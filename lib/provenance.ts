import { createHash } from "node:crypto";

export type Freshness = "LIVE" | "SNAPSHOT" | "LAGGED" | "UNAVAILABLE";
export type ObservationStatus = "OBSERVED" | "UNAVAILABLE" | "ERROR";

export type Observation<T = number | string | boolean | null> = {
  observationId: string; runId: string; symbol: string; field: string; value: T | null;
  source: string; provider: string; observedAt: string | null; retrievedAt: string;
  freshness: Freshness; live: boolean; status: ObservationStatus;
  ruleVersion?: string; error?: string;
};

export type CollectionRun = {
  runId: string; startedAt: string; finishedAt: string; codeVersion: string;
  universeVersion: string; ruleVersion: string; status: "COMPLETE" | "PARTIAL" | "FAILED";
  symbolCount: number; observationCount: number;
};

export const PROVENANCE_VERSION = "provenance-v1";
export const UNIVERSE_VERSION = "squeeze20-v1";
export const RULE_VERSION = "squeeze-rules-v1";

export function makeRunId(startedAt = new Date()) {
  return startedAt.toISOString().replace(/[-:.TZ]/g, "") + "-" + Math.random().toString(36).slice(2, 8);
}
export function stableId(parts: string[]) {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}
export function makeObservation<T>(runId:string,symbol:string,field:string,value:T|null,meta:Omit<Observation<T>,"observationId"|"runId"|"symbol"|"field"|"value">):Observation<T>{
  return {observationId:stableId([runId,symbol,field,meta.observedAt??"null",String(value)]),runId,symbol,field,value,...meta};
}
export function codeVersion(){return process.env.VERCEL_GIT_COMMIT_SHA||process.env.GIT_COMMIT_SHA||"local";}
export function startRun(symbolCount:number,startedAt=new Date()):CollectionRun{
  return {runId:makeRunId(startedAt),startedAt:startedAt.toISOString(),finishedAt:"",codeVersion:codeVersion(),universeVersion:UNIVERSE_VERSION,ruleVersion:RULE_VERSION,status:"PARTIAL",symbolCount,observationCount:0};
}
export function finishRun(run:CollectionRun,observationCount:number,status:CollectionRun["status"]):CollectionRun{
  return {...run,finishedAt:new Date().toISOString(),observationCount,status};
}
