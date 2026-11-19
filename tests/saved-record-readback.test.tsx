import {it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import type {SupabaseClient} from '@supabase/supabase-js';
import History from '@/components/partners/SavedPartnerHistory';
import Audit from '@/components/workspace/SavedAuditHistory';
const id='d0000000-0000-4000-8000-000000000001',other='d0000000-0000-4000-8000-000000000002';
it('reads persisted history once, excludes off-scope records, escapes saved text and distinguishes current and former rules',async()=>{
 const rpc=vi.fn().mockResolvedValue({data:{notes:[{entity_id:id,action:'refund_approve',note:'SAVED <script>alert(1)</script>',created_at:'2026-11-17'},{entity_id:other,action:'refund_approve',note:'OTHER RECORD PRIVATE',created_at:'2026-11-17'}],policies:[{id,wallet_id:id,mode:'fixed',value:100,agreement:'CURRENT AGREEMENT',active:true,created_at:'2026-11-17'},{id:other,wallet_id:id,mode:'percent',value:250,agreement:'PREVIOUS AGREEMENT',active:false,created_at:'2026-11-16'}],notes_limit:1000,policies_limit:1000},error:null});
 const html=renderToStaticMarkup(await History({client:{rpc} as unknown as SupabaseClient,records:[{id,label:'FICTIONAL WALLET'}]}));
 expect(rpc).toHaveBeenCalledWith('read_saved_partner_history',{p_ids:[id]});expect(html).toContain('退款批准依据');expect(html).toContain('SAVED &lt;script&gt;');expect(html).not.toContain('OTHER RECORD PRIVATE');expect(html).toContain('当前生效规则');expect(html).toContain('历史规则');expect(html).toContain('每笔固定 CNY 1.00');expect(html).not.toContain('申请金额的 2.5%');expect(html).toContain('value="'+other+'"');
});
it('does not claim an empty history when configuration or response validation fails',async()=>{
 for(const reply of [{data:null,error:{message:'PRIVATE SQL'}},{data:{notes:[],policies:[]},error:null}]){const html=renderToStaticMarkup(await History({client:{rpc:async()=>reply} as unknown as SupabaseClient,records:[{id,label:'Record'}]}));expect(html).toContain('不能据此认定尚未保存');expect(html).not.toContain('PRIVATE SQL');expect(html).not.toContain('暂无可查看的办理说明');}
 const rpc=vi.fn();expect(await History({client:{rpc} as unknown as SupabaseClient,records:[]})).toBeNull();expect(rpc).not.toHaveBeenCalled();
});
it('shows only selected audit note fields rather than raw audit payloads',async()=>{
 const q:any={};for(const key of ['select','eq','in','order'])q[key]=vi.fn(()=>q);q.limit=async()=>({data:[{id,entity_id:id,created_at:'2026-11-17',changes:{archived:true,note:'SAVED ARCHIVE REASON',password:'PRIVATE SECRET'}}],error:null});const from=vi.fn(()=>q);
 const html=renderToStaticMarkup(await Audit({client:{from} as unknown as SupabaseClient,entityType:'quote_lifecycle',records:[{id,label:'Quote V2'}],locale:'zh'}));expect(q.eq).toHaveBeenCalledWith('entity_type','quote_lifecycle');expect(html).toContain('SAVED ARCHIVE REASON');expect(html).not.toContain('PRIVATE SECRET');
});
it('displays credential maintenance history without rendering passwords or asserting uncertain changes succeeded',async()=>{
 const {default:Maintenance}=await import('@/components/live-access/CredentialMaintenanceHistory');
 const q:any={};for(const key of ['select','order'])q[key]=vi.fn(()=>q);q.limit=async()=>({data:[{id,action:'password',old_email:'fixture@example.test',new_email:null,status:'uncertain',reason:'SAVED MAINTENANCE REASON',started_at:'2026-11-17',finished_at:null,password:'MUST NOT DISPLAY'}],error:null});
 const html=renderToStaticMarkup(await Maintenance({client:{from:()=>q} as unknown as SupabaseClient,locale:'zh'}));expect(html).toContain('SAVED MAINTENANCE REASON');expect(html).toContain('结果待核查');expect(html).not.toContain('MUST NOT DISPLAY');expect(q.select).toHaveBeenCalledWith('id,action,old_email,new_email,status,reason,started_at,finished_at');
});
