import {useEffect,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';
export function PageTitle({eyebrow,title,subtitle}:{eyebrow:string;title:string;subtitle:string}){return <div className="page-heading tall"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div></div>}
export function Empty({icon,title,text}:{icon:ReactNode;title:string;text:string}){return <div className="empty"><div>{icon}</div><h3>{title}</h3><p>{text}</p></div>}
export function Metric({icon,value,label,detail}:{icon:ReactNode;value:string;label:string;detail:string}){return <div className="metric"><div className="metric-icon">{icon}</div><div><div className="metric-value">{value}<span>{label}</span></div><p>{detail}</p></div></div>}
export function SetupStep({n,title,children}:{n:string;title:string;children:ReactNode}){return <div className="setup-step"><span>{n}</span><div><h3>{title}</h3>{children}</div></div>}
export function Modal({title,close,children}:{title:string;close:()=>void;children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const d=dialog.current;d?.showModal();const handler=(e:Event)=>{e.preventDefault();close();};d?.addEventListener('cancel',handler);return()=>{d?.removeEventListener('cancel',handler);d?.close();};},[]);
 return <dialog ref={dialog} className="modal" onClick={e=>{if(e.target===e.currentTarget)close();}} aria-label={title}><div className="modal-header"><strong>{title}</strong><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={20}/></button></div><div className="modal-body">{children}</div></dialog>;
}
export const time=(v:string)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v));
export const money=(n:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(n);
