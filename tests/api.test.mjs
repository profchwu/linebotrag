import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi,modelOperation,sheetOperation,normalizeRules,rulesToRows} from '../server/api.mjs';
const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
test('three providers actually request their fixed generation endpoints',async()=>{
  for(const provider of ['OpenAI','Gemini','Grok']){let called=false;const result=await modelOperation({provider,action:'test',apiKey:'not-a-real-key',model:'test-model'},async(url,opts)=>{called=true;assert.equal(opts.method,'POST');const body=JSON.parse(opts.body);assert.ok(!JSON.stringify(body).includes('not-a-real-key'));if(provider==='OpenAI'){assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(body.store,false);return response({output:[{content:[{type:'output_text',text:'OK'}]}],usage:{total_tokens:4}})}if(provider==='Gemini'){assert.ok(url.startsWith('https://generativelanguage.googleapis.com/'));assert.equal(opts.headers['x-goog-api-key'],'not-a-real-key');return response({candidates:[{content:{parts:[{text:'OK'}]}}]})}assert.equal(url,'https://api.x.ai/v1/chat/completions');return response({choices:[{message:{content:'OK'}}]})});assert.ok(called);assert.equal(result.status,'tested');assert.equal(result.text,'OK')}
});
test('models are listed without claiming tested, Gemini pagination retained',async()=>{const r=await modelOperation({provider:'Gemini',action:'list',apiKey:'dummy-key'},async()=>response({models:[{name:'models/text-model',supportedGenerationMethods:['generateContent']},{name:'models/embedding-model',supportedGenerationMethods:['embedContent']}],nextPageToken:'page2'}));assert.deepEqual(r.models,['text-model']);assert.equal(r.nextPageToken,'page2');assert.equal(r.status,'listed_not_tested')});
test('provider failure never returns provider text containing a key',async()=>{await assert.rejects(modelOperation({provider:'OpenAI',action:'test',model:'x',apiKey:'dummy-secret'},async()=>response({error:{message:'invalid dummy-secret'}},401)),e=>e.status===401&&!e.message.includes('dummy-secret'))});
test('empty/incomplete generation is not labeled usable',async()=>{await assert.rejects(modelOperation({provider:'OpenAI',action:'test',model:'x',apiKey:'dummy-key'},async()=>response({output:[],status:'incomplete'})),e=>e.status===422)});
test('invalid credential, provider and injected model fail before network',async()=>{let calls=0;for(const input of [{provider:'other',action:'list',apiKey:'dummy-key'},{provider:'OpenAI',action:'test',apiKey:'dummy-key',model:'https://evil.test?x'},{provider:'Grok',action:'list',apiKey:''}])await assert.rejects(modelOperation(input,async()=>{calls++}));assert.equal(calls,0)});
const rule={id:'r1',enabled:true,keyword:'報名',match:'exact',type:'url',text:'請報名',url:'https://example.com/apply'};
test('rules reject unsafe URLs and duplicate IDs',()=>{assert.throws(()=>normalizeRules([{...rule,url:'javascript:alert(1)'}]));assert.throws(()=>normalizeRules([rule,rule]));assert.equal(normalizeRules([rule])[0].url,rule.url)});
test('Google read, create, write RAW and readback; unrelated sheets preserved',async()=>{
  let rows=[],hasSheet=false;const requests=[];
  const fetcher=async(url,opts)=>{requests.push({url,opts});if(url.includes('?fields='))return response({properties:{title:'Test'},sheets:[{properties:{sheetId:1,title:'Setting'}},...(hasSheet?[{properties:{sheetId:9,title:'Keywords'}}]:[])]});if(url.endsWith(':batchUpdate')){const body=JSON.parse(opts.body);assert.equal(body.requests[0].addSheet.properties.title,'Keywords');hasSheet=true;return response({})}if(opts.method==='PUT'){assert.ok(url.endsWith('valueInputOption=RAW'));rows=JSON.parse(opts.body).values.map(row=>{const r=[...row];while(r.at(-1)==='')r.pop();return r});return response({updatedRows:rows.length})}return response({values:rows.filter(r=>r.length)})};
  const base={googleToken:'dummy-google-token',spreadsheetId:'test-spreadsheet-123'};
  const first=await sheetOperation({...base,action:'read'},fetcher);assert.deepEqual(first.rules,[]);
  const written=await sheetOperation({...base,action:'write',revision:first.revision,rules:[rule]},fetcher);assert.equal(written.verified,true);assert.equal(written.written,1);
  const read=await sheetOperation({...base,action:'read'},fetcher);assert.deepEqual(read.rules,[rule]);
  await assert.rejects(sheetOperation({...base,action:'write',revision:first.revision,rules:[]},fetcher),e=>e.status===409);
  const empty=await sheetOperation({...base,action:'write',revision:read.revision,rules:[]},fetcher);assert.equal(empty.written,0);assert.equal(rows.filter(r=>r.length).length,1);
});
test('existing foreign sheet schema cannot be overwritten',async()=>{await assert.rejects(sheetOperation({action:'write',spreadsheetId:'test-spreadsheet-123',googleToken:'dummy-token',revision:'anything',rules:[rule]},async url=>url.includes('?fields=')?response({sheets:[{properties:{title:'Keywords'}}]}):response({values:[['其他業務資料']]})),e=>e.status===409)});
test('HTTP validates origin and content, redacts errors and disables caching',async()=>{
  const make=(origin,payload)=>new Request('http://localhost:4317/.netlify/functions/relay-api',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  assert.equal((await handleApi(make('https://evil.test',{}))).status,403);
  const r=await handleApi(make('http://localhost:4317',{service:'models',provider:'OpenAI',action:'list',apiKey:''}));assert.equal(r.status,400);assert.equal(r.headers.get('cache-control'),'no-store');
  const cors=await handleApi(make('https://account.github.io',{service:'models',provider:'Grok',action:'list',apiKey:'dummy-key'}),{allowedOrigins:'https://account.github.io',fetcher:async()=>response({data:[{id:'m1'}]})});assert.equal(cors.headers.get('access-control-allow-origin'),'https://account.github.io');assert.equal(cors.status,200);
});
