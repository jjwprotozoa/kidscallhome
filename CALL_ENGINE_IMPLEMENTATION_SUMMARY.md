# Call Engine Implementation Summary

This document provides an overview of the KidsCallHome WebRTC call engine and its integration with Supabase Realtime for signaling.

## Overview

The call engine implements a state machine for managing video calls between parents and children. It uses WebRTC for peer-to-peer media connections and Supabase Realtime for signaling (offers, answers, ICE candidates, and call status updates).

## Architecture

### Core Components

- **`src/hooks/useCallEngine.ts`**: Main React hook implementing the call state machine
- **`src/hooks/useWebRTC.ts`**: WebRTC peer connection management
- **`src/utils/callEnding.ts`**: Call termination utilities
- **`src/utils/callHandlers.ts`**: Call flow handlers for parent/child roles
- **`src/utils/childCallHandler.ts`**: Child-specific call handling logic

### State Machine

The call engine uses the following states:

- `idle`: No active call
- `calling`: Outgoing call initiated, waiting for answer
- `incoming`: Incoming call received, waiting for user action
- `connecting`: Call accepted, establishing WebRTC connection
- `in_call`: Call connected, media flowing
- `ended`: Call terminated

### Database Schema

The `public.calls` table stores call signaling data:

- `id`: Unique call identifier
- `parent_id`: Parent user ID
- `child_id`: Child user ID
- `caller_type`: "parent" or "child" (who initiated)
- `status`: Call status ("ringing", "in_call", "ended", etc.)
- `offer`: WebRTC SDP offer (JSON)
- `answer`: WebRTC SDP answer (JSON)
- `parent_ice_candidates`: Parent's ICE candidates (JSON array)
- `child_ice_candidates`: Child's ICE candidates (JSON array)
- `ended_at`: Timestamp when call ended

### Signaling Flow

1. **Call Initiation**: Caller creates a call record with `status: "ringing"` and an SDP offer
2. **Incoming Call Detection**: Recipient receives INSERT event via Supabase Realtime
3. **Answer Creation**: Recipient creates SDP answer and updates call record
4. **ICE Exchange**: Both parties exchange ICE candidates via UPDATE events
5. **Connection Established**: WebRTC connection completes, status updates to "in_call"
6. **Call Termination**: Either party updates status to "ended"

### Realtime Subscriptions

The call engine uses Supabase Realtime v2 to listen for:

- **INSERT events**: New calls (for incoming call notifications)
- **UPDATE events**: Call status changes, answer/offer updates, ICE candidate additions

Subscriptions are filtered by:
- `parent_id` or `child_id` (for incoming calls)
- `call.id` (for call-specific updates)

## Realtime debugging for calls table

### Overview

Supabase Realtime v2 is configured via the `supabase_realtime` publication, and `public.calls` is included. The call engine uses realtime subscriptions to receive signaling events (INSERT/UPDATE) for call state changes.

### Debug Helper

A lightweight debug listener is available for development to verify that realtime events are being received correctly.

#### Enabling Debug Mode

1. Set the environment variable `VITE_ENABLE_CALLS_REALTIME_DEBUG=true` in your `.env` file
2. Run the app in development mode (`npm run dev`)
3. Watch the browser console for `[CALLS REALTIME]` logs

#### What Gets Logged

The debug listener logs all postgres changes on the `calls` table:

- **INSERT events**: New call records created
- **UPDATE events**: Status changes, offer/answer updates, ICE candidate additions
- **DELETE events**: Call records deleted (if applicable)

Each log entry includes:
- `eventType`: The type of change (INSERT, UPDATE, DELETE)
- `schema`: Database schema (always "public")
- `table`: Table name (always "calls")
- `new`: The new row data (for INSERT/UPDATE)
- `old`: The old row data (for UPDATE/DELETE)

#### Implementation

The debug helper is implemented in `src/features/calls/dev/callsRealtimeDebug.ts` and is automatically initialized when:
- Running in development mode (`import.meta.env.DEV === true`)
- The `VITE_ENABLE_CALLS_REALTIME_DEBUG` environment variable is set to `"true"`

The debug listener is wired into `useCallEngine.ts` via a `useEffect` hook that runs once on mount. It does not interfere with the call engine's normal operation.

#### Disabling Debug Mode

- Remove the `VITE_ENABLE_CALLS_REALTIME_DEBUG` environment variable, or
- Set it to `"false"`

**Note**: This debug feature is intended for troubleshooting signaling issues and should usually remain disabled. It should never be enabled in production.

### RLS Policy for Debugging

If you're experiencing issues with realtime events not being received, you may need to temporarily relax RLS policies for debugging. See `supabase/migrations/20251116000100_calls_realtime_debug_policy.sql` for a commented template policy.

**Important**: Debug RLS policies should never be enabled in production. Always remove or comment them out after debugging is complete.

## Testing

See `CALL_FLOW_SUMMARY.md` for detailed flow descriptions and testing checklists for both parent-to-child and child-to-parent call directions.

## Protection Rules

The call engine is considered stable and protected. See `.cursorrules` for detailed protection rules that prevent accidental modifications to the core call engine logic.
