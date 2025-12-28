// src/data/infoSections.ts
// Purpose: Section definitions for Info page

export interface Section {
  id: string;
  label: string;
}

export const infoSections: Section[] = [
  { id: "overview", label: "App Description" },
  { id: "beta", label: "Beta Testing" },
  { id: "pricing", label: "Pricing & Subscription" },
  { id: "terms", label: "Terms & Conditions" },
  { id: "privacy", label: "Privacy Policy" },
  { id: "security", label: "Security & Safety" },
  { id: "cancellation", label: "Cancellation Policy" },
  { id: "data-removal", label: "Personal Information Removal" },
  { id: "contact", label: "Contact & Support" },
  { id: "demo", label: "Demo / Test Account" },
  { id: "referrals", label: "Referrals" },
  { id: "faq", label: "FAQ" },
];
