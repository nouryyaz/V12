-- Mateology Play Society: parent accounts
-- Run this once: Supabase dashboard > SQL Editor > New query > paste everything > Run.
-- Safe to run again; it only creates what is missing.
--
-- How the privacy works:
--   * Parents sign in with an emailed code (Supabase Auth). No passwords are stored.
--   * Row Level Security is switched on for every table. A signed-in parent can only ever
--     read or change rows whose family_id is their own sign-in id. The website cannot
--     ask for anyone else's rows, even by editing its own code.
--   * Parents can read their sessions, activity notes and invoices, but cannot create or
--     change them. Only you can, through the admin portal (server-side key, never in the website).
--   * Nobody who is signed out can read anything.

-- ---------- Tables ----------

create table if not exists public.families (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  parent_name text not null default '' check (char_length(parent_name) <= 80),
  phone       text not null default '' check (char_length(phone) <= 30),
  created_at  timestamptz not null default now()
);

create table if not exists public.children (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  first_name  text not null check (char_length(first_name) between 1 and 40),
  birth_year  int check (birth_year between 2000 and 2100),
  created_at  timestamptz not null default now()
);
create index if not exists children_family_idx on public.children(family_id);

create table if not exists public.attendances (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  child_id      uuid references public.children(id) on delete set null,
  booking_ref   text,
  session_date  date not null,
  session_title text not null default 'Mateology Play Session',
  venue         text not null default '',
  status        text not null default 'booked' check (status in ('booked','attended','cancelled')),
  created_at    timestamptz not null default now()
);
create index if not exists attendances_family_idx on public.attendances(family_id, session_date desc);

create table if not exists public.activity_notes (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  child_id      uuid references public.children(id) on delete set null,
  session_date  date not null,
  activity      text not null check (char_length(activity) between 1 and 120),
  note          text not null default '' check (char_length(note) <= 600),
  created_at    timestamptz not null default now()
);
create index if not exists notes_family_idx on public.activity_notes(family_id, session_date desc);

-- Invoices are business records, so they stay (without the personal link) if a parent deletes their account.
create table if not exists public.invoices (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid references public.families(id) on delete set null,
  number        text not null unique,
  issued_at     date not null default current_date,
  description   text not null default '',
  amount_cents  int not null check (amount_cents >= 0),
  status        text not null default 'unpaid' check (status in ('unpaid','paid','refunded')),
  pay_url       text check (pay_url is null or pay_url ~ '^https://'),
  billed_name   text not null default '',
  billed_email  text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists invoices_family_idx on public.invoices(family_id, issued_at desc);

create table if not exists public.marketing_prefs (
  family_id    uuid primary key references public.families(id) on delete cascade,
  email_opt_in boolean not null default false,   -- off until the parent turns it on
  opted_in_at  timestamptz,
  opted_out_at timestamptz,
  updated_at   timestamptz not null default now()
);

-- ---------- Automatic set-up when a parent first signs in ----------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.families (id, email) values (new.id, coalesce(new.email, '')) on conflict do nothing;
  insert into public.marketing_prefs (family_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Records when someone agreed to or left marketing, set by the database so it can't be faked.
create or replace function public.stamp_marketing() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.email_opt_in and not old.email_opt_in then new.opted_in_at := now(); new.opted_out_at := null; end if;
  if not new.email_opt_in and old.email_opt_in then new.opted_out_at := now(); end if;
  return new;
end $$;

drop trigger if exists marketing_stamp on public.marketing_prefs;
create trigger marketing_stamp before update on public.marketing_prefs
  for each row execute function public.stamp_marketing();

-- No more than 10 children per family.
create or replace function public.limit_children() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.children where family_id = new.family_id) >= 10 then
    raise exception 'A family can have up to 10 children.';
  end if;
  return new;
end $$;

drop trigger if exists children_limit on public.children;
create trigger children_limit before insert on public.children
  for each row execute function public.limit_children();

-- ---------- Locking it down ----------

alter table public.families        enable row level security;
alter table public.children        enable row level security;
alter table public.attendances     enable row level security;
alter table public.activity_notes  enable row level security;
alter table public.invoices        enable row level security;
alter table public.marketing_prefs enable row level security;

revoke all on public.families, public.children, public.attendances, public.activity_notes, public.invoices, public.marketing_prefs from anon, authenticated;

-- Parents read their own rows
drop policy if exists own_family_read on public.families;
create policy own_family_read on public.families for select to authenticated using (id = (select auth.uid()));
drop policy if exists own_family_update on public.families;
create policy own_family_update on public.families for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
grant select on public.families to authenticated;
grant update (parent_name, phone) on public.families to authenticated;   -- email cannot be changed from the website

drop policy if exists own_children_all on public.children;
create policy own_children_all on public.children for all to authenticated
  using (family_id = (select auth.uid())) with check (family_id = (select auth.uid()));
grant select, insert, delete on public.children to authenticated;
grant update (first_name, birth_year) on public.children to authenticated;

drop policy if exists own_attendances_read on public.attendances;
create policy own_attendances_read on public.attendances for select to authenticated using (family_id = (select auth.uid()));
grant select on public.attendances to authenticated;

drop policy if exists own_notes_read on public.activity_notes;
create policy own_notes_read on public.activity_notes for select to authenticated using (family_id = (select auth.uid()));
grant select on public.activity_notes to authenticated;

drop policy if exists own_invoices_read on public.invoices;
create policy own_invoices_read on public.invoices for select to authenticated using (family_id = (select auth.uid()));
grant select on public.invoices to authenticated;

drop policy if exists own_prefs_read on public.marketing_prefs;
create policy own_prefs_read on public.marketing_prefs for select to authenticated using (family_id = (select auth.uid()));
drop policy if exists own_prefs_update on public.marketing_prefs;
create policy own_prefs_update on public.marketing_prefs for update to authenticated using (family_id = (select auth.uid())) with check (family_id = (select auth.uid()));
grant select on public.marketing_prefs to authenticated;
grant update (email_opt_in) on public.marketing_prefs to authenticated;

-- ---------- Parent can delete their own account ----------

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in.'; end if;
  delete from auth.users where id = auth.uid();   -- removes their family, children, sessions, notes and preferences
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- Tiny "are you awake" call used by the weekly keep-alive ----------

create or replace function public.ping() returns text
language sql stable set search_path = '' as $$ select 'ok'::text $$;
grant execute on function public.ping() to anon, authenticated;
