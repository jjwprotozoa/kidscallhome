// src/components/childLogin/FamilyCodeKeypad.tsx
// Purpose: Family code entry keypad with swipe functionality

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KEYPAD_BLOCKS } from "@/data/childLoginConstants";
import { ChevronLeft, ChevronRight, Delete, Smile } from "lucide-react";
import { useRef } from "react";

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
  const keypadRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const isButtonInteraction = useRef<boolean>(false);
  const buttonTouchStartX = useRef<number>(0);
  const buttonTouchStartTime = useRef<number>(0);

  const currentBlockData = KEYPAD_BLOCKS[currentBlock];
  const isFirstBlock = currentBlock === 0;
  const isLastBlock = currentBlock === KEYPAD_BLOCKS.length - 1;

  const handleBlockChange = (newBlock: number) => {
    if (newBlock >= 0 && newBlock < KEYPAD_BLOCKS.length) {
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
      <Card className="w-full max-w-md p-6 space-y-3">
        <div className="text-center space-y-2">
          <Smile className="h-16 w-16 text-primary mx-auto" />
          <h1 className="text-3xl font-bold text-primary">Hi There!</h1>
          <p className="text-lg">Enter your family code</p>
          <p className="text-xs text-muted-foreground">
            Ask a parent for your 6-character family code
          </p>
        </div>

        <div className="space-y-2">
          <div className="bg-muted p-4 rounded-2xl">
            <div className="flex justify-center">
              <div className="w-full max-w-sm h-16 rounded-xl bg-card flex items-center justify-center border-2 border-primary/20 px-4">
                <span className="text-2xl sm:text-3xl font-bold text-primary font-mono tracking-wider whitespace-nowrap">
                  {familyCode.padEnd(6, "_")}
                </span>
              </div>
            </div>
          </div>

          {/* Block Navigation */}
          <div className="flex items-center justify-between gap-2">
            <Button
              onClick={() => handleBlockChange(currentBlock - 1)}
              disabled={isFirstBlock}
              variant="outline"
              size="sm"
              className="flex-shrink-0"
              aria-label="Previous block"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            {/* Block Indicator Dots */}
            <div className="flex items-center gap-2 flex-1 justify-center">
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

            <Button
              onClick={() => handleBlockChange(currentBlock + 1)}
              disabled={isLastBlock}
              variant="outline"
              size="sm"
              className="flex-shrink-0"
              aria-label="Next block"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Block Label */}
          <div className="text-center -mt-1">
            <p className="text-xs font-medium text-muted-foreground">
              {currentBlockData.label}
            </p>
          </div>

          {/* Keypad Block */}
          <div
            ref={keypadRef}
            className="relative overflow-hidden"
            style={{ touchAction: "pan-x" }}
          >
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
                  {block.chars.map((char) => (
                    <Button
                      key={char}
                      onClick={() => onFamilyCodeChange(familyCode + char)}
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
                      className="h-14 sm:h-16 text-xl sm:text-2xl font-bold rounded-xl hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 border-2 pointer-events-auto relative z-10"
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
                  ))}
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

