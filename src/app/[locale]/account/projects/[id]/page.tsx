import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectSummary } from "@/components/client/ClientWorkspace";
import { requireClientPage } from "@/lib/client/page";
import { loadClientProjectScope, clientProjectColumns, type ClientProject } from "@/lib/client/data";
import ProjectWorkflow from "@/components/workflow/ProjectWorkflow";
import { loadWorkflow } from "@/lib/workflow/data";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "项目详情 | 智点未来", robots: { index: false, follow: false } };
export default async function Project({ params }: { params: Promise<{ locale: string; id: string }> }) {
 const { locale, id } = await params;
 if (locale !== "zh" && locale !== "en") notFound();
 const { client, user } = await requireClientPage(locale);
 if (!z.uuid().safeParse(id).success) notFound();
 const membership = await loadClientProjectScope(client);
 const ids = membership.organizations.map(row => row.id);
 const result = !membership.error && ids.length ? await client.from("projects").select(clientProjectColumns).eq("id", id).in("organization_id", ids).maybeSingle() : null;
 if (!membership.error && !result?.error && !result?.data) notFound();
 const workflow = result?.data && !result.error ? await loadWorkflow(client, id) : null;
 const canCollaborate = membership.organizations.some(m => m.id === result?.data?.organization_id && m.collaborate);
 const zh = locale === "zh";
 return <><main id="main" className="section wrap client-workspace"><Link className="service-link" href={`/${locale}/access`}>← {zh ? "返回客户中心" : "Client center"}</Link><h1>{zh ? "项目详情" : "Project details"}</h1>{membership.error || result?.error ? <p className="admin-error">{zh ? "暂时无法读取项目，请稍后重试。" : "Project unavailable. Please try again later."}</p> : <article className="client-project"><ProjectSummary locale={locale} project={result!.data as ClientProject}/><p className="admin-notice">{zh ? "当前为团队维护的项目阶段，不代表广告平台实时状态。需求提交、版本审核与客户确认记录见下方。广告报表尚未接入。" : "This stage is maintained by the team and does not indicate live advertising status. Briefs, reviews and client approvals appear below. Advertising reports are not connected."}</p></article>}{workflow && <ProjectWorkflow locale={locale} projectId={id} role={canCollaborate ? "client" : "viewer"} data={workflow} completed={result!.data!.status === "completed"}/>}</main></>;
}
