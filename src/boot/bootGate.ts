// src/boot/bootGate.ts
// BootGate: Centralized boot monitoring, logging, and recovery system
// Never throws - always recovers gracefully

export type BootPhase = 
  | "start"
  | "dom-ready"
  | "react-init"
  | "auth-check"
  | "storage-validate"
  | "routes-ready"
  | "ready"
  | "failed";

export interface BootLogEntry {
  phase: BootPhase;
  timestamp: number;
  message: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

class BootLogger {
  private logBuffer: BootLogEntry[] = [];
  private readonly maxEntries = 50;
  private readonly storageKey = "kch_bootlog";

  log(phase: BootPhase, message: string, metadata?: Record<string, unknown>, error?: Error): void {
    const entry: BootLogEntry = {
      phase,
      timestamp: Date.now(),
      message,
      metadata,
      error: error ? `${error.name}: ${error.message}` : undefined,
    };

    this.logBuffer.push(entry);
    
    // Keep only last N entries
    if (this.logBuffer.length > this.maxEntries) {
      this.logBuffer.shift();
    }

    // Persist to sessionStorage for debugging
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        const serialized = JSON.stringify(this.logBuffer.slice(-20)); // Keep last 20 for storage
        window.sessionStorage.setItem(this.storageKey, serialized);
      }
    } catch {
      // Ignore storage errors
    }

    // Log to console in dev
    if (import.meta.env.DEV) {
      const prefix = error ? "❌" : "✓";
      console.log(`${prefix} [BOOT:${phase}] ${message}`, metadata || "", error || "");
    }
  }

  getLogs(): BootLogEntry[] {
    return [...this.logBuffer];
  }

  getLogsFromStorage(): BootLogEntry[] {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        const stored = window.sessionStorage.getItem(this.storageKey);
        if (stored) {
          return JSON.parse(stored) as BootLogEntry[];
        }
      }
    } catch {
      // Ignore parse errors
    }
    return [];
  }

  clear(): void {
    this.logBuffer = [];
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.removeItem(this.storageKey);
      }
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Append a log entry (can be called anywhere, even after boot completes)
   * Useful for post-render error capture
   */
  append(phase: BootPhase, message: string, metadata?: Record<string, unknown>, error?: Error): void {
    this.log(phase, message, metadata, error);
  }
}

export const bootLogger = new BootLogger();

// Global error handlers
let errorHandlersInstalled = false;

export function installErrorHandlers(): void {
  if (errorHandlersInstalled) return;
  errorHandlersInstalled = true;

  // Window error handler - captures errors even after boot completes
  window.addEventListener("error", (event) => {
    const error = event.error || new Error(event.message);
    const isChunkError = 
      error.message?.includes("ChunkLoadError") ||
      error.message?.includes("Loading chunk") ||
      error.message?.includes("Failed to fetch dynamically imported module") ||
      error.message?.includes("Failed to load resource") ||
      (error.message?.includes("404") && error.message?.includes(".js"));

    // Always append to boot log (works even after boot completes)
    bootLogger.append(
      "failed",
      `Post-render error: ${error.message}`,
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        isChunkError,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'), // First 5 lines of stack
      },
      error
    );

    // If chunk error detected, trigger recovery (once per session)
    if (isChunkError) {
      try {
        const alreadyRecovered = sessionStorage.getItem("kch_chunk_recovered");
        if (alreadyRecovered !== "1") {
          bootLogger.append("failed", "Chunk load error detected - triggering recovery");
          sessionStorage.setItem("kch_chunk_recovered", "1");
          // Delay recovery slightly to allow logging
          setTimeout(() => {
            recoverAndReload({ mode: "reset" });
          }, 500);
        }
      } catch {
        // Ignore storage errors
      }
    }
  });

  // Unhandled promise rejection handler - captures rejections even after boot completes
  window.addEventListener("unhandledrejection", (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    const isChunkError = 
      error.message?.includes("ChunkLoadError") ||
      error.message?.includes("Loading chunk") ||
      error.message?.includes("Failed to fetch dynamically imported module");

    // Always append to boot log (works even after boot completes)
    bootLogger.append(
      "failed",
      `Post-render promise rejection: ${error.message}`,
      { 
        isChunkError,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'), // First 5 lines of stack
      },
      error
    );

    // If chunk error detected, trigger recovery (once per session)
    if (isChunkError) {
      try {
        const alreadyRecovered = sessionStorage.getItem("kch_chunk_recovered");
        if (alreadyRecovered !== "1") {
          bootLogger.append("failed", "Chunk load error in promise - triggering recovery");
          sessionStorage.setItem("kch_chunk_recovered", "1");
          setTimeout(() => {
            recoverAndReload({ mode: "reset" });
          }, 500);
        }
      } catch {
        // Ignore storage errors
      }
    }
  });
}

// Boot watchdog timer
let bootWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
let bootStartTime = 0;
let bootReady = false;

export function startBootWatchdog(timeoutMs: number = 8000): void {
  bootStartTime = Date.now();
  bootReady = false;

  if (bootWatchdogTimer) {
    clearTimeout(bootWatchdogTimer);
  }

  bootWatchdogTimer = setTimeout(() => {
    if (!bootReady) {
      const elapsed = Date.now() - bootStartTime;
      bootLogger.log("failed", `Boot watchdog timeout after ${elapsed}ms`, {
        elapsed,
        timeout: timeoutMs,
      });

      // Trigger boot failure UI
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("boot-timeout"));
      }
    }
  }, timeoutMs);
}

export function markBootReady(): void {
  bootReady = true;
  if (bootWatchdogTimer) {
    clearTimeout(bootWatchdogTimer);
    bootWatchdogTimer = null;
  }
  const elapsed = Date.now() - bootStartTime;
  bootLogger.log("ready", `Boot completed in ${elapsed}ms`, { elapsed });
}

export function isBootReady(): boolean {
  return bootReady;
}

// Recovery functions
export async function recoverAndReload(options: { mode: "soft" | "reset" }): Promise<void> {
  bootLogger.log("failed", `Recovery triggered: ${options.mode}`, { mode: options.mode });

  if (options.mode === "reset") {
    // Clear app storage
    try {
      const { clearAppStorage } = await import("@/utils/storage");
      clearAppStorage();
    } catch {
      // Ignore errors
    }

    // Clear IndexedDB (known databases)
    try {
      const dbNames = ["kidscallhome-query-cache", "kidscallhome"];
      for (const dbName of dbNames) {
        try {
          const deleteReq = indexedDB.deleteDatabase(dbName);
          await new Promise((resolve, reject) => {
            deleteReq.onsuccess = () => resolve(undefined);
            deleteReq.onerror = () => reject(deleteReq.error);
            deleteReq.onblocked = () => resolve(undefined); // Ignore blocked
          });
        } catch {
          // Ignore individual DB errors
        }
      }
    } catch {
      // Ignore IndexedDB errors
    }

    // Unregister service worker and clear caches
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          try {
            await registration.unregister();
          } catch {
            // Ignore unregister errors
          }
        }
      }

      // Clear all caches
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          try {
            await caches.delete(cacheName);
          } catch {
            // Ignore cache deletion errors
          }
        }
      }
    } catch {
      // Ignore SW/cache errors
    }
  }

  // Reload
  bootLogger.log("failed", "Reloading page...", { mode: options.mode });
  window.location.reload();
}

// iOS auto-recovery
export function checkIOSAutoRecovery(): boolean {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (!isIOS) return false;

  try {
    const alreadyRecovered = sessionStorage.getItem("kch_ios_autorecover");
    if (alreadyRecovered === "1") return false;

    // Check if boot failed
    if (!bootReady && Date.now() - bootStartTime > 3000) {
      bootLogger.log("failed", "iOS auto-recovery triggered");
      sessionStorage.setItem("kch_ios_autorecover", "1");
      recoverAndReload({ mode: "reset" });
      return true;
    }
  } catch {
    // Ignore errors
  }

  return false;
}

