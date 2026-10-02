type ScanRow={s?:string;d?:unknown[]};
const URL="https://scanner.tradingview.com/global/scan"; const TIMEOUT_MS=8000;
export type Candidate={ticker:string;exchange:string|null;price:number|null;volume:number|null;marketCap:number|null;float:number|null;relativeVolume:number|null;source:string;observedAt:number};

async function scan(body:unknown){const c=new AbortController(),timer=setTimeout(()=>c.abort(),TIMEOUT_MS);try{const r=await fetch(URL,{method:"POST",headers:{"content-type":"application/json","accept":"application/json","User-Agent":"Squeeze-Race/1.0"},body:JSON.stringify(body),cache:"no-store",signal:c.signal});if(!r.ok)throw new Error("TradingView scanner HTTP "+r.status);return await r.json();}finally{clearTimeout(timer);}}
export async function discoverCandidates(limit=100):Promise<Candidate[]>{
  const j=await scan({filter:[
    {left:"market_cap_basic",operation:"greater",right:10000000},
    {left:"market_cap_basic",operation:"less",right:5000000000},
    {left:"close",operation:"greater",right:1},
    {left:"volume",operation:"greater",right:100000}
  ],options:{lang:"en"},symbols:{query:{types:["stock"]},tickers:[]},
  columns:["name","close","volume","market_cap_basic","float_shares_outstanding_current","relative_volume_10d_calc"],
  sort:{sortBy:"volume",sortOrder:"desc"},range:[0,Math.min(Math.max(limit,25),200)]});
  const now=Date.now(),out:Candidate[]=[];
  for(const row of (j.data||[]) as ScanRow[]){const parts=String(row.s||"").split(":"),ticker=parts.pop()?.toUpperCase()||"";if(!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker))continue;const d=Array.isArray(row.d)?row.d:[],n=(i:number)=>Number.isFinite(Number(d[i]))?Number(d[i]):null;out.push({ticker,exchange:parts[0]||null,price:n(1),volume:n(2),marketCap:n(3),float:n(4),relativeVolume:n(5),source:"TradingView public scanner",observedAt:now});}
  const unique=new Map<string,Candidate>();for(const c of out)if(!unique.has(c.ticker))unique.set(c.ticker,c);return [...unique.values()];
}
