// src/pages/ChildDashboard/types.ts
// Purpose: TypeScript interfaces for ChildDashboard

export interface ChildSession {
  id: string;
  name: string;
  avatar_color: string;
  parent_id: string;
}

export interface IncomingCall {
  id: string;
  parent_id: string;
}

export interface CallRecord {
  id: string;
  child_id: string;
  parent_id: string;
  caller_type: string;
  status: string;
  created_at: string;
  ended_at?: string | null;
}








