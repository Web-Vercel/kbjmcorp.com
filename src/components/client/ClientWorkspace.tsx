import Link from "next/link";
import type { Locale } from "@/lib/content";
import type { ClientOrganization, ClientProject } from "@/lib/client/data";
import { formatDate, marketText, statusText } from "@/lib/admin/content";
export function ProjectSummary({ project, locale }: { project: ClientProject; locale: Locale }) {
 const zh = locale === "zh";
 const stages = ["briefing", "creative", "review", "ready"];
 return <><div className="client-project-top"><span className="admin-badge">{statusText(project.status, locale)}</span><span>{marketText(project.target_market, locale)}</span></div><h2>{project.name}</h2><p className="client-updated">{zh ? "最近更新：" : "Updated: "}{formatDate(project.updated_at, locale)}</p>
 <ol className="admin-stage-track" aria-label={zh ? "项目准备阶段，当前状态以标签为准" : "Preparation stages; badge shows current status"}>{stages.map(stage => <li key={stage} className={project.status === stage ? "is-current" : ""} aria-current={project.status === stage ? "step" : undefined}><span aria-hidden="true"/>{statusText(stage, locale)}</li>)}</ol></>;
}
export default function ClientWorkspace({ locale, organizations, projects, error = false, demo = false }: { locale: Locale; organizations: ClientOrganization[]; projects: ClientProject[]; error?: boolean; demo?: boolean }) {
 const zh = locale === "zh";
 if (error) return <section className="account-panel"><h2>{zh ? "暂时无法读取客户信息" : "Client information is unavailable"}</h2><p>{zh ? "请稍后重试；当前不会展示不完整的公司或项目数据。" : "Please try again later. Incomplete company or project data is not displayed."}</p></section>;
 if (!organizations.length) return <section className="account-panel"><h2>{zh ? "等待关联客户公司" : "Organization association pending"}</h2><p>{zh ? "登录成功。完成公司身份核验与权限分配后，即可查看所属公司的项目。请联系您的业务对接人员。" : "You are signed in. Projects become available after company verification and access assignment. Contact your business representative."}</p></section>;
 return <><p className="admin-notice">{zh ? "这里展示团队维护的项目进度，并非广告平台实时投放状态。尚未接入广告效果数据，不展示推算的花费或成效。" : "These are team-maintained project stages, not real-time advertising status. Performance data is not connected; no estimated spend or results are shown."}</p>
 <div className="client-summary"><div><span>{zh ? "已关联公司" : "Organizations"}</span><strong>{organizations.length}</strong></div><div><span>{zh ? "本页项目" : "Projects on this page"}</span><strong>{projects.length}</strong></div><div><span>{zh ? "广告数据" : "Advertising data"}</span><strong className="client-summary-text">{zh ? "尚未接入" : "Not connected"}</strong></div></div>
 {organizations.map(org => <section className="client-company" key={org.id}><h2>{org.name}</h2><div className="client-projects">{projects.filter(p => p.organization_id === org.id).map(project => <article className="client-project" key={project.id}><ProjectSummary locale={locale} project={project}/>{!demo && <Link className="service-link" href={`/${locale}/account/projects/${project.id}`}>{zh ? "查看项目详情" : "View project"} ↗</Link>}</article>)}</div>{!projects.some(p => p.organization_id === org.id) && <p className="admin-empty">{zh ? "公司已关联，暂无项目。" : "Organization linked. No projects yet."}</p>}</section>)}
 {projects.length === 100 && <p className="admin-notice">{zh ? "仅显示最近更新的 100 个项目；更多项目请联系业务人员。" : "Showing the 100 most recently updated projects. Contact your representative for older projects."}</p>}
 </>;
}
