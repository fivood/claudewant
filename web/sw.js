// 离线：第一次联网打开时把整站（约 2 MB）存进缓存，之后断网也能玩。存档本来就在本机的 localStorage 里。
// 网络优先：联网时永远拿最新的，断网才用缓存。不用「先给缓存、后台再更新」——游戏的脚本共享一个全局作用域，
// 刚发的新版和缓存里的旧版混着跑一次就可能出错。
const CACHE = 'clawd-offline';
const FONTS = 'fonts/Fusion-Pixel-12px-Proportional-Simplified-Chinese.css';
// 页面存无扩展名的地址：静态服务器（Cloudflare Pages、本地的 serve）都会把 x.html 跳成 x，
// 而跳转过来的响应不能拿去回应页面导航。
const FIXED = ['./', 'game', 'viewer', 'pixel.css', 'game.css', 'i18n.js', 'parse.js', FONTS];

self.addEventListener('install', e => e.waitUntil((async () => {
  // 游戏按顺序加载的脚本、按 unicode-range 切开的 78 个字体文件：从页面和 css 里读出来，加文件不用改这里
  const [game, fonts] = await Promise.all(['game', FONTS].map(u => fetch(u).then(r => r.text())));
  const scripts = [...game.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  const faces = [...fonts.matchAll(/url\(([^)]+)\)/g)].map(m => 'fonts/' + m[1].replace(/["']/g, ''));
  await (await caches.open(CACHE)).addAll([...new Set([...FIXED, ...scripts, ...faces])]);
  self.skipWaiting();
})()));

self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // cache: 'no-cache'：浏览器自己的 HTTP 缓存里可能还有几小时内「仍算新鲜」的旧脚本，联网时一律找服务器确认。
  // 页面导航不能这么传（带 init 重建 navigate 请求会直接抛错），页面本来就是 max-age=0
  e.respondWith((req.mode === 'navigate' ? fetch(req) : fetch(req, { cache: 'no-cache' })).then(res => {
    if (res.ok && !res.redirected) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    // 首页跳进游戏用的是 game.html?seed=…，缓存里存的是 game；index.html 就是 ./
    const bare = new URL(req.url); bare.pathname = bare.pathname.replace(/(index)?\.html$/, '');
    return (await caches.match(bare.href, { ignoreSearch: true })) || Response.error();
  }));
});
