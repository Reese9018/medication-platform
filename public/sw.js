/**
 * 智药护航 PWA Service Worker
 * 
 * 缓存策略：
 * - 静态资源（/assets/）：缓存优先（Cache First），带 hash 不变
 * - 页面导航请求：网络优先（Network First），离线时读缓存
 * - API 请求：不缓存，直接走网络
 */

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `zhiyao-static-${CACHE_VERSION}`;
const PAGES_CACHE = `zhiyao-pages-${CACHE_VERSION}`;

// 安装时预缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/logo.png',
        '/manifest.json'
      ]);
    }).then(() => self.skipWaiting())
  );
});

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('zhiyao-') && !key.includes(CACHE_VERSION))
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 请求拦截
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理 GET 请求
  if (request.method !== 'GET') return;

  // API 请求直接走网络，不缓存
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 静态资源：缓存优先
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // 只缓存成功的响应
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 页面导航请求：网络优先，缓存兜底
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 成功了，更新缓存
          const clone = response.clone();
          caches.open(PAGES_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // 离线了，读缓存
          return caches.match(request).then((cached) => {
            return cached || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 其他静态资源（图片、字体等）：缓存优先
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
