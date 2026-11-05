"use client";
import { useState } from "react";
import type { Locale } from "@/lib/content";
import { adminContent } from "@/lib/admin/content";
import { inquiryText,markets } from "@/lib/inquiry";
export default function ProjectFields({locale,organizations,accounts}:{locale:Locale;organizations:{id:string;name:string}[];accounts:{id:string;organization_id:string;label:string|null;external_id:string}[]}){
 const t=adminContent[locale];const [organization,setOrganization]=useState(organizations[0]?.id||"");const [account,setAccount]=useState("");
 return <><label>{t.company}<select name="organizationId" value={organization} onChange={event=>{setOrganization(event.target.value);setAccount("");}} required>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label>{t.name}<input name="name" required minLength={2} maxLength={160}/></label><label>{t.market}<select name="market" defaultValue="undecided">{markets.map((m,i)=><option key={m} value={m}>{inquiryText[locale].markets[i]}</option>)}</select></label><label>{locale==="zh"?"广告账户关联（选填）":"Ad account link (optional)"}<select name="adAccountId" value={account} onChange={event=>setAccount(event.target.value)}><option value="">{locale==="zh"?"暂不关联":"Not linked yet"}</option>{accounts.filter(a=>a.organization_id===organization).map(a=><option key={a.id} value={a.id}>{a.label||a.external_id}</option>)}</select></label><label>{t.budget}<input name="budget" inputMode="decimal" pattern="[0-9]{1,10}(\.[0-9]{1,2})?" placeholder={locale==="zh"?"选填":"Optional"}/></label><label>{locale==="zh"?"币种":"Currency"}<select name="currency" defaultValue="CAD">{["CAD","USD","CNY","EUR","GBP","AUD"].map(c=><option key={c}>{c}</option>)}</select></label></>;
}
