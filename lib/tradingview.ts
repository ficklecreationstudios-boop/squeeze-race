type Row=Record<string,any>;
const URL="https://scanner.tradingview.com/global/scan";
const exchanges=["NASDAQ","NYSE","AMEX"];
const TIMEOUT_MS=7000;
async function post(body:unknown){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
 try{const r=await fetch(URL,{method:"POST",headers:{"content-type":"application/json","accept":"application/json","User-Agent":"Squeeze-Race/1.0"},body:JSON.stringify(body),cache:"no-store",signal:controller.signal});if(!r.ok)throw new Error("TradingView scanner HTTP "+r.status);return await r.json();}
 finally{clearTimeout(timer)}
}
export async function getTradingViewFundamentals(tickers:string[]){
 if(!tickers.length)return new Map();
 const symbols=exchanges.flatMap(e=>tickers.map(t=>e+":"+t));
 const j=await post({symbols:{tickers:symbols,query:{types:[]}},columns:["name","close","volume","market_cap_basic","float_shares_outstanding_current"],range:[0,symbols.length]});
 const out=new Map<string,{price:number|null;volume:number|null;marketCap:number|null;float:number|null;exchange:string|null;source:string;observedAt:number|null;freshness:"SNAPSHOT"}>();
 for(const row of (j.data||[]) as Row[]){
  const parts=String(row.s||"").split(":");const ticker=(parts.pop()||"").toUpperCase();const exchange=parts[0]||null;const d=Array.isArray(row.d)?row.d:[];
  const candidate={price:Number.isFinite(Number(d[1]))?Number(d[1]):null,volume:Number.isFinite(Number(d[2]))?Number(d[2]):null,marketCap:Number.isFinite(Number(d[3]))?Number(d[3])/1e6:null,float:Number.isFinite(Number(d[4]))?Number(d[4]):null,exchange,source:"TradingView public scanner",observedAt:null,freshness:"SNAPSHOT" as const};
  const old=out.get(ticker);
  if(!old||(old.price===null&&candidate.price!==null)||(old.float===null&&candidate.float!==null))out.set(ticker,candidate);
 }
 return out;
}
