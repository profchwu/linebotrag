import {handleApi} from '../../server/api.mjs';
export default (request,context)=>handleApi(request,{allowedOrigins:process.env.ALLOWED_ORIGINS||'',ip:context.ip||'unknown'});
