// src/components/info/ContactSection.tsx
// Purpose: Contact and support section for Info page

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Check, Mail, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

export const ContactSection = () => {
  return (
    <section id="contact" className="mb-8 scroll-mt-20">
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Contact & Support
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Submit Feedback or Get Support</h3>
            <div className="bg-muted p-4 rounded-lg mb-3">
              <p className="text-sm text-muted-foreground mb-3">
                Have questions, need help, or want to share feedback? Use our Beta Program feedback form to get in touch with our team.
              </p>
              <Button asChild className="w-full sm:w-auto">
                <Link to="/beta">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Go to Beta Program & Feedback
                </Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              For technical support, account questions, billing inquiries,
              or data deletion requests, please submit your request through the Beta Program page. We aim to respond within 24-48 hours.
            </p>
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2">
              What to Include in Your Feedback
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
  );
};

