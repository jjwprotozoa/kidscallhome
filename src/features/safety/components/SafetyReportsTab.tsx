// src/features/safety/components/SafetyReportsTab.tsx
// Tab component for viewing blocked contacts and safety reports

import { BlockedContactsList } from "./BlockedContactsList";
import { ReportsList } from "./ReportsList";
import { SafetyModeSettings } from "./SafetyModeSettings";

export const SafetyReportsTab: React.FC = () => {
  return (
    <div className="space-y-6 min-h-[400px]">
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
    </div>
  );
};

