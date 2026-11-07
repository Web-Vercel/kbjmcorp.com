import 'server-only';
import {z} from 'zod';
import {getStaffLoginConfig} from './config';
/** A separate Preview-only entry for two explicitly provisioned, verified email customers. */
export function getClientTestLoginConfig(){
 if(process.env.VERCEL_ENV!=='preview'||process.env.CLIENT_EMAIL_TEST_LOGIN_ENABLED!=='true')return null;
 const ids=(process.env.CLIENT_EMAIL_TEST_USER_IDS||'').split(',').map(id=>id.trim());
 if(ids.length!==2||new Set(ids).size!==2||ids.some(id=>!z.uuid().safeParse(id).success))return null;
 const security=getStaffLoginConfig();
 return security?{allowedUserIds:ids,siteKey:security.siteKey}:null;
}
