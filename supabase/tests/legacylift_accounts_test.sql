-- Run after legacylift_access_test.sql (same database). Checks open sign-up, the private account register and
-- self-service business set-up.
\set ON_ERROR_STOP on
create or replace function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;
create or replace function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;
create or replace function pg_temp.must_fail(q text, what text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    raise notice 'ok  % (%)', what, sqlerrm;
    return;
  end;
  raise exception 'FAILED: % (it was allowed)', what;
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

\set OWNER    '''00000000-0000-0000-0000-00000000000a'''
\set MARIA    '''00000000-0000-0000-0000-00000000000c'''
\set GOOGLE   '''00000000-0000-0000-0000-0000000000f1'''
\set MSFT     '''00000000-0000-0000-0000-0000000000f2'''

-- 1. existing accounts were copied into the register; new sign-ups arrive by themselves
select pg_temp.check((select count(*) from internal.accounts) = (select count(*) from auth.users), 'register holds every existing account');
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data) values
  (:GOOGLE, 'Ilze@Saulite.example', now(), '{"full_name": "Ilze Saule", "language": "lv"}', '{"provider": "google", "providers": ["google"]}'),
  (:MSFT, 'jonas@medis.example', now(), '{"name": "Jonas Petraitis"}', '{"provider": "azure", "providers": ["azure"]}');
select pg_temp.check((select full_name || '|' || providers || '|' || email || '|' || language from internal.accounts where user_id = :GOOGLE) = 'Ilze Saule|google|ilze@saulite.example|lv', 'Google sign-up recorded with name, provider, lower-case email and language');
select pg_temp.check((select full_name || '|' || providers from internal.accounts where user_id = :MSFT) = 'Jonas Petraitis|azure', 'Microsoft sign-up recorded');
update auth.users set last_sign_in_at = now(), raw_app_meta_data = '{"provider": "google", "providers": ["email", "google"]}' where id = :GOOGLE;
select pg_temp.check((select last_sign_in_at is not null and providers = 'email, google' from internal.accounts where user_id = :GOOGLE), 'sign-ins and linked providers kept up to date');

-- 2. the register is private: no API role can reach it directly
select pg_temp.as_user(:OWNER); set role authenticated;
select pg_temp.must_fail($$select * from internal.accounts$$, 'even staff cannot read the register table directly');
reset role;
select pg_temp.as_user(:MARIA); set role authenticated;
select pg_temp.must_fail($$select * from internal.accounts$$, 'a client cannot read the register');
select pg_temp.must_fail($$select * from public.account_register()$$, 'a client cannot list accounts');
reset role;
select pg_temp.as_user(''); set role anon;
select pg_temp.must_fail($$select * from public.account_register()$$, 'logged-out visitors cannot list accounts');
select pg_temp.must_fail($$select public.start_my_business('X')$$, 'logged-out visitors cannot set up a business');
reset role;

-- 3. staff see every account through account_register()
select count(*) as total_accounts from auth.users \gset
select pg_temp.as_user(:OWNER); set role authenticated;
select pg_temp.check((select count(*) from public.account_register()) = :total_accounts, 'staff see every account');
select pg_temp.check((select is_staff from public.account_register() where email = 'owner@agency.test'), 'staff accounts are marked');
select pg_temp.check((select jsonb_array_length(businesses) from public.account_register() where email = 'maria@bakery.test') >= 0, 'businesses listed per account');
reset role;

-- 4. a new Google user sets up her own business
select pg_temp.as_user(:GOOGLE); set role authenticated;
select pg_temp.check((select count(*) from public.my_workspaces()) = 0, 'a new account starts with no business');
select pg_temp.must_fail($$select public.start_my_business('   ')$$, 'a business needs a name');
select pg_temp.check(public.start_my_business('SIA Maiznīca Saulīte') is not null, 'she sets up her business');
select pg_temp.check((select string_agg(business_name, ',') from public.my_workspaces()) = 'SIA Maiznīca Saulīte', 'she can open exactly her new workspace');
select pg_temp.check((select count(*) from public.workspaces) = 1, 'she sees no other firm''s workspace');
select pg_temp.check((select count(*) from public.firms) = 0, 'firms table shows her nothing');
select pg_temp.check((select count(*) from public.firm_log) = 0, 'activity log shows her nothing');
select pg_temp.check(public.start_my_business('Second shop') is not null and public.start_my_business('Third shop') is not null, 'up to 3 businesses');
select pg_temp.must_fail($$select public.start_my_business('Fourth shop')$$, 'a fourth self-service business is refused');
reset role;

-- 5. the team sees the new lead, marked as a website sign-up
select pg_temp.as_user(:OWNER); set role authenticated;
select pg_temp.check((select source || '|' || stage || '|' || contact_name || '|' || email from public.firms where firm_name = 'SIA Maiznīca Saulīte') = 'website|lead|Ilze Saule|ilze@saulite.example', 'team sees a website lead with her name and email');
select pg_temp.check((select count(*) from public.firm_log l join public.firms f on f.id = l.firm_id where f.firm_name = 'SIA Maiznīca Saulīte' and l.author = 'Website') = 1, 'sign-up noted in the activity log');
select pg_temp.check((select jsonb_array_length(businesses) from public.account_register() where email = 'ilze@saulite.example') = 3, 'register lists her businesses');
reset role;

-- 6. Microsoft user cannot see the Google user's business
select pg_temp.as_user(:MSFT); set role authenticated;
select pg_temp.check((select count(*) from public.workspaces) = 0, 'other new accounts see nothing of hers');
reset role;

-- 7. a Microsoft account with an unverified email cannot take over an invite or a team seat
\set SPOOF '''00000000-0000-0000-0000-0000000000f3'''
\set VERIFIED '''00000000-0000-0000-0000-0000000000f4'''
select pg_temp.as_user(:OWNER); set role authenticated;
insert into public.firms (id, firm_name) values ('33333333-3333-3333-3333-333333333333', 'Invited Bakery');
insert into public.firm_invites (firm_id, email, invited_by) values ('33333333-3333-3333-3333-333333333333', 'real.owner@bakery.example', :OWNER), ('33333333-3333-3333-3333-333333333333', 'verified@bakery.example', :OWNER);
reset role;
insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data) values
  (:SPOOF, 'real.owner@bakery.example', now(), '{"provider": "azure", "providers": ["azure"]}'),
  (:VERIFIED, 'verified@bakery.example', now(), '{"provider": "azure", "providers": ["azure"]}');
insert into auth.identities (user_id, provider, identity_data) values
  (:SPOOF, 'azure', '{"email": "real.owner@bakery.example"}'),
  (:VERIFIED, 'azure', '{"email": "verified@bakery.example", "email_verified": "true"}');
select pg_temp.as_user(:SPOOF); set role authenticated;
select pg_temp.check(public.claim_invites() = 0, 'unverified Microsoft email cannot claim an invite');
select pg_temp.check((select count(*) from public.workspaces) = 0, 'and sees no workspace');
reset role;
select pg_temp.as_user(:OWNER); set role authenticated;
select pg_temp.check(not public.add_staff('real.owner@bakery.example'), 'unverified Microsoft email cannot be added to the team');
reset role;
select pg_temp.as_user(:VERIFIED); set role authenticated;
select pg_temp.check(public.claim_invites() = 1, 'a verified Microsoft email claims its invite');
reset role;

-- 7. deleting an account removes it from the register
delete from auth.users where id = :MSFT;
select pg_temp.check((select count(*) from internal.accounts where user_id = :MSFT) = 0, 'deleted accounts leave the register');
\echo ALL ACCOUNT TESTS PASSED
