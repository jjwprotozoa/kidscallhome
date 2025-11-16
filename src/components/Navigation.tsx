// src/components/Navigation.tsx
// Navigation component for parent and child pages

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Home, LayoutDashboard, Users, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Check localStorage synchronously first for immediate render
  const getInitialUserType = (): "parent" | "child" | null => {
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

  useEffect(() => {
    const checkUserType = async () => {
      // If we already detected child from localStorage, we're done
      if (userType === "child") {
        return;
      }

      // Check if parent session exists
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          setUserType("parent");
        } else {
          setUserType(null);
        }
      } catch (error) {
        console.error("Error checking parent session:", error);
        setUserType(null);
      }
    };

    checkUserType();
  }, [location.pathname, userType]);

  const handleLogout = async () => {
    if (userType === "child") {
      localStorage.removeItem("childSession");
      toast({ title: "Logged out" });
      navigate("/child/login");
    } else if (userType === "parent") {
      await supabase.auth.signOut();
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
      "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    );

  if (userType === "parent") {
    return (
      <nav className="border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <NavLink to="/parent" className={navLinkClassName}>
                <Home className="h-4 w-4" />
                <span>Home</span>
              </NavLink>
              <NavLink to="/parent/dashboard" className={navLinkClassName}>
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/parent/children" className={navLinkClassName}>
                <Users className="h-4 w-4" />
                <span>Children</span>
              </NavLink>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </nav>
    );
  }

  if (userType === "child") {
    return (
      <nav className="border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <NavLink to="/child" className={navLinkClassName}>
                <Home className="h-4 w-4" />
                <span>Home</span>
              </NavLink>
              <NavLink to="/child/dashboard" className={navLinkClassName}>
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/child/parents" className={navLinkClassName}>
                <Users className="h-4 w-4" />
                <span>Parents</span>
              </NavLink>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </nav>
    );
  }

  return null;
};

export default Navigation;

