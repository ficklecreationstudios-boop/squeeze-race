import {evaluate} from "../lib/rules";
const base:any={ticker:"TEST",price:100,breakout:100,rvol:3,si:25,dtc:7,ctb:8,avail:200000,ftd:1.2,svd:6,ctbFreshness:"SNAPSHOT",availFreshness:"SNAPSHOT",ftdFreshness:"SNAPSHOT",marketCap:100,float:1000000,floatTurnover:30,updatedAt:Date.now(),provider:"test",freshness:"MIXED",sources:{}};
function expectCase(name:string,ok:boolean){if(!ok)throw new Error("FAIL: "+name);console.log("PASS: "+name)}
expectCase("active requires breakout, RVOL, CTB and stress",evaluate(base).phase==="ACTIVE");
expectCase("sub-2x volume is not pre-squeeze",evaluate({...base,rvol:1.99}).phase==="FUEL");
expectCase("SI below 20 invalidates",evaluate({...base,si:19.99}).phase==="INVALIDATED");
expectCase("DTC below 5 is monitor",evaluate({...base,dtc:4.99,price:80,rvol:1}).phase==="MONITOR");
expectCase("missing required field is data-gap",evaluate({...base,price:null}).phase==="DATA-GAP");
expectCase("GYGY liquidity regime is distinct",evaluate({...base,ticker:"GYGY",si:null,dtc:null,price:null,breakout:null,rvol:3,marketCap:20,floatTurnover:30}).phase==="LIQUIDITY");
expectCase("lagged CTB cannot satisfy borrow stress",evaluate({...base,ctbFreshness:"LAGGED",avail:900000,ftd:0,svd:0,rvol:2.5}).phase==="FUEL");
console.log("RULE TESTS PASS");
