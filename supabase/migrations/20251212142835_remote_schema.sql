


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."block_contact_for_child"("p_blocker_child_id" "uuid", "p_blocked_adult_profile_id" "uuid" DEFAULT NULL::"uuid", "p_blocked_child_profile_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_block_id UUID;
  v_child_exists BOOLEAN;
BEGIN
  -- Validate that blocker_child_id exists
  SELECT EXISTS(SELECT 1 FROM public.child_profiles WHERE id = p_blocker_child_id)
  INTO v_child_exists;
  
  IF NOT v_child_exists THEN
    RAISE EXCEPTION 'Invalid child profile ID';
  END IF;
  
  -- Validate that exactly one of blocked_adult_profile_id or blocked_child_profile_id is provided
  IF (p_blocked_adult_profile_id IS NULL AND p_blocked_child_profile_id IS NULL) OR
     (p_blocked_adult_profile_id IS NOT NULL AND p_blocked_child_profile_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Exactly one of blocked_adult_profile_id or blocked_child_profile_id must be provided';
  END IF;
  
  -- Insert the block
  INSERT INTO public.blocked_contacts (
    blocker_child_id,
    blocked_adult_profile_id,
    blocked_child_profile_id,
    blocked_at
  ) VALUES (
    p_blocker_child_id,
    p_blocked_adult_profile_id,
    p_blocked_child_profile_id,
    NOW()
  )
  ON CONFLICT (blocker_child_id, blocked_adult_profile_id, blocked_child_profile_id) 
  DO UPDATE SET
    blocked_at = NOW(),
    unblocked_at = NULL,
    unblocked_by_parent_id = NULL
  RETURNING id INTO v_block_id;
  
  RETURN v_block_id;
END;
$$;


ALTER FUNCTION "public"."block_contact_for_child"("p_blocker_child_id" "uuid", "p_blocked_adult_profile_id" "uuid", "p_blocked_child_profile_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."block_contact_for_child"("p_blocker_child_id" "uuid", "p_blocked_adult_profile_id" "uuid", "p_blocked_child_profile_id" "uuid") IS 'Allows children (via anonymous auth) to block contacts. Validates child_profile_id and creates parent notifications.';



CREATE OR REPLACE FUNCTION "public"."can_add_child"("p_parent_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_allowed_children INTEGER;
  v_current_children INTEGER;
  v_subscription_status TEXT;
  v_subscription_expires_at TIMESTAMPTZ;
BEGIN
  -- Get subscription info
  SELECT 
    COALESCE(allowed_children, 1),
    subscription_status,
    subscription_expires_at
  INTO 
    v_allowed_children,
    v_subscription_status,
    v_subscription_expires_at
  FROM public.parents
  WHERE id = p_parent_id;
  
  -- Get current children count
  SELECT COUNT(*) INTO v_current_children
  FROM public.children
  WHERE parent_id = p_parent_id;
  
  -- Check if subscription is active OR cancelled but not expired
  -- Cancelled subscriptions should continue working until expiration
  IF (v_subscription_status = 'active' OR v_subscription_status = 'cancelled') 
     AND (v_subscription_expires_at IS NULL OR v_subscription_expires_at > NOW()) THEN
    -- For unlimited plans (allowed_children = -1 or very high number)
    IF v_allowed_children = -1 OR v_allowed_children >= 999 THEN
      RETURN TRUE;
    END IF;
    
    -- Check if under limit
    RETURN v_current_children < v_allowed_children;
  END IF;
  
  -- Default free tier: 1 child (for expired, inactive, or no subscription)
  RETURN v_current_children < 1;
END;
$$;


ALTER FUNCTION "public"."can_add_child"("p_parent_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_child_view_parent"("parent_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if any child exists with this parent_id
  RETURN EXISTS (
    SELECT 1 FROM public.children
    WHERE parent_id = parent_uuid
  );
END;
$$;


ALTER FUNCTION "public"."can_child_view_parent"("parent_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_children_communicate"("p_child1_id" "uuid", "p_child2_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_connection RECORD;
BEGIN
  -- Check if there's an approved connection
  SELECT * INTO v_connection
  FROM public.child_connections
  WHERE (
    (requester_child_id = p_child1_id AND target_child_id = p_child2_id) OR
    (requester_child_id = p_child2_id AND target_child_id = p_child1_id)
  )
  AND status = 'approved';
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."can_children_communicate"("p_child1_id" "uuid", "p_child2_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_users_call"("p_sender_id" "uuid", "p_sender_type" "text", "p_receiver_id" "uuid", "p_receiver_type" "text", "p_sender_family_id" "uuid" DEFAULT NULL::"uuid", "p_receiver_family_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_blocked BOOLEAN := false;
  v_child_connection_approved BOOLEAN := false;
BEGIN
  -- Use same logic as can_users_communicate, but check 'child_to_child_calls' flag
  -- For non-child-to-child, use can_users_communicate
  IF p_sender_type = 'child' AND p_receiver_type = 'child' THEN
    SELECT can_children_communicate(p_sender_id, p_receiver_id) 
    INTO v_child_connection_approved;
    
    IF NOT v_child_connection_approved THEN
      RETURN false;
    END IF;
    
    -- Check feature flag for child-to-child calls
    IF NOT is_feature_enabled_for_children(p_sender_id, p_receiver_id, 'child_to_child_calls') THEN
      RETURN false;
    END IF;
  END IF;
  
  -- For all other cases, use the messaging permission check
  RETURN can_users_communicate(
    p_sender_id,
    p_sender_type,
    p_receiver_id,
    p_receiver_type,
    p_sender_family_id,
    p_receiver_family_id
  );
END;
$$;


ALTER FUNCTION "public"."can_users_call"("p_sender_id" "uuid", "p_sender_type" "text", "p_receiver_id" "uuid", "p_receiver_type" "text", "p_sender_family_id" "uuid", "p_receiver_family_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_users_call"("p_sender_id" "uuid", "p_sender_type" "text", "p_receiver_id" "uuid", "p_receiver_type" "text", "p_sender_family_id" "uuid", "p_receiver_family_id" "uuid") IS 'Same as can_users_communicate but checks ''child_to_child_calls'' feature flag instead of ''child_to_child_messaging''.';



CREATE OR REPLACE FUNCTION "public"."can_users_communicate"("p_sender_id" "uuid", "p_sender_type" "text", "p_receiver_id" "uuid", "p_receiver_type" "text", "p_sender_family_id" "uuid" DEFAULT NULL::"uuid", "p_receiver_family_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_blocked BOOLEAN := false;
  v_child_connection_approved BOOLEAN := false;
  v_sender_is_parent BOOLEAN := false;
  v_receiver_is_parent BOOLEAN := false;
BEGIN
  -- CRITICAL RULE 1: NO adult-to-adult communication
  IF (p_sender_type IN ('parent', 'family_member') AND 
      p_receiver_type IN ('parent', 'family_member')) THEN
    RETURN false;
  END IF;

  -- CRITICAL RULE 2: Check blocking (blocking overrides everything)
  -- Exception: Child cannot fully block their own parent (safety feature)
  -- Check if receiver is the child's parent
  IF p_sender_type = 'child' AND p_receiver_type = 'parent' THEN
    -- Check if receiver is the sender's parent
    SELECT EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = p_sender_id
        AND ap.user_id = p_receiver_id
        AND ap.role = 'parent'
    ) INTO v_receiver_is_parent;
    
    -- If receiver is the child's parent, allow communication (child cannot block parent)
    IF v_receiver_is_parent THEN
      -- Still check if child blocked parent (for logging), but don't block communication
      -- This allows "mute" on client side while maintaining parent oversight
      -- For now, we allow it - implement client-side mute if needed
    ELSE
      -- Check if child blocked this adult (not their parent)
      SELECT is_contact_blocked(
        p_sender_id,
        p_adult_profile_id := (
          SELECT id FROM public.adult_profiles 
          WHERE user_id = p_receiver_id 
          LIMIT 1
        )
      ) INTO v_blocked;
      
      IF v_blocked THEN
        RETURN false;
      END IF;
    END IF;
  ELSIF p_sender_type = 'child' AND p_receiver_type = 'child' THEN
    -- Check if child blocked another child
    SELECT is_contact_blocked(
      p_sender_id,
      p_child_profile_id := p_receiver_id
    ) INTO v_blocked;
    
    IF v_blocked THEN
      RETURN false;
    END IF;
  ELSIF p_sender_type = 'parent' AND p_receiver_type = 'child' THEN
    -- Check if child blocked this parent (reverse check)
    -- Note: Child cannot block their own parent, but can block other parents
    SELECT is_contact_blocked(
      p_receiver_id,
      p_adult_profile_id := (
        SELECT id FROM public.adult_profiles 
        WHERE user_id = p_sender_id 
        LIMIT 1
      )
    ) INTO v_blocked;
    
    IF v_blocked THEN
      RETURN false;
    END IF;
  ELSIF p_sender_type = 'family_member' AND p_receiver_type = 'child' THEN
    -- Check if child blocked this family member
    SELECT is_contact_blocked(
      p_receiver_id,
      p_adult_profile_id := (
        SELECT id FROM public.adult_profiles 
        WHERE user_id = p_sender_id 
        LIMIT 1
      )
    ) INTO v_blocked;
    
    IF v_blocked THEN
      RETURN false;
    END IF;
  END IF;

  -- CRITICAL RULE 3: Child-to-child requires approved connection AND feature flag
  IF p_sender_type = 'child' AND p_receiver_type = 'child' THEN
    SELECT can_children_communicate(p_sender_id, p_receiver_id) 
    INTO v_child_connection_approved;
    
    IF NOT v_child_connection_approved THEN
      RETURN false;
    END IF;
    
    -- Check feature flag for child-to-child messaging
    -- Note: For calls, use 'child_to_child_calls' instead
    IF NOT is_feature_enabled_for_children(p_sender_id, p_receiver_id, 'child_to_child_messaging') THEN
      RETURN false;
    END IF;
  END IF;

  -- CRITICAL RULE 4: Family members can only communicate with children in their family
  IF p_sender_type = 'family_member' AND p_receiver_type = 'child' THEN
    IF p_sender_family_id IS NULL OR p_receiver_family_id IS NULL THEN
      -- Try to determine family IDs
      SELECT family_id INTO p_sender_family_id
      FROM public.adult_profiles
      WHERE user_id = p_sender_id
      LIMIT 1;
      
      SELECT family_id INTO p_receiver_family_id
      FROM public.child_family_memberships
      WHERE child_profile_id = p_receiver_id
      LIMIT 1;
    END IF;
    
    IF p_sender_family_id != p_receiver_family_id THEN
      RETURN false;
    END IF;
  END IF;

  -- CRITICAL RULE 5: Parent can only communicate with their own children
  -- (This is already enforced by existing RLS, but we check here for completeness)
  IF p_sender_type = 'parent' AND p_receiver_type = 'child' THEN
    -- Verify parent owns this child
    IF NOT EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = p_receiver_id
        AND ap.user_id = p_sender_id
        AND ap.role = 'parent'
    ) THEN
      RETURN false;
    END IF;
  END IF;

  -- All checks passed
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."can_users_communicate"("p_sender_id" "uuid", "p_sender_type" "text", "p_receiver_id" "uuid", "p_receiver_type" "text", "p_sender_family_id" "uuid", "p_receiver_family_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_users_communicate"("p_sender_id" "uuid", "p_sender_type" "text", "p_receiver_id" "uuid", "p_receiver_type" "text", "p_sender_family_id" "uuid", "p_receiver_family_id" "uuid") IS 'Central permission check function that enforces the permissions matrix at database level. 
Prevents adult-to-adult communication, checks blocking, verifies child-to-child approvals, 
and enforces family boundaries. Returns false if communication is not allowed.';



CREATE OR REPLACE FUNCTION "public"."cancel_subscription"("p_parent_id" "uuid", "p_cancel_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_children_count INTEGER;
  v_allowed_children INTEGER;
BEGIN
  -- Verify authenticated user matches parent_id
  IF auth.uid() != p_parent_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only cancel your own subscription'
    );
  END IF;
  
  -- Get current subscription info
  SELECT allowed_children INTO v_allowed_children
  FROM public.parents
  WHERE id = p_parent_id;
  
  -- Get current children count
  SELECT COUNT(*) INTO v_current_children_count
  FROM public.children
  WHERE parent_id = p_parent_id;
  
  -- Cancel subscription (set status to cancelled, keep until expiration)
  UPDATE public.parents
  SET 
    subscription_status = 'cancelled',
    subscription_cancelled_at = NOW(),
    subscription_cancel_reason = p_cancel_reason
  WHERE id = p_parent_id
  AND subscription_status = 'active'
  AND subscription_type != 'free';
  
  -- Check if update succeeded
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No active subscription found to cancel'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'parent_id', p_parent_id,
    'subscription_status', 'cancelled',
    'current_children_count', v_current_children_count,
    'allowed_children', v_allowed_children,
    'message', 'Subscription cancelled. Access will continue until expiration date.'
  );
END;
$$;


ALTER FUNCTION "public"."cancel_subscription"("p_parent_id" "uuid", "p_cancel_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cancel_subscription"("p_parent_id" "uuid", "p_cancel_reason" "text") IS 'Cancels an active subscription. Subscription remains active until expiration date. User retains access until then.';



CREATE OR REPLACE FUNCTION "public"."check_family_member_email"("email_to_check" "text", "parent_id_to_check" "uuid") RETURNS TABLE("found" boolean, "status" "text", "invitation_token" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as found,
    fm.status,
    fm.invitation_token
  FROM public.family_members fm
  WHERE fm.email = email_to_check
  AND fm.parent_id = parent_id_to_check
  LIMIT 1;
  
  -- If no row found, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::UUID;
  END IF;
END;
$$;


ALTER FUNCTION "public"."check_family_member_email"("email_to_check" "text", "parent_id_to_check" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_call_artifacts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."cleanup_call_artifacts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_audit_logs"("p_retention_days" integer DEFAULT 90) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Only service role can cleanup
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: Only service role can cleanup audit logs';
  END IF;

  DELETE FROM public.audit_logs
  WHERE event_timestamp < NOW() - (p_retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_audit_logs"("p_retention_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT auth.uid();
$$;


ALTER FUNCTION "public"."current_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_call_ending_columns"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Add ended_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'ended_by'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN ended_by TEXT CHECK (ended_by IN ('parent', 'child'));
  END IF;

  -- Add end_reason column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'end_reason'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN end_reason TEXT;
  END IF;

  -- Add version column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'version'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN version BIGINT DEFAULT 0;
  END IF;

  -- Create indexes if they don't exist
  CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls(status);
  CREATE INDEX IF NOT EXISTS idx_calls_ended_at ON public.calls(ended_at);
END;
$$;


ALTER FUNCTION "public"."ensure_call_ending_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_kid_friendly_login_code"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  options TEXT[] := ARRAY[
    -- Colors (10)
    'red', 'blue', 'green', 'yellow', 'orange', 
    'purple', 'pink', 'brown', 'black', 'white',
    -- Animals (15)
    'cat', 'dog', 'bird', 'fish', 'bear', 
    'lion', 'tiger', 'elephant', 'monkey', 'rabbit',
    'horse', 'duck', 'cow', 'pig', 'sheep'
  ];
  selected_option TEXT;
  selected_number INT;
  code TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    -- Randomly select color or animal
    selected_option := options[floor(random() * array_length(options, 1) + 1)::int];
    
    -- Randomly select number 1-99
    selected_number := floor(random() * 99 + 1)::int;
    
    -- Format: "color-7" or "tiger-4" (family_code will be prepended by application)
    -- This function now returns just the child-specific part
    code := selected_option || '-' || selected_number::text;
    
    -- Check if code exists (without family_code prefix)
    -- Note: We check for partial matches since login_code now includes family_code
    IF NOT EXISTS (
      SELECT 1 FROM public.children 
      WHERE login_code LIKE '%-' || code
    ) THEN
      RETURN code;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 500 THEN
      RAISE EXCEPTION 'Could not generate unique kid-friendly code after 500 attempts';
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."generate_kid_friendly_login_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_unique_family_code"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; -- All alphanumeric characters
  code TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    code := '';
    -- Generate 6-character code
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    -- Check if code exists
    IF NOT EXISTS (SELECT 1 FROM public.parents WHERE family_code = code) THEN
      RETURN code;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 500 THEN
      RAISE EXCEPTION 'Could not generate unique family code after 500 attempts';
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."generate_unique_family_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_unique_login_code"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN public.generate_kid_friendly_login_code();
END;
$$;


ALTER FUNCTION "public"."generate_unique_login_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_adult_profile_id"("p_user_id" "uuid", "p_family_id" "uuid", "p_role" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  IF p_role IS NOT NULL THEN
    SELECT id INTO v_profile_id
    FROM public.adult_profiles
    WHERE user_id = p_user_id
      AND family_id = p_family_id
      AND role = p_role
    LIMIT 1;
  ELSE
    -- If no role specified, try parent first, then family_member
    SELECT id INTO v_profile_id
    FROM public.adult_profiles
    WHERE user_id = p_user_id
      AND family_id = p_family_id
      AND role = 'parent'
    LIMIT 1;
    
    IF v_profile_id IS NULL THEN
      SELECT id INTO v_profile_id
      FROM public.adult_profiles
      WHERE user_id = p_user_id
        AND family_id = p_family_id
        AND role = 'family_member'
      LIMIT 1;
    END IF;
  END IF;
  
  RETURN v_profile_id;
END;
$$;


ALTER FUNCTION "public"."get_adult_profile_id"("p_user_id" "uuid", "p_family_id" "uuid", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_audit_logs"("p_user_id" "uuid" DEFAULT NULL::"uuid", "p_event_type" "text" DEFAULT NULL::"text", "p_severity" "text" DEFAULT NULL::"text", "p_start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_end_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 100) RETURNS TABLE("id" "uuid", "event_type" "text", "user_id" "uuid", "email" "text", "ip" "text", "user_agent" "text", "event_timestamp" timestamp with time zone, "metadata" "jsonb", "severity" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only service role can query audit logs
  -- This prevents regular users from accessing audit data
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: Only service role can query audit logs';
  END IF;

  RETURN QUERY
  SELECT 
    al.id,
    al.event_type,
    al.user_id,
    al.email,
    al.ip,
    al.user_agent,
    al.event_timestamp,
    al.metadata,
    al.severity,
    al.created_at
  FROM public.audit_logs al
  WHERE 
    (p_user_id IS NULL OR al.user_id = p_user_id)
    AND (p_event_type IS NULL OR al.event_type = p_event_type)
    AND (p_severity IS NULL OR al.severity = p_severity)
    AND (p_start_date IS NULL OR al.event_timestamp >= p_start_date)
    AND (p_end_date IS NULL OR al.event_timestamp <= p_end_date)
  ORDER BY al.event_timestamp DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_audit_logs"("p_user_id" "uuid", "p_event_type" "text", "p_severity" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_child_blocks"("p_child_profile_id" "uuid") RETURNS TABLE("id" "uuid", "blocker_child_id" "uuid", "blocked_adult_profile_id" "uuid", "blocked_child_profile_id" "uuid", "blocked_at" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Validate child_profile_id exists
  IF NOT EXISTS (SELECT 1 FROM public.child_profiles WHERE id = p_child_profile_id) THEN
    RAISE EXCEPTION 'Invalid child profile ID';
  END IF;
  
  RETURN QUERY
  SELECT 
    bc.id,
    bc.blocker_child_id,
    bc.blocked_adult_profile_id,
    bc.blocked_child_profile_id,
    bc.blocked_at,
    bc.created_at
  FROM public.blocked_contacts bc
  WHERE bc.blocker_child_id = p_child_profile_id
    AND bc.unblocked_at IS NULL
  ORDER BY bc.blocked_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_child_blocks"("p_child_profile_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_child_blocks"("p_child_profile_id" "uuid") IS 'Allows children to safely query their own blocked contacts. Returns only active (non-unblocked) blocks.';



CREATE OR REPLACE FUNCTION "public"."get_child_families"("p_child_profile_id" "uuid") RETURNS TABLE("family_id" "uuid", "household_type" "text", "linked_family_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id as family_id,
    f.household_type,
    f.linked_family_id
  FROM public.child_family_memberships cfm
  JOIN public.families f ON f.id = cfm.family_id
  WHERE cfm.child_profile_id = p_child_profile_id;
END;
$$;


ALTER FUNCTION "public"."get_child_families"("p_child_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_child_profile_id"("p_child_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- child_profiles.id should match children.id, so this should work
  SELECT id INTO v_profile_id
  FROM public.child_profiles
  WHERE id = p_child_id
  LIMIT 1;
  
  RETURN v_profile_id;
END;
$$;


ALTER FUNCTION "public"."get_child_profile_id"("p_child_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_adult_profile_id"("p_family_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- If family_id provided, use it; otherwise try to find any profile for this user
  IF p_family_id IS NOT NULL THEN
    -- Try parent first
    SELECT id INTO v_profile_id
    FROM public.adult_profiles
    WHERE user_id = auth.uid()
      AND family_id = p_family_id
      AND role = 'parent'
    LIMIT 1;
    
    -- If not found, try family_member
    IF v_profile_id IS NULL THEN
      SELECT id INTO v_profile_id
      FROM public.adult_profiles
      WHERE user_id = auth.uid()
        AND family_id = p_family_id
        AND role = 'family_member'
      LIMIT 1;
    END IF;
  ELSE
    -- No family_id, try to find any profile
    SELECT id INTO v_profile_id
    FROM public.adult_profiles
    WHERE user_id = auth.uid()
    ORDER BY 
      CASE role WHEN 'parent' THEN 1 ELSE 2 END, -- Prefer parent
      created_at ASC
    LIMIT 1;
  END IF;
  
  RETURN v_profile_id;
END;
$$;


ALTER FUNCTION "public"."get_current_adult_profile_id"("p_family_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_full_login_code"("p_child_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_family_code TEXT;
  v_child_code TEXT;
BEGIN
  SELECT p.family_code, c.login_code
  INTO v_family_code, v_child_code
  FROM public.children c
  JOIN public.parents p ON c.parent_id = p.id
  WHERE c.id = p_child_id;
  
  IF v_family_code IS NULL OR v_child_code IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN v_family_code || '-' || v_child_code;
END;
$$;


ALTER FUNCTION "public"."get_full_login_code"("p_child_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_conversation"("p_adult_id" "uuid", "p_adult_role" "text", "p_child_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Validate inputs
  IF p_adult_id IS NULL OR p_child_id IS NULL OR p_adult_role IS NULL THEN
    RAISE EXCEPTION 'All parameters must be provided: p_adult_id, p_adult_role, p_child_id';
  END IF;
  
  IF p_adult_role NOT IN ('parent', 'family_member') THEN
    RAISE EXCEPTION 'p_adult_role must be ''parent'' or ''family_member''';
  END IF;
  
  -- Verify adult_profile exists
  IF NOT EXISTS (
    SELECT 1 FROM public.adult_profiles 
    WHERE id = p_adult_id AND role = p_adult_role
  ) THEN
    RAISE EXCEPTION 'Adult profile with id % and role % does not exist', p_adult_id, p_adult_role;
  END IF;
  
  -- Verify child_profile exists
  IF NOT EXISTS (
    SELECT 1 FROM public.child_profiles 
    WHERE id = p_child_id
  ) THEN
    RAISE EXCEPTION 'Child profile with id % does not exist', p_child_id;
  END IF;
  
  -- Try to find existing conversation
  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE adult_id = p_adult_id
    AND child_id = p_child_id;
  
  -- If not found, create it
  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (adult_id, child_id, adult_role)
    VALUES (p_adult_id, p_child_id, p_adult_role)
    ON CONFLICT (adult_id, child_id)
    DO UPDATE SET updated_at = NOW(), adult_role = p_adult_role
    RETURNING id INTO v_conversation_id;
  END IF;
  
  RETURN v_conversation_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_conversation"("p_adult_id" "uuid", "p_adult_role" "text", "p_child_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_conversation"("p_participant1_id" "uuid", "p_participant1_type" "text", "p_participant2_id" "uuid", "p_participant2_type" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_conversation_id UUID;
  v_p1_id UUID;
  v_p1_type TEXT;
  v_p2_id UUID;
  v_p2_type TEXT;
BEGIN
  -- Normalize: always put child as participant2
  IF p_participant1_type = 'child' THEN
    v_p1_id := p_participant2_id;
    v_p1_type := p_participant2_type;
    v_p2_id := p_participant1_id;
    v_p2_type := p_participant1_type;
  ELSE
    v_p1_id := p_participant1_id;
    v_p1_type := p_participant1_type;
    v_p2_id := p_participant2_id;
    v_p2_type := p_participant2_type;
  END IF;

  -- Try to find existing conversation
  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE participant1_id = v_p1_id
    AND participant1_type = v_p1_type
    AND participant2_id = v_p2_id
    AND participant2_type = v_p2_type;

  -- If not found, create it
  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (participant1_id, participant1_type, participant2_id, participant2_type)
    VALUES (v_p1_id, v_p1_type, v_p2_id, v_p2_type)
    ON CONFLICT (participant1_id, participant1_type, participant2_id, participant2_type)
    DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_conversation_id;
  END IF;

  RETURN v_conversation_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_conversation"("p_participant1_id" "uuid", "p_participant1_type" "text", "p_participant2_id" "uuid", "p_participant2_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_parent_name_for_child"("parent_uuid" "uuid") RETURNS TABLE("id" "uuid", "name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  -- Direct query - SECURITY DEFINER bypasses all RLS
  -- Just verify relationship exists, then return parent
  SELECT p.id, p.name
  FROM public.parents p
  INNER JOIN public.children c ON c.parent_id = p.id
  WHERE p.id = parent_uuid
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_parent_name_for_child"("parent_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_timezone_names"() RETURNS TABLE("name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT name FROM public.timezone_names_cache ORDER BY name;
$$;


ALTER FUNCTION "public"."get_timezone_names"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_timezone_names"() IS 'Returns all timezone names from pg_timezone_names. This function is marked as STABLE to enable query result caching. Use this instead of direct pg_timezone_names queries to improve performance.';



CREATE OR REPLACE FUNCTION "public"."handle_new_family_member"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  invitation_record RECORD;
  v_adult_profile_id UUID;
BEGIN
  -- Check if this user was invited (has invitation_token in metadata)
  IF NEW.raw_user_meta_data->>'invitation_token' IS NOT NULL THEN
    -- Find the invitation
    SELECT * INTO invitation_record
    FROM public.family_members
    WHERE invitation_token::text = NEW.raw_user_meta_data->>'invitation_token'
    AND status = 'pending';
    
    -- If invitation found, activate the family member and create adult_profiles
    IF FOUND THEN
      -- Update family_members record
      UPDATE public.family_members
      SET 
        id = NEW.id,
        invitation_accepted_at = NOW(),
        status = 'active',
        updated_at = NOW()
      WHERE invitation_token::text = NEW.raw_user_meta_data->>'invitation_token';
      
      -- Create adult_profiles record for this family member
      INSERT INTO public.adult_profiles (
        user_id,
        family_id,
        role,
        relationship_type,
        name,
        email
      )
      VALUES (
        NEW.id,
        invitation_record.parent_id, -- family_id is the parent_id
        'family_member',
        invitation_record.relationship,
        invitation_record.name,
        invitation_record.email
      )
      ON CONFLICT (user_id, family_id, role)
      DO UPDATE SET
        updated_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_family_member"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_parent"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.parents (id, email, name, family_code, privacy_cookie_accepted, email_updates_opt_in)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    public.generate_unique_family_code(), -- Preserve family_code generation
    false, -- privacy_cookie_accepted defaults to false
    false  -- email_updates_opt_in defaults to false
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_parent"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_call_version"("call_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.calls
  SET version = version + 1
  WHERE id = call_id;
END;
$$;


ALTER FUNCTION "public"."increment_call_version"("call_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_contact_blocked"("p_child_id" "uuid", "p_adult_profile_id" "uuid" DEFAULT NULL::"uuid", "p_child_profile_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_blocked RECORD;
  v_is_parent BOOLEAN := false;
BEGIN
  -- SAFETY FEATURE: If blocking an adult, check if it's the child's own parent
  -- Child cannot fully block their own parent (safety/oversight requirement)
  IF p_adult_profile_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = p_child_id
        AND ap.id = p_adult_profile_id
        AND ap.role = 'parent'
    ) INTO v_is_parent;
    
    -- If this is the child's parent, return false (cannot block)
    -- Note: This allows client-side "mute" while maintaining parent oversight
    IF v_is_parent THEN
      RETURN false;
    END IF;
  END IF;

  -- Check for active block (unblocked_at IS NULL)
  SELECT * INTO v_blocked
  FROM public.blocked_contacts
  WHERE blocker_child_id = p_child_id
    AND unblocked_at IS NULL
    AND (
      (p_adult_profile_id IS NOT NULL AND blocked_adult_profile_id = p_adult_profile_id) OR
      (p_child_profile_id IS NOT NULL AND blocked_child_profile_id = p_child_profile_id)
    );
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."is_contact_blocked"("p_child_id" "uuid", "p_adult_profile_id" "uuid", "p_child_profile_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_contact_blocked"("p_child_id" "uuid", "p_adult_profile_id" "uuid", "p_child_profile_id" "uuid") IS 'Checks if a contact is blocked for a child. Includes safety feature: child cannot 
fully block their own parent (allows client-side mute while maintaining parent oversight).';



CREATE OR REPLACE FUNCTION "public"."is_feature_enabled_for_children"("p_child_a_id" "uuid", "p_child_b_id" "uuid", "p_feature_key" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if feature is enabled for at least one of the children's families
  -- This allows child-to-child if either family has it enabled
  RETURN EXISTS (
    SELECT 1
    FROM public.child_family_memberships cfa
    JOIN public.family_feature_flags ffa
      ON ffa.family_id = cfa.family_id
     AND ffa.key = p_feature_key
     AND ffa.enabled = true
    WHERE cfa.child_profile_id = p_child_a_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.child_family_memberships cfb
    JOIN public.family_feature_flags ffb
      ON ffb.family_id = cfb.family_id
     AND ffb.key = p_feature_key
     AND ffb.enabled = true
    WHERE cfb.child_profile_id = p_child_b_id
  );
END;
$$;


ALTER FUNCTION "public"."is_feature_enabled_for_children"("p_child_a_id" "uuid", "p_child_b_id" "uuid", "p_feature_key" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_feature_enabled_for_children"("p_child_a_id" "uuid", "p_child_b_id" "uuid", "p_feature_key" "text") IS 'Checks if a feature is enabled for at least one of the children''s families. Returns true if either child''s family has the feature enabled.';



CREATE OR REPLACE FUNCTION "public"."link_family_member_to_auth_user"("p_invitation_token" "uuid", "p_auth_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result JSONB;
  v_family_member RECORD;
  v_adult_profile_id UUID;
BEGIN
  -- Find the invitation
  SELECT * INTO v_family_member
  FROM public.family_members
  WHERE invitation_token = p_invitation_token
  AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired invitation token'
    );
  END IF;

  -- Check if already linked
  IF v_family_member.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Already linked',
      'family_member_id', v_family_member.id
    );
  END IF;

  -- Update the family member record
  UPDATE public.family_members
  SET 
    id = p_auth_user_id,
    status = 'active',
    invitation_accepted_at = NOW(),
    updated_at = NOW()
  WHERE invitation_token = p_invitation_token;

  -- Create adult_profiles record
  INSERT INTO public.adult_profiles (
    user_id,
    family_id,
    role,
    relationship_type,
    name,
    email
  )
  VALUES (
    p_auth_user_id,
    v_family_member.parent_id, -- family_id is the parent_id
    'family_member',
    v_family_member.relationship,
    v_family_member.name,
    v_family_member.email
  )
  ON CONFLICT (user_id, family_id, role)
  DO UPDATE SET
    updated_at = NOW()
  RETURNING id INTO v_adult_profile_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Family member linked successfully',
    'family_member_id', p_auth_user_id,
    'adult_profile_id', v_adult_profile_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;


ALTER FUNCTION "public"."link_family_member_to_auth_user"("p_invitation_token" "uuid", "p_auth_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_audit_event"("p_event_type" "text", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_email" "text" DEFAULT NULL::"text", "p_ip" "text" DEFAULT NULL::"text", "p_user_agent" "text" DEFAULT NULL::"text", "p_timestamp" timestamp with time zone DEFAULT "now"(), "p_metadata" "jsonb" DEFAULT NULL::"jsonb", "p_severity" "text" DEFAULT 'medium'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- Insert audit log entry
  INSERT INTO public.audit_logs (
    event_type,
    user_id,
    email,
    ip,
    user_agent,
    event_timestamp,
    metadata,
    severity
  ) VALUES (
    p_event_type,
    p_user_id,
    p_email,
    p_ip,
    p_user_agent,
    p_timestamp,
    p_metadata,
    p_severity
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;


ALTER FUNCTION "public"."log_audit_event"("p_event_type" "text", "p_user_id" "uuid", "p_email" "text", "p_ip" "text", "p_user_agent" "text", "p_timestamp" timestamp with time zone, "p_metadata" "jsonb", "p_severity" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_missed_calls"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- If call is ending and was never active, mark it as missed
  IF NEW.status = 'ended' AND NEW.ended_at IS NOT NULL THEN
    -- Check if call was ever active (we can't directly check history, so we check if it's ending without being active)
    -- A call is missed if it ends without ever being active
    -- We'll mark it as missed if status transitions from 'ringing' to 'ended' without going through 'active'
    IF OLD.status = 'ringing' AND NEW.status = 'ended' THEN
      NEW.missed_call = TRUE;
    END IF;
  END IF;
  
  -- If call becomes active, it's no longer missed
  IF NEW.status = 'active' THEN
    NEW.missed_call = FALSE;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."mark_missed_calls"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_parents_on_block"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  parent_row RECORD;
  child_name TEXT;
  blocked_name TEXT;
  notification_message TEXT;
BEGIN
  -- Get child's name
  SELECT name INTO child_name
  FROM public.child_profiles
  WHERE id = NEW.blocker_child_id;
  
  -- Get blocked contact's name
  IF NEW.blocked_adult_profile_id IS NOT NULL THEN
    SELECT name INTO blocked_name
    FROM public.adult_profiles
    WHERE id = NEW.blocked_adult_profile_id;
  ELSIF NEW.blocked_child_profile_id IS NOT NULL THEN
    SELECT name INTO blocked_name
    FROM public.child_profiles
    WHERE id = NEW.blocked_child_profile_id;
  END IF;
  
  -- Build notification message
  notification_message := format(
    'Your child %s blocked %s',
    COALESCE(child_name, 'your child'),
    COALESCE(blocked_name, 'a contact')
  );
  
  -- For each parent of the blocker, create a notification
  FOR parent_row IN
    SELECT DISTINCT ap.id as parent_profile_id
    FROM public.adult_profiles ap
    JOIN public.child_family_memberships cfm ON cfm.child_profile_id = NEW.blocker_child_id
    WHERE ap.role = 'parent'
      AND ap.family_id = cfm.family_id
  LOOP
    INSERT INTO public.parent_notifications (
      parent_id,
      child_id,
      blocked_id,
      blocked_contact_id,
      notification_type,
      message,
      created_at
    ) VALUES (
      parent_row.parent_profile_id,
      NEW.blocker_child_id,
      COALESCE(NEW.blocked_adult_profile_id, NEW.blocked_child_profile_id),
      NEW.id,
      'block',
      notification_message,
      NOW()
    )
    ON CONFLICT DO NOTHING; -- Prevent duplicate notifications
  END LOOP;
  
  -- Update parent_notified_at timestamp
  UPDATE public.blocked_contacts
  SET parent_notified_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_parents_on_block"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_parents_on_block"() IS 'Trigger function that creates parent notifications when a child blocks someone. Runs as SECURITY DEFINER.';



CREATE OR REPLACE FUNCTION "public"."process_expired_subscriptions"() RETURNS TABLE("parent_id" "uuid", "subscription_type" "text", "children_count" integer, "action_taken" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_parent_record RECORD;
  v_current_children INTEGER;
  v_new_allowed_children INTEGER;
BEGIN
  -- Find subscriptions that have expired
  FOR v_parent_record IN
    SELECT id, subscription_type, allowed_children
    FROM public.parents
    WHERE subscription_status IN ('active', 'cancelled')
    AND subscription_expires_at IS NOT NULL
    AND subscription_expires_at < NOW()
    AND subscription_type != 'free'
  LOOP
    -- Get current children count
    SELECT COUNT(*) INTO v_current_children
    FROM public.children
    WHERE parent_id = v_parent_record.id;
    
    -- Determine new allowed children (revert to free tier: 1 child)
    -- If they have more than 1 child, keep current count but set limit to 1
    -- They won't be able to add more until they upgrade
    v_new_allowed_children := 1;
    
    -- Update subscription to expired/free tier
    UPDATE public.parents
    SET 
      subscription_status = 'expired',
      subscription_type = 'free',
      allowed_children = v_new_allowed_children
    WHERE id = v_parent_record.id;
    
    -- Return result
    parent_id := v_parent_record.id;
    subscription_type := v_parent_record.subscription_type;
    children_count := v_current_children;
    action_taken := CASE 
      WHEN v_current_children > 1 THEN 
        'Reverted to free tier (1 child limit). ' || v_current_children || ' children exist but cannot add more.'
      ELSE 
        'Reverted to free tier (1 child limit).'
    END;
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;


ALTER FUNCTION "public"."process_expired_subscriptions"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_expired_subscriptions"() IS 'Processes expired subscriptions and reverts to free tier. Should be run via cron job or scheduled task.';



CREATE OR REPLACE FUNCTION "public"."reactivate_subscription"("p_parent_id" "uuid", "p_subscription_type" "text", "p_allowed_children" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Verify authenticated user
  IF auth.uid() != p_parent_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only reactivate your own subscription'
    );
  END IF;
  
  -- Reactivate subscription
  UPDATE public.parents
  SET 
    subscription_type = p_subscription_type,
    allowed_children = p_allowed_children,
    subscription_status = 'active',
    subscription_cancelled_at = NULL,
    subscription_cancel_reason = NULL,
    subscription_started_at = COALESCE(subscription_started_at, NOW()),
    subscription_expires_at = CASE 
      WHEN p_subscription_type LIKE '%annual%' OR p_subscription_type LIKE '%year%' THEN NOW() + INTERVAL '1 year'
      WHEN p_subscription_type LIKE '%month%' THEN NOW() + INTERVAL '1 month'
      ELSE NULL
    END
  WHERE id = p_parent_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'parent_id', p_parent_id,
    'subscription_type', p_subscription_type,
    'subscription_status', 'active'
  );
END;
$$;


ALTER FUNCTION "public"."reactivate_subscription"("p_parent_id" "uuid", "p_subscription_type" "text", "p_allowed_children" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_timezone_cache"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.timezone_names_cache;
END;
$$;


ALTER FUNCTION "public"."refresh_timezone_cache"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_timezone_cache"() IS 'Refreshes the timezone_names_cache materialized view. Run this periodically (e.g., monthly) or when timezone data changes.';



CREATE OR REPLACE FUNCTION "public"."revoke_device"("p_device_id" "uuid", "p_parent_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.devices
  SET is_active = false,
      updated_at = NOW()
  WHERE id = p_device_id
    AND parent_id = p_parent_id;

  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."revoke_device"("p_device_id" "uuid", "p_parent_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."revoke_device"("p_device_id" "uuid", "p_parent_id" "uuid") IS 'Revokes (soft deletes) a device by setting is_active = false. Returns true if device was found and updated, false otherwise.';



CREATE OR REPLACE FUNCTION "public"."unblock_contact_for_child"("p_blocker_child_id" "uuid", "p_blocked_contact_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Validate that the block belongs to this child
  UPDATE public.blocked_contacts
  SET unblocked_at = NOW()
  WHERE id = p_blocked_contact_id
    AND blocker_child_id = p_blocker_child_id
    AND unblocked_at IS NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN v_updated_count > 0;
END;
$$;


ALTER FUNCTION "public"."unblock_contact_for_child"("p_blocker_child_id" "uuid", "p_blocked_contact_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."unblock_contact_for_child"("p_blocker_child_id" "uuid", "p_blocked_contact_id" "uuid") IS 'Allows children to unblock contacts they previously blocked.';



CREATE OR REPLACE FUNCTION "public"."update_conversation_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_conversation_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_device_login"("p_parent_id" "uuid", "p_device_identifier" "text", "p_device_name" "text", "p_device_type" "text", "p_user_agent" "text", "p_ip_address" "inet", "p_child_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  device_id UUID;
BEGIN
  -- Try to find existing device
  SELECT id INTO device_id
  FROM public.devices
  WHERE parent_id = p_parent_id
    AND device_identifier = p_device_identifier
    AND is_active = true
  LIMIT 1;

  IF device_id IS NOT NULL THEN
    -- Update existing device
    UPDATE public.devices
    SET 
      last_login_at = NOW(),
      last_used_child_id = COALESCE(p_child_id, last_used_child_id),
      last_ip_address = p_ip_address,
      user_agent = p_user_agent,
      updated_at = NOW()
    WHERE id = device_id;
  ELSE
    -- Create new device
    INSERT INTO public.devices (
      parent_id,
      device_name,
      device_type,
      device_identifier,
      last_used_child_id,
      last_ip_address,
      user_agent
    )
    VALUES (
      p_parent_id,
      p_device_name,
      p_device_type,
      p_device_identifier,
      p_child_id,
      p_ip_address,
      p_user_agent
    )
    RETURNING id INTO device_id;
  END IF;

  RETURN device_id;
END;
$$;


ALTER FUNCTION "public"."update_device_login"("p_parent_id" "uuid", "p_device_identifier" "text", "p_device_name" "text", "p_device_type" "text", "p_user_agent" "text", "p_ip_address" "inet", "p_child_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_device_login"("p_parent_id" "uuid", "p_device_identifier" "text", "p_device_name" "text", "p_device_type" "text", "p_user_agent" "text", "p_ip_address" "text", "p_mac_address" "text" DEFAULT NULL::"text", "p_country_code" "text" DEFAULT NULL::"text", "p_child_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  device_id UUID;
  ip_address_validated TEXT;
BEGIN
  -- Safely validate IP address (handles invalid IPs)
  BEGIN
    IF p_ip_address IS NULL OR p_ip_address = '' THEN
      ip_address_validated := NULL;
    ELSE
      -- Validate IP format by attempting conversion to INET
      PERFORM p_ip_address::inet;
      ip_address_validated := p_ip_address;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If IP address is invalid, set to NULL instead of failing
    ip_address_validated := NULL;
  END;

  -- Try to find existing device by identifier
  SELECT id INTO device_id
  FROM public.devices
  WHERE parent_id = p_parent_id
    AND device_identifier = p_device_identifier
    AND is_active = true
  LIMIT 1;

  IF device_id IS NOT NULL THEN
    -- Update existing device
    UPDATE public.devices
    SET 
      last_login_at = NOW(),
      last_used_child_id = COALESCE(p_child_id, last_used_child_id),
      last_ip_address = CASE 
        WHEN ip_address_validated IS NULL THEN NULL 
        ELSE ip_address_validated::inet 
      END,
      mac_address = COALESCE(p_mac_address, mac_address),
      country_code = COALESCE(p_country_code, country_code), -- Update country if provided, keep existing if null
      user_agent = p_user_agent,
      updated_at = NOW()
    WHERE id = device_id;
  ELSE
    -- Create new device
    INSERT INTO public.devices (
      parent_id,
      device_name,
      device_type,
      device_identifier,
      last_used_child_id,
      last_ip_address,
      mac_address,
      country_code,
      user_agent
    )
    VALUES (
      p_parent_id,
      p_device_name,
      p_device_type,
      p_device_identifier,
      p_child_id,
      CASE 
        WHEN ip_address_validated IS NULL THEN NULL 
        ELSE ip_address_validated::inet 
      END,
      p_mac_address,
      p_country_code,
      p_user_agent
    )
    RETURNING id INTO device_id;
  END IF;

  RETURN device_id;
END;
$$;


ALTER FUNCTION "public"."update_device_login"("p_parent_id" "uuid", "p_device_identifier" "text", "p_device_name" "text", "p_device_type" "text", "p_user_agent" "text", "p_ip_address" "text", "p_mac_address" "text", "p_country_code" "text", "p_child_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_devices_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_devices_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_family_member_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_family_member_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_profile_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upgrade_family_subscription"("p_family_email" "text", "p_subscription_type" "text", "p_allowed_children" integer, "p_stripe_customer_id" "text" DEFAULT NULL::"text", "p_stripe_subscription_id" "text" DEFAULT NULL::"text", "p_stripe_price_id" "text" DEFAULT NULL::"text", "p_stripe_payment_link_id" "text" DEFAULT NULL::"text", "p_stripe_checkout_session_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_parent_id UUID;
  v_current_children_count INTEGER;
  v_authenticated_user_id UUID;
  v_session_already_used BOOLEAN;
BEGIN
  -- Get authenticated user ID
  v_authenticated_user_id := auth.uid();
  
  IF v_authenticated_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required'
    );
  END IF;
  
  -- Find parent by email
  SELECT id INTO v_parent_id
  FROM public.parents
  WHERE email = p_family_email;
  
  IF v_parent_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Family account not found with email: ' || p_family_email
    );
  END IF;
  
  -- SECURITY: Verify the email matches the authenticated user
  IF v_parent_id != v_authenticated_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only upgrade your own account. Email must match your authenticated account.'
    );
  END IF;
  
  -- SECURITY: Check if Stripe checkout session has already been used (if provided)
  IF p_stripe_checkout_session_id IS NOT NULL THEN
    -- Check if table exists (might not exist if migration 20250122000008 hasn't run)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'stripe_checkout_sessions'
    ) THEN
      SELECT EXISTS(
        SELECT 1 FROM public.stripe_checkout_sessions
        WHERE checkout_session_id = p_stripe_checkout_session_id
      ) INTO v_session_already_used;
      
      IF v_session_already_used THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'This payment has already been processed. Each payment can only be used once.'
        );
      END IF;
    END IF;
  END IF;
  
  -- Update subscription with all Stripe details
  UPDATE public.parents
  SET 
    subscription_type = p_subscription_type,
    allowed_children = p_allowed_children,
    subscription_status = 'active',
    subscription_started_at = COALESCE(subscription_started_at, NOW()),
    subscription_expires_at = CASE 
      WHEN p_subscription_type LIKE '%annual%' OR p_subscription_type LIKE '%year%' THEN NOW() + INTERVAL '1 year'
      WHEN p_subscription_type LIKE '%month%' THEN NOW() + INTERVAL '1 month'
      ELSE NULL
    END,
    stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
    stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
    stripe_price_id = COALESCE(p_stripe_price_id, stripe_price_id),
    stripe_payment_link_id = COALESCE(p_stripe_payment_link_id, stripe_payment_link_id),
    stripe_checkout_session_id = COALESCE(p_stripe_checkout_session_id, stripe_checkout_session_id)
  WHERE id = v_parent_id;
  
  -- Record the checkout session as used (if provided and table exists)
  IF p_stripe_checkout_session_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'stripe_checkout_sessions'
    ) THEN
      INSERT INTO public.stripe_checkout_sessions (
        checkout_session_id,
        parent_id,
        subscription_type
      ) VALUES (
        p_stripe_checkout_session_id,
        v_parent_id,
        p_subscription_type
      ) ON CONFLICT (checkout_session_id) DO NOTHING;
    END IF;
  END IF;
  
  -- Get current child count
  SELECT COUNT(*) INTO v_current_children_count
  FROM public.children
  WHERE parent_id = v_parent_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'parent_id', v_parent_id,
    'subscription_type', p_subscription_type,
    'allowed_children', p_allowed_children,
    'current_children_count', v_current_children_count,
    'stripe_subscription_id', p_stripe_subscription_id,
    'stripe_customer_id', p_stripe_customer_id
  );
END;
$$;


ALTER FUNCTION "public"."upgrade_family_subscription"("p_family_email" "text", "p_subscription_type" "text", "p_allowed_children" integer, "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_stripe_price_id" "text", "p_stripe_payment_link_id" "text", "p_stripe_checkout_session_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."upgrade_family_subscription"("p_family_email" "text", "p_subscription_type" "text", "p_allowed_children" integer, "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_stripe_price_id" "text", "p_stripe_payment_link_id" "text", "p_stripe_checkout_session_id" "text") IS 'Unified function to upgrade family subscription. Handles both Payment Links and Subscriptions API. Accepts all Stripe-related parameters with defaults.';



CREATE OR REPLACE FUNCTION "public"."user_has_family_access"("p_family_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if the current user has any profile in the given family
  -- SECURITY DEFINER bypasses RLS, so this won't cause recursion
  RETURN EXISTS (
    SELECT 1 FROM public.adult_profiles ap
    WHERE ap.user_id = auth.uid()
      AND ap.family_id = p_family_id
  );
END;
$$;


ALTER FUNCTION "public"."user_has_family_access"("p_family_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_child_can_insert_call"("p_child_id" "uuid", "p_parent_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Verify child exists and parent_id matches
  RETURN EXISTS (
    SELECT 1 
    FROM public.children 
    WHERE id = p_child_id 
    AND parent_id = p_parent_id
  );
END;
$$;


ALTER FUNCTION "public"."verify_child_can_insert_call"("p_child_id" "uuid", "p_parent_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_child_can_send_message"("p_child_id" "uuid", "p_sender_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Verify child exists and sender_id matches child_id
  -- SECURITY DEFINER allows this to bypass RLS on children table
  RETURN EXISTS (
    SELECT 1 FROM public.children
    WHERE id = p_child_id
    AND id = p_sender_id
  );
END;
$$;


ALTER FUNCTION "public"."verify_child_can_send_message"("p_child_id" "uuid", "p_sender_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_child_parent"("p_child_id" "uuid", "p_parent_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- This runs with SECURITY DEFINER, so it bypasses RLS
    RETURN EXISTS (
        SELECT 1 
        FROM public.children
        WHERE id = p_child_id
        AND parent_id = p_parent_id
    );
END;
$$;


ALTER FUNCTION "public"."verify_child_parent"("p_child_id" "uuid", "p_parent_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_child_parent_relationship"("p_child_id" "uuid", "p_parent_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.children 
        WHERE id = p_child_id 
        AND parent_id = p_parent_id
    );
$$;


ALTER FUNCTION "public"."verify_child_parent_relationship"("p_child_id" "uuid", "p_parent_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."adult_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "family_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "relationship_type" "text",
    "name" "text" NOT NULL,
    "email" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "adult_profiles_relationship_type_check" CHECK (("relationship_type" = ANY (ARRAY['grandparent'::"text", 'aunt'::"text", 'uncle'::"text", 'cousin'::"text", 'other'::"text"]))),
    CONSTRAINT "adult_profiles_role_check" CHECK (("role" = ANY (ARRAY['parent'::"text", 'family_member'::"text"])))
);


ALTER TABLE "public"."adult_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "ip" "text",
    "user_agent" "text",
    "event_timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb",
    "severity" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "audit_logs_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocked_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blocker_child_id" "uuid" NOT NULL,
    "blocked_adult_profile_id" "uuid",
    "blocked_child_profile_id" "uuid",
    "blocked_at" timestamp with time zone DEFAULT "now"(),
    "parent_notified_at" timestamp with time zone,
    "unblocked_at" timestamp with time zone,
    "unblocked_by_parent_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "blocked_contacts_one_target" CHECK (((("blocked_adult_profile_id" IS NOT NULL) AND ("blocked_child_profile_id" IS NULL)) OR (("blocked_adult_profile_id" IS NULL) AND ("blocked_child_profile_id" IS NOT NULL))))
);


ALTER TABLE "public"."blocked_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "caller_id" "uuid",
    "callee_id" "uuid",
    "call_type" "text",
    "status" "text" DEFAULT 'initiated'::"text",
    "caller_profile" "jsonb",
    "callee_profile" "jsonb",
    "child_id" "uuid",
    "parent_id" "uuid",
    "caller_type" "text",
    "offer" "jsonb",
    "answer" "jsonb",
    "parent_ice_candidates" "jsonb" DEFAULT '[]'::"jsonb",
    "child_ice_candidates" "jsonb" DEFAULT '[]'::"jsonb",
    "ended_at" timestamp with time zone,
    "ended_by" "text",
    "end_reason" "text",
    "version" bigint DEFAULT 0,
    "missed_call" boolean DEFAULT false,
    "missed_call_read_at" timestamp with time zone,
    "family_member_id" "uuid",
    "conversation_id" "uuid",
    CONSTRAINT "calls_caller_type_check" CHECK (("caller_type" = ANY (ARRAY['parent'::"text", 'child'::"text", 'family_member'::"text"]))),
    CONSTRAINT "calls_ended_by_check" CHECK (("ended_by" = ANY (ARRAY['parent'::"text", 'child'::"text"]))),
    CONSTRAINT "ended_has_timestamp" CHECK (((("status" <> 'ended'::"text") AND ("ended_at" IS NULL)) OR (("status" = 'ended'::"text") AND ("ended_at" IS NOT NULL))))
);


ALTER TABLE "public"."calls" OWNER TO "postgres";


COMMENT ON COLUMN "public"."calls"."missed_call" IS 'TRUE if this call ended without being answered (missed call)';



COMMENT ON COLUMN "public"."calls"."missed_call_read_at" IS 'Timestamp when the missed call notification was read/acknowledged. NULL means unread.';



CREATE TABLE IF NOT EXISTS "public"."calls_backup" (
    "id" "uuid",
    "created_at" timestamp with time zone,
    "caller_id" "uuid",
    "callee_id" "uuid",
    "call_type" "text",
    "status" "text",
    "caller_profile" "jsonb",
    "callee_profile" "jsonb",
    "backup_created_at" timestamp with time zone
);


ALTER TABLE "public"."calls_backup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."child_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_child_id" "uuid" NOT NULL,
    "requester_family_id" "uuid" NOT NULL,
    "target_child_id" "uuid" NOT NULL,
    "target_family_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approved_by_parent_id" "uuid",
    "approved_at" timestamp with time zone,
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "requested_by_child" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "child_connections_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."child_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."child_family_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "child_profile_id" "uuid" NOT NULL,
    "family_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."child_family_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."child_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "family_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "login_code" "text" NOT NULL,
    "avatar_url" "text",
    "avatar_color" "text" DEFAULT '#3B82F6'::"text",
    "age" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."child_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."children" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "login_code" "text" NOT NULL,
    "avatar_color" "text" DEFAULT '#3B82F6'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."children" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "conversation_participants_role_check" CHECK (("role" = ANY (ARRAY['parent'::"text", 'family_member'::"text", 'child'::"text"])))
);


ALTER TABLE "public"."conversation_participants" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversation_participants" IS 'Links users/children to conversations. Supports adults (user_id = auth.users.id) and children (user_id = child_profiles.id).';



CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "adult_id" "uuid",
    "child_id" "uuid",
    "adult_role" "text",
    "type" "text" DEFAULT 'one_to_one'::"text" NOT NULL,
    CONSTRAINT "conversations_adult_role_check" CHECK (("adult_role" = ANY (ARRAY['parent'::"text", 'family_member'::"text"]))),
    CONSTRAINT "conversations_type_check" CHECK (("type" = ANY (ARRAY['one_to_one'::"text", 'group'::"text"])))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversations" IS 'Conversations table supporting 1:1 and group chats. Used for child-to-child messaging/calls when enabled.';



CREATE TABLE IF NOT EXISTS "public"."devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_id" "uuid" NOT NULL,
    "device_name" "text" NOT NULL,
    "device_type" "text" NOT NULL,
    "device_identifier" "text" NOT NULL,
    "last_used_child_id" "uuid",
    "last_login_at" timestamp with time zone DEFAULT "now"(),
    "last_ip_address" "inet",
    "last_location" "text",
    "user_agent" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "mac_address" "text",
    "country_code" "text",
    CONSTRAINT "devices_device_type_check" CHECK (("device_type" = ANY (ARRAY['mobile'::"text", 'tablet'::"text", 'desktop'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."devices" OWNER TO "postgres";


COMMENT ON TABLE "public"."devices" IS 'Tracks devices used to access family accounts for security and management';



COMMENT ON COLUMN "public"."devices"."device_identifier" IS 'Unique fingerprint/identifier for the device (browser fingerprint, device ID, etc.)';



COMMENT ON COLUMN "public"."devices"."last_location" IS 'Approximate location based on IP geolocation or user-provided location';



COMMENT ON COLUMN "public"."devices"."mac_address" IS 'MAC address for native apps (Android only, iOS blocks access). Format: XX:XX:XX:XX:XX:XX or stored without colons.';



COMMENT ON COLUMN "public"."devices"."country_code" IS 'ISO 3166-1 alpha-2 country code (e.g., US, GB, CA) derived from IP geolocation. Used to display country flags.';



CREATE TABLE IF NOT EXISTS "public"."families" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "invite_code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "household_type" "text" DEFAULT 'single'::"text" NOT NULL,
    "linked_family_id" "uuid",
    "linked_at" timestamp with time zone,
    "safety_mode_enabled" boolean DEFAULT false NOT NULL,
    "safety_mode_settings" "jsonb" DEFAULT '{"keyword_alerts": true, "alert_threshold": "medium", "ai_content_scanning": false, "export_conversations": true}'::"jsonb",
    CONSTRAINT "families_household_type_check" CHECK (("household_type" = ANY (ARRAY['single'::"text", 'two_household'::"text"]))),
    CONSTRAINT "families_no_self_link" CHECK (("linked_family_id" <> "id"))
);


ALTER TABLE "public"."families" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_feature_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "family_id" "uuid" NOT NULL,
    "key" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."family_feature_flags" OWNER TO "postgres";


COMMENT ON TABLE "public"."family_feature_flags" IS 'Feature flags per family. Allows enabling/disabling features like child-to-child messaging/calls without migrations.';



CREATE TABLE IF NOT EXISTS "public"."family_members" (
    "id" "uuid",
    "parent_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "relationship" "text" NOT NULL,
    "invitation_token" "uuid" DEFAULT "gen_random_uuid"(),
    "invitation_sent_at" timestamp with time zone,
    "invitation_accepted_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "internal_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    CONSTRAINT "family_members_relationship_check" CHECK (("relationship" = ANY (ARRAY['grandparent'::"text", 'aunt'::"text", 'uncle'::"text", 'cousin'::"text", 'other'::"text"]))),
    CONSTRAINT "family_members_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."family_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "sender_type" "text" NOT NULL,
    "child_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "read_at" timestamp with time zone,
    "family_member_id" "uuid",
    "conversation_id" "uuid" NOT NULL,
    "receiver_type" "text",
    CONSTRAINT "messages_receiver_type_check" CHECK (("receiver_type" = ANY (ARRAY['parent'::"text", 'family_member'::"text", 'child'::"text"]))),
    CONSTRAINT "messages_sender_type_check" CHECK (("sender_type" = ANY (ARRAY['parent'::"text", 'child'::"text", 'family_member'::"text"])))
);

ALTER TABLE ONLY "public"."messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON COLUMN "public"."messages"."read_at" IS 'Timestamp when the message was read by the recipient. NULL means unread.';



CREATE TABLE IF NOT EXISTS "public"."parent_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_id" "uuid" NOT NULL,
    "child_id" "uuid" NOT NULL,
    "blocked_id" "uuid",
    "blocked_contact_id" "uuid",
    "notification_type" "text" DEFAULT 'block'::"text" NOT NULL,
    "message" "text",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "parent_notifications_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['block'::"text", 'report'::"text"])))
);


ALTER TABLE "public"."parent_notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."parent_notifications" IS 'Stores notifications for parents when their children block contacts or create reports.';



CREATE TABLE IF NOT EXISTS "public"."parents" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "family_code" "text",
    "allowed_children" integer DEFAULT 1,
    "subscription_type" "text" DEFAULT 'free'::"text",
    "subscription_status" "text" DEFAULT 'active'::"text",
    "subscription_started_at" timestamp with time zone,
    "subscription_expires_at" timestamp with time zone,
    "stripe_payment_link_id" "text",
    "stripe_checkout_session_id" "text",
    "subscription_cancelled_at" timestamp with time zone,
    "subscription_cancel_reason" "text",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "privacy_cookie_accepted" boolean DEFAULT false NOT NULL,
    "email_updates_opt_in" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."parents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "role" "text",
    "family_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_child_id" "uuid" NOT NULL,
    "reported_adult_profile_id" "uuid",
    "reported_child_profile_id" "uuid",
    "report_type" "text" NOT NULL,
    "report_message" "text",
    "related_message_id" "uuid",
    "related_call_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by_parent_id" "uuid",
    "reviewed_at" timestamp with time zone,
    "resolution_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reports_one_target" CHECK (((("reported_adult_profile_id" IS NOT NULL) AND ("reported_child_profile_id" IS NULL)) OR (("reported_adult_profile_id" IS NULL) AND ("reported_child_profile_id" IS NOT NULL)))),
    CONSTRAINT "reports_report_type_check" CHECK (("report_type" = ANY (ARRAY['inappropriate_content'::"text", 'harassment'::"text", 'bullying'::"text", 'threat'::"text", 'other'::"text"]))),
    CONSTRAINT "reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'resolved'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_checkout_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "checkout_session_id" "text" NOT NULL,
    "parent_id" "uuid" NOT NULL,
    "subscription_type" "text" NOT NULL,
    "used_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stripe_checkout_sessions" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."timezone_names_cache" AS
 SELECT "name"
   FROM "pg_timezone_names"
  ORDER BY "name"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."timezone_names_cache" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."timezone_names_cache" IS 'Cached timezone names from pg_timezone_names. Refresh periodically using refresh_timezone_cache(). This provides much better cache hit rates than direct pg_timezone_names queries.';



ALTER TABLE ONLY "public"."adult_profiles"
    ADD CONSTRAINT "adult_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."adult_profiles"
    ADD CONSTRAINT "adult_profiles_user_id_family_id_role_key" UNIQUE ("user_id", "family_id", "role");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocked_contacts"
    ADD CONSTRAINT "blocked_contacts_blocker_child_id_blocked_adult_profile_id__key" UNIQUE ("blocker_child_id", "blocked_adult_profile_id", "blocked_child_profile_id");



ALTER TABLE ONLY "public"."blocked_contacts"
    ADD CONSTRAINT "blocked_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_connections"
    ADD CONSTRAINT "child_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_connections"
    ADD CONSTRAINT "child_connections_requester_child_id_target_child_id_key" UNIQUE ("requester_child_id", "target_child_id");



ALTER TABLE ONLY "public"."child_family_memberships"
    ADD CONSTRAINT "child_family_memberships_child_profile_id_family_id_key" UNIQUE ("child_profile_id", "family_id");



ALTER TABLE ONLY "public"."child_family_memberships"
    ADD CONSTRAINT "child_family_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_profiles"
    ADD CONSTRAINT "child_profiles_login_code_key" UNIQUE ("login_code");



ALTER TABLE ONLY "public"."child_profiles"
    ADD CONSTRAINT "child_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."children"
    ADD CONSTRAINT "children_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_user_id_key" UNIQUE ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_unique_adult_child" UNIQUE ("adult_id", "child_id");



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_parent_id_device_identifier_key" UNIQUE ("parent_id", "device_identifier");



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."families"
    ADD CONSTRAINT "families_invite_code_key" UNIQUE ("invite_code");



ALTER TABLE ONLY "public"."families"
    ADD CONSTRAINT "families_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_feature_flags"
    ADD CONSTRAINT "family_feature_flags_family_id_key_key" UNIQUE ("family_id", "key");



ALTER TABLE ONLY "public"."family_feature_flags"
    ADD CONSTRAINT "family_feature_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_id_unique" UNIQUE ("id");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_invitation_token_key" UNIQUE ("invitation_token");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_pkey" PRIMARY KEY ("internal_id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parent_notifications"
    ADD CONSTRAINT "parent_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parents"
    ADD CONSTRAINT "parents_family_code_key" UNIQUE ("family_code");



ALTER TABLE ONLY "public"."parents"
    ADD CONSTRAINT "parents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_checkout_sessions"
    ADD CONSTRAINT "stripe_checkout_sessions_checkout_session_id_key" UNIQUE ("checkout_session_id");



ALTER TABLE ONLY "public"."stripe_checkout_sessions"
    ADD CONSTRAINT "stripe_checkout_sessions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_adult_profiles_family_id" ON "public"."adult_profiles" USING "btree" ("family_id");



CREATE INDEX "idx_adult_profiles_role" ON "public"."adult_profiles" USING "btree" ("role");



CREATE INDEX "idx_adult_profiles_user_family" ON "public"."adult_profiles" USING "btree" ("user_id", "family_id");



CREATE INDEX "idx_adult_profiles_user_family_role" ON "public"."adult_profiles" USING "btree" ("user_id", "family_id", "role");



CREATE INDEX "idx_adult_profiles_user_id" ON "public"."adult_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_adult_profiles_user_role_covering" ON "public"."adult_profiles" USING "btree" ("user_id", "role") INCLUDE ("id", "family_id", "created_at") WHERE (("user_id" IS NOT NULL) AND ("role" IS NOT NULL));



CREATE INDEX "idx_audit_logs_event_timestamp" ON "public"."audit_logs" USING "btree" ("event_timestamp" DESC);



CREATE INDEX "idx_audit_logs_event_type" ON "public"."audit_logs" USING "btree" ("event_type");



CREATE INDEX "idx_audit_logs_severity" ON "public"."audit_logs" USING "btree" ("severity");



CREATE INDEX "idx_audit_logs_user_id" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_blocked_contacts_active" ON "public"."blocked_contacts" USING "btree" ("blocker_child_id", "unblocked_at") WHERE ("unblocked_at" IS NULL);



CREATE INDEX "idx_blocked_contacts_adult" ON "public"."blocked_contacts" USING "btree" ("blocked_adult_profile_id");



CREATE INDEX "idx_blocked_contacts_blocker" ON "public"."blocked_contacts" USING "btree" ("blocker_child_id");



CREATE INDEX "idx_blocked_contacts_child" ON "public"."blocked_contacts" USING "btree" ("blocked_child_profile_id");



CREATE INDEX "idx_calls_backup_caller_callee" ON "public"."calls_backup" USING "btree" ("caller_id", "callee_id");



CREATE INDEX "idx_calls_callee_id" ON "public"."calls" USING "btree" ("callee_id") WHERE ("callee_id" IS NOT NULL);



CREATE INDEX "idx_calls_child_id" ON "public"."calls" USING "btree" ("child_id");



CREATE INDEX "idx_calls_child_status" ON "public"."calls" USING "btree" ("child_id", "status");



CREATE INDEX "idx_calls_conversation_created" ON "public"."calls" USING "btree" ("conversation_id", "created_at" DESC) WHERE ("conversation_id" IS NOT NULL);



CREATE INDEX "idx_calls_conversation_id" ON "public"."calls" USING "btree" ("conversation_id") WHERE ("conversation_id" IS NOT NULL);



CREATE INDEX "idx_calls_created_at" ON "public"."calls" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_calls_ended_at" ON "public"."calls" USING "btree" ("ended_at");



CREATE INDEX "idx_calls_family_member_id" ON "public"."calls" USING "btree" ("family_member_id");



CREATE INDEX "idx_calls_id_active" ON "public"."calls" USING "btree" ("id") WHERE ("id" IS NOT NULL);



CREATE INDEX "idx_calls_missed_unread" ON "public"."calls" USING "btree" ("missed_call_read_at") WHERE (("missed_call" = true) AND ("missed_call_read_at" IS NULL));



CREATE INDEX "idx_calls_parent_id" ON "public"."calls" USING "btree" ("parent_id");



CREATE INDEX "idx_calls_parent_status" ON "public"."calls" USING "btree" ("parent_id", "status");



CREATE INDEX "idx_calls_status" ON "public"."calls" USING "btree" ("status");



CREATE INDEX "idx_child_connections_families" ON "public"."child_connections" USING "btree" ("requester_family_id", "target_family_id");



CREATE INDEX "idx_child_connections_requester" ON "public"."child_connections" USING "btree" ("requester_child_id");



CREATE INDEX "idx_child_connections_status" ON "public"."child_connections" USING "btree" ("status");



CREATE INDEX "idx_child_connections_target" ON "public"."child_connections" USING "btree" ("target_child_id");



CREATE INDEX "idx_child_family_memberships_child" ON "public"."child_family_memberships" USING "btree" ("child_profile_id");



CREATE INDEX "idx_child_family_memberships_family" ON "public"."child_family_memberships" USING "btree" ("family_id");



CREATE INDEX "idx_child_profiles_family_id" ON "public"."child_profiles" USING "btree" ("family_id");



CREATE INDEX "idx_child_profiles_login_code" ON "public"."child_profiles" USING "btree" ("login_code");



CREATE INDEX "idx_children_id" ON "public"."children" USING "btree" ("id");



CREATE INDEX "idx_children_id_parent_id" ON "public"."children" USING "btree" ("id", "parent_id");



CREATE INDEX "idx_children_login_code" ON "public"."children" USING "btree" ("login_code");



CREATE INDEX "idx_children_login_code_pattern" ON "public"."children" USING "btree" ("login_code" "text_pattern_ops");



CREATE INDEX "idx_children_parent_id" ON "public"."children" USING "btree" ("parent_id");



CREATE UNIQUE INDEX "idx_children_parent_login_code_unique" ON "public"."children" USING "btree" ("parent_id", "login_code");



CREATE INDEX "idx_conversation_participants_conversation" ON "public"."conversation_participants" USING "btree" ("conversation_id");



CREATE INDEX "idx_conversation_participants_role" ON "public"."conversation_participants" USING "btree" ("role");



CREATE INDEX "idx_conversation_participants_user" ON "public"."conversation_participants" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_adult_child" ON "public"."conversations" USING "btree" ("adult_id", "child_id");



CREATE INDEX "idx_conversations_adult_id" ON "public"."conversations" USING "btree" ("adult_id");



CREATE INDEX "idx_conversations_adult_id_covering" ON "public"."conversations" USING "btree" ("adult_id") INCLUDE ("id", "child_id", "type", "created_at", "updated_at") WHERE ("adult_id" IS NOT NULL);



CREATE INDEX "idx_conversations_adult_role" ON "public"."conversations" USING "btree" ("adult_role");



CREATE INDEX "idx_conversations_child_id" ON "public"."conversations" USING "btree" ("child_id");



CREATE INDEX "idx_conversations_child_id_covering" ON "public"."conversations" USING "btree" ("child_id") INCLUDE ("id", "adult_id", "type", "created_at", "updated_at") WHERE ("child_id" IS NOT NULL);



CREATE INDEX "idx_conversations_created_at" ON "public"."conversations" USING "btree" ("created_at");



CREATE INDEX "idx_conversations_type" ON "public"."conversations" USING "btree" ("type");



CREATE INDEX "idx_conversations_updated_at" ON "public"."conversations" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_devices_active" ON "public"."devices" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_devices_country_code" ON "public"."devices" USING "btree" ("country_code") WHERE ("country_code" IS NOT NULL);



CREATE INDEX "idx_devices_last_login" ON "public"."devices" USING "btree" ("last_login_at" DESC);



CREATE INDEX "idx_devices_mac_address" ON "public"."devices" USING "btree" ("mac_address") WHERE ("mac_address" IS NOT NULL);



CREATE INDEX "idx_devices_parent_id" ON "public"."devices" USING "btree" ("parent_id");



CREATE INDEX "idx_families_household_type" ON "public"."families" USING "btree" ("household_type");



CREATE INDEX "idx_families_linked_family_id" ON "public"."families" USING "btree" ("linked_family_id");



CREATE INDEX "idx_families_safety_mode" ON "public"."families" USING "btree" ("safety_mode_enabled") WHERE ("safety_mode_enabled" = true);



CREATE INDEX "idx_family_feature_flags_enabled" ON "public"."family_feature_flags" USING "btree" ("enabled") WHERE ("enabled" = true);



CREATE INDEX "idx_family_feature_flags_family" ON "public"."family_feature_flags" USING "btree" ("family_id");



CREATE INDEX "idx_family_feature_flags_key" ON "public"."family_feature_flags" USING "btree" ("key");



CREATE INDEX "idx_family_members_email" ON "public"."family_members" USING "btree" ("email");



CREATE INDEX "idx_family_members_invitation_token" ON "public"."family_members" USING "btree" ("invitation_token");



CREATE INDEX "idx_family_members_parent_id" ON "public"."family_members" USING "btree" ("parent_id");



CREATE INDEX "idx_family_members_status" ON "public"."family_members" USING "btree" ("status");



CREATE INDEX "idx_messages_conversation_created" ON "public"."messages" USING "btree" ("conversation_id", "created_at") WHERE ("conversation_id" IS NOT NULL);



CREATE INDEX "idx_messages_conversation_id" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at");



CREATE INDEX "idx_messages_family_member_id" ON "public"."messages" USING "btree" ("family_member_id");



CREATE INDEX "idx_messages_read_at" ON "public"."messages" USING "btree" ("read_at") WHERE ("read_at" IS NULL);



CREATE INDEX "idx_parent_notifications_child_id" ON "public"."parent_notifications" USING "btree" ("child_id");



CREATE INDEX "idx_parent_notifications_created_at" ON "public"."parent_notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_parent_notifications_parent_id" ON "public"."parent_notifications" USING "btree" ("parent_id");



CREATE INDEX "idx_parent_notifications_read_at" ON "public"."parent_notifications" USING "btree" ("parent_id", "read_at") WHERE ("read_at" IS NULL);



CREATE INDEX "idx_parents_family_code" ON "public"."parents" USING "btree" ("family_code");



CREATE INDEX "idx_parents_subscription_cancelled" ON "public"."parents" USING "btree" ("subscription_cancelled_at") WHERE ("subscription_cancelled_at" IS NOT NULL);



CREATE INDEX "idx_parents_subscription_status" ON "public"."parents" USING "btree" ("subscription_status");



CREATE INDEX "idx_parents_subscription_type" ON "public"."parents" USING "btree" ("subscription_type");



CREATE INDEX "idx_reports_adult" ON "public"."reports" USING "btree" ("reported_adult_profile_id");



CREATE INDEX "idx_reports_child" ON "public"."reports" USING "btree" ("reported_child_profile_id");



CREATE INDEX "idx_reports_pending" ON "public"."reports" USING "btree" ("status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_reports_reporter" ON "public"."reports" USING "btree" ("reporter_child_id");



CREATE INDEX "idx_reports_status" ON "public"."reports" USING "btree" ("status");



CREATE INDEX "idx_stripe_sessions_checkout_id" ON "public"."stripe_checkout_sessions" USING "btree" ("checkout_session_id");



CREATE INDEX "idx_stripe_sessions_parent_id" ON "public"."stripe_checkout_sessions" USING "btree" ("parent_id");



CREATE UNIQUE INDEX "idx_timezone_names_cache_name" ON "public"."timezone_names_cache" USING "btree" ("name");



CREATE OR REPLACE TRIGGER "devices_updated_at" BEFORE UPDATE ON "public"."devices" FOR EACH ROW EXECUTE FUNCTION "public"."update_devices_updated_at"();



CREATE OR REPLACE TRIGGER "trg_cleanup_call_artifacts" AFTER UPDATE ON "public"."calls" FOR EACH ROW WHEN ((("new"."status" = 'ended'::"text") AND ("new"."ended_at" IS NOT NULL) AND (("old"."status" IS NULL) OR ("old"."status" <> 'ended'::"text")))) EXECUTE FUNCTION "public"."cleanup_call_artifacts"();



CREATE OR REPLACE TRIGGER "trg_notify_parents_on_block" AFTER INSERT ON "public"."blocked_contacts" FOR EACH ROW WHEN (("new"."unblocked_at" IS NULL)) EXECUTE FUNCTION "public"."notify_parents_on_block"();



CREATE OR REPLACE TRIGGER "trigger_mark_missed_calls" BEFORE UPDATE ON "public"."calls" FOR EACH ROW EXECUTE FUNCTION "public"."mark_missed_calls"();



CREATE OR REPLACE TRIGGER "update_adult_profiles_updated_at" BEFORE UPDATE ON "public"."adult_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_profile_updated_at"();



CREATE OR REPLACE TRIGGER "update_child_connections_updated_at" BEFORE UPDATE ON "public"."child_connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_profile_updated_at"();



CREATE OR REPLACE TRIGGER "update_child_profiles_updated_at" BEFORE UPDATE ON "public"."child_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_profile_updated_at"();



CREATE OR REPLACE TRIGGER "update_conversation_on_message" AFTER INSERT ON "public"."messages" FOR EACH ROW WHEN (("new"."conversation_id" IS NOT NULL)) EXECUTE FUNCTION "public"."update_conversation_timestamp"();



CREATE OR REPLACE TRIGGER "update_conversations_updated_at" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_profile_updated_at"();



CREATE OR REPLACE TRIGGER "update_family_feature_flags_updated_at" BEFORE UPDATE ON "public"."family_feature_flags" FOR EACH ROW EXECUTE FUNCTION "public"."update_profile_updated_at"();



CREATE OR REPLACE TRIGGER "update_family_members_updated_at" BEFORE UPDATE ON "public"."family_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_family_member_updated_at"();



ALTER TABLE ONLY "public"."adult_profiles"
    ADD CONSTRAINT "adult_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."blocked_contacts"
    ADD CONSTRAINT "blocked_contacts_blocked_adult_profile_id_fkey" FOREIGN KEY ("blocked_adult_profile_id") REFERENCES "public"."adult_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocked_contacts"
    ADD CONSTRAINT "blocked_contacts_blocked_child_profile_id_fkey" FOREIGN KEY ("blocked_child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocked_contacts"
    ADD CONSTRAINT "blocked_contacts_blocker_child_id_fkey" FOREIGN KEY ("blocker_child_id") REFERENCES "public"."child_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocked_contacts"
    ADD CONSTRAINT "blocked_contacts_unblocked_by_parent_id_fkey" FOREIGN KEY ("unblocked_by_parent_id") REFERENCES "public"."adult_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_callee_id_fkey" FOREIGN KEY ("callee_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_caller_id_fkey" FOREIGN KEY ("caller_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_family_member_id_fkey" FOREIGN KEY ("family_member_id") REFERENCES "public"."family_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_connections"
    ADD CONSTRAINT "child_connections_approved_by_parent_id_fkey" FOREIGN KEY ("approved_by_parent_id") REFERENCES "public"."adult_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."child_connections"
    ADD CONSTRAINT "child_connections_requester_child_id_fkey" FOREIGN KEY ("requester_child_id") REFERENCES "public"."child_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_connections"
    ADD CONSTRAINT "child_connections_requester_family_id_fkey" FOREIGN KEY ("requester_family_id") REFERENCES "public"."families"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_connections"
    ADD CONSTRAINT "child_connections_target_child_id_fkey" FOREIGN KEY ("target_child_id") REFERENCES "public"."child_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_connections"
    ADD CONSTRAINT "child_connections_target_family_id_fkey" FOREIGN KEY ("target_family_id") REFERENCES "public"."families"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_family_memberships"
    ADD CONSTRAINT "child_family_memberships_child_profile_id_fkey" FOREIGN KEY ("child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."child_family_memberships"
    ADD CONSTRAINT "child_family_memberships_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_adult_id_fkey" FOREIGN KEY ("adult_id") REFERENCES "public"."adult_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_last_used_child_id_fkey" FOREIGN KEY ("last_used_child_id") REFERENCES "public"."children"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."families"
    ADD CONSTRAINT "families_linked_family_id_fkey" FOREIGN KEY ("linked_family_id") REFERENCES "public"."families"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."family_feature_flags"
    ADD CONSTRAINT "family_feature_flags_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."parents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_family_member_id_fkey" FOREIGN KEY ("family_member_id") REFERENCES "public"."family_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parent_notifications"
    ADD CONSTRAINT "parent_notifications_blocked_contact_id_fkey" FOREIGN KEY ("blocked_contact_id") REFERENCES "public"."blocked_contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parents"
    ADD CONSTRAINT "parents_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reported_adult_profile_id_fkey" FOREIGN KEY ("reported_adult_profile_id") REFERENCES "public"."adult_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reported_child_profile_id_fkey" FOREIGN KEY ("reported_child_profile_id") REFERENCES "public"."child_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reporter_child_id_fkey" FOREIGN KEY ("reporter_child_id") REFERENCES "public"."child_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reviewed_by_parent_id_fkey" FOREIGN KEY ("reviewed_by_parent_id") REFERENCES "public"."adult_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stripe_checkout_sessions"
    ADD CONSTRAINT "stripe_checkout_sessions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can verify login codes" ON "public"."children" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Anyone can view child profiles for login code verification" ON "public"."child_profiles" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Authenticated users can insert audit logs" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Children can delete their own blocks" ON "public"."blocked_contacts" FOR DELETE TO "authenticated", "anon" USING (true);



CREATE POLICY "Children can initiate calls" ON "public"."calls" FOR INSERT TO "anon" WITH CHECK ((("caller_type" = 'child'::"text") AND ("child_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."child_profiles"
  WHERE ("child_profiles"."id" = "calls"."child_id")))));



CREATE POLICY "Children can select their own blocks" ON "public"."blocked_contacts" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Children can send messages" ON "public"."messages" FOR INSERT TO "anon" WITH CHECK ((("sender_type" = 'child'::"text") AND ("sender_id" = "child_id") AND (EXISTS ( SELECT 1
   FROM "public"."child_profiles"
  WHERE ("child_profiles"."id" = "messages"."child_id"))) AND ((("conversation_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."conversation_participants" "cp"
  WHERE (("cp"."conversation_id" = "messages"."conversation_id") AND ("cp"."user_id" = "messages"."child_id"))))) OR ("conversation_id" IS NULL))));



CREATE POLICY "Children can update their calls" ON "public"."calls" FOR UPDATE TO "anon" USING ((("caller_type" = 'child'::"text") AND ("child_id" IS NOT NULL))) WITH CHECK ((("caller_type" = 'child'::"text") AND ("child_id" IS NOT NULL)));



CREATE POLICY "Children can view adult names from conversations" ON "public"."adult_profiles" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE ("c"."adult_id" = "adult_profiles"."id"))));



CREATE POLICY "Parents can block contacts for their children" ON "public"."blocked_contacts" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."adult_profiles" "ap"
     JOIN "public"."child_family_memberships" "cfm" ON (("cfm"."child_profile_id" = "blocked_contacts"."blocker_child_id")))
  WHERE (("ap"."user_id" = "auth"."uid"()) AND ("ap"."role" = 'parent'::"text") AND ("ap"."family_id" = "cfm"."family_id")))));



CREATE POLICY "Parents can select their own notifications" ON "public"."parent_notifications" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."adult_profiles" "ap"
  WHERE (("ap"."id" = "parent_notifications"."parent_id") AND ("ap"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("ap"."role" = 'parent'::"text")))));



CREATE POLICY "Parents can unblock contacts for their children" ON "public"."blocked_contacts" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."adult_profiles" "ap"
     JOIN "public"."child_family_memberships" "cfm" ON (("cfm"."child_profile_id" = "blocked_contacts"."blocker_child_id")))
  WHERE (("ap"."user_id" = "auth"."uid"()) AND ("ap"."role" = 'parent'::"text") AND ("ap"."family_id" = "cfm"."family_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."adult_profiles" "ap"
     JOIN "public"."child_family_memberships" "cfm" ON (("cfm"."child_profile_id" = "blocked_contacts"."blocker_child_id")))
  WHERE (("ap"."user_id" = "auth"."uid"()) AND ("ap"."role" = 'parent'::"text") AND ("ap"."family_id" = "cfm"."family_id")))));



CREATE POLICY "Parents can update their own notifications" ON "public"."parent_notifications" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."adult_profiles" "ap"
  WHERE (("ap"."id" = "parent_notifications"."parent_id") AND ("ap"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("ap"."role" = 'parent'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."adult_profiles" "ap"
  WHERE (("ap"."id" = "parent_notifications"."parent_id") AND ("ap"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("ap"."role" = 'parent'::"text")))));



CREATE POLICY "Parents can view blocked contacts for their children" ON "public"."blocked_contacts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."adult_profiles" "ap"
     JOIN "public"."child_family_memberships" "cfm" ON (("cfm"."child_profile_id" = "blocked_contacts"."blocker_child_id")))
  WHERE (("ap"."user_id" = "auth"."uid"()) AND ("ap"."role" = 'parent'::"text") AND ("ap"."family_id" = "cfm"."family_id")))));



CREATE POLICY "Public profiles are viewable by everyone." ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Service role can read audit logs" ON "public"."audit_logs" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Users can insert their own family." ON "public"."families" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."adult_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blocked_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calls_backup" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calls_backup_delete_owner" ON "public"."calls_backup" FOR DELETE TO "authenticated" USING ((("caller_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("callee_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "calls_backup_insert_owner" ON "public"."calls_backup" FOR INSERT TO "authenticated" WITH CHECK ((("caller_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("callee_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "calls_backup_select_owner" ON "public"."calls_backup" FOR SELECT TO "authenticated" USING ((("caller_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("callee_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "calls_backup_update_owner" ON "public"."calls_backup" FOR UPDATE TO "authenticated" USING ((("caller_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("callee_id" = ( SELECT "auth"."uid"() AS "uid")))) WITH CHECK ((("caller_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("callee_id" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."child_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_family_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."children" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."devices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."families" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_feature_flags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parent_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_checkout_sessions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."adult_profiles";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."blocked_contacts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."calls";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."child_connections";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."child_family_memberships";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."child_profiles";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."conversation_participants";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."conversations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."devices";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."family_feature_flags";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."family_members";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."reports";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





























































































































































































GRANT ALL ON FUNCTION "public"."block_contact_for_child"("p_blocker_child_id" "uuid", "p_blocked_adult_profile_id" "uuid", "p_blocked_child_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."block_contact_for_child"("p_blocker_child_id" "uuid", "p_blocked_adult_profile_id" "uuid", "p_blocked_child_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."block_contact_for_child"("p_blocker_child_id" "uuid", "p_blocked_adult_profile_id" "uuid", "p_blocked_child_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_add_child"("p_parent_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_add_child"("p_parent_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_add_child"("p_parent_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_child_view_parent"("parent_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_child_view_parent"("parent_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_child_view_parent"("parent_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_children_communicate"("p_child1_id" "uuid", "p_child2_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_children_communicate"("p_child1_id" "uuid", "p_child2_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_children_communicate"("p_child1_id" "uuid", "p_child2_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_users_call"("p_sender_id" "uuid", "p_sender_type" "text", "p_receiver_id" "uuid", "p_receiver_type" "text", "p_sender_family_id" "uuid", "p_receiver_family_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_users_call"("p_sender_id" "uuid", "p_sender_type" "text", "p_receiver_id" "uuid", "p_receiver_type" "text", "p_sender_family_id" "uuid", "p_receiver_family_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_users_call"("p_sender_id" "uuid", "p_sender_type" "text", "p_receiver_id" "uuid", "p_receiver_type" "text", "p_sender_family_id" "uuid", "p_receiver_family_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_users_communicate"("p_sender_id" "uuid", "p_sender_type" "text", "p_receiver_id" "uuid", "p_receiver_type" "text", "p_sender_family_id" "uuid", "p_receiver_family_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_users_communicate"("p_sender_id" "uuid", "p_sender_type" "text", "p_receiver_id" "uuid", "p_receiver_type" "text", "p_sender_family_id" "uuid", "p_receiver_family_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_users_communicate"("p_sender_id" "uuid", "p_sender_type" "text", "p_receiver_id" "uuid", "p_receiver_type" "text", "p_sender_family_id" "uuid", "p_receiver_family_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_subscription"("p_parent_id" "uuid", "p_cancel_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_subscription"("p_parent_id" "uuid", "p_cancel_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_subscription"("p_parent_id" "uuid", "p_cancel_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_family_member_email"("email_to_check" "text", "parent_id_to_check" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_family_member_email"("email_to_check" "text", "parent_id_to_check" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_family_member_email"("email_to_check" "text", "parent_id_to_check" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_call_artifacts"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_call_artifacts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_call_artifacts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_audit_logs"("p_retention_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_audit_logs"("p_retention_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_audit_logs"("p_retention_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_user_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_call_ending_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_call_ending_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_call_ending_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_kid_friendly_login_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_kid_friendly_login_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_kid_friendly_login_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_unique_family_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_unique_family_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_unique_family_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_unique_login_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_unique_login_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_unique_login_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_adult_profile_id"("p_user_id" "uuid", "p_family_id" "uuid", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_adult_profile_id"("p_user_id" "uuid", "p_family_id" "uuid", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_adult_profile_id"("p_user_id" "uuid", "p_family_id" "uuid", "p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_audit_logs"("p_user_id" "uuid", "p_event_type" "text", "p_severity" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_audit_logs"("p_user_id" "uuid", "p_event_type" "text", "p_severity" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_audit_logs"("p_user_id" "uuid", "p_event_type" "text", "p_severity" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_child_blocks"("p_child_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_child_blocks"("p_child_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_child_blocks"("p_child_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_child_families"("p_child_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_child_families"("p_child_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_child_families"("p_child_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_child_profile_id"("p_child_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_child_profile_id"("p_child_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_child_profile_id"("p_child_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_adult_profile_id"("p_family_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_adult_profile_id"("p_family_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_adult_profile_id"("p_family_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_full_login_code"("p_child_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_full_login_code"("p_child_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_full_login_code"("p_child_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_conversation"("p_adult_id" "uuid", "p_adult_role" "text", "p_child_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_conversation"("p_adult_id" "uuid", "p_adult_role" "text", "p_child_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_conversation"("p_adult_id" "uuid", "p_adult_role" "text", "p_child_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_conversation"("p_participant1_id" "uuid", "p_participant1_type" "text", "p_participant2_id" "uuid", "p_participant2_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_conversation"("p_participant1_id" "uuid", "p_participant1_type" "text", "p_participant2_id" "uuid", "p_participant2_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_conversation"("p_participant1_id" "uuid", "p_participant1_type" "text", "p_participant2_id" "uuid", "p_participant2_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_parent_name_for_child"("parent_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_parent_name_for_child"("parent_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_parent_name_for_child"("parent_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_timezone_names"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_timezone_names"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_timezone_names"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_family_member"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_family_member"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_family_member"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_parent"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_parent"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_parent"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_call_version"("call_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_call_version"("call_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_call_version"("call_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contact_blocked"("p_child_id" "uuid", "p_adult_profile_id" "uuid", "p_child_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contact_blocked"("p_child_id" "uuid", "p_adult_profile_id" "uuid", "p_child_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contact_blocked"("p_child_id" "uuid", "p_adult_profile_id" "uuid", "p_child_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_feature_enabled_for_children"("p_child_a_id" "uuid", "p_child_b_id" "uuid", "p_feature_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_feature_enabled_for_children"("p_child_a_id" "uuid", "p_child_b_id" "uuid", "p_feature_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_feature_enabled_for_children"("p_child_a_id" "uuid", "p_child_b_id" "uuid", "p_feature_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_family_member_to_auth_user"("p_invitation_token" "uuid", "p_auth_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."link_family_member_to_auth_user"("p_invitation_token" "uuid", "p_auth_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_family_member_to_auth_user"("p_invitation_token" "uuid", "p_auth_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_audit_event"("p_event_type" "text", "p_user_id" "uuid", "p_email" "text", "p_ip" "text", "p_user_agent" "text", "p_timestamp" timestamp with time zone, "p_metadata" "jsonb", "p_severity" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_audit_event"("p_event_type" "text", "p_user_id" "uuid", "p_email" "text", "p_ip" "text", "p_user_agent" "text", "p_timestamp" timestamp with time zone, "p_metadata" "jsonb", "p_severity" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_audit_event"("p_event_type" "text", "p_user_id" "uuid", "p_email" "text", "p_ip" "text", "p_user_agent" "text", "p_timestamp" timestamp with time zone, "p_metadata" "jsonb", "p_severity" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_missed_calls"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_missed_calls"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_missed_calls"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_parents_on_block"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_parents_on_block"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_expired_subscriptions"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_expired_subscriptions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_expired_subscriptions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reactivate_subscription"("p_parent_id" "uuid", "p_subscription_type" "text", "p_allowed_children" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."reactivate_subscription"("p_parent_id" "uuid", "p_subscription_type" "text", "p_allowed_children" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reactivate_subscription"("p_parent_id" "uuid", "p_subscription_type" "text", "p_allowed_children" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_timezone_cache"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_timezone_cache"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_timezone_cache"() TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_device"("p_device_id" "uuid", "p_parent_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_device"("p_device_id" "uuid", "p_parent_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_device"("p_device_id" "uuid", "p_parent_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."unblock_contact_for_child"("p_blocker_child_id" "uuid", "p_blocked_contact_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."unblock_contact_for_child"("p_blocker_child_id" "uuid", "p_blocked_contact_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unblock_contact_for_child"("p_blocker_child_id" "uuid", "p_blocked_contact_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_device_login"("p_parent_id" "uuid", "p_device_identifier" "text", "p_device_name" "text", "p_device_type" "text", "p_user_agent" "text", "p_ip_address" "inet", "p_child_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_device_login"("p_parent_id" "uuid", "p_device_identifier" "text", "p_device_name" "text", "p_device_type" "text", "p_user_agent" "text", "p_ip_address" "inet", "p_child_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_device_login"("p_parent_id" "uuid", "p_device_identifier" "text", "p_device_name" "text", "p_device_type" "text", "p_user_agent" "text", "p_ip_address" "inet", "p_child_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_device_login"("p_parent_id" "uuid", "p_device_identifier" "text", "p_device_name" "text", "p_device_type" "text", "p_user_agent" "text", "p_ip_address" "text", "p_mac_address" "text", "p_country_code" "text", "p_child_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_device_login"("p_parent_id" "uuid", "p_device_identifier" "text", "p_device_name" "text", "p_device_type" "text", "p_user_agent" "text", "p_ip_address" "text", "p_mac_address" "text", "p_country_code" "text", "p_child_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_device_login"("p_parent_id" "uuid", "p_device_identifier" "text", "p_device_name" "text", "p_device_type" "text", "p_user_agent" "text", "p_ip_address" "text", "p_mac_address" "text", "p_country_code" "text", "p_child_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_devices_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_devices_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_devices_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_family_member_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_family_member_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_family_member_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_profile_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profile_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upgrade_family_subscription"("p_family_email" "text", "p_subscription_type" "text", "p_allowed_children" integer, "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_stripe_price_id" "text", "p_stripe_payment_link_id" "text", "p_stripe_checkout_session_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upgrade_family_subscription"("p_family_email" "text", "p_subscription_type" "text", "p_allowed_children" integer, "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_stripe_price_id" "text", "p_stripe_payment_link_id" "text", "p_stripe_checkout_session_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upgrade_family_subscription"("p_family_email" "text", "p_subscription_type" "text", "p_allowed_children" integer, "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_stripe_price_id" "text", "p_stripe_payment_link_id" "text", "p_stripe_checkout_session_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_family_access"("p_family_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_family_access"("p_family_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_family_access"("p_family_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_child_can_insert_call"("p_child_id" "uuid", "p_parent_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_child_can_insert_call"("p_child_id" "uuid", "p_parent_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_child_can_insert_call"("p_child_id" "uuid", "p_parent_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_child_can_send_message"("p_child_id" "uuid", "p_sender_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_child_can_send_message"("p_child_id" "uuid", "p_sender_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_child_can_send_message"("p_child_id" "uuid", "p_sender_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_child_parent"("p_child_id" "uuid", "p_parent_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_child_parent"("p_child_id" "uuid", "p_parent_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_child_parent"("p_child_id" "uuid", "p_parent_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_child_parent_relationship"("p_child_id" "uuid", "p_parent_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_child_parent_relationship"("p_child_id" "uuid", "p_parent_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_child_parent_relationship"("p_child_id" "uuid", "p_parent_id" "uuid") TO "service_role";
























GRANT ALL ON TABLE "public"."adult_profiles" TO "anon";
GRANT ALL ON TABLE "public"."adult_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."adult_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."blocked_contacts" TO "anon";
GRANT ALL ON TABLE "public"."blocked_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."calls" TO "anon";
GRANT ALL ON TABLE "public"."calls" TO "authenticated";
GRANT ALL ON TABLE "public"."calls" TO "service_role";



GRANT ALL ON TABLE "public"."calls_backup" TO "anon";
GRANT ALL ON TABLE "public"."calls_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."calls_backup" TO "service_role";



GRANT ALL ON TABLE "public"."child_connections" TO "anon";
GRANT ALL ON TABLE "public"."child_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."child_connections" TO "service_role";



GRANT ALL ON TABLE "public"."child_family_memberships" TO "anon";
GRANT ALL ON TABLE "public"."child_family_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."child_family_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."child_profiles" TO "anon";
GRANT ALL ON TABLE "public"."child_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."child_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."children" TO "anon";
GRANT ALL ON TABLE "public"."children" TO "authenticated";
GRANT ALL ON TABLE "public"."children" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_participants" TO "anon";
GRANT ALL ON TABLE "public"."conversation_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_participants" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."devices" TO "anon";
GRANT ALL ON TABLE "public"."devices" TO "authenticated";
GRANT ALL ON TABLE "public"."devices" TO "service_role";



GRANT ALL ON TABLE "public"."families" TO "anon";
GRANT ALL ON TABLE "public"."families" TO "authenticated";
GRANT ALL ON TABLE "public"."families" TO "service_role";



GRANT ALL ON TABLE "public"."family_feature_flags" TO "anon";
GRANT ALL ON TABLE "public"."family_feature_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."family_feature_flags" TO "service_role";



GRANT ALL ON TABLE "public"."family_members" TO "anon";
GRANT ALL ON TABLE "public"."family_members" TO "authenticated";
GRANT ALL ON TABLE "public"."family_members" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."parent_notifications" TO "anon";
GRANT ALL ON TABLE "public"."parent_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."parent_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."parents" TO "anon";
GRANT ALL ON TABLE "public"."parents" TO "authenticated";
GRANT ALL ON TABLE "public"."parents" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_checkout_sessions" TO "anon";
GRANT ALL ON TABLE "public"."stripe_checkout_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_checkout_sessions" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."timezone_names_cache" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."timezone_names_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."timezone_names_cache" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































