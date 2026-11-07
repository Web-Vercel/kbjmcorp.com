/** A local diagnostic: never return or log supplied values. No network or business writes. */
export function staffReadiness(environment){
 const checks=[];const add=(name,status)=>checks.push({name,status});
 const url=environment.SUPABASE_URL||'';let validUrl=false;
 try{const u=new URL(url);validUrl=url===url.trim()&&u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/';}catch{}
 add('SUPABASE_URL',!url?'missing':validUrl?'configured':'invalid_format');
 const publicKey=environment.SUPABASE_PUBLISHABLE_KEY||'';
 add('SUPABASE_PUBLISHABLE_KEY',!publicKey?'missing':!publicKey.startsWith('sb_secret_')&&!/\s|=/.test(publicKey)?'configured':'invalid_format');
 const current=environment.SUPABASE_SECRET_KEY||'';const legacy=environment.SUPABASE_SERVICE_ROLE_KEY||'';
 add(current?'SUPABASE_SECRET_KEY':legacy?'SUPABASE_SERVICE_ROLE_KEY':'SUPABASE_SECRET_KEY',current?(/^sb_secret_[A-Za-z0-9_-]+$/.test(current)?'configured':'invalid_format'):legacy?(!/\s|=/.test(legacy)?'legacy_configured':'invalid_format'):'missing');
 const secret=environment.AUTH_RATE_LIMIT_SECRET||'';
 add('AUTH_RATE_LIMIT_SECRET',!secret?'missing':secret.length>=32&&secret===secret.trim()&&!secret.startsWith('AUTH_RATE_LIMIT_SECRET=')?'configured':'invalid_format');
 const siteKey=environment.NEXT_PUBLIC_TURNSTILE_SITE_KEY||'';
 add('NEXT_PUBLIC_TURNSTILE_SITE_KEY',!siteKey?'missing':!/\s|=/.test(siteKey)?'configured':'invalid_format');
 return {checks,staff_config_ready:checks.every(c=>['configured','legacy_configured'].includes(c.status)),requires_hosted_validation:['email_password_provider','turnstile_server_configuration','limiter_rpc_authorization','staff_membership','totp_enrollment_and_aal2','preview_runtime_configuration']};
}
