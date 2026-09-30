type Borrow={fee:number|null;available:number|null;observedAt:number|null;source:string;freshness:"LIVE"|"SNAPSHOT"|"UNAVAILABLE"};
export async function getIBorrowDesk(ticker:string):Promise<Borrow>{
  try{
    const r=await fetch("https://iborrowdesk.com/api/ticker/"+encodeURIComponent(ticker.toUpperCase()),{
      headers:{"accept":"application/json","User-Agent":"Squeeze-Race/1.0"},cache:"no-store"
    });
    if(!r.ok)throw new Error("IBorrowDesk HTTP "+r.status);
    const j=await r.json() as {real_time?:Array<Record<string,any>>;daily?:Array<Record<string,any>>};
    const rows=[...(j.real_time||[]),...(j.daily||[])].filter(x=>x&&Number.isFinite(Number(x.fee))||Number.isFinite(Number(x.available)));
    if(!rows.length)throw new Error("IBorrowDesk empty");
    rows.sort((a,b)=>new Date(String(b.date||b.reported||0)).getTime()-new Date(String(a.date||a.reported||0)).getTime());
    const x=rows[0];
    const fee=Number(x.fee),available=Number(x.available);
    const ts=Date.parse(String(x.date||x.reported||""));
    return{fee:Number.isFinite(fee)?fee:null,available:Number.isFinite(available)?available:null,observedAt:Number.isFinite(ts)?ts:null,source:"IBorrowDesk / Interactive Brokers public stock-loan feed",freshness:"LIVE"};
  }catch{return{fee:null,available:null,observedAt:null,source:"IBorrowDesk / Interactive Brokers public stock-loan feed",freshness:"UNAVAILABLE"}}
}