// src/components/GlobalIncomingCall/types.ts
// Purpose: TypeScript interfaces for GlobalIncomingCall

export interface CallRecord {
  id: string;
  child_id: string;
  parent_id: string;
  family_member_id?: string | null;
  caller_type: string;
  recipient_type?: string | null;
  status: string;
  created_at: string;
  ended_at?: string | null;
}

export interface IncomingCall {
  id: string;
  child_id?: string;
  parent_id?: string;
  family_member_id?: string;
  child_name?: string;
  child_avatar_color?: string;
  parent_name?: string;
}
