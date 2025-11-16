// src/pages/NetworkError.tsx
// Kid-friendly network error page with animations

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Wifi, WifiOff, RefreshCw } from "lucide-react";

const NetworkError = () => {
  const navigate = useNavigate();

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-secondary/5 via-background to-primary/5 p-4">
      <div className="text-center space-y-8 max-w-md w-full">
        {/* Animated network icon */}
        <div className="relative">
          <div className="text-9xl font-bold text-secondary/20 select-none flex items-center justify-center">
            <WifiOff className="w-32 h-32 text-secondary/30" />
          </div>
          {/* Animated wifi waves */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-40 h-40">
              <div className="absolute inset-0 border-4 border-secondary/20 rounded-full animate-ping" />
              <div className="absolute inset-0 border-4 border-secondary/20 rounded-full animate-ping" style={{ animationDelay: "0.5s" }} />
              <div className="absolute inset-0 border-4 border-secondary/20 rounded-full animate-ping" style={{ animationDelay: "1s" }} />
            </div>
          </div>
        </div>

        {/* Friendly message */}
        <div className="space-y-4 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Oops! No internet connection! 📡
          </h1>
          <p className="text-xl text-muted-foreground">
            It looks like you're not connected to the internet. Check your connection and try again!
          </p>
        </div>

        {/* Animated wifi icon */}
        <div className="flex justify-center">
          <div className="relative">
            <Wifi className="w-24 h-24 text-secondary/30 animate-pulse" />
            <WifiOff className="absolute inset-0 w-24 h-24 text-destructive/30 animate-pulse" style={{ animationDelay: "0.5s" }} />
          </div>
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
          <span className="animate-bounce" style={{ animationDelay: "0s" }}>📡</span>
          <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>🌐</span>
          <span className="animate-bounce" style={{ animationDelay: "0.4s" }}>🔌</span>
        </div>
      </div>
    </div>
  );
};

export default NetworkError;

