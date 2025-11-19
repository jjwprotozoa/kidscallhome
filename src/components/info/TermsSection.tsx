// src/components/info/TermsSection.tsx
// Purpose: Terms and conditions section for Info page

import { Card } from "@/components/ui/card";
import { FileText } from "lucide-react";

export const TermsSection = () => {
  return (
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
  );
};

