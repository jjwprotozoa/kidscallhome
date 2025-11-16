# Git Bisect Guide: Finding When Calls Broke

This guide helps you find the exact commit where WebRTC calls stopped working.

## Prerequisites

1. **Create the new GitHub repo first** (if not already done):
   - Go to https://github.com/new
   - Create a public repo named `kids-call-home-webrtc`
   - **DO NOT** initialize with README, .gitignore, or license (we'll push existing code)

2. **Set up git remote** (run this in your project root):
   ```bash
   git remote set-url origin https://github.com/jjwprotozoa/kids-call-home-webrtc.git
   git push -u origin main
   ```

## Step 1: Identify a Known Good Commit

Run this to see recent commits:
```bash
git log --oneline --graph --decorate --max-count=40
```

Look for commits from before the "stable, encapsulated WebRTC engine" work, or from when you remember calls were working. Examples:
- `feat: initial calls working`
- `chore: add callHandlers`
- `811a99b Implement WebRTC signaling` (from your log)

**Note the commit hash** - we'll call it `GOOD_HASH`.

## Step 2: Start Git Bisect

```bash
# Start bisect
git bisect start

# Mark current HEAD as bad (broken)
git bisect bad HEAD

# Mark the known good commit as good
git bisect good GOOD_HASH
# Example: git bisect good 811a99b
```

Git will automatically checkout a mid-point commit.

## Step 3: Test Each Commit

At each step:

1. **Start dev server**:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

2. **Test a simple scenario**:
   - Parent calls Child
   - Child answers
   - Check: Do you see and hear each other?

3. **Mark the commit**:
   ```bash
   # If call WORKS:
   git bisect good
   
   # If call FAILS:
   git bisect bad
   ```

4. **Repeat** until Git prints:
   ```
   <HASH> is the first bad commit
   ```

## Step 4: Inspect the Bad Commit

Once you find the first bad commit:

```bash
# See what changed
git show --stat <HASH>

# See the full diff
git diff <HASH>^ <HASH>

# Or see the commit message and changes
git show <HASH>
```

## Step 5: What to Look For in the Bad Commit

When reviewing the diff, focus on:

### 3.1. Supabase Signaling Queries

Look for new filters in queries that read/write call rows or ICE candidates:
- `.eq('status', 'ringing')`
- `.eq('parent_profile_id', parentProfileId)`
- `.eq('child_profile_id', childProfileId)`
- `.eq('parent_display_name', ...)`

**A single extra `.eq(...)` that never matches in production will make the answering side think "no incoming call".**

### 3.2. State Guards You Recently Added

Check for new guards like:
```typescript
if (!localStream || !localStream.getVideoTracks().length) {
  throw new Error('No video track');
}

if (!offer.sdp?.includes('m=video')) {
  throw new Error('No video in SDP');
}

if (call.status !== 'ringing') return;
```

**If, in real usage, the call row never gets `status = 'ringing'`, or media permissions fail once, these guards will kill the flow.**

### 3.3. Engine Wiring / Double Mounting

Check for:
- Is `useCallEngine` imported in more than one root component?
- Did you change props so parent and child both see themselves as the same "role"?
- Did you switch from old call handlers to new engine but leave one old listener still active?

**Double-mounting the engine or mismatching "role" flags can cause two peer connections per side.**

### 3.4. DB Migration Mismatch

Check if migrations were added but not run:
- Does `calls` table actually have new fields (`parent_display_name`, `child_display_name`, etc.)?
- Did you change any query to require those fields?
- If code assumes the migration but deployed DB didn't run it, reads/writes can silently fail.

## Step 6: Using Telemetry Logs

With the new `[KCH]` telemetry logs, you can see exactly where the chain breaks:

**In browser console, filter for `[KCH]` logs:**

1. **If you never see "created offer"** → engine never reaches that branch
2. **If you see "created offer" but not "saving offer"** → bug in signaling write
3. **If offer + answer save, but `iceConnectionState` never leaves `checking`** → STUN/TURN / network issue
4. **If `connectionState` becomes `connected` but UI is black** → binding of `remoteStream` to `<video>` is broken

**Example log sequence for a working call:**
```
[KCH] parent media tracks { audio: 1, video: 1 }
[KCH] parent created offer true
[KCH] parent saving offer for call abc123
[KCH] child media tracks { audio: 1, video: 1 }
[KCH] child created answer true
[KCH] child saving answer for call abc123
[KCH] parent iceConnectionState checking
[KCH] child iceConnectionState checking
[KCH] parent iceConnectionState connected
[KCH] child iceConnectionState connected
[KCH] parent connectionState connected
[KCH] child connectionState connected
```

## Step 7: Finish Bisect

After finding the bad commit:

```bash
# Reset to your original branch
git bisect reset

# Or checkout the bad commit to inspect it
git checkout <BAD_HASH>
```

## Troubleshooting

### "Git bisect says I'm at the wrong commit"

Make sure you're testing the right commit:
```bash
git log -1  # Shows current commit
```

### "Can't test because dependencies are missing"

```bash
# Install dependencies for this commit
npm install
# or
yarn install
```

### "The commit doesn't compile"

```bash
# Mark as skip - git will find another commit to test
git bisect skip
```

## Next Steps

Once you find the bad commit:

1. **Share the diff** - The diff shows exactly what changed
2. **Check the commit message** - It might explain the intent
3. **Review related PRs/issues** - See if there were known issues
4. **Test the fix** - Revert the bad change or fix the logic

## Quick Reference

```bash
# Start bisect
git bisect start
git bisect bad HEAD
git bisect good <GOOD_HASH>

# Test and mark
git bisect good   # Call works
git bisect bad    # Call fails
git bisect skip   # Can't test this commit

# Inspect bad commit
git show <BAD_HASH>
git diff <BAD_HASH>^ <BAD_HASH>

# Finish
git bisect reset
```

