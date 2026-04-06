-- migrations/003_conflicts.sql
-- Add conflicts table for Phase 3: conflict detection between stakeholder needs

CREATE TABLE IF NOT EXISTS public.cluster_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  cluster_a_id uuid NOT NULL REFERENCES public.requirement_clusters(id) ON DELETE CASCADE,
  cluster_b_id uuid NOT NULL REFERENCES public.requirement_clusters(id) ON DELETE CASCADE,
  description text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  specific_points text[],
  created_at timestamptz DEFAULT now(),

  -- prevent duplicate pairings, but allow reverse duplicates (A,B and B,A)
  CONSTRAINT unique_cluster_pair UNIQUE (project_id, cluster_a_id, cluster_b_id)
);

-- Enable RLS
ALTER TABLE public.cluster_conflicts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Project members can read conflicts" ON public.cluster_conflicts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = cluster_conflicts.project_id 
    AND projects.owner_user_id = auth.uid()
  )
);