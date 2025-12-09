# Backup Directory

This directory contains backups of protected call engine files before refactoring.

## Backup Structure

Each backup is stored in a timestamped directory: `yyyyMMdd_HHmmss/`

## Files Backed Up

- `hooks/useCallEngine.ts` - Call state machine hook
- `hooks/useWebRTC.ts` - WebRTC peer connection management
- `hooks/useVideoCall.ts` - Video call orchestration
- `utils/callHandlers.ts` - Parent-side call handling
- `utils/childCallHandler.ts` - Child-side call handling

## Restoring a Backup

To restore a backup:

```powershell
# Copy files from backup directory
Copy-Item "src/features/calls/.backups/YYYYMMDD_HHMMSS/*" "src/features/calls/" -Recurse
```

## Why Backups Exist

These files are protected by guardian rules. Backups are created before any refactoring to ensure we can restore the working state if needed.



