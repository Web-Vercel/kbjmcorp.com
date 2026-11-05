import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Locale } from "@/lib/content";
import { getStaffContext } from "./guard";
export const requireStaffPage = cache(async (locale: Locale) => {
  const result = await getStaffContext();
  if ("error" in result) redirect(`/${locale}/admin/${result.error === "mfa_required" ? "security" : "login"}`);
  return result;
});
