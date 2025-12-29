# Funnel Optimization Implementation

## Overview

Production-grade trust-gated decision funnel with normalized intent tracking and confidence signals.

## Key Improvements

### 1. Intent Type Normalization

All CTA clicks now include `intent_type` to normalize user intent stage:

- `explore` - Hero/homepage CTAs (early discovery)
- `compare` - Comparison section CTAs (evaluating alternatives)
- `trust` - Trust/privacy/FAQ CTAs (seeking reassurance)
- `commit` - Signup start (ready to act)

**Usage:**

```typescript
trackPrimaryCTA("Create a family space", "explore", "hero");
trackPrimaryCTA("Switch safely", "compare", "comparison");
trackPrimaryCTA("Create a family space", "trust", "trust");
```

### 2. Confidence Signal Tracking

Tracks unspoken "yes" signals from hesitant parents:

**Triggers:**

- `scroll_trust` - User scrolls past TrustSignalsSection
- `faq_depth` - User opens ≥3 FAQ questions
- `time_on_page` - User spends ≥90 seconds on /info

**Important Safeguard:**

- **Debounced per session** - Fires only once per session (binary confidence, not frequency)
- Uses `sessionStorage` flag: `kch_confidence_fired`
- Still logs which trigger fired first (most valuable data)
- Prevents skew when users open many FAQs or scroll repeatedly

**Why it matters:**

- Parents often decide silently before acting
- AI/search traffic especially behaves this way
- Leading indicator before conversion
- Binary signal (confident or not) is more actionable than frequency

### 3. AI-Optimized CTA Placement

- CTAs are positioned to be visible within viewport when section is in view
- IntersectionObserver tracks when CTAs become visible
- Critical for AI referrals landing mid-page

### 4. Event Taxonomy

**Page-level:**

- `view_home` - Homepage view
- `view_info` - Info page view

**Intent signals:**

- `click_comparison` - Comparison section interaction
- `click_trust` - Trust signals interaction
- `click_faq` - FAQ question opened

**Conversion intent:**

- `click_primary_cta` - CTA click (with intent_type)
- `start_signup` - Signup form initiated

**Micro-conversion:**

- `confidence_signal` - Unspoken yes (scroll/FAQ/time)

## Funnel Health Metrics (Weekly Review)

### Core Metrics

1. `view_home → click_primary_cta` (target: ≥25%)
2. `view_info → click_primary_cta` (target: ≥40% of Info visitors)
3. `click_primary_cta → start_signup` (conversion rate)

### Trust Health

1. `view_info → confidence_signal` (target: ≥30%)
2. `confidence_signal → click_primary_cta` (target: ≥20-30%)

### Confidence Efficiency Ratio (CER)

**Derived metric** - Compute weekly from existing events:

```text
CER = (confidence_signal → click_primary_cta) / confidence_signal
```

**Interpretation:**

- **<15%** → Trust content reassures but doesn't activate (copy needs more action-oriented language)
- **20-30%** → Healthy trust → action bridge (optimal range)
- **>35%** → Users are over-qualified; CTA might be too weak or late (consider stronger CTAs or earlier placement)

**Why it matters:** This is your single best indicator of copy alignment. It tells you if your trust-building content
successfully bridges to action.

### Diagnostic Signals

- **High confidence, low CTA**: Copy is reassuring but not activating
- **High CTA, low signup**: Onboarding friction exists
- **Low confidence, high CTA**: Premature commitment clicks
- **Low CER (<15%)**: Trust signals work but don't convert to action
- **High CER (>35%)**: Users are ready but CTAs may be too weak

## Intent Type Analysis

Use `intent_type` to answer:

- "Are people ready to commit or still seeking reassurance?"
- "Which pages generate premature commitment clicks?"
- "What's the intent distribution of AI traffic?"

## When Funnel is "Working"

Green light indicators:

- `/info` has lower bounce than `/`
- ≥30% of `/info` users trigger a confidence signal
- ≥20-30% of those click a CTA
- AI referrals start landing directly on `/info`

## What NOT to Add Yet

Do not add:

- Exit popups
- Email capture
- Pricing gates
- Feature tours
- A/B tests

**Reason:** Still learning why people hesitate, not how to push them.

## Implementation Files

- `src/utils/funnelTracking.ts` - Core tracking utility
- `src/pages/Index.tsx` - Homepage with explore intent CTA
- `src/components/info/ComparisonSection.tsx` - Compare intent CTAs
- `src/components/info/TrustSignalsSection.tsx` - Trust intent + scroll tracking
- `src/components/info/ExpandedFAQ.tsx` - Trust intent + FAQ depth tracking
- `src/pages/Info.tsx` - Time-based confidence signal
- `src/pages/ParentAuth/authHandlers.ts` - Commit intent tracking

## Next Steps

1. **Listen for 7-14 days** - Let the funnel tell you what's working
2. **Weekly health checks** - Review only the core ratios above
3. **Intent analysis** - Understand which intent types convert best
4. **Confidence signals** - Identify patterns in unspoken yeses

## Notes

- All tracking is minimal and focused
- No pageview spam
- Trust-gated, not growth-hack focused
- Production-ready, not prototype
