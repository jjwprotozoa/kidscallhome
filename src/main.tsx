import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { safeLog } from "./utils/security";

// Disable console in production (fallback - esbuild should remove these)
if (import.meta.env.PROD) {
  // Override console methods to prevent any logging in production
  const noop = () => {};
  // eslint-disable-next-line no-console
  console.log = noop;
  // eslint-disable-next-line no-console
  console.debug = noop;
  // eslint-disable-next-line no-console
  console.info = noop;
  // Keep console.error and console.warn for critical issues, but they'll be removed by esbuild
  // console.error = noop;
  // console.warn = noop;
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

try {
  // Remove SSR fallback content before React hydration to prevent mismatch
  const ssrFallback = rootElement.querySelector("main[data-ssr-fallback]");
  if (ssrFallback) {
    ssrFallback.remove();
  }

  safeLog.log("⚛️ [APP INIT] Creating React root...");
  const root = createRoot(rootElement);
  safeLog.log("⚛️ [APP INIT] Rendering App component...");
  root.render(<App />);
  safeLog.log("✅ [APP INIT] App rendered successfully");

  // Function to hide loading screen
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
  };

  // Hide loading spinner immediately after React render (reduced delay for faster LCP)
  // Single requestAnimationFrame is sufficient - double RAF was causing unnecessary delay
  requestAnimationFrame(() => {
    hideLoadingScreen();
  });

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
