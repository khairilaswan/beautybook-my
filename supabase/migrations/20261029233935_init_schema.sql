-- BeautyBook initial schema.
-- Public directory data is readable by everyone; everything else is scoped by
-- row-level security. Staff permissions live in roles.permissions and are
-- checked through private.has_permission().

create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Taxonomy
-- ---------------------------------------------------------------------------

create table public.areas (
  id bigint generated always as identity primary key,
  parent_id bigint references public.areas (id) on delete restrict,
  type text not null check (type in ('state', 'city', 'area')),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  lat double precision,
  lng double precision,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index areas_parent_id_idx on public.areas (parent_id);

create table public.categories (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  slug_ms text not null unique check (slug_ms ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en text not null,
  name_ms text not null,
  name_zh text,
  schema_type text not null default 'BeautySalon',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.attributes (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  group_name text not null check (group_name in ('audience', 'language', 'amenity', 'service_mode')),
  name_en text not null,
  name_ms text not null,
  sort_order int not null default 0
);

-- Standard menu shown on unclaimed listings until the owner adds their own.
create table public.service_templates (
  id bigint generated always as identity primary key,
  category_id bigint not null references public.categories (id) on delete cascade,
  name_en text not null,
  name_ms text not null,
  price_from numeric(10, 2),
  price_to numeric(10, 2),
  duration_min int check (duration_min > 0),
  sort_order int not null default 0,
  check (price_to is null or price_from is null or price_to >= price_from)
);
create index service_templates_category_id_idx on public.service_templates (category_id);

-- ---------------------------------------------------------------------------
-- Staff, roles and permissions (one role per person)
-- ---------------------------------------------------------------------------

create table public.roles (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  description text,
  permissions text[] not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  check (permissions <@ array[
    'all', 'listings.edit', 'listings.import', 'claims.review', 'reports.review',
    'taxonomy.edit', 'seo.edit', 'staff.manage', 'billing.manage', 'audit.view'
  ]::text[])
);

create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role_id bigint not null references public.roles (id) on delete restrict,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index staff_role_id_idx on public.staff (role_id);
create index staff_invited_by_idx on public.staff (invited_by);

create function private.has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff s
    join public.roles r on r.id = s.role_id
    where s.user_id = (select auth.uid())
      and ('all' = any (r.permissions) or perm = any (r.permissions))
  );
$$;

create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------

create table public.import_batches (
  id bigint generated always as identity primary key,
  created_by uuid references auth.users (id) on delete set null,
  filename text not null,
  status text not null default 'committed' check (status in ('committed', 'undone')),
  counts jsonb not null default '{}',
  created_at timestamptz not null default now(),
  undone_at timestamptz
);
create index import_batches_created_by_idx on public.import_batches (created_by);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) > 0),
  status text not null default 'active'
    check (status in ('active', 'closed', 'hidden', 'archived')),
  area_id bigint references public.areas (id) on delete set null,
  address text,
  postcode text check (postcode is null or postcode ~ '^[0-9]{5}$'),
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  -- E.164 without the plus sign, e.g. 60123456789. WhatsApp links use it as is.
  phone text check (phone is null or phone ~ '^60[0-9]{8,10}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^60[0-9]{8,10}$'),
  phone_verified_at timestamptz,
  website text,
  instagram text,
  facebook text,
  description text,
  price_level smallint check (price_level between 1 and 4),
  gender text check (gender in ('men', 'women', 'unisex')),
  google_place_id text unique,
  source text not null default 'manual'
    check (source in ('manual', 'owner', 'import', 'open_data')),
  import_batch_id bigint references public.import_batches (id) on delete set null,
  last_verified_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) stored
);
create index listings_area_id_idx on public.listings (area_id) where status = 'active';
create index listings_search_idx on public.listings using gin (search);
create index listings_name_trgm_idx on public.listings using gin (name extensions.gin_trgm_ops);
create index listings_phone_idx on public.listings (phone);
create index listings_import_batch_id_idx on public.listings (import_batch_id);
create index listings_created_by_idx on public.listings (created_by);

-- What each import did to each listing, so a whole batch can be undone.
create table public.import_batch_rows (
  batch_id bigint not null references public.import_batches (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  action text not null check (action in ('created', 'updated')),
  before jsonb,
  primary key (batch_id, listing_id)
);
create index import_batch_rows_listing_id_idx on public.import_batch_rows (listing_id);

create table public.listing_categories (
  listing_id uuid not null references public.listings (id) on delete cascade,
  category_id bigint not null references public.categories (id) on delete cascade,
  is_primary boolean not null default false,
  primary key (listing_id, category_id)
);
create index listing_categories_category_id_idx on public.listing_categories (category_id);
create unique index listing_categories_one_primary_idx
  on public.listing_categories (listing_id) where is_primary;

create table public.listing_attributes (
  listing_id uuid not null references public.listings (id) on delete cascade,
  attribute_id bigint not null references public.attributes (id) on delete cascade,
  primary key (listing_id, attribute_id)
);
create index listing_attributes_attribute_id_idx on public.listing_attributes (attribute_id);

create table public.listing_members (
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'manager')),
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);
create index listing_members_user_id_idx on public.listing_members (user_id);

create function private.is_listing_member(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.listing_members
    where listing_id = p_listing_id and user_id = (select auth.uid())
  );
$$;

-- Whether a listing has an owner. Public, but the members themselves are not.
create function private.is_claimed(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.listing_members where listing_id = p_listing_id);
$$;

create table public.services (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  name text not null,
  price_from numeric(10, 2) check (price_from >= 0),
  price_to numeric(10, 2),
  duration_min int check (duration_min > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check (price_to is null or price_from is null or price_to >= price_from)
);
create index services_listing_id_idx on public.services (listing_id);

-- Several rows per weekday allow lunch and Friday prayer breaks.
-- closes <= opens means the slot runs past midnight.
create table public.opening_hours (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  opens time not null,
  closes time not null
);
create index opening_hours_listing_id_idx on public.opening_hours (listing_id, weekday);

create table public.closures (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  date_from date not null,
  date_to date not null,
  note text,
  check (date_to >= date_from)
);
create index closures_listing_id_idx on public.closures (listing_id, date_to);

create table public.photos (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null unique,
  alt text,
  source text not null check (source in ('owner', 'staff', 'stock')),
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  sort_order int not null default 0,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index photos_listing_id_idx on public.photos (listing_id, sort_order);
create index photos_uploaded_by_idx on public.photos (uploaded_by);

create table public.redirects (
  from_path text primary key check (from_path like '/%'),
  to_path text not null check (to_path like '/%'),
  created_at timestamptz not null default now()
);

-- Google Places is used for discovery only: we keep place IDs so data entry
-- staff know which shops to collect, and nothing else from Google.
create table public.discovery_queue (
  google_place_id text primary key,
  search_term text not null,
  cell text not null,
  status text not null default 'new' check (status in ('new', 'collected', 'skipped')),
  listing_id uuid references public.listings (id) on delete set null,
  assigned_to uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index discovery_queue_status_idx on public.discovery_queue (status, created_at);
create index discovery_queue_listing_id_idx on public.discovery_queue (listing_id);
create index discovery_queue_assigned_to_idx on public.discovery_queue (assigned_to);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  phone text check (phone is null or phone ~ '^60[0-9]{8,10}$'),
  preferred_lang text not null default 'en' check (preferred_lang in ('en', 'ms', 'zh')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.favourites (
  user_id uuid not null references auth.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index favourites_listing_id_idx on public.favourites (listing_id);

create table public.notes (
  user_id uuid not null references auth.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  body text not null check (length(body) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index notes_listing_id_idx on public.notes (listing_id);

create table public.search_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  query text,
  category_slug text,
  area_slug text,
  created_at timestamptz not null default now()
);
create index search_history_user_id_idx on public.search_history (user_id, created_at desc);

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  short_code text not null unique check (short_code ~ '^[A-Za-z0-9]{6,10}$'),
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  service_id bigint references public.services (id) on delete set null,
  service_name text not null,
  preferred_at timestamptz,
  customer_name text not null,
  customer_phone text check (customer_phone is null or customer_phone ~ '^60[0-9]{8,10}$'),
  note text check (length(note) <= 500),
  status text not null default 'sent'
    check (status in ('sent', 'confirmed', 'declined', 'no_show', 'completed')),
  -- Salted hash of the sender's IP, for rate limiting. Never the IP itself.
  client_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index booking_requests_listing_id_idx on public.booking_requests (listing_id, created_at desc);
create index booking_requests_user_id_idx on public.booking_requests (user_id, created_at desc);
create index booking_requests_service_id_idx on public.booking_requests (service_id);
create index booking_requests_client_hash_idx on public.booking_requests (client_hash, created_at desc);

-- ---------------------------------------------------------------------------
-- Claims, reports, audit
-- ---------------------------------------------------------------------------

create table public.claims (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  method text not null check (method in ('otp', 'document')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired')),
  evidence_path text,
  note text check (length(note) <= 1000),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index claims_listing_id_idx on public.claims (listing_id);
create index claims_user_id_idx on public.claims (user_id);
create index claims_reviewed_by_idx on public.claims (reviewed_by);
create index claims_pending_idx on public.claims (created_at) where status = 'pending';
create unique index claims_one_pending_per_user_idx
  on public.claims (listing_id, user_id) where status = 'pending';

-- One-time codes live apart from claims so claimants can never read the hash.
-- No policies: only the service role touches this table.
create table public.claim_codes (
  claim_id bigint primary key references public.claims (id) on delete cascade,
  code_hash text not null,
  phone text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create table public.reports (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  reason text not null
    check (reason in ('closed', 'wrong_phone', 'wrong_info', 'removal_request', 'other')),
  details text check (length(details) <= 2000),
  contact text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_listing_id_idx on public.reports (listing_id);
create index reports_user_id_idx on public.reports (user_id);
create index reports_resolved_by_idx on public.reports (resolved_by);
create index reports_open_idx on public.reports (created_at) where status = 'open';

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('insert', 'update', 'delete')),
  table_name text not null,
  record_id text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_record_idx on public.audit_log (table_name, record_id, created_at desc);
create index audit_log_actor_id_idx on public.audit_log (actor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger listings_touch before update on public.listings
  for each row execute function private.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger booking_requests_touch before update on public.booking_requests
  for each row execute function private.touch_updated_at();
create trigger discovery_queue_touch before update on public.discovery_queue
  for each row execute function private.touch_updated_at();

-- Owners may edit their own listing, but only the fields they control.
-- Name, location, status and the verified phone stay with staff; a phone
-- change goes through the server, which re-verifies the new number.
create function private.guard_listing_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or (select private.has_permission('listings.edit')) then
    return new;
  end if;
  if new.slug is distinct from old.slug
    or new.name is distinct from old.name
    or new.status is distinct from old.status
    or new.area_id is distinct from old.area_id
    or new.lat is distinct from old.lat
    or new.lng is distinct from old.lng
    or new.phone is distinct from old.phone
    or new.whatsapp is distinct from old.whatsapp
    or new.phone_verified_at is distinct from old.phone_verified_at
    or new.google_place_id is distinct from old.google_place_id
    or new.source is distinct from old.source
    or new.import_batch_id is distinct from old.import_batch_id
    or new.last_verified_at is distinct from old.last_verified_at
    or new.created_by is distinct from old.created_by
  then
    raise exception 'Only BeautyBook staff can change this field'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger listings_guard before update on public.listings
  for each row execute function private.guard_listing_update();

-- Only an existing owner-role staff member can hand out the owner role.
create function private.guard_staff_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  owner_role_id bigint;
begin
  if (select auth.uid()) is null then
    return coalesce(new, old);
  end if;
  select id into owner_role_id from public.roles where slug = 'owner';
  if (tg_op <> 'DELETE' and new.role_id = owner_role_id)
    or (tg_op <> 'INSERT' and old.role_id = owner_role_id)
  then
    if not exists (
      select 1 from public.staff
      where user_id = (select auth.uid()) and role_id = owner_role_id
    ) then
      raise exception 'Only an Owner can grant or remove the Owner role'
        using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' and old.user_id = (select auth.uid()) then
    raise exception 'You cannot remove yourself' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger staff_guard before insert or update or delete on public.staff
  for each row execute function private.guard_staff_change();

create function private.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (actor_id, action, table_name, record_id, before, after)
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce(rec ->> 'id', rec ->> 'listing_id', rec ->> 'user_id', rec ->> 'slug', ''),
    case when tg_op <> 'INSERT' then to_jsonb(old) - 'search' end,
    case when tg_op <> 'DELETE' then to_jsonb(new) - 'search' end
  );
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'listings', 'listing_categories', 'listing_attributes', 'listing_members',
    'services', 'opening_hours', 'closures', 'photos', 'claims', 'reports',
    'staff', 'roles', 'categories', 'areas', 'attributes', 'redirects'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function private.write_audit_log()',
      t || '_audit', t
    );
  end loop;
end;
$$;

create function private.handle_new_user()
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
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Read functions (security invoker: RLS still applies)
-- ---------------------------------------------------------------------------

-- An area and everything under it, e.g. 'selangor' -> PJ, Subang, ...
create function public.area_tree(p_slug text)
returns setof bigint
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive tree as (
    select id from public.areas where slug = p_slug
    union all
    select a.id from public.areas a join tree t on a.parent_id = t.id
  )
  select id from tree;
$$;

create function public.is_open_at(p_listing_id uuid, p_at timestamptz)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  with local as (
    select (p_at at time zone 'Asia/Kuala_Lumpur') as ts
  )
  select
    not exists (
      select 1 from public.closures c, local
      where c.listing_id = p_listing_id and local.ts::date between c.date_from and c.date_to
    )
    and exists (
      select 1 from public.opening_hours h, local
      where h.listing_id = p_listing_id
        and (
          -- same-day slot
          (h.weekday = extract(dow from local.ts) and h.opens < h.closes
            and local.ts::time >= h.opens and local.ts::time < h.closes)
          -- overnight slot that started today
          or (h.weekday = extract(dow from local.ts) and h.closes <= h.opens
            and local.ts::time >= h.opens)
          -- overnight slot that started yesterday
          or (h.weekday = (extract(dow from local.ts)::int + 6) % 7 and h.closes <= h.opens
            and local.ts::time < h.closes)
        )
    );
$$;

create function public.search_listings(
  p_query text default null,
  p_category text default null,
  p_area text default null,
  p_attributes text[] default null,
  p_gender text default null,
  p_open_now boolean default false,
  p_limit int default 24,
  p_offset int default 0
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
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with matched as (
    select l.*
    from public.listings l
    where l.status = 'active'
      and (p_area is null or l.area_id in (select public.area_tree(p_area)))
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
        or p_query operator(extensions.<%) l.name)
      and (not p_open_now or public.is_open_at(l.id, now()))
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
       order by p.sort_order, p.id limit 1),
    count(*) over ()
  from matched m
  left join public.areas a on a.id = m.area_id
  order by
    case when p_query is null or p_query = '' then 0
      else ts_rank(m.search, websearch_to_tsquery('simple', p_query))
        + extensions.word_similarity(p_query, m.name) end desc,
    m.last_verified_at desc nulls last,
    m.name
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

-- Shop counts per area, per area + category (category_slug null = all
-- categories). A listing sits in exactly one area, so counts for an area tree
-- are the sum over its areas. Hub pages with fewer than 3 shops stay out of
-- the sitemap and get noindex.
create function public.hub_counts()
returns table (area_slug text, category_slug text, listing_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.slug, c.slug, count(distinct l.id)
  from public.listings l
  join public.areas a on a.id = l.area_id
  left join public.listing_categories lc on lc.listing_id = l.id
  left join public.categories c on c.id = lc.category_id
  where l.status = 'active'
  group by grouping sets ((a.slug, c.slug), (a.slug))
  having grouping(c.slug) = 1 or c.slug is not null;
$$;

-- Facts for the opening line of a hub page ("12 barbershops in Bangsar,
-- haircuts from RM15 to RM40, last checked Oct 2026").
create function public.hub_stats(p_area text, p_category text default null)
returns table (
  listing_count bigint,
  min_price numeric,
  max_price numeric,
  priced_count bigint,
  open_late_count bigint,
  last_verified_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with scoped as (
    select l.id, l.last_verified_at
    from public.listings l
    where l.status = 'active'
      and l.area_id in (select public.area_tree(p_area))
      and (p_category is null or exists (
        select 1 from public.listing_categories lc
        join public.categories c on c.id = lc.category_id
        where lc.listing_id = l.id and c.slug = p_category
      ))
  )
  select
    (select count(*) from scoped),
    (select min(s.price_from) from public.services s where s.listing_id in (select id from scoped)),
    (select max(coalesce(s.price_to, s.price_from)) from public.services s where s.listing_id in (select id from scoped)),
    (select count(distinct s.listing_id) from public.services s
       where s.listing_id in (select id from scoped) and s.price_from is not null),
    (select count(distinct h.listing_id) from public.opening_hours h
       where h.listing_id in (select id from scoped) and (h.closes >= '21:00' or h.closes <= h.opens)),
    (select max(last_verified_at) from scoped);
$$;

create function public.listing_is_claimed(p_listing_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_claimed(p_listing_id);
$$;

-- Enquiry counts for owners and staff (members only see their own listings
-- because booking_requests RLS applies).
create function public.listing_enquiry_count(p_listing_id uuid, p_since timestamptz)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*) from public.booking_requests
  where listing_id = p_listing_id and created_at >= p_since;
$$;

-- Looks up a user by email for staff invites. Service role only: the server
-- checks staff.manage before calling it.
create function private.user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

create function public.staff_user_id_by_email(p_email text)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select private.user_id_by_email(p_email);
$$;
revoke execute on function public.staff_user_id_by_email(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.areas enable row level security;
alter table public.categories enable row level security;
alter table public.attributes enable row level security;
alter table public.service_templates enable row level security;
alter table public.roles enable row level security;
alter table public.staff enable row level security;
alter table public.import_batches enable row level security;
alter table public.listings enable row level security;
alter table public.import_batch_rows enable row level security;
alter table public.listing_categories enable row level security;
alter table public.listing_attributes enable row level security;
alter table public.listing_members enable row level security;
alter table public.services enable row level security;
alter table public.opening_hours enable row level security;
alter table public.closures enable row level security;
alter table public.photos enable row level security;
alter table public.redirects enable row level security;
alter table public.discovery_queue enable row level security;
alter table public.profiles enable row level security;
alter table public.favourites enable row level security;
alter table public.notes enable row level security;
alter table public.search_history enable row level security;
alter table public.booking_requests enable row level security;
alter table public.claims enable row level security;
alter table public.claim_codes enable row level security;
alter table public.reports enable row level security;
alter table public.audit_log enable row level security;

-- Taxonomy: public read, staff with taxonomy.edit write.
create policy "taxonomy readable" on public.areas for select to anon, authenticated using (true);
create policy "taxonomy writable" on public.areas for all to authenticated
  using ((select private.has_permission('taxonomy.edit')))
  with check ((select private.has_permission('taxonomy.edit')));
create policy "taxonomy readable" on public.categories for select to anon, authenticated using (true);
create policy "taxonomy writable" on public.categories for all to authenticated
  using ((select private.has_permission('taxonomy.edit')))
  with check ((select private.has_permission('taxonomy.edit')));
create policy "taxonomy readable" on public.attributes for select to anon, authenticated using (true);
create policy "taxonomy writable" on public.attributes for all to authenticated
  using ((select private.has_permission('taxonomy.edit')))
  with check ((select private.has_permission('taxonomy.edit')));
create policy "taxonomy readable" on public.service_templates for select to anon, authenticated using (true);
create policy "taxonomy writable" on public.service_templates for all to authenticated
  using ((select private.has_permission('taxonomy.edit')))
  with check ((select private.has_permission('taxonomy.edit')));

-- Roles and staff: visible to staff, managed by staff.manage.
create policy "staff read roles" on public.roles for select to authenticated
  using ((select private.is_staff()));
create policy "manage roles" on public.roles for all to authenticated
  using ((select private.has_permission('staff.manage')) and not is_system)
  with check ((select private.has_permission('staff.manage')) and not is_system);
create policy "staff read staff" on public.staff for select to authenticated
  using ((select private.is_staff()));
create policy "manage staff" on public.staff for all to authenticated
  using ((select private.has_permission('staff.manage')))
  with check ((select private.has_permission('staff.manage')));

create policy "importers read batches" on public.import_batches for select to authenticated
  using ((select private.has_permission('listings.import')));
create policy "importers write batches" on public.import_batches for all to authenticated
  using ((select private.has_permission('listings.import')))
  with check ((select private.has_permission('listings.import')));
create policy "importers use batch rows" on public.import_batch_rows for all to authenticated
  using ((select private.has_permission('listings.import')))
  with check ((select private.has_permission('listings.import')));

-- Listings: active ones are public; members and editors see the rest.
create policy "read listings" on public.listings for select to anon, authenticated
  using (
    status = 'active'
    or (select private.has_permission('listings.edit'))
    or (select private.is_listing_member(id))
  );
create policy "editors insert listings" on public.listings for insert to authenticated
  with check ((select private.has_permission('listings.edit')));
create policy "members and editors update listings" on public.listings for update to authenticated
  using ((select private.has_permission('listings.edit')) or (select private.is_listing_member(id)))
  with check ((select private.has_permission('listings.edit')) or (select private.is_listing_member(id)));
create policy "editors delete listings" on public.listings for delete to authenticated
  using ((select private.has_permission('listings.edit')));

-- Child tables of a listing: public read, members and editors write.
do $$
declare
  t text;
begin
  foreach t in array array['services', 'opening_hours', 'closures', 'listing_attributes'] loop
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

create policy "public read" on public.listing_categories for select to anon, authenticated using (true);
create policy "editors write" on public.listing_categories for all to authenticated
  using ((select private.has_permission('listings.edit')))
  with check ((select private.has_permission('listings.edit')));

create policy "read approved photos" on public.photos for select to anon, authenticated
  using (
    status = 'approved'
    or (select private.has_permission('listings.edit'))
    or (select private.is_listing_member(listing_id))
  );
create policy "members add photos" on public.photos for insert to authenticated
  with check (
    (select private.has_permission('listings.edit'))
    or ((select private.is_listing_member(listing_id)) and source = 'owner'
        and uploaded_by = (select auth.uid()))
  );
create policy "members and editors update photos" on public.photos for update to authenticated
  using ((select private.has_permission('listings.edit')) or (select private.is_listing_member(listing_id)))
  with check ((select private.has_permission('listings.edit')) or (select private.is_listing_member(listing_id)));
create policy "members and editors delete photos" on public.photos for delete to authenticated
  using ((select private.has_permission('listings.edit')) or (select private.is_listing_member(listing_id)));

create policy "read own memberships" on public.listing_members for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_permission('claims.review')));
create policy "reviewers manage memberships" on public.listing_members for all to authenticated
  using ((select private.has_permission('claims.review')))
  with check ((select private.has_permission('claims.review')));

create policy "public read" on public.redirects for select to anon, authenticated using (true);
create policy "seo editors write" on public.redirects for all to authenticated
  using ((select private.has_permission('seo.edit')))
  with check ((select private.has_permission('seo.edit')));

create policy "editors use queue" on public.discovery_queue for all to authenticated
  using ((select private.has_permission('listings.edit')))
  with check ((select private.has_permission('listings.edit')));

-- Customer data: own rows only.
create policy "own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "own favourites" on public.favourites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own notes" on public.notes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own search history" on public.search_history for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Booking requests are created by the server (rate limited and captcha
-- checked). Customers see their own; owners see and update their shop's.
create policy "read booking requests" on public.booking_requests for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_listing_member(listing_id))
    or (select private.has_permission('listings.edit'))
  );
create policy "members update booking status" on public.booking_requests for update to authenticated
  using ((select private.is_listing_member(listing_id)))
  with check ((select private.is_listing_member(listing_id)));

-- Claims are created and approved by the server; claimants can read theirs.
create policy "read claims" on public.claims for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_permission('claims.review')));
create policy "reviewers update claims" on public.claims for update to authenticated
  using ((select private.has_permission('claims.review')))
  with check ((select private.has_permission('claims.review')));

create policy "reviewers read reports" on public.reports for select to authenticated
  using ((select private.has_permission('reports.review')));
create policy "reviewers update reports" on public.reports for update to authenticated
  using ((select private.has_permission('reports.review')))
  with check ((select private.has_permission('reports.review')));

create policy "auditors read log" on public.audit_log for select to authenticated
  using ((select private.has_permission('audit.view')));

-- ---------------------------------------------------------------------------
-- Grants. Tables are exposed explicitly; RLS decides which rows.
-- ---------------------------------------------------------------------------

-- Supabase grants everything on new public tables by default. Start from
-- nothing so column-level grants (booking_requests.status) actually bite.
revoke all on all tables in schema public from anon, authenticated;

grant usage on schema private to anon, authenticated, service_role;
revoke execute on all functions in schema private from public, anon, authenticated;
-- The service role (server-side writes) runs the same triggers.
grant execute on all functions in schema private to service_role;
grant execute on function public.staff_user_id_by_email(text) to service_role;
-- Policies call these helpers, so the roles evaluating policies need execute.
-- For anon, auth.uid() is null and they return false.
grant execute on function private.has_permission(text) to anon, authenticated;
grant execute on function private.is_listing_member(uuid) to anon, authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_claimed(uuid) to anon, authenticated;

grant select on public.areas, public.categories, public.attributes, public.service_templates,
  public.listings, public.listing_categories, public.listing_attributes, public.services,
  public.opening_hours, public.closures, public.photos, public.redirects
  to anon, authenticated;

grant insert, update, delete on public.areas, public.categories, public.attributes,
  public.service_templates, public.listings, public.listing_categories,
  public.listing_attributes, public.services, public.opening_hours, public.closures,
  public.photos, public.redirects
  to authenticated;

grant select, insert, update, delete on public.roles, public.staff, public.import_batches, public.import_batch_rows,
  public.discovery_queue, public.favourites, public.notes, public.search_history
  to authenticated;
grant select, update on public.profiles, public.claims, public.reports to authenticated;
grant select on public.listing_members, public.audit_log to authenticated;
grant insert, update, delete on public.listing_members to authenticated;
grant select (id, short_code, listing_id, user_id, service_id, service_name, preferred_at,
  customer_name, customer_phone, note, status, created_at, updated_at)
  on public.booking_requests to authenticated;
-- Owners may only move a request's status.
grant update (status) on public.booking_requests to authenticated;

grant execute on function public.area_tree(text), public.is_open_at(uuid, timestamptz),
  public.search_listings(text, text, text, text[], text, boolean, int, int),
  public.hub_counts(), public.listing_is_claimed(uuid), public.hub_stats(text, text)
  to anon, authenticated;
grant execute on function public.listing_enquiry_count(uuid, timestamptz) to authenticated;
revoke execute on function public.listing_enquiry_count(uuid, timestamptz) from public, anon;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-photos', 'listing-photos', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp']),
  ('claim-evidence', 'claim-evidence', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- listing-photos/<listing_id>/<file>. The bucket is public for reading by
-- URL; this select policy lets members list and delete their own files.
create policy "members read listing photos" on storage.objects for select to authenticated
  using (
    bucket_id = 'listing-photos'
    and (
      (select private.has_permission('listings.edit'))
      or (select private.is_listing_member(((storage.foldername(name))[1])::uuid))
    )
  );
create policy "members upload listing photos" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (
      (select private.has_permission('listings.edit'))
      or (select private.is_listing_member(((storage.foldername(name))[1])::uuid))
    )
  );
create policy "members manage listing photos" on storage.objects for update to authenticated
  using (
    bucket_id = 'listing-photos'
    and (
      (select private.has_permission('listings.edit'))
      or (select private.is_listing_member(((storage.foldername(name))[1])::uuid))
    )
  );
create policy "members delete listing photos" on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and (
      (select private.has_permission('listings.edit'))
      or (select private.is_listing_member(((storage.foldername(name))[1])::uuid))
    )
  );

-- claim-evidence/<user_id>/<file>
create policy "claimants upload evidence" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'claim-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "claimants and reviewers read evidence" on storage.objects for select to authenticated
  using (
    bucket_id = 'claim-evidence'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.has_permission('claims.review'))
    )
  );
