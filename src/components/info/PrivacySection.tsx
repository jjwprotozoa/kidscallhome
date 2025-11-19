// src/components/info/PrivacySection.tsx
// Purpose: Privacy policy section for Info page

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield } from "lucide-react";

export const PrivacySection = () => {
  return (
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
  );
};

