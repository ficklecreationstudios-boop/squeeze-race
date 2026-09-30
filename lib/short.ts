import {getFinraShortInterest,getFinraShortVolume} from "./finra";
import {getTradingViewFundamentals} from "./tradingview";
import {getIBorrowDesk} from "./borrow";
import {getFtd} from "./ftd";
export type ShortBundle={si:number|null;dtc:number|null;ctb:number|null;avail:number|null;ftd:number|null;svd:number|null;float:number|null;marketCap:number|null;sources:Record<string,{value:number|null;source:string;observedAt:number|null;freshness:"SNAPSHOT"|"LAGGED"|"LIVE"|"UNAVAILABLE"}>};
export async function getShortBundle(ticker:string):Promise<ShortBundle>{
  const empty=(source:string)=>({value:null,source,observedAt:null,freshness:"UNAVAILABLE" as const});
  const out:ShortBundle={si:null,dtc:null,ctb:null,avail:null,ftd:null,svd:null,float:null,marketCap:null,sources:{
    si:empty("FINRA Consolidated Short Interest"),dtc:empty("FINRA Consolidated Short Interest"),
    ctb:empty("IBorrowDesk / Interactive Brokers public stock-loan feed"),
    avail:empty("IBorrowDesk / Interactive Brokers public stock-loan feed"),
    ftd:empty("SEC CNS fails-to-deliver data"),svd:empty("FINRA Reg SHO Daily Short Sale Volume"),
    float:empty("TradingView public scanner"),marketCap:empty("TradingView public scanner")
  }};
  const [si,sv,tv,borrow,ftd]=await Promise.all([
    getFinraShortInterest(ticker).catch(()=>null),
    getFinraShortVolume(ticker).catch(()=>null),
    getTradingViewFundamentals([ticker]).catch(()=>new Map()),
    getIBorrowDesk(ticker).catch(()=>null),
    getFtd(ticker).catch(()=>null)
  ]);
  const f=tv.get(ticker);
  if(si){
    out.dtc=si.dtc;
    out.sources.dtc={value:si.dtc,source:si.source+" (recomputed from current short / FINRA ADV)",observedAt:si.observedAt,freshness:si.freshness};
    if(si.sharesShort!==null&&f?.float&&f.float>0){
      out.si=si.sharesShort/f.float*100;
      out.sources.si={value:out.si,source:si.source+" + TradingView float",observedAt:Math.min(si.observedAt,f.observedAt),freshness:"SNAPSHOT"};
    }else{
      out.sources.si={value:si.sharesShort,source:si.source+" (shares; float denominator separate)",observedAt:si.observedAt,freshness:si.freshness};
    }
  }
  if(sv){out.svd=sv.svd;out.sources.svd={value:sv.svd,source:sv.source,observedAt:sv.observedAt,freshness:sv.freshness}}
  if(borrow){
    out.ctb=borrow.fee;out.avail=borrow.available;
    out.sources.ctb={value:borrow.fee,source:borrow.source,observedAt:borrow.observedAt,freshness:borrow.freshness};
    out.sources.avail={value:borrow.available,source:borrow.source,observedAt:borrow.observedAt,freshness:borrow.freshness};
  }
  if(ftd&&ftd.shares!==null&&f?.float&&f.float>0){
    out.ftd=ftd.shares/f.float*100;
    out.sources.ftd={value:out.ftd,source:ftd.source+" ("+Math.round(ftd.shares).toLocaleString()+" shares on "+ftd.date+")",observedAt:ftd.observedAt,freshness:ftd.freshness};
  }
  if(f){out.float=f.float;out.marketCap=f.marketCap;out.sources.float={value:f.float,source:f.source,observedAt:f.observedAt,freshness:f.freshness};out.sources.marketCap={value:f.marketCap,source:f.source,observedAt:f.observedAt,freshness:f.freshness}}
  return out;
}