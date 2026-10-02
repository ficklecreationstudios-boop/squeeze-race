import {getFinraShortInterest,getFinraShortVolume} from "./finra";
import {getIBorrowDesk} from "./borrow";
import {getFtd} from "./ftd";
const BORROW_CACHE_MS=5*60*1000;
const borrowCache=new Map<string,{at:number;v:Awaited<ReturnType<typeof getIBorrowDesk>>}>();
const borrowInflight=new Map<string,Promise<Awaited<ReturnType<typeof getIBorrowDesk>>>>();
async function cachedBorrow(ticker:string,exchange?:string|null){
 const key=ticker.toUpperCase();const c=borrowCache.get(key);if(c&&Date.now()-c.at<BORROW_CACHE_MS)return c.v;
 const pending=borrowInflight.get(key);if(pending)return pending;
 const p=getIBorrowDesk(ticker,exchange).finally(()=>borrowInflight.delete(key));borrowInflight.set(key,p);
 const v=await p;if(v.freshness!=="UNAVAILABLE")borrowCache.set(key,{at:Date.now(),v});return v;
}
export type ShortBundle={si:number|null;siRaw:number|null;siQuality:"OK"|"ANOMALOUS_RATIO"|"UNAVAILABLE";siChangePct:number|null;dtc:number|null;ctb:number|null;avail:number|null;ftd:number|null;svd:number|null;float:number|null;marketCap:number|null;price:number|null;volume:number|null;sources:Record<string,{value:number|null;source:string;observedAt:number|null;freshness:"SNAPSHOT"|"LAGGED"|"LIVE"|"UNAVAILABLE"}>};
export async function getShortBundle(ticker:string,tv?:Map<string,{price:number|null;volume:number|null;marketCap:number|null;float:number|null;exchange:string|null;source:string;observedAt:number|null;freshness:"SNAPSHOT"}>):Promise<ShortBundle>{
 const empty=(source:string)=>({value:null,source,observedAt:null,freshness:"UNAVAILABLE" as const});
 const out:ShortBundle={si:null,siRaw:null,siQuality:"UNAVAILABLE",siChangePct:null,dtc:null,ctb:null,avail:null,ftd:null,svd:null,float:null,marketCap:null,price:null,volume:null,sources:{si:empty("FINRA Consolidated Short Interest"),dtc:empty("FINRA Consolidated Short Interest"),ctb:empty("Borrow provider"),avail:empty("Borrow provider"),ftd:empty("SEC CNS fails-to-deliver data"),svd:empty("FINRA Reg SHO Daily Short Sale Volume"),float:empty("TradingView public scanner"),marketCap:empty("TradingView public scanner")}};
 const [si,sv,ftd]=await Promise.all([getFinraShortInterest(ticker).catch(()=>null),getFinraShortVolume(ticker).catch(()=>null),getFtd(ticker).catch(()=>null)]);
 const f=tv?.get(ticker)??null;const borrow=await cachedBorrow(ticker,f?.exchange??null).catch(()=>null);
 if(si){
  out.dtc=si.dtc;out.siChangePct=si.shortChangePct??null;out.sources.dtc={value:si.dtc,source:si.source+" (recomputed from current short / FINRA ADV)",observedAt:si.observedAt,freshness:si.freshness};
  if(si.sharesShort!==null&&f?.float&&f.float>0){const raw=si.sharesShort/f.float*100;out.siRaw=raw;if(raw>100){out.si=null;out.siQuality="ANOMALOUS_RATIO";out.sources.si={value:raw,source:si.source+" + TradingView float (anomalous SI/float ratio; excluded from classification)",observedAt:Math.min(si.observedAt,f.observedAt),freshness:"SNAPSHOT"}}else{out.si=raw;out.siQuality="OK";out.sources.si={value:raw,source:si.source+" + TradingView float",observedAt:Math.min(si.observedAt,f.observedAt),freshness:"SNAPSHOT"}}}
  else out.sources.si={value:si.sharesShort,source:si.source+" (shares; float denominator separate)",observedAt:si.observedAt,freshness:si.freshness};
 }
 if(sv){out.svd=sv.svd;out.sources.svd={value:sv.svd,source:sv.source,observedAt:sv.observedAt,freshness:sv.freshness}}
 if(borrow){out.ctb=borrow.fee;out.avail=borrow.available;out.sources.ctb={value:borrow.fee,source:borrow.source,observedAt:borrow.observedAt,freshness:borrow.freshness};out.sources.avail={value:borrow.available,source:borrow.source,observedAt:borrow.observedAt,freshness:borrow.freshness}}
 if(ftd&&ftd.shares!==null&&f?.float&&f.float>0){out.ftd=ftd.shares/f.float*100;out.sources.ftd={value:out.ftd,source:ftd.source+" ("+Math.round(ftd.shares).toLocaleString()+" shares on "+ftd.date+")",observedAt:ftd.observedAt,freshness:ftd.freshness}}
 if(f){out.float=f.float;out.marketCap=f.marketCap;out.price=f.price;out.volume=f.volume;out.sources.float={value:f.float,source:f.source,observedAt:f.observedAt,freshness:f.freshness};out.sources.marketCap={value:f.marketCap,source:f.source,observedAt:f.observedAt,freshness:f.freshness}}
 return out;
}
