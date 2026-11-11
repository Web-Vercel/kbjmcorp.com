import 'server-only';
export type DemoSettingState='ready'|'missing'|'disabled'|'invalid'|'encoded'|'wrong_shape';
// Configuration metadata only. Never include secret values, hashes or account contents.
export function demoSettingChecks(validateAccounts:(value:unknown)=>boolean){
 const enabled=process.env.DEMO_LOGIN_ENABLED,secret=process.env.DEMO_SESSION_SECRET,raw=process.env.DEMO_ACCOUNTS_JSON;
 let accounts:DemoSettingState='missing';if(raw){try{const value=JSON.parse(raw);accounts=typeof value==='string'?'encoded':!Array.isArray(value)?'wrong_shape':validateAccounts(value)?'ready':'invalid';}catch{accounts='invalid';}}
 return {DEMO_LOGIN_ENABLED:(!enabled?'missing':enabled==='true'?'ready':enabled==='false'?'disabled':'invalid') as DemoSettingState,DEMO_SESSION_SECRET:(!secret?'missing':secret.length<32||secret.trim()!==secret||secret===process.env.AUTH_RATE_LIMIT_SECRET?'invalid':'ready') as DemoSettingState,DEMO_ACCOUNTS_JSON:accounts};
}
