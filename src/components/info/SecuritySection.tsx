// src/components/info/SecuritySection.tsx
// Purpose: Security and safety section for Info page

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield } from "lucide-react";

export const SecuritySection = () => {
  return (
    <section id="security" className="mb-8 scroll-mt-20">
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security & Safety
        </h2>
        <div className="space-y-4">
          <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
            <p className="font-semibold text-primary mb-2">
              Your Family's Security is Our Priority
            </p>
            <p className="text-sm text-muted-foreground">
              We implement multiple layers of security to protect your family's data and communications.
            </p>
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2">Password Security</h3>
            <p className="text-sm text-muted-foreground mb-3">
              We enforce strong password requirements to protect your account:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
              <li>Minimum 8 characters in length</li>
              <li>Must include uppercase and lowercase letters</li>
              <li>Must include numbers and special characters</li>
              <li>Passwords are checked against known data breaches</li>
              <li>Common weak passwords are automatically rejected</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-3">
              Your password is never stored in plain text. We use industry-standard encryption (bcrypt) to securely hash and store passwords.
            </p>
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2">Account Protection</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Multiple security measures protect against unauthorized access:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
              <li>Rate limiting prevents brute force attacks</li>
              <li>Automatic account lockout after multiple failed login attempts</li>
              <li>CAPTCHA verification for suspicious activity</li>
              <li>Email breach checking alerts you if your email was compromised elsewhere</li>
              <li>Secure authentication using Supabase (enterprise-grade security)</li>
            </ul>
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2">Data Encryption</h3>
            <p className="text-sm text-muted-foreground mb-3">
              All your data is protected with encryption:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
              <li>Data at rest: Encrypted in our secure database (Supabase/PostgreSQL)</li>
              <li>Data in transit: All communications use HTTPS/TLS encryption</li>
              <li>Video calls: Use WebRTC peer-to-peer encryption when possible</li>
              <li>Messages: Encrypted during transmission</li>
            </ul>
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2">Secure Communication</h3>
            <p className="text-sm text-muted-foreground">
              Video calls use WebRTC technology, which establishes direct, encrypted connections between devices when possible. This means your video calls can go directly from your device to your child's device without passing through our servers, providing maximum privacy and security.
            </p>
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2">Access Control</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Strict access controls ensure only authorized users can access accounts:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
              <li>Parents control all child account access</li>
              <li>Children use secure login codes (not passwords)</li>
              <li>Device authorization required for new devices</li>
              <li>Parents can view and manage all authorized devices</li>
              <li>Row-level security ensures data isolation between families</li>
            </ul>
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2">What You Can Do</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Help keep your account secure:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
              <li>Use a strong, unique password (don't reuse passwords from other sites)</li>
              <li>Keep your login codes private and don't share them</li>
              <li>Regularly review authorized devices in Account Settings</li>
              <li>If you receive a breach warning, change your password immediately</li>
              <li>Contact support immediately if you suspect unauthorized access</li>
            </ul>
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2">Children's Safety</h3>
            <p className="text-muted-foreground">
              All children's accounts are created and managed by parents. Children can only communicate with authorized parent accounts. We do not allow children to communicate with strangers or create accounts independently. All communication is between family members only.
            </p>
          </div>
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Security is an ongoing priority. We regularly update our security measures and monitor for threats. If you have security concerns, please contact us at{" "}
              <a
                href="mailto:support@kidscallhome.com"
                className="text-primary hover:underline"
              >
                support@kidscallhome.com
              </a>
              .
            </p>
          </div>
        </div>
      </Card>
    </section>
  );
};

