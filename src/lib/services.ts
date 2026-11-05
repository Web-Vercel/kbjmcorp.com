import type { Locale } from "./content";

export const serviceSlugs = ["strategy", "creative", "media", "insights"] as const;
export type ServiceSlug = (typeof serviceSlugs)[number];

type ServiceDetail = {
  title: string;
  summary: string;
  deliverables: readonly string[];
  inputs: string;
};
export const serviceDetails: Record<Locale, Record<ServiceSlug, ServiceDetail>> = {
  zh: {
    strategy: {
      title: "出海增长策略",
      summary: "先明确市场与客户，再决定如何投入。围绕产品优势、竞争环境和购买路径，构建可执行的市场进入方案。",
      deliverables: ["目标市场与竞争格局分析", "核心受众与价值主张梳理", "广告渠道优先级与测试计划", "预算场景与衡量指标建议"],
      inputs: "产品介绍、目标市场、已有营销数据，以及预期预算范围。",
    },
    creative: {
      title: "AI 广告创意",
      summary: "把品牌表达转化为海外受众能理解的内容。AI 辅助拓展创意方向，人工负责事实核验、品牌一致性与文化适配。",
      deliverables: ["面向目标受众的创意方向", "多语言广告文案与视觉概念", "适配渠道的素材版本规划", "创意测试假设与复盘框架"],
      inputs: "品牌规范、产品素材、可证明的产品卖点，以及目标渠道要求。",
    },
    media: {
      title: "广告投放与优化",
      summary: "让每一轮投放回答一个明确的问题。通过受众、信息与落地页的组合测试，持续调整投放策略。",
      deliverables: ["搜索与社交广告账户结构建议", "受众与关键词测试方案", "预算分配与优化节奏", "转化路径检查与阶段复盘"],
      inputs: "目标市场、落地页、广告账户授权与已确认的衡量方案。广告媒体费用另行确认。",
    },
    insights: {
      title: "数据与增长洞察",
      summary: "把分散的广告指标整理成业务可以使用的信息。先对齐数据口径，再讨论趋势、限制与下一步行动。",
      deliverables: ["业务目标与指标定义", "数据来源及追踪方案梳理", "渠道表现分析与报告框架", "可执行的测试与优化建议"],
      inputs: "可授权的数据来源、业务目标与历史报告；涉及个人数据时先确认权限和处理范围。",
    },
  },
  en: {
    strategy: {
      title: "Global growth strategy",
      summary: "Understand the market and customer before allocating spend. Build a practical market-entry plan around product strengths, competition and the buying journey.",
      deliverables: ["Target-market and competitive landscape review", "Audience and value proposition development", "Channel priorities and a structured test plan", "Budget scenarios and measurement recommendations"],
      inputs: "Your product overview, target markets, existing marketing data and indicative budget.",
    },
    creative: {
      title: "AI advertising creative",
      summary: "Translate your brand into content international audiences can understand. AI supports exploration; people review accuracy, brand consistency and cultural fit.",
      deliverables: ["Audience-led creative directions", "Multilingual copy and visual concepts", "Channel-specific asset planning", "Creative hypotheses and a review framework"],
      inputs: "Brand guidelines, product assets, substantiated product claims and channel requirements.",
    },
    media: {
      title: "Media & optimization",
      summary: "Give every campaign a clear question to answer. Test combinations of audiences, messaging and landing pages, then use the results to refine your approach.",
      deliverables: ["Search and social account structure recommendations", "Audience and keyword test plans", "Budget allocation and optimization cadence", "Conversion journey review and campaign retrospectives"],
      inputs: "Target markets, landing pages, authorized ad-account access and agreed measurement. Media spend is confirmed separately.",
    },
    insights: {
      title: "Data & growth insights",
      summary: "Turn fragmented advertising metrics into useful business information. Align definitions first, then discuss trends, limitations and the next action.",
      deliverables: ["Business goals and metric definitions", "Data-source and tracking review", "Channel analysis and reporting framework", "Actionable testing and optimization recommendations"],
      inputs: "Authorized data sources, business objectives and historical reports. Confirm permissions and scope before processing personal data.",
    },
  },
};

export function isServiceSlug(value: string): value is ServiceSlug {
  return serviceSlugs.some((slug) => slug === value);
}
