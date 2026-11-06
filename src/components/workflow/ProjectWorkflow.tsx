"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/content";
import { formatDate, statusText } from "@/lib/admin/content";
import { safeReference, workflowActionSchema, type WorkflowAction, type WorkflowData, type Submission } from "@/lib/workflow/model";
export type WorkflowRole = "staff" | "client" | "viewer";
export default function ProjectWorkflow({ locale, projectId, role, data, completed = false, onAction }: { locale: Locale; projectId: string; role: WorkflowRole; data: WorkflowData; completed?: boolean; onAction?: (action: WorkflowAction) => void }) {
 const zh = locale === "zh";
 const router = useRouter();
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState("");
 const locked = useRef(false);
 const latest = (kind: string) => data.submissions.filter(s => s.kind === kind).sort((a, b) => b.version - a.version)[0];
 const title = (kind: string) => kind === "brief" ? (zh ? "推广需求" : "Campaign brief") : (zh ? "创意方案" : "Creative proposal");
 const decision = (value: string) => value === "approved" ? (zh ? "已确认" : "Approved") : (zh ? "需要修改" : "Changes requested");
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); if (locked.current) return;
  const form = event.currentTarget;
  const parsed = workflowActionSchema.safeParse(Object.fromEntries(new FormData(form)));
  if (!parsed.success) { setMessage(zh ? "请检查输入内容与确认选项。" : "Check the fields and confirmation."); return; }
  locked.current = true; setBusy(true); setMessage("");
  try {
   if (onAction) onAction(parsed.data);
   else {
    const response = await fetch(`/api/projects/${projectId}/workflow`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
    if (!response.ok) {
     setMessage(response.status === 409 ? (zh ? "版本已更新或已经审核，请刷新页面后重试。" : "This version changed or was reviewed. Refresh and try again.") : response.status === 401 ? (zh ? "登录已过期，请重新登录；内容尚未保存。" : "Session expired. Sign in again; your changes were not saved.") : response.status === 403 ? (zh ? "没有操作权限，请确认公司授权或员工二次验证。" : "Access denied. Check company authorization or staff MFA.") : (zh ? "未保存，请稍后重试。输入内容已保留。" : "Not saved. Try again later; your input is retained.")); return;
    }
    router.refresh();
   }
   form.reset(); setMessage(onAction ? (zh ? "演示操作完成，仅在当前页面模拟。" : "Demo action completed in this page only.") : (zh ? "已保存，可在记录中查看。" : "Saved to the project record."));
  } catch { setMessage(zh ? "操作未完成，输入内容已保留，请重试。" : "Action failed. Your input is retained; try again."); }
  finally { locked.current = false; setBusy(false); }
 }
 function submissionCard(item: Submission, current: boolean) {
  const review = data.reviews.find(r => r.submission_id === item.id);
  const url = safeReference(item.reference_url);
  const canReview = current && !completed && !review && ((role === "staff" && item.kind === "brief") || (role === "client" && item.kind === "creative"));
  return <article className="workflow-version" key={item.id}><div className="workflow-version-heading"><h3>{item.title}</h3><span className="admin-badge">V{item.version} · {review ? decision(review.decision) : zh ? "待审核" : "Awaiting review"}</span></div><p className="workflow-byline">{item.author_role === "staff" ? (zh ? "团队提交" : "Submitted by team") : (zh ? "客户提交" : "Submitted by client")} · {formatDate(item.created_at, locale)}</p><p className="admin-prewrap">{item.body}</p>{url && <a className="service-link" href={url} target="_blank" rel="noopener noreferrer nofollow">{zh ? "查看外部参考资料" : "Open external reference"} ↗</a>}{review && <div className="workflow-feedback"><strong>{review.reviewer_role === "staff" ? (zh ? "团队反馈" : "Team feedback") : (zh ? "客户确认意见" : "Client feedback")}</strong><p className="admin-prewrap">{review.feedback}</p><time>{formatDate(review.created_at, locale)}</time></div>}{canReview && <form className="admin-form workflow-review" onSubmit={submit}><input type="hidden" name="action" value="review"/><input type="hidden" name="submissionId" value={item.id}/><label>{zh ? "审核结果" : "Decision"}<select name="decision"><option value="approved">{zh ? "确认本版本" : "Approve this version"}</option><option value="changes_requested">{zh ? "请求修改" : "Request changes"}</option></select></label><label>{zh ? "反馈意见" : "Feedback"}<textarea name="feedback" required minLength={2} maxLength={1000} rows={3}/></label><label className="admin-checkbox"><input name="confirm" type="checkbox" required/>{zh ? `我已审阅 ${title(item.kind)} V${item.version}，确认以上意见。` : `I reviewed ${title(item.kind)} V${item.version} and confirm this decision.`}</label><button className="button" disabled={busy}>{zh ? "提交审核意见" : "Submit decision"}</button></form>}</article>;
 }
 function activityLabel(type: string, detail: string) {
  if (type === "update") return detail;
  const parts = detail.split(":");
  if (type === "status") return `${zh ? "项目阶段" : "Project stage"}: ${statusText(parts[0], locale)} → ${statusText(parts[1], locale)}`;
  return `${title(parts[0])} V${parts[1]} · ${type === "submission" ? (zh ? "已提交" : "Submitted") : decision(parts[2])}`;
 }
 if (data.error) return <section className="admin-panel"><p className="admin-error">{zh ? "暂时无法读取协作记录，请稍后重试。当前不会开放提交操作。" : "Collaboration records are unavailable. Try again later; submissions are disabled."}</p></section>;
 const kind = role === "staff" ? "creative" : "brief";
 return <section className="project-workflow" aria-label={zh ? "项目协作" : "Project collaboration"}><div className="admin-page-heading"><h2>{zh ? "需求与创意协作" : "Briefs & creative review"}</h2></div><p className="admin-notice">{zh ? "每次提交保留独立版本，确认仅适用于该版本。这里的确认不会提交广告、调整预算或启动真实投放。参考资料以外部 HTTPS 链接提供；请勿填写密码、验证码或账户密钥。" : "Each submission keeps a separate version. Approval applies only to that version and does not submit ads, change budgets or launch campaigns. References use external HTTPS links. Do not include passwords, verification codes or account keys."}</p>{completed && <p className="admin-notice">{zh ? "项目已完成，需求与创意现为只读。" : "Project completed. Briefs and creative are read-only."}</p>}{role === "viewer" && <p className="workflow-byline">{zh ? "您拥有只读访问权限；提交需求和确认创意需由公司授权协作成员操作。" : "You have read-only access. An authorized collaborator must submit briefs and approve creative."}</p>}
 <div className="workflow-grid">{["brief", "creative"].map(k => { const current = latest(k); const history = data.submissions.filter(s => s.kind === k && s.id !== current?.id).sort((a, b) => b.version - a.version); return <section className="admin-panel" key={k}><h2>{title(k)}</h2>{current ? submissionCard(current, true) : <p className="admin-empty">{zh ? "尚未提交" : "Not submitted"}</p>}{!!history.length && <details className="workflow-history"><summary>{zh ? `查看历史版本（${history.length}）` : `Previous versions (${history.length})`}</summary>{history.map(item => submissionCard(item, false))}</details>}</section>; })}</div>
 {role !== "viewer" && !completed && <section className="admin-panel"><h2>{zh ? `提交${latest(kind) ? "新版" : ""}${title(kind)}` : `Submit ${latest(kind) ? "revised " : ""}${title(kind)}`}</h2><form className="admin-form" onSubmit={submit}><input type="hidden" name="action" value="submit"/><input type="hidden" name="kind" value={kind}/><input type="hidden" name="expectedVersion" value={latest(kind)?.version || 0}/><label>{zh ? "标题" : "Title"}<input name="title" required minLength={2} maxLength={160}/></label><label>{zh ? (kind === "brief" ? "产品、品牌、目标受众与推广目标" : "创意内容、表达方向与交付说明") : kind === "brief" ? "Product, brand, audience and objectives" : "Creative content, direction and delivery notes"}<textarea name="body" required minLength={10} maxLength={1500} rows={5}/></label><label>{zh ? "外部参考资料链接（选填，仅 HTTPS）" : "External reference link (optional, HTTPS only)"}<input name="referenceUrl" type="url" maxLength={1000} placeholder="https://"/></label><button className="button" disabled={busy}>{zh ? "提交并保留版本" : "Submit version"}</button></form></section>}
 {role === "staff" && <section className="admin-panel"><h2>{zh ? "发布客户可见的进展说明" : "Publish a client-visible update"}</h2><p className="workflow-byline">{zh ? "此处内容会展示给客户。内部备注请继续写在咨询跟进记录中。" : "Clients can read this update. Keep internal notes in inquiry follow-up."}</p><form className="admin-form" onSubmit={submit}><input type="hidden" name="action" value="update"/><label>{zh ? "进展说明" : "Progress update"}<textarea name="body" required minLength={2} maxLength={1000} rows={3}/></label><button className="button" disabled={busy}>{zh ? "发布进展" : "Publish update"}</button></form></section>}
 <p className="workflow-result" role="status" aria-live="polite">{message}</p><section className="admin-panel"><h2>{zh ? "项目动态" : "Project activity"}</h2>{!data.activity.length ? <p className="admin-empty">{zh ? "暂无动态" : "No activity yet"}</p> : <ol className="workflow-timeline">{data.activity.map(event => <li key={event.id}><span className="workflow-byline">{event.actor_role === "staff" ? (zh ? "团队" : "Team") : event.actor_role === "client" ? (zh ? "客户" : "Client") : (zh ? "系统" : "System")} · {formatDate(event.created_at, locale)}</span><p>{activityLabel(event.event_type, event.detail)}</p></li>)}</ol>}{data.activity.length === 100 && <p className="workflow-byline">{zh ? "显示最近 100 条动态。" : "Showing the latest 100 events."}</p>}</section></section>;
}
