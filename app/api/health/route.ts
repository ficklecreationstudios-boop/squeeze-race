import {getFtdDiagnostics} from "@/lib/ftd";
import {NextResponse} from "next/server";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(){
  const response=NextResponse.json({
    ok:true,mode:"controlled-provider-mesh",framework:"Next.js 16.3.8",
    pricePlane:"Yahoo Finance chart + Stooq fallback",
    shortInterestPlane:"FINRA Consolidated Short Interest (bi-monthly snapshot)",
    shortVolumePlane:"FINRA Reg SHO Daily Short Sale Volume",
    fundamentalsPlane:"TradingView public scanner",
    borrowPlane:"MOCK_IBKR deterministic simulator (no live account connected)",
    ctbPlane:"MOCK_IBKR fee snapshot",borrowAvailabilityPlane:"MOCK_IBKR shares-available snapshot",
    ftdPlane:"SEC CNS fails-to-deliver",ftdDiagnostics:getFtdDiagnostics(),timestamp:Date.now()
  });
  response.headers.set("Cache-Control","no-store, max-age=0");
  response.headers.set("X-Content-Type-Options","nosniff");
  return response;
}
