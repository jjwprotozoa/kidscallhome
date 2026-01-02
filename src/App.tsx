// Critical imports - needed for initial render
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SafeAreaLayout } from "@/components/layout/SafeAreaLayout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";

// Deferred UI components - loaded after initial paint for faster FCP
// These are non-critical for the initial page render but provide enhanced UX
const CookieConsent = lazy(() => import("@/components/CookieConsent").then(m => ({ default: m.CookieConsent })));
const GlobalIncomingCall = lazy(() => import("@/components/GlobalIncomingCall").then(m => ({ default: m.GlobalIncomingCall })));
const GlobalMessageNotifications = lazy(() => import("@/components/GlobalMessageNotifications").then(m => ({ default: m.GlobalMessageNotifications })));
const GlobalPresenceTracker = lazy(() => import("@/components/GlobalPresenceTracker").then(m => ({ default: m.GlobalPresenceTracker })));
const PWAInstallPrompt = lazy(() => import("@/components/PWAInstallPrompt").then(m => ({ default: m.PWAInstallPrompt })));
const UpdateAvailableToast = lazy(() => import("@/components/UpdateAvailableToast").then(m => ({ default: m.UpdateAvailableToast })));
const Sonner = lazy(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster })));
const Toaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));

// Regular imports for hooks and utilities (small size, needed for functionality)
import { useBadgeInitialization } from "@/hooks/useBadgeInitialization";
import { useBadgeRealtime } from "@/hooks/useBadgeRealtime";
import { useWidgetData } from "@/hooks/useWidgetData";
// Supabase is NOT imported here - it's lazy-loaded only in app routes
import {
  initializeNativeAndroid,
  isNativeAndroid,
} from "@/utils/nativeAndroid";
import { loadWidgetData } from "@/utils/widgetData";

// Import functions for critical routes (used for both lazy loading and prefetching)
const parentHomeImport = () => import("./pages/ParentHome");
const childHomeImport = () => import("./pages/ChildHome");
const parentCallScreenImport = () => import("./pages/ParentCallScreen");
const childCallScreenImport = () => import("./pages/ChildCallScreen");

// Component to prefetch critical routes on idle for weak network optimization
// Prefetches home screens and call screens that are likely to be visited
// This improves Time to Interactive on weak networks (LTE/2G) by loading
// critical route chunks in the background when the browser is idle
const RoutePrefetcher = () => {
  useEffect(() => {
    // Use requestIdleCallback for non-blocking prefetch on idle
    // Falls back to setTimeout if not available
    const schedulePrefetch = (callback: () => void) => {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(callback, { timeout: 2000 });
      } else {
        setTimeout(callback, 2000);
      }
    };

    // Prefetch critical routes by triggering their lazy imports
    // This causes Vite to prefetch the chunks in the background
    // Critical routes: home screens and call screens (most frequently accessed)
    const prefetchCriticalRoutes = () => {
      // Trigger lazy imports for critical routes to prefetch their chunks
      // These are the most commonly accessed routes, so prefetching improves
      // perceived performance on slow networks
      const criticalRouteImports = [
        parentHomeImport,      // Parent home screen
        childHomeImport,       // Child home screen
        parentCallScreenImport, // Parent call screen
        childCallScreenImport,  // Child call screen
      ];

      // Prefetch each critical route's chunk
      criticalRouteImports.forEach((routeImport) => {
        // Trigger the lazy import to prefetch the chunk
        // The import() will resolve but we don't need to use the component
        routeImport().catch(() => {
          // Silently fail if prefetch fails - this is non-critical
        });
      });
    };

    // Schedule prefetch after initial load to avoid blocking
    schedulePrefetch(prefetchCriticalRoutes);
  }, []);

  return null;
};

// Keep small/essential pages as regular imports (needed immediately)
import Index from "./pages/Index";
import NetworkError from "./pages/NetworkError";
import NotFound from "./pages/NotFound";
import ServerError from "./pages/ServerError";

// Lazy load all other pages for code splitting
const ParentAuth = lazy(() => import("./pages/ParentAuth"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));
const ParentFamily = lazy(() => import("./pages/ParentFamily"));
const ParentReferrals = lazy(() => import("./pages/ParentReferrals"));
const ParentHome = lazy(parentHomeImport);
const ParentChildrenList = lazy(() => import("./pages/ParentChildrenList"));
const ParentCallScreen = lazy(parentCallScreenImport);
const ParentSafety = lazy(() => import("./pages/ParentSafety"));
const ParentConnections = lazy(() => import("./pages/ParentConnections"));
const DeviceManagement = lazy(() => import("./pages/DeviceManagement/index"));
const Upgrade = lazy(() => import("./pages/Upgrade/Upgrade"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const ChildLogin = lazy(() => import("./pages/ChildLogin"));
const ChildDashboard = lazy(() => import("./pages/ChildDashboard"));
const ChildHome = lazy(childHomeImport);
const ChildParentsList = lazy(() => import("./pages/ChildParentsList"));
const ChildCallScreen = lazy(childCallScreenImport);
const FamilyMemberAuth = lazy(() => import("./pages/FamilyMemberAuth"));
const FamilyMemberDashboard = lazy(
  () => import("./pages/FamilyMemberDashboard")
);
const FamilyMemberInvite = lazy(() => import("./pages/FamilyMemberInvite"));
const FamilyMemberCallScreen = lazy(
  () => import("./pages/FamilyMemberCallScreen")
);
const VideoCall = lazy(() => import("./pages/VideoCall"));
const Chat = lazy(() => import("./pages/Chat"));
const Info = lazy(() => import("./pages/Info"));
const Beta = lazy(() => import("./pages/Beta"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Security = lazy(() => import("./pages/Security"));
const SupportedDevices = lazy(() => import("./pages/SupportedDevices"));

// Loading fallback component - minimal to avoid double spinner effect
// The initial HTML loading screen handles the first load, this is for route transitions
const PageLoader = () => {
  // If initial loading screen is still visible, don't show another spinner
  const initialLoading = document.getElementById("app-loading");
  if (initialLoading) {
    return null; // Let the HTML loading screen handle it
  }
  
  return (
    <div className="flex items-center justify-center min-h-[100dvh]">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
};

// Configure QueryClient with error handling and caching
// gcTime must be >= maxAge for persistence to work properly
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for 5 min by default
      gcTime: 1000 * 60 * 60 * 24, // 24 hours - keep in cache for persistence
      // Prevent queries from throwing errors that break the app
      throwOnError: false,
    },
    mutations: {
      retry: 1,
      // Prevent mutations from throwing errors that break the app
      throwOnError: false,
    },
  },
});

// Create localStorage persister for instant dashboard loading
// Data survives page refreshes and browser restarts
const localStoragePersister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "kidscallhome-query-cache",
  // Throttle writes to localStorage (reduce write frequency)
  throttleTime: 1000,
});

// Persistence options
const persistOptions = {
  persister: localStoragePersister,
  maxAge: 1000 * 60 * 60 * 24, // 24 hours - cache persists for a day
  // Don't persist error states or loading states
  dehydrateOptions: {
    shouldDehydrateQuery: (query: { state: { status: string } }) => {
      return query.state.status === "success";
    },
  },
};

// Badge initialization component (runs once per session)
// Only loads on app routes, not marketing routes
// Hooks must be called unconditionally, so we check the route inside the hooks
const BadgeProvider = () => {
  // Always call hooks (React rules), but hooks will check route internally
  useBadgeInitialization(); // One-time initial snapshot (checks route internally)
  useBadgeRealtime(); // Realtime subscriptions (checks route internally)
  return null;
};

// Component to initialize native Android features
const NativeAndroidInitializer = () => {
  useEffect(() => {
    initializeNativeAndroid().catch((error) => {
      console.error("Failed to initialize native Android features:", error);
    });
  }, []);
  return null;
};

// Component to handle widget intents and deep links
const WidgetIntentHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeAndroid()) {
      return;
    }

    // Listen for widget quick call events
    const handleWidgetQuickCall = (event: CustomEvent) => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log("📱 Widget quick call received:", event.detail);
      }

      const { childId } = event.detail || {};

      // Use childId from event if available (from widget URI)
      if (childId) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log("📱 Routing to child from widget:", childId);
        }
        navigate(`/parent/call/${childId}`);
        return;
      }

      // Fallback: Try to load widget data to get last-called child
      const widgetData = loadWidgetData();

      if (widgetData?.childId) {
        // Route directly to last-called child's call screen
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log("📱 Routing to last-called child:", widgetData.childId);
        }
        navigate(`/parent/call/${widgetData.childId}`);
      } else {
        // Fallback to parent children list
        navigate("/parent/children");
      }
    };

    window.addEventListener(
      "widgetQuickCall",
      handleWidgetQuickCall as EventListener
    );

    return () => {
      window.removeEventListener(
        "widgetQuickCall",
        handleWidgetQuickCall as EventListener
      );
    };
  }, [navigate]);

  return null;
};

// Component to manage widget data updates
const WidgetDataManager = () => {
  useWidgetData();
  return null;
};

// Component to handle session clearing when "Stay signed in" is unchecked
const SessionManager = () => {
  useEffect(() => {
    // Check if sessionStorage is available
    if (typeof window === "undefined" || !window.sessionStorage) {
      return;
    }

    // Check if we should clear session on browser close
    const shouldClearOnClose = sessionStorage.getItem("clearSessionOnClose");

    if (shouldClearOnClose === "true") {
      const clearSession = async () => {
        // Clear Supabase session from localStorage
        const supabaseKeys = Object.keys(localStorage).filter(
          (key) => key.startsWith("sb-") || key.includes("supabase")
        );
        supabaseKeys.forEach((key) => localStorage.removeItem(key));
        // Also sign out from Supabase to ensure clean state (lazy load only if needed)
        const pathname = window.location.pathname;
        if (!pathname.startsWith('/') && !pathname.startsWith('/info')) {
          // Only load Supabase on app routes
          try {
            const { supabase } = await import("@/integrations/supabase/client");
            supabase.auth.signOut().catch(() => {
              // Ignore errors during signout
            });
          } catch {
            // Ignore if Supabase can't be loaded
          }
        }
      };

      // Clear session on page unload/close
      // Use pagehide for better reliability (fires on tab close, browser close, navigation)
      const handlePageHide = () => {
        clearSession();
      };

      // Fallback to beforeunload for browsers that don't support pagehide well
      const handleBeforeUnload = () => {
        clearSession();
      };

      window.addEventListener("pagehide", handlePageHide);
      window.addEventListener("beforeunload", handleBeforeUnload);

      return () => {
        window.removeEventListener("pagehide", handlePageHide);
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }
  }, []);

  return null;
};

// Debug helper for Vercel Analytics - logs mount and navigation events when debug_analytics=1
// Zero overhead when disabled: returns null before any hooks to avoid location subscriptions
const AnalyticsDebugHelper = () => {
  const enabled = typeof window !== 'undefined' && localStorage.getItem('debug_analytics') === '1';
  
  // Early return BEFORE useLocation to avoid subscribing to route changes when disabled
  if (!enabled) return null;
  
  return <AnalyticsDebugHelperInner />;
};

// Inner component only mounts when debug is enabled - subscribes to location changes
const AnalyticsDebugHelperInner = () => {
  const location = useLocation();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[Analytics Debug] Analytics and SpeedInsights mounted inside BrowserRouter');
  }, []);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[Analytics Debug] Route changed:', location.pathname);
  }, [location.pathname]);

  return null;
};

// Component to render deferred global components after initial load
// These are lazy-loaded to improve FCP but should mount quickly after
// CRITICAL: These components use router hooks, so we must ensure BrowserRouter
// is fully initialized before rendering them
const DeferredGlobalComponents = () => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    // Wait for initial paint AND ensure Router context is ready
    // Components like GlobalIncomingCall use router hooks, so Router must be initialized
    const schedule = (callback: () => void) => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(callback, { timeout: 1000 });
      } else {
        setTimeout(callback, 200); // Increased delay to ensure Router context is ready
      }
    };
    
    // Additional delay to ensure BrowserRouter context is fully initialized
    // This prevents "Cannot destructure property 'basename'" errors
    schedule(() => {
      // Wait one more tick to ensure Router context is definitely ready
      setTimeout(() => {
        setMounted(true);
      }, 100);
    });
  }, []);
  
  if (!mounted) return null;
  
  return (
    <Suspense fallback={null}>
      <ErrorBoundary fallback={null}>
        <GlobalIncomingCall />
      </ErrorBoundary>
      <ErrorBoundary fallback={null}>
        <GlobalMessageNotifications />
      </ErrorBoundary>
      <ErrorBoundary fallback={null}>
        <GlobalPresenceTracker />
      </ErrorBoundary>
      <CookieConsent />
      <PWAInstallPrompt />
      <ErrorBoundary fallback={null}>
        <UpdateAvailableToast />
      </ErrorBoundary>
    </Suspense>
  );
};

const App = () => {
  // Wrap critical components in error boundaries to prevent app crashes
  return (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
      >
        <TooltipProvider>
          <ErrorBoundary fallback={null}>
            <BadgeProvider />
          </ErrorBoundary>
          <SessionManager />
          <ErrorBoundary fallback={null}>
            <NativeAndroidInitializer />
          </ErrorBoundary>
          <ErrorBoundary fallback={null}>
            <WidgetDataManager />
          </ErrorBoundary>
          <ErrorBoundary fallback={null}>
            <RoutePrefetcher />
          </ErrorBoundary>
          {/* Toasters are lazy-loaded but needed early for notifications */}
          <Suspense fallback={null}>
            <Toaster />
            <Sonner />
          </Suspense>
          <SafeAreaLayout className="w-full overflow-x-hidden">
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              {/* Vercel Analytics - inside BrowserRouter to reliably track SPA route changes */}
              {/* Debug mode: localStorage.setItem("debug_analytics", "1") then reload */}
              <Analytics 
                debug={typeof window !== 'undefined' && localStorage.getItem('debug_analytics') === '1'}
              />
              {/* Vercel Speed Insights - inside BrowserRouter for consistent context */}
              <SpeedInsights 
                debug={typeof window !== 'undefined' && localStorage.getItem('debug_analytics') === '1'}
              />
              {/* Debug helper - logs route changes when debug_analytics=1 */}
              <AnalyticsDebugHelper />
              <ErrorBoundary fallback={null}>
                <WidgetIntentHandler />
              </ErrorBoundary>
              {/* Deferred global components - loaded after initial paint */}
              <DeferredGlobalComponents />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/parent/auth" element={<ParentAuth />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/parent" element={<Navigate to="/parent/children" replace />} />
                  <Route
                    path="/parent/children"
                    element={<ParentChildrenList />}
                  />
                  <Route
                    path="/parent/call/:childId"
                    element={<ParentCallScreen />}
                  />
                  <Route
                    path="/parent/dashboard"
                    element={<Navigate to="/parent/family" replace />}
                  />
                  <Route
                    path="/parent/family"
                    element={<ParentFamily />}
                  />
                  <Route
                    path="/parent/safety"
                    element={<ParentSafety />}
                  />
                  <Route
                    path="/parent/connections"
                    element={<ParentConnections />}
                  />
                  <Route
                    path="/parent/referrals"
                    element={<ParentReferrals />}
                  />
                  <Route
                    path="/parent/devices"
                    element={<DeviceManagement />}
                  />
                  <Route path="/parent/upgrade" element={<Upgrade />} />
                  <Route
                    path="/parent/settings"
                    element={<AccountSettings />}
                  />
                  <Route path="/child/login" element={<ChildLogin />} />
                  <Route path="/child" element={<Navigate to="/child/family" replace />} />
                  <Route path="/child/family" element={<ChildParentsList />} />
                  {/* Legacy route redirect for backward compatibility */}
                  <Route path="/child/parents" element={<Navigate to="/child/family" replace />} />
                  <Route
                    path="/child/call/:parentId"
                    element={<ChildCallScreen />}
                  />
                  <Route path="/child/parent" element={<ChildDashboard />} />
                  {/* Legacy route redirect for backward compatibility */}
                  <Route path="/child/dashboard" element={<Navigate to="/child/parent" replace />} />
                  <Route
                    path="/family-member/auth"
                    element={<FamilyMemberAuth />}
                  />
                  <Route
                    path="/family-member"
                    element={<FamilyMemberDashboard />}
                  />
                  <Route
                    path="/family-member/dashboard"
                    element={<FamilyMemberDashboard />}
                  />
                  <Route
                    path="/family-member/invite/:token"
                    element={<FamilyMemberInvite />}
                  />
                  <Route
                    path="/family-member/call/:childId"
                    element={<FamilyMemberCallScreen />}
                  />
                  {/* Legacy route - redirect to prevent incorrect user type detection */}
                  <Route path="/call/:childId" element={<Navigate to="/parent/children" replace />} />
                  <Route path="/chat/:childId" element={<Chat />} />
                  <Route path="/info" element={<Info />} />
                  <Route path="/beta" element={<Beta />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/security" element={<Security />} />
                  <Route path="/supported-devices" element={<SupportedDevices />} />
                  {/* Error pages */}
                  <Route path="/error/server" element={<ServerError />} />
                  <Route path="/error/network" element={<NetworkError />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </SafeAreaLayout>
        </TooltipProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
