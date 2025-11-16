-- Add read_at field to messages table for tracking unread messages
-- This allows us to show message count badges in the navigation

-- Add read_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'read_at'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN read_at TIMESTAMPTZ;
    RAISE NOTICE 'Added read_at column to messages table';
  ELSE
    RAISE NOTICE 'read_at column already exists in messages table';
  END IF;
END $$;

-- Create index for efficient queries on unread messages
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON public.messages(read_at) WHERE read_at IS NULL;

-- Add comment to explain the field
COMMENT ON COLUMN public.messages.read_at IS 'Timestamp when the message was read by the recipient. NULL means unread.';

