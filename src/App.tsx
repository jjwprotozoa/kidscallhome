import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SafeAreaLayout } from "@/components/layout/SafeAreaLayout";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ServerError from "./pages/ServerError";
import NetworkError from "./pages/NetworkError";
import ParentAuth from "./pages/ParentAuth";
import ParentDashboard from "./pages/ParentDashboard";
import ParentHome from "./pages/ParentHome";
import ParentChildrenList from "./pages/ParentChildrenList";
import ParentCallScreen from "./pages/ParentCallScreen";
import DeviceManagement from "./pages/DeviceManagement";
import Upgrade from "./pages/Upgrade";
import AccountSettings from "./pages/AccountSettings";
import ChildLogin from "./pages/ChildLogin";
import ChildDashboard from "./pages/ChildDashboard";
import ChildHome from "./pages/ChildHome";
import ChildParentsList from "./pages/ChildParentsList";
import ChildCallScreen from "./pages/ChildCallScreen";
import VideoCall from "./pages/VideoCall";
import Chat from "./pages/Chat";
import Info from "./pages/Info";
import { useBadgeInitialization } from "@/hooks/useBadgeInitialization";
import { useBadgeRealtime } from "@/hooks/useBadgeRealtime";
import { GlobalIncomingCall } from "@/components/GlobalIncomingCall";
import { GlobalMessageNotifications } from "@/components/GlobalMessageNotifications";
import { GlobalPresenceTracker } from "@/components/GlobalPresenceTracker";
import { CookieConsent } from "@/components/CookieConsent";

const queryClient = new QueryClient();

// Badge initialization component (runs once per session)
const BadgeProvider = () => {
  useBadgeInitialization(); // One-time initial snapshot
  useBadgeRealtime(); // Realtime subscriptions
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

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BadgeProvider />
        <SessionManager />
        <Toaster />
        <Sonner />
        <SafeAreaLayout className="w-full overflow-x-hidden">
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <GlobalIncomingCall />
            <GlobalMessageNotifications />
            <GlobalPresenceTracker />
            <CookieConsent />
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
          </BrowserRouter>
        </SafeAreaLayout>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
