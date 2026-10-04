import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/cloudflare-worker.mjs';
import {readFile} from 'node:fs/promises';

test('deployment permits both published frontends and rejects unrelated origins',async()=>{
  const config=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  for(const origin of ['https://profchwu.github.io','https://linebotrag.nthuai.com','https://unrelated.example']){
    const request=new Request('https://linebot.example/api/relay',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST'}});
    const response=await worker.fetch(request,config.vars);
    const permitted=origin!=='https://unrelated.example';
    assert.equal(response.status,permitted?204:403);
    assert.equal(response.headers.get('access-control-allow-origin'),permitted?origin:null);
  }
});

test('Workers serves assets and public health separately from credentials',async()=>{
  const env={ASSETS:{fetch:async()=>new Response('static asset')}};
  assert.equal(await (await worker.fetch(new Request('https://linebot.example/'),env)).text(),'static asset');
  const health=await worker.fetch(new Request('https://linebot.example/api/health'),env);
  assert.equal((await health.json()).runtime,'cloudflare-workers');
});
test('Workers routes both API paths through origin and credential checks',async()=>{
  for(const path of ['/api/relay','/.netlify/functions/relay-api']){
    const request=new Request('https://linebot.example'+path,{method:'POST',headers:{Origin:'https://linebot.example','Content-Type':'application/json'},body:JSON.stringify({service:'models',provider:'OpenAI',action:'list',apiKey:''})});
    assert.equal((await worker.fetch(request,{})).status,400);
    const forbidden=new Request('https://linebot.example'+path,{method:'POST',headers:{Origin:'https://evil.example'}});
    assert.equal((await worker.fetch(forbidden,{})).status,403);
  }
});
