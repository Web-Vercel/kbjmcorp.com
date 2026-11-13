import "server-only";
import {clientLoginDestination} from "@/lib/auth/client-return";
import { cache } from "react";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/auth/server";
import type { Locale } from "@/lib/content";
export const requireClientPage = cache(async (locale: Locale, returnTo?:string) => {
 const login=clientLoginDestination(locale,returnTo);
 const client = await authClient();
 if (!client) redirect(login);
 const result = await client.auth.getUser().catch(() => null);
 if (!result?.data.user || result.error) redirect(login);
 return { client, user: result.data.user };
});
