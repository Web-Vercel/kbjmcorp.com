-- Read-only role-scoped home reminders. No notifications, writes or permission grants.
begin;
create function public.get_home_attention() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare account public.live_access_accounts%rowtype;agent public.partner_agents%rowtype;staff boolean;owner boolean;prep boolean;reviewer boolean;result jsonb;
begin
 staff:=public.has_ops_capability('finance.read') or public.has_ops_capability('support.handle') or public.has_ops_capability('source.submit');
 owner:=public.has_staff_access(array['admin']::text[]);
 if staff or owner then
 prep:=public.has_ops_capability('finance.prepare');reviewer:=public.has_ops_capability('finance.review');
 with tasks as (
 select 'statement_review' key,case when reviewer and d.prepared_by<>auth.uid() then 'action' else 'waiting' end bucket,d.organization_id org,d.prepared_at since
 from public.monthly_settlement_drafts d left join public.monthly_settlement_reviews r on r.draft_id=d.id
 where public.has_ops_capability('finance.read',d.organization_id) and r.draft_id is null and not exists(select 1 from public.monthly_client_statements s where s.binding_id=d.binding_id and s.month=d.month) and not exists(select 1 from public.monthly_settlement_drafts newer where newer.binding_id=d.binding_id and newer.month=d.month and newer.prepared_at>d.prepared_at)
 union all select case when r.decision='rejected' then 'statement_returned' else 'statement_publish' end,case when r.decision='rejected' and prep or r.decision='approved' and owner then 'action' else 'waiting' end,d.organization_id,r.reviewed_at
 from public.monthly_settlement_drafts d join public.monthly_settlement_reviews r on r.draft_id=d.id where public.has_ops_capability('finance.read',d.organization_id) and not exists(select 1 from public.monthly_client_statements s where s.binding_id=d.binding_id and s.month=d.month) and not exists(select 1 from public.monthly_settlement_drafts newer where newer.binding_id=d.binding_id and newer.month=d.month and newer.prepared_at>d.prepared_at)
 union all select 'receipt_review',case when reviewer and prepared_by<>auth.uid() then 'action' else 'waiting' end,organization_id,prepared_at from public.bank_receipts where status='pending' and public.has_ops_capability('finance.read',organization_id)
 union all select 'topup_check',case when prep then 'action' else 'waiting' end,t.organization_id,t.created_at from public.client_topups t where t.status='pending' and public.has_ops_capability('finance.read',t.organization_id) and not exists(select 1 from public.bank_receipts b where b.topup_id=t.id and b.status<>'rejected')
 union all select 'inquiry_followup','action',null::uuid,created_at from public.inquiries where status='new' and public.has_staff_access()
 union all select 'lead_review','action',null::uuid,created_at from public.partner_leads where status='pending' and owner
 union all select 'commission_review',case when reviewer and prepared_by<>auth.uid() then 'action' else 'waiting' end,organization_id,created_at from public.partner_commissions where status='pending' and public.has_ops_capability('finance.read',organization_id)
 union all select 'settlement_'||status,case when status='prepared' and reviewer and prepared_by<>auth.uid() or status='reviewed' and owner or status='approved' and prep then 'action' else 'waiting' end,null::uuid,created_at from public.partner_settlements where status in ('prepared','reviewed','approved','payment_pending') and public.has_ops_capability('finance.read')
 union all select 'refund_'||status,case when status='requested' and prep or status='prepared' and reviewer and prepared_by<>auth.uid() or status='reviewed' and owner or status='approved' and prep then 'action' else 'waiting' end,organization_id,created_at from public.balance_refunds where status in ('requested','prepared','reviewed','approved','payment_pending') and public.has_ops_capability('finance.read',organization_id)
 union all select 'payment_'||kind,case when reviewer and prepared_by<>auth.uid() then 'action' else 'waiting' end,null::uuid,created_at from public.partner_payments where status='pending' and public.has_ops_capability('finance.read')
 union all select 'service_followup','action',organization_id,updated_at from public.service_requests where status<>'resolved' and public.can_read_service_request(organization_id,category)
 union all select case when s.check_status='difference' then 'source_difference' else 'monthclose_check' end,case when s.check_status='difference' then 'attention' when prep then 'action' else 'waiting' end,b.organization_id,h.shared_at from public.ads_source_handoffs h join public.ads_reporting_bindings b on b.id=h.binding_id join public.ads_reporting_snapshots s on s.id=h.snapshot_id where b.active and public.has_ops_capability('finance.read',b.organization_id) and s.until<(date_trunc('month',now() at time zone 'Asia/Shanghai'))::date and not exists(select 1 from public.monthly_settlement_drafts d where d.binding_id=b.id and d.month=date_trunc('month',s.since)::date) and not exists(select 1 from public.ads_source_handoffs newer join public.ads_reporting_snapshots sn on sn.id=newer.snapshot_id where newer.binding_id=b.id and date_trunc('month',sn.since)=date_trunc('month',s.since) and newer.shared_at>h.shared_at)
 union all select 'manual_review',case when reviewer and r.prepared_by<>auth.uid() then 'action' else 'waiting' end,p.organization_id,r.prepared_at from public.ops_reconciliations r join public.ops_source_packets p on p.id=r.packet_id where r.status='pending' and public.has_ops_capability('finance.read',p.organization_id) and p.status<>'superseded'
 union all select 'source_check',case when prep then 'action' else 'waiting' end,organization_id,submitted_at from public.ops_source_packets where status='submitted' and public.has_ops_capability('finance.read',organization_id)
 union all select 'source_correction','attention',organization_id,submitted_at from public.ops_source_packets where status='needs_correction' and public.has_ops_capability('source.submit',organization_id)
 ), grouped as (select key,bucket,org,count(*)::integer count,min(since) oldest from tasks group by key,bucket,org)
 select jsonb_build_object('role','staff','totalGroups',(select count(*) from grouped),'items',coalesce((select jsonb_agg(v) from (select g.*,o.name company from grouped g left join public.organizations o on o.id=g.org order by case bucket when 'attention' then 0 when 'action' then 1 else 2 end,oldest,key,org limit 200)v),'[]'::jsonb)) into result;
 elsif exists(select 1 from public.partner_agents where user_id=auth.uid()) then
 agent:=public.require_partner_agent(false);
 with tasks as (
 select 'lead_pending' key,'waiting' bucket,created_at since from public.partner_leads where agent_id=agent.id and status='pending'
 union all select 'commission_pending','waiting',created_at from public.partner_commissions where agent_id=agent.id and status='pending'
 union all select 'commission_hold','attention',created_at from public.partner_commissions where agent_id=agent.id and status='approved' and settlement_id is null and public.partner_org_refund_hold(organization_id)
 union all select 'commission_wait','waiting',created_at from public.partner_commissions where agent_id=agent.id and status='approved' and kind='earned' and settlement_id is null and available_on>(now() at time zone 'Asia/Shanghai')::date and not public.partner_org_refund_hold(organization_id)
 union all select 'commission_ready','waiting',created_at from public.partner_commissions where agent_id=agent.id and status='approved' and kind='earned' and settlement_id is null and available_on<=(now() at time zone 'Asia/Shanghai')::date and not public.partner_org_refund_hold(organization_id)
 union all select 'agent_settlement','waiting',created_at from public.partner_settlements where agent_id=agent.id and status in ('prepared','reviewed','approved','payment_pending')
 ), grouped as (select key,bucket,count(*)::integer count,min(since) oldest from tasks group by key,bucket)
 select jsonb_build_object('role','agent','totalGroups',(select count(*) from grouped),'items',coalesce((select jsonb_agg(g) from grouped g),'[]'::jsonb)) into result;
 else
 account:=public.require_live_account(false);if account.role<>'client' then raise exception 'Client, agent or operating account required' using errcode='42501';end if;
 with tasks as (
 select 'statement_unread' key,'action' bucket,s.published_at since from public.monthly_client_statements s where s.organization_id=account.organization_id and not exists(select 1 from public.client_statement_read_receipts r where r.statement_id=s.id and r.user_id=auth.uid())
 union all select 'client_service',case when (select m.author_role from public.service_request_messages m where m.request_id=r.id order by m.created_at desc,m.id desc limit 1)='staff' then 'action' else 'waiting' end,updated_at from public.service_requests r where organization_id=account.organization_id and status<>'resolved'
 union all select 'client_topup','waiting',created_at from public.client_topups where organization_id=account.organization_id and status='pending'
 union all select 'client_refund','waiting',created_at from public.balance_refunds where organization_id=account.organization_id and status not in ('paid','rejected','cancelled')
 ), grouped as (select key,bucket,count(*)::integer count,min(since) oldest from tasks group by key,bucket)
 select jsonb_build_object('role','client','totalGroups',(select count(*) from grouped),'items',coalesce((select jsonb_agg(g) from grouped g),'[]'::jsonb)) into result;
 end if;
 return result;
end $$;
revoke all on function public.get_home_attention() from public,anon;
grant execute on function public.get_home_attention() to authenticated;
commit;
