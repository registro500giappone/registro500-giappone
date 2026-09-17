/**
 * Registro500 Giappone Service Worker
 *
 * 更新手順:
 *   CACHE_VERSION はデプロイ時に Cloudflare Pages のビルドスクリプト (build.sh) が
 *   自動的にコミットハッシュへ置換する。手動更新は不要。
 *   新しい SW が検知されると画面下部に更新バナーが表示され、
 *   ユーザーがタップすると新バージョンに切り替わる。
 *
 * キャッシュ戦略:
 *   - HTML:  NetworkFirst  （常に最新取得、オフライン時のみキャッシュから返す）
 *   - CSS/JS(自サイト): StaleWhileRevalidate （即表示＋裏で更新）
 *   - 画像・アイコン: CacheFirst （長期キャッシュ）
 *   - Supabase / Stripe / GA 等の外部API: SW を通さない（素通り）
 */

const CACHE_VERSION = '__BUILD_VERSION__';
const RUNTIME_CACHE = `registro500-runtime-${CACHE_VERSION}`;
const HTML_CACHE = `registro500-html-${CACHE_VERSION}`;

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

  // 外部ホスト（API/決済/解析/CDN）は素通り
  if (BYPASS_HOSTS.some((host) => url.hostname.includes(host))) return;

  // 同一オリジン以外も素通り（クロスオリジン画像等）
  if (url.origin !== self.location.origin) return;

  // sw.js 自体のリクエストはブラウザに任せる
  if (url.pathname === '/sw.js') return;

  // config.js は NetworkFirst（API_URL等の設定変更を即時反映）
  if (url.pathname === '/config.js') {
    event.respondWith(networkFirst(req, RUNTIME_CACHE));
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
    event.respondWith(networkFirst(req, HTML_CACHE));
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

  // CSS/JS(自サイト): StaleWhileRevalidate
  if (req.destination === 'style' || req.destination === 'script') {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
    return;
  }

  // その他（フォント等）: StaleWhileRevalidate
  event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      cache.put(req, fresh.clone());
    }
    return fresh;
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
