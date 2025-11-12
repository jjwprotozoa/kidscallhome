-- Create parents profile table
CREATE TABLE public.parents (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create children table with unique login codes
CREATE TABLE public.children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  login_code TEXT NOT NULL UNIQUE,
  avatar_color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table for parent-child communication
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('parent', 'child')),
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for parents
CREATE POLICY "Parents can view own profile"
  ON public.parents FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Parents can update own profile"
  ON public.parents FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Parents can insert own profile"
  ON public.parents FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for children
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

-- RLS Policies for messages
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

-- Function to generate unique 6-character login codes
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

-- Trigger to auto-create parent profile on signup
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_parent();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;