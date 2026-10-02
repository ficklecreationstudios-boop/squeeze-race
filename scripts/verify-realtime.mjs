const base=process.env.BASE_URL||"http://localhost:3000";
const r=await fetch(base+"/api/realtime",{cache:"no-store"});
if(!r.ok)throw new Error("realtime HTTP "+r.status);
const j=await r.json();
if(j.plane!=="REALTIME_TECHNICAL")throw new Error("wrong realtime plane");
if(j.expectedSymbolCount!==20||j.symbolCount!==20)throw new Error("expected exact 20 symbols");
if(j.interval!=="1m")throw new Error("expected 1m interval");
for(const s of j.signals){
  if(!s.ticker)throw new Error("missing ticker");
  if(s.freshness==="LIVE"&&s.observedAt===null)throw new Error(s.ticker+" claims LIVE without observation timestamp");
}
console.log("realtime verification passed:",j.symbolCount,"symbols");
