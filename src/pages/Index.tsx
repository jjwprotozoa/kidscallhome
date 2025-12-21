// src/pages/Index.tsx
// SEO/ASO/AI-optimized marketing landing page for Kids Call Home
// Benefits-focused, problem-solving approach with founder story for trust
// Accessible design with prominent Kids Login

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
  Shield,
  Heart,
  Phone,
  Baby,
  Home,
  Globe,
  CheckCircle2,
  Quote,
  Star,
  Lock,
  Eye,
  Sparkles,
  ArrowRight,
  Play,
} from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-[100dvh] bg-background">
      {/* ============================================================
          HERO SECTION - Problem-focused with emotional hook
          ============================================================ */}
      <section 
        className="relative overflow-hidden"
        aria-labelledby="hero-heading"
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10 -z-10" />
        
        <div className="container mx-auto px-4 py-12 md:py-20 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left: Headline and CTA */}
            <div className="text-center lg:text-left space-y-6">
              {/* Emotional headline - problem focused */}
              <h1 
                id="hero-heading"
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight"
              >
                <span className="text-primary">When you can't be there,</span>
                <br />
                <span className="text-foreground">be just a tap away.</span>
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0">
                A safe, simple way for kids to video call parents and family — 
                built by a long-distance dad who knows the heartache of missing bedtime.
              </p>

              {/* Trust indicators */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-green-600" aria-hidden="true" />
                  Family-only contacts
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-green-600" aria-hidden="true" />
                  No strangers, ever
                </span>
                <span className="flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-green-600" aria-hidden="true" />
                  Parent controlled
                </span>
              </div>

              {/* Parent CTA */}
              <div className="pt-2">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all"
                  onClick={() => navigate("/parent/auth")}
                  aria-label="Parents and family members sign in or create account"
                >
                  <Users className="mr-2 h-5 w-5" aria-hidden="true" />
                  Parents & Family — Get Started Free
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Free plan includes 1 child. No credit card required.
                </p>
              </div>
            </div>

            {/* Right: Kids Login Card - PROMINENT and ACCESSIBLE */}
            <div className="flex justify-center lg:justify-end">
              <Card 
                className="w-full max-w-sm p-8 bg-gradient-to-br from-secondary/20 to-primary/20 border-2 border-primary/30 shadow-2xl hover:shadow-3xl transition-all cursor-pointer group"
                onClick={() => navigate("/child/login")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate("/child/login");
                  }
                }}
                aria-label="Kids login - tap to enter your special code"
              >
                {/* Large, friendly icon */}
                <div className="text-center space-y-4">
                  <div className="mx-auto w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                    <Baby className="h-12 w-12 md:h-14 md:w-14 text-white" aria-hidden="true" />
                  </div>
                  
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-primary">
                      Kids Login
                    </h2>
                    <p className="text-muted-foreground mt-2 text-base md:text-lg">
                      Tap here to call Mom, Dad, or Grandma!
                    </p>
                  </div>

                  {/* Visual login hint */}
                  <div className="flex justify-center gap-2 py-2">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-blue-500 flex items-center justify-center text-white text-xl">🐻</div>
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-green-500 flex items-center justify-center text-white text-xl">🦊</div>
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-purple-500 flex items-center justify-center text-white text-xl">🐰</div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Use your special animal code to log in!
                  </p>

                  <Button 
                    size="lg" 
                    className="w-full text-lg py-6 group-hover:bg-primary/90"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <Play className="mr-2 h-5 w-5" />
                    Enter My Code
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FOUNDER STORY - Trust Building Section
          ============================================================ */}
      <section 
        className="bg-muted/30 py-12 md:py-16"
        aria-labelledby="story-heading"
      >
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              {/* Founder image placeholder */}
              <div className="flex-shrink-0">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border-4 border-primary/30 flex items-center justify-center shadow-lg">
                  <Heart className="h-16 w-16 md:h-20 md:w-20 text-primary" aria-hidden="true" />
                </div>
              </div>
              
              {/* Story content */}
              <div className="text-center md:text-left space-y-4">
                <Quote className="h-8 w-8 text-primary/40 mx-auto md:mx-0" aria-hidden="true" />
                <h2 id="story-heading" className="text-2xl md:text-3xl font-bold">
                  Built by a Dad Who Understands
                </h2>
                <div className="text-muted-foreground space-y-3 text-base md:text-lg">
                  <p>
                    <strong className="text-foreground">I built Kids Call Home because I needed it.</strong> As a 
                    long-distance parent, the hardest part wasn't the miles—it was missing 
                    the little moments. Bedtime stories. Morning hellos. The random "Dad, guess what!" calls.
                  </p>
                  <p>
                    My kids had tablets, but calling me was complicated. They'd need help dialing, 
                    remember passwords, or navigate apps designed for adults. I wanted something 
                    <em> they</em> could use—<strong>without help, without confusion, without strangers</strong>.
                  </p>
                  <p>
                    So I built it. No social feeds. No friend requests from people you don't know. 
                    No filters hiding their real faces. Just <strong>real connection with real family</strong>.
                  </p>
                </div>
                <p className="text-sm text-muted-foreground italic">
                  — Justin, Founder & Dad
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          PROBLEMS WE SOLVE - Benefit-focused, not features
          ============================================================ */}
      <section 
        className="py-12 md:py-16"
        aria-labelledby="problems-heading"
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 md:mb-14">
            <h2 id="problems-heading" className="text-2xl md:text-3xl font-bold mb-4">
              The Problems We Solve
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every feature exists because a real family needed it.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Problem 1 */}
            <Card className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-primary">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl" role="img" aria-label="Worried face">😰</span>
                  </div>
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400">The Problem</h3>
                </div>
                <p className="text-muted-foreground">
                  "My child has a tablet, but calling me requires my help every time."
                </p>
                <div className="flex items-start gap-3 pt-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-600 dark:text-green-400">How We Help</h4>
                    <p className="text-sm text-muted-foreground">
                      Kids log in by tapping pictures (like Blue Bear), then tap your face to call. 
                      No typing, no passwords, no adult needed.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Problem 2 */}
            <Card className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-primary">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl" role="img" aria-label="Fearful face">😨</span>
                  </div>
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400">The Problem</h3>
                </div>
                <p className="text-muted-foreground">
                  "I worry about strangers contacting my child on messaging apps."
                </p>
                <div className="flex items-start gap-3 pt-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-600 dark:text-green-400">How We Help</h4>
                    <p className="text-sm text-muted-foreground">
                      Kids can ONLY contact family you've approved. No search. No friend requests. 
                      No public profiles. No strangers, ever.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Problem 3 */}
            <Card className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-primary">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl" role="img" aria-label="Sad face">😢</span>
                  </div>
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400">The Problem</h3>
                </div>
                <p className="text-muted-foreground">
                  "We live in different homes, and staying connected is hard for the kids."
                </p>
                <div className="flex items-start gap-3 pt-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-600 dark:text-green-400">How We Help</h4>
                    <p className="text-sm text-muted-foreground">
                      Kids can call either parent instantly, from any home, any device. 
                      Perfect for co-parenting and shared custody.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Problem 4 */}
            <Card className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-primary">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl" role="img" aria-label="Pensive face">😔</span>
                  </div>
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400">The Problem</h3>
                </div>
                <p className="text-muted-foreground">
                  "Grandma lives far away and misses the grandkids terribly."
                </p>
                <div className="flex items-start gap-3 pt-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-600 dark:text-green-400">How We Help</h4>
                    <p className="text-sm text-muted-foreground">
                      Invite grandparents, aunts, uncles, cousins. Kids see their faces and call with one tap. 
                      Distance disappears.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Problem 5 */}
            <Card className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-primary">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl" role="img" aria-label="Concerned face">😟</span>
                  </div>
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400">The Problem</h3>
                </div>
                <p className="text-muted-foreground">
                  "Kids' apps are full of ads, games, and addictive feeds."
                </p>
                <div className="flex items-start gap-3 pt-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-600 dark:text-green-400">How We Help</h4>
                    <p className="text-sm text-muted-foreground">
                      Zero ads. Zero games. Zero infinite scroll. Just calls and messages with family. 
                      That's it.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Problem 6 */}
            <Card className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-primary">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl" role="img" aria-label="Unamused face">😑</span>
                  </div>
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400">The Problem</h3>
                </div>
                <p className="text-muted-foreground">
                  "I don't trust big tech apps with my child's data."
                </p>
                <div className="flex items-start gap-3 pt-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-600 dark:text-green-400">How We Help</h4>
                    <p className="text-sm text-muted-foreground">
                      We collect minimal data, never track for ads, never sell your information. 
                      Your family's privacy is sacred.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ============================================================
          SOCIAL PROOF - Trust Building
          ============================================================ */}
      <section 
        className="bg-primary/5 py-12 md:py-16"
        aria-labelledby="testimonials-heading"
      >
        <div className="container mx-auto px-4">
          <h2 id="testimonials-heading" className="text-2xl md:text-3xl font-bold text-center mb-10">
            Families Like Yours
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                quote: "My 4-year-old calls Grandma by herself now. She just taps Grandma's picture and they're talking!",
                name: "Sarah M.",
                role: "Mom of 2",
                stars: 5,
              },
              {
                quote: "After the divorce, this helped my kids stay close to me even when they're at their mom's. Game changer.",
                name: "David R.",
                role: "Co-parenting Dad",
                stars: 5,
              },
              {
                quote: "Finally, an app that doesn't try to sell my kids stuff or show them random videos. Just family.",
                name: "Jennifer L.",
                role: "Mom & Grandma",
                stars: 5,
              },
            ].map((testimonial, index) => (
              <Card key={index} className="p-6">
                <div className="space-y-4">
                  <div className="flex gap-1" aria-label={`${testimonial.stars} out of 5 stars`}>
                    {[...Array(testimonial.stars)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" aria-hidden="true" />
                    ))}
                  </div>
                  <blockquote className="text-muted-foreground italic">
                    "{testimonial.quote}"
                  </blockquote>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          HOW IT WORKS - Simple visual flow
          ============================================================ */}
      <section 
        className="py-12 md:py-16"
        aria-labelledby="how-it-works-heading"
      >
        <div className="container mx-auto px-4">
          <h2 id="how-it-works-heading" className="text-2xl md:text-3xl font-bold text-center mb-10">
            Simple for Everyone
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "1",
                icon: Users,
                title: "Parents Set Up",
                description: "Create your family, add your kids, invite grandparents and family members. Takes 2 minutes.",
              },
              {
                step: "2",
                icon: Baby,
                title: "Kids Get a Code",
                description: "Each child gets a fun, memorable code like 'Blue Bear' — no passwords to forget.",
              },
              {
                step: "3",
                icon: Heart,
                title: "Family Connects",
                description: "Kids tap their code, see family faces, and call anyone you've approved. That's it.",
              },
            ].map((item, index) => (
              <div key={index} className="text-center space-y-4">
                <div className="relative mx-auto w-20 h-20">
                  <div className="absolute inset-0 rounded-full bg-primary/10" />
                  <div className="absolute inset-2 rounded-full bg-primary/20 flex items-center justify-center">
                    <item.icon className="h-8 w-8 text-primary" aria-hidden="true" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-xl font-bold">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          USE CASES - Who it's for
          ============================================================ */}
      <section 
        className="bg-muted/30 py-12 md:py-16"
        aria-labelledby="use-cases-heading"
      >
        <div className="container mx-auto px-4">
          <h2 id="use-cases-heading" className="text-2xl md:text-3xl font-bold text-center mb-10">
            Perfect For
          </h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Home, title: "Co-Parents", desc: "Kids reach both homes easily" },
              { icon: Globe, title: "Long-Distance Family", desc: "Grandparents, aunts, uncles" },
              { icon: Sparkles, title: "Young Kids", desc: "Ages 3+ can use it alone" },
              { icon: Shield, title: "Safety-First Parents", desc: "No strangers, no worries" },
            ].map((item, index) => (
              <Card key={index} className="p-6 text-center hover:shadow-lg transition-shadow">
                <item.icon className="h-10 w-10 text-primary mx-auto mb-3" aria-hidden="true" />
                <h3 className="font-bold mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          FAQ Section - SEO & AI Optimized
          ============================================================ */}
      <section 
        className="py-12 md:py-16"
        aria-labelledby="faq-heading"
      >
        <div className="container mx-auto px-4">
          <h2 id="faq-heading" className="text-2xl md:text-3xl font-bold text-center mb-10">
            Questions Parents Ask
          </h2>
          
          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="safety">
                <AccordionTrigger className="text-left">
                  How do you keep my child safe from strangers?
                </AccordionTrigger>
                <AccordionContent>
                  Kids can ONLY contact people you've specifically approved. There's no search feature, 
                  no friend requests, no public profiles, and no way for anyone outside your family to 
                  find or contact your child. Period.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="age">
                <AccordionTrigger className="text-left">
                  What age is this designed for?
                </AccordionTrigger>
                <AccordionContent>
                  Kids as young as 3-4 can use the picture-based login and tap-to-call interface 
                  independently. The app grows with them — older kids appreciate the messaging features 
                  while parents maintain oversight.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="devices">
                <AccordionTrigger className="text-left">
                  What devices work with Kids Call Home?
                </AccordionTrigger>
                <AccordionContent>
                  Any device with a web browser and camera works — iPads, Android tablets, Kindle Fire, 
                  iPhones, Android phones, Chromebooks, and computers. WiFi or mobile data is all you need.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="coparenting">
                <AccordionTrigger className="text-left">
                  Does this work for co-parenting situations?
                </AccordionTrigger>
                <AccordionContent>
                  Absolutely. This is one of the most common use cases. Kids can call either parent 
                  from either home, and both parents can be involved in managing the family account. 
                  Many co-parents tell us this has reduced friction around staying connected.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="privacy">
                <AccordionTrigger className="text-left">
                  What about privacy and data?
                </AccordionTrigger>
                <AccordionContent>
                  We collect the minimum data needed to make the app work. We don't track behavior 
                  for advertising, we don't sell data, and calls are encrypted. Your family's privacy 
                  is fundamental to our design, not an afterthought.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="cost">
                <AccordionTrigger className="text-left">
                  Is it really free?
                </AccordionTrigger>
                <AccordionContent>
                  Yes! The free plan lets you add 1 child and unlimited family members. If you have 
                  multiple kids, affordable family plans are available. No ads, no tricks, no surprise charges.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* ============================================================
          FINAL CTA - Kids Login Prominent Again
          ============================================================ */}
      <section 
        className="bg-gradient-to-br from-primary/10 to-secondary/10 py-12 md:py-20"
        aria-labelledby="cta-heading"
      >
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h2 id="cta-heading" className="text-2xl md:text-4xl font-bold">
              Ready to bring your family closer?
            </h2>
            <p className="text-lg text-muted-foreground">
              Join thousands of families who've made staying connected simple and safe.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                className="text-lg px-8 py-6 w-full sm:w-auto"
                onClick={() => navigate("/parent/auth")}
              >
                <Users className="mr-2 h-5 w-5" aria-hidden="true" />
                Parents — Start Free
              </Button>
              
              <Button
                size="lg"
                variant="secondary"
                className="text-lg px-8 py-6 w-full sm:w-auto border-2 border-primary/30"
                onClick={() => navigate("/child/login")}
              >
                <Baby className="mr-2 h-5 w-5" aria-hidden="true" />
                Kids Login
              </Button>
            </div>

            <Button
              variant="link"
              className="text-muted-foreground"
              onClick={() => navigate("/info")}
            >
              Learn more about safety, privacy & pricing →
            </Button>
          </div>
        </div>
      </section>

      {/* ============================================================
          FOOTER
          ============================================================ */}
      <footer className="border-t py-8 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <img 
                src="/icon-96x96.png" 
                alt="" 
                className="h-10 w-10"
                aria-hidden="true"
              />
              <div>
                <span className="font-bold text-lg">Kids Call Home</span>
                <p className="text-xs text-muted-foreground">Safe family calling for kids</p>
              </div>
            </div>
            
            <nav aria-label="Footer navigation">
              <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <li>
                  <button 
                    onClick={() => navigate("/info#privacy")} 
                    className="hover:text-foreground transition-colors"
                  >
                    Privacy
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/info#terms")} 
                    className="hover:text-foreground transition-colors"
                  >
                    Terms
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/info#security")} 
                    className="hover:text-foreground transition-colors"
                  >
                    Security
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/info#contact")} 
                    className="hover:text-foreground transition-colors"
                  >
                    Contact
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/info")} 
                    className="hover:text-foreground transition-colors"
                  >
                    About
                  </button>
                </li>
              </ul>
            </nav>
            
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
