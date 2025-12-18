// src/features/safety/components/SafetyReportsTab.tsx
// Tab component for viewing blocked contacts and safety reports

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { unblockContact } from "@/utils/family-communication";
import { BlockedContactsList } from "./BlockedContactsList";
import { ReportsList } from "./ReportsList";
import { SafetyModeSettings } from "./SafetyModeSettings";

export const SafetyReportsTab: React.FC = () => {
  return (
    <TabsContent value="safety" className="space-y-6 mt-6 min-h-[400px]">
      {/* Blocked Contacts Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Blocked Contacts</h2>
        <BlockedContactsList />
      </section>

      {/* Reports Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Reports</h2>
        <ReportsList />
      </section>

      {/* Safety Mode Settings */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Safety Mode</h2>
        <SafetyModeSettings />
      </section>
    </TabsContent>
  );
};

