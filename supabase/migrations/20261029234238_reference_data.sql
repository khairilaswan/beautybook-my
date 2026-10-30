-- Reference data every environment needs: staff roles, categories,
-- attributes, Klang Valley areas and standard service menus.

insert into public.roles (slug, name, description, permissions, is_system) values
  ('owner', 'Owner', 'Everything, including billing and staff.', array['all'], true),
  ('admin', 'Admin', 'Everything except billing and the Owner role.',
    array['listings.edit', 'listings.import', 'claims.review', 'reports.review',
          'taxonomy.edit', 'seo.edit', 'staff.manage', 'audit.view'], false),
  ('editor', 'Editor', 'Listings, imports, categories and SEO fields.',
    array['listings.edit', 'listings.import', 'taxonomy.edit', 'seo.edit'], false),
  ('moderator', 'Moderator', 'Claims, visitor reports and removal requests.',
    array['claims.review', 'reports.review'], false),
  ('data-entry', 'Data entry', 'Adds and edits listings from the field.',
    array['listings.edit'], false);

insert into public.categories (slug, slug_ms, name_en, name_ms, name_zh, schema_type, sort_order) values
  ('barbershop', 'kedai-gunting-rambut', 'Barbershop', 'Kedai gunting rambut', '理发店', 'HairSalon', 10),
  ('hair-salon', 'salon-rambut', 'Hair salon', 'Salon rambut', '发廊', 'HairSalon', 20),
  ('beauty-facial', 'kecantikan-wajah', 'Beauty & facial', 'Kecantikan & rawatan wajah', '美容护肤', 'BeautySalon', 30),
  ('nails', 'salon-kuku', 'Nails', 'Salon kuku', '美甲', 'NailSalon', 40),
  ('lashes-brows', 'bulu-mata-kening', 'Lashes & brows', 'Bulu mata & kening', '睫毛与眉毛', 'BeautySalon', 50),
  ('bridal-makeup', 'mak-andam', 'Bridal makeup', 'Mak andam', '新娘化妆', 'HealthAndBeautyBusiness', 60),
  ('spa-massage', 'spa-urutan', 'Spa & massage', 'Spa & urutan', '水疗按摩', 'DaySpa', 70),
  ('waxing-threading', 'waxing-threading', 'Waxing & threading', 'Waxing & threading', '脱毛', 'BeautySalon', 80);

insert into public.attributes (slug, group_name, name_en, name_ms, sort_order) values
  ('muslimah-friendly', 'audience', 'Muslimah-friendly', 'Mesra Muslimah', 10),
  ('female-stylists', 'audience', 'Female stylists', 'Pendandan wanita', 20),
  ('private-room', 'audience', 'Private room', 'Bilik persendirian', 30),
  ('kids-friendly', 'audience', 'Kids welcome', 'Mesra kanak-kanak', 40),
  ('speaks-malay', 'language', 'Malay', 'Bahasa Melayu', 10),
  ('speaks-english', 'language', 'English', 'Bahasa Inggeris', 20),
  ('speaks-chinese', 'language', 'Chinese', 'Bahasa Cina', 30),
  ('speaks-tamil', 'language', 'Tamil', 'Bahasa Tamil', 40),
  ('halal-products', 'amenity', 'Halal products', 'Produk halal', 10),
  ('parking', 'amenity', 'Parking', 'Tempat letak kereta', 20),
  ('wheelchair-access', 'amenity', 'Wheelchair access', 'Akses kerusi roda', 30),
  ('home-service', 'service_mode', 'Home service', 'Servis ke rumah', 10),
  ('walk-in', 'service_mode', 'Walk-ins welcome', 'Boleh walk-in', 20),
  ('appointment-only', 'service_mode', 'Appointment only', 'Temu janji sahaja', 30);

-- Areas: Kuala Lumpur and Putrajaya are top-level cities; Selangor holds the
-- rest of Klang Valley. Coordinates are city centres, used for map defaults.
insert into public.areas (type, name, slug, lat, lng, sort_order) values
  ('city', 'Kuala Lumpur', 'kuala-lumpur', 3.1390, 101.6869, 10),
  ('state', 'Selangor', 'selangor', null, null, 20),
  ('city', 'Putrajaya', 'putrajaya', 2.9264, 101.6964, 30);

insert into public.areas (parent_id, type, name, slug, lat, lng, sort_order)
select (select id from public.areas where slug = 'selangor'), 'city', v.name, v.slug, v.lat, v.lng, v.sort_order
from (values
  ('Petaling Jaya', 'petaling-jaya', 3.1073, 101.6067, 10),
  ('Subang Jaya', 'subang-jaya', 3.0567, 101.5851, 20),
  ('Shah Alam', 'shah-alam', 3.0733, 101.5185, 30),
  ('Klang', 'klang', 3.0449, 101.4456, 40),
  ('Puchong', 'puchong', 3.0181, 101.6174, 50),
  ('Ampang', 'ampang', 3.1488, 101.7614, 60),
  ('Kajang', 'kajang', 2.9927, 101.7909, 70),
  ('Bangi', 'bangi', 2.9161, 101.7742, 80),
  ('Seri Kembangan', 'seri-kembangan', 3.0213, 101.7055, 90),
  ('Cyberjaya', 'cyberjaya', 2.9213, 101.6559, 100),
  ('Selayang', 'selayang', 3.2547, 101.6489, 110),
  ('Sungai Buloh', 'sungai-buloh', 3.2069, 101.5793, 120),
  ('Rawang', 'rawang', 3.3213, 101.5767, 130)
) as v (name, slug, lat, lng, sort_order);

insert into public.areas (parent_id, type, name, slug, sort_order)
select (select id from public.areas where slug = v.parent), 'area', v.name, v.slug, v.sort_order
from (values
  ('kuala-lumpur', 'Bangsar', 'bangsar', 10),
  ('kuala-lumpur', 'Mont Kiara', 'mont-kiara', 20),
  ('kuala-lumpur', 'Bukit Bintang', 'bukit-bintang', 30),
  ('kuala-lumpur', 'KLCC', 'klcc', 40),
  ('kuala-lumpur', 'Cheras', 'cheras', 50),
  ('kuala-lumpur', 'Kepong', 'kepong', 60),
  ('kuala-lumpur', 'Setapak', 'setapak', 70),
  ('kuala-lumpur', 'Wangsa Maju', 'wangsa-maju', 80),
  ('kuala-lumpur', 'Sri Petaling', 'sri-petaling', 90),
  ('kuala-lumpur', 'Bukit Jalil', 'bukit-jalil', 100),
  ('kuala-lumpur', 'Brickfields', 'brickfields', 110),
  ('kuala-lumpur', 'Sentul', 'sentul', 120),
  ('kuala-lumpur', 'Taman Tun Dr Ismail', 'ttdi', 130),
  ('kuala-lumpur', 'Desa ParkCity', 'desa-parkcity', 140),
  ('kuala-lumpur', 'Kuchai Lama', 'kuchai-lama', 150),
  ('kuala-lumpur', 'Old Klang Road', 'old-klang-road', 160),
  ('petaling-jaya', 'SS2', 'ss2', 10),
  ('petaling-jaya', 'Damansara Jaya', 'damansara-jaya', 20),
  ('petaling-jaya', 'Bandar Utama', 'bandar-utama', 30),
  ('petaling-jaya', 'Kota Damansara', 'kota-damansara', 40),
  ('petaling-jaya', 'Ara Damansara', 'ara-damansara', 50),
  ('petaling-jaya', 'Kelana Jaya', 'kelana-jaya', 60),
  ('subang-jaya', 'USJ', 'usj', 10),
  ('subang-jaya', 'SS15', 'ss15', 20),
  ('shah-alam', 'Setia Alam', 'setia-alam', 10)
) as v (parent, name, slug, sort_order);

-- Standard menus. Prices are left empty on purpose: unclaimed listings show
-- "Ask for price" rather than numbers nobody has checked.
insert into public.service_templates (category_id, name_en, name_ms, duration_min, sort_order)
select c.id, v.name_en, v.name_ms, v.duration_min, v.sort_order
from (values
  ('barbershop', 'Haircut', 'Gunting rambut', 30, 10),
  ('barbershop', 'Haircut + wash', 'Gunting + cuci', 45, 20),
  ('barbershop', 'Shave / beard trim', 'Cukur / rapi janggut', 20, 30),
  ('barbershop', 'Kids haircut', 'Gunting rambut kanak-kanak', 20, 40),
  ('hair-salon', 'Haircut', 'Gunting rambut', 45, 10),
  ('hair-salon', 'Hair colour', 'Warna rambut', 120, 20),
  ('hair-salon', 'Rebonding / straightening', 'Rebonding', 180, 30),
  ('hair-salon', 'Hair treatment', 'Rawatan rambut', 60, 40),
  ('beauty-facial', 'Facial', 'Facial', 60, 10),
  ('beauty-facial', 'Acne treatment', 'Rawatan jerawat', 60, 20),
  ('nails', 'Manicure', 'Manikur', 45, 10),
  ('nails', 'Pedicure', 'Pedikur', 60, 20),
  ('nails', 'Gel nails', 'Kuku gel', 60, 30),
  ('lashes-brows', 'Eyelash extensions', 'Sambung bulu mata', 90, 10),
  ('lashes-brows', 'Brow shaping', 'Bentuk kening', 30, 20),
  ('bridal-makeup', 'Bridal makeup (solemnisation)', 'Solek pengantin (akad nikah)', 120, 10),
  ('bridal-makeup', 'Bridal makeup (reception)', 'Solek pengantin (bersanding)', 150, 20),
  ('bridal-makeup', 'Event makeup', 'Solekan majlis', 60, 30),
  ('spa-massage', 'Full body massage', 'Urutan badan penuh', 60, 10),
  ('spa-massage', 'Foot reflexology', 'Refleksologi kaki', 45, 20),
  ('waxing-threading', 'Eyebrow threading', 'Threading kening', 15, 10),
  ('waxing-threading', 'Waxing', 'Waxing', 30, 20)
) as v (category, name_en, name_ms, duration_min, sort_order)
join public.categories c on c.slug = v.category;
