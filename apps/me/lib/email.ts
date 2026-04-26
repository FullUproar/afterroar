/**
 * Transactional email — Passport.
 *
 * Uses Resend (via RESEND_API_KEY env var). Fire-and-forget: we never block
 * the caller, and missing config logs to console + returns false rather than
 * throwing. That keeps verification flows robust during local dev where the
 * key isn't set.
 */

const RESEND_API_URL = "https://api.resend.com/emails";

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
  text?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `[Email] No RESEND_API_KEY — skipping: "${params.subject}" → ${params.to}`,
    );
    if (process.env.NODE_ENV !== "production") {
      // Helpful in dev: print the verification link so we can click it.
      console.log("[Email] Body preview:\n", stripHtml(params.html).slice(0, 800));
    }
    return false;
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: params.from || process.env.EMAIL_FROM || "Afterroar <noreply@afterroar.me>",
        to: params.to,
        subject: params.subject,
        html: params.html,
        ...(params.text ? { text: params.text } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[Email] Resend ${res.status}:`, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Send failed:", err);
    return false;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

export function verifyEmailTemplate(verifyUrl: string, displayName?: string | null): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = displayName ? `Hey ${displayName}` : "Hey there";
  const subject = "Verify your Afterroar Passport";
  const text = `${greeting},

Tap this link to verify your email and finish setting up your Afterroar Passport:

${verifyUrl}

This link expires in 24 hours. If you didn't sign up, you can ignore this email.

— Afterroar`;
  const html = `
<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; max-width: 540px; margin: 0 auto; padding: 32px 24px;">
    <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 16px;">Verify your Afterroar Passport</h1>
    <p style="font-size: 15px; line-height: 1.5; margin: 0 0 12px;">${greeting},</p>
    <p style="font-size: 15px; line-height: 1.5; margin: 0 0 24px;">
      Tap the button below to verify your email and finish setting up your Passport.
    </p>
    <p style="margin: 0 0 32px;">
      <a href="${verifyUrl}"
         style="display: inline-block; padding: 12px 24px; background: #ff6b35; color: #fff; text-decoration: none; font-weight: 600; border-radius: 4px;">
        Verify Email
      </a>
    </p>
    <p style="font-size: 13px; color: #666; line-height: 1.5; margin: 0 0 8px;">
      Or copy this link into your browser:<br>
      <span style="word-break: break-all;">${verifyUrl}</span>
    </p>
    <p style="font-size: 12px; color: #999; margin: 24px 0 0;">
      This link expires in 24 hours. If you didn't sign up, you can ignore this email.
    </p>
  </body>
</html>`.trim();

  return { subject, html, text };
}
