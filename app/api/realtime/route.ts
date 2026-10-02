import {NextRequest,NextResponse} from "next/server";
import {getRealtimeTechnical} from "@/lib/realtime";
import {WATCHLIST} from "@/lib/config";
import {checkRateLimit} from "@/lib/rateLimit";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export async function GET(request:NextRequest){
  const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key="realtime:"+ (forwarded||request.headers.get("x-real-ip")||"anonymous");
  const limit=checkRateLimit(key);
  if(!limit.ok)return NextResponse.json({error:"Too many realtime refreshes; retry shortly"},{status:429,headers:{"Cache-Control":"no-store","Retry-After":String(limit.retryAfter)}});
  try{
    const symbols=WATCHLIST.map(x=>x.ticker);
    const signals=await getRealtimeTechnical(symbols);
    return NextResponse.json({
      plane:"REALTIME_TECHNICAL",
      symbolCount:signals.length,
      expectedSymbolCount:symbols.length,
      interval:"1m",
      source:"Yahoo Finance chart (keyless)",
      liveObservationDefinition:"LIVE means the latest 1-minute regular-session bar is <= 2 minutes old; source timestamps are retained.",
      signals,
      retrievedAt:Date.now()
    },{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  }catch{
    return NextResponse.json({error:"Realtime technical data temporarily unavailable",symbolCount:0,expectedSymbolCount:WATCHLIST.length},{status:503,headers:{"Cache-Control":"no-store","Retry-After":"5","X-Content-Type-Options":"nosniff"}});
  }
}
