-- Part 2: Indexes

CREATE INDEX idx_project_nfrs_project_status ON project_nfrs(project_id, status);
CREATE INDEX idx_cluster_opinions_project_cluster ON cluster_opinions(project_id, cluster_id);
CREATE INDEX idx_cluster_divergence_project ON cluster_divergence_scores(project_id);
CREATE INDEX idx_ahp_criteria_project ON ahp_criteria(project_id);
CREATE INDEX idx_ahp_comparisons_project ON ahp_comparisons(project_id);
CREATE INDEX idx_ahp_cluster_scores_project_cluster ON ahp_cluster_scores(project_id, cluster_id);
CREATE INDEX idx_ahp_results_project_rank ON ahp_results(project_id, rank);
