-- Fix cleanup_call_artifacts function to remove reference to ice_candidates column
-- This column was removed in migration 20251115154750_f7e64802-675c-4b0c-a34d-9e93c52f8a38.sql

CREATE OR REPLACE FUNCTION cleanup_call_artifacts()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ended' AND NEW.ended_at IS NOT NULL AND (OLD.status IS NULL OR OLD.status <> 'ended') THEN
    -- Clear ICE candidates (they're no longer needed)
    -- Only clear parent_ice_candidates and child_ice_candidates (ice_candidates column removed)
    UPDATE public.calls 
    SET 
      parent_ice_candidates = '[]'::jsonb,
      child_ice_candidates = '[]'::jsonb
    WHERE id = NEW.id;
    
    -- Optional: null out big blobs to save space (keep for debugging, but could be cleared)
    -- UPDATE public.calls SET offer = NULL, answer = NULL WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

