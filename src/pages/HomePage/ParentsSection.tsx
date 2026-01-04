// src/pages/HomePage/ParentsSection.tsx
// How It Works for Parents section with CTA and kid-friendly login visual

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Download, Shield, UserPlus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trackPrimaryCTA } from "@/utils/funnelTracking";

export const ParentsSection = () => {
  const navigate = useNavigate();

  return (
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
                <h3 className="font-semibold text-lg mb-1">
                  Create your family space
                </h3>
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
                <h3 className="font-semibold text-lg mb-1">
                  Approve who your child can call
                </h3>
                <p className="text-sm text-muted-foreground">
                  You control every contact. Only approved family members can be
                  called.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Download className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">
                  Kids log in and connect
                </h3>
                <p className="text-sm text-muted-foreground">
                  They enter their code and see big &quot;Call&quot; and &quot;Message&quot;
                  buttons for each family member. One tap!
                </p>
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
                navigate("/parent/auth?mode=signup");
              }}
              aria-label="Get started free - Create your family space"
            >
              <Users className="mr-2 h-5 w-5 md:h-6 md:w-6" aria-hidden="true" />
              Get started free
              <ArrowRight
                className="ml-2 h-5 w-5 md:h-6 md:w-6"
                aria-hidden="true"
              />
            </Button>
          </div>

          {/* Login Code Visual - matches actual login UI */}
          <div className="mb-8">
            <h3 className="text-lg md:text-xl font-semibold text-center mb-4">
              Kid-Friendly Login
            </h3>
            <p className="text-sm text-muted-foreground text-center mb-6">
              No passwords — just pick a color or animal, then a number
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              {/* Color example */}
              <Card className="p-4 text-center hover:shadow-md transition-shadow">
                <div className="w-14 h-14 rounded-xl bg-[#3B82F6] mx-auto mb-3 flex items-center justify-center text-white text-lg font-bold shadow-md">
                  Blue
                </div>
                <div className="font-semibold text-primary mb-1">blue + 7</div>
                <p className="text-xs text-muted-foreground">
                  Pick a color, add a number
                </p>
              </Card>
              {/* Animal example */}
              <Card className="p-4 text-center hover:shadow-md transition-shadow">
                <div className="w-14 h-14 rounded-xl bg-white border-2 border-gray-200 mx-auto mb-3 flex items-center justify-center text-3xl shadow-md">
                  🐱
                </div>
                <div className="font-semibold text-primary mb-1">cat + 23</div>
                <p className="text-xs text-muted-foreground">
                  Or pick an animal instead
                </p>
              </Card>
              {/* Another animal example */}
              <Card className="p-4 text-center hover:shadow-md transition-shadow">
                <div className="w-14 h-14 rounded-xl bg-white border-2 border-gray-200 mx-auto mb-3 flex items-center justify-center text-3xl shadow-md">
                  🐻
                </div>
                <div className="font-semibold text-primary mb-1">bear + 5</div>
                <p className="text-xs text-muted-foreground">
                  Easy for kids to remember
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

