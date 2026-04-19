/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

// Handle Push Notifications
self.addEventListener('push', (event) => {
  let data = { title: 'Notificação', body: 'Você tem uma nova mensagem.' };
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error('SW: Error parsing push data', e);
  }
  
  const options: NotificationOptions = {
    body: data.body,
    icon: `${self.location.origin}/favicon.ico`,
    badge: `${self.location.origin}/favicon.ico`,
    data: data.data || {},
    vibrate: [200, 100, 200, 100, 200],
    tag: `capelania-notif-${Date.now()}`, // Tag dinâmica força o aparecimento de novo balão
    timestamp: Date.now(),
    renotify: true,
    requireInteraction: true,
    silent: false, // Garante que não seja silenciosa
    actions: [
      { action: 'open', title: 'Abrir Sistema' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle Notification Clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open and focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window found, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
