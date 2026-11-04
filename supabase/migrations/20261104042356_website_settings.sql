-- Public website content; existing manager-only RLS and audit trigger apply.
alter table public.site_settings add column website jsonb not null default '{}'::jsonb
  check (jsonb_typeof(website) = 'object' and octet_length(website::text) < 65536);
grant update (website) on public.site_settings to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 2097152,
  array['image/png','image/jpeg','image/webp','image/x-icon'])
on conflict (id) do nothing;

create policy "managers read site media" on storage.objects for select to authenticated
using (bucket_id = 'site-media' and (select private.has_permission('staff.manage')));
create policy "managers upload site media" on storage.objects for insert to authenticated
with check (bucket_id = 'site-media' and (select private.has_permission('staff.manage')));
create policy "managers remove site media" on storage.objects for delete to authenticated
using (bucket_id = 'site-media' and (select private.has_permission('staff.manage')));

