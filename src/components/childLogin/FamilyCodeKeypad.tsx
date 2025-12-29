// src/components/childLogin/FamilyCodeKeypad.tsx
// Purpose: Family code entry keypad with swipe functionality and onboarding hints

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KEYPAD_BLOCKS } from "@/data/childLoginConstants";
import { ChevronLeft, ChevronRight, Delete, Smile, HelpCircle, Sparkles, Keyboard, Grid3x3, Shuffle } from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { KeypadOnboardingHints, useFirstTimeUser } from "./KeypadOnboardingHints";
import { Input } from "@/components/ui/input";

interface FamilyCodeKeypadProps {
  familyCode: string;
  currentBlock: number;
  loading: boolean;
  onFamilyCodeChange: (value: string) => void;
  onBlockChange: (newBlock: number) => void;
  onDelete: () => void;
  onSubmit: () => void;
}

export const FamilyCodeKeypad = ({
  familyCode,
  currentBlock,
  loading,
  onFamilyCodeChange,
  onBlockChange,
  onDelete,
  onSubmit,
}: FamilyCodeKeypadProps) => {
  const navigate = useNavigate();
  const keypadRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const isButtonInteraction = useRef<boolean>(false);
  const buttonTouchStartX = useRef<number>(0);
  const buttonTouchStartTime = useRef<number>(0);

  // Onboarding state
  const { isFirstTime, markAsSeen } = useFirstTimeUser("keypad_hints");
  const [showHints, setShowHints] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showHelpTooltip, setShowHelpTooltip] = useState(false);
  const [useDeviceKeyboard, setUseDeviceKeyboard] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Show hints after a brief delay for first-time users
  useEffect(() => {
    if (isFirstTime && !hasInteracted) {
      const timer = setTimeout(() => setShowHints(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isFirstTime, hasInteracted]);

  // Focus input when switching to device keyboard
  useEffect(() => {
    if (useDeviceKeyboard && inputRef.current) {
      inputRef.current.focus();
    }
  }, [useDeviceKeyboard]);

  // Handle first interaction
  const handleFirstInteraction = useCallback(() => {
    if (!hasInteracted) {
      setHasInteracted(true);
      setShowHints(false);
      markAsSeen();
    }
  }, [hasInteracted, markAsSeen]);

  const currentBlockData = KEYPAD_BLOCKS[currentBlock];
  const isFirstBlock = currentBlock === 0;
  const isLastBlock = currentBlock === KEYPAD_BLOCKS.length - 1;

  const handleBlockChange = (newBlock: number) => {
    if (newBlock >= 0 && newBlock < KEYPAD_BLOCKS.length) {
      handleFirstInteraction();
      onBlockChange(newBlock);
    }
  };

  const handleSwipeStart = (e: React.TouchEvent) => {
    if (isButtonInteraction.current) {
      return;
    }
    touchStartX.current = e.touches[0].clientX;
    touchStartTime.current = Date.now();
  };

  const handleSwipeMove = (e: React.TouchEvent) => {
    if (touchStartX.current === 0) {
      return;
    }
    touchEndX.current = e.touches[0].clientX;
  };

  const handleSwipeEnd = () => {
    if (touchStartX.current === 0 || touchEndX.current === 0) {
      return;
    }

    const swipeDistance = touchStartX.current - touchEndX.current;
    const swipeDuration = Date.now() - touchStartTime.current;
    const minSwipeDistance = 30;
    const maxSwipeDuration = 600;

    const isSignificantSwipe = Math.abs(swipeDistance) > minSwipeDistance;

    if (
      isSignificantSwipe &&
      swipeDuration < maxSwipeDuration &&
      touchStartX.current !== 0 &&
      touchEndX.current !== 0 &&
      (!isButtonInteraction.current || Math.abs(swipeDistance) > 50)
    ) {
      if (swipeDistance > 0) {
        handleBlockChange(Math.min(currentBlock + 1, KEYPAD_BLOCKS.length - 1));
      } else {
        handleBlockChange(Math.max(currentBlock - 1, 0));
      }
    }

    touchStartX.current = 0;
    touchEndX.current = 0;
    touchStartTime.current = 0;
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-primary/5 p-4">
      <Card className="w-full max-w-md p-6 space-y-3 relative overflow-visible">
        {/* Help, Keyboard toggle, and Switch to Parent buttons */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={() => navigate("/parent/auth")}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Switch to Parent"
            title="Switch to Parent Login"
          >
            <Shuffle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
          </button>
          <button
            onClick={() => setUseDeviceKeyboard(!useDeviceKeyboard)}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label={useDeviceKeyboard ? "Use on-screen keypad" : "Use device keyboard"}
            title={useDeviceKeyboard ? "Switch to on-screen keypad" : "Switch to device keyboard"}
          >
            {useDeviceKeyboard ? (
              <Grid3x3 className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
            ) : (
              <Keyboard className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
            )}
          </button>
          <button
            onClick={() => setShowHelpTooltip(!showHelpTooltip)}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Help"
          >
            <HelpCircle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
          </button>
        </div>

        {/* Help tooltip */}
        {showHelpTooltip && (
          <div className="absolute top-14 right-2 z-50 w-64 p-4 bg-card border-2 border-primary/20 rounded-xl shadow-xl animate-fade-in">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Sparkles className="h-4 w-4" />
                <span>How to enter your code:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li><strong>Tap</strong> letters to type your code</li>
                <li><strong>Swipe</strong> or use arrows for more letters</li>
                <li>Enter all <strong>6 characters</strong></li>
                <li>Press <strong>Next</strong> when done!</li>
              </ol>
              <button
                onClick={() => setShowHelpTooltip(false)}
                className="w-full mt-2 text-xs text-primary hover:underline"
              >
                Got it!
              </button>
            </div>
          </div>
        )}

        <div className="text-center space-y-2">
          <Smile className="h-16 w-16 text-primary mx-auto animate-bounce-gentle" />
          <h1 className="text-3xl font-bold text-primary">Hi There!</h1>
          <p className="text-lg">Enter your family code</p>
          
          {/* Enhanced instructions for first-time users */}
          {isFirstTime && !hasInteracted ? (
            <div className="bg-primary/10 rounded-xl p-3 border border-primary/20 animate-fade-in">
              <p className="text-sm text-primary font-medium">
                👆 Tap the letters below to spell your code!
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Need letters like X, Y, Z? Swipe left on the keypad →
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ask a parent for your 6-character family code
            </p>
          )}
        </div>

        <div className="space-y-2">
          {useDeviceKeyboard ? (
            /* Device keyboard input */
            <div className="bg-muted p-4 rounded-2xl">
              <Input
                ref={inputRef}
                type="text"
                value={familyCode}
                onChange={(e) => {
                  const cleaned = e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 6);
                  onFamilyCodeChange(cleaned);
                }}
                placeholder="Enter 6-character code"
                className="text-2xl sm:text-3xl font-bold text-primary font-mono tracking-wider text-center h-16 border-2 border-primary/20"
                maxLength={6}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck="false"
              />
              <p className="text-xs text-muted-foreground text-center mt-2">
                Use your device keyboard to type
              </p>
            </div>
          ) : (
            /* On-screen keypad display */
            <div className="bg-muted p-4 rounded-2xl">
              <div className="flex justify-center">
                <div className="w-full max-w-sm h-16 rounded-xl bg-card flex items-center justify-center border-2 border-primary/20 px-4">
                  <span className="text-2xl sm:text-3xl font-bold text-primary font-mono tracking-wider whitespace-nowrap">
                    {familyCode.padEnd(6, "_")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Block Navigation - only show with on-screen keypad */}
          {!useDeviceKeyboard && (
          <div className="flex items-center justify-between gap-2">
            <Button
              onClick={() => handleBlockChange(currentBlock - 1)}
              disabled={isFirstBlock}
              variant="outline"
              size="sm"
              className={`flex-shrink-0 ${!isFirstBlock && isFirstTime && !hasInteracted ? 'animate-swipe-hint-left' : ''}`}
              aria-label="Previous block"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            {/* Block Indicator Dots with labels */}
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className="flex items-center gap-2 justify-center">
                {KEYPAD_BLOCKS.map((block, index) => (
                  <button
                    key={block.id}
                    onClick={() => handleBlockChange(index)}
                    className={`transition-all duration-200 rounded-full ${
                      index === currentBlock
                        ? "w-3 h-3 bg-primary scale-125"
                        : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                    aria-label={`Go to ${block.label} block`}
                    aria-current={index === currentBlock ? "true" : "false"}
                  />
                ))}
              </div>
              {/* Block labels shown inline */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                {KEYPAD_BLOCKS.map((block, index) => (
                  <span 
                    key={block.id}
                    className={`transition-all ${index === currentBlock ? 'font-bold text-primary' : 'opacity-60'}`}
                  >
                    {block.label}
                  </span>
                ))}
              </div>
            </div>

            <Button
              onClick={() => handleBlockChange(currentBlock + 1)}
              disabled={isLastBlock}
              variant="outline"
              size="sm"
              className={`flex-shrink-0 ${!isLastBlock && isFirstTime && !hasInteracted ? 'animate-swipe-hint-right' : ''}`}
              aria-label="Next block"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          )}

          {!useDeviceKeyboard && (
            <>
              {/* Current block indicator for better visibility */}
              <div className="text-center -mt-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {isFirstTime && !hasInteracted ? (
                    <span className="text-primary">
                      ← Use arrows to find more letters →
                    </span>
                  ) : (
                    <>Now showing: <span className="text-primary font-bold">{currentBlockData.label}</span></>
                  )}
                </p>
              </div>

              {/* Keypad Block */}
              <div
                ref={keypadRef}
                className="relative overflow-hidden"
                style={{ touchAction: "pan-x" }}
              >
            {/* Onboarding hints overlay */}
            {showHints && (
              <KeypadOnboardingHints
                showSwipeHint={true}
                showTapHint={familyCode.length === 0}
                onDismiss={() => setShowHints(false)}
                isFirstBlock={isFirstBlock}
                isLastBlock={isLastBlock}
              />
            )}

            {/* Swipe zones on edges */}
            <div
              className="absolute left-0 top-0 bottom-0 w-16 z-0 pointer-events-auto"
              onTouchStart={handleSwipeStart}
              onTouchMove={handleSwipeMove}
              onTouchEnd={handleSwipeEnd}
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-16 z-0 pointer-events-auto"
              onTouchStart={handleSwipeStart}
              onTouchMove={handleSwipeMove}
              onTouchEnd={handleSwipeEnd}
            />
            {/* Center area with buttons */}
            <div
              className="relative z-10"
              onTouchStart={handleSwipeStart}
              onTouchMove={handleSwipeMove}
              onTouchEnd={handleSwipeEnd}
            >
              {KEYPAD_BLOCKS.map((block, blockIndex) => (
                <div
                  key={block.id}
                  className={`grid grid-cols-3 gap-3 transition-all duration-300 ease-in-out ${
                    blockIndex === currentBlock
                      ? "opacity-100 translate-x-0 pointer-events-auto"
                      : blockIndex < currentBlock
                      ? "opacity-0 -translate-x-full absolute inset-0 pointer-events-none"
                      : "opacity-0 translate-x-full absolute inset-0 pointer-events-none"
                  }`}
                >
                  {block.chars.map((char, charIndex) => {
                    // Highlight first button for first-time users
                    const isFirstButton = blockIndex === 0 && charIndex === 0 && familyCode.length === 0;
                    const shouldPulse = isFirstTime && !hasInteracted && isFirstButton;
                    
                    return (
                      <Button
                        key={char}
                        onClick={() => {
                          handleFirstInteraction();
                          onFamilyCodeChange(familyCode + char);
                        }}
                        onTouchStart={(e) => {
                          buttonTouchStartX.current = e.touches[0].clientX;
                          buttonTouchStartTime.current = Date.now();
                        }}
                        onTouchMove={(e) => {
                          const moveDistance = Math.abs(
                            e.touches[0].clientX - buttonTouchStartX.current
                          );
                          if (moveDistance > 10) {
                            isButtonInteraction.current = false;
                          } else {
                            isButtonInteraction.current = true;
                          }
                        }}
                        onTouchEnd={(e) => {
                          const moveDistance = Math.abs(
                            e.changedTouches[0].clientX - buttonTouchStartX.current
                          );
                          const touchDuration = Date.now() - buttonTouchStartTime.current;

                          if (moveDistance < 10 && touchDuration < 300) {
                            isButtonInteraction.current = true;
                            setTimeout(() => {
                              isButtonInteraction.current = false;
                            }, 100);
                          } else {
                            isButtonInteraction.current = false;
                          }
                        }}
                        onTouchCancel={() => {
                          isButtonInteraction.current = false;
                          buttonTouchStartX.current = 0;
                          buttonTouchStartTime.current = 0;
                        }}
                        size="lg"
                        variant="outline"
                        className={`h-14 sm:h-16 text-xl sm:text-2xl font-bold rounded-xl hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 border-2 pointer-events-auto relative z-10 ${
                          shouldPulse ? 'animate-gentle-pulse border-primary bg-primary/5' : ''
                        }`}
                        disabled={familyCode.length >= 6}
                        aria-label={`Enter ${char}`}
                        style={{
                          touchAction: "manipulation",
                          WebkitTouchCallout: "none",
                          WebkitUserSelect: "none",
                        }}
                      >
                        {char}
                      </Button>
                    );
                  })}
                  {/* Fill empty slots in last row */}
                  {block.chars.length % 3 === 1 && (
                    <>
                      <div className="col-span-1" />
                      <div className="col-span-1" />
                    </>
                  )}
                  {block.chars.length % 3 === 2 && <div className="col-span-1" />}
                </div>
              ))}
            </div>
          </div>
            </>
          )}

          {/* Delete and Next Buttons */}
          <div className="space-y-2 -mt-1">
            <Button
              onClick={onDelete}
              size="lg"
              variant="outline"
              className="w-full h-11 rounded-xl"
              disabled={!familyCode}
            >
              <Delete className="h-4 w-4 mr-2" />
              Delete
            </Button>

            <Button
              onClick={onSubmit}
              disabled={familyCode.length < 3 || loading}
              size="lg"
              className="w-full text-lg h-11 rounded-xl"
            >
              {loading ? "Checking..." : "Next"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

