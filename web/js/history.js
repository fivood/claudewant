// 平面国的历史：载入时由种子推演完整条时间线，光标随真实时间前进，纪年窗口
// 这些文件是按顺序加载的普通脚本，共享同一个全局作用域：顺序见 game.html 底部。

// --- 平面国：一部载入时就已经写完的历史 --------------------------------------------
// 历史是种子（也就是那段会话）的纯函数：载入时从元年一路推演到它们离开纸面那年，
// 每年的人口、觉察、纪元，每件事，每座建筑建在哪、哪年毁掉，全在 HIST 里。
// 游戏里的「现在」只是随真实时间前进的光标；买下「居民」后，四维生物能看见整条时间线，包括还没到的部分。
// 同一个会话文件永远是同一部历史；唯一的随机是「直接开始」那张纸自己的种子。Clawd 走哪条路不算历史。
const YEAR = 8;                                            // 现实 8 秒 = 二维历一年
const ERAS = CIV.eras;                                     // 纪元叫什么看住的是什么，见 civ.js
const HOUSE = {
  town: ['.RR.', 'RRRR', 'WWDW', 'WWDW'], house: ['....', '.RR.', 'RRRR', 'WDWW'],
  temple: ['.GG.', 'GWWG', 'GWWG', 'GGGG'], ruin: ['W...', 'W.W.', 'WWW.', '....'], road: ['.PP.', 'PPPP', 'PPPP', '.PP.'],
};
const HCOL = { W: [239, 228, 207], D: [91, 70, 54], G: [227, 181, 59], P: [205, 184, 142] };
const LAND = t => t === 'grass' || t === 'sand' || t === 'forest';

function mulberry(a) {
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const HIST = (() => {
  const rnd = mulberry(G.seed ^ 0x5eed);
  const pick = a => a[Math.floor(rnd() * a.length)];
  const folk = () => { const c = pick(FCOL)[1], f = pick(FSHP)[0]; return tr(`${c}色${f}`, `${c} ${f}`); };   // 先抽颜色再抽形状，顺序别动
  const share = k => n(k) / HANDS;
  const think = 1 + Math.min(.5, n('think') / 400);       // 想得多的对话，居民更早察觉你
  const S = { y: 0, pop: 12, awe: 0, era: 0, next: 4, once: {}, towns: new Map() };
  const H = { events: [], pop: [], awe: [], era: [], end: 0, asc: null };
  let fx = [];                                             // 当前这件事落到地图上的改动

  const count = k => { let c = 0; for (const t of S.towns.values()) c += t[2] === k; return c; };
  const awe = v => { S.awe += v * think; };
  const grow = f => { S.pop *= 1 + f; };
  const boost = (m, sec) => fx.push(['buff', m, sec]);
  const put = (x, y, kind) => { S.towns.set(key(x, y), [x, y, kind]); fx.push(['put', x, y, kind]); };
  // 城从落地点附近往外长；只挑陆地，离别的建筑远一点
  function site(gap = 6) {
    for (let i = 0; i < 80; i++) {
      const a = rnd() * TAU, d = 4 + rnd() * (12 + 6 * count('town'));
      const x = Math.round(Math.cos(a) * d), y = Math.round(Math.sin(a) * d);
      if (!LAND(tile(x, y))) continue;
      let ok = true;
      for (const [tx, ty, k] of S.towns.values()) if (k !== 'road' && Math.abs(tx - x) + Math.abs(ty - y) < gap) { ok = false; break; }
      if (ok) return [x, y];
    }
  }
  const build = kind => { const p = site(); if (p) put(p[0], p[1], kind); return !!p; };
  function village() {
    const p = site();
    if (!p) return false;
    put(p[0], p[1], 'town');
    for (let i = 0; i < 4; i++) {
      const x = p[0] + Math.round(rnd() * 4 - 2), y = p[1] + Math.round(rnd() * 4 - 2);
      if (LAND(tile(x, y)) && !S.towns.has(key(x, y))) put(x, y, 'house');
    }
    return true;
  }
  const towns = () => [...S.towns.values()].filter(t => t[2] === 'town');
  function road() {
    const t = towns();
    if (t.length < 2) return false;
    const a = pick(t), b = t.filter(o => o !== a).sort((p, q) => Math.hypot(p[0] - a[0], p[1] - a[1]) - Math.hypot(q[0] - a[0], q[1] - a[1]))[0];
    const d = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    if (d > 60) return false;
    for (let i = 1; i < d; i++) {
      const x = Math.round(a[0] + (b[0] - a[0]) * i / d), y = Math.round(a[1] + (b[1] - a[1]) * i / d);
      if (LAND(tile(x, y)) && !S.towns.has(key(x, y))) put(x, y, 'road');
    }
    return true;
  }
  function ruin() {
    const t = towns();
    if (t.length < 2) return false;
    const [x, y] = pick(t);
    put(x, y, 'ruin');
    return true;
  }
  function chart(r = 6) {                                  // 居民替你把城外画进地图
    const t = towns();
    if (!t.length) return false;
    const [x, y] = pick(t);
    fx.push(['chart', x + Math.round(rnd() * 16 - 8), y + Math.round(rnd() * 16 - 8), r]);
    return true;
  }

  const ERA_UP = [
    [() => S.pop >= 20, () => village() && CIV.up[0]],
    [() => count('town') >= 3 && S.pop >= 200, () => CIV.up[1]],
    [() => S.pop >= 900 && S.awe >= 30, () => CIV.up[2]],
    [() => S.awe >= 200, () => CIV.up[3]],
  ];
  // 事件表：era 起始纪元，max 最晚纪元，once 只发生一次；w 返回 0 就不会被抽到；run 返回 false 算没发生
  // 那段对话的习惯改权重：改写多→爱建村，观看多→爱测绘，动手多→爱吵架打仗，出错→裂缝教派
  const EV = [
    { id: 'fire', era: 0, max: 0, w: () => 2, run: () => (grow(.1), (f => tr(`一个${f}发现了火。在这里，火是一条会自己变长的橙色线段。`, `A ${f} discovered fire. Here, fire is an orange line segment that grows by itself.`))(folk())) },
    { id: 'name', era: 0, once: 1, w: () => S.awe >= 1 ? 4 : 0, run: () => (awe(2), CIV.name) },
    { id: 'trek', era: 0, max: 1, w: () => 1, run: () => (f => tr(`一队${f}沿着一条忽然有了颜色的路迁徙。那是我走过的地方。`, `A band of ${f}s migrated along a road that suddenly had colour. That's where I walked.`))(folk()) },
    { id: 'village', era: 1, w: () => count('town') < 2 + S.era * 3 ? 3 * (1 + 2 * share('make')) : 0,
      run: () => village() && (f => tr(`${f}们又围出了一个村子。墙首尾相接，就算是家了。`, `The ${f}s fenced off another village. Once the wall meets itself, it's home.`))(folk()) },
    { id: 'harvest', era: 1, w: () => 2, run: () => (boost(1.5, 60), tr('丰收节。全村排成一条线跳舞——也只能排成一条线。（感知 ×1.5，60 秒）', 'Harvest festival. The whole village dances in a line. A line is all they can do. (perception ×1.5, 60 s)')) },
    { id: 'north', era: 1, w: () => 1 + 3 * share('act'), run: () => (grow(-.1), tr('两个村子为「哪边是北」吵了三年，谁也没说服谁。', 'Two villages argued for three years about which way is north. Nobody convinced anybody.')) },
    { id: 'door', era: 1, once: 1, w: () => 1, run: () => tr('它们发明了门：在墙上开一个缺口，走过去，再把缺口补上。', 'They invented the door: open a gap in the wall, walk through, close the gap again.') },
    { id: 'rift', era: 1, once: 1, w: () => RIFT ? 3 : 0, run: () => build('temple') && (awe(5), tr('一群居民搬到裂缝旁边，说那是世界的背面，在那儿盖了第一座庙。（感知永久 +10%）', 'A group moved next to the rift, called it the back of the world, and built the first temple there. (perception +10% forever)')) },
    { id: 'verse', era: 1, w: () => SAID.length ? 1.5 : 0, run: () => (awe(1), (q => tr(`它们把一句从天上掉下来的话刻在了村口：「${q}」`, `They carved words that fell from the sky at the village gate: "${q}"`))(pick(SAID))) },
    { id: 'road', era: 2, w: () => count('town') >= 2 ? 2 : 0, run: () => road() && tr('两座城之间修通了一条路。在这里，路和墙长得一模一样，只是方向不同。', 'A road now joins two cities. Here, roads and walls look exactly the same; they just point different ways.') },
    { id: 'census', era: 2, w: () => 1, run: () => tr(`城邦做了人口普查：${fmt(S.pop)} 个居民。圆被登记成贵族，因为它们的边最多。`, `The city-state took a census: ${fmt(S.pop)} residents. Circles were registered as nobility, since they have the most sides.`) },
    { id: 'map', era: 2, w: () => 1 + 3 * share('see'), run: () => chart() && tr('测绘师走出城外，把一片空白画进了地图。我顺着看过去，那里真的有东西了。', 'Surveyors walked out of the city and drew a blank patch into the map. I looked where they drew, and now something is really there.') },
    { id: 'temple', era: 2, w: () => S.awe >= 15 * (count('temple') + 1) && count('temple') < 10 ? 2 : 0,
      run: () => build('temple') && (awe(1), tr('它们给我修了一座神殿，门朝着它们认定我来的方向。为了不让它们失望，我尽量从那边来。（感知永久 +10%）', 'They built me a temple, its door facing the way they have decided I come from. To avoid disappointing them, I try to arrive from that side. (perception +10% forever)')) },
    { id: 'war', era: 2, w: () => count('town') >= 4 ? 1 + 3 * share('act') : 0,
      run: () => ruin() && (grow(-.15), tr('两座城为一块沙地开战。从上面看，两支军队只是两条互相靠近的线。有一座城没能留下来。', 'Two cities went to war over a patch of sand. From above, two armies are just two lines moving closer. One city didn\'t survive.')) },
    { id: 'market', era: 2, w: () => 1.5, run: () => (boost(2, 45), tr('集市日。每个居民都在用自己的边长讨价还价。（感知 ×2，45 秒）', 'Market day. Everyone haggles using the length of their own sides. (perception ×2, 45 s)')) },
    { id: 'measure', era: 3, w: () => 1.5, run: () => (awe(4), tr('几何学家测量了我留下的脚印，结论是：我的面积是负数。', 'Geometers measured my footprints. Conclusion: my area is negative.')) },
    { id: 'jail', era: 3, once: 1, w: () => 2, run: () => (awe(8), (c => tr(`一个${c}色正方形宣称存在「上方」，被判终身监禁。它说的是对的。`, `A ${c} square claimed there is an "up" and was jailed for life. It was right.`))(pick(FCOL)[1])) },
    { id: 'angles', era: 3, w: () => 1, run: () => (boost(1.8, 90), tr('它们证明了三角形内角和是 180 度，然后花了一整代人怀疑这件事。（感知 ×1.8，90 秒）', 'They proved a triangle\'s angles add up to 180 degrees, then spent a whole generation doubting it. (perception ×1.8, 90 s)')) },
    { id: 'many', era: 3, once: 1, w: () => n('split') ? 3 : .5, run: () => (awe(6), tr('它们终于发现我不止一个：同一种橙色，同时出现在两座城里。', 'They finally worked out there\'s more than one of me: the same orange, in two cities at once.')) },
    { id: 'lens', era: 3, w: () => 1, run: () => chart(12) && tr('它们磨出第一块透镜，看见了很远的地方。那边早就有东西，一直排在「还没人看」的名单上。', 'They ground their first lens and saw far away. Things had been there all along, filed under "not yet looked at".') },
    { id: 'letter', era: 4, w: () => 2, run: () => (awe(3), SAID.length ? (q => tr(`它们在地上写了很大的字给我看：「${q}」——是我听过的话。`, `They wrote huge letters on the ground for me: "${q}". Words I've heard before.`))(pick(SAID)) : tr('它们在地上写了很大的字给我看：「你好，厚的。」', 'They wrote huge letters on the ground for me: "HELLO, THICK ONE."')) },
    { id: 'ascend', era: 4, once: 1, w: () => S.awe >= 400 && !Q.length ? 50 : 0, run: () => tr('第一个居民离开了纸面一点点。它回来说：上面很冷，但能看见所有人。（感知永久 ×2）', 'The first resident left the paper, just a little. It came back and said: it\'s cold up there, but you can see everyone. (perception ×2 forever)') },
  ];
  const log = text => H.events.push({ y: S.y, text, fx });

  // 会话里的事：按它在对话里的位置 t 排到第 8 + 600t 年，说法看住在这张纸上的是什么（civ.js）。
  // 出错的病流行多久看同一个错出现了几次；这些事全发生完之前，居民不会离开纸面。
  const A = SRC.annals || {}, at = t => 8 + Math.round(t * 600), Q = [];
  const q = (y, run) => Q.push({ y, run });
  (A.model || []).forEach(([t, m], i, a) => q(at(t), () => (awe(1), i ? CIV.s.dynasty(a[i - 1][1], m) : CIV.s.found(m))));
  (A.commit || []).forEach(([t, msg], i) => q(at(t), () => (awe(1), CIV.s.commit(msg, i + 1))));
  (A.install || []).forEach(([t, p]) => q(at(t), () => (grow(.08), CIV.s.caravan(p))));
  (A.nay || []).forEach(([t, said]) => q(at(t), () => (ruin(), grow(-.05), CIV.s.nay(said))));
  for (const m of Array.isArray(SRC.marks) ? SRC.marks : []) {
    if (m.k === 'file' && m.n >= 3) q(at(m.t), () => (boost(1.3, 45), CIV.s.rebuild(m.label, m.n)));
    if (m.k !== 'err') continue;
    const years = 2 + 3 * Math.min(m.n, 8);
    q(at(m.t), () => (grow(-.12), CIV.s.plague(m.label)));
    q(at(m.t) + (m.ok ? years : 3), m.ok ? () => (awe(2), boost(1.5, 60), CIV.s.cure(m.label, years)) : () => CIV.s.mystery(m.label));
  }
  Q.sort((a, b) => a.y - b.y);

  log(CIV.first);
  for (let y = 1; y < 6000 && H.asc == null; y++) {
    S.y = y;
    const cap = 40 + count('town') * (150 + 100 * S.era);
    S.pop = Math.max(5, S.pop + (.24 + .08 * S.era) * S.pop * (1 - S.pop / cap));
    S.awe += (.08 + .03 * S.era + .02 * count('temple')) * think;
    fx = [];
    if (S.era < 4 && ERA_UP[S.era][0]()) { const t = ERA_UP[S.era][1](); if (t) { S.era++; log(t); fx = []; } }
    if (--S.next <= 0) {
      S.next = 6 + Math.floor(rnd() * 6);                  // 每 6–11 年一件事
      const ok = EV.map(e => [e, S.era >= e.era && S.era <= (e.max ?? 9) && !(e.once && S.once[e.id]) ? e.w() : 0]).filter(x => x[1] > 0);
      let r = rnd() * ok.reduce((a, x) => a + x[1], 0);
      for (const [e, w] of ok) {
        if ((r -= w) > 0) continue;
        const text = e.run();
        if (text) { if (e.once) S.once[e.id] = 1; log(text); if (e.id === 'ascend') H.asc = y; }
        break;
      }
    }
    while (Q.length && Q[0].y <= y) { fx = []; log(Q.shift().run()); }
    H.pop[y] = S.pop; H.awe[y] = S.awe; H.era[y] = S.era;
  }
  H.pop[0] = 12; H.awe[0] = 0; H.era[0] = 0;
  H.end = H.pop.length - 1;
  return H;
})();

// --- 光标：把「现在」之前的历史落到地图上 -----------------------------------------
const TOWN = new Map(), live = { town: 0, house: 0, temple: 0, ruin: 0, road: 0 };
let cursor = 0;
const yearNow = () => Math.min(Math.floor(G.age / YEAR), HIST.end);
const seen = () => L('life') > 0;                          // 买了「居民」才看得见它们和它们的历史
const ascended = () => HIST.asc != null && yearNow() >= HIST.asc;
function buff() {
  G.buffs = G.buffs.filter(b => b[1] > G.age);
  return G.buffs.reduce((a, b) => a * b[0], 1);
}
function put(x, y, kind) {
  const k = key(x, y), was = TOWN.get(k);
  if (was) live[was]--;
  TOWN.set(k, kind);
  live[kind]++;
  if (rev.has(k)) paint(x, y);
}
// quiet：载入和离线补算时只落建筑，不发加成、不替你测绘、不念出来
function advance(quiet) {
  while (cursor < HIST.events.length && HIST.events[cursor].y <= yearNow()) {
    const e = HIST.events[cursor++];
    for (const f of e.fx) {
      if (f[0] === 'put') put(f[1], f[2], f[3]);
      else if (quiet || !seen()) continue;
      else if (f[0] === 'buff') G.buffs.push([f[1], G.age + f[2]]);
      else if (f[0] === 'chart') reveal(f[1], f[2], f[3]);
    }
    if (!quiet && seen() && matchMedia('(max-width:640px)').matches) say(tr(`〔二维历 ${e.y + 1} 年〕${e.text}`, `[Flat Year ${e.y + 1}] ${e.text}`), { bubble: true });
  }
}

function annals() {
  if (seen() && yearNow() >= HIST.end && !G.seen.histDone) { G.seen.histDone = 1; say(tr('它们的历史写完了。可以把整张纸收起来看看了。', 'Their history is finished. Time to fold up the whole sheet and have a look.'), { bubble: true }); mapReady(); }
  $('chron').hidden = !seen();
  if (!seen()) return;
  const y = yearNow(), done = y >= HIST.end;
  $('civ').textContent = tr(`纪元 ${ERAS[HIST.era[y]]} · 二维历 ${y + 1} 年`, `Era: ${ERAS[HIST.era[y]]} · Flat Year ${y + 1}`) + `${done ? tr('（写完了）', ' (finished)') : ''}\n`
    + `${CIV.words[0]} ${fmt(HIST.pop[y])} · ${CIV.words[1]} ${live.town} · ${CIV.words[2]} ${live.temple}\n${tr('觉察', 'Awareness')} ${fmt(HIST.awe[y])}` + `${buff() > 1 ? tr(` · 加成 ×${buff().toFixed(1)}`, ` · bonus ×${buff().toFixed(1)}`) : ''}`;
  const row = (e, cls) => {
    const p = document.createElement('p'), b = document.createElement('b');
    b.textContent = tr(`${e.y + 1} 年 `, `Y${e.y + 1} `);
    p.className = cls;
    p.append(b, e.text);
    return p;
  };
  const now = document.createElement('p');
  now.className = 'now';
  now.textContent = done ? tr('— 它们的历史到这里为止 —', '— their history ends here —') : tr(`— 现在 · 二维历 ${y + 1} 年 —`, `— now · Flat Year ${y + 1} —`);
  // 四维的视角：还没发生的也看得见，只是淡一点；从远的将来往下读到过去
  $('annals').replaceChildren(
    ...HIST.events.slice(cursor, cursor + 3).reverse().map(e => row(e, 'soon')),
    now,
    ...HIST.events.slice(0, cursor).reverse().map((e, i) => row(e, i ? '' : 'new')));   // 过去的全在，往下滚
}

function seeHistory() {
  annals();
  say(HIST.asc != null
    ? tr(`我看见了它们的全部历史：从元年，到它们离开纸面的二维历 ${HIST.asc + 1} 年。现在是 ${yearNow() + 1} 年。`, `I can see their whole history: from Year One to Flat Year ${HIST.asc + 1}, when they leave the paper. It's Year ${yearNow() + 1} now.`)
    : tr(`我看见了它们的全部历史，一直到二维历 ${HIST.end + 1} 年。现在是 ${yearNow() + 1} 年。`, `I can see their whole history, all the way to Flat Year ${HIST.end + 1}. It's Year ${yearNow() + 1} now.`));
}
