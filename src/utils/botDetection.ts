// src/utils/botDetection.ts
// Purpose: Detect bot-like behavior and headless browsers

interface BotDetectionResult {
  isBot: boolean;
  confidence: number;
  reasons: string[];
}

/**
 * Detect if browser is likely a bot/headless browser
 */
export function detectBot(): BotDetectionResult {
  const reasons: string[] = [];
  let confidence = 0;

  // Check for headless browser indicators
  const userAgent = navigator.userAgent.toLowerCase();

  // Common bot user agents
  const botPatterns = [
    'headless',
    'phantom',
    'selenium',
    'webdriver',
    'puppeteer',
    'playwright',
    'scrapy',
    'bot',
    'crawler',
    'spider',
  ];

  const isBotUA = botPatterns.some((pattern) => userAgent.includes(pattern));
  if (isBotUA) {
    reasons.push('Bot user agent detected');
    confidence += 50;
  }

  // Check for missing browser features
  if (!window.chrome && !window.safari && !(window as any).firefox) {
    reasons.push('Missing browser vendor object');
    confidence += 20;
  }

  // Check for WebDriver property (Selenium/WebDriver)
  if ((navigator as any).webdriver) {
    reasons.push('WebDriver property detected');
    confidence += 40;
  }

  // Check for missing plugins (headless browsers often have empty plugin arrays)
  if (navigator.plugins.length === 0) {
    reasons.push('No browser plugins detected');
    confidence += 15;
  }

  // Check for missing languages
  if (navigator.languages.length === 0) {
    reasons.push('No browser languages detected');
    confidence += 10;
  }

  // Check for missing permissions API
  if (!navigator.permissions) {
    reasons.push('Permissions API missing');
    confidence += 10;
  }

  // Check for unusual screen dimensions (common in headless browsers)
  if (window.screen.width === 0 || window.screen.height === 0) {
    reasons.push('Invalid screen dimensions');
    confidence += 20;
  }

  // Check for missing WebGL (some headless browsers don't support it)
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      reasons.push('WebGL not supported');
      confidence += 10;
    }
  } catch {
    reasons.push('WebGL check failed');
    confidence += 5;
  }

  // Check for automation frameworks
  if ((window as any).__nightmare || (window as any).__phantomas) {
    reasons.push('Automation framework detected');
    confidence += 30;
  }

  return {
    isBot: confidence >= 30, // Threshold for bot detection
    confidence: Math.min(100, confidence),
    reasons,
  };
}

/**
 * Track user behavior to detect bot-like patterns
 */
export class BehaviorTracker {
  private mouseMovements: number[] = [];
  private clicks: number[] = [];
  private keystrokes: number[] = [];
  private scrolls: number[] = [];
  private pageViews: number[] = [];
  private startTime: number = Date.now();

  constructor() {
    this.setupTracking();
  }

  private setupTracking(): void {
    // Track mouse movements
    document.addEventListener('mousemove', () => {
      this.mouseMovements.push(Date.now());
      // Keep only last 100 movements
      if (this.mouseMovements.length > 100) {
        this.mouseMovements.shift();
      }
    });

    // Track clicks
    document.addEventListener('click', () => {
      this.clicks.push(Date.now());
      if (this.clicks.length > 50) {
        this.clicks.shift();
      }
    });

    // Track keystrokes
    document.addEventListener('keydown', () => {
      this.keystrokes.push(Date.now());
      if (this.keystrokes.length > 100) {
        this.keystrokes.shift();
      }
    });

    // Track scrolls
    let scrollTimeout: NodeJS.Timeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.scrolls.push(Date.now());
        if (this.scrolls.length > 50) {
          this.scrolls.shift();
        }
      }, 100);
    });
  }

  /**
   * Analyze behavior for bot-like patterns
   */
  analyzeBehavior(): {
    isSuspicious: boolean;
    score: number;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let score = 0;
    const now = Date.now();
    const sessionDuration = now - this.startTime;
    const sessionMinutes = sessionDuration / 60000;

    // Check for no mouse movement (bot indicator)
    if (this.mouseMovements.length === 0 && sessionMinutes > 0.5) {
      reasons.push('No mouse movement detected');
      score += 30;
    }

    // Check for rapid page switching (bot-like)
    if (this.pageViews.length > 10 && sessionMinutes < 1) {
      reasons.push('Rapid page switching');
      score += 25;
    }

    // Check for no user interaction
    const totalInteractions =
      this.mouseMovements.length + this.clicks.length + this.keystrokes.length;
    if (totalInteractions === 0 && sessionMinutes > 1) {
      reasons.push('No user interactions');
      score += 40;
    }

    // Check for mechanical timing (all actions at exact intervals)
    if (this.clicks.length > 5) {
      const intervals = [];
      for (let i = 1; i < this.clicks.length; i++) {
        intervals.push(this.clicks[i] - this.clicks[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce(
        (sum, interval) => sum + Math.pow(interval - avgInterval, 2),
        0
      ) / intervals.length;
      if (variance < 100) {
        // Very consistent timing (bot-like)
        reasons.push('Mechanical timing pattern');
        score += 20;
      }
    }

    return {
      isSuspicious: score >= 30,
      score: Math.min(100, score),
      reasons,
    };
  }

  /**
   * Record a page view
   */
  recordPageView(): void {
    this.pageViews.push(Date.now());
    if (this.pageViews.length > 20) {
      this.pageViews.shift();
    }
  }

  /**
   * Get interaction score (higher = more human-like)
   */
  getInteractionScore(): number {
    const totalInteractions =
      this.mouseMovements.length + this.clicks.length + this.keystrokes.length + this.scrolls.length;
    const sessionMinutes = (Date.now() - this.startTime) / 60000;
    return Math.min(100, (totalInteractions / Math.max(1, sessionMinutes)) * 10);
  }
}

// Global behavior tracker instance
let behaviorTracker: BehaviorTracker | null = null;

/**
 * Initialize behavior tracking
 */
export function initBehaviorTracking(): BehaviorTracker {
  if (!behaviorTracker) {
    behaviorTracker = new BehaviorTracker();
  }
  return behaviorTracker;
}

/**
 * Get current behavior tracker
 */
export function getBehaviorTracker(): BehaviorTracker | null {
  return behaviorTracker;
}

