import Image from "next/image";
import type { Locale } from "@/lib/content";

export default function HeroVisual({ locale }: { locale: Locale }) {
  const zh = locale === "zh";
  const features = zh ? [
    ["01", "广告策略", "围绕需求，连接品牌"],
    ["02", "创意表达", "让产品价值清晰可见"],
    ["03", "效果洞察", "让每一步优化有据可依"],
  ] : [
    ["01", "Ad strategy", "Connect intent and brands"],
    ["02", "Creative", "Make product value clear"],
    ["03", "Insights", "Inform the next improvement"],
  ];
  return <div className="hero-visual chatgpt-visual" aria-hidden="true">
    <div className="hero-halo"/><div className="brand-orbit brand-orbit-one"/><div className="brand-orbit brand-orbit-two"/><div className="brand-orbit brand-orbit-three"/>
    <span className="orbit-point orbit-point-one"/><span className="orbit-point orbit-point-two"/><span className="orbit-point orbit-point-three"/>
    <div className="chatgpt-card hero-artwork">
      <div className="chatgpt-card-top"><span className="platform-indicator"/><span>{zh ? "AI 对话中的品牌机遇" : "BRAND OPPORTUNITIES IN AI CONVERSATION"}</span><span className="platform-spark" aria-hidden="true">✦</span></div>
      <div className="chatgpt-platform"><div className="chatgpt-symbol"><Image src="/images/openai.svg" alt="" width={80} height={80}/></div><div><strong>ChatGPT</strong><span>{zh ? "新一代 AI 广告营销" : "A new era of AI advertising"}</span></div></div>
      <div className="chatgpt-connection"><span/><span/><span/></div>
      <div className="chatgpt-features">{features.map(([n, title, description]) => <div key={n}><span className="feature-index">{n}</span><strong>{title}</strong><p>{description}</p></div>)}</div>
      <div className="chatgpt-card-bottom"><span>{zh ? "从用户需求，到品牌价值" : "FROM CUSTOMER INTENT TO BRAND VALUE"}</span><span>↗</span></div>
    </div>
    <span className="orbit-dust dust-one"/><span className="orbit-dust dust-two"/><span className="orbit-dust dust-three"/>
  </div>;
}
