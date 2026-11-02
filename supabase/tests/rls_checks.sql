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
update public.listings set mall_id = (select id from public.malls where slug = 'bangsar-village')
where slug = 'demo-barber-bangsar';
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
  if (select count(*) from public.malls) < 20 then
    raise exception 'anon cannot read the mall list';
  end if;
  if (select count(*) from public.search_listings(p_mall => 'bangsar-village')) <> 1
    or (select mall_name from public.search_listings(p_mall => 'bangsar-village')) <> 'Bangsar Village' then
    raise exception 'search_listings by mall failed';
  end if;
  if (select count(*) from public.search_listings(p_mall => 'suria-klcc')) <> 0 then
    raise exception 'search_listings returned shops from another mall';
  end if;
  if (select listing_count from public.mall_counts() where mall_slug = 'bangsar-village') <> 1 then
    raise exception 'mall_counts failed';
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
  insert into public.malls (slug, name) values ('fake-mall', 'Fake Mall');
  raise exception 'anon added a mall';
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
  update public.listings set mall_id = (select id from public.malls where slug = 'mid-valley-megamall')
  where slug = 'demo-barber-bangsar';
  if (select m.slug from public.listings l join public.malls m on m.id = l.mall_id
      where l.slug = 'demo-barber-bangsar') <> 'mid-valley-megamall' then
    raise exception 'owner could not set their shop''s mall';
  end if;
end $$;

do $$ begin
  insert into public.malls (slug, name) values ('owner-mall', 'Owner Mall');
  raise exception 'shop owner added a mall';
exception when insufficient_privilege then null;
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
  insert into public.malls (slug, name) values ('editor-mall', 'Editor Mall');
  update public.malls set name = 'Editor Mall 2' where slug = 'editor-mall';
  delete from public.malls where slug = 'editor-mall';
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

-- Members-only access --------------------------------------------------------
reset role;
insert into auth.users (id, email) values ('10000000-0000-4000-8000-000000000005', 'member@example.test');
do $$ begin
  if (select status from public.member_access where user_id = '10000000-0000-4000-8000-000000000005') is distinct from 'pending' then
    raise exception 'a new sign-up is not pending';
  end if;
  if (select status from public.member_access where user_id = '10000000-0000-4000-8000-000000000001') is distinct from 'approved' then
    raise exception 'staff are not approved';
  end if;
  if (select raw_app_meta_data ->> 'access' from auth.users where id = '10000000-0000-4000-8000-000000000005') is distinct from 'pending' then
    raise exception 'access not copied to app_metadata';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
do $$ begin
  if (select count(*) from public.member_access) <> 1 then
    raise exception 'a customer sees other members';
  end if;
  update public.member_access set status = 'approved' where user_id = '10000000-0000-4000-8000-000000000005';
  if (select status from public.member_access where user_id = '10000000-0000-4000-8000-000000000005') is distinct from 'pending' then
    raise exception 'a customer approved themselves';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
do $$
declare n int;
begin
  update public.member_access set status = 'approved' where user_id = '10000000-0000-4000-8000-000000000005';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'an editor approved a member';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$ begin
  update public.member_access set status = 'approved', decided_at = now()
  where user_id = '10000000-0000-4000-8000-000000000005';
end $$;

reset role;
do $$ begin
  if (select raw_app_meta_data ->> 'access' from auth.users where id = '10000000-0000-4000-8000-000000000005') is distinct from 'approved' then
    raise exception 'the owner could not approve a member';
  end if;
end $$;

-- Site theme ---------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  if (select theme_style from public.site_settings) is distinct from 'classic' then
    raise exception 'anon cannot read the site theme';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
do $$
declare n int;
begin
  update public.site_settings set theme_style = 'glass';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'an editor changed the site theme';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$
declare n int;
begin
  update public.site_settings set theme_style = 'swiss', theme_color = 'red';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'the owner could not change the site theme';
  end if;
end $$;

-- A shop's own member can set its theme; a customer can't.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
do $$
declare n int;
begin
  update public.listings set theme_style = 'brutal', theme_color = 'yellow'
  where id = '00000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'a shop owner could not set their shop theme';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
do $$
declare n int;
begin
  update public.listings set theme_style = 'glass'
  where id = '00000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'a customer changed a shop theme';
  end if;
end $$;
reset role;

-- Growth features (2026-11-02) ----------------------------------------------
-- Fixtures as the database owner.
insert into public.loyalty_programs (listing_id, enabled, stamps_required, reward)
values ('00000000-0000-4000-8000-000000000001', true, 2, 'Free cut');
insert into public.booking_requests (id, short_code, listing_id, user_id, service_name, customer_name, status, preferred_at)
values
  ('20000000-0000-4000-8000-000000000001', 'DONE001', '00000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000003', 'Fade', 'Aina', 'confirmed', now() - interval '2 days'),
  ('20000000-0000-4000-8000-000000000002', 'DONE002', '00000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000003', 'Fade', 'Aina', 'confirmed', now() - interval '1 day'),
  ('20000000-0000-4000-8000-000000000003', 'LATER01', '00000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000003', 'Fade', 'Aina', 'confirmed', now() + interval '2 days');
insert into public.referrals (referred_id, referrer_id)
values ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004');
insert into public.listing_service_areas (listing_id, area_id)
select '00000000-0000-4000-8000-000000000003', id from public.areas where slug = 'kuala-lumpur';

-- Anonymous visitors
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  if (select count(*) from public.search_listings(p_lat => 3.13, p_lng => 101.67, p_radius_km => 50)) < 1 then
    raise exception 'search_listings near me found nothing';
  end if;
  if exists (select 1 from public.search_listings(p_lat => 3.13, p_lng => 101.67, p_radius_km => 50) where distance_km is null and lat is not null) then
    raise exception 'search_listings did not return distances';
  end if;
  if not exists (select 1 from public.search_listings(p_area => 'kuala-lumpur') where slug = 'demo-nails-subang') then
    raise exception 'a mobile vendor did not show in an area it serves';
  end if;
  if (select count(*) from public.search_listings(p_slugs => array['demo-salon-ss2', 'demo-nails-subang'])) <> 2 then
    raise exception 'search_listings by slugs failed';
  end if;
end $$;
do $$ begin
  perform 1 from public.quote_requests;
  raise exception 'anon can read quote requests';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform 1 from public.listing_stats;
  raise exception 'anon can read shop analytics';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform 1 from public.payments;
  raise exception 'anon can read payments';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.book_instant('00000000-0000-4000-8000-000000000001', now(), 30, null, 'x', null, null, null, null, 'x', null, null, null, 'XXXXXX');
  raise exception 'anon can book instant slots directly';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.track_listing_event('00000000-0000-4000-8000-000000000001', 'view');
  raise exception 'anon can write analytics directly';
exception when insufficient_privilege then null;
end $$;

-- Shop owner: content, completing visits
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
do $$ begin
  insert into public.shop_staff (listing_id, name) values ('00000000-0000-4000-8000-000000000001', 'Ahmad');
  insert into public.promotions (listing_id, title, ends_on)
  values ('00000000-0000-4000-8000-000000000001', 'Raya fade', current_date + 7);
  insert into public.booking_settings (listing_id, instant_enabled) values ('00000000-0000-4000-8000-000000000001', true);
  update public.booking_requests set status = 'completed'
  where id in ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');
end $$;
do $$ begin
  insert into public.shop_staff (listing_id, name) values ('00000000-0000-4000-8000-000000000002', 'Intruder');
  raise exception 'owner added staff to someone else''s shop';
exception when insufficient_privilege then null;
end $$;

reset role;
do $$ begin
  if (select count(*) from public.loyalty_stamps where user_id = '10000000-0000-4000-8000-000000000003') <> 2 then
    raise exception 'completed visits did not add stamps';
  end if;
  if (select coalesce(sum(points), 0) from public.reward_points where user_id = '10000000-0000-4000-8000-000000000004') <> 100 then
    raise exception 'the referrer was not rewarded exactly once';
  end if;
end $$;

-- Customer: reviews are off until the owner turns them on
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
do $$ begin
  insert into public.reviews (listing_id, booking_request_id, user_id, author_name, rating)
  values ('00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
          '10000000-0000-4000-8000-000000000003', 'Aina', 5);
  raise exception 'a review was accepted while reviews are off';
exception when insufficient_privilege then null;
end $$;
reset role;
update public.site_settings set reviews_enabled = true;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
do $$ begin
  insert into public.reviews (listing_id, booking_request_id, user_id, author_name, rating)
  values ('00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
          '10000000-0000-4000-8000-000000000003', 'Aina', 5);
  if (select loyalty_balance('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003')) <> 2 then
    raise exception 'customer cannot see their stamp balance';
  end if;
end $$;
do $$ begin
  insert into public.reviews (listing_id, booking_request_id, user_id, author_name, rating)
  values ('00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003',
          '10000000-0000-4000-8000-000000000003', 'Aina', 5);
  raise exception 'a customer reviewed a visit that has not happened';
exception when insufficient_privilege then null;
end $$;

-- Shop owner: reply yes, change the stars no; give a reward once
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
do $$ begin
  update public.reviews set owner_reply = 'Thanks!' where booking_request_id = '20000000-0000-4000-8000-000000000001';
  if not exists (select 1 from public.reviews where owner_reply = 'Thanks!') then
    raise exception 'owner could not reply to a review';
  end if;
end $$;
do $$ begin
  update public.reviews set rating = 1 where booking_request_id = '20000000-0000-4000-8000-000000000001';
  raise exception 'owner changed a customer''s rating';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.loyalty_redemptions (listing_id, user_id, stamps_used, reward, redeemed_by)
  values ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 2, 'Free cut',
          '10000000-0000-4000-8000-000000000002');
end $$;
do $$ begin
  insert into public.loyalty_redemptions (listing_id, user_id, stamps_used, reward, redeemed_by)
  values ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 2, 'Free cut',
          '10000000-0000-4000-8000-000000000002');
  raise exception 'a reward was given twice for the same stamps';
exception when insufficient_privilege then null;
end $$;

-- Instant booking: the last chair can only be taken once
reset role;
do $$
declare
  t timestamptz := date_trunc('hour', now()) + interval '3 days';
begin
  perform public.book_instant('00000000-0000-4000-8000-000000000001', t, 30, null, 'Fade', null, null, null, null,
    'A', null, null, null, 'INST001');
  begin
    perform public.book_instant('00000000-0000-4000-8000-000000000001', t + interval '15 minutes', 30, null, 'Fade',
      null, null, null, null, 'B', null, null, null, 'INST002');
    raise exception 'an overlapping slot was booked twice';
  exception when raise_exception then
    if sqlerrm <> 'slot_full' then raise; end if;
  end;
end $$;

reset role;
select 'all RLS checks passed' as result;
rollback;
