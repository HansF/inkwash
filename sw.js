'use strict';

const CACHE = 'inkwash-v2';
const SHELL = [
  './',
  './index.html',
  './about.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './images/inkwash_tests.png',
  './images/sketches.png',
  './js/main.js',
  './js/config.js',
  './js/gl.js',
  './js/shaders.js',
  './js/sim.js',
  './js/input.js',
  './js/ui.js',
  './js/gallery.js',
  './js/storage.js',
  './js/share.js',
  './js/native.js',
  './js/onboarding.js',
  './js/tools/index.js',
  './js/tools/pen.js',
  './js/tools/brush.js',
  './js/tools/fude.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
