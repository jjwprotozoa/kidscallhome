// src/pages/Terms.tsx
// Terms of Service page for Kids Call Home

import { Link } from "react-router-dom";

const Terms = () => {
  return (
    <main className="min-h-[100dvh] bg-background">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">
            Terms of Service
          </h1>

          <section className="space-y-6 mb-8">
            <p className="text-muted-foreground">
              By using Kids Call Home, you agree to these terms of service. Please read them carefully.
            </p>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Acceptable Use</h2>
              <p className="text-muted-foreground">
                Kids Call Home is designed for family communication only. You agree to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Use the service only for family communication</li>
                <li>Maintain control over who can contact your child</li>
                <li>Not use the service for commercial purposes</li>
                <li>Respect the privacy and safety of all users</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Parent Responsibilities</h2>
              <p className="text-muted-foreground">
                As a parent, you are responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Managing your child's approved contacts</li>
                <li>Ensuring your child uses the service appropriately</li>
                <li>Maintaining the security of your account</li>
                <li>Complying with applicable laws and regulations</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Service Availability</h2>
              <p className="text-muted-foreground">
                We strive to provide reliable service, but we cannot guarantee uninterrupted access. The service may be temporarily unavailable due to maintenance, updates, or circumstances beyond our control.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Changes to Terms</h2>
              <p className="text-muted-foreground">
                We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the new terms.
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

export default Terms;





