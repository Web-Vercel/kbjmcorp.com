import "server-only";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/admin/guard";
import type { Locale } from "@/lib/content";
import type { OpsContext } from "./model";
export async function requireOperations(locale:Locale){const staff=await getStaffContext();if('error'in staff)redirect(`/${locale}/admin/${staff.error==='mfa_required'?'security':'login'}`);const context=await staff.client.rpc('get_ops_context');return {...staff,context:context.error?null:context.data as OpsContext};}
