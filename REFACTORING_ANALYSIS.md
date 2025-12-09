# Code Reorganization Analysis

## Files Exceeding 600 Lines

### Non-Protected Files (Can Refactor Immediately)

1. **Chat.tsx** - 1,294 lines
   - **Location**: `src/pages/Chat.tsx`
   - **Status**: ✅ Refactoring in progress
   - **Strategy**: 
     - Extract UI components (MessageBubble, ChatHeader, MessageInput, MessageList) ✅
     - Extract hooks (useChatInitialization, useMessageSending, useChatRealtime, useMarkMessagesRead)
     - Target: ~300-400 lines for main Chat.tsx

2. **ParentDashboard.tsx** - 960 lines
   - **Location**: `src/pages/ParentDashboard.tsx`
   - **Status**: ⏳ Pending
   - **Strategy**:
     - Extract ChildrenTab component (~200 lines)
     - Extract FamilyTab component (~200 lines)
     - Extract FamilyCodeCard component (~50 lines)
     - Extract handlers into custom hooks
     - Target: ~200-250 lines for main ParentDashboard.tsx

3. **DeviceManagement.tsx** - 851 lines
   - **Location**: `src/pages/DeviceManagement.tsx`
   - **Status**: ⏳ Pending
   - **Strategy**:
     - Extract ActiveDevicesTab component (~200 lines)
     - Extract DeviceHistoryTab component (~250 lines)
     - Extract device fetching logic into useDeviceManagement hook
     - Target: ~200-250 lines for main DeviceManagement.tsx

4. **Upgrade.tsx** - 788 lines
   - **Location**: `src/pages/Upgrade.tsx`
   - **Status**: ⏳ Pending
   - **Strategy**:
     - Extract PricingPlanCard component (~100 lines)
     - Extract EmailDialog component (~80 lines)
     - Extract SuccessDialog component (~30 lines)
     - Extract subscription logic into useSubscription hook
     - Target: ~200-250 lines for main Upgrade.tsx

### Protected Files (Require Approval)

1. **useVideoCall.ts** - ~1,000+ lines (estimated)
   - **Location**: `src/features/calls/hooks/useVideoCall.ts`
   - **Status**: ⚠️ PROTECTED - Requires explicit approval
   - **Note**: This file is in the protected calls directory. Any refactoring requires:
     1. User approval
     2. Backup creation
     3. Careful testing

2. **Other files in src/features/calls/**
   - All files in this directory are protected
   - Check line counts and ask for approval before refactoring

## Files Under 600 Lines (OK)

- ParentHome.tsx - 77 lines ✅
- AccountSettings.tsx - 427 lines ✅
- Info.tsx - ~196 lines ✅
- Most component files are under 600 lines ✅

## Refactoring Progress

### Phase 1: Chat.tsx Refactoring ✅ In Progress
- [x] Created MessageBubble component
- [x] Created ChatHeader component
- [x] Created MessageInput component
- [x] Created MessageList component
- [ ] Extract useChatInitialization hook
- [ ] Extract useMessageSending hook
- [ ] Extract useChatRealtime hook
- [ ] Extract useMarkMessagesRead hook
- [ ] Refactor main Chat.tsx to use components and hooks

### Phase 2: ParentDashboard.tsx Refactoring ⏳ Pending
- [ ] Extract ChildrenTab component
- [ ] Extract FamilyTab component
- [ ] Extract FamilyCodeCard component
- [ ] Extract family member handlers into hooks

### Phase 3: DeviceManagement.tsx Refactoring ⏳ Pending
- [ ] Extract ActiveDevicesTab component
- [ ] Extract DeviceHistoryTab component
- [ ] Extract useDeviceManagement hook

### Phase 4: Upgrade.tsx Refactoring ⏳ Pending
- [ ] Extract PricingPlanCard component
- [ ] Extract EmailDialog component
- [ ] Extract SuccessDialog component
- [ ] Extract useSubscription hook

## Next Steps

1. Complete Chat.tsx refactoring
2. Move to ParentDashboard.tsx
3. Continue with other large files
4. Check protected files and ask for approval if needed



