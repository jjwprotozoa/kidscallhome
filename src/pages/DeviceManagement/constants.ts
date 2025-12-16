// src/pages/DeviceManagement/constants.ts
// Purpose: Constants for DeviceManagement page

import { DeviceLimit } from "./types";

export const DEVICE_LIMITS: DeviceLimit = {
  free: 3,
  basic: 10,
  premium: 999, // Unlimited
};

export const DEVICE_TYPES = {
  MOBILE: "mobile",
  TABLET: "tablet",
  DESKTOP: "desktop",
  WEB: "web",
} as const;

export const HISTORY_PAGE_SIZE = 10;







