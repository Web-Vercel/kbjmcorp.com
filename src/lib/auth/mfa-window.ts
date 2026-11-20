/** Fixed window anchored to the authenticated provider sign-in time, never browser activity. */
export function mfaDeadline(lastSignIn:string|undefined,hasVerifiedFactor:boolean){
 const started=lastSignIn?Date.parse(lastSignIn):NaN;
 return Number.isFinite(started)&&started>0?started+(hasVerifiedFactor?5:10)*60000:null;
}
