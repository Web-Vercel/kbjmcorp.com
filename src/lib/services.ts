import type { Locale } from "./content";

// Preserve established detail URLs while updating the four service offerings.
export const serviceSlugs = ["strategy", "creative", "media", "insights"] as const;
export type ServiceSlug = (typeof serviceSlugs)[number];

type ServiceDetail = {
  title: string;
  summary: string;
  deliverables: readonly string[];
  inputs: string;
  availability?: string;
};
export const serviceDetails: Record<Locale, Record<ServiceSlug, ServiceDetail>> = {
  zh: {
    strategy: {
      title: "ChatGPT 广告代理服务",
      summary: "智点未来面向中国大陆企业提供广告代理服务，以 OpenAI Ads Manager 为投放管理基础，围绕 ChatGPT 内的广告场景，协助客户推广品牌、产品与服务。",
      deliverables: ["品牌、产品与推广需求梳理", "围绕 OpenAI Ads Manager 制定投放代理方案", "明确客户授权、投放流程与服务分工", "约定媒体预算、代理服务范围与沟通机制"],
      inputs: "企业与产品介绍、推广目标、预期预算，以及在平台支持方式下提供的必要账户授权。无需通过咨询表单提交密码或密钥。",
    },
    creative: {
      title: "全球与指定市场投放",
      summary: "根据客户的全球业务布局或指定市场目标，规划品牌与产品的 ChatGPT 广告推广。投放地区、受众设置及广告形式以平台当时开放的能力为准，不将全球规划等同于当前已覆盖所有市场。",
      deliverables: ["全球布局或指定市场的推广目标梳理", "核对平台当前可投市场与设置选项", "制定市场优先级、预算分配与阶段计划", "根据实际开放范围与投放反馈调整方案"],
      inputs: "希望推广的国家或地区、产品服务可覆盖的市场、目标客户、语言与预算范围。",
    },
    media: {
      title: "广告制作与投放执行",
      summary: "将品牌与产品信息转化为符合平台要求的广告素材，围绕 OpenAI Ads Manager 统筹投放配置、审核跟进与后续管理，让客户清楚了解每个执行环节。",
      deliverables: ["产品卖点、广告文案与素材整理制作", "按平台规范准备广告内容与落地信息", "在授权范围内配置投放并跟进审核状态", "持续跟进投放进展并提出调整建议"],
      inputs: "品牌规范、产品资料、可证明的广告表述、目标落地页与必要授权。广告能否上线取决于平台审核，媒体费用与服务费用分别确认。",
    },
    insights: {
      title: "线上客户管理平台",
      summary: "让客户对自己的广告业务全程有数。线上平台将围绕客户专属视图，整合项目进度、投放流程与广告数据，使沟通、执行和效果信息更容易查阅与理解。",
      deliverables: ["客户公司与成员的专属访问权限", "项目进度、服务环节与投放状态追踪", "在授权及平台可提供范围内汇总广告数据", "集中查看预算、进展与效果报告"],
      inputs: "客户公司与成员权限、已约定的服务范围，以及合法授权的数据来源与报告口径。不同客户公司的信息按权限隔离。",
      availability: "客户登录与公司权限框架已建立；投放数据接入、流程视图及报表功能仍在逐步建设，具体可查看内容以实际开通的服务为准。",
    },
  },
  en: {
    strategy: {
      title: "ChatGPT advertising agency",
      summary: "智点未来 provides advertising agency services for mainland Chinese businesses. Using OpenAI Ads Manager as the campaign-management foundation, we help clients promote brands, products and services through advertising in ChatGPT.",
      deliverables: ["Clarify brand, product and advertising requirements", "Develop an agency plan around OpenAI Ads Manager", "Define client permissions, campaign workflows and responsibilities", "Agree media budgets, agency scope and communication"],
      inputs: "Your business and products, advertising goals, budget and necessary account access through platform-supported permissions. Do not submit passwords or keys through the inquiry form.",
    },
    creative: {
      title: "Global & selected markets",
      summary: "Plan ChatGPT advertising around global business ambitions or selected markets. Available locations, audience settings and ad formats depend on the platform’s capabilities at the time; a global plan does not imply that every market is already supported.",
      deliverables: ["Define global expansion or selected-market promotion goals", "Check currently available markets and platform settings", "Plan market priorities, budget allocation and campaign phases", "Adjust plans to availability and actual campaign feedback"],
      inputs: "Desired countries or regions, markets your products can serve, target customers, languages and budget.",
    },
    media: {
      title: "Creative & campaign execution",
      summary: "Turn brand and product information into platform-appropriate advertising assets. Coordinate campaign setup, review follow-up and ongoing management through OpenAI Ads Manager, giving clients a clear view of each execution stage.",
      deliverables: ["Prepare product messaging, ad copy and creative assets", "Prepare advertising content and destination information to platform requirements", "Configure authorized campaigns and follow review status", "Monitor progress and recommend adjustments"],
      inputs: "Brand guidelines, product information, substantiated claims, landing pages and necessary permissions. Platform review determines ad approval; media spend and agency fees are agreed separately.",
    },
    insights: {
      title: "Online client management",
      summary: "Give clients a clear view of their own advertising business. The platform will bring project progress, campaign workflows and advertising data into a client-specific view, making communication, execution and performance easier to understand.",
      deliverables: ["Organization-specific access and member permissions", "Project, service-stage and campaign-status tracking", "Advertising data available through authorized, supported sources", "A consolidated view of budgets, progress and performance reports"],
      inputs: "Client organization and member permissions, agreed service scope, authorized data sources and reporting definitions. Company data is isolated by access permissions.",
      availability: "Client sign-in and organization-access foundations are implemented. Campaign-data connections, workflow views and reporting are still being developed; available information depends on the services actually enabled.",
    },
  },
};

export function isServiceSlug(value: string): value is ServiceSlug {
  return serviceSlugs.some((slug) => slug === value);
}
