// src/pages/DeviceManagement/deviceValidation.ts
// Purpose: Device validation functions

import { Device } from "./types";
import { DEVICE_LIMITS } from "./constants";

export const checkDeviceLimit = (
  currentDeviceCount: number,
  subscriptionTier: "free" | "basic" | "premium"
): { canAdd: boolean; limit: number; remaining: number } => {
  const limit = DEVICE_LIMITS[subscriptionTier];
  const canAdd = currentDeviceCount < limit;
  const remaining = Math.max(0, limit - currentDeviceCount);

  return { canAdd, limit, remaining };
};

export const validateDeviceName = (name: string): { valid: boolean; error?: string } => {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "Device name cannot be empty" };
  }

  if (name.trim().length > 100) {
    return { valid: false, error: "Device name must be 100 characters or less" };
  }

  return { valid: true };
};

export const canRemoveDevice = (device: Device, currentDeviceId?: string): boolean => {
  // Cannot remove current device
  if (currentDeviceId && device.id === currentDeviceId) {
    return false;
  }

  // Can remove any other device
  return true;
};

export const isCurrentDevice = (device: Device, currentDeviceId?: string): boolean => {
  return currentDeviceId === device.id;
};










