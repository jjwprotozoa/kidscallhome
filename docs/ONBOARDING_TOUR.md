# Onboarding Tour System

## Overview

The onboarding tour system provides a role-aware, interactive guide that walks users through key features of their dashboard. The design philosophy is: **very clear the first time, invisible after that**.

### Key Features

- **Role-aware**: Different tours for parents vs. children with appropriate language
- **Non-blocking**: Never interferes with call buttons or video UI
- **Skippable**: Users can skip at any time
- **Persistent**: Uses localStorage to remember completion status
- **Zero DB usage**: No database reads or writes
- **Easy to disable**: Can be removed by deleting the feature folder

## Architecture

The onboarding system is organized as a self-contained feature in `src/features/onboarding/`:

```
src/features/onboarding/
├── onboardingConfig.ts      # Tour step definitions
├── useOnboardingTour.ts     # State management hook
├── OnboardingTour.tsx       # Main UI component
└── HelpBubble.tsx           # Persistent help button
```

## How It Works

### 1. Configuration (`onboardingConfig.ts`)

Tour steps are defined in configuration files with:
- **id**: Unique identifier for the step
- **selector**: CSS selector to find the target element (uses `data-tour` attributes)
- **title**: Optional title (typically for parents)
- **description**: The text shown in the speech bubble
- **placement**: Where the bubble appears relative to the target (top/bottom/left/right)

### 2. State Management (`useOnboardingTour.ts`)

The hook manages:
- Whether the tour should run (checks localStorage)
- Current step index
- Navigation (next, back, skip, finish)
- Completion tracking (stores in localStorage with key: `kch_tour_{role}_{pageKey}_done`)

### 3. UI Component (`OnboardingTour.tsx`)

Renders:
- Semi-transparent backdrop (clicking skips tour)
- Highlighted target element (outline effect)
- Speech bubble positioned near target
- Navigation buttons (Back, Next/Got it, Skip)

### 4. Help Bubble (`HelpBubble.tsx`)

A persistent "?" button in the bottom-right corner that:
- Only appears after tour completion
- Allows users to re-run the tour
- Hides automatically when tour is running

## Adding/Modifying Steps

### Adding a New Step

1. **Add the step to config** (`onboardingConfig.ts`):

```typescript
{
  id: "parent-new-feature",
  selector: '[data-tour="parent-new-feature"]',
  title: "New Feature", // Optional, parent only
  description: "This is what this feature does.",
  placement: "bottom",
}
```

2. **Add data-tour attribute** to the target element:

```tsx
<Button data-tour="parent-new-feature" onClick={...}>
  New Feature
</Button>
```

3. **Add the step to the tour array** in `onboardingConfig.ts`:

```typescript
export const parentDashboardTour: OnboardingStep[] = [
  // ... existing steps
  {
    id: "parent-new-feature",
    selector: '[data-tour="parent-new-feature"]',
    description: "This is what this feature does.",
    placement: "bottom",
  },
];
```

### Modifying Text

Edit the `description` (and optional `title`) fields in `onboardingConfig.ts`:

- **For parents**: Use clear, descriptive sentences (1-2 lines)
- **For children**: Use short, friendly phrases with emojis allowed

### Changing Step Order

Reorder the arrays in `onboardingConfig.ts`. Steps are shown in array order.

## Disabling Tours

### Temporarily Disable

Set localStorage keys to `"true"`:

```javascript
localStorage.setItem("kch_tour_parent_parent_dashboard_done", "true");
localStorage.setItem("kch_tour_child_child_dashboard_done", "true");
```

### Permanently Remove

1. Remove tour components from dashboards:
   - Remove `<OnboardingTour />` and `<HelpBubble />` imports and usage
   - Remove from `ParentDashboard.tsx` and `ChildDashboard.tsx`

2. Optionally remove data-tour attributes (not required, but cleans up code)

3. Delete the feature folder: `src/features/onboarding/`

## Current Tour Steps

### Parent Dashboard Tour

1. **Call Button** (`parent-call-button`)
   - Target: Call button on child card
   - Message: "Tap your child's name to start a video call."

2. **Status Indicator** (`parent-status-indicator`)
   - Target: First child card
   - Message: "Green dot = they're online and available."

3. **Messages** (`parent-messages`)
   - Target: Chat button on child card
   - Message: "Use messages for quick notes when they can't talk."

4. **Menu** (`parent-menu`)
   - Target: Logout button in navigation
   - Message: "Menu has settings and help."

### Child Dashboard Tour

1. **Answer Button** (`child-answer-button`)
   - Target: Main call card
   - Message: "Tap this to talk to mom or dad. 👋"

2. **Messages** (`child-messages`)
   - Target: Message card
   - Message: "Tap here to see messages. 💬"

3. **Help** (`child-help`)
   - Target: Logout button in navigation
   - Message: "Stuck? Tap the question mark. ❓"

## Technical Details

### Storage Keys

Format: `kch_tour_{role}_{pageKey}_done`

Examples:
- `kch_tour_parent_parent_dashboard_done`
- `kch_tour_child_child_dashboard_done`

### Z-Index Layers

- Backdrop: `z-[10000]`
- Target element highlight: `z-[10001]`
- Speech bubble: `z-[10002]`
- Help bubble: `z-50`

### Positioning

The speech bubble automatically:
- Positions based on `placement` preference
- Adjusts to stay within viewport bounds
- Updates on window resize and scroll

### Element Not Found Handling

If a target element is not found:
- Logs a warning to console
- Automatically advances to next step after 100ms
- Prevents tour from crashing

## Best Practices

1. **Keep tours short**: 3-4 steps maximum per page
2. **Use clear selectors**: Prefer stable `data-tour` attributes over CSS classes
3. **Test element visibility**: Ensure target elements exist before tour starts
4. **Avoid call-critical elements**: Don't target elements that block calls
5. **Role-appropriate language**: Parents get detailed text, children get simple phrases

## Troubleshooting

### Tour doesn't start

- Check localStorage: `localStorage.getItem("kch_tour_parent_parent_dashboard_done")`
- Verify element exists: Check browser console for selector warnings
- Check component is mounted: Verify `<OnboardingTour />` is in the component tree

### Element not highlighting

- Verify `data-tour` attribute matches selector exactly
- Check element is visible (not hidden by CSS)
- Ensure element exists when tour starts (may need to wait for data load)

### Bubble positioning issues

- Check viewport size (may need responsive adjustments)
- Verify `placement` value is valid
- Check for CSS conflicts (z-index, positioning)

## Future Enhancements

Potential improvements:
- Multi-page tours (guide across multiple screens)
- Analytics tracking (optional, with user consent)
- Customizable tour triggers (button vs. auto-start)
- Tour progress persistence across sessions
- Accessibility improvements (keyboard navigation, screen reader support)

