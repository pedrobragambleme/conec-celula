// Service worker do Conec Célula: funciona offline (tela base) e recebe notificações push.
const VERSION = 'conec-v1';
const SHELL = ['./', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icons/logo.svg', 'icons/icon-192.png',
  'js/app.js', 'js/ui.js', 'js/sb.js', 'js/config.js', 'js/push.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// arquivos do próprio app: rede primeiro, cache se estiver offline
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data.json(); } catch { data = { title: 'Conec Célula', body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(data.title || 'Conec Célula', {
    body: data.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-72.png',
    tag: data.tag,
    data: { url: data.url || './#/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = e.notification.data?.url || './#/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if ('focus' in c) { c.navigate(target).catch(() => {}); return c.focus(); }
    }
    return self.clients.openWindow(target);
  }));
});
