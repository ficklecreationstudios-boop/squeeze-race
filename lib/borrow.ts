type Borrow={fee:number|null;available:number|null;observedAt:number|null;source:string;freshness:"LIVE"|"SNAPSHOT"|"LAGGED"|"UNAVAILABLE"};
function parseCompact(v:string){const n=Number(v.replace(/[$,%]/g,""));if(!Number.isFinite(n))return null;const u=v.trim().toUpperCase();return n*(u.endsWith("M")?1_000_000:u.endsWith("K")?1_000:1)}
function cleanHtml(s:string){return s.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim()}
async function pageFallback(ticker:string):Promise<Borrow>{
  const hosts=["https://www.iborrowdesk.com/report/","https://www.cjmochrie.com/report/"];
  let last:unknown=null;
  for(const host of hosts){
   try{
    const r=await fetch(host+encodeURIComponent(ticker.toUpperCase()),{headers:{"accept":"text/html","User-Agent":"Squeeze-Race/1.0 (+https://github.com/ficklecreationstudios-boop/squeeze-race)"},cache:"no-store"});
  if(!r.ok)throw new Error("IBorrowDesk page HTTP "+r.status);
  const text=cleanHtml(await r.text());
  const feeMatch=text.match(/Borrow fee\s+([0-9]+(?:\.[0-9]+)?%)/i);
  const availMatch=text.match(/Shares available\s+([0-9]+(?:\.[0-9]+)?[KM]?)/i);
  const updated=text.match(/Updated\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}\s+(?:AM|PM))/i);
  const fee=feeMatch?parseCompact(feeMatch[1]):null,available=availMatch?parseCompact(availMatch[1]):null;
  if(fee===null&&available===null)throw new Error("IBorrowDesk page values missing");
  const ts=updated?Date.parse(updated[1]):null;
  const age=Number.isFinite(ts??NaN)?Date.now()-(ts as number):Number.POSITIVE_INFINITY;
  const freshness=age<=45*60*1000?"LIVE":age<=24*60*60*1000?"SNAPSHOT":"LAGGED";
  return{fee,available,observedAt:Number.isFinite(ts??NaN)?ts:null,source:"IBorrowDesk public report page / Interactive Brokers stock-loan feed",freshness};
   }catch(e){last=e}
  }
  throw last||new Error("IBorrowDesk page unavailable");
}
export async function getIBorrowDesk(ticker:string):Promise<Borrow>{
  try{
    const r=await fetch("https://iborrowdesk.com/api/ticker/"+encodeURIComponent(ticker.toUpperCase()),{headers:{"accept":"application/json","User-Agent":"Squeeze-Race/1.0 (+https://github.com/ficklecreationstudios-boop/squeeze-race)"},cache:"no-store"});
    if(!r.ok)throw new Error("IBorrowDesk API HTTP "+r.status);
    const j=await r.json() as {real_time?:Array<Record<string,any>>;daily?:Array<Record<string,any>>};
    const rows=[...(j.real_time||[]),...(j.daily||[])].filter(x=>x&&(Number.isFinite(Number(x.fee))||Number.isFinite(Number(x.available))));
    if(!rows.length)throw new Error("IBorrowDesk API empty");
    rows.sort((a,b)=>new Date(String(b.date||b.reported||0)).getTime()-new Date(String(a.date||a.reported||0)).getTime());
    const x=rows[0],fee=Number(x.fee),available=Number(x.available),ts=Date.parse(String(x.date||x.reported||""));
    return{fee:Number.isFinite(fee)?fee:null,available:Number.isFinite(available)?available:null,observedAt:Number.isFinite(ts)?ts:null,source:"IBorrowDesk / Interactive Brokers public stock-loan feed",freshness:"LIVE"};
  }catch{
    try{return await pageFallback(ticker)}catch{
      return{fee:null,available:null,observedAt:null,source:"IBorrowDesk / Interactive Brokers public stock-loan feed",freshness:"UNAVAILABLE"}
    }
  }
}