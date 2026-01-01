# Database Call Reduction Plan

**Current Issue:** 3,677 database REST requests in ~1 hour period  
**Goal:** Reduce database calls by 70-90% through caching, query optimization, and smarter polling

---

## Current Problems Identified

### 1. **Excessive Polling** 🔴
Multiple components poll every 60 seconds even when realtime subscriptions are active:
- `useMessages.ts` - polls messages every 60s
- `GlobalMessageNotifications.tsx` - polls messages every 60s  
- `useIncomingCallState.ts` - polls calls every 60s
- `useParentIncomingCallSubscription.ts` - polls calls every 60s
- `useDashboardData.ts` - polls calls every 60s

**Impact:** Even with 60s intervals, 5 components × 60 polls/hour = 300+ unnecessary queries/hour per user

### 2. **No Query Result Caching** 🔴
- Every component makes direct Supabase queries
- Same data fetched multiple times by different components
- No shared cache between components

### 3. **Redundant Queries** 🟡
- Children list fetched separately by multiple components
- User session checked repeatedly (`getUser()` vs cached `getSession()`)
- Messages/calls queried independently

### 4. **Polling When Realtime Works** 🟡
- Polling runs as "safety net" even when realtime subscriptions are active
- Should only poll when realtime subscription fails

---

## Solutions

### Solution 1: Implement React Query for Caching ✅ (Recommended)

**Why:** React Query is already installed but unused. It provides:
- Automatic caching with configurable TTL
- Request deduplication (multiple components requesting same data = 1 query)
- Background refetching
- Stale-while-revalidate pattern

**Implementation Steps:**

1. **Create query hooks for common data:**
   - `useChildren()` - cache children list (5 min TTL)
   - `useUserSession()` - cache user session (never stale)
   - `useMessages(conversationId)` - cache messages (1 min TTL, invalidate on new message)
   - `useUnreadCount()` - cache unread count (30s TTL)

2. **Replace direct Supabase calls with React Query hooks**

3. **Configure React Query defaults:**
   ```typescript
   const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         staleTime: 5 * 60 * 1000, // 5 minutes
         gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
         refetchOnWindowFocus: false,
         refetchOnReconnect: true,
       },
     },
   });
   ```

**Expected Reduction:** 60-80% fewer queries

---

### Solution 2: Smart Polling (Only When Realtime Fails) ✅

**Current:** Polling runs every 60s regardless of realtime status  
**New:** Only poll when realtime subscription status is not "SUBSCRIBED"

**Implementation:**
```typescript
// Track realtime subscription status
const [realtimeStatus, setRealtimeStatus] = useState<'SUBSCRIBED' | 'ERROR' | 'TIMED_OUT'>('ERROR');

// Only poll if realtime is not working
useEffect(() => {
  if (realtimeStatus === 'SUBSCRIBED') {
    return; // No polling needed
  }
  
  const pollInterval = setInterval(pollForData, 60000);
  return () => clearInterval(pollInterval);
}, [realtimeStatus]);
```

**Expected Reduction:** 80-90% fewer polling queries (when realtime works)

---

### Solution 3: Batch Queries ✅

**Current:** Each component makes separate queries  
**New:** Batch related queries together

**Example:**
```typescript
// Instead of:
const { data: children } = await supabase.from('children').select('*');
const { data: messages } = await supabase.from('messages').select('*');
const { data: calls } = await supabase.from('calls').select('*');

// Use React Query's parallel queries:
const [children, messages, calls] = await Promise.all([
  queryClient.fetchQuery(['children']),
  queryClient.fetchQuery(['messages']),
  queryClient.fetchQuery(['calls']),
]);
```

**Expected Reduction:** 20-30% fewer round trips

---

### Solution 4: Increase Polling Intervals (When Needed) ✅

**Current:** 60 seconds  
**New:** 
- If realtime is working: No polling
- If realtime fails: 120-180 seconds (instead of 60s)

**Rationale:** If realtime fails, 60s polling is too aggressive. 120-180s is sufficient for a fallback.

**Expected Reduction:** 50% fewer polling queries (when polling is needed)

---

### Solution 5: Cache Children List Aggressively ✅

**Current:** Fetched by multiple components independently  
**New:** Single cached query with 5-minute TTL, shared across all components

**Implementation:**
```typescript
// src/hooks/useChildren.ts
export const useChildren = () => {
  return useQuery({
    queryKey: ['children'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from('children')
        .select('*')
        .eq('parent_id', user.id);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
```

**Expected Reduction:** 90% fewer children list queries

---

### Solution 6: Use Supabase Realtime More Effectively ✅

**Current:** Realtime subscriptions exist but polling still runs  
**New:** 
- Monitor realtime subscription status
- Only poll when subscription status is not "SUBSCRIBED"
- Add exponential backoff for failed subscriptions

**Expected Reduction:** 80-90% fewer queries when realtime works

---

## Implementation Priority

### Phase 1: Quick Wins (Immediate Impact)
1. ✅ Implement React Query for children list caching
2. ✅ Disable polling when realtime is SUBSCRIBED
3. ✅ Increase polling interval to 120s when needed

**Expected Reduction:** 50-70% fewer queries

### Phase 2: Medium Impact
4. ✅ Implement React Query for messages
5. ✅ Implement React Query for unread counts
6. ✅ Cache user session (use getSession() instead of getUser())

**Expected Reduction:** Additional 20-30% reduction

### Phase 3: Advanced Optimization
7. ✅ Batch queries where possible
8. ✅ Implement query invalidation on mutations
9. ✅ Add request deduplication

**Expected Reduction:** Additional 10-20% reduction

---

## Expected Results

### Before Optimization
- **3,677 requests/hour** (current)
- Multiple components polling every 60s
- No caching
- Redundant queries

### After Phase 1
- **~1,100 requests/hour** (70% reduction)
- Polling only when realtime fails
- Children list cached

### After Phase 2
- **~550 requests/hour** (85% reduction)
- Messages and counts cached
- Session cached

### After Phase 3
- **~370 requests/hour** (90% reduction)
- Batched queries
- Smart invalidation

---

## Monitoring

Track these metrics:
1. Database REST requests per hour (Supabase dashboard)
2. Realtime subscription success rate
3. Cache hit rate (if possible)
4. Average query response time

---

## Notes

- React Query is already installed - no new dependencies needed
- Changes are backward compatible
- Can be implemented incrementally
- No breaking changes to existing functionality

