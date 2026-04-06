-- ============================================================
-- MIGRATION: Upgrade legacy database to match current codebase
-- 
-- Run this entire script in:
--   Supabase Dashboard → SQL Editor → New Query → Run
--
-- It is SAFE to run on an existing database:
--   • Uses ADD COLUMN IF NOT EXISTS everywhere
--   • Renames columns only when the old name exists
--   • Creates tables with IF NOT EXISTS
--   • Creates policies with IF NOT EXISTS
-- ============================================================


-- ============================================================
-- 0. Required extensions
-- ============================================================
create extension if not exists vector;


-- ============================================================
-- 1. Alter existing tables to add missing columns
-- ============================================================

-- projects: add domain and stakeholder_link_token
alter table public.projects
  add column if not exists domain text default 'other',
  add column if not exists stakeholder_link_token text default encode(gen_random_bytes(16), 'hex');

-- Backfill token for any existing projects that don't have one
update public.projects
set stakeholder_link_token = encode(gen_random_bytes(16), 'hex')
where stakeholder_link_token is null;


-- stakeholder_submissions: rename content→raw_text, source→stakeholder_role, add new columns
-- Step 1: rename content to raw_text (only if content exists and raw_text does not)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stakeholder_submissions'
      and column_name = 'content'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stakeholder_submissions'
      and column_name = 'raw_text'
  ) then
    alter table public.stakeholder_submissions rename column content to raw_text;
  end if;
end $$;

-- Step 2: rename source to stakeholder_role (only if source exists and stakeholder_role does not)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stakeholder_submissions'
      and column_name = 'source'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stakeholder_submissions'
      and column_name = 'stakeholder_role'
  ) then
    alter table public.stakeholder_submissions rename column source to stakeholder_role;
  end if;
end $$;

-- Step 3: add remaining missing columns
alter table public.stakeholder_submissions
  add column if not exists submitted_by uuid references auth.users(id),
  add column if not exists stakeholder_name text,
  add column if not exists stakeholder_role text,   -- no-op if rename above ran
  add column if not exists embedding vector(1536),
  add column if not exists cluster_id uuid;         -- FK added after requirement_clusters is created


-- project_threads: add is_pinned if missing
alter table public.project_threads
  add column if not exists is_pinned boolean default false;


-- ============================================================
-- 2. Rename project_messages → thread_messages (if needed)
--    The code uses thread_messages; the old DB had project_messages.
--    We keep BOTH names working by creating thread_messages if it
--    doesn't exist, then migrating data from project_messages.
-- ============================================================

-- Create thread_messages if it doesn't exist (code-expected name)
create table if not exists public.thread_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.project_threads(id) on delete cascade,
  user_id    uuid references auth.users(id),
  content    text not null,
  created_at timestamptz default now()
);

-- If project_messages exists, migrate its data into thread_messages
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'project_messages'
  ) then
    -- Copy rows (map 'text' column → 'content')
    insert into public.thread_messages (id, thread_id, user_id, content, created_at)
    select id, thread_id, user_id,
           coalesce(text, '')::text as content,
           created_at
    from public.project_messages
    on conflict (id) do nothing;
  end if;
end $$;


-- ============================================================
-- 3. Create missing tables
-- ============================================================

-- requirement_clusters
create table if not exists public.requirement_clusters (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  label             text not null,
  summary           text,
  submission_count  int default 0,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Now that requirement_clusters exists, add the FK on stakeholder_submissions
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'stakeholder_submissions_cluster_id_fkey'
      and table_name = 'stakeholder_submissions'
  ) then
    alter table public.stakeholder_submissions
      add constraint stakeholder_submissions_cluster_id_fkey
      foreign key (cluster_id) references public.requirement_clusters(id) on delete set null;
  end if;
end $$;

-- cluster_conflicts
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

-- prioritized_requirements
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

-- goal_models
create table if not exists public.goal_models (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  model_type    text check (model_type in ('kaos', 'istar')),
  model_data    jsonb not null,
  generated_at  timestamptz default now()
);

-- export_logs
create table if not exists public.export_logs (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  target        text check (target in ('github', 'jira')),
  exported_by   uuid references auth.users(id),
  item_count    int,
  external_url  text,
  created_at    timestamptz default now()
);

-- processed_requirements (from migration 006)
create table if not exists public.processed_requirements (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  submission_id uuid not null references public.stakeholder_submissions(id) on delete cascade,
  text          text not null,
  embedding     vector(1536),
  cluster_id    uuid references public.requirement_clusters(id) on delete set null,
  created_at    timestamptz default now()
);


-- ============================================================
-- 4. Enable RLS on all new tables
-- ============================================================
alter table public.thread_messages         enable row level security;
alter table public.requirement_clusters    enable row level security;
alter table public.cluster_conflicts       enable row level security;
alter table public.prioritized_requirements enable row level security;
alter table public.goal_models             enable row level security;
alter table public.export_logs             enable row level security;
alter table public.processed_requirements  enable row level security;


-- ============================================================
-- 5. RLS Policies (IF NOT EXISTS via DO blocks)
-- ============================================================

-- Helper: project member check used in multiple policies
-- (inline in each policy for portability)

-- THREAD MESSAGES
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Project members can read messages' and tablename = 'thread_messages') then
    execute $p$
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
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Authenticated users can post messages' and tablename = 'thread_messages') then
    execute $p$
      create policy "Authenticated users can post messages"
        on public.thread_messages for insert with check (auth.uid() = user_id);
    $p$;
  end if;
end $$;

-- REQUIREMENT CLUSTERS
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Project members can read clusters' and tablename = 'requirement_clusters') then
    execute $p$
      create policy "Project members can read clusters"
        on public.requirement_clusters for select
        using (project_id in (
          select id from public.projects where owner_user_id = auth.uid()
          union
          select project_id from public.project_collaborators
            where user_id = auth.uid() and role != 'pending'
        ));
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Service role can manage clusters' and tablename = 'requirement_clusters') then
    execute $p$
      create policy "Service role can manage clusters"
        on public.requirement_clusters for all using (true) with check (true);
    $p$;
  end if;
end $$;

-- CLUSTER CONFLICTS
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Project members can read conflicts' and tablename = 'cluster_conflicts') then
    execute $p$
      create policy "Project members can read conflicts"
        on public.cluster_conflicts for select
        using (project_id in (
          select id from public.projects where owner_user_id = auth.uid()
          union
          select project_id from public.project_collaborators
            where user_id = auth.uid() and role != 'pending'
        ));
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Service role can manage conflicts' and tablename = 'cluster_conflicts') then
    execute $p$
      create policy "Service role can manage conflicts"
        on public.cluster_conflicts for all using (true) with check (true);
    $p$;
  end if;
end $$;

-- PRIORITIZED REQUIREMENTS
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Project members can read priorities' and tablename = 'prioritized_requirements') then
    execute $p$
      create policy "Project members can read priorities"
        on public.prioritized_requirements for select
        using (project_id in (
          select id from public.projects where owner_user_id = auth.uid()
          union
          select project_id from public.project_collaborators
            where user_id = auth.uid() and role != 'pending'
        ));
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Service role can manage priorities' and tablename = 'prioritized_requirements') then
    execute $p$
      create policy "Service role can manage priorities"
        on public.prioritized_requirements for all using (true) with check (true);
    $p$;
  end if;
end $$;

-- PROCESSED REQUIREMENTS
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Service role can manage processed requirements' and tablename = 'processed_requirements') then
    execute $p$
      create policy "Service role can manage processed requirements"
        on public.processed_requirements for all using (true) with check (true);
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Project members can read processed requirements' and tablename = 'processed_requirements') then
    execute $p$
      create policy "Project members can read processed requirements"
        on public.processed_requirements for select
        using (project_id in (
          select id from public.projects where owner_user_id = auth.uid()
          union
          select project_id from public.project_collaborators
            where user_id = auth.uid() and role != 'pending'
        ));
    $p$;
  end if;
end $$;

-- SUBMISSIONS: ensure anyone can insert (needed for public stakeholder form)
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Anyone can insert submissions' and tablename = 'stakeholder_submissions') then
    execute $p$
      create policy "Anyone can insert submissions"
        on public.stakeholder_submissions for insert with check (true);
    $p$;
  end if;
end $$;


-- ============================================================
-- 6. Indexes
-- ============================================================
create index if not exists idx_submissions_project    on public.stakeholder_submissions(project_id);
create index if not exists idx_submissions_cluster    on public.stakeholder_submissions(cluster_id);
create index if not exists idx_clusters_project       on public.requirement_clusters(project_id);
create index if not exists idx_conflicts_project      on public.cluster_conflicts(project_id);
create index if not exists idx_priorities_project     on public.prioritized_requirements(project_id);
create index if not exists idx_proc_reqs_project      on public.processed_requirements(project_id);
create index if not exists idx_proc_reqs_submission   on public.processed_requirements(submission_id);
create index if not exists idx_proc_reqs_cluster      on public.processed_requirements(cluster_id);
create index if not exists idx_messages_thread        on public.thread_messages(thread_id);
create index if not exists idx_threads_project        on public.project_threads(project_id);


-- ============================================================
-- 7. Auto-create user profile on signup (idempotent)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- Done! Run SELECT to verify critical tables exist:
-- ============================================================
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
