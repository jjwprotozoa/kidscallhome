// src/components/Captcha.tsx
// Purpose: Cloudflare Turnstile CAPTCHA component

import { useEffect, useRef, useState } from 'react';

interface CaptchaProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: (error: string) => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      ready?: (callback: () => void) => void;
      render: (
        element: HTMLElement | string,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: (error: string) => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible' | 'invisible';
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse?: (widgetId: string) => string | undefined;
    };
  }
}

export const Captcha = ({
  siteKey,
  onVerify,
  onError,
  theme = 'auto',
  size = 'normal',
  className = '',
}: CaptchaProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load Turnstile script
    if (!window.turnstile) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // Wait for turnstile to be fully ready
        if (window.turnstile && typeof window.turnstile.ready === 'function') {
          window.turnstile.ready(() => {
            setIsLoaded(true);
          });
        } else {
          // Fallback if ready() doesn't exist
          setTimeout(() => setIsLoaded(true), 100);
        }
      };
      script.onerror = () => {
        if (onError) {
          onError('Failed to load CAPTCHA script');
        }
      };
      document.head.appendChild(script);

      return () => {
        // Cleanup
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch (e) {
            // Ignore cleanup errors
          }
          widgetIdRef.current = null;
        }
      };
    } else {
      setIsLoaded(true);
    }
  }, [onError]);

  useEffect(() => {
    // Only render if everything is ready and widget hasn't been created yet
    if (!isLoaded || !containerRef.current || !window.turnstile || widgetIdRef.current) {
      return;
    }

    // Ensure container is in the DOM
    if (!containerRef.current.isConnected) {
      return;
    }

    // Ensure container is empty before rendering
    if (containerRef.current.children.length > 0) {
      return;
    }

    // Use turnstile.ready() if available to ensure Turnstile is fully initialized
    const renderWidget = () => {
      if (!containerRef.current || widgetIdRef.current) {
        return;
      }

      try {
        const widgetId = window.turnstile!.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            onVerify(token);
          },
          'error-callback': (error: string) => {
            console.error('Turnstile error:', error);
            if (onError) {
              onError(`Turnstile error: ${error}`);
            }
          },
          'expired-callback': () => {
            // Token expired - reset widget
            if (widgetIdRef.current && window.turnstile) {
              try {
                window.turnstile.reset(widgetIdRef.current);
              } catch (e) {
                console.warn('Turnstile reset error:', e);
              }
            }
          },
          theme,
          size,
        });
        widgetIdRef.current = widgetId;
      } catch (error) {
        console.error('Turnstile render error:', error);
        if (onError) {
          onError(`CAPTCHA render error: ${error}`);
        }
      }
    };

    if (window.turnstile.ready) {
      window.turnstile.ready(renderWidget);
    } else {
      // Fallback: small delay to ensure Turnstile is ready
      setTimeout(renderWidget, 100);
    }
  }, [isLoaded, siteKey, onVerify, onError, theme, size]);

  const reset = () => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  };

  // Expose reset function
  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as any).resetCaptcha = reset;
    }
  }, []);

  if (!isLoaded) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="text-sm text-muted-foreground">Loading security check...</div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div ref={containerRef} className="flex justify-center" />
    </div>
  );
};

// Fallback reCAPTCHA component (if Turnstile is not available)
export const RecaptchaFallback = ({
  siteKey,
  onVerify,
  onError,
  className = '',
}: {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: (error: string) => void;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!(window as any).grecaptcha) {
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => setIsLoaded(true);
      script.onerror = () => {
        if (onError) {
          onError('Failed to load reCAPTCHA script');
        }
      };
      document.head.appendChild(script);
    } else {
      setIsLoaded(true);
    }
  }, [siteKey, onError]);

  useEffect(() => {
    if (isLoaded && containerRef.current && (window as any).grecaptcha) {
      try {
        (window as any).grecaptcha.ready(() => {
          (window as any).grecaptcha
            .execute(siteKey, { action: 'submit' })
            .then((token: string) => {
              onVerify(token);
            })
            .catch((error: any) => {
              if (onError) {
                onError(`reCAPTCHA error: ${error}`);
              }
            });
        });
      } catch (error) {
        if (onError) {
          onError(`reCAPTCHA render error: ${error}`);
        }
      }
    }
  }, [isLoaded, siteKey, onVerify, onError]);

  if (!isLoaded) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="text-sm text-muted-foreground">Loading security check...</div>
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
};

