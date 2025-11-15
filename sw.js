// Service Worker for Gabor Patch Training App
const CACHE_NAME = 'gabor-patch-v1.0';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './FNT512.png',
  './FNT512-transparent.png'
];

// インストールイベント
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// アクティベートイベント
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// フェッチイベント - オフライン対応
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュがあればそれを返す
        if (response) {
          return response;
        }
        
        // キャッシュがない場合はネットワークから取得
        return fetch(event.request).then((response) => {
          // 有効なレスポンスでない場合は返す
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // レスポンスをクローンしてキャッシュに保存
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        });
      })
      .catch(() => {
        // オフライン時のフォールバック
        return new Response('オフラインです。インターネット接続を確認してください。', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain; charset=utf-8'
          })
        });
      })
  );
});

// バックグラウンド同期
self.addEventListener('sync', (event) => {
  if (event.tag === 'update-cache') {
    event.waitUntil(updateCache());
  }
});

// キャッシュ更新
async function updateCache() {
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  
  const updatePromises = requests.map(async (request) => {
    try {
      const response = await fetch(request);
      if (response && response.status === 200) {
        await cache.put(request, response);
      }
    } catch (error) {
      console.log('Cache update failed for:', request.url);
    }
  });
  
  return Promise.all(updatePromises);
}

// プッシュ通知（将来の機能拡張用）
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'トレーニングの時間です！',
    icon: './FNT512.png',
    badge: './FNT512.png',
    vibrate: [200, 100, 200],
    tag: 'training-reminder'
  };
  
  event.waitUntil(
    self.registration.showNotification('ガボールパッチトレーニング', options)
  );
});

// 通知クリック
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('./')
  );
});

// バージョン管理
const APP_VERSION = '1.0.0';

// 定期的な更新チェック（24時間ごと）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    checkForUpdates();
  }
});

async function checkForUpdates() {
  try {
    const response = await fetch('./version.json');
    const data = await response.json();
    
    if (data.version !== APP_VERSION) {
      // 新しいバージョンが利用可能
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'UPDATE_AVAILABLE',
            version: data.version
          });
        });
      });
    }
  } catch (error) {
    console.log('Update check failed:', error);
  }
}

// オフライン検出
self.addEventListener('online', () => {
  console.log('Online status detected');
  updateCache();
});

self.addEventListener('offline', () => {
  console.log('Offline status detected');
});
