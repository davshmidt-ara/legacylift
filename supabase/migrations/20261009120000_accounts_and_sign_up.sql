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
