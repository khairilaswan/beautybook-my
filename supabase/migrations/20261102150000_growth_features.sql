-- Twenty features in one migration (2026-11-02):
--   discovery: new trust filters, late-night, near me / map, price filter,
--     mobile vendors' service areas, featured placement
--   shop content: portfolio photos, staff profiles, promotions, bridal and
--     event packages with quote requests, guides
--   customers: instant booking with slot capacity, verified reviews,
--     reminders and rebooking nudges, loyalty stamps, referrals
--   owners: analytics counters, gift vouchers, payments
-- Payments and outbound reminders stay switched off until their keys are set
-- (see .env.example); the tables below work without them.

-- ---------------------------------------------------------------------------
-- Taxonomy additions
-- ---------------------------------------------------------------------------

insert into public.attributes (slug, group_name, name_en, name_ms, sort_order) values
  ('women-only', 'audience', 'Women-only', 'Wanita sahaja', 5),
  ('muslim-friendly', 'audience', 'Muslim-friendly', 'Mesra Muslim', 8),
  ('prayer-room', 'amenity', 'Prayer room', 'Surau', 15)
on conflict (slug) do nothing;

-- How long until a customer usually comes back, for "time for a touch-up".
alter table public.categories add column rebook_days int check (rebook_days between 7 and 365);
update public.categories set rebook_days = case slug
  when 'barbershop' then 21
  when 'hair-salon' then 42
  when 'beauty-facial' then 30
  when 'nails' then 21
  when 'lashes-brows' then 21
  when 'spa-massage' then 30
  when 'waxing-threading' then 28
  else null end;

-- ---------------------------------------------------------------------------
-- Site switches
-- ---------------------------------------------------------------------------

-- Ratings stay off until the platform owner turns them on in /admin/features.
alter table public.site_settings
  add column reviews_enabled boolean not null default false,
  add column referral_points int not null default 100 check (referral_points between 0 and 10000),
  add column featured_price_rm int not null default 99 check (featured_price_rm between 1 and 100000);
grant update (reviews_enabled, referral_points, featured_price_rm) on public.site_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Mobile vendors: areas a home-service listing travels to
-- ---------------------------------------------------------------------------

create table public.listing_service_areas (
  listing_id uuid not null references public.listings (id) on delete cascade,
  area_id bigint not null references public.areas (id) on delete cascade,
  primary key (listing_id, area_id)
);
create index listing_service_areas_area_id_idx on public.listing_service_areas (area_id);

-- ---------------------------------------------------------------------------
-- Portfolio photos, staff, promotions, packages
-- ---------------------------------------------------------------------------

alter table public.photos
  add column kind text not null default 'shop' check (kind in ('shop', 'portfolio')),
  add column caption text check (length(caption) <= 140),
  add column category_id bigint references public.categories (id) on delete set null;
create index photos_category_id_idx on public.photos (category_id);

create table public.shop_staff (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  title text check (length(title) <= 60),
  bio text check (length(bio) <= 500),
  photo_path text,
  languages text[] not null default '{}',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index shop_staff_listing_id_idx on public.shop_staff (listing_id, sort_order);

create table public.promotions (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 80),
  details text check (length(details) <= 500),
  price_label text check (length(price_label) <= 40),
  occasion text not null default 'other'
    check (occasion in ('raya', 'cny', 'deepavali', 'christmas', 'merdeka', 'wedding', 'other')),
  starts_on date not null default current_date,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index promotions_listing_id_idx on public.promotions (listing_id, ends_on);
create index promotions_live_idx on public.promotions (ends_on, starts_on);

create table public.packages (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  kind text not null default 'bridal' check (kind in ('bridal', 'event', 'group', 'other')),
  name text not null check (length(trim(name)) between 1 and 80),
  description text check (length(description) <= 1000),
  includes text[] not null default '{}',
  price_from numeric(10, 2) check (price_from >= 0),
  price_to numeric(10, 2),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check (price_to is null or price_from is null or price_to >= price_from)
);
create index packages_listing_id_idx on public.packages (listing_id, sort_order);

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  short_code text not null unique check (short_code ~ '^[A-Za-z0-9]{6,10}$'),
  listing_id uuid not null references public.listings (id) on delete cascade,
  package_id bigint references public.packages (id) on delete set null,
  package_name text,
  user_id uuid references auth.users (id) on delete set null,
  customer_name text not null,
  customer_phone text check (customer_phone is null or customer_phone ~ '^60[0-9]{8,10}$'),
  event_type text not null check (event_type in ('wedding', 'engagement', 'dinner', 'photoshoot', 'graduation', 'other')),
  event_date date,
  people int check (people between 1 and 500),
  location text check (length(location) <= 200),
  budget text check (length(budget) <= 40),
  note text check (length(note) <= 500),
  status text not null default 'sent' check (status in ('sent', 'quoted', 'booked', 'declined')),
  client_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quote_requests_listing_id_idx on public.quote_requests (listing_id, created_at desc);
create index quote_requests_user_id_idx on public.quote_requests (user_id);
create index quote_requests_package_id_idx on public.quote_requests (package_id);
create index quote_requests_client_hash_idx on public.quote_requests (client_hash, created_at desc);
create trigger quote_requests_touch before update on public.quote_requests
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Guides (editorial pages for search)
-- ---------------------------------------------------------------------------

create table public.guides (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) between 1 and 120),
  summary text check (length(summary) <= 300),
  body text not null default '' check (length(body) <= 50000),
  area_id bigint references public.areas (id) on delete set null,
  category_id bigint references public.categories (id) on delete set null,
  faqs jsonb not null default '[]' check (jsonb_typeof(faqs) = 'array'),
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guides_area_id_idx on public.guides (area_id);
create index guides_category_id_idx on public.guides (category_id);
create index guides_author_id_idx on public.guides (author_id);
create index guides_published_idx on public.guides (published_at desc) where status = 'published';
create trigger guides_touch before update on public.guides
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Bookings: staff, deals, instant booking, reminders
-- ---------------------------------------------------------------------------

alter table public.booking_requests
  add column staff_id bigint references public.shop_staff (id) on delete set null,
  add column staff_name text,
  add column promotion_id bigint references public.promotions (id) on delete set null,
  add column duration_min int check (duration_min between 5 and 1440),
  -- Booked straight into a free slot (confirmed at once), not a WhatsApp request.
  add column instant boolean not null default false,
  add column reminder_sent_at timestamptz,
  add column rebook_sent_at timestamptz;
create index booking_requests_staff_id_idx on public.booking_requests (staff_id);
create index booking_requests_promotion_id_idx on public.booking_requests (promotion_id);
create index booking_requests_instant_idx on public.booking_requests (listing_id, preferred_at)
  where instant and status in ('confirmed', 'completed');
grant select (staff_id, staff_name, promotion_id, duration_min, instant)
  on public.booking_requests to authenticated;

-- Owners switch on instant booking and say how many customers they can take
-- at once (chairs or beds).
create table public.booking_settings (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  instant_enabled boolean not null default false,
  slot_minutes int not null default 30 check (slot_minutes in (15, 30, 45, 60, 90, 120)),
  capacity int not null default 1 check (capacity between 1 and 50),
  min_notice_hours int not null default 2 check (min_notice_hours between 0 and 72),
  max_days_ahead int not null default 14 check (max_days_ahead between 1 and 60),
  updated_at timestamptz not null default now()
);
create trigger booking_settings_touch before update on public.booking_settings
  for each row execute function private.touch_updated_at();

-- Takes a slot if it is still free. Called by the server only, after it has
-- checked the slot is inside opening hours. The advisory lock serialises
-- bookings for one shop so two customers can't take the last chair.
create function public.book_instant(
  p_listing_id uuid,
  p_start timestamptz,
  p_duration int,
  p_service_id bigint,
  p_service_name text,
  p_staff_id bigint,
  p_staff_name text,
  p_promotion_id bigint,
  p_user_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_note text,
  p_client_hash text,
  p_short_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.booking_settings;
  taken int;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_listing_id::text, 0));
  select * into s from public.booking_settings where listing_id = p_listing_id;
  if not found or not s.instant_enabled then
    raise exception 'instant booking is off' using errcode = 'P0001';
  end if;
  select count(*) into taken
  from public.booking_requests b
  where b.listing_id = p_listing_id
    and b.instant
    and b.status in ('confirmed', 'completed')
    and b.preferred_at < p_start + make_interval(mins => p_duration)
    and b.preferred_at + make_interval(mins => coalesce(b.duration_min, s.slot_minutes)) > p_start;
  if taken >= s.capacity then
    raise exception 'slot_full' using errcode = 'P0001';
  end if;
  if p_staff_id is not null and exists (
    select 1 from public.booking_requests b
    where b.listing_id = p_listing_id and b.instant and b.staff_id = p_staff_id
      and b.status in ('confirmed', 'completed')
      and b.preferred_at < p_start + make_interval(mins => p_duration)
      and b.preferred_at + make_interval(mins => coalesce(b.duration_min, s.slot_minutes)) > p_start
  ) then
    raise exception 'slot_full' using errcode = 'P0001';
  end if;
  insert into public.booking_requests (
    short_code, listing_id, user_id, service_id, service_name, staff_id, staff_name,
    promotion_id, preferred_at, duration_min, instant, status, customer_name,
    customer_phone, note, client_hash
  ) values (
    p_short_code, p_listing_id, p_user_id, p_service_id, p_service_name, p_staff_id, p_staff_name,
    p_promotion_id, p_start, p_duration, true, 'confirmed', p_customer_name,
    p_customer_phone, p_note, p_client_hash
  ) returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.book_instant(uuid, timestamptz, int, bigint, text, bigint, text, bigint, uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.book_instant(uuid, timestamptz, int, bigint, text, bigint, text, bigint, uuid, text, text, text, text, text)
  to service_role;

-- Reminders and rebooking nudges are opt-in (PDPA).
alter table public.profiles
  add column reminders_opt_in boolean not null default false,
  add column referral_code text generated always as (upper(substr(md5(id::text), 1, 8))) stored;
create unique index profiles_referral_code_idx on public.profiles (referral_code);

-- ---------------------------------------------------------------------------
-- Reviews from verified bookings
-- ---------------------------------------------------------------------------

create table public.reviews (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  booking_request_id uuid not null unique references public.booking_requests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null check (length(trim(author_name)) between 1 and 40),
  rating smallint not null check (rating between 1 and 5),
  body text check (length(body) <= 1000),
  service_name text,
  status text not null default 'published' check (status in ('published', 'hidden')),
  owner_reply text check (length(owner_reply) <= 1000),
  owner_replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reviews_listing_id_idx on public.reviews (listing_id, created_at desc) where status = 'published';
create index reviews_user_id_idx on public.reviews (user_id);
create trigger reviews_touch before update on public.reviews
  for each row execute function private.touch_updated_at();

-- A booking counts as a visit once the shop marked it completed, or a
-- confirmed booking's time has passed.
create function private.can_review(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select reviews_enabled from public.site_settings where id)
    and exists (
      select 1 from public.booking_requests b
      where b.id = p_booking_id
        and b.user_id = (select auth.uid())
        and (b.status = 'completed' or (b.status = 'confirmed' and b.preferred_at < now()))
    );
$$;

-- Authors edit their words, shop members only their reply, moderators anything.
create function private.guard_review_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or (select private.has_permission('reports.review')) then
    return new;
  end if;
  if new.listing_id is distinct from old.listing_id
    or new.booking_request_id is distinct from old.booking_request_id
    or new.user_id is distinct from old.user_id
    or new.status is distinct from old.status
    or new.service_name is distinct from old.service_name
  then
    raise exception 'You cannot change this field' using errcode = '42501';
  end if;
  if old.user_id = (select auth.uid()) then
    if new.owner_reply is distinct from old.owner_reply or new.owner_replied_at is distinct from old.owner_replied_at then
      raise exception 'Only the shop can reply' using errcode = '42501';
    end if;
  elsif (select private.is_listing_member(old.listing_id)) then
    if new.rating is distinct from old.rating or new.body is distinct from old.body
      or new.author_name is distinct from old.author_name then
      raise exception 'Shops cannot edit reviews' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger reviews_guard before update on public.reviews
  for each row execute function private.guard_review_update();

-- ---------------------------------------------------------------------------
-- Owner analytics: one counter row per listing, day and kind
-- ---------------------------------------------------------------------------

create table public.listing_stats (
  listing_id uuid not null references public.listings (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('view', 'whatsapp', 'call', 'directions', 'request', 'website')),
  count int not null default 0,
  primary key (listing_id, day, kind)
);

-- Called by the server's tracking endpoint (service role) only.
create function public.track_listing_event(p_listing_id uuid, p_kind text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.listing_stats (listing_id, day, kind, count)
  select p_listing_id, (now() at time zone 'Asia/Kuala_Lumpur')::date, p_kind, 1
  where exists (select 1 from public.listings where id = p_listing_id and status = 'active')
  on conflict (listing_id, day, kind) do update set count = public.listing_stats.count + 1;
$$;
revoke execute on function public.track_listing_event(uuid, text) from public, anon, authenticated;
grant execute on function public.track_listing_event(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Payments, featured placement, gift vouchers
-- ---------------------------------------------------------------------------

-- Written by the server only (Stripe Checkout + webhook).
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('featured', 'voucher')),
  ref_id text not null,
  user_id uuid references auth.users (id) on delete set null,
  amount_sen int not null check (amount_sen > 0),
  currency text not null default 'myr',
  provider text not null default 'stripe',
  provider_ref text unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payments_user_id_idx on public.payments (user_id);
create index payments_ref_idx on public.payments (kind, ref_id);

create table public.featured_placements (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  -- Null area or category: featured everywhere / in every category.
  area_id bigint references public.areas (id) on delete cascade,
  category_id bigint references public.categories (id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'requested'
    check (status in ('requested', 'pending_payment', 'active', 'cancelled')),
  amount_rm numeric(10, 2),
  requested_by uuid references auth.users (id) on delete set null,
  note text check (length(note) <= 300),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index featured_placements_listing_id_idx on public.featured_placements (listing_id);
create index featured_placements_area_id_idx on public.featured_placements (area_id);
create index featured_placements_category_id_idx on public.featured_placements (category_id);
create index featured_placements_requested_by_idx on public.featured_placements (requested_by);
create index featured_placements_live_idx on public.featured_placements (ends_at) where status = 'active';

create table public.voucher_settings (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  enabled boolean not null default false,
  amounts int[] not null default '{50,100,200}' check (cardinality(amounts) between 1 and 6),
  valid_months int not null default 6 check (valid_months between 1 and 24),
  terms text check (length(terms) <= 500),
  updated_at timestamptz not null default now()
);
create trigger voucher_settings_touch before update on public.voucher_settings
  for each row execute function private.touch_updated_at();

create table public.gift_vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{10}$'),
  listing_id uuid not null references public.listings (id) on delete cascade,
  amount_rm int not null check (amount_rm between 10 and 5000),
  buyer_id uuid references auth.users (id) on delete set null,
  buyer_name text not null check (length(buyer_name) <= 80),
  recipient_name text not null check (length(recipient_name) <= 80),
  message text check (length(message) <= 300),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'redeemed', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index gift_vouchers_listing_id_idx on public.gift_vouchers (listing_id, created_at desc);
create index gift_vouchers_buyer_id_idx on public.gift_vouchers (buyer_id);
create index gift_vouchers_redeemed_by_idx on public.gift_vouchers (redeemed_by);

-- ---------------------------------------------------------------------------
-- Loyalty stamp cards and referrals
-- ---------------------------------------------------------------------------

create table public.loyalty_programs (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  enabled boolean not null default false,
  stamps_required int not null default 8 check (stamps_required between 2 and 20),
  reward text not null default 'Free visit' check (length(trim(reward)) between 1 and 80),
  updated_at timestamptz not null default now()
);
create trigger loyalty_programs_touch before update on public.loyalty_programs
  for each row execute function private.touch_updated_at();

create table public.loyalty_stamps (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  booking_request_id uuid unique references public.booking_requests (id) on delete set null,
  created_at timestamptz not null default now()
);
create index loyalty_stamps_card_idx on public.loyalty_stamps (user_id, listing_id);
create index loyalty_stamps_listing_id_idx on public.loyalty_stamps (listing_id);

create table public.loyalty_redemptions (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  stamps_used int not null check (stamps_used > 0),
  reward text not null,
  redeemed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index loyalty_redemptions_card_idx on public.loyalty_redemptions (user_id, listing_id);
create index loyalty_redemptions_listing_id_idx on public.loyalty_redemptions (listing_id);
create index loyalty_redemptions_redeemed_by_idx on public.loyalty_redemptions (redeemed_by);

create table public.referrals (
  referred_id uuid primary key references auth.users (id) on delete cascade,
  referrer_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  check (referred_id <> referrer_id)
);
create index referrals_referrer_id_idx on public.referrals (referrer_id);

create table public.reward_points (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  points int not null,
  reason text not null check (reason in ('referral', 'referred_welcome', 'adjustment')),
  created_at timestamptz not null default now()
);
create index reward_points_user_id_idx on public.reward_points (user_id, created_at desc);

-- When a shop marks a signed-in customer's booking completed: add a stamp if
-- the shop runs a card, and reward whoever referred the customer the first time.
create function private.on_booking_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pts int;
  ref public.referrals;
begin
  if new.status <> 'completed' or old.status = 'completed' or new.user_id is null then
    return null;
  end if;
  if exists (select 1 from public.loyalty_programs where listing_id = new.listing_id and enabled) then
    insert into public.loyalty_stamps (listing_id, user_id, booking_request_id)
    values (new.listing_id, new.user_id, new.id)
    on conflict (booking_request_id) do nothing;
  end if;
  select * into ref from public.referrals where referred_id = new.user_id and rewarded_at is null for update;
  if found then
    select referral_points into pts from public.site_settings where id;
    insert into public.reward_points (user_id, points, reason) values
      (ref.referrer_id, pts, 'referral'),
      (ref.referred_id, pts / 2, 'referred_welcome');
    update public.referrals set rewarded_at = now() where referred_id = ref.referred_id;
  end if;
  return null;
end;
$$;
create trigger booking_requests_completed after update of status on public.booking_requests
  for each row execute function private.on_booking_completed();

-- Stamps a customer has on a shop's card since their last reward.
create function public.loyalty_balance(p_listing_id uuid, p_user_id uuid)
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  select (select count(*)::int from public.loyalty_stamps where listing_id = p_listing_id and user_id = p_user_id)
    - coalesce((select sum(stamps_used)::int from public.loyalty_redemptions
                where listing_id = p_listing_id and user_id = p_user_id), 0);
$$;

-- ---------------------------------------------------------------------------
-- Search, now with distance, price, late-night, service areas, featured and
-- ratings.
-- ---------------------------------------------------------------------------

drop function public.search_listings(text, text, text, text[], text, boolean, int, int);

create function public.search_listings(
  p_query text default null,
  p_category text default null,
  p_area text default null,
  p_attributes text[] default null,
  p_gender text default null,
  p_open_now boolean default false,
  p_limit int default 24,
  p_offset int default 0,
  p_open_late boolean default false,
  p_max_price numeric default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_sort text default null,
  p_slugs text[] default null
)
returns table (
  id uuid,
  slug text,
  name text,
  area_name text,
  area_slug text,
  primary_category text,
  price_level smallint,
  gender text,
  is_claimed boolean,
  open_now boolean,
  cover_path text,
  lat double precision,
  lng double precision,
  min_price numeric,
  max_price numeric,
  distance_km double precision,
  is_featured boolean,
  has_deal boolean,
  rating_avg numeric,
  rating_count bigint,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with tree as (
    select t from public.area_tree(p_area) t where p_area is not null
  ),
  late as (
    select ((date_trunc('day', now() at time zone 'Asia/Kuala_Lumpur') + interval '22 hours')
      at time zone 'Asia/Kuala_Lumpur') as at
  ),
  matched as (
    select l.*,
      case when p_lat is null or p_lng is null or l.lat is null or l.lng is null then null
        else 2 * 6371 * asin(sqrt(
          power(sin(radians(l.lat - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(l.lat)) * power(sin(radians(l.lng - p_lng) / 2), 2)
        )) end as dist
    from public.listings l
    where l.status = 'active'
      and (p_slugs is null or l.slug = any (p_slugs))
      and (p_area is null
        or l.area_id in (select t from tree)
        or exists (select 1 from public.listing_service_areas sa
                   where sa.listing_id = l.id and sa.area_id in (select t from tree)))
      and (p_category is null or exists (
        select 1 from public.listing_categories lc
        join public.categories c on c.id = lc.category_id
        where lc.listing_id = l.id and (c.slug = p_category or c.slug_ms = p_category)
      ))
      and (p_gender is null or l.gender = p_gender or l.gender = 'unisex')
      and (p_attributes is null or cardinality(p_attributes) = 0 or (
        select count(distinct a.slug) from public.listing_attributes la
        join public.attributes a on a.id = la.attribute_id
        where la.listing_id = l.id and a.slug = any (p_attributes)
      ) = cardinality(p_attributes))
      and (p_query is null or p_query = ''
        or l.search @@ websearch_to_tsquery('simple', p_query)
        or p_query operator(extensions.<%) l.name
        or exists (select 1 from public.services s
                   where s.listing_id = l.id and s.name ilike '%' || p_query || '%'))
      and (not p_open_now or public.is_open_at(l.id, now()))
      and (not p_open_late or public.is_open_at(l.id, (select at from late)))
      and (p_max_price is null or exists (
        select 1 from public.services s where s.listing_id = l.id and s.price_from <= p_max_price))
  ),
  scored as (
    select m.*,
      exists (
        select 1 from public.featured_placements fp
        where fp.listing_id = m.id and fp.status = 'active'
          and now() between fp.starts_at and fp.ends_at
          and (fp.area_id is null or p_area is null or fp.area_id in (select t from tree))
          and (fp.category_id is null or p_category is null or exists (
            select 1 from public.categories c
            where c.id = fp.category_id and (c.slug = p_category or c.slug_ms = p_category)))
      ) as featured
    from matched m
    where p_radius_km is null or m.dist is null or m.dist <= p_radius_km
  )
  select
    m.id, m.slug, m.name, a.name, a.slug,
    (select c.slug from public.listing_categories lc
       join public.categories c on c.id = lc.category_id
       where lc.listing_id = m.id order by lc.is_primary desc, c.sort_order limit 1),
    m.price_level, m.gender,
    private.is_claimed(m.id),
    public.is_open_at(m.id, now()),
    (select p.storage_path from public.photos p
       where p.listing_id = m.id and p.status = 'approved'
       order by (p.kind = 'portfolio'), p.sort_order, p.id limit 1),
    m.lat, m.lng,
    (select min(s.price_from) from public.services s where s.listing_id = m.id),
    (select max(coalesce(s.price_to, s.price_from)) from public.services s where s.listing_id = m.id),
    round(m.dist::numeric, 1)::double precision,
    m.featured,
    exists (select 1 from public.promotions pr
            where pr.listing_id = m.id and current_date between pr.starts_on and pr.ends_on),
    (select round(avg(r.rating), 1) from public.reviews r where r.listing_id = m.id and r.status = 'published'),
    (select count(*) from public.reviews r where r.listing_id = m.id and r.status = 'published'),
    count(*) over ()
  from scored m
  left join public.areas a on a.id = m.area_id
  order by
    m.featured desc,
    case when p_sort = 'distance' or (p_sort is null and p_lat is not null) then m.dist end asc nulls last,
    case when p_sort = 'price' then (select min(s.price_from) from public.services s where s.listing_id = m.id) end asc nulls last,
    case when p_query is null or p_query = '' then 0
      else ts_rank(m.search, websearch_to_tsquery('simple', p_query))
        + extensions.word_similarity(p_query, m.name) end desc,
    m.last_verified_at desc nulls last,
    m.name
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
$$;

grant execute on function public.search_listings(
  text, text, text, text[], text, boolean, int, int, boolean, numeric,
  double precision, double precision, double precision, text, text[]
) to anon, authenticated;
grant execute on function public.loyalty_balance(uuid, uuid) to authenticated;
grant execute on function private.can_review(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.listing_service_areas enable row level security;
alter table public.shop_staff enable row level security;
alter table public.promotions enable row level security;
alter table public.packages enable row level security;
alter table public.quote_requests enable row level security;
alter table public.guides enable row level security;
alter table public.booking_settings enable row level security;
alter table public.reviews enable row level security;
alter table public.listing_stats enable row level security;
alter table public.payments enable row level security;
alter table public.featured_placements enable row level security;
alter table public.voucher_settings enable row level security;
alter table public.gift_vouchers enable row level security;
alter table public.loyalty_programs enable row level security;
alter table public.loyalty_stamps enable row level security;
alter table public.loyalty_redemptions enable row level security;
alter table public.referrals enable row level security;
alter table public.reward_points enable row level security;

-- Shop content: public read, the shop's members and editors write.
do $$
declare
  t text;
begin
  foreach t in array array[
    'listing_service_areas', 'shop_staff', 'promotions', 'packages',
    'booking_settings', 'voucher_settings', 'loyalty_programs'
  ] loop
    execute format(
      'create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format(
      'create policy "members and editors write" on public.%I for all to authenticated
         using ((select private.has_permission(''listings.edit'')) or (select private.is_listing_member(listing_id)))
         with check ((select private.has_permission(''listings.edit'')) or (select private.is_listing_member(listing_id)))',
      t);
  end loop;
end;
$$;

-- Quote requests: created by the server; the customer and the shop read them,
-- the shop moves the status.
create policy "read quote requests" on public.quote_requests for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_listing_member(listing_id))
    or (select private.has_permission('listings.edit'))
  );
create policy "members update quote status" on public.quote_requests for update to authenticated
  using ((select private.is_listing_member(listing_id)))
  with check ((select private.is_listing_member(listing_id)));

create policy "read published guides" on public.guides for select to anon, authenticated
  using (status = 'published' or (select private.has_permission('seo.edit')));
create policy "seo editors write guides" on public.guides for all to authenticated
  using ((select private.has_permission('seo.edit')))
  with check ((select private.has_permission('seo.edit')));

create policy "read published reviews" on public.reviews for select to anon, authenticated
  using (
    status = 'published'
    or user_id = (select auth.uid())
    or (select private.is_listing_member(listing_id))
    or (select private.has_permission('reports.review'))
  );
create policy "verified customers write reviews" on public.reviews for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.can_review(booking_request_id))
    and exists (select 1 from public.booking_requests b
                where b.id = booking_request_id and b.listing_id = reviews.listing_id)
  );
create policy "authors, shops and moderators update reviews" on public.reviews for update to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_listing_member(listing_id))
    or (select private.has_permission('reports.review'))
  )
  with check (
    user_id = (select auth.uid())
    or (select private.is_listing_member(listing_id))
    or (select private.has_permission('reports.review'))
  );
create policy "authors and moderators delete reviews" on public.reviews for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.has_permission('reports.review')));

create policy "members read stats" on public.listing_stats for select to authenticated
  using ((select private.is_listing_member(listing_id)) or (select private.has_permission('listings.edit')));

-- payments: no policies, server only.

create policy "read featured" on public.featured_placements for select to anon, authenticated
  using (
    status = 'active'
    or (select private.is_listing_member(listing_id))
    or (select private.has_permission('billing.manage'))
  );
create policy "billing manages featured" on public.featured_placements for all to authenticated
  using ((select private.has_permission('billing.manage')))
  with check ((select private.has_permission('billing.manage')));

create policy "buyers and shops read vouchers" on public.gift_vouchers for select to authenticated
  using (
    buyer_id = (select auth.uid())
    or (select private.is_listing_member(listing_id))
    or (select private.has_permission('billing.manage'))
  );
create policy "shops redeem vouchers" on public.gift_vouchers for update to authenticated
  using ((select private.is_listing_member(listing_id)) and status = 'active')
  with check ((select private.is_listing_member(listing_id)) and status in ('active', 'redeemed'));

create policy "read own or shop stamps" on public.loyalty_stamps for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_listing_member(listing_id)));
create policy "read own or shop redemptions" on public.loyalty_redemptions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_listing_member(listing_id)));
create policy "shops record redemptions" on public.loyalty_redemptions for insert to authenticated
  with check (
    (select private.is_listing_member(listing_id))
    and redeemed_by = (select auth.uid())
    and stamps_used <= public.loyalty_balance(listing_id, user_id)
  );

create policy "read own referrals" on public.referrals for select to authenticated
  using (referrer_id = (select auth.uid()) or referred_id = (select auth.uid()));
create policy "read own points" on public.reward_points for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- New tables get Supabase's default grants (everything); start from nothing
-- so the column grants below actually restrict.
revoke all on public.listing_service_areas, public.shop_staff, public.promotions, public.packages,
  public.quote_requests, public.guides, public.booking_settings, public.reviews, public.listing_stats,
  public.payments, public.featured_placements, public.voucher_settings, public.gift_vouchers,
  public.loyalty_programs, public.loyalty_stamps, public.loyalty_redemptions, public.referrals,
  public.reward_points
  from anon, authenticated;

grant select on public.listing_service_areas, public.shop_staff, public.promotions, public.packages,
  public.guides, public.booking_settings, public.reviews, public.featured_placements,
  public.voucher_settings, public.loyalty_programs
  to anon, authenticated;
grant insert, update, delete on public.listing_service_areas, public.shop_staff, public.promotions,
  public.packages, public.guides, public.booking_settings, public.featured_placements,
  public.voucher_settings, public.loyalty_programs
  to authenticated;
grant select on public.quote_requests, public.listing_stats, public.gift_vouchers,
  public.loyalty_stamps, public.loyalty_redemptions, public.referrals, public.reward_points
  to authenticated;
grant update (status) on public.quote_requests to authenticated;
grant update (status, redeemed_at, redeemed_by) on public.gift_vouchers to authenticated;
grant insert on public.loyalty_redemptions to authenticated;
grant insert, update (rating, body, author_name, owner_reply, owner_replied_at, status), delete
  on public.reviews to authenticated;
-- Photos gained columns that owners set.
grant update (kind, caption, category_id) on public.photos to authenticated;

-- ---------------------------------------------------------------------------
-- Audit trail for the new owner-editable tables
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'listing_service_areas', 'shop_staff', 'promotions', 'packages', 'guides',
    'booking_settings', 'reviews', 'featured_placements', 'voucher_settings',
    'gift_vouchers', 'loyalty_programs', 'loyalty_redemptions'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function private.write_audit_log()',
      t || '_audit', t
    );
  end loop;
end;
$$;
