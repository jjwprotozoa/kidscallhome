// src/pages/HomePage/IfThisSoundsFamiliarSection.tsx
// "If this sounds familiar..." problem section

import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export const IfThisSoundsFamiliarSection = () => {
  const problems = [
    {
      problem: "My child has a tablet, but every call still goes through my phone.",
      solution: "Your child logs in with a simple code and sees big \"Call Mom\", \"Call Dad\", \"Call Grandma\" buttons — with a clear indicator of who is available to talk.",
    },
    {
      problem: "I don't want strangers, 'friends of friends', or random invites anywhere near my kid.",
      solution: "Only contacts a parent approves ever appear; there are no public profiles, no search, and no friend requests.",
    },
    {
      problem: "The apps we already use feel too open or distracting for my child.",
      solution: "KidsCallHome removes social feeds, group invites, and sharing features — it is only for simple family calls and messages.",
    },
  ];

  return (
    <section className="py-12 md:py-16" aria-labelledby="familiar-heading">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10 md:mb-14">
          <h2
            id="familiar-heading"
            className="text-2xl md:text-3xl font-bold mb-4"
          >
            If this sounds familiar…
          </h2>
        </div>

        <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {problems.map((item, index) => (
            <Card key={index} className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-primary">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
                    <span
                      className="text-xl"
                      role="img"
                      aria-label="Problem indicator"
                    >
                      😰
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-muted-foreground font-medium">
                      {item.problem}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 pt-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2
                      className="h-5 w-5 text-green-700 dark:text-green-300"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      {item.solution}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

