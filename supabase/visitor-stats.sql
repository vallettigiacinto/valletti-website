-- Visitor statistics for the admin panel (/admin/statistics).
-- Run this once in the Supabase SQL editor on the existing project.
-- (It is also included at the end of schema.sql for fresh setups.)
--
-- Only daily totals per country are stored: no IP addresses, no cookies,
-- no per-visitor data. The country comes from Vercel's IP lookup at the
-- moment of the request and is then thrown away together with the IP.

create table if not exists page_views_daily (
  day date not null,
  -- ISO 3166-1 alpha-2 code (IT, DK, …), or 'XX' when unknown.
  country text not null,
  -- Every page shown.
  views integer not null default 0,
  -- Arrivals from outside the site (search, link, typed address).
  visits integer not null default 0,
  primary key (day, country)
);
alter table page_views_daily enable row level security;

drop policy if exists "admin read page_views_daily" on page_views_daily;
create policy "admin read page_views_daily" on page_views_daily
  for select to authenticated using (is_admin());

-- The public site can only add +1 through this function; it can't read
-- or change the table directly. Days follow Italian time.
create or replace function record_page_view(p_country text, p_entry boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  c text := upper(coalesce(p_country, ''));
begin
  if c !~ '^[A-Z]{2}$' then
    c := 'XX';
  end if;
  insert into page_views_daily (day, country, views, visits)
  values ((now() at time zone 'Europe/Rome')::date, c, 1, case when p_entry then 1 else 0 end)
  on conflict (day, country) do update
    set views = page_views_daily.views + 1,
        visits = page_views_daily.visits + excluded.visits;
end;
$$;
revoke execute on function record_page_view(text, boolean) from public;
grant execute on function record_page_view(text, boolean) to anon, authenticated;
