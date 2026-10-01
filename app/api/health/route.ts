import {getFtdDiagnostics} from "@/lib/ftd";
import {NextResponse} from "next/server";
export const dynamic="force-dynamic";
export async function GET(){
  return NextResponse.json({
    ok:true,
    mode:"controlled-provider-mesh",
    pricePlane:"Yahoo Finance chart + Stooq fallback",
    shortInterestPlane:"FINRA Consolidated Short Interest (bi-monthly snapshot)",
    shortVolumePlane:"FINRA Reg SHO Daily Short Sale Volume",
    fundamentalsPlane:"TradingView public scanner",
    borrowPlane:"MOCK_IBKR deterministic simulator (no live account connected)",
    ctbPlane:"MOCK_IBKR fee snapshot",
    borrowAvailabilityPlane:"MOCK_IBKR shares-available snapshot",
    ftdPlane:"SEC CNS fails-to-deliver",
    ftdDiagnostics:getFtdDiagnostics(),
    timestamp:Date.now()
  });
}