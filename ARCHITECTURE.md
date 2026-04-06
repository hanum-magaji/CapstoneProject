# Architecture: Collaborative Requirements Elicitation and Prioritization Platform

## Project Summary

A web-based platform where multiple stakeholders submit needs and concerns in natural
language. The system uses NLP to cluster similar inputs, detect conflicts, and support
structured prioritization. Visual goal models help teams reason about stakeholder
alignment. Results can be exported to GitHub Issues or Jira.

The demonstration use case is a smart-city civic portal (e.g., e-permitting, transit
tracking, civic engagement).

---

## What We Keep From the Existing Codebase

The current repository already provides a working foundation. The following components
carry forward with minor modifications:

| Existing Component        | Reuse Plan                                              |
|---------------------------|---------------------------------------------------------|
| Supabase Auth             | Keep as-is. Add a "stakeholder" role alongside "owner". |
| Project CRUD              | Keep. Rename internally to "Elicitation Session".       |
| Collaborators / Invites   | Keep. Extend to support stakeholder invitation links.   |
| Inbox                     | Keep. Will also surface clustering review notifications.|
| Discussions / Threads     | Keep. Useful for stakeholder deliberation.              |
| Dashboard                 | Keep shell. Replace content with elicitation metrics.   |
| Settings / Profile        | Keep as-is.                                             |
| Auth Navbar / Sidebar     | Keep. Add new navigation entries for new pages.         |
| Supabase client setup     | Keep as-is.                                             |
| Vercel serverless (api/)  | Keep pattern. Replace AI endpoints with new ones.       |

The following components are removed or replaced:

| Existing Component        | Action                                                  |
|---------------------------|---------------------------------------------------------|
| AI requirement generation | Replace with NLP clustering and conflict detection.     |
| AI task generation        | Replace with AI-assisted prioritization.                |
| ProjectTimeline.jsx       | Delete (duplicate file). Replace with visual modeling.  |
| PostLoginNavbar.jsx       | Delete (unused).                                        |
| Pricing page              | Keep for presentation but not a deliverable.            |

---

## System Architecture

```
+------------------------------------------------------------------+
|                        FRONTEND (React + Vite)                    |
|                                                                   |
|  Public Pages          App Pages              Project Pages       |
|  +-----------+     +---------------+     +-------------------+    |
|  | Home      |     | Dashboard     |     | Submissions       |    |
|  | Pricing   |     | Projects List |     | Clusters          |    |
|  | Auth      |     | Inbox         |     | Conflicts         |    |
|  |           |     | Settings      |     | Prioritization    |    |
|  |           |     |               |     | Goal Model        |    |
|  |           |     |               |     | Export            |    |
|  |           |     |               |     | Collaborators     |    |
|  |           |     |               |     | Discussions       |    |
|  |           |     |               |     | Settings          |    |
|  +-----------+     +---------------+     +-------------------+    |
+------------------------------|------------------------------------+
                               |
                      REST / Serverless
                               |
+------------------------------|------------------------------------+
|                    API LAYER (Vercel Serverless)                   |
|                                                                   |
|  +------------------+  +------------------+  +-----------------+  |
|  | /api/cluster     |  | /api/conflicts   |  | /api/prioritize |  |
|  | Embed + cluster  |  | Detect conflicts |  | AI ranking      |  |
|  | stakeholder      |  | between clusters |  | with MoSCoW     |  |
|  | submissions      |  |                  |  |                 |  |
|  +------------------+  +------------------+  +-----------------+  |
|                                                                   |
|  +------------------+  +------------------+  +-----------------+  |
|  | /api/goalmodel   |  | /api/export      |  | /api/submit     |  |
|  | Generate KAOS    |  | GitHub Issues    |  | Save stakeholder|  |
|  | goal structure   |  | or Jira export   |  | input + embed   |  |
|  +------------------+  +------------------+  +-----------------+  |
+------------------------------|------------------------------------+
                               |
              +----------------+----------------+
              |                                 |
+-------------|------------+   +----------------|---------------+
|        SUPABASE          |   |           OPENAI API           |
|                          |   |                                |
|  Auth (users, sessions)  |   |  text-embedding-3-small        |
|  Database (PostgreSQL)   |   |    -> vector embeddings        |
|  Storage (avatars, docs) |   |                                |
|  pgvector extension      |   |  gpt-4o-mini                   |
|    -> embedding storage  |   |    -> conflict detection       |
|    -> similarity search  |   |    -> prioritization ranking   |
|                          |   |    -> goal model generation    |
+--------------------------+   +--------------------------------+
```

---

## Database Schema (Supabase PostgreSQL)

### Existing Tables (kept as-is or with minor changes)

```
users
  id              uuid  PK
  email           text
  first_name      text
  last_name       text
  avatar_url      text
  created_at      timestamp

projects
  id              uuid  PK
  name            text
  description     text
  owner_user_id   uuid  FK -> users.id
  created_at      timestamp
  -- ADD: domain text (e.g., "transit", "e-permitting", "civic-engagement")
  -- ADD: stakeholder_link_token text (unique invite token for public submission)

project_collaborators
  id              uuid  PK
  project_id      uuid  FK -> projects.id
  user_id         uuid  FK -> users.id
  role            text  ("owner", "editor", "viewer", "pending")
  created_at      timestamp

project_threads
  (keep as-is for discussions)

thread_messages
  (keep as-is for discussions)
```

### New Tables

```
stakeholder_submissions
  id              uuid  PK  default gen_random_uuid()
  project_id      uuid  FK -> projects.id
  submitted_by    uuid  FK -> users.id  (nullable for anonymous)
  stakeholder_name text  (display name, for anonymous or named input)
  stakeholder_role text  (e.g., "resident", "city-planner", "transit-user")
  raw_text        text  NOT NULL  (the original natural-language input)
  embedding       vector(1536)  (OpenAI text-embedding-3-small output)
  cluster_id      uuid  FK -> requirement_clusters.id  (null until clustered)
  created_at      timestamp

requirement_clusters
  id              uuid  PK  default gen_random_uuid()
  project_id      uuid  FK -> projects.id
  label           text  (AI-generated cluster name, e.g., "Real-time transit updates")
  summary         text  (AI-generated summary of grouped submissions)
  submission_count int
  created_at      timestamp
  updated_at      timestamp

cluster_conflicts
  id              uuid  PK  default gen_random_uuid()
  project_id      uuid  FK -> projects.id
  cluster_a_id    uuid  FK -> requirement_clusters.id
  cluster_b_id    uuid  FK -> requirement_clusters.id
  description     text  (AI explanation of the conflict)
  severity        text  ("low", "medium", "high")
  resolved        boolean  default false
  resolution_note text
  created_at      timestamp

prioritized_requirements
  id              uuid  PK  default gen_random_uuid()
  project_id      uuid  FK -> projects.id
  cluster_id      uuid  FK -> requirement_clusters.id
  moscow_category text  ("must", "should", "could", "wont")
  ai_rank_score   float  (0.0 to 1.0, AI-computed importance)
  ai_reasoning    text  (why the AI ranked it this way)
  manual_override text  (null unless a human overrides the AI)
  stakeholder_vote_count int  default 0
  created_at      timestamp

goal_models
  id              uuid  PK  default gen_random_uuid()
  project_id      uuid  FK -> projects.id
  model_type      text  ("kaos" or "istar")
  model_data      jsonb  (structured graph: nodes + edges)
  generated_at    timestamp

export_logs
  id              uuid  PK  default gen_random_uuid()
  project_id      uuid  FK -> projects.id
  target          text  ("github" or "jira")
  exported_by     uuid  FK -> users.id
  item_count      int
  external_url    text  (link to created GitHub issues, etc.)
  created_at      timestamp
```

### Required Supabase Extension

```sql
-- Enable pgvector for embedding storage and similarity search
create extension if not exists vector;
```

---

## API Endpoints (Vercel Serverless)

Each endpoint lives in the `api/` directory and follows the existing pattern.

### POST /api/submit

Receives a stakeholder submission, generates an embedding, stores both.

```
Input:  { project_id, raw_text, stakeholder_name, stakeholder_role }
Steps:  1. Call OpenAI text-embedding-3-small to embed raw_text
        2. Insert into stakeholder_submissions with embedding
Output: { id, created_at }
```

### POST /api/cluster

Runs clustering on all submissions for a project.

```
Input:  { project_id }
Steps:  1. Fetch all submissions with embeddings for this project
        2. Compute pairwise cosine similarity
        3. Run agglomerative clustering (threshold-based)
        4. For each cluster, call GPT to generate a label and summary
        5. Upsert requirement_clusters
        6. Update each submission with its cluster_id
Output: { clusters: [{ id, label, summary, count }] }
```

### POST /api/conflicts

Detects conflicts between clusters.

```
Input:  { project_id }
Steps:  1. Fetch all clusters with their summaries
        2. Send cluster pairs to GPT with prompt:
           "Identify any conflicting goals between these requirement groups.
            Return conflicts with severity and explanation."
        3. Insert into cluster_conflicts
Output: { conflicts: [{ cluster_a, cluster_b, description, severity }] }
```

### POST /api/prioritize

AI-assisted MoSCoW prioritization.

```
Input:  { project_id, context (optional domain-specific constraints) }
Steps:  1. Fetch all clusters with summaries and submission counts
        2. Send to GPT with prompt:
           "Prioritize these requirements using MoSCoW for a smart-city
            civic portal. Consider stakeholder vote counts, submission
            frequency, and feasibility."
        3. Upsert prioritized_requirements
Output: { priorities: [{ cluster_id, moscow, rank_score, reasoning }] }
```

### POST /api/goalmodel

Generates a KAOS goal model from prioritized requirements.

```
Input:  { project_id, model_type ("kaos" or "istar") }
Steps:  1. Fetch prioritized clusters
        2. Send to GPT with prompt:
           "Generate a KAOS goal decomposition model from these requirements.
            Return as structured JSON with nodes (goals, softgoals, agents,
            obstacles) and edges (refinement, contribution, obstruction)."
        3. Insert into goal_models
Output: { model_data: { nodes: [...], edges: [...] } }
```

### POST /api/export

Exports prioritized requirements to GitHub Issues.

```
Input:  { project_id, target ("github"), repo_owner, repo_name, token }
Steps:  1. Fetch prioritized clusters ordered by rank
        2. For each cluster, create a GitHub Issue via GitHub API
           Title: cluster label
           Body: summary + MoSCoW category + stakeholder count + reasoning
           Labels: moscow category
        3. Log export
Output: { exported_count, url }
```

---

## Frontend Pages (New and Modified)

### New Pages

```
src/pages/StakeholderSubmit.jsx
  Public-facing submission form. Accessed via a shareable link with
  the project's stakeholder_link_token. No login required for submission.
  Fields: name (optional), role dropdown, free-text input area.
  Calls POST /api/submit on submit.

src/pages/Clusters.jsx
  Displays clustered requirements as grouped cards. Each cluster shows
  its label, summary, submission count, and expandable list of original
  submissions. A "Run Clustering" button triggers POST /api/cluster.

src/pages/Conflicts.jsx
  Shows detected conflicts between clusters. Each conflict card shows
  the two conflicting clusters, severity badge, AI explanation, and
  a resolution toggle with notes field. "Detect Conflicts" button
  triggers POST /api/conflicts.

src/pages/Prioritization.jsx
  MoSCoW board with four columns (Must, Should, Could, Won't).
  Clusters are placed in columns based on AI ranking. Users can drag
  to override. Each card shows rank score, AI reasoning, and vote count.
  "Run AI Prioritization" button triggers POST /api/prioritize.
  Stakeholders can vote on clusters to influence ranking.

src/pages/GoalModel.jsx
  Renders a KAOS or i* goal model as an interactive graph.
  Uses a lightweight graph rendering library (e.g., reactflow or dagre).
  "Generate Model" button triggers POST /api/goalmodel.
  Nodes are color-coded by type (goal, softgoal, agent, obstacle).

src/pages/Export.jsx
  Form to configure and trigger export. Select target (GitHub or Jira),
  enter credentials or token, preview what will be exported, then execute.
  Shows export history from export_logs.
```

### Modified Pages

```
src/pages/Dashboard.jsx
  Replace generic stats with elicitation metrics:
  - Total submissions received
  - Number of clusters formed
  - Conflicts detected (unresolved count)
  - Prioritization status (complete or pending)
  - Recent stakeholder activity

src/pages/ProjectDetail.jsx
  Project overview showing:
  - Submission count and recent submissions
  - Cluster summary
  - Shareable stakeholder link
  - Quick links to clusters, conflicts, prioritization, goal model

src/pages/CreateProject.jsx
  Add a "domain" field (dropdown: transit, e-permitting, civic-engagement,
  public-safety, other). Remove the AI requirement generation prompt.
  Auto-generate the stakeholder_link_token on project creation.
```

### Updated Sidebar Navigation

```
src/components/ProjectSidebar.jsx
  Current:                    Updated:
  - Overview                  - Overview
  - Requirements              - Submissions        (new)
  - Tasks                     - Clusters           (new)
  - Calendar                  - Conflicts          (new)
  - Collaborators             - Prioritization     (new)
  - Discussions               - Goal Model         (new)
  - Timeline                  - Export             (new)
  - Settings                  - Collaborators
                              - Discussions
                              - Settings
```

---

## Clustering Algorithm (api/cluster.js)

The clustering runs server-side in the Vercel function. The approach:

1. Fetch all submission embeddings for the project from Supabase.
2. Compute a cosine similarity matrix between all embedding pairs.
3. Apply agglomerative clustering with a similarity threshold (default 0.78).
4. For each resulting cluster, select the 5 most representative submissions
   (closest to the cluster centroid).
5. Send the representative submissions to GPT to generate a human-readable
   cluster label and summary.
6. Save clusters and update submission assignments.

This avoids heavy ML dependencies. Cosine similarity and agglomerative
clustering can be implemented in ~60 lines of JavaScript using basic
linear algebra on the 1536-dimensional embedding vectors.

For projects with fewer than 200 submissions, this runs comfortably
within Vercel's 60-second serverless timeout.

---

## Build Order

Each phase produces a working, testable increment. No phase depends
on an incomplete prior phase.

### Phase 1: Database and Submission Portal
- Enable pgvector in Supabase
- Create new tables (stakeholder_submissions, requirement_clusters, etc.)
- Add domain and stakeholder_link_token columns to projects
- Build StakeholderSubmit.jsx (public submission form)
- Build /api/submit (embedding generation + storage)
- Update CreateProject.jsx to generate shareable link
- Update ProjectDetail.jsx to show submission count and link

### Phase 2: Clustering Engine
- Build /api/cluster (embedding retrieval, similarity, clustering, labeling)
- Build Clusters.jsx (cluster display with expandable submissions)
- Update sidebar navigation
- Update Dashboard.jsx with submission and cluster metrics

### Phase 3: Conflict Detection
- Build /api/conflicts (GPT-based conflict analysis between clusters)
- Build Conflicts.jsx (conflict cards with severity and resolution)

### Phase 4: Prioritization
- Build /api/prioritize (MoSCoW ranking with AI reasoning)
- Build Prioritization.jsx (four-column board with drag override and voting)

### Phase 5: Goal Modeling
- Build /api/goalmodel (KAOS/i* structure generation)
- Build GoalModel.jsx (interactive graph rendering)
- Integrate a graph library (reactflow or dagre-d3)

### Phase 6: Export and Polish
- Build /api/export (GitHub Issues creation via API)
- Build Export.jsx (configuration form and history)
- Clean up unused files (ProjectTimeline.jsx, PostLoginNavbar.jsx)
- Remove old AI generation endpoints (generateRequirements, generateTasks)
- Final smart-city theming pass on Home.jsx and Pricing.jsx
- Error handling and loading states across all pages

---

## File Map (Final State)

```
checklist/
  api/
    submit.js                 -- stakeholder submission + embedding
    cluster.js                -- agglomerative clustering pipeline
    conflicts.js              -- GPT conflict detection
    prioritize.js             -- MoSCoW AI ranking
    goalmodel.js              -- KAOS/i* generation
    export.js                 -- GitHub/Jira export
  src/
    components/
      AuthNavbar.jsx          -- (kept)
      PreLoginNavbar.jsx      -- (kept)
      ProjectSidebar.jsx      -- (updated navigation)
      ProjectSidebar.css
      AuthNavbar.css
    context/
      AuthContext.jsx          -- (kept)
    lib/
      supabase.js              -- (kept)
      clustering.js            -- cosine similarity + agglomerative clustering
    pages/
      Home.jsx                 -- (updated: smart-city theming)
      AuthPage.jsx             -- (kept)
      Dashboard.jsx            -- (updated: elicitation metrics)
      Projects.jsx             -- (kept)
      CreateProject.jsx        -- (updated: domain field, stakeholder link)
      ProjectDetail.jsx        -- (updated: submission overview)
      StakeholderSubmit.jsx    -- NEW: public submission form
      Clusters.jsx             -- NEW: clustered requirements view
      Conflicts.jsx            -- NEW: conflict detection view
      Prioritization.jsx       -- NEW: MoSCoW board
      GoalModel.jsx            -- NEW: KAOS/i* graph
      Export.jsx               -- NEW: GitHub/Jira export
      ProjectCollaborators.jsx -- (kept)
      Discussions.jsx          -- (kept)
      ThreadView.jsx           -- (kept)
      Inbox.jsx                -- (kept)
      Settings.jsx             -- (kept)
      ProjectSettings.jsx      -- (kept)
      ProjectCalendar.jsx      -- (kept, optional for task deadlines)
    App.jsx                    -- (updated routes)
    main.jsx                   -- (kept)
    index.css                  -- (kept)
  index.html                   -- (kept)
  package.json                 -- (add reactflow dependency)
  vite.config.js               -- (kept)
  .env                         -- (kept, add any new keys)
```

---

## Notes

- All AI calls go through Vercel serverless functions. No AI API keys
  are exposed to the client.
- The pgvector extension in Supabase handles embedding storage and
  nearest-neighbor queries natively in PostgreSQL.
- The clustering algorithm is implemented in plain JavaScript without
  external ML libraries, keeping the serverless bundle small.
- The system supports both authenticated and anonymous stakeholder
  submissions via the shareable link token.
- Each phase is independently deployable and testable.
