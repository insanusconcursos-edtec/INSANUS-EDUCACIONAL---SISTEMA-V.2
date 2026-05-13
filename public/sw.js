// SW v2
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => {}));
});

// Suporte a Notificações Push
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || "Você acabou de ganhar uma comissão. Confira seu saldo!",
        icon: "https://insanusconcursos.com/wp-content/uploads/2026/05/LOGO-MOBILE-2-INSANUS.png",
        badge: "https://insanusconcursos.com/wp-content/uploads/2026/05/LOGO-MOBILE-2-INSANUS.png",
        data: data.url || "/",
        vibrate: [200, 100, 200]
      };

      event.waitUntil(
        self.registration.showNotification(data.title || "VENDA REALIZADA! 🚀", options)
      );
    } catch (e) {
      // Se não for JSON, trata como texto
      const options = {
        body: event.data.text(),
        icon: "https://insanusconcursos.com/wp-content/uploads/2026/05/LOGO-MOBILE-2-INSANUS.png"
      };
      event.waitUntil(
        self.registration.showNotification("Notificação Insanus", options)
      );
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow(event.notification.data || '/')
  );
});
