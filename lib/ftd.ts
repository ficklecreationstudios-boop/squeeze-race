import {inflateRawSync} from "node:zlib";
type Ftd={shares:number|null;date:string;observedAt:number;source:string;freshness:"SNAPSHOT"};
const cache=new Map<string,{at:number;rows:Map<string,Ftd>}>();
const inflight=new Map<string,Promise<Map<string,Ftd>>>();
const fallbackCache=new Map<string,{at:number;row:Ftd|null}>();
let lastFtdError:string|null=null;
const SEC_UA="Squeeze-Race/1.0 (+https://github.com/ficklecreationstudios-boop/squeeze-race)";
const INDEX="https://www.sec.gov/data-research/sec-markets-data/fails-deliver-data";
const MAX_FILE=60_000_000;

async function recentFiles():Promise<string[]>{
  const r=await fetch(INDEX,{headers:{"accept":"text/html","User-Agent":SEC_UA},cache:"no-store"});
  if(!r.ok){lastFtdError="index_http_"+r.status;throw new Error(lastFtdError)}
  const html=await r.text(),out:string[]=[];
  for(const m of html.matchAll(/href="([^"]*cnsfails(\d{6}[ab])\.zip)"/gi)){
    const u=m[1].startsWith("http")?m[1]:"https://www.sec.gov"+m[1];
    if(!out.includes(u))out.push(u);
  }
  if(!out.length){lastFtdError="index_no_zip_links";throw new Error(lastFtdError)}
  return out.sort((a,b)=>b.localeCompare(a)).slice(0,12);
}
function isoDate(v:string){const s=v.trim();return/^\d{8}$/.test(s)?`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`:s}

async function load(url:string):Promise<Map<string,Ftd>>{
  const candidates=[url,url.replace("https://dcm.sec.gov/","https://www.sec.gov/")];
  let last:unknown=null;
  for(const candidate of candidates){
    try{
      const r=await fetch(candidate,{headers:{"User-Agent":SEC_UA,"Accept":"application/zip","Accept-Encoding":"gzip, deflate, br"},cache:"no-store"});
      if(!r.ok)throw new Error("SEC FTD file HTTP "+r.status);
      const bytes=new Uint8Array(await r.arrayBuffer());
      if(bytes.byteLength>MAX_FILE)throw new Error("SEC FTD file exceeds size limit");
      const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
      let eocd=-1;
      for(let i=bytes.length-22;i>=0&&i>=bytes.length-65558;i--){if(dv.getUint32(i,true)===0x06054b50){eocd=i;break}}
      if(eocd<0)throw new Error("SEC FTD ZIP central directory not found");
      const total=dv.getUint16(eocd+10,true),dirOffset=dv.getUint32(eocd+16,true);
      let offset=dirOffset,text:string|null=null;
      const decoder=new TextDecoder();
      for(let i=0;i<total&&text===null;i++){
        if(offset+46>bytes.length||dv.getUint32(offset,true)!==0x02014b50)break;
        const method=dv.getUint16(offset+10,true),compressed=dv.getUint32(offset+20,true),uncompressed=dv.getUint32(offset+24,true);
        const nameLen=dv.getUint16(offset+28,true),extraLen=dv.getUint16(offset+30,true),commentLen=dv.getUint16(offset+32,true),localOffset=dv.getUint32(offset+42,true);
        const name=decoder.decode(bytes.subarray(offset+46,offset+46+nameLen)).toLowerCase();
        offset+=46+nameLen+extraLen+commentLen;
        if(!name.endsWith(".txt"))continue;
        if(uncompressed>MAX_FILE)throw new Error("SEC FTD member exceeds size limit");
        if(localOffset+30>bytes.length||dv.getUint32(localOffset,true)!==0x04034b50)continue;
        const localNameLen=dv.getUint16(localOffset+26,true),localExtraLen=dv.getUint16(localOffset+28,true);
        const start=localOffset+30+localNameLen+localExtraLen,payload=bytes.subarray(start,start+compressed);
        text=method===0?decoder.decode(payload):method===8?new TextDecoder().decode(inflateRawSync(payload)):null;
        if(text===null)throw new Error("SEC FTD ZIP unsupported compression method "+method);
      }
      if(text===null)throw new Error("SEC FTD ZIP contained no text member");
      const rows=new Map<string,Ftd>();
      for(const line of text.replace(/^\uFEFF/,"").split(/\r?\n/)){
        const p=line.split("|").map(x=>x.trim());
        if(p.length<6||!/^(?:\d{8}|\d{4}-\d{2}-\d{2})$/.test(p[0])||!p[2])continue;
        const shares=Number(p[3]);if(!Number.isFinite(shares))continue;
        const date=isoDate(p[0]),ticker=p[2].toUpperCase(),old=rows.get(ticker);
        if(!old||date>old.date)rows.set(ticker,{shares,date,observedAt:Date.parse(date),source:"SEC CNS fails-to-deliver data",freshness:"SNAPSHOT"});
      }
      return rows;
    }catch(e){last=e}
  }
  throw last||new Error("SEC FTD unavailable");
}

function findFtdValue(value:unknown):Ftd|null{
  if(!value||typeof value!=="object")return null;
  if(Array.isArray(value)){for(const v of value){const h=findFtdValue(v);if(h)return h}return null}
  const o=value as Record<string,unknown>,date=String(o.settlement_date??o.settlementDate??o.date??""),shares=Number(o.shares_failed??o.failure_to_deliver??o.shares??o.quantity??NaN);
  if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(shares))return{shares,date,observedAt:Date.parse(date),source:"SEC CNS fails-to-deliver data via keyless SEC fallback",freshness:"SNAPSHOT"};
  for(const v of Object.values(o)){const h=findFtdValue(v);if(h)return h}
  return null;
}
async function pipeworxFallback(ticker:string):Promise<Ftd|null>{
  const key=ticker.toUpperCase(),old=fallbackCache.get(key);if(old&&Date.now()-old.at<86400000)return old.row;
  try{
    const r=await fetch("https://gateway.pipeworx.io/v1/tools/ftd_security",{method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({symbol:key,periods:6}),cache:"no-store"});
    if(!r.ok)throw new Error("keyless FTD fallback HTTP "+r.status);
    const h=findFtdValue(await r.json());fallbackCache.set(key,{at:Date.now(),row:h});return h;
  }catch(e){lastFtdError=e instanceof Error?e.message:"fallback_failed";fallbackCache.set(key,{at:Date.now(),row:null});return null}
}
async function buildRows(){const merged=new Map<string,Ftd>();for(const file of await recentFiles()){try{const rows=await load(file);for(const [k,v] of rows){const old=merged.get(k);if(!old||v.date>old.date)merged.set(k,v)}}catch{}}return merged}

export async function getFtd(ticker:string){
  const key=ticker.toUpperCase(),day=new Date().toISOString().slice(0,10),cacheKey=day;
  const c=cache.get(cacheKey);if(c&&Date.now()-c.at<86400000)return c.rows.get(key)||await pipeworxFallback(key);
  let p=inflight.get(cacheKey);if(!p){p=buildRows().finally(()=>inflight.delete(cacheKey));inflight.set(cacheKey,p)}
  const rows=await p;cache.set(cacheKey,{at:Date.now(),rows});return rows.get(key)||await pipeworxFallback(key);
}
export function getFtdDiagnostics(){return{lastError:lastFtdError,source:"SEC CNS fails-to-deliver primary + keyless fallback"}}
