import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireOperations} from '@/lib/operations/server';
import {lastEndedFundsMonth} from '@/lib/billing/monthly-funds';
import {statementQuestionWorkbench,statementQuestionColumns,statementQuestionRow,statementQuestionMessage} from '@/lib/operations/statement-questions';
import StatementQuestionSummary from '@/components/operations/StatementQuestionSummary';
import ServiceThread from '@/components/operations/ServiceThread';
export const dynamic='force-dynamic';
export const metadata={title:'账单问题跟进 | 智点未来',robots:{index:false,follow:false}};
export default async function Questions({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{company?:string;month?:string;ticket?:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const zh=locale==='zh';const {client,context}=await requireOperations(locale);if(!context||!(context.owner||context.canPrepare||context.canReview))notFound();
 const query=await searchParams,month=query.month||lastEndedFundsMonth();
 if(query.company&&!z.uuid().safeParse(query.company).success||query.ticket&&!z.uuid().safeParse(query.ticket).success)notFound();
 if(!/^\d{4}-\d{2}$/.test(month)||!z.iso.date().safeParse(month+'-01').success||month<'2000-01')notFound();
 const orgResult=await client.from('organizations').select('id,name').order('name').limit(500);const parsedOrgs=z.array(z.object({id:z.uuid(),name:z.string()})).safeParse(orgResult.data);const orgError=!!orgResult.error||!parsedOrgs.success,orgs=!orgError&&parsedOrgs.success?parsedOrgs.data:[],company=query.company||orgs[0]?.id;
 if(query.company&&!orgError&&!orgs.some(o=>o.id===query.company))notFound();
 const result=company&&!orgError?await client.rpc('get_statement_question_workbench',{p_org:company,p_month:month+'-01'}):null;const parsed=statementQuestionWorkbench.safeParse(result?.data);const data=result&&!result.error&&parsed.success&&parsed.data.organization_id===company&&parsed.data.month===month+'-01'?parsed.data:null;
 let selected:z.infer<typeof statementQuestionRow>|null=null,messages:z.infer<typeof statementQuestionMessage>[]=[],detailError=false;
 if(query.ticket&&company&&data){const r=await client.from('service_requests').select(statementQuestionColumns).eq('id',query.ticket).eq('organization_id',company).eq('statement_month',month+'-01').eq('category','billing').not('statement_id','is',null).maybeSingle();if(!r.error&&!r.data)notFound();const one=statementQuestionRow.safeParse(r.data);detailError=!!r.error||!one.success;if(one.success&&!r.error&&one.data.id===query.ticket&&one.data.organization_id===company&&one.data.statement_month===month+'-01'){selected=one.data;const thread=await client.from('service_request_messages').select('id,request_id,body,author_role,created_at').eq('request_id',selected.id).order('created_at').limit(200);const list=statementQuestionMessage.array().max(200).safeParse(thread.data);if(!thread.error&&list.success&&list.data.every(m=>m.request_id===selected!.id))messages=list.data;else detailError=true;}else detailError=true;}
 return <main className="wrap section client-workspace"><Link className="service-link" href={`/${locale}/operations/month-close?${new URLSearchParams({month,...(company?{company}:{})})}`}>← {zh?'月结工作台':'Month-close workbench'}</Link><h1>{zh?'账单问题跟进':'Billing-question follow-up'}</h1><p className="admin-notice">{zh?'按客户企业和账单结算月份跟进，月份不是提问日期或扣款日期。待处理工单优先显示，回复与状态更新沿用原工单流程，不修改账单或资金。':'Follow questions by client company and statement settlement month, not question or debit date. Pending requests appear first. Replies and status updates use the existing workflow and do not change statements or funds.'}</p>
 {!orgError&&orgs.length>0&&<form className="admin-filter"><label>{zh?'客户企业':'Client company'}<select name="company" defaultValue={company}>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label>{zh?'账单结算月份':'Statement settlement month'}<input name="month" type="month" min="2000-01" defaultValue={month} required/></label><button className="button">{zh?'查看账单问题':'View billing questions'}</button></form>}
 {orgError?<p className="admin-error">{zh?'企业资料暂不可用，未推断工单状态。':'Company data unavailable; request status is unknown.'}</p>:!company?<p>{zh?'暂无可访问的客户企业。':'No accessible client company.'}</p>:<><StatementQuestionSummary data={data} locale={locale} company={company} month={month} showLink={false}/>{data&&<><p>{data.truncated?(zh?'汇总覆盖全部关联工单，列表仅显示100条，待处理优先；较早记录仍可由原工单链接打开。':'Totals include all linked requests. The list is limited to 100, pending first; older requests remain accessible via their original links.'):(zh?'本月账单关联工单均已列出，待处理优先。':'All requests linked to this month’s statements are listed, pending first.')}</p><ServiceThread locale={locale} requests={data.rows} selected={selected} messages={messages} staff staffScope={{company,month}} error={detailError}/></>}</>}
 </main>;
}
