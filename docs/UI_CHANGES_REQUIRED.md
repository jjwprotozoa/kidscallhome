# Obvious UI Changes Required for Family Communication System

## 🎯 High Priority - User-Facing Changes

### 1. **Onboarding Flow - Family Setup Selection** ✅ (Created, needs integration)

**Location**: After parent signup, before dashboard access

**Changes**:

- Add `FamilySetupSelection` component to signup flow
- Show after parent account creation
- Two options:
  - ☐ "We live together as one household" (Single Household)
  - ☐ "We live in separate households" (Two Households)
- Save selection to `families.household_type`
- **File**: `src/pages/ParentAuth.tsx` or `src/pages/SetupPage.tsx`

---

### 2. **Parent Dashboard - New Tabs/Sections**

#### A. **Family Setup Tab** (NEW)

**Location**: `src/pages/ParentDashboard.tsx` - Add new tab

**Content**:

- Display current household type (Single/Two Household)
- Show linked family status (if two-household)
- "Link Family" button (for two-household, to link with co-parent)
- "Unlink Family" button (if linked)
- Household type cannot be changed after initial setup (or with warning)

#### B. **Child Connections Tab** (NEW)

**Location**: `src/pages/ParentDashboard.tsx` - Add new tab

**Content**:

- List of pending child-to-child connection requests
- Show: Child name, other child name, requested by (parent/child), status
- "Approve" / "Reject" buttons for pending requests
- List of approved connections
- "Request Connection" button to connect children
- For two-household: Show which parent approved

#### C. **Safety & Reports Tab** (NEW)

**Location**: `src/pages/ParentDashboard.tsx` - Add new tab

**Content**:

- **Blocked Contacts Section**:
  - List of contacts blocked by children
  - Show: Child name, blocked contact name, reason (if provided), date blocked
  - "Unblock" button (with confirmation)
  - "Remove from Family" button (permanently remove family member)
- **Reports Section**:
  - List of reports from children
  - Show: Child name, reported contact, report type, message, date
  - Status badges: Pending, Reviewed, Resolved, Dismissed
  - "Review" button to mark as reviewed
  - "Resolve" / "Dismiss" buttons
- **Safety Mode Settings**:
  - Toggle: "Enable Safety Mode"
  - Options (when enabled):
    - ☐ Keyword alerts
    - ☐ AI content scanning
    - ☐ Export conversations
    - Alert threshold: Low / Medium / High

---

### 3. **Child Dashboard - Block & Report Buttons** ✅ (Component created, needs integration)

**Location**: `src/pages/ChildDashboard.tsx` - On each contact card

**Changes**:

- Add "Block & Report" button to each contact (parent, family member, or other child)
- Button should be visible but not prominent (maybe in contact card menu)
- When clicked, opens `BlockAndReportButton` dialog
- Show blocked status indicator on blocked contacts
- Disable call/message buttons for blocked contacts

**Visual Indicators**:

- 🚫 Icon on blocked contacts
- Grayed out contact cards for blocked contacts
- Tooltip: "This contact is blocked"

---

### 4. **Child Dashboard - Approved Peers Section** (NEW)

**Location**: `src/pages/ChildDashboard.tsx` - New section

**Content**:

- Show list of approved child connections (other children they can communicate with)
- Only show children that both parents approved
- Show connection status (if pending approval from other parent)
- "Request Connection" button (for children 10+ with supervised friending enabled)

---

### 5. **Chat Page - Permission Errors** (NEW)

**Location**: `src/pages/Chat.tsx` and `src/features/messaging/components/MessageInput.tsx`

**Changes**:

- Check permissions before allowing message send
- Show error messages:
  - "This contact is blocked"
  - "Child-to-child communication requires parent approval"
  - "Adults cannot message other adults"
- Disable send button when communication is not allowed
- Show reason in UI

---

### 6. **Call Screens - Permission Checks** (NEW)

**Location**:

- `src/pages/ParentCallScreen.tsx`
- `src/pages/ChildCallScreen.tsx`
- `src/features/calls/hooks/useVideoCall.ts`

**Changes**:

- Check permissions before initiating call
- Show error dialogs:
  - "Cannot call: This contact is blocked"
  - "Cannot call: Child-to-child communication requires parent approval"
  - "Adults cannot call other adults"
- Prevent call initiation if blocked
- Show blocked status in contact list

---

### 7. **Parent Dashboard - Family Members Tab Updates**

**Location**: `src/features/family/components/FamilyTab.tsx`

**Changes**:

- Add relationship type display (Grandparent, Aunt, Uncle, Cousin, Other)
- Show if family member is blocked by any child
- Add "View Reports" link if family member has reports
- Show communication status (can/cannot communicate with children)

---

### 8. **Navigation - New Menu Items**

**Location**: `src/components/Navigation.tsx`

**Changes**:

- For Parents: Add "Family Setup" link (if not set up yet)
- For Parents: Add "Safety & Reports" link
- For Parents: Add "Child Connections" link
- Show notification badges for:
  - Pending connection requests
  - New reports
  - New blocked contacts

---

### 9. **Contact Lists - Visual Indicators**

**Location**:

- `src/pages/ChildDashboard.tsx` (contact cards)
- `src/pages/ParentDashboard.tsx` (children list)
- `src/pages/FamilyMemberDashboard.tsx` (children list)

**Changes**:

- Show 🚫 icon on blocked contacts
- Show ⏳ icon on pending child connections
- Show ✅ icon on approved child connections
- Gray out blocked contacts
- Show tooltips explaining status

---

### 10. **Settings Page - Family Settings Section** (NEW)

**Location**: `src/pages/AccountSettings.tsx` or new `src/pages/FamilySettings.tsx`

**Content**:

- **Household Type**: Display current type (read-only after setup)
- **Linked Families**: Show linked family info (if two-household)
- **Safety Mode**: Toggle and settings
- **Child Communication**:
  - Enable/disable supervised friending (for children 10+)
  - View child connection requests

---

## 🎨 UI Component Changes

### New Components Needed:

1. ✅ `FamilySetupSelection.tsx` - Created
2. ✅ `BlockAndReportButton.tsx` - Created
3. ❌ `ChildConnectionRequest.tsx` - List and manage connection requests
4. ❌ `ChildConnectionList.tsx` - Show approved connections
5. ❌ `BlockedContactsList.tsx` - Show blocked contacts for parents
6. ❌ `ReportsList.tsx` - Show reports for parents
7. ❌ `SafetyModeSettings.tsx` - Safety mode configuration
8. ❌ `FamilyLinkDialog.tsx` - Link/unlink families (two-household)
9. ❌ `PermissionErrorDialog.tsx` - Show permission errors

### Components to Update:

1. `ParentDashboard.tsx` - Add new tabs
2. `ChildDashboard.tsx` - Add block/report buttons, approved peers section
3. `Chat.tsx` - Add permission checks
4. `useVideoCall.ts` - Add permission checks
5. `FamilyTab.tsx` - Add relationship type, blocked status
6. `Navigation.tsx` - Add new menu items
7. `MessageInput.tsx` - Disable if blocked
8. Contact cards - Add status indicators

---

## 📱 Mobile/Responsive Considerations

- Block/Report button should be easily accessible but not accidentally clickable
- Connection requests should be swipeable (approve/reject)
- Reports should be expandable to see full details
- Safety mode settings should be in collapsible sections

---

## 🔔 Notification Changes

### New Notifications Needed:

1. **Parent Notification**: "Your child [Name] blocked [Contact Name]"
2. **Parent Notification**: "Your child [Name] reported [Contact Name]"
3. **Parent Notification**: "New child connection request from [Child Name]"
4. **Parent Notification**: "[Other Parent] approved child connection"
5. **Child Notification**: "Your connection request to [Child Name] was approved"

---

## 🚫 Error States & Edge Cases

### Error Messages to Add:

1. "This contact has been blocked"
2. "Child-to-child communication requires approval from both parents"
3. "Adults cannot communicate with other adults in this app"
4. "This contact is not approved to communicate with your child"
5. "Connection request is pending approval"

### Loading States:

- "Checking permissions..."
- "Loading connection requests..."
- "Loading reports..."

---

## 📊 Summary of Changes by Page

| Page                 | Changes Required                                                |
| -------------------- | --------------------------------------------------------------- |
| **ParentAuth/Setup** | Add family setup selection                                      |
| **ParentDashboard**  | 3 new tabs: Family Setup, Child Connections, Safety & Reports   |
| **ChildDashboard**   | Block/Report buttons, Approved Peers section, Status indicators |
| **Chat**             | Permission checks, Error messages, Disable blocked contacts     |
| **Call Screens**     | Permission checks, Error dialogs, Blocked contact handling      |
| **FamilyTab**        | Relationship types, Blocked status, Reports link                |
| **Navigation**       | New menu items, Notification badges                             |
| **Settings**         | Family settings section, Safety mode                            |

---

## 🎯 Implementation Priority

1. **P0 (Critical)**:

   - Permission checks in Chat and Calls
   - Block/Report buttons on Child Dashboard
   - Error messages for blocked contacts

2. **P1 (High)**:

   - Family Setup onboarding
   - Parent Dashboard new tabs
   - Child connection management

3. **P2 (Medium)**:

   - Safety mode settings
   - Reports review UI
   - Family linking UI

4. **P3 (Low)**:
   - Notification enhancements
   - Advanced safety features
   - Analytics/insights











