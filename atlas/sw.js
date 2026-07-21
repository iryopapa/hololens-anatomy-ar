// 解剖アトラス PWA サービスワーカー（オフライン対応・アプリシェル＋モデルを事前キャッシュ）
const CACHE = 'atlas-v25';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './dict.js',
  '../sync/config.js',
  '../sync/room.js',
  '../sync/viewsync.js',
  './vendor/arjs/ar-threex.js',
  './vendor/arjs/camera_para.dat',
  './vendor/arjs/patt.hiro',
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

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== self.location.origin) return;
  // 実物大AR用のUSDZ(7MB)はキャッシュしない。AR Quick Look はシステム側で取得するうえ、
  // 端末のストレージを二重に食うだけになる。
  if (u.pathname.endsWith('.usdz')) return;

  const put = (res) => { const c = res.clone(); caches.open(CACHE).then((k) => k.put(req, c)).catch(() => {}); return res; };

  // 🔥アプリ本体(HTML と vendor 以外のJS)は必ずネットワーク優先。
  //   全部キャッシュ優先にしていたため、修正しても実機に反映されるのが「次の次の読み込み」に
  //   なり、実機での不具合切り分けが毎回狂った（古い版を新しい版だと思って調べてしまう）。
  //   通信が無いときだけキャッシュへ落ちるので、オフライン動作は維持される。
  const isAppCode = u.pathname.endsWith('/') || u.pathname.endsWith('.html') ||
                    (u.pathname.endsWith('.js') && !u.pathname.includes('/vendor/'));
  if (isAppCode) {
    e.respondWith(fetch(req).then(put).catch(() => caches.match(req)));
    return;
  }

  // モデルやライブラリなど大きくて変わらない資産はキャッシュ優先のまま
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then(put).catch(() => hit))
  );
});
