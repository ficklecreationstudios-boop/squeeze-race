const base=process.env.SQUEEZE_RACE_BASE_URL||"http://127.0.0.1:3000";
const r=await fetch(base+"/");if(!r.ok)throw new Error("homepage HTTP "+r.status);
for(const [k,v] of [["x-content-type-options","nosniff"],["x-frame-options","DENY"],["referrer-policy","strict-origin-when-cross-origin"],["permissions-policy","camera=(), microphone=(), geolocation=()"]]){const got=r.headers.get(k);if(got!==v)throw new Error("security header "+k+" expected "+v+" got "+got)}
const api=await fetch(base+"/api/health");if(!api.ok)throw new Error("health HTTP "+api.status);if(!(api.headers.get("cache-control")||"").includes("no-store"))throw new Error("health must be no-store");console.log("SECURITY HEADER TESTS PASS");
