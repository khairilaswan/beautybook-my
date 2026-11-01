-- Site-wide settings, one row. For now: the theme (style + colour) chosen in
-- /admin/theme. Anyone can read it (every page needs it); only staff with
-- staff.manage can change it. The app checks values against src/lib/themes.ts
-- and falls back to the classic look for anything it doesn't know.

create table public.site_settings (
  id boolean primary key default true check (id),
  theme_style text not null default 'classic' check (theme_style ~ '^[a-z]{1,20}$'),
  theme_color text not null default 'pink' check (theme_color ~ '^[a-z]{1,20}$'),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index site_settings_updated_by_idx on public.site_settings (updated_by);

insert into public.site_settings (id) values (true);

alter table public.site_settings enable row level security;

create policy "anyone reads site settings" on public.site_settings for select to anon, authenticated
  using (true);
create policy "managers change site settings" on public.site_settings for update to authenticated
  using ((select private.has_permission('staff.manage')))
  with check ((select private.has_permission('staff.manage')));

grant select on public.site_settings to anon, authenticated;
grant update (theme_style, theme_color, updated_by, updated_at) on public.site_settings to authenticated;

create trigger site_settings_audit after insert or update or delete on public.site_settings
  for each row execute function private.write_audit_log();
