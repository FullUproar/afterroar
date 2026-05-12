/**
 * Browser-side helpers for Passport PWA: SW registration + push
 * subscription. Keep small + side-effect-free so it can be imported
 * from any client component without a hook cascade.
 */

const SW_PATH = '/sw.js';

export interface PushSupport {
  serviceWorker: boolean;
  pushManager: boolean;
  notifications: boolean;
}

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') {
    return { serviceWorker: false, pushManager: false, notifications: false };
  }
  return {
    serviceWorker: 'serviceWorker' in navigator,
    pushManager: 'PushManager' in window,
    notifications: 'Notification' in window,
  };
}

export function isPushSupported(): boolean {
  const s = pushSupport();
  return s.serviceWorker && s.pushManager && s.notifications;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (existing) return existing;
    return await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
  } catch (err) {
    console.warn('[pwa] SW register failed', err);
    return null;
  }
}

export function notificationPermission(): NotificationPermission {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return await Notification.requestPermission();
}

/**
 * Fetch VAPID public key, subscribe via PushManager, POST subscription
 * to the server. Returns true if a subscription is in place at the end
 * (whether or not we created a new one in this call).
 *
 * Caller must ensure Notification permission is already 'granted'.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (notificationPermission() !== 'granted') return false;

  const reg = await registerServiceWorker();
  if (!reg) return false;

  // Already subscribed? Re-send to server (in case the server doesn't
  // have it for any reason) and return.
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    await postSubscription(existing, 'reconnect');
    return true;
  }

  // Fetch the VAPID public key from the server.
  let key: string;
  try {
    const res = await fetch('/api/push/vapid-public-key');
    if (!res.ok) return false;
    const data = await res.json();
    key = data.key;
    if (!key) return false;
  } catch {
    return false;
  }

  let subscription: PushSubscription;
  try {
    // PushManager.subscribe wants a BufferSource. Casting through
    // BufferSource here keeps TS happy on the SharedArrayBuffer vs
    // ArrayBuffer distinction without changing runtime behavior —
    // the underlying buffer is always an ArrayBuffer in practice.
    const applicationServerKey = urlBase64ToUint8Array(key) as unknown as BufferSource;
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  } catch (err) {
    console.warn('[pwa] push subscribe failed', err);
    return false;
  }

  return postSubscription(subscription, 'initial');
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  try {
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
  } catch {
    // Best-effort.
  }
  return true;
}

async function postSubscription(subscription: PushSubscription, reason: string): Promise<boolean> {
  try {
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        reason,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}
