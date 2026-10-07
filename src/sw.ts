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
// Campos extras do payload (enviados pelas Edge Functions send-daily-reminders/send-visit-reminders):
//   type      'daily' | 'visit'  -- tipo do aviso
//   urgency   'normal' | 'firm'  -- 'firm' = vibração longa e a notificação fica na tela até tocar
//   tag       substitui o aviso anterior de mesma tag em vez de empilhar (e toca/vibra de novo)
//   badgeCount  número no ícone do app (0 limpa)
interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  type?: string;
  urgency?: 'normal' | 'firm';
  tag?: string;
  badgeCount?: number;
}

const VIBRATE_NORMAL = [200, 100, 200];
const VIBRATE_FIRM = [500, 150, 500, 150, 500, 150, 700];

self.addEventListener('push', (event: PushEvent) => {
  let data: PushPayload = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() };
  }

  const title = data.title || 'Capelania Pro';
  const body = data.body || 'Você tem novidades no Capelania Pro.';
  const strong = data.urgency === 'firm' || data.type === 'visit';

  event.waitUntil((async () => {
    // O app está aberto e visível? Então quem toca o som é a própria página (um sinozinho nosso,
    // ver src/components/PushFeedback.tsx) e a notificação do sistema sai SILENCIOSA, pra não tocar
    // dois sons ao mesmo tempo. Com o app fechado/em segundo plano, vale o som padrão do aparelho --
    // navegador nenhum deixa um site escolher o som de uma notificação push.
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visibleClients = allClients.filter(c => (c as WindowClient).visibilityState === 'visible');

    const options: any = {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
      // `tag` obrigatória quando renotify=true: um aviso novo troca o anterior e ainda alerta de novo.
      tag: data.tag || 'capelania-pro',
      renotify: true,
      // No computador, a notificação "firme" não some sozinha até a pessoa tocar/fechar.
      requireInteraction: strong,
      // Vibração só no Android (iPhone ignora). Firme = padrão longo e marcante.
      vibrate: strong ? VIBRATE_FIRM : VIBRATE_NORMAL,
      silent: visibleClients.length > 0
    };

    await self.registration.showNotification(title, options);

    // Número no ícone do app instalado (Android Chrome e iPhone 16.4+ com o app na tela de início).
    if (typeof data.badgeCount === 'number') {
      try {
        const nav: any = self.navigator;
        if (data.badgeCount > 0) await nav.setAppBadge?.(data.badgeCount);
        else await nav.clearAppBadge?.();
      } catch {
        // sem suporte: tudo bem, é só um reforço
      }
    }

    // Avisa as abas visíveis pra tocarem o som e mostrarem o aviso dentro do app.
    visibleClients.forEach(c => c.postMessage({
      type: 'PUSH_RECEIVED',
      title,
      body,
      kind: data.type || 'generic',
      urgency: data.urgency || 'normal'
    }));
  })());
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
