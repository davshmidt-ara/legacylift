-- LegacyLift: complete database setup in one file.
-- Paste all of this into Supabase → SQL Editor → New query, and click Run, once.
-- Generated from supabase/migrations/*.sql (in order). Don't edit here; edit the migrations.

-- ================================================================ 20260927120000_legacylift_cloud.sql
-- LegacyLift cloud: our team (staff), client firms, each firm's workspace, and who may see what.
--
-- Access rules
--   * Staff see and change everything.
--   * A client user sees and edits only the workspace of the firm(s) they belong to.
--     They never see the firms table (internal notes, package, checklist) or the activity log.
--   * Client users join a firm by accepting an email invite (claim_invites) after confirming their email.
--   * The first staff member (the admin) is added once by hand in the Supabase SQL editor:
--       insert into public.staff (user_id, display_name)
--       select id, 'Your name' from auth.users where email = 'you@example.com';
--     After that, staff add colleagues in the app (add_staff).
--   * Keep "Confirm email" switched ON in Supabase Auth: invites and add_staff trust confirmed emails only.

-- ---------------------------------------------------------------- tables

create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.firms (
  id uuid primary key default gen_random_uuid(),
  firm_name text not null check (length(trim(firm_name)) > 0),
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  industry text not null default '',
  city text not null default '',
  package text not null default 'start' check (package in ('start', 'suite', 'partner')),
  stage text not null default 'lead' check (stage in ('lead', 'onboarding', 'active', 'paused')),
  owner text not null default '',
  notes text not null default '',
  manual_done text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.firm_log (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  text text not null check (length(text) between 1 and 2000),
  author text,
  created_at timestamptz not null default now()
);
create index firm_log_firm_id_created_at on public.firm_log (firm_id, created_at desc);

create table public.firm_members (
  firm_id uuid not null references public.firms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (firm_id, user_id)
);
create index firm_members_user_id on public.firm_members (user_id);

create table public.firm_invites (
  firm_id uuid not null references public.firms (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email like '%@%'),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (firm_id, email)
);
create index firm_invites_email on public.firm_invites (email);

-- One JSON document per firm: profile, customers, invoices, stock, documents, roadmap, chat.
-- `version` goes up by one on every save so two people can't silently overwrite each other.
create table public.workspaces (
  firm_id uuid primary key references public.firms (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- ---------------------------------------------------------------- helpers

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

create or replace function public.is_firm_member(p_firm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.firm_members where firm_id = p_firm_id and user_id = auth.uid());
$$;

-- Email of the signed-in user, but only once they have confirmed it.
create or replace function public.confirmed_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email) from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
$$;

-- ---------------------------------------------------------------- triggers

create or replace function public.touch_firm()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger firms_touch before update on public.firms
for each row execute function public.touch_firm();

-- Every new firm gets its workspace, pre-filled with the firm's name and contact details.
create or replace function public.create_firm_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspaces (firm_id, data, updated_by)
  values (
    new.id,
    jsonb_build_object(
      'version', 2,
      'profile', jsonb_build_object('businessName', new.firm_name, 'email', new.email, 'phone', new.phone)
    ),
    auth.uid()
  )
  on conflict (firm_id) do nothing;
  return new;
end;
$$;

create trigger firms_create_workspace after insert on public.firms
for each row execute function public.create_firm_workspace();

-- The server, not the browser, decides the next version, the time and who saved.
create or replace function public.bump_workspace()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.firm_id <> old.firm_id then
    raise exception 'firm_id cannot change';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger workspaces_bump before update on public.workspaces
for each row execute function public.bump_workspace();

-- ---------------------------------------------------------------- row level security

alter table public.staff enable row level security;
alter table public.firms enable row level security;
alter table public.firm_log enable row level security;
alter table public.firm_members enable row level security;
alter table public.firm_invites enable row level security;
alter table public.workspaces enable row level security;

create policy "staff: see team, or yourself" on public.staff
  for select to authenticated using (public.is_staff() or user_id = auth.uid());
create policy "staff: rename yourself" on public.staff
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "firms: staff only" on public.firms
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "firm log: staff only" on public.firm_log
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "members: staff see all, users see their own" on public.firm_members
  for select to authenticated using (public.is_staff() or user_id = auth.uid());
create policy "members: staff add" on public.firm_members
  for insert to authenticated with check (public.is_staff());
create policy "members: staff remove" on public.firm_members
  for delete to authenticated using (public.is_staff());

create policy "invites: staff only" on public.firm_invites
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "workspaces: staff or firm members read" on public.workspaces
  for select to authenticated using (public.is_staff() or public.is_firm_member(firm_id));
create policy "workspaces: staff or firm members save" on public.workspaces
  for update to authenticated
  using (public.is_staff() or public.is_firm_member(firm_id))
  with check (public.is_staff() or public.is_firm_member(firm_id));
-- Workspaces are created by the firm trigger and removed with the firm; no direct insert/delete.

-- Supabase grants every privilege on new tables to anon and authenticated by default.
-- Take them all back (TRUNCATE in particular ignores row level security), then grant only what the policies expect.
revoke all on public.staff, public.firms, public.firm_log, public.firm_members, public.firm_invites, public.workspaces from anon, authenticated;
grant select, update on public.staff to authenticated;
grant select, insert, update, delete on public.firms, public.firm_log, public.firm_members, public.firm_invites to authenticated;
grant select, update on public.workspaces to authenticated;

-- ---------------------------------------------------------------- actions (RPC)

-- Joins every firm that invited the signed-in user's (confirmed) email. Returns how many.
create or replace function public.claim_invites()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := public.confirmed_email();
  v_count integer := 0;
begin
  if auth.uid() is null or v_email is null then
    return 0;
  end if;
  insert into public.firm_members (firm_id, user_id)
  select i.firm_id, auth.uid() from public.firm_invites i where i.email = v_email
  on conflict do nothing;
  get diagnostics v_count = row_count;
  delete from public.firm_invites where email = v_email;
  return v_count;
end;
$$;

-- True when nobody is staff yet (so the app can offer "Set me up as the admin").
create or replace function public.staff_exists()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff);
$$;

-- Staff add a colleague who already has an account.
create or replace function public.add_staff(p_email text, p_display_name text default '')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_staff() then
    raise exception 'Only staff can add staff';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) and email_confirmed_at is not null;
  if v_user is null then
    return false;
  end if;
  insert into public.staff (user_id, display_name) values (v_user, coalesce(p_display_name, '')) on conflict (user_id) do nothing;
  return true;
end;
$$;

-- Staff tick or un-tick a checklist task in one step, so two people ticking at once don't overwrite each other.
create or replace function public.set_task_done(p_firm_id uuid, p_task text, p_done boolean)
returns text[]
language sql
security invoker
set search_path = ''
as $$
  update public.firms
  set manual_done = case
    when p_done then array(select distinct unnest(array_append(manual_done, p_task)))
    else array_remove(manual_done, p_task)
  end
  where id = p_firm_id
  returning manual_done;
$$;

-- Workspaces a client user can open, with the business name for the picker.
create or replace function public.my_workspaces()
returns table (firm_id uuid, business_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select w.firm_id, coalesce(nullif(w.data -> 'profile' ->> 'businessName', ''), 'Workspace')
  from public.workspaces w
  where public.is_staff() or public.is_firm_member(w.firm_id)
  order by 2;
$$;

-- Staff: who can open a firm's workspace (their emails), for the client file.
create or replace function public.firm_member_emails(p_firm_id uuid)
returns table (user_id uuid, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff can list firm members';
  end if;
  return query
    select m.user_id, u.email::text from public.firm_members m join auth.users u on u.id = m.user_id
    where m.firm_id = p_firm_id order by u.email;
end;
$$;

-- Staff: the team, with emails.
create or replace function public.staff_list()
returns table (user_id uuid, email text, display_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff can list the team';
  end if;
  return query
    select s.user_id, u.email::text, s.display_name from public.staff s join auth.users u on u.id = s.user_id order by u.email;
end;
$$;

revoke execute on function public.claim_invites(), public.staff_exists(), public.add_staff(text, text), public.my_workspaces(), public.is_staff(), public.is_firm_member(uuid),
  public.confirmed_email(), public.firm_member_emails(uuid), public.staff_list(), public.set_task_done(uuid, text, boolean) from public, anon;
grant execute on function public.claim_invites(), public.staff_exists(), public.add_staff(text, text), public.my_workspaces(), public.is_staff(), public.is_firm_member(uuid),
  public.confirmed_email(), public.firm_member_emails(uuid), public.staff_list(), public.set_task_done(uuid, text, boolean) to authenticated;

-- Live updates when someone else saves the same workspace (Supabase Realtime respects the policies above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.workspaces;
  end if;
end;
$$;

-- ================================================================ 20261009120000_accounts_and_sign_up.sql
-- Open sign-up (email, Google, Microsoft), a private register of every account, and self-service business set-up.
--
--   * internal.accounts is the account register: one row per person who has an account. It lives in its own
--     schema, which the website's API does not expose, and has no access policies at all, so no browser can read
--     it directly. Staff read it only through account_register(), which checks they are on the team.
--   * A trigger on auth.users keeps the register up to date (sign-up, email confirmed, last sign-in, provider).
--   * start_my_business() lets a signed-in person who wasn't invited set up their own business. It creates a
--     firm marked source = 'website' (it shows up in the team console as a new lead), its workspace, and makes
--     the person its only client user. Nobody else's data becomes visible to them.

-- ---------------------------------------------------------------- the private account register

create schema if not exists internal;
revoke all on schema internal from public;
do $$
begin
  -- Keep the register out of reach of the API roles, even if the schema is ever exposed by mistake.
  execute 'revoke all on schema internal from anon, authenticated';
end;
$$;

create table internal.accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  -- How they sign in: email, google, azure (Microsoft), or several, e.g. "email, google".
  providers text not null default 'email',
  language text not null default '',
  created_at timestamptz not null default now(),
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz
);
alter table internal.accounts enable row level security;
-- No policies on purpose: only security-definer functions below can read or write it.

create or replace function internal.sync_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), 200);
  v_providers text := coalesce(
    (select string_agg(p, ', ' order by p) from jsonb_array_elements_text(coalesce(new.raw_app_meta_data -> 'providers', '[]'::jsonb)) as p),
    new.raw_app_meta_data ->> 'provider',
    'email'
  );
begin
  insert into internal.accounts as a (user_id, email, full_name, providers, language, created_at, email_confirmed_at, last_sign_in_at)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    v_name,
    v_providers,
    left(coalesce(new.raw_user_meta_data ->> 'language', ''), 5),
    coalesce(new.created_at, now()),
    new.email_confirmed_at,
    new.last_sign_in_at
  )
  on conflict (user_id) do update set
    email = excluded.email,
    full_name = case when excluded.full_name <> '' then excluded.full_name else a.full_name end,
    providers = excluded.providers,
    language = case when excluded.language <> '' then excluded.language else a.language end,
    email_confirmed_at = excluded.email_confirmed_at,
    last_sign_in_at = excluded.last_sign_in_at;
  return new;
end;
$$;

revoke all on function internal.sync_account() from public;
do $$
begin
  -- Supabase's auth service inserts and updates auth.users as this role.
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant usage on schema internal to supabase_auth_admin';
    execute 'grant execute on function internal.sync_account() to supabase_auth_admin';
  end if;
end;
$$;

drop trigger if exists legacylift_sync_account on auth.users;
create trigger legacylift_sync_account
after insert or update of email, email_confirmed_at, last_sign_in_at, raw_user_meta_data, raw_app_meta_data on auth.users
for each row execute function internal.sync_account();

-- Everyone who already has an account.
insert into internal.accounts (user_id, email, full_name, providers, created_at, email_confirmed_at, last_sign_in_at)
select
  u.id,
  lower(coalesce(u.email, '')),
  left(trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')), 200),
  coalesce(
    (select string_agg(p, ', ' order by p) from jsonb_array_elements_text(coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb)) as p),
    u.raw_app_meta_data ->> 'provider',
    'email'
  ),
  coalesce(u.created_at, now()),
  u.email_confirmed_at,
  u.last_sign_in_at
from auth.users u
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------- trusted email addresses

-- Invites and adding staff hand over access by email address, so the address must really belong to the person.
-- Email sign-ups prove it with the confirmation link. Google only gives verified addresses. Microsoft can pass on an
-- address its owner never verified, so a Microsoft identity counts only when Microsoft says the address is verified
-- (the "xms_edov" claim, see docs/DEPLOYMENT.md step 1e).
create or replace function public.email_trusted(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null)
    and not exists (
      select 1 from auth.identities i
      where i.user_id = p_user
        and i.provider = 'azure'
        and lower(coalesce(i.identity_data ->> 'email', '')) = (select lower(u.email) from auth.users u where u.id = p_user)
        and coalesce(i.identity_data ->> 'email_verified', 'false') <> 'true'
    );
$$;
revoke execute on function public.email_trusted(uuid) from public, anon, authenticated;

-- Same as before, but only for trusted addresses (claim_invites uses this).
create or replace function public.confirmed_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email) from auth.users u where u.id = auth.uid() and public.email_trusted(u.id);
$$;

-- Same as before, but a colleague's account must have a trusted address.
create or replace function public.add_staff(p_email text, p_display_name text default '')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_staff() then
    raise exception 'Only staff can add staff';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) and public.email_trusted(id);
  if v_user is null then
    return false;
  end if;
  insert into public.staff (user_id, display_name) values (v_user, coalesce(p_display_name, '')) on conflict (user_id) do nothing;
  return true;
end;
$$;

-- ---------------------------------------------------------------- firms that signed up on the website

alter table public.firms add column if not exists source text not null default 'team' check (source in ('team', 'website'));
alter table public.firms add column if not exists created_by uuid references auth.users (id) on delete set null;

-- ---------------------------------------------------------------- actions (RPC)

-- Staff: every account, newest first, with the businesses each person can open.
create or replace function public.account_register()
returns table (
  user_id uuid,
  email text,
  full_name text,
  providers text,
  language text,
  created_at timestamptz,
  email_confirmed boolean,
  last_sign_in_at timestamptz,
  is_staff boolean,
  businesses jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Only the LegacyLift team can see accounts';
  end if;
  return query
    select
      a.user_id,
      a.email,
      a.full_name,
      a.providers,
      a.language,
      a.created_at,
      a.email_confirmed_at is not null,
      a.last_sign_in_at,
      exists (select 1 from public.staff s where s.user_id = a.user_id),
      coalesce(
        (select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.firm_name) order by f.firm_name)
         from public.firm_members m join public.firms f on f.id = m.firm_id where m.user_id = a.user_id),
        '[]'::jsonb
      )
    from internal.accounts a
    order by a.created_at desc;
end;
$$;

-- A signed-in person sets up their own business. Returns the new firm's id.
create or replace function public.start_my_business(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text := left(trim(coalesce(p_name, '')), 120);
  v_email text;
  v_full_name text;
  v_firm uuid;
begin
  if v_user is null then
    raise exception 'Please sign in first';
  end if;
  if v_name = '' then
    raise exception 'Enter your business name';
  end if;
  if (select count(*) from public.firms where created_by = v_user and source = 'website') >= 3 then
    raise exception 'You have already set up 3 businesses. Contact your LegacyLift adviser to add more.';
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_user;
  select a.full_name into v_full_name from internal.accounts a where a.user_id = v_user;

  insert into public.firms (firm_name, contact_name, email, source, created_by, stage, package, notes)
  values (v_name, coalesce(v_full_name, ''), coalesce(v_email, ''), 'website', v_user, 'lead', 'start', 'Signed up on the website.')
  returning id into v_firm;
  insert into public.firm_members (firm_id, user_id) values (v_firm, v_user);
  insert into public.firm_log (firm_id, text, author) values (v_firm, 'Signed up on the website as ' || coalesce(v_email, 'unknown email'), 'Website');
  return v_firm;
end;
$$;

revoke execute on function public.account_register(), public.start_my_business(text) from public, anon;
grant execute on function public.account_register(), public.start_my_business(text) to authenticated;

-- ================================================================ 20261009130000_founding_admin.sql
-- Founding admins: email addresses that join the team automatically the moment they sign in with a verified address
-- (email confirmed, Google, or Microsoft with a verified address). Replaces the one-time "insert into staff" line.
--
-- Add an address (Supabase → SQL editor):
--   insert into internal.founding_admins (email) values ('you@example.com');
-- After that, add colleagues from the console's Team page as usual.

create table if not exists internal.founding_admins (
  email text primary key check (email = lower(trim(email)) and email like '%@%')
);
alter table internal.founding_admins enable row level security;
-- No policies: not readable or writable through the API.

create or replace function internal.promote_founding_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from internal.founding_admins f where f.email = lower(coalesce(new.email, '')))
     and public.email_trusted(new.id) then
    insert into public.staff (user_id, display_name)
    values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)))
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function internal.promote_founding_admin() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant execute on function internal.promote_founding_admin() to supabase_auth_admin';
  end if;
end;
$$;

-- Runs on sign-up, on email confirmation and on every sign-in, so it also works when the identity
-- (which says whether a Microsoft address is verified) is saved a moment after the account.
drop trigger if exists legacylift_founding_admin on auth.users;
create trigger legacylift_founding_admin
after insert or update of email, email_confirmed_at, last_sign_in_at on auth.users
for each row execute function internal.promote_founding_admin();

-- Accounts that already exist join as soon as their address is listed.
create or replace function internal.promote_listed_admins()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.staff (user_id, display_name)
  select u.id, split_part(u.email, '@', 1) from auth.users u
  where lower(u.email) = new.email and public.email_trusted(u.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function internal.promote_listed_admins() from public;

drop trigger if exists legacylift_founding_admin_listed on internal.founding_admins;
create trigger legacylift_founding_admin_listed
after insert on internal.founding_admins
for each row execute function internal.promote_listed_admins();

