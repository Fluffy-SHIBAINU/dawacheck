-- DawaCheck backend. Paste into the Supabase SQL editor once (safe to re-run).
create table if not exists public.reports (
  id uuid primary key,
  device_id uuid not null,
  created_at timestamptz not null,
  received_at timestamptz not null default now(),
  nrn text check (char_length(nrn) <= 20),
  product_name text check (char_length(product_name) <= 200),
  reason text not null check (reason in ('not_in_register','name_mismatch','strength_mismatch','pack_expired','reg_lapsed','on_alert','batch_on_alert','alert_product','community_flag','looks_different','other')),
  verdict text not null check (verdict in ('green','amber','red','unknown')),
  state text check (char_length(state) <= 3),
  note text check (char_length(note) <= 500),
  photo_thumb text check (char_length(photo_thumb) <= 90000),
  ocr_excerpt text check (char_length(ocr_excerpt) <= 500),
  lang text,
  app_version text,
  pack_version text
);

create table if not exists public.events (
  id uuid primary key,
  device_id uuid not null,
  ts timestamptz not null,
  received_at timestamptz not null default now(),
  type text not null check (char_length(type) <= 40),
  props jsonb not null default '{}'::jsonb,
  lang text,
  app_version text,
  pack_version text
);

create index if not exists reports_nrn_idx on public.reports (nrn, created_at);
create index if not exists events_type_idx on public.events (type, ts);

alter table public.reports enable row level security;
alter table public.events enable row level security;
drop policy if exists "anon inserts reports" on public.reports;
create policy "anon inserts reports" on public.reports for insert to anon with check (true);
drop policy if exists "anon inserts events" on public.events;
create policy "anon inserts events" on public.events for insert to anon with check (true);

-- Per-device daily caps: 20 reports and 2,000 usage events per 24 hours, by server receive time.
-- Device ids come from the phone, so this slows spam; it cannot stop a determined attacker.
-- SECURITY DEFINER lets the count see rows that anon cannot read. A retried id skips the cap, so
-- the insert fails as a duplicate (HTTP 409) and the app marks it sent. PostgREST turns SQLSTATE
-- PT429 into HTTP 429, and the app keeps those rows queued for a later sync.
create index if not exists reports_device_idx on public.reports (device_id, received_at);
create index if not exists events_device_idx on public.events (device_id, received_at);

create or replace function public.enforce_daily_cap() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cap int := case tg_table_name when 'reports' then 20 else 2000 end;
  n int;
begin
  if tg_table_name = 'reports' then
    if exists (select 1 from public.reports where id = new.id) then return new; end if;
    select count(*) into n from public.reports where device_id = new.device_id and received_at > now() - interval '24 hours';
  else
    if exists (select 1 from public.events where id = new.id) then return new; end if;
    select count(*) into n from public.events where device_id = new.device_id and received_at > now() - interval '24 hours';
  end if;
  if n >= cap then
    raise sqlstate 'PT429' using message = format('rate limited: %s %s per device per day', cap, tg_table_name);
  end if;
  return new;
end $$;

-- Triggers fire without EXECUTE; nobody should call this function directly.
revoke all on function public.enforce_daily_cap() from public, anon, authenticated;

drop trigger if exists reports_daily_cap on public.reports;
create trigger reports_daily_cap before insert on public.reports for each row execute function public.enforce_daily_cap();
drop trigger if exists events_daily_cap on public.events;
create trigger events_daily_cap before insert on public.events for each row execute function public.enforce_daily_cap();

-- Learning: numbers reported by several phones become community flags.
create or replace view public.community_flags as
select nrn,
       count(*)::int as reports,
       count(distinct device_id)::int as devices,
       coalesce(array_agg(distinct state) filter (where state is not null), '{}') as states,
       case when count(*) >= 5 and count(distinct device_id) >= 3 then 'warning' else 'watch' end as level,
       max(created_at) as last_report_at
from public.reports
where nrn is not null and created_at > now() - interval '14 days'
group by nrn
having count(*) >= 3 and count(distinct device_id) >= 2;

-- Learning: user corrections of misread numbers.
create or replace view public.nrn_corrections as
select props->>'read' as read, props->>'corrected' as corrected, count(*)::int as n
from public.events
where type = 'nrn_corrected' and ts > now() - interval '90 days' and props ? 'read' and props ? 'corrected'
group by 1, 2;

create or replace view public.dash_activity as
select count(*) filter (where type = 'verdict_shown')::int as checks,
       count(*) filter (where type = 'verdict_shown' and props->>'level' = 'red')::int as red,
       count(distinct device_id)::int as devices,
       (select count(*)::int from public.reports where created_at > now() - interval '7 days') as reports
from public.events
where ts > now() - interval '7 days';

create or replace view public.dash_by_state as
select coalesce(state, '??') as state, count(*)::int as reports
from public.reports where created_at > now() - interval '7 days'
group by 1 order by 2 desc;

create or replace view public.dash_by_reason as
select reason, count(*)::int as reports
from public.reports where created_at > now() - interval '7 days'
group by 1 order by 2 desc;

create or replace view public.dash_unknown_nrns as
select nrn, count(*)::int as reports, count(distinct device_id)::int as devices, max(created_at) as last_report_at
from public.reports
where reason = 'not_in_register' and nrn is not null
group by nrn having count(*) >= 2
order by 2 desc;

grant select on public.community_flags, public.nrn_corrections, public.dash_activity,
  public.dash_by_state, public.dash_by_reason, public.dash_unknown_nrns to anon;

insert into storage.buckets (id, name, public) values ('packs', 'packs', true) on conflict (id) do nothing;
