// src/pages/HomePage/ProblemsWeSolveSection.tsx
// Benefit-focused section showing problems and solutions

import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export const ProblemsWeSolveSection = () => {
  const problems = [
    {
      emoji: "😰",
      emojiLabel: "Worried face",
      problem: "My child has a tablet, but calling me requires my help every time.",
      solution:
        "Kids log in with a simple code, then see big \"Call Mom\" and \"Send Message\" buttons. One tap to connect. No adult needed.",
    },
    {
      emoji: "😨",
      emojiLabel: "Fearful face",
      problem: "I worry about strangers contacting my child on messaging apps.",
      solution:
        "Kids can ONLY contact family you've approved. No search. No friend requests. No public profiles. No strangers, ever.",
    },
    {
      emoji: "😢",
      emojiLabel: "Sad face",
      problem: "We live in different homes, and staying connected is hard for the kids.",
      solution:
        "Kids can call either parent instantly, from any home, any device. Perfect for co-parenting and shared custody.",
    },
    {
      emoji: "😔",
      emojiLabel: "Pensive face",
      problem: "Grandma lives far away and misses the grandkids terribly.",
      solution:
        "Invite grandparents, aunts, uncles, cousins. Kids see \"Call Grandma\" and \"Message Grandpa\" buttons. One tap to connect.",
    },
    {
      emoji: "😟",
      emojiLabel: "Concerned face",
      problem: "Kids' apps are full of ads, games, and addictive feeds.",
      solution:
        "Zero ads. Zero games. Zero infinite scroll. Just calls and messages with family. That's it.",
    },
    {
      emoji: "😑",
      emojiLabel: "Unamused face",
      problem: "I don't trust big tech apps with my child's data.",
      solution:
        "We collect minimal data, use analytics only to improve the app, never for ads, and never sell your information.",
    },
  ];

  return (
    <section className="py-12 md:py-16" aria-labelledby="problems-heading">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10 md:mb-14 max-w-4xl mx-auto">
          <h2
            id="problems-heading"
            className="text-2xl md:text-3xl font-bold mb-4"
          >
            The Problems We Solve
          </h2>
          <div className="w-full flex justify-center">
            <p className="text-lg text-muted-foreground max-w-2xl px-4">
              Every feature exists because a real family needed it.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {problems.map((item, index) => (
            <Card
              key={index}
              className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-primary"
            >
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
                    <span
                      className="text-xl"
                      role="img"
                      aria-label={item.emojiLabel}
                    >
                      {item.emoji}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400">
                    The Problem
                  </h3>
                </div>
                <p className="text-muted-foreground">"{item.problem}"</p>
                <div className="flex items-start gap-3 pt-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2
                      className="h-5 w-5 text-green-700 dark:text-green-300"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-700 dark:text-green-300">
                      How We Help
                    </h4>
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

