"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChromeNav, PlayerCard, Workbench } from "@/app/components/card-shell";
import { TYPE, TitleBar } from "@/app/components/ui";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const [state, setState] = useState<"verifying" | "ok" | "error">("verifying");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!token || !email) {
      setState("error");
      setMessage("Missing verification details. Open the link from your email.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.ok) {
          setState("ok");
          setMessage("Email verified. You can sign in now.");
          // After a beat, send them to login
          // ?verified=1 shows the green "Email verified" banner on /login
          // ?fresh=1 tells /login to route this newly-verified user to
          // /welcome after they sign in, instead of dumping them on /
          setTimeout(() => router.push("/login?verified=1&fresh=1"), 1500);
        } else {
          setState("error");
          setMessage(data?.error || "Verification failed.");
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
  }, [token, email, router]);

  return (
    <>
      <ChromeNav signedIn={false} />
      <Workbench>
        <PlayerCard maxWidth="26rem">
          <TitleBar left="Verify Email" />
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
                  Verifying…
                </h1>
                <p style={{ ...TYPE.body, fontSize: "0.9rem", color: "var(--ink-soft)", margin: 0 }}>
                  One moment while we confirm your email.
                </p>
              </>
            )}
            {state === "ok" && (
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
                  Verified
                </h1>
                <p style={{ ...TYPE.body, fontSize: "0.9rem", color: "var(--ink-soft)", margin: 0 }}>
                  {message}
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
                  href="/login"
                  style={{
                    color: "var(--orange)",
                    ...TYPE.body,
                    fontSize: "0.88rem",
                  }}
                >
                  Back to sign in
                </a>
              </>
            )}
          </div>
        </PlayerCard>
      </Workbench>
    </>
  );
}

export default function VerifyEmailPage() {
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
      <VerifyEmailContent />
    </Suspense>
  );
}
