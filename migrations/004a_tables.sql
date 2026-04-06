-- Part 1: Create all tables

CREATE TABLE project_nfrs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    rationale TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cluster_opinions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES requirement_clusters(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    viewpoint_label TEXT NOT NULL,
    viewpoint_summary TEXT NOT NULL,
    stance TEXT NOT NULL CHECK (stance IN ('supportive', 'opposed', 'neutral', 'alternative')),
    submission_ids JSONB NOT NULL,
    stakeholder_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cluster_divergence_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES requirement_clusters(id) ON DELETE CASCADE UNIQUE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    divergence_score NUMERIC(3,2) NOT NULL CHECK (divergence_score >= 0.0 AND divergence_score <= 1.0),
    opinion_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ahp_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    weight NUMERIC(5,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, name)
);

CREATE TABLE ahp_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    criterion_a_id UUID NOT NULL REFERENCES ahp_criteria(id) ON DELETE CASCADE,
    criterion_b_id UUID NOT NULL REFERENCES ahp_criteria(id) ON DELETE CASCADE,
    value NUMERIC(6,4) NOT NULL,
    judge_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, criterion_a_id, criterion_b_id)
);

CREATE TABLE ahp_cluster_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cluster_id UUID NOT NULL REFERENCES requirement_clusters(id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES ahp_criteria(id) ON DELETE CASCADE,
    score NUMERIC(3,2) NOT NULL CHECK (score >= 1 AND score <= 9),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, cluster_id, criterion_id)
);

CREATE TABLE ahp_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cluster_id UUID NOT NULL REFERENCES requirement_clusters(id) ON DELETE CASCADE,
    priority_score NUMERIC(8,6) NOT NULL,
    rank INTEGER NOT NULL,
    consistency_ratio NUMERIC(5,4) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, cluster_id)
);
