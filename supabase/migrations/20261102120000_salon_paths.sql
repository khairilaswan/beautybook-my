-- Listing pages moved from /shop/<slug> to /salon/<slug>. The app 301s any
-- /shop/ URL to /salon/, and slug-rename redirects are now looked up by the
-- /salon/ path, so rewrite stored redirects to match.
update public.redirects
set from_path = '/salon/' || substr(from_path, 7)
where from_path like '/shop/%'
  and not exists (
    select 1 from public.redirects r2 where r2.from_path = '/salon/' || substr(public.redirects.from_path, 7)
  );

update public.redirects
set to_path = '/salon/' || substr(to_path, 7)
where to_path like '/shop/%';
