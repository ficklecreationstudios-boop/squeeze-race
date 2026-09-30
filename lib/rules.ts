export type Phase="FUEL"|"PRE-SQUEEZE"|"ACTIVE"|"INVALIDATED"|"LIQUIDITY"|"DATA-GAP"|"MONITOR";
export type MetricSource={value:number|null;source:string;observedAt:number|null;freshness:"LIVE"|"SNAPSHOT"|"LAGGED"|"UNAVAILABLE"};
export type Signal={ticker:string;price:number|null;breakout:number|null;rvol:number|null;si:number|null;dtc:number|null;ctb:number|null;avail:number|null;ftd:number|null;svd:number|null;marketCap:number|null;float:number|null;floatTurnover:number|null;phase:Phase;freshness:string;updatedAt:number;provider:string;sources:Record<string,MetricSource>;reasons:string[]};
export function evaluate(r:Omit<Signal,"phase"|"reasons">):{phase:Phase;reasons:string[]}{
  if(r.ticker==="GYGY"&&r.rvol!==null&&r.marketCap!==null&&r.floatTurnover!==null&&r.rvol>=3&&r.marketCap<25&&r.floatTurnover>=25)return{phase:"LIQUIDITY",reasons:["market cap < $25M","RVOL >= 3x","float turnover >= 25%"]};
  if(r.price===null||r.breakout===null||r.rvol===null||r.si===null||r.dtc===null)return{phase:"DATA-GAP",reasons:["required live structural fields are unavailable"]};
  if(r.si<20)return{phase:"INVALIDATED",reasons:["SI < 20%"]};

  const stress=(r.ctb!==null&&r.ctb>=5)||(r.avail!==null&&r.avail<=500000)||(r.ftd!==null&&r.ftd>=1)||(r.svd!==null&&r.svd>=5);
  const activeStress=(r.avail!==null&&r.avail<=250000)||(r.ctb!==null&&r.ctb>=10)||(r.ftd!==null&&r.ftd>=1)||(r.svd!==null&&r.svd>=5);

  if(r.price>=r.breakout&&r.rvol>=3&&r.ctb!==null&&r.ctb>=5&&activeStress)return{phase:"ACTIVE",reasons:["price >= breakout","RVOL >= 3x","CTB >= 5%","active stress condition"]};
  if(r.price>=r.breakout&&r.rvol>=2&&stress)return{phase:"PRE-SQUEEZE",reasons:["price >= breakout","RVOL >= 2x","pre-squeeze stress condition"]};
  if(r.si>=20&&r.dtc>=5){
    return{phase:"FUEL",reasons:r.price<=r.breakout*.95?["SI >= 20%","DTC >= 5","below breakout does not invalidate structural fuel"]:["SI >= 20%","DTC >= 5","awaiting breakout/volume trigger"]};
  }
  return{phase:"MONITOR",reasons:["SI >= 20%","DTC < 5","structural fuel threshold not fully met"]};
}