-- =====================================================
-- COMPLETE DATABASE SETUP FOR NEW PROJECT
-- Run this in: https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt/sql/new
-- This sets up ALL tables, policies, functions, and triggers
-- =====================================================

-- STEP 1: Create parents table
CREATE TABLE IF NOT EXISTS public.parents (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- STEP 2: Create children table
CREATE TABLE IF NOT EXISTS public.children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  login_code TEXT NOT NULL UNIQUE,
  avatar_color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- STEP 3: Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('parent', 'child')),
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- STEP 4: Create calls table
CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  parent_id uuid NOT NULL,
  caller_type text NOT NULL CHECK (caller_type IN ('parent', 'child')),
  status text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'active', 'ended')),
  offer jsonb,
  answer jsonb,
  ice_candidates jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  ended_at timestamptz
);

-- STEP 5: Enable RLS on all tables
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- STEP 6: Drop existing policies (if any) to start fresh
DROP POLICY IF EXISTS "Parents can view own profile" ON public.parents;
DROP POLICY IF EXISTS "Parents can update own profile" ON public.parents;
DROP POLICY IF EXISTS "Parents can insert own profile" ON public.parents;
DROP POLICY IF EXISTS "Parents can view own children" ON public.children;
DROP POLICY IF EXISTS "Parents can insert own children" ON public.children;
DROP POLICY IF EXISTS "Parents can update own children" ON public.children;
DROP POLICY IF EXISTS "Parents can delete own children" ON public.children;
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;
DROP POLICY IF EXISTS "Parents can view messages for their children" ON public.messages;
DROP POLICY IF EXISTS "Parents can send messages" ON public.messages;
DROP POLICY IF EXISTS "Children can view their own calls" ON public.calls;
DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;
DROP POLICY IF EXISTS "Children can update their own calls" ON public.calls;
DROP POLICY IF EXISTS "Parents can view calls for their children" ON public.calls;
DROP POLICY IF EXISTS "Parents can insert calls" ON public.calls;
DROP POLICY IF EXISTS "Parents can update calls" ON public.calls;

-- STEP 7: Create RLS Policies for parents table
CREATE POLICY "Parents can view own profile"
  ON public.parents FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Parents can update own profile"
  ON public.parents FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Parents can insert own profile"
  ON public.parents FOR INSERT
  WITH CHECK (auth.uid() = id);

-- STEP 8: Create RLS Policies for children table
CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Parents can view own children"
  ON public.children FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "Parents can insert own children"
  ON public.children FOR INSERT
  WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Parents can update own children"
  ON public.children FOR UPDATE
  USING (parent_id = auth.uid());

CREATE POLICY "Parents can delete own children"
  ON public.children FOR DELETE
  USING (parent_id = auth.uid());

-- STEP 9: Create RLS Policies for messages table
CREATE POLICY "Parents can view messages for their children"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = messages.child_id
      AND children.parent_id = auth.uid()
    )
  );

CREATE POLICY "Parents can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_type = 'parent' AND
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = child_id
      AND children.parent_id = auth.uid()
    )
  );

-- STEP 10: Create RLS Policies for calls table - Parents
CREATE POLICY "Parents can view calls for their children"
ON public.calls
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
);

CREATE POLICY "Parents can insert calls"
ON public.calls
FOR INSERT
WITH CHECK (
  caller_type = 'parent' AND
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
);

CREATE POLICY "Parents can update calls"
ON public.calls
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
);

-- STEP 11: Create RLS Policies for calls table - Children (anonymous)
CREATE POLICY "Children can view their own calls"
ON public.calls
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
  )
);

CREATE POLICY "Children can insert calls they initiate"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (
  caller_type = 'child' AND
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = calls.parent_id
  )
);

CREATE POLICY "Children can update their own calls"
ON public.calls
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
  )
);

-- STEP 12: Create function to generate unique login codes
CREATE OR REPLACE FUNCTION generate_unique_login_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed confusing chars
  code TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    -- Check if code exists
    IF NOT EXISTS (SELECT 1 FROM public.children WHERE login_code = code) THEN
      RETURN code;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique code';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 13: Create trigger function to auto-create parent profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_parent()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.parents (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- STEP 14: Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_parent();

-- STEP 15: Enable realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;

-- STEP 16: Verify setup
SELECT 
    'Setup Complete!' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('parents', 'children', 'messages', 'calls')) as tables_created,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename IN ('parents', 'children', 'messages', 'calls')) as policies_created;

-- Show all tables
SELECT 
    'Tables' as info,
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('parents', 'children', 'messages', 'calls')
ORDER BY table_name;

