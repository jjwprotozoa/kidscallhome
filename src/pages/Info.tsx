// src/pages/Info.tsx
// App Store / Play Store compliance information page

import { AppDescription } from "@/components/info/AppDescription";
import { BetaTestingSection } from "@/components/info/BetaTestingSection";
import { CancellationSection } from "@/components/info/CancellationSection";
import { ContactSection } from "@/components/info/ContactSection";
import { DataRemovalSection } from "@/components/info/DataRemovalSection";
import { DemoSection } from "@/components/info/DemoSection";
import { InfoNavigation } from "@/components/info/InfoNavigation";
import { PricingSection } from "@/components/info/PricingSection";
import { PrivacySection } from "@/components/info/PrivacySection";
import { SecuritySection } from "@/components/info/SecuritySection";
import { TermsSection } from "@/components/info/TermsSection";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { infoSections } from "@/data/infoSections";
import { supabase } from "@/integrations/supabase/client";
import { safeLog, sanitizeError } from "@/utils/security";
import { ArrowLeft, Home, Info as InfoIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const Info = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showFloatingNav, setShowFloatingNav] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [userType, setUserType] = useState<
    "parent" | "child" | "family_member" | null
  >(null);
  const [loading, setLoading] = useState(true);

  // Determine user type and home route
  useEffect(() => {
    const determineUserType = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const childSession = localStorage.getItem("childSession");

        if (session) {
          // Has auth session - check if parent or family member
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user) {
            // Check if user is a family member first
            const { data: familyMember } = await supabase
              .from("family_members")
              .select("id")
              .eq("id", user.id)
              .eq("status", "active")
              .maybeSingle();

            if (familyMember) {
              setUserType("family_member");
            } else {
              // Fallback: Check adult_profiles
              const { data: adultProfile } = await supabase
                .from("adult_profiles" as never)
                .select("role")
                .eq("user_id", user.id)
                .eq("role", "family_member")
                .maybeSingle();

              if (adultProfile) {
                setUserType("family_member");
              } else {
                // Not a family member, must be a parent
                setUserType("parent");
              }
            }
          } else {
            setUserType("parent"); // Default to parent if session exists but no user
          }
        } else if (childSession) {
          try {
            JSON.parse(childSession);
            setUserType("child");
          } catch {
            setUserType(null);
          }
        } else {
          setUserType(null);
        }
      } catch (error) {
        safeLog.error("Error determining user type:", sanitizeError(error));
        setUserType(null);
      } finally {
        setLoading(false);
      }
    };

    determineUserType();
  }, []);

  // Get home route based on user type
  const getHomeRoute = () => {
    if (userType === "parent") return "/parent";
    if (userType === "family_member") return "/family-member/dashboard";
    if (userType === "child") return "/child";
    return "/"; // Landing page if not logged in
  };

  // Check if user is likely a parent (synchronous, non-blocking)
  const isParent = useMemo(() => {
    return userType === "parent";
  }, [userType]);

  // Filter sections based on user type - hide privacy policy for kids
  const filteredSections = useMemo(() => {
    if (userType === "child") {
      return infoSections.filter((section) => section.id !== "privacy");
    }
    return infoSections;
  }, [userType]);

  // Show floating nav when scrolled down
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setShowFloatingNav(scrollY > 300); // Show after scrolling 300px
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll to section and update URL hash
  const scrollToSection = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      // Update URL hash without triggering navigation
      window.history.replaceState(null, "", `/info#${id}`);
      setSheetOpen(false); // Close sheet after navigation
    }
  }, []);

  // Handle initial hash on page load and hash changes
  useEffect(() => {
    const hash = location.hash.replace("#", "");
    if (hash) {
      // Small delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [location.hash]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Clear the hash from URL
    window.history.replaceState(null, "", "/info");
  };

  return (
    <div className="min-h-[100dvh] bg-background w-full overflow-x-hidden">
      <Navigation />
      <div
        className="px-4 pb-8"
        style={{
          paddingTop: "calc(0.5rem + 64px + var(--safe-area-inset-top) * 0.15)",
        }}
      >
        <div className="max-w-4xl mx-auto">
          {/* Header with App Icon and Back Button */}
          <div className="mt-4 mb-8">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-4 flex-1">
                {/* App Icon */}
                <div className="flex-shrink-0">
                  <img
                    src="/icon-192x192.png"
                    alt="Kids Call Home"
                    className="w-16 h-16 rounded-xl shadow-md"
                    width="64"
                    height="64"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <InfoIcon className="h-6 w-6 flex-shrink-0" />
                    <h1 className="text-3xl font-bold">App Information</h1>
                  </div>
                  <p className="text-muted-foreground">
                    Important information about Kids Call Home
                  </p>
                </div>
              </div>
              {/* Back to App Button */}
              {!loading && (
                <Button
                  onClick={() => navigate(getHomeRoute())}
                  variant="default"
                  size="lg"
                  className="flex-shrink-0 shadow-md"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">
                    {userType === "parent"
                      ? "Back to Parent Home"
                      : userType === "family_member"
                      ? "Back to Family Member Home"
                      : userType === "child"
                      ? "Back to Kid Home"
                      : "Back to App"}
                  </span>
                  <Home className="h-4 w-4 sm:hidden" />
                </Button>
              )}
            </div>
          </div>

          {/* Navigation */}
          <InfoNavigation
            sections={filteredSections}
            scrollToSection={scrollToSection}
            scrollToTop={scrollToTop}
            sheetOpen={sheetOpen}
            setSheetOpen={setSheetOpen}
            showFloatingNav={showFloatingNav}
            onBackToApp={() => navigate(getHomeRoute())}
            backButtonTitle={
              userType === "parent"
                ? "Back to Parent Home"
                : userType === "family_member"
                ? "Back to Family Member Home"
                : userType === "child"
                ? "Back to Kid Home"
                : "Back to App"
            }
            loading={loading}
          />

          {/* Sections */}
          <AppDescription />
          <BetaTestingSection />
          <PricingSection isParent={isParent} />
          <TermsSection />
          {userType !== "child" && <PrivacySection />}
          <SecuritySection />
          <CancellationSection isParent={isParent} />
          <DataRemovalSection />
          <ContactSection />
          <DemoSection />

          {/* Back to Top */}
          <div className="text-center pt-8">
            <Button variant="outline" onClick={scrollToTop}>
              Back to Top
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Info;
