export async function simulationApi<T>(path:string,init:RequestInit={}):Promise<T>{
 const response=await fetch('/api/simulation'+path,{...init,credentials:'same-origin',headers:{'Content-Type':'application/json',...init.headers}});
 const data=await response.json();
 if(!response.ok){if(response.status===401)window.dispatchEvent(new Event('cobid:simulation-expired'));throw Error(data.error||'The simulation request failed.');}
 return data;
}
