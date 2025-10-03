import { fetch as undiciFetch } from 'undici';
export async function postSlack(url,payload){ if(!url) return; try{ await undiciFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});}catch(e){ console.error('[slack] post failed',e.message)}}
