import {handleApi} from './api.mjs';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/health') {
      return Response.json({ok:true,service:'linebotrag',runtime:'cloudflare-workers'}, {headers:{'Cache-Control':'no-store'}});
    }
    // Preserve the existing frontend path across Netlify and Workers deployments.
    if (path === '/.netlify/functions/relay-api' || path === '/api/relay') {
      return handleApi(request, {
        allowedOrigins: env.ALLOWED_ORIGINS || '',
        ip: request.headers.get('CF-Connecting-IP') || 'unknown'
      });
    }
    return env.ASSETS.fetch(request);
  }
};
