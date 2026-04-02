"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store-context";

/* ------------------------------------------------------------------ */
/*  Health Score — single-glance store status                          */
/*  Green: you're good. Amber: watch out. Red: needs attention now.    */
/* ------------------------------------------------------------------ */

interface Insight {
  priority: "high" | "medium" | "low";
  type: "action" | "warning" | "opportunity" | "celebration";
}

type HealthLevel = "great" | "good" | "watch" | "attention";

function computeHealth(insights: Insight[]): { level: HealthLevel; message: string } {
  const highCount = insights.filter((i) => i.priority === "high" && i.type !== "celebration").length;
  const mediumCount = insights.filter((i) => i.priority === "medium" && i.type !== "celebration").length;
  const actionCount = insights.filter((i) => i.type === "action" || i.type === "warning").length;

  if (highCount >= 2) {
    return { level: "attention", message: `${highCount} urgent items need your attention` };
  }
  if (highCount === 1) {
    return { level: "watch", message: "One thing needs your attention today" };
  }
  if (mediumCount >= 3) {
    return { level: "watch", message: "A few things to keep an eye on" };
  }
  if (actionCount === 0) {
    return { level: "great", message: "Everything looks great" };
  }
  return { level: "good", message: "Store is running smoothly" };
}

const LEVEL_STYLES: Record<HealthLevel, { bg: string; text: string; dot: string; border: string }> = {
  great: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400", border: "border-emerald-500/20" },
  good: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400", border: "border-green-500/20" },
  watch: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400", border: "border-amber-500/20" },
  attention: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400 animate-pulse", border: "border-red-500/20" },
};

export function HealthScore() {
  const { can } = useStore();
  const [health, setHealth] = useState<{ level: HealthLevel; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!can("reports")) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const res = await fetch("/api/intelligence");
        if (res.ok) {
          const data = await res.json();
          setHealth(computeHealth(data.insights ?? []));
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [can]);

  if (loading || !health || !can("reports")) return null;

  const style = LEVEL_STYLES[health.level];

  return (
    <Link
      href="/dashboard/cash-flow"
      className={`flex items-center gap-3 rounded-xl border ${style.border} ${style.bg} px-4 py-3 transition-colors hover:opacity-90`}
    >
      <span className={`h-3 w-3 rounded-full ${style.dot} shrink-0`} />
      <span className={`text-sm font-medium ${style.text}`}>{health.message}</span>
    </Link>
  );
}
