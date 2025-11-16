# 🔒 PROTECTED DIRECTORY - DOUBLE VERIFICATION REQUIRED

## ⚠️ CRITICAL: This Directory is Protected

This directory (`src/features/calls/`) contains the **RESTORED WORKING** WebRTC call engine that was carefully restored from commit `b6c35a4` ("Fix: Critical WebRTC role detection and connection state tracking").

**ALL CALL FUNCTIONALITY DEPENDS ON THIS CODE WORKING CORRECTLY.**

---

## 🛡️ Protection Rules

### Before Making ANY Changes:

1. **Read this file completely**
2. **Read `README.md` in this directory** to understand the architecture
3. **Get explicit user confirmation** - ask TWICE:
   - First: Explain what needs to change and why
   - Second: Get explicit "Yes, proceed" confirmation

### Required Verification Process:

```
Step 1: Identify the change needed
Step 2: Explain the change to the user
Step 3: Wait for user confirmation
Step 4: Show a diff preview
Step 5: Get explicit "Yes, I approve" confirmation
Step 6: Make the change
Step 7: Verify tests/manual testing
```

---

## ✅ Allowed Changes (with double verification):

- **Bug fixes**: Only if functionality is clearly broken
- **Security fixes**: Critical security vulnerabilities
- **Performance fixes**: That don't change behavior or API
- **User-requested features**: Only with explicit user request

---

## ❌ Prohibited Changes:

- ❌ Refactoring for "clean code" or style
- ❌ Simplifying logic "for readability"
- ❌ Changing public API shapes
- ❌ Adding new features without explicit request
- ❌ "Improving" code structure
- ❌ Removing "unnecessary" code
- ❌ Changing variable/function names for style

---

## 📋 Files in This Directory:

### Core Hooks:
- `hooks/useVideoCall.ts` - Main call orchestration hook
- `hooks/useWebRTC.ts` - Core WebRTC peer connection management
- `hooks/useCallEngine.ts` - Call state machine
- `hooks/useIncomingCallNotifications.ts` - Incoming call notifications
- `hooks/useAudioNotifications.ts` - Audio notifications

### Handlers/Utils:
- `utils/callHandlers.ts` - Parent-side call handling
- `utils/childCallHandler.ts` - Child-side call handling
- `utils/callEnding.ts` - Call termination logic

### Components:
- `components/VideoCallUI.tsx` - Main video call UI
- `components/CallControls.tsx` - Call control buttons

### Types:
- `types/call.ts` - TypeScript type definitions

---

## 🔍 Why This Protection Exists:

1. **Stability**: This code was restored from a known-working commit
2. **Complexity**: WebRTC is complex and easy to break
3. **Critical Path**: All video/audio calls depend on this code
4. **History**: Previous "improvements" broke functionality

---

## 🚨 If You Must Make Changes:

### For AI Assistants (Cursor, GitHub Copilot, etc.):

1. **STOP** before modifying any file in this directory
2. **ASK** the user: "I need to modify `[file]` to `[reason]`. Is this necessary?"
3. **WAIT** for explicit confirmation
4. **SHOW** a diff preview
5. **GET** explicit approval: "Yes, proceed with this change"
6. **MAKE** the change
7. **VERIFY** functionality still works

### For Human Developers:

1. Read `README.md` to understand the architecture
2. Test your change thoroughly
3. Verify both parent→child and child→parent calls still work
4. Check that role detection and ICE routing are correct
5. Test manual scenarios from `CALLS_TEST_PLAN.md`

---

## 📝 Change Log:

All changes to this directory should be documented here:

- **2025-01-XX**: Directory created and protected
- **2025-01-XX**: Files restored from commit `b6c35a4`
- **2025-01-XX**: Files reorganized into `src/features/calls/`

---

## 🔗 Related Documentation:

- `README.md` - Detailed technical documentation
- `../../docs/webrtc-calls-overview.md` - High-level call flow overview
- `../../CALLS_TEST_PLAN.md` - Manual testing procedures

---

## ⚡ Emergency Override:

If you absolutely must bypass this protection:

1. Create a backup branch: `git checkout -b backup-before-calls-changes`
2. Document why the change is necessary
3. Get explicit user approval
4. Make minimal changes
5. Test thoroughly
6. Document the change in this file

---

**Remember**: This code works. Don't break it. When in doubt, ask the user.

