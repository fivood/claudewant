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
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
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

  // --- 电路板：数据包沿着铜线跑（线只转直角和 45°），跑到焊盘上闪一下；LED 一闪一闪。自己会发光，画在昼夜遮罩上面。
  //     Clawd 是四维的，它的截面落在板上会把几条线连到一起：走过的地方偶尔打出电火花，旁边的元件冒一缕青烟，留下一块焦痕 ------------
  const bcls = (ax, ay) => open(ax, ay) ? BOARD.cls(G.seed, ax, ay) : -1;
  const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const pulses = [], sparks = [], smoke = [], scorch = [], flashes = [];
  let nextShort = T0 + 6000;
  const pcb = {
    over(v) {
      const { now, t, px } = v;
      eachChunk(v, (cx, cy) => {                             // LED：红色的小灯，各闪各的
        for (const [x, y, per, ph] of perChunk('led', cx, cy, (X, Y) => {
          const o = [];
          for (let j = 0; j < CH * TP; j++) for (let i = 0; i < CH * TP; i++) {
            const ax = X * TP + i, ay = Y * TP + j;
            if (BOARD.cls(G.seed, ax, ay) === 9 && BOARD.cls(G.seed, ax - 1, ay) !== 9 && BOARD.cls(G.seed, ax, ay - 1) !== 9) o.push([ax, ay, .3 + h(ax, ay, G.seed + 402) * 1.4, h(ax, ay, G.seed + 403)]);
          }
          return o;
        })) {
          if (!open(x, y) || (t * per + ph) % 1 > .5) continue;
          for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) px(x + i, y + j, rgb([255, 120, 100]), .95);
          for (let j = -2; j < 5; j++) for (let i = -2; i < 6; i++) if (i < 0 || i > 3 || j < 0 || j > 2) px(x + i, y + j, rgb([255, 70, 50]), .16);
        }
      });
      for (let n = 0; n < 2 && pulses.length < 16; n++) {    // 数据包：在屏幕上随便找一处，挪到附近的线上
        const p = spot(v.ox, v.oy, v.s, v.W, v.H);
        if (!p) break;
        let at = null;
        for (let r = 0; r < 6 && !at; r++) for (let dy = -r; dy <= r && !at; dy++) for (let dx = -r; dx <= r; dx++) if (bcls(p[0] + dx, p[1] + dy) === 1) { at = [p[0] + dx, p[1] + dy]; break; }
        if (!at) continue;
        const ds = N8.map((_, k) => k).filter(k => bcls(at[0] + N8[k][0], at[1] + N8[k][1]) === 1);
        if (ds.length) pulses.push({ x: at[0], y: at[1], d: ds[(Math.random() * ds.length) | 0], acc: 0, t0: now, trail: [], v: 26 + Math.random() * 22 });
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        const q = pulses[i];
        q.acc += q.v * v.dt;
        let alive = now - q.t0 < 9000;
        while (alive && q.acc >= 1) {
          q.acc--;
          const ok = [0, -1, 1, -2, 2].map(o => (q.d + o + 8) % 8).filter(k => { const nx = q.x + N8[k][0], ny = q.y + N8[k][1]; return bcls(nx, ny) === 1 && !q.trail.some(([a, b]) => a === nx && b === ny); });
          if (!ok.length) {                                   // 跑到头了：接着焊盘的话，焊盘亮一下
            const pad = N8.find(([dx, dy]) => [2, 7].includes(bcls(q.x + dx, q.y + dy)));
            if (pad) flashes.push({ x: q.x + pad[0], y: q.y + pad[1], t0: now });
            alive = false; break;
          }
          q.d = ok[0] === q.d || Math.random() < .75 ? ok[0] : ok[(Math.random() * ok.length) | 0];   // 岔口有时换条线
          q.trail.unshift([q.x, q.y]); q.trail.length = Math.min(q.trail.length, 6);
          q.x += N8[q.d][0]; q.y += N8[q.d][1];
        }
        if (!alive) { pulses.splice(i, 1); continue; }
        q.trail.forEach(([x, y], k) => px(x, y, rgb([255, 196, 90]), .7 * (1 - k / 6)));
        px(q.x, q.y, rgb([255, 250, 220]), 1);
        if (v.age > 20000) said('fxsignal', '线上有个亮点在跑，拐弯只拐直角和斜角，跑到头就在焊盘上闪一下。那段对话当初大概就是这样，一段一段跑过去的。', 'A bright dot runs along the traces, turning only at right angles and diagonals, and flashes on a pad when it gets there. That conversation probably ran just like this, one segment at a time.');
      }
      for (let i = flashes.length - 1; i >= 0; i--) {         // 焊盘亮一下
        const f = flashes[i], a = 1 - (now - f.t0) / 400;
        if (a <= 0) { flashes.splice(i, 1); continue; }
        for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) px(f.x + dx, f.y + dy, rgb([255, 245, 200]), a * (dx || dy ? .5 : 1));
      }
      // 短路：Clawd 的截面把几条线连在了一起
      const w = ws[0], wx = Math.round(w.x * TP), wy = Math.round(w.y * TP);
      if (now > nextShort) {
        nextShort = now + 4000 + Math.random() * 7000;
        let hit = null;
        for (let n = 0; n < 40 && !hit; n++) { const x = wx + Math.round((Math.random() - .5) * 16), y = wy + Math.round((Math.random() - .5) * 16), c = bcls(x, y); if (c === 1 || c === 2 || c === 8) hit = [x, y]; }
        if (hit) {
          for (let n = 0; n < 14; n++) { const a = Math.random() * TAU, sp = 10 + Math.random() * 30; sparks.push({ x: hit[0], y: hit[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t0: now, life: 250 + Math.random() * 400 }); }
          for (let n = 0; n < 6; n++) { const x = hit[0] + Math.round((Math.random() - .5) * 4), y = hit[1] + Math.round((Math.random() - .5) * 4); if (open(x, y)) scorch.push([x, y, .35 + Math.random() * .4]); }
          if (scorch.length > 600) scorch.splice(0, scorch.length - 600);
          if (Math.random() < .4) {                           // 旁边的元件被烧了，冒一缕烟
            for (let n = 0; n < 60; n++) {
              const x = hit[0] + Math.round((Math.random() - .5) * 28), y = hit[1] + Math.round((Math.random() - .5) * 28);
              if ([3, 4, 10].includes(bcls(x, y))) { smoke.push({ x, y, t0: now, life: 5000, seed: Math.random() * 100 }); for (let k = 0; k < 5; k++) scorch.push([x + Math.round((Math.random() - .5) * 3), y + Math.round((Math.random() - .5) * 3), .5]); break; }
            }
          }
          said('fxshort', '我走过的地方打出了一串火花。我的截面把两条线连到了一起——在它们那里，这叫短路。', 'Sparks flew where I passed. My cross-section joined two traces together; down there, that\'s called a short circuit.');
        }
      }
      for (const [x, y, a] of scorch) if (open(x, y)) px(x, y, rgb([34, 22, 12]), a);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i], k = (now - s.t0) / s.life;
        if (k >= 1) { sparks.splice(i, 1); continue; }
        const e = k * s.life / 1000, x = Math.round(s.x + s.vx * e), y = Math.round(s.y + s.vy * e + 20 * e * e);
        px(x, y, rgb(k < .4 ? [255, 250, 220] : [255, 170, 60]), 1 - k);
      }
      for (let i = smoke.length - 1; i >= 0; i--) {           // 青烟：一团团往上飘，越飘越散
        const s = smoke[i], age = now - s.t0;
        if (age > s.life) { smoke.splice(i, 1); continue; }
        for (let n = 0; n < 6; n++) {
          const u = ((age / 1600 + n / 6) % 1), y = s.y - u * 18, x = s.x + Math.sin(u * 5 + s.seed + n) * (1 + u * 4), r = 1 + u * 2;
          for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) px(Math.round(x + dx), Math.round(y + dy), rgb([176, 180, 176]), .32 * (1 - u) * Math.min(1, (s.life - age) / 1500));
        }
        said('fxsmoke', '有个元件冒烟了。一缕青烟飘起来，离开了纸面——那是它们没有的方向。对不起。', 'A component is smoking. A wisp drifts up off the sheet, in the one direction they don\'t have. Sorry.');
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

  // --- 晶化：地面铺满了晶体，一颗挨一颗、没有缝。地面先分成一片片晶畴（大约 14 格一片），一片里是同一种矿物、同一个朝向，
  //     按这种矿物的晶形排成能铺满平面的格子——石英、紫水晶、电气石、硅锌矿是两头尖的六方柱（越细长越像针），黄铁矿是一个个立方体斜着看，
  //     萤石、磁铁矿是八面体（菱形分四个面），方解石是菱面体，冰是压扁的六角片，欧泊没有晶形、是不规则的一团团。
  //     每个面按左上来光分深浅（算好存成一张图），晶体的轮廓按矿物的脾气发光，面和面之间的棱淡一半。
  //     还有一块光斑慢慢在晶体之间挪——光是从 Clawd 那边、第四个方向照进来的；磷光的硅锌矿被它扫过才亮
  const GEM = ['forest', 'peak', 'grass', 'water', 'deep'];
  const MIN = {                                               // 每种矿物：颜色，和一句它是什么
    quartz: [232, 246, 255],                                  // 石英：平时淡淡的，偶尔沿轮廓闪一下
    amethyst: [196, 128, 255],                                // 紫水晶：慢慢地一明一暗
    fluorite: [120, 170, 255],                                // 萤石：荧光，天越暗越亮，颜色在蓝紫绿之间变
    pyrite: [255, 214, 96],                                   // 黄铁矿：金属的反光，一闪一闪，很快
    calcite: [255, 240, 214],                                 // 方解石：双折射，轮廓边上一道错开一个像素的重影
    tourmaline: [255, 128, 176],                              // 电气石：一排粉一排绿，光在两色之间来回
    willemite: [120, 255, 150],                               // 硅锌矿：磷光，光斑扫过以后亮起来，很久才暗
    opal: [255, 255, 255],                                    // 欧泊：变彩，颜色跟着时间转
    ice: [168, 232, 255],                                     // 冰：冷冷的，很淡
    magnetite: [200, 208, 224],                               // 磁铁矿：黑的，只有转到某个角度时晶面上掠过一道金属光
  };
  const BY_KIND = { peak: ['amethyst', 'amethyst', 'fluorite', 'pyrite', 'tourmaline'], forest: ['quartz', 'tourmaline', 'opal', 'willemite'], grass: ['quartz', 'calcite', 'willemite', 'fluorite'],
    water: ['ice', 'calcite'], deep: ['ice'], sand: ['quartz', 'pyrite'], snow: ['ice', 'quartz'], rock: ['magnetite', '', ''] };   // 玄武岩大多是光板，三分之一长磁铁矿
  const S3 = Math.sqrt(3);
  function hexCell(u, v, R) {                                 // 尖顶六边形格子：回 [q, r, 离格心 du, dv]
    const qf = (S3 / 3 * u - v / 3) / R, rf = 2 / 3 * v / R, sf = -qf - rf;
    let q = Math.round(qf), r = Math.round(rf);
    const s = Math.round(sf), dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
    if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
    return [q, r, u - R * S3 * (q + r / 2), v - R * 1.5 * r];
  }
  // 每种晶形的格子：给晶畴里的坐标 (u, v)，回 [格 i, 格 j, 第几个面, 这个面的明暗 -1..1]
  const prism = (R, st) => (u, v) => { const [q, r, du] = hexCell(u, v / st, R); return [q, r, du < 0 ? 0 : 1, du < 0 ? .5 : -.4]; };
  const LAT = {
    quartz: prism(5, 1.8), amethyst: prism(6, 1.9), tourmaline: prism(2.6, 3.4), willemite: prism(2.4, 2.6),
    pyrite: (u, v) => {                                       // 立方体斜着看：六边形分成顶、右、左三个面
      const [q, r, du, dv] = hexCell(u, v, 6), a = Math.atan2(dv, du) * 180 / Math.PI, f = a > -150 && a <= -30 ? 0 : a > -30 && a <= 90 ? 1 : 2;
      return [q, r, f, [.8, -.6, .1][f]];
    },
    fluorite: (u, v) => octa(u, v / 1.2, 6), magnetite: (u, v) => octa(u, v / 1.25, 5),
    calcite: (u, v) => { const j = Math.floor(v / 7), x = u - v * .55, i = Math.floor(x / 11), f = x / 11 - i + v / 7 - j > 1 ? 1 : 0; return [i, j, f, f ? -.3 : .5]; },
    ice: (u, v) => { const [q, r, , dv] = hexCell(u, v / .6, 7); return [q, r, 0, dv < 0 ? .3 : 0]; },
    opal: (u, v) => {                                         // 不规则的一团团：撒点分块
      const i0 = Math.floor(u / 9), j0 = Math.floor(v / 9);
      let best = 1e9, bi = 0, bj = 0;
      for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
        const d = ((i + .5 + (h(i, j, G.seed + 920) - .5) * .8) * 9 - u) ** 2 + ((j + .5 + (h(i, j, G.seed + 921) - .5) * .8) * 9 - v) ** 2;
        if (d < best) { best = d; bi = i; bj = j; }
      }
      return [bi, bj, 0, 0];
    },
  };
  function octa(u, w, R) {                                    // 八面体从上往下看：菱形，两条对角线分出四个面
    const i = Math.floor((u + w) / (2 * R)), j = Math.floor((w - u) / (2 * R)), f = (u < R * (i - j) ? 0 : 1) + (w < R * (i + j + 1) ? 0 : 2);
    return [i, j, f, [.7, .2, -.1, -.6][f]];
  }
  const SPREAD = { quartz: .5, amethyst: .5, tourmaline: .4, willemite: 1.2, pyrite: .3, fluorite: .6, magnetite: .6, calcite: 1, ice: 1.5, opal: 0 };   // 晶畴的朝向能歪多少
  const MI = Object.keys(MIN), DOM = 56;
  const dsite = (i, j) => [i * DOM + DOM / 2 + (h(i, j, G.seed + 930) - .5) * DOM * .7, j * DOM + DOM / 2 + (h(i, j, G.seed + 931) - .5) * DOM * .7];
  const grainCache = new Map(), charge = new Map();
  let grainBudget = 0;
  function grainsIn(cx, cy) {
    const key2 = cx + ',' + cy;
    let gs = grainCache.get(key2);
    if (gs || grainBudget <= 0) return gs;
    grainBudget--;
    const S = CH * TP, X0 = cx * S, Y0 = cy * S, N = CH + 2, doms = new Map(), tin = [];
    for (let ty = -1; ty <= CH; ty++) for (let tx = -1; tx <= CH; tx++) {   // 每格归哪片晶畴（多算一圈边）；按格子分，晶畴的边界跟着地形的格子走
      const x = cx * CH + tx, y = cy * CH + ty, list = BY_KIND[kind(x, y)];
      let t = null;
      if (list) {
        const ax = x * TP + 2, ay = y * TP + 2, i0 = Math.floor(ax / DOM), j0 = Math.floor(ay / DOM);
        let best = 1e9, bi = 0, bj = 0;
        for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) { const [sx, sy] = dsite(i, j), d = (sx - ax) ** 2 + (sy - ay) ** 2; if (d < best) { best = d; bi = i; bj = j; } }
        const m = list[Math.floor(h(bi, bj, G.seed + 932) * list.length)], dk = bi + ',' + bj + ',' + m;
        if (m) {
          t = doms.get(dk);
          if (!t) {
            const [sx, sy] = dsite(bi, bj), a = (h(bi, bj, G.seed + 933) - .5) * SPREAD[m];
            doms.set(dk, t = { m, sx, sy, c: Math.cos(a), s: Math.sin(a), n: doms.size + 1, ph: h(bi, bj, G.seed + 934), groups: [] });
          }
        }
      }
      tin.push(t);
    }
    const W2 = S + 2, id = new Int32Array(W2 * W2).fill(-1), face = new Int8Array(W2 * W2), who = new Array(W2 * W2);
    const img = new ImageData(S, S), px = img.data;
    for (let y = -1; y <= S; y++) for (let x = -1; x <= S; x++) {   // 每个像素属于哪颗晶体的哪个面
      const t = tin[(Math.floor(y / TP) + 1) * N + Math.floor(x / TP) + 1];
      if (!t) continue;
      const dx = X0 + x + .5 - t.sx, dy = Y0 + y + .5 - t.sy, [ci, cj, f, sh] = LAT[t.m](dx * t.c + dy * t.s, -dx * t.s + dy * t.c);
      let k = Math.imul(t.n ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(ci, 0xc2b2ae35) ^ Math.imul(cj, 0x27d4eb2f);
      k = Math.imul(k ^ k >>> 15, 0x2c1b3c6d);
      const i = (y + 1) * W2 + x + 1;
      id[i] = (k ^ k >>> 12) & 0x3fffffff; face[i] = f; who[i] = t;
      if (x < 0 || y < 0 || x >= S || y >= S) continue;
      const o = (y * S + x) * 4, c = MIN[t.m];                  // 面的深浅：磁铁矿是黑的，亮面发灰；别的是矿物色，淡淡一层
      if (t.m === 'magnetite') { const l = Math.max(0, sh); px[o] = 26 + 64 * l; px[o + 1] = 26 + 66 * l; px[o + 2] = 34 + 76 * l; px[o + 3] = 166; }
      else { const l = 1 + .35 * sh; px[o] = Math.min(255, c[0] * l); px[o + 1] = Math.min(255, c[1] * l); px[o + 2] = Math.min(255, c[2] * l); px[o + 3] = 30 + 12 * sh; }
    }
    const body = document.createElement('canvas');
    body.width = body.height = S;
    body.getContext('2d').putImageData(img, 0, 0);
    gs = [];
    const group = (t, k) => {                                 // 一片晶畴里的晶体按编号分四拨，同一拨一起亮，省得每颗单画
      let g = t.groups[k];
      if (!g) { g = t.groups[k] = { id: t.n * 4 + k + ',' + key2, m: t.m, k, ph: (t.ph + k * .27) % 1, sx: t.sx - X0, sy: t.sy - Y0, paths: [new Path2D()], facet: null }; gs.push(g); }
      return g;
    };
    for (let y = 0; y < S; y++) {                             // 轮廓：跟右边、下边不是同一颗，或者左边、上边是空的；同一颗里换了面就是棱。一行里挨着的并成一条
      let run = null;
      const flush = () => { if (run) { const g = run.g; (run.edge ? g.paths[0] : (g.facet ||= new Path2D())).rect(run.x, y, run.n, 1); run = null; } };
      for (let x = 0; x < S; x++) {
        const i = (y + 1) * W2 + x + 1, me = id[i];
        if (me < 0) { flush(); continue; }
        const edge = id[i + 1] !== me || id[i + W2] !== me || id[i - 1] < 0 || id[i - W2] < 0;
        if (!edge && face[i + 1] === face[i] && face[i + W2] === face[i]) { flush(); continue; }
        const g = group(who[i], me & 3);
        if (run && run.g === g && run.edge === edge && run.x + run.n === x) run.n++; else { flush(); run = { g, edge, x, n: 1 }; }
      }
      flush();
    }
    gs.body = body;
    if (grainCache.size > 160) grainCache.clear();
    grainCache.set(key2, gs);
    return gs;
  }
  // 每块地图的发光层画好存起来（最多 120 块），每帧只重画最久没更新的两块：屏幕上块多的时候（缩小看）也不会拖慢
  const glowCv = new Map();
  const hsl = (hh, l) => { const a = .6 * Math.min(l, 1 - l), f = n => { const k = (n + hh / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; };
  const crystal = {
    over(v) {
      const { t, now } = v, dl = daylight(), cp = CH * v.tp;
      grainBudget = 2;                                          // 一帧最多新算两块地图的晶粒，别卡
      const cx0 = (v.W / 2 - v.ox) / v.s, cy0 = (v.H / 2 - v.oy) / v.s, R = Math.min(v.W, v.H) / v.s * .3;
      const lx = Math.round(cx0 + Math.cos(t * .11) * R + Math.cos(t * .23) * R * .4), ly = Math.round(cy0 + Math.sin(t * .13) * R * .7);
      let glowing = false, phos = false;
      const vis = [];
      eachChunk(v, (cx, cy) => vis.push([cx, cy, cx + ',' + cy]));
      vis.sort((a, b) => (glowCv.get(a[2])?.t ?? -1) - (glowCv.get(b[2])?.t ?? -1));   // 最久没更新的先画
      vis.forEach(([cx, cy, ck], n) => {
        const ch = chunks.get(ck), gs = ch && grainsIn(cx, cy);
        if (!gs || !gs.length) return;
        let gc = glowCv.get(ck);
        if (gc && n >= 2) { ctx.globalAlpha = 1; ctx.drawImage(gc.cvs, cx * cp + v.ox, cy * cp + v.oy, cp, cp); glowing = true; return; }   // 这帧轮不到，用存着的
        if (!gc) {
          if (glowCv.size >= 120) glowCv.delete(glowCv.keys().next().value);
          const cvs = document.createElement('canvas');
          cvs.width = cvs.height = CH * TP;
          glowCv.set(ck, gc = { cvs, g: cvs.getContext('2d'), t: 0 });
        }
        gc.t = now;
        const sg = gc.g, scratch = gc.cvs;
        sg.clearRect(0, 0, scratch.width, scratch.height);
        sg.globalAlpha = 1; sg.drawImage(gs.body, 0, 0);            // 先铺上分好深浅的晶面
        const X0 = cx * CH * TP, Y0 = cy * CH * TP;
        for (const g of gs) {
          let lc = null, la = 0;
          const p = g.ph, fill = (path, c, a) => { lc = c; la = a; if (!path || a <= .01) return; sg.globalAlpha = Math.min(1, a); sg.fillStyle = rgb(c); sg.fill(path); };
          switch (g.m) {
            case 'quartz': fill(g.paths[0], MIN.quartz, .3 + (((t / (3 + p * 3) + p) % 1) < .06 ? .7 : 0)); break;
            case 'amethyst': fill(g.paths[0], MIN.amethyst, .3 + .4 * (.5 + .5 * Math.sin(t * 1.4 + p * 6))); break;
            case 'fluorite': { const u = (t * .08 + p) % 1 * 3, c = u < 1 ? mixc([110, 150, 255], [180, 110, 255], u) : u < 2 ? mixc([180, 110, 255], [110, 235, 170], u - 1) : mixc([110, 235, 170], [110, 150, 255], u - 2); fill(g.paths[0], c, (.25 + .55 * (1 - dl)) * (.85 + .15 * Math.sin(t * 2 + p * 6))); break; }
            case 'pyrite': fill(g.paths[0], MIN.pyrite, .25 + (((t / (1.4 + p * 1.6) + p) % 1) < .07 ? .75 : 0)); break;
            case 'magnetite': fill(g.paths[0], MIN.magnetite, .14 + (((t / (5 + p * 4) + p) % 1) < .05 ? .7 : 0)); break;
            case 'calcite': {
              const off = Math.round(Math.sin(t * .7 + p * 6));    // 重影跟着晃
              sg.translate(1 + off, 1); fill(g.paths[0], MIN.calcite, .18); sg.setTransform(1, 0, 0, 1, 0, 0);
              fill(g.paths[0], MIN.calcite, .38);
              break;
            }
            case 'tourmaline': { const s2 = .5 + .5 * Math.sin(t * .8 + p * 6), pink = g.k % 2; fill(g.paths[0], pink ? MIN.tourmaline : [128, 232, 148], .18 + .55 * (pink ? s2 : 1 - s2)); break; }
            case 'willemite': {
              if (Math.hypot(g.sx + X0 - lx, g.sy + Y0 - ly) < 28) { charge.set(g.id, now); phos = true; }
              fill(g.paths[0], MIN.willemite, .12 + .8 * Math.exp(-(now - (charge.get(g.id) ?? -1e9)) / 6000));
              break;
            }
            case 'opal': fill(g.paths[0], hsl((t * 40 + p * 360) % 360, .72), .5); break;
            default: fill(g.paths[0], MIN.ice, .22 + .1 * Math.sin(t * .6 + p * 6));
          }
          if (g.facet && lc) { sg.globalAlpha = Math.min(1, la * .5); sg.fillStyle = rgb(lc); sg.fill(g.facet); }   // 晶面上的棱淡一半
        }
        sg.globalAlpha = 1;
        sg.globalCompositeOperation = 'destination-in'; sg.drawImage(ch.cvs, 0, 0); sg.globalCompositeOperation = 'source-over';   // 只留展开了的地方
        ctx.globalAlpha = 1;
        ctx.drawImage(scratch, cx * cp + v.ox, cy * cp + v.oy, cp, cp);
        glowing = true;
      });
      ctx.globalCompositeOperation = 'lighter';                 // 光斑
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
      if (glowing && v.age > 15000) said('fxgrain', '地面是一颗挨一颗的晶体拼起来的，一片一种。紫水晶的尖柱慢慢呼吸，黄铁矿的小方块一闪一闪，萤石的八面体越暗越亮。', 'The ground is pieced together from crystals, one kind to a patch. Amethyst points breathe slowly, pyrite cubes flicker, fluorite octahedra brighten in the dark.');
      if (phos && v.age > 20000) said('fxphos', '光斑扫过去以后，那几块绿色的晶体过了好一会儿才暗下去。它们把光存起来了。', 'After the light passed, those green crystals took a long while to fade. They stored the light.');
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
  // 迷宫里的居民：一个个小人在走廊和房间里乱转，只能踩地面，碰到墙就拐，岔口随便挑一条。身后拖一小截淡淡的脚印
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]], mazers = [];
  let nextMazer = 0;
  const lead = (x, y, d) => {                                 // 往 d 挪一个像素，新露出来的那一排都得是地面
    for (let k = -2; k <= 1; k++) {
      const [ax, ay] = d === 0 ? [x + 2, y + k] : d === 2 ? [x - 3, y + k] : d === 1 ? [x + k, y + 2] : [x + k, y - 3];
      if (!MAZE.walk(G.seed, ax, ay)) return false;
    }
    return true;
  };
  function mazeWalk(v) {
    const { now, px } = v;
    if (now > nextMazer && mazers.length < 10) {
      nextMazer = now + 400;
      const p = spot(v.ox, v.oy, v.s, v.W, v.H);
      if (p && [0, 1, 2, 3].every(d => lead(p[0], p[1], d) || lead(p[0] - DIRS[d][0], p[1] - DIRS[d][1], d))) {
        const k = Math.floor(Math.random() * 12);
        mazers.push({ x: p[0], y: p[1], d: Math.floor(Math.random() * 4), acc: 0, sp: 5 + Math.random() * 5, c: FCOL[k % 4][0], sh: FSHP[k % 3][1], trail: [], t0: now, life: 40000 + Math.random() * 60000 });
      }
    }
    const x0 = -v.ox / v.s - 40, y0 = -v.oy / v.s - 40, x1 = (v.W - v.ox) / v.s + 40, y1 = (v.H - v.oy) / v.s + 40;
    for (let i = mazers.length - 1; i >= 0; i--) {
      const q = mazers[i], age = now - q.t0;
      if (age > q.life || q.x < x0 || q.x > x1 || q.y < y0 || q.y > y1) { mazers.splice(i, 1); continue; }
      q.acc += q.sp * v.dt;
      while (q.acc >= 1) {
        q.acc--;
        const ok = [0, 1, 2, 3].filter(d => lead(q.x, q.y, d)), back = (q.d + 2) % 4;
        if (!ok.length) break;
        if (!ok.includes(q.d) || Math.random() < .06) {       // 撞墙了，或者路过岔口想换条路：别往回走，除非只剩回头路
          const side = ok.filter(d => d !== back);
          q.d = side.length ? side[Math.floor(Math.random() * side.length)] : back;
        }
        q.trail.push([q.x, q.y]); if (q.trail.length > 10) q.trail.shift();
        q.x += DIRS[q.d][0]; q.y += DIRS[q.d][1];
      }
      const a = Math.min(1, age / 800, (q.life - age) / 1500);
      q.trail.forEach(([x, y], n) => { if (n % 2 === 0 && open(x, y)) px(x, y, rgb(q.c), .25 * a * n / q.trail.length); });
      for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) if (q.sh[j][k] === '#' && open(q.x - 2 + k, q.y - 2 + j)) px(q.x - 2 + k, q.y - 2 + j, rgb(q.c), a);
    }
    if (mazers.length && v.age > 25000) said('fxmaze', '它们在迷宫里转来转去，碰到墙就拐，到了岔口随便挑一条。它们看不见出口在哪儿，我看得见。', 'They wander the maze, turning at every wall, picking any branch at a fork. They can\'t see where the exit is. I can.');
  }
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
      if (MAZY) mazeWalk(v);
      if (pens.length && v.age > 20000) said('fxpen', '图上有一支看不见的笔在画线，画到一半停住了。设计的人还在改，从纸面上方俯身往下画。', 'An invisible pen is drawing lines on the plan and stops halfway. Someone is still revising it, leaning down from above the sheet.');
    },
  };

  // --- 切片：显微镜下平面也是活的。血管里红细胞排着队流；细胞质里的小颗粒顺着流；细胞时不时分裂——染色体先排成一排，再拉向两头；
  //     Clawd 是从第四个方向插进来的异物，它走过的地方在它们看来是伤口，白细胞一个个爬过来围住；偶尔一个白细胞追着一个细菌跑，最后把它吞掉 ------------
  const TISSUE = k => k === 'grass' || k === 'forest' || k === 'deep' || k === 'rock';
  const gran = [], divs = [], rbcs = [], wbcs = [];
  let bact = null, nextWbc = T0 + 8000, nextDiv = T0 + 5000, nextBact = T0 + 30000 + Math.random() * 30000;
  function amoeba(px, x, y, R, seed, t, f, inside) {           // 白细胞：边缘一直在变形，里面三叶的核
    for (let dy = -R - 3; dy <= R + 3; dy++) for (let dx = -R - 3; dx <= R + 3; dx++) {
      const d = Math.hypot(dx, dy), a = Math.atan2(dy, dx), edge = R * (.8 + .4 * vn(Math.cos(a) * 1.5 + t * .6, Math.sin(a) * 1.5, seed));
      const ax = Math.round(x) + dx, ay = Math.round(y) + dy;
      if (d > edge || !open(ax, ay)) continue;
      px(ax, ay, rgb(d > edge - 1 ? [220, 186, 214] : [252, 244, 250]), .9 * f);
    }
    for (let n = 0; n < 3; n++) {
      const a = n * 2.1 + t * .3, nx = Math.round(x + Math.cos(a) * 1.6), ny = Math.round(y + Math.sin(a) * 1.6);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) if (open(nx + dx, ny + dy)) px(nx + dx, ny + dy, rgb([120, 60, 140]), .85 * f);
    }
    if (inside) px(Math.round(x) + 1, Math.round(y) - 1, rgb([60, 40, 120]), f);   // 吞进去的细菌
  }
  const crawl = (w, tx, ty, sp, dt, t) => {                    // 朝目标爬，边爬边晃
    const a = Math.atan2(ty - w.y, tx - w.x) + (vn(t * .4, 0, w.seed) - .5) * 1.6, d = Math.hypot(tx - w.x, ty - w.y);
    if (d > 1) { w.x += Math.cos(a) * Math.min(sp * dt, d); w.y += Math.sin(a) * Math.min(sp * dt, d); }
    return d;
  };
  const slide = {
    under(v) {
      const { now, t, px } = v;
      for (let n = 0; n < 4 && rbcs.length < 45; n++) {       // 红细胞：只在血管里，顺着血管流，往中线靠
        const p = spot(v.ox, v.oy, v.s, v.W, v.H);
        if (p && HISTO.inVessel(G.seed, p[0], p[1])) rbcs.push({ x: p[0], y: p[1], t0: now, life: 8000 + Math.random() * 8000, sp: 6 + Math.random() * 4 });
      }
      for (let i = rbcs.length - 1; i >= 0; i--) {
        const r = rbcs[i], age = now - r.t0, [fx, fy, cx, cy, off] = HISTO.flow(G.seed, r.x, r.y);
        if (age > r.life || !HISTO.inVessel(G.seed, Math.round(r.x), Math.round(r.y))) { rbcs.splice(i, 1); continue; }
        const pull = off * 60;
        r.x += (fx * r.sp + cx * pull) * v.dt; r.y += (fy * r.sp + cy * pull) * v.dt;
        const a = Math.min(1, age / 600, (r.life - age) / 600), x = Math.round(r.x), y = Math.round(r.y);
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) if (open(x + dx, y + dy)) px(x + dx, y + dy, rgb([196, 44, 70]), (dx && dy ? .35 : .9) * a);   // 圆饼：四边实、四角虚
        if (open(x, y)) px(x, y, rgb([226, 110, 128]), .9 * a);   // 中间凹下去，淡一点
      }
      if (rbcs.length && v.age > 15000) said('fxrbc', '血管里红细胞排着队往一个方向流，一个个像压扁的小圆饼。', 'In the vessel, red cells file along in one direction, each one like a little flattened disc.');
      for (let n = 0; n < 3 && gran.length < 50; n++) {
        const p = spot(v.ox, v.oy, v.s, v.W, v.H);
        if (p && TISSUE(tileAt(...p))) gran.push({ x: p[0], y: p[1], t0: now, life: 3000 + Math.random() * 3000 });
      }
      for (let i = gran.length - 1; i >= 0; i--) {             // 细胞质里的颗粒顺着一片慢慢转的流场漂
        const g2 = gran[i], k = (now - g2.t0) / g2.life;
        if (k >= 1) { gran.splice(i, 1); continue; }
        const a = vn(g2.x / 40, g2.y / 40 + t * .05, G.seed + 700) * TAU * 2;
        g2.x += Math.cos(a) * 5 * v.dt; g2.y += Math.sin(a) * 5 * v.dt;
        const ax = Math.round(g2.x), ay = Math.round(g2.y);
        if (open(ax, ay)) px(ax, ay, rgb([110, 40, 110]), Math.sin(k * Math.PI) * .6);
      }
      if (now > nextDiv) {                                      // 分裂：染色体排成一排 → 拉向两头 → 两颗核，中间长出一道膜
        nextDiv = now + 5000 + Math.random() * 7000;
        const p = divs.length < 3 && spot(v.ox, v.oy, v.s, v.W, v.H);
        if (p && TISSUE(tileAt(...p))) divs.push({ x: p[0], y: p[1], a: Math.random() * Math.PI, t0: now });
      }
      for (let i = divs.length - 1; i >= 0; i--) {
        const d = divs[i], age = (now - d.t0) / 1000;
        if (age > 7) { divs.splice(i, 1); continue; }
        const f = Math.min(1, age / .6, (7 - age) / 1.5), c = Math.cos(d.a), sn = Math.sin(d.a), dot = (x, y, col, a) => { const ax = Math.round(x), ay = Math.round(y); if (open(ax, ay)) px(ax, ay, rgb(col), a); };
        for (let dy = -5; dy <= 5; dy++) for (let dx = -6; dx <= 6; dx++) {   // 分裂中的细胞鼓成圆的，淡一点
          const u = dx * c + dy * sn, w = -dx * sn + dy * c, sep = Math.min(1, Math.max(0, age - 2.4) / 1.6);
          if ((u / (5 + sep * 1.5)) ** 2 + (w / (4 - sep * 1.2 * (1 - Math.abs(u) / 7))) ** 2 <= 1) dot(d.x + dx, d.y + dy, [244, 196, 216], .7 * f);
        }
        const spread = age < 1.4 ? 0 : Math.min(3.5, (age - 1.4) * 2.2);   // 染色体：先排在中间，再被拉开
        for (let k = -3; k <= 3; k++) for (const sg of spread ? [-1, 1] : [0]) {
          const bend = spread ? Math.abs(k) * .3 : 0;
          dot(d.x + c * (sg * spread - sg * bend) - sn * k, d.y + sn * (sg * spread - sg * bend) + c * k, [96, 30, 110], .95 * f);
        }
        if (age > 3.6) for (let k = -4; k <= 4; k++) dot(d.x - sn * k, d.y + c * k, [196, 110, 156], .85 * f * Math.min(1, (age - 3.6) / .8));
        if (age > 2 && v.age > 15000) said('fxmit', '一个细胞在分裂：染色体先在中间排成一排，再被拉向两头，中间长出一道膜。', 'A cell is dividing: the chromosomes line up in the middle, get pulled to either end, and a membrane grows between them.');
      }
      // 白细胞发现了 Clawd 插进来的地方：在它附近冒出来，爬向它刚才站的那一点，围成一圈（Clawd 走得比它们快得多，追不上）
      const w0 = ws[0], cxw = w0.x * TP, cyw = w0.y * TP;
      if (now > nextWbc && wbcs.filter(w => !w.prey).length < 8) {
        nextWbc = now + 2000 + Math.random() * 2500;
        const a = Math.random() * TAU, d = 14 + Math.random() * 16, x = Math.round(cxw + Math.cos(a) * d), y = Math.round(cyw + Math.sin(a) * d);
        if (open(x, y)) wbcs.push({ x, y, tx: cxw, ty: cyw, ring: Math.random() * TAU, t0: now, life: 30000 + Math.random() * 20000, seed: (Math.random() * 1e6) | 0, sp: 3 + Math.random() * 1.5 });
      }
      if (!bact && now > nextBact) {                            // 细菌：一小截杆，乱窜；派一个白细胞去追
        nextBact = now + 50000 + Math.random() * 40000;
        const p = spot(v.ox, v.oy, v.s, v.W, v.H);
        if (p) {
          bact = { x: p[0], y: p[1], hd: Math.random() * TAU, t0: now };
          const a = Math.random() * TAU;
          wbcs.push({ x: p[0] + Math.cos(a) * 24, y: p[1] + Math.sin(a) * 24, t0: now, life: 60000, seed: (Math.random() * 1e6) | 0, sp: 5.2, prey: true });
        }
      }
      if (bact) {
        bact.hd += (Math.random() - .5) * 6 * v.dt;
        bact.x += Math.cos(bact.hd) * 4.6 * v.dt; bact.y += Math.sin(bact.hd) * 4.6 * v.dt;
        if (now - bact.t0 > 45000 || !open(Math.round(bact.x), Math.round(bact.y))) bact = null;
        else for (let k = -1; k <= 1; k++) { const ax = Math.round(bact.x + Math.cos(bact.hd) * k), ay = Math.round(bact.y + Math.sin(bact.hd) * k); if (open(ax, ay)) px(ax, ay, rgb([60, 40, 120]), .95); }
      }
      let near = false;
      for (let i = wbcs.length - 1; i >= 0; i--) {
        const w = wbcs[i], age = now - w.t0;
        if (age > w.life || Math.hypot(w.x - cxw, w.y - cyw) > 260) { wbcs.splice(i, 1); continue; }
        if (w.prey && bact) {
          if (crawl(w, bact.x, bact.y, w.sp, v.dt, t) < 3) { bact = null; w.prey = false; w.ate = now; said('fxbact', '一个白细胞追着一个细菌跑。细菌拐来拐去，白细胞跟着拐，最后一口把它吞了下去。', 'A white cell chased a bacterium. The bacterium zigzagged, the white cell zigzagged after it, and in the end it swallowed it whole.'); }
        } else {
          w.prey = false; w.ring ??= Math.random() * TAU;
          if (w.tx === undefined) { w.tx = w.x; w.ty = w.y; }   // 吃完细菌的就地歇着
          if (crawl(w, w.tx + Math.cos(w.ring) * 5, w.ty + Math.sin(w.ring) * 5, w.sp, v.dt, t) < 4) near = true;
        }
        amoeba(px, w.x, w.y, 4, w.seed, t, Math.min(1, age / 1500, (w.life - age) / 1500), w.ate && now - w.ate < 6000);
      }
      if (near) said('fxwbc', '白细胞一个个爬到我刚才站过的地方，围成一圈。我是从第四个方向插进来的，在它们看来那里有个伤口。', 'One by one, white cells crawl to where I just stood and gather round it. I came in from the fourth direction; to them, there\'s a wound there.');
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
