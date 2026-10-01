type Bucket={count:number;reset:number};
const buckets=new Map<string,Bucket>();
const WINDOW_MS=60_000;
const LIMIT=30;
export function checkRateLimit(key:string){const now=Date.now();const current=buckets.get(key);if(!current||current.reset<=now){buckets.set(key,{count:1,reset:now+WINDOW_MS});return{ok:true,retryAfter:0}}if(current.count>=LIMIT)return{ok:false,retryAfter:Math.max(1,Math.ceil((current.reset-now)/1000))};current.count++;return{ok:true,retryAfter:0}}
