-- Local development only: a handful of made-up shops so pages have content.
-- `supabase db reset` runs this; production never does.

insert into public.listings (id, slug, name, area_id, address, postcode, lat, lng, phone, whatsapp,
  description, price_level, gender, source, last_verified_at)
values
  ('00000000-0000-4000-8000-000000000001', 'demo-barber-bangsar', 'Demo Barber Bangsar',
    (select id from public.areas where slug = 'bangsar'), '1 Jalan Demo, Bangsar', '59100',
    3.1300, 101.6710, '60123456701', '60123456701',
    'Made-up barbershop for local development.', 1, 'men', 'manual', now()),
  ('00000000-0000-4000-8000-000000000002', 'demo-salon-ss2', 'Demo Hair Salon SS2',
    (select id from public.areas where slug = 'ss2'), '2 Jalan Demo, SS2', '47300',
    3.1180, 101.6220, '60123456702', '60123456702',
    'Made-up hair salon with a Muslimah-friendly private room.', 2, 'women', 'manual', now()),
  ('00000000-0000-4000-8000-000000000003', 'demo-nails-subang', 'Demo Nails Subang',
    (select id from public.areas where slug = 'ss15'), '3 Jalan Demo, SS15', '47500',
    3.0750, 101.5880, '60123456703', null,
    'Made-up nail salon.', 2, 'unisex', 'manual', now());

insert into public.listing_categories (listing_id, category_id, is_primary)
select v.listing_id::uuid, c.id, v.is_primary
from (values
  ('00000000-0000-4000-8000-000000000001', 'barbershop', true),
  ('00000000-0000-4000-8000-000000000002', 'hair-salon', true),
  ('00000000-0000-4000-8000-000000000002', 'beauty-facial', false),
  ('00000000-0000-4000-8000-000000000003', 'nails', true)
) as v (listing_id, category, is_primary)
join public.categories c on c.slug = v.category;

insert into public.listing_attributes (listing_id, attribute_id)
select v.listing_id::uuid, a.id
from (values
  ('00000000-0000-4000-8000-000000000001', 'walk-in'),
  ('00000000-0000-4000-8000-000000000001', 'speaks-malay'),
  ('00000000-0000-4000-8000-000000000002', 'muslimah-friendly'),
  ('00000000-0000-4000-8000-000000000002', 'private-room'),
  ('00000000-0000-4000-8000-000000000002', 'female-stylists'),
  ('00000000-0000-4000-8000-000000000003', 'appointment-only')
) as v (listing_id, attribute)
join public.attributes a on a.slug = v.attribute;

insert into public.services (listing_id, name, price_from, price_to, duration_min, sort_order) values
  ('00000000-0000-4000-8000-000000000001', 'Haircut', 18, null, 30, 10),
  ('00000000-0000-4000-8000-000000000001', 'Haircut + wash', 25, null, 45, 20),
  ('00000000-0000-4000-8000-000000000002', 'Women''s haircut', 45, 90, 60, 10),
  ('00000000-0000-4000-8000-000000000002', 'Hair colour', 150, 350, 120, 20);

-- Demo hours: 10:00-21:00 daily, with a Friday prayer break at the salon.
insert into public.opening_hours (listing_id, weekday, opens, closes)
select l.id, d.weekday, '10:00', '21:00'
from public.listings l cross join generate_series(0, 6) as d (weekday)
where l.slug in ('demo-barber-bangsar', 'demo-nails-subang');

insert into public.opening_hours (listing_id, weekday, opens, closes)
select '00000000-0000-4000-8000-000000000002', d.weekday, v.opens::time, v.closes::time
from generate_series(1, 6) as d (weekday)
cross join lateral (
  select * from (values ('10:00', '13:00'), ('14:30', '20:00')) as s (opens, closes)
  where d.weekday = 5
  union all
  select '10:00', '20:00' where d.weekday <> 5
) as v;
