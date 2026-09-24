import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {resolve, sep} from 'node:path';

const root=fileURLToPath(new URL('./dist/',import.meta.url));
const html=await readFile(resolve(root,'index.html'),'utf8');
const assets=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(x=>x[1]).filter(x=>!x.startsWith('#')&&!/^(data:|https?:)/.test(x));
assert.deepEqual(assets.sort(),['app.js','connections.js','styles.css','wizard.js']);
for(const asset of assets){
  assert.ok(!asset.startsWith('/'),'Assets must be relative to support GitHub repository paths');
  assert.ok((await stat(resolve(root,asset))).isFile());
}
assert.ok((await stat(resolve(root,'.nojekyll'))).isFile());
const config=await readFile(new URL('./netlify.toml',import.meta.url),'utf8');
assert.match(config,/publish\s*=\s*"dist"/);
const server=createServer(async(req,res)=>{
  let pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname.startsWith('/relay-studio/'))pathname=pathname.slice('/relay-studio'.length);
  const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403);res.end();return;}
  try{const data=await readFile(file);res.writeHead(200);res.end(data);}catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{
  const origin=`http://127.0.0.1:${server.address().port}`;
  for(const prefix of ['/','/relay-studio/']){
    const base=origin+prefix;
    assert.equal((await fetch(base)).status,200);
    for(const asset of [...assets,'templates/linebot-template.xlsx'])assert.equal((await fetch(new URL(asset,base))).status,200);
    for(const route of ['knowledge','sheets','models','gas','test','settings']){
      const url=new URL('#'+route,base);
      assert.equal(url.pathname,prefix);
      assert.equal((await fetch(url)).status,200,'Hash navigation must not require rewrites');
    }
  }
  console.log('PASS: static assets, Netlify publish path, all six hash routes at domain root and GitHub repository subpath.');
}finally{await new Promise(resolve=>server.close(resolve));}
