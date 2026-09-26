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
  const tileAt = (ax, ay) => tile(Math.floor(ax / TP), Math.floor(ay / TP));
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

  // --- 地球：云在纸面上方的第三维，居民只看得到它们的影子；水面上有细碎的波光 --------------------------
  const earth = {
    under(v) {
      const { ox, oy, tp, W, H, t } = v, dl = daylight(), g = ctx;
      if (dl > .05) {
        const step = Math.max(1, Math.ceil(16 / tp)), x0 = Math.floor(-ox / tp / step) * step, y0 = Math.floor(-oy / tp / step) * step;
        const cx = t * 1.1, cy = t * .45;                    // 风：一秒一格多
        let any = false;
        g.fillStyle = '#1e2a3a';
        for (let y = y0; y * tp + oy < H; y += step) for (let x = x0; x * tp + ox < W; x += step) {
          if (!rev.has(key(x, y))) continue;
          const n = vn((x - cx) / 16, (y - cy) / 16, G.seed + 300) * .7 + vn((x - cx) / 6, (y - cy) / 6, G.seed + 301) * .3;
          const a = n > .66 ? .2 : n > .6 ? .11 : 0;          // 两档深浅，边上浅一点
          if (!a) continue;
          any = true;
          g.globalAlpha = a * dl; g.fillRect(x * tp + ox, y * tp + oy, tp * step, tp * step);
        }
        if (any && v.age > 45000) said('fxcloud', '一片影子从纸上慢慢滑过去。那是一朵云——它在纸面上方的第三维，居民只看得到它的影子。', 'A shadow slides slowly across the paper. It\'s a cloud, up in the third dimension above the sheet; the residents only ever see its shadow.');
      }
      // 波光：每格水按自己的节奏，每 3–7 秒闪一下，一道横向亮线，渐亮再渐暗；深水暗一点。每一闪的长短（1–4 像素）和位置都重新抽
      const px = v.px, a = .45 + .55 * dl;
      eachChunk(v, (cx, cy) => {
        for (const [x, y, deep, per, ph] of perChunk('water', cx, cy, (X, Y) => { const o = []; for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) { const t2 = tile(X + i, Y + j); if (t2 === 'water' || t2 === 'deep') o.push([X + i, Y + j, t2 === 'deep', 3 + h(X + i, Y + j, G.seed + 310) * 4, h(X + i, Y + j, G.seed + 311)]); } return o; })) {
          const k = ((t / per + ph) % 1) * per / .6;             // 这一闪进行到哪了（0–1），过了就等下一轮
          if (k >= 1 || !rev.has(key(x, y))) continue;
          const n = Math.floor(t / per + ph), len = 1 + ((h(x, y, n) * 4) | 0), ax = x * TP + ((h(x, y, n + 1) * (TP - len + 1)) | 0), ay = y * TP + ((h(x, y, n + 2) * TP) | 0);
          const f = Math.sin(k * Math.PI) * a * (deep ? .7 : 1);
          for (let i = 0; i < len; i++) px(ax + i, ay, '#ffffff', len > 2 && (i === 0 || i === len - 1) ? f * .6 : f);   // 长的那几道两头淡一点
        }
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
  const traceH = (ax, ay) => { const x = Math.floor(ax / TP), y = Math.floor(ay / TP); return ay - y * TP === 1 && y % 4 === 0 && (x >> 2) % 5 !== 0 && tile(x, y) === 'grass'; };
  const traceV = (ax, ay) => { const x = Math.floor(ax / TP), y = Math.floor(ay / TP); return ax - x * TP === 2 && x % 6 === 0 && (y >> 2) % 4 !== 1 && tile(x, y) === 'grass'; };
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

  const THEME = { earth, dune, pcb };
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
