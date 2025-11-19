// src/components/info/InfoNavigation.tsx
// Purpose: Navigation component for Info page sections

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ArrowUp, Home, Menu } from "lucide-react";

interface Section {
  id: string;
  label: string;
}

interface InfoNavigationProps {
  sections: Section[];
  scrollToSection: (id: string) => void;
  scrollToTop: () => void;
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
  showFloatingNav: boolean;
  onBackToApp?: () => void;
  backButtonTitle?: string;
  loading?: boolean;
}

export const InfoNavigation = ({
  sections,
  scrollToSection,
  scrollToTop,
  sheetOpen,
  setSheetOpen,
  showFloatingNav,
  onBackToApp,
  backButtonTitle,
  loading = false,
}: InfoNavigationProps) => {
  return (
    <>
      {/* Quick Navigation */}
      <Card className="p-4 mb-6 sticky top-4 z-10 bg-background/95 backdrop-blur-sm">
        <div className="flex flex-wrap gap-2 text-sm">
          {sections.map((section) => (
            <Button
              key={section.id}
              variant="ghost"
              size="sm"
              onClick={() => scrollToSection(section.id)}
            >
              {section.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Floating Navigation Buttons */}
      {showFloatingNav && !loading && (
        <div
          className="fixed right-6 z-50 flex flex-col gap-2"
          style={{
            bottom: `calc(1.5rem + var(--safe-area-inset-bottom))`,
          }}
        >
          {/* Back to App Button */}
          {onBackToApp && (
            <Button
              onClick={onBackToApp}
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg"
              aria-label="Back to App"
              title={backButtonTitle}
            >
              <Home className="h-6 w-6" />
            </Button>
          )}
          
          {/* Navigation Menu Button */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                size="lg"
                className="h-14 w-14 rounded-full shadow-lg"
                aria-label="Open navigation menu"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>Navigate to Section</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-2">
                {sections.map((section) => (
                  <Button
                    key={section.id}
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => scrollToSection(section.id)}
                  >
                    {section.label}
                  </Button>
                ))}
                <div className="pt-4 border-t mt-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={scrollToTop}
                  >
                    <ArrowUp className="mr-2 h-4 w-4" />
                    Back to Top
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}
    </>
  );
};

