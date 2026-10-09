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
