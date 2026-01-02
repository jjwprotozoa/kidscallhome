// src/components/ErrorBoundary.tsx
// Error boundary component to catch React errors and prevent blank white screen
// Includes special handling for Router context errors on mobile devices

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const isRouterError = isRouterContextError(error);
    return {
      hasError: true,
      error,
      errorInfo: null,
      isRouterContextError: isRouterError,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isRouterError = isRouterContextError(error);
    
    // Only log non-router errors or final retry failures
    if (!isRouterError || this.state.retryCount >= this.maxRetries) {
      console.error("❌ [ERROR BOUNDARY] Caught error:", error);
      console.error("❌ [ERROR BOUNDARY] Error message:", error.message);
      console.error("❌ [ERROR BOUNDARY] Error stack:", error.stack);
      console.error("❌ [ERROR BOUNDARY] Component stack:", errorInfo.componentStack);
    } else if (import.meta.env.DEV) {
      console.warn(`⚠️ [ERROR BOUNDARY] Router context error caught, will retry (attempt ${this.state.retryCount + 1}/${this.maxRetries}):`, error.message);
    }
    
    this.setState({
      error,
      errorInfo,
      isRouterContextError: isRouterError,
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

            <div className="flex gap-4">
              <Button onClick={this.handleReset} className="flex-1">
                Reload Page
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.href = "/"}
                className="flex-1"
              >
                Go Home
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

