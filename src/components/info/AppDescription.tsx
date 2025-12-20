// src/components/info/AppDescription.tsx
// Purpose: App description section for Info page

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getAppVersion } from "@/utils/appVersion";
import { Info as InfoIcon } from "lucide-react";
import { useEffect, useState } from "react";

export const AppDescription = () => {
  const [appVersion, setAppVersion] = useState<string>("");

  useEffect(() => {
    const loadVersion = async () => {
      const version = await getAppVersion();
      setAppVersion(version);
    };
    loadVersion();
  }, []);

  return (
    <section id="description" className="mb-8 scroll-mt-20">
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <InfoIcon className="h-5 w-5" />
          App Description
        </h2>
        <div className="space-y-4">
          {appVersion && (
            <>
              <div>
                <h3 className="font-semibold mb-2">App Version</h3>
                <p className="text-muted-foreground font-mono">{appVersion}</p>
              </div>
              <Separator />
            </>
          )}
          <div>
            <h3 className="font-semibold mb-2">Short Description</h3>
            <p className="text-muted-foreground">
              Learn how Kids Call Home helps kids safely call and message
              parents and family on most phones and tablets, without a phone
              number, social media account, or passwords to remember.
            </p>
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2">Full Description</h3>
            <p className="text-muted-foreground leading-relaxed">
              Kids Call Home is a kids call parents app built by a long‑distance
              parent who needed a simple, reliable way for his children to call
              him from any home, country, or device. The app is designed as a
              safe kids messenger and family communication tool, not a social
              network: there are no public profiles, no strangers, no filters
              hiding faces, and no addictive feeds. Parents can create accounts
              and manage their children's access, while family members
              (grandparents, aunts, uncles, and other trusted adults) can be
              invited to connect with children. Kids can easily call and message
              their parents and family members using a special login code. The
              app works on most phones and tablets over Wi‑Fi or mobile data,
              without requiring a phone number or SIM card. Perfect for tablets,
              iPads, Chromebooks, and other Wi‑Fi devices.
            </p>
          </div>
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Key Features</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Family-only video calls and messaging</li>
              <li>Parent-controlled contacts</li>
              <li>No public profiles or stranger contact</li>
              <li>Encrypted communication</li>
              <li>Works without SIM card or phone number</li>
              <li>Works on most phones and tablets, including many kids tablets and e-readers</li>
              <li>Co-parenting friendly and long-distance family friendly</li>
              <li>No ads, no filters, no data tracking</li>
              <li>Magic link login for kids (no passwords to remember)</li>
              <li>Real-time notifications</li>
              <li>Progressive Web App (PWA)</li>
              <li>Low-bandwidth optimization</li>
            </ul>
          </div>
        </div>
      </Card>
    </section>
  );
};
