type Bar={date:string;open:number;high:number;low:number;close:number;volume:number};
type EventEvidence={field:string;value:number|string;source:string;observedAt:string;freshness:"LIVE"|"SNAPSHOT"};
export type HistoricalEvent={eventId:string;symbol:string;eventType:"BREAKOUT"|"VOLUME_EXPANSION"|"PRICE_ACCELERATION";eventDate:string;ruleVersion:string;status:"DETECTED";evidence:EventEvidence[];outcome?:{forward1d:number|null;forward5d:number|null;forward10d:number|null;maxFavorable10d:number|null;maxAdverse10d:number|null}};

async function loadDaily(ticker:string,years=3):Promise<Bar[]>{
  const p1=Math.floor(Date.now()/1000)-years*366*86400,u="https://query1.finance.yahoo.com/v8/finance/chart/"+encodeURIComponent(ticker)+"?interval=1d&period1="+p1+"&period2="+Math.floor(Date.now()/1000)+"&includePrePost=false&events=div%2Csplits",c=new AbortController(),timer=setTimeout(()=>c.abort(),8000);
  try{const r=await fetch(u,{cache:"no-store",headers:{"User-Agent":"Squeeze-Race/1.0"},signal:c.signal});if(!r.ok)throw new Error("Yahoo chart HTTP "+r.status);const j=await r.json(),q=j.chart?.result?.[0],ts=q?.timestamp||[],x=q?.indicators?.quote?.[0]||{};return ts.map((t:number,i:number)=>({date:new Date(t*1000).toISOString().slice(0,10),open:Number(x.open?.[i]),high:Number(x.high?.[i]),low:Number(x.low?.[i]),close:Number(x.close?.[i]),volume:Number(x.volume?.[i])})).filter((b:Bar)=>[b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)&&b.close>0&&b.volume>0);}finally{clearTimeout(timer);}
}
const mean=(a:number[])=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
export async function getHistoricalEvents(ticker:string,years=3):Promise<HistoricalEvent[]>{
  if(!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker))throw new Error("invalid ticker");
  const bars=await loadDaily(ticker,Math.min(Math.max(years,1),5)),events:HistoricalEvent[]=[];
  for(let i=20;i<bars.length-10;i++){const b=bars[i],prior=bars.slice(i-20,i),avg=mean(prior.map(x=>x.volume))||0,high20=Math.max(...prior.map(x=>x.high)),rvol=avg?b.volume/avg:null,momentum5=i>=5?b.close/bars[i-5].close-1:null;
    const evidence=():EventEvidence[]=>[
      {field:"close",value:b.close,source:"Yahoo Finance chart (keyless)",observedAt:b.date,freshness:"SNAPSHOT"},
      {field:"prior20dHigh",value:high20,source:"Yahoo Finance chart (keyless)",observedAt:b.date,freshness:"SNAPSHOT"},
      {field:"rvol",value:rvol??0,source:"Yahoo Finance chart (keyless)",observedAt:b.date,freshness:"SNAPSHOT"},
      {field:"momentum5",value:momentum5??0,source:"Yahoo Finance chart (keyless)",observedAt:b.date,freshness:"SNAPSHOT"}];
    const outcome=()=>{const f=bars.slice(i+1,i+11);if(f.length<10)return undefined;return{forward1d:f[0]?(f[0].close/b.close-1):null,forward5d:f[4]?(f[4].close/b.close-1):null,forward10d:f[9]?(f[9].close/b.close-1):null,maxFavorable10d:Math.max(...f.map(x=>x.high))/b.close-1,maxAdverse10d:Math.min(...f.map(x=>x.low))/b.close-1};};
    if(b.close>=high20)events.push({eventId:ticker+"-"+b.date+"-breakout",symbol:ticker,eventType:"BREAKOUT",eventDate:b.date,ruleVersion:"historical-events-v1",status:"DETECTED",evidence:evidence(),outcome:outcome()});
    if(rvol!==null&&rvol>=2)events.push({eventId:ticker+"-"+b.date+"-volume",symbol:ticker,eventType:"VOLUME_EXPANSION",eventDate:b.date,ruleVersion:"historical-events-v1",status:"DETECTED",evidence:evidence(),outcome:outcome()});
    if(momentum5!==null&&momentum5>=.10)events.push({eventId:ticker+"-"+b.date+"-acceleration",symbol:ticker,eventType:"PRICE_ACCELERATION",eventDate:b.date,ruleVersion:"historical-events-v1",status:"DETECTED",evidence:evidence(),outcome:outcome()});
  } return events;
}
