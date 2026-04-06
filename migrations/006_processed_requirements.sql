-- ============================================================
-- Migration 006: processed_requirements
--
-- Stores individual, AI-rewritten requirements extracted from
-- a stakeholder submission. Each row is one atomic requirement
-- derived from the submission's raw_text.
--
-- Run in Supabase SQL Editor before deploying the updated submit.js
-- ============================================================

create table if not exists public.processed_requirements (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  submission_id uuid not null references public.stakeholder_submissions(id) on delete cascade,
  text          text not null,
  embedding     vector(1536),
  cluster_id    uuid references public.requirement_clusters(id) on delete set null,
  created_at    timestamptz default now()
);

-- RLS
alter table public.processed_requirements enable row level security;

create policy "Service role can manage processed requirements"
  on public.processed_requirements for all using (true) with check (true);

create policy "Project members can read processed requirements"
  on public.processed_requirements for select
  using (project_id in (
    select id from public.projects where owner_user_id = auth.uid()
    union
    select project_id from public.project_collaborators
      where user_id = auth.uid() and role != 'pending'
  ));

-- Indexes
create index if not exists idx_proc_reqs_project    on public.processed_requirements(project_id);
create index if not exists idx_proc_reqs_submission on public.processed_requirements(submission_id);
create index if not exists idx_proc_reqs_cluster    on public.processed_requirements(cluster_id);
