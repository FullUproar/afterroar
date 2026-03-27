"use client";

import { useEffect, useState } from "react";

export default function OpsPage() {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count <= 0) {
      window.location.href = "https://www.afterroar.store";
      return;
    }
    const timer = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(timer);
  }, [count]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-foreground">
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
        Future home of the best friendly local POS&hellip;
      </h1>
      <p className="mt-8 text-8xl font-mono font-bold tabular-nums">
        {count > 0 ? count : "🚀"}
      </p>
    </div>
  );
}
