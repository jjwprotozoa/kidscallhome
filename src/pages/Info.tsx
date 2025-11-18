// src/pages/Info.tsx
// App Store / Play Store compliance information page

import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  Crown,
  DollarSign,
  ExternalLink,
  FileText,
  Home,
  Info as InfoIcon,
  Mail,
  Menu,
  Shield,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const Info = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showFloatingNav, setShowFloatingNav] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [userType, setUserType] = useState<"parent" | "child" | null>(null);
  const [loading, setLoading] = useState(true);

  // Determine user type and home route
  useEffect(() => {
    const determineUserType = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const childSession = localStorage.getItem("childSession");

        if (session) {
          setUserType("parent");
        } else if (childSession) {
          try {
            JSON.parse(childSession);
            setUserType("child");
          } catch {
            setUserType(null);
          }
        } else {
          setUserType(null);
        }
      } catch (error) {
        console.error("Error determining user type:", error);
        setUserType(null);
      } finally {
        setLoading(false);
      }
    };

    determineUserType();
  }, []);

  // Get home route based on user type
  const getHomeRoute = () => {
    if (userType === "parent") return "/parent";
    if (userType === "child") return "/child";
    return "/"; // Landing page if not logged in
  };

  // Check if user is likely a parent (synchronous, non-blocking)
  const isParent = useMemo(() => {
    return userType === "parent";
  }, [userType]);

  // Show floating nav when scrolled down
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setShowFloatingNav(scrollY > 300); // Show after scrolling 300px
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setSheetOpen(false); // Close sheet after navigation
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const sections = [
    { id: "description", label: "App Description" },
    { id: "pricing", label: "Pricing & Subscription" },
    { id: "terms", label: "Terms & Conditions" },
    { id: "privacy", label: "Privacy Policy" },
    { id: "cancel", label: "Cancellation Policy" },
    { id: "removal", label: "Personal Information Removal" },
    { id: "contact", label: "Contact & Support" },
    { id: "demo", label: "Demo / Test Account" },
  ];

  return (
    <div className="min-h-[100dvh] bg-background w-full overflow-x-hidden">
      <Navigation />
      <div
        className="px-4 pb-8"
        style={{
          paddingTop: "calc(0.5rem + 64px + var(--safe-area-inset-top) * 0.15)",
        }}
      >
        <div className="max-w-4xl mx-auto">
          {/* Header with App Icon and Back Button */}
          <div className="mt-4 mb-8">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-4 flex-1">
                {/* App Icon */}
                <div className="flex-shrink-0">
                  <img
                    src="/icon-192x192.png"
                    alt="Kids Call Home"
                    className="w-16 h-16 rounded-xl shadow-md"
                    width="64"
                    height="64"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <InfoIcon className="h-6 w-6 flex-shrink-0" />
                    <h1 className="text-3xl font-bold">App Information</h1>
                  </div>
                  <p className="text-muted-foreground">
                    Important information about Kids Call Home
                  </p>
                </div>
              </div>
              {/* Back to App Button */}
              {!loading && (
                <Button
                  onClick={() => navigate(getHomeRoute())}
                  variant="default"
                  size="lg"
                  className="flex-shrink-0 shadow-md"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">
                    {userType === "parent"
                      ? "Back to Parent Home"
                      : userType === "child"
                      ? "Back to Kid Home"
                      : "Back to App"}
                  </span>
                  <Home className="h-4 w-4 sm:hidden" />
                </Button>
              )}
            </div>
          </div>

          {/* Quick Navigation */}
          <Card className="p-4 mb-6 sticky top-4 z-10 bg-background/95 backdrop-blur-sm">
            <div className="flex flex-wrap gap-2 text-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => scrollToSection("description")}
              >
                Description
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => scrollToSection("pricing")}
              >
                Pricing
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => scrollToSection("terms")}
              >
                Terms
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => scrollToSection("privacy")}
              >
                Privacy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => scrollToSection("cancel")}
              >
                Cancellation
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => scrollToSection("removal")}
              >
                Data Removal
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => scrollToSection("contact")}
              >
                Contact
              </Button>
            </div>
          </Card>

          {/* Section 1: App Description */}
          <section id="description" className="mb-8 scroll-mt-20">
            <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <InfoIcon className="h-5 w-5" />
                App Description
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Short Description</h3>
                  <p className="text-muted-foreground">
                    Stay connected with your family through simple video calls
                    and messaging.
                  </p>
                </div>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Full Description</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Kids Call Home is a family communication app that enables
                    secure video calls and messaging between parents and
                    children. Parents can create accounts and manage their
                    children's access, while kids can easily call and message
                    their parents using a special login code. The app works on
                    WiFi-only devices (no SIM card required) and also supports
                    devices with cellular data (LTE, 3G, 4G, 5G). Perfect for
                    tablets, Chromebooks, and mobile devices.
                  </p>
                </div>
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Key Features</h3>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Video calls between parents and children</li>
                    <li>Secure messaging</li>
                    <li>Simple login codes for kids</li>
                    <li>Parent account management</li>
                    <li>Real-time notifications</li>
                    <li>Mobile-friendly interface</li>
                    <li>Progressive Web App (PWA)</li>
                    <li>Works without SIM card or phone number</li>
                    <li>Low-bandwidth optimization</li>
                  </ul>
                </div>
              </div>
            </Card>
          </section>

          {/* Section 2: Pricing & Subscription Terms */}
          <section id="pricing" className="mb-8 scroll-mt-20">
            <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pricing & Subscription Terms
              </h2>
              <div className="space-y-4">
                <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                  <p className="font-semibold text-primary mb-2">
                    Free Tier Available
                  </p>
                  <p className="text-muted-foreground">
                    The app allows 1 parent and 1 child account for free.
                    Charges apply for each additional child account.
                  </p>
                </div>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3">Subscription Plans</h3>
                  <div className="space-y-3">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Additional Kid Monthly</h4>
                        <span className="text-lg font-bold">$2.99/month</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Add one more child to your account
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Additional Kid Annual</h4>
                        <span className="text-lg font-bold">$29.99/year</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Add one more child (save 17% vs monthly)
                      </p>
                    </div>
                    <div className="border rounded-lg p-4 border-primary/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">Family Bundle Monthly</h4>
                          <Crown className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-lg font-bold">$14.99/month</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Perfect for families with up to 5 kids
                      </p>
                    </div>
                    <div className="border-2 border-primary rounded-lg p-4 bg-primary/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">Annual Family Plan</h4>
                          <Crown className="h-4 w-4 text-primary" />
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                            Best Value
                          </span>
                        </div>
                        <span className="text-lg font-bold">$99/year</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Best value - unlimited kids for the whole family
                      </p>
                    </div>
                  </div>
                </div>
                {isParent && (
                  <div className="pt-4">
                    <Button
                      onClick={() => navigate("/parent/upgrade")}
                      className="w-full sm:w-auto"
                    >
                      View Full Pricing Details
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </section>

          {/* Section 3: Terms & Conditions */}
          <section id="terms" className="mb-8 scroll-mt-20">
            <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Terms & Conditions
              </h2>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  By using Kids Call Home, you agree to the following terms and
                  conditions:
                </p>
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold mb-2">
                      Account Responsibility
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Parents are responsible for maintaining the security of
                      their account and managing their children's access. You
                      must provide accurate information when creating an
                      account.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Acceptable Use</h3>
                    <p className="text-sm text-muted-foreground">
                      The app is intended for family communication only. Users
                      must not use the service for any illegal, harmful, or
                      unauthorized purposes. Harassment, abuse, or inappropriate
                      content is strictly prohibited.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Service Availability</h3>
                    <p className="text-sm text-muted-foreground">
                      We strive to maintain service availability but do not
                      guarantee uninterrupted access. The service may be
                      temporarily unavailable due to maintenance, updates, or
                      technical issues.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Age Requirements</h3>
                    <p className="text-sm text-muted-foreground">
                      Parents must be at least 18 years old to create an
                      account. Children's accounts are managed by their parents.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">
                      Limitation of Liability
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Kids Call Home is provided "as is" without warranties. We
                      are not liable for any damages arising from use of the
                      service, including but not limited to communication
                      failures or data loss.
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    These terms may be updated from time to time. Continued use
                    of the service constitutes acceptance of updated terms.
                  </p>
                </div>
              </div>
            </Card>
          </section>

          {/* Section 4: Privacy Policy */}
          <section id="privacy" className="mb-8 scroll-mt-20">
            <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacy Policy
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Data Collection</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Kids Call Home collects the following information:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    <li>
                      Account information (email, name) for parent accounts
                    </li>
                    <li>
                      Child profile information (name, login code) managed by
                      parents
                    </li>
                    <li>
                      Device information for security and device management
                    </li>
                    <li>Call and message data for service functionality</li>
                  </ul>
                </div>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Data Usage</h3>
                  <p className="text-sm text-muted-foreground">
                    We use collected data solely to provide and improve the
                    service. Data is not sold to third parties. We use
                    industry-standard security measures to protect your
                    information.
                  </p>
                </div>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Data Storage</h3>
                  <p className="text-sm text-muted-foreground">
                    Data is stored securely using Supabase (PostgreSQL database)
                    with encryption at rest. Video calls use WebRTC peer-to-peer
                    connections when possible, minimizing data transmission
                    through our servers.
                  </p>
                </div>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Children's Privacy</h3>
                  <p className="text-sm text-muted-foreground">
                    We comply with COPPA (Children's Online Privacy Protection
                    Act). All children's accounts are created and managed by
                    parents. We do not knowingly collect personal information
                    from children without parental consent.
                  </p>
                </div>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">
                    Data Queries & Requests
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    For questions about your data or to request access,
                    correction, or deletion, please contact us at:
                  </p>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="font-mono text-sm">
                      support@kidscallhome.com
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* Section 5: Cancellation Policy */}
          <section id="cancel" className="mb-8 scroll-mt-20">
            <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Cancellation Policy
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">
                    How to Cancel Subscription
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    You can cancel your subscription at any time through your
                    Account Settings:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-4">
                    <li>
                      Navigate to Account Settings (accessible from the main
                      menu)
                    </li>
                    <li>Find the Subscription section</li>
                    <li>Click "Cancel Subscription"</li>
                    <li>Confirm the cancellation</li>
                  </ol>
                  {isParent && (
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        onClick={() => navigate("/parent/settings")}
                        className="w-full sm:w-auto"
                      >
                        Go to Account Settings
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">
                    Access After Cancellation
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    When you cancel your subscription, you will continue to have
                    access to all premium features until the end of your current
                    billing period. After expiration, your account will
                    automatically revert to the free tier (1 child limit).
                    Existing children can still use the app, but you won't be
                    able to add more children until you resubscribe.
                  </p>
                </div>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Refund Policy</h3>
                  <p className="text-sm text-muted-foreground">
                    Subscriptions are billed in advance. Refunds are not
                    available for partial billing periods. If you cancel during
                    a billing period, you retain access until the period ends
                    without additional charges.
                  </p>
                </div>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Account Deletion</h3>
                  <p className="text-sm text-muted-foreground">
                    To delete your account completely, please contact support at{" "}
                    <a
                      href="mailto:support@kidscallhome.com"
                      className="text-primary hover:underline"
                    >
                      support@kidscallhome.com
                    </a>
                    . Account deletion will permanently remove all your data,
                    including children's accounts, messages, and call history.
                  </p>
                </div>
              </div>
            </Card>
          </section>

          {/* Section 6: Personal Information Removal */}
          <section id="removal" className="mb-8 scroll-mt-20">
            <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Personal Information Removal
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">
                    Requesting Data Deletion
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    You can request deletion of your personal information and
                    account data in the following ways:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
                    <li>
                      <strong>Email Request:</strong> Send an email to{" "}
                      <a
                        href="mailto:support@kidscallhome.com"
                        className="text-primary hover:underline"
                      >
                        support@kidscallhome.com
                      </a>{" "}
                      with the subject "Account Deletion Request" and include
                      your account email address.
                    </li>
                    <li>
                      <strong>In-App Request:</strong> Contact support through
                      the app's support section (see Contact & Support below).
                    </li>
                  </ul>
                </div>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">What Gets Deleted</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    When you request account deletion, the following data will
                    be permanently removed:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    <li>
                      Parent account information (email, name, profile data)
                    </li>
                    <li>
                      All children's accounts associated with your parent
                      account
                    </li>
                    <li>All messages and call history</li>
                    <li>Device registration information</li>
                    <li>
                      Subscription and payment information (after required
                      retention period)
                    </li>
                  </ul>
                </div>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Response Time</h3>
                  <p className="text-sm text-muted-foreground">
                    We typically process deletion requests within{" "}
                    <strong>7-14 business days</strong>. You will receive a
                    confirmation email once your data has been deleted. Some
                    data may be retained for legal or regulatory compliance
                    purposes for a limited time, but will not be used for
                    service purposes.
                  </p>
                </div>
                <Separator />
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm font-semibold mb-1">Important Note</p>
                  <p className="text-xs text-muted-foreground">
                    Account deletion is permanent and cannot be undone. Make
                    sure you want to delete your account before submitting a
                    request.
                  </p>
                </div>
              </div>
            </Card>
          </section>

          {/* Section 7: Contact & Support */}
          <section id="contact" className="mb-8 scroll-mt-20">
            <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Contact & Support
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Support Email</h3>
                  <div className="bg-muted p-4 rounded-lg mb-3">
                    <p className="font-mono text-base">
                      support@kidscallhome.com
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    For technical support, account questions, billing inquiries,
                    or data deletion requests, please email us at the address
                    above. We aim to respond within 24-48 hours.
                  </p>
                </div>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">
                    What to Include in Support Emails
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    <li>Your account email address</li>
                    <li>Description of the issue or request</li>
                    <li>
                      Device type and browser/app version (if reporting a
                      technical issue)
                    </li>
                    <li>Screenshots (if applicable)</li>
                  </ul>
                </div>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Common Support Topics</h3>
                  <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Account setup and login issues</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Subscription and billing questions</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Video call connection problems</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Data deletion requests</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Privacy and security concerns</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Feature requests and feedback</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* Section 8: Demo/Test Account Info (Optional - for store reviewers) */}
          <section id="demo" className="mb-8 scroll-mt-20">
            <Card className="p-6 border-dashed">
              <h2 className="text-2xl font-semibold mb-4">
                Demo / Test Account
              </h2>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  For app store reviewers: The app requires account creation to
                  use. You can create a free parent account and add one child
                  account at no cost. For testing premium features, please
                  contact support for test account credentials.
                </p>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <strong>Note:</strong> Test account information is available
                    upon request for app store review purposes. Please contact{" "}
                    <a
                      href="mailto:support@kidscallhome.com"
                      className="text-primary hover:underline"
                    >
                      support@kidscallhome.com
                    </a>{" "}
                    with your review request.
                  </p>
                </div>
              </div>
            </Card>
          </section>

          {/* Back to Top */}
          <div className="text-center pt-8">
            <Button variant="outline" onClick={scrollToTop}>
              Back to Top
            </Button>
          </div>
        </div>
      </div>

      {/* Floating Navigation Button */}
      {showFloatingNav && (
        <div
          className="fixed right-6 z-50 flex flex-col gap-2"
          style={{
            bottom: `calc(1.5rem + var(--safe-area-inset-bottom))`,
          }}
        >
          {/* Back to App Button - Floating */}
          {!loading && (
            <Button
              onClick={() => navigate(getHomeRoute())}
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg"
              aria-label="Back to App"
              title={
                userType === "parent"
                  ? "Back to Parent Home"
                  : userType === "child"
                  ? "Back to Kid Home"
                  : "Back to App"
              }
            >
              <Home className="h-6 w-6" />
            </Button>
          )}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                size="lg"
                className="h-14 w-14 rounded-full shadow-lg"
                aria-label="Open navigation menu"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>Navigate to Section</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-2">
                {sections.map((section) => (
                  <Button
                    key={section.id}
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => scrollToSection(section.id)}
                  >
                    {section.label}
                  </Button>
                ))}
                <div className="pt-4 border-t mt-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={scrollToTop}
                  >
                    <ArrowUp className="mr-2 h-4 w-4" />
                    Back to Top
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}
    </div>
  );
};

export default Info;
