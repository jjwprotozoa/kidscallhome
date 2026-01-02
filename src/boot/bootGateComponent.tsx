// src/boot/bootGateComponent.tsx
// BootGate React component that wraps the app and monitors boot state

import { useEffect, useState } from "react";
import { bootLogger, markBootReady, startBootWatchdog, checkIOSAutoRecovery } from "./bootGate";

interface BootGateProps {
  children: React.ReactNode;
}

export function BootGate({ children }: BootGateProps) {
  const [bootFailed, setBootFailed] = useState(false);
  const [showDebug] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("debug") === "1";
  });

  useEffect(() => {
    // Start watchdog
    startBootWatchdog(8000);

    // Listen for boot timeout
    const handleBootTimeout = () => {
      setBootFailed(true);
    };

    window.addEventListener("boot-timeout", handleBootTimeout);

    // Check iOS auto-recovery
    const autoRecovered = checkIOSAutoRecovery();
    if (autoRecovered) {
      return; // Will reload
    }

    // Mark boot as ready after a short delay (allows React to render)
    const readyTimer = setTimeout(() => {
      markBootReady();
    }, 1000);

    return () => {
      window.removeEventListener("boot-timeout", handleBootTimeout);
      clearTimeout(readyTimer);
    };
  }, []);

  // CRITICAL: Always render children or fallback to prevent white screen
  // If boot failed, ErrorBoundary will show the UI, but we still render children
  // to ensure there's always something on screen (no blank state)
  // ErrorBoundary will catch and display the error UI if needed
  
  return (
    <>
      {children}
      {showDebug && (
        <div style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(0,0,0,0.8)",
          color: "white",
          padding: "1rem",
          fontSize: "0.75rem",
          fontFamily: "monospace",
          maxHeight: "200px",
          overflow: "auto",
          zIndex: 9999,
        }}>
          <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>Boot Log (debug=1):</div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(bootLogger.getLogs(), null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}

