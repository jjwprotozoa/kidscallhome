// src/utils/deviceAuthorization.ts
// Purpose: Manage device authorization for child login
// Family code is only required for new devices - returning devices skip family code

import { generateDeviceIdentifier } from "./deviceTracking";

const AUTHORIZED_DEVICES_KEY = "kidscallhome_authorized_devices";

interface AuthorizedDevice {
  deviceId: string;
  childId: string;
  authorizedAt: string; // ISO timestamp
}

/**
 * Get all authorized devices from localStorage
 */
function getAuthorizedDevices(): AuthorizedDevice[] {
  try {
    const stored = localStorage.getItem(AUTHORIZED_DEVICES_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/**
 * Save authorized devices to localStorage
 */
function saveAuthorizedDevices(devices: AuthorizedDevice[]): void {
  try {
    localStorage.setItem(AUTHORIZED_DEVICES_KEY, JSON.stringify(devices));
  } catch (error) {
    console.warn("Failed to save authorized devices:", error);
  }
}

/**
 * Check if current device is authorized for a specific child
 */
export function isDeviceAuthorized(childId: string): boolean {
  const deviceId = generateDeviceIdentifier();
  const authorizedDevices = getAuthorizedDevices();
  
  return authorizedDevices.some(
    (device) => device.deviceId === deviceId && device.childId === childId
  );
}

/**
 * Authorize current device for a child (after successful login with family code)
 */
export function authorizeDevice(childId: string): void {
  const deviceId = generateDeviceIdentifier();
  const authorizedDevices = getAuthorizedDevices();
  
  // Check if already authorized
  const existingIndex = authorizedDevices.findIndex(
    (device) => device.deviceId === deviceId && device.childId === childId
  );
  
  if (existingIndex >= 0) {
    // Update timestamp
    authorizedDevices[existingIndex].authorizedAt = new Date().toISOString();
  } else {
    // Add new authorization
    authorizedDevices.push({
      deviceId,
      childId,
      authorizedAt: new Date().toISOString(),
    });
  }
  
  // Keep only last 10 devices per child (prevent localStorage bloat)
  const devicesForChild = authorizedDevices.filter((d) => d.childId === childId);
  if (devicesForChild.length > 10) {
    // Remove oldest devices
    devicesForChild.sort((a, b) => 
      new Date(a.authorizedAt).getTime() - new Date(b.authorizedAt).getTime()
    );
    const toRemove = devicesForChild.slice(0, devicesForChild.length - 10);
    toRemove.forEach((device) => {
      const index = authorizedDevices.findIndex(
        (d) => d.deviceId === device.deviceId && d.childId === device.childId
      );
      if (index >= 0) authorizedDevices.splice(index, 1);
    });
  }
  
  saveAuthorizedDevices(authorizedDevices);
}

/**
 * Revoke authorization for current device (when parent revokes device)
 */
export function revokeDeviceAuthorization(childId: string): void {
  const deviceId = generateDeviceIdentifier();
  const authorizedDevices = getAuthorizedDevices();
  
  const filtered = authorizedDevices.filter(
    (device) => !(device.deviceId === deviceId && device.childId === childId)
  );
  
  saveAuthorizedDevices(filtered);
}

/**
 * Revoke all authorizations for a child (when child is deleted or parent revokes all devices)
 */
export function revokeAllAuthorizations(childId: string): void {
  const authorizedDevices = getAuthorizedDevices();
  const filtered = authorizedDevices.filter((device) => device.childId !== childId);
  saveAuthorizedDevices(filtered);
}

/**
 * Get the child ID for which this device is authorized (if any)
 * Used to auto-fill child login on returning devices
 */
export function getAuthorizedChildId(): string | null {
  const deviceId = generateDeviceIdentifier();
  const authorizedDevices = getAuthorizedDevices();
  
  // Find most recently authorized child for this device
  const deviceAuthorizations = authorizedDevices.filter(
    (device) => device.deviceId === deviceId
  );
  
  if (deviceAuthorizations.length === 0) return null;
  
  // Sort by most recent
  deviceAuthorizations.sort((a, b) => 
    new Date(b.authorizedAt).getTime() - new Date(a.authorizedAt).getTime()
  );
  
  return deviceAuthorizations[0].childId;
}

