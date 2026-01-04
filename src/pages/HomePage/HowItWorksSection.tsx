// src/pages/HomePage/HowItWorksSection.tsx
// Simple visual flow showing how the app works for everyone

import { Baby, Heart, Users } from "lucide-react";

export const HowItWorksSection = () => {
  const steps = [
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
        "Each child picks a color or animal plus a number — like 'blue + 7' or 'cat + 23'. No passwords!",
    },
    {
      step: "3",
      icon: Heart,
      title: "Family Connects",
      description:
        "Kids see big buttons with family names — tap to call or message. Simple as that.",
    },
  ];

  return (
    <section
      className="py-12 md:py-16"
      aria-labelledby="how-it-works-heading"
    >
      <div className="container mx-auto px-4">
        <h2
          id="how-it-works-heading"
          className="text-2xl md:text-3xl font-bold text-center mb-10"
        >
          How It Works for Parents
        </h2>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto text-center">
          {steps.map((item, index) => (
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
  );
};

