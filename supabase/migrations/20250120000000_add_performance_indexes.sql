-- Migration: Add Performance Indexes
-- Purpose: Optimize common query patterns for messages and calls tables
-- Date: 2025-01-20
-- This migration adds composite indexes to improve ORDER BY and filtering performance

-- =====================================================
-- STEP 1: Add composite index for messages queries
-- =====================================================
-- Optimizes: SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
-- This is a very common query pattern in the chat system

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON public.messages(conversation_id, created_at ASC)
WHERE conversation_id IS NOT NULL;

-- Add index for unread messages filtering (if read_at is NULL, message is unread)
CREATE INDEX IF NOT EXISTS idx_messages_read_at 
ON public.messages(read_at) 
WHERE read_at IS NULL;

-- =====================================================
-- STEP 2: Add composite index for calls queries
-- =====================================================
-- Optimizes: SELECT * FROM calls WHERE conversation_id = ? ORDER BY created_at DESC
-- This improves call history queries

CREATE INDEX IF NOT EXISTS idx_calls_conversation_created 
ON public.calls(conversation_id, created_at DESC)
WHERE conversation_id IS NOT NULL;

-- =====================================================
-- STEP 3: Add index for messages created_at (if not exists)
-- =====================================================
-- Optimizes: ORDER BY created_at queries without conversation_id filter

CREATE INDEX IF NOT EXISTS idx_messages_created_at 
ON public.messages(created_at ASC);

-- =====================================================
-- STEP 4: Add index for calls created_at (if not exists)
-- =====================================================
-- Optimizes: ORDER BY created_at queries for calls

CREATE INDEX IF NOT EXISTS idx_calls_created_at 
ON public.calls(created_at DESC);

-- =====================================================
-- STEP 5: Verify indexes were created
-- =====================================================
-- Run this query to verify all indexes exist:
-- SELECT indexname, tablename 
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- AND indexname IN (
--   'idx_messages_conversation_created',
--   'idx_messages_read_at',
--   'idx_messages_created_at',
--   'idx_calls_conversation_created',
--   'idx_calls_created_at'
-- );

