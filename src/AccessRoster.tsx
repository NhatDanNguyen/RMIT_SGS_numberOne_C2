import {useEffect,useState} from 'react';
import {ExternalLink,RefreshCw} from 'lucide-react';
import {IAMService} from '@tidecloak/js';
import {accessRole} from './lib/tide';
import type {Config} from './types';
import {simulationApi} from './lib/simulation';

type Person={id:string;username?:string;enabled?:boolean};
type Entry=Person&{canDecrypt:boolean};

export default function AccessRoster({supplier,config}:{supplier:string;config:Config}){
 const [entries,setEntries]=useState<Entry[]|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();let active=true;
  setLoading(true);setError('');setEntries(null);
  if(config.mode==='simulation'){
   void simulationApi<{entries:Entry[]}>('/access/'+supplier,{signal:controller.signal}).then(data=>{if(active)setEntries(data.entries);}).catch(e=>{if(active&&e.name!=='AbortError')setError(e.message);}).finally(()=>{if(active)setLoading(false);});
   return()=>{active=false;controller.abort();};
  }
  const adapter=config.adapter!;
  const root=String(adapter['auth-server-url']).replace(/\/+$/,'')+'/admin/realms/'+encodeURIComponent(String(adapter.realm));
  async function get(path:string){
   const response=await IAMService.secureFetch(root+path,{signal:controller.signal});
   if(!response.ok)throw Error('Live access listing requires permission to view users in TideCloak. Open the console to inspect role membership.');
   return response.json();
  }
  void (async()=>{
   const users:Person[]=[];
   for(let first=0;first<1000;first+=100){
    const batch=await get('/roles/'+encodeURIComponent(accessRole(supplier))+'/users?first='+first+'&max=100') as Person[];
    if(!Array.isArray(batch))throw Error('TideCloak returned an unexpected role member response.');
    users.push(...batch);if(batch.length<100)break;
    if(first===900)throw Error('This list is too large for the demo. Inspect all access in TideCloak.');
   }
   const result:Entry[]=[];
   for(const user of users){
    const roles=await get('/users/'+encodeURIComponent(user.id)+'/role-mappings/realm/composite') as {name:string}[];
    if(!Array.isArray(roles))throw Error('TideCloak returned an unexpected role response.');
    result.push({...user,canDecrypt:roles.some(role=>role.name==='_tide_decryptor')});
   }
   if(active)setEntries(result);
  })().catch(e=>{if(active&&e.name!=='AbortError')setError(e.message);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;controller.abort();};
 },[supplier,config,revision]);
 return <section className="access-roster"><div className="section-heading"><div><h3>Quote role members</h3><p>{config.mode==='simulation'?'Current roles in the local simulator.':'Read directly from TideCloak using your administrator session.'}</p></div><button className="button secondary small" disabled={loading} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={14}/>Refresh</button></div>
 {loading&&<p role="status">Checking live role membership…</p>}
 {error&&<div className="alert" role="alert">{error}</div>}
 {entries?.length===0&&<p>No directly listed role members.</p>}
 {entries?.map(person=><div className="access-person" key={person.id}><div><strong>{person.username||person.id}</strong><small>{person.id}</small></div><span className={'pill '+(person.enabled!==false&&person.canDecrypt?'green':'neutral')}>{person.enabled===false?'Account disabled':person.canDecrypt?'Decrypt role present':'Decrypt role missing'}</span></div>)}
 <p className="fine-print">{config.mode==='simulation'?'Simulated role membership only. Switch to the recipient and refresh access after approval. No Tide identity or cryptographic checks run in this mode.':'This role-members endpoint is a directory snapshot, not proof of a successful decrypt. Check inherited group/composite access in the console. Existing tokens can retain old claims until refreshed or expired; a valid signed quote policy and Tide network approval are also required.'}</p>
 {config.mode!=='simulation'&&<a className="text-link" href={config.consoleUrl} target="_blank" rel="noreferrer">Inspect all access in TideCloak<ExternalLink size={14}/></a>}</section>;
}
