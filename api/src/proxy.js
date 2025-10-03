import { fetch as undiciFetch } from 'undici';
import { riskScore } from './risk.js';
const sleep = (ms)=>new Promise(res=>setTimeout(res,ms));
function averageFeetDiameter(ed){const f=ed?.feet;if(!f) return null;const a=Number(f.estimated_diameter_min),b=Number(f.estimated_diameter_max);return (isFinite(a)&&isFinite(b))?((a+b)/2):null}
function pickApproachForDate(arr,dateUTC){if(!Array.isArray(arr)||!arr.length) return null;return arr.find(a=>a.close_approach_date===dateUTC)||arr[0]}
function mph(ap){const s=ap?.relative_velocity?.miles_per_hour;const n=s!=null?Number(s):null;return isFinite(n)?n:null}
function missMiles(ap){const s=ap?.miss_distance?.miles;const n=s!=null?Number(s):null;return isFinite(n)?n:null}
function normalize(dateUTC,json){
  const items=json?.near_earth_objects?.[dateUTC]||[];
  return items.map(o=>{const ap=pickApproachForDate(o.close_approach_data,dateUTC);
    const diameterFt=averageFeetDiameter(o.estimated_diameter);
    const speedMph=mph(ap); const distanceMiles=missMiles(ap);
    return { id:o.id, name:o.name, diameterFt, speedMph, distanceMiles,
      hazardous:!!o.is_potentially_hazardous_asteroid, nasaJplUrl:o.nasa_jpl_url||o.links?.self||null,
      riskScore: riskScore({diameterFt,speedMph,distanceMiles})
    };
  });
}
export async function fetchNeosForDate({dateUTC,apiKey,timeoutMs=10000,retries=2}){
  const url=new URL('https://api.nasa.gov/neo/rest/v1/feed'); url.searchParams.set('start_date',dateUTC); url.searchParams.set('end_date',dateUTC); url.searchParams.set('api_key',apiKey);
  let attempt=0,lastErr;
  while(attempt<=retries){
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const res=await undiciFetch(url.toString(),{signal:controller.signal}); clearTimeout(timer);
      if(res.status===429){const retryAfter=Number(res.headers.get('retry-after')||60); return {error:{code:'UPSTREAM_RATE_LIMIT',retryAfterSec:retryAfter}}}
      if(res.status>=400 && res.status<500){const text=await res.text(); return {error:{code:'BAD_UPSTREAM_REQUEST',status:res.status,message:text.slice(0,500)}}}
      if(res.status>=500) throw new Error('NASA 5xx '+res.status);
      const json=await res.json(); const items=normalize(dateUTC,json); return {data:{date:dateUTC,items}};
    }catch(err){
      lastErr=err; if(attempt==retries) break; const backoff=Math.round(300*(2**attempt)*(1+Math.random())); await sleep(backoff); attempt++; continue;
    }
  }
  const timeout=lastErr?.name==='AbortError'; return {error:{code:timeout?'UPSTREAM_TIMEOUT':'UPSTREAM_ERROR',message:String(lastErr)}};
}
