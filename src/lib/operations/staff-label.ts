import { opsStatus } from "./model";
import type { Locale } from "@/lib/content";
export type OperatingStaff = { user_id: string; role: string; active: boolean; assignments?: { unit: string; role: string; active: boolean }[] };
export function staffLabel(staff: OperatingStaff, email: string | undefined, locale: Locale) {
  const zh = locale === "zh";
  const identity = email || `${zh ? "邮箱暂不可用" : "Email unavailable"} (${staff.user_id})`;
  const duties = staff.role === "admin" ? (zh ? "管理员" : "Administrator") : staff.assignments?.filter(a => a.active).map(a => opsStatus(a.role, locale)).join(" / ") || (zh ? "未分配职责" : "No duties assigned");
  return `${identity} · ${duties}${staff.active ? "" : (zh ? " · 已停用" : " · Disabled")}`;
}
