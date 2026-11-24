import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname,join,extname,normalize,sep } from "node:path";
import { platform,plans,allowedTerms,calculateQuote,isLaunchReady } from "./src/catalog.mjs";
const root=dirname(fileURLToPath(import.meta.url));
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".json":"application/json; charset=utf-8"};
const MAX_BODY=8192;
function reply(res,status,data,headers={}) {
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...headers});
  res.end(JSON.stringify(data));
}
async function getBody(req) {
  let chunks=[],total=0;
  for await(const part of req) {
    total+=part.length;
    if(total>MAX_BODY){ const e=new Error("요청 크기 제한 초과");e.status=413;throw e; }
    chunks.push(part);
  }
  try{return JSON.parse(Buffer.concat(chunks).toString("utf8"));}
  catch{const e=new Error("잘못된 JSON입니다.");e.status=400;throw e;}
}
async function serveFile(req,res,path) {
  const pathWithin=path==="/"?"index.html":decodeURIComponent(path).replace(/^\/+/, "");
  const safe=normalize(pathWithin);
  if (safe.startsWith("..") || safe.includes(".."+sep) || !["index.html","styles.css","app.js"].includes(safe)){
    return reply(res,404,{error:"NOT_FOUND"});
  }
  try {
    const filename=join(root,"public",safe);
    const s=await stat(filename);
    if(!s.isFile()) return reply(res,404,{error:"NOT_FOUND"});
    res.writeHead(200,{"Content-Type":mime[extname(filename)]||"application/octet-stream","X-Content-Type-Options":"nosniff","Cache-Control":"no-cache"});
    res.end(await readFile(filename));
  } catch { reply(res,404,{error:"NOT_FOUND"}); }
}
export function createApp() {
 return http.createServer(async(req,res)=>{
  let path;
  try{path=new URL(req.url,"http://localhost").pathname;}
  catch{return reply(res,400,{error:"BAD_REQUEST"});}
  res.setHeader("X-Frame-Options","DENY");
  res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");
  res.setHeader("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  if (req.method==="GET" && path==="/api/health") return reply(res,200,{status:"ok",phase:"DEMO_ONLY"});
  if (req.method==="GET" && path==="/api/config") return reply(res,200,{
    brand:platform.brand,operator:platform.operator,branch:platform.headquarters,
    pgProvider:platform.pgProvider,plans,allowedTerms,canCheckout:isLaunchReady()
  });
  if (req.method==="POST" && path==="/api/quote") {
    try { const body=await getBody(req);return reply(res,200,calculateQuote(body));}
    catch(err){return reply(res,err.status||400,{error:"INVALID_QUOTE",message:err.message});}
  }
  if (path.startsWith("/api/")){
    if(["/api/orders","/api/checkout","/api/contracts","/api/pg/callback","/api/webhooks/hecto"].includes(path))
      return reply(res,503,{error:"LAUNCH_BLOCKED",message:"사업장 권리·사용 적합성 및 PG 운영 승인이 완료되지 않았습니다."});
    return reply(res,404,{error:"NOT_FOUND"});
  }
  if(req.method!=="GET" && req.method!=="HEAD")return reply(res,405,{error:"METHOD_NOT_ALLOWED"});
  return serveFile(req,res,path);
 });
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]){
  const port=Number(process.env.PORT||8888);
  createApp().listen(port,"0.0.0.0",()=>console.log("HANOFFICE DEMO http://localhost:"+port));
}
