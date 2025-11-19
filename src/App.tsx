import React, { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SafeAreaLayout } from "@/components/layout/SafeAreaLayout";
import { supabase } from "@/integrations/supabase/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useBadgeInitialization } from "@/hooks/useBadgeInitialization";
import { useBadgeRealtime } from "@/hooks/useBadgeRealtime";
import { GlobalIncomingCall } from "@/components/GlobalIncomingCall";
import { GlobalMessageNotifications } from "@/components/GlobalMessageNotifications";
import { GlobalPresenceTracker } from "@/components/GlobalPresenceTracker";
import { CookieConsent } from "@/components/CookieConsent";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { initializeNativeAndroid, isNativeAndroid } from "@/utils/nativeAndroid";
import { useNavigate } from "react-router-dom";
import { useWidgetData } from "@/hooks/useWidgetData";

// Keep small/essential pages as regular imports (needed immediately)
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ServerError from "./pages/ServerError";
import NetworkError from "./pages/NetworkError";

// Lazy load all other pages for code splitting
const ParentAuth = lazy(() => import("./pages/ParentAuth"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));
const ParentHome = lazy(() => import("./pages/ParentHome"));
const ParentChildrenList = lazy(() => import("./pages/ParentChildrenList"));
const ParentCallScreen = lazy(() => import("./pages/ParentCallScreen"));
const DeviceManagement = lazy(() => import("./pages/DeviceManagement"));
const Upgrade = lazy(() => import("./pages/Upgrade"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const ChildLogin = lazy(() => import("./pages/ChildLogin"));
const ChildDashboard = lazy(() => import("./pages/ChildDashboard"));
const ChildHome = lazy(() => import("./pages/ChildHome"));
const ChildParentsList = lazy(() => import("./pages/ChildParentsList"));
const ChildCallScreen = lazy(() => import("./pages/ChildCallScreen"));
const VideoCall = lazy(() => import("./pages/VideoCall"));
const Chat = lazy(() => import("./pages/Chat"));
const Info = lazy(() => import("./pages/Info"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[100dvh]">
    <div className="text-center">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
      <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

// Configure QueryClient with error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
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

// Badge initialization component (runs once per session)
const BadgeProvider = () => {
  useBadgeInitialization(); // One-time initial snapshot
  useBadgeRealtime(); // Realtime subscriptions
  return null;
};

// Component to initialize native Android features
const NativeAndroidInitializer = () => {
  useEffect(() => {
    initializeNativeAndroid().catch((error) => {
      console.error('Failed to initialize native Android features:', error);
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
    const handleWidgetQuickCall = async (event: CustomEvent) => {
      console.log('📱 Widget quick call received:', event.detail);
      
      const { childId } = event.detail || {};
      
      // Use childId from event if available (from widget URI)
      if (childId) {
        console.log('📱 Routing to child from widget:', childId);
        navigate(`/parent/call/${childId}`);
        return;
      }
      
      // Fallback: Try to load widget data to get last-called child
      const { loadWidgetData } = await import('@/utils/widgetData');
      const widgetData = loadWidgetData();
      
      if (widgetData?.childId) {
        // Route directly to last-called child's call screen
        console.log('📱 Routing to last-called child:', widgetData.childId);
        navigate(`/parent/call/${widgetData.childId}`);
      } else {
        // Fallback to parent dashboard
        navigate('/parent/dashboard');
      }
    };

    window.addEventListener('widgetQuickCall', handleWidgetQuickCall as EventListener);

    return () => {
      window.removeEventListener('widgetQuickCall', handleWidgetQuickCall as EventListener);
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
    // Check if we should clear session on browser close
    const shouldClearOnClose = sessionStorage.getItem("clearSessionOnClose");
    
    if (shouldClearOnClose === "true") {
      const clearSession = () => {
        // Clear Supabase session from localStorage
        const supabaseKeys = Object.keys(localStorage).filter(key => 
          key.startsWith("sb-") || key.includes("supabase")
        );
        supabaseKeys.forEach(key => localStorage.removeItem(key));
        // Also sign out from Supabase to ensure clean state
        supabase.auth.signOut().catch(() => {
          // Ignore errors during signout
        });
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

const App = () => {
  // Wrap critical components in error boundaries to prevent app crashes
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
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
            <WidgetIntentHandler />
          </ErrorBoundary>
          <Toaster />
          <Sonner />
          <SafeAreaLayout className="w-full overflow-x-hidden">
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
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
              <Suspense fallback={<PageLoader />}>
                <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/parent/auth" element={<ParentAuth />} />
                <Route path="/parent" element={<ParentHome />} />
                <Route path="/parent/children" element={<ParentChildrenList />} />
                <Route path="/parent/call/:childId" element={<ParentCallScreen />} />
                <Route path="/parent/dashboard" element={<ParentDashboard />} />
                <Route path="/parent/devices" element={<DeviceManagement />} />
                <Route path="/parent/upgrade" element={<Upgrade />} />
                <Route path="/parent/settings" element={<AccountSettings />} />
                <Route path="/child/login" element={<ChildLogin />} />
                <Route path="/child" element={<ChildHome />} />
                <Route path="/child/parents" element={<ChildParentsList />} />
                <Route path="/child/call/:parentId" element={<ChildCallScreen />} />
                <Route path="/child/dashboard" element={<ChildDashboard />} />
                <Route path="/call/:childId" element={<VideoCall />} />
                <Route path="/chat/:childId" element={<Chat />} />
                <Route path="/info" element={<Info />} />
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
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
