import {NextResponse} from "next/server";
import {getIBorrowDesk} from "@/lib/borrow";
import {WATCHLIST} from "@/lib/config";
export const dynamic="force-dynamic";
export async function GET(){
  const signals=await Promise.all(WATCHLIST.map(async ({ticker})=>{
    const b=await getIBorrowDesk(ticker);
    return {ticker,ctb:b.fee,avail:b.available,source:b.source,freshness:b.freshness,observedAt:b.observedAt};
  }));
  return NextResponse.json({gate:"20-symbol-borrow",expectedSymbolCount:WATCHLIST.length,symbolCount:signals.length,borrowProvider:"MOCK_IBKR",live:false,signals},{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
