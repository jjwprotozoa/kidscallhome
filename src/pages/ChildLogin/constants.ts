// src/pages/ChildLogin/constants.ts
// Purpose: Constants for ChildLogin page

export const FAMILY_CODE_LENGTH = 6;

export const MIN_LOGIN_NUMBER = 1;
export const MAX_LOGIN_NUMBER = 99;
export const MAX_NUMBER_LENGTH = 2;

export const MAX_LOGIN_ATTEMPTS = 5;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const SUCCESS_REDIRECT_DELAY_MS = 2000; // 2 seconds

export const LOGIN_CODE_FORMAT = /^[A-Z0-9]{6}-[a-z]+-\d{1,2}$/;







