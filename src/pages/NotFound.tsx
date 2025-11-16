// src/pages/NotFound.tsx
// Kid-friendly 404 error page with animations

import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, Search, Sparkles } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="text-center space-y-8 max-w-md w-full">
        {/* Animated 404 with floating numbers */}
        <div className="relative">
          <div className="text-9xl font-bold text-primary/20 select-none">
            <span className="inline-block animate-bounce" style={{ animationDelay: "0s", animationDuration: "2s" }}>
              4
            </span>
            <span className="inline-block animate-bounce" style={{ animationDelay: "0.2s", animationDuration: "2s" }}>
              0
            </span>
            <span className="inline-block animate-bounce" style={{ animationDelay: "0.4s", animationDuration: "2s" }}>
              4
            </span>
          </div>
          {/* Floating sparkles */}
          <Sparkles className="absolute top-0 left-1/4 w-6 h-6 text-kid-purple animate-pulse" style={{ animationDelay: "0.5s" }} />
          <Sparkles className="absolute top-4 right-1/4 w-5 h-5 text-kid-pink animate-pulse" style={{ animationDelay: "1s" }} />
          <Sparkles className="absolute bottom-0 left-1/3 w-4 h-4 text-kid-green animate-pulse" style={{ animationDelay: "1.5s" }} />
        </div>

        {/* Friendly message */}
        <div className="space-y-4 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Oops! This page went on an adventure! 🗺️
          </h1>
          <p className="text-xl text-muted-foreground">
            We couldn't find the page you're looking for. Maybe it's playing hide and seek?
          </p>
        </div>

        {/* Animated search icon */}
        <div className="flex justify-center">
          <div className="relative">
            <Search className="w-24 h-24 text-primary/30 animate-spin-slow" />
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full animate-ping" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          <Button
            onClick={() => navigate("/")}
            size="lg"
            className="w-full sm:w-auto animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            <Home className="mr-2 h-5 w-5" />
            Go Home
          </Button>
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            size="lg"
            className="w-full sm:w-auto animate-fade-in-up"
            style={{ animationDelay: "0.5s" }}
          >
            Go Back
          </Button>
        </div>

        {/* Fun emoji trail */}
        <div className="flex justify-center gap-4 text-2xl pt-4">
          <span className="animate-bounce" style={{ animationDelay: "0s" }}>🏠</span>
          <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>🌟</span>
          <span className="animate-bounce" style={{ animationDelay: "0.4s" }}>🎈</span>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
