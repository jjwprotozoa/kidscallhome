// src/types/call.ts
// Types and interfaces for video call functionality

export interface ChildSession {
  id: string;
  name: string;
  avatar_color: string;
}

export interface CallRecord {
  id: string;
  child_id: string;
  parent_id: string;
  caller_type: "parent" | "child";
  status: "ringing" | "active" | "ended";
  offer?: unknown;
  answer?: unknown;
  ice_candidates?: unknown;
  parent_ice_candidates?: unknown;
  child_ice_candidates?: unknown;
  created_at: string;
  ended_at?: string | null;
}
