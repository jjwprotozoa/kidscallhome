// src/components/GlobalPresenceTracker.tsx
// Global presence tracking - tracks presence on all pages for both children and parents

import { useEffect, useState } from "react";
import { usePresence } from "@/features/presence/usePresence";
import { supabase } from "@/integrations/supabase/client";
import { getChildSessionLegacy } from "@/lib/childSession";

interface ChildSession {
  id: string;
  name: string;
  avatar_color: string;
  parent_id: string;
}

/**
 * Global component that tracks presence on all pages
 * - Tracks child presence when child is logged in
 * - Tracks parent presence when parent is logged in
 * Runs automatically regardless of current page
 */
export const GlobalPresenceTracker = () => {
  const [child, setChild] = useState<ChildSession | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [parentName, setParentName] = useState<string | null>(null);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // If there's an error getting session, silently fail and check child session
        if (error) {
          if (import.meta.env.DEV) {
            console.warn("⚠️ [GLOBAL PRESENCE] Error getting session:", error);
          }
          // Fall through to check child session
        }
        
        if (session?.user) {
          // Parent is logged in - track parent presence
          setParentId(session.user.id);
          setChild(null);
          
          // Fetch parent name with error handling
          try {
            const { data: parentData } = await supabase
              .from("parents")
              .select("name")
              .eq("id", session.user.id)
              .maybeSingle();
            
            setParentName(parentData?.name || null);
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn("⚠️ [GLOBAL PRESENCE] Error fetching parent name:", error);
            }
            setParentName(null);
          }
        } else {
          // Check for child session
          if (typeof window === 'undefined' || !window.localStorage) {
            return;
          }
          
          try {
            const childData = getChildSessionLegacy();
            if (childData) {
              setChild(childData);
              setParentId(null);
              setParentName(null);
            } else {
              setChild(null);
              setParentId(null);
              setParentName(null);
            }
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn("⚠️ [GLOBAL PRESENCE] Error getting child session:", error);
            }
            setChild(null);
            setParentId(null);
            setParentName(null);
          }
        }
      } catch (error) {
        // Catch any unexpected errors and log them
        if (import.meta.env.DEV) {
          console.error("❌ [GLOBAL PRESENCE] Unexpected error in checkSession:", error);
        }
        // Reset state on error
        setChild(null);
        setParentId(null);
        setParentName(null);
      }
    };

    // Initial session check with error handling
    checkSession().catch((error) => {
      if (import.meta.env.DEV) {
        console.error("❌ [GLOBAL PRESENCE] Error in initial checkSession:", error);
      }
    });

    // Listen for storage changes (in case user logs in/out in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "childSession") {
        checkSession().catch((error) => {
          if (import.meta.env.DEV) {
            console.warn("⚠️ [GLOBAL PRESENCE] Error in storage change handler:", error);
          }
        });
      }
    };

    // Listen for auth state changes with error handling
    try {
      const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(() => {
        checkSession().catch((error) => {
          if (import.meta.env.DEV) {
            console.warn("⚠️ [GLOBAL PRESENCE] Error in auth state change handler:", error);
          }
        });
      });
      subscription = authSubscription;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("❌ [GLOBAL PRESENCE] Error setting up auth state listener:", error);
      }
      // Continue without auth state listener if it fails
    }

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      if (subscription) {
        try {
          subscription.unsubscribe();
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn("⚠️ [GLOBAL PRESENCE] Error unsubscribing:", error);
          }
        }
      }
    };
  }, []);

  // Track child's online presence globally (on all pages)
  usePresence({
    userId: child?.id || "",
    userType: "child",
    name: child?.name,
    enabled: !!child,
  });

  // Track parent's online presence globally (on all pages)
  usePresence({
    userId: parentId || "",
    userType: "parent",
    name: parentName || undefined,
    enabled: !!parentId,
  });

  // This component doesn't render anything
  return null;
};

