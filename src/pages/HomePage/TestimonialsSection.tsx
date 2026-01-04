// src/pages/HomePage/TestimonialsSection.tsx
// Social proof section with family testimonials

import { Card } from "@/components/ui/card";
import { Star } from "lucide-react";

export const TestimonialsSection = () => {
  const testimonials = [
    {
      quote:
        "My 4-year-old calls Grandma by herself now. She taps 'Call Grandma' and they're talking!",
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
  ];

  return (
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
          {testimonials.map((testimonial, index) => (
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
  );
};

