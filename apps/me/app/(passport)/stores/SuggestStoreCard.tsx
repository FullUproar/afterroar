"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { TYPE } from "@/app/components/ui";
import { Plus, ChevronRight } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Suggest a Store card                                               */
/*                                                                      */
/*  Lives at the bottom of /stores. Three states: collapsed prompt,   */
/*  expanded form (signed in), and "thanks" confirmation. Doubles as   */
/*  the empty-state CTA when the directory has zero results too.       */
/* ------------------------------------------------------------------ */

export function SuggestStoreCard({ compact = false }: { compact?: boolean }) {
  const { data: session, status: sessionStatus } = useSession();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    | { kind: "duplicate"; slug: string; message: string }
    | { kind: "created"; slug: string; message: string; looseMatch?: { slug: string; name: string } | null }
    | null
  >(null);

  const isLoggedIn = sessionStatus === "authenticated" && !!session?.user;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (name.trim().length < 2) {
      setError("Name is required.");
      return;
    }
    if (city.trim().length < 2) {
      setError("City is required so we can place the store on a map.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/venues/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          city: city.trim(),
          state: state.trim(),
          website: website.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Could not submit. Try again.");
        setSubmitting(false);
        return;
      }
      if (data.duplicate) {
        setResult({ kind: "duplicate", slug: data.slug, message: data.message });
      } else {
        setResult({
          kind: "created",
          slug: data.slug,
          message: data.message,
          looseMatch: data.loose_match ?? null,
        });
      }
    } catch {
      setError("Could not reach the server. Try again.");
      setSubmitting(false);
    }
  }

  // ───────── Result state ─────────
  if (result) {
    return (
      <div
        style={{
          marginTop: compact ? 0 : "1.5rem",
          padding: "1rem 1.1rem",
          border: "1.5px solid var(--orange)",
          borderLeft: "4px solid var(--orange)",
          background: "rgba(255, 130, 0, 0.06)",
        }}
      >
        <p
          style={{
            ...TYPE.mono,
            fontSize: "0.6rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "var(--orange)",
            margin: "0 0 0.5rem",
          }}
        >
          {result.kind === "duplicate" ? "Already in the directory" : "Thanks — added"}
        </p>
        <p
          style={{
            ...TYPE.body,
            color: "var(--ink)",
            fontSize: "0.92rem",
            lineHeight: 1.5,
            margin: "0 0 0.75rem",
          }}
        >
          {result.message}
        </p>
        {result.kind === "created" && result.looseMatch && (
          <p
            style={{
              ...TYPE.body,
              color: "var(--ink-soft)",
              fontSize: "0.82rem",
              lineHeight: 1.5,
              margin: "0 0 0.75rem",
            }}
          >
            Heads up: <Link href={`/stores/${result.looseMatch.slug}`} style={{ color: "var(--orange)" }}>{result.looseMatch.name}</Link> is also in the directory and looks similar — make sure you didn&apos;t just add a duplicate.
          </p>
        )}
        <Link
          href={`/stores/${result.slug}`}
          style={{
            ...TYPE.display,
            fontSize: "0.85rem",
            fontWeight: 700,
            color: "var(--orange)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          {result.kind === "duplicate" ? "Open existing listing" : "Open the new listing"} <ChevronRight size={14} />
        </Link>
      </div>
    );
  }

  // ───────── Collapsed prompt ─────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          marginTop: compact ? 0 : "1.5rem",
          padding: "0.95rem 1.1rem",
          border: "1.5px dashed var(--rule-hi)",
          background: "transparent",
          color: "var(--ink-soft)",
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          ...TYPE.body,
          fontSize: "0.92rem",
          transition: "border-color 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--orange)";
          e.currentTarget.style.color = "var(--cream)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--rule-hi)";
          e.currentTarget.style.color = "var(--ink-soft)";
        }}
      >
        <Plus size={16} color="var(--orange)" strokeWidth={2.5} />
        <span>
          Don&apos;t see your local store?{" "}
          <span style={{ color: "var(--orange)", fontWeight: 600 }}>Add it →</span>
        </span>
      </button>
    );
  }

  // ───────── Logged-out form prompt ─────────
  if (!isLoggedIn) {
    const callbackUrl = "/stores";
    return (
      <div
        style={{
          marginTop: compact ? 0 : "1.5rem",
          padding: "1rem 1.1rem",
          border: "1.5px solid var(--rule-hi)",
          background: "var(--panel-mute)",
        }}
      >
        <p
          style={{
            ...TYPE.body,
            color: "var(--ink)",
            fontSize: "0.92rem",
            lineHeight: 1.5,
            margin: "0 0 0.85rem",
          }}
        >
          Sign in to suggest a store. We require a Passport to keep submissions
          legit (and so the actual store owner can claim the listing later).
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            style={{
              padding: "0.55rem 0.95rem",
              background: "var(--orange)",
              color: "var(--void, #1a1a1a)",
              ...TYPE.display,
              fontSize: "0.82rem",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Sign in
          </Link>
          <Link
            href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            style={{
              padding: "0.55rem 0.95rem",
              background: "transparent",
              color: "var(--orange)",
              border: "1.5px solid var(--orange)",
              ...TYPE.display,
              fontSize: "0.82rem",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Create a Passport
          </Link>
        </div>
      </div>
    );
  }

  // ───────── Form ─────────
  return (
    <form
      onSubmit={submit}
      style={{
        marginTop: compact ? 0 : "1.5rem",
        padding: "1rem 1.1rem",
        border: "1.5px solid var(--rule-hi)",
        background: "var(--panel-mute)",
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem",
      }}
    >
      <p
        style={{
          ...TYPE.mono,
          fontSize: "0.6rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: "var(--orange)",
          margin: 0,
        }}
      >
        Suggest a store
      </p>
      <p
        style={{
          ...TYPE.body,
          color: "var(--ink-soft)",
          fontSize: "0.84rem",
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        Add a local game store to the directory. The actual owner can claim
        and verify it later — your suggestion shows up immediately as a
        community-added listing.
      </p>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Store name"
        required
        style={inputStyle}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--orange)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--rule)")}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: "0.5rem" }}>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          required
          style={inputStyle}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--orange)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--rule)")}
        />
        <input
          type="text"
          value={state}
          onChange={(e) => setState(e.target.value)}
          placeholder="State"
          maxLength={2}
          style={{ ...inputStyle, textTransform: "uppercase" }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--orange)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--rule)")}
        />
      </div>
      <input
        type="url"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        placeholder="Website (optional)"
        style={inputStyle}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--orange)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--rule)")}
      />

      {error && (
        <p
          style={{
            ...TYPE.body,
            color: "var(--red)",
            fontSize: "0.82rem",
            margin: 0,
          }}
        >
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setName("");
            setCity("");
            setState("");
            setWebsite("");
            setError(null);
          }}
          style={{
            padding: "0.55rem 0.95rem",
            background: "transparent",
            color: "var(--ink-soft)",
            border: "none",
            ...TYPE.body,
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "0.55rem 0.95rem",
            background: "var(--orange)",
            color: "var(--void, #1a1a1a)",
            border: "none",
            ...TYPE.display,
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "Adding…" : "Add to directory"}
        </button>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "0.6rem 0.8rem",
  background: "var(--panel)",
  border: "1.5px solid var(--rule)",
  color: "var(--cream)",
  fontFamily: "var(--font-body)",
  fontSize: "0.92rem",
  outline: "none",
};
