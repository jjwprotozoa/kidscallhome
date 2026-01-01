// src/components/info/TrustSignalsSection.tsx
// Purpose: Structured trust signals for SEO and AI discovery
// Makes privacy commitments and safety design choices explicit

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trackTrustClick, trackPrimaryCTA, trackConfidenceSignal } from "@/utils/funnelTracking";
import { Lock, Shield, Eye, Database, Ban, Heart, ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export const TrustSignalsSection = () => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const hasTrackedScroll = useRef(false);

  // Track confidence signal when user scrolls past this section
  useEffect(() => {
    if (!sectionRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // If section has scrolled past viewport (is above viewport)
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0 && !hasTrackedScroll.current) {
            hasTrackedScroll.current = true;
            trackConfidenceSignal("scroll_trust");
          }
        });
      },
      { threshold: 0 }
    );

    observer.observe(sectionRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  const trustSignals = [
    {
      icon: Shield,
      title: "Encrypted Communication",
      description: "All calls and messages are encrypted in transit. Your family's conversations are private and secure."
    },
    {
      icon: Eye,
      title: "Minimal Data Collection",
      description: "We only collect data necessary for the service to function. No tracking for advertising, no behavioral profiling."
    },
    {
      icon: Database,
      title: "No Data Selling",
      description: "We never sell your family's data to advertisers, partners, or third parties. Your privacy is not a product."
    },
    {
      icon: Ban,
      title: "No Advertising",
      description: "Zero ads, zero sponsored content, zero distractions. Your child's attention stays on family, not on marketing."
    },
    {
      icon: Lock,
      title: "Parent-Controlled Contacts",
      description: "Only family members you explicitly approve can contact your child. No exceptions, no workarounds."
    },
    {
      icon: Heart,
      title: "Designed for Kids",
      description: "Built with children's safety and well-being as the primary concern, not engagement metrics or revenue."
    }
  ];

  return (
    <section id="trust" ref={sectionRef} className="mb-8 scroll-mt-20">
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-2">
          Our Privacy & Safety Commitment
        </h2>
        <p className="text-muted-foreground mb-6">
          These aren't marketing promises—they're design decisions built into every 
          part of Kids Call Home. We believe your family's privacy and safety should 
          be non-negotiable.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          {trustSignals.map((signal, index) => (
            <div
              key={index}
              className="flex gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex-shrink-0">
                <signal.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">{signal.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {signal.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-semibold mb-2">What We Don't Collect</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Location data (except when you explicitly enable location sharing for safety)</li>
            <li>Browsing history or activity outside the app</li>
            <li>Contact lists from your device</li>
            <li>Biometric data (we don't use face recognition or fingerprint scanning)</li>
            <li>Behavioral data for advertising or profiling</li>
            <li>Third-party tracking cookies or pixels</li>
          </ul>
        </div>

        {/* Contextual CTA after trust signals - for hesitant parents */}
        {/* Also visible in viewport for AI traffic landing mid-page */}
        <div className="mt-6 flex justify-center" data-cta="trust">
          <Button
            size="lg"
            onClick={() => {
              trackTrustClick("cta");
              trackPrimaryCTA("Create a family space", "trust", "trust");
              navigate("/parent/auth");
            }}
          >
            Create a family space
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </Card>
    </section>
  );
};

