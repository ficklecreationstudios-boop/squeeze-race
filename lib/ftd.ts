import {unzipSync} from "fflate";
type Ftd={shares:number|null;date:string;observedAt:number;source:string;freshness:"SNAPSHOT"};
const cache=new Map<string,{at:number;rows:Map<string,Ftd>}>();
const SEC_UA="Squeeze-Race/1.0 (+https://github.com/ficklecreationstudios-boop/squeeze-race)";
function ymd(d:Date){return d.toISOString().slice(0,10)}
async function recentFiles(){
  const r=await fetch("https://catalog.data.gov/api/3/action/package_show?id=fails-to-deliver-data",{headers:{"accept":"application/json","User-Agent":SEC_UA},cache:"no-store"});
  if(!r.ok)throw new Error("Data.gov FTD catalog HTTP "+r.status);
  const j=await r.json() as {result?:{resources?:Array<{url?:string}>}};
  const files=(j.result?.resources||[]).map(x=>String(x.url||"")).filter(url=>url.toLowerCase().endsWith(".zip")&&/cnsfails\d{6}[ab]\.zip/i.test(url));
  files.sort((a,b)=>b.localeCompare(a));
  return files.slice(0,12);
}
async function load(url:string):Promise<Map<string,Ftd>>{
  let lastError:unknown=null;
  const candidates=[url,url.replace("https://dcm.sec.gov/","https://www.sec.gov/")];
  for(const candidate of candidates){
    try{
      const r=await fetch(candidate,{headers:{"User-Agent":SEC_UA,"Accept":"application/zip"},cache:"no-store"});
      if(!r.ok){lastError=new Error("SEC FTD HTTP "+r.status);continue}
      const bytes=new Uint8Array(await r.arrayBuffer());
      const files=unzipSync(bytes) as Record<string,Uint8Array>;
      const entry=Object.entries(files).find(([name])=>name.toLowerCase().endsWith(".txt"));
      if(!entry)throw new Error("SEC FTD text entry missing");
      const txt=new TextDecoder().decode(entry[1]);
      const rows=new Map<string,Ftd>();
      for(const line of txt.split(/\r?\n/)){
        const p=line.split("|").map(x=>x.trim());
        if(p.length<4||!/^[0-9]{8}$/.test(p[0])||!p[2])continue;
        const date=p[0].slice(0,4)+"-"+p[0].slice(4,6)+"-"+p[0].slice(6,8),shares=Number(p[3]);
        if(!Number.isFinite(shares))continue;
        const ticker=p[2].toUpperCase(),old=rows.get(ticker);
        if(!old||date>old.date)rows.set(ticker,{shares,date,observedAt:Date.parse(date),source:"SEC CNS fails-to-deliver data",freshness:"SNAPSHOT"});
      }
      return rows;
    }catch(e){lastError=e}
  }
  throw lastError||new Error("SEC FTD unavailable");
}
export async function getFtd(ticker:string){
  const key=ymd(new Date()),cached=cache.get(key);
  if(cached&&Date.now()-cached.at<1800000)return cached.rows.get(ticker.toUpperCase())||null;
  const merged=new Map<string,Ftd>();
  for(const file of await recentFiles()){
    try{const rows=await load(file);for(const [k,v] of rows){const old=merged.get(k);if(!old||v.date>old.date)merged.set(k,v)}}catch{}
  }
  cache.set(key,{at:Date.now(),rows:merged});
  return merged.get(ticker.toUpperCase())||null;
}