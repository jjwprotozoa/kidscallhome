// src/features/referrals/components/SocialShareButtons.tsx
// Purpose: Social media sharing buttons for referral links with branded marketing messages

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  Facebook,
  Mail,
  MessageCircle,
  Share2,
  Twitter,
} from "lucide-react";

interface SocialShareButtonsProps {
  referralCode: string;
  referralUrl: string;
}

const APP_NAME = "Kids Call Home";
const APP_TAGLINE = "Safe Video Calls for Kids";

// Platform-specific share messages with branding and emojis
const getWhatsAppMessage = (code: string, url: string) => `
📱💚 *${APP_NAME}* – ${APP_TAGLINE}

Hey! I found an amazing app that lets kids video call family safely – no phone number needed! 

✨ *What makes it special:*
• Kids can call grandparents, aunts & uncles anytime
• Parents approve every contact – 100% safe
• Works on any tablet or old phone
• No social media, no strangers

🎁 *Special offer:* Use my code and we BOTH get 1 week FREE!

👉 *My referral code:* ${code}

Sign up here: ${url}

Perfect for keeping the whole family connected! 👨‍👩‍👧‍👦💕
`.trim();

const getTwitterMessage = (code: string) =>
  `📱 Discovered ${APP_NAME} – lets my kids video call grandparents safely! No phone needed, parents control everything.

🎁 Use code ${code} and we both get 1 week FREE!

#KidsCallHome #FamilyTech #ParentingTips`;

const getFacebookQuote = (code: string) =>
  `My kids can now video call their grandparents anytime – safely! 📱💚

${APP_NAME} is a game-changer for family connection. Parents approve every contact, so there's zero worry about strangers.

🎁 Use my referral code ${code} when you sign up and we BOTH get 1 week FREE!

Perfect for:
✅ Kids without their own phone
✅ Staying connected with grandparents
✅ Safe messaging with approved family only

Highly recommend for any family! 👨‍👩‍👧‍👦`;

const getEmailSubject = () =>
  `🏠 ${APP_NAME} – Safe way for kids to video call family (+ 1 week FREE!)`;

const getEmailBody = (code: string, url: string) => `
Hi there! 👋

I wanted to share something that's been wonderful for our family – an app called ${APP_NAME}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱 WHAT IS ${APP_NAME.toUpperCase()}?

It's a safe video calling and messaging app designed specifically for kids. My children can now:

   ✅ Video call grandparents, aunts, uncles & cousins
   ✅ Send messages to approved family members
   ✅ Stay connected – even without their own phone!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛡️ WHY IT'S SAFE

As a parent, I control everything:
   • I approve every single contact
   • No strangers, no social media exposure
   • I can see all messages and calls
   • Works on any tablet or spare phone

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎁 SPECIAL OFFER – 1 WEEK FREE!

Use my referral code when you sign up, and we BOTH get 1 week free on the Family Plan!

   📋 My referral code: ${code}

   🔗 Sign up here:
   ${url}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Family Plan ($14.99/month) covers up to 5 kids and unlimited family members – grandparents, aunts, uncles, everyone!

I genuinely think you'll love it as much as we do. Let me know if you have any questions!

Take care,

P.S. – The free tier lets you try it with 1 parent + 1 child before committing to anything. 🙂
`.trim();

const getNativeShareMessage = (code: string) =>
  `📱 ${APP_NAME} – Safe Video Calls for Kids

Kids can video call grandparents & family safely! Parents control everything.

🎁 Use my code ${code} – we both get 1 week FREE!`;

export const SocialShareButtons = ({
  referralCode,
  referralUrl,
}: SocialShareButtonsProps) => {
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
          text: getNativeShareMessage(referralCode),
          url: referralUrl,
        });
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
      copyToClipboard(referralUrl, "Referral link");
    }
  };

  const openShareWindow = (url: string) => {
    window.open(url, "_blank", "width=600,height=500,noopener,noreferrer");
  };

  const shareToWhatsApp = () => {
    const text = encodeURIComponent(
      getWhatsAppMessage(referralCode, referralUrl)
    );
    openShareWindow(`https://wa.me/?text=${text}`);
  };

  const shareToFacebook = () => {
    const url = encodeURIComponent(referralUrl);
    const quote = encodeURIComponent(getFacebookQuote(referralCode));
    openShareWindow(
      `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`
    );
  };

  const shareToTwitter = () => {
    const text = encodeURIComponent(getTwitterMessage(referralCode));
    const url = encodeURIComponent(referralUrl);
    openShareWindow(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`
    );
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(getEmailSubject());
    const body = encodeURIComponent(getEmailBody(referralCode, referralUrl));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Copy a nicely formatted message with the link
  const copyFullMessage = () => {
    const message = `📱 ${APP_NAME} – ${APP_TAGLINE}

Safe video calls between kids and approved family members – no phone needed!

🎁 Use my referral code: ${referralCode}
We both get 1 week FREE when you subscribe!

👉 Sign up: ${referralUrl}`;

    copyToClipboard(message, "Share message");
  };

  return (
    <div className="space-y-4">
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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

      {/* Quick copy code */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span>Just need the code?</span>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-primary"
          onClick={() => copyToClipboard(referralCode, "Referral code")}
        >
          Copy {referralCode}
        </Button>
      </div>
    </div>
  );
};
