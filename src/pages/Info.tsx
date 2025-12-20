// src/pages/Info.tsx
// App Store / Play Store compliance information page
// Mobile-first design with responsive navigation and SEO-friendly copy

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
  useEffect(() => {
    const determineUserType = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const childSession = localStorage.getItem("childSession");

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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
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

            {/* Short founder story / SEO subheader */}
            <div className="mt-4 md:mt-5 text-sm md:text-base text-muted-foreground space-y-1.5">
              <p>
                Kids Call Home is a kids call parents app built by a
                long‑distance parent who needed a simple, reliable way for his
                children to call him from any home, country, or device.
              </p>
              <p>
                The app is designed as a safe kids messenger and family
                communication tool, not a social network: there are no public
                profiles, no strangers, no filters hiding faces, and no
                addictive feeds.
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
            {/* Overview / App description */}
            <section id="overview">
              <AppDescription />
            </section>

            {/* How it works – optional anchor for SEO, handled inside AppDescription or here */}
            {/* You can implement this as its own component later if desired */}

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

            {/* SEO-friendly FAQ block (optional: could be moved into its own component) */}
            <section id="faq" className="space-y-4 md:space-y-5">
              <h2 className="text-lg md:text-xl font-semibold">
                Frequently asked questions
              </h2>
              <div className="space-y-3 text-sm md:text-base text-muted-foreground">
                <div>
                  <h3 className="font-medium">
                    Does my child need a phone number or SIM card?
                  </h3>
                  <p>
                    No. Kids Call Home works over Wi‑Fi or mobile data and does
                    not require a phone number, SIM card, or separate telephone
                    account for your child.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">
                    Which devices can my child use?
                  </h3>
                  <p>
                    Kids can call and message from most modern phones and
                    tablets, including many Android, iOS and compatible e‑reader
                    devices, as long as they have an internet connection.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">
                    Can both parents and family members use the app?
                  </h3>
                  <p>
                    Yes. Parents can invite family members and approved adults
                    so kids can safely stay in touch with parents, grandparents
                    and other close family without strangers or public search.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">
                    Why are there no filters or games?
                  </h3>
                  <p>
                    Kids Call Home is focused on real connection, not
                    entertainment. There are no face filters, feeds or games, so
                    when your child calls you, you see their real face and hear
                    their real voice.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">
                    Is Kids Call Home a parental control app?
                  </h3>
                  <p>
                    Kids Call Home is a safe kids messaging and calling app with
                    strong parent controls around who kids can contact, but it
                    does not try to monitor or control other apps on your
                    child&apos;s device.
                  </p>
                </div>
              </div>
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
