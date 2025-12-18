// src/components/info/InfoNavigation.tsx
// Purpose: Navigation component for Info page sections
// Mobile: Compact dropdown selector
// Desktop: Horizontal button strip

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ArrowUp, ChevronUp, List } from "lucide-react";

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
}: InfoNavigationProps) => {
  return (
    <>
      {/* Mobile Navigation - Compact Dropdown */}
      <div className="md:hidden sticky top-[64px] z-40 -mx-4 px-4 py-3 bg-background/95 backdrop-blur-sm border-b">
        <Select
          onValueChange={(value) => {
            if (value === "top") {
              scrollToTop();
            } else {
              scrollToSection(value);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <div className="flex items-center gap-2">
              <List className="h-4 w-4" />
              <SelectValue placeholder="Jump to section..." />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="top" className="font-medium">
              <div className="flex items-center gap-2">
                <ArrowUp className="h-4 w-4" />
                Back to Top
              </div>
            </SelectItem>
            <div className="h-px bg-border my-1" />
            {sections.map((section) => (
              <SelectItem key={section.id} value={section.id}>
                {section.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop Navigation - Horizontal Card */}
      <Card className="hidden md:block p-4 mb-6 sticky top-[80px] z-40 bg-background/95 backdrop-blur-sm">
        <div className="flex flex-wrap gap-2 text-sm">
          {sections.map((section) => (
            <Button
              key={section.id}
              variant="ghost"
              size="sm"
              asChild
            >
              <a
                href={`/info#${section.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(section.id);
                }}
              >
                {section.label}
              </a>
            </Button>
          ))}
        </div>
      </Card>

      {/* Floating Navigation - Minimal FAB */}
      {showFloatingNav && (
        <div
          className="fixed z-50 flex flex-col gap-2"
          style={{
            right: "1rem",
            bottom: `calc(1.5rem + var(--safe-area-inset-bottom))`,
          }}
        >
          {/* Mobile: Sheet menu for sections */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                className="h-12 w-12 rounded-full shadow-lg md:hidden"
                aria-label="Open navigation menu"
              >
                <List className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
              <SheetHeader className="pb-2">
                <SheetTitle>Jump to Section</SheetTitle>
              </SheetHeader>
              <div className="space-y-1 overflow-y-auto">
                <Button
                  variant="ghost"
                  className="w-full justify-start h-12 text-base"
                  onClick={scrollToTop}
                >
                  <ArrowUp className="mr-3 h-5 w-5" />
                  Back to Top
                </Button>
                <div className="h-px bg-border my-2" />
                {sections.map((section) => (
                  <Button
                    key={section.id}
                    variant="ghost"
                    className="w-full justify-start h-12 text-base"
                    asChild
                  >
                    <a
                      href={`/info#${section.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        scrollToSection(section.id);
                      }}
                    >
                      {section.label}
                    </a>
                  </Button>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          {/* Back to Top Button */}
          <Button
            onClick={scrollToTop}
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg"
            aria-label="Back to top"
          >
            <ChevronUp className="h-5 w-5" />
          </Button>
        </div>
      )}
    </>
  );
};
