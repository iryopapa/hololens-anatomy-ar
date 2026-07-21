// 解剖アトラス PWA サービスワーカー（オフライン対応・アプリシェル＋モデルを事前キャッシュ）
const CACHE = 'atlas-v16';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './dict.js',
  '../sync/config.js',
  '../sync/room.js',
  '../sync/viewsync.js',
  './icon-192.png',
  './icon-512.png',
  './vendor/three.module.js',
  './vendor/jsm/controls/OrbitControls.js',
  './vendor/jsm/loaders/GLTFLoader.js',
  './vendor/jsm/loaders/DRACOLoader.js',
  './vendor/jsm/utils/BufferGeometryUtils.js',
  './vendor/draco/draco_wasm_wrapper.js',
  './vendor/draco/draco_decoder.wasm',
  './vendor/anatomy.glb',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 同一オリジンGETはキャッシュ優先→なければ取得してキャッシュ。
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== self.location.origin) return;
  // 実物大AR用のUSDZ(7MB)はキャッシュしない。AR Quick Look はシステム側で取得するうえ、
  // 端末のストレージを二重に食うだけになる。
  if (u.pathname.endsWith('.usdz')) return;
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => hit))
  );
});
