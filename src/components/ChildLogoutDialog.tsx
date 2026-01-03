// src/components/ChildLogoutDialog.tsx
// Purpose: Kid-friendly logout dialog with emoji-based verification
// Makes it easy for kids who want to logout but hard to do accidentally

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";

// Emoji sets for each step - kids must find the "special" emoji
const STEP_CONFIG = [
  {
    title: "Want to leave?",
    subtitle: "Find the door! 🚪",
    targetEmoji: "🚪",
    decoyEmojis: ["🎈", "🌟", "🎨", "🎪", "🎭", "🎯", "🎲", "🎸"],
    bgGradient: "from-purple-500 via-pink-500 to-rose-500",
  },
  {
    title: "Are you sure?",
    subtitle: "Find the wave! 👋",
    targetEmoji: "👋",
    decoyEmojis: ["🌈", "🦋", "🌸", "🍭", "🎀", "💫", "🌺", "🍬"],
    bgGradient: "from-blue-500 via-cyan-500 to-teal-500",
  },
  {
    title: "Bye bye!",
    subtitle: "Tap to leave! 💜",
    targetEmoji: "💜",
    decoyEmojis: ["❤️", "💚", "💙", "🧡", "💛", "🖤", "🤍", "💗"],
    bgGradient: "from-amber-500 via-orange-500 to-red-500",
  },
];

interface ChildLogoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogout: () => void;
}

// Shuffle array helper
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const ChildLogoutDialog = ({
  open,
  onOpenChange,
  onLogout,
}: ChildLogoutDialogProps) => {
  const [step, setStep] = useState(0);
  const [shuffledEmojis, setShuffledEmojis] = useState<string[]>([]);
  const [wrongTap, setWrongTap] = useState(false);
  const [correctTap, setCorrectTap] = useState(false);

  // Shuffle emojis when step changes or dialog opens
  useEffect(() => {
    if (open) {
      const config = STEP_CONFIG[step];
      const allEmojis = [config.targetEmoji, ...config.decoyEmojis];
      setShuffledEmojis(shuffleArray(allEmojis));
      setWrongTap(false);
      setCorrectTap(false);
    }
  }, [step, open]);

  // Reset step when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(0);
    }
  }, [open]);

  const handleEmojiTap = useCallback(
    (emoji: string) => {
      const config = STEP_CONFIG[step];

      if (emoji === config.targetEmoji) {
        // Correct emoji tapped!
        setCorrectTap(true);
        setWrongTap(false);

        setTimeout(() => {
          if (step === 2) {
            // Final step - logout
            onLogout();
            onOpenChange(false);
          } else {
            // Move to next step
            setStep((s) => s + 1);
          }
        }, 400);
      } else {
        // Wrong emoji - give feedback
        setWrongTap(true);
        setTimeout(() => setWrongTap(false), 600);
      }
    },
    [step, onLogout, onOpenChange]
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  if (!open) return null;

  const config = STEP_CONFIG[step];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div
        className={`relative w-full max-w-sm bg-gradient-to-br ${config.bgGradient} rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-300 ${
          wrongTap ? "animate-shake" : ""
        } ${correctTap ? "scale-105" : ""}`}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          aria-label="Cancel"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        {/* Progress dots */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                i < step
                  ? "bg-white"
                  : i === step
                  ? "bg-white scale-125"
                  : "bg-white/40"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="pt-16 pb-8 px-6">
          {/* Title section */}
          <div className="text-center mb-6">
            <h2
              id="logout-title"
              className="text-3xl font-bold text-white mb-2 drop-shadow-lg"
            >
              {config.title}
            </h2>
            <p className="text-xl text-white/90 font-medium">
              {config.subtitle}
            </p>
          </div>

          {/* Emoji grid */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {shuffledEmojis.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                onClick={() => handleEmojiTap(emoji)}
                className={`aspect-square rounded-2xl bg-white/20 hover:bg-white/30 active:scale-95 transition-all duration-150 flex items-center justify-center text-5xl shadow-lg border-2 border-white/30 ${
                  correctTap && emoji === config.targetEmoji
                    ? "bg-green-400/50 border-green-300 scale-110"
                    : ""
                }`}
                style={{
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span
                  className={`transition-transform duration-150 ${
                    correctTap && emoji === config.targetEmoji
                      ? "scale-125"
                      : "hover:scale-110"
                  }`}
                >
                  {emoji}
                </span>
              </button>
            ))}
          </div>

          {/* Hint/feedback area */}
          <div className="text-center">
            {wrongTap ? (
              <p className="text-white/90 text-lg font-medium animate-pulse">
                Oops! Try again! 🔍
              </p>
            ) : (
              <p className="text-white/70 text-base">
                Tap the {config.targetEmoji} emoji
              </p>
            )}
          </div>

          {/* Cancel button */}
          <button
            onClick={handleClose}
            className="w-full mt-6 py-4 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-bold text-lg transition-all active:scale-98 border-2 border-white/30"
          >
            Stay Here! 🏠
          </button>
        </div>

        {/* Decorative sparkles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-1/4 left-1/6 w-2 h-2 bg-white rounded-full animate-ping opacity-60"
            style={{ animationDuration: "2s" }}
          />
          <div
            className="absolute top-1/3 right-1/4 w-1.5 h-1.5 bg-yellow-200 rounded-full animate-ping opacity-60"
            style={{ animationDuration: "2.5s", animationDelay: "0.5s" }}
          />
          <div
            className="absolute bottom-1/4 left-1/4 w-2 h-2 bg-pink-200 rounded-full animate-ping opacity-60"
            style={{ animationDuration: "3s", animationDelay: "1s" }}
          />
        </div>
      </div>

      {/* Add shake animation to global styles */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};




