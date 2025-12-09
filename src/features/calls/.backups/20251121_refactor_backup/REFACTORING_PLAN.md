# Refactoring Plan: Breaking Down Large Call Files

## Backup Location
All original files backed up to: `src/features/calls/.backups/20251121_refactor_backup/`

## Refactoring Strategy: Break by Concern

Instead of breaking by technical layers, we'll break by **functional concerns** to make debugging easier:
- **Video** - Video stream handling
- **Audio** - Audio stream handling  
- **Ringing** - Ringtone and call state management
- **ICE** - ICE candidate exchange
- **Signaling** - Offer/Answer exchange
- **Connection** - Connection state monitoring

## Files to Refactor

### 1. `useWebRTC.ts` (1,302 lines) → Break into:
- `hooks/useLocalMedia.ts` - Local camera/mic handling
- `hooks/useRemoteStream.ts` - Remote video/audio stream handling
- `hooks/useIceCandidates.ts` - ICE candidate exchange
- `hooks/useConnectionState.ts` - Connection state monitoring
- `hooks/useWebRTC.ts` - Main orchestrator (much smaller)

### 2. `useCallEngine.ts` (810 lines) → Break into:
- `hooks/useCallState.ts` - Call state machine
- `hooks/useCallSignaling.ts` - Offer/Answer handling
- `hooks/useCallStatusListener.ts` - Database status listener
- `hooks/useCallEngine.ts` - Main orchestrator

### 3. `useVideoCall.ts` (992 lines) → Break into:
- `hooks/useCallInitialization.ts` - Call setup logic
- `hooks/useCallTermination.ts` - Call ending logic
- `hooks/useRingtoneControl.ts` - Ringtone start/stop
- `hooks/useVideoCall.ts` - Main orchestrator

### 4. `childCallHandler.ts` (1,443 lines) → Break into:
- `utils/childCallHandlers/incomingCallHandler.ts` - Handle incoming calls
- `utils/childCallHandlers/outgoingCallHandler.ts` - Handle outgoing calls
- `utils/childCallHandlers/iceCandidateHandler.ts` - ICE candidate processing
- `utils/childCallHandler.ts` - Main router

### 5. `callHandlers.ts` (1,260 lines) → Break into:
- `utils/parentCallHandlers/incomingCallHandler.ts` - Handle incoming calls
- `utils/parentCallHandlers/outgoingCallHandler.ts` - Handle outgoing calls
- `utils/parentCallHandlers/iceCandidateHandler.ts` - ICE candidate processing
- `utils/callHandlers.ts` - Main router

## Benefits

1. **Easier Debugging**: If video doesn't work, check `useRemoteStream.ts`
2. **Easier Testing**: Test each concern independently
3. **Clearer Code**: Each file has a single responsibility
4. **Better Maintainability**: Changes to ringing logic don't affect video logic

## Migration Strategy

1. Create new files with extracted logic
2. Update imports in existing files
3. Test each piece incrementally
4. Keep old files as fallback until fully tested

## Testing Checklist

After refactoring, test:
- [ ] Parent → Child call (video + audio)
- [ ] Child → Parent call (video + audio)
- [ ] Ringtone plays/stops correctly
- [ ] Call termination works
- [ ] ICE connection establishes
- [ ] Remote stream appears
- [ ] Mute/unmute works
- [ ] Video on/off works



