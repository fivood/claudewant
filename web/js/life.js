// Clawd 怎么长、怎么走：自动升级、行走的截面、展开格子拿感知、遇见居民、离线补算
// 这些文件是按顺序加载的普通脚本，共享同一个全局作用域：顺序见 game.html 底部。

// --- 升级 --------------------------------------------------------------------
const L = id => G.lv[id] || 0;
const speed = () => 1.2 + .35 * L('speed');
const radius = () => 1 + L('radius');
const mult = () => 1.25 ** L('mult') * (seen() ? (1 + .1 * Math.min(10, live.temple)) * (ascended() ? 2 : 1) : 1);
const foldCD = () => 48 - 6 * L('fold');

const UPS = [
  { id: 'speed', name: '步长', max: 20, cost: l => 40 * 1.9 ** l, info: l => `每秒走 ${(1.2 + .35 * l).toFixed(2)} 格`,
    say: '少往第四个方向漏一点，就走得快一点。' },
  { id: 'radius', name: '截面', max: 8, cost: l => 150 * 4 ** l, info: l => `落在纸面上的截面半径 ${1 + l}`,
    say: '我把更大的一截放进了这个平面。' },
  { id: 'color', name: '色彩', max: 1, cost: () => 200, info: () => '这里原本是有颜色的',
    say: '颜色回来了。或者说，我终于看见了它们。' },
  { id: 'mult', name: '理解', max: 40, cost: l => 400 * 3 ** l, info: l => `每格感知 ×${(1.25 ** l).toFixed(2)}`,
    say: '我开始理解这里的规则。规则只沿着两条轴。' },
  { id: 'clone', name: '投影', max: 5, cost: l => 6000 * 10 ** l, info: l => `同时落在纸面上的截面 ${1 + l} 个`,
    say: '我又放下了自己的另一截。在这里，它们看起来毫无关系。' },
  { id: 'life', name: '居民', max: 1, need: 'color', cost: () => 2000, info: () => '看见生活在纸面上的东西', say: '' },
  { id: 'fold', name: '折纸', max: 6, cost: l => 60000 * 4 ** l, info: l => `每 ${48 - 6 * l} 秒把纸对折一次，跳去远处`,
    say: '纸是可以折的。住在纸上的人不知道。' },
];

const rows = {};
for (const u of UPS) {
  const b = document.createElement('div'), top = document.createElement('b');
  const name = document.createElement('span'), cost = document.createElement('span'), info = document.createElement('small');
  top.append(name, cost);
  b.append(top, info);
  b.className = 'up field';
  b.hidden = true;
  $('rows').append(b);
  rows[u.id] = { b, name, cost, info };
}

// 没有按钮：它自己决定先长哪一块。偏好来自那段对话里的习惯。
const WANT = {
  speed: 1 + 3 * n('act') / HANDS, radius: 1 + 3 * n('see') / HANDS, color: 4,
  life: 2 + Math.min(4, n('talk') / 10), mult: 1 + Math.min(3, n('think') / 20),
  clone: 1 + Math.min(3, n('split') / 2), fold: 1 + Math.min(3, n('min') / 60),
};
let goal = null;
function decide() {
  let bs = Infinity;
  goal = null;
  for (const u of UPS) {
    const l = L(u.id);
    if (l >= u.max || (u.need && !L(u.need))) continue;
    const sc = u.cost(l) / WANT[u.id];
    if (sc < bs) { bs = sc; goal = u; }
  }
  if (goal) buy(goal);
}

function buy(u) {
  const l = L(u.id), c = Math.ceil(u.cost(l));
  if (l >= u.max || G.pts < c) return;
  G.pts -= c;
  G.lv[u.id] = l + 1;
  if (!l && u.say) say(u.say);
  if (u.id === 'clone') addWalker(ws[0].x, ws[0].y);
  if (u.id === 'color') repaintAll();
  if (u.id === 'life') {
    repaintAll();
    let n = 0;
    for (const k of rev) { const x = kx(k), y = ky(k); if (h(x, y, G.seed + 99) < FLATP && isFlat(x, y, tile(x, y))) n++; }
    G.flat += n;
    if (n) earn(n * FLATV * mult());
    say(n ? `原来它们一直都在。我走过的地方住着 ${n} 个居民。` : '这里应该有人住。我还没走到。');
    seeHistory();
  }
  hud();
}

// --- 行走的截面 --------------------------------------------------------------
const ws = [];
function addWalker(x, y) {
  const a = Math.random() * TAU;
  const w = { x, y, tx: x, ty: y, hx: Math.cos(a), hy: Math.sin(a), k: -1, anim: 0 };
  retarget(w);
  ws.push(w);
}

// 往前方大致没展开的地方走：随机抽样，偏向当前朝向。找不到就把圈放大。
function retarget(w) {
  if (w === ws[0] && ROUTE.size && Math.random() < .25) { const p = nextRoute(w); if (p) { w.tx = p[0] + .5; w.ty = p[1] + .5; return; } }   // 顺着对话往后读
  for (let ring = radius() + 3; ring <= 512; ring *= 2) {
    let best = null, bs = -9;
    for (let n = 0; n < 20; n++) {
      const a = Math.random() * TAU, d = ring * (.6 + Math.random() * .4);
      const x = Math.floor(w.x + Math.cos(a) * d), y = Math.floor(w.y + Math.sin(a) * d);
      if (rev.has(key(x, y))) continue;
      const sc = Math.cos(a) * w.hx + Math.sin(a) * w.hy + Math.random() * 1.2;
      if (sc > bs) { bs = sc; best = [x + .5, y + .5]; }
    }
    if (best) { [w.tx, w.ty] = best; return; }
  }
  const a = Math.random() * TAU;
  w.tx = w.x + Math.cos(a) * 60; w.ty = w.y + Math.sin(a) * 60;
}

function reveal(cx, cy, r) {
  let gain = 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r + r) continue;
    const x = cx + dx, y = cy + dy, k = key(x, y);
    if (rev.has(k)) continue;
    rev.add(k);
    hasChunk.add(ckey(x, y));
    paint(x, y);
    const t = tile(x, y);
    gain += T[t].v;
    if (!G.seen[t]) { G.seen[t] = 1; if (FIRST[t]) say(FIRST[t]); }
    if (L('life') && isFlat(x, y, t)) { gain += FLATV; meet(x, y); }
    if (ROUTE.has(k)) routeStep();
    if (WKEY.has(k)) discover(WKEY.get(k));
  }
  if (gain) earn(gain * mult() * buff());
  for (const m of MILES) if (rev.size >= m[0] && !G.seen['m' + m[0]]) { G.seen['m' + m[0]] = 1; say(m[1]); }
}

let secGain = 0;
function earn(v) { G.pts += v; G.total += v; secGain += v; }

function meet(x, y) {
  G.flat++;
  const [[, cn], [sn]] = flatOf(x, y);
  if (pet) return say(`我从一个${cn}色${sn}上面跨了过去。在它看来，我凭空消失了一瞬间。`, { chat: true, bubble: true });
  if (SAID.length) return say(`遇见一个${cn}色的${sn}。它反复念着一句从上方掉下来的话：「${SAID[G.heard++ % SAID.length]}」`, { chat: true });
  const sees = ['一段会变长变短的橙色线段', '一团忽大忽小的颜色', '一个不讲道理的影子', '天气'];
  say(`遇见一个${cn}色的${sn}。它把我看成了${sees[Math.floor(Math.random() * sees.length)]}。`, { chat: true });
}

// 不在的时候按离开前的速度折半算，不模拟地图。
// ponytail: 离线期间地图不会展开，只给感知；想要离线也画地图就在这里跑一段简化模拟。
function away(sec) {
  const y0 = yearNow();
  G.age += sec;
  advance(true);
  if (seen() && yearNow() > y0) say(`你不在的时候，它们过了 ${yearNow() - y0} 年。纪年里记着。`);
  sec = Math.min(sec, 8 * 3600);
  const v = G.rate * sec * .5;
  if (v < 10) return;
  earn(v);
  const m = Math.round(sec / 60);
  say(`你离开的 ${m >= 60 ? (m / 60).toFixed(1) + ' 小时' : Math.max(m, 1) + ' 分钟'}里，我在纸面上继续游荡，带回 ${fmt(v)} 感知。`);
}
