-- Create secure RPC function for children to get their call records
-- This validates the session token before returning call data

CREATE OR REPLACE FUNCTION public.get_child_calls(p_token text, p_child_id uuid)
RETURNS TABLE(
  id uuid,
  child_id uuid,
  parent_id uuid,
  caller_type text,
  status text,
  created_at timestamp with time zone,
  ended_at timestamp with time zone,
  offer jsonb,
  answer jsonb,
  child_ice_candidates jsonb,
  parent_ice_candidates jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate session token matches child_id
  IF NOT verify_child_session(p_token, p_child_id) THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;
  
  -- Return calls for this child
  RETURN QUERY
  SELECT 
    c.id,
    c.child_id,
    c.parent_id,
    c.caller_type,
    c.status,
    c.created_at,
    c.ended_at,
    c.offer,
    c.answer,
    c.child_ice_candidates,
    c.parent_ice_candidates
  FROM public.calls c
  WHERE c.child_id = p_child_id
  ORDER BY c.created_at DESC;
END;
$$;

-- Grant execute permission to anonymous users (children)
GRANT EXECUTE ON FUNCTION public.get_child_calls(text, uuid) TO anon;