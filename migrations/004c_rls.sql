-- Part 3: RLS Policies

ALTER TABLE project_nfrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cluster_opinions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cluster_divergence_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ahp_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE ahp_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE ahp_cluster_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ahp_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_nfrs_select_policy ON project_nfrs
FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND (p.owner_user_id = auth.uid() OR EXISTS (SELECT 1 FROM project_collaborators pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())))
);

CREATE POLICY project_nfrs_insert_policy ON project_nfrs
FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND (p.owner_user_id = auth.uid() OR EXISTS (SELECT 1 FROM project_collaborators pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())))
);

CREATE POLICY project_nfrs_update_policy ON project_nfrs
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND (p.owner_user_id = auth.uid() OR EXISTS (SELECT 1 FROM project_collaborators pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())))
);

CREATE POLICY cluster_opinions_select_policy ON cluster_opinions
FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND (p.owner_user_id = auth.uid() OR EXISTS (SELECT 1 FROM project_collaborators pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())))
);

CREATE POLICY cluster_opinions_insert_policy ON cluster_opinions
FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND (p.owner_user_id = auth.uid() OR EXISTS (SELECT 1 FROM project_collaborators pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())))
);

CREATE POLICY cluster_divergence_scores_select_policy ON cluster_divergence_scores
FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND (p.owner_user_id = auth.uid() OR EXISTS (SELECT 1 FROM project_collaborators pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())))
);

CREATE POLICY cluster_divergence_scores_insert_policy ON cluster_divergence_scores
FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND (p.owner_user_id = auth.uid() OR EXISTS (SELECT 1 FROM project_collaborators pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())))
);

CREATE POLICY ahp_criteria_select_policy ON ahp_criteria
FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND (p.owner_user_id = auth.uid() OR EXISTS (SELECT 1 FROM project_collaborators pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())))
);

CREATE POLICY ahp_criteria_all_policy ON ahp_criteria
FOR ALL USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND (p.owner_user_id = auth.uid() OR EXISTS (SELECT 1 FROM project_collaborators pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())))
);

CREATE POLICY ahp_comparisons_all_policy ON ahp_comparisons
FOR ALL USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND (p.owner_user_id = auth.uid() OR EXISTS (SELECT 1 FROM project_collaborators pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())))
);

CREATE POLICY ahp_cluster_scores_all_policy ON ahp_cluster_scores
FOR ALL USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND (p.owner_user_id = auth.uid() OR EXISTS (SELECT 1 FROM project_collaborators pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())))
);

CREATE POLICY ahp_results_all_policy ON ahp_results
FOR ALL USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND (p.owner_user_id = auth.uid() OR EXISTS (SELECT 1 FROM project_collaborators pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())))
);
