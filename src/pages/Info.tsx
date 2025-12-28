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
import { ReferralsSection } from "@/components/info/ReferralsSection";
import { SecuritySection } from "@/components/info/SecuritySection";
import { TermsSection } from "@/components/info/TermsSection";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { infoSections } from "@/data/infoSections";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { safeLog, sanitizeError } from "@/utils/security";
import { HelpCircle, Info as InfoIcon, Share2 } from "lucide-react";
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

            <section id="referrals">
              <ReferralsSection isParent={isParent} />
            </section>

            {/* SEO-friendly FAQ block (optional: could be moved into its own component) */}
            <section id="faq" className="mb-8 scroll-mt-20">
              <Card className="p-6">
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Frequently Asked Questions
                </h2>
                <div className="space-y-4">
                <div>
                  <h3 className="font-medium">
                    How can my child call me from a tablet without a SIM card?
                  </h3>
                  <p>
                    Kids Call Home works perfectly on tablets, iPads, Kindle Fire, and
                    Chromebooks over Wi‑Fi without needing a SIM card or phone number. Your
                    child simply opens the app, enters their login code, and can call
                    approved family members. Parents control all contacts, so only family
                    members you approve can connect with your child.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">
                    Is this app safer than typical kids messaging apps?
                  </h3>
                  <p>
                    Yes. Kids Call Home is designed specifically for family-only
                    communication. Unlike many kids messaging apps, there are no public
                    profiles, no search features, no friend requests from strangers, and no
                    &quot;friends of friends&quot; connections. Only parent-approved family members
                    can contact your child. The app uses encrypted communication, collects
                    minimal data, does not show ads, and does not sell family data to
                    advertisers or partners.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">
                    How does Kids Call Home protect my child&apos;s privacy?
                  </h3>
                  <p>
                    Kids Call Home uses encrypted calls and messages to protect your
                    family&apos;s communication. The app collects minimal data necessary for the
                    service to function, does not use tracking for advertising purposes, and
                    does not sell family data. There are no manipulative design patterns
                    like infinite feeds, aggressive notifications, or surprise in‑app
                    purchases. Parents have full control over who can contact their child.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">
                    Can my child use this to call both parents in different homes?
                  </h3>
                  <p>
                    Yes. Kids Call Home is built for co‑parents and long‑distance family. Your
                    child can easily call both parents, grandparents, and other approved
                    family members across different homes and even different countries.
                    Parents control which family members are approved, making it ideal for
                    shared custody situations and international families.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">
                    Does Kids Call Home work on iPads and tablets?
                  </h3>
                  <p>
                    Yes. Kids Call Home works great on iPads, Android tablets, Kindle Fire,
                    and Chromebooks. It works over Wi‑Fi without needing a SIM card or phone
                    number, making it perfect for kids who don&apos;t have their own phone. The
                    app is also available as a Progressive Web App (PWA), so it can be added
                    to the home screen like a native app.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">
                    Are there ads or in‑app purchases in Kids Call Home?
                  </h3>
                  <p>
                    No. Kids Call Home has no ads, no in‑app purchases, and no manipulative
                    design features. The app is designed to be a simple, safe communication
                    tool for families, not a platform for engagement or monetization. Your
                    child&apos;s attention stays on connecting with family, not on games, feeds,
                    or notifications designed to keep them online longer.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">
                    Does my child need a password to use Kids Call Home?
                  </h3>
                  <p>
                    Kids Call Home supports simple magic links so children can tap once to log
                    in from trusted devices instead of remembering complex usernames or
                    passwords. Parents control where and how these links are used.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">
                    Does Kids Call Home include filters or games?
                  </h3>
                  <p>
                    No. Kids Call Home is focused on real connection between kids and family,
                    so there are no face filters, social feeds or games. When your child
                    calls, you see their real face and hear their real voice.
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
              </Card>
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
