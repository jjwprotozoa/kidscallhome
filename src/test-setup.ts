// src/test-setup.ts
// Purpose: Test setup file for Vitest

import "@testing-library/jest-dom";

// Polyfill ResizeObserver for Radix UI components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
