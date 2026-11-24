import test from "node:test";
import assert from "node:assert/strict";
import {createApp} from "../server.mjs";
import {calculateQuote,isLaunchReady,platform} from "../src/catalog.mjs";
test("annual individual quote includes correct tax",()=>{
 const q=calculateQuote({type:"individual",months:12});
 assert.equal(q.monthly,29000);assert.equal(q.subtotal,348000);assert.equal(q.vat,34800);assert.equal(q.total,382800);assert.equal(q.canCheckout,false);
});
test("period, add-on, and corporate price",()=>{
 const q=calculateQuote({type:"corporate",months:6,mail:true,meeting:true});
 assert.equal(q.monthly,57900);assert.equal(q.total,382140);
});
test("reject invalid quote",()=>{
 assert.throws(()=>calculateQuote({type:"unknown"}),RangeError);
 assert.throws(()=>calculateQuote({months:2}),RangeError);
 assert.throws(()=>calculateQuote({mail:"true"}),TypeError);
});
test("launch gates default blocked",()=>{
 assert.equal(isLaunchReady(),false);
 assert.equal(platform.headquarters.isForSale,false);
});
test("HTTP endpoints work while all real transaction paths stay blocked",async(t)=>{
 const server=createApp().listen(0,"127.0.0.1");
 await new Promise(resolve=>server.once("listening",resolve));
 t.after(()=>server.close());
 const base="http://127.0.0.1:"+server.address().port;
 const health=await fetch(base+"/api/health").then(r=>r.json());
 assert.equal(health.phase,"DEMO_ONLY");
 const resp=await fetch(base+"/api/quote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"individual",months:12})});
 assert.equal(resp.status,200);assert.equal((await resp.json()).total,382800);
 for(const path of ["/api/checkout","/api/orders","/api/contracts","/api/pg/callback","/api/webhooks/hecto"]){
   const res=await fetch(base+path,{method:"POST"});
   assert.equal(res.status,503,path);
   assert.equal((await res.json()).error,"LAUNCH_BLOCKED");
 }
 const cfg=await fetch(base+"/api/config").then(r=>r.json());
 assert.equal(cfg.canCheckout,false);
 assert.equal(cfg.branch.address,"서울특별시 종로구 새문안로 15-1");
 const index=await fetch(base+"/");
 assert.equal(index.status,200);
 assert.match(await index.text(),/HAN BIZ OFFICE/);
});
