import {useEffect,useState,type ReactNode} from 'react';
import {ArrowRight,Building2,ShieldCheck} from 'lucide-react';
import {simulationPeople} from '../shared/simulation.mjs';
import {simulationApi} from './lib/simulation';
import {Modal} from './ui';
import type {Member} from './types';
import type {Session} from './App';

export default function SimulationSession({children}:{children:(session:Session)=>ReactNode}){
 const [member,setMember]=useState<Member|null>(null),[loading,setLoading]=useState(true),[picker,setPicker]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  void simulationApi<{member:Member|null}>('/session').then(data=>{if(active)setMember(data.member);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
  const expire=()=>{setMember(null);setError('Your simulated session expired. Choose a demo identity again.');};
  window.addEventListener('cobid:simulation-expired',expire);
  return()=>{active=false;window.removeEventListener('cobid:simulation-expired',expire);};
 },[]);
 async function select(identity:string){
  setBusy(true);setError('');setMember(null);
  try{const data=await simulationApi<{member:Member}>('/session',{method:'POST',body:JSON.stringify({identity})});setMember(data.member);setPicker(false);}
  catch(e){setError(e instanceof Error?e.message:'Could not select the demo identity.');}
  finally{setBusy(false);}
 }
 const session:Session={authenticated:!!member,loading,error,sub:member?.sub||'',name:member?.name||'Demo visitor',roles:member?.roles||[],
  login:async()=>{setError('');setPicker(true);},
  logout:async()=>{await simulationApi('/logout',{method:'POST',body:'{}'});setMember(null);setError('');},
  refresh:async()=>{const data=await simulationApi<{member:Member}>('/refresh',{method:'POST',body:'{}'});setMember(data.member);return data.member;},
 };
 return <>{children(session)}{picker&&<Modal title="Choose a simulated identity" close={()=>{if(!busy)setPicker(false);}}>
  <div className="simulation-label">LOCAL SIMULATION</div><h2>Step into the bidding team.</h2><p>These are fictional demo accounts. Choosing one simulates sign-in and loads its roles. No Tide account or password is used.</p>
  {error&&<div className="alert error" role="alert">{error}</div>}
  <div className="identity-grid">{simulationPeople.map(person=><button className="identity-card" key={person.id} disabled={busy} onClick={()=>void select(person.id)}>
   <span className="identity-icon">{person.roles.includes('tide-realm-admin')?<ShieldCheck size={20}/>:<Building2 size={20}/>}</span>
   <span><strong>{person.name}</strong><small>{person.context}</small></span><ArrowRight size={16}/>
  </button>)}</div>
  <p className="fine-print">Start as Jordan to try a denied quote, or Alex to open Forma’s example. Switch identities to rehearse independent approvals; this models the workflow, not real identity assurance.</p>
 </Modal>}</>;
}
