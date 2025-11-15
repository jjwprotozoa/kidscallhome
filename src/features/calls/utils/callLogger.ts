// src/features/calls/utils/callLogger.ts
// Toggleable logger for call-related debugging

const CALL_DEBUG =
  import.meta.env.DEV &&
  (localStorage.getItem("CALL_DEBUG") === "1" ||
    import.meta.env.VITE_CALL_DEBUG === "1");

type Level = "debug" | "info" | "warn" | "error";

function log(level: Level, tag: string, ...args: any[]) {
  // Always allow warn/error in dev; gate debug/info
  if (!CALL_DEBUG && (level === "debug" || level === "info")) return;

  const prefix = `[CALL][${tag}]`;
  switch (level) {
    case "warn":
      console.warn(prefix, ...args);
      break;
    case "error":
      console.error(prefix, ...args);
      break;
    default:
      console.log(prefix, ...args);
  }
}

export const callLog = {
  debug: (tag: string, ...args: any[]) => log("debug", tag, ...args),
  info: (tag: string, ...args: any[]) => log("info", tag, ...args),
  warn: (tag: string, ...args: any[]) => log("warn", tag, ...args),
  error: (tag: string, ...args: any[]) => log("error", tag, ...args),
};

