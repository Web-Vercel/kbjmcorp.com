import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hasSameOrigin } from "@/lib/http/request-origin";
export const runtime="nodejs";
const schema=z.object({company:z.string().trim().min(2).max(160),email:z.email().max(254),message:z.string().trim().min(10).max(4000),locale:z.enum(["zh","en"]),consent:z.literal(true),website:z.string().max(0).optional()});
export async function POST(request:Request){
 if(!hasSameOrigin(request, false)) return NextResponse.json({error:"Forbidden"},{status:403});
 if(!request.headers.get("content-type")?.includes("application/json"))return NextResponse.json({error:"JSON required"},{status:415});
 // Bound the body before parsing; Content-Length alone is untrusted.
 const reader=request.body?.getReader(); if(!reader)return NextResponse.json({error:"Invalid input"},{status:400});
 const chunks:Uint8Array[]=[]; let size=0; for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();return NextResponse.json({error:"Too large"},{status:413});}chunks.push(value);}
 let json:unknown; try{json=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}
 const parsed=schema.safeParse(json);if(!parsed.success)return NextResponse.json({error:"Invalid input"},{status:400});
 const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:"Service unavailable"},{status:503});
 const {company,email,message,locale}=parsed.data;
 try{const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {error}=await db.from("inquiries").insert({company,email,message,locale,consent_at:new Date().toISOString(),consent_version:"inquiry-v1"});if(error)return NextResponse.json({error:"Unable to save"},{status:502});return NextResponse.json({ok:true},{status:201});}catch{return NextResponse.json({error:"Unable to save"},{status:502});}
}
