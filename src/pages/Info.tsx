// src/pages/Info.tsx
// App Store / Play Store compliance information page
// Mobile-first design with responsive navigation and SEO-friendly copy

import { AboutMissionSection } from "@/components/info/AboutMissionSection";
import { AppDescription } from "@/components/info/AppDescription";
import { BetaTestingSection } from "@/components/info/BetaTestingSection";
import { CancellationSection } from "@/components/info/CancellationSection";
import { ComparisonSection } from "@/components/info/ComparisonSection";
import { ContactSection } from "@/components/info/ContactSection";
import { DataRemovalSection } from "@/components/info/DataRemovalSection";
import { DemoSection } from "@/components/info/DemoSection";
import { ExpandedFAQ } from "@/components/info/ExpandedFAQ";
import { InfoNavigation } from "@/components/info/InfoNavigation";
import { PricingSection } from "@/components/info/PricingSection";
import { PrivacySection } from "@/components/info/PrivacySection";
import { ReferralsSection } from "@/components/info/ReferralsSection";
import { SecuritySection } from "@/components/info/SecuritySection";
import { SEOHead } from "@/components/SEOHead";
import { TermsSection } from "@/components/info/TermsSection";
import { TrustSignalsSection } from "@/components/info/TrustSignalsSection";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { infoSections } from "@/data/infoSections";
import { useToast } from "@/hooks/use-toast";
import { trackPageView, trackConfidenceSignal } from "@/utils/funnelTracking";
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
    const shareTitle = "Kids Call Home – App Information & Safety Details";
    const shareText =
      "Learn how Kids Call Home helps kids safely call and message parents and family on almost any device, without phone numbers or social media.";

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast({
            title: "Share failed",
            description: "Could not share. Try copying the link instead.",
            variant: "destructive",
          });
        }
      }
    } else {
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
  // Lazy-load Supabase only when needed to avoid loading on marketing page
  useEffect(() => {
    const determineUserType = async () => {
      try {
        // Check child session first (no Supabase needed)
        const childSession = localStorage.getItem("childSession");
        if (childSession) {
          try {
            JSON.parse(childSession);
            setUserType("child");
            setLoading(false);
            return;
          } catch {
            // Invalid child session, continue
          }
        }

        // Only load Supabase if we detect a stored session
        const hasStoredSession = typeof window !== 'undefined' &&
          Object.keys(localStorage).some(key => key.startsWith('sb-') || key.includes('supabase'));

        if (!hasStoredSession) {
          setUserType(null);
          setLoading(false);
          return;
        }

        // Lazy import Supabase only when we detect a stored session
        const { supabase } = await import("@/integrations/supabase/client");

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user) {
            const { data: familyMember } = await supabase
              .from("family_members")
              .select("id")
              .eq("id", user.id)
              .eq("status", "active")
              .maybeSingle();

            if (familyMember) {
              setUserType("family_member");
            } else {
              const { data: adultProfile } = await supabase
                .from("adult_profiles" as never)
                .select("role")
                .eq("user_id", user.id)
                .eq("role", "family_member")
                .maybeSingle();

              if (adultProfile) {
                setUserType("family_member");
              } else {
                setUserType("parent");
              }
            }
          } else {
            setUserType("parent");
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

  // Check if user is likely a parent
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
      setShowFloatingNav(scrollY > 200);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll to section and update URL hash
  const scrollToSection = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 140;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition =
        elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      window.history.replaceState(null, "", `/info#${id}`);
      setSheetOpen(false);
    }
  }, []);

  // Handle initial hash on page load and hash changes
  useEffect(() => {
    const hash = location.hash.replace("#", "");
    if (hash) {
      const timeoutId = setTimeout(() => {
        scrollToSection(hash);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [location.hash, scrollToSection]);

  // Track page view and time-based confidence signal
  useEffect(() => {
    if (!loading) {
      trackPageView("info");

      // Track confidence signal after 90 seconds on page
      const timeTracker = setTimeout(() => {
        trackConfidenceSignal("time_on_page");
      }, 90000); // 90 seconds

      return () => clearTimeout(timeTracker);
    }
  }, [loading]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.history.replaceState(null, "", "/info");
    setSheetOpen(false);
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 w-full overflow-x-hidden">
      <SEOHead
        title="App Information & Safety - Complete Guide"
        description="Complete guide to Kids Call Home. Learn about safety features, privacy policy, pricing, supported devices, and how we protect your family's communication."
        path="/info"
      />
      <Navigation />
      <div
        className="px-4 pb-8 md:pb-12"
        style={{
          paddingTop: "calc(0.5rem + 64px + var(--safe-area-inset-top) * 0.15)",
        }}
      >
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <header className="py-4 md:py-6">
            <div className="flex items-center gap-3 md:gap-4">
              {/* App Icon */}
              <div className="flex-shrink-0">
                <img
                  src="/icon-192x192.png"
                  alt="Kids Call Home – Safe calls and messaging for kids and family"
                  className="w-14 h-14 md:w-16 md:h-16 rounded-xl shadow-md"
                  width="64"
                  height="64"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <InfoIcon className="h-5 w-5 md:h-6 md:w-6 text-primary flex-shrink-0" />
                  <h1 className="text-xl md:text-3xl font-bold truncate">
                    App Information & Safety
                  </h1>
                </div>
                <p className="text-sm md:text-base text-muted-foreground line-clamp-3">
                  Learn how Kids Call Home helps kids safely call and message
                  parents and family on most phones and tablets, without a phone
                  number, social media account, or passwords to remember.
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

            {/* Brief intro - detailed content moved to About section */}
            <div className="mt-4 md:mt-5 text-sm md:text-base text-muted-foreground">
              <p>
                Comprehensive information about Kids Call Home, including our mission,
                safety commitments, technical details, and legal information. For a
                quick overview of features and benefits, visit our{" "}
                <a href="/" className="text-primary hover:underline">homepage</a>.
              </p>
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
            {/* About & Mission - NEW: Distinct content not on homepage */}
            <AboutMissionSection />

            {/* Comparison - NEW: How we compare to alternatives */}
            <ComparisonSection />

            {/* Trust Signals - NEW: Structured privacy commitments */}
            <TrustSignalsSection />

            {/* App Description - Technical/compliance focused */}
            <section id="overview">
              <AppDescription />
            </section>

            {/* Expanded FAQ - Replaces duplicate FAQ */}
            <ExpandedFAQ />

            <section id="beta">
              <BetaTestingSection />
            </section>

            <section id="pricing">
              <PricingSection isParent={isParent} />
            </section>

            <section id="terms">
              <TermsSection />
            </section>

            {userType !== "child" && (
              <section id="privacy">
                <PrivacySection />
              </section>
            )}

            <section id="security">
              <SecuritySection />
            </section>

            <section id="cancellation">
              <CancellationSection isParent={isParent} />
            </section>

            <section id="data-removal">
              <DataRemovalSection />
            </section>

            <section id="contact">
              <ContactSection />
            </section>

            <section id="demo">
              <DemoSection />
            </section>

            <section id="referrals">
              <ReferralsSection isParent={isParent} />
            </section>

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
