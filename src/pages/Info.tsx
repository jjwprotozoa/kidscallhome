// src/pages/Info.tsx
// App Store / Play Store compliance information page
// Mobile-first design with responsive navigation

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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { safeLog, sanitizeError } from "@/utils/security";
import { Info as InfoIcon, Share2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

const Info = () => {
  const location = useLocation();
  const { toast } = useToast();
  const [showFloatingNav, setShowFloatingNav] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [userType, setUserType] = useState<
    "parent" | "child" | "family_member" | null
  >(null);
  const [loading, setLoading] = useState(true);

  // Share page functionality
  const handleShare = async () => {
    const shareUrl = window.location.origin + "/info";
    const shareTitle = "Kids Call Home - App Information";
    const shareText =
      "Check out Kids Call Home - Safe video calls for kids! Here's information about the app:";

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled or share failed - don't show error for cancellation
        if ((error as Error).name !== "AbortError") {
          toast({
            title: "Share failed",
            description: "Could not share. Try copying the link instead.",
            variant: "destructive",
          });
        }
      }
    } else {
      // Fallback: copy link to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link copied!",
          description: "Page link copied to clipboard",
        });
      } catch {
        toast({
          title: "Copy failed",
          description: "Please copy the URL manually",
          variant: "destructive",
        });
      }
    }
  };

  // Determine user type
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
      setShowFloatingNav(scrollY > 200); // Show after scrolling 200px
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll to section and update URL hash
  const scrollToSection = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      // Account for fixed header height
      const headerOffset = 140; // Navigation + sticky section nav
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition =
        elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
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
        scrollToSection(hash);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [location.hash, scrollToSection]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Clear the hash from URL
    window.history.replaceState(null, "", "/info");
    setSheetOpen(false);
  };

  return (
    <div className="min-h-[100dvh] bg-background w-full overflow-x-hidden">
      <Navigation />
      <div
        className="px-4 pb-8 md:pb-12"
        style={{
          paddingTop: "calc(0.5rem + 64px + var(--safe-area-inset-top) * 0.15)",
        }}
      >
        <div className="max-w-4xl mx-auto">
          {/* Header - Compact on mobile */}
          <header className="py-4 md:py-6">
            <div className="flex items-center gap-3 md:gap-4">
              {/* App Icon */}
              <div className="flex-shrink-0">
                <img
                  src="/icon-192x192.png"
                  alt="Kids Call Home"
                  className="w-14 h-14 md:w-16 md:h-16 rounded-xl shadow-md"
                  width="64"
                  height="64"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <InfoIcon className="h-5 w-5 md:h-6 md:w-6 text-primary flex-shrink-0" />
                  <h1 className="text-xl md:text-3xl font-bold truncate">
                    App Information
                  </h1>
                </div>
                <p className="text-sm md:text-base text-muted-foreground line-clamp-2">
                  Important information about Kids Call Home
                </p>
              </div>
              {/* Share Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={handleShare}
                className="flex-shrink-0 h-10 w-10 md:h-11 md:w-11 rounded-full bg-primary/10 hover:bg-primary/20 border-primary/30 text-primary"
                aria-label="Share this page"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </header>

          {/* Navigation */}
          <InfoNavigation
            sections={filteredSections}
            scrollToSection={scrollToSection}
            scrollToTop={scrollToTop}
            sheetOpen={sheetOpen}
            setSheetOpen={setSheetOpen}
            showFloatingNav={showFloatingNav}
            loading={loading}
          />

          {/* Content Sections */}
          <div className="space-y-6 md:space-y-8">
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
          </div>

          {/* Back to Top - Footer */}
          <div className="text-center pt-8 md:pt-12 pb-4">
            <Button variant="outline" size="lg" onClick={scrollToTop}>
              Back to Top
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Info;
