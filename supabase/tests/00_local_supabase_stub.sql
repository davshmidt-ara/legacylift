-- LOCAL TESTING ONLY. Never run this against a real Supabase project.
-- Minimal stand-in for what Supabase provides: roles, auth.users, auth.uid(), default grants.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz,
  created_at timestamptz default now(),
  last_sign_in_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{"provider": "email", "providers": ["email"]}'::jsonb
);
create table auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  provider text not null,
  identity_data jsonb not null default '{}'::jsonb
);
-- Same shape as Supabase's auth.uid(): works with psql tests (request.jwt.claim.sub) and PostgREST (request.jwt.claims).
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true), current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
-- Supabase grants everything on new public tables to anon/authenticated by default; RLS does the rest.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'owner@agency.test', now()),
  ('00000000-0000-0000-0000-00000000000b', 'colleague@agency.test', now()),
  ('00000000-0000-0000-0000-00000000000c', 'maria@bakery.test', now()),
  ('00000000-0000-0000-0000-00000000000d', 'klaus@joinery.test', now()),
  ('00000000-0000-0000-0000-00000000000e', 'maria.fake@bakery.test', null);
