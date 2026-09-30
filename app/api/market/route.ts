import {NextResponse} from "next/server";import {getMarket} from "@/lib/market";
export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json(await getMarket(),{headers:{"Cache-Control":"no-store"}})}
