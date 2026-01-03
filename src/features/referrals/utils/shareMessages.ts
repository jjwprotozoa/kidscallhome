// src/features/referrals/utils/shareMessages.ts
// Purpose: Centralized share message generation for all platforms (referral and non-referral)

const APP_NAME = "Kids Call Home";
const APP_TAGLINE = "Safe Video Calls for Kids";
const APP_URL = typeof window !== "undefined" ? window.location.origin : "https://kidscallhome.com";

/**
 * Generates WhatsApp share message
 * Note: No emojis to prevent encoding issues across platforms
 */
export const getWhatsAppMessage = (referralCode?: string, referralUrl?: string): string => {
  const url = referralUrl || APP_URL;
  
  if (referralCode && referralUrl) {
    return `
*${APP_NAME}* – ${APP_TAGLINE}

Hey! I found an amazing app that lets kids video call family safely – no phone number needed! 

*What makes it special:*
• Kids can call grandparents, aunts & uncles anytime
• Parents approve every contact – 100% safe
• Works on any tablet or old phone
• No social media, no strangers

*Special offer:* Use my code when you subscribe to the Family Plan and we BOTH get 1 week FREE!

*My referral code:* ${referralCode}

Sign up here: ${url}

Perfect for keeping the whole family connected!
`.trim();
  }
  
  return `
*${APP_NAME}* – ${APP_TAGLINE}

Hey! I found an amazing safe kids messaging app that lets kids video call family safely – no phone number or SIM card needed! 

*What makes it special:*
• Kids can call grandparents, aunts & uncles anytime
• Parents approve every contact – 100% safe, no strangers
• Works on most phones and tablets over Wi‑Fi
• No social media, no filters, no addictive feeds
• Built by a long‑distance parent for real family connection

Check it out: ${url}

Perfect for keeping the whole family connected!
`.trim();
};

/**
 * Generates Twitter/X share message
 * Note: Using minimal emojis for better compatibility across platforms
 */
export const getTwitterMessage = (referralCode?: string, referralUrl?: string): string => {
  const url = referralUrl || APP_URL;
  
  if (referralCode && referralUrl) {
    return `Discovered ${APP_NAME} – lets my kids video call grandparents safely! No phone needed, parents control everything.

Use code ${referralCode} when you subscribe to the Family Plan and we both get 1 week FREE!

Sign up here: ${url}

#KidsCallHome #FamilyTech #ParentingTips`;
  }
  
  return `Discovered ${APP_NAME} – safe kids messaging app that lets my kids video call grandparents safely! No phone number or SIM card needed, parents control everything. No strangers, no filters, no social feeds.

Check it out: ${url}

#KidsCallHome #FamilyTech #ParentingTips`;
};

/**
 * Generates Facebook share quote
 * Note: Using minimal emojis for better compatibility - Facebook may not render complex emojis
 */
export const getFacebookQuote = (referralCode?: string, referralUrl?: string): string => {
  const url = referralUrl || APP_URL;
  
  if (referralCode && referralUrl) {
    return `My kids can now video call their grandparents anytime – safely!

${APP_NAME} is a game-changer for family connection. Parents approve every contact, so there's zero worry about strangers.

Special offer: Use my referral code ${referralCode} when you subscribe to the Family Plan and we BOTH get 1 week FREE!

Sign up here: ${url}

Perfect for:
- Kids without their own phone
- Staying connected with grandparents
- Safe messaging with approved family only

Highly recommend for any family!`;
  }
  
  return `My kids can now video call their grandparents anytime – safely!

${APP_NAME} is a safe kids messaging and family communication app built by a long‑distance parent. Parents approve every contact, so there's zero worry about strangers. No social network features, no filters, no addictive feeds – just real family connection.

Check it out: ${url}

Perfect for:
- Kids without their own phone or SIM card
- Staying connected with grandparents and family
- Safe messaging with approved family only
- Co‑parents and long‑distance families

Highly recommend for any family!`;
};

/**
 * Generates email subject
 * Note: No emojis in subject line for better email client compatibility
 */
export const getEmailSubject = (referralCode?: string): string => {
  return referralCode
    ? `${APP_NAME} – Safe way for kids to video call family (+ 1 week FREE!)`
    : `${APP_NAME} – Safe way for kids to video call family`;
};

/**
 * Generates email body
 */
export const getEmailBody = (referralCode?: string, referralUrl?: string): string => {
  const url = referralUrl || APP_URL;
  
  if (referralCode && referralUrl) {
    return `
Hi there!

I wanted to share something that's been wonderful for our family – an app called ${APP_NAME}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT IS ${APP_NAME.toUpperCase()}?

It's a safe video calling and messaging app designed specifically for kids. My children can now:

   • Video call grandparents, aunts, uncles & cousins
   • Send messages to approved family members
   • Stay connected – even without their own phone!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHY IT'S SAFE

As a parent, I control everything:
   • I approve every single contact
   • No strangers, no social media exposure
   • I can see all messages and calls
   • Works on any tablet or spare phone

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SPECIAL OFFER – 1 WEEK FREE!

Use my referral code when you subscribe to the Family Plan, and we BOTH get 1 week free!

   My referral code: ${referralCode}

   Sign up here:
   ${url}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Family Plan ($14.99/month) covers up to 5 kids and unlimited family members – grandparents, aunts, uncles, everyone!

I genuinely think you'll love it as much as we do. Let me know if you have any questions!

Take care,

P.S. – The free tier lets you try it with 1 parent + 1 child before committing to anything.
`.trim();
  }
  
  return `
Hi there!

I wanted to share something that's been wonderful for our family – an app called ${APP_NAME}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT IS ${APP_NAME.toUpperCase()}?

It's a safe kids messaging and video calling app built by a long‑distance parent who needed a simple, reliable way for his children to call him from any home, country, or device. The app is designed as a safe kids messenger and family communication tool, not a social network. Children can:

   • Video call grandparents, aunts, uncles & cousins
   • Send messages to approved family members
   • Stay connected – even without their own phone or SIM card!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHY IT'S SAFE

Parents control everything:
   • Approve every single contact – no strangers, no public profiles
   • No social media exposure, no filters, no addictive feeds
   • See all messages and calls
   • Works on most phones and tablets over Wi‑Fi or mobile data

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Check it out:
${url}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The free plan lets you try it with 1 parent + 1 child before committing to anything!

I genuinely think you'll love it as much as we do. Let me know if you have any questions!

Take care
`.trim();
};

/**
 * Generates native share message (for Web Share API)
 * Note: Using minimal emojis for better cross-platform compatibility
 */
export const getNativeShareMessage = (referralCode?: string, referralUrl?: string): string => {
  const url = referralUrl || APP_URL;
  
  if (referralCode && referralUrl) {
    return `${APP_NAME} – Safe Video Calls for Kids

Kids can video call grandparents & family safely! Parents control everything.

Use my code ${referralCode} when you subscribe to the Family Plan – we both get 1 week FREE!

Sign up here: ${url}`;
  }
  
  return `${APP_NAME} – Safe Video Calls for Kids

Safe kids messaging app for family-only communication. Kids can video call grandparents & family safely without a phone number or SIM card! Parents control everything. No strangers, no filters, no social feeds.

Check it out: ${url}`;
};

/**
 * Generates a general share message (for copy message button)
 * Note: Using minimal emojis for better compatibility across platforms
 */
export const getGeneralShareMessage = (referralCode?: string, referralUrl?: string): string => {
  const url = referralUrl || APP_URL;
  
  if (referralCode && referralUrl) {
    return `${APP_NAME} – Safe Video Calls for Kids

Safe video calls between kids and approved family members – no phone needed!

Special offer: Use my referral code ${referralCode} and we both get 1 week FREE when you subscribe!

Sign up: ${url}`;
  }
  
  return `${APP_NAME} – ${APP_TAGLINE}

Safe kids messaging and video calling app for family-only communication – no phone number or SIM card needed!

- Parents approve every contact
- No strangers, no filters, no social feeds
- Video calls & messaging
- Works on most phones and tablets over Wi‑Fi

Check it out: ${url}`;
};

// Export constants for use in components
export { APP_NAME, APP_TAGLINE, APP_URL };

