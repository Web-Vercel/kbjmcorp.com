"use client";
import { useState } from "react";
import type { Locale } from "@/lib/content";
import { applyDemoAction, emptyWorkflow } from "@/lib/workflow/demo";
import ProjectWorkflow, { type WorkflowRole } from "./ProjectWorkflow";
export default function WorkflowPreview({ locale }: { locale: Locale }) {
 const [data, setData] = useState(emptyWorkflow);
 const [role, setRole] = useState<WorkflowRole>("client");
 const zh = locale === "zh";
 return <><p className="admin-demo-banner">{zh ? "交互演示 · 仅在当前页面内存中模拟，刷新或重置即清空。全部资料请使用虚构内容。没有登录真实账户，也不会保存或发送业务数据。" : "Interactive demo · Simulated in this page's memory only. Refresh or reset clears it. Use fictional content. No real account is signed in and no business data is saved or sent."}</p><ol className="workflow-demo-guide"><li>{zh ? "客户视角：提交一份推广需求。" : "Client view: submit a campaign brief."}</li><li>{zh ? "切换团队视角：审核需求，并提交创意方案。" : "Switch to team view: review the brief and submit creative."}</li><li>{zh ? "切回客户视角：确认方案，或请求团队修改后再确认新版。" : "Switch back to client: approve or request changes, then review a revised version."}</li></ol><div className="workflow-preview-switch" aria-label={zh ? "切换模拟角色" : "Switch simulated role"}>{(["client", "staff", "viewer"] as const).map(value => <button key={value} type="button" aria-pressed={role === value} onClick={() => setRole(value)}>{value === "staff" ? (zh ? "团队视角" : "Team view") : value === "client" ? (zh ? "客户协作视角" : "Client collaborator") : (zh ? "客户只读视角" : "Read-only client")}</button>)}<button type="button" onClick={() => { setData(emptyWorkflow()); setRole("client"); }}>{zh ? "重置演示" : "Reset demo"}</button></div><ProjectWorkflow key={role} locale={locale} projectId="demo-project" role={role} data={data} onAction={action => setData(applyDemoAction(data, role, action))}/></>;
}
