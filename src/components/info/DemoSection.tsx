// src/components/info/DemoSection.tsx
// Purpose: Demo/test account section for Info page

import { Card } from "@/components/ui/card";

export const DemoSection = () => {
  return (
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
  );
};

