// Service Worker for ガボールパッチ視力回復トレーニング
const CACHE_NAME = 'gabor-patch-v1.0.0';
const CACHE_VERSION = '1.0.0';

// キャッシュするファイルリスト
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './FNT512.png',
    './FNT512-transparent.png'
];

// インストール時
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing version:', CACHE_VERSION);
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching app shell');
                // 各ファイルを個別にキャッシュ（エラーがあっても続行）
                return Promise.allSettled(
                    ASSETS_TO_CACHE.map(url => 
                        cache.add(url).catch(err => {
                            console.warn('[Service Worker] Failed to cache:', url, err);
                        })
                    )
                );
            })
            .then(() => {
                console.log('[Service Worker] Installation complete');
                return self.skipWaiting();
            })
            .catch((err) => {
                console.error('[Service Worker] Installation failed:', err);
            })
    );
});

// アクティベート時（古いキャッシュの削除）
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating version:', CACHE_VERSION);
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activation complete');
                return self.clients.claim();
            })
    );
});

// フェッチイベント（リクエスト時）
self.addEventListener('fetch', (event) => {
    // 同一オリジンのリクエストのみ処理
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // GETリクエストのみ処理
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // キャッシュがあればそれを返す
                if (cachedResponse) {
                    // バックグラウンドで最新版を取得（Stale-While-Revalidate）
                    event.waitUntil(
                        fetch(event.request)
                            .then((networkResponse) => {
                                if (networkResponse && networkResponse.status === 200) {
                                    caches.open(CACHE_NAME)
                                        .then((cache) => {
                                            cache.put(event.request, networkResponse.clone());
                                        });
                                }
                            })
                            .catch(() => {
                                // ネットワークエラーは無視
                            })
                    );
                    return cachedResponse;
                }

                // キャッシュがなければネットワークから取得
                return fetch(event.request)
                    .then((networkResponse) => {
                        // 有効なレスポンスのみキャッシュ
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }

                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    })
                    .catch(() => {
                        // オフライン時のフォールバック
                        if (event.request.destination === 'document') {
                            return caches.match('./index.html');
                        }
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// メッセージ受信時
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[Service Worker] Skip waiting requested');
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_VERSION });
    }
});

// プッシュ通知（将来の拡張用）
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body || 'トレーニングの時間です！',
            icon: './FNT512.png',
            badge: './FNT512.png',
            vibrate: [100, 50, 100],
            data: {
                url: data.url || './'
            }
        };

        event.waitUntil(
            self.registration.showNotification(data.title || 'ガボールパッチ', options)
        );
    }
});

// 通知クリック時
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // 既存のウィンドウがあればフォーカス
                for (const client of clientList) {
                    if (client.url.includes('gabor-patch') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // なければ新しいウィンドウを開く
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data.url || './');
                }
            })
    );
});

// バックグラウンド同期（将来の拡張用）
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-scores') {
        console.log('[Service Worker] Background sync triggered');
        // スコアの同期処理をここに追加
    }
});

// 定期的なバックグラウンド同期（将来の拡張用）
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'update-check') {
        console.log('[Service Worker] Periodic sync triggered');
        // 定期的な更新チェック処理をここに追加
    }
});

console.log('[Service Worker] Script loaded, version:', CACHE_VERSION);
