// src/components/info/ContactSection.tsx
// Purpose: Contact and support section for Info page

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Check, Mail } from "lucide-react";

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
  );
};

