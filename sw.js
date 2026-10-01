/**
 * Registro500 Giappone Service Worker
 *
 * 更新手順:
 *   CACHE_VERSION はデプロイ時に Cloudflare Pages のビルドスクリプト (build.sh) が
 *   自動的にコミットハッシュへ置換する。手動更新は不要。
 *   新しい SW は待機状態に入り、トップの「↻ 更新」ボタン（index.html の forceReload）が
 *   SKIP_WAITING を送ったとき、またはタブを全て閉じたときに切り替わる（無音更新・バナーなし）。
 *
 * キャッシュ戦略:
 *   - HTML:  NetworkFirst  （常に最新取得。オフライン時と、NETWORK_TIMEOUT_MS を超えたときはキャッシュから返す）
 *   - supabase-js（版番号固定の CDN 版）: CacheFirst（VENDOR_CACHE＝デプロイをまたいで保持）
 *   - CSS/JS(自サイト): StaleWhileRevalidate （即表示＋裏で更新）
 *   - 画像・アイコン: CacheFirst （長期キャッシュ）
 *   - Supabase / Stripe / GA 等の外部API: SW を通さない（素通り）
 */

const CACHE_VERSION = '__BUILD_VERSION__';
const RUNTIME_CACHE = `registro500-runtime-${CACHE_VERSION}`;
const HTML_CACHE = `registro500-html-${CACHE_VERSION}`;
// 版番号固定の外部ライブラリ置き場。名前が registro500- で始まらないので activate の掃除に掛からない。
const VENDOR_CACHE = 'vendor-v1';
const VENDOR_PATH = /^\/npm\/@supabase\/supabase-js@\d+\.\d+\.\d+$/;

// 起動に必須な HTML・config.js のネットワーク待ちの上限（ミリ秒）。
// 超えたら前回の保存分で先に表示し、取得は裏で続けて保存だけ更新する。
// iPhone のホーム画面起動の直後は通信が詰まることがあり、上限が無いと白いまま止まる。
const NETWORK_TIMEOUT_MS = 3500;

// SW で扱わないホスト（API・決済・解析・CDN等）
const BYPASS_HOSTS = [
  'supabase.co',
  'supabase.in',
  'buy.stripe.com',
  'js.stripe.com',
  'googletagmanager.com',
  'google-analytics.com',
  'cdn.jsdelivr.net',
  'maps.googleapis.com',
  'maps.gstatic.com',
];

self.addEventListener('install', (event) => {
  // install 完了を待たずに即 activate 可能状態へ（ただし clients への反映はユーザータップまで保留）
  // skipWaiting はメッセージ受信時のみ呼ぶ。ここでは呼ばない。
  self.skipWaiting = self.skipWaiting; // no-op (明示コメント用)
});

self.addEventListener('activate', (event) => {
  // 旧バージョンのキャッシュを削除
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('registro500-') &&
                           !key.endsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// クライアントからのメッセージ受信（更新バナー「更新」タップ時）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // GET 以外は素通り
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // supabase-js（版番号を固定した CDN 版）: CacheFirst・デプロイをまたいで保持
  // <head> で同期読み込みしているため、ここがネットワーク待ちで詰まると画面が真っ白のまま止まり、
  // 失敗すると supabase 未定義で全データ取得が落ちる（2026-10-01・iPhone のホーム画面起動で発生）。
  // 版番号付きの URL は中身が変わらないので、一度取れたら二度と取りに行かない。
  if (url.hostname === 'cdn.jsdelivr.net' && VENDOR_PATH.test(url.pathname)) {
    event.respondWith(cacheFirst(req, VENDOR_CACHE));
    return;
  }

  // 外部ホスト（API/決済/解析/CDN）は素通り
  if (BYPASS_HOSTS.some((host) => url.hostname.includes(host))) return;

  // 同一オリジン以外も素通り（クロスオリジン画像等）
  if (url.origin !== self.location.origin) return;

  // sw.js 自体のリクエストはブラウザに任せる
  if (url.pathname === '/sw.js') return;

  // config.js は NetworkFirst（API_URL等の設定変更を即時反映）
  if (url.pathname === '/config.js') {
    event.respondWith(networkFirst(req, RUNTIME_CACHE, NETWORK_TIMEOUT_MS));
    return;
  }

  // HTML リクエスト（ナビゲーション or .html）: NetworkFirst
  const isHtml =
    req.mode === 'navigate' ||
    req.destination === 'document' ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('/');

  if (isHtml) {
    event.respondWith(networkFirst(req, HTML_CACHE, NETWORK_TIMEOUT_MS));
    return;
  }

  // データJSON: NetworkFirst（中身が更新されるので古いものを先に返さない）
  // fetch() で取るJSONは destination が空になり、下の「その他」に落ちて
  // StaleWhileRevalidate になっていた＝更新した内容が1回遅れて出る。
  // 実害が出た例＝torque-data.json（新しいタブ名や締め付け順序の図が出なかった）。
  if (url.pathname.endsWith('.json')) {
    event.respondWith(networkFirst(req, RUNTIME_CACHE));
    return;
  }

  // 画像: CacheFirst
  if (req.destination === 'image') {
    event.respondWith(cacheFirst(req, RUNTIME_CACHE));
    return;
  }

  // 開発中テーマのJS: NetworkFirst（StaleWhileRevalidate だと直した内容が1回遅れて出る）
  // 実害が出た例＝engine-simulator（坂の名前が古いまま・直したはずの重なりが再発して見えた）。
  // ⚠️ESM の import も destination は 'script' なので、下の分岐より先に置く必要がある。
  if (url.pathname.startsWith('/engine-simulator/')) {
    event.respondWith(networkFirst(req, RUNTIME_CACHE));
    return;
  }

  // CSS/JS(自サイト): StaleWhileRevalidate
  if (req.destination === 'style' || req.destination === 'script') {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
    return;
  }

  // その他（フォント等）: StaleWhileRevalidate
  event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
});

// timeoutMs を渡すと、その時間内にネットワークが返らず保存分があるとき保存分を先に返す
// （取得は裏で続き、届いたら保存だけ更新する）。保存分が無ければネットワークを待ち続ける。
async function networkFirst(req, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  const network = fetch(req).then((fresh) => {
    if (fresh && fresh.ok) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  });
  try {
    if (!timeoutMs) return await network;
    const timedOut = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const first = await Promise.race([network, timedOut]);
    if (first) return first;
    const cached = await cache.match(req);
    if (cached) {
      network.catch(() => {});
      return cached;
    }
    return await network;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    // JSON に index.html を返すと JSON.parse で落ちるだけなので、素直に投げる
    if (new URL(req.url).pathname.endsWith('.json')) throw err;
    // HTML が無ければ index.html のキャッシュをフォールバック
    const fallback = await cache.match('/') || await cache.match('/index.html');
    if (fallback) return fallback;
    throw err;
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (err) {
    throw err;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((fresh) => {
      if (fresh && fresh.ok) {
        cache.put(req, fresh.clone());
      }
      return fresh;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}
