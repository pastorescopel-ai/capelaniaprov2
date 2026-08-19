/// <reference lib="webworker" />
// Service worker customizado (troca do modo "generateSW" automático pro "injectManifest")
// -- precisou dessa troca só para poder escrever os handlers de push/notificationclick
// abaixo à mão; o modo automático anterior não permitia código de push nenhum.
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

// Pré-cache dos arquivos do build (mesma coisa que o modo automático já fazia).
precacheAndRoute(self.__WB_MANIFEST);

// Mesmo cache de fontes/ícones que já existia em vite.config.ts antes da troca de modo.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] })
    ]
  })
);

registerRoute(
  ({ url }) => url.origin === 'https://cdnjs.cloudflare.com',
  new CacheFirst({
    cacheName: 'font-awesome-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] })
    ]
  })
);

// Lembrete diário (12h/18h, disparado pela Edge Function send-daily-reminders via pg_cron) --
// esse listener é o que efetivamente mostra a notificação do sistema quando o push chega,
// mesmo com o app fechado.
self.addEventListener('push', (event: PushEvent) => {
  let data: { title?: string; body?: string; url?: string } = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() };
  }

  const title = data.title || 'Capelania Pro';
  const options: NotificationOptions = {
    body: data.body || 'Você tem novidades no Capelania Pro.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Tocar na notificação foca uma aba já aberta do app, ou abre uma nova.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return (client as WindowClient).focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

self.skipWaiting();
self.addEventListener('activate', () => self.clients.claim());
