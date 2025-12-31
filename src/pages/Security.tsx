// src/pages/Security.tsx
// Security information page for Kids Call Home

import { Link } from "react-router-dom";
import { Shield, Lock, Eye } from "lucide-react";

const Security = () => {
  return (
    <main className="min-h-[100dvh] bg-background">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">
            Security
          </h1>

          <section className="space-y-6 mb-8">
            <p className="text-muted-foreground">
              Kids Call Home is designed with security and privacy as top priorities. Here's how we protect your family's communication.
            </p>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Encryption</h2>
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground">
                    All calls and messages are encrypted in transit using industry-standard encryption protocols. This means your family's conversations are protected while traveling over the internet.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Access Control</h2>
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground">
                    Parents have complete control over who can contact their child. Only approved family members can connect, and there's no way for strangers or unapproved contacts to reach your child.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Data Protection</h2>
              <div className="flex items-start gap-3">
                <Eye className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground">
                    We collect only the minimal data necessary for the service to function. We don't track your family for advertising, and we never sell your data to third parties.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Account Security</h2>
              <p className="text-muted-foreground">
                We use secure authentication methods to protect your account. Parents control access through email verification, and kids use simple, memorable codes that are managed securely.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Regular Updates</h2>
              <p className="text-muted-foreground">
                We regularly update the service to address security vulnerabilities and improve protection. We recommend keeping the app updated to the latest version.
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

export default Security;




