import { z } from "zod";
import { phoneSchema } from "./auth/validation";

export const inquirySchema = z.object({
  company: z.string().trim().min(2).max(160),
  email: z.union([z.email().max(254), z.literal("")]).optional(),
  phone: z.union([phoneSchema, z.literal("")]).optional(),
  market: z.enum(["undecided", "north-america", "europe", "asia-pacific", "other"]).default("undecided"),
  message: z.string().trim().min(10).max(4000),
  locale: z.enum(["zh", "en"]),
  consent: z.literal(true),
  website: z.string().max(0).optional(),
}).superRefine((data, context) => {
  if (!data.phone && !data.email) context.addIssue({ code: "custom", path: ["phone"], message: "contact_required" });
});

export const inquiryText = {
  zh: {
    phone: "联系电话（中国大陆）", email: "工作邮箱（选填）", contactHelp: "手机号与邮箱至少填写一项。咨询不会触发短信或注册账户。",
    phonePlaceholder: "11 位手机号", market: "计划进入的市场", markets: ["尚未确定", "北美", "欧洲", "亚太", "其他市场"],
    errors: { company: "请填写 2–160 个字符的公司名称。", phone: "请填写有效的 11 位大陆手机号，或留下有效邮箱。", email: "请填写有效邮箱，或留空并填写手机号。", message: "请填写 10–4000 个字符的需求说明。", consent: "请同意为回复咨询处理您提交的信息。", market: "请选择有效的目标市场。" },
  },
  en: {
    phone: "Contact phone (mainland China)", email: "Work email (optional)", contactHelp: "Provide a phone number or email, or both. An inquiry does not send SMS or register an account.",
    phonePlaceholder: "11-digit mobile number", market: "Target market", markets: ["Not decided", "North America", "Europe", "Asia Pacific", "Other markets"],
    errors: { company: "Enter a company name of 2–160 characters.", phone: "Enter a valid 11-digit mainland China mobile number, or provide an email.", email: "Enter a valid email, or leave blank and provide a phone number.", message: "Describe your needs in 10–4000 characters.", consent: "Agree to processing your details to respond to this inquiry.", market: "Select a valid target market." },
  },
} as const;
export const markets = ["undecided", "north-america", "europe", "asia-pacific", "other"] as const;
