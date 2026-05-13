'use client';

import { useEffect, useState } from 'react';
import { TYPE } from '@/app/components/ui';
import {
  registerServiceWorker,
  isPushSupported,
  notificationPermission,
  requestNotificationPermission,
  subscribeToPush,
} from '@/lib/pwa/push-client';

/**
 * PWA bootstrap — drop this once near the top of the Passport-shell
 * layout to:
 *
 *   1. Register the service worker on first load.
 *   2. After the user has engaged (any click after the page is shown),
 *      surface a small unobtrusive "Get notifications" banner if
 *      notifications haven't been requested yet.
 *   3. Catch the beforeinstallprompt event and offer "Add to Home
 *      Screen" once the user has been on Passport for ≥ 20 seconds
 *      AND clicked something at least once.
 *
 * Deliberately quiet — no permission spam on page load, no
 * "install our app!" interstitials. The Passport mobile vision
 * earns its install; the banner is a nudge not a wall.
 *
 * Renders nothing if neither prompt is relevant.
 */

const DISMISS_STORAGE_KEY = 'afterroar-pwa-bootstrap-v1';
const ENGAGEMENT_DELAY_MS = 20_000;

type DismissedState = {
  notifications?: number;
  install?: number;
};

function readDismissed(): DismissedState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as DismissedState;
  } catch {
    return {};
  }
}

function writeDismissed(patch: DismissedState) {
  if (typeof window === 'undefined') return;
  try {
    const current = readDismissed();
    window.localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    /* ignore quota */
  }
}

// 14 days between re-prompts after dismiss.
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

function recentlyDismissed(ts: number | undefined): boolean {
  if (!ts) return false;
  return Date.now() - ts < DISMISS_COOLDOWN_MS;
}

export function PwaBootstrap() {
  const [mounted, setMounted] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showNotificationNudge, setShowNotificationNudge] = useState(false);
  const [showInstallNudge, setShowInstallNudge] = useState(false);
  const [busy, setBusy] = useState(false);

  // SW registration on mount.
  useEffect(() => {
    setMounted(true);
    registerServiceWorker().catch(() => {});
  }, []);

  // Capture beforeinstallprompt for our own UI.
  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  // Engagement gate — surface nudges once user has been here ≥ 20s
  // AND clicked something. Stops us from spamming opens-then-bounces.
  useEffect(() => {
    if (!mounted) return;
    let hasClicked = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function maybeShow() {
      const dismissed = readDismissed();

      // Notification nudge — only if push is supported AND permission
      // is still 'default' (we haven't asked yet) AND no recent dismiss.
      if (
        isPushSupported() &&
        notificationPermission() === 'default' &&
        !recentlyDismissed(dismissed.notifications)
      ) {
        setShowNotificationNudge(true);
      }

      // Install nudge — only if a beforeinstallprompt fired AND no recent dismiss.
      if (installEvent && !recentlyDismissed(dismissed.install)) {
        setShowInstallNudge(true);
      }
    }

    function onClick() {
      hasClicked = true;
      if (timer === null) {
        timer = setTimeout(() => {
          if (hasClicked) maybeShow();
        }, ENGAGEMENT_DELAY_MS);
      }
    }

    window.addEventListener('click', onClick, { once: true });

    // Also try the show after a base delay even without a click — if
    // the user is reading the page passively, that's still engagement.
    const baseTimer = setTimeout(maybeShow, ENGAGEMENT_DELAY_MS + 5_000);

    return () => {
      window.removeEventListener('click', onClick);
      if (timer) clearTimeout(timer);
      clearTimeout(baseTimer);
    };
  }, [mounted, installEvent]);

  async function handleEnableNotifications() {
    setBusy(true);
    try {
      const perm = await requestNotificationPermission();
      if (perm === 'granted') {
        await subscribeToPush();
      }
      setShowNotificationNudge(false);
    } finally {
      setBusy(false);
    }
  }

  function dismissNotifications() {
    writeDismissed({ notifications: Date.now() });
    setShowNotificationNudge(false);
  }

  async function handleInstall() {
    if (!installEvent) return;
    setBusy(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome !== 'accepted') {
        writeDismissed({ install: Date.now() });
      }
      setShowInstallNudge(false);
      setInstallEvent(null);
    } finally {
      setBusy(false);
    }
  }

  function dismissInstall() {
    writeDismissed({ install: Date.now() });
    setShowInstallNudge(false);
  }

  if (!mounted) return null;

  // Show at most one nudge at a time. Notification takes priority —
  // it's higher signal for re-engagement.
  if (showNotificationNudge) {
    return (
      <NudgeBanner
        title="Get notified when something happens"
        body="Game-night invites, recap-ready, store check-ins. Quiet by default — you control what comes through."
        primaryLabel={busy ? 'Working…' : 'Enable notifications'}
        primaryDisabled={busy}
        onPrimary={handleEnableNotifications}
        onDismiss={dismissNotifications}
      />
    );
  }

  if (showInstallNudge && installEvent) {
    return (
      <NudgeBanner
        title="Install Afterroar"
        body="Add Passport to your home screen — opens like a real app, gets notifications, works fast."
        primaryLabel={busy ? 'Working…' : 'Add to home screen'}
        primaryDisabled={busy}
        onPrimary={handleInstall}
        onDismiss={dismissInstall}
      />
    );
  }

  return null;
}

interface NudgeBannerProps {
  title: string;
  body: string;
  primaryLabel: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  onDismiss: () => void;
}

function NudgeBanner({ title, body, primaryLabel, primaryDisabled, onPrimary, onDismiss }: NudgeBannerProps) {
  return (
    <div
      role="region"
      aria-label={title}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#2a2f3a',
        borderTop: '2px solid #FF8200',
        padding: '1rem 1.1rem 1.1rem',
        zIndex: 1000,
        boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.4)',
      }}
    >
      <div style={{ maxWidth: '32rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <p
          style={{
            ...TYPE.mono,
            fontSize: '0.62rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: '#FF8200',
            fontWeight: 700,
            margin: 0,
          }}
        >
          Afterroar Passport
        </p>
        <p
          style={{
            ...TYPE.displayMd,
            color: 'var(--cream, #f5e9c9)',
            fontSize: '1.05rem',
            fontWeight: 700,
            margin: 0,
            lineHeight: 1.25,
          }}
        >
          {title}
        </p>
        <p style={{ ...TYPE.body, color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>{body}</p>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
          <button
            type="button"
            onClick={onPrimary}
            disabled={primaryDisabled}
            style={{
              flex: 1,
              padding: '0.7rem 0.95rem',
              background: '#FF8200',
              color: 'var(--void, #2a2f3a)',
              border: 'none',
              fontSize: '0.88rem',
              fontWeight: 800,
              cursor: primaryDisabled ? 'wait' : 'pointer',
              opacity: primaryDisabled ? 0.6 : 1,
            }}
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              padding: '0.7rem 1rem',
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #2a2a4a',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

// beforeinstallprompt typing — not in lib.dom yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}
