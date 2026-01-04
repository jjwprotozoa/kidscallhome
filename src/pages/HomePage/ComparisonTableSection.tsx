// src/pages/HomePage/ComparisonTableSection.tsx
// "Why not just use regular chat or video apps?" comparison section

import { Card } from "@/components/ui/card";

export const ComparisonTableSection = () => {
  const comparisons = [
    {
      category: "Who can contact your child",
      kidsCallHome: "Only family members a parent approves. No one else can find or contact your child.",
      regularApps: "Designed for broad contact lists; can include friends, group invites, or people outside the immediate family unless every setting is locked down.",
    },
    {
      category: "What your child sees",
      kidsCallHome: "Simple family list with clear online status and big 'Call' buttons.",
      regularApps: "Chats, group threads, statuses or stories, media, and sometimes suggested or non-family content.",
    },
    {
      category: "How kids log in",
      kidsCallHome: "Kid-friendly code on a Wi‑Fi device. No phone number or SIM card needed.",
      regularApps: "Often built around phone numbers, email accounts, or full profiles managed by adults.",
    },
    {
      category: "What it's designed for",
      kidsCallHome: "Only for calls and messages with family, not a social network.",
      regularApps: "Designed for broad communication or social networking, often optimized for engagement.",
    },
    {
      category: "Business model",
      kidsCallHome: "No ads, no social feeds, no selling family data.",
      regularApps: "Many big platforms rely on ads or engagement, which can mean features designed to keep people online longer.",
    },
  ];

  return (
    <section className="py-12 md:py-16" aria-labelledby="comparison-heading">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 md:mb-14">
            <h2
              id="comparison-heading"
              className="text-2xl md:text-3xl font-bold mb-4"
            >
              Why not just use regular chat or video apps?
            </h2>
            <div className="w-full flex justify-center">
              <p className="text-lg text-muted-foreground max-w-2xl px-4">
                Most families already use apps like FaceTime, Messenger, WhatsApp, or kids chat apps to stay in touch. Those tools are built for everyone. KidsCallHome is built just for children and their families.
              </p>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="w-full">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="min-w-full">
                {/* Header */}
                <div className="grid grid-cols-3 gap-4 mb-4 pb-2 border-b">
                  <div className="font-semibold text-sm md:text-base"></div>
                  <div className="font-semibold text-sm md:text-base text-primary">KidsCallHome</div>
                  <div className="font-semibold text-sm md:text-base">Regular chat & video apps</div>
                </div>

                {/* Rows */}
                {comparisons.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-3 gap-4 py-4 border-b last:border-b-0"
                  >
                    <div className="font-medium text-sm md:text-base text-foreground">
                      {item.category}
                    </div>
                    <div className="text-sm md:text-base text-muted-foreground">
                      {item.kidsCallHome}
                    </div>
                    <div className="text-sm md:text-base text-muted-foreground">
                      {item.regularApps}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom line - centered under table */}
            <div className="w-full mt-8 flex justify-center">
              <p className="text-center text-base md:text-lg text-foreground font-medium max-w-2xl px-4">
                KidsCallHome is not another social app for kids — it&apos;s a small, closed, family-only space for calls and messages.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

