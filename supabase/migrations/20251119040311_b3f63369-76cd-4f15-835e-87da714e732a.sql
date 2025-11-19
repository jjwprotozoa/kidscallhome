-- Fix: Grant execute permissions on child messaging RPC functions to anonymous users
-- This allows children (who are anonymous/unauthenticated) to call these functions

-- Grant permissions on send_child_message function
GRANT EXECUTE ON FUNCTION public.send_child_message(text, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.send_child_message(text, uuid, text) TO authenticated;

-- Grant permissions on get_child_messages function  
GRANT EXECUTE ON FUNCTION public.get_child_messages(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_child_messages(text, uuid) TO authenticated;

-- Grant permissions on authenticate_child_with_code function
GRANT EXECUTE ON FUNCTION public.authenticate_child_with_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.authenticate_child_with_code(text) TO authenticated;

-- Grant permissions on verify_child_session function
GRANT EXECUTE ON FUNCTION public.verify_child_session(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_child_session(text, uuid) TO authenticated;

-- Grant permissions on logout_child_session function
GRANT EXECUTE ON FUNCTION public.logout_child_session(text) TO anon;
GRANT EXECUTE ON FUNCTION public.logout_child_session(text) TO authenticated;

-- Grant permissions on get_child_calls function
GRANT EXECUTE ON FUNCTION public.get_child_calls(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_child_calls(text, uuid) TO authenticated;