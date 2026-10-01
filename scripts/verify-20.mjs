const expected=["BBAI","SERV","SOUN","ONDS","WOLF","HTZ","STEM","EQ","MAC","EEFT","WULF","HST","WWW","ESQ","RES","ARR","FDS","GYGY","TMS","PAYS"];
const base=process.env.SQUEEZE_RACE_BASE_URL||"http://127.0.0.1:3000";
const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);
const r=await fetch(base+"/api/verify-20",{cache:"no-store",signal:controller.signal}).finally(()=>clearTimeout(timeout));
if(!r.ok)throw new Error("market endpoint HTTP "+r.status);
const j=await r.json();
const got=(j.signals||[]).map(x=>x.ticker);
if(j.symbolCount!==20||j.expectedSymbolCount!==20)throw new Error(`symbol-count gate failed: ${j.symbolCount}/${j.expectedSymbolCount}`);
if(JSON.stringify(got)!==JSON.stringify(expected))throw new Error("20-symbol order/set gate failed: "+got.join(","));
if(j.borrowProvider!=="MOCK_IBKR")throw new Error("borrow provenance gate failed: expected MOCK_IBKR, got "+j.borrowProvider);
if(j.live!==false)throw new Error("live-status gate failed: mock provider must never be reported as live");
for(const row of j.signals){if(row.ctb===null||row.avail===null)throw new Error(`${row.ticker}: missing simulated CTB/availability`);const source=String(row.sources?.ctb?.source||"");if(!source.includes("MOCK_IBKR"))throw new Error(`${row.ticker}: borrow source is not MOCK_IBKR`);if(row.sources?.ctb?.freshness!=="SNAPSHOT")throw new Error(`${row.ticker}: simulated borrow freshness is not SNAPSHOT`);}
console.log(JSON.stringify({gate:"20-symbol-borrow",status:"PASS",symbols:20,borrowProvider:j.borrowProvider,live:j.live,allBorrowValuesPresent:true}));
