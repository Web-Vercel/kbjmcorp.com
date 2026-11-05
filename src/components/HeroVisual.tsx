import type { Locale } from "@/lib/content";

export default function HeroVisual({ locale }: { locale: Locale }) {
  const zh = locale === "zh";
  const stages = zh ? [
    ["01", "需求确认", "目标 · 市场 · 预算"],
    ["02", "素材准备", "内容 · 创意 · 审核"],
    ["03", "投放跟进", "进度 · 沟通 · 调整"],
    ["04", "数据复盘", "表现 · 分析 · 反馈"],
  ] : [
    ["01", "Define", "Goals · Markets · Budget"],
    ["02", "Prepare", "Content · Creative · Review"],
    ["03", "Manage", "Progress · Updates · Changes"],
    ["04", "Review", "Performance · Analysis · Feedback"],
  ];
  const views = zh ? ["项目进度", "投放流程", "数据报告"] : ["Progress", "Workflow", "Reports"];
  return <div className="hero-visual workflow-visual" aria-hidden="true">
    <div className="hero-halo"/><div className="brand-orbit brand-orbit-one"/><div className="brand-orbit brand-orbit-two"/><div className="brand-orbit brand-orbit-three"/>
    <span className="orbit-point orbit-point-one"/><span className="orbit-point orbit-point-two"/>
    <div className="workflow-card hero-artwork">
      <div className="workflow-card-top"><span className="workspace-symbol"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg></span><span>智点未来</span><span className="workflow-demo">{zh ? "服务流程示意" : "SERVICE ILLUSTRATION"}</span></div>
      <div className="workflow-heading"><strong>{zh ? "广告项目，一览全程" : "Your campaign. A clear view."}</strong><span>{zh ? "每一步有进展，每一环可了解" : "Understand every stage of the process"}</span></div>
      <ol className="workflow-stages">{stages.map(([number, title, description]) => <li key={number}><span className="workflow-number">{number}</span><div><strong>{title}</strong><p>{description}</p></div><span className="workflow-arrow">↗</span></li>)}</ol>
      <div className="workflow-client-view"><div className="workflow-view-title"><span>{zh ? "客户平台视图" : "CLIENT WORKSPACE"}</span><span>{zh ? "集中查看" : "ONE PLACE"}</span></div><div className="workflow-view-items">{views.map((view, index) => <span key={view}><svg viewBox="0 0 20 20" fill="none">{index === 0 ? <><path d="M4 5h12M4 10h8M4 15h10"/><circle cx="15" cy="10" r="1"/></> : index === 1 ? <><rect x="2" y="7" width="5" height="6" rx="1"/><rect x="13" y="7" width="5" height="6" rx="1"/><path d="M7 10h6M10 7l3 3-3 3"/></> : <><path d="M3 3v14h14M7 13V9m4 4V6m4 7V4"/></>}</svg>{view}</span>)}</div></div>
      <div className="workflow-card-bottom"><span>{zh ? "流程与功能示意 · 非实时投放数据" : "ILLUSTRATIVE WORKFLOW · NOT LIVE CAMPAIGN DATA"}</span><span aria-hidden="true">↗</span></div>
    </div>
  </div>;
}
