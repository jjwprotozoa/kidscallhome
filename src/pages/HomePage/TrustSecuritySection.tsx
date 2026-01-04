// src/pages/HomePage/TrustSecuritySection.tsx
// Trust & security copy (lightweight, non-technical)

import { Shield, Lock, Eye } from "lucide-react";

export const TrustSecuritySection = () => {
  return (
    <section className="py-12 md:py-16 bg-muted/30" aria-labelledby="security-heading">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h2
            id="security-heading"
            className="text-2xl md:text-3xl font-bold text-center mb-6 md:mb-8"
          >
            Security & privacy
          </h2>

          <div className="space-y-4 text-base md:text-lg text-muted-foreground leading-relaxed mb-8">
            <p>
              KidsCallHome uses standard, best-practice security and privacy measures to protect family communication.
            </p>
            <p>
              We encrypt calls and messages, collect only the minimal data needed to provide the service, and never sell your information. There are no ads, no tracking for advertising, and no manipulative design patterns like infinite feeds, aggressive notifications, or surprise in‑app purchases.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm md:text-base text-muted-foreground">
                Encrypted calls and messages
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm md:text-base text-muted-foreground">
                Minimal data collection
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Eye className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm md:text-base text-muted-foreground">
                No ads or tracking
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

