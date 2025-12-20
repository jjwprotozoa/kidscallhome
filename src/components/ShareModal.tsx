// src/components/ShareModal.tsx
// Purpose: Modal for sharing the app with friends & family via various platforms

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  Facebook,
  Gift,
  Heart,
  Mail,
  MessageCircle,
  Share2,
  Twitter,
} from "lucide-react";

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const APP_NAME = "Kids Call Home";
const APP_TAGLINE = "Safe Video Calls for Kids";
const APP_URL = typeof window !== "undefined" ? window.location.origin : "https://kidscallhome.com";

// Platform-specific share messages
const getWhatsAppMessage = () => `
📱💚 *${APP_NAME}* – ${APP_TAGLINE}

Hey! I found an amazing safe kids messaging app that lets kids video call family safely – no phone number or SIM card needed! 

✨ *What makes it special:*
• Kids can call grandparents, aunts & uncles anytime
• Parents approve every contact – 100% safe, no strangers
• Works on most phones and tablets over Wi‑Fi
• No social media, no filters, no addictive feeds
• Built by a long‑distance parent for real family connection

👉 Check it out: ${APP_URL}

Perfect for keeping the whole family connected! 👨‍👩‍👧‍👦💕
`.trim();

const getTwitterMessage = () =>
  `📱 Discovered ${APP_NAME} – safe kids messaging app that lets my kids video call grandparents safely! No phone number or SIM card needed, parents control everything. No strangers, no filters, no social feeds.

Check it out! #KidsCallHome #FamilyTech #ParentingTips`;

const getFacebookQuote = () =>
  `My kids can now video call their grandparents anytime – safely! 📱💚

${APP_NAME} is a safe kids messaging and family communication app built by a long‑distance parent. Parents approve every contact, so there's zero worry about strangers. No social network features, no filters, no addictive feeds – just real family connection.

Perfect for:
✅ Kids without their own phone or SIM card
✅ Staying connected with grandparents and family
✅ Safe messaging with approved family only
✅ Co‑parents and long‑distance families

Highly recommend for any family! 👨‍👩‍👧‍👦`;

const getEmailSubject = () =>
  `🏠 ${APP_NAME} – Safe way for kids to video call family`;

const getEmailBody = () => `
Hi there! 👋

I wanted to share something that's been wonderful for our family – an app called ${APP_NAME}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱 WHAT IS ${APP_NAME.toUpperCase()}?

It's a safe kids messaging and video calling app built by a long‑distance parent who needed a simple, reliable way for his children to call him from any home, country, or device. The app is designed as a safe kids messenger and family communication tool, not a social network. Children can:

   ✅ Video call grandparents, aunts, uncles & cousins
   ✅ Send messages to approved family members
   ✅ Stay connected – even without their own phone or SIM card!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛡️ WHY IT'S SAFE

Parents control everything:
   • Approve every single contact – no strangers, no public profiles
   • No social media exposure, no filters, no addictive feeds
   • See all messages and calls
   • Works on most phones and tablets over Wi‑Fi or mobile data

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 Check it out:
${APP_URL}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The free plan lets you try it with 1 parent + 1 child before committing to anything!

I genuinely think you'll love it as much as we do. Let me know if you have any questions!

Take care 🙂
`.trim();

const getNativeShareMessage = () =>
  `📱 ${APP_NAME} – Safe Video Calls for Kids

Safe kids messaging app for family-only communication. Kids can video call grandparents & family safely without a phone number or SIM card! Parents control everything. No strangers, no filters, no social feeds.

Check it out!`;

export const ShareModal = ({ open, onOpenChange }: ShareModalProps) => {
  const { toast } = useToast();

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Please copy manually",
        variant: "destructive",
      });
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${APP_NAME} – ${APP_TAGLINE}`,
          text: getNativeShareMessage(),
          url: APP_URL,
        });
        onOpenChange(false);
      } catch (error) {
        // User cancelled or share failed - don't show error for cancellation
        if ((error as Error).name !== "AbortError") {
          toast({
            title: "Share failed",
            description: "Could not share. Try copying the link instead.",
            variant: "destructive",
          });
        }
      }
    } else {
      // Fallback to copy link
      copyToClipboard(APP_URL, "App link");
    }
  };

  const openShareWindow = (url: string) => {
    window.open(url, "_blank", "width=600,height=500,noopener,noreferrer");
  };

  const shareToWhatsApp = () => {
    const text = encodeURIComponent(getWhatsAppMessage());
    openShareWindow(`https://wa.me/?text=${text}`);
  };

  const shareToFacebook = () => {
    const url = encodeURIComponent(APP_URL);
    const quote = encodeURIComponent(getFacebookQuote());
    openShareWindow(
      `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`
    );
  };

  const shareToTwitter = () => {
    const text = encodeURIComponent(getTwitterMessage());
    const url = encodeURIComponent(APP_URL);
    openShareWindow(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`
    );
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(getEmailSubject());
    const body = encodeURIComponent(getEmailBody());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Copy a nicely formatted message with the link
  const copyFullMessage = () => {
    const message = `📱 ${APP_NAME} – ${APP_TAGLINE}

Safe kids messaging and video calling app for family-only communication – no phone number or SIM card needed!

✨ Parents approve every contact
🛡️ No strangers, no filters, no social feeds
📞 Video calls & messaging
🌍 Works on most phones and tablets over Wi‑Fi

👉 Check it out: ${APP_URL}`;

    copyToClipboard(message, "Share message");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            Share with Friends & Family
          </DialogTitle>
          <DialogDescription>
            Help other families discover safe video calling for kids!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Primary Actions */}
          <div className="flex flex-wrap gap-2">
            {/* Native Share (mobile) or Copy Link */}
            <Button
              onClick={handleNativeShare}
              variant="default"
              className="flex-1 min-w-[140px]"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share Link
            </Button>

            <Button
              onClick={copyFullMessage}
              variant="outline"
              className="flex-1 min-w-[140px]"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Message
            </Button>
          </div>

          {/* Social Media Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={shareToWhatsApp}
              variant="outline"
              className="bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30 text-[#25D366] dark:bg-[#25D366]/20 dark:hover:bg-[#25D366]/30 dark:border-[#25D366]/40"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>

            <Button
              onClick={shareToFacebook}
              variant="outline"
              className="bg-[#1877F2]/10 hover:bg-[#1877F2]/20 border-[#1877F2]/30 text-[#1877F2] dark:bg-[#1877F2]/20 dark:hover:bg-[#1877F2]/30 dark:border-[#1877F2]/40"
            >
              <Facebook className="h-4 w-4 mr-2" />
              Facebook
            </Button>

            <Button
              onClick={shareToTwitter}
              variant="outline"
              className="bg-black/5 hover:bg-black/10 border-black/20 text-black dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/30 dark:text-white"
            >
              <Twitter className="h-4 w-4 mr-2" />
              X / Twitter
            </Button>

            <Button
              onClick={shareViaEmail}
              variant="outline"
              className="bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700 dark:bg-orange-950 dark:hover:bg-orange-900 dark:border-orange-800 dark:text-orange-300"
            >
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
          </div>

          {/* Quick copy link */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
            <span>Just need the link?</span>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-primary"
              onClick={() => copyToClipboard(APP_URL, "App link")}
            >
              Copy {APP_URL.replace("https://", "")}
            </Button>
          </div>

          {/* Referral hint */}
          <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-lg border border-purple-200 dark:border-purple-800 mt-2">
            <p className="text-sm text-muted-foreground flex items-start gap-2">
              <Gift className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-foreground">Want referral rewards?</strong>{" "}
                Parents can get a personalized referral link from the Dashboard → Referrals tab to earn free subscription time!
              </span>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};



