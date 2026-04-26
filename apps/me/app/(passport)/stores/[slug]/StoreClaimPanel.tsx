"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { TYPE } from "@/app/components/ui";
import { Shield, ChevronRight } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Store Claim Panel                                                  */
/*                                                                      */
/*  Renders inline on /stores/[slug] when the venue's status is        */
/*  "unclaimed" or "pending". Shows differently in three states:       */
/*    1. Logged out → "Sign in to claim this store" CTA                */
/*    2. Logged in, claim not started → claim initiation form          */
/*    3. Logged in, after submit → "Check your email" confirmation     */
/*                                                                      */
/*  Status="pending" (someone else's claim is in flight) is rendered    */
/*  with a disclaimer so the user knows there's a competing claim.     */
/* ------------------------------------------------------------------ */

interface StoreClaimPanelProps {
  slug: string;
  storeName: string;
  status: string; // "unclaimed" | "pending"
  websiteUrl: string | null;
}

export function StoreClaimPanel({ slug, storeName, status, websiteUrl }: StoreClaimPanelProps) {
  const { data: session, status: sessionStatus } = useSession();
  const [stage, setStage] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [domainMatch, setDomainMatch] = useState<boolean | null>(null);

  const callbackUrl = `/stores/${slug}`;
  const loginHref = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const signupHref = `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const isLoggedIn = sessionStatus === "authenticated" && !!session?.user;
  const pendingClaim = status === "pending";

  // Suggest the website's apex domain so a quick eye scan reveals if the
  // claimant's email might auto-trust on domain match (a hint, not a gate).
  const suggestDomain = websiteUrl
    ? (() => {
        try {
          const url = new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`);
          return url.hostname.replace(/^www\./, "");
        } catch {
          return null;
        }
      })()
    : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (stage === "submitting") return;
    setError(null);

    if (!contactEmail.includes("@")) {
      setError("Enter a valid email at this store.");
      return;
    }

    setStage("submitting");
    try {
      const res = await fetch(`/api/entities/${slug}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactEmail: contactEmail.trim(),
          contactName: contactName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Could not start the claim. Try again.");
        setStage("error");
        return;
      }
      setDomainMatch(!!data.domain_match);
      setStage("sent");
    } catch {
      setError("Could not reach the server. Try again.");
      setStage("error");
    }
  }

  return (
    <div
      style={{
        margin: "0.5rem var(--pad-x) 0",
        background: "linear-gradient(135deg, rgba(255, 130, 0, 0.08) 0%, rgba(245, 158, 11, 0.04) 100%)",
        border: "1.5px solid var(--orange)",
        borderLeft: "4px solid var(--orange)",
        padding: "1rem 1.1rem",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.45rem",
          marginBottom: "0.4rem",
        }}
      >
        <Shield size={16} color="var(--orange)" strokeWidth={2.5} />
        <span
          style={{
            ...TYPE.mono,
            fontSize: "0.6rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "var(--orange)",
          }}
        >
          {pendingClaim ? "Claim in progress" : "Unclaimed listing"}
        </span>
      </div>

      {/* Stage 1: not logged in */}
      {!isLoggedIn && (
        <>
          <p
            style={{
              ...TYPE.body,
              color: "var(--ink)",
              fontSize: "0.92rem",
              lineHeight: 1.5,
              margin: "0 0 0.85rem",
            }}
          >
            Are you the owner of <strong>{storeName}</strong>? Claim this listing to update
            your details, manage staff, and connect Afterroar tools.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Link
              href={loginHref}
              style={{
                padding: "0.6rem 1rem",
                background: "var(--orange)",
                color: "var(--void, #1a1a1a)",
                ...TYPE.display,
                fontSize: "0.85rem",
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              Sign in to claim <ChevronRight size={14} />
            </Link>
            <Link
              href={signupHref}
              style={{
                padding: "0.6rem 1rem",
                background: "transparent",
                color: "var(--orange)",
                border: "1.5px solid var(--orange)",
                ...TYPE.display,
                fontSize: "0.85rem",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Create a Passport
            </Link>
          </div>
        </>
      )}

      {/* Stage 2: logged in, not yet submitted */}
      {isLoggedIn && stage !== "sent" && (
        <>
          <p
            style={{
              ...TYPE.body,
              color: "var(--ink)",
              fontSize: "0.92rem",
              lineHeight: 1.5,
              margin: "0 0 0.85rem",
            }}
          >
            {pendingClaim ? (
              <>
                A claim for <strong>{storeName}</strong> is in flight. If that&apos;s yours,
                check your email. If it&apos;s not, you can submit your own claim — the
                first to verify wins.
              </>
            ) : (
              <>
                Are you the owner of <strong>{storeName}</strong>? Confirm your email at
                this store and we&apos;ll send a verification link.
              </>
            )}
          </p>
          <form
            onSubmit={submit}
            style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}
          >
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder={suggestDomain ? `you@${suggestDomain}` : "owner@your-store.com"}
              required
              style={{
                padding: "0.65rem 0.85rem",
                background: "var(--panel-mute)",
                border: "1.5px solid var(--rule)",
                color: "var(--cream)",
                ...TYPE.body,
                fontSize: "0.92rem",
                outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--orange)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--rule)")}
            />
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Your name (optional)"
              style={{
                padding: "0.65rem 0.85rem",
                background: "var(--panel-mute)",
                border: "1.5px solid var(--rule)",
                color: "var(--cream)",
                ...TYPE.body,
                fontSize: "0.92rem",
                outline: "none",
              }}
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
            <button
              type="submit"
              disabled={stage === "submitting"}
              style={{
                padding: "0.65rem 1rem",
                background: "var(--orange)",
                color: "var(--void, #1a1a1a)",
                border: "none",
                ...TYPE.display,
                fontSize: "0.9rem",
                fontWeight: 700,
                cursor: stage === "submitting" ? "not-allowed" : "pointer",
                opacity: stage === "submitting" ? 0.6 : 1,
              }}
            >
              {stage === "submitting" ? "Sending…" : "Send verification link"}
            </button>
            {suggestDomain && (
              <p
                style={{
                  ...TYPE.mono,
                  fontSize: "0.66rem",
                  letterSpacing: "0.06em",
                  color: "var(--ink-faint)",
                  margin: "0.2rem 0 0",
                }}
              >
                Tip: an email at <strong>@{suggestDomain}</strong> auto-trusts on domain match.
              </p>
            )}
          </form>
        </>
      )}

      {/* Stage 3: submitted */}
      {isLoggedIn && stage === "sent" && (
        <>
          <p
            style={{
              ...TYPE.body,
              color: "var(--ink)",
              fontSize: "0.92rem",
              lineHeight: 1.5,
              margin: "0 0 0.5rem",
            }}
          >
            ✓ Verification link sent to <strong>{contactEmail}</strong>.{" "}
            {domainMatch ? (
              <>
                That email matches the store&apos;s domain — your claim will move fast.
              </>
            ) : (
              <>
                Click the link from that inbox to confirm ownership. The link expires in 72 hours.
              </>
            )}
          </p>
          <p
            style={{
              ...TYPE.mono,
              fontSize: "0.66rem",
              letterSpacing: "0.06em",
              color: "var(--ink-faint)",
              margin: 0,
            }}
          >
            Didn&apos;t arrive? Check spam, or use a different email above.
          </p>
        </>
      )}
    </div>
  );
}
