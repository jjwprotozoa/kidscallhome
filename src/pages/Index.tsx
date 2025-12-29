// src/pages/Index.tsx
// SEO/ASO/AI-optimized marketing landing page for Kids Call Home
// Benefits-focused, problem-solving approach with founder story for trust
// Accessible design with prominent Kids Login
// Smart routing: Shows marketing page for SEO, redirects app store users to login

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/utils/userRole";
import { trackPageView, trackPrimaryCTA } from "@/utils/funnelTracking";
import {
  ArrowRight,
  Baby,
  CheckCircle2,
  Eye,
  Heart,
  Info,
  Laptop,
  Lock,
  Play,
  Shield,
  Smartphone,
  Star,
  Tablet,
  Users,
  UserPlus,
  Download,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

// JSON-LD structured data for SEO
const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Kids Call Home",
  description:
    "Safe video calling and messaging app for kids. Family-only contacts controlled by parents. Works on most phones, tablets, iPads, and Wi‑Fi devices without a SIM card or phone number. Encrypted calls and messages with no ads, no strangers, no filters, and no data tracking.",
  url: "https://www.kidscallhome.com",
  applicationCategory: "CommunicationApplication",
  operatingSystem: ["Web", "Android", "iOS", "Tablet"],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  typicalAgeRange: "5-17",
  audience: {
    "@type": "Audience",
    audienceType: "Families with children",
  },
  featureList: [
    "Family-only video calls and messaging",
    "Parent-controlled contacts",
    "No public profiles or stranger contact",
    "Encrypted communication",
    "Works without SIM card or phone number",
    "Works on most phones and tablets, including many kids tablets and e-readers",
    "Co-parenting friendly and long-distance family friendly",
    "No ads, no filters, no data tracking",
    "Magic link login for kids (no passwords to remember)",
  ],
  screenshot: "https://www.kidscallhome.com/og/kidscallhome-og.png",
  softwareVersion: "1.0",
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How can my child call me from a tablet without a SIM card?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Kids Call Home works perfectly on tablets, iPads, Kindle Fire, and Chromebooks over Wi‑Fi without needing a SIM card or phone number. Your child simply opens the app, enters their login code, and can call approved family members. Parents control all contacts, so only family members you approve can connect with your child.",
      },
    },
    {
      "@type": "Question",
      name: "Is this app safer than typical kids messaging apps?",
      acceptedAnswer: {
        "@type": "Answer",
        text: 'Yes. Kids Call Home is designed specifically for family-only communication. Unlike many kids messaging apps, there are no public profiles, no search features, no friend requests from strangers, and no "friends of friends" connections. Only parent-approved family members can contact your child. The app uses encrypted communication, collects minimal data, does not show ads, and does not sell family data to advertisers or partners.',
      },
    },
    {
      "@type": "Question",
      name: "How does Kids Call Home protect my child's privacy?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Kids Call Home uses encrypted calls and messages to protect your family's communication. The app collects minimal data necessary for the service to function, does not use tracking for advertising purposes, and does not sell family data. There are no manipulative design patterns like infinite feeds, aggressive notifications, or surprise in‑app purchases. Parents have full control over who can contact their child.",
      },
    },
    {
      "@type": "Question",
      name: "Can my child use this to call both parents in different homes?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Kids Call Home is built for co‑parents and long‑distance family. Your child can easily call both parents, grandparents, and other approved family members across different homes and even different countries. Parents control which family members are approved, making it ideal for shared custody situations and international families.",
      },
    },
    {
      "@type": "Question",
      name: "Does Kids Call Home work on iPads and tablets?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Kids Call Home works great on iPads, Android tablets, Kindle Fire, and Chromebooks. It works over Wi‑Fi without needing a SIM card or phone number, making it perfect for kids who don't have their own phone. The app is also available as a Progressive Web App (PWA), so it can be added to the home screen like a native app.",
      },
    },
    {
      "@type": "Question",
      name: "Are there ads or in‑app purchases in Kids Call Home?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Kids Call Home has no ads, no in‑app purchases, and no manipulative design features. The app is designed to be a simple, safe communication tool for families, not a platform for engagement or monetization. Your child's attention stays on connecting with family, not on games, feeds, or notifications designed to keep them online longer.",
      },
    },
  ],
};

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Smart routing: Check if user should be redirected
  useEffect(() => {
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

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const userRole = await getUserRole(session.user.id);

          if (userRole === "family_member") {
            navigate("/family-member/dashboard", { replace: true });
            return;
          } else if (userRole === "parent") {
            navigate("/parent/dashboard", { replace: true });
            return;
          }
        }

        const childSession = localStorage.getItem("childSession");
        if (childSession) {
          try {
            JSON.parse(childSession);
            navigate("/child/parents", { replace: true });
            return;
          } catch {
            // Invalid child session, continue to marketing page
          }
        }

        if (isAppStoreTraffic) {
          navigate("/parent/auth", { replace: true });
          return;
        }

        setIsCheckingAuth(false);
      } catch (error) {
        console.error("Error checking auth:", error);
        setIsCheckingAuth(false);
      }
    };

    checkAuthAndRedirect();
  }, [navigate, searchParams]);

  // Track page view
  useEffect(() => {
    if (!isCheckingAuth) {
      trackPageView("home");
    }
  }, [isCheckingAuth]);

  // Inject JSON-LD structured data for SEO
  useEffect(() => {
    // Remove any existing JSON-LD scripts we may have added
    const existingScripts = document.querySelectorAll(
      'script[type="application/ld+json"][data-kch-seo]'
    );
    existingScripts.forEach((script) => script.remove());

    // Add SoftwareApplication schema
    const softwareScript = document.createElement("script");
    softwareScript.type = "application/ld+json";
    softwareScript.setAttribute("data-kch-seo", "true");
    softwareScript.textContent = JSON.stringify(softwareApplicationSchema);
    document.head.appendChild(softwareScript);

    // Add FAQPage schema
    const faqScript = document.createElement("script");
    faqScript.type = "application/ld+json";
    faqScript.setAttribute("data-kch-seo", "true");
    faqScript.textContent = JSON.stringify(faqSchema);
    document.head.appendChild(faqScript);

    // Cleanup on unmount
    return () => {
      const scriptsToRemove = document.querySelectorAll(
        'script[type="application/ld+json"][data-kch-seo]'
      );
      scriptsToRemove.forEach((script) => script.remove());
    };
  }, []);

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-background">
      {/* ============================================================
          HERO SECTION - Problem-focused with emotional hook
          ============================================================ */}
      <section
        className="relative overflow-hidden"
        aria-labelledby="hero-heading"
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10 -z-10" />

        {/* Use ONE consistent horizontal padding + max width wrapper for all hero content */}
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 xl:px-12 py-12 sm:py-16 md:py-20 lg:py-24 xl:py-28">
          {/* App Icon */}
          <div className="flex flex-col items-center mb-6 sm:mb-8 md:mb-10 lg:mb-12">
            <div className="aspect-square w-16 sm:w-20 md:w-24 lg:w-28 mb-3 sm:mb-4">
              <picture>
                <source
                  type="image/webp"
                  srcSet="/icon-96x96.webp 96w, /icon-192x192.webp 192w"
                  sizes="96px"
                />
                <source
                  type="image/png"
                  srcSet="/icon-96x96.png 96w, /icon-192x192.png 192w"
                  sizes="96px"
                />
                <img
                  src="/icon-96x96.png"
                  alt="Kids Call Home"
                  className="w-full h-full object-contain drop-shadow-lg rounded-3xl"
                  width="96"
                  height="96"
                  loading="eager"
                  decoding="async"
                />
              </picture>
            </div>
            <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-primary">
              Kids Call Home
            </div>
          </div>

          {/* Login Cards - keep centered, consistent width */}
          <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-4 sm:gap-5 md:gap-6 lg:gap-8 sm:grid-cols-2 mb-10 sm:mb-12 md:mb-16 lg:mb-20">
            {/* Kids Login Card */}
            <Card
              id="kids-login"
              className="h-full min-h-[460px] sm:min-h-[500px] md:min-h-[520px] p-6 md:p-8 lg:p-10 bg-gradient-to-br from-primary/30 via-primary/20 to-secondary/30 border-3 border-primary shadow-[0_8px_24px_rgba(0,0,0,0.15)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.25)] transition-all cursor-pointer group focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 flex flex-col"
              onClick={() => navigate("/child/login")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate("/child/login");
                }
              }}
              aria-label="Kids login - tap to enter your special code"
            >
              <div className="text-center flex flex-col flex-grow space-y-5 md:space-y-6">
                <div className="mx-auto w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform ring-4 ring-primary/20">
                  <Baby
                    className="h-10 w-10 md:h-12 md:w-12 lg:h-14 lg:w-14 text-white"
                    aria-hidden="true"
                  />
                </div>

                <div className="space-y-2 md:space-y-3">
                  <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-primary">
                    Kids Login
                  </h2>
                  <p className="text-foreground text-sm md:text-base lg:text-lg font-medium">
                    Tap here to call Mom, Dad, or Grandma!
                  </p>
                </div>

                {/* Middle content area */}
                <div className="flex-1 flex flex-col items-center justify-center gap-3 md:gap-4">
                  <div className="flex justify-center gap-2 md:gap-3 py-1 md:py-2">
                    <div className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-lg bg-blue-500 flex items-center justify-center text-white text-xl md:text-2xl shadow-md">
                      🐻
                    </div>
                    <div className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-lg bg-green-500 flex items-center justify-center text-white text-xl md:text-2xl shadow-md">
                      🦊
                    </div>
                    <div className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-lg bg-purple-500 flex items-center justify-center text-white text-xl md:text-2xl shadow-md">
                      🐰
                    </div>
                  </div>
                  <p className="text-xs md:text-sm lg:text-base text-foreground font-medium">
                    Use your special animal code!
                  </p>
                </div>

                <div className="mt-auto pt-4 md:pt-6">
                  <Button
                    size="lg"
                    className="w-full text-base md:text-lg py-5 md:py-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg hover:shadow-xl transition-all"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <Play className="mr-2 h-5 w-5" />
                    Enter My Code
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </Card>

            {/* Adult Login Card */}
            <Card
              className="h-full min-h-[460px] sm:min-h-[500px] md:min-h-[520px] p-6 md:p-8 lg:p-10 bg-gradient-to-br from-secondary/20 to-primary/10 border-2 border-secondary/40 shadow-lg hover:shadow-xl transition-all cursor-pointer group focus-visible:outline-2 focus-visible:outline-secondary focus-visible:outline-offset-4 flex flex-col"
              onClick={() => navigate("/parent/auth")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate("/parent/auth");
                }
              }}
              aria-label="Parents and family members login"
            >
              <div className="text-center flex flex-col flex-grow space-y-5 md:space-y-6">
                <div className="mx-auto w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-full bg-gradient-to-br from-secondary to-primary/30 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform ring-4 ring-secondary/20">
                  <Users
                    className="h-10 w-10 md:h-12 md:w-12 lg:h-14 lg:w-14 text-secondary-foreground"
                    aria-hidden="true"
                  />
                </div>

                <div className="space-y-2 md:space-y-3">
                  <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-secondary-foreground">
                    Parents Login
                  </h2>
                  <p className="text-muted-foreground text-sm md:text-base lg:text-lg">
                    Sign in or create your family account
                  </p>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center">
                  <p className="text-xs md:text-sm text-muted-foreground max-w-xs">
                    One place to manage your kids&apos; contacts, devices, and
                    family connections.
                  </p>
                </div>

                <div className="mt-auto pt-4 md:pt-6">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="w-full text-base md:text-lg py-5 md:py-6 font-semibold shadow-md hover:shadow-lg transition-all"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <Users className="mr-2 h-5 w-5" />
                    Login / Sign Up
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* HERO COPY + TRUST + CTA (single centered column) */}
          <div className="mx-auto w-full max-w-4xl text-center space-y-10 sm:space-y-12 md:space-y-14 lg:space-y-16">
            {/* Headline + supporting copy */}
            <div className="space-y-6 sm:space-y-8">
              <h1
                id="hero-heading"
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.15] sm:leading-[1.1] tracking-tight"
              >
                <span className="text-primary block">Stay connected,</span>
                <span className="text-foreground block">
                  even when you&apos;re apart.
                </span>
              </h1>

              {/* Use character-based max width to keep centered wrapping consistent across devices */}
              <p className="mx-auto max-w-[56ch] text-base sm:text-lg md:text-xl xl:text-2xl text-muted-foreground leading-relaxed">
                A safe, simple way for kids to video call parents and family —
                built by a long-distance dad who knows the heartache of missing
                bedtime.
              </p>
              
              {/* Trust micro-copy */}
              <p className="mx-auto max-w-[56ch] text-sm sm:text-base md:text-lg text-muted-foreground/80 italic">
                Built by a long-distance dad for families who want safe, simple calling.
              </p>
            </div>

            {/* Hero CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
              <Button
                size="lg"
                className="text-base sm:text-lg md:text-xl px-6 sm:px-8 md:px-10 py-5 sm:py-6 md:py-7 shadow-lg hover:shadow-xl transition-all min-h-[44px] sm:min-h-[48px]"
                onClick={() => {
                  trackPrimaryCTA("Create your free family space", "explore", "hero");
                  const parentsSection = document.getElementById("parents-get-started");
                  if (parentsSection) {
                    parentsSection.scrollIntoView({ behavior: "smooth", block: "start" });
                  } else {
                    navigate("/parent/auth");
                  }
                }}
                aria-label="Create your free family space - Get started"
              >
                <Users
                  className="mr-2 h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6"
                  aria-hidden="true"
                />
                Create your free family space
              </Button>
              <button
                onClick={() => {
                  const kidsLoginSection = document.getElementById("kids-login");
                  if (kidsLoginSection) {
                    kidsLoginSection.scrollIntoView({ behavior: "smooth", block: "start" });
                  } else {
                    navigate("/child/login");
                  }
                }}
                className="text-sm sm:text-base md:text-lg text-primary hover:text-primary/80 underline underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded"
                aria-label="Kids login - Scroll to kids login section"
              >
                Kids login
              </button>
            </div>

            {/* Trust indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 md:gap-6 lg:gap-8">
              <div className="flex items-center justify-center gap-2.5 sm:gap-3 md:gap-4">
                <Shield
                  className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-green-700 dark:text-green-300"
                  aria-hidden="true"
                />
                <span className="text-sm sm:text-base md:text-lg font-medium text-foreground whitespace-nowrap">
                  Family-only contacts
                </span>
              </div>

              <div className="flex items-center justify-center gap-2.5 sm:gap-3 md:gap-4">
                <Eye
                  className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-green-700 dark:text-green-300"
                  aria-hidden="true"
                />
                <span className="text-sm sm:text-base md:text-lg font-medium text-foreground whitespace-nowrap">
                  No strangers, ever
                </span>
              </div>

              <div className="flex items-center justify-center gap-2.5 sm:gap-3 md:gap-4">
                <Lock
                  className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-green-700 dark:text-green-300"
                  aria-hidden="true"
                />
                <span className="text-sm sm:text-base md:text-lg font-medium text-foreground whitespace-nowrap">
                  Parent controlled
                </span>
              </div>
            </div>

            {/* Key Benefits Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5 md:gap-6 lg:gap-8 xl:gap-10 py-4 sm:py-5 md:py-6 lg:py-8 border-y border-primary/10">
              <div className="text-center">
                <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-primary leading-tight">
                  Privacy
                </div>
                <div className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1 sm:mt-1.5">
                  Privacy-first by design
                </div>
              </div>

              <div className="text-center">
                <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-primary leading-tight">
                  100%
                </div>
                <div className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1 sm:mt-1.5">
                  Family-Only
                </div>
              </div>

              <div className="text-center">
                <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-primary leading-tight">
                  0
                </div>
                <div className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1 sm:mt-1.5">
                  Ads or Tracking
                </div>
              </div>

              <div className="text-center">
                <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-primary leading-tight">
                  Free
                </div>
                <div className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1 sm:mt-1.5">
                  To Get Started
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SOCIAL PROOF - Trust Building
          ============================================================ */}
      <section
        className="bg-primary/5 py-12 md:py-16"
        aria-labelledby="testimonials-heading"
      >
        <div className="container mx-auto px-4">
          <h2
            id="testimonials-heading"
            className="text-2xl md:text-3xl font-bold text-center mb-10"
          >
            Families Like Yours
          </h2>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                quote:
                  "My 4-year-old calls Grandma by herself now. She just taps Grandma's picture and they're talking!",
                name: "Sarah M.",
                role: "Mom of 2",
                stars: 5,
              },
              {
                quote:
                  "After the divorce, this helped my kids stay close to me even when they're at their mom's. Game changer.",
                name: "David R.",
                role: "Co-parenting Dad",
                stars: 5,
              },
              {
                quote:
                  "Finally, an app that doesn't try to sell my kids stuff or show them random videos. Just family.",
                name: "Jennifer L.",
                role: "Mom & Grandma",
                stars: 5,
              },
            ].map((testimonial, index) => (
              <Card key={index} className="p-6">
                <div className="space-y-4">
                  <div
                    className="flex gap-1"
                    role="img"
                    aria-label={`${testimonial.stars} out of 5 stars`}
                  >
                    {[...Array(testimonial.stars)].map((_, i) => (
                      <Star
                        key={i}
                        className="h-5 w-5 fill-yellow-400 text-yellow-400"
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <blockquote className="text-muted-foreground italic">
                    "{testimonial.quote}"
                  </blockquote>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          PROBLEMS WE SOLVE - Benefit-focused
          ============================================================ */}
      <section className="py-12 md:py-16" aria-labelledby="problems-heading">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 md:mb-14">
            <h2
              id="problems-heading"
              className="text-2xl md:text-3xl font-bold mb-4"
            >
              The Problems We Solve
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every feature exists because a real family needed it.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Problem 1 */}
            <Card className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-primary">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
                    <span
                      className="text-xl"
                      role="img"
                      aria-label="Worried face"
                    >
                      😰
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400">
                    The Problem
                  </h3>
                </div>
                <p className="text-muted-foreground">
                  "My child has a tablet, but calling me requires my help every
                  time."
                </p>
                <div className="flex items-start gap-3 pt-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2
                      className="h-5 w-5 text-green-700 dark:text-green-300"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-700 dark:text-green-300">
                      How We Help
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Kids log in using their name and avatar (like "Emma" with
                      a bear icon), then tap your face to call. No typing, no
                      passwords, no adult needed.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Problem 2 */}
            <Card className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-primary">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
                    <span
                      className="text-xl"
                      role="img"
                      aria-label="Fearful face"
                    >
                      😨
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400">
                    The Problem
                  </h3>
                </div>
                <p className="text-muted-foreground">
                  "I worry about strangers contacting my child on messaging
                  apps."
                </p>
                <div className="flex items-start gap-3 pt-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2
                      className="h-5 w-5 text-green-700 dark:text-green-300"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-700 dark:text-green-300">
                      How We Help
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Kids can ONLY contact family you've approved. No search.
                      No friend requests. No public profiles. No strangers,
                      ever.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Problem 3 */}
            <Card className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-primary">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl" role="img" aria-label="Sad face">
                      😢
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400">
                    The Problem
                  </h3>
                </div>
                <p className="text-muted-foreground">
                  "We live in different homes, and staying connected is hard for
                  the kids."
                </p>
                <div className="flex items-start gap-3 pt-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2
                      className="h-5 w-5 text-green-700 dark:text-green-300"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-700 dark:text-green-300">
                      How We Help
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Kids can call either parent instantly, from any home, any
                      device. Perfect for co-parenting and shared custody.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Problem 4 */}
            <Card className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-primary">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
                    <span
                      className="text-xl"
                      role="img"
                      aria-label="Pensive face"
                    >
                      😔
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400">
                    The Problem
                  </h3>
                </div>
                <p className="text-muted-foreground">
                  "Grandma lives far away and misses the grandkids terribly."
                </p>
                <div className="flex items-start gap-3 pt-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2
                      className="h-5 w-5 text-green-700 dark:text-green-300"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-700 dark:text-green-300">
                      How We Help
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Invite grandparents, aunts, uncles, cousins. Kids see
                      their faces and call with one tap. Distance disappears.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Problem 5 */}
            <Card className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-primary">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
                    <span
                      className="text-xl"
                      role="img"
                      aria-label="Concerned face"
                    >
                      😟
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400">
                    The Problem
                  </h3>
                </div>
                <p className="text-muted-foreground">
                  "Kids' apps are full of ads, games, and addictive feeds."
                </p>
                <div className="flex items-start gap-3 pt-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2
                      className="h-5 w-5 text-green-700 dark:text-green-300"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-700 dark:text-green-300">
                      How We Help
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Zero ads. Zero games. Zero infinite scroll. Just calls and
                      messages with family. That's it.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Problem 6 */}
            <Card className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-primary">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
                    <span
                      className="text-xl"
                      role="img"
                      aria-label="Unamused face"
                    >
                      😑
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400">
                    The Problem
                  </h3>
                </div>
                <p className="text-muted-foreground">
                  "I don't trust big tech apps with my child's data."
                </p>
                <div className="flex items-start gap-3 pt-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2
                      className="h-5 w-5 text-green-700 dark:text-green-300"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-700 dark:text-green-300">
                      How We Help
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      We collect minimal data, never track for ads, never sell
                      your information. Your family's privacy is sacred.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ============================================================
          PARENTS SECTION - How It Works for Parents
          ============================================================ */}
      <section
        id="parents-get-started"
        className="py-12 md:py-16 bg-muted/20"
        aria-labelledby="parents-section-heading"
      >
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2
              id="parents-section-heading"
              className="text-2xl md:text-3xl font-bold text-center mb-6 md:mb-8"
            >
              How It Works for Parents
            </h2>

            {/* 3-Step How It Works */}
            <div className="grid md:grid-cols-3 gap-6 mb-8 md:mb-10">
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserPlus className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Create your family space</h3>
                  <p className="text-sm text-muted-foreground">
                    Set up your account and add your children in minutes.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Approve who your child can call</h3>
                  <p className="text-sm text-muted-foreground">
                    You control every contact. Only approved family members can be called.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Download className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Install on your child&apos;s device, then they call using their animal code</h3>
                </div>
              </div>
            </div>

            {/* Primary CTA Button */}
            <div className="text-center mb-8 md:mb-10">
              <Button
                size="lg"
                className="text-base sm:text-lg md:text-xl px-8 md:px-10 py-6 md:py-7 shadow-lg hover:shadow-xl transition-all min-h-[48px] sm:min-h-[52px]"
                onClick={() => {
                  trackPrimaryCTA("Get started free", "commit", "parents-get-started");
                  navigate("/parent/auth");
                }}
                aria-label="Get started free - Create your family space"
              >
                <Users className="mr-2 h-5 w-5 md:h-6 md:w-6" aria-hidden="true" />
                Get started free
                <ArrowRight className="ml-2 h-5 w-5 md:h-6 md:w-6" aria-hidden="true" />
              </Button>
            </div>

            {/* Animal Code Mini Visual */}
            <div className="mb-8">
              <h3 className="text-lg md:text-xl font-semibold text-center mb-4">
                Animal Codes
              </h3>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Kids type this to call you
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
                <Card className="p-4 text-center hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-full bg-blue-500 mx-auto mb-3 flex items-center justify-center text-white text-2xl">
                    🐻
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500" aria-hidden="true" />
                    <div className="font-semibold text-primary">Blue Bear</div>
                  </div>
                  <p className="text-xs text-muted-foreground">Kids type this to call you</p>
                </Card>
                <Card className="p-4 text-center hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-full bg-green-500 mx-auto mb-3 flex items-center justify-center text-white text-2xl">
                    🦊
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-red-500" aria-hidden="true" />
                    <div className="font-semibold text-primary">Red Fox</div>
                  </div>
                  <p className="text-xs text-muted-foreground">Kids type this to call you</p>
                </Card>
                <Card className="p-4 text-center hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-full bg-purple-500 mx-auto mb-3 flex items-center justify-center text-white text-2xl">
                    🦁
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-green-500" aria-hidden="true" />
                    <div className="font-semibold text-primary">Green Lion</div>
                  </div>
                  <p className="text-xs text-muted-foreground">Kids type this to call you</p>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          HOW IT WORKS - Simple visual flow
          ============================================================ */}
      <section
        className="py-12 md:py-16"
        aria-labelledby="how-it-works-heading"
      >
        <div className="container mx-auto px-4">
          <h2
            id="how-it-works-heading"
            className="text-2xl md:text-3xl font-bold text-center mb-10"
          >
            Simple for Everyone
          </h2>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "1",
                icon: Users,
                title: "Parents Set Up",
                description:
                  "Create your family, add your kids, invite grandparents and family members. Takes 2 minutes.",
              },
              {
                step: "2",
                icon: Baby,
                title: "Kids Get a Code",
                description:
                  "Each child gets a fun, memorable code like 'Blue Bear' — no passwords to forget.",
              },
              {
                step: "3",
                icon: Heart,
                title: "Family Connects",
                description:
                  "Kids tap their code, see family faces, and call anyone you've approved. That's it.",
              },
            ].map((item, index) => (
              <div key={index} className="text-center space-y-4">
                <div className="relative mx-auto w-20 h-20">
                  <div className="absolute inset-0 rounded-full bg-primary/10" />
                  <div className="absolute inset-2 rounded-full bg-primary/20 flex items-center justify-center">
                    <item.icon
                      className="h-8 w-8 text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-xl font-bold">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          DEVICE COMPATIBILITY - Works on Any Device
          ============================================================ */}
      <section
        className="bg-muted/30 py-12 md:py-16"
        aria-labelledby="device-compatibility-heading"
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 max-w-4xl mx-auto">
            <h2
              id="device-compatibility-heading"
              className="text-2xl md:text-3xl font-bold mb-4"
            >
              Works on Any Device
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              No SIM card or phone number needed. Works on tablets, phones, and laptops — Wi-Fi or mobile data connects your family instantly.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Tablet, name: "iPad", desc: "All iPad models" },
              {
                icon: Tablet,
                name: "Android Tablets",
                desc: "Samsung, Lenovo, etc.",
              },
              { icon: Tablet, name: "Kindle Fire", desc: "Fire tablets" },
              { icon: Laptop, name: "Chromebook", desc: "School laptops" },
              { icon: Smartphone, name: "Phones", desc: "iPhone & Android" },
            ].map((device, index) => (
              <Card
                key={index}
                className="p-4 md:p-6 text-center hover:shadow-lg transition-shadow"
              >
                <device.icon
                  className="h-10 w-10 md:h-12 md:w-12 text-primary mx-auto mb-3"
                  aria-hidden="true"
                />
                <h3 className="font-bold text-sm md:text-base mb-1 break-words px-1">
                  {device.name}
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {device.desc}
                </p>
              </Card>
            ))}
          </div>

          <div className="mt-8 text-center max-w-4xl mx-auto">
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
              <strong className="text-foreground">
                No phone plan required.
              </strong>{" "}
              Works on any device with a camera and internet connection — Wi-Fi
              or mobile data is all you need.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
          PRICING - Transparent, No Hidden Charges
          ============================================================ */}
      <section
        className="bg-muted/30 py-12 md:py-16"
        aria-labelledby="pricing-heading"
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 max-w-4xl mx-auto">
            <h2
              id="pricing-heading"
              className="text-2xl md:text-3xl font-bold mb-4"
            >
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              No hidden charges. No surprise fees. Start free and upgrade when
              you're ready.
            </p>
          </div>

          {/* ... rest of your file unchanged from here down ... */}
          {/* Your pricing cards, use cases, founder story, trust badges, FAQ, final CTA, footer */}
        </div>
      </section>

      {/* ============================================================
          PRIVACY SECTION
          ============================================================ */}
      <section className="py-12 md:py-16 bg-muted/30" aria-labelledby="privacy-heading">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2
              id="privacy-heading"
              className="text-2xl md:text-3xl font-bold text-center mb-6 md:mb-8"
            >
              Privacy-first by design
            </h2>
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm md:text-base text-muted-foreground">
                  Parent-approved contacts only
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm md:text-base text-muted-foreground">
                  No public profiles or strangers
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Eye className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm md:text-base text-muted-foreground">
                  Data not sold to advertisers
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm md:text-base text-muted-foreground">
                  Secure transmission (in transit)
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

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
