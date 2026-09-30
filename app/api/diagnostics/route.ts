import {getFtd,getFtdDiagnostics} from "@/lib/ftd";
import {getIBorrowDesk} from "@/lib/borrow";
export const dynamic="force-dynamic";
export async function GET(){
  const [ftd,borrow]=await Promise.all([getFtd("BBAI"),getIBorrowDesk("BBAI")]);
  return Response.json({
    ftd:{value:ftd,diagnostics:getFtdDiagnostics()},
    borrow:{fee:borrow.fee,available:borrow.available,observedAt:borrow.observedAt,source:borrow.source,freshness:borrow.freshness}
  });
}