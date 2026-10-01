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
