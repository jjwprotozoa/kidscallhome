// src/pages/Index.tsx
// Comprehensive SEO-optimized marketing/landing page for Kids Call Home
// Uses shadcn/ui components and Tailwind CSS

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Users,
  MessageCircle,
  Video,
  Shield,
  Smartphone,
  Heart,
  Phone,
  Tablet,
  Wifi,
  Lock,
  Eye,
  UserCheck,
  Baby,
  Home,
  Globe,
  CheckCircle2,
} from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 md:py-20">
        <div className="text-center space-y-6 max-w-4xl mx-auto">
          {/* App Icon */}
          <div className="aspect-square w-24 md:w-28 mx-auto">
            <picture>
              <source
                type="image/webp"
                srcSet="/icon-96x96.webp 96w, /icon-192x192.webp 192w"
                sizes="112px"
              />
              <source
                type="image/png"
                srcSet="/icon-96x96.png 96w, /icon-192x192.png 192w"
                sizes="112px"
              />
              <img
                src="/icon-96x96.png"
                alt="Kids Call Home"
                className="w-full h-full object-contain drop-shadow-lg"
                width="96"
                height="96"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </picture>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary leading-tight">
            Safe Video Calls for Kids
            <span className="block text-2xl md:text-3xl lg:text-4xl text-muted-foreground mt-2">
              No Phone or SIM Required
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Let your kids safely call and message family members on any tablet, iPad, or WiFi device. 
            <strong className="text-foreground"> Family-only contacts, no strangers, no ads.</strong>
          </p>

          {/* Key Benefits Bar */}
          <div className="flex flex-wrap justify-center gap-4 md:gap-6 py-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>100% Family-Only</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>Zero Ads</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>Free to Start</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>Any Device Works</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button
              size="lg"
              className="text-lg px-8 py-6"
              onClick={() => navigate("/parent/auth")}
            >
              <Users className="mr-2 h-5 w-5" />
              Parents & Family Sign In
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="text-lg px-8 py-6"
              onClick={() => navigate("/child/login")}
            >
              <Baby className="mr-2 h-5 w-5" />
              Kids Login
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 md:mb-12">
          Everything Your Family Needs
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <Video className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Video & Voice Calls</h3>
            <p className="text-muted-foreground">
              Crystal-clear video calls between kids and approved family members. Works on WiFi or mobile data.
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <MessageCircle className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Secure Messaging</h3>
            <p className="text-muted-foreground">
              Send messages, photos, and voice notes. All communication stays within your family.
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <UserCheck className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Family-Only Contacts</h3>
            <p className="text-muted-foreground">
              Parents control who kids can contact. No strangers, no random friend requests, ever.
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Privacy & Security</h3>
            <p className="text-muted-foreground">
              End-to-end encryption, no data tracking, no ads, no selling your information.
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <Tablet className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Works on Any Device</h3>
            <p className="text-muted-foreground">
              iPads, Android tablets, Kindle Fire, phones, or computers. No SIM card needed.
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <Heart className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Easy for Kids</h3>
            <p className="text-muted-foreground">
              Simple picture-based login. No passwords to remember, just fun animal codes.
            </p>
          </Card>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="bg-muted/30 py-12 md:py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 md:mb-12">
            Perfect For Your Family
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Home className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Co-Parenting & Shared Custody</h3>
                <p className="text-muted-foreground">
                  Kids can easily reach both parents regardless of which home they're at. 
                  Perfect for separated families who want to stay connected.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Long-Distance Family</h3>
                <p className="text-muted-foreground">
                  Grandparents, aunts, uncles, and cousins can video call kids from anywhere in the world.
                  Keep extended family connected.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wifi className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Tablets & WiFi Devices</h3>
                <p className="text-muted-foreground">
                  Your child's iPad or Android tablet becomes a safe communication device.
                  No phone plan or SIM card required.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Emergency Contact</h3>
                <p className="text-muted-foreground">
                  Give kids a safe way to reach you when they need help.
                  No social media accounts or phone numbers to manage.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Safety Section */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <Shield className="h-16 w-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Built for Safety, Designed for Kids
            </h2>
            <p className="text-lg text-muted-foreground">
              Unlike social media apps, Kids Call Home puts parents in complete control.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Lock, text: "No strangers can contact your child" },
              { icon: Eye, text: "No public profiles or discovery features" },
              { icon: UserCheck, text: "Parent-approved contacts only" },
              { icon: Shield, text: "No social feeds or random content" },
              { icon: CheckCircle2, text: "No ads or in-app purchases" },
              { icon: Lock, text: "Encrypted video calls & messages" },
              { icon: Eye, text: "No data tracking or selling" },
              { icon: Heart, text: "Simple, kid-friendly interface" },
            ].map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20"
              >
                <item.icon className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span className="text-sm font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Device Compatibility */}
      <section className="bg-muted/30 py-12 md:py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
            Works on All Your Devices
          </h2>
          <div className="flex flex-wrap justify-center gap-6 md:gap-8 max-w-3xl mx-auto">
            {[
              { icon: Tablet, label: "iPads" },
              { icon: Tablet, label: "Android Tablets" },
              { icon: Tablet, label: "Kindle Fire" },
              { icon: Smartphone, label: "iPhones" },
              { icon: Smartphone, label: "Android Phones" },
              { icon: Globe, label: "Web Browsers" },
            ].map((device, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <device.icon className="h-8 w-8 text-primary" />
                </div>
                <span className="text-sm font-medium">{device.label}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-muted-foreground mt-6">
            WiFi or mobile data connection required. No SIM card or phone plan needed.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 md:mb-12">
          Frequently Asked Questions
        </h2>
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-left">
                How can my child call me from a tablet without a SIM card?
              </AccordionTrigger>
              <AccordionContent>
                Kids Call Home uses WiFi or mobile data to make video calls, just like FaceTime or WhatsApp. 
                Your child logs in with a simple picture code, and they can instantly call any approved family member. 
                No phone number or SIM card needed.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-left">
                Is this app safer than other kids messaging apps?
              </AccordionTrigger>
              <AccordionContent>
                Yes. Unlike apps that allow "friends of friends" or have open search features, 
                Kids Call Home only allows contact with family members that parents have specifically approved. 
                There's no way for strangers to find or contact your child.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="text-left">
                How does Kids Call Home protect my child's privacy?
              </AccordionTrigger>
              <AccordionContent>
                We use end-to-end encryption for calls and messages. We collect minimal data, 
                never track your child's activity for advertising, and never sell any information. 
                There are no ads, no social features, and no public profiles.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="text-left">
                Can my child use this to call both parents in different homes?
              </AccordionTrigger>
              <AccordionContent>
                Absolutely! This is perfect for co-parenting situations. Your child can call either parent 
                (and grandparents, aunts, uncles, etc.) from any device. Each parent can manage their own 
                account while sharing access to the child's profile.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger className="text-left">
                Does Kids Call Home work on iPads and tablets?
              </AccordionTrigger>
              <AccordionContent>
                Yes! Kids Call Home works on iPads, Android tablets, Kindle Fire, Chromebooks, 
                and any device with a web browser. It's perfect for WiFi-only devices that don't have 
                a phone number.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger className="text-left">
                Are there ads or in-app purchases?
              </AccordionTrigger>
              <AccordionContent>
                No. Kids Call Home has zero ads and no manipulative in-app purchases. 
                We believe kids' apps should be clean and simple. We offer a free tier and 
                paid family plans for larger families.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7">
              <AccordionTrigger className="text-left">
                How do kids log in without a password?
              </AccordionTrigger>
              <AccordionContent>
                Kids use a fun, memorable code made of colors and animals (like "Blue Bear"). 
                Parents set this up, and kids just tap the matching pictures to log in. 
                No typing, no passwords to remember.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8">
              <AccordionTrigger className="text-left">
                Can grandparents and other family members use this?
              </AccordionTrigger>
              <AccordionContent>
                Yes! Parents can invite grandparents, aunts, uncles, cousins, and other trusted family members. 
                Each family member gets their own login, and kids can call any approved family member.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-primary/5 py-12 md:py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to Connect Your Family?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Start free today. Set up your family in minutes and give your kids a safe way to stay connected.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="text-lg px-8 py-6"
              onClick={() => navigate("/parent/auth")}
            >
              Get Started Free
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6"
              onClick={() => navigate("/info")}
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <img src="/icon-96x96.png" alt="Kids Call Home" className="h-8 w-8" />
              <span className="font-bold">Kids Call Home</span>
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <button onClick={() => navigate("/info#privacy")} className="hover:text-foreground">
                Privacy Policy
              </button>
              <button onClick={() => navigate("/info#terms")} className="hover:text-foreground">
                Terms of Service
              </button>
              <button onClick={() => navigate("/info#contact")} className="hover:text-foreground">
                Contact
              </button>
              <button onClick={() => navigate("/info")} className="hover:text-foreground">
                About
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Kids Call Home
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default Index;





