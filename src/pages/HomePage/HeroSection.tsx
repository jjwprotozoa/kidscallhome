// src/pages/HomePage/HeroSection.tsx
// Hero section with emotion-first, dad-first messaging

import { Button } from "@/components/ui/button";
import { Baby, Shield, Eye, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trackPrimaryCTA } from "@/utils/funnelTracking";

interface HeroSectionProps {
  onGetStartedClick?: () => void;
  onKidsLoginClick?: () => void;
}

export const HeroSection = ({ onGetStartedClick, onKidsLoginClick }: HeroSectionProps) => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    trackPrimaryCTA("Get started free", "commit", "hero");
    if (onGetStartedClick) {
      onGetStartedClick();
    } else {
      navigate("/parent/auth?mode=signup");
    }
  };

  const handleKidsLogin = () => {
    if (onKidsLoginClick) {
      onKidsLoginClick();
    } else {
      navigate("/child/login");
    }
  };

  return (
    <section
      className="relative overflow-hidden pt-16 pb-12 sm:pt-20 sm:pb-16 md:pt-24 md:pb-20 lg:pt-32 lg:pb-24 xl:pt-40 xl:pb-32"
      aria-labelledby="hero-heading"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10 -z-10" />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-5 md:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="mx-auto w-full max-w-[65ch] text-center space-y-8 sm:space-y-10 md:space-y-12 lg:space-y-14 xl:space-y-16 2xl:space-y-20">
          {/* Headline */}
          <div className="space-y-4 sm:space-y-5 md:space-y-6 lg:space-y-8 xl:space-y-10">
            <h1
              id="hero-heading"
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-bold leading-[1.15] sm:leading-[1.1] md:leading-[1.05] tracking-tight text-foreground px-2 sm:px-0"
            >
              <span className="block">A safer way for kids</span>
              <span className="block">to call home</span>
            </h1>

            {/* Subheadline */}
            <div className="space-y-3 sm:space-y-4 md:space-y-5 lg:space-y-6 px-2 sm:px-0">
              <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-muted-foreground leading-relaxed max-w-[58ch] mx-auto">
                When kids are on tablets and parents are in different homes or places, even a quick goodnight call can turn into a hassle. KidsCallHome lets your child reach the right parent or grandparent with one tap — without social feeds, random contacts, or online noise.
              </p>

              {/* Emotional problem → solution micro-line */}
              <p className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl text-foreground font-medium max-w-[55ch] mx-auto">
                No more &quot;Can you call Mom or Dad for me?&quot; — your child sees who is available and taps to call.
              </p>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 md:gap-5 lg:gap-6 pt-2 sm:pt-3 md:pt-4 px-2 sm:px-0">
            <Button
              size="lg"
              className="text-sm sm:text-base md:text-lg lg:text-xl px-6 sm:px-8 md:px-10 lg:px-12 xl:px-14 py-5 sm:py-6 md:py-7 lg:py-8 shadow-lg hover:shadow-xl transition-all min-h-[44px] sm:min-h-[48px] md:min-h-[52px] lg:min-h-[56px] w-full sm:w-auto flex-shrink-0"
              onClick={handleGetStarted}
              aria-label="Get started free"
            >
              Get started free
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-sm sm:text-base md:text-lg lg:text-xl px-6 sm:px-8 md:px-10 lg:px-12 xl:px-14 py-5 sm:py-6 md:py-7 lg:py-8 min-h-[44px] sm:min-h-[48px] md:min-h-[52px] lg:min-h-[56px] w-full sm:w-auto border-2 flex-shrink-0"
              onClick={handleKidsLogin}
              aria-label="Let kids log in"
            >
              <Baby className="mr-2 h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 flex-shrink-0" aria-hidden="true" />
              <span className="whitespace-nowrap">Let kids log in</span>
            </Button>
          </div>

          {/* Micro-trust line */}
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground pt-2 sm:pt-3 md:pt-4 px-4 sm:px-0">
            Start with 1 child free. No ads. No public profiles. Cancel any time.
          </p>
        </div>

        {/* Trust indicators - break out of narrow container */}
        <div className="w-full pt-6 sm:pt-8 md:pt-10 lg:pt-12 xl:pt-16">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 md:gap-6 lg:gap-8 xl:gap-10 2xl:gap-12 flex-wrap px-2 sm:px-4">
            <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4">
              <Shield
                className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8 text-green-700 dark:text-green-300 flex-shrink-0"
                aria-hidden="true"
              />
              <span className="text-xs sm:text-sm md:text-base lg:text-lg font-medium text-foreground whitespace-nowrap">
                Family-only contacts
              </span>
            </div>

            <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4">
              <Eye
                className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8 text-green-700 dark:text-green-300 flex-shrink-0"
                aria-hidden="true"
              />
              <span className="text-xs sm:text-sm md:text-base lg:text-lg font-medium text-foreground whitespace-nowrap">
                No strangers, ever
              </span>
            </div>

            <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4">
              <Lock
                className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8 text-green-700 dark:text-green-300 flex-shrink-0"
                aria-hidden="true"
              />
              <span className="text-xs sm:text-sm md:text-base lg:text-lg font-medium text-foreground whitespace-nowrap">
                Parent controlled
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

