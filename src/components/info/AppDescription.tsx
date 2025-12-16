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
              Stay connected with your family through simple video calls and
              messaging between parents, family members, and children.
            </p>
          </div>
          <Separator />
          <div>
            <h3 className="font-semibold mb-2">Full Description</h3>
            <p className="text-muted-foreground leading-relaxed">
              Kids Call Home is a family communication app that enables secure
              video calls and messaging between parents, family members, and
              children. Parents can create accounts and manage their children's
              access, while family members (grandparents, aunts, uncles, and
              other trusted adults) can be invited to connect with children.
              Kids can easily call and message their parents and family members
              using a special login code. The app works on WiFi-only devices (no
              SIM card required) and also supports devices with cellular data
              (LTE, 3G, 4G, 5G). Perfect for tablets, Chromebooks, and mobile
              devices.
            </p>
          </div>
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Key Features</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Video calls between parents, family members, and children</li>
              <li>Secure messaging</li>
              <li>Simple login codes for kids</li>
              <li>Parent account management</li>
              <li>Family member invitations and access control</li>
              <li>Real-time notifications</li>
              <li>Mobile-friendly interface</li>
              <li>Progressive Web App (PWA)</li>
              <li>Works without SIM card or phone number</li>
              <li>Low-bandwidth optimization</li>
            </ul>
          </div>
        </div>
      </Card>
    </section>
  );
};
