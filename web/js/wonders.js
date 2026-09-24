// 对话之路、会话奇观（像素立体物和跟着太阳走的影子）、全图海报与四维投影视图
// 这些文件是按顺序加载的普通脚本，共享同一个全局作用域：顺序见 game.html 底部。

// --- 对话之路：会话用海龟画图画成的曲线（parse.js 的 pathOf），铺在纸上 --------------------
// 离落点越远，就是对话里越晚的事。Clawd 顺着它走，就是在往后读那段对话；整条走完，这段对话就读完了。
const RC = { u: [217, 119, 87], a: [96, 110, 150], s: [70, 130, 200], c: [140, 100, 80], m: [70, 150, 80], t: [160, 140, 200], e: [220, 50, 50] };
const ROUTE = new Map(), ROUTE_LIST = [];                 // 格子 → 类型；按对话顺序排好的格子
{
  const P = Array.isArray(SRC.path) ? SRC.path : [];
  for (let i = 1; i < P.length; i++) {
    const [ax, ay] = P[i - 1], [bx, by, k] = P[i], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
    for (let j = i === 1 ? 0 : 1; j <= n; j++) {
      const x = Math.round(ax + (bx - ax) * j / n), y = Math.round(ay + (by - ay) * j / n), kk = key(x, y);
      if (!ROUTE.has(kk)) { ROUTE.set(kk, k); ROUTE_LIST.push([x, y]); }
    }
  }
}
let routeSeen = 0, routeI = 0;
for (const k of ROUTE.keys()) if (rev.has(k)) routeSeen++;
const readPct = () => ROUTE.size ? Math.floor(routeSeen / ROUTE.size * 100) : 0;
function routeStep() {                                     // 又读到一格
  routeSeen++;
  const pct = readPct();
  for (const [q, line] of [[25, tr('那段对话我读到四分之一了。前面的路是它后来说的话。', 'I\'ve read a quarter of that conversation. The road ahead is what it said later.')], [50, tr('读到一半了。回头看，路上的颜色就是那段对话的样子。', 'Halfway. Looking back, the colours on the road are what the conversation looked like.')], [75, tr('还剩四分之一。我大概猜得到结尾，但还是想走过去。', 'A quarter left. I can probably guess the ending, but I want to walk there anyway.')]])
    if (pct >= q && !G.seen['read' + q]) { G.seen['read' + q] = 1; say(line, { bubble: true }); }
  if (routeSeen >= ROUTE.size && !G.seen.readAll) { G.seen.readAll = 1; bubbleAt = -1e9; say(tr('这段对话我从头到尾走完了。可以把整张纸收起来看看了。', 'I\'ve walked this conversation from start to finish. Time to fold up the whole sheet and have a look.'), { bubble: true }); mapReady(); }
}
// 顺着对话往后读：挑下一格还没展开的路，太远就算了
function nextRoute(w) {
  while (routeI < ROUTE_LIST.length && rev.has(key(...ROUTE_LIST[routeI]))) routeI++;
  const p = ROUTE_LIST[routeI];
  return p && Math.hypot(p[0] - w.x, p[1] - w.y) < 200 ? p : null;
}

// --- 会话奇观：从对话里长出来的三维物体，立在对话之路旁边 ------------------------------------
// 它们是立体的（像素方块，俯视斜着看：顶面亮、正面暗），二维居民看不见它们，只看得见投在纸上的影子。
// 影子跟着你那边的太阳走：早上朝西拉得很长，中午朝北最短，傍晚朝东；夜里没有影子，锻炉和发射台亮灯。
// 原料是 parse.js 的 marksOf：第一句话、改得最多的文件、出过的错、几类命令，各带它在对话里的时间位置。
const C3 = { stone: [196, 190, 180], dark: [120, 114, 110], clay: [214, 128, 92], gold: [226, 186, 92], white: [236, 232, 222],
  wood: [150, 108, 70], green: [96, 150, 84], brick: [176, 96, 72], js: [232, 204, 92], ts: [104, 146, 210], html: [226, 120, 80],
  py: [86, 150, 128], ink: [60, 56, 64] };
// 一个模型：方块 [x, y, z, 宽, 深, 高, 颜色]（美术像素，一格 = 4），可选的坑 [x, y, 宽, 深, 深度] 和夜灯 [x, y, z]
function model(m) {
  const ext = (m.label.match(/\.(\w+)$/) || [])[1]?.toLowerCase() || '';
  if (m.k === 'first') return { name: tr('开篇碑', 'Opening Stele'), boxes: [[0, 8, 0, 14, 6, 3, 'stone'], [4, 9, 3, 6, 3, 20, 'stone'], [4, 8, 23, 6, 4, 2, 'dark']],
    line: tr(`一块碑，立在我落下来的地方。上面刻着：「${m.label}」`, `A stele, standing where I fell in. It's inscribed: "${m.label}"`) };
  if (m.k === 'file') {
    let shape, boxes;
    if (/^(m?js|jsx|ts|tsx|cjs)$/.test(ext)) {
      shape = tr('方塔', 'tower'); boxes = [];
      for (let k = 0; k < 2 + Math.min(2, Math.floor(m.n / 5)); k++) boxes.push([2 * k, 2 * k, 6 * k, 14 - 4 * k, 14 - 4 * k, 6, /^t/.test(ext) ? 'ts' : 'js']);
    } else if (/^html?$/.test(ext)) { shape = tr('城门', 'gate'); boxes = [[0, 6, 0, 4, 4, 16, 'html'], [12, 6, 0, 4, 4, 16, 'html'], [0, 6, 16, 16, 4, 4, 'clay']]; }
    else if (/^(s?css|less)$/.test(ext)) {
      shape = tr('彩砖台', 'mosaic terrace'); boxes = [[0, 0, 0, 16, 12, 2, 'stone']];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) boxes.push([i * 4, j * 4, 2, 4, 4, .5, ['clay', 'ts', 'gold'][(i + j) % 3]]);
    } else if (/^(md|txt|rst)$/.test(ext)) { shape = tr('摊开的书', 'open book'); boxes = [[0, 3, 0, 7, 10, 3, 'white'], [9, 3, 0, 7, 10, 3, 'white'], [7, 3, 0, 2, 10, 2, 'ink']]; }
    else if (ext === 'py') { shape = tr('蛇形墙', 'serpent wall'); boxes = Array.from({ length: 7 }, (_, i) => [i * 2.5, 5 + Math.round(3 * Math.sin(i * 1.1)), 0, 3, 3, 4 + i % 2, 'py']); }
    else { shape = tr('方尖碑', 'obelisk'); boxes = [[2, 2, 0, 10, 10, 2, 'stone'], [4, 4, 2, 6, 6, 22, 'dark'], [5, 5, 24, 4, 4, 3, 'gold']]; }
    return { name: `${m.label} ${shape}`, boxes, line: tr(`${m.label}。那段对话在这里改了 ${m.n} 次，改成了一座${shape}。`, `${m.label}. The conversation changed it ${m.n} times, and it became ${/^[aeiou]/.test(shape) ? 'an' : 'a'} ${shape}.`) };
  }
  if (m.k === 'err') return { name: tr(`「${m.label}」峡谷`, `"${m.label}" ravine`), pits: [[0, 0, 20, 8, 6, true]], boxes: m.ok ? [[8, -3, 0, 4, 14, 1, 'wood']] : [],
    line: m.ok ? tr(`「${m.label}」——一道裂谷。上面架着一座桥：那个错后来修好了。`, `"${m.label}": a ravine with a bridge over it. That error got fixed later.`) : tr(`「${m.label}」——一道裂谷，没有桥。那个错一直没修好。`, `"${m.label}": a ravine with no bridge. That error was never fixed.`) };
  const cmd = {
    deploy: [tr('发射台', 'Launch Pad'), [[0, 0, 0, 16, 16, 2, 'stone'], [12, 2, 2, 3, 3, 24, 'dark'], [5, 6, 2, 5, 5, 14, 'white'], [5, 6, 16, 5, 5, 3, 'clay'], [6, 7, 19, 3, 3, 3, 'clay']], [[13, 2, 26]], tr(`发射台。那段对话从这里往外发射过 ${m.n} 次。`, `A launch pad. The conversation launched things from here ${m.n} times.`)],
    build: [tr('锻炉', 'Forge'), [[0, 4, 0, 14, 10, 10, 'brick'], [10, 5, 10, 3, 3, 10, 'brick']], [[6, 13, 3]], tr(`锻炉。东西在这里被烧成了形状，一共 ${m.n} 炉。`, `A forge. Things were fired into shape here, ${m.n} batches in all.`)],
    test: [tr('试炼场', 'Proving Ground'), Array.from({ length: 6 }, (_, i) => [8 + 7 * Math.cos(i * Math.PI / 3) - 1, 8 + 7 * Math.sin(i * Math.PI / 3) - 1, 0, 2, 2, 9, 'stone']), [], tr(`试炼场。${m.n} 次，它们在这里证明自己没坏。`, `A proving ground. ${m.n} times, things came here to prove they weren't broken.`)],
    git: [tr('分叉树', 'Branching Tree'), [[7, 7, 0, 3, 3, 16, 'wood'], [2, 8, 9, 5, 2, 2, 'wood'], [10, 8, 11, 5, 2, 2, 'wood'], [1, 7, 11, 2, 2, 6, 'green'], [14, 7, 13, 2, 2, 6, 'green'], [7, 6, 16, 3, 3, 4, 'green']], [], tr(`一棵分叉的树，${m.n} 根枝。每一根都是一次决定。`, `A branching tree with ${m.n} branches. Each one was a decision.`)],
    install: [tr('依赖森林', 'Dependency Grove'), [[2, 3], [9, 1], [13, 7], [4, 10], [10, 12]].flatMap(([x, y]) => [[x, y, 0, 1, 1, 3, 'wood'], [x - 1, y - 1, 3, 3, 3, 5, 'green']]), [], tr(`依赖森林。${m.n} 次，它把别人的东西种了进来。`, `A dependency grove. ${m.n} times, it planted other people's things here.`)],
  }[m.label];
  return cmd && { name: cmd[0], boxes: cmd[1], glow: cmd[2], line: cmd[3] };
}

// 用会话的四维曲线「雕」奇观：取它在对话里那个时刻前后的一段曲线，
//   x-y 决定占地哪几格，z 决定每格多高，w 高的地方用点缀色（窗、装饰）。
// 光有曲线会像一团噪声，所以按类型加规矩：建筑左右对称、塔四向对称、试炼场只留外圈、
// 蛇形墙和分叉树顺着曲线长、森林挑几个点种树、裂谷就是曲线划出的口子。高度按 2 取整，看着像砌出来的。
// 同一段会话永远雕出同一批奇观；换一段会话，形状全都不一样。
const SCULPT = {                                          // 对称方式、最高多高、主色、点缀色
  first: ['stele', 18, 'stone', 'dark'], js: ['radial', 24, 'js', 'gold'], ts: ['radial', 24, 'ts', 'white'],
  html: ['bilateral', 16, 'html', 'clay'], css: ['bilateral', 6, 'stone', 'mosaic'], md: ['bilateral', 8, 'white', 'ink'],
  py: ['serpent', 7, 'py', 'green'], other: ['bilateral', 20, 'dark', 'gold'],
  deploy: ['radial', 26, 'white', 'clay'], build: ['bilateral', 14, 'brick', 'dark'], test: ['ring', 10, 'stone', 'gold'],
  git: ['grow', 18, 'wood', 'green'], install: ['scatter', 8, 'green', 'wood'], err: ['pit', 6],
};
function sculpt(style, m) {
  const S4 = SRC.shape, N = 6, CELL = 3;                  // 6×6 格，每格 3 个美术像素：占地约 18×18
  // 同一时刻的几件事（比如连着出的几个错）会取到同一段曲线，按名字再错开几步，免得长得一样
  const nudge = (m.i % 4) * 5 + Math.abs([...m.label].reduce((v, ch) => (v * 31 + ch.charCodeAt(0)) | 0, 7)) % 5;   // 挨着的四个一定错开
  const c = Math.max(0, Math.min(S4.length - 1, Math.round(m.t * (S4.length - 1)) + nudge)), seg = S4.slice(Math.max(0, c - 12), c + 13);
  const mid = [0, 1, 2, 3].map(i => seg.reduce((v, q) => v + q[i], 0) / seg.length);
  const span = i => Math.max(...seg.map(q => Math.abs(q[i] - mid[i]))) || 1;
  const sx = Math.max(span(0), span(1)), sz = span(2), sw = span(3);
  const H = Array.from({ length: N }, () => Array(N).fill(0)), Wt = Array.from({ length: N }, () => Array(N).fill(-1));
  const cells = [];
  for (let i = 1; i < seg.length; i++) for (let k = 0; k < 8; k++) {   // 沿曲线加密取点
    const q = [0, 1, 2, 3].map(j => seg[i - 1][j] + (seg[i][j] - seg[i - 1][j]) * k / 8);
    const gx = Math.min(N - 1, Math.floor(((q[0] - mid[0]) / sx * .5 + .5) * N)), gy = Math.min(N - 1, Math.floor(((q[1] - mid[1]) / sx * .5 + .5) * N));
    const hz = ((q[2] - mid[2]) / sz * .5 + .5), wv = (q[3] - mid[3]) / sw;
    if (!H[gx][gy]) cells.push([gx, gy, i / seg.length]);
    H[gx][gy] = Math.max(H[gx][gy], .25 + hz * .75); Wt[gx][gy] = Math.max(Wt[gx][gy], wv);
  }
  const each = f => { for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) f(x, y); };
  const dilate = () => { const h2 = H.map(r => [...r]); each((x, y) => { if (H[x][y]) return; let m2 = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) m2 = Math.max(m2, H[x + dx]?.[y + dy] || 0); if (m2) h2[x][y] = m2 * .6; }); each((x, y) => { H[x][y] = h2[x][y]; }); };
  if (style === 'bilateral') { dilate(); each((x, y) => { H[x][y] = H[N - 1 - x][y] = Math.max(H[x][y], H[N - 1 - x][y]); Wt[x][y] = Wt[N - 1 - x][y] = Math.max(Wt[x][y], Wt[N - 1 - x][y]); }); }
  if (style === 'radial') {
    dilate();
    each((x, y) => { const v = Math.max(H[x][y], H[N - 1 - y][x], H[N - 1 - x][N - 1 - y], H[y][N - 1 - x]); H[x][y] = v; });
    each((x, y) => { const d = Math.max(Math.abs(x - 2.5), Math.abs(y - 2.5)); H[x][y] *= 1.25 - d * .22; });   // 越往外越矮，像塔
  }
  if (style === 'ring') { dilate(); each((x, y) => { const d = Math.hypot(x - 2.5, y - 2.5); if (d < 1.6 || d > 3.3) H[x][y] = 0; else H[x][y] = Math.max(H[x][y], .5); }); }
  if (style === 'stele') {                               // 碑：一面墙，顶上的轮廓是曲线的起伏，至少四列宽，前面一级台阶
    each((x, y) => { H[x][y] = 0; });
    for (const [gx, , t] of cells) H[gx][2] = Math.max(H[gx][2], .45 + t * .55);
    for (let x = 1; x < N - 1; x++) H[x][2] = Math.max(H[x][2], .4);
    for (let x = 0; x < N; x++) { H[x][2] = H[N - 1 - x][2] = Math.max(H[x][2], H[N - 1 - x][2]); if (H[x][2]) H[x][3] = .12; }
  }
  if (style === 'grow') each((x, y) => { if (H[x][y]) H[x][y] = .3 + .7 * (cells.find(c2 => c2[0] === x && c2[1] === y)?.[2] || 0); });
  if (style === 'serpent') each((x, y) => { if (H[x][y]) H[x][y] = .5 + H[x][y] * .5; });
  const [, top, main, acc] = SCULPT[m.kindKey];
  if (style === 'pit') {                                  // 裂谷：曲线在地上划出的口子
    dilate();
    const pits = [], boxes = [];
    each((x, y) => { if (H[x][y]) pits.push([x * CELL, y * CELL, CELL, CELL, top, !H[x][y - 1]]); });
    if (m.ok) { const col = Math.round(N / 2) - 1, ys = pits.filter(p => p[0] === col * CELL).map(p => p[1]); if (ys.length) boxes.push([col * CELL, Math.min(...ys) - 3, 0, 4, Math.max(...ys) - Math.min(...ys) + CELL + 6, 1, 'wood']); }
    return { pits, boxes };
  }
  const boxes = [[-1, -1, 0, N * CELL + 2, N * CELL + 2, 1, 'stone']];   // 一层底座，看着是「立」在纸上的
  const MOS = ['clay', 'ts', 'gold'];
  if (style === 'scatter') {                              // 森林：挑曲线上几个点，各种一棵树
    cells.filter((_, i) => i % Math.max(1, Math.floor(cells.length / 5)) === 0).slice(0, 6).forEach(([x, y], i) => {
      boxes.push([x * CELL + 1, y * CELL + 1, 0, 1, 1, 3, acc], [x * CELL, y * CELL, 3, 3, 3, 3 + (i % 3) * 2, main]);
    });
    return { boxes };
  }
  // 点缀色按竖列决定再左右镜像：出来是对称的竖条，像立面上的窗，不是一格一格的噪点
  const colW = Array.from({ length: N }, (_, x) => { const v = Wt[x].filter(w => w > -1); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : -1; });
  const stripe = x => Math.max(colW[x], colW[N - 1 - x]) > .25;
  each((x, y) => {
    if (!H[x][y]) return;
    const h = Math.max(2, Math.round(H[x][y] * top / 2) * 2);
    const color = acc === 'mosaic' ? MOS[(x + y + (Wt[x][y] > 0 ? 1 : 0)) % 3] : stripe(x) ? acc : main;
    boxes.push([x * CELL, y * CELL, 1, CELL, CELL, h, color]);
  });
  return { boxes };
}

const WONDERS = [], WKEY = new Map();
{
  const P = Array.isArray(SRC.path) ? SRC.path : [];
  (Array.isArray(SRC.marks) && P.length > 2 ? SRC.marks : []).forEach((m, i) => {
    const md = model(m);
    if (!md) return;
    m.i = i;
    const ext = (m.label.match(/\.(\w+)$/) || [])[1]?.toLowerCase() || '';
    m.kindKey = m.k === 'first' ? 'first' : m.k === 'err' ? 'err' : m.k === 'cmd' ? m.label
      : /^(m?js|jsx|cjs)$/.test(ext) ? 'js' : /^tsx?$/.test(ext) ? 'ts' : /^html?$/.test(ext) ? 'html' : /^(s?css|less)$/.test(ext) ? 'css'
      : /^(md|txt|rst)$/.test(ext) ? 'md' : ext === 'py' ? 'py' : 'other';
    if (Array.isArray(SRC.shape) && SRC.shape.length > 4 && SCULPT[m.kindKey]) {
      const sc = sculpt(SCULPT[m.kindKey][0], m);
      md.boxes = sc.boxes; md.pits = sc.pits;
      if (md.glow) { const t = md.boxes.reduce((a, b) => b[2] + b[5] > a[2] + a[5] ? b : a); md.glow = [[t[0] + 1, t[1] + 1, t[2] + t[5]]]; }   // 灯挂在最高处
    }
    // 立在对话之路旁边：沿路的法线往一侧挪 5 格，左右交替；离已经摆好的奇观太近就往后挪
    let idx = Math.max(1, Math.min(P.length - 2, Math.round(m.t * (P.length - 1)))), ax, ay;
    for (let tries = 0; tries < 12; tries++, idx = Math.min(P.length - 2, idx + 3)) {
      const dx = P[idx + 1][0] - P[idx - 1][0], dy = P[idx + 1][1] - P[idx - 1][1], L = Math.hypot(dx, dy) || 1, side = i % 2 ? 1 : -1;
      ax = Math.round(P[idx][0] - dy / L * 5 * side); ay = Math.round(P[idx][1] + dx / L * 5 * side);
      if (!WONDERS.some(w => Math.abs(w.x - ax) < 8 && Math.abs(w.y - ay) < 8)) break;
    }
    const w = { ...md, id: `${m.k}:${m.label}`, m, x: ax, y: ay };
    WONDERS.push(w);
    for (let tx = 0; tx < 5; tx++) for (let ty = -1; ty < 4; ty++) WKEY.set(key(ax + tx, ay + ty), w);   // 占地约 5×5 格，展开到任何一格都算发现
  });
}
G.found ??= {};
// 奇观是对话里的一件事，它旁边的那句话：提到这个文件的优先，否则挑时间上最近的（出错的往后找，那是在想怎么修）。
// 载入时按时间顺序一次分好，一句话只配一个奇观
function recallNear(m, used) {
  const stem = m.k === 'file' && m.label.replace(/\.[^.]+$/, '').toLowerCase();
  let top = null, sc = 1e9;
  for (const r of RECALL) {
    if (used.has(r)) continue;
    const dt = r[0] - m.t, s = Math.abs(dt) + (m.k === 'err' && dt < 0 ? .05 : 0) - (stem?.length > 2 && r[1].toLowerCase().includes(stem) ? 1 : 0) - r[2] * .01;
    if (s < sc) { sc = s; top = r; }
  }
  return sc < .08 ? top : null;                            // 离得太远的就不硬凑了
}
{
  const used = new Set();
  for (const w of [...WONDERS].sort((a, b) => a.m.t - b.m.t)) if ((w.r = recallNear(w.m, used))) used.add(w.r);
}
function discover(w) {
  if (G.found[w.id]) return;
  G.found[w.id] = 1;
  bubbleAt = -1e9;
  say(w.line, { bubble: true });
  const r = w.r;
  if (r) setTimeout(() => { bubbleAt = -1e9; say(r[2] ? tr(`看着它，我想起当时在想：「${r[1]}」`, `Looking at it, I remember thinking: "${r[1]}"`) : tr(`看着它，我想起当时说过：「${r[1]}」`, `Looking at it, I remember saying: "${r[1]}"`), { bubble: true }); }, 9000);   // 等上一个气泡说完
  earn(150 * mult() * (1 + 3 * w.m.t));
  if (!G.seen.shadowNote) { G.seen.shadowNote = 1; say(tr('它立在纸上，但居民看不见它——它们只看得见它投下来的影子。在它们眼里，那是一块会跟着天色转动的暗斑。', 'It stands on the paper, but the residents can\'t see it. They only see its shadow: a dark patch that turns with the time of day.')); }
}
const foundCount = () => WONDERS.filter(w => G.found[w.id]).length;

// 太阳：你那边的钟点决定影子朝哪、多长。返回每升高一个美术像素，影子在纸上挪多少；夜里没有太阳
function sunVec() {
  const hr = hourNow();
  if (hr < 6 || hr > 18) return null;
  const th = Math.PI * (hr - 6) / 12, elev = Math.max(.18, Math.sin(th)) * 65 * Math.PI / 180, L = Math.min(3, 1 / Math.tan(elev));
  return { x: -Math.cos(th) * L, y: -Math.sin(th) * L };
}
let shadowCv = null;
function drawWonders(ox, oy, tp, s, g, W, H, sun) {
  const vis = WONDERS.filter(w => G.found[w.id] || rev.has(key(w.x, w.y)))
    .filter(w => { const x = w.x * tp + ox, y = w.y * tp + oy; return x > -tp * 8 && y > -tp * 12 && x < W + tp * 4 && y < H + tp * 8; });
  if (!vis.length) return vis;
  const at = w => [w.x * tp + ox, w.y * tp + oy];
  const face = (c, f) => `rgb(${c.map(v => Math.round(v * f))})`;
  for (const w of vis) for (const [px, py, pw, pd, depth, north] of w.pits || []) {   // 裂谷：往纸里凹下去，靠北的边看得见内壁
    const [x0, y0] = at(w);
    g.fillStyle = '#2a2430'; g.fillRect(Math.round(x0 + px * s), Math.round(y0 + py * s), Math.ceil(pw * s), Math.ceil(pd * s));
    if (north) { g.fillStyle = '#5c5262'; g.fillRect(Math.round(x0 + px * s), Math.round(y0 + py * s), Math.ceil(pw * s), Math.ceil(Math.min(depth, pd) * s * .6)); }
  }
  if (sun) {                                                  // 影子：先画到离屏画布上，再整块半透明盖上去，重叠处不会更黑
    shadowCv ??= document.createElement('canvas');
    if (shadowCv.width !== W || shadowCv.height !== H) { shadowCv.width = W; shadowCv.height = H; }
    const sg = shadowCv.getContext('2d');
    sg.clearRect(0, 0, W, H); sg.fillStyle = '#1b1422';
    for (const w of vis) {
      const [x0, y0] = at(w);
      for (const [x, y, z, bw, bd, h] of w.boxes) for (let k = z; k <= z + h; k += .5)
        sg.fillRect(Math.round(x0 + (x + sun.x * k) * s), Math.round(y0 + (y + sun.y * k) * s), Math.ceil(bw * s), Math.ceil(bd * s));
    }
    g.globalAlpha = .28; g.drawImage(shadowCv, 0, 0); g.globalAlpha = 1;
  }
  // 画的先后：奇观之间按南北排，同一个奇观里先画低的（叠在上面的后画），同高度再按南北
  const boxes = vis.sort((a, b) => a.y - b.y).flatMap(w => [...w.boxes].sort((a, b) => a[2] - b[2] || (a[1] + a[4]) - (b[1] + b[4])).map(b => [at(w), b]));
  for (const [[x0, y0], [x, y, z, bw, bd, h, c]] of boxes) {   // 由后往前：先正面（暗），再顶面（亮）
    const sx = Math.round(x0 + x * s), top = Math.round(y0 + (y - z - h) * s), W1 = Math.ceil(bw * s);
    g.fillStyle = face(C3[c], .72); g.fillRect(sx, Math.round(y0 + (y + bd - z - h) * s), W1, Math.max(1, Math.ceil(h * s)));
    g.fillStyle = face(C3[c], 1); g.fillRect(sx, top, W1, Math.ceil(bd * s));
  }
  return vis;
}
// 奇观的名字：画在昼夜遮罩上面，带一圈纸色的像素描边，压在什么地形上、白天黑夜都看得清
function drawLabels(ox, oy, tp, s, g, vis) {
  g.font = `${Math.round(12 * dpr)}px ${getComputedStyle(document.documentElement).getPropertyValue('--px')}`;
  const o = Math.max(1, Math.round(dpr));
  for (const w of vis) if (G.found[w.id]) {
    const x = Math.round(w.x * tp + ox), y = Math.round(w.y * tp + oy - (Math.max(...w.boxes.map(b => b[2] + b[5]), 0) + 4) * s);
    g.fillStyle = PAPER;
    for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, -o], [-o, o], [o, o]]) g.fillText(w.name, x + dx, y + dy);
    g.fillStyle = INK; g.fillText(w.name, x, y);
  }
}

// --- 全图：把展开过的整张纸画成一张海报，可以下载 --------------------------------------
const mapReady = () => $('mapBtn').classList.add('ready');
function renderPoster() {
  let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
  const grow = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (const k of rev) grow(kx(k), ky(k));
  for (const [x, y] of ROUTE_LIST) grow(x, y);
  x0 -= 6; y0 -= 6; x1 += 7; y1 += 7;
  const w = x1 - x0, h = y1 - y0, px = Math.min(4, 1600 / Math.max(w, h));   // 每格几个像素，大图会小于 1
  const M = 32, HEAD = 78, FOOT = 46, W = Math.ceil(w * px) + M * 2, H = Math.ceil(h * px) + M * 2 + HEAD + FOOT;
  const c = $('pcv'), g = c.getContext('2d'), font = getComputedStyle(document.documentElement).getPropertyValue('--px');
  c.width = W; c.height = H;
  g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
  g.imageSmoothingEnabled = px < 1;
  const ox = M - x0 * px, oy = M + HEAD - y0 * px;
  const tmp = document.createElement('canvas'), tg = tmp.getContext('2d');   // 逐块画完就贴，不进缓存，海报再大内存也不涨
  tmp.width = tmp.height = CH * TP;
  for (const ck of hasChunk) {
    const [cx, cy] = ck.split(',').map(Number), c = chunks.get(ck);
    if (!c) tg.putImageData(fillChunk(cx, cy), 0, 0);
    g.drawImage(c ? c.cvs : tmp, ox + cx * CH * px, oy + cy * CH * px, CH * px, CH * px);
  }
  const P = SRC.path || [];                                 // 对话之路：读过的实线，没读到的淡淡的虚线
  g.lineWidth = Math.max(1.5, px * .7); g.lineCap = 'round';
  for (let i = 1; i < P.length; i++) {
    const read = rev.has(key(P[i][0], P[i][1]));
    g.setLineDash(read ? [] : [3, 4]);
    g.strokeStyle = read ? `rgb(${RC[P[i][2]]})` : 'rgba(125,119,128,.45)';
    g.beginPath(); g.moveTo(ox + (P[i - 1][0] + .5) * px, oy + (P[i - 1][1] + .5) * px); g.lineTo(ox + (P[i][0] + .5) * px, oy + (P[i][1] + .5) * px); g.stroke();
  }
  g.setLineDash([]);
  g.fillStyle = BODY; g.fillRect(ox + .5 * px - 3, oy + .5 * px - 3, 6, 6);   // 落点
  g.imageSmoothingEnabled = false;
  drawWonders(ox, oy, px, px / TP, g, W, H, { x: 0, y: -.5 });
  drawClawd(ox + ws[0].x * px, oy + ws[0].y * px, 3, { x: 0, y: 0, tx: 0, ty: 0, anim: 0 }, g);
  g.fillStyle = INK; g.font = `24px ${font}`;
  g.fillText(`${tr('四维来客', 'A Visitor from the Fourth Dimension')} · ${TH.name}`, M, 44);
  g.fillStyle = '#7d7780'; g.font = `12px ${font}`;
  g.fillText(`${SEED ? tr(`纸面 #${SEED} · 从一段对话里折出来`, `Sheet #${SEED} · folded out of a conversation`) : tr(`纸面 #${G.seed} · 直接开始的一张`, `Sheet #${G.seed} · started from scratch`)} · ${new Date().toLocaleDateString(LANG === 'en' ? 'en' : 'zh-CN')}`, M, 66);
  const y = yearNow();
  g.fillText([tr(`已展开 ${fmt(rev.size)} 格`, `${fmt(rev.size)} tiles unfolded`), tr(`遇见居民 ${fmt(G.flat)}`, `${fmt(G.flat)} residents met`), seen() ? tr(`二维历 ${y + 1} 年 · ${ERAS[HIST.era[y]]}`, `Flat Year ${y + 1} · ${ERAS[HIST.era[y]]}`) : '', ROUTE.size ? tr(`对话读到 ${readPct()}%`, `conversation read ${readPct()}%`) : ''].filter(Boolean).join(' · '), M, H - 20);
}

// 全图有两个视图：「纸面」是展开过的地图；「四维」是这段对话本来的样子——
// 左边一直在 x-w、y-z 两个平面里双旋转着投影，右边是它在六个坐标平面上的影子，纸上那条路只是其中 x-y 那一个。
let posterMode = 'map', spin = 0;
function shapeView(now) {
  const S4 = SRC.shape, c = $('pcv'), g = c.getContext('2d'), font = getComputedStyle(document.documentElement).getPropertyValue('--px');
  const W = 1320, H = 800;
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
  const mean = [0, 1, 2, 3].map(i => S4.reduce((v, q) => v + q[i], 0) / S4.length);
  const P = S4.map(q => [q[0] - mean[0], q[1] - mean[1], q[2] - mean[2], q[3] - mean[3], q[4]]);
  const R = Math.max(...P.map(q => Math.hypot(q[0], q[1], q[2], q[3]))) || 1;
  // 同一种颜色的线段并成一条 path，画得快；fit=true 时按这个影子自己的范围放满，不然按四维半径（旋转时不会忽大忽小）
  const trace = (pts, cx, cy, size, lw, fit) => {
    const ext = fit ? Math.max(...pts.map(q => Math.max(Math.abs(q[0]), Math.abs(q[1])))) || 1 : R;
    const sc = size / 2 / ext, paths = {};
    for (let i = 1; i < pts.length; i++) (paths[pts[i][2]] ??= []).push(pts[i - 1], pts[i]);
    g.lineWidth = lw; g.lineCap = 'round';
    for (const [k, seg] of Object.entries(paths)) {
      g.strokeStyle = `rgb(${RC[k]})`; g.beginPath();
      for (let i = 0; i < seg.length; i += 2) { g.moveTo(cx + seg[i][0] * sc, cy + seg[i][1] * sc); g.lineTo(cx + seg[i + 1][0] * sc, cy + seg[i + 1][1] * sc); }
      g.stroke();
    }
  };
  const a = now / 1000 * .35, b = a * .61, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  trace(P.map(([x, y, z, w, k]) => [x * ca - w * sa, y * cb - z * sb, k]), 360, 440, 700, 2);   // 半径 350，转到哪都不出界
  [[tr('x-y · 纸面', 'x-y · paper'), 0, 1], ['x-z', 0, 2], ['x-w', 0, 3], ['y-z', 1, 2], ['y-w', 1, 3], ['z-w', 2, 3]].forEach(([name, i, j], n) => {
    const cx = 800 + (n % 3) * 200, cy = 290 + Math.floor(n / 3) * 290;
    g.strokeStyle = '#e3ded4'; g.lineWidth = 2; g.strokeRect(cx - 92, cy - 106, 184, 196);
    trace(P.map(q => [q[i], q[j], q[4]]), cx, cy, 170, 1.2, true);
    g.fillStyle = '#7d7780'; g.font = `12px ${font}`; g.fillText(name, cx - 84, cy - 90);
  });
  g.fillStyle = INK; g.font = `24px ${font}`; g.fillText(tr('这段对话的四维样子', 'This conversation in four dimensions'), 32, 44);
  g.fillStyle = '#7d7780'; g.font = `12px ${font}`;
  g.fillText(tr('纸上那条路，只是它在 x-y 平面上的影子。换一个方向投下去，就是另一个图案。', 'The road on the paper is only its shadow on the x-y plane. Project it another way and you get another pattern.'), 32, 68);
  g.fillText(tr('橙 你说的话 · 蓝 观看 · 褐 动手 · 绿 改写 · 紫 思考 · 灰蓝 回话 · 红 出错', 'orange: your words · blue: looking · brown: doing · green: editing · purple: thinking · slate: replies · red: errors'), 32, H - 24);
}
function posterView(mode) {
  posterMode = mode;
  cancelAnimationFrame(spin);
  $('pmap').classList.toggle('on', mode === 'map'); $('p4d').classList.toggle('on', mode === '4d');
  if (mode === 'map') return renderPoster();
  const loop = now => { shapeView(now); spin = requestAnimationFrame(loop); };
  spin = requestAnimationFrame(loop);
}
$('p4d').hidden = !Array.isArray(SRC.shape);
$('mapBtn').onclick = () => {
  $('poster').hidden = false; $('mapBtn').classList.remove('ready');
  const c = $('pcv'), g = c.getContext('2d');                // 大地图要画一两秒，先说一声再画
  c.width = 480; c.height = 120; g.fillStyle = PAPER; g.fillRect(0, 0, 480, 120);
  g.fillStyle = INK; g.font = `12px ${getComputedStyle(document.documentElement).getPropertyValue('--px')}`; g.fillText(tr('正在把整张纸铺开……', 'Laying out the whole sheet...'), 24, 64);
  setTimeout(() => posterView('map'), 30);
};
$('pmap').onclick = () => posterView('map');
$('p4d').onclick = () => posterView('4d');
$('pclose').onclick = () => { cancelAnimationFrame(spin); $('poster').hidden = true; };
$('pdl').onclick = () => $('pcv').toBlob(b => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = `${tr('四维来客', 'visitor4d')}-${posterMode === '4d' ? tr('四维投影', '4d-projection') : TH.name}-${SEED || G.seed}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
