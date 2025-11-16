# Calls Directory Protection Setup

## ✅ Protection Mechanisms Installed

The `src/features/calls/` directory is now protected with multiple layers of verification:

### 1. `.cursorrules` (Root Directory)
- **Purpose**: Instructs Cursor AI to require double verification before changes
- **Location**: `.cursorrules` at project root
- **Effect**: Cursor AI will see warnings and require explicit confirmation

### 2. `PROTECTED.md` (Calls Directory)
- **Purpose**: Detailed protection rules and verification process
- **Location**: `src/features/calls/PROTECTED.md`
- **Content**: 
  - Protection rules
  - Verification checklist
  - Allowed vs prohibited changes
  - Emergency override procedures

### 3. `README.md` Updates
- **Purpose**: Visible warning at the top of technical documentation
- **Location**: `src/features/calls/README.md`
- **Content**: Warning banner and status indicator

### 4. Verification Scripts
- **Purpose**: Manual verification before making changes
- **Location**: 
  - `scripts/verify-calls-directory.sh` (Unix/Linux/Mac)
  - `scripts/verify-calls-directory.ps1` (Windows PowerShell)
- **Usage**: Run before making changes to check status

---

## 🔒 How Protection Works

### For Cursor AI:
1. Cursor reads `.cursorrules` and sees protection rules
2. Before modifying files in `src/features/calls/`, Cursor will:
   - Read `PROTECTED.md`
   - Explain the change needed
   - Wait for user confirmation
   - Show diff preview
   - Get explicit "Yes, proceed" confirmation
   - Make the change

### For Human Developers:
1. Read `PROTECTED.md` before making changes
2. Follow the verification checklist
3. Get explicit approval if working with others
4. Test thoroughly after changes

---

## 📋 Verification Checklist

Before making ANY change to `src/features/calls/`:

- [ ] Read `PROTECTED.md` completely
- [ ] Read `README.md` to understand architecture
- [ ] Understand why the change is necessary
- [ ] Get user/team confirmation
- [ ] Review diff preview
- [ ] Get explicit approval
- [ ] Test parent→child calls
- [ ] Test child→parent calls
- [ ] Verify role detection still works
- [ ] Verify ICE routing still works
- [ ] Document the change

---

## 🚨 Emergency Override

If you absolutely must bypass protection:

1. Create backup branch: `git checkout -b backup-before-calls-changes`
2. Document why change is necessary
3. Get explicit approval
4. Make minimal changes
5. Test thoroughly
6. Document change in `PROTECTED.md`

---

## 📝 Files Protected

All files in `src/features/calls/` are protected:

- `hooks/useVideoCall.ts`
- `hooks/useWebRTC.ts`
- `hooks/useCallEngine.ts`
- `hooks/useIncomingCallNotifications.ts`
- `hooks/useAudioNotifications.ts`
- `utils/callHandlers.ts`
- `utils/childCallHandler.ts`
- `utils/callEnding.ts`
- `components/VideoCallUI.tsx`
- `components/CallControls.tsx`
- `types/call.ts`

---

## ✅ Status

**Protection Status**: ✅ **ACTIVE**

**Last Updated**: 2025-01-XX

**Restored From**: Commit `b6c35a4` ("Fix: Critical WebRTC role detection and connection state tracking")

---

## 🔗 Related Files

- `.cursorrules` - Cursor AI protection rules
- `PROTECTED.md` - Detailed protection documentation
- `README.md` - Technical documentation
- `../../CALLS_TEST_PLAN.md` - Manual testing procedures
- `../../docs/webrtc-calls-overview.md` - High-level overview

