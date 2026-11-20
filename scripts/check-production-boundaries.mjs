// Run in a securely supplied Production environment. Prints statuses, never secret values.
import {fileURLToPath} from 'node:url';
export function inspectProductionBoundary(env){
 const checks=[];const add=(name,ok)=>checks.push({check:name,passed:!!ok});
 const expected=env.EXPECTED_PRODUCTION_SUPABASE_REF||'rywmjguhvnppfxwhherl';
 const preview=env.EXPECTED_PREVIEW_SUPABASE_REF||'ziijwwbcpuynkaxsbdvg';
 let url;try{url=new URL(env.SUPABASE_URL);}catch{}
 add('executing_in_production_environment',env.VERCEL_ENV==='production');
 add('separate_project_identity',expected!==preview&&url?.protocol==='https:'&&url?.hostname===expected+'.supabase.co'&&url?.pathname==='/'&&!url?.username&&!url?.password&&!url?.search&&!url?.hash&&!url?.port);
 const publicKey=env.SUPABASE_PUBLISHABLE_KEY||'',secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY||'';
 add('publishable_key_shape',/^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey));
 add('server_key_present_and_distinct',secret.length>=32&&secret!==publicKey&&!/\s/.test(secret)&&(env.SUPABASE_SECRET_KEY?/^sb_secret_[A-Za-z0-9_-]+$/.test(secret):!secret.includes('=')));
 const rate=env.AUTH_RATE_LIMIT_SECRET||'';add('rate_limit_secret_distinct',rate.length>=32&&rate.trim()===rate&&rate!==secret&&rate!==publicKey);
 add('captcha_keys_present',!!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY&&!!env.TURNSTILE_SECRET_KEY);
 add('preview_test_login_disabled',env.CLIENT_EMAIL_TEST_LOGIN_ENABLED!=='true');
 add('retired_demo_disabled',env.DEMO_LOGIN_ENABLED!=='true');
 add('fictional_acceptance_target_absent',!env.COLLECTIONS_TEST_ORGANIZATION_ID);
 add('self_service_application_disabled',env.CLIENT_APPLICATIONS_ENABLED!=='true');
 add('sms_disabled',env.SMS_AUTH_ENABLED!=='true');
 return {passed:checks.every(x=>x.passed),configurationOnly:true,providerScopeVerified:false,captchaPairingVerified:false,backupVerified:false,checks};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const result=inspectProductionBoundary(process.env);console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;}
