-- Shop media: a profile photo, one short video and team photos.
--
-- Profile photo: the owner picks one of their shop photos. It becomes the
-- shop's first photo (lowest sort_order), which search_listings already uses
-- as the card cover, so no search change is needed.
--
-- Team photos: photos.kind gains 'team' (group shots of the people who work
-- there). The app gives them a sort_order above 1,000,000,000 so a shop photo
-- always wins the cover when there is one.
--
-- Video: listings.video_path points at listing-videos/<listing_id>/<file>.

alter table public.photos drop constraint photos_kind_check;
alter table public.photos
  add constraint photos_kind_check check (kind in ('shop', 'portfolio', 'team'));

alter table public.listings
  add column video_path text
    check (video_path is null or (length(video_path) <= 200 and video_path like id::text || '/%'));

-- 30 MB is about a minute of phone video at 1080p. Public for playback;
-- writes are limited to members of the listing, like listing-photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-videos', 'listing-videos', true, 31457280,
    array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

create policy "members read listing videos" on storage.objects for select to authenticated
  using (
    bucket_id = 'listing-videos'
    and (
      (select private.has_permission('listings.edit'))
      or (select private.is_listing_member(((storage.foldername(name))[1])::uuid))
    )
  );
create policy "members upload listing videos" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-videos'
    and (
      (select private.has_permission('listings.edit'))
      or (select private.is_listing_member(((storage.foldername(name))[1])::uuid))
    )
  );
create policy "members manage listing videos" on storage.objects for update to authenticated
  using (
    bucket_id = 'listing-videos'
    and (
      (select private.has_permission('listings.edit'))
      or (select private.is_listing_member(((storage.foldername(name))[1])::uuid))
    )
  );
create policy "members delete listing videos" on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-videos'
    and (
      (select private.has_permission('listings.edit'))
      or (select private.is_listing_member(((storage.foldername(name))[1])::uuid))
    )
  );
