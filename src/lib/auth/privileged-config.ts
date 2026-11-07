import 'server-only';
/** Prefer the current Supabase server secret; retain existing deployments' legacy setting. */
export function getPrivilegedKey(): string | null {
 const current=process.env.SUPABASE_SECRET_KEY;
 if(current){return /^sb_secret_[A-Za-z0-9_-]+$/.test(current)?current:null;}
 const legacy=process.env.SUPABASE_SERVICE_ROLE_KEY;
 return legacy&&!/\s/.test(legacy)&&!legacy.includes('=')?legacy:null;
}
export function getPrivilegedConnection(){
 const url=process.env.SUPABASE_URL;const key=getPrivilegedKey();
 if(!url||!key||url.trim()!==url)return null;
 try{const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/')return null;}catch{return null;}
 return {url,key};
}
