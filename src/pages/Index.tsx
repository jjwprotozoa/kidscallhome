// src/pages/Index.tsx
// SEO/ASO/AI-optimized marketing landing page for Kids Call Home
// Benefits-focused, problem-solving approach with founder story for trust
// Accessible design with prominent Kids Login
// Smart routing: Shows marketing page for SEO, redirects app store users to login

import { trackPageView } from "@/utils/funnelTracking";
import { Info } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  HomePageNav,
  HeroSection,
  IfThisSoundsFamiliarSection,
  FounderStorySection,
  ComparisonTableSection,
  TrustSecuritySection,
  AppAvailabilitySection,
  TestimonialsSection,
  ProblemsWeSolveSection,
  ParentsSection,
  HowItWorksSection,
  DeviceCompatibilitySection,
  PricingSection,
} from "./HomePage";

// SEO Note: All structured data (SoftwareApplication and FAQPage schemas) are defined
// statically in index.html to ensure proper SEO indexing and avoid duplication.
// Google only allows one schema of each type per page.

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Smart routing: Check if user should be redirected
  // Only load Supabase when actually needed (lazy import to avoid loading on marketing page)
  useEffect(() => {
    // Track if this effect instance is still active (for cleanup)
    let isMounted = true;

    // PERFORMANCE: Reduced timeout from 3s to 1.5s for faster page load
    // Safety timeout: If auth check takes too long, show the page anyway
    // This prevents blank screen on slow networks or iOS Safari issues
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn("⚠️ [INDEX] Auth check timeout - showing marketing page");
        setIsCheckingAuth(false);
      }
    }, 1500); // 1.5 second safety timeout

    const checkAuthAndRedirect = async () => {
      try {
        const source =
          searchParams.get("source") ||
          searchParams.get("from") ||
          searchParams.get("utm_source");
        const isAppStoreTraffic =
          source?.toLowerCase().includes("appstore") ||
          source?.toLowerCase().includes("playstore") ||
          source?.toLowerCase().includes("app_store");

        // Check child session first (no Supabase needed)
        const childSession = localStorage.getItem("childSession");
        if (childSession) {
          try {
            JSON.parse(childSession);
            clearTimeout(safetyTimeout);
            if (isMounted) {
              navigate("/child/family", { replace: true });
            }
            return;
          } catch {
            // Invalid child session, continue to marketing page
          }
        }

        if (isAppStoreTraffic) {
          clearTimeout(safetyTimeout);
          if (isMounted) {
            navigate("/parent/auth", { replace: true });
          }
          return;
        }

        // Only load Supabase if we need to check for existing session
        // This prevents Supabase from initializing on marketing page for most users
        const hasStoredSession = typeof window !== 'undefined' &&
          Object.keys(localStorage).some(key => key.startsWith('sb-') || key.includes('supabase'));

        if (hasStoredSession) {
          // Lazy import Supabase only when we detect a stored session
          const { supabase } = await import("@/integrations/supabase/client");
          const { getUserRole } = await import("@/utils/userRole");

          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user && isMounted) {
            const userRole = await getUserRole(session.user.id);

            if (userRole === "family_member") {
              clearTimeout(safetyTimeout);
              navigate("/family-member/dashboard", { replace: true });
              return;
            } else if (userRole === "parent") {
              clearTimeout(safetyTimeout);
              navigate("/parent/children", { replace: true });
              return;
            }
          }
        }

        clearTimeout(safetyTimeout);
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      } catch (error) {
        // Silently fail - don't break marketing page if Supabase check fails
        console.error("Error checking auth:", error);
        clearTimeout(safetyTimeout);
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    };

    checkAuthAndRedirect();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
    };
  }, [navigate, searchParams]); // Intentionally exclude isCheckingAuth to prevent re-runs

  // Track page view
  useEffect(() => {
    if (!isCheckingAuth) {
      trackPageView("home");
    }
  }, [isCheckingAuth]);

  // SEO: All structured data (SoftwareApplication and FAQPage schemas) are defined
  // statically in index.html. No dynamic injection needed to avoid duplication.

  if (isCheckingAuth) {
    // Use inline styles as fallback in case Tailwind CSS hasn't loaded yet on iOS
    // This prevents blank screen while checking auth
    return (
      <div
        className="flex items-center justify-center min-h-[100dvh]"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          backgroundColor: '#ffffff'
        }}
      >
        <div className="text-center" style={{ textAlign: 'center' }}>
          <div
            className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"
            style={{
              display: 'inline-block',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '4px solid #e5e7eb',
              borderTopColor: '#3b82f6',
              animation: 'spin 1s linear infinite'
            }}
          />
          <p
            className="mt-4 text-sm text-muted-foreground"
            style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6b7280' }}
          >
            Loading...
          </p>
        </div>
        {/* Inline keyframes for spinner animation as fallback */}
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <main
      className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50"
      style={{
        minHeight: '100dvh',
        // Ensure content is visible even if CSS hasn't loaded
        visibility: 'visible',
        opacity: 1
      }}
    >
      {/* Top Navigation */}
      <HomePageNav />

      {/* Hero Section */}
      <HeroSection />

      {/* If this sounds familiar... */}
      <IfThisSoundsFamiliarSection />

      {/* Founder Story */}
      <FounderStorySection />

      {/* Comparison Table */}
      <ComparisonTableSection />

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* Problems We Solve Section */}
      <ProblemsWeSolveSection />

      {/* Parents Section */}
      <ParentsSection />

      {/* How It Works Section */}
      <HowItWorksSection />

      {/* Device Compatibility Section */}
      <DeviceCompatibilitySection />

      {/* Pricing Section */}
      <PricingSection />

      {/* Trust & Security Section */}
      <TrustSecuritySection />

      {/* App Availability Section */}
      <AppAvailabilitySection />

      {/* ============================================================
          FOOTER - Links and Information
          ============================================================ */}
      <footer className="border-t border-border/40 bg-muted/20 py-8 md:py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <Link
              to="/info"
              className="inline-flex items-center gap-2 text-sm md:text-base text-muted-foreground hover:text-foreground transition-colors"
            >
              <Info className="h-4 w-4" aria-hidden="true" />
              <span>Learn More &amp; App Information</span>
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm md:text-base">
              <Link
                to="/pricing"
                className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
                aria-label="Pricing"
              >
                Pricing
              </Link>
              <span className="text-muted-foreground">•</span>
              <Link
                to="/privacy"
                className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
                aria-label="Privacy Policy"
              >
                Privacy
              </Link>
              <span className="text-muted-foreground">•</span>
              <Link
                to="/terms"
                className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
                aria-label="Terms of Service"
              >
                Terms
              </Link>
              <span className="text-muted-foreground">•</span>
              <Link
                to="/security"
                className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
                aria-label="Security"
              >
                Security
              </Link>
              <span className="text-muted-foreground">•</span>
              <Link
                to="/supported-devices"
                className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
                aria-label="Supported Devices"
              >
                Supported Devices
              </Link>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">
              Privacy, Terms, Security, and more details
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default Index;
