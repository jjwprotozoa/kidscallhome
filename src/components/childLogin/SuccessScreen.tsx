// src/components/childLogin/SuccessScreen.tsx
// Purpose: Success animation screen after successful child login

import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface SuccessScreenProps {
  childName: string;
  avatarColor: string;
}

export const SuccessScreen = ({ childName, avatarColor }: SuccessScreenProps) => {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-primary/5 p-4">
      <Card className="w-full max-w-md p-8 space-y-6 text-center">
        <div className="space-y-4 animate-bounce">
          <div className="flex justify-center">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold text-white shadow-lg"
              style={{ backgroundColor: avatarColor }}
            >
              {childName[0].toUpperCase()}
            </div>
          </div>
          <div className="flex justify-center gap-2">
            <Sparkles className="h-8 w-8 text-yellow-500 animate-pulse" />
            <h1 className="text-4xl font-bold text-primary">Welcome, {childName}!</h1>
            <Sparkles className="h-8 w-8 text-yellow-500 animate-pulse" />
          </div>
          <p className="text-xl text-muted-foreground">You're all set! 🎉</p>
        </div>
      </Card>
    </div>
  );
};

