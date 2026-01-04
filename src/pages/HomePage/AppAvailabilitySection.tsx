// src/pages/HomePage/AppAvailabilitySection.tsx
// App availability section

import { Smartphone, Tablet } from "lucide-react";

export const AppAvailabilitySection = () => {
  return (
    <section className="py-12 md:py-16" aria-labelledby="availability-heading">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2
            id="availability-heading"
            className="text-2xl md:text-3xl font-bold mb-4"
          >
            Available on the web. Mobile apps coming soon.
          </h2>
          <p className="text-base md:text-lg text-muted-foreground mb-8">
            iOS App Store and Google Play support is on the way.
          </p>

          {/* Placeholder badges */}
          <div className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-2 opacity-50">
              <div className="w-32 h-10 bg-muted rounded-lg flex items-center justify-center">
                <Smartphone className="h-6 w-6 text-muted-foreground" />
              </div>
              <span className="text-xs text-muted-foreground">App Store</span>
            </div>
            <div className="flex flex-col items-center gap-2 opacity-50">
              <div className="w-32 h-10 bg-muted rounded-lg flex items-center justify-center">
                <Tablet className="h-6 w-6 text-muted-foreground" />
              </div>
              <span className="text-xs text-muted-foreground">Google Play</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

