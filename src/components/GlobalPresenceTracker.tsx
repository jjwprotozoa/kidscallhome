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
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Parent is logged in - track parent presence
        setParentId(session.user.id);
        setChild(null);
        
        // Fetch parent name
        const { data: parentData } = await supabase
          .from("parents")
          .select("name")
          .eq("id", session.user.id)
          .maybeSingle();
        
        setParentName(parentData?.name || null);
      } else {
        // Check for child session
        if (typeof window === 'undefined' || !window.localStorage) {
          return;
        }
        
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
      }
    };

    checkSession();

    // Listen for storage changes (in case user logs in/out in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "childSession") {
        checkSession();
      }
    };

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkSession();
    });

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      subscription.unsubscribe();
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

