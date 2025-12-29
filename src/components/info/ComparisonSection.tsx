// src/components/info/ComparisonSection.tsx
// Purpose: Comparison section explaining how Kids Call Home differs from alternatives
// Helps answer "Is Kids Call Home safer than FaceTime/WhatsApp/Messenger?" queries

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trackComparisonClick, trackPrimaryCTA } from "@/utils/funnelTracking";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export const ComparisonSection = () => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const ctaVisibleRef = useRef(false);

  // Track when CTA becomes visible in viewport (for AI traffic)
  useEffect(() => {
    if (!sectionRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !ctaVisibleRef.current) {
            ctaVisibleRef.current = true;
            // CTA is now visible - AI users can see it without scrolling
          }
        });
      },
      { threshold: 0.1 }
    );

    const ctaElement = sectionRef.current.querySelector('[data-cta="comparison"]');
    if (ctaElement) {
      observer.observe(ctaElement);
    }

    return () => {
      if (ctaElement) {
        observer.unobserve(ctaElement);
      }
    };
  }, []);

  const comparisons = [
    {
      app: "WhatsApp",
      issues: [
        "Requires phone number (kids' tablets don't have one)",
        "Anyone with your number can contact you",
        "No parent controls over who can message your child",
        "Owned by Meta, collects extensive data for advertising"
      ],
      ourSolution: [
        "Works without phone number or SIM card",
        "Only parent-approved family members can contact kids",
        "Full parent control over all contacts",
        "No data collection for advertising, no selling family data"
      ]
    },
    {
      app: "FaceTime",
      issues: [
        "Requires Apple ID and phone number",
        "Only works on Apple devices",
        "No parent controls—kids can call anyone in their contacts",
        "Requires sharing personal phone numbers"
      ],
      ourSolution: [
        "Works on any device (iPad, Android, Chromebook, etc.)",
        "No phone number needed—works over Wi-Fi",
        "Parents approve every contact before kids can call",
        "No personal phone numbers shared between family members"
      ]
    },
    {
      app: "Messenger Kids",
      issues: [
        "Owned by Meta, collects data for advertising",
        "Allows 'friends of friends' connections",
        "Includes games and entertainment features",
        "Requires Facebook account for parents"
      ],
      ourSolution: [
        "No advertising, no data collection for ads",
        "Zero stranger contact—only family you approve",
        "No games or distractions—just calls and messages",
        "No social media account required"
      ]
    }
  ];

  return (
    <section id="comparison" ref={sectionRef} className="mb-8 scroll-mt-20">
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-2">
          How Kids Call Home Compares
        </h2>
        <p className="text-muted-foreground mb-6">
          Unlike general messaging apps, Kids Call Home is built specifically for 
          family-only communication with kids' safety as the top priority.
        </p>

        <div className="space-y-8">
          {comparisons.map((comparison, index) => (
            <div key={index} className="border-l-4 border-l-primary pl-4">
              <h3 className="text-xl font-semibold mb-4">
                Kids Call Home vs. {comparison.app}
              </h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2 text-red-600 dark:text-red-400">
                    <XCircle className="h-5 w-5" />
                    {comparison.app} Challenges
                  </h4>
                  <ul className="space-y-2">
                    {comparison.issues.map((issue, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-red-500 mt-1">•</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-5 w-5" />
                    How Kids Call Home Helps
                  </h4>
                  <ul className="space-y-2">
                    {comparison.ourSolution.map((solution, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-green-500 mt-1">✓</span>
                        <span>{solution}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Bottom line:</strong> Kids Call Home 
            isn't trying to be a general messaging app. It's purpose-built for one thing: 
            letting kids safely call and message their family, with parents in complete 
            control, on any device, without needing a phone number.
          </p>
        </div>

        {/* Contextual CTA after comparison - for high-intent users */}
        {/* Also visible in viewport for AI traffic landing mid-page */}
        <div 
          className="mt-6 flex flex-col sm:flex-row gap-3 items-center justify-center"
          data-cta="comparison"
        >
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => {
              trackComparisonClick("cta");
              trackPrimaryCTA("Switch safely", "compare", "comparison");
              navigate("/parent/auth");
            }}
          >
            Switch safely
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => {
              trackComparisonClick("see_how");
              trackPrimaryCTA("See how it works", "compare", "comparison");
              navigate("/");
            }}
          >
            See how it works
          </Button>
        </div>
      </Card>
    </section>
  );
};

