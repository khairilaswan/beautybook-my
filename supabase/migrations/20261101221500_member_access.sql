-- Members-only mode: every account starts as 'pending' and a staff member with
-- staff.manage approves or rejects it. The status is copied into the user's
-- app_metadata (which users can't edit) so the proxy can check it from the
-- session token without a database call on every request.

create table public.member_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index member_access_status_idx on public.member_access (status, created_at desc);
create index member_access_decided_by_idx on public.member_access (decided_by);

alter table public.member_access enable row level security;

create policy "read own or manage access" on public.member_access for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_permission('staff.manage')));
create policy "managers decide access" on public.member_access for update to authenticated
  using ((select private.has_permission('staff.manage')))
  with check ((select private.has_permission('staff.manage')));

grant select on public.member_access to authenticated;
grant update (status, decided_by, decided_at) on public.member_access to authenticated;

create trigger member_access_audit after insert or update or delete on public.member_access
  for each row execute function private.write_audit_log();

-- Keep auth.users.raw_app_meta_data.access in step with the table.
create function private.sync_member_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('access', new.status)
  where id = new.user_id;
  -- Losing access ends every session at its next token refresh.
  if tg_op = 'UPDATE' and old.status = 'approved' and new.status <> 'approved' then
    delete from auth.sessions where user_id = new.user_id;
  end if;
  return null;
end;
$$;

create trigger member_access_sync after insert or update of status on public.member_access
  for each row execute function private.sync_member_access();

-- New sign-ups wait for approval.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  insert into public.member_access (user_id, email, display_name)
  values (
    new.id,
    coalesce(new.email, new.phone),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Staff always get in.
create function private.approve_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.member_access
  set status = 'approved', decided_by = (select auth.uid()), decided_at = now()
  where user_id = new.user_id and status <> 'approved';
  return null;
end;
$$;

create trigger staff_approve_access after insert on public.staff
  for each row execute function private.approve_staff();

-- Existing accounts: staff are approved, everyone else waits.
insert into public.member_access (user_id, email, display_name, status, decided_at)
select
  u.id,
  coalesce(u.email, u.phone),
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  case when s.user_id is not null then 'approved' else 'pending' end,
  case when s.user_id is not null then now() end
from auth.users u
left join public.staff s on s.user_id = u.id
on conflict (user_id) do nothing;
