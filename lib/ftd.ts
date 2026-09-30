import {unzipSync} from "fflate";
type Ftd={shares:number|null;date:string;observedAt:number;source:string;freshness:"SNAPSHOT"};
const cache=new Map<string,{at:number;rows:Map<string,Ftd>}>();
function ymd(d:Date){return d.toISOString().slice(0,10)}
function halfFiles(now=new Date()){
  const out:string[]=[];
  for(let i=0;i<3;i++){
    const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-i,1));
    const y=String(d.getUTCFullYear()),m=String(d.getUTCMonth()+1).padStart(2,"0"),ym=y+m;
    out.push("cnsfails"+ym+"a.zip","cnsfails"+ym+"b.zip");
  }
  return out;
}
async function load(file:string){
  const url="https://www.sec.gov/files/data/fails-deliver-data/"+file;
  const r=await fetch(url,{headers:{"User-Agent":"Squeeze-Race/1.0 contact@example.com","Accept":"application/zip"},cache:"no-store"});
  if(!r.ok)throw new Error("SEC FTD "+r.status);
  const bytes=new Uint8Array(await r.arrayBuffer()),unz=unzipSync(bytes),entry=Object.entries(unz).find(([name])=>name.toLowerCase().endsWith(".txt"));
  if(!entry)throw new Error("SEC FTD text entry missing");
  const txt=new TextDecoder().decode(entry[1]),rows=new Map<string,Ftd>();
  for(const line of txt.split(/\r?\n/)){
    const p=line.split("|").map(x=>x.trim()); if(p.length<4||!/^\d{8}$/.test(p[0])||!p[2])continue;
    const date=p[0].slice(0,4)+"-"+p[0].slice(4,6)+"-"+p[0].slice(6,8),shares=Number(p[3]); if(!Number.isFinite(shares))continue;
    const ticker=p[2].toUpperCase(),prev=rows.get(ticker); if(!prev||date>prev.date)rows.set(ticker,{shares,date,observedAt:Date.parse(date),source:"SEC CNS fails-to-deliver data",freshness:"SNAPSHOT"});
  }
  return rows;
}
export async function getFtd(ticker:string){
  const key=ymd(new Date()),c=cache.get(key);
  if(c&&Date.now()-c.at<1800000)return c.rows.get(ticker.toUpperCase())||null;
  const merged=new Map<string,Ftd>();
  for(const file of halfFiles()){try{const rows=await load(file);for(const [k,v] of rows){const old=merged.get(k);if(!old||v.date>old.date)merged.set(k,v)}}catch{}}
  cache.set(key,{at:Date.now(),rows:merged});
  return merged.get(ticker.toUpperCase())||null;
}