import { authResponse, readAuthBody } from "@/lib/auth/http";
import { authClient } from "@/lib/auth/server";
import {z} from 'zod';
export async function POST(request: Request) {
  const input = await readAuthBody(request);
  if (input.error) return input.error;
  const parsed=z.object({expectedUserId:z.uuid().optional()}).strict().safeParse(input.body);
  if(!parsed.success)return authResponse({error:'invalid_input'},400);
  try {
    const client = await authClient(true);
    if (!client) return authResponse({ error: "unavailable" }, 503);
    if(parsed.data.expectedUserId){
      const identity=await client.auth.getUser();
      if(identity.error||!identity.data.user)return authResponse({error:'unauthenticated'},401);
      if(identity.data.user.id!==parsed.data.expectedUserId)return authResponse({error:'session_changed'},409);
    }
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) return authResponse({ error: "logout_failed" }, 502);
    return authResponse({ ok: true });
  } catch { return authResponse({ error: "unavailable" }, 503); }
}
