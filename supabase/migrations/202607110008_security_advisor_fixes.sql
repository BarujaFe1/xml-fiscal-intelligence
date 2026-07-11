-- Hardening follow-up from Supabase security advisors

-- Trigger-only: revoke public EXECUTE on handle_new_user
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;
grant execute on function public.handle_new_user() to postgres;
grant execute on function public.handle_new_user() to service_role;

-- Fix mutable search_path on membership helper
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

-- Tighten workspace create: authenticated only
drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces
  for insert to authenticated
  with check (auth.uid() is not null);

-- workspace_invites policies
drop policy if exists workspace_invites_select on public.workspace_invites;
create policy workspace_invites_select on public.workspace_invites
  for select using (
    public.is_workspace_member(workspace_id)
    or invited_by = auth.uid()
  );

drop policy if exists workspace_invites_insert on public.workspace_invites;
create policy workspace_invites_insert on public.workspace_invites
  for insert with check (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_invites.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

drop policy if exists workspace_invites_update on public.workspace_invites;
create policy workspace_invites_update on public.workspace_invites
  for update using (
    public.is_workspace_member(workspace_id)
    or invited_by = auth.uid()
  );
