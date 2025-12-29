// src/components/info/ExpandedFAQ.tsx
// Purpose: Expanded FAQ with user intent questions for SEO and AI discovery
// Includes questions that match real search queries

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trackFAQClick, trackPrimaryCTA, trackConfidenceSignal } from "@/utils/funnelTracking";
import { HelpCircle, ArrowRight } from "lucide-react";
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: "How can my child call me from a tablet without a SIM card?",
    answer: "Kids Call Home works perfectly on tablets, iPads, Kindle Fire, and Chromebooks over Wi‑Fi without needing a SIM card or phone number. Your child simply opens the app, enters their login code, and can call approved family members. Parents control all contacts, so only family members you approve can connect with your child."
  },
  {
    question: "Is this app safer than typical kids messaging apps?",
    answer: "Yes. Kids Call Home is designed specifically for family-only communication. Unlike many kids messaging apps, there are no public profiles, no search features, no friend requests from strangers, and no \"friends of friends\" connections. Only parent-approved family members can contact your child. The app uses encrypted communication, collects minimal data, does not show ads, and does not sell family data to advertisers or partners."
  },
  {
    question: "How does Kids Call Home protect my child's privacy?",
    answer: "Kids Call Home uses encrypted calls and messages to protect your family's communication. The app collects minimal data necessary for the service to function, does not use tracking for advertising purposes, and does not sell family data. There are no manipulative design patterns like infinite feeds, aggressive notifications, or surprise in‑app purchases. Parents have full control over who can contact their child."
  },
  {
    question: "Can my child use this to call both parents in different homes?",
    answer: "Yes. Kids Call Home is built for co‑parents and long‑distance family. Your child can easily call both parents, grandparents, and other approved family members across different homes and even different countries. Parents control which family members are approved, making it ideal for shared custody situations and international families."
  },
  {
    question: "Does Kids Call Home work on iPads and tablets?",
    answer: "Yes. Kids Call Home works great on iPads, Android tablets, Kindle Fire, and Chromebooks. It works over Wi‑Fi without needing a SIM card or phone number, making it perfect for kids who don't have their own phone. The app is also available as a Progressive Web App (PWA), so it can be added to the home screen like a native app."
  },
  {
    question: "Are there ads or in‑app purchases in Kids Call Home?",
    answer: "No. Kids Call Home has no ads, no in‑app purchases, and no manipulative design features. The app is designed to be a simple, safe communication tool for families, not a platform for engagement or monetization. Your child's attention stays on connecting with family, not on games, feeds, or notifications designed to keep them online longer."
  },
  {
    question: "Does my child need a password to use Kids Call Home?",
    answer: "Kids Call Home supports simple magic links so children can tap once to log in from trusted devices instead of remembering complex usernames or passwords. Parents control where and how these links are used."
  },
  {
    question: "Does Kids Call Home include filters or games?",
    answer: "No. Kids Call Home is focused on real connection between kids and family, so there are no face filters, social feeds or games. When your child calls, you see their real face and hear their real voice."
  },
  {
    question: "Is Kids Call Home accessible on iPads/tablets?",
    answer: "Absolutely. Kids Call Home is designed to work on any device with internet access, including iPads, Android tablets, Kindle Fire tablets, and Chromebooks. No phone number or SIM card is required—just Wi‑Fi or mobile data. The app works as a Progressive Web App (PWA), so it can be installed on the home screen and used like a native app."
  },
  {
    question: "How do approved contacts work?",
    answer: "Parents have complete control over who can contact their child. When you set up your family account, you explicitly approve each family member (grandparents, aunts, uncles, etc.) before they can connect with your child. Your child can only see and contact people you've approved—there's no way for strangers or unapproved contacts to reach them. You can add or remove approved contacts at any time from your parent dashboard."
  },
  {
    question: "How does encryption protect my family?",
    answer: "Kids Call Home uses end-to-end encryption for all calls and messages, meaning your family's conversations are scrambled and can only be decrypted by the intended recipient. Even if someone intercepted the data, they couldn't read or listen to it. This is the same level of security used by banks and healthcare systems to protect sensitive information."
  },
  {
    question: "Can my child call relatives internationally?",
    answer: "Yes. Kids Call Home works anywhere there's internet access—Wi‑Fi or mobile data. Your child can call approved family members in different countries just as easily as calling someone in the same city. There are no geographic restrictions, and international calls work the same way as local calls (no extra charges beyond your internet connection)."
  },
  {
    question: "Is Kids Call Home safer than FaceTime?",
    answer: "Kids Call Home offers several safety advantages over FaceTime for families with kids: (1) No phone number required—works on tablets without SIM cards, (2) Parent-controlled contacts—kids can only call people you approve, not everyone in their device contacts, (3) Works across all devices (not just Apple), (4) No personal phone numbers shared between family members, and (5) Designed specifically for kids' safety, not general communication."
  },
  {
    question: "What data does Kids Call Home collect?",
    answer: "Kids Call Home collects only the minimal data necessary for the service to function: account information (parent email, child's display name and avatar), contact relationships (which family members are approved), and call/message metadata (who called whom, when, duration—not the content, which is encrypted). We do NOT collect: location data (unless you enable it), browsing history, device contacts, biometric data, or any data for advertising purposes."
  },
  {
    question: "Can grandparents use Kids Call Home?",
    answer: "Yes. Grandparents and other extended family members can easily use Kids Call Home. Once a parent invites them and they create an account, they'll appear in your child's contact list. Grandparents can call and message kids directly, and kids can call them back with one tap. The app is designed to be simple enough for grandparents who aren't tech-savvy, while still being secure and parent-controlled."
  }
];

export const ExpandedFAQ = () => {
  const navigate = useNavigate();
  const [openedQuestions, setOpenedQuestions] = useState<Set<number>>(new Set());
  const hasTrackedConfidence = useRef(false);

  const handleQuestionClick = (index: number) => {
    const newOpened = new Set(openedQuestions);
    newOpened.add(index);
    setOpenedQuestions(newOpened);

    // Track FAQ click
    trackFAQClick(faqItems[index].question);

    // Track confidence signal when ≥3 questions opened
    if (newOpened.size >= 3 && !hasTrackedConfidence.current) {
      hasTrackedConfidence.current = true;
      trackConfidenceSignal("faq_depth");
    }
  };

  return (
    <section id="faq" className="mb-8 scroll-mt-20">
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          Frequently Asked Questions
        </h2>
        <p className="text-muted-foreground mb-6 text-sm">
          Questions answered in plain language. If you don't see your question here, 
          please <a href="#contact" className="text-primary hover:underline">contact us</a>.
        </p>
        <div className="space-y-6">
          {faqItems.map((item, index) => (
            <div 
              key={index} 
              className="border-b border-border/40 pb-4 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors rounded p-2 -m-2"
              onClick={() => handleQuestionClick(index)}
            >
              <h3 className="font-semibold mb-2 text-base md:text-lg">
                {item.question}
              </h3>
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                {item.answer}
              </p>
            </div>
          ))}
        </div>

        {/* Contextual CTA after FAQ - low-commitment options for hesitant parents */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 items-center justify-center">
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => {
              trackFAQClick("cta");
              trackPrimaryCTA("Get started", "trust", "faq");
              navigate("/parent/auth");
            }}
          >
            Get started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => {
              trackFAQClick("try_one_device");
              trackPrimaryCTA("Try it with one device", "trust", "faq");
              navigate("/parent/auth");
            }}
          >
            Try it with one device
          </Button>
        </div>
      </Card>
    </section>
  );
};

