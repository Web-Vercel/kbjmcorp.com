/** No credentials are broadcast or stored. Other tabs only learn to refresh their server session. */
export const sessionChannel='workspace-session-change';
export function notifySessionChange(){
 if(typeof window==='undefined')return;
 // Successful sign-in/sign-out starts a fresh inactivity window, never an old account's timer.
 try{for(const key of Object.keys(window.localStorage))if(key.startsWith('workspace-last-activity:'))window.localStorage.removeItem(key);}catch{/* Memory-only inactivity tracking is still available. */}
 try{if(typeof window.BroadcastChannel!=='undefined'){const channel=new window.BroadcastChannel(sessionChannel);channel.postMessage('changed');channel.close();}}catch{/* Storage events provide a fallback. */}
 try{window.localStorage.setItem(sessionChannel,String(Date.now()));}catch{/* Private browsing may disable storage. */}
}
/** Full navigation discards client form state and prefetched pages from the previous account. */
export function reloadForSessionChange(){window.location.reload();}
