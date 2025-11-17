// src/features/presence/presenceDb.ts
// Database write utilities for presence status
// Only writes to database on login/logout/major state changes (not on heartbeats)

import { supabase } from "@/integrations/supabase/client";

/**
 * Write user online status to database on login
 * This is called only on major state changes (login), not on heartbeats
 */
export async function writePresenceOnLogin(
  userId: string,
  userType: "parent" | "child"
): Promise<void> {
  try {
    // Optional: Write to a user_sessions or presence_log table if you have one
    // For now, this is a placeholder - implement based on your database schema
    
    // Example implementation (uncomment and modify based on your schema):
    /*
    const { error } = await supabase
      .from("user_sessions")
      .insert({
        user_id: userId,
        user_type: userType,
        status: "online",
        logged_in_at: new Date().toISOString(),
      });

    if (error) {
      console.error("[PRESENCE DB] Error writing login status:", error);
    }
    */
    
    // For Supabase Realtime-based presence, database writes are optional
    // Presence is managed ephemerally via WebSocket connections
    // Only write to DB if you need to track login history or analytics
    
    if (import.meta.env.DEV) {
      console.log("✅ [PRESENCE DB] Login event (optional DB write)", {
        userId,
        userType,
      });
    }
  } catch (error) {
    console.error("[PRESENCE DB] Error writing login status:", error);
  }
}

/**
 * Write user offline status to database on logout
 * This is called only on major state changes (logout), not on heartbeats
 */
export async function writePresenceOnLogout(
  userId: string,
  userType: "parent" | "child"
): Promise<void> {
  try {
    // Optional: Write to a user_sessions or presence_log table if you have one
    // For now, this is a placeholder - implement based on your database schema
    
    // Example implementation (uncomment and modify based on your schema):
    /*
    const { error } = await supabase
      .from("user_sessions")
      .update({
        status: "offline",
        logged_out_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("user_type", userType);

    if (error) {
      console.error("[PRESENCE DB] Error writing logout status:", error);
    }
    */
    
    // For Supabase Realtime-based presence, database writes are optional
    // Presence is managed ephemerally via WebSocket connections
    // Only write to DB if you need to track login history or analytics
    
    if (import.meta.env.DEV) {
      console.log("✅ [PRESENCE DB] Logout event (optional DB write)", {
        userId,
        userType,
      });
    }
  } catch (error) {
    console.error("[PRESENCE DB] Error writing logout status:", error);
  }
}

/**
 * Optional: Create a user_sessions table migration
 * 
 * Run this SQL in Supabase SQL Editor if you want to track login/logout in database:
 * 
 * CREATE TABLE IF NOT EXISTS user_sessions (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id UUID NOT NULL,
 *   user_type TEXT NOT NULL CHECK (user_type IN ('parent', 'child')),
 *   status TEXT NOT NULL CHECK (status IN ('online', 'offline')),
 *   logged_in_at TIMESTAMPTZ NOT NULL,
 *   logged_out_at TIMESTAMPTZ,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
 * CREATE INDEX IF NOT EXISTS idx_user_sessions_status ON user_sessions(status);
 */

