-- Fix RLS policies for messages table to allow children (anonymous users) to send messages
-- Run this in Supabase SQL Editor

-- Add policy for children to view messages
CREATE POLICY IF NOT EXISTS "Children can view their messages"
  ON public.messages FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = messages.child_id
    )
  );

-- Add policy for children to send messages
CREATE POLICY IF NOT EXISTS "Children can send messages"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (
    sender_type = 'child' AND
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = messages.child_id
      AND children.id = messages.sender_id
    )
  );

