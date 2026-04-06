-- ============================================================
-- Full schema for Collaborative Requirements Platform
-- Run on a fresh Supabase project: SQL Editor > New Query > Run
--
-- Structure:
--   1. Extensions
--   2. Tables (in dependency order)
--   3. RLS policies (after all tables exist)
--   4. Indexes and triggers
-- ============================================================

-- ============================================================
-- 1. Extensions
-- ============================================================
create extension if not exists vector;

-- ============================================================
-- 2. Tables (Created in order of dependency)
-- ============================================================

-- Profiles linked to Auth
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  first_name  text,
  last_name   text,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- Projects Table
create table if not exists public.projects (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  description             text,
  domain                  text default 'other',
  owner_user_id           uuid not null references auth.users(id) on delete cascade,
  stakeholder_link_token  text default encode(gen_random_bytes(16), 'hex'),
  created_at              timestamptz default now()
);

-- Collaborators Table (Must exist before Project RLS policies)
create table if not exists public.project_collaborators (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text default 'pending' check (role in ('owner', 'editor', 'viewer', 'pending')),
  created_at  timestamptz default now(),
  unique(project_id, user_id)
);

-- Threads and Messages
create table if not exists public.project_threads (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  title       text not null,
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now()
);

create table if not exists public.thread_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.project_threads(id) on delete cascade,
  user_id     uuid references auth.users(id),
  content     text not null,
  created_at  timestamptz default now()
);

-- Requirements and Tasks
create table if not exists public.requirements (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  text        text not null,
  priority    int default 2,
  status      text default 'pending',
  created_at  timestamptz default now()
);

create table if not exists public.tasks (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  requirement_id  uuid references public.requirements(id) on delete set null,
  name            text not null,
  description     text,
  priority        int default 2,
  status          text default 'pending',
  due_date        date,
  created_at      timestamptz default now()
);

-- Clusters and Submissions
create table if not exists public.requirement_clusters (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  label             text not null,
  summary           text,
  submission_count  int default 0,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table if not exists public.stakeholder_submissions (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  submitted_by      uuid references auth.users(id),
  stakeholder_name  text,
  stakeholder_role  text,
  raw_text          text not null,
  embedding         vector(1536),
  cluster_id        uuid references public.requirement_clusters(id) on delete set null,
  created_at        timestamptz default now()
);

-- Conflicts, Priorities, Goals, and Export Logs
create table if not exists public.cluster_conflicts (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  cluster_a_id    uuid not null references public.requirement_clusters(id) on delete cascade,
  cluster_b_id    uuid not null references public.requirement_clusters(id) on delete cascade,
  description     text,
  severity        text check (severity in ('low', 'medium', 'high')),
  resolved        boolean default false,
  resolution_note text,
  created_at      timestamptz default now()
);

create table if not exists public.prioritized_requirements (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid not null references public.projects(id) on delete cascade,
  cluster_id              uuid not null references public.requirement_clusters(id) on delete cascade,
  moscow_category         text check (moscow_category in ('must', 'should', 'could', 'wont')),
  ai_rank_score           float,
  ai_reasoning            text,
  manual_override         text,
  stakeholder_vote_count  int default 0,
  created_at              timestamptz default now()
);

create table if not exists public.goal_models (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  model_type    text check (model_type in ('kaos', 'istar')),
  model_data    jsonb not null,
  generated_at  timestamptz default now()
);

create table if not exists public.export_logs (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  target        text check (target in ('github', 'jira')),
  exported_by   uuid references auth.users(id),
  item_count    int,
  external_url  text,
  created_at    timestamptz default now()
);

-- ============================================================
-- 3. Row Level Security and Policies
-- ============================================================

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.project_collaborators enable row level security;
alter table public.project_threads enable row level security;
alter table public.thread_messages enable row level security;
alter table public.requirements enable row level security;
alter table public.tasks enable row level security;
alter table public.stakeholder_submissions enable row level security;
alter table public.requirement_clusters enable row level security;
alter table public.cluster_conflicts enable row level security;
alter table public.prioritized_requirements enable row level security;
alter table public.goal_models enable row level security;
alter table public.export_logs enable row level security;

-- USERS
create policy "Users can read own profile"
  on public.users for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.users for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.users for insert with check (auth.uid() = id);
create policy "Users can read any profile"
  on public.users for select using (true);

-- PROJECTS
-- Read is public (needed for stakeholder submission page).
-- Write operations restricted to owner. No circular collaborator check.
create policy "Anyone can read projects"
  on public.projects for select using (true);
create policy "Owners can insert projects"
  on public.projects for insert with check (auth.uid() = owner_user_id);
create policy "Owners can update projects"
  on public.projects for update using (auth.uid() = owner_user_id);
create policy "Owners can delete projects"
  on public.projects for delete using (auth.uid() = owner_user_id);

-- COLLABORATORS
create policy "Project owners can manage collaborators"
  on public.project_collaborators for all
  using (project_id in (select id from public.projects where owner_user_id = auth.uid()));
create policy "Users can see their own collaborations"
  on public.project_collaborators for select using (user_id = auth.uid());
create policy "Users can update their own collaboration"
  on public.project_collaborators for update using (user_id = auth.uid());

-- THREADS
create policy "Project members can read threads"
  on public.project_threads for select
  using (project_id in (
    select id from public.projects where owner_user_id = auth.uid()
    union
    select project_id from public.project_collaborators
      where user_id = auth.uid() and role != 'pending'
  ));
create policy "Project members can create threads"
  on public.project_threads for insert
  with check (project_id in (
    select id from public.projects where owner_user_id = auth.uid()
    union
    select project_id from public.project_collaborators
      where user_id = auth.uid() and role != 'pending'
  ));
create policy "Thread creators can update"
  on public.project_threads for update using (created_by = auth.uid());
create policy "Thread creators can delete"
  on public.project_threads for delete using (created_by = auth.uid());

-- MESSAGES
create policy "Project members can read messages"
  on public.thread_messages for select
  using (thread_id in (
    select pt.id from public.project_threads pt
    join public.projects p on p.id = pt.project_id
    where p.owner_user_id = auth.uid()
    union
    select pt.id from public.project_threads pt
    join public.project_collaborators pc on pc.project_id = pt.project_id
    where pc.user_id = auth.uid() and pc.role != 'pending'
  ));
create policy "Authenticated users can post messages"
  on public.thread_messages for insert with check (auth.uid() = user_id);

-- REQUIREMENTS
create policy "Project members can read requirements"
  on public.requirements for select
  using (project_id in (
    select id from public.projects where owner_user_id = auth.uid()
    union
    select project_id from public.project_collaborators
      where user_id = auth.uid() and role != 'pending'
  ));
create policy "Project members can manage requirements"
  on public.requirements for all
  using (project_id in (
    select id from public.projects where owner_user_id = auth.uid()
    union
    select project_id from public.project_collaborators
      where user_id = auth.uid() and role in ('owner', 'editor')
  ));

-- TASKS
create policy "Project members can read tasks"
  on public.tasks for select
  using (project_id in (
    select id from public.projects where owner_user_id = auth.uid()
    union
    select project_id from public.project_collaborators
      where user_id = auth.uid() and role != 'pending'
  ));
create policy "Project members can manage tasks"
  on public.tasks for all
  using (project_id in (
    select id from public.projects where owner_user_id = auth.uid()
    union
    select project_id from public.project_collaborators
      where user_id = auth.uid() and role in ('owner', 'editor')
  ));

-- SUBMISSIONS
create policy "Anyone can insert submissions"
  on public.stakeholder_submissions for insert with check (true);
create policy "Project members can read submissions"
  on public.stakeholder_submissions for select
  using (project_id in (
    select id from public.projects where owner_user_id = auth.uid()
    union
    select project_id from public.project_collaborators
      where user_id = auth.uid() and role != 'pending'
  ));

-- CLUSTERS
create policy "Project members can read clusters"
  on public.requirement_clusters for select
  using (project_id in (
    select id from public.projects where owner_user_id = auth.uid()
    union
    select project_id from public.project_collaborators
      where user_id = auth.uid() and role != 'pending'
  ));
create policy "Service role can manage clusters"
  on public.requirement_clusters for all using (true) with check (true);

-- CONFLICTS
create policy "Project members can read conflicts"
  on public.cluster_conflicts for select
  using (project_id in (
    select id from public.projects where owner_user_id = auth.uid()
    union
    select project_id from public.project_collaborators
      where user_id = auth.uid() and role != 'pending'
  ));
create policy "Service role can manage conflicts"
  on public.cluster_conflicts for all using (true) with check (true);

-- PRIORITIES
create policy "Project members can read priorities"
  on public.prioritized_requirements for select
  using (project_id in (
    select id from public.projects where owner_user_id = auth.uid()
    union
    select project_id from public.project_collaborators
      where user_id = auth.uid() and role != 'pending'
  ));
create policy "Service role can manage priorities"
  on public.prioritized_requirements for all using (true) with check (true);

-- GOAL MODELS
create policy "Project members can read goal models"
  on public.goal_models for select
  using (project_id in (
    select id from public.projects where owner_user_id = auth.uid()
    union
    select project_id from public.project_collaborators
      where user_id = auth.uid() and role != 'pending'
  ));
create policy "Service role can manage goal models"
  on public.goal_models for all using (true) with check (true);

-- EXPORT LOGS
create policy "Project members can read export logs"
  on public.export_logs for select
  using (project_id in (
    select id from public.projects where owner_user_id = auth.uid()
    union
    select project_id from public.project_collaborators
      where user_id = auth.uid() and role != 'pending'
  ));
create policy "Service role can manage export logs"
  on public.export_logs for all using (true) with check (true);

-- ============================================================
-- 4. Indexes and Triggers
-- ============================================================

create index if not exists idx_submissions_project on public.stakeholder_submissions(project_id);
create index if not exists idx_submissions_cluster on public.stakeholder_submissions(cluster_id);
create index if not exists idx_clusters_project on public.requirement_clusters(project_id);
create index if not exists idx_conflicts_project on public.cluster_conflicts(project_id);
create index if not exists idx_priorities_project on public.prioritized_requirements(project_id);
create index if not exists idx_tasks_project on public.tasks(project_id);
create index if not exists idx_requirements_project on public.requirements(project_id);
create index if not exists idx_collaborators_user on public.project_collaborators(user_id);
create index if not exists idx_collaborators_project on public.project_collaborators(project_id);
create index if not exists idx_threads_project on public.project_threads(project_id);
create index if not exists idx_messages_thread on public.thread_messages(thread_id);

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
