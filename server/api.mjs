import {createHash} from 'node:crypto';
const RULE_HEADERS=['規則ID','啟用','關鍵詞','比對方式','回覆類型','顯示文字','網址'];
export class ApiError extends Error {constructor(status,message){super(message);this.status=status}}
const fail=(status,message)=>{throw new ApiError(status,message)};
function credential(value){if(typeof value!=='string'||value.trim().length<8||value.length>4096||/[\r\n]/.test(value))fail(400,'請輸入有效的憑證。');return value.trim()}
function modelID(value){if(typeof value!=='string'||!/^[-a-zA-Z0-9_./:]{1,200}$/.test(value))fail(400,'請選擇或輸入模型名稱。');return value.replace(/^models\//,'')}
async function upstream(url,options,fetcher){let r;try{r=await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(25000)})}catch{fail(504,'服務連線失敗或逾時，請稍後再試。')}let data;try{data=await r.json()}catch{fail(502,'服務未回傳可辨識的資料。')}if(!r.ok){const messages={400:'請求不被接受，請確認模型支援此文字測試介面或資料格式。',401:'憑證無效或已過期，請重新輸入或授權。',403:'沒有權限，或服務尚未啟用。',404:'找不到模型、試算表或服務資源。',429:'額度不足或請求過於頻繁，請檢查帳號用量。'};fail(r.status,messages[r.status]||'外部服務暫時無法處理請求。')}return data}
const jsonBody=data=>({method:'POST',body:JSON.stringify(data)});
export async function modelOperation(input,fetcher=fetch){const {provider,action}=input;if(!['OpenAI','Gemini','Grok'].includes(provider)||!['list','test'].includes(action))fail(400,'不支援的模型操作。');const key=credential(input.apiKey);const headers={'Content-Type':'application/json',...(provider==='Gemini'?{'x-goog-api-key':key}:{Authorization:`Bearer ${key}`})};const started=Date.now();let data;
  if(action==='list'){
    let models=[],nextPageToken=null;
    if(provider==='Gemini'){if(input.pageToken!==undefined&&(typeof input.pageToken!=='string'||input.pageToken.length>4096))fail(400,'模型清單分頁參數無效。');const url=new URL('https://generativelanguage.googleapis.com/v1beta/models');url.searchParams.set('pageSize','1000');if(input.pageToken)url.searchParams.set('pageToken',input.pageToken);data=await upstream(url,{headers},fetcher);models=(data.models||[]).filter(m=>m.supportedGenerationMethods?.includes('generateContent')).map(m=>m.name.replace(/^models\//,''));nextPageToken=data.nextPageToken||null;
    }else{data=await upstream(provider==='OpenAI'?'https://api.openai.com/v1/models':'https://api.x.ai/v1/models',{headers},fetcher);models=(data.data||[]).map(m=>m.id)}
    return {provider,models:[...new Set(models)].sort(),nextPageToken,status:'listed_not_tested',latencyMs:Date.now()-started};
  }
  const model=modelID(input.model),prompt='This is an API connectivity test. Reply with OK only.';let text='',usage=null;
  if(provider==='OpenAI'){data=await upstream('https://api.openai.com/v1/responses',{headers,...jsonBody({model,input:prompt,max_output_tokens:512,store:false})},fetcher);text=(data.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('\n');usage=data.usage||null;
  }else if(provider==='Gemini'){data=await upstream(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{headers,...jsonBody({contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:512}})},fetcher);text=(data.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('\n');usage=data.usageMetadata||null;
  }else{data=await upstream('https://api.x.ai/v1/chat/completions',{headers,...jsonBody({model,messages:[{role:'user',content:prompt}],max_tokens:512,stream:false})},fetcher);text=data.choices?.[0]?.message?.content||'';usage=data.usage||null}
  if(typeof text!=='string'||!text.trim())fail(422,'服務已接受請求，但沒有產生可用文字；可能達到輸出上限、受限制或不支援此測試，不能判定測試通過。');
  return {provider,model,status:'tested',text:text.slice(0,2000),latencyMs:Date.now()-started,testedAt:new Date().toISOString(),usage};
}
export function normalizeRules(rules){if(!Array.isArray(rules)||rules.length>100)fail(400,'規則最多 100 筆。');const ids=new Set();return rules.map((r,i)=>{if(!r||typeof r.id!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(r.id)||ids.has(r.id))fail(400,'規則識別碼無效或重複。');ids.add(r.id);if(typeof r.enabled!=='boolean'||!['contains','exact','prefix'].includes(r.match)||!['text','url'].includes(r.type))fail(400,`第 ${i+1} 筆規則格式錯誤。`);const keyword=String(r.keyword||'').trim(),text=String(r.text||'').trim(),url=String(r.url||'').trim();if(!keyword||keyword.length>200||!text||text.length>4000||url.length>1000)fail(400,`第 ${i+1} 筆關鍵詞或回覆長度不正確。`);if(r.type==='url'){try{const u=new URL(url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error()}catch{fail(400,`第 ${i+1} 筆網址必須是 http 或 https。`)}}return {id:r.id,enabled:r.enabled,keyword,match:r.match,type:r.type,text,url:r.type==='url'?url:''}})}
export const rulesToRows=rules=>[RULE_HEADERS,...rules.map(r=>[r.id,r.enabled?'TRUE':'FALSE',r.keyword,r.match,r.type,r.text,r.url])];
const revision=values=>createHash('sha256').update(JSON.stringify(values)).digest('hex');
export async function sheetOperation(input,fetcher=fetch){const token=credential(input.googleToken);const id=input.spreadsheetId;if(typeof id!=='string'||!/^[-a-zA-Z0-9_]{10,200}$/.test(id))fail(400,'試算表 ID 無效。');if(!['read','write'].includes(input.action))fail(400,'不支援的試算表操作。');const headers={'Content-Type':'application/json',Authorization:`Bearer ${token}`};const base=`https://sheets.googleapis.com/v4/spreadsheets/${id}`;const metadata=await upstream(base+'?fields=spreadsheetId,properties(title),sheets(properties)',{headers},fetcher);const sheets=(metadata.sheets||[]).map(s=>s.properties);const sheet=sheets.find(s=>s.title.toLowerCase()==='keywords')||sheets.find(s=>s.title==='關鍵詞觸發');const ruleSheetName=sheet?.title||'Keywords';let values=[];
  if(sheet){const result=await upstream(base+'/values/'+encodeURIComponent(`'${ruleSheetName}'!A1:G1001`),{headers},fetcher);values=result.values||[];if(values.length&&JSON.stringify(values[0])!==JSON.stringify(RULE_HEADERS))fail(409,'「Keywords」工作表已有其他格式，請先備份並更名，系統不會覆寫。');if(values.length>101)fail(409,'工作表超過 100 筆規則，請先整理資料再同步。')}
  const currentRevision=revision(values);const existing=values.slice(1).filter(r=>r.some(Boolean)).map(r=>({id:r[0],enabled:r[1]==='TRUE',keyword:r[2]||'',match:r[3],type:r[4],text:r[5]||'',url:r[6]||''}));
  if(input.action==='read')return {spreadsheetId:id,title:metadata.properties?.title,sheets:sheets.map(s=>({id:s.sheetId,name:s.title})),rules:normalizeRules(existing),revision:currentRevision};
  const rules=normalizeRules(input.rules);if(input.revision!==currentRevision)fail(409,'Google Sheet 已有變更，請先重新讀取規則再寫入，避免覆蓋其他人的修改。');
  if(!sheet)await upstream(base+':batchUpdate',{headers,...jsonBody({requests:[{addSheet:{properties:{title:'Keywords',gridProperties:{rowCount:1000,columnCount:7}}}}]})},fetcher);
  const rows=rulesToRows(rules),padded=[...rows];while(padded.length<values.length)padded.push(Array(7).fill(''));
  await upstream(base+'/values/'+encodeURIComponent(`'${ruleSheetName}'!A1:G${padded.length}`)+'?valueInputOption=RAW',{headers,method:'PUT',body:JSON.stringify({range:`'${ruleSheetName}'!A1:G${padded.length}`,majorDimension:'ROWS',values:padded})},fetcher);
  const confirmed=await upstream(base+'/values/'+encodeURIComponent(`'${ruleSheetName}'!A1:G1001`),{headers},fetcher);const received=confirmed.values||[];
  // Google omits trailing empty cells. Compare padded rows, not byte representation.
  const canon=rs=>rs.map(r=>Array.from({length:7},(_,i)=>String(r[i]??''))).filter(r=>r.some(Boolean));
  if(JSON.stringify(canon(received))!==JSON.stringify(canon(rows)))fail(409,'写入後讀回內容不同，請重新讀取工作表確認，勿重複送出。');
  return {written:rules.length,revision:revision(received),spreadsheetId:id,range:'Keywords!A:G',verified:true};
}
const rate=new Map();
export async function handleApi(request,{fetcher=fetch,allowedOrigins='',ip='local'}={}){const origin=request.headers.get('origin'),own=new URL(request.url).origin;const allowed=new Set([own,...allowedOrigins.split(',').map(s=>s.trim()).filter(Boolean)]);const cors={'Cache-Control':'no-store','Content-Type':'application/json','Vary':'Origin'};if(origin&&allowed.has(origin)){cors['Access-Control-Allow-Origin']=origin;cors['Access-Control-Allow-Headers']='Content-Type';cors['Access-Control-Allow-Methods']='POST, OPTIONS'}const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
  if(!origin||!allowed.has(origin))return respond({error:'此來源未被允許。'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return respond({error:'只接受 POST。'},405);
  const now=Date.now();if(rate.size>1000)for(const[k,v]of rate)if(now-v.since>60000)rate.delete(k);const slot=rate.get(ip);if(slot&&now-slot.since<60000){if(++slot.count>30)return respond({error:'請稍後再試。'},429)}else rate.set(ip,{since:now,count:1});
  try{if(!request.headers.get('content-type')?.includes('application/json'))fail(415,'只接受 JSON。');const raw=await request.text();if(raw.length>600000)fail(413,'請求過大。');let input;try{input=JSON.parse(raw)}catch{fail(400,'JSON 格式無效。')}if(!input||typeof input!=='object')fail(400,'請求格式無效。');const result=input.service==='models'?await modelOperation(input,fetcher):input.service==='sheets'?await sheetOperation(input,fetcher):fail(400,'未知服務。');return respond(result)}catch(e){return respond({error:e instanceof ApiError?e.message:'服務暫時無法處理請求。'},e instanceof ApiError?e.status:500)}
}
