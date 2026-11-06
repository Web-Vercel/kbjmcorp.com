import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaffPage } from "@/lib/admin/page";
import { statusText } from "@/lib/admin/content";
import { loadWorkflow } from "@/lib/workflow/data";
import ProjectWorkflow from "@/components/workflow/ProjectWorkflow";
export default async function Project({ params }: { params: Promise<{ locale: string; id: string }> }) {
 const { locale, id } = await params; if (locale !== "zh" && locale !== "en") notFound();
 const { client } = await requireStaffPage(locale); if (!z.uuid().safeParse(id).success) notFound();
 const { data: project, error } = await client.from("projects").select("id,name,status").eq("id", id).maybeSingle();
 if (error) return <p className="admin-error">{locale === "zh" ? "暂时无法读取项目，请重试。" : "Project unavailable. Try again later."}</p>;
 if (!project) notFound();
 const data = await loadWorkflow(client, id);
 return <><Link className="service-link" href={`/${locale}/admin/projects`}>← {locale === "zh" ? "项目列表" : "Projects"}</Link><div className="admin-page-heading"><h1>{project.name}</h1><span className="admin-badge">{statusText(project.status, locale)}</span></div><ProjectWorkflow locale={locale} projectId={id} role="staff" data={data} completed={project.status === "completed"}/></>;
}
