import Link from 'next/link';
export default function SettlementFollowup({locale,company,month,draftId,quoteId,status,archived,published,owner,canReview,preparedByMe}:{locale:'zh'|'en';company?:string;month:string;draftId:string;quoteId:string;status:string;archived:boolean;published:boolean;owner:boolean;canReview:boolean;preparedByMe:boolean}){
 const zh=locale==='zh';if(!company)return null;
 const query=new URLSearchParams({company,month});
 const workbench=`/${locale}/operations/month-close?${query}`;
 let text:string,href=workbench,label=zh?'查看本月整体进度':'View this month’s progress';
 if(published){
  text=zh?'这份草稿已有正式账单，不能通过重新编辑或另存草稿再次结算。接下来核查客户查阅、账单问题与公司间到账。':'This draft has a published statement. Editing or saving another draft must not settle the same account month again. Follow up client acknowledgement, billing questions and intercompany receipts.';
 }else if(!['pending','approved','rejected'].includes(status)){
  text=zh?'当前复核状态尚待确认，请先刷新核查原记录。':'The review status is unconfirmed. Refresh and check the original record first.';
 }else if(status==='rejected'||archived){
  text=archived?(zh?'关联报价已归档，请管理员核查归档原因；需要修订时载入原报价另存新版本，再重新制单。原草稿及复核记录保留。':'The linked quote is archived. An administrator should check why; if revision is needed, load the original quote, save a new version and prepare again. Original preparation and review records remain.'):(zh?'请按退回说明核查来源、收费约定和报价。管理员载入原报价另存新版本后，制单人员再重新制单；不能修改这份已退回草稿。':'Check the source, fee terms and quote against the rejection note. An administrator saves a revised quote as a new version, then finance prepares again. This rejected draft cannot be edited.');
  if(owner){href=`/${locale}/operations/pricing?${new URLSearchParams({company,month,edit:quoteId})}#quote-editor`;label=zh?'载入原报价并修订（另存新版本）':'Load original quote and revise (save new version)';}
  else {href=`/${locale}/operations/pricing?${query}#saved-quotes`;label=zh?'查看本月报价，并请管理员修订':'View monthly quotes; ask an administrator to revise';}
 }else if(status==='approved'){
  text=owner?(zh?'复核已通过。请在下方核对资金、收费约定及客户可见说明，再单独确认发布；余额和版本状态仍由服务器重新核验。':'Review is approved. Check funds, fee terms and the client summary below, then separately confirm publication. The server rechecks balance and version status.'):(zh?'复核已通过，下一步由管理员核对资金并正式发布。当前账号不会自动发布或扣余额。':'Review is approved. An administrator must check funds and publish. This account does not automatically publish or debit the wallet.');
  if(owner){href=`#publish-draft-${draftId}`;label=zh?'前往本草稿发布核对':'Go to publication checks for this draft';}
 }else{
  text=preparedByMe?(zh?'本账号是制单人，须由另一位有权限的账号独立复核。原草稿编号和说明供交接使用。':'This account prepared the draft; another authorized account must independently review it. Use the original draft ID and notes for handoff.'):canReview||owner?(zh?'请在下方独立核对原来源、报价及收费约定后选择通过或退回；复核本身不发布、不扣款。':'Independently check the source, quote and fee terms below, then approve or reject. Review itself does not publish or debit.'):(zh?'等待另一位有权限的复核人员处理，请保留原草稿供交接。':'Await an authorized independent reviewer; retain the original draft for handoff.');
 }
 return <section className="admin-notice" aria-label={zh?'本草稿下一步':'Next step for this draft'}><h4>{zh?'下一步':'Next step'}</h4><p>{text}</p><Link className="service-link" href={href}>{label}</Link>{published&&<p><Link className="service-link" href={`/${locale}/operations/upstream-payments?${query}`}>{zh?'核查本月公司间到账与核销':'Check monthly intercompany receipts and allocations'}</Link></p>}</section>;
}
