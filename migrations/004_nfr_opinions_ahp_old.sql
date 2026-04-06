-- NFR, Opinions, and AHP Tables Migration
-- Phase: NFR Generation, Opinion Mining, and AHP Prioritization

-- 1. Auto-generated non-functional requirements
CREATE TABLE project_nfrs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- ISO 25010 categories
    description TEXT NOT NULL, -- The NFR text
    rationale TEXT NOT NULL, -- Why this NFR applies
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Divergent viewpoints within clusters
CREATE TABLE cluster_opinions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES requirement_clusters(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    viewpoint_label TEXT NOT NULL, -- Short label for this opinion camp
    viewpoint_summary TEXT NOT NULL, -- Description of this stance
    stance TEXT NOT NULL CHECK (stance IN ('supportive', 'opposed', 'neutral', 'alternative')),
    submission_ids JSONB NOT NULL, -- Array of submission IDs in this camp
    stakeholder_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. How polarized each cluster is
CREATE TABLE cluster_divergence_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES requirement_clusters(id) ON DELETE CASCADE UNIQUE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    divergence_score NUMERIC(3,2) NOT NULL CHECK (divergence_score >= 0.0 AND divergence_score <= 1.0),
    opinion_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Criteria for AHP prioritization
CREATE TABLE ahp_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., "Business Value", "Implementation Cost"
    description TEXT NOT NULL,
    weight NUMERIC(5,4) DEFAULT 0, -- Computed AHP weight
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, name)
);

-- 5. Pairwise comparison judgments
CREATE TABLE ahp_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    criterion_a_id UUID NOT NULL REFERENCES ahp_criteria(id) ON DELETE CASCADE,
    criterion_b_id UUID NOT NULL REFERENCES ahp_criteria(id) ON DELETE CASCADE,
    value NUMERIC(6,4) NOT NULL, -- Saaty scale 1-9 (or reciprocals)
    judge_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, criterion_a_id, criterion_b_id)
);

-- 6. Scores for each cluster against each criterion
CREATE TABLE ahp_cluster_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cluster_id UUID NOT NULL REFERENCES requirement_clusters(id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES ahp_criteria(id) ON DELETE CASCADE,
    score NUMERIC(3,2) NOT NULL CHECK (score >= 1 AND score <= 9), -- 1-9 scale
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, cluster_id, criterion_id)
);

-- 7. Final computed priority for each cluster
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

-- Indexes for performance
CREATE INDEX idx_project_nfrs_project_status ON project_nfrs(project_id, status);
CREATE INDEX idx_cluster_opinions_project_cluster ON cluster_opinions(project_id, cluster_id);
CREATE INDEX idx_cluster_divergence_project ON cluster_divergence_scores(project_id);
CREATE INDEX idx_ahp_criteria_project ON ahp_criteria(project_id);
CREATE INDEX idx_ahp_comparisons_project ON ahp_comparisons(project_id);
CREATE INDEX idx_ahp_cluster_scores_project_cluster ON ahp_cluster_scores(project_id, cluster_id);
CREATE INDEX idx_ahp_results_project_rank ON ahp_results(project_id, rank);

-- Row Level Security Policies

-- NFRs: readable by project members, modifiable by project members
ALTER TABLE project_nfrs ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_nfrs_select_policy ON project_nfrs
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = project_id 
        AND (p.owner_user_id = auth.uid() OR 
             EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
);

CREATE POLICY project_nfrs_insert_policy ON project_nfrs
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = project_id 
        AND (p.owner_user_id = auth.uid() OR 
             EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
);

CREATE POLICY project_nfrs_update_policy ON project_nfrs
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = project_id 
        AND (p.owner_user_id = auth.uid() OR 
             EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
);

-- Cluster Opinions: readable by project members
ALTER TABLE cluster_opinions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cluster_opinions_select_policy ON cluster_opinions
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = project_id 
        AND (p.owner_user_id = auth.uid() OR 
             EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
);

CREATE POLICY cluster_opinions_insert_policy ON cluster_opinions
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = project_id 
        AND (p.owner_user_id = auth.uid() OR 
             EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
);

-- Cluster Divergence Scores: similar policies
ALTER TABLE cluster_divergence_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY cluster_divergence_scores_select_policy ON cluster_divergence_scores
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = project_id 
        AND (p.owner_user_id = auth.uid() OR 
             EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
);

CREATE POLICY cluster_divergence_scores_insert_policy ON cluster_divergence_scores
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = project_id 
        AND (p.owner_user_id = auth.uid() OR 
             EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
);

-- AHP Tables: similar policies for all
ALTER TABLE ahp_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE ahp_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE ahp_cluster_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ahp_results ENABLE ROW LEVEL SECURITY;

-- AHP Criteria policies
CREATE POLICY ahp_criteria_select_policy ON ahp_criteria
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = project_id 
        AND (p.owner_user_id = auth.uid() OR 
             EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
);

CREATE POLICY ahp_criteria_all_policy ON ahp_criteria
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = project_id 
        AND (p.owner_user_id = auth.uid() OR 
             EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
);

-- AHP Comparisons policies
CREATE POLICY ahp_comparisons_all_policy ON ahp_comparisons
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = project_id 
        AND (p.owner_user_id = auth.uid() OR 
             EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
);

-- AHP Cluster Scores policies
CREATE POLICY ahp_cluster_scores_all_policy ON ahp_cluster_scores
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = project_id 
        AND (p.owner_user_id = auth.uid() OR 
             EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
);

-- AHP Results policies
CREATE POLICY ahp_results_all_policy ON ahp_results
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = project_id 
        AND (p.owner_user_id = auth.uid() OR 
             EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
);