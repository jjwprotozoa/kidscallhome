// src/components/childLogin/MagicLinkPreloader.tsx
// Purpose: Preloading screen for magic link authentication (hides family code)

import { Loader2, Sparkles } from "lucide-react";

export const MagicLinkPreloader = () => {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="text-center space-y-8 max-w-md w-full">
        {/* Animated "Loading" text with bouncing letters */}
        <div className="relative">
          <div className="text-6xl md:text-7xl font-bold text-primary/20 select-none">
            {"Loading".split("").map((char, index) => (
              <span
                key={index}
                className="inline-block animate-bounce"
                style={{
                  animationDelay: `${index * 0.1}s`,
                  animationDuration: "1.5s",
                }}
              >
                {char === " " ? "\u00A0" : char}
              </span>
            ))}
          </div>
          {/* Floating sparkles */}
          <Sparkles
            className="absolute top-0 left-1/4 w-6 h-6 text-kid-purple animate-pulse"
            style={{ animationDelay: "0.5s" }}
          />
          <Sparkles
            className="absolute top-4 right-1/4 w-5 h-5 text-kid-pink animate-pulse"
            style={{ animationDelay: "1s" }}
          />
          <Sparkles
            className="absolute bottom-0 left-1/3 w-4 h-4 text-kid-green animate-pulse"
            style={{ animationDelay: "1.5s" }}
          />
        </div>

        {/* Friendly message */}
        <div className="space-y-4 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Signing you in! 🎉
          </h1>
          <p className="text-xl text-muted-foreground">
            We're getting everything ready for you...
          </p>
        </div>

        {/* Animated loading icon */}
        <div className="flex justify-center">
          <div className="relative">
            <Loader2 className="w-24 h-24 text-primary/30 animate-spin-slow" />
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full animate-ping" />
          </div>
        </div>

        {/* Fun emoji trail */}
        <div className="flex justify-center gap-4 text-2xl pt-4">
          <span className="animate-bounce" style={{ animationDelay: "0s" }}>
            ✨
          </span>
          <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>
            🌟
          </span>
          <span className="animate-bounce" style={{ animationDelay: "0.4s" }}>
            🎈
          </span>
        </div>
      </div>
    </div>
  );
};
