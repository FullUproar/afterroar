"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "@/lib/store-context";
import type { Role } from "@/lib/permissions";

const ROLES: { value: Role | "off"; label: string }[] = [
  { value: "off", label: "Off (actual role)" },
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
];

export function TestPanel() {
  const { isGodAdmin, actualRole, effectiveRole, isTestMode, setTestRole } =
    useStore();
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: 20, y: 20 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    offset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      setPos({
        x: e.clientX - offset.current.x,
        y: e.clientY - offset.current.y,
      });
    }
    function handleMouseUp() {
      dragging.current = false;
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  if (!isGodAdmin) return null;

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        style={{ left: pos.x, top: pos.y }}
        className="fixed z-50 flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white shadow-lg hover:bg-purple-700"
        title="Open Test Panel"
      >
        T
      </button>
    );
  }

  return (
    <div
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 w-64 rounded-lg border border-purple-700/50 bg-zinc-900/95 shadow-2xl backdrop-blur"
    >
      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        className="flex cursor-move items-center justify-between rounded-t-lg border-b border-purple-700/30 bg-purple-900/30 px-3 py-1.5"
      >
        <span className="text-xs font-bold text-purple-300">
          GOD MODE
        </span>
        <button
          onClick={() => setMinimized(true)}
          className="text-xs text-purple-400 hover:text-white"
        >
          _
        </button>
      </div>

      <div className="space-y-3 p-3">
        {/* Actual role */}
        <div className="text-xs text-zinc-500">
          Actual: <span className="text-zinc-300">{actualRole}</span>
        </div>

        {/* Role switcher */}
        <div>
          <label className="mb-1 block text-xs text-zinc-400">
            Simulate Role
          </label>
          <select
            value={isTestMode ? (effectiveRole ?? "off") : "off"}
            onChange={(e) => {
              const val = e.target.value;
              setTestRole(val === "off" ? null : (val as Role));
            }}
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Current effective state */}
        {isTestMode && (
          <div className="rounded border border-purple-700/30 bg-purple-950/30 px-2 py-1.5 text-xs text-purple-300">
            Viewing as: <strong>{effectiveRole}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
