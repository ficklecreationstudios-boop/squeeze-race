export type MockBorrow = { fee:number; available:number; observedAt:number; source:"MOCK_IBKR"; freshness:"SNAPSHOT" };

const WATCHLIST=["BBAI","SERV","SOUN","ONDS","WOLF","HTZ","STEM","EQ","MAC","EEFT","WULF","HST","WWW","ESQ","RES","ARR","FDS","GYGY","TMS","PAYS"] as const;

function hashTicker(ticker:string){let h=0;for(const c of ticker.toUpperCase())h=(h*31+c.charCodeAt(0))>>>0;return h;}

export function getMockBorrow(ticker:string):MockBorrow{
  const key=ticker.toUpperCase();
  if(!WATCHLIST.includes(key as typeof WATCHLIST[number])) throw new Error("Mock IBKR feed: ticker is outside the 20-symbol acceptance set");
  const h=hashTicker(key);
  return {
    fee:Number((2.5+(h%1750)/100).toFixed(2)),
    available:25000+(h%975000),
    observedAt:Date.now(),
    source:"MOCK_IBKR",
    freshness:"SNAPSHOT"
  };
}

export function getMockBorrowAcceptanceSymbols(){return [...WATCHLIST];}
