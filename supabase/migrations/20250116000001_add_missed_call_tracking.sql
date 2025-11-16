-- Add fields to calls table for tracking missed calls
-- A missed call is a call that ended without being answered (status='ended' but was never 'active')

-- Add missed_call field if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'calls'
      AND column_name = 'missed_call'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN missed_call BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added missed_call column to calls table';
  ELSE
    RAISE NOTICE 'missed_call column already exists in calls table';
  END IF;
END $$;

-- Add read_at field for missed call notifications (when user views/acknowledges missed call)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'calls'
      AND column_name = 'missed_call_read_at'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN missed_call_read_at TIMESTAMPTZ;
    RAISE NOTICE 'Added missed_call_read_at column to calls table';
  ELSE
    RAISE NOTICE 'missed_call_read_at column already exists in calls table';
  END IF;
END $$;

-- Create index for efficient queries on unread missed calls
CREATE INDEX IF NOT EXISTS idx_calls_missed_unread ON public.calls(missed_call_read_at) 
WHERE missed_call = TRUE AND missed_call_read_at IS NULL;

-- Add comment to explain the fields
COMMENT ON COLUMN public.calls.missed_call IS 'TRUE if this call ended without being answered (missed call)';
COMMENT ON COLUMN public.calls.missed_call_read_at IS 'Timestamp when the missed call notification was read/acknowledged. NULL means unread.';

-- Create a function to automatically mark calls as missed when they end without being answered
CREATE OR REPLACE FUNCTION mark_missed_calls()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger to automatically mark missed calls
DROP TRIGGER IF EXISTS trigger_mark_missed_calls ON public.calls;
CREATE TRIGGER trigger_mark_missed_calls
  BEFORE UPDATE ON public.calls
  FOR EACH ROW
  EXECUTE FUNCTION mark_missed_calls();

