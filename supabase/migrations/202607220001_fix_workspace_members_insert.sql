-- Fix: authenticated users must not self-insert into arbitrary workspaces.
-- Membership insert is allowed only for:
-- 1) workspace owner/admin adding another member (or themselves as admin action)
-- 2) accepting a valid, non-expired, unused invite addressed to the user email

drop policy if exists workspace_members_insert on workspace_members;

create policy workspace_members_insert on workspace_members
  for insert
  with check (
    -- Owner/admin of the target workspace may insert memberships
    exists (
      select 1
      from workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
    or
    -- Invite acceptance: row must match invite for this user's email
    (
      workspace_members.user_id = auth.uid()
      and exists (
        select 1
        from workspace_invites i
        join profiles p on p.id = auth.uid()
        where i.workspace_id = workspace_members.workspace_id
          and i.accepted_at is null
          and i.expires_at > now()
          and lower(i.email) = lower(coalesce(p.email, ''))
          and i.role = workspace_members.role
      )
    )
  );

comment on policy workspace_members_insert on workspace_members is
  'Prevent BOLA self-join: only owner/admin or valid invite acceptance may insert memberships.';
