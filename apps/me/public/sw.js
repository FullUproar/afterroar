/*
 * Afterroar Passport service worker.
 *
 * Scope: notification delivery + click routing. Intentionally minimal —
 * we don't precache the app shell yet (Next.js handles its own caching
 * and we don't want to fight it). Add cache strategies when offline
 * support actually matters.
 *
 * Push payload contract:
 *   {
 *     title: string,
 *     body: string,
 *     url?: string,      // relative path to open on click
 *     tag?: string,      // dedup key — same tag replaces in-flight notification
 *     badge?: string,    // path to small badge image (Android status bar)
 *     icon?: string,     // large icon
 *     image?: string,    // big image for expanded notification
 *     timestamp?: number,
 *     data?: object,     // forwarded to notificationclick event
 *   }
 */

const VERSION = '1';

self.addEventListener('install', (event) => {
  // Take over immediately on first install so users don't need a refresh.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/*
 * Web Push handler.
 *
 * Resilience: if the payload can't be parsed, fall back to a generic
 * notification rather than swallowing the push silently. A push that
 * arrives but doesn't surface is worse than a slightly-mysterious
 * notification — the user knows something happened.
 */
self.addEventListener('push', (event) => {
  let payload = null;
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      try {
        payload = { title: 'Afterroar', body: event.data.text() };
      } catch (e2) {
        payload = { title: 'Afterroar', body: 'You have a new notification.' };
      }
    }
  }
  if (!payload) {
    payload = { title: 'Afterroar', body: 'You have a new notification.' };
  }

  const title = payload.title || 'Afterroar';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    image: payload.image,
    tag: payload.tag,
    renotify: !!payload.tag,
    requireInteraction: false,
    timestamp: payload.timestamp || Date.now(),
    data: {
      url: payload.url || '/dashboard',
      ...payload.data,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a Passport window is already open, focus + navigate it.
      for (const client of clientList) {
        if ('focus' in client) {
          try {
            client.focus();
            if ('navigate' in client && new URL(client.url).origin === self.location.origin) {
              client.navigate(targetUrl);
              return;
            }
          } catch (e) {
            // navigate can fail in some browsers; fall through to open.
          }
        }
      }
      // Otherwise open a new window.
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});

/*
 * Pushsubscriptionchange — fires when the browser invalidates a
 * subscription (key rotation, expired endpoint, etc.). We POST the new
 * subscription to the server so we don't lose the user silently.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const subscription = await self.registration.pushManager.subscribe(
          event.oldSubscription
            ? { userVisibleOnly: true, applicationServerKey: event.oldSubscription.options.applicationServerKey }
            : { userVisibleOnly: true },
        );
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription,
            reason: 'pushsubscriptionchange',
          }),
        });
      } catch (e) {
        // Best-effort. User will be re-subscribed next time they open the app.
      }
    })(),
  );
});

self.addEventListener('message', (event) => {
  // Allow the page to ask the SW to skipWaiting (useful for "refresh to
  // update" flows).
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
