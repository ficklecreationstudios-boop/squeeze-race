export type Phase="FUEL"|"PRE-SQUEEZE"|"ACTIVE"|"INVALIDATED"|"LIQUIDITY";
export type Signal={ticker:string;price:number;breakout:number;rvol:number;si:number;dtc:number;ctb:number;avail:number;ftd:number;svd:number;marketCap?:number;float?:number;floatTurnover?:number;phase:Phase;freshness:string;updatedAt:number;provider:string};
export function evaluate(r:Omit<Signal,"phase">):Phase{
 if(r.ticker==="GYGY" && r.rvol>=3 && (r.marketCap===undefined || r.marketCap<25)) return "LIQUIDITY";
 if(r.si<20 || r.price<=r.breakout*.95) return "INVALIDATED";
 if(r.price>=r.breakout && r.rvol>=3 && r.ctb>=5 && (r.avail<=250000 || r.ctb>=10 || r.ftd>=1 || r.svd>=5)) return "ACTIVE";
 if(r.price>=r.breakout && r.rvol>=2 && (r.ctb>=5 || r.avail<=500000 || r.ftd>=1 || r.svd>=5)) return "PRE-SQUEEZE";
 return r.si>=20 && r.dtc>=5 ? "FUEL" : "INVALIDATED";
}
