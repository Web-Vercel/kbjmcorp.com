export const idleLimitMs=15*60*1000;
export const idleWarningMs=60*1000;
export function activityKey(userId:string){return 'workspace-last-activity:'+userId;}
export function validActivity(value:string|null,now:number){const time=Number(value);return value!==null&&Number.isFinite(time)&&time>0&&time<=now?time:null;}
export function idleRemaining(last:number,now:number){return Math.max(0,idleLimitMs-Math.max(0,now-last));}
