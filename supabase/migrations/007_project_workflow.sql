-- Versioned, shared project collaboration. No file storage or platform writes.
begin;
create function public.can_collaborate(p_organization_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships where user_id=auth.uid() and organization_id=p_organization_id and role in ('owner','admin'))
 and not exists(select 1 from public.staff_members where user_id=auth.uid());
$$;
revoke all on function public.can_collaborate(uuid) from public,anon;
grant execute on function public.can_collaborate(uuid) to authenticated;

create table public.project_submissions (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id),
 kind text not null check(kind in ('brief','creative')),
 version integer not null check(version>0),
 title text not null check(char_length(btrim(title)) between 2 and 160),
 body text not null check(char_length(btrim(body)) between 10 and 1500),
 reference_url text check(reference_url is null or (char_length(reference_url)<=1000 and reference_url ~ '^https://[^[:space:]@]+$')),
 author_id uuid not null references auth.users(id),
 author_role text not null check(author_role in ('staff','client')),
 created_at timestamptz not null default now(),
 unique(project_id,kind,version)
);
create table public.project_reviews (
 id uuid primary key default gen_random_uuid(),
 submission_id uuid not null unique references public.project_submissions(id),
 decision text not null check(decision in ('approved','changes_requested')),
 feedback text not null check(char_length(btrim(feedback)) between 2 and 1000),
 reviewer_id uuid not null references auth.users(id),
 reviewer_role text not null check(reviewer_role in ('staff','client')),
 created_at timestamptz not null default now()
);
create table public.project_activity (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id),
 event_type text not null check(event_type in ('status','submission','review','update')),
 detail text not null check(char_length(detail) between 1 and 1000),
 actor_id uuid references auth.users(id),
 actor_role text not null check(actor_role in ('staff','client','system')),
 created_at timestamptz not null default now()
);
create index project_submissions_lookup on public.project_submissions(project_id,kind,version desc);
create index project_activity_lookup on public.project_activity(project_id,created_at desc);
alter table public.project_submissions enable row level security;
alter table public.project_reviews enable row level security;
alter table public.project_activity enable row level security;
revoke all on public.project_submissions,public.project_reviews,public.project_activity from public,anon,authenticated;
grant all on public.project_submissions,public.project_reviews,public.project_activity to service_role;
-- Do not disclose staff/customer Auth identifiers in shared business records.
grant select(id,project_id,kind,version,title,body,reference_url,author_role,created_at) on public.project_submissions to authenticated;
grant select(id,submission_id,decision,feedback,reviewer_role,created_at) on public.project_reviews to authenticated;
grant select(id,project_id,event_type,detail,actor_role,created_at) on public.project_activity to authenticated;
create policy shared_submissions on public.project_submissions for select to authenticated using(exists(select 1 from public.projects p where p.id=project_id));
create policy shared_reviews on public.project_reviews for select to authenticated using(exists(select 1 from public.project_submissions s where s.id=submission_id));
create policy shared_activity on public.project_activity for select to authenticated using(exists(select 1 from public.projects p where p.id=project_id));

create function public.submit_project_content(p_project_id uuid,p_kind text,p_title text,p_body text,p_reference_url text,p_expected_version integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare project public.projects%rowtype; latest integer; result uuid; staff boolean := public.has_staff_access();
begin
 select * into project from public.projects where id=p_project_id for update;
 if not found or not (staff or public.can_collaborate(project.organization_id)) then raise exception 'Not available' using errcode='42501'; end if;
 if project.status='completed' then raise exception 'Project closed' using errcode='22023'; end if;
 if p_kind is null or p_kind not in ('brief','creative') or (p_kind='brief' and staff) or (p_kind='creative' and not staff) then raise exception 'Forbidden action' using errcode='42501'; end if;
 select coalesce(max(version),0) into latest from public.project_submissions where project_id=p_project_id and kind=p_kind;
 if p_expected_version is null or latest<>p_expected_version then raise exception 'Stale revision' using errcode='40001'; end if;
 if latest>=100 then raise exception 'Revision limit' using errcode='54000'; end if;
 insert into public.project_submissions(project_id,kind,version,title,body,reference_url,author_id,author_role)
 values(p_project_id,p_kind,latest+1,btrim(p_title),btrim(p_body),nullif(btrim(p_reference_url),''),auth.uid(),case when staff then 'staff' else 'client' end) returning id into result;
 insert into public.project_activity(project_id,event_type,detail,actor_id,actor_role)
 values(p_project_id,'submission',p_kind||':'||(latest+1)::text,auth.uid(),case when staff then 'staff' else 'client' end);
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes)
 values(auth.uid(),'project_submission',result,'INSERT',jsonb_build_object('project_id',p_project_id,'kind',p_kind,'version',latest+1));
 update public.projects set updated_at=now() where id=p_project_id;
 return result;
end;
$$;
create function public.review_project_content(p_project_id uuid,p_submission_id uuid,p_decision text,p_feedback text)
returns void language plpgsql security definer set search_path='' as $$
declare project public.projects%rowtype; submission public.project_submissions%rowtype; staff boolean := public.has_staff_access();
begin
 select * into project from public.projects where id=p_project_id for update;
 if not found or not (staff or public.can_collaborate(project.organization_id)) then raise exception 'Not available' using errcode='42501'; end if;
 if project.status='completed' then raise exception 'Project closed' using errcode='22023'; end if;
 select * into submission from public.project_submissions where id=p_submission_id and project_id=p_project_id;
 if not found then raise exception 'Not available' using errcode='42501'; end if;
 if (submission.kind='brief' and not staff) or (submission.kind='creative' and staff) or submission.author_id=auth.uid() then raise exception 'Forbidden action' using errcode='42501'; end if;
 if exists(select 1 from public.project_submissions where project_id=p_project_id and kind=submission.kind and version>submission.version)
 or exists(select 1 from public.project_reviews where submission_id=p_submission_id) then raise exception 'Stale revision' using errcode='40001'; end if;
 insert into public.project_reviews(submission_id,decision,feedback,reviewer_id,reviewer_role)
 values(p_submission_id,p_decision,btrim(p_feedback),auth.uid(),case when staff then 'staff' else 'client' end);
 insert into public.project_activity(project_id,event_type,detail,actor_id,actor_role)
 values(p_project_id,'review',submission.kind||':'||submission.version::text||':'||p_decision,auth.uid(),case when staff then 'staff' else 'client' end);
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes)
 values(auth.uid(),'project_review',p_submission_id,'INSERT',jsonb_build_object('project_id',p_project_id,'decision',p_decision));
 update public.projects set updated_at=now() where id=p_project_id;
end;
$$;
create function public.publish_project_update(p_project_id uuid,p_body text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.has_staff_access() then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.projects where id=p_project_id for update;
 if not found then raise exception 'Project not found' using errcode='P0002'; end if;
 if p_body is null or char_length(btrim(p_body)) not between 2 and 1000 then raise exception 'Invalid update' using errcode='22023'; end if;
 if (select count(*) from public.project_activity where project_id=p_project_id and event_type='update')>=200 then raise exception 'Update limit' using errcode='54000'; end if;
 insert into public.project_activity(project_id,event_type,detail,actor_id,actor_role) values(p_project_id,'update',btrim(p_body),auth.uid(),'staff');
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'project_update',p_project_id,'INSERT','{}'::jsonb);
 update public.projects set updated_at=now() where id=p_project_id;
end;
$$;
revoke all on function public.submit_project_content(uuid,text,text,text,text,integer),public.review_project_content(uuid,uuid,text,text),public.publish_project_update(uuid,text) from public,anon;
grant execute on function public.submit_project_content(uuid,text,text,text,text,integer),public.review_project_content(uuid,uuid,text,text),public.publish_project_update(uuid,text) to authenticated;

create function public.project_status_activity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if OLD.status is distinct from NEW.status then
  insert into public.project_activity(project_id,event_type,detail,actor_id,actor_role)
  values(NEW.id,'status',OLD.status||':'||NEW.status,auth.uid(),case when public.has_staff_access() then 'staff' else 'system' end);
 end if;
 return NEW;
end;
$$;
revoke all on function public.project_status_activity() from public,anon,authenticated;
create trigger project_status_history after update on public.projects for each row execute function public.project_status_activity();
create or replace function public.set_client_access(p_organization_id uuid,p_user_id uuid,p_action text)
returns void language plpgsql security definer set search_path='' as $$
declare previous_role text; next_role text;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_action is null or p_action not in ('grant_viewer','grant_contributor','revoke') then raise exception 'Invalid action' using errcode='22023'; end if;
 -- Serialize changes for this organization, including an absent membership row.
 perform 1 from public.organizations where id=p_organization_id for update;
 if not found then raise exception 'Invalid association' using errcode='22023'; end if;
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Invalid association' using errcode='22023'; end if;
 if exists(select 1 from public.staff_members where user_id=p_user_id) then raise exception 'Staff identity cannot be assigned as client' using errcode='22023'; end if;
 select role into previous_role from public.memberships where organization_id=p_organization_id and user_id=p_user_id;
 if p_action in ('grant_viewer','grant_contributor') then
  next_role := case when p_action='grant_contributor' then 'admin' else 'viewer' end;
  if previous_role='owner' or previous_role=next_role or (previous_role='admin' and next_role='viewer') then return; end if;
  insert into public.memberships(organization_id,user_id,role) values(p_organization_id,p_user_id,next_role)
  on conflict(organization_id,user_id) do update set role=excluded.role;
 else
  if previous_role is null then return; end if;
  delete from public.memberships where organization_id=p_organization_id and user_id=p_user_id;
 end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes)
 values(auth.uid(),'client_access',p_organization_id,case when p_action='revoke' then 'DELETE' when previous_role is not null then 'UPDATE' else 'INSERT' end,
 jsonb_build_object('organization_id',p_organization_id,'target_user_id',p_user_id,'previous_role',previous_role,'role',next_role));
end;
$$;

commit;
