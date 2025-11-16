// src/pages/ServerError.tsx
// Kid-friendly 500 server error page with animations

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, RefreshCw, AlertCircle } from "lucide-react";

const ServerError = () => {
  const navigate = useNavigate();

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-destructive/5 via-background to-secondary/5 p-4">
      <div className="text-center space-y-8 max-w-md w-full">
        {/* Animated 500 with alert icon */}
        <div className="relative">
          <div className="text-9xl font-bold text-destructive/20 select-none">
            <span className="inline-block animate-bounce" style={{ animationDelay: "0s", animationDuration: "2s" }}>
              5
            </span>
            <span className="inline-block animate-bounce" style={{ animationDelay: "0.2s", animationDuration: "2s" }}>
              0
            </span>
            <span className="inline-block animate-bounce" style={{ animationDelay: "0.4s", animationDuration: "2s" }}>
              0
            </span>
          </div>
          {/* Alert icon */}
          <AlertCircle className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 text-destructive/40 animate-pulse" />
        </div>

        {/* Friendly message */}
        <div className="space-y-4 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Oops! Something went wrong! 🔧
          </h1>
          <p className="text-xl text-muted-foreground">
            Our servers are taking a little break. Don't worry, we're working on fixing it!
          </p>
        </div>

        {/* Animated gear/refresh icon */}
        <div className="flex justify-center">
          <RefreshCw className="w-24 h-24 text-destructive/30 animate-spin-slow" />
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          <Button
            onClick={handleRefresh}
            size="lg"
            className="w-full sm:w-auto animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            <RefreshCw className="mr-2 h-5 w-5" />
            Try Again
          </Button>
          <Button
            onClick={() => navigate("/")}
            variant="outline"
            size="lg"
            className="w-full sm:w-auto animate-fade-in-up"
            style={{ animationDelay: "0.5s" }}
          >
            <Home className="mr-2 h-5 w-5" />
            Go Home
          </Button>
        </div>

        {/* Fun emoji trail */}
        <div className="flex justify-center gap-4 text-2xl pt-4">
          <span className="animate-bounce" style={{ animationDelay: "0s" }}>🔧</span>
          <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>⚡</span>
          <span className="animate-bounce" style={{ animationDelay: "0.4s" }}>✨</span>
        </div>
      </div>
    </div>
  );
};

export default ServerError;

