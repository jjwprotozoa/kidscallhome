// src/utils/userInteraction.ts
// Tracks whether user has explicitly started/accepted a call
// Audio should ONLY be enabled after clicking "Call" or "Accept" buttons
// This is more restrictive than general page interaction

let hasUserStartedCall = false;

/**
 * Returns true if user has clicked Call or Accept button.
 * Used to determine if audio should be enabled.
 */
export const getUserHasStartedCall = (): boolean => {
  return hasUserStartedCall;
};

/**
 * Call this when user clicks "Call" or "Accept" button.
 * This enables audio for the call.
 */
export const setUserStartedCall = (): void => {
  hasUserStartedCall = true;
  console.warn("🔊 [USER INTERACTION] User started/accepted call - audio enabled");
};

/**
 * Reset the call started state (e.g., when call ends).
 */
export const resetUserStartedCall = (): void => {
  hasUserStartedCall = false;
};

