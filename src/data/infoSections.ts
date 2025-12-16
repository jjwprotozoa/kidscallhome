// src/data/infoSections.ts
// Purpose: Section definitions for Info page

export interface Section {
  id: string;
  label: string;
}

export const infoSections: Section[] = [
  { id: "description", label: "App Description" },
  { id: "beta-testing", label: "Beta Testing" },
  { id: "pricing", label: "Pricing & Subscription" },
  { id: "terms", label: "Terms & Conditions" },
  { id: "privacy", label: "Privacy Policy" },
  { id: "security", label: "Security & Safety" },
  { id: "cancel", label: "Cancellation Policy" },
  { id: "removal", label: "Personal Information Removal" },
  { id: "contact", label: "Contact & Support" },
  { id: "demo", label: "Demo / Test Account" },
];
