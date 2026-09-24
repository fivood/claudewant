// Clawd 怎么长、怎么走：自动升级、行走的截面、展开格子拿感知、遇见居民、离线补算
// 这些文件是按顺序加载的普通脚本，共享同一个全局作用域：顺序见 game.html 底部。

// --- 升级 --------------------------------------------------------------------
const L = id => G.lv[id] || 0;
const speed = () => 1.2 + .35 * L('speed');
const radius = () => 1 + L('radius');
const mult = () => 1.25 ** L('mult') * (seen() ? (1 + .1 * Math.min(10, live.temple)) * (ascended() ? 2 : 1) : 1);
const foldCD = () => 48 - 6 * L('fold');

const UPS = [
  { id: 'speed', name: tr('步长', 'Stride'), max: 20, cost: l => 40 * 1.9 ** l, info: l => tr(`每秒走 ${(1.2 + .35 * l).toFixed(2)} 格`, `${(1.2 + .35 * l).toFixed(2)} tiles per second`),
    say: tr('少往第四个方向漏一点，就走得快一点。', 'Leak a little less into the fourth direction, and I walk a little faster.') },
  { id: 'radius', name: tr('截面', 'Cross-section'), max: 8, cost: l => 150 * 4 ** l, info: l => tr(`落在纸面上的截面半径 ${1 + l}`, `Cross-section radius on the paper: ${1 + l}`),
    say: tr('我把更大的一截放进了这个平面。', 'I put a bigger slice of myself into the plane.') },
  { id: 'color', name: tr('色彩', 'Colour'), max: 1, cost: () => 200, info: () => tr('这里原本是有颜色的', 'This place had colours all along'),
    say: tr('颜色回来了。或者说，我终于看见了它们。', 'The colours came back. Or rather, I finally saw them.') },
  { id: 'mult', name: tr('理解', 'Understanding'), max: 40, cost: l => 400 * 3 ** l, info: l => tr(`每格感知 ×${(1.25 ** l).toFixed(2)}`, `Perception per tile ×${(1.25 ** l).toFixed(2)}`),
    say: tr('我开始理解这里的规则。规则只沿着两条轴。', 'I\'m starting to understand the rules here. They only run along two axes.') },
  { id: 'clone', name: tr('投影', 'Projection'), max: 5, cost: l => 6000 * 10 ** l, info: l => tr(`同时落在纸面上的截面 ${1 + l} 个`, `${1 + l} cross-sections on the paper at once`),
    say: tr('我又放下了自己的另一截。在这里，它们看起来毫无关系。', 'I set down another slice of myself. Down here they look completely unrelated.') },
  { id: 'life', name: tr('居民', 'Residents'), max: 1, need: 'color', cost: () => 2000, info: () => tr('看见生活在纸面上的东西', 'See the things that live on the paper'), say: '' },
  { id: 'fold', name: tr('折纸', 'Folding'), max: 6, cost: l => 60000 * 4 ** l, info: l => tr(`每 ${48 - 6 * l} 秒把纸对折一次，跳去远处`, `Fold the paper every ${48 - 6 * l} s and jump somewhere far`),
    say: tr('纸是可以折的。住在纸上的人不知道。', 'Paper can be folded. The people who live on it don\'t know that.') },
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
    say(n ? tr(`原来它们一直都在。我走过的地方住着 ${n} 个居民。`, `They were here all along. ${n} residents live where I've walked.`) : tr('这里应该有人住。我还没走到。', 'Someone should live here. I just haven\'t reached them yet.'));
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
  if (pet) return say(tr(`我从一个${cn}色${sn}上面跨了过去。在它看来，我凭空消失了一瞬间。`, `I stepped over a ${cn} ${sn}. To it, I vanished for a moment.`), { chat: true, bubble: true });
  if (SAID.length) { const q = SAID[G.heard++ % SAID.length]; return say(tr(`遇见一个${cn}色的${sn}。它反复念着一句从上方掉下来的话：「${q}」`, `Met a ${cn} ${sn}. It keeps repeating something that fell from above: "${q}"`), { chat: true }); }
  const sees = [tr('一段会变长变短的橙色线段', 'an orange line segment that grows and shrinks'), tr('一团忽大忽小的颜色', 'a blob of colour that swells and fades'), tr('一个不讲道理的影子', 'an unreasonable shadow'), tr('天气', 'weather')];
  say(tr(`遇见一个${cn}色的${sn}。它把我看成了${sees[Math.floor(Math.random() * sees.length)]}。`, `Met a ${cn} ${sn}. It saw me as ${sees[Math.floor(Math.random() * sees.length)]}.`), { chat: true });
}

// 不在的时候按离开前的速度折半算，不模拟地图。
// ponytail: 离线期间地图不会展开，只给感知；想要离线也画地图就在这里跑一段简化模拟。
function away(sec) {
  const y0 = yearNow();
  G.age += sec;
  advance(true);
  if (seen() && yearNow() > y0) say(tr(`你不在的时候，它们过了 ${yearNow() - y0} 年。纪年里记着。`, `While you were gone, ${yearNow() - y0} year${yearNow() - y0 > 1 ? 's' : ''} passed for them. It's all in the annals.`));
  sec = Math.min(sec, 8 * 3600);
  const v = G.rate * sec * .5;
  if (v < 10) return;
  earn(v);
  const m = Math.round(sec / 60);
  say(tr(`你离开的 ${m >= 60 ? (m / 60).toFixed(1) + ' 小时' : Math.max(m, 1) + ' 分钟'}里，我在纸面上继续游荡，带回 ${fmt(v)} 感知。`, `In the ${m >= 60 ? (m / 60).toFixed(1) + ' hours' : m > 1 ? m + ' minutes' : 'minute'} you were away, I kept wandering the paper and brought back ${fmt(v)} perception.`));
}
