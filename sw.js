/* ELID — Service Worker (PWA). Páginas: rede primeiro (sempre a versão mais nova quando online; cópia salva para uso offline). */
var VERSION = 'elid-v1';
var PAGES = VERSION + '-pages';
var ASSETS = VERSION + '-assets';
var PRECACHE = ['./landing-page/', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
var CDN = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com',
           'cdn.tailwindcss.com', 'unpkg.com', 'www.gstatic.com', 'code.jquery.com'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(PAGES).then(function (c) { return c.addAll(PRECACHE); }).catch(function () {}));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf(VERSION) !== 0; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function networkFirst(req) {
  var key = req.url.split('#')[0].split('?')[0];
  return fetch(key, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(PAGES).then(function (c) { c.put(key, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(key).then(function (hit) {
      return hit || caches.match('./landing-page/') || new Response('Sem conexão.', { status: 503 });
    });
  });
}

function staleWhileRevalidate(req) {
  return caches.open(ASSETS).then(function (c) {
    return c.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) {
    var isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') > -1;
    e.respondWith(isPage ? networkFirst(req) : staleWhileRevalidate(req));
  } else if (CDN.indexOf(url.hostname) > -1) {
    e.respondWith(staleWhileRevalidate(req));
  }
  /* Firebase (login/Firestore) e demais APIs passam direto, sem cache. */
});
