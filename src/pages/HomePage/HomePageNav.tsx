// src/pages/HomePage/HomePageNav.tsx
// Fixed top navigation bar for the marketing homepage

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Baby, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface HomePageNavProps {
  onLoginClick?: () => void;
  onGetStartedClick?: () => void;
}

export const HomePageNav = ({ onLoginClick, onGetStartedClick }: HomePageNavProps) => {
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleLogin = () => {
    if (onLoginClick) {
      onLoginClick();
    } else {
      setShowLoginModal(true);
    }
  };

  const handleGetStarted = () => {
    if (onGetStartedClick) {
      onGetStartedClick();
    } else {
      navigate("/parent/auth?mode=signup");
    }
  };

  const handleChildLogin = () => {
    setShowLoginModal(false);
    navigate("/child/login");
  };

  const handleParentLogin = () => {
    setShowLoginModal(false);
    navigate("/parent/auth");
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Left: Logo */}
            <div className="flex items-center gap-3">
              <div className="aspect-square w-8 h-8">
                <picture>
                  <source
                    type="image/webp"
                    srcSet="/icon-96x96.webp 96w, /icon-192x192.webp 192w"
                    sizes="32px"
                  />
                  <source
                    type="image/png"
                    srcSet="/icon-96x96.png 96w, /icon-192x192.png 192w"
                    sizes="32px"
                  />
                  <img
                    src="/icon-96x96.png"
                    alt="KidsCallHome"
                    className="w-full h-full object-contain rounded-lg"
                    width="32"
                    height="32"
                    loading="eager"
                    decoding="async"
                  />
                </picture>
              </div>
              <span className="text-lg font-semibold text-primary">KidsCallHome</span>
            </div>

            {/* Right: Buttons */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleLogin}
                className="text-sm sm:text-base"
              >
                Log in
              </Button>
              <Button
                onClick={handleGetStarted}
                className="text-sm sm:text-base"
              >
                Get started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Login Modal with Two Cards */}
      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent className="max-w-2xl bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
          <div className="p-6">
            <DialogTitle className="text-2xl font-bold text-center mb-6">
              Who is logging in?
            </DialogTitle>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Child Login Card */}
              <Card
                className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
                onClick={handleChildLogin}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Baby className="h-8 w-8 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Child Login</h3>
                    <p className="text-sm text-muted-foreground">
                      Kids log in with their color or animal code to call family
                    </p>
                  </div>
                  <Button className="w-full">
                    Log in as Child
                  </Button>
                </div>
              </Card>

              {/* Parent/Family Member Login Card */}
              <Card
                className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
                onClick={handleParentLogin}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-8 w-8 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      Parent / Family Member
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Parents and family members log in to manage accounts and settings
                    </p>
                  </div>
                  <Button className="w-full">
                    Log in as Parent
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
};

