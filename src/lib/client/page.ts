import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/auth/server";
import type { Locale } from "@/lib/content";
export const requireClientPage = cache(async (locale: Locale) => {
 const client = await authClient();
 if (!client) redirect(`/${locale}/login`);
 const result = await client.auth.getUser().catch(() => null);
 if (!result?.data.user || result.error) redirect(`/${locale}/login`);
 return { client, user: result.data.user };
});
