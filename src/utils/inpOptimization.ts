// kidscallhome/src/utils/inpOptimization.ts
// Utilities to optimize Interaction to Next Paint (INP) for better mobile performance
// INP measures the time from user interaction to when the browser can present the next frame
// Target: < 200ms for good user experience

/**
 * Scheduler API priority levels for deferring work
 * Uses scheduler.postTask when available, falls back to setTimeout
 */
type TaskPriority = 'user-blocking' | 'user-visible' | 'background';

/**
 * Defer non-critical work to improve INP
 * Uses scheduler.postTask when available (Chrome 94+), falls back to setTimeout
 * 
 * @param task Function to execute
 * @param priority Priority level (default: 'background')
 * @returns Promise that resolves when task completes
 */
export function deferTask(
  task: () => void | Promise<void>,
  priority: TaskPriority = 'background'
): Promise<void> {
  return new Promise((resolve) => {
    // Use scheduler.postTask if available (Chrome 94+, Edge 94+)
    if ('scheduler' in window && 'postTask' in (window as any).scheduler) {
      const scheduler = (window as any).scheduler;
      scheduler
        .postTask(
          async () => {
            await task();
            resolve();
          },
          { priority }
        )
        .catch((error: Error) => {
          console.error('[INP] Task failed:', error);
          resolve(); // Resolve anyway to prevent hanging
        });
    } else {
      // Fallback to setTimeout with appropriate delay based on priority
      const delay = priority === 'user-blocking' ? 0 : priority === 'user-visible' ? 4 : 16;
      setTimeout(async () => {
        try {
          await task();
        } catch (error) {
          console.error('[INP] Task failed:', error);
        }
        resolve();
      }, delay);
    }
  });
}

/**
 * Execute critical work immediately, defer non-critical work
 * Improves INP by ensuring visual feedback happens immediately
 * 
 * @param immediateWork Work that must happen synchronously (visual feedback, state updates)
 * @param deferredWork Work that can happen after paint (API calls, heavy computations)
 * @param priority Priority for deferred work (default: 'background')
 */
export function splitWork(
  immediateWork: () => void,
  deferredWork?: () => void | Promise<void>,
  priority: TaskPriority = 'background'
): void {
  // Execute immediate work synchronously
  immediateWork();

  // Defer non-critical work
  if (deferredWork) {
    deferTask(deferredWork, priority).catch(() => {
      // Silently handle errors in deferred work
    });
  }
}

/**
 * Wrap an event handler to optimize INP
 * Splits work into immediate (visual feedback) and deferred (heavy operations)
 * 
 * @param handler Original event handler
 * @param options Configuration options
 * @returns Optimized event handler
 */
export function optimizeEventHandler<T extends React.SyntheticEvent>(
  handler: (e: T) => void | Promise<void>,
  options?: {
    immediateWork?: (e: T) => void;
    deferredWork?: (e: T) => void | Promise<void>;
    priority?: TaskPriority;
    preventDefault?: boolean;
    stopPropagation?: boolean;
  }
): (e: T) => void {
  return (e: T) => {
    // Prevent default/stop propagation immediately if needed
    if (options?.preventDefault) {
      e.preventDefault();
    }
    if (options?.stopPropagation) {
      e.stopPropagation();
    }

    // Execute immediate work (visual feedback, critical state updates)
    if (options?.immediateWork) {
      options.immediateWork(e);
    }

    // Defer heavy work (API calls, audio/media operations, logging)
    if (options?.deferredWork || handler) {
      const workToDefer = options?.deferredWork || handler;
      deferTask(
        () => workToDefer(e),
        options?.priority || 'background'
      ).catch(() => {
        // Silently handle errors
      });
    }
  };
}

/**
 * Safe console.warn that defers logging to avoid blocking main thread
 * Use this instead of console.warn in event handlers
 */
export function deferredLog(
  message: string,
  ...args: unknown[]
): void {
  deferTask(() => {
    console.warn(message, ...args);
  }, 'background').catch(() => {
    // Silently handle errors
  });
}

/**
 * Safe console.error that defers logging to avoid blocking main thread
 * Use this instead of console.error in event handlers
 */
export function deferredError(
  message: string,
  ...args: unknown[]
): void {
  deferTask(() => {
    console.error(message, ...args);
  }, 'background').catch(() => {
    // Silently handle errors
  });
}

/**
 * Check if scheduler.postTask is available
 */
export function hasSchedulerSupport(): boolean {
  return 'scheduler' in window && 'postTask' in (window as any).scheduler;
}

