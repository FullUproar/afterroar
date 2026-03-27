"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ScannerInputManager,
  DEFAULT_SCANNER_CONFIG,
  type ScannerError,
  type ScannerStatus,
} from "@/lib/scanner-manager";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UseScannerOptions {
  /** Called when a valid barcode scan is detected */
  onScan: (barcode: string) => void;
  /** Called when human typing is detected (optional) */
  onHumanTyping?: (text: string) => void;
  /** Called on scanner errors (optional) */
  onError?: (error: ScannerError) => void;
  /** Whether the scanner is enabled (default: true) */
  enabled?: boolean;
}

interface UseScannerReturn {
  /** Ref to attach to the hidden input element */
  hiddenInputRef: React.RefObject<HTMLInputElement | null>;
  /** Whether the scanner is actively listening */
  isListening: boolean;
  /** Last successful scan */
  lastScan: { code: string; time: Date } | null;
  /** Last error */
  lastError: ScannerError | null;
  /** Pause scanner (e.g., when modal opens) */
  pause: () => void;
  /** Resume scanner (e.g., when modal closes) */
  resume: () => void;
  /** Current scanner status */
  status: ScannerStatus;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useScanner(options: UseScannerOptions): UseScannerReturn {
  const { onScan, onHumanTyping, onError, enabled = true } = options;

  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const managerRef = useRef<ScannerInputManager | null>(null);
  const refocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPausedRef = useRef(false);

  const [lastScan, setLastScan] = useState<{
    code: string;
    time: Date;
  } | null>(null);
  const [lastError, setLastError] = useState<ScannerError | null>(null);
  const [status, setStatus] = useState<ScannerStatus>("listening");

  // Stable callback refs to avoid re-creating the manager on every render
  const onScanRef = useRef(onScan);
  const onHumanTypingRef = useRef(onHumanTyping);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);
  useEffect(() => {
    onHumanTypingRef.current = onHumanTyping;
  }, [onHumanTyping]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Create / destroy the scanner manager
  useEffect(() => {
    const manager = new ScannerInputManager({
      ...DEFAULT_SCANNER_CONFIG,
      onScan: (barcode: string) => {
        setLastScan({ code: barcode, time: new Date() });
        setLastError(null);
        setStatus("listening");
        onScanRef.current(barcode);
      },
      onHumanTyping: (text: string) => {
        setStatus("listening");
        onHumanTypingRef.current?.(text);
      },
      onError: (error: ScannerError) => {
        setLastError(error);
        setStatus("listening");
        onErrorRef.current?.(error);
      },
    });

    managerRef.current = manager;

    return () => {
      manager.destroy();
      managerRef.current = null;
    };
  }, []);

  // Handle enabled/disabled state
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;

    if (enabled && !isPausedRef.current) {
      manager.resume();
      setStatus("listening");
    } else {
      manager.pause();
      setStatus("paused");
    }
  }, [enabled]);

  // Focus management — keep the hidden input focused
  const ensureFocus = useCallback(() => {
    if (isPausedRef.current || !enabled) return;

    const el = hiddenInputRef.current;
    if (!el) return;

    // Don't steal focus from other inputs that are intentionally focused
    const active = document.activeElement;
    if (
      active &&
      active !== document.body &&
      active !== el &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.tagName === "SELECT" ||
        (active as HTMLElement).isContentEditable)
    ) {
      // Some other input has focus — don't fight it
      return;
    }

    el.focus({ preventScroll: true });
  }, [enabled]);

  // Set up the global keydown listener for scanner input
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      const manager = managerRef.current;
      if (!manager || isPausedRef.current) return;

      // Ignore modifier combos (Ctrl+C, Alt+Tab, etc.)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Ignore function keys, arrows, etc. — only printable chars and terminators
      if (e.key.length > 1) {
        // Check for terminator keys
        if (manager.isTerminator(e.key)) {
          // Only process if we have buffer content
          if (manager.status === "processing") {
            e.preventDefault();
            e.stopPropagation();
            setStatus("processing");
            manager.handleTerminator();
          }
          return;
        }
        // Non-printable, non-terminator key — ignore
        return;
      }

      // Check if another input element has focus
      const active = document.activeElement;
      const hiddenEl = hiddenInputRef.current;
      if (
        active &&
        active !== document.body &&
        active !== hiddenEl &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT" ||
          (active as HTMLElement).isContentEditable)
      ) {
        // Another input has focus. We still listen — scanner fires fast
        // regardless of focus. Feed the char to the manager; the speed
        // check will distinguish scanner from human typing.
        manager.handleKeyPress(e.key, e.timeStamp || Date.now());
        setStatus(manager.status);
        return;
      }

      // Feed the character to the scanner manager
      e.preventDefault();
      manager.handleKeyPress(e.key, e.timeStamp || Date.now());
      setStatus(manager.status);
    }

    // Use capture phase to intercept before other handlers
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enabled]);

  // Auto-refocus the hidden input when focus is lost
  useEffect(() => {
    if (!enabled) return;

    function handleFocusOut() {
      if (isPausedRef.current) return;

      // Clear any existing refocus timer
      if (refocusTimerRef.current) {
        clearTimeout(refocusTimerRef.current);
      }

      // Delay refocus to allow intentional focus changes to settle
      refocusTimerRef.current = setTimeout(() => {
        ensureFocus();
      }, 150);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && !isPausedRef.current) {
        // Tab was backgrounded and came back — refocus
        setTimeout(() => ensureFocus(), 100);
      }
    }

    document.addEventListener("focusout", handleFocusOut);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Initial focus
    setTimeout(() => ensureFocus(), 50);

    return () => {
      document.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (refocusTimerRef.current) {
        clearTimeout(refocusTimerRef.current);
      }
    };
  }, [enabled, ensureFocus]);

  // Pause / resume
  const pause = useCallback(() => {
    isPausedRef.current = true;
    managerRef.current?.pause();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    isPausedRef.current = false;
    managerRef.current?.resume();
    setStatus("listening");
    // Refocus after a short delay
    setTimeout(() => ensureFocus(), 100);
  }, [ensureFocus]);

  return {
    hiddenInputRef,
    isListening: status === "listening" && enabled,
    lastScan,
    lastError,
    pause,
    resume,
    status: enabled ? status : "paused",
  };
}
