-- Row-level security checks. Run after migrations and seed:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_checks.sql
-- Each block raises an exception when a rule is broken. Everything runs in a
-- transaction that is rolled back.

begin;

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'owner@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'shop@example.test'),
  ('10000000-0000-4000-8000-000000000003', 'customer@example.test'),
  ('10000000-0000-4000-8000-000000000004', 'editor@example.test');

insert into public.staff (user_id, role_id)
select '10000000-0000-4000-8000-000000000001', id from public.roles where slug = 'owner';
insert into public.staff (user_id, role_id)
select '10000000-0000-4000-8000-000000000004', id from public.roles where slug = 'editor';
insert into public.listing_members (listing_id, user_id)
values ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
insert into public.listings (id, slug, name, status)
values ('00000000-0000-4000-8000-000000000009', 'hidden-shop', 'Hidden shop', 'hidden');
insert into public.booking_requests (short_code, listing_id, user_id, service_name, customer_name)
values ('ABC123', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003',
  'Haircut', 'Aina');

-- Anonymous visitors -------------------------------------------------------
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

do $$ begin
  if exists (select 1 from public.listings where slug = 'hidden-shop') then
    raise exception 'anon can see a hidden listing';
  end if;
  if (select count(*) from public.listings) < 3 then
    raise exception 'anon cannot see active listings';
  end if;
  if (select count(*) from public.search_listings(p_category => 'barbershop')) <> 1 then
    raise exception 'search_listings by category failed';
  end if;
  if (select count(*) from public.search_listings(p_area => 'petaling-jaya')) <> 1 then
    raise exception 'search_listings by parent area failed';
  end if;
  if (select count(*) from public.search_listings(p_query => 'barbr')) <> 1 then
    raise exception 'search_listings fuzzy name match failed';
  end if;
  -- 2026-10-30 is a Friday. The demo salon breaks 13:00-14:30 for prayers.
  if public.is_open_at('00000000-0000-4000-8000-000000000002', '2026-10-30 13:30+08') then
    raise exception 'is_open_at ignored the Friday break';
  end if;
  if not public.is_open_at('00000000-0000-4000-8000-000000000002', '2026-10-30 12:00+08') then
    raise exception 'is_open_at missed Friday morning hours';
  end if;
  if public.is_open_at('00000000-0000-4000-8000-000000000002', '2026-11-01 12:00+08') then
    raise exception 'is_open_at opened the salon on Sunday';
  end if;
end $$;

do $$ begin
  update public.listings set name = 'Hacked' where slug = 'demo-barber-bangsar';
  if exists (select 1 from public.listings where name = 'Hacked') then
    raise exception 'anon updated a listing';
  end if;
exception when insufficient_privilege then null;
end $$;

do $$ begin
  perform 1 from public.booking_requests;
  raise exception 'anon can read booking requests';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  perform 1 from public.claim_codes;
  raise exception 'anon can read claim codes';
exception when insufficient_privilege then null;
end $$;

-- Shop owner ----------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

do $$ begin
  update public.listings set description = 'Owner edit' where slug = 'demo-barber-bangsar';
  if not exists (select 1 from public.listings where description = 'Owner edit') then
    raise exception 'owner could not edit own description';
  end if;
  update public.listings set description = 'Other edit' where slug = 'demo-salon-ss2';
  if exists (select 1 from public.listings where description = 'Other edit') then
    raise exception 'owner edited someone else''s listing';
  end if;
end $$;

do $$ begin
  update public.listings set phone = '60199999999' where slug = 'demo-barber-bangsar';
  raise exception 'owner changed the verified phone directly';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  update public.booking_requests set status = 'confirmed' where short_code = 'ABC123';
  if not exists (select 1 from public.booking_requests where status = 'confirmed') then
    raise exception 'owner could not confirm a request';
  end if;
end $$;

do $$ begin
  update public.booking_requests set customer_name = 'Changed' where short_code = 'ABC123';
  raise exception 'owner changed a request field other than status';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  -- Role 1 is Owner. A literal id, because non-staff cannot read roles.
  insert into public.staff (user_id, role_id)
  values ('10000000-0000-4000-8000-000000000002', 1);
  raise exception 'shop owner made themselves staff';
exception when insufficient_privilege then null;
end $$;

-- Customer -------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);

do $$ begin
  if (select count(*) from public.booking_requests) <> 1 then
    raise exception 'customer cannot see their own request';
  end if;
  insert into public.favourites (user_id, listing_id)
  values ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002');
  insert into public.notes (user_id, listing_id, body)
  values ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'Ask for Ahmad');
end $$;

do $$ begin
  insert into public.favourites (user_id, listing_id)
  values ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002');
  raise exception 'customer wrote a favourite for someone else';
exception when insufficient_privilege then null;
end $$;

-- Editor ---------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);

do $$ begin
  if not exists (select 1 from public.listings where slug = 'hidden-shop') then
    raise exception 'editor cannot see hidden listings';
  end if;
  update public.listings set phone = '60188888888' where slug = 'demo-salon-ss2';
  if not exists (select 1 from public.listings where phone = '60188888888') then
    raise exception 'editor could not change a phone';
  end if;
  if (select count(*) from public.audit_log) <> 0 then
    raise exception 'editor can read the audit log';
  end if;
end $$;

do $$ begin
  insert into public.staff (user_id, role_id)
  values ('10000000-0000-4000-8000-000000000003', 2);
  raise exception 'editor added staff';
exception when insufficient_privilege then null;
end $$;

-- Owner (platform) -------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

do $$ begin
  if not exists (select 1 from public.audit_log where table_name = 'listings' and actor_id = '10000000-0000-4000-8000-000000000004') then
    raise exception 'audit log missed the editor''s change';
  end if;
  insert into public.staff (user_id, role_id)
  select '10000000-0000-4000-8000-000000000003', id from public.roles where slug = 'moderator';
end $$;

-- Service role (server actions) ------------------------------------------------
reset role;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);

do $$ begin
  update public.listings set name = 'Renamed by server' where slug = 'demo-nails-subang';
  insert into public.booking_requests (short_code, listing_id, service_name, customer_name)
  values ('SRV123', '00000000-0000-4000-8000-000000000003', 'Manicure', 'Mei');
  if public.staff_user_id_by_email('OWNER@example.test') <> '10000000-0000-4000-8000-000000000001' then
    raise exception 'staff_user_id_by_email failed';
  end if;
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
do $$ begin
  perform public.staff_user_id_by_email('owner@example.test');
  raise exception 'a customer can look up users by email';
exception when insufficient_privilege then null;
end $$;

reset role;
select 'all RLS checks passed' as result;
rollback;
