type Bar={t:number;c:number;v:number};
type YahooQuote={close?:Array<number|null>;volume?:Array<number|null>};
type YahooChart={chart?:{result?:Array<{timestamp?:number[];indicators?:{quote?:YahooQuote[]}}>}};

const HOSTS=["query1.finance.yahoo.com","query2.finance.yahoo.com"];
const TIMEOUT_MS=4000;
const MAX_CONCURRENCY=6;

async function yahoo1m(ticker:string){
  let last:unknown=null;
  for(const host of HOSTS){
    const c=new AbortController(),timer=setTimeout(()=>c.abort(),TIMEOUT_MS);
    try{
      const u="https://"+host+"/v8/finance/chart/"+encodeURIComponent(ticker)+"?interval=1m&range=1d&includePrePost=false";
      const r=await fetch(u,{cache:"no-store",headers:{"User-Agent":"Squeeze-Race/1.0"},signal:c.signal});
      if(!r.ok)throw new Error("Yahoo 1m HTTP "+r.status);
      return await r.json() as YahooChart;
    }catch(e){last=e}finally{clearTimeout(timer)}
  }
  throw last||new Error("Yahoo 1m unavailable");
}

function bars(j:YahooChart):Bar[]{
  const x=j.chart?.result?.[0],q=x?.indicators?.quote?.[0],ts=x?.timestamp||[];
  if(!q)return[];
  return ts.map((t,i)=>({t:t*1000,c:Number(q.close?.[i]??NaN),v:Number(q.volume?.[i]??0)}))
    .filter(x=>Number.isFinite(x.c)&&Number.isFinite(x.v));
}

function rth(ts:number){
  const p=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",hour12:false,hour:"2-digit",minute:"2-digit"}).formatToParts(ts);
  const h=Number(p.find(x=>x.type==="hour")?.value||0),m=Number(p.find(x=>x.type==="minute")?.value||0);
  const mins=h*60+m; return mins>=570&&mins<960;
}

async function mapLimit<T,R>(items:T[],limit:number,fn:(x:T)=>Promise<R>):Promise<R[]>{
  const out:R[]=[];let next=0;
  async function worker(){while(true){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i]);}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return out;
}

export type RealtimeTechnical={
  ticker:string;price:number|null;volume:number|null;observedAt:number|null;
  freshness:"LIVE"|"SNAPSHOT"|"UNAVAILABLE";source:string;
  sessionVolume:number|null;barsToday:number;volumeRate:number|null;
};

export async function getRealtimeTechnical(tickers:string[]):Promise<RealtimeTechnical[]>{
  const now=Date.now();
  return mapLimit(tickers,MAX_CONCURRENCY,async ticker=>{
    try{
      const b=bars(await yahoo1m(ticker)).filter(x=>rth(x.t));
      const latest=b.at(-1)??null;
      const todayKey=new Date(now).toLocaleDateString("en-US",{timeZone:"America/New_York"});
      const today=b.filter(x=>new Date(x.t).toLocaleDateString("en-US",{timeZone:"America/New_York"})===todayKey);
      const observedAt=latest?.t??null;
      const age=observedAt===null?Infinity:Math.max(0,now-observedAt);
      const sessionVolume=today.length?today.reduce((a,x)=>a+x.v,0):null;
      const volumeRate=today.length>=2&&sessionVolume!==null?sessionVolume/Math.max(1,(now-(today[0].t))/60000):null;
      return {ticker,price:latest?.c??null,volume:latest?.v??null,observedAt,
        freshness:age<=2*60*1000?"LIVE":age<=30*60*1000?"SNAPSHOT":"UNAVAILABLE",
        source:"Yahoo Finance 1m chart (keyless)",sessionVolume,barsToday:today.length,volumeRate};
    }catch{
      return {ticker,price:null,volume:null,observedAt:null,freshness:"UNAVAILABLE",source:"Yahoo Finance 1m chart (keyless)",sessionVolume:null,barsToday:0,volumeRate:null};
    }
  });
}
