// src/pages/DeviceManagement/types.ts
// Purpose: Type definitions for DeviceManagement page

export interface Device {
  id: string;
  device_name: string;
  device_type: string;
  is_active: boolean;
  last_login_at: string | null;
  last_used_child_id: string | null;
  child_name: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DeviceSession {
  deviceId: string;
  lastLoginAt: string;
  childId: string | null;
}

export type DeviceStatus = "active" | "inactive" | "removed";

export interface DeviceLimit {
  free: number;
  basic: number;
  premium: number;
}









