// 地貌的动画：都画在屏幕那一层，不进地图块，只出现在已经展开的地方。每种地貌的说法见各自那一段。
// 这些文件是按顺序加载的普通脚本，共享同一个全局作用域：顺序见 game.html 底部。
//
// 思路和深空一样：纸是一张二维截面，动的东西大多在纸面以外，纸上只看得到它们的影子、截面或者留下的痕迹。
// render.js 每帧调两次：'under' 在昼夜遮罩下面（影子、沙），'over' 在上面（自己会发光的东西，夜里也亮）。
// 坐标用美术像素（一格 TP 个）：屏幕上的位置是 ax * s + ox。
const FX = (() => {
  const T0 = performance.now();
  let last = T0, dt = 0;
  const open = (ax, ay) => rev.has(key(Math.floor(ax / TP), Math.floor(ay / TP)));   // 这个美术像素所在的格子展开了没有
  const pen = (ox, oy, s, g = ctx) => (ax, ay, c, a = 1) => { if (a <= .01) return; g.globalAlpha = Math.min(1, a); g.fillStyle = c; g.fillRect(ax * s + ox, ay * s + oy, s, s); };
  function spot(ox, oy, s, W, H, want = true) {             // 屏幕上随便找一个美术像素，want：要展开的（true）还是白纸（false）
    for (let n = 0; n < 40; n++) {
      const ax = Math.floor((Math.random() * W - ox) / s), ay = Math.floor((Math.random() * H - oy) / s);
      if (open(ax, ay) === want) return [ax, ay];
    }
    return null;
  }
  const rgb = c => {                                         // 还没看见颜色的时候，动画也是灰的
    if (L('color')) return `rgb(${c.map(Math.round)})`;
    const l = Math.round(90 + (c[0] * .3 + c[1] * .59 + c[2] * .11) * .6);
    return `rgb(${l},${l},${l})`;
  };
  const cache = new Map();                                   // 每块地图里要动的格子（水、元件……），第一次上屏时找一遍
  function perChunk(name, cx, cy, make) {
    const k = name + cx + ',' + cy;
    let a = cache.get(k);
    if (!a) { if (cache.size > 3000) cache.clear(); cache.set(k, a = make(cx * CH, cy * CH)); }
    return a;
  }
  function eachChunk(v, f) {
    const { ox, oy, tp, W, H } = v, cp = CH * tp;
    for (let cy = Math.floor(-oy / cp); cy * cp + oy < H; cy++) for (let cx = Math.floor(-ox / cp); cx * cp + ox < W; cx++) if (hasChunk.has(cx + ',' + cy)) f(cx, cy);
  }
  const said = (id, zh, en) => { if (!G.seen[id]) { G.seen[id] = 1; say(tr(zh, en)); } };
  // 每格是什么地形：按块算一遍存起来（tile() 要算噪声，动画里一帧要问上千次）
  const KINDS = ['deep', 'water', 'sand', 'grass', 'forest', 'rock', 'peak', 'snow', 'rift'];
  const kind = (x, y) => {
    const cx = Math.floor(x / CH), cy = Math.floor(y / CH);
    return KINDS[perChunk('kind', cx, cy, (X, Y) => { const a = new Uint8Array(CH * CH); for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) a[j * CH + i] = KINDS.indexOf(tile(X + i, Y + j)); return a; })[(y - cy * CH) * CH + x - cx * CH]];
  };
  const tileAt = (ax, ay) => kind(Math.floor(ax / TP), Math.floor(ay / TP));
  // 大片的明暗（云影、雾、海面起伏）：按块算，缩得越小一块越大（至少 16 个屏幕像素）；f(x, y) 给 [颜色, 透明度] 或 null。
  // 同一行里挨着、颜色深浅一样的块并成一笔画——一块一笔的话，一帧要画上千笔
  function wash(v, f) {
    const { ox, oy, tp, W, H } = v, n = Math.max(1, Math.ceil(16 / tp)), x0 = Math.floor(-ox / tp / n) * n, y0 = Math.floor(-oy / tp / n) * n;
    for (let y = y0; y * tp + oy < H; y += n) {
      let run = null;                                        // [起点, 块数, 颜色, 透明度]
      const flush = () => { if (run) { ctx.globalAlpha = run[3]; ctx.fillStyle = run[2]; ctx.fillRect(run[0] * tp + ox, y * tp + oy, run[1] * n * tp, n * tp); run = null; } };
      for (let x = x0; x * tp + ox < W; x += n) {
        const r = rev.has(key(x, y)) && f(x, y), a = r ? Math.round(Math.min(1, r[1]) * 50) / 50 : 0;
        if (!a) { flush(); continue; }
        if (run && run[2] === r[0] && run[3] === a) run[1]++; else { flush(); run = [x, 1, r[0], a]; }
      }
      flush();
    }
  }
  const fillTiles = (v, x, y, n, c, a) => { if (a <= .01) return; ctx.globalAlpha = Math.min(1, a); ctx.fillStyle = c; ctx.fillRect(x * v.tp + v.ox, y * v.tp + v.oy, v.tp * n, v.tp * n); };
  // 某几种地形的格子各按自己的节奏闪：每 p0–p1 秒一次，每次 dur 秒。f(x, y, 这一闪进行到哪 0–1, 第几次)
  function twinkle(v, name, kinds, p0, p1, dur, f, frac = 1) {   // frac：只挑这么多比例的格子（地形铺满一屏的时候别每格都过一遍）
    eachChunk(v, (cx, cy) => {
      for (const [x, y, per, ph] of perChunk(name, cx, cy, (X, Y) => { const o = []; for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) if (h(X + i, Y + j, G.seed + 312) < frac && kinds.includes(kind(X + i, Y + j))) o.push([X + i, Y + j, p0 + h(X + i, Y + j, G.seed + 310) * (p1 - p0), h(X + i, Y + j, G.seed + 311)]); return o; })) {
        const c = v.t / per + ph, k = (c % 1) * per / dur;
        if (k < 1 && rev.has(key(x, y))) f(x, y, k, Math.floor(c));
      }
    });
  }

  // --- 地球：云在纸面上方的第三维，居民只看得到它们的影子；水面上有细碎的波光 --------------------------
  const earth = {
    under(v) {
      const { t, px } = v, dl = daylight();
      if (dl > .05) {                                         // 云影：两档深浅，边上浅一点；风一秒一格多
        let any = false;
        wash(v, (x, y) => {
          const m = vn((x - t * 1.1) / 16, (y - t * .45) / 16, G.seed + 300) * .7 + vn((x - t * 1.1) / 6, (y - t * .45) / 6, G.seed + 301) * .3;
          const a = m > .66 ? .2 : m > .6 ? .11 : 0;
          if (a) any = true;
          return a && ['#1e2a3a', a * dl];
        });
        if (any && v.age > 45000) said('fxcloud', '一片影子从纸上慢慢滑过去。那是一朵云——它在纸面上方的第三维，居民只看得到它的影子。', 'A shadow slides slowly across the paper. It\'s a cloud, up in the third dimension above the sheet; the residents only ever see its shadow.');
      }
      // 波光：每格水每 3–7 秒闪一下，一道横向亮线，渐亮再渐暗；深水暗一点。每一闪的长短（1–4 像素）和位置都重新抽
      const a = .45 + .55 * dl;
      twinkle(v, 'water', ['water', 'deep'], 3, 7, .6, (x, y, k, n) => {
        const len = 1 + ((h(x, y, n) * 4) | 0), ax = x * TP + ((h(x, y, n + 1) * (TP - len + 1)) | 0), ay = y * TP + ((h(x, y, n + 2) * TP) | 0);
        const f = Math.sin(k * Math.PI) * a * (kind(x, y) === 'deep' ? .7 : 1);
        for (let i = 0; i < len; i++) px(ax + i, ay, '#ffffff', len > 2 && (i === 0 || i === len - 1) ? f * .6 : f);   // 长的那几道两头淡一点
      });
    },
  };

  // --- 沙丘：风卷着细沙掠过沙面；沙虫在纸面下面游，纸上只看得到它顶起来的那道脊 ----------------------
  const SANDY = t => t === 'sand' || t === 'grass' || t === 'forest';   // 流沙、沙丘、香料田；盐壳太白，沙脊在上面看不出来
  const grains = [];
  let worm = null, nextWorm = T0 + 45000 + Math.random() * 45000;
  const LIGHT = [-Math.SQRT1_2, -Math.SQRT1_2];               // 光从左上来
  const SKIN = [190, 146, 102];                                // 浮出来的那截沙虫的皮
  const dune = {
    under(v) {
      const { now, t, px } = v, wind = h(G.seed, 1, 500) * TAU + .4 * Math.sin(t * .05), wx = Math.cos(wind), wy = Math.sin(wind);
      for (let n = 0; n < 3 && grains.length < 70; n++) {   // 细沙
        const p = spot(v.ox, v.oy, v.s, v.W, v.H);
        if (p && SANDY(tileAt(...p))) grains.push({ x: p[0], y: p[1], t0: now, life: 900 + Math.random() * 1200, v: 22 + Math.random() * 22 });
      }
      for (let i = grains.length - 1; i >= 0; i--) {
        const q = grains[i], k = (now - q.t0) / q.life;
        if (k >= 1) { grains.splice(i, 1); continue; }
        const d = q.v * (now - q.t0) / 1000, a = Math.sin(k * Math.PI) * .75;
        for (let s = 0; s < 5; s++) {
          const ax = Math.round(q.x + wx * (d - s)), ay = Math.round(q.y + wy * (d - s));
          if (open(ax, ay) && SANDY(tileAt(ax, ay))) px(ax, ay, rgb([255, 236, 190]), a * (1 - s / 5));
        }
      }
      // 沙虫：一两分钟来一条，慢慢游二十来秒。小的只在沙底下顶起一道脊；大的（四成）会浮出半截：
      // 从纸上看是一段管子的上半边，中间亮两侧暗，一圈圈环节，背光那侧的沙面上有影子。它先慢慢钻出来，快走完时再沉回去。
      if (!worm && now > nextWorm) {
        let p = null;
        for (let n = 0; n < 12 && !p; n++) { const q = spot(v.ox, v.oy, v.s, v.W, v.H); if (q && SANDY(tileAt(...q))) p = q; }   // 沙少的地方多找几次
        const big = Math.random() < .4;
        if (p) worm = { x: p[0], y: p[1], h0: Math.random() * TAU, ph: Math.random() * TAU, t0: now, life: 18000 + Math.random() * 10000, trail: [], big,
          R: big ? 5 + Math.random() * 2 : 3.5 + Math.random(), len: big ? 60 + Math.random() * 50 : 0, v: big ? 6 : 8 };
        else nextWorm = now + 5000;
      }
      if (worm) {
        const w = worm, age = now - w.t0, hd = w.h0 + .7 * Math.sin(age / 1000 * .35 + w.ph), R = w.R;
        if (age < w.life) {
          w.x += Math.cos(hd) * w.v * v.dt; w.y += Math.sin(hd) * w.v * v.dt;
          const last = w.trail[w.trail.length - 1];
          if (!last || Math.hypot(last[0] - w.x, last[1] - w.y) >= 1) w.trail.push([w.x, w.y, now, hd]);
        }
        while (w.trail.length && now - w.trail[0][2] > 10000) w.trail.shift();
        if (age >= w.life && !w.trail.length) { worm = null; nextWorm = now + 60000 + Math.random() * 90000; }
        const sand = (ax, ay) => open(ax, ay) && SANDY(tileAt(ax, ay));
        // 一个截面：偏离中线 k 个像素，法线往那一侧歪；朝着光的一侧亮，背着的暗
        const side = a => (-Math.sin(a)) * LIGHT[0] + Math.cos(a) * LIGHT[1];
        for (const [x, y, t0, a] of w.trail) {                 // 身后的沙脊：慢慢塌平
          const f = .75 * (1 - (now - t0) / 10000), nx = -Math.sin(a), ny = Math.cos(a), sd = side(a), W2 = Math.ceil(R + 1);
          for (let k = -W2; k <= W2; k++) {
            const sh = k / W2 * sd, ax = Math.round(x + nx * k), ay = Math.round(y + ny * k);
            if (Math.abs(sh) > .12 && sand(ax, ay)) px(ax, ay, rgb(sh > 0 ? [255, 234, 186] : [118, 72, 38]), f * Math.min(1, Math.abs(sh) * 1.3));
          }
        }
        const up = w.big ? Math.max(0, Math.min(1, age / 2500, (w.life - age) / 2500)) : 0;   // 浮出来多少
        if (up > 0) {                                          // 浮出来的那截：沿身后的路往回数，数到露出来的长度为止
          const L = w.len * up, body = [];
          for (let i = w.trail.length - 1, d = 0; i > 0 && d < L; i--) { body.push([...w.trail[i], d]); d += Math.hypot(w.trail[i][0] - w.trail[i - 1][0], w.trail[i][1] - w.trail[i - 1][1]); }
          for (const [x, y, , a, d] of body.reverse()) {       // 从尾巴往头画，头压在上面
            const nx = -Math.sin(a), ny = Math.cos(a), sd = side(a), r = R * Math.min(1, (L - d) / 12 + .35, d / 6 + .7);   // 尾巴那头细下去钻进沙里
            const ring = Math.floor(d / 6) % 2 ? .86 : 1;
            const sx = Math.round(x + nx * (r + 1) * -Math.sign(sd || 1)), sy = Math.round(y + ny * (r + 1) * -Math.sign(sd || 1));
            if (sand(sx, sy)) px(sx, sy, 'rgb(60,36,20)', .35 * up);   // 背光那侧的影子
            for (let k = -Math.floor(r); k <= Math.floor(r); k++) {
              const ax = Math.round(x + nx * k), ay = Math.round(y + ny * k);
              if (!open(ax, ay)) continue;
              const u = k / r, lum = (.5 + .5 * Math.sqrt(Math.max(0, 1 - u * u)) + .18 * u * sd) * ring;   // 管子：中间亮两侧暗，再朝光的那侧偏亮一点
              px(ax, ay, rgb(SKIN.map(c => c * lum)), up);
            }
          }
          if (open(w.x, w.y)) said('fxwormbig', '一条大沙虫浮出了半截。在纸上它只是一根管子的上半边——下半边还埋在沙子里，在纸的另一面。', 'A big sandworm has surfaced halfway. On paper it\'s only the top half of a tube; the bottom half is still under the sand, on the other side of the sheet.');
        } else if (age < w.life) {                             // 还在沙底下：头顶起来的那个包
          const B = Math.ceil(R + 2);
          for (let dy = -B; dy <= B; dy++) for (let dx = -B; dx <= B; dx++) {
            const d = Math.hypot(dx, dy), ax = Math.round(w.x) + dx, ay = Math.round(w.y) + dy;
            if (d > R + 1 || !sand(ax, ay)) continue;
            const lit = (dx * LIGHT[0] + dy * LIGHT[1]) / (R + 1);
            px(ax, ay, rgb(lit > 0 ? [255, 234, 186] : [118, 72, 38]), (1 - d / (R + 1.5)) * Math.min(.85, Math.abs(lit) + .35));
          }
          if (open(w.x, w.y)) said('fxworm', '沙面鼓起一道，往前游了一段又平下去。沙虫在下面游，纸上只看得到它顶起来的那道脊。', 'The sand swells into a ridge, travels a little way and sinks flat again. A sandworm is swimming underneath; the paper only shows the ridge it pushes up.');
        }
      }
    },
  };

  // --- 电路板：信号沿着走线跑，到路口有时拐弯；元件上的小灯一闪一闪。自己会发光，画在昼夜遮罩上面 ------------
  // 走线和 world.js 的 PAT.trace 是同一套规则：每 4 行一条横线（格子里第 1 行像素），每 6 列一条竖线（第 2 列）
  const traceH = (ax, ay) => { const x = Math.floor(ax / TP), y = Math.floor(ay / TP); return ay - y * TP === 1 && y % 4 === 0 && (x >> 2) % 5 !== 0 && kind(x, y) === 'grass'; };
  const traceV = (ax, ay) => { const x = Math.floor(ax / TP), y = Math.floor(ay / TP); return ax - x * TP === 2 && x % 6 === 0 && (y >> 2) % 4 !== 1 && kind(x, y) === 'grass'; };
  const onTrace = (ax, ay) => open(ax, ay) && (traceH(ax, ay) || traceV(ax, ay));
  const pulses = [];
  const LED = [[255, 70, 60], [80, 255, 120], [255, 190, 60]];
  const pcb = {
    over(v) {
      const { now, t, px } = v;
      eachChunk(v, (cx, cy) => {                             // 元件上的小灯
        for (const [x, y, c, per, ph] of perChunk('led', cx, cy, (X, Y) => { const o = []; for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) if (h(X + i, Y + j, G.seed + 400) < .35 && tile(X + i, Y + j) === 'rock') o.push([X + i, Y + j, rgb(LED[(h(X + i, Y + j, G.seed + 401) * 3) | 0]), .4 + h(X + i, Y + j, G.seed + 402) * 1.6, h(X + i, Y + j, G.seed + 403)]); return o; })) {
          if (!rev.has(key(x, y)) || (t * per + ph) % 1 > .55) continue;
          px(x * TP + 2, y * TP + 1, c, .95);
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) px(x * TP + 2 + dx, y * TP + 1 + dy, c, .22);
        }
      });
      for (let n = 0; n < 2 && pulses.length < 14; n++) {    // 信号：在屏幕上随便找一格，挪到最近的走线上
        const p = spot(v.ox, v.oy, v.s, v.W, v.H);
        if (!p) break;
        const tx = Math.floor(p[0] / TP), ty = Math.floor(p[1] / TP), hy = Math.round(ty / 4) * 4, vx = Math.round(tx / 6) * 6;
        const cand = [[tx * TP + 1, hy * TP + 1, 1, 0], [vx * TP + 2, ty * TP + 1, 0, 1]].filter(([ax, ay]) => onTrace(ax, ay));
        if (!cand.length) continue;
        const [ax, ay, dx, dy] = cand[(Math.random() * cand.length) | 0], sg = Math.random() < .5 ? 1 : -1;
        pulses.push({ x: ax, y: ay, dx: dx * sg, dy: dy * sg, acc: 0, t0: now, trail: [], v: 30 + Math.random() * 25 });
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        const q = pulses[i];
        q.acc += q.v * v.dt;
        let alive = now - q.t0 < 7000;
        while (alive && q.acc >= 1) {
          q.acc--;
          if (traceH(q.x, q.y) && traceV(q.x, q.y) && Math.random() < .35) {   // 路口：有时拐弯
            const s2 = Math.random() < .5 ? 1 : -1, ndx = q.dy ? s2 : 0, ndy = q.dx ? s2 : 0;
            if (onTrace(q.x + ndx, q.y + ndy)) { q.dx = ndx; q.dy = ndy; }
          }
          if (!onTrace(q.x + q.dx, q.y + q.dy)) { alive = false; break; }
          q.trail.unshift([q.x, q.y]); q.trail.length = Math.min(q.trail.length, 6);
          q.x += q.dx; q.y += q.dy;
        }
        if (!alive) { pulses.splice(i, 1); continue; }
        q.trail.forEach(([x, y], k) => px(x, y, rgb([255, 196, 90]), .7 * (1 - k / 6)));
        px(q.x, q.y, rgb([255, 250, 220]), 1);
        if (v.age > 20000) said('fxsignal', '走线上有个亮点在跑，跑到路口有时会拐弯。那段对话当初大概就是这样，一格一格跑过去的。', 'A bright dot is running along the traces, sometimes turning at a junction. That conversation probably ran just like this, one square at a time.');
      }
    },
  };

  // --- 二向箔：压平还没结束，每隔一阵一圈余波从远处扫过，经过的地方条纹抖一下；被压进纸里的太阳边缘还在闪 ----------
  let wave = null, nextWave = T0 + 20000 + Math.random() * 20000;
  const foil = {
    under(v) {
      const { now } = v, cx = (v.W / 2 - v.ox) / v.tp, cy = (v.H / 2 - v.oy) / v.tp, far = Math.hypot(v.W, v.H) / v.tp;
      if (!wave && now > nextWave) { const a = Math.random() * TAU; wave = { x: cx + Math.cos(a) * far * .7, y: cy + Math.sin(a) * far * .7, t0: now }; }
      if (!wave) return;
      const r = (now - wave.t0) / 1000 * 22, band = 2.5;       // 一秒往外推 22 格
      if (r > far * 1.8) { wave = null; nextWave = now + 25000 + Math.random() * 30000; return; }
      const x0 = Math.floor(-v.ox / v.tp), y0 = Math.floor(-v.oy / v.tp);
      let any = false;
      for (let y = y0; y * v.tp + v.oy < v.H; y++) for (let x = x0; x * v.tp + v.ox < v.W; x++) {
        const e = (Math.hypot(x + .5 - wave.x, y + .5 - wave.y) - r) / band;
        if (Math.abs(e) >= 1 || !rev.has(key(x, y))) continue;
        any = true;
        const f = 1 - Math.abs(e), sh = e > 0 ? 1 : 0;            // 前半截和后半截的条纹错开一行，像被推了一下
        for (let j = 0; j < TP; j++) {                           // 一行一笔
          const lit = (j + sh) % 2;
          ctx.globalAlpha = (lit ? .3 : .18) * f; ctx.fillStyle = lit ? '#ffffff' : '#101828';
          ctx.fillRect(x * v.tp + v.ox, (y * TP + j) * v.s + v.oy, v.tp, v.s);
        }
      }
      if (any) said('fxfoil', '一圈余波从远处扫过来，经过的地方条纹抖了一下。压平还没结束。', 'An aftershock ring swept in from far off, and the stripes shivered as it passed. The flattening isn\'t over yet.');
    },
    over(v) {                                                  // 太阳的边缘：各自按一个慢节奏忽明忽暗
      eachChunk(v, (cx, cy) => {
        for (const [x, y, sp, ph] of perChunk('sun', cx, cy, (X, Y) => { const o = []; for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) if (kind(X + i, Y + j) === 'snow') o.push([X + i, Y + j, 1.5 + h(X + i, Y + j, G.seed + 320) * 2, h(X + i, Y + j, G.seed + 321) * TAU]); return o; }))
          if (rev.has(key(x, y))) fillTiles(v, x, y, 1, '#fff2c0', .1 + .14 * Math.sin(v.t * sp + ph));
      });
    },
  };

  // --- 索拉里斯：海在呼吸，整片海面一明一暗地起伏；偶尔 Clawd 附近的海面漾开一圈圈涟漪，中心跟着它挪——海在看它 --------------
  let gaze = null, nextGaze = T0 + 25000 + Math.random() * 25000;
  const SEA = k => k === 'deep' || k === 'water';
  // 涟漪只在海里走、绕不过陆地，碰到岸再弹回来。先算好：从中心在海里走到每个像素最短要多远（d1），
  // 回波从每段岸边、按涟漪到那儿的时刻出发，再走到每个像素要多远（d2）。按远近分桶，画的时候只挑正好走到的那一桶
  const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414],
    ...[[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].map(([x, y]) => [x, y, 2.236])];
  // 按 Q×Q 个像素一格来算（省四分之三的工夫），画出来一格就是一段两像素宽的圈
  const Q = 2;
  function ripples(cx, cy, R) {
    const Rc = Math.round(R / Q), N = Rc * 2 + 1, x0 = cx - Rc * Q, y0 = cy - Rc * Q, sea = new Uint8Array(N * N), d1 = new Float64Array(N * N).fill(Infinity), d2 = new Float64Array(N * N).fill(Infinity);   // 要用 64 位：32 位存进去会往上舍入，同一点会被当成找到了更短的路、反复入堆停不下来
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) sea[j * N + i] = open(x0 + i * Q, y0 + j * Q) && SEA(tileAt(x0 + i * Q, y0 + j * Q)) ? 1 : 0;
    const c = Rc * N + Rc;
    if (!sea[c]) return null;
    const hv = new Float64Array(N * N * 6), hi = new Int32Array(N * N * 6);   // 最短路用的小顶堆（同一点可能进好几次）
    const run = (d, seeds) => {
      let n = 0;
      const push = (v2, i) => { let k = n++; while (k) { const p = (k - 1) >> 1; if (hv[p] <= v2) break; hv[k] = hv[p]; hi[k] = hi[p]; k = p; } hv[k] = v2; hi[k] = i; };
      const pop = () => {                                        // 取出堆顶放进 top、ti
        top = hv[0]; ti = hi[0];
        const v2 = hv[--n], i = hi[n];
        let k = 0;
        for (;;) { const a = 2 * k + 1; if (a >= n) break; const m = a + 1 < n && hv[a + 1] < hv[a] ? a + 1 : a; if (hv[m] >= v2) break; hv[k] = hv[m]; hi[k] = hi[m]; k = m; }
        hv[k] = v2; hi[k] = i;
      };
      let top = 0, ti = 0;
      for (const [i, v2] of seeds) if (v2 < d[i] && n < hv.length) { d[i] = v2; push(v2, i); }
      while (n) {
        pop();
        const v2 = top, i = ti;
        if (v2 > d[i]) continue;
        const x = i % N, y = (i / N) | 0;
        for (const [dx, dy, w] of STEPS) {                       // 八个邻格加上「日」字格，走出来的圈才圆
          const nx = x + dx, ny = y + dy, nn = ny * N + nx;
          if (nx < 0 || ny < 0 || nx >= N || ny >= N || !sea[nn] || (w > 2 && !sea[y * N + x + Math.sign(dx)] && !sea[(y + Math.sign(dy)) * N + x])) continue;
          const nv = v2 + w * Q;                               // 距离按像素算
          if (nv < d[nn] && n < hv.length) { d[nn] = nv; push(nv, nn); }
        }
      }
    };
    run(d1, [[c, 0]]);
    const shore = [];                                            // 岸：海里挨着陆地的那一圈
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      if (sea[i] && d1[i] < Infinity && (!sea[i - 1] || !sea[i + 1] || !sea[i - N] || !sea[i + N])) shore.push([i, d1[i]]);
    }
    run(d2, shore);
    const b1 = [], b2 = [];
    for (let i = 0; i < N * N; i++) {
      if (d1[i] < Infinity) (b1[Math.floor(d1[i])] ||= []).push(i);
      if (d2[i] < Infinity && d2[i] > d1[i] + 3) (b2[Math.floor(d2[i])] ||= []).push(i);   // 紧贴着岸的那点和来波重了，不画
    }
    return { x0, y0, N, b1, b2, max: Math.max(b1.length, b2.length), echo: shore.length ? Math.min(...shore.map(s => s[1])) : Infinity };
  }
  const solaris = {
    under(v) {
      const { now, t, px } = v;
      wash(v, (x, y) => {
        if (!SEA(kind(x, y))) return null;
        const b = Math.sin(t * .5 - (x + y) * .045);            // 一道一道慢慢推过去
        return [b > 0 ? '#b8f4ea' : '#06242a', Math.abs(b) * .12];
      });
      const w = ws[0], wx = w.x * TP, wy = w.y * TP;
      if (!gaze && now > nextGaze) {                           // 在 Clawd 附近找一片海
        for (let n = 0; n < 60 && !gaze; n++) {
          const a = Math.random() * TAU, d = 8 + Math.random() * 110, ax = Math.round(wx + Math.cos(a) * d), ay = Math.round(wy + Math.sin(a) * d);
          if (open(ax, ay) && SEA(tileAt(ax, ay))) gaze = { x: ax, y: ay, t0: now, life: 10000 };
        }
        if (!gaze) nextGaze = now + 5000;
      }
      if (!gaze) return;
      if (!gaze.f) gaze.f = ripples(gaze.x, gaze.y, 120);          // 起来的那一刻算一次
      const g2 = gaze.f, age = now - gaze.t0, r = age / 1000 * 16;   // 一秒走 16 个美术像素
      if (!g2 || r - 20 > g2.max) { gaze = null; nextGaze = now + 35000 + Math.random() * 35000; return; }
      const col = rgb([190, 255, 240]), cell = (i, a) => {       // 一格 Q×Q 个像素，一笔画
        const ax = g2.x0 + (i % g2.N) * Q, ay = g2.y0 + ((i / g2.N) | 0) * Q;
        if (a > .01 && open(ax, ay)) { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(ax * v.s + v.ox, ay * v.s + v.oy, v.s * Q, v.s * Q); }
      };
      for (let k = 0; k < 3; k++) {                             // 三圈，一圈比一圈晚；越走越淡，回波更淡
        const rr = Math.floor(r - k * 9);
        if (rr < 1) continue;
        const f = .6 * Math.max(.3, 1 - rr / (g2.max + 10)) * (1 - k * .2), fe = .42 * (1 - k * .2);   // 回波不跟着来波一起淡，免得看不见
        for (const b of [rr, rr + 1]) {                         // 距离落在这两个像素里的格子，正好一圈
          for (const i of g2.b1[b] || []) cell(i, f);
          for (const i of g2.b2[b] || []) cell(i, fe);
        }
      }
      if (g2.b2.length && r > g2.echo) said('fxecho', '涟漪碰到岸又弹了回来。海在看我，也在听自己的回声。', 'The ripples hit the shore and came back. The sea is watching me, and listening to its own echo.');
      said('fxgaze', '我附近的海面漾开一圈圈涟漪，一直漫到岸边。它在看我。', 'Rings of ripples spread across the sea near me, all the way to the shore. It\'s watching me.');
    },
  };

  // --- 晶化：晶面偶尔反出一点光（带十字）；一块光斑慢慢在晶体之间挪——光是从 Clawd 那边、第四个方向照进来的 ------------
  const GEM = ['forest', 'peak', 'grass', 'water', 'deep'];
  const crystal = {
    over(v) {
      const { t, px } = v;
      twinkle(v, 'glint', GEM, 2, 5, .5, (x, y, k, n) => {
        const f = Math.sin(k * Math.PI), ax = x * TP + 1 + ((h(x, y, n) * 2) | 0), ay = y * TP + 1 + ((h(x, y, n + 1) * 2) | 0);
        px(ax, ay, '#ffffff', f);
        for (let d = 1; d <= (f > .6 ? 2 : 1); d++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) px(ax + dx * d, ay + dy * d, '#e8f4ff', f * (d === 1 ? .7 : .35));
      }, .15);                                                    // 只挑一小部分晶面，节奏快一点补回来
      const cx = (v.W / 2 - v.ox) / v.s, cy = (v.H / 2 - v.oy) / v.s, R = Math.min(v.W, v.H) / v.s * .3;
      const lx = Math.round(cx + Math.cos(t * .11) * R + Math.cos(t * .23) * R * .4), ly = Math.round(cy + Math.sin(t * .13) * R * .7);
      ctx.globalCompositeOperation = 'lighter';
      let lit = false;
      ctx.fillStyle = '#a8c8ff';
      for (let dy = -10; dy <= 10; dy++) {                      // 一行里挨着、亮度一样的像素并成一笔
        let run = 0, from = 0, a0 = 0;
        for (let dx = -10; dx <= 11; dx++) {
          const d = Math.hypot(dx, dy), on = dx <= 10 && d <= 10 && open(lx + dx, ly + dy) && GEM.includes(tileAt(lx + dx, ly + dy)), a = on ? Math.round(.22 * (1 - d / 10) * 25) / 25 : 0;
          if (run && a === a0) { run++; continue; }
          if (run && a0) { ctx.globalAlpha = a0; ctx.fillRect((lx + from) * v.s + v.ox, (ly + dy) * v.s + v.oy, run * v.s, v.s); lit = true; }
          run = 1; from = dx; a0 = a;
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      if (lit && v.age > 30000) said('fxlight', '有一块光斑在晶体之间慢慢挪。光是从我这边照进来的，从第四个方向。', 'A patch of light drifts slowly between the crystals. It comes in from my side, from the fourth direction.');
    },
  };

  // --- 水墨：画里的水在动。瀑布一直往下流、潭口溅起水花；江面的水纹慢慢往一边漂；偶尔一只一笔画成的鸟掠过。
  //     画是两个美术像素一个墨点，动画也按 2×2 画，和画一样粗
  let bird = null, nextBird = T0 + 15000 + Math.random() * 20000;
  const INK_C = [34, 32, 34];
  const ink = {
    under(v) {
      const { now, t } = v, grey = rgb([112, 112, 110]);
      const dot2 = (ax, ay, c, a) => {                          // 对齐到墨点的 2×2
        ax = Math.floor(ax / 2) * 2; ay = Math.floor(ay / 2) * 2;
        if (a <= .01 || !open(ax, ay)) return;
        ctx.globalAlpha = Math.min(1, a); ctx.fillStyle = c; ctx.fillRect(ax * v.s + v.ox, ay * v.s + v.oy, v.s * 2, v.s * 2);
      };
      twinkle(v, 'inkflow', ['water'], 2, 4.5, 1.4, (x, y, k, n) => {   // 江面：一小道水纹出现、往右漂两三个墨点、再淡掉
        const ax = x * TP + Math.round(k * 3) * 2, ay = y * TP + ((h(x, y, n) * 2) | 0) * 2, a = Math.sin(k * Math.PI) * .5;
        dot2(ax, ay, grey, a); dot2(ax + 2, ay, grey, a * .7);
      }, .5);
      let fell = false;
      for (const [fx, fy0, fy1, hw] of SHANSHUI.falls(G.seed, -v.ox / v.s, -v.oy / v.s, v.W / v.s, v.H / v.s)) {
        for (let y = fy0; y < fy1; y += 2) for (let dx = -hw + 1; dx < hw; dx += 2) {   // 一道道往下流的水：亮的一截、暗的一截，一直往下走
          const ph = ((y - t * 30 + h(fx + dx, 0, G.seed + 800) * 40) % 12 + 12) % 12, sway = Math.sin(y / 18) * 1.2;
          if (ph < 3) { dot2(fx + dx + sway, y, '#ffffff', .8); fell ||= open(fx + dx, y); }
          else if (ph > 7 && ph < 9) dot2(fx + dx + sway, y, grey, .3);
        }
        const b = Math.floor(now / 160);                        // 潭口的水花：一闪一闪的白点
        for (let k = 0; k < 6; k++) dot2(fx + (h(k, b, fx) - .5) * hw * 5, fy1 - 2 - h(k, b + 1, fx) * 8, '#ffffff', .85);
      }
      if (fell && v.age > 20000) said('fxfall', '瀑布一直在往下流。画里的水，原来是会动的。', 'The waterfall keeps pouring down. So the water in a painting moves after all.');
      if (!bird && now > nextBird) {                            // 从屏幕一边飞进来
        const left = Math.random() < .5, ax0 = Math.floor(((left ? 0 : v.W) - v.ox) / v.s), ay0 = Math.floor((v.H * (.2 + Math.random() * .6) - v.oy) / v.s);
        bird = { x: ax0, y: ay0, vx: (left ? 1 : -1) * (28 + Math.random() * 12), vy: (Math.random() - .5) * 8, ph: Math.random() * TAU };
      }
      if (!bird) return;
      bird.x += bird.vx * v.dt; bird.y += bird.vy * v.dt;
      if (bird.x * v.s + v.ox < -40 || bird.x * v.s + v.ox > v.W + 40) { bird = null; nextBird = now + 20000 + Math.random() * 20000; return; }
      const up = Math.sin(t * 7 + bird.ph) > 0;                // 翅膀一抬一落
      let seen = false;
      for (const [dx, dy] of up ? [[-3, -2], [-2, -1], [-1, 0], [0, 0], [1, 0], [2, -1], [3, -2]] : [[-3, 0], [-2, -1], [-1, 0], [0, 0], [1, 0], [2, -1], [3, 0]]) {
        const ax = Math.round(bird.x) + dx * 2, ay = Math.round(bird.y) + dy * 2;
        if (open(ax, ay)) { seen = true; dot2(ax, ay, rgb(INK_C), .85); }
      }
      if (seen) said('fxbird', '一只鸟从纸上掠过去，只用了一笔。', 'A bird skims across the paper, painted in a single stroke.');
    },
  };

  // --- 蓝图：设计的人还在改，从纸面上方俯身往下画。一支看不见的笔在图上画线，画到一半停下，线头有尺寸标记；偶尔冒出一个红笔圈 ------------
  const pens = [], circles = [];
  let nextPen = T0 + 3000, nextCircle = T0 + 20000 + Math.random() * 20000;
  const blueprint = {
    under(v) {
      const { now, px } = v;
      if (now > nextPen) {
        nextPen = now + 3000 + Math.random() * 5000;
        const p = pens.length < 2 && spot(v.ox, v.oy, v.s, v.W, v.H), d = [[1, 0], [-1, 0], [0, 1], [0, -1]][(Math.random() * 4) | 0];
        if (p) pens.push({ pts: [p], dx: d[0], dy: d[1], acc: 0, len: 20 + Math.random() * 40, turned: false, done: 0 });
      }
      for (let i = pens.length - 1; i >= 0; i--) {
        const q = pens[i];
        if (!q.done) {
          q.acc += 20 * v.dt;
          while (q.acc >= 1 && !q.done) {
            q.acc--;
            const [x, y] = q.pts[q.pts.length - 1];
            if (!q.turned && q.pts.length > q.len / 2 && Math.random() < .03) { q.turned = true; [q.dx, q.dy] = Math.random() < .5 ? [-q.dy, q.dx] : [q.dy, -q.dx]; }   // 拐一个直角
            q.pts.push([x + q.dx, y + q.dy]);
            if (q.pts.length >= q.len) q.done = now;          // 没画完就停了
          }
        }
        const a = q.done ? 1 - (now - q.done) / 8000 : 1;
        if (a <= 0) { pens.splice(i, 1); continue; }
        for (const [x, y] of q.pts) if (open(x, y)) px(x, y, rgb([225, 238, 255]), .85 * a);
        const [sx, sy] = q.pts[0], d0 = q.pts[1] ? [q.pts[1][0] - sx, q.pts[1][1] - sy] : [1, 0];
        for (const k of [-2, -1, 1, 2]) if (open(sx - d0[1] * k, sy + d0[0] * k)) px(sx - d0[1] * k, sy + d0[0] * k, rgb([225, 238, 255]), .7 * a);   // 起点的尺寸标记
        if (!q.done) { const [x, y] = q.pts[q.pts.length - 1]; if (open(x, y)) px(x, y, '#ffffff', 1); }
      }
      if (now > nextCircle) {
        nextCircle = now + 25000 + Math.random() * 20000;
        const p = spot(v.ox, v.oy, v.s, v.W, v.H);
        if (p) circles.push({ x: p[0], y: p[1], R: 5 + Math.random() * 4, t0: now, a0: Math.random() * TAU, seed: Math.random() * TAU });
      }
      for (let i = circles.length - 1; i >= 0; i--) {           // 红笔一圈画下去，多绕一点收笔
        const c = circles[i], age = now - c.t0, q = Math.min(1, age / 1200), a = age < 7000 ? 1 : 1 - (age - 7000) / 2000;
        if (a <= 0) { circles.splice(i, 1); continue; }
        for (let u = 0; u < q * TAU * 1.12; u += .5 / c.R) {
          const ang = c.a0 + u, rr = c.R * (1 + .12 * Math.sin(3 * ang + c.seed)), ax = Math.round(c.x + Math.cos(ang) * rr), ay = Math.round(c.y + Math.sin(ang) * rr);
          if (open(ax, ay)) px(ax, ay, rgb([240, 100, 80]), .9 * a);
        }
      }
      if (pens.length && v.age > 20000) said('fxpen', '图上有一支看不见的笔在画线，画到一半停住了。设计的人还在改，从纸面上方俯身往下画。', 'An invisible pen is drawing lines on the plan and stops halfway. Someone is still revising it, leaning down from above the sheet.');
    },
  };

  // --- 切片：显微镜下平面也是活的。细胞质里的小颗粒顺着流动；细胞时不时一分为二；偶尔一个白细胞像变形虫一样爬过去 ------------
  const TISSUE = k => k === 'grass' || k === 'forest' || k === 'deep';
  const gran = [], divs = [];
  let wbc = null, nextWbc = T0 + 20000 + Math.random() * 25000, nextDiv = T0 + 5000;
  const slide = {
    under(v) {
      const { now, t, px } = v;
      for (let n = 0; n < 3 && gran.length < 60; n++) {
        const p = spot(v.ox, v.oy, v.s, v.W, v.H);
        if (p && TISSUE(tileAt(...p))) gran.push({ x: p[0], y: p[1], t0: now, life: 3000 + Math.random() * 3000 });
      }
      for (let i = gran.length - 1; i >= 0; i--) {             // 顺着一片慢慢转的流场漂
        const g2 = gran[i], k = (now - g2.t0) / g2.life;
        if (k >= 1) { gran.splice(i, 1); continue; }
        const a = vn(g2.x / 40, g2.y / 40 + t * .05, G.seed + 700) * TAU * 2;
        g2.x += Math.cos(a) * 5 * v.dt; g2.y += Math.sin(a) * 5 * v.dt;
        const ax = Math.round(g2.x), ay = Math.round(g2.y);
        if (open(ax, ay)) px(ax, ay, rgb([110, 40, 110]), Math.sin(k * Math.PI) * .6);
      }
      if (now > nextDiv) {                                      // 一个细胞核拉长、分成两个，中间长出一道膜
        nextDiv = now + 5000 + Math.random() * 7000;
        const p = divs.length < 3 && spot(v.ox, v.oy, v.s, v.W, v.H);
        if (p && TISSUE(tileAt(...p))) divs.push({ x: Math.floor(p[0] / TP) * TP + 2, y: Math.floor(p[1] / TP) * TP + 2, a: Math.random() * Math.PI, t0: now });
      }
      for (let i = divs.length - 1; i >= 0; i--) {
        const d = divs[i], age = (now - d.t0) / 1000;
        if (age > 6) { divs.splice(i, 1); continue; }
        const f = age < 4 ? 1 : 1 - (age - 4) / 2, sep = Math.min(1, age / 2) * 3, c = Math.cos(d.a), sn = Math.sin(d.a);
        for (const sg of [-1, 1]) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const ax = Math.round(d.x + c * sep * sg) + dx - 1, ay = Math.round(d.y + sn * sep * sg) + dy - 1;
          if (open(ax, ay)) px(ax, ay, rgb([90, 30, 100]), .85 * f);
        }
        if (age > 1.2) for (let k = -3; k <= 3; k++) { const ax = Math.round(d.x - sn * k), ay = Math.round(d.y + c * k); if (open(ax, ay)) px(ax, ay, rgb([196, 110, 156]), .8 * f * Math.min(1, (age - 1.2) / .8)); }
      }
      if (!wbc && now > nextWbc) {
        const p = spot(v.ox, v.oy, v.s, v.W, v.H);
        if (p) wbc = { x: p[0], y: p[1], hd: Math.random() * TAU, t0: now, life: 22000, seed: (Math.random() * 1e6) | 0 };
        else nextWbc = now + 5000;
      }
      if (!wbc) return;
      const w = wbc, age = now - w.t0;
      if (age > w.life) { wbc = null; nextWbc = now + 30000 + Math.random() * 30000; return; }
      w.hd += (vn(t * .3, 0, w.seed) - .5) * v.dt * 2;
      w.x += Math.cos(w.hd) * 4 * v.dt; w.y += Math.sin(w.hd) * 4 * v.dt;
      const f = Math.min(1, age / 1500, (w.life - age) / 1500), R = 5;
      let seen = false;
      for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {   // 边缘一直在变形
        const d = Math.hypot(dx, dy), a = Math.atan2(dy, dx), edge = R * (.8 + .4 * vn(Math.cos(a) * 1.5 + t * .6, Math.sin(a) * 1.5, w.seed));
        const ax = Math.round(w.x) + dx, ay = Math.round(w.y) + dy;
        if (d > edge || !open(ax, ay)) continue;
        seen = true;
        px(ax, ay, rgb(d > edge - 1 ? [220, 186, 214] : [252, 244, 250]), .9 * f);
      }
      for (let n = 0; n < 3; n++) {                             // 分叶的细胞核
        const a = n * 2.1 + t * .3, nx = Math.round(w.x + Math.cos(a) * 1.8), ny = Math.round(w.y + Math.sin(a) * 1.8);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) if (open(nx + dx, ny + dy)) px(nx + dx, ny + dy, rgb([120, 60, 140]), .85 * f);
      }
      if (seen) said('fxwbc', '一个白细胞慢慢爬过来，边走边改形状。它在巡逻。', 'A white blood cell crawls slowly past, changing shape as it goes. It\'s on patrol.');
    },
  };

  const THEME = { earth, dune, pcb, foil, solaris, crystal, ink, blueprint, slide };
  function frame(ox, oy, tp, s, W, H, layer) {
    const now = performance.now();
    if (layer === 'under') { dt = Math.min(.1, (now - last) / 1000); last = now; }
    if (SKY) { if (layer === 'under') SKY.fx(ox, oy, tp, s, W, H); return; }
    const f = THEME[G.theme]?.[layer];
    if (!f) return;
    f({ ox, oy, tp, s, W, H, now, t: now / 1000, dt, age: now - T0, px: pen(ox, oy, s) });
    ctx.globalAlpha = 1;
  }
  return { open, pen, spot, frame };
})();
