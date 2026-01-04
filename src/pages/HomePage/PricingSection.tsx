// src/pages/HomePage/PricingSection.tsx
// Simple, transparent pricing section

export const PricingSection = () => {
  return (
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
          <div className="w-full flex justify-center">
            <p className="text-lg text-muted-foreground max-w-2xl px-4">
              No hidden charges. No surprise fees. Start free and upgrade when
              you're ready.
            </p>
          </div>
        </div>

        {/* Pricing content can be added here when ready */}
      </div>
    </section>
  );
};

