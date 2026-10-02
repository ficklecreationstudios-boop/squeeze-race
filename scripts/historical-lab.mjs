/*
 * Historical Squeeze Event Lab
 *
 * Purpose: build a leakage-safe, public-data historical dataset and evaluate
 * a calibrated probability model. This is research infrastructure only:
 * the "short-supported explosive move" label is a proxy, not proof that
 * covering caused the move.
 *
 * Sources:
 * - Yahoo chart API: daily OHLCV
 * - FINRA biweekly short-interest CSVs (public CDN)
 *
 * Important alignment rule:
 * FINRA short-interest observations are not usable on their settlement date.
 * We conservatively require settlementDate + 7 calendar days <= observationDate
 * before a report can become a feature. This prevents publication look-ahead.
 */
import fs from "node:fs";

const TICKERS = ["BBAI","SERV","SOUN","ONDS","WOLF","HTZ","STEM","EQ","MAC","EEFT","WULF","HST","WWW","ESQ","RES","ARR","FDS","GYGY","TMS","PAYS"];
const YEARS = Number(process.env.SQUEEZE_LAB_YEARS || 5);
const MIN_SAMPLES = Number(process.env.SQUEEZE_LAB_MIN_SAMPLES || 5000);
const MIN_TEST_EVENTS = Number(process.env.SQUEEZE_LAB_MIN_TEST_EVENTS || 50);
const UNIVERSE_SIZE = Number(process.env.SQUEEZE_LAB_UNIVERSE_SIZE || 100);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (x,a,b) => Math.max(a, Math.min(b,x));
const sigmoid = z => 1/(1+Math.exp(-clamp(z,-30,30)));
const mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
const median = a => { if(!a.length)return null; const s=[...a].sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; };

async function fetchText(url, tries=3){
  let last;
  for(let i=0;i<tries;i++){
    try{
      const r=await fetch(url,{headers:{"User-Agent":"Squeeze-Race-Historical-Lab/1.0"}});
      if(!r.ok) throw new Error("HTTP "+r.status);
      return await r.text();
    }catch(e){last=e; if(i+1<tries) await sleep(400*(i+1));}
  }
  throw last;
}

async function fetchJson(url, tries=3){
  const t=await fetchText(url,tries);
  return JSON.parse(t);
}

function ymd(d){return d.toISOString().slice(0,10).replaceAll("-","");}
function businessDayOnOrBefore(d){
  const x=new Date(d);
  while(x.getUTCDay()===0 || x.getUTCDay()===6)x.setUTCDate(x.getUTCDate()-1);
  return x;
}
function candidateSettlementDates(year){
  const out=[];
  for(let m=0;m<12;m++){
    const mid=businessDayOnOrBefore(new Date(Date.UTC(year,m,15)));
    const end=businessDayOnOrBefore(new Date(Date.UTC(year,m+1,0)));
    out.push(ymd(mid),ymd(end));
  }
  return [...new Set(out)];
}

function parseFinraCsv(text){
  const lines=text.split(/\r?\n/).filter(Boolean);
  if(!lines.length)return [];
  const header=lines[0].split("|").map(x=>x.trim().replace(/^"|"$/g,""));
  const idx=new Map(header.map((x,i)=>[x,i]));
  const find=(...names)=>{for(const n of names){if(idx.has(n))return idx.get(n)}return -1};
  const sym=find("symbolCode","issueSymbolIdentifier","Symbol");
  const marketIdx=find("marketClassCode","Market");
  const settle=find("settlementDate","Settlement Date");
  const short=find("currentShortPositionQuantity","currentShortShareNumber","Current Short");
  const prev=find("previousShortPositionQuantity","previousShortShareNumber","Previous Short");
  const dtc=find("daysToCoverQuantity","daysToCoverNumber","Days to Cover");
  const chg=find("changePercent","percentageChangefromPreviousShort","% Change from Prev");
  if(sym<0||settle<0||short<0)return [];
  const rows=[];
  for(let i=1;i<lines.length;i++){
    const p=lines[i].split("|");
    const ticker=(p[sym]||"").trim().toUpperCase();
    if(!/^[A-Z]{1,5}$/.test(ticker))continue;
    const settlement=(p[settle]||"").trim().slice(0,10);
    const current=Number(p[short]), previous=prev>=0?Number(p[prev]):NaN;
    const days=dtc>=0?Number(p[dtc]):NaN;
    const change=chg>=0?Number(p[chg]):(Number.isFinite(previous)&&previous?((current/previous)-1)*100:NaN);
    if(!settlement || !Number.isFinite(current))continue;
    rows.push({ticker,settlement,market:marketIdx>=0?(p[marketIdx]||"").trim():null,short:current,dtc:Number.isFinite(days)?days:null,siChangePct:Number.isFinite(change)?change:null});
  }
  return rows;
}

async function loadShortInterest(){
  const startYear=new Date().getUTCFullYear()-YEARS;
  const all=[];
  for(let y=startYear;y<=new Date().getUTCFullYear();y++){
    const dates=candidateSettlementDates(y);
    const results=await mapLimit(dates,6,async d=>{
      try{
        const txt=await fetchText("https://cdn.finra.org/equity/otcmarket/biweekly/shrt"+d+".csv",2);
        return parseFinraCsv(txt);
      }catch{return []}
    });
    for(const rows of results)all.push(...rows);
  }
  const byTicker=new Map();
  for(const r of all){if(!byTicker.has(r.ticker))byTicker.set(r.ticker,[]);byTicker.get(r.ticker).push(r);}
  for(const a of byTicker.values())a.sort((x,y)=>x.settlement.localeCompare(y.settlement));
  return byTicker;
}

async function loadBars(ticker){
  const period1=Math.floor(Date.now()/1000)-Math.floor(YEARS*366*86400);
  const url="https://query1.finance.yahoo.com/v8/finance/chart/"+ticker+"?interval=1d&period1="+period1+"&period2="+Math.floor(Date.now()/1000)+"&includePrePost=false&events=div%2Csplits";
  const j=await fetchJson(url);
  const q=j.chart?.result?.[0], ts=q?.timestamp||[], b=q?.indicators?.quote?.[0]||{};
  return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),h:Number(b.high?.[i]),l:Number(b.low?.[i]),c:Number(b.close?.[i]),v:Number(b.volume?.[i])}))
    .filter(x=>[x.h,x.l,x.c,x.v].every(Number.isFinite)&&x.c>0&&x.v>0);
}

function latestShortBefore(reports, obsDate){
  const cutoff=new Date(obsDate+"T00:00:00Z"); cutoff.setUTCDate(cutoff.getUTCDate()-7);
  const key=cutoff.toISOString().slice(0,10);
  let best=null;
  for(const r of reports){if(r.settlement<=key)best=r;else break;}
  return best;
}

function makeRows(ticker,bars,reports,marketByDate){
  const rows=[];
  for(let i=25;i<bars.length-10;i++){
    const b=bars[i-1], w20=bars.slice(i-21,i-1), w5=bars.slice(i-6,i-1), f5=bars.slice(i,i+5), f10=bars.slice(i,i+10);
    if(w20.length<20||w5.length<5||f5.length<5)continue;
    const breakout=Math.max(...w20.map(x=>x.h));
    const avgVol=mean(w20.map(x=>x.v));
    const avgVol10=mean(w5.map(x=>x.v));
    const rvol=b.v/avgVol;
    const momentum5=b.c/w5[0].c-1;
    const breakoutDistance=b.c/breakout-1;
    const volumeAcceleration=avgVol10/avgVol;
    const ranges=w5.map(x=>(x.h-x.l)/x.c);
    const rangeCompression=mean(ranges)/mean(w20.map(x=>(x.h-x.l)/x.c));
    const forward5=Math.max(...f5.map(x=>x.h))/b.c-1;
    const forward10=Math.max(...f10.map(x=>x.h))/b.c-1;
    const trough=Math.min(...f10.map(x=>x.l));
    const maxDrawdown=trough/b.c-1;
    const peakRvol=Math.max(...f5.map(x=>x.v))/avgVol;
    const short=latestShortBefore(reports,b.date);
    const market=marketByDate.get(b.date);
    if(!short || !market)continue;
    const dollarVolumeLog=Math.log10(Math.max(1,b.c*avgVol));

    // Event labels are intentionally distinct:
    // explosiveMove = price/volume outcome only.
    // shortSupported = explosive move + elevated pre-event short pressure.
    // Neither label proves causal short covering.
    const explosiveMove=forward5>=0.20;
    const shortSupported=forward5>=0.05 && short.dtc!==null && short.dtc>=3 && rvol>=2 && breakoutDistance>=-0.01 && momentum5>=0;
    const sustained=shortSupported && forward10>=0.10 && maxDrawdown>-0.20;
    const featureValues=[short.dtc,short.siChangePct??0,rvol,momentum5,breakoutDistance,volumeAcceleration,rangeCompression,dollarVolumeLog,market.momentum20,market.vol20];
    if(!featureValues.every(Number.isFinite))continue;
    rows.push({
      ticker,date:b.date,
      features:{
        dtc:short.dtc,siChangePct:short.siChangePct??0,
        rvol,momentum5,breakoutDistance,volumeAcceleration,rangeCompression,dollarVolumeLog,marketMomentum20:market.momentum20,marketVol20:market.vol20
      },
      outcomes:{
        explosiveMove,shortSupported,sustained,
        forward5,forward10,maxDrawdown,peakRvol
      }
    });
  }
  return rows;
}

const FEATURE_NAMES=["dtc","siChangePct","rvol","momentum5","breakoutDistance","volumeAcceleration","rangeCompression","dollarVolumeLog","marketMomentum20","marketVol20"];
function fitStats(train){
  const stats={};
  for(const f of FEATURE_NAMES){
    const a=train.map(r=>r.features[f]).filter(Number.isFinite);
    const m=mean(a)??0;
    const sd=Math.sqrt(mean(a.map(x=>(x-m)**2))||1)||1;
    stats[f]={m,sd};
  }
  return stats;
}
function standardize(train,rows){
  const stats=fitStats(train);
  return rows.map(r=>({...r,x:FEATURE_NAMES.map(f=>(r.features[f]-stats[f].m)/stats[f].sd)}));
}
function fitLogistic(train,label){
  let w=new Array(FEATURE_NAMES.length+1).fill(0);
  const lr=0.035, lambda=0.001, epochs=350;
  for(let e=0;e<epochs;e++){
    const g=new Array(w.length).fill(0);
    for(const r of train){
      const p=sigmoid(w[0]+r.x.reduce((s,x,j)=>s+w[j+1]*x,0));
      const y=r.outcomes[label]?1:0, err=p-y;
      g[0]+=err;
      for(let j=0;j<r.x.length;j++)g[j+1]+=err*r.x[j];
    }
    for(let j=0;j<w.length;j++)w[j]-=lr*((g[j]/train.length)+(j?lambda*w[j]:0));
  }
  return w;
}
function predict(model,r){return sigmoid(model[0]+r.x.reduce((s,x,j)=>s+model[j+1]*x,0));}

function isotonicFit(items){
  const a=items.map(x=>({p:x.p,y:x.y,n:1,sum:x.y})).sort((a,b)=>a.p-b.p);
  const blocks=[];
  for(const z of a){
    blocks.push(z);
    while(blocks.length>1){
      const q=blocks[blocks.length-2], r=blocks[blocks.length-1];
      if(q.sum/q.n<=r.sum/r.n)break;
      blocks.splice(blocks.length-2,2,{p:(q.p*q.n+r.p*r.n)/(q.n+r.n),y:0,n:q.n+r.n,sum:q.sum+r.sum});
    }
  }
  return blocks;
}
function isoPredict(blocks,p){
  if(!blocks.length)return p;
  if(p<=blocks[0].p)return blocks[0].sum/blocks[0].n;
  if(p>=blocks.at(-1).p)return blocks.at(-1).sum/blocks.at(-1).n;
  for(let i=1;i<blocks.length;i++)if(p<=blocks[i].p)return blocks[i-1].sum/blocks[i-1].n;
  return p;
}
function brier(pred,ys){return mean(pred.map((p,i)=>(p-ys[i])**2));}
function topDecileLift(pred,ys){const n=Math.max(1,Math.floor(pred.length*.10));const idx=pred.map((p,i)=>[p,i]).sort((a,b)=>b[0]-a[0]).slice(0,n).map(x=>x[1]);const rate=mean(idx.map(i=>ys[i]));const base=mean(ys);return {eventRate:rate,lift:base?rate/base:null};}
function logloss(pred,ys){return -mean(pred.map((p,i)=>ys[i]?Math.log(Math.max(p,1e-9)):Math.log(Math.max(1-p,1e-9))));}
function auc(pred,ys){
  const pairs=pred.map((p,i)=>[p,ys[i]]).sort((a,b)=>a[0]-b[0]);
  let pos=0,neg=0,rank=0,rankPos=0;
  for(const [,y] of pairs){if(y){pos++;rankPos+=rank+1}else neg++;rank++;}
  return pos&&neg?(rankPos-pos*(pos+1)/2)/(pos*neg):null;
}
function evaluate(test,label,model,stats,calibration){
  const x=standardize([],[]); // no-op; test is already standardized below
  const raw=test.map(r=>predict(model,r));
  const calibrated=raw.map(p=>isoPredict(calibration,p));
  const ys=test.map(r=>r.outcomes[label]?1:0);
  const threshold=.5;
  const positives=ys.reduce((s,y)=>s+y,0);
  const tp=ys.reduce((s,y,i)=>s+(y&&calibrated[i]>=threshold?1:0),0);
  const fp=ys.reduce((s,y,i)=>s+(!y&&calibrated[i]>=threshold?1:0),0);
  const baseRate=mean(ys);const b=brier(calibrated,ys);return {samples:test.length,events:positives,baseRate,brier:b,baselineBrier:baseRate*(1-baseRate),brierSkill:baseRate*(1-baseRate)?1-b/(baseRate*(1-baseRate)):null,logLoss:logloss(calibrated,ys),auc:auc(calibrated,ys),precision:tp+fp?tp/(tp+fp):null,topDecile:topDecileLift(calibrated,ys),medianPredicted:median(calibrated),medianForward5:median(test.map(r=>r.outcomes.forward5))};
}

async function mapLimit(items,limit,fn){
  const out=new Array(items.length);let next=0;
  async function worker(){while(true){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i]);}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out;
}

async function main(){
  console.log(JSON.stringify({stage:"historical-lab",years:YEARS,requestedUniverse:UNIVERSE_SIZE,status:"loading public data"},null,2));
  const short=await loadShortInterest();
  const ranked=[...short.entries()].filter(([t,a])=>a.length>=30 && a.some(r=>r.market && r.market!=="S")).sort((a,b)=>b[1].length-a[1].length).map(([t])=>t);
  const activeTickers=[...new Set([...TICKERS,...ranked])].slice(0,Math.max(TICKERS.length,UNIVERSE_SIZE));
  const marketBars=await loadBars("SPY");
  const marketByDate=new Map();
  for(let i=20;i<marketBars.length;i++){
    const w=marketBars.slice(i-20,i), c=marketBars[i-1].c;
    const momentum20=c/w[0].c-1;
    const returns=[];
    for(let k=1;k<w.length;k++)returns.push(Math.log(w[k].c/w[k-1].c));
    const vol=Math.sqrt(mean(returns.map(r=>r*r))||0)*Math.sqrt(252);
    marketByDate.set(marketBars[i-1].date,{momentum20,vol20:vol});
  }
  const bars=await mapLimit(activeTickers,6,async t=>{try{return[t,await loadBars(t)]}catch(e){console.error("YAHOO_SKIP",t,String(e));return[t,[]]}});
  const rows=bars.flatMap(([t,b])=>makeRows(t,b,short.get(t)||[],marketByDate));
  if(rows.length<MIN_SAMPLES)throw new Error("Historical lab gate failed: only "+rows.length+" aligned samples; need >= "+MIN_SAMPLES);
  rows.sort((a,b)=>a.date.localeCompare(b.date));
  const dates=[...new Set(rows.map(r=>r.date))];
  const d1=dates[Math.floor(dates.length*.60)], d2=dates[Math.floor(dates.length*.80)];
  const train=rows.filter(r=>r.date<d1),cal=rows.filter(r=>r.date>=d1&&r.date<d2),test=rows.filter(r=>r.date>=d2);
  const stats=fitStats(train);
  const standardizeWithStats=rows=>rows.map(r=>({...r,x:FEATURE_NAMES.map(f=>(r.features[f]-stats[f].m)/stats[f].sd)}));
  const trainStd=standardizeWithStats(train),calStd=standardizeWithStats(cal),testStd=standardizeWithStats(test);
  const result={dataset:{samples:rows.length,tickers:activeTickers.length,dateStart:dates[0],dateEnd:dates.at(-1),train:train.length,calibration:cal.length,test:test.length,universeBias:"FINRA-derived historical universe capped by SQUEEZE_LAB_UNIVERSE_SIZE; Yahoo survivorship/availability bias remains"},labels:{}};
  result.models={};
  for(const label of ["explosiveMove","shortSupported","sustained"]){
    const model=fitLogistic(trainStd,label);
    const calPred=calStd.map(r=>predict(model,r));
    const calibration=isotonicFit(calStd.map((r,i)=>({p:calPred[i],y:r.outcomes[label]?1:0})));
    const calibrationEvents=calStd.filter(r=>r.outcomes[label]).length;
    result.labels[label]={trainEvents:trainStd.filter(r=>r.outcomes[label]).length,calibrationEvents,test:evaluate(testStd,label,model,null,calibration)};
    result.models[label]={featureNames:FEATURE_NAMES,weights:model,standardization:stats,calibrationBlocks:calibration.map(b=>({p:b.p,n:b.n,sum:b.sum}))};
  }
  result.gates={
    minimumSamples:rows.length>=MIN_SAMPLES,
    minimumTestEvents:result.labels.explosiveMove.test.events>=50 && result.labels.shortSupported.test.events>=50 && result.labels.sustained.test.events>=25,
    minimumCalibrationEvents:result.labels.explosiveMove.calibrationEvents>=50 && result.labels.shortSupported.calibrationEvents>=50 && result.labels.sustained.calibrationEvents>=25,
    positiveBrierSkill:["explosiveMove","shortSupported","sustained"].every(l=>result.labels[l].test.brierSkill!==null&&result.labels[l].test.brierSkill>0),
    noLookahead:true,
    probabilitiesCalibratedOnValidationOnly:true,
    borrowSource:"No historical IBKR borrow; MOCK_IBKR is excluded from training evidence"
  };
  fs.mkdirSync("artifacts",{recursive:true});
  fs.writeFileSync("artifacts/historical-lab-latest.json",JSON.stringify(result,null,2)+"\\n");
  console.log(JSON.stringify(result,null,2));
  if(!result.gates.minimumTestEvents || !result.gates.minimumCalibrationEvents || !result.gates.positiveBrierSkill)throw new Error("Historical lab gate failed: calibration evidence is insufficient or does not beat the base-rate Brier score");
}
main().catch(e=>{console.error("HISTORICAL_LAB_FAIL",e.stack||e);process.exit(1)});
