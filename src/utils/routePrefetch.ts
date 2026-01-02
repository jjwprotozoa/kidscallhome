// src/utils/routePrefetch.ts
// Route prefetching utility for faster navigation
// Prefetches route chunks when links are hovered or focused

// Map of route paths to their lazy import functions
// This allows us to prefetch routes before navigation
const routeMap: Record<string, () => Promise<any>> = {
  "/parent/auth": () => import("@/pages/ParentAuth"),
  "/parent/children": () => import("@/pages/ParentChildrenList"),
  "/parent/call": () => import("@/pages/ParentCallScreen"),
  "/parent/family": () => import("@/pages/ParentFamily"),
  "/parent/safety": () => import("@/pages/ParentSafety"),
  "/parent/connections": () => import("@/pages/ParentConnections"),
  "/parent/referrals": () => import("@/pages/ParentReferrals"),
  "/parent/devices": () => import("@/pages/DeviceManagement/index"),
  "/parent/upgrade": () => import("@/pages/Upgrade/Upgrade"),
  "/parent/settings": () => import("@/pages/AccountSettings"),
  "/parent": () => import("@/pages/ParentHome"),
  "/child/login": () => import("@/pages/ChildLogin"),
  "/child/family": () => import("@/pages/ChildParentsList"),
  "/child/call": () => import("@/pages/ChildCallScreen"),
  "/child/parent": () => import("@/pages/ChildDashboard"),
  "/child": () => import("@/pages/ChildHome"),
  "/family-member/auth": () => import("@/pages/FamilyMemberAuth"),
  "/family-member/dashboard": () => import("@/pages/FamilyMemberDashboard"),
  "/family-member/invite": () => import("@/pages/FamilyMemberInvite"),
  "/family-member/call": () => import("@/pages/FamilyMemberCallScreen"),
  "/chat": () => import("@/pages/Chat"),
  "/verify-email": () => import("@/pages/VerifyEmail"),
  "/pricing": () => import("@/pages/Pricing"),
  "/privacy": () => import("@/pages/Privacy"),
  "/terms": () => import("@/pages/Terms"),
  "/security": () => import("@/pages/Security"),
  "/supported-devices": () => import("@/pages/SupportedDevices"),
};

// Track prefetched routes to avoid duplicate prefetches
const prefetchedRoutes = new Set<string>();

/**
 * Prefetch a route by its path
 * Returns true if prefetch was successful, false if route not found or already prefetched
 */
export function prefetchRoute(path: string): boolean {
  // Normalize path (remove trailing slash, handle dynamic segments)
  const normalizedPath = path.split("?")[0].split("#")[0].replace(/\/$/, "");
  
  // Find matching route (handle dynamic segments like /parent/call/:childId)
  let routeKey: string | null = null;
  for (const key in routeMap) {
    // Exact match
    if (normalizedPath === key) {
      routeKey = key;
      break;
    }
    // Prefix match for dynamic routes (e.g., /parent/call matches /parent/call/:childId)
    if (normalizedPath.startsWith(key + "/") || normalizedPath.startsWith(key + "?")) {
      routeKey = key;
      break;
    }
  }
  
  if (!routeKey || prefetchedRoutes.has(routeKey)) {
    return false;
  }
  
  const importFn = routeMap[routeKey];
  if (!importFn) {
    return false;
  }
  
  // Mark as prefetched immediately to prevent duplicate prefetches
  prefetchedRoutes.add(routeKey);
  
  // Prefetch the route chunk
  importFn().catch(() => {
    // Silently fail - prefetching is non-critical
    // Remove from prefetched set so we can retry if needed
    prefetchedRoutes.delete(routeKey);
  });
  
  return true;
}

/**
 * Initialize global route prefetching on link hover/focus
 * This automatically prefetches routes when users hover over or focus links
 */
export function initRoutePrefetching(): void {
  if (typeof window === "undefined") return;
  
  // PERFORMANCE: Reduced delay from 100ms to 50ms for faster prefetching
  // Use a small delay to avoid prefetching on accidental hovers
  let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  const PREFETCH_DELAY = 50; // 50ms delay before prefetching (reduced for faster navigation)
  
  const handleLinkHover = (event: MouseEvent | FocusEvent) => {
    // Ensure target is an Element (closest only exists on Element)
    const target = event.target;
    if (!target || !(target instanceof Element)) {
      return;
    }
    
    const link = target.closest("a[href]") as HTMLAnchorElement | null;
    
    if (!link) return;
    
    const href = link.getAttribute("href");
    if (!href) return;
    
    // Only prefetch internal routes (not external links or anchors)
    if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#")) {
      return;
    }
    
    // Clear existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    
    // Prefetch after delay
    hoverTimeout = setTimeout(() => {
      prefetchRoute(href);
      hoverTimeout = null;
    }, PREFETCH_DELAY);
  };
  
  // Listen for hover and focus events on links
  document.addEventListener("mouseenter", handleLinkHover, true);
  document.addEventListener("focusin", handleLinkHover, true);
  
  // Cleanup on mouseleave/focusout
  const handleLinkLeave = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
  };
  
  document.addEventListener("mouseleave", handleLinkLeave, true);
  document.addEventListener("focusout", handleLinkLeave, true);
}

