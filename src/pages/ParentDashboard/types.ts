// src/pages/ParentDashboard/types.ts
// Purpose: TypeScript interfaces for ParentDashboard

export interface Child {
  id: string;
  name: string;
  login_code: string;
  avatar_color: string;
}

export interface IncomingCall {
  id: string;
  child_id: string;
  child_name: string;
  child_avatar_color: string;
}

export interface FamilyMember {
  id: string | null;
  name: string;
  email: string;
  relationship: string;
  status: "pending" | "active" | "suspended";
  invitation_token?: string | null;
  invitation_sent_at: string | null;
  invitation_accepted_at: string | null;
  created_at: string;
  blockedByChildren?: string[];
  reportCount?: number;
}

export type ValidTab = "children" | "family" | "connections" | "safety" | "setup";









