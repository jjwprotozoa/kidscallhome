// src/components/ErrorBoundary.tsx
// Error boundary component to catch React errors and prevent blank white screen
// Includes special handling for Router context errors on mobile devices

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface BootLogEntry {
  phase: string;
  timestamp: number;
  message: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isRouterContextError: boolean;
  retryCount: number;
}

// Helper to detect Router context errors (basename destructuring issue on mobile)
const isRouterContextError = (error: Error | null): boolean => {
  if (!error?.message) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("basename") ||
    message.includes("cannot destructure property") ||
    message.includes("usenavigate") ||
    message.includes("usesearchparams") ||
    message.includes("uselocation") ||
    message.includes("router") ||
    (message.includes("null") && message.includes("undefined") && message.includes("destructure")) ||
    (message.includes("cannot read") && message.includes("null"))
  );
};

// Detect iOS for longer retry delays
const isIOS = typeof navigator !== 'undefined' && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) || 
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);

export class ErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
  // iOS needs more retries due to slower context initialization
  private maxRetries = isIOS ? 8 : 5;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isRouterContextError: false,
      retryCount: 0,
      bootLog: [],
      isChunkError: false,
      isStorageCorrupt: false,
      detectedFlags: {
        ios: false,
        chunkError: false,
        routerError: false,
        storageCorrupt: false,
      },
    };
  }

  async componentDidMount() {
    // Load boot log if debug mode
    const showDebug = typeof window !== "undefined" && 
      new URLSearchParams(window.location.search).get("debug") === "1";
    
    if (showDebug) {
      try {
        const stored = sessionStorage.getItem("kch_bootlog");
        if (stored) {
          this.setState({ bootLog: JSON.parse(stored) });
        } else {
          const { bootLogger } = await import("@/boot/bootGate");
          this.setState({ bootLog: bootLogger.getLogs() });
        }
      } catch {
        // Ignore errors
      }
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const isRouterError = isRouterContextError(error);
    const isChunkErr = 
      error.message?.includes("ChunkLoadError") ||
      error.message?.includes("Loading chunk") ||
      error.message?.includes("Failed to fetch dynamically imported module");
    const isStorageErr = 
      error.message?.includes("storage:corrupt") ||
      error.message?.includes("QuotaExceededError") ||
      error.message?.includes("Failed to read") ||
      (error.message?.includes("JSON") && error.message?.includes("parse"));
    
    const isIOSDevice = typeof navigator !== 'undefined' && (
      /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );

    return {
      hasError: true,
      error,
      errorInfo: null,
      isRouterContextError: isRouterError,
      isChunkError: isChunkErr,
      isStorageCorrupt: isStorageErr,
      detectedFlags: {
        ios: isIOSDevice,
        chunkError: isChunkErr,
        routerError: isRouterError,
        storageCorrupt: isStorageErr,
      },
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isRouterError = isRouterContextError(error);
    const isChunkErr = 
      error.message?.includes("ChunkLoadError") ||
      error.message?.includes("Loading chunk") ||
      error.message?.includes("Failed to fetch dynamically imported module");
    const isStorageErr = 
      error.message?.includes("storage:corrupt") ||
      error.message?.includes("QuotaExceededError") ||
      error.message?.includes("Failed to read") ||
      (error.message?.includes("JSON") && error.message?.includes("parse"));
    
    // Log to boot logger if available
    try {
      import("@/boot/bootGate").then(({ bootLogger }) => {
        bootLogger.append("failed", `ErrorBoundary caught: ${error.message}`, {
          isRouterError,
          isChunkError: isChunkErr,
          isStorageCorrupt: isStorageErr,
          componentStack: errorInfo.componentStack?.split('\n').slice(0, 5).join('\n'),
        }, error);
      }).catch(() => {
        // Boot logger not available
      });
    } catch {
      // Ignore import errors
    }
    
    // Only log non-router errors or final retry failures
    if (!isRouterError || this.state.retryCount >= this.maxRetries) {
      console.error("❌ [ERROR BOUNDARY] Caught error:", error);
      console.error("❌ [ERROR BOUNDARY] Error message:", error.message);
      console.error("❌ [ERROR BOUNDARY] Error stack:", error.stack);
      console.error("❌ [ERROR BOUNDARY] Component stack:", errorInfo.componentStack);
    } else if (import.meta.env.DEV) {
      console.warn(`⚠️ [ERROR BOUNDARY] Router context error caught, will retry (attempt ${this.state.retryCount + 1}/${this.maxRetries}):`, error.message);
    }
    
    // iOS auto-recovery for storage/router errors (once per session)
    const isIOSDevice = typeof navigator !== 'undefined' && (
      /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
    
    if (isIOSDevice && (isStorageErr || isRouterError)) {
      try {
        const alreadyRecovered = sessionStorage.getItem("kch_ios_autorecover");
        if (alreadyRecovered !== "1") {
          console.warn("⚠️ [ERROR BOUNDARY] iOS auto-recovery triggered for", isStorageErr ? "storage" : "router", "error");
          sessionStorage.setItem("kch_ios_autorecover", "1");
          // Trigger recovery after a short delay to allow logging
          setTimeout(async () => {
            try {
              const { recoverAndReload } = await import("@/boot/bootGate");
              await recoverAndReload({ mode: "reset" });
            } catch {
              // Fallback to reload
              window.location.reload();
            }
          }, 1000);
          return; // Exit early, recovery will reload
        }
      } catch {
        // Ignore storage errors
      }
    }
    
    this.setState({
      error,
      errorInfo,
      isRouterContextError: isRouterError,
      isChunkError: isChunkErr,
      isStorageCorrupt: isStorageErr,
      detectedFlags: {
        ios: isIOSDevice,
        chunkError: isChunkErr,
        routerError: isRouterError,
        storageCorrupt: isStorageErr,
      },
    });
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    // Auto-retry for Router context errors (common on mobile devices during initial load)
    if (
      this.state.hasError &&
      this.state.isRouterContextError &&
      this.state.retryCount < this.maxRetries &&
      (this.state.retryCount !== prevState.retryCount || !prevState.hasError)
    ) {
      // Clear any existing timeout
      if (this.retryTimeoutId) {
        clearTimeout(this.retryTimeoutId);
      }
      
      // Progressive retry delays - iOS needs longer delays
      // iOS: 500ms, 1000ms, 1500ms, 2000ms, 2500ms, 3000ms, 3500ms, 4000ms
      // Other: 300ms, 600ms, 1000ms, 1500ms, 2000ms
      const retryDelays = isIOS 
        ? [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000]
        : [300, 600, 1000, 1500, 2000];
      const retryDelay = retryDelays[this.state.retryCount] || (isIOS ? 4000 : 2000);
      
      this.retryTimeoutId = setTimeout(() => {
        if (import.meta.env.DEV) {
          console.log(`🔄 [ERROR BOUNDARY] Retrying render after Router context error (attempt ${this.state.retryCount + 1}/${this.maxRetries})...`);
        }
        this.setState((state) => ({
          hasError: false,
          error: null,
          errorInfo: null,
          isRouterContextError: false,
          retryCount: state.retryCount + 1,
        }));
      }, retryDelay);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isRouterContextError: false,
      retryCount: 0,
    });
    window.location.reload();
  };

  handleSoftReset = async () => {
    // Use BootGate recovery
    try {
      const { recoverAndReload } = await import("@/boot/bootGate");
      await recoverAndReload({ mode: "soft" });
    } catch {
      // Fallback to simple reload
      window.location.reload();
    }
  };

  handleForceLogout = async () => {
    // Use BootGate recovery with reset
    try {
      const { recoverAndReload } = await import("@/boot/bootGate");
      await recoverAndReload({ mode: "reset" });
    } catch {
      // Fallback to simple reload
      window.location.href = "/";
    }
  };

  render() {
    if (this.state.hasError) {
      // For Router context errors, show nothing while retrying (prevents flash of error UI)
      if (this.state.isRouterContextError && this.state.retryCount < this.maxRetries) {
        return null;
      }
      
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isEnvError = this.state.error?.message?.includes("VITE_SUPABASE") ||
                        this.state.error?.message?.includes("environment variable");
      
      // For Router context errors that exhausted retries, show a simpler message
      const isRouterError = this.state.isRouterContextError;

      // Check for debug mode
      const showDebug = typeof window !== "undefined" && 
        new URLSearchParams(window.location.search).get("debug") === "1";

      return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
          <Card className="max-w-2xl w-full p-8 space-y-6">
            <div className="flex items-center gap-4">
              <AlertTriangle className="h-12 w-12 text-destructive" />
              <div>
                <h1 className="text-2xl font-bold">
                  {isRouterError ? "Loading issue" : "Something went wrong"}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {isEnvError 
                    ? "Missing required configuration"
                    : isRouterError
                    ? "The app is having trouble loading. Please reload the page."
                    : "An unexpected error occurred"}
                </p>
              </div>
            </div>

            {isEnvError ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  The app is missing required environment variables. Please check:
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
                  <li>VITE_SUPABASE_URL</li>
                  <li>VITE_SUPABASE_PUBLISHABLE_KEY</li>
                </ul>
                <p className="text-sm text-muted-foreground">
                  Set these in your Vercel project settings (Settings → Environment Variables) or in a .env file for local development.
                </p>
              </div>
            ) : isRouterError ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This can happen on slower connections or when the app is loading for the first time.
                  Reloading usually fixes the issue.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {this.state.error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                    <p className="font-mono text-sm text-destructive break-all">
                      {this.state.error.toString()}
                    </p>
                    {this.state.errorInfo && (
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm text-muted-foreground">
                          Stack trace
                        </summary>
                        <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-48">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-4 flex-col sm:flex-row">
              <Button onClick={this.handleSoftReset} className="flex-1">
                Retry
              </Button>
              <Button
                variant="outline"
                onClick={this.handleForceLogout}
                className="flex-1"
              >
                Reset & Reload
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.href = "/"}
                className="flex-1"
              >
                Go Home
              </Button>
            </div>

            {showDebug && (
              <div className="mt-4 pt-4 border-t space-y-4">
                {/* Detected Flags */}
                <div className="text-sm">
                  <div className="font-semibold text-muted-foreground mb-2">Detected Flags:</div>
                  <div className="flex flex-wrap gap-2">
                    {this.state.detectedFlags.ios && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">iOS</span>
                    )}
                    {this.state.detectedFlags.chunkError && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">Chunk Error</span>
                    )}
                    {this.state.detectedFlags.routerError && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Router Error</span>
                    )}
                    {this.state.detectedFlags.storageCorrupt && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">Storage Corrupt</span>
                    )}
                  </div>
                </div>

                {/* Last Error */}
                {this.state.error && (
                  <div className="text-sm">
                    <div className="font-semibold text-muted-foreground mb-2">Last Error:</div>
                    <div className="bg-muted p-2 rounded text-xs font-mono break-all">
                      {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground">Stack Trace</summary>
                        <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-32 font-mono">
                          {this.state.error.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

                {/* Boot Log */}
                {this.state.bootLog.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground mb-2">
                      Boot Log (debug mode)
                    </summary>
                    <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-48 font-mono">
                      {JSON.stringify(this.state.bootLog, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

