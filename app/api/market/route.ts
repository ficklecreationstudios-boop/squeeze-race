import {NextRequest,NextResponse} from "next/server";
import {getMarket} from "@/lib/market";
import {checkRateLimit} from "@/lib/rateLimit";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:NextRequest){
  const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key=forwarded||request.headers.get("x-real-ip")||"anonymous";
  const limit=checkRateLimit(key);
  if(!limit.ok)return NextResponse.json({error:"Too many market refreshes; retry shortly"},{status:429,headers:{"Cache-Control":"no-store","Retry-After":String(limit.retryAfter)}});
  try{
    const data=await getMarket();
    return NextResponse.json(data,{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  }catch{
    return NextResponse.json({error:"Market data temporarily unavailable",coverageComplete:false},{status:503,headers:{"Cache-Control":"no-store","Retry-After":"10","X-Content-Type-Options":"nosniff"}});
  }
}
