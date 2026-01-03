import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { safeLog } from "./utils/security";
import { initApp } from "./boot/initApp";
import { installErrorHandlers, bootLogger, startBootWatchdog, markBootReady } from "./boot/bootGate";

// Disable console in production (fallback - esbuild should remove these)
// CRITICAL: Always keep console.error and console.warn enabled for debugging
if (import.meta.env.PROD) {
  // Override console methods to prevent verbose logging in production
  const noop = () => {};
  // eslint-disable-next-line no-console
  console.log = noop;
  // eslint-disable-next-line no-console
  console.debug = noop;
  // eslint-disable-next-line no-console
  console.info = noop;
  // CRITICAL: Keep console.error and console.warn enabled for debugging production issues
  // These are essential for diagnosing blank screens and rendering errors
}

// Suppress known browser extension/autofill errors that don't affect app functionality
// These are harmless console noise from browser extensions and Chrome's autofill overlay
if (typeof window !== "undefined") {
  // Suppress console.error from browser extensions
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const errorMessage = args[0]?.toString() || "";
    const isBrowserExtensionError = 
      errorMessage.includes("Duplicate script ID") ||
      errorMessage.includes("fido2-page-script") ||
      errorMessage.includes("Frame with ID") ||
      errorMessage.includes("extension port") ||
      errorMessage.includes("bootstrap-autofill-overlay") ||
      errorMessage.includes("AutofillInlineMenuContentService") ||
      (errorMessage.includes("insertBefore") && errorMessage.includes("NotFoundError"));
    
    // Only suppress browser extension/autofill errors, log everything else
    if (!isBrowserExtensionError) {
      originalError.apply(console, args);
    }
  };

  // Suppress unhandled promise rejections from browser extensions
  // These occur when extensions try to manipulate the DOM while React is re-rendering
  window.addEventListener("unhandledrejection", (event) => {
    const error = event.reason;
    const errorMessage = error?.toString() || "";
    const errorStack = error?.stack || "";
    const errorName = error?.name || "";
    
    // Check if this is a browser extension/autofill error
    const isBrowserExtensionError = 
      errorMessage.includes("bootstrap-autofill-overlay") ||
      errorMessage.includes("AutofillInlineMenuContentService") ||
      errorStack.includes("bootstrap-autofill-overlay") ||
      errorStack.includes("AutofillInlineMenuContentService") ||
      (errorName === "NotFoundError" && 
       (errorMessage.includes("insertBefore") || errorStack.includes("insertBefore")));
    
    // Suppress browser extension errors silently - they don't affect app functionality
    if (isBrowserExtensionError) {
      event.preventDefault(); // Prevent the error from being logged to console
      return;
    }
    
    // Let other unhandled rejections through to the normal error handlers
  });
}

// Log startup (only in development)
safeLog.log("🚀 [APP INIT] Starting application...", {
  mode: import.meta.env.MODE,
  dev: import.meta.env.DEV,
  prod: import.meta.env.PROD,
});

// Validate root element exists
const rootElement = document.getElementById("root");
if (!rootElement) {
  const error = new Error(
    "Root element not found. Make sure index.html has a <div id='root'></div> element."
  );
  console.error("❌ [APP INIT]", error);
  document.body.innerHTML = `
    <div style="padding: 2rem; font-family: system-ui; max-width: 600px; margin: 2rem auto;">
      <h1 style="color: #dc2626;">Application Error</h1>
      <p style="color: #6b7280;">Root element not found.</p>
      <pre style="background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; overflow: auto; margin-top: 1rem;">
${error.message}
      </pre>
    </div>
  `;
  throw error;
}

// Log environment info for debugging (only in development)
safeLog.log("🔍 [ENV] Environment variables check:", {
  hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
  hasSupabaseKey: !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  urlLength: import.meta.env.VITE_SUPABASE_URL?.length || 0,
  keyLength: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.length || 0,
});

// Install global error handlers first
installErrorHandlers();
bootLogger.log("start", "Boot started");

// Boot-safe initialization wrapper - never throws, always recovers
// PERFORMANCE: Render React immediately, run boot in parallel to avoid blocking UI
(async () => {
  try {
    bootLogger.log("dom-ready", "DOM ready, starting React initialization");
    
    // Remove SSR fallback content before React hydration to prevent mismatch
    const ssrFallback = rootElement.querySelector("main[data-ssr-fallback]");
    if (ssrFallback) {
      ssrFallback.remove();
    }

    // Start boot watchdog
    startBootWatchdog(8000);

    // Detect iOS for special handling (needed for both boot recovery and loading screen timing)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // PERFORMANCE OPTIMIZATION: Render React immediately with default bootResult
    // Boot initialization runs in parallel and updates the app when complete
    // This eliminates the 3-4 second blocking delay on initial load
    bootLogger.log("react-init", "Creating React root");
    safeLog.log("⚛️ [APP INIT] Creating React root immediately...");
    const root = createRoot(rootElement);
    
    // Start with default bootResult - app will work without it
    const defaultBootResult = { session: null, bootLog: ["boot:deferred"], ok: true };
    bootLogger.log("react-init", "Rendering App component");
    safeLog.log("⚛️ [APP INIT] Rendering App component immediately...");
    root.render(<App bootResult={defaultBootResult} />);
    safeLog.log("✅ [APP INIT] App render initiated (non-blocking)");

    // Run boot initialization in parallel (non-blocking)
    // This allows React to render immediately while boot completes in background
    bootLogger.log("auth-check", "Starting auth check");
    safeLog.log("⚛️ [APP INIT] Starting boot initialization in parallel...");
    (async () => {
      try {
        bootLogger.log("auth-check", "Calling initApp");
        const bootResult = await initApp();
        bootLogger.log("auth-check", `Auth check complete: ${bootResult.ok ? "ok" : "failed"}`);
        if (import.meta.env.DEV) {
          safeLog.log("⚛️ [APP INIT] Boot log:", bootResult.bootLog);
        }

        // iOS recovery path - detect repeated boot failures
        if (isIOS && !bootResult.ok && !sessionStorage.getItem("kch_ios_autorecover")) {
          bootLogger.log("failed", "iOS boot failure detected, triggering auto-recovery");
          safeLog.warn("⚠️ [APP INIT] iOS boot failure detected, attempting recovery...");
          try {
            const { recoverAndReload } = await import("./boot/bootGate");
            sessionStorage.setItem("kch_ios_autorecover", "1");
            await recoverAndReload({ mode: "reset" });
            return; // Exit early, reload will restart
          } catch {
            // If recovery fails, continue with normal boot
          }
        }

        // Update app with boot result when available
        // This allows React to use the boot result if needed, but doesn't block initial render
        bootLogger.log("routes-ready", "Routes ready, updating app");
        root.render(<App bootResult={bootResult} />);
        bootLogger.log("ready", "Boot complete");
        markBootReady();
        safeLog.log("✅ [APP INIT] Boot complete, app updated");
      } catch (error) {
        bootLogger.log("failed", `Boot failed: ${error instanceof Error ? error.message : String(error)}`, undefined, error instanceof Error ? error : undefined);
        safeLog.error("⚠️ [APP INIT] Boot failed, continuing with default:", error);
        // Continue with default bootResult - app should work without it
        markBootReady(); // Still mark as ready to prevent watchdog timeout
      }
    })();

    // Function to hide loading screen and signal app loaded
    const hideLoadingScreen = () => {
      const loadingElement = document.getElementById("app-loading");
      if (loadingElement) {
        // Use CSS class for smooth fade (hardware-accelerated)
        loadingElement.classList.add("fade-out");
        // Remove from DOM after fade completes to free memory
        setTimeout(() => {
          loadingElement.remove();
        }, 200);
      }
      
      // Signal to the recovery mechanism that the app has loaded successfully
      // This prevents the recovery UI from showing on successful loads
      // CRITICAL: Only call this AFTER we've confirmed content is painted
      if (typeof window !== "undefined" && typeof (window as unknown as { __appLoaded?: () => void }).__appLoaded === "function") {
        (window as unknown as { __appLoaded: () => void }).__appLoaded();
      }
    };

    // Hide loading spinner after React render
    // iOS Safari needs double requestAnimationFrame to ensure React has fully committed
    // This prevents the blank screen issue where loading screen is removed before content is painted
    if (isIOS) {
      // PERFORMANCE: Reduced delay from 300ms to 150ms since React renders immediately
      // iOS: Use triple RAF + delay to ensure paint is complete
      // iOS Safari is notoriously slow at committing React renders
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Add a delay for iOS Safari to ensure content is visible
            // 150ms gives iOS Safari enough time to paint the DOM (reduced from 300ms)
            setTimeout(hideLoadingScreen, 150);
          });
        });
      });
    } else {
      // Non-iOS: Double RAF is sufficient for most browsers
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          hideLoadingScreen();
        });
      });
    }

    // Fallback timeout: If React doesn't render within 5 seconds, hide loading screen anyway
    // This prevents the app from being stuck on loading if there's an initialization issue
    setTimeout(() => {
      const loadingElement = document.getElementById("app-loading");
      if (loadingElement && !loadingElement.classList.contains("fade-out")) {
        safeLog.warn("⚠️ [APP INIT] Loading screen timeout - forcing removal");
        hideLoadingScreen();
      }
    }, 5000);
  } catch (error) {
    // Always log errors to console, even in production, for debugging
    console.error("❌ [APP INIT] Failed to render app:", error);
    safeLog.error("❌ [APP INIT] Failed to render app:", error);
    // Hide loading spinner on error
    const loadingElement = document.getElementById("app-loading");
    if (loadingElement) {
      loadingElement.remove();
    }
    // Show error in the DOM if React fails to render
    rootElement.innerHTML = `
      <div style="padding: 2rem; font-family: system-ui; max-width: 600px; margin: 2rem auto;">
        <h1 style="color: #dc2626;">Application Error</h1>
        <p style="color: #6b7280;">Failed to initialize the application.</p>
        <pre style="background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; overflow: auto; margin-top: 1rem; white-space: pre-wrap;">
${error instanceof Error ? error.message + "\n\n" + error.stack : String(error)}
        </pre>
        <button 
          onclick="window.location.reload()" 
          style="margin-top: 1rem; padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.25rem; cursor: pointer;"
        >
          Reload Page
        </button>
        <p style="margin-top: 1rem; font-size: 0.875rem; color: #6b7280;">
          Check the browser console (F12) for more details.
        </p>
      </div>
    `;
    throw error;
  }
})();
