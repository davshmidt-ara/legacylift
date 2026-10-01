\set ON_ERROR_STOP on
create or replace function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;
create or replace function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- ids
\set OWNER    '''00000000-0000-0000-0000-00000000000a'''
\set COLL     '''00000000-0000-0000-0000-00000000000b'''
\set MARIA    '''00000000-0000-0000-0000-00000000000c'''
\set KLAUS    '''00000000-0000-0000-0000-00000000000d'''
\set FAKE     '''00000000-0000-0000-0000-00000000000e'''

-- 1. first admin is added by hand (as in the Supabase SQL editor); nobody can promote themselves
select pg_temp.as_user(:MARIA); set role authenticated;
select pg_temp.check(not public.staff_exists(), 'no staff yet');
select pg_temp.check(not public.is_staff(), 'maria is not staff');
reset role;
insert into public.staff (user_id, display_name) select id, 'Owner' from auth.users where email = 'owner@agency.test';
select pg_temp.as_user(:OWNER); set role authenticated;
select pg_temp.check(public.is_staff(), 'owner is staff after the one-time SQL line');
reset role;

-- 2. staff create firms; workspace appears with the firm name
select pg_temp.as_user(:OWNER); set role authenticated;
insert into public.firms (id, firm_name, email, package, stage) values
  ('11111111-1111-1111-1111-111111111111', 'Bäckerei Lindner', 'maria@bakery.test', 'start', 'onboarding'),
  ('22222222-2222-2222-2222-222222222222', 'Hartmann Joinery', 'klaus@joinery.test', 'suite', 'active');
select pg_temp.check((select count(*) from public.workspaces) = 2, 'workspace created for each firm');
select pg_temp.check((select data->'profile'->>'businessName' from public.workspaces where firm_id = '11111111-1111-1111-1111-111111111111') = 'Bäckerei Lindner', 'workspace pre-filled with firm name');
insert into public.firm_log (firm_id, text, author) values ('11111111-1111-1111-1111-111111111111', 'Kick-off call held', 'Owner');
insert into public.firm_invites (firm_id, email, invited_by) values
  ('11111111-1111-1111-1111-111111111111', 'maria@bakery.test', :OWNER),
  ('11111111-1111-1111-1111-111111111111', 'maria.fake@bakery.test', :OWNER);
select pg_temp.check(public.add_staff('colleague@agency.test', 'Colleague'), 'owner adds a colleague as staff');
reset role;

-- 2b. checklist ticks are applied in one step
select pg_temp.as_user(:OWNER); set role authenticated;
select pg_temp.check(public.set_task_done('11111111-1111-1111-1111-111111111111', 'kickoff', true) = array['kickoff'], 'tick a task');
select pg_temp.check(public.set_task_done('11111111-1111-1111-1111-111111111111', 'kickoff', true) = array['kickoff'], 'ticking twice keeps one entry');
select pg_temp.check(public.set_task_done('11111111-1111-1111-1111-111111111111', 'training', true) @> array['kickoff','training'], 'a second tick keeps the first');
select pg_temp.check(public.set_task_done('11111111-1111-1111-1111-111111111111', 'kickoff', false) = array['training'], 'un-tick removes only that task');
reset role;

-- 3. colleague (staff) sees everything
select pg_temp.as_user(:COLL); set role authenticated;
select pg_temp.check((select count(*) from public.firms) = 2, 'colleague sees all firms');
select pg_temp.check((select count(*) from public.firm_log) = 1, 'colleague sees the activity log');
reset role;

-- 4. client before accepting the invite sees nothing
select pg_temp.as_user(:MARIA); set role authenticated;
select pg_temp.check((select count(*) from public.workspaces) = 0, 'maria sees no workspace before joining');
select pg_temp.check((select count(*) from public.my_workspaces()) = 0, 'my_workspaces empty before joining');
select pg_temp.check(public.claim_invites() = 1, 'maria accepts her invite');
select pg_temp.check((select count(*) from public.workspaces) = 1, 'maria now sees exactly one workspace');
select pg_temp.check((select business_name from public.my_workspaces()) = 'Bäckerei Lindner', 'my_workspaces lists her firm');
select pg_temp.check((select count(*) from public.firms) = 0, 'maria cannot see the internal firms table');
select pg_temp.check((select count(*) from public.firm_log) = 0, 'maria cannot see the internal log');
select pg_temp.check((select count(*) from public.firm_invites) = 0, 'maria cannot see invites');
select pg_temp.check((select count(*) from public.staff) = 0, 'maria cannot see the team');

-- 5. saving with version check
with s as (update public.workspaces set data = '{"version":2,"profile":{"businessName":"Bäckerei Lindner"},"customers":[{"id":"c1"}]}'::jsonb
           where firm_id = '11111111-1111-1111-1111-111111111111' and version = 1 returning version)
select pg_temp.check((select version from s) = 2, 'maria saves; version becomes 2');
with s as (update public.workspaces set data = '{}'::jsonb
           where firm_id = '11111111-1111-1111-1111-111111111111' and version = 1 returning version)
select pg_temp.check((select count(*) from s) = 0, 'a stale save (old version) changes nothing');
with s as (update public.workspaces set data = '{}'::jsonb, version = 999
           where firm_id = '11111111-1111-1111-1111-111111111111' and version = 2 returning version)
select pg_temp.check((select version from s) = 3, 'version cannot be forced by the browser');
select pg_temp.check((select updated_by from public.workspaces) = :MARIA::uuid, 'server records who saved');
with s as (update public.workspaces set data = '{}'::jsonb where firm_id = '22222222-2222-2222-2222-222222222222' returning 1)
select pg_temp.check((select count(*) from s) = 0, 'maria cannot save another firm''s workspace');
reset role;

-- 5b. staff can see who has access; clients cannot
reset role; select pg_temp.as_user(:OWNER); set role authenticated;
select pg_temp.check((select email from public.firm_member_emails('11111111-1111-1111-1111-111111111111')) = 'maria@bakery.test', 'staff see member emails');
select pg_temp.check((select count(*) from public.staff_list()) = 2, 'staff see the team');
reset role;

-- 6. forbidden actions raise errors
create or replace function pg_temp.must_fail(sql text, what text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'ok  % (%)', what, sqlerrm;
    return;
  end;
  raise exception 'FAILED: % should have been refused', what;
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;
select pg_temp.as_user(:MARIA); set role authenticated;
select pg_temp.must_fail($$insert into public.firms (firm_name) values ('Sneaky')$$, 'client cannot create firms');
select pg_temp.must_fail($$insert into public.firm_members (firm_id, user_id) values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-00000000000c')$$, 'client cannot add herself to another firm');
select pg_temp.must_fail($$insert into public.staff (user_id) values ('00000000-0000-0000-0000-00000000000c')$$, 'client cannot make herself staff');
select pg_temp.must_fail($$select public.add_staff('maria@bakery.test')$$, 'client cannot call add_staff');
select pg_temp.check(public.set_task_done('11111111-1111-1111-1111-111111111111', 'x', true) is null, 'client cannot tick tasks (no row visible)');
select pg_temp.must_fail($$update public.workspaces set firm_id = '22222222-2222-2222-2222-222222222222'$$, 'workspace cannot be moved to another firm');
select pg_temp.must_fail($$delete from public.workspaces$$, 'client cannot delete workspaces');
select pg_temp.must_fail($$insert into public.workspaces (firm_id) values (gen_random_uuid())$$, 'nobody inserts workspaces directly');
select pg_temp.must_fail($$truncate public.workspaces$$, 'client cannot truncate workspaces');
select pg_temp.must_fail($$truncate public.firms cascade$$, 'client cannot truncate firms');
select pg_temp.must_fail($$delete from public.staff$$, 'client cannot delete staff');
select pg_temp.must_fail($$select * from public.firm_member_emails('11111111-1111-1111-1111-111111111111')$$, 'client cannot list member emails');
select pg_temp.must_fail($$select * from public.staff_list()$$, 'client cannot list the team');
reset role;

-- 7. unconfirmed email cannot claim an invite meant for that address
select pg_temp.as_user(:FAKE); set role authenticated;
select pg_temp.check(public.claim_invites() = 0, 'unconfirmed account cannot accept an invite');
select pg_temp.check((select count(*) from public.workspaces) = 0, 'unconfirmed account sees nothing');
reset role;

-- 8. another client sees nothing of the bakery
select pg_temp.as_user(:KLAUS); set role authenticated;
select pg_temp.check(public.claim_invites() = 0, 'klaus has no invite yet');
select pg_temp.check((select count(*) from public.workspaces) = 0, 'klaus cannot see the bakery');
reset role;

-- 9. logged-out visitors get nothing
select pg_temp.as_user(''); set role anon;
select pg_temp.must_fail($$select * from public.workspaces$$, 'anon cannot read workspaces');
select pg_temp.must_fail($$select * from public.firms$$, 'anon cannot read firms');
select pg_temp.must_fail($$select public.add_staff('x@y.z')$$, 'anon cannot add staff');
reset role;

-- 10. deleting a firm removes its workspace, members and log
select pg_temp.as_user(:OWNER); set role authenticated;
delete from public.firms where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.check((select count(*) from public.workspaces) = 1, 'workspace removed with the firm');
select pg_temp.check((select count(*) from public.firm_members) = 0, 'memberships removed with the firm');
select pg_temp.check((select count(*) from public.firm_log) = 0, 'log removed with the firm');
reset role;
\echo ALL SQL TESTS PASSED
