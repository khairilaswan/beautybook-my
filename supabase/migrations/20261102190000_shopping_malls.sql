-- Shopping malls: an admin-managed list, a mall tag on each listing, a mall
-- filter in search and data for /mall/<slug> landing pages.

create table public.malls (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(name) between 1 and 120),
  area_id bigint references public.areas (id) on delete set null,
  address text check (length(address) <= 300),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  sort_order int not null default 1000,
  created_at timestamptz not null default now()
);
create index malls_area_id_idx on public.malls (area_id);

-- A shop sits in at most one mall. Owners may set it themselves, like the
-- description; guard_listing_update does not lock this column.
alter table public.listings
  add column mall_id bigint references public.malls (id) on delete set null;
create index listings_mall_id_idx on public.listings (mall_id) where mall_id is not null;

alter table public.malls enable row level security;
create policy "malls readable" on public.malls for select to anon, authenticated using (true);
create policy "malls writable" on public.malls for all to authenticated
  using ((select private.has_permission('taxonomy.edit')))
  with check ((select private.has_permission('taxonomy.edit')));
grant select on public.malls to anon, authenticated;
grant insert, update, delete on public.malls to authenticated;

create trigger malls_audit after insert or update or delete on public.malls
  for each row execute function private.write_audit_log();

-- Active shops per mall, for the mall pages, the mall index and the sitemap.
create function public.mall_counts()
returns table (mall_slug text, listing_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.slug, count(l.id)
  from public.malls m
  left join public.listings l on l.mall_id = m.id and l.status = 'active'
  group by m.slug;
$$;
grant execute on function public.mall_counts() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Popular Klang Valley malls. Areas are matched by slug; a mall whose area
-- is missing is still added, without an area. Coordinates are approximate
-- (mall centre) and can be corrected in /admin/taxonomy.
-- ---------------------------------------------------------------------------
insert into public.malls (slug, name, area_id, address, lat, lng, sort_order)
select v.slug, v.name, a.id, v.address, v.lat, v.lng, v.sort_order
from (values
  ('mid-valley-megamall', 'Mid Valley Megamall', 'bangsar', 'Lingkaran Syed Putra, Mid Valley City, 59200 Kuala Lumpur', 3.1179, 101.6773, 10),
  ('the-gardens-mall', 'The Gardens Mall', 'bangsar', 'Lingkaran Syed Putra, Mid Valley City, 59200 Kuala Lumpur', 3.1186, 101.6763, 20),
  ('pavilion-kuala-lumpur', 'Pavilion Kuala Lumpur', 'bukit-bintang', '168 Jalan Bukit Bintang, 55100 Kuala Lumpur', 3.1490, 101.7133, 30),
  ('suria-klcc', 'Suria KLCC', 'klcc', 'Kuala Lumpur City Centre, 50088 Kuala Lumpur', 3.1580, 101.7117, 40),
  ('the-exchange-trx', 'The Exchange TRX', 'bukit-bintang', 'Persiaran TRX, Tun Razak Exchange, 55188 Kuala Lumpur', 3.1424, 101.7193, 50),
  ('lot-10', 'Lot 10', 'bukit-bintang', '50 Jalan Sultan Ismail, 50250 Kuala Lumpur', 3.1463, 101.7121, 60),
  ('berjaya-times-square', 'Berjaya Times Square', 'bukit-bintang', '1 Jalan Imbi, 55100 Kuala Lumpur', 3.1424, 101.7106, 70),
  ('bangsar-shopping-centre', 'Bangsar Shopping Centre', 'bangsar', '285 Jalan Maarof, Bukit Bandaraya, 59000 Kuala Lumpur', 3.1436, 101.6655, 80),
  ('bangsar-village', 'Bangsar Village', 'bangsar', '1 Jalan Telawi 1, Bangsar Baru, 59100 Kuala Lumpur', 3.1302, 101.6710, 90),
  ('publika', 'Publika Shopping Gallery', 'mont-kiara', '1 Jalan Dutamas 1, Solaris Dutamas, 50480 Kuala Lumpur', 3.1708, 101.6658, 100),
  ('pavilion-bukit-jalil', 'Pavilion Bukit Jalil', 'bukit-jalil', '2 Persiaran Jalil 8, Bukit Jalil, 57000 Kuala Lumpur', 3.0496, 101.6727, 110),
  ('mytown-shopping-centre', 'MyTOWN Shopping Centre', 'cheras', '6 Jalan Cochrane, Seksyen 90, 55100 Kuala Lumpur', 3.1373, 101.7240, 120),
  ('sunway-velocity-mall', 'Sunway Velocity Mall', 'cheras', 'Lingkaran SV, Sunway Velocity, 55100 Kuala Lumpur', 3.1281, 101.7238, 130),
  ('nu-sentral', 'NU Sentral', 'brickfields', '201 Jalan Tun Sambanthan, 50470 Kuala Lumpur', 3.1325, 101.6870, 140),
  ('sunway-putra-mall', 'Sunway Putra Mall', 'kuala-lumpur', '100 Jalan Putra, 50350 Kuala Lumpur', 3.1667, 101.6928, 150),
  ('wangsa-walk-mall', 'Wangsa Walk Mall', 'wangsa-maju', 'Wangsa Avenue, 9 Jalan Wangsa Perdana 1, 53300 Kuala Lumpur', 3.2054, 101.7378, 160),
  ('sunway-pyramid', 'Sunway Pyramid', 'subang-jaya', '3 Jalan PJS 11/15, Bandar Sunway, 47500 Subang Jaya', 3.0731, 101.6075, 170),
  ('empire-shopping-gallery', 'Empire Shopping Gallery', 'subang-jaya', 'Jalan SS16/1, SS16, 47500 Subang Jaya', 3.0818, 101.5835, 180),
  ('subang-parade', 'Subang Parade', 'subang-jaya', '5 Jalan SS16/1, SS16, 47500 Subang Jaya', 3.0812, 101.5856, 190),
  ('main-place-mall', 'Main Place Mall', 'usj', 'Jalan USJ 21/10, USJ 21, 47630 Subang Jaya', 3.0299, 101.5879, 200),
  ('1-utama', '1 Utama Shopping Centre', 'bandar-utama', '1 Lebuh Bandar Utama, Bandar Utama, 47800 Petaling Jaya', 3.1503, 101.6152, 210),
  ('the-curve', 'The Curve', 'kota-damansara', '6 Jalan PJU 7/3, Mutiara Damansara, 47800 Petaling Jaya', 3.1578, 101.6118, 220),
  ('tropicana-gardens-mall', 'Tropicana Gardens Mall', 'kota-damansara', '2A Persiaran Surian, Tropicana Indah, 47810 Petaling Jaya', 3.1517, 101.5938, 230),
  ('atria-shopping-gallery', 'Atria Shopping Gallery', 'damansara-jaya', 'Jalan SS22/23, Damansara Jaya, 47400 Petaling Jaya', 3.1253, 101.6280, 240),
  ('starling-mall', 'The Starling Mall', 'damansara-jaya', '6 Jalan SS21/37, Damansara Uptown, 47400 Petaling Jaya', 3.1366, 101.6201, 250),
  ('paradigm-mall-petaling-jaya', 'Paradigm Mall Petaling Jaya', 'kelana-jaya', '1 Jalan SS7/26A, Kelana Jaya, 47301 Petaling Jaya', 3.1050, 101.5957, 260),
  ('ioi-mall-puchong', 'IOI Mall Puchong', 'puchong', 'Batu 9, Jalan Puchong, Bandar Puchong Jaya, 47100 Puchong', 3.0457, 101.6178, 270),
  ('ioi-city-mall', 'IOI City Mall', 'putrajaya', 'Lebuh IRC, IOI Resort City, 62502 Putrajaya', 2.9701, 101.7135, 280),
  ('setia-city-mall', 'Setia City Mall', 'setia-alam', '7 Persiaran Setia Dagang, Setia Alam, 40170 Shah Alam', 3.1060, 101.4620, 290),
  ('aeon-mall-shah-alam', 'AEON Mall Shah Alam', 'shah-alam', '1 Jalan Akuatik 13/64, Seksyen 13, 40100 Shah Alam', 3.0743, 101.5408, 300),
  ('aeon-mall-bukit-tinggi', 'AEON Mall Bukit Tinggi', 'klang', '1 Persiaran Batu Nilam 1/KS6, Bandar Bukit Tinggi 2, 41200 Klang', 3.0084, 101.4302, 310),
  ('dpulze-cyberjaya', 'DPULZE Shopping Centre', 'cyberjaya', 'Lingkaran Cyber Point Timur, Cyber 12, 63000 Cyberjaya', 2.9225, 101.6527, 320)
) as v (slug, name, area, address, lat, lng, sort_order)
left join public.areas a on a.slug = v.area
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- search_listings gains p_mall (a mall slug) and returns the mall's name.
-- ---------------------------------------------------------------------------
drop function public.search_listings(
  text, text, text, text[], text, boolean, int, int, boolean, numeric,
  double precision, double precision, double precision, text, text[]
);

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
  p_slugs text[] default null,
  p_mall text default null
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
  mall_name text,
  mall_slug text,
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
      and (p_mall is null or l.mall_id = (select ml.id from public.malls ml where ml.slug = p_mall))
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
                   where s.listing_id = l.id and s.name ilike '%' || p_query || '%')
        or exists (select 1 from public.malls ml
                   where ml.id = l.mall_id and ml.name ilike '%' || p_query || '%'))
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
    mall.name, mall.slug,
    count(*) over ()
  from scored m
  left join public.areas a on a.id = m.area_id
  left join public.malls mall on mall.id = m.mall_id
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
  double precision, double precision, double precision, text, text[], text
) to anon, authenticated;
