import { IAMService } from '@tidecloak/js';
import { Models } from '@tideorg/js';
import { PolicySignRequest } from 'heimdall-tide';
import { hasRole } from '../../shared/access.mjs';
import { encodeSimulationQuote,decodeSimulationQuote,simulationPolicy } from '../../shared/simulation.mjs';
let simulation=false;
export function configureIntegration(mode:'tide'|'simulation'){simulation=mode==='simulation';}
export const recordId=(id:string)=>'cobid-quote-'+id+'-v1';
export const accessRole=(id:string)=>'cobid-quote-'+id;
export const toBase64=(bytes:Uint8Array)=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);};
export const fromBase64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function authenticatedFetch(path:string,init:RequestInit={}){
 if(simulation)return fetch(path,{...init,credentials:'same-origin',headers:{'Content-Type':'application/json',...init.headers}});
 const token=await IAMService.getToken();if(!token)throw Error('Sign in with TideCloak to continue.');
 const headers=new Headers(init.headers);headers.set('Content-Type','application/json');
 return IAMService.secureFetch(new URL(path,window.location.origin),{...init,headers});
}
export async function api<T>(path:string,init:RequestInit={}):Promise<T>{const r=await authenticatedFetch(path,init);const d=await r.json();if(!r.ok){if(simulation&&r.status===401)window.dispatchEvent(new Event('cobid:simulation-expired'));throw Error(d.error||'The request failed.');}return d;}
export async function encryptQuote(value:unknown,id:string,policy:string){
 if(simulation)return {ciphertext:encodeSimulationQuote(value,recordId(id)),format:'string' as const};
 const [out]=await IAMService.doEncrypt([{data:JSON.stringify(value),tags:[recordId(id)]}],fromBase64(policy));
 if(!out)throw Error('Tide returned no encrypted data.');
 return typeof out==='string'?{ciphertext:out,format:'string' as const}:{ciphertext:toBase64(out),format:'bytes' as const};
}
export async function decryptQuote(d:{ciphertext:string;format:string;recordId:string;policy:string}){
 let v;
 if(simulation)v=decodeSimulationQuote(d.ciphertext,d.recordId);
 else{const [out]=await IAMService.doDecrypt([{encrypted:d.format==='bytes'?fromBase64(d.ciphertext):d.ciphertext,tags:[d.recordId]}],fromBase64(d.policy));v=JSON.parse(typeof out==='string'?out:new TextDecoder().decode(out));}
 if(typeof v.amount!=='number'||!Number.isFinite(v.amount)||typeof v.note!=='string'||typeof v.timeline!=='string'||typeof v.currency!=='string')throw Error('The decrypted quote has an unexpected format.');
 return v;
}
interface SigningClient{
 createTideRequest(r:Uint8Array):Promise<Uint8Array>;
 requestTideOperatorApproval(r:{id:string;request:Uint8Array}[]):Promise<{id:string;request:Uint8Array;status:string}[]>;
 executeSignRequest(r:Uint8Array,wait?:boolean):Promise<Uint8Array[]>;
}
// Browser-only, based on Tide's RelationshipAttestation reference; no fake signing fallback.
export async function signQuotePolicy(id:string,adapter:Record<string,unknown>){
 if(simulation)return simulationPolicy(id);
 if(!hasRole({realm_access:IAMService.getValueFromToken('realm_access'),resource_access:IAMService.getValueFromToken('resource_access')},'tide-realm-admin'))throw Error('An enrolled governance administrator must sign the policy.');
 const root=String(adapter['auth-server-url']).replace(/\/+$/,'')+'/admin/realms/'+encodeURIComponent(String(adapter.realm));
 const token=await IAMService.getToken();if(!token)throw Error('Sign in again.');
 const r=await IAMService.secureFetch(root+'/iga/role-policies/name/tide-realm-admin',{headers:{Authorization:'Bearer '+token}});
 if(!r.ok)throw Error('Cannot read the realm admin policy. Check enrolment and client admin scopes.');
 const admin=await r.json();if(typeof admin.policy!=='string')throw Error('The realm admin policy is missing or unsigned.');
 const policy=new Models.Policy({version:Models.Policy.latestVersion,contractId:'RelationshipAttestation:1',modelId:['PolicyEnabledEncryption:1','PolicyEnabledDecryption:1'],keyId:String(adapter.vendorId),approvalType:Models.ApprovalType.IMPLICIT,executionType:Models.ExecutionType.PRIVATE,params:new Map([['subjectType','Role'],['subjectId',accessRole(id)],['assignmentId',recordId(id)],['roles',JSON.stringify(['_tide_encryptor','_tide_decryptor'])]])});
 const tc=IAMService._tc as unknown as SigningClient;if(!tc)throw Error('Tide has not initialised.');
 const request=PolicySignRequest.New(policy);request.setCustomExpiry(604800);
 const initialised=await tc.createTideRequest(request.encode());const requestId=Models.BaseTideRequest.decode(initialised).getUniqueId();
 const [approved]=await tc.requestTideOperatorApproval([{id:requestId,request:initialised}]);
 if(approved?.status!=='approved')throw Error('Policy signing was not approved. No policy saved.');
 const signedRequest=Models.BaseTideRequest.decode(approved.request);signedRequest.addPolicy(fromBase64(admin.policy));
 const signatures=await tc.executeSignRequest(signedRequest.encode(),true);
 if(signatures?.[0]?.length!==64)throw Error('The network did not return a valid-length signature.');
 policy.signature=signatures[0];return toBase64(policy.toBytes());
}
