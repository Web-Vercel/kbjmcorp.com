import {z} from 'zod';
import {opsStatus} from './model';
import {statementQuestionMessage} from './statement-questions';
export const serviceExportRequest=z.object({id:z.uuid(),subject:z.string().min(3).max(160),category:z.enum(['account','report','billing','other']),status:z.enum(['open','in_progress','resolved']),created_at:z.iso.datetime({offset:true}),updated_at:z.iso.datetime({offset:true}),statement_id:z.uuid().nullable(),statement_month:z.iso.date().nullable()});
export const serviceExportMessages=statementQuestionMessage.array().min(1).max(200);
export function serviceConversationCsv(input:unknown,rows:unknown,locale:'zh'|'en',exportedAt:string){
 const r=serviceExportRequest.parse(input),messages=serviceExportMessages.parse(rows),zh=locale==='zh';z.iso.datetime({offset:true}).parse(exportedAt);
 if(messages.some(m=>m.request_id!==r.id)||new Set(messages.map(m=>m.id)).size!==messages.length)throw new Error('Invalid conversation scope');
 const t=(cn:string,en:string)=>zh?cn:en;
 const categories={account:t('账户服务','Account service'),report:t('报告问题','Report question'),billing:t('财务问题','Billing question'),other:t('其他服务','Other service')};
 const data:string[][]=[
 [t('工单沟通记录','Service conversation record')],
 [t('说明','Notice'),t('本文件为下载时的沟通记录副本，不自动更新；不代表收费认可、账单调整、退款或付款凭证。','This is a conversation copy at download time and does not update automatically. It does not establish fee agreement, statement adjustments, refunds or proof of payment.')],
 [t('工单编号','Request ID'),r.id],[t('标题','Subject'),r.subject],[t('问题类别','Category'),categories[r.category]],
 [t('下载时处理状态','Status at download'),opsStatus(r.status,locale)],
 [t('创建时间（ISO 8601）','Created at (ISO 8601)'),r.created_at],[t('最后更新时间（ISO 8601）','Last updated (ISO 8601)'),r.updated_at],
 [t('下载时间（ISO 8601）','Downloaded at (ISO 8601)'),exportedAt],
 [t('关联账单编号','Linked statement ID'),r.statement_id||''],[t('账单结算月份','Statement settlement month'),r.statement_month?.slice(0,7)||''],
 [t('消息条数','Message count'),String(messages.length)],[],
 [t('消息编号','Message ID'),t('发送时间（ISO 8601）','Sent at (ISO 8601)'),t('发送方','Sender'),t('内容','Content')],
 ...[...messages].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||a.id.localeCompare(b.id)).map(m=>[m.id,m.created_at,m.author_role==='staff'?t('服务团队','Service team'):t('客户','Client'),m.body])];
 const cell=(v:string)=>'"'+(/^[\s\uFEFF]*[=+\-@]/.test(v)?"'"+v:v).replaceAll('"','""')+'"';
 return '\uFEFF'+data.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
