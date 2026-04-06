-- Migration 005: Rename AHP tables to Prioritization
-- Reason: We replaced AHP (Analytic Hierarchy Process) with Smart Prioritization.
-- The table names should reflect the current system, not the legacy approach.

-- 1. Rename the results table
ALTER TABLE IF EXISTS ahp_results RENAME TO prioritization_results;

-- 2. Rename the supporting tables (keep for reference but rename for clarity)
ALTER TABLE IF EXISTS ahp_criteria RENAME TO prioritization_criteria;
ALTER TABLE IF EXISTS ahp_comparisons RENAME TO prioritization_comparisons;
ALTER TABLE IF EXISTS ahp_cluster_scores RENAME TO prioritization_cluster_scores;

-- 3. Rename constraints (PostgreSQL auto-renames most, but be explicit)
-- Note: Primary keys and unique constraints keep old names in Supabase.
-- This is cosmetic and doesn't affect functionality.

-- 4. Add a comment for documentation
COMMENT ON TABLE prioritization_results IS 'Smart prioritization results — composite scores from multi-criteria analysis (demand, consensus, conflict, value, feasibility, urgency)';
COMMENT ON TABLE prioritization_criteria IS 'Legacy AHP criteria — retained for backward compatibility';
COMMENT ON TABLE prioritization_comparisons IS 'Legacy AHP pairwise comparisons — retained for backward compatibility';
COMMENT ON TABLE prioritization_cluster_scores IS 'Legacy AHP cluster scores — retained for backward compatibility';
