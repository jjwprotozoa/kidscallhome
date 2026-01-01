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

// Info page FAQ - Technical and safety-focused questions
// Different from homepage FAQ to avoid duplicate content penalties
const faqItems: FAQItem[] = [
  {
    question: "How do approved contacts work?",
    answer: "Parents have complete control over who can contact their child. When you set up your family account, you explicitly approve each family member (grandparents, aunts, uncles, etc.) before they can connect with your child. Your child can only see and contact people you've approved—there's no way for strangers or unapproved contacts to reach them. You can add or remove approved contacts at any time from your parent dashboard."
  },
  {
    question: "How does encryption protect my family?",
    answer: "Kids Call Home uses encryption for all calls and messages, meaning your family's conversations are protected in transit. The app uses WebRTC peer-to-peer connections with encryption, similar to modern video calling platforms. Your data is encrypted both in transit (during calls/messages) and at rest (in storage)."
  },
  {
    question: "What data does Kids Call Home collect?",
    answer: "Kids Call Home collects only the minimal data necessary for the service to function: account information (parent email, child's display name and avatar), contact relationships (which family members are approved), and call/message metadata (who called whom, when, duration—not the content, which is encrypted). We do NOT collect: location data (unless you enable it), browsing history, device contacts, biometric data, or any data for advertising purposes."
  },
  {
    question: "Is Kids Call Home safer than FaceTime?",
    answer: "Kids Call Home offers several safety advantages over FaceTime for families with kids: (1) No phone number required—works on tablets without SIM cards, (2) Parent-controlled contacts—kids can only call people you approve, not everyone in their device contacts, (3) Works across all devices (not just Apple), (4) No personal phone numbers shared between family members, and (5) Designed specifically for kids' safety, not general communication."
  },
  {
    question: "Can my child call relatives internationally?",
    answer: "Yes. Kids Call Home works anywhere there's internet access—Wi‑Fi or mobile data. Your child can call approved family members in different countries just as easily as calling someone in the same city. There are no geographic restrictions, and international calls work the same way as local calls (no extra charges beyond your internet connection)."
  },
  {
    question: "What devices and browsers are compatible with Kids Call Home?",
    answer: "Kids Call Home works on any device with a modern web browser and internet connection. This includes iPads (Safari), Android tablets (Chrome), Kindle Fire tablets (Silk browser), Chromebooks (Chrome), iPhones (Safari), Android phones (Chrome), and desktop computers (Chrome, Firefox, Safari, Edge). The app works as a Progressive Web App (PWA), so it can be installed on the home screen and used like a native app. No phone number or SIM card is required—just Wi‑Fi or mobile data."
  },
  {
    question: "Can grandparents use Kids Call Home?",
    answer: "Yes. Grandparents and other extended family members can easily use Kids Call Home. Once a parent invites them and they create an account, they'll appear in your child's contact list. Grandparents can call and message kids directly, and kids can call them back with one tap. The app is designed to be simple enough for grandparents who aren't tech-savvy, while still being secure and parent-controlled."
  },
  {
    question: "How does Kids Call Home protect my child's privacy?",
    answer: "Kids Call Home uses encrypted calls and messages to protect your family's communication. The app collects minimal data necessary for the service to function, does not use tracking for advertising purposes, and does not sell family data. There are no manipulative design patterns like infinite feeds, aggressive notifications, or surprise in‑app purchases. Parents have full control over who can contact their child."
  },
  {
    question: "What happens if I want to delete my child's account?",
    answer: "You can request account deletion at any time through your parent dashboard or by contacting support. When you delete an account, we permanently remove all associated data including profile information, contact relationships, and call/message metadata. Encrypted message content cannot be recovered after deletion. This process typically completes within 30 days of your request."
  },
  {
    question: "How does Kids Call Home compare to WhatsApp or Messenger Kids?",
    answer: "Kids Call Home differs from WhatsApp and Messenger Kids in several key ways: (1) No phone number required—works on tablets without SIM cards, (2) No public profiles or search features—only parent-approved contacts, (3) No \"friends of friends\" connections, (4) Designed specifically for family communication, not social networking, (5) No ads, no games, no infinite feeds, and (6) Parent controls every contact from the start."
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

