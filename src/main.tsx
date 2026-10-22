import {createRoot} from 'react-dom/client';
import {TideCloakContextProvider} from '@tidecloak/react';
import {useEffect,useState} from 'react';
import App from './App';
import type {Config} from './types';
import './styles.css';
function Bootstrap(){
 const [config,setConfig]=useState<Config|null>(null),[error,setError]=useState('');
 useEffect(()=>{const a=new AbortController();fetch('/api/config',{signal:a.signal}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(setConfig).catch(e=>{if(e.name!=='AbortError')setError('Start both local services with npm run dev, then retry.');});return()=>a.abort();},[]);
 if(error)return <main className="boot"><div className="brandmark">c</div><h1>Let’s reconnect.</h1><p>{error}</p><button className="button primary" onClick={()=>location.reload()}>Retry connection</button></main>;
 if(!config)return <main className="boot"><div className="brandmark">c</div><p>Opening your bidding room…</p></main>;
 if(!config.configured)return <App config={config}/>;
 return <TideCloakContextProvider config={config.adapter!}><App config={config} connected/></TideCloakContextProvider>;
}
createRoot(document.getElementById('root')!).render(<Bootstrap/>);
