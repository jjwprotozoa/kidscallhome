// src/pages/ErrorPage.tsx
// Reusable kid-friendly error page component

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, RefreshCw, LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface ErrorPageProps {
  code?: string | number;
  title: string;
  message: string;
  icon?: LucideIcon;
  showRefresh?: boolean;
  showHome?: boolean;
  onRefresh?: () => void;
  emojis?: string[];
}

const ErrorPage = ({
  code = "?",
  title,
  message,
  icon: Icon,
  showRefresh = false,
  showHome = true,
  onRefresh,
  emojis = ["😊", "🌟", "🎈"],
}: ErrorPageProps) => {
  const navigate = useNavigate();

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="text-center space-y-8 max-w-md w-full">
        {/* Animated error code */}
        <div className="relative">
          <div className="text-9xl font-bold text-primary/20 select-none">
            {String(code)
              .split("")
              .map((char, index) => (
                <span
                  key={index}
                  className="inline-block animate-bounce"
                  style={{
                    animationDelay: `${index * 0.2}s`,
                    animationDuration: "2s",
                  }}
                >
                  {char === " " ? "\u00A0" : char}
                </span>
              ))}
          </div>
          {/* Icon overlay */}
          {Icon && (
            <Icon className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 text-primary/40 animate-pulse" />
          )}
        </div>

        {/* Friendly message */}
        <div className="space-y-4 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">{title}</h1>
          <p className="text-xl text-muted-foreground">{message}</p>
        </div>

        {/* Animated icon */}
        {Icon && (
          <div className="flex justify-center">
            <Icon className="w-24 h-24 text-primary/30 animate-spin-slow" />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          {showRefresh && (
            <Button
              onClick={handleRefresh}
              size="lg"
              className="w-full sm:w-auto animate-fade-in-up"
              style={{ animationDelay: "0.3s" }}
            >
              <RefreshCw className="mr-2 h-5 w-5" />
              Try Again
            </Button>
          )}
          {showHome && (
            <Button
              onClick={() => navigate("/")}
              variant={showRefresh ? "outline" : "default"}
              size="lg"
              className="w-full sm:w-auto animate-fade-in-up"
              style={{ animationDelay: showRefresh ? "0.5s" : "0.3s" }}
            >
              <Home className="mr-2 h-5 w-5" />
              Go Home
            </Button>
          )}
        </div>

        {/* Fun emoji trail */}
        {emojis.length > 0 && (
          <div className="flex justify-center gap-4 text-2xl pt-4">
            {emojis.map((emoji, index) => (
              <span
                key={index}
                className="animate-bounce"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                {emoji}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorPage;

