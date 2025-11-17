// src/components/Navigation.tsx
// Navigation component for parent and child pages

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Home, LayoutDashboard, Users, LogOut, MessageSquare, PhoneMissed, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTotalUnreadBadge, useTotalMissedBadge, useBadgeStore } from "@/stores/badgeStore";

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Check route path first (most reliable indicator)
  const getInitialUserType = (): "parent" | "child" | null => {
    const pathname = location.pathname;
    // If on child route, definitely a child
    if (pathname.includes('/child/')) return "child";
    // If on parent route, likely a parent (but verify with auth session)
    if (pathname.includes('/parent/')) return null; // Will check auth session
    
    // For other routes, check sessions
    // CRITICAL: Check auth session FIRST - parents have auth session, children don't
    // This prevents parents from being misidentified as children due to stale childSession
    const hasAuthSession = document.cookie.includes('sb-') || localStorage.getItem('sb-');
    if (hasAuthSession) {
      // Has auth session = parent (even if childSession exists)
      return "parent";
    }
    
    // No auth session - check if we have childSession
    const childSession = localStorage.getItem("childSession");
    if (childSession) {
      try {
        JSON.parse(childSession);
        return "child";
      } catch {
        // Invalid JSON
      }
    }
    return null;
  };

  const [userType, setUserType] = useState<"parent" | "child" | null>(getInitialUserType);
  const [loading, setLoading] = useState(false);
  
  // Get badge counts from store (derived, no DB reads)
  const unreadMessageCount = useTotalUnreadBadge();
  const missedCallCount = useTotalMissedBadge();

  useEffect(() => {
    const checkUserType = async () => {
      const pathname = location.pathname;
      
      // Route-based detection (most reliable)
      if (pathname.includes('/child/')) {
        // On child route - verify childSession exists
        const childSession = localStorage.getItem("childSession");
        if (childSession) {
          try {
            JSON.parse(childSession);
            setUserType("child");
            return;
          } catch {
            // Invalid JSON - fall through to check auth
          }
        }
      }
      
      if (pathname.includes('/parent/')) {
        // On parent route - check auth session
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            setUserType("parent");
            return;
          }
        } catch (error) {
          console.error("Error checking parent session:", error);
        }
      }

      // For other routes (like /call/), check auth session FIRST
      // CRITICAL: Always check auth session FIRST - parents have auth session, children don't
      // This prevents parents from being misidentified as children due to stale childSession
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          // Has auth session = parent (even if childSession exists)
          setUserType("parent");
        } else {
          // No auth session - check if we have childSession
          const childSession = localStorage.getItem("childSession");
          if (childSession) {
            try {
              JSON.parse(childSession);
              setUserType("child");
            } catch {
              // Invalid JSON
              setUserType(null);
            }
          } else {
            setUserType(null);
          }
        }
      } catch (error) {
        console.error("Error checking parent session:", error);
        setUserType(null);
      }
    };

    checkUserType();
  }, [location.pathname]);

  const handleLogout = async () => {
    if (userType === "child") {
      const childSession = localStorage.getItem("childSession");
      if (childSession) {
        try {
          const childData = JSON.parse(childSession);
          // Write presence status to database on logout (major state change)
          // Note: This is optional - presence is managed via WebSocket/Realtime
          // import { writePresenceOnLogout } from "@/features/presence/presenceDb";
          // await writePresenceOnLogout(childData.id, "child");
        } catch (error) {
          // Ignore errors
        }
      }
      localStorage.removeItem("childSession");
      // Reset badge store on logout
      useBadgeStore.getState().reset();
      toast({ title: "Logged out" });
      navigate("/child/login");
    } else if (userType === "parent") {
      // Get user ID before signing out
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.auth.signOut();
      
      // Write presence status to database on logout (major state change)
      // Note: This is optional - presence is managed via WebSocket/Realtime
      // if (user) {
      //   import { writePresenceOnLogout } from "@/features/presence/presenceDb";
      //   await writePresenceOnLogout(user.id, "parent");
      // }
      
      // Reset badge store on logout
      useBadgeStore.getState().reset();
      toast({ title: "Logged out" });
      navigate("/parent/auth");
    }
  };

  // Don't show navigation on auth/login pages or call screens
  if (
    loading ||
    !userType ||
    location.pathname.includes("/auth") ||
    location.pathname.includes("/login") ||
    location.pathname.includes("/call/") ||
    location.pathname.includes("/chat/")
  ) {
    return null;
  }

  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    );

  // CLS: Badge component - always reserve space to prevent layout shift
  // Badges are absolutely positioned so they don't affect layout, but we ensure consistent rendering
  const Badge = ({ count }: { count: number }) => {
    if (count === 0) return null; // Absolute positioning means no layout shift
    return (
      <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 border-2 border-background">
        {count > 99 ? "99+" : count}
      </span>
    );
  };

  if (userType === "parent") {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background w-full overflow-x-hidden" style={{ paddingTop: `calc(var(--safe-area-inset-top) * 0.15)` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex items-center justify-between h-16 min-w-0">
            <div className="flex items-center gap-4 min-w-0 flex-shrink" data-tour="parent-menu">
              <NavLink to="/parent" className={navLinkClassName}>
                <Home className="h-4 w-4" />
                <span>Home</span>
              </NavLink>
              <NavLink to="/parent/dashboard" className={navLinkClassName}>
                <div className="relative flex items-center justify-center">
                  <LayoutDashboard className="h-4 w-4" />
                  <Badge count={missedCallCount} />
                </div>
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/parent/children" className={navLinkClassName}>
                <div className="relative flex items-center justify-center">
                  <Users className="h-4 w-4" />
                  <Badge count={unreadMessageCount} />
                </div>
                <span>Children</span>
              </NavLink>
              <NavLink to="/parent/devices" className={navLinkClassName}>
                <Smartphone className="h-4 w-4" />
                <span>Devices</span>
              </NavLink>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="flex-shrink-0">
              <LogOut className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          </div>
        </div>
      </nav>
    );
  }

  if (userType === "child") {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background w-full overflow-x-hidden" style={{ paddingTop: `calc(var(--safe-area-inset-top) * 0.15)` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex items-center justify-between h-16 min-w-0">
            <div className="flex items-center gap-4 min-w-0 flex-shrink" data-tour="child-help">
              <NavLink to="/child" className={navLinkClassName}>
                <Home className="h-4 w-4" />
                <span>Home</span>
              </NavLink>
              <NavLink to="/child/dashboard" className={navLinkClassName}>
                <div className="relative flex items-center justify-center">
                  <LayoutDashboard className="h-4 w-4" />
                  <Badge count={missedCallCount} />
                </div>
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/child/parents" className={navLinkClassName}>
                <div className="relative flex items-center justify-center">
                  <Users className="h-4 w-4" />
                  <Badge count={unreadMessageCount} />
                </div>
                <span>Parents</span>
              </NavLink>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="flex-shrink-0">
              <LogOut className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          </div>
        </div>
      </nav>
    );
  }

  return null;
};

export default Navigation;

