-- Deleting accounts (GDPR "right to erasure").
--   * delete_my_account(): a client deletes their own account. Businesses they set up themselves on the website and
--     share with nobody else are deleted with it (workspace, log, everything). Businesses the team set up for them stay
--     with the team; only the person's access is removed.
--   * remove_account(user): the team does the same on someone's behalf (e.g. a request by email).
--   * Team members can't delete themselves this way; a colleague removes them from the team first.

create or replace function internal.erase_account(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.firms f
  where f.source = 'website'
    and f.created_by = p_user
    and not exists (select 1 from public.firm_members m where m.firm_id = f.id and m.user_id <> p_user);
  -- Cascades to memberships, the account register and the person's sign-in identities.
  delete from auth.users where id = p_user;
end;
$$;
revoke all on function internal.erase_account(uuid) from public;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  if public.is_staff() then
    raise exception 'Team members are removed by a colleague on the Team page first.';
  end if;
  perform internal.erase_account(auth.uid());
end;
$$;

create or replace function public.remove_account(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Only the LegacyLift team can remove accounts';
  end if;
  if exists (select 1 from public.staff where user_id = p_user) then
    raise exception 'This is a team member. Remove them from the team first.';
  end if;
  perform internal.erase_account(p_user);
end;
$$;

revoke execute on function public.delete_my_account(), public.remove_account(uuid) from public, anon;
grant execute on function public.delete_my_account(), public.remove_account(uuid) to authenticated;
