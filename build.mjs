// 网页部署用：把 web/ 转成 Kindle 自带浏览器（内核约 Chromium 74）也能跑的版本，放到 dist/。
// 源码照旧用新语法写；桌面版（WebView2 很新）、本地开发、test.mjs 都直接用 web/，只有部署网页走这一步。
// esbuild 只降语法（?.、??、??=、CSS 的 inset……）不补 API：Chrome 74 没有的函数在 Kindle 上会直接报错，
// 所以最后扫一遍，用到了就不让部署。2026-09 在 Kindle（固件 5.18.6）上实测过：没有 ?.、??、??=、.at()、
// replaceAll、Promise.allSettled；有 ES 模块、类的私有字段、matchAll、Service Worker。
import { transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { cpSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const target = 'chrome74';
const lower = async (code, loader) => (await transform(code, { loader, target })).code;

rmSync('dist', { recursive: true, force: true });
cpSync('web', 'dist', { recursive: true });

const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const f of walk('dist')) {
  const ext = extname(f);
  if (ext === '.js' || ext === '.css') writeFileSync(f, await lower(readFileSync(f, 'utf8'), ext.slice(1)));
  if (ext !== '.html') continue;
  // 页面里的内联脚本（首页和会话查看器的模块脚本就写在 html 里）也要降
  const html = readFileSync(f, 'utf8'), parts = [];
  let at = 0;
  for (const m of html.matchAll(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g)) {
    parts.push(html.slice(at, m.index), m[1], m[2].trim() ? await lower(m[2], 'js') : m[2], m[3]);
    at = m.index + m[0].length;
  }
  writeFileSync(f, parts.join('') + html.slice(at));
}

// 页面引用的脚本、样式加上内容哈希（parse.js?v=…）：文件一改地址就变，浏览器只能重新拿。
// 靠响应头不行——70015.net 这个域在 Cloudflare 上的「浏览器缓存 TTL」会把 js/css 改成 max-age=14400，
// 页面是新的、脚本却是 4 小时前的，2026-09 Kindle 上点 START 没反应就是这样。页面本身不缓存，所以总能拿到新地址。
const ver = rel => `${rel}?v=${createHash('sha1').update(readFileSync(join('dist', rel))).digest('hex').slice(0, 8)}`;
for (const f of walk('dist').filter(f => extname(f) === '.html')) {
  writeFileSync(f, readFileSync(f, 'utf8')
    .replace(/(<script\b[^>]*\bsrc=")([^"?:]+\.js)"/g, (_, a, p) => `${a}${ver(p)}"`)
    .replace(/(<link\b[^>]*\bhref=")([^"?:]+\.css)"/g, (_, a, p) => `${a}${ver(p)}"`)
    .replace(/(\bfrom\s*["']\.\/)([^"'?]+\.js)(["'])/g, (_, a, p, q) => `${a}${ver(p)}${q}`));
}

const MISSING =/\.at\(|\.replaceAll\(|Promise\.(allSettled|any)\b|structuredClone|Object\.hasOwn|\.findLast(Index)?\(|\.toSorted\(|\.toReversed\(/;
const hits = walk('dist').filter(f => /\.(js|html)$/.test(f)).flatMap(f =>
  readFileSync(f, 'utf8').split('\n').flatMap((l, i) => MISSING.test(l) ? [`${f}:${i + 1}  ${l.trim().slice(0, 100)}`] : []));
if (hits.length) {
  console.error('Kindle 的浏览器没有这些函数：\n' + hits.join('\n'));
  process.exit(1);
}
console.log('dist/ ready for', target);
