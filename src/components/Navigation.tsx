// src/components/Navigation.tsx
// Navigation component for parent and child pages

import { NavLink } from "@/components/NavLink";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  useBadgeStore,
  useTotalMissedBadge,
  useTotalUnreadBadge,
} from "@/stores/badgeStore";
import { getUserRole } from "@/utils/userRole";
import {
  Home,
  Info,
  LayoutDashboard,
  LogOut,
  MoreVertical,
  Settings,
  Shield,
  Smartphone,
  Star,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check route path first (most reliable indicator)
  const getInitialUserType = ():
    | "parent"
    | "child"
    | "family_member"
    | null => {
    const pathname = location.pathname;
    // If on child route, definitely a child
    if (pathname.includes("/child/")) return "child";
    // If on family-member route, set as family_member initially
    // The useEffect will verify this, but this prevents showing parent nav initially
    if (
      pathname.includes("/family-member") ||
      pathname.startsWith("/family-member")
    ) {
      console.warn("🔍 [NAVIGATION] Initial state: family_member (from route)");
      return "family_member";
    }
    // If on parent route, likely a parent (but verify with auth session)
    if (pathname.includes("/parent/")) return null; // Will check auth session

    // For other routes, check sessions
    // CRITICAL: Check auth session FIRST - parents and family members have auth session, children don't
    // This prevents parents from being misidentified as children due to stale childSession
    const hasAuthSession =
      document.cookie.includes("sb-") || localStorage.getItem("sb-");
    if (hasAuthSession) {
      // Has auth session - could be parent or family member, will check in useEffect
      return null; // Will check in useEffect
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

  const [userType, setUserType] = useState<
    "parent" | "child" | "family_member" | null
  >(getInitialUserType);
  const [loading, setLoading] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [pendingConnectionsCount, setPendingConnectionsCount] = useState(0);
  const [newReportsCount, setNewReportsCount] = useState(0);
  const [blockedContactsCount, setBlockedContactsCount] = useState(0);

  // Get badge counts from store (derived, no DB reads)
  const unreadMessageCount = useTotalUnreadBadge();
  const missedCallCount = useTotalMissedBadge();

  useEffect(() => {
    const checkUserType = async () => {
      const pathname = location.pathname;

      console.warn("🔍 [NAVIGATION] Checking user type for path:", pathname);

      // Route-based detection (most reliable)
      if (pathname.includes("/child/")) {
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

      if (pathname.includes("/parent/") || pathname === "/parent") {
        // On parent route - check auth session and verify it's a parent
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (user) {
              // Check user role using canonical source
              const userRole = await getUserRole(user.id);
              if (userRole === "family_member") {
                setUserType("family_member");
              } else {
                setUserType("parent");
              }
              return;
            }
          }
        } catch (error) {
          console.error("Error checking parent session:", error);
        }
      }

      if (
        pathname.includes("/family-member") ||
        pathname.startsWith("/family-member")
      ) {
        // On family member route - verify it's a family member
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (user) {
              // Check user role using canonical source
              const userRole = await getUserRole(user.id);
              if (userRole === "family_member") {
                console.warn(
                  "✅ [NAVIGATION] User is family member (from adult_profiles)"
                );
                setUserType("family_member");
                return;
              } else if (userRole === "parent") {
                // Parent on family member route - should redirect, but show family nav for now
                console.warn(
                  "⚠️ [NAVIGATION] Parent detected on family-member route"
                );
                setUserType("family_member"); // Show family nav to prevent confusion
                return;
              }
            }
          }
        } catch (error) {
          console.error("Error checking family member session:", error);
        }
      }

      // For other routes (like /call/), check auth session FIRST
      // CRITICAL: Always check auth session FIRST - parents and family members have auth session, children don't
      // This prevents parents from being misidentified as children due to stale childSession
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            // Has auth session - check if parent or family member using canonical source
            const userRole = await getUserRole(user.id);
            if (userRole === "family_member") {
              console.warn(
                "✅ [NAVIGATION] User is family member (from adult_profiles)"
              );
              setUserType("family_member");
            } else if (userRole === "parent") {
              console.warn(
                "✅ [NAVIGATION] User is parent (from adult_profiles)"
              );
              setUserType("parent");
            } else {
              // Role not determined - default based on route or parent
              if (
                pathname.includes("/family-member") ||
                pathname.startsWith("/family-member")
              ) {
                setUserType("family_member");
              } else {
                setUserType("parent");
              }
            }
          }
        } else {
          // No auth session - check if we have childSession
          const { getChildSessionLegacy } = await import("@/lib/childSession");
          const childSession = getChildSessionLegacy();
          if (childSession) {
            setUserType("child");
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

  // Load badge counts for parent navigation
  useEffect(() => {
    const loadParentBadges = async () => {
      if (userType !== "parent") {
        setPendingConnectionsCount(0);
        setNewReportsCount(0);
        setBlockedContactsCount(0);
        return;
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // First check if user is a family member - if so, don't load parent badges
        const { data: familyMember } = await supabase
          .from("family_members")
          .select("id")
          .eq("id", user.id)
          .eq("status", "active")
          .maybeSingle();

        if (familyMember) {
          // User is a family member, not a parent - don't load parent badges
          setPendingConnectionsCount(0);
          setNewReportsCount(0);
          setBlockedContactsCount(0);
          return;
        }

        const { data: adultProfile } = await supabase
          .from("adult_profiles" as never)
          .select("family_id")
          .eq("user_id", user.id)
          .eq("role", "parent")
          .single();

        if (!adultProfile) return;

        const ap = adultProfile as { family_id: string };
        const familyId = ap.family_id;

        // Query child_connections for pending status
        const { data: pendingConnections, error: connectionsError } =
          await supabase
            .from("child_connections" as never)
            .select("id", { count: "exact" })
            .or(
              `requester_family_id.eq.${familyId},target_family_id.eq.${familyId}`
            )
            .eq("status", "pending");

        if (!connectionsError && pendingConnections) {
          setPendingConnectionsCount(pendingConnections.length || 0);
        }

        // Query reports for pending status
        const { data: childMemberships } = await supabase
          .from("child_family_memberships" as never)
          .select("child_profile_id")
          .eq("family_id", familyId);

        if (childMemberships && childMemberships.length > 0) {
          const cms = childMemberships as { child_profile_id: string }[];
          const childProfileIds = cms.map((cm) => cm.child_profile_id);

          const { data: pendingReports, error: reportsError } = await supabase
            .from("reports" as never)
            .select("id", { count: "exact" })
            .in("reporter_child_id", childProfileIds)
            .eq("status", "pending");

          if (!reportsError && pendingReports) {
            setNewReportsCount(pendingReports.length || 0);
          }

          // Query blocked_contacts where unblocked_at is null
          const { data: blockedContacts, error: blockedError } = await supabase
            .from("blocked_contacts" as never)
            .select("id", { count: "exact" })
            .in("blocker_child_id", childProfileIds)
            .is("unblocked_at", null);

          if (!blockedError && blockedContacts) {
            setBlockedContactsCount(blockedContacts.length || 0);
          }
        }
      } catch (error) {
        console.error("Error loading parent badges:", error);
      }
    };

    loadParentBadges();
  }, [userType]);

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
    } else if (userType === "parent" || userType === "family_member") {
      // Get user ID before signing out
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.auth.signOut();

      // Write presence status to database on logout (major state change)
      // Note: This is optional - presence is managed via WebSocket/Realtime
      // if (user) {
      //   import { writePresenceOnLogout } from "@/features/presence/presenceDb";
      //   await writePresenceOnLogout(user.id, userType);
      // }

      // Reset badge store on logout
      useBadgeStore.getState().reset();
      toast({ title: "Logged out" });
      navigate(
        userType === "family_member" ? "/family-member/auth" : "/parent/auth"
      );
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

  const getNavLinkClassName = (path: string) => {
    const isActive =
      location.pathname === path || location.pathname.startsWith(path + "/");
    return cn(
      "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    );
  };

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

  // IMPORTANT: Check family_member FIRST before parent
  // This ensures family members on /family-member/ routes get the correct navigation
  if (userType === "family_member") {
    // Family members have limited navigation - just Home and More menu
    // They can only call/message children, not manage settings or view reports
    return (
      <>
        <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background w-full overflow-x-hidden safe-area-top">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="flex items-center justify-between h-16 min-w-0">
              <div className="flex items-center gap-4 min-w-0 flex-shrink">
                <NavLink
                  to="/family-member"
                  className={getNavLinkClassName("/family-member")}
                >
                  <Home className="h-4 w-4" />
                  <span>Home</span>
                </NavLink>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        location.pathname === "/info"
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <MoreVertical className="h-4 w-4" />
                      <span className="hidden sm:inline">More</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate("/info")}>
                      <Info className="mr-2 h-4 w-4" />
                      <span>App Information</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLogoutDialog(true)}
                className="flex-shrink-0"
              >
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Logout</span>
              </Button>
            </div>
          </div>
        </nav>
        {/* Logout Confirmation Dialog */}
        <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to log out? You'll need to sign in again
                to access your account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLogout}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Logout
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  if (userType === "parent") {
    return (
      <>
        <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background w-full overflow-x-hidden safe-area-top">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="flex items-center justify-between h-16 min-w-0">
              <div
                className="flex items-center gap-4 min-w-0 flex-shrink"
                data-tour="parent-menu"
              >
                <NavLink
                  to="/parent"
                  className={getNavLinkClassName("/parent")}
                >
                  <Home className="h-4 w-4" />
                  <span>Home</span>
                </NavLink>
                <NavLink
                  to="/parent/dashboard"
                  className={getNavLinkClassName("/parent/dashboard")}
                >
                  <div className="relative flex items-center justify-center">
                    <LayoutDashboard className="h-4 w-4" />
                    <Badge count={missedCallCount} />
                  </div>
                  <span>Dashboard</span>
                </NavLink>
                <button
                  onClick={() => navigate("/parent/dashboard?tab=connections")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
                    location.pathname === "/parent/dashboard" &&
                      location.search.includes("tab=connections")
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  title="Connections"
                >
                  <div className="relative flex items-center justify-center">
                    <UserCheck className="h-4 w-4" />
                    <Badge count={pendingConnectionsCount} />
                  </div>
                  <span className="hidden sm:inline">Connections</span>
                </button>
                <button
                  onClick={() => navigate("/parent/dashboard?tab=safety")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
                    location.pathname === "/parent/dashboard" &&
                      location.search.includes("tab=safety")
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  title="Safety"
                >
                  <div className="relative flex items-center justify-center">
                    <Shield className="h-4 w-4" />
                    <Badge count={newReportsCount + blockedContactsCount} />
                  </div>
                  <span className="hidden sm:inline">Safety</span>
                </button>
                <NavLink
                  to="/parent/children"
                  className={getNavLinkClassName("/parent/children")}
                >
                  <div className="relative flex items-center justify-center">
                    <Users className="h-4 w-4" />
                    <Badge count={unreadMessageCount} />
                  </div>
                  <span>Children</span>
                </NavLink>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        location.pathname === "/parent/devices" ||
                          location.pathname === "/parent/settings" ||
                          location.pathname === "/info"
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <MoreVertical className="h-4 w-4" />
                      <span className="hidden sm:inline">More</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => navigate("/parent/devices")}
                    >
                      <Smartphone className="mr-2 h-4 w-4" />
                      <span>Devices</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate("/parent/settings")}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/info")}>
                      <Info className="mr-2 h-4 w-4" />
                      <span>App Information</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/beta")}>
                      <Star className="mr-2 h-4 w-4" />
                      <span>Beta Testing</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLogoutDialog(true)}
                className="flex-shrink-0"
              >
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Logout</span>
              </Button>
            </div>
          </div>
        </nav>
        {/* Logout Confirmation Dialog */}
        <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to log out? You'll need to sign in again
                to access your account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLogout}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Logout
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  if (userType === "child") {
    return (
      <>
        <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background w-full overflow-x-hidden safe-area-top">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="flex items-center justify-between h-16 min-w-0">
              <div
                className="flex items-center gap-4 min-w-0 flex-shrink"
                data-tour="child-help"
              >
                <NavLink to="/child" className={getNavLinkClassName("/child")}>
                  <Home className="h-4 w-4" />
                  <span>Home</span>
                </NavLink>
                <NavLink
                  to="/child/dashboard"
                  className={getNavLinkClassName("/child/dashboard")}
                >
                  <div className="relative flex items-center justify-center">
                    <LayoutDashboard className="h-4 w-4" />
                    <Badge count={missedCallCount} />
                  </div>
                  <span>Dashboard</span>
                </NavLink>
                <NavLink
                  to="/child/parents"
                  className={getNavLinkClassName("/child/parents")}
                >
                  <div className="relative flex items-center justify-center">
                    <Users className="h-4 w-4" />
                    <Badge count={unreadMessageCount} />
                  </div>
                  <span>Family</span>
                </NavLink>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        location.pathname === "/info"
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <MoreVertical className="h-4 w-4" />
                      <span className="hidden sm:inline">More</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate("/info")}>
                      <Info className="mr-2 h-4 w-4" />
                      <span>App Information</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLogoutDialog(true)}
                className="flex-shrink-0"
              >
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Logout</span>
              </Button>
            </div>
          </div>
        </nav>
        {/* Logout Confirmation Dialog */}
        <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to log out? You'll need to sign in again
                to access your account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLogout}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Logout
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return null;
};

export default Navigation;
