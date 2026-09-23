// 平面国的历史：载入时由种子推演完整条时间线，光标随真实时间前进，纪年窗口
// 这些文件是按顺序加载的普通脚本，共享同一个全局作用域：顺序见 game.html 底部。

// --- 平面国：一部载入时就已经写完的历史 --------------------------------------------
// 历史是种子（也就是那段会话）的纯函数：载入时从元年一路推演到它们离开纸面那年，
// 每年的人口、觉察、纪元，每件事，每座建筑建在哪、哪年毁掉，全在 HIST 里。
// 游戏里的「现在」只是随真实时间前进的光标；买下「居民」后，四维生物能看见整条时间线，包括还没到的部分。
// 同一个会话文件永远是同一部历史；唯一的随机是「直接开始」那张纸自己的种子。Clawd 走哪条路不算历史。
const YEAR = 8;                                            // 现实 8 秒 = 二维历一年
const ERAS = ['游荡', '村落', '城邦', '几何', '觉醒'];
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
  const folk = () => `${pick(FCOL)[1]}色${pick(FSHP)[0]}`;
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
    [() => S.pop >= 20, () => village() && '第一个村子出现了：一圈首尾相接的线。它们管里面叫「家」，外面叫「外面」。'],
    [() => count('town') >= 3 && S.pop >= 200, () => '村子长成了城邦。城墙越修越厚——在这里，「厚」是最贵的形容词。'],
    [() => S.pop >= 900 && S.awe >= 30, () => '它们开始研究几何。第一个问题是：那个橙色的东西，到底有几条边？'],
    [() => S.awe >= 200, () => '一个正方形在夜里「抬起头」——它们本来没有这个方向——看见了我。纸面开始觉醒。'],
  ];
  // 事件表：era 起始纪元，max 最晚纪元，once 只发生一次；w 返回 0 就不会被抽到；run 返回 false 算没发生
  // 那段对话的习惯改权重：改写多→爱建村，观看多→爱测绘，动手多→爱吵架打仗，出错→裂缝教派
  const EV = [
    { id: 'fire', era: 0, max: 0, w: () => 2, run: () => (grow(.1), `一个${folk()}发现了火。在这里，火是一条会自己变长的橙色线段。`) },
    { id: 'name', era: 0, once: 1, w: () => S.awe >= 1 ? 4 : 0, run: () => (awe(2), '它们给那个会突然出现的橙色东西起了名字：「厚的」。') },
    { id: 'trek', era: 0, max: 1, w: () => 1, run: () => `一队${folk()}沿着一条忽然有了颜色的路迁徙。那是我走过的地方。` },
    { id: 'village', era: 1, w: () => count('town') < 2 + S.era * 3 ? 3 * (1 + 2 * share('make')) : 0,
      run: () => village() && `${folk()}们又围出了一个村子。墙首尾相接，就算是家了。` },
    { id: 'harvest', era: 1, w: () => 2, run: () => (boost(1.5, 60), '丰收节。全村排成一条线跳舞——也只能排成一条线。（感知 ×1.5，60 秒）') },
    { id: 'north', era: 1, w: () => 1 + 3 * share('act'), run: () => (grow(-.1), '两个村子为「哪边是北」吵了三年，谁也没说服谁。') },
    { id: 'door', era: 1, once: 1, w: () => 1, run: () => '它们发明了门：在墙上开一个缺口，走过去，再把缺口补上。' },
    { id: 'rift', era: 1, once: 1, w: () => RIFT ? 3 : 0, run: () => build('temple') && (awe(5), '一群居民搬到裂缝旁边，说那是世界的背面，在那儿盖了第一座庙。（感知永久 +10%）') },
    { id: 'verse', era: 1, w: () => SAID.length ? 1.5 : 0, run: () => (awe(1), `它们把一句从天上掉下来的话刻在了村口：「${pick(SAID)}」`) },
    { id: 'road', era: 2, w: () => count('town') >= 2 ? 2 : 0, run: () => road() && '两座城之间修通了一条路。在这里，路和墙长得一模一样，只是方向不同。' },
    { id: 'census', era: 2, w: () => 1, run: () => `城邦做了人口普查：${fmt(S.pop)} 个居民。圆被登记成贵族，因为它们的边最多。` },
    { id: 'map', era: 2, w: () => 1 + 3 * share('see'), run: () => chart() && '测绘师走出城外，把一片空白画进了地图。我顺着看过去，那里真的有东西了。' },
    { id: 'temple', era: 2, w: () => S.awe >= 15 * (count('temple') + 1) && count('temple') < 10 ? 2 : 0,
      run: () => build('temple') && (awe(1), '它们给我修了一座神殿，门朝着它们以为我来的方向——其实我是从每个方向来的。（感知永久 +10%）') },
    { id: 'war', era: 2, w: () => count('town') >= 4 ? 1 + 3 * share('act') : 0,
      run: () => ruin() && (grow(-.15), '两座城为一块沙地开战。从上面看，两支军队只是两条互相靠近的线。有一座城没能留下来。') },
    { id: 'market', era: 2, w: () => 1.5, run: () => (boost(2, 45), '集市日。每个居民都在用自己的边长讨价还价。（感知 ×2，45 秒）') },
    { id: 'measure', era: 3, w: () => 1.5, run: () => (awe(4), '几何学家测量了我留下的脚印，结论是：我的面积是负数。') },
    { id: 'jail', era: 3, once: 1, w: () => 2, run: () => (awe(8), `一个${pick(FCOL)[1]}色正方形宣称存在「上方」，被判终身监禁。它说的是对的。`) },
    { id: 'angles', era: 3, w: () => 1, run: () => (boost(1.8, 90), '它们证明了三角形内角和是 180 度，然后花了一整代人怀疑这件事。（感知 ×1.8，90 秒）') },
    { id: 'many', era: 3, once: 1, w: () => n('split') ? 3 : .5, run: () => (awe(6), '它们终于发现我不止一个：同一种橙色，同时出现在两座城里。') },
    { id: 'lens', era: 3, w: () => 1, run: () => chart(12) && '它们磨出第一块透镜，看见了很远的地方。远处原来不是空白，只是还没人看。' },
    { id: 'letter', era: 4, w: () => 2, run: () => (awe(3), SAID.length ? `它们在地上写了很大的字给我看：「${pick(SAID)}」——是我听过的话。` : '它们在地上写了很大的字给我看：「你好，厚的。」') },
    { id: 'ascend', era: 4, once: 1, w: () => S.awe >= 400 ? 50 : 0, run: () => '第一个居民离开了纸面一点点。它回来说：上面很冷，但能看见所有人。（感知永久 ×2）' },
  ];
  const log = text => H.events.push({ y: S.y, text, fx });

  log('元年。纸面上有了第一批会动的形状。它们还不知道自己是平的。');
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
    if (!quiet && seen() && matchMedia('(max-width:640px)').matches) say(`〔二维历 ${e.y + 1} 年〕${e.text}`, { bubble: true });
  }
}

function annals() {
  if (seen() && yearNow() >= HIST.end && !G.seen.histDone) { G.seen.histDone = 1; say('它们的历史写完了。可以把整张纸收起来看看了。', { bubble: true }); mapReady(); }
  $('chron').hidden = !seen();
  if (!seen()) return;
  const y = yearNow(), done = y >= HIST.end;
  $('civ').textContent = `纪元 ${ERAS[HIST.era[y]]} · 二维历 ${y + 1} 年${done ? '（写完了）' : ''}\n`
    + `人口 ${fmt(HIST.pop[y])} · 城 ${live.town} · 庙 ${live.temple}\n觉察 ${fmt(HIST.awe[y])}${buff() > 1 ? ` · 加成 ×${buff().toFixed(1)}` : ''}`;
  const row = (e, cls) => {
    const p = document.createElement('p'), b = document.createElement('b');
    b.textContent = `${e.y + 1} 年 `;
    p.className = cls;
    p.append(b, e.text);
    return p;
  };
  const now = document.createElement('p');
  now.className = 'now';
  now.textContent = done ? '— 它们的历史到这里为止 —' : `— 现在 · 二维历 ${y + 1} 年 —`;
  // 四维的视角：还没发生的也看得见，只是淡一点；从远的将来往下读到过去
  $('annals').replaceChildren(
    ...HIST.events.slice(cursor, cursor + 3).reverse().map(e => row(e, 'soon')),
    now,
    ...HIST.events.slice(0, cursor).reverse().map((e, i) => row(e, i ? '' : 'new')));   // 过去的全在，往下滚
}

function seeHistory() {
  annals();
  say(HIST.asc != null
    ? `我看见了它们的全部历史：从元年，到它们离开纸面的二维历 ${HIST.asc + 1} 年。现在是 ${yearNow() + 1} 年。`
    : `我看见了它们的全部历史，一直到二维历 ${HIST.end + 1} 年。现在是 ${yearNow() + 1} 年。`);
}
