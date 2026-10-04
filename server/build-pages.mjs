import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// Dashboard Direct Upload accepts a self-contained _worker.js in the asset ZIP.
const root = new URL('../', import.meta.url);
const output = new URL('release/cloudflare-pages/', root);
await mkdir(output, {recursive:true});
await cp(new URL('dist/', root), output, {recursive:true});
const api = await readFile(new URL('server/api.mjs', root), 'utf8');
const worker = await readFile(new URL('server/cloudflare-worker.mjs', root), 'utf8');
const dependency = "import {handleApi} from './api.mjs';";
if (!worker.includes(dependency) || /^import\s/m.test(api)) {
  throw new Error('Worker dependencies changed; review the self-contained Pages bundle.');
}
await writeFile(new URL('_worker.js', output), api + '\n' + worker.replace(dependency, ''));
await writeFile(new URL('_routes.json', output), JSON.stringify({version:1,include:['/api/*','/.netlify/functions/*'],exclude:[]}));
console.log('Pages upload directory:', fileURLToPath(output));
