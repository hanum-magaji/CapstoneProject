-- Fix infinite recursion between projects and project_collaborators RLS policies.
--
-- Problem: projects SELECT policy queries project_collaborators,
-- and project_collaborators policy queries projects, creating a loop.
--
-- Solution: Since projects need to be publicly readable for the
-- stakeholder submission page, use a simple public read policy
-- and remove the circular collaborator check on projects.

-- Drop the conflicting policies on projects
drop policy if exists "Owners can do anything with their projects" on public.projects;
drop policy if exists "Collaborators can read projects" on public.projects;
drop policy if exists "Anyone can read project basics for submission" on public.projects;

-- Recreate projects policies without circular references
create policy "Anyone can read projects"
  on public.projects for select using (true);

create policy "Owners can insert projects"
  on public.projects for insert
  with check (auth.uid() = owner_user_id);

create policy "Owners can update projects"
  on public.projects for update
  using (auth.uid() = owner_user_id);

create policy "Owners can delete projects"
  on public.projects for delete
  using (auth.uid() = owner_user_id);
