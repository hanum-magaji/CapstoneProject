-- Phase 1: Database setup for stakeholder submissions
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Enable pgvector extension for embedding storage
create extension if not exists vector;

-- 2. Add new columns to existing projects table
alter table projects
  add column if not exists domain text default 'other',
  add column if not exists stakeholder_link_token text;

-- Generate unique tokens for existing projects
update projects
set stakeholder_link_token = encode(gen_random_bytes(16), 'hex')
where stakeholder_link_token is null;

-- Make token non-nullable going forward
alter table projects
  alter column stakeholder_link_token set default encode(gen_random_bytes(16), 'hex');

-- 3. Create requirement_clusters table (referenced by submissions)
create table if not exists requirement_clusters (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  label           text not null,
  summary         text,
  submission_count int default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- 4. Create stakeholder_submissions table
create table if not exists stakeholder_submissions (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  submitted_by      uuid references auth.users(id),
  stakeholder_name  text,
  stakeholder_role  text,
  raw_text          text not null,
  embedding         vector(1536),
  cluster_id        uuid references requirement_clusters(id) on delete set null,
  created_at        timestamptz default now()
);

-- 5. Create cluster_conflicts table
create table if not exists cluster_conflicts (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  cluster_a_id    uuid not null references requirement_clusters(id) on delete cascade,
  cluster_b_id    uuid not null references requirement_clusters(id) on delete cascade,
  description     text,
  severity        text check (severity in ('low', 'medium', 'high')),
  resolved        boolean default false,
  resolution_note text,
  created_at      timestamptz default now()
);

-- 6. Create prioritized_requirements table
create table if not exists prioritized_requirements (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid not null references projects(id) on delete cascade,
  cluster_id              uuid not null references requirement_clusters(id) on delete cascade,
  moscow_category         text check (moscow_category in ('must', 'should', 'could', 'wont')),
  ai_rank_score           float,
  ai_reasoning            text,
  manual_override         text,
  stakeholder_vote_count  int default 0,
  created_at              timestamptz default now()
);

-- 7. Create goal_models table
create table if not exists goal_models (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  model_type      text check (model_type in ('kaos', 'istar')),
  model_data      jsonb not null,
  generated_at    timestamptz default now()
);

-- 8. Create export_logs table
create table if not exists export_logs (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  target          text check (target in ('github', 'jira')),
  exported_by     uuid references auth.users(id),
  item_count      int,
  external_url    text,
  created_at      timestamptz default now()
);

-- 9. Indexes for performance
create index if not exists idx_submissions_project
  on stakeholder_submissions(project_id);

create index if not exists idx_submissions_cluster
  on stakeholder_submissions(cluster_id);

create index if not exists idx_clusters_project
  on requirement_clusters(project_id);

create index if not exists idx_conflicts_project
  on cluster_conflicts(project_id);

create index if not exists idx_priorities_project
  on prioritized_requirements(project_id);

-- 10. Row Level Security policies for stakeholder_submissions
-- Allow anyone with valid project token to insert (public submissions)
alter table stakeholder_submissions enable row level security;

create policy "Anyone can insert submissions"
  on stakeholder_submissions for insert
  with check (true);

create policy "Project members can read submissions"
  on stakeholder_submissions for select
  using (
    project_id in (
      select id from projects where owner_user_id = auth.uid()
      union
      select project_id from project_collaborators
        where user_id = auth.uid() and role != 'pending'
    )
  );

-- RLS for requirement_clusters
alter table requirement_clusters enable row level security;

create policy "Project members can read clusters"
  on requirement_clusters for select
  using (
    project_id in (
      select id from projects where owner_user_id = auth.uid()
      union
      select project_id from project_collaborators
        where user_id = auth.uid() and role != 'pending'
    )
  );

create policy "Service role can manage clusters"
  on requirement_clusters for all
  using (true)
  with check (true);

-- RLS for other new tables follows same pattern
alter table cluster_conflicts enable row level security;

create policy "Project members can read conflicts"
  on cluster_conflicts for select
  using (
    project_id in (
      select id from projects where owner_user_id = auth.uid()
      union
      select project_id from project_collaborators
        where user_id = auth.uid() and role != 'pending'
    )
  );

create policy "Service role can manage conflicts"
  on cluster_conflicts for all
  using (true)
  with check (true);

alter table prioritized_requirements enable row level security;

create policy "Project members can read priorities"
  on prioritized_requirements for select
  using (
    project_id in (
      select id from projects where owner_user_id = auth.uid()
      union
      select project_id from project_collaborators
        where user_id = auth.uid() and role != 'pending'
    )
  );

create policy "Service role can manage priorities"
  on prioritized_requirements for all
  using (true)
  with check (true);

alter table goal_models enable row level security;

create policy "Project members can read goal models"
  on goal_models for select
  using (
    project_id in (
      select id from projects where owner_user_id = auth.uid()
      union
      select project_id from project_collaborators
        where user_id = auth.uid() and role != 'pending'
    )
  );

create policy "Service role can manage goal models"
  on goal_models for all
  using (true)
  with check (true);

alter table export_logs enable row level security;

create policy "Project members can read export logs"
  on export_logs for select
  using (
    project_id in (
      select id from projects where owner_user_id = auth.uid()
      union
      select project_id from project_collaborators
        where user_id = auth.uid() and role != 'pending'
    )
  );

create policy "Service role can manage export logs"
  on export_logs for all
  using (true)
  with check (true);
