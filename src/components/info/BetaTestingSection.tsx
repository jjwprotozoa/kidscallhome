// src/components/info/BetaTestingSection.tsx
// Purpose: Beta testing section for Info page

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Star } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const BetaTestingSection = () => {
  const navigate = useNavigate();

  return (
    <section id="beta-testing" className="mb-8 scroll-mt-20">
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Star className="h-5 w-5" />
          Beta Testing Program
        </h2>
        <div className="space-y-4">
          <div>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Help us improve KidsCallHome by joining our beta testing program.
              Beta testers get early access to new features and can provide
              feedback to help shape the future of the app.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              As a beta tester, you'll be able to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
              <li>Try new features before they're released</li>
              <li>Report bugs and provide feedback</li>
              <li>Suggest improvements and new features</li>
              <li>Help us make KidsCallHome better for everyone</li>
            </ul>
            <Button
              onClick={() => navigate("/beta")}
              className="w-full sm:w-auto"
            >
              <Star className="mr-2 h-4 w-4" />
              Join Beta Program
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
};

