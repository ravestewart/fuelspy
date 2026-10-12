// FuelSpy service worker (spec F10). It caches nothing: every request goes to the network, so prices
// are never stale. It exists so the app can be installed to the home screen.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request)));
