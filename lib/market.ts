import {WATCHLIST} from "./config";import {evaluate} from "./rules";import {get20DayHistory} from "./history";import {getShortBundle} from "./short";
const histCache=new Map<string,{at:number;v:Awaited<ReturnType<typeof get20DayHistory>>}>(),shortCache=new Map<string,{at:number;v:Awaited<ReturnType<typeof getShortBundle>>}>();
async function cachedHistory(t:string){const c=histCache.get(t);if(c&&Date.now()-c.at<60000)return c.v;const v=await get20DayHistory(t);histCache.set(t,{at:Date.now(),v});return v}
async function cachedShort(t:string){const c=shortCache.get(t);if(c&&Date.now()-c.at<300000)return c.v;const v=await getShortBundle(t);shortCache.set(t,{at:Date.now(),v});return v}
export async function getMarket(){
  const now=Date.now(),results=await Promise.all(WATCHLIST.map(async x=>{
    const[h,s]=await Promise.all([cachedHistory(x.ticker),cachedShort(x.ticker)]),price=h.price,floatTurnover=s.float&&h.volume?h.volume/s.float*100:null;
    const sources={...s.sources,price:{value:price,source:h.source,observedAt:h.observedAt,freshness:h.freshness},breakout:{value:h.breakout,source:h.source,observedAt:h.observedAt,freshness:h.freshness},rvol:{value:h.rvol,source:h.source,observedAt:h.observedAt,freshness:h.freshness},floatTurnover:{value:floatTurnover,source:h.source+" + TradingView float",observedAt:h.observedAt,freshness:h.freshness}};
    const base={ticker:x.ticker,price,breakout:h.breakout,rvol:h.rvol,si:s.si,dtc:s.dtc,ctb:s.ctb,avail:s.avail,ftd:s.ftd,svd:s.svd,ctbFreshness:s.sources.ctb.freshness,availFreshness:s.sources.avail.freshness,ftdFreshness:s.sources.ftd.freshness,marketCap:s.marketCap,float:s.float,floatTurnover,updatedAt:now,provider:"Yahoo/Stooq + FINRA + TradingView + IBorrowDesk + SEC",freshness:price!==null&&h.breakout!==null&&s.si!==null?"PARTIAL":"DATA-GAP",sources};
    const ev=evaluate(base);return{...base,phase:ev.phase,reasons:ev.reasons}
  }));
  const fields=["si","dtc","ctb","avail","ftd","svd","price","breakout","rvol","float","marketCap"] as const;
  const coverage=Object.fromEntries(fields.map(f=>[f,results.filter(x=>x[f]!==null).length]));
  const phaseCounts=Object.fromEntries([...new Set(results.map(x=>x.phase))].map(p=>[p,results.filter(x=>x.phase===p).length]));
  const providerStatus={
    finraShortInterest:coverage.si>0,
    finraShortVolume:coverage.svd>0,
    tradingViewFundamentals:coverage.float>0,
    iborrowDesk:coverage.ctb>0||coverage.avail>0,
    secFtd:coverage.ftd>0,
    priceHistory:coverage.price>0
  };
  const coverageComplete=fields.every(f=>coverage[f]===results.length);
  return{signals:results,source:"keyless public provider mesh",timestamp:now,live:true,coverageComplete,coverage,phaseCounts,providerStatus,error:results.some(x=>x.phase==="DATA-GAP")?"Some required fields remain unavailable; no positive squeeze state is fabricated":undefined}
}