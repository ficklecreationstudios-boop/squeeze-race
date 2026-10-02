"use client";
import {useEffect,useState} from "react";

type Candidate={ticker:string;exchange:string|null;price:number|null;volume:number|null;marketCap:number|null;float:number|null;relativeVolume:number|null};
type Event={eventId:string;eventType:string;eventDate:string;ruleVersion:string;outcome?:{forward5d:number|null;forward10d:number|null;maxFavorable10d:number|null;maxAdverse10d:number|null};evidence:{field:string;value:number|string;source:string;observedAt:string;freshness:string}[]};

const money=(n:number|null)=>n===null?"—":n>=1e9?"$"+(n/1e9).toFixed(2)+"B":n>=1e6?"$"+(n/1e6).toFixed(1)+"M":"$"+n.toFixed(0);

export default function ExpandedScan(){
  const [candidates,setCandidates]=useState<Candidate[]>([]);
  const [selected,setSelected]=useState<string[]>(["BBAI","SOUN","GYGY"]);
  const [signals,setSignals]=useState<any[]>([]);
  const [events,setEvents]=useState<Event[]>([]);
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");

  const discover=async()=>{
    setBusy(true);setErr("");
    try{const j=await (await fetch("/api/discover?limit=100",{cache:"no-store"})).json();if(!j.candidates?.length)throw new Error(j.error||"No candidates returned");setCandidates(j.candidates);}
    catch(e){setErr(String(e))}finally{setBusy(false)}
  };
  const scan=async()=>{
    if(!selected.length)return;
    setBusy(true);setErr("");
    try{const j=await (await fetch("/api/scan?symbols="+encodeURIComponent(selected.join(",")),{cache:"no-store"})).json();if(j.error)throw new Error(j.error);setSignals(j.signals||[]);}
    catch(e){setErr(String(e))}finally{setBusy(false)}
  };
  const loadEvents=async(t:string)=>{
    setBusy(true);setErr("");
    try{const j=await (await fetch("/api/events?ticker="+encodeURIComponent(t)+"&years=3",{cache:"no-store"})).json();if(j.error)throw new Error(j.error);setEvents(j.events||[]);}
    catch(e){setErr(String(e))}finally{setBusy(false)}
  };
  useEffect(()=>{void discover()},[]);
  const toggle=(t:string)=>setSelected(s=>s.includes(t)?s.filter(x=>x!==t):s.length<30?[...s,t]:s);

  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-800 p-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="text-xs tracking-[.3em] text-cyan-300">SQUEEZE RACE / EXPANDED RESEARCH</div>
          <h1 className="text-3xl font-semibold mt-2">Expanded Universe + Historical Events</h1>
          <p className="text-sm text-slate-400 mt-2 max-w-4xl">The fixed 20-symbol acceptance set remains intact. This surface discovers additional U.S.-listed equities, lets you select up to 30 for the same mechanical pipeline, and exposes historical price/volume events with point-in-time evidence.</p>
          <div className="mt-4 flex gap-2">
            <a className="rounded-lg border border-slate-700 px-4 py-2 text-sm" href="/">← Trigger Board</a>
            <button className="rounded-lg bg-cyan-900 px-4 py-2 text-sm" onClick={discover}>{busy?"Scanning…":"Refresh candidate universe"}</button>
            <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm" onClick={scan}>Evaluate selected ({selected.length})</button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1600px] p-6">
        {err&&<div className="mb-4 border border-amber-800 bg-amber-950/30 p-3 rounded-lg text-sm text-amber-200">{err}</div>}
        <div className="grid xl:grid-cols-[1fr_420px] gap-5">
          <section className="panel p-5 overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <div><h2 className="text-xl">Candidate discovery</h2><p className="text-xs text-slate-500 mt-1">Public TradingView scanner · U.S. NASDAQ/NYSE/AMEX · $10M–$5B market cap · price &gt; $1 · volume &gt; 100k.</p></div>
              <div className="text-xs text-slate-500">{candidates.length} candidates</div>
            </div>
            <table className="w-full text-left text-sm">
              <thead><tr>{["Use","Ticker","Exchange","Price","Volume","Market cap","RVOL"].map(h=><th key={h} className="p-2 text-xs text-slate-500">{h}</th>)}</tr></thead>
              <tbody>{candidates.map(c=><tr key={c.ticker} className="border-t border-slate-800">
                <td className="p-2"><input type="checkbox" checked={selected.includes(c.ticker)} onChange={()=>toggle(c.ticker)}/></td>
                <td className="p-2 mono font-semibold">{c.ticker}</td><td className="p-2 text-slate-500">{c.exchange||"—"}</td>
                <td className="p-2 mono">{c.price===null?"—":"$"+c.price.toFixed(2)}</td><td className="p-2 mono">{c.volume===null?"—":c.volume.toLocaleString()}</td>
                <td className="p-2 mono">{money(c.marketCap)}</td><td className="p-2 mono">{c.relativeVolume===null?"—":c.relativeVolume.toFixed(2)+"x"}</td>
              </tr>)}</tbody>
            </table>
          </section>
          <aside className="space-y-5">
            <section className="panel p-5">
              <h2 className="text-xl">Selected evaluation</h2>
              <p className="text-xs text-slate-500 mt-1">The expanded scan uses the same deterministic classifier. Borrow remains MOCK_IBKR; no live account is connected.</p>
              {signals.length===0?<p className="text-sm text-slate-500 mt-4">Select candidates and evaluate them.</p>:
                <div className="mt-4 space-y-3">{signals.map(r=><button key={r.ticker} onClick={()=>loadEvents(r.ticker)} className="w-full text-left border border-slate-800 rounded-lg p-3 hover:bg-slate-900">
                  <div className="flex justify-between"><span className="mono font-semibold">{r.ticker}</span><span className="text-xs">{r.phase}</span></div>
                  <div className="text-xs text-slate-500 mt-1">Pressure {r.pressureScore===null?"—":r.pressureScore.toFixed(1)} · SI {r.si===null?"—":r.si.toFixed(1)+"%"} · DTC {r.dtc===null?"—":r.dtc.toFixed(1)} · RVOL {r.rvol===null?"—":r.rvol.toFixed(2)+"x"}</div>
                </button>)}</div>}
            </section>
            <section className="panel p-5">
              <h2 className="text-xl">Historical events</h2>
              <p className="text-xs text-slate-500 mt-1">Yahoo daily history; events are objective price/volume detections, not claims that short covering caused the move.</p>
              {events.length===0?<p className="text-sm text-slate-500 mt-4">Click an evaluated ticker.</p>:
                <div className="mt-4 max-h-[700px] overflow-auto space-y-3">{events.slice(-80).reverse().map(e=><div key={e.eventId} className="border-t border-slate-800 pt-3">
                  <div className="flex justify-between"><span className="text-cyan-300 text-xs">{e.eventType}</span><span className="text-xs text-slate-500">{e.eventDate}</span></div>
                  <div className="text-xs text-slate-400 mt-1">{e.evidence.map(x=>x.field+"="+(typeof x.value==="number"?x.value.toFixed(3):x.value)).join(" · ")}</div>
                  {e.outcome&&<div className="text-[11px] text-slate-500 mt-1">+5d {(e.outcome.forward5d!*100).toFixed(1)}% · +10d {(e.outcome.forward10d!*100).toFixed(1)}% · max favorable {(e.outcome.maxFavorable10d!*100).toFixed(1)}%</div>}
                  <div className="text-[10px] text-slate-600 mt-1">rule {e.ruleVersion} · evidence is date-bounded</div>
                </div>)}</div>}
            </section>
          </aside>
        </div>
        <footer className="text-xs text-slate-500 mt-8">Discovery expands the research universe; it does not silently replace the frozen 20-symbol acceptance set. Candidate discovery is not a recommendation and does not establish that any security will squeeze.</footer>
      </div>
    </main>
  );
}