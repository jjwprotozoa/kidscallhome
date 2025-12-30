// src/pages/Privacy.tsx
// Privacy policy page for Kids Call Home

import { Link } from "react-router-dom";
import { Shield, Lock, Eye } from "lucide-react";

const Privacy = () => {
  return (
    <main className="min-h-[100dvh] bg-background">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">
            Privacy Policy
          </h1>

          <section className="space-y-6 mb-8">
            <p className="text-muted-foreground">
              Kids Call Home is built with privacy and safety as core principles. This page outlines how we handle your family's data.
            </p>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Data We Collect</h2>
              <p className="text-muted-foreground">
                We collect only the minimal data necessary for the service to function:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Account information (parent email, child's display name and avatar)</li>
                <li>Contact relationships (which family members are approved)</li>
                <li>Call and message metadata (who called whom, when, duration—not the content)</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Data We Don't Collect</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Location data (unless you explicitly enable it)</li>
                <li>Browsing history</li>
                <li>Device contacts</li>
                <li>Biometric data</li>
                <li>Any data for advertising purposes</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">How We Protect Your Data</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">Encrypted Communication</h3>
                    <p className="text-sm text-muted-foreground">
                      Calls and messages are encrypted in transit to protect your family's communication.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">No Data Sales</h3>
                    <p className="text-sm text-muted-foreground">
                      We never sell your family's data to advertisers or partners.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Eye className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">No Tracking</h3>
                    <p className="text-sm text-muted-foreground">
                      We don't use tracking for advertising purposes.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Your Rights</h2>
              <p className="text-muted-foreground">
                You can request access to, correction of, or deletion of your data at any time. Contact us through the app or website for assistance.
              </p>
            </div>
          </section>

          <div className="border-t pt-6 mt-8">
            <Link
              to="/"
              className="inline-block text-sm text-primary hover:underline"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Privacy;



