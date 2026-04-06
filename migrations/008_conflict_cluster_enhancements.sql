-- Optional columns for conflict types and resolutions; relax unique pair constraint for multiple findings

ALTER TABLE public.cluster_conflicts
  ADD COLUMN IF NOT EXISTS conflict_type text DEFAULT 'contradiction',
  ADD COLUMN IF NOT EXISTS resolution_suggestion text;

ALTER TABLE public.cluster_conflicts DROP CONSTRAINT IF EXISTS unique_cluster_pair;
