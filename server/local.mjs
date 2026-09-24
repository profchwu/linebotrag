import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {handleApi} from './api.mjs';
const root=fileURLToPath(new URL('../dist/',import.meta.url));const port=Number(process.env.PORT||4317);
const server=createServer(async(req,res)=>{try{
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)){res.writeHead(403);res.end();return}
  const url=new URL(req.url,`http://${req.headers.host}`);
  if(url.pathname==='/.netlify/functions/relay-api'){
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>600000){res.writeHead(413);res.end();return}chunks.push(chunk)}
    const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
    const response=await handleApi(request,{allowedOrigins:process.env.ALLOWED_ORIGINS||'',ip:req.socket.remoteAddress});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
  const filename=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!filename.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403);res.end();return}
  const data=await readFile(filename);res.writeHead(200,{'Content-Type':({'.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'})[extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);
}catch{res.writeHead(404);res.end('Not found')}});
server.listen(port,'127.0.0.1',()=>console.log(`LineBot + RAG: http://127.0.0.1:${port} (API enabled)`));
