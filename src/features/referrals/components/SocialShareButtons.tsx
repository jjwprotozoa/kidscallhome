// src/features/referrals/components/SocialShareButtons.tsx
// Purpose: Social media sharing buttons for referral links with branded marketing messages

import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  Facebook,
  Mail,
  MessageCircle,
  Share2,
  Twitter,
} from "lucide-react";
import { detectBrowser } from "@/utils/browserUtils";
import { getReferralShareLink } from "../utils/referralHelpers";
import {
  APP_NAME,
  APP_TAGLINE,
  getWhatsAppMessage,
  getTwitterMessage,
  getFacebookQuote,
  getEmailSubject,
  getEmailBody,
  getNativeShareMessage,
  getGeneralShareMessage,
} from "../utils/shareMessages";

interface SocialShareButtonsProps {
  referralCode: string;
  referralUrl?: string; // Optional - will be generated if not provided
}

export const SocialShareButtons = ({
  referralCode,
  referralUrl: providedUrl,
}: SocialShareButtonsProps) => {
  const { toast } = useToast();
  
  // Use provided URL or generate one with source parameter
  const referralUrl = providedUrl || getReferralShareLink(referralCode, "referrals_page");

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
          text: getNativeShareMessage(referralCode, referralUrl),
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
    try {
      const shareWindow = window.open(url, "_blank", "width=600,height=500,noopener,noreferrer");
      // Check if popup was blocked
      if (!shareWindow || shareWindow.closed || typeof shareWindow.closed === 'undefined') {
        const browser = detectBrowser();
        toast({
          title: "Popup blocked",
          description: (
            <div className="space-y-2">
              <p>To enable social sharing, allow popups for this site:</p>
              <p className="text-xs font-mono bg-background/50 p-2 rounded border">
                {browser.popupInstructions}
              </p>
              <p className="text-xs text-muted-foreground">
                Or click "Copy Link" below to share manually.
              </p>
            </div>
          ),
          variant: "destructive",
          action: (
            <ToastAction
              altText="Copy link"
              onClick={() => copyToClipboard(referralUrl, "Referral link")}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy Link
            </ToastAction>
          ),
          duration: 10000, // Show longer so user can read instructions
        });
      }
    } catch (error) {
      toast({
        title: "Share failed",
        description: "Could not open share window. Please try copying the link instead.",
        variant: "destructive",
        action: (
          <ToastAction
            altText="Copy link"
            onClick={() => copyToClipboard(referralUrl, "Referral link")}
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy Link
          </ToastAction>
        ),
      });
    }
  };

  const shareToWhatsApp = () => {
    const text = encodeURIComponent(
      getWhatsAppMessage(referralCode, referralUrl)
    );
    openShareWindow(`https://wa.me/?text=${text}`);
  };

  const shareToFacebook = async () => {
    // Facebook doesn't support pre-filled text via URL parameters anymore
    // So we copy the message to clipboard and open the share dialog
    const facebookMessage = getFacebookQuote(referralCode, referralUrl);
    
    // Copy message to clipboard
    try {
      await navigator.clipboard.writeText(facebookMessage);
      toast({
        title: "Message copied!",
        description: "Paste it into the Facebook post (the share window will open)",
        duration: 5000,
      });
    } catch {
      // If clipboard fails, still open the share dialog
      toast({
        title: "Opening Facebook...",
        description: "Copy the message manually from the 'Copy Message' button",
      });
    }
    
    // Open Facebook share dialog with just the URL
    const url = encodeURIComponent(referralUrl);
    openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${url}`);
  };

  const shareToTwitter = () => {
    const text = encodeURIComponent(getTwitterMessage(referralCode, referralUrl));
    const url = encodeURIComponent(referralUrl);
    openShareWindow(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`
    );
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(getEmailSubject(referralCode));
    const body = encodeURIComponent(getEmailBody(referralCode, referralUrl));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Copy a nicely formatted message with the link
  const copyFullMessage = () => {
    const message = getGeneralShareMessage(referralCode, referralUrl);
    copyToClipboard(message, "Referral message");
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
          className="bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 border-[#1DA1F2]/30 text-[#1DA1F2] dark:bg-[#1DA1F2]/20 dark:hover:bg-[#1DA1F2]/30 dark:border-[#1DA1F2]/40 dark:text-[#1DA1F2]"
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
