"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChromeNav, PlayerCard, Workbench } from "@/app/components/card-shell";
import { TYPE, TitleBar } from "@/app/components/ui";

interface VerifiedEntity {
  id: string;
  slug: string;
  name: string;
  status: string;
}

function ClaimVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { data: session, status: sessionStatus } = useSession();

  const [state, setState] = useState<"verifying" | "ok" | "needs_login" | "error">(
    sessionStatus === "loading" ? "verifying" : "verifying",
  );
  const [message, setMessage] = useState<string>("");
  const [entity, setEntity] = useState<VerifiedEntity | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Missing claim token. Open the link from your email.");
      return;
    }
    if (sessionStatus === "loading") return;
    if (!session?.user?.id) {
      setState("needs_login");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/entities/claim/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.ok) {
          setState("ok");
          setEntity(data.entity);
          setMessage(`You're now the owner of ${data.entity.name}.`);
          // Auto-redirect to the (now-active) store page after a beat
          setTimeout(() => {
            router.push(`/stores/${data.entity.slug}`);
          }, 1800);
        } else if (data?.login_required) {
          setState("needs_login");
        } else {
          setState("error");
          setMessage(data?.error || "Claim verification failed.");
        }
      } catch {
        if (!cancelled) {
          setState("error");
          setMessage("Could not reach the server. Try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, session, sessionStatus, router]);

  const callbackUrl = `/claim/verify?token=${encodeURIComponent(token ?? "")}`;
  const loginHref = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const signupHref = `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <>
      <ChromeNav signedIn={!!session?.user} />
      <Workbench>
        <PlayerCard maxWidth="28rem">
          <TitleBar
            left={
              state === "ok"
                ? "Claim Confirmed"
                : state === "needs_login"
                  ? "Sign in to confirm"
                  : state === "error"
                    ? "Claim Issue"
                    : "Verifying Claim"
            }
          />
          <div
            style={{
              padding: "2rem var(--pad-x) 1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              textAlign: "center",
            }}
          >
            {state === "verifying" && (
              <>
                <h1
                  style={{
                    ...TYPE.display,
                    fontSize: "clamp(1.4rem, 4vw, 1.8rem)",
                    color: "var(--cream)",
                    margin: 0,
                  }}
                >
                  Confirming…
                </h1>
                <p
                  style={{
                    ...TYPE.body,
                    fontSize: "0.9rem",
                    color: "var(--ink-soft)",
                    margin: 0,
                  }}
                >
                  Wiring up your store ownership.
                </p>
              </>
            )}

            {state === "needs_login" && (
              <>
                <h1
                  style={{
                    ...TYPE.display,
                    fontSize: "clamp(1.4rem, 4vw, 1.8rem)",
                    color: "var(--cream)",
                    margin: 0,
                  }}
                >
                  Sign in to confirm
                </h1>
                <p
                  style={{
                    ...TYPE.body,
                    fontSize: "0.9rem",
                    color: "var(--ink-soft)",
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  You need to be signed in to your Afterroar Passport to take
                  ownership of this store. Use the same account you started
                  the claim with.
                </p>
                <a
                  href={loginHref}
                  style={{
                    padding: "0.85rem 1.25rem",
                    background: "var(--orange)",
                    color: "var(--void, #1a1a1a)",
                    ...TYPE.display,
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Sign In
                </a>
                <a
                  href={signupHref}
                  style={{
                    color: "var(--orange)",
                    ...TYPE.body,
                    fontSize: "0.85rem",
                  }}
                >
                  Don&apos;t have a Passport? Create one →
                </a>
              </>
            )}

            {state === "ok" && entity && (
              <>
                <div
                  style={{
                    fontSize: "3rem",
                    color: "var(--green, #7db87d)",
                    lineHeight: 1,
                  }}
                >
                  ✓
                </div>
                <h1
                  style={{
                    ...TYPE.display,
                    fontSize: "clamp(1.4rem, 4vw, 1.8rem)",
                    color: "var(--cream)",
                    margin: 0,
                  }}
                >
                  {entity.name} is yours
                </h1>
                <p
                  style={{
                    ...TYPE.body,
                    fontSize: "0.9rem",
                    color: "var(--ink-soft)",
                    margin: 0,
                  }}
                >
                  {message}
                </p>
                <p
                  style={{
                    ...TYPE.body,
                    fontSize: "0.78rem",
                    color: "var(--ink-faint)",
                    margin: 0,
                  }}
                >
                  Taking you to your store page…
                </p>
              </>
            )}

            {state === "error" && (
              <>
                <div
                  style={{
                    padding: "0.75rem 0.9rem",
                    background: "rgba(196, 77, 77, 0.08)",
                    border: "1px solid rgba(196, 77, 77, 0.3)",
                    color: "var(--red)",
                    ...TYPE.body,
                    fontSize: "0.88rem",
                  }}
                >
                  {message}
                </div>
                <a
                  href="/stores"
                  style={{
                    color: "var(--orange)",
                    ...TYPE.body,
                    fontSize: "0.88rem",
                  }}
                >
                  Back to stores
                </a>
              </>
            )}
          </div>
        </PlayerCard>
      </Workbench>
    </>
  );
}

export default function ClaimVerifyPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
          }}
        >
          <p style={{ color: "var(--orange)" }}>Loading…</p>
        </main>
      }
    >
      <ClaimVerifyContent />
    </Suspense>
  );
}
