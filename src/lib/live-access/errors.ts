// Return fixed categories and SQLSTATE only, never raw database messages or details.
export function liveAccessDatabaseError(error:{code?:string;message?:string}) {
 const known:Record<string,string>={
  'Verified email user required':'account_email_unverified',
  'Dedicated scoped identity required':'account_conflicting_grants',
  'Account scope is immutable':'account_scope_locked',
  'Stale account revision':'account_revision_conflict',
 };
 const category=(error.message&&known[error.message]) || (error.code==='40001'?'conflict':error.code==='42501'?'forbidden':error.code==='22023'?'invalid_association':'account_save_unavailable');
 const diagnosticCode=error.code&&/^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(error.code)?error.code:'UNKNOWN';
 const status=category==='conflict'||category==='account_revision_conflict'?409:category==='forbidden'?403:category==='account_save_unavailable'?503:400;
 return {body:{error:category,diagnosticCode},status};
}
