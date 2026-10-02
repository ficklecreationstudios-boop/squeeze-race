type Row=Record<string,any>;
const base="https://api.finra.org";
function num(v:any){const n=Number(v);return Number.isFinite(n)?n:null}

async function post(dataset:string,body:any){
  const r=await fetch(base+"/data/group/otcMarket/name/"+dataset,{
    method:"POST",
    headers:{"accept":"application/json","content-type":"application/json","Data-API-Version":"1","User-Agent":"Squeeze-Race/1.0"},
    body:JSON.stringify(body),cache:"no-store"
  });
  if(r.status===204)return [];
  if(!r.ok)throw new Error("FINRA "+dataset+" HTTP "+r.status);
  return(await r.json()) as Row[];
}

async function partitions(dataset:string){
  const r=await fetch(base+"/partitions/group/otcMarket/name/"+dataset,{
    headers:{"accept":"application/json","Data-API-Version":"1","User-Agent":"Squeeze-Race/1.0"},cache:"no-store"
  });
  if(!r.ok)throw new Error("FINRA partitions "+dataset+" HTTP "+r.status);
  const j=await r.json() as {availablePartitions?:Array<{partitions?:string[]}>};
  return (j.availablePartitions||[]).flatMap(x=>x.partitions||[]).sort().reverse();
}

let siPartitionCache:{at:number;dates:string[]}|null=null;
let svPartitionCache:{at:number;dates:string[]}|null=null;
async function latestPartitions(dataset:"consolidatedShortInterest"|"regShoDaily"){
  const cache=dataset==="consolidatedShortInterest"?siPartitionCache:svPartitionCache;
  if(cache&&Date.now()-cache.at<1800000)return cache.dates;
  const dates=await partitions(dataset);
  const next={at:Date.now(),dates};
  if(dataset==="consolidatedShortInterest")siPartitionCache=next;else svPartitionCache=next;
  return dates;
}

export async function getFinraShortInterest(ticker:string){
  const dates=await latestPartitions("consolidatedShortInterest");
  for(const date of dates.slice(0,6)){
    const rows=await post("consolidatedShortInterest",{
      limit:5,
      fields:["settlementDate","symbolCode","currentShortPositionQuantity","averageDailyVolumeQuantity","daysToCoverQuantity"],
      compareFilters:[
        {compareType:"EQUAL",fieldName:"settlementDate",fieldValue:date},
        {compareType:"EQUAL",fieldName:"symbolCode",fieldValue:ticker}
      ]
    });
    const x=rows[0];
    if(!x)continue;
    const sharesShort=num(x.currentShortPositionQuantity),adv=num(x.averageDailyVolumeQuantity);
    let previousShort:null|number=null,previousDate:null|string=null;
    for(const priorDate of dates.slice(1,4)){const pr=await post("consolidatedShortInterest",{limit:5,fields:["settlementDate","symbolCode","currentShortPositionQuantity"],compareFilters:[{compareType:"EQUAL",fieldName:"settlementDate",fieldValue:priorDate},{compareType:"EQUAL",fieldName:"symbolCode",fieldValue:ticker}]});if(pr[0]){previousShort=num(pr[0].currentShortPositionQuantity);previousDate=String(pr[0].settlementDate||priorDate);break}}
    const shortChangePct=sharesShort!==null&&previousShort!==null&&previousShort>0?(sharesShort/previousShort-1)*100:null;
    return{sharesShort,previousShort,shortChangePct,previousDate,dtc:sharesShort!==null&&adv&&adv>0?sharesShort/adv:null,settlementDate:String(x.settlementDate||date),observedAt:Date.parse(String(x.settlementDate||date)),source:"FINRA Consolidated Short Interest",freshness:"SNAPSHOT" as const};
  }
  return null;
}

export async function getFinraShortVolume(ticker:string){
  const dates=await latestPartitions("regShoDaily");
  const latest=dates[0], start=new Date(Date.parse(latest)-35*86400000).toISOString().slice(0,10);
  const rows=await post("regShoDaily",{
    limit:1000,
    fields:["tradeReportDate","securitiesInformationProcessorSymbolIdentifier","shortParQuantity","shortExemptParQuantity","totalParQuantity"],
    compareFilters:[{compareType:"EQUAL",fieldName:"securitiesInformationProcessorSymbolIdentifier",fieldValue:ticker}],
    dateRangeFilters:[{startDate:start,endDate:latest,fieldName:"tradeReportDate"}]
  });
  const by=new Map<string,{short:number;total:number}>();
  for(const x of rows){
    const d=String(x.tradeReportDate||""),s=num(x.shortParQuantity)||0,t=num(x.totalParQuantity)||0;
    if(!d||t<=0)continue;
    const v=by.get(d)||{short:0,total:0};v.short+=s;v.total+=t;by.set(d,v);
  }
  const ratios=[...by.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([date,v])=>({date,ratio:v.total?v.short/v.total*100:null})).filter(x=>x.ratio!==null).slice(0,21) as {date:string;ratio:number}[];
  if(!ratios.length)return null;
  const latestRatio=ratios[0].ratio,prior=ratios.slice(1);
  return{svd:prior.length?latestRatio-prior.reduce((a,b)=>a+b.ratio,0)/prior.length:null,latestShortVolumePct:latestRatio,observedAt:Date.parse(ratios[0].date),source:"FINRA Reg SHO Daily Short Sale Volume",freshness:"SNAPSHOT" as const};
}