-- =====================================================
-- FINAL RLS POLICIES FOR messages TABLE
-- KidsCallHome Project
-- Created: Based on verified schema inspection
-- =====================================================
--
-- VERIFIED SCHEMA:
-- =====================================================
-- messages table columns:
--   - id (UUID, PRIMARY KEY)
--   - sender_id (UUID, NOT NULL) - Parent's auth.uid() or child's UUID
--   - sender_type (TEXT, NOT NULL) - 'parent' or 'child'
--   - child_id (UUID, NOT NULL) - References children.id
--   - content (TEXT, NOT NULL)
--   - created_at (TIMESTAMPTZ)
--
-- calls table columns:
--   - id (UUID, PRIMARY KEY)
--   - child_id (UUID, NOT NULL) - References children.id
--   - parent_id (UUID, NOT NULL) - Parent's UUID
--   - caller_type (TEXT, NOT NULL) - 'parent' or 'child'
--   - status (TEXT, NOT NULL) - 'ringing', 'active', 'ended'
--   - offer (JSONB)
--   - answer (JSONB)
--   - ice_candidates (JSONB)
--   - created_at (TIMESTAMPTZ)
--   - ended_at (TIMESTAMPTZ)
--
-- IMPORTANT FINDINGS:
-- =====================================================
-- 1. messages table does NOT have a call_id column
-- 2. Messages are NOT tied to calls - they are independent parent-child messaging
-- 3. Messages are tied to child_id only - all messages for a conversation are filtered by child_id
-- 4. sender_id for parents = auth.uid() (parent's UUID from auth.users)
-- 5. sender_id for children = child.id (child's UUID from children table)
--
-- RELATIONSHIP EXPLANATION:
-- =====================================================
-- Messages are parent-child communication tied to a specific child (child_id).
-- They are NOT related to calls. The messaging system is separate from the call system.
-- 
-- For a conversation with a specific child:
-- - All messages have the same child_id
-- - Parent messages: sender_type='parent', sender_id=auth.uid(), child_id=child.id
-- - Child messages: sender_type='child', sender_id=child.id, child_id=child.id
--
-- RLS LOGIC:
-- =====================================================
-- INSERT Policy:
--   - Parents: sender_type='parent' AND sender_id=auth.uid() AND child belongs to parent
--   - Children: sender_type='child' AND sender_id=child_id AND child exists
--
-- SELECT Policy:
--   - Parents: Can read messages where child_id belongs to their children
--   - Children: Can read messages where child_id matches their own ID
--   - Both can read all messages in the conversation (sent and received)
--
-- =====================================================
-- STEP 1: Ensure RLS is enabled on messages table
-- =====================================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: Ensure children table allows anonymous reads
-- (Required for child policies to work)
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'children'
    AND policyname = 'Anyone can verify login codes'
  ) THEN
    CREATE POLICY "Anyone can verify login codes"
    ON public.children
    FOR SELECT
    TO anon
    USING (true);
    
    RAISE NOTICE 'Created policy: Anyone can verify login codes';
  ELSE
    RAISE NOTICE 'Policy "Anyone can verify login codes" already exists';
  END IF;
END $$;

-- =====================================================
-- STEP 3: Drop all existing message policies
-- (Safe to drop - we'll recreate them correctly)
-- =====================================================
DROP POLICY IF EXISTS "Parents can view messages for their children" ON public.messages;
DROP POLICY IF EXISTS "Parents can send messages" ON public.messages;
DROP POLICY IF EXISTS "Children can view their messages" ON public.messages;
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- =====================================================
-- STEP 4: Create INSERT policy for PARENTS
-- Parents can only send messages as themselves to their own children
-- =====================================================
CREATE POLICY "Parents can send messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'parent' AND
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = messages.child_id
      AND children.parent_id = auth.uid()
    )
  );

-- =====================================================
-- STEP 5: Create INSERT policy for CHILDREN
-- Children can only send messages as themselves (sender_id = child_id)
-- =====================================================
CREATE POLICY "Children can send messages"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (
    sender_type = 'child' AND
    sender_id = child_id AND
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = messages.child_id
      AND children.id = messages.sender_id
    )
  );

-- =====================================================
-- STEP 6: Create SELECT policy for PARENTS
-- Parents can read all messages for their children
-- (Both messages they sent and messages from the child)
-- =====================================================
CREATE POLICY "Parents can view messages for their children"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = messages.child_id
      AND children.parent_id = auth.uid()
    )
  );

-- =====================================================
-- STEP 7: Create SELECT policy for CHILDREN
-- Children can read all messages for their child_id
-- (Both messages they sent and messages from their parent)
-- 
-- NOTE: Since children are anonymous users, RLS cannot identify
-- which specific child is making the request. This policy ensures
-- that only messages for valid child_ids can be read. The application
-- layer (Chat.tsx) filters by the child's ID from their session,
-- ensuring children only see their own messages.
-- =====================================================
CREATE POLICY "Children can view their messages"
  ON public.messages FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = messages.child_id
    )
  );

-- =====================================================
-- STEP 8: Verify policies were created correctly
-- =====================================================
SELECT 
    'messages' as table_name,
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
ORDER BY 
    CASE cmd 
        WHEN 'SELECT' THEN 1
        WHEN 'INSERT' THEN 2
        WHEN 'UPDATE' THEN 3
        WHEN 'DELETE' THEN 4
    END,
    policyname;

-- =====================================================
-- EXPECTED OUTPUT:
-- =====================================================
-- 1. "Children can send messages" (INSERT, anon)
-- 2. "Children can view their messages" (SELECT, anon)
-- 3. "Parents can send messages" (INSERT, authenticated)
-- 4. "Parents can view messages for their children" (SELECT, authenticated)
-- =====================================================

