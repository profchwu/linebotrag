import {writeFile} from 'node:fs/promises';

// These two values are PUBLIC browser configuration, never credentials.
const apiBase=(process.env.PUBLIC_API_ORIGIN||'').trim();
const googleClientId=(process.env.PUBLIC_GOOGLE_CLIENT_ID||'').trim();
if(apiBase){
  const url=new URL(apiBase);
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('PUBLIC_API_ORIGIN must be an HTTPS origin');
}
if(googleClientId&&!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(googleClientId))throw Error('PUBLIC_GOOGLE_CLIENT_ID must be a public Web OAuth client ID');
await writeFile(new URL('../dist/site-config.js',import.meta.url),`window.LINEBOT_SITE_CONFIG=Object.freeze(${JSON.stringify({apiBase,googleClientId})});\n`);
console.log('Public website configuration generated; no API keys or tokens included.');
