import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export function resolveConfig(environment,dashboardMode=false,log=console.log){
function configured(name,alias){
 const original=environment[name]||'';let value=original.trim();
 const prefix=[`${name}=`,`${alias}=`].find(p=>value.startsWith(p));
 if(prefix){if(!dashboardMode)throw new Error(`${name}: Value must contain only the value, without NAME=. Fix environment settings, or use --dashboard-values for a diagnostic-only read.`);value=value.slice(prefix.length).trim();log(JSON.stringify({warning:'assignment_prefix_removed_for_diagnostic_only',variable:name}));}
 if(value!==original&&!prefix)log(JSON.stringify({warning:'outer_whitespace_removed_for_diagnostic_only',variable:name}));
 return value;
}
 const rawUrl=configured('SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL');
 const key=configured('SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
 const url=new URL(rawUrl);
 if(url.protocol!=='https:'||!/^\w+\.supabase\.co$/.test(url.hostname)||url.username||url.password||url.port||url.search||url.hash||!['','/'].includes(url.pathname))throw new Error('SUPABASE_URL must be the project HTTPS origin only.');
 if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))throw new Error('SUPABASE_PUBLISHABLE_KEY is missing or not a new publishable key; no request was sent.');
 return {origin:url.origin,key};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
try{
 const {origin,key}=resolveConfig(process.env,process.argv.includes('--dashboard-values'));
 let ready=true;
 for(const [check,path] of [['auth_health','/auth/v1/health'],['auth_settings','/auth/v1/settings'],['application_schema','/rest/v1/customer_applications?select=id&limit=0']]){
  // stdin keeps configuration out of process arguments. Never print raw responses or credentials.
  const config=`url = "${origin}${path}"\nheader = "apikey: ${key}"\nheader = "Accept: application/json"\n`;
  const r=spawnSync('curl',['--config','-','--silent','--show-error','--connect-timeout','10','--max-time','20','--write-out','\n%{http_code}'],{input:config,encoding:'utf8',maxBuffer:65536});
  if(r.status!==0){console.log(JSON.stringify({check,error:'network_or_proxy_failure',curl_exit:r.status}));ready=false;break;}
  const split=r.stdout.lastIndexOf('\n');const status=Number(r.stdout.slice(split+1));let body={};try{body=JSON.parse(r.stdout.slice(0,split));}catch{}
  const output={check,status};if(check==='auth_settings'&&status===200)output.phone_provider_enabled=body.external?.phone===true;
  if(typeof body.code==='string')output.code=body.code;
  console.log(JSON.stringify(output));if(status!==200)ready=false;
 }
 if(!ready)process.exitCode=1;
}catch(error){console.error(error.message);process.exitCode=1;}

}
