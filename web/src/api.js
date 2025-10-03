let latestId=0; let inFlight; let consecutiveFailures=0; let breakerUntil=0;
const cache=new Map(); const API_BASE= import.meta.env.VITE_API_BASE || '/api';
function timeoutFetch(resource,options={}){ const {timeout=15000,signal}=options; const c=new AbortController(); const t=setTimeout(()=>c.abort(),timeout);
  if(signal){ if(signal.aborted) c.abort(); signal.addEventListener('abort',()=>c.abort(),{once:true}); }
  return fetch(resource,{...options,signal:c.signal}).finally(()=>clearTimeout(t));
}
export async function getNeos(date){
  const now=Date.now(); if(breakerUntil>now){ const remaining=Math.ceil((breakerUntil-now)/1000); const e=new Error(`Circuit open; retry in ${remaining}s`); e.code='CIRCUIT_OPEN'; throw e; }
  const cached=cache.get(date);
  if(cached && (now-cached.fetchedAt)<15*60*1000){
    refresh(date).then(fresh=>{ window.dispatchEvent(new CustomEvent('neos:revalidated',{detail:{date,fresh}}))}).catch(()=>{});
    return {...cached, cache:'HIT'};
  }
  return await refresh(date);
}
async function refresh(date){
  if(inFlight) inFlight.abort(); const ctrl=new AbortController(); inFlight=ctrl; const id=++latestId;
  try{
    const res=await timeoutFetch(`${API_BASE}/neos?date=${encodeURIComponent(date)}`,{timeout:15000,signal:ctrl.signal});
    if(id!==latestId) throw Object.assign(new Error('Stale response'),{stale:true});
    const ct=(res.headers.get('content-type')||'').toLowerCase(); const looksJson=ct.includes('application/json')||ct.includes('json');
    if(!looksJson){ const text=await res.text().catch(()=>'');
      const err=new Error('Expected JSON but received HTML. Is the API running / proxy configured?'); err.code='BAD_CONTENT_TYPE'; err.sample=text.slice(0,120); err.status=res.status; throw err; }
    if(!res.ok){ let payload={}; try{ payload=await res.json() }catch{}; const err=new Error(payload.message||res.statusText); err.code=payload.code||`HTTP_${res.status}`; if(payload.retryAfterSec) err.retryAfterSec=payload.retryAfterSec; throw err; }
    const json=await res.json(); cache.set(date,{...json,fetchedAt:Date.now()}); consecutiveFailures=0; return {...json,fetchedAtMs:Date.now()}
  }catch(e){
    if(id!==latestId || e.name==='AbortError' || e.stale) throw e;
    consecutiveFailures++; if(consecutiveFailures>=3){ breakerUntil=Date.now()+2*60*1000; }
    const cached=cache.get(date); if(cached){ return {...cached, stale:true, error:e.message, cache:'STALE'} }
    throw e;
  }finally{ if(id===latestId) inFlight=null; }
}
