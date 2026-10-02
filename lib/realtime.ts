import {getTradingViewFundamentals} from "@/lib/tradingview";

export type RealtimeTechnical={
  ticker:string;price:number|null;volume:number|null;observedAt:number|null;
  freshness:"SNAPSHOT"|"UNAVAILABLE";source:string;sessionVolume:number|null;
  barsToday:number;volumeRate:number|null;retrievedAt:number;
};

export async function getRealtimeTechnical(tickers:string[]):Promise<RealtimeTechnical[]>{
  const retrievedAt=Date.now();
  try{
    const tv=await getTradingViewFundamentals(tickers);
    return tickers.map(ticker=>{
      const x=tv.get(ticker);
      return {
        ticker,
        price:x?.price??null,
        volume:x?.volume??null,
        observedAt:x?.observedAt??null,
        freshness:x?"SNAPSHOT":"UNAVAILABLE",
        source:x?.source??"TradingView public scanner",
        sessionVolume:x?.volume??null,
        barsToday:0,
        volumeRate:null,
        retrievedAt
      };
    });
  }catch{
    return tickers.map(ticker=>({
      ticker,price:null,volume:null,observedAt:null,freshness:"UNAVAILABLE" as const,
      source:"TradingView public scanner",sessionVolume:null,barsToday:0,volumeRate:null,retrievedAt
    }));
  }
}
