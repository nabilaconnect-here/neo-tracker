import express from 'express';
import morgan from 'morgan';
import * as dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import { fetchNeosForDate } from './src/proxy.js';
import { postSlack } from './src/slack.js';
import { initSentry } from './src/sentry.js';

dotenv.config();
const app=express();
const PORT=process.env.PORT||8787;
const NASA_API_KEY=process.env.NASA_API_KEY;
const SENTRY_DSN=process.env.SENTRY_DSN||'';
const SLACK_WEBHOOK_URL=process.env.SLACK_WEBHOOK_URL||'';
const ALLOWED_ORIGINS=(process.env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
const Sentry = initSentry(SENTRY_DSN);

app.use(helmet({contentSecurityPolicy:false}));
app.use(compression());
app.use(morgan('combined'));

app.use((req,res,next)=>{
  const o=req.headers.origin;
  if(!ALLOWED_ORIGINS.length){ res.setHeader('Access-Control-Allow-Origin', o || 'http://localhost:5173'); }
  else if(ALLOWED_ORIGINS.includes(o)){ res.setHeader('Access-Control-Allow-Origin', o); }
  res.setHeader('Vary','Origin'); next();
});

const hits=new Map();
app.use('/api/',(req,res,next)=>{
  const ip=req.ip||req.headers['x-forwarded-for']||'unknown';
  const now=Date.now(); const arr=hits.get(ip)||[]; const recent=arr.filter(t=>now-t<60000); recent.push(now); hits.set(ip,recent);
  if(recent.length>120){ res.setHeader('Content-Type','application/json; charset=utf-8'); return res.status(429).json({code:'RATE_LIMIT',message:'Too many requests'}); }
  next();
});

let failureWindow=[]; const FAILURE_THRESHOLD=10; const FAILURE_WINDOW_MS=5*60*1000; let lastAlertAt=0;
function recordFailure(){ const now=Date.now(); failureWindow.push(now); failureWindow=failureWindow.filter(ts=>now-ts<FAILURE_WINDOW_MS);
  if(failureWindow.length>=FAILURE_THRESHOLD && now-lastAlertAt>10*60*1000){ lastAlertAt=now; postSlack(SLACK_WEBHOOK_URL,{text:`NEO API proxy: High failure rate: ${failureWindow.length} errors in last 5 min.`}); } }

app.get('/api/neos', async (req,res)=>{
  try{
    const date=String(req.query.date||'');
    if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)){ res.setHeader('Content-Type','application/json; charset=utf-8'); return res.status(400).json({code:'BAD_REQUEST',message:'date must be YYYY-MM-DD'}); }
    if(!NASA_API_KEY){ res.setHeader('Content-Type','application/json; charset=utf-8'); return res.status(500).json({code:'MISSING_API_KEY',message:'NASA_API_KEY not configured'}); }
    const t0=Date.now(); const result=await fetchNeosForDate({dateUTC:date,apiKey:NASA_API_KEY,timeoutMs:10000,retries:2}); const duration=Date.now()-t0;
    if(result.error){
      const code=result.error.code||'UPSTREAM_ERROR'; if(Sentry) Sentry.captureMessage(`NEO proxy error ${code}`,{level:'warning',extra:{code,date,duration,error:result.error}}); recordFailure();
      let status=502; if(code==='UPSTREAM_RATE_LIMIT') status=429; if(code==='UPSTREAM_TIMEOUT') status=504; if(code==='BAD_UPSTREAM_REQUEST') status=502;
      res.setHeader('Cache-Control','no-store'); res.setHeader('Content-Type','application/json; charset=utf-8'); return res.status(status).json({...result.error,date});
    }
    const payload={date,items:result.data.items,fetchedAt:new Date().toISOString(),cache:'MISS'};
    console.log(JSON.stringify({event:'neos_fetch',date,duration_ms:duration,items:payload.items.length}));
    res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=600'); res.setHeader('Content-Type','application/json; charset=utf-8'); return res.json(payload);
  }catch(e){ if(Sentry) Sentry.captureException(e); recordFailure(); res.setHeader('Cache-Control','no-store'); res.setHeader('Content-Type','application/json; charset=utf-8'); return res.status(500).json({code:'PROXY_INTERNAL_ERROR',message:String(e)}); }
});

app.listen(PORT,()=>{ console.log(`[neo-proxy] listening on http://localhost:${PORT}`) });
