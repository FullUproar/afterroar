"use client";

import { useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/*  KeyboardShortcutsHelp — modal showing all keyboard shortcuts        */
/*  Triggered by F1 or "?" key. Dismisses with Escape or click outside. */
/* ------------------------------------------------------------------ */

interface Shortcut {
  keys: string;
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: "F1 / ?", description: "Show this help" },
  { keys: "F2", description: "Focus search bar" },
  { keys: "F4", description: "Complete sale / Open payment" },
  { keys: "Escape", description: "Close modal / panel" },
];

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Don't trigger when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "F1") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Keyboard Shortcuts</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-zinc-500 hover:text-white text-xl leading-none min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            &times;
          </button>
        </div>

        <div className="space-y-1">
          {SHORTCUTS.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between py-2 px-1"
            >
              <span className="text-sm text-zinc-300">{s.description}</span>
              <kbd className="rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs font-mono text-zinc-400">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-800 text-center text-xs text-zinc-600">
          Press Escape or F1 to close
        </div>
      </div>
    </div>
  );
}
