import {WATCHLIST} from "./config";
import {evaluate,Signal} from "./rules";
const POLYGON="https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers";
type P=any;
export async function getMarket():Promise<{signals:Signal[];source:string;timestamp:number;live:boolean;error?:string}>{
 const key=process.env.POLYGON_API_KEY;
 const now=Date.now();
 if(!key){
   return {signals:WATCHLIST.map(x=>evaluate({...x,price:x.breakout*.88,rvol:1,freshness:"DEMO",updatedAt:now,provider:"demo"})).map((phase,i)=>({...WATCHLIST[i],price:WATCHLIST[i].breakout*.88,rvol:1,phase,updatedAt:now,freshness:"DEMO",provider:"demo"})),source:"demo",timestamp:now,live:false,error:"POLYGON_API_KEY is not configured"};
 }
 try{
   const symbols=WATCHLIST.map(x=>x.ticker).join(",");
   const res=await fetch(POLYGON+"?tickers="+encodeURIComponent(symbols)+"&apiKey="+encodeURIComponent(key),{cache:"no-store"});
   if(!res.ok) throw new Error("Polygon HTTP "+res.status);
   const json=await res.json();
   const by=new Map<string,P>(json.tickers?.map((x:P)=>[x.ticker,x])||[]);
   const signals=WATCHLIST.map(x=>{
     const p=by.get(x.ticker);
     const price=Number(p?.lastTrade?.p ?? p?.day?.c ?? x.breakout*.88);
     const volume=Number(p?.day?.v ?? 0);
     const prevVolume=Number(p?.prevDay?.v ?? 0);
     const rvol=prevVolume>0?volume/prevVolume:1;
     const updated=Number(p?.updated ?? p?.lastTrade?.t ?? now);
     const base={...x,price,rvol,freshness:p?"LIVE":"MISSING",updatedAt:updated,provider:"polygon"};
     return {...base,phase:evaluate(base)};
   });
   return {signals,source:"Polygon snapshot",timestamp:now,live:true};
 }catch(e){
   return {signals:WATCHLIST.map(x=>({...x,price:x.breakout*.88,rvol:1,phase:evaluate({...x,price:x.breakout*.88,rvol:1,freshness:"STALE",updatedAt:now,provider:"fallback"}),freshness:"STALE",updatedAt:now,provider:"fallback"})),source:"fallback",timestamp:now,live:false,error:e instanceof Error?e.message:"market provider failed"};
 }
}
