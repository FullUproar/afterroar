"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store-context";

/* ------------------------------------------------------------------ */
/*  Staff Quick-Switch                                                 */
/*  Modal overlay: avatar tiles → tap a name → 4-digit PIN numpad →    */
/*  POST /api/staff-auth → active-staff cookie set, useStore updates.  */
/*  Mounted globally; opened via useStaffQuickSwitch().open().         */
/* ------------------------------------------------------------------ */

interface RosterStaff {
  id: string;
  name: string;
  role: string;
  has_pin: boolean;
  avatar_url: string | null;
}

interface StaffQuickSwitchProps {
  open: boolean;
  onClose: () => void;
}

function haptic() {
  try {
    navigator.vibrate?.(10);
  } catch {}
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((s) => s[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
};

export function StaffQuickSwitch({ open, onClose }: StaffQuickSwitchProps) {
  const { setActiveStaff, activeStaff } = useStore();
  const [roster, setRoster] = useState<RosterStaff[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<RosterStaff | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [authing, setAuthing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch roster on open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelected(null);
    setPin("");

    (async () => {
      try {
        const res = await fetch("/api/staff/roster");
        if (cancelled) return;
        if (res.ok) {
          const data: RosterStaff[] = await res.json();
          setRoster(data.filter((s) => s.has_pin));
        } else {
          setError("Could not load roster");
        }
      } catch {
        if (!cancelled) setError("Connection error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Focus PIN input when a staff is selected
  useEffect(() => {
    if (selected) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [selected]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selected) {
          setSelected(null);
          setPin("");
          setError(null);
        } else {
          onClose();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selected, onClose]);

  const submit = useCallback(async () => {
    if (!selected || pin.length < 4 || authing) return;
    haptic();
    setAuthing(true);
    setError(null);
    try {
      const res = await fetch("/api/staff-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: selected.id, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Invalid PIN");
        setPin("");
        setAuthing(false);
        return;
      }
      setActiveStaff(data.staff);
      onClose();
    } catch {
      setError("Connection error");
      setAuthing(false);
    }
  }, [selected, pin, authing, setActiveStaff, onClose]);

  // Auto-submit at 4 digits
  useEffect(() => {
    if (selected && pin.length >= 4 && !authing) {
      submit();
    }
  }, [pin, selected, authing, submit]);

  if (!open) return null;

  function handleDigit(d: string) {
    if (pin.length >= 8) return;
    haptic();
    setPin((p) => p + d);
    setError(null);
  }
  function handleBackspace() {
    haptic();
    setPin((p) => p.slice(0, -1));
    setError(null);
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(7,8,12,0.88)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--panel)",
          border: "1px solid var(--rule-hi)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header stripe */}
        <div
          className="ar-stripe"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
            borderBottom: "1px solid var(--rule)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.65rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: "var(--orange)",
            }}
          >
            {selected ? "Enter PIN" : "Switch Operator"}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ink-soft hover:text-ink transition-colors"
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600 }}
          >
            Esc
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div style={{ padding: "3rem 1.5rem", textAlign: "center", color: "var(--ink-faint)", fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Loading…
          </div>
        ) : error && roster.length === 0 ? (
          <div style={{ padding: "2rem 1.5rem", textAlign: "center" }}>
            <div style={{ color: "var(--red)", fontSize: "0.95rem", marginBottom: "0.75rem" }}>{error}</div>
          </div>
        ) : roster.length === 0 ? (
          <div style={{ padding: "2rem 1.5rem", textAlign: "center" }}>
            <div style={{ color: "var(--ink)", fontFamily: "var(--font-display)", fontSize: "1.05rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              No PINs set up yet
            </div>
            <p style={{ color: "var(--ink-faint)", fontSize: "0.85rem", lineHeight: 1.5 }}>
              Have each staff member open Time Clock and set their PIN.
            </p>
          </div>
        ) : !selected ? (
          // Avatar tile grid
          <div style={{ padding: "1rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            {roster.map((s) => {
              const isActive = activeStaff?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    haptic();
                    setSelected(s);
                  }}
                  className="transition-colors"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "1rem 0.5rem",
                    background: isActive ? "var(--orange-mute)" : "var(--panel-mute)",
                    border: isActive ? "2px solid var(--orange)" : "1px solid var(--rule)",
                    minHeight: 110,
                    cursor: "pointer",
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      width: 48,
                      height: 48,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isActive ? "var(--orange)" : "var(--slate)",
                      color: isActive ? "var(--void)" : "var(--ink)",
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: "1.1rem",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {s.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      initialsOf(s.name)
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      color: "var(--ink)",
                      lineHeight: 1.1,
                      textAlign: "center",
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.55rem",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      color: isActive ? "var(--orange)" : "var(--ink-faint)",
                    }}
                  >
                    {ROLE_LABEL[s.role] || s.role}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          // PIN entry
          <div style={{ padding: "1.25rem 1rem 1rem" }}>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <div
                aria-hidden
                style={{
                  width: 56,
                  height: 56,
                  margin: "0 auto 0.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--orange)",
                  color: "var(--void)",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "1.3rem",
                  letterSpacing: "0.05em",
                }}
              >
                {selected.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  initialsOf(selected.name)
                )}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.05rem", color: "var(--ink)" }}>
                {selected.name}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.6rem",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color: "var(--ink-faint)",
                  marginTop: "0.15rem",
                }}
              >
                {ROLE_LABEL[selected.role] || selected.role}
              </div>
            </div>

            {/* PIN dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: "0.6rem", marginBottom: "1rem" }}>
              {[0, 1, 2, 3].map((i) => {
                const filled = i < pin.length;
                return (
                  <span
                    key={i}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: filled ? "var(--orange)" : "transparent",
                      border: `2px solid ${filled ? "var(--orange)" : "var(--rule-hi)"}`,
                      transition: "background 0.15s, border-color 0.15s",
                    }}
                  />
                );
              })}
            </div>

            {/* Hidden input — keeps physical-keyboard typing fast */}
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, "").slice(0, 8);
                setPin(next);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && pin.length >= 4) submit();
              }}
              autoFocus
              autoComplete="off"
              style={{
                position: "absolute",
                opacity: 0,
                pointerEvents: "none",
                width: 1,
                height: 1,
              }}
            />

            {/* Numpad */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, idx) =>
                k === "" ? (
                  <div key={`spacer-${idx}`} />
                ) : (
                  <button
                    key={k}
                    type="button"
                    onClick={() => (k === "⌫" ? handleBackspace() : handleDigit(k))}
                    disabled={authing}
                    className="transition-transform active:scale-95"
                    style={{
                      height: 60,
                      background: "var(--panel-mute)",
                      border: "1px solid var(--rule)",
                      color: k === "⌫" ? "var(--red)" : "var(--ink)",
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: k === "⌫" ? "1.1rem" : "1.25rem",
                      cursor: authing ? "not-allowed" : "pointer",
                      touchAction: "manipulation",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    {k}
                  </button>
                ),
              )}
            </div>

            {error && (
              <div
                style={{
                  marginTop: "0.75rem",
                  textAlign: "center",
                  color: "var(--red)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  letterSpacing: "0.06em",
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={() => {
                setSelected(null);
                setPin("");
                setError(null);
              }}
              disabled={authing}
              style={{
                marginTop: "0.75rem",
                width: "100%",
                padding: "0.6rem",
                fontFamily: "var(--font-mono)",
                fontSize: "0.7rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                fontWeight: 600,
                color: "var(--ink-faint)",
                background: "transparent",
                border: "none",
                cursor: authing ? "not-allowed" : "pointer",
              }}
            >
              ← Pick someone else
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
