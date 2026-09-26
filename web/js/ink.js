// 水墨：整张纸是一幅画。画里的山水是一处处局部的小景（奇峰、瀑布崖、江岸柳村、远山云雾……）随手拼起来的，
// 不讲整幅的章法，小景之间用云雾和留白接上；全图的时候外面裱一圈，看得出是一幅画。
// 只靠种子，不依赖游戏里别的脚本：预览页 ink-lab.html 和游戏共用这一份。单位是美术像素（游戏里一格 4×4 个）。
//
// SHANSHUI.region(seed, x0, y0, w, h, sc) → { rgba, kind }：画出地图上任意一块；sc 是一个墨点占几个美术像素（默认 2，和别的地貌一样粗）。kind 每个像素一个地形编号（和 world.js 九种地形同序）：
//   坡地 = 绢上的留白（居民住这儿）  坡岸 = 近处的地面  水  山石  远山  林木  云雾  深潭 = 瀑布下的潭
// SHANSHUI.frame(rgba, w, h, seed) → 裱好的整幅（立轴的样子）
const SHANSHUI = (() => {
  const T2 = Math.PI * 2;
  const K = { deep: 0, water: 1, sand: 2, grass: 3, forest: 4, rock: 5, peak: 6, snow: 7, rift: 8 };
  const rng = s => { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hash = (x, y, s) => { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const n1 = (x, s) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, 0, s) * (1 - u) + hash(i + 1, 0, s) * u; };
  const n2 = (x, y, s) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const cl = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // --- 颜料 -----------------------------------------------------------------------
  const C = {
    ink: [36, 32, 30], inkM: [78, 72, 66], inkL: [132, 126, 118],
    ochre: [170, 116, 72], ochreL: [198, 156, 112], indigo: [80, 100, 122], indigoL: [138, 154, 166],
    malachite: [58, 138, 100], malachiteL: [112, 170, 134], azurite: [46, 98, 146], azuriteL: [104, 146, 178],
    gold: [206, 162, 74], cinnabar: [184, 50, 36], rouge: [176, 64, 60], gamboge: [200, 166, 66],
    pine: [44, 74, 56], leaf: [70, 104, 68], bamboo: [66, 116, 78], trunk: [98, 72, 52], thatch: [176, 140, 90], wall: [226, 214, 186],
  };
  const SILK = [[214, 196, 158], [224, 208, 170], [204, 184, 144], [230, 218, 186]];          // 绢：新旧不一
  const MOUNT = [                                                                                   // 绫的颜色：面、隔水、轴
    { face: [180, 190, 180], band: [118, 104, 82], rod: [70, 50, 36], knob: [230, 226, 210] },
    { face: [200, 186, 152], band: [94, 70, 50], rod: [60, 44, 34], knob: [196, 160, 90] },
    { face: [158, 168, 178], band: [108, 84, 60], rod: [52, 40, 34], knob: [120, 170, 150] },
    { face: [196, 170, 138], band: [66, 78, 92], rod: [74, 52, 38], knob: [236, 232, 220] },
    { face: [170, 150, 150], band: [80, 96, 86], rod: [58, 42, 36], knob: [200, 196, 180] },
  ];
  const PAPER_C = [251, 250, 247];

  // --- 画布 -----------------------------------------------------------------------
  // 画布：颜色、盖住了多少（al，0 是透明）、每个像素算什么地形（255 = 这块画布没管）
  function Pic(w, h, bg, bgKind = 255, clear = false, mono = false) {   // mono：画里只用墨
    const d = new Float32Array(w * h * 3), al = new Float32Array(w * h).fill(clear ? 0 : 1), kd = new Uint8Array(w * h).fill(bgKind);
    for (let i = 0; i < w * h; i++) { d[i * 3] = bg[0]; d[i * 3 + 1] = bg[1]; d[i * 3 + 2] = bg[2]; }
    const put = (x, y, c, a = 1, k = -1) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= w || y >= h || !(a > 0.004)) return;
      if (a > 1) a = 1;
      if (mono && c !== C.cinnabar) { const l = c[0] * .3 + c[1] * .59 + c[2] * .11; c = [l, l, l]; }   // 只用墨：什么颜色都化成灰，印章除外
      const j = y * w + x, i = j * 3;
      d[i] += (c[0] - d[i]) * a; d[i + 1] += (c[1] - d[i + 1]) * a; d[i + 2] += (c[2] - d[i + 2]) * a;
      al[j] += (1 - al[j]) * a;
      if (k >= 0) kd[j] = k;
    };
    const rect = (x, y, rw, rh, c, a = 1, k = -1) => { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) put(x + i, y + j, c, a, k); };
    return { w, h, d, al, kd, put, rect };
  }
  // 一笔：两头细中间粗；dry 是飞白（跳过的比例）
  function line(P, R, x0, y0, x1, y1, c, a, wd = 1, dry = 0, k = -1) {
    const L = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
    for (let s = 0; s <= L; s++) {
      if (dry && R() < dry) continue;
      const t = s / L, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, ww = wd * (.55 + .45 * Math.sin(Math.PI * t));
      if (ww < 1.5) { P.put(x, y, c, a, k); continue; }
      const r = ww / 2;
      for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) if (dx * dx + dy * dy <= r * r) P.put(x + dx, y + dy, c, a * .6, k);
    }
  }
  const dot = (P, x, y, r, c, a, k = -1) => { for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) if (dx * dx + dy * dy <= r * r + .3) P.put(x + dx, y + dy, c, a, k); };
  // 小像素图：字母对应颜色，'.' 不画；以底边中点为锚
  function sprite(P, rows, x, y, pal, k = -1, flip = false) {
    const h = rows.length, w = rows[0].length;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const ch = rows[j][flip ? w - 1 - i : i];
      if (ch !== '.' && pal[ch]) P.put(x - (w >> 1) + i, y - h + 1 + j, pal[ch][0], pal[ch][1] ?? 1, k);
    }
  }

  // --- 山 -------------------------------------------------------------------------
  // 设色：水墨只用墨；浅绛山头淡花青、山身淡赭；青绿、金碧山头石绿、往下石青、山脚赭石
  const hue = tone => tone < .35 ? mix(C.inkL, [200, 198, 194], .3) : mix(C.inkM, C.ink, tone * .6);   // 远山淡、近山浓，都是墨
  // 一座山（或一列山）：返回山脊高度函数 ridgeAt(x)，方便往山上放树、放房子
  function mountain(P, R, o) {
    const { x0, x1, base, top, tone, tex, style } = o, W = Math.max(8, Math.round(x1 - x0)), H = base - top, sd = (R() * 1e6) | 0;
    const pk = [], n = 1 + ((R() * 3) | 0);
    for (let i = 0; i < n; i++) pk.push({ u: i === 0 ? (o.peakU ?? .3 + R() * .4) : .08 + R() * .84, h: i === 0 ? 1 : .3 + R() * .45, w: o.flat ? .45 + R() * .3 : (o.steep ? .12 : .2) + R() * .22 });
    const ridge = new Float32Array(W + 1);
    for (let i = 0; i <= W; i++) {
      const u = i / W;
      let v = 0;
      for (const p of pk) { const t = (u - p.u) / p.w; if (Math.abs(t) < 1) v = Math.max(v, p.h * (1 - t * t) ** (o.steep ? 1 : 1.5)); }
      v = v * Math.min(1, u * 6, (1 - u) * 6) ** .6 + (n1(u * 7, sd) - .5) * .16 + (n1(u * 19, sd + 1) - .5) * .09 + (n1(u * 45, sd + 2) - .5) * .03;   // 远山也一起一伏好几下
      ridge[i] = base - Math.max(0, v) * H;
    }
    const at = x => ridge[Math.max(0, Math.min(W, Math.round(x - x0)))];
    const fade = H * (o.fade ?? .38), kd = tone < .35 ? K.peak : K.rock, inkC = mix(C.inkL, C.ink, tone);
    for (let i = 0; i <= W; i++) {                           // 山体：淡墨或设色的一层染，山脚化进云雾里
      const yt = ridge[i];
      if (yt >= base - 1) continue;
      const slope = (ridge[Math.min(W, i + 1)] - ridge[Math.max(0, i - 1)]) / 2;
      for (let y = Math.ceil(yt); y < base; y++) {
        const dd = y - yt, m = cl((base - y) / fade), a = (.3 + .5 * tone) * m * (slope > .3 ? 1.12 : slope < -.3 ? .88 : 1);   // 光从左来，右坡暗一点
        P.put(x0 + i, y, hue(tone), a, m > .35 ? kd : -1);
      }
    }
    const area = W * H / 70;                                 // 皴：按山的大小决定笔数
    const inside = (x, y) => y > at(x) + 1 && y < base - fade * .3;
    if (tex === 'pima') for (let s = 0; s < area; s++) {       // 披麻皴：顺着山势往下的长线，干笔
      let x = x0 + R() * W, y = at(x) + 1 + R() * H * .5;
      if (!inside(x, y)) continue;
      const L = 8 + R() * 22, sl = (at(x + 2) - at(x - 2)) / 4;
      let px = x, py = y;
      for (let t = 0; t < L; t++) {
        const nx = px + Math.sign(sl) * .35 + (n1(t * .4, s) - .5) * .5, ny = py + 1;
        if (!inside(nx, ny)) break;
        if (R() > .25) P.put(nx, ny, inkC, (.24 + .34 * tone) * (1 - t / L * .5), kd);
        px = nx; py = ny;
      }
    }
    if (tex === 'fupi') for (let s = 0; s < area * .6; s++) {  // 斧劈皴：短而斜的方笔，墨重
      const x = x0 + R() * W, y = at(x) + 2 + R() * H * .55;
      if (!inside(x, y)) continue;
      const L = 4 + R() * 7, a = 1.1 + R() * .5;
      line(P, R, x, y, x - Math.cos(a) * L, y + Math.sin(a) * L, inkC, .3 + .25 * tone, 2.2, .25, kd);
    }
    if (tex === 'midian') for (let s = 0; s < area * 1.4; s++) {   // 米点：一层层横着的湿墨点，越靠山脊越密
      const x = x0 + R() * W, y = at(x) + 1 + (R() ** 1.6) * H * .6;
      if (!inside(x, y)) continue;
      for (let dx = -2; dx <= 2; dx++) P.put(x + dx, y, inkC, (.18 + .25 * tone) * (Math.abs(dx) === 2 ? .5 : 1), kd);
      P.put(x, y - 1, inkC, .15 + .2 * tone, kd);
    }
    const edge = inkC;                                         // 山脊勾一道线
    for (let i = 0; i <= W; i++) {
      if (ridge[i] >= base - fade * .5) continue;
      const a = (.5 + .45 * tone) * (.6 + .4 * n1(i / 6, sd + 2));
      P.put(x0 + i, ridge[i], edge, a, kd);
      if (tone > .45 && n1(i / 4, sd + 3) > .4) P.put(x0 + i, ridge[i] + 1, edge, a * .7, kd);
    }
    if (tone > .45) for (let i = 2; i < W - 2; i += 5 + ((R() * 9) | 0)) {   // 点苔
      if (ridge[i] < base - fade) dot(P, x0 + i, ridge[i] - .5, R() < .3 ? 1.2 : .6, C.ink, .75, kd);
    }
    return at;
  }
  // 一座由好几块山石叠起来的山：每块自己一道多次起伏的山脊，勾一道重墨边、点苔，
  // 皴线顺着这一块的轮廓一道道往下走；块和块之间的缝里墨最重，前面的块盖住后面的。返回山顶那条线 ridgeAt(x)
  function massif(P, R, o) {
    const { x0, x1, base, top, tone } = o, W = x1 - x0, H = base - top, sd = (R() * 1e6) | 0, tex = o.tex ?? 'pima';
    const n = o.lumps ?? 4 + ((R() * 5) | 0), pu = o.peakU ?? .3 + R() * .4, lumps = [];
    for (let i = 0; i < n; i++) {
      const u = i === 0 ? pu : .08 + R() * .84, near = 1 - Math.min(1, Math.abs(u - pu) * 1.6);   // 离主峰越近越高
      const hh = H * (i === 0 ? 1 : .3 + .6 * near * (.6 + R() * .4)), yt = base - hh;
      lumps.push({ cx: x0 + W * u, w: Math.max(W * (.1 + R() * .14) * (i === 0 ? 1.3 : 1), hh * .55), yt, yb: Math.min(base, yt + hh * (.6 + R() * .5)), sd: sd + i * 17, flat: R() < (o.flatness ?? .3) * .6 });
    }
    lumps.sort((a, b) => a.yb - b.yb);                         // 下沿越高的越靠后，先画
    const fade = H * (o.fade ?? .3), kd = tone < .35 ? K.peak : K.rock, ink = mix(C.inkL, C.ink, tone);
    const edgeOf = L => x => {                                  // 这一块的顶：圆的或平顶的，上面再起伏几下
      const t = (x - L.cx) / L.w;
      if (Math.abs(t) >= 1) return Infinity;
      const sh = L.flat ? (1 - t ** 4) ** 1.5 : (1 - t * t) ** .9, bump = (n1(x / 6, L.sd) - .5) * .22 + (n1(x / 17, L.sd + 1) - .5) * .4;
      return L.yb - (L.yb - L.yt) * cl(sh * (1 + bump));
    };
    const edges = lumps.map(edgeOf);
    lumps.forEach((L, li) => {
      const e = edges[li], hL = L.yb - L.yt, xa = Math.floor(L.cx - L.w), xb = Math.ceil(L.cx + L.w);
      for (let x = xa; x <= xb; x++) {                          // 先用纸色盖掉后面的，再染：上面淡、往下重，贴着下沿的缝最重
        const yt = e(x);
        if (!isFinite(yt) || yt >= L.yb - 1) continue;
        for (let y = Math.ceil(yt); y < L.yb; y++) {
          const f = (y - yt) / (L.yb - yt), k = cl((L.yb - y) / (hL * .35)) * cl((base - y) / fade);   // 下半截慢慢淡掉，化进下面那块或云雾里
          P.put(x, y, o.bg, .92 * k, k > .35 ? kd : -1);
          P.put(x, y, hue(tone), ((.08 + .22 * tone) + .32 * f * f) * k);
        }
      }
      if (tex === 'midian') {                                   // 米点：一层层横着的湿墨点
        for (let s = 0; s < L.w * hL / 12; s++) { const x = L.cx + (R() * 2 - 1) * L.w, yt = e(x), y = yt + 1 + R() ** 1.5 * (L.yb - yt) * .7; if (!isFinite(yt)) continue; for (let dx = -2; dx <= 2; dx++) P.put(x + dx, y, ink, (.25 + .3 * tone) * (Math.abs(dx) === 2 ? .5 : 1)); }
      } else for (let d = 3; d < hL * .85; d += 3 + R() * 3) {   // 披麻、斧劈：顺着轮廓一道道往下的线，越往下越断续
        const dry = tex === 'fupi' ? .55 : .35;
        for (let x = xa; x <= xb; x++) {
          const yt = e(x);
          if (!isFinite(yt)) continue;
          const y = yt + d * (1 + .3 * (n1(x / 9, L.sd + d) - .5)) * (tex === 'fupi' ? 1 + Math.abs(x - L.cx) / L.w * .6 : 1);
          if (y >= L.yb - 1 || R() < dry + d / hL * .3) continue;
          P.put(x, y, ink, (.2 + .3 * tone) * (1 - d / hL * .6) * cl((L.yb - y) / (hL * .35)) * cl((base - y) / fade));
          if (tex === 'fupi' && R() < .25) P.put(x + 1, y + 1, ink, (.2 + .3 * tone) * .8);
        }
      }
      for (let x = xa; x <= xb; x++) {                          // 勾边，边上点苔
        const yt = e(x);
        if (!isFinite(yt) || yt >= L.yb - 2) continue;
        const a = (.5 + .45 * tone) * (.6 + .4 * n1(x / 5, L.sd + 2)) * cl((base - yt) / fade);
        P.put(x, yt, C.ink, a, kd);
        if (tone > .4 && n1(x / 4, L.sd + 3) > .45) P.put(x, yt + 1, C.ink, a * .7, kd);
        if (tone > .4 && hash(x, li, L.sd) < .12) dot(P, x, yt - .5, .7 + R() * .8, C.ink, .8, kd);
      }
    });
    return x => { let m = base; for (const e of edges) { const y = e(x); if (y < m) m = y; } return m; };
  }
  // 云雾：一条横着的留白，把前后山隔开
  function mist(P, bg, y, thick, sd) {
    for (let x = 0; x < P.w; x++) {
      const off = (n1(x / 45, sd) - .5) * thick * 1.4, amt = .75 + .25 * n1(x / 13, sd + 1);
      for (let dy = -thick * 1.6; dy <= thick * 1.6; dy++) {
        const a = Math.exp(-((dy / thick) ** 2) * 1.6) * amt;
        P.put(x, y + dy + off, bg, a, a > .55 ? K.snow : -1);
      }
    }
  }
  // 水：留白，只画几道水纹；越远越稀
  function water(P, R, x0, x1, y0, y1, far = y0) {
    for (let y = Math.max(0, Math.round(y0)); y < Math.min(P.h, y1); y++) for (let x = Math.max(0, Math.round(x0)); x < Math.min(P.w, x1); x++) { const j = y * P.w + x; if (P.kd[j] === 255 || P.kd[j] === K.grass) P.kd[j] = K.water; }
    for (let y = y0 + 2; y < y1 - 1; y += 3 + R() * 4) {
      const near = cl((y - far) / Math.max(1, y1 - far)), n = (x1 - x0) / 40 * (.4 + near * 1.4);
      for (let s = 0; s < n; s++) {
        const x = x0 + R() * (x1 - x0), L = 4 + R() * 12 * (.5 + near);
        for (let t = 0; t < L; t++) P.put(x + t, y + Math.sin(t / L * Math.PI) * -.8, mix(C.indigoL, C.inkM, near * .5), (.12 + .18 * near) * Math.sin(t / L * Math.PI));
      }
    }
  }
  function waterfall(P, R, x, y0, y1, bg) {                     // 瀑布：一道留白，两边淡淡勾线
    for (let y = y0; y < y1; y++) {
      const w = 2 + (y - y0) / (y1 - y0) * 2, sway = Math.sin(y / 9) * .6;
      for (let dx = -w; dx <= w; dx++) P.put(x + dx + sway, y, bg, .95, K.snow);
      P.put(x - w - 1 + sway, y, C.inkL, .35); P.put(x + w + 1 + sway, y, C.inkL, .35);
      if (R() < .3) P.put(x + (R() - .5) * w * 2 + sway, y, C.indigoL, .3);
    }
  }

  // --- 树 -------------------------------------------------------------------------
  function trunk(P, R, x, y, h, lean, wd = 2) {
    const pts = [];
    for (let s = 0; s <= h; s++) {
      const xx = x + lean * s + Math.sin(s * .35) * .5, yy = y - s;
      pts.push([xx, yy]);
      P.put(xx, yy, C.trunk, .9, K.forest);
      if (wd > 1 && s < h * .7) P.put(xx + 1, yy, mix(C.trunk, C.ink, .5), .9, K.forest);
    }
    return pts;
  }
  function pine(P, R, x, y, h) {                                // 松：高干，横出的枝，枝头一团团扁圆的松针
    const pts = trunk(P, R, x, y, h, (R() - .5) * .4);
    for (let s = 3; s < h - 2; s += 3 + R() * 3) { const [bx, by] = pts[Math.round(s)]; P.put(bx + (R() < .5 ? 0 : 1), by, C.ink, .7, K.forest); }   // 树皮上的鳞
    const pad = (cx, cy, rx) => {                               // 一团松针：从中间往四周扫的短线，压扁，中间墨重
      for (let a = 0; a < Math.PI * 2; a += .28) {
        const r = rx * (.7 + R() * .4);
        line(P, R, cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r * .45, C.pine, .75, 1, .1, K.forest);
      }
      dot(P, cx, cy, rx * .35, C.ink, .8, K.forest);
    };
    const nb = 3 + ((R() * 3) | 0);
    for (let b = 0; b < nb; b++) {
      const [bx, by] = pts[Math.round(h * (.35 + .65 * b / nb))], side = b % 2 ? 1 : -1, L = 3 + R() * h * .4;
      const ex = bx + side * L, ey = by - 1 - R() * 3;
      line(P, R, bx, by, ex, ey, C.trunk, .9, 1, 0, K.forest);
      pad(ex, ey - 1, 4 + R() * 3);
      if (R() < .6) pad(ex - side * L * .45, ey - 2, 3 + R() * 2);
    }
    const [tx, ty] = pts[pts.length - 1];
    pad(tx, ty - 1, 4 + R() * 2);
  }
  function conifer(P, R, x, y, h) {                             // 杉：直直一根干，一层层横着的短笔叠成塔形（山脊上那种）
    for (let t = 0; t < h; t++) P.put(x, y - t, C.ink, .8, K.forest);
    const levels = Math.max(3, Math.round(h / 2));
    for (let k = 0; k < levels; k++) {
      const yy = y - h * .2 - k * (h * .8 / levels), hw = (h * .28) * (1 - k / levels) + 1;
      for (const s of [-1, 1]) line(P, R, x, yy, x + s * hw, yy + 1 + hw * .25, C.ink, .75, 1, .2, K.forest);
    }
  }

  function leafy(P, R, x, y, h, style) {                        // 杂树：分叉的干，几团点叶；秋天是赭和胭脂
    const pts = trunk(P, R, x, y, h * .6, (R() - .5) * .4);
    const [tx, ty] = pts[pts.length - 1], autumn = R() < .35;
    const pal = style === 'ink' ? [C.ink, C.inkM] : autumn ? [C.rouge, C.ochre, C.gamboge] : [C.leaf, mix(C.leaf, C.ink, .4), C.malachiteL];
    const nc = 3 + ((R() * 3) | 0);
    for (let c = 0; c < nc; c++) {
      const cx = tx + (R() - .5) * h * .6, cy = ty - R() * h * .45, r = 3 + R() * h * .18;
      line(P, R, tx, ty + 2, cx, cy + 1, C.trunk, .8, 1, 0, K.forest);
      for (let s = 0; s < r * r * 1.6; s++) {               // 介字点：一个个小小的「个」
        const a = R() * T2, d = Math.sqrt(R()) * r, px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * .75, col = pal[(R() * pal.length) | 0];
        P.put(px, py, col, .75, K.forest); P.put(px - 1, py + 1, col, .45, K.forest); P.put(px + 1, py + 1, col, .45, K.forest);
      }
    }
  }
  function willow(P, R, x, y, h) {                              // 柳：垂下来的细枝
    const pts = trunk(P, R, x, y, h * .55, (R() - .5) * .3);
    const [tx, ty] = pts[pts.length - 1];
    for (let s = 0; s < 14; s++) {
      const sx = tx + (R() - .5) * h * .5, sy = ty - R() * h * .3, L = h * (.3 + R() * .4), dir = sx > tx ? 1 : -1;
      for (let t = 0; t < L; t++) P.put(sx + dir * Math.sin(t / L * 1.2) * 3, sy + t, mix(C.malachiteL, C.leaf, .4), .55 * (1 - t / L * .5), K.forest);
    }
  }
  function bamboo(P, R, x, y, h) {                              // 竹：几竿带节的竹子，顶上一组组「个」字叶
    const n = 3 + ((R() * 4) | 0);
    for (let s = 0; s < n; s++) {
      const bx = x + (s - n / 2) * 3 + (R() - .5) * 2, bh = h * (.6 + R() * .4), lean = (R() - .5) * .15;
      for (let t = 0; t < bh; t++) P.put(bx + lean * t, y - t, t % 6 === 0 ? mix(C.bamboo, C.ink, .6) : C.bamboo, .9, K.forest);
      for (let l = 0; l < 4; l++) {
        const ly = y - bh * (.5 + R() * .5), lx = bx + lean * (y - ly), side = R() < .5 ? -1 : 1;
        for (const a of [.3, .6, .9]) line(P, R, lx, ly, lx + side * Math.cos(a) * 5, ly + Math.sin(a) * 2.5, mix(C.bamboo, C.ink, .5), .8, 1, 0, K.forest);
      }
    }
  }
  function reeds(P, R, x, y, w) {                               // 芦苇：水边一丛细弯的秆，头上一点赭
    for (let s = 0; s < w * .8; s++) {
      const bx = x + R() * w, L = 5 + R() * 9, bend = (R() - .3) * 3;
      for (let t = 0; t < L; t++) P.put(bx + bend * (t / L) ** 2, y - t, C.inkL, .6, K.forest);
      P.put(bx + bend, y - L, C.ochre, .8, K.forest); P.put(bx + bend, y - L - 1, C.ochreL, .6, K.forest);
    }
  }
  function deadTree(P, R, x, y, h) {                            // 枯树：蟹爪一样的枝
    const grow = (bx, by, a, L, d) => {
      const ex = bx + Math.cos(a) * L, ey = by + Math.sin(a) * L;
      line(P, R, bx, by, ex, ey, C.ink, .85, d > 2 ? 2 : 1, 0, K.forest);
      if (d > 0) for (const s of [-1, 1]) grow(ex, ey, a + s * (.35 + R() * .4), L * (.6 + R() * .15), d - 1);
    };
    grow(x, y, -Math.PI / 2 + (R() - .5) * .3, h * .35, 4);
  }

  // --- 点景：房子、船、人 ---------------------------------------------------------------
  const PAV = ['K............K', 'KK...KKKK...KK', '.KKKKKKKKKKKK.', '..KKKKKKKKKK..', '...r......r...', '...r......r...', '...r......r...', '..OOOOOOOOOO..'];
  const HUT = ['....TTTTTT....', '..TTTTTTTTTT..', 'TTTTTTTTTTTTTT', '.WWWWWWKKWWWW.', '.WWWWWWKKWWWW.', '.WWWWWWKKWWWW.'];
  const PAGODA = ['...K...', '..KKK..', '...W...', '.KKKKK.', '..WWW..', 'KKKKKKK', '..WKW..', 'KKKKKKK', '.WWKWW.', 'KKKKKKK', '.WWKWW.', '.WWWWW.'];
  const BOAT = ['........KKK.......', '.......KKKKK......', '........OO........', '........OO........', 'KKKKKKKKKKKKKKKKKK', '.KKKKKKKKKKKKKKKK.', '...KKKKKKKKKKKK...'];
  const RIDER = ['..KK..', '..OO..', '.OOOO.', 'KKKKKK', 'K.K.K.'];
  const SCHOLAR = ['.KK.', '.WW.', 'WWWW', 'WWWW', '.WW.'];
  const housePal = style => ({ K: [C.ink, .85], r: [style === 'ink' ? C.inkM : C.cinnabar, .9], O: [C.ochre, .8], T: [C.thatch, .9], W: [C.wall, .95] });
  const boatPal = { K: [C.inkM, .85], O: [C.ochre, .85] };
  function boat(P, R, x, y, flip) {                             // 渔舟：蓑笠翁，一根钓竿一根线
    sprite(P, BOAT, x, y, boatPal, K.deep, flip);
    const hx = x + (flip ? -1 : 1), hy = y - 3, s = flip ? -1 : 1;
    line(P, R, hx, hy, hx + s * 14, hy - 8, C.inkM, .7, 1, 0);
    for (let t = 0; t < 7; t++) P.put(hx + s * 14, hy - 8 + t, C.inkL, .5);
  }
  function sail(P, x, y) { for (let j = 0; j < 6; j++) for (let i = 0; i <= j / 2; i++) P.put(x + i, y - 6 + j, C.wall, .9); for (let i = -2; i < 4; i++) P.put(x + i, y, C.inkM, .6); }
  function birds(P, R, x, y, n) { for (let b = 0; b < n; b++) { const bx = x + R() * 30, by = y + R() * 12; for (const [dx, dy] of [[-2, -1], [-1, 0], [0, 0], [1, 0], [2, -1]]) P.put(bx + dx, by + dy, C.ink, .7); } }

  // 塔：几层翘角的飞檐，每层一扇黑窗，顶上塔刹；塔下一堆墨很重的石头和树
  function pagoda(P, R, x, y, tiers) {
    let bw = 3 + tiers * .8, yy = y;
    for (let t = 0; t < tiers; t++) {
      const bh = Math.max(3, 5 - t * .5 | 0);
      for (let j = 0; j < bh; j++) for (let i = -Math.round(bw); i <= Math.round(bw); i++) P.put(x + i, yy - j, Math.abs(i) >= Math.round(bw) ? C.ink : C.wall, Math.abs(i) >= Math.round(bw) ? .85 : .9, K.rock);
      for (let j = 1; j < bh - 1; j++) P.put(x, yy - j, C.ink, .9, K.rock);   // 窗
      yy -= bh;
      const ew = bw + 3 + (tiers - t) * .4;                     // 飞檐：比塔身宽一截，两头往上翘
      for (let i = -ew; i <= ew; i++) {
        const lift = (Math.abs(i) / ew) ** 3 * 2.5;
        P.put(x + i, yy - lift, C.ink, .9, K.rock); P.put(x + i, yy - lift - 1, C.ink, Math.abs(i) < ew - 1 ? .85 : .5, K.rock);
      }
      yy -= 2; bw *= .82;
    }
    for (let j = 0; j < 7; j++) P.put(x, yy - j, C.ink, .9, K.rock);   // 塔刹
    for (const j of [2, 4]) { P.put(x - 1, yy - j, C.ink, .8, K.rock); P.put(x + 1, yy - j, C.ink, .8, K.rock); }
    for (let s = 0; s < 40; s++) {                              // 塔脚的石头和树：一笔笔重墨
      const a = R() * Math.PI, r = 4 + R() * (bw * 3 + 6);
      line(P, R, x + Math.cos(a) * r * 1.2, y + 1 + R() * 3, x + Math.cos(a) * r * 1.2 + (R() - .5) * 4, y + 6 + R() * 8, C.ink, .55, 2, .3, K.rock);
    }
  }
  // 篷船：船身两头翘，中间一顶编出交叉纹的篷
  function canopyBoat(P, R, x, y, flip) {
    const s = flip ? -1 : 1;
    for (let i = -13; i <= 13; i++) { const lift = (Math.abs(i) / 13) ** 2.5 * 3 * (i * s > 0 ? 1.3 : 1); P.put(x + i, y - lift, C.ink, .85, K.water); P.put(x + i, y - lift + 1, C.inkM, .6, K.water); }
    for (let i = -6; i <= 5; i++) for (let j = 1; j <= 5; j++) {
      const arc = Math.sqrt(Math.max(0, 1 - ((i + .5) / 6.5) ** 2)) * 5;
      if (j > arc) continue;
      const edgeP = j > arc - 1 || Math.abs(i + .5) > 5.5;
      P.put(x + i * s, y - 1 - j, edgeP ? C.ink : C.inkM, edgeP ? .85 : (i + j) % 2 ? .5 : .2, K.water);   // 篷上的编纹
    }
    for (let t = 0; t < 10; t++) P.put(x + s * (-10 - t * .9), y - 2 - t * .6, C.inkM, .6);   // 船尾一支篙
  }
  const BUFFALO = ['...KK.......', 'KKKKKKKKKK..', '.KKKKKKKKKKK', '.KKKKKKKKKK.', '.K.K....K.K.', '.K.K....K.K.'];
  function herdBoy(P, x, y, flip) {                             // 牧童骑牛
    sprite(P, BUFFALO, x, y, { K: [C.ink, .85] }, K.sand, flip);
    sprite(P, ['.K.', 'KWK', '.K.'], x + (flip ? 1 : -1), y - 6, { K: [C.ink, .9], W: [C.wall, .9] }, K.sand);
  }
  // --- 题款与印章 ------------------------------------------------------------------------
  function glyph(P, R, x, y, c, a) {                            // 一个像字的东西：5×5 里几笔横竖撇捺点
    const n = 3 + ((R() * 3) | 0);
    for (let s = 0; s < n; s++) {
      const k = (R() * 5) | 0, gx = (R() * 5) | 0, gy = (R() * 5) | 0;
      if (k === 0) for (let i = 0; i < 5; i++) P.put(x + i, y + gy, c, a);
      else if (k === 1) for (let j = 0; j < 5; j++) P.put(x + gx, y + j, c, a);
      else if (k === 2) for (let i = 0; i < 3; i++) P.put(x + gx - i, y + i + 1, c, a);
      else if (k === 3) for (let i = 0; i < 3; i++) P.put(x + gx + i, y + i + 1, c, a);
      else P.put(x + gx, y + gy, c, a);
    }
  }
  function inscription(P, R, x, y, cols, len) {                 // 从右往左竖着写几行，末尾一方名章
    for (let c = 0; c < cols; c++) {
      const n = Math.max(3, Math.round(len * (c === cols - 1 ? .5 + R() * .4 : 1)));
      for (let g = 0; g < n; g++) glyph(P, R, x - c * 7, y + g * 7, C.ink, .8);
      if (c === cols - 1) seal(P, R, x - c * 7 - 1, y + n * 7 + 2, 7, R() < .5);
    }
  }
  function seal(P, R, x, y, s, white) {                         // 朱文：红字；白文：红底白字
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      const border = i === 0 || j === 0 || i === s - 1 || j === s - 1, stroke = hash(i, j, (R() * 1e6) | 0) < .45;
      if (white ? !(stroke && !border) : border || stroke) P.put(x + i, y + j, C.cinnabar, .9);
    }
  }

  // --- 小景 ----------------------------------------------------------------------------
  // 每处小景画在一块透明的画布上（VW×VH），中间那块是它自己的格子，四周多出来的一圈淡出去、和邻居叠在一起。
  function ground(P, R, o, x0, x1, top, base) {                // 一道又宽又低的缓坡，算坡岸
    const at = mountain(P, R, { x0, x1, base, top: base - (base - top) * .7, tone: .9, tex: o.tex === 'midian' ? 'pima' : o.tex, style: o.style, fade: .6, flat: true });
    for (let x = Math.max(0, Math.ceil(x0)); x < Math.min(P.w, x1); x++) for (let y = Math.max(0, Math.ceil(at(x)) + 1); y < Math.min(P.h, base); y++) if (P.kd[y * P.w + x] === K.rock) P.kd[y * P.w + x] = K.sand;
    for (let x = x0; x < x1; x += 3 + R() * 6) { const y = at(x); if (y < base - 2) P.put(x, y - 1, C.inkM, .6, K.sand); }   // 坡上的草点
    return at;
  }
  function plant(P, R, o, x, y, h, kinds) {                   // 在一个位置种一棵随机的树
    const k = kinds[(R() * kinds.length) | 0];
    if (k === 'pine') pine(P, R, x, y, h); else if (k === 'leafy') leafy(P, R, x, y, h, o.style); else if (k === 'willow') willow(P, R, x, y, h);
    else if (k === 'bamboo') bamboo(P, R, x, y, h * .8); else if (k === 'conifer') conifer(P, R, x, y, h * .6); else deadTree(P, R, x, y, h);
  }
  function mesa(P, R, o, x0, x1, top, base) {                  // 方崖：顶上平一点、四周陡，长满苔点（奇峰前面那块）
    const at = mountain(P, R, { x0, x1, base, top, tone: .85, tex: 'fupi', style: o.style, flat: true, fade: .3 });
    for (let x = x0 + 2; x < x1 - 2; x += 1 + R() * 3) { const y = at(x); if (y < base - 8) dot(P, x + (R() - .5) * 2, y + R() * 5, .8 + R() * .9, C.ink, .8, K.rock); }
    return at;
  }
  const HOUSE_PAL = o => ({ K: [C.ink, .85], r: [o.style === 'ink' ? C.inkM : C.cinnabar, .9], O: [C.ochre, .8], T: [C.thatch, .9], W: [C.wall, .95] });
  const VW = 280, VH = 220;
  const VIG = {
    // 奇峰：后面几座平顶的高峰（山脊上长着杉），前面一块长满苔点的方崖，崖顶几棵松，山脚一间屋
    qifeng(P, R, o) {
      const n = 2 + ((R() * 2) | 0);
      for (let i = 0; i < n; i++) {
        const cx = VW * (.2 + R() * .6), w = VW * (.1 + R() * .08);
        const top = massif(P, R, { x0: cx - w, x1: cx + w, base: VH * .62, top: VH * (.04 + R() * .12), tone: .35 + R() * .15, tex: 'pima', lumps: 3 + ((R() * 2) | 0), flatness: .6, bg: o.bg });
        for (let t = 0; t < 2; t++) { const x = cx + (R() - .5) * w; conifer(P, R, x, top(x) + 1, 5 + R() * 4); }
      }
      mist(P, o.bg, VH * .55, VH * .035, R() * 1e6);
      const mx0 = VW * (.18 + R() * .15), mx1 = mx0 + VW * (.35 + R() * .15);
      const top = massif(P, R, { x0: mx0, x1: mx1, base: VH * .82, top: VH * .3, tone: .85, tex: 'fupi', lumps: 3, flatness: .85, peakU: .5, bg: o.bg });
      for (let x = mx0 + 3; x < mx1 - 3; x += 1 + R() * 2) { const y = top(x); if (y < VH * .75) dot(P, x + (R() - .5) * 2, y + R() * 4, .7 + R() * .9, C.ink, .85, K.rock); }   // 崖顶密密的苔点
      for (let t = 0; t < 2 + R() * 3; t++) { const x = mx0 + (mx1 - mx0) * (.2 + R() * .6); pine(P, R, x, top(x) + 1, 9 + R() * 9); }
      const gr = ground(P, R, o, VW * .08, VW * .92, VH * .78, VH * .9);
      const hx = VW * (R() < .5 ? .22 : .78); sprite(P, HUT, hx, gr(hx) + 1, HOUSE_PAL(o), K.sand, R() < .5);
    },
    // 瀑布崖：一面由好几块山石叠成的大崖，瀑布从崖缝挂下来，崖腰一座亭，崖脚一片树和一汪潭
    pubu(P, R, o) {
      const cx = VW * (.4 + R() * .2), cliff = massif(P, R, { x0: cx - VW * .34, x1: cx + VW * .34, base: VH * .82, top: VH * .04, tone: .7, tex: 'pima', lumps: 6, peakU: .45, bg: o.bg });
      for (let t = 0; t < 3; t++) { const x = cx + VW * (-.25 + R() * .5); conifer(P, R, x, cliff(x) + 1, 5 + R() * 4); }
      const wx = cx + VW * .06, wy = Math.round(cliff(wx) + VH * .22);
      waterfall(P, R, wx, wy, Math.round(VH * .82), o.bg);
      P.falls.push([wx, wy, Math.round(VH * .82), 3]);          // 记下来，游戏里让它流
      sprite(P, PAV, wx + 14, wy + 4, HOUSE_PAL(o), K.rock);
      water(P, R, cx - VW * .25, cx + VW * .3, VH * .82, VH * .9, VH * .82);
      for (let y = Math.round(VH * .82); y < VH * .9; y++) for (let x = Math.round(wx - 10); x < wx + 10; x++) if (P.kd[y * P.w + x] === K.water) P.kd[y * P.w + x] = K.deep;
      for (let t = 0; t < 5; t++) { const x = cx + VW * (-.3 + R() * .6); plant(P, R, o, x, VH * (.82 + R() * .03), 10 + R() * 12, ['pine', 'pine', 'leafy', 'conifer']); }
    },
    // 远山云雾：几层起起伏伏的淡远山，中间隔着云雾，天上几只鸟
    yuanshan(P, R, o) {
      for (let k = 0; k < 3; k++) {
        const top = VH * (.18 + k * .15);
        mountain(P, R, { x0: VW * (.02 + R() * .1), x1: VW * (.9 + R() * .08), base: top + VH * .2, top, tone: .1 + k * .12, tex: o.tex, fade: .55 });
        mist(P, o.bg, top + VH * .18, VH * .03, R() * 1e6);
      }
      birds(P, R, VW * (.3 + R() * .3), VH * .12, 2 + ((R() * 3) | 0));
    },
    // 江岸柳村：一带江，远岸起伏的低山，近岸柳树茅屋，江上篷船远帆
    jiangan(P, R, o) {
      mountain(P, R, { x0: VW * .05, x1: VW * .95, base: VH * .35, top: VH * .2, tone: .25, tex: o.tex, fade: .5 });
      water(P, R, VW * .08, VW * .92, VH * .35, VH * .68, VH * .35);
      if (R() < .7) sail(P, VW * (.3 + R() * .4), VH * .42);
      canopyBoat(P, R, VW * (.25 + R() * .5), VH * (.55 + R() * .08), R() < .5);
      const gr = ground(P, R, o, VW * .05, VW * .95, VH * .64, VH * .82);
      for (let t = 0; t < 3; t++) { const x = VW * (.15 + R() * .7); plant(P, R, o, x, gr(x), 11 + R() * 9, ['willow', 'willow', 'leafy']); }
      const hx = VW * (.3 + R() * .4); sprite(P, HUT, hx, gr(hx) + 1, HOUSE_PAL(o), K.sand);
      reeds(P, R, VW * (.1 + R() * .6), VH * .67, VW * .1);
    },
    // 松林坡：几道高低长短不一的坡，坡上的树疏密不一
    songlin(P, R, o) {
      const layers = 2 + ((R() * 3) | 0);
      for (let k = 0; k < layers; k++) {
        const base = VH * (.4 + k * (.45 / layers) + R() * .06), x0 = VW * R() * .35, x1 = x0 + VW * (.35 + R() * .45), gr = ground(P, R, o, x0, x1, base - VH * (.06 + R() * .08), base);
        const kinds = [['pine', 'conifer'], ['leafy', 'conifer', 'pine'], ['conifer'], ['leafy', 'leafy', 'dead']][(R() * 4) | 0];
        for (let x = x0 + 6; x < x1 - 6; x += 4 + R() * 14) if (R() < .8) plant(P, R, o, x, gr(x), 8 + R() * 10, kinds);
      }
    },
    // 芦汀：一片水，几个小沙洲长着芦苇，一只篷船，一片帆
    luting(P, R, o) {
      water(P, R, VW * .05, VW * .95, VH * .2, VH * .85, VH * .2);
      for (let k = 0; k < 2 + R() * 2; k++) { const cx = VW * (.15 + R() * .7), cy = VH * (.35 + R() * .45), w = VW * (.08 + R() * .1); ground(P, R, o, cx - w, cx + w, cy - 5, cy); reeds(P, R, cx - w * .6, cy - 1, w * 1.2); }
      canopyBoat(P, R, VW * (.3 + R() * .4), VH * (.5 + R() * .2), R() < .5);
      if (R() < .6) sail(P, VW * (.2 + R() * .6), VH * .28);
      birds(P, R, VW * .4, VH * .08, 2 + ((R() * 2) | 0));
    },
    // 坡石：一堆叠起来的圆石头，勾着披麻皴的线，一个人骑驴走过
    poshi(P, R, o) {
      const at = massif(P, R, { x0: VW * .08, x1: VW * .92, base: VH * .88, top: VH * (.4 + R() * .15), tone: .75, tex: R() < .6 ? 'pima' : 'fupi', lumps: 5 + ((R() * 3) | 0), flatness: .4, bg: o.bg });
      for (let t = 0; t < 2; t++) { const x = VW * (.15 + R() * .7); plant(P, R, o, x, at(x) + 1, 8 + R() * 8, ['conifer', 'dead', 'pine']); }
      const gr = ground(P, R, o, VW * .05, VW * .95, VH * .84, VH * .94);
      const x = VW * (.3 + R() * .4); sprite(P, RIDER, x, gr(x), { K: [C.ink, .85], O: [C.ochre, .85] }, K.sand, R() < .5);
    },
    // 竹林茅屋：一片竹子围着一间屋，一道篱笆
    zhulin(P, R, o) {
      const gr = ground(P, R, o, VW * .05, VW * .95, VH * .6, VH * .8);
      for (let k = 0; k < 3 + R() * 2; k++) { const x = VW * (.12 + R() * .76); bamboo(P, R, x, gr(x), 24 + R() * 16); }
      const hx = VW * (.4 + R() * .2); sprite(P, HUT, hx, gr(hx) + 1, HOUSE_PAL(o), K.sand);
      for (let x = hx + 10; x < hx + 34; x += 3) for (let y = 0; y < 5; y++) P.put(x, gr(x) - y, C.trunk, .8, K.sand);   // 篱笆
      for (let x = hx + 10; x < hx + 34; x++) P.put(x, gr(x) - 3, C.trunk, .6, K.sand);
    },
    // 溪桥：一道斜着的溪，一座小石桥，桥上一个人，两岸几棵树
    xiqiao(P, R, o) {
      const g1 = ground(P, R, o, VW * .02, VW * .98, VH * .45, VH * .62);
      const sx = VW * (.35 + R() * .3);
      for (let y = VH * .5; y < VH * .9; y++) { const cx = sx + (y - VH * .5) * .5; water(P, R, cx - 7, cx + 7, y, y + 1, VH * .5); }
      const g2 = ground(P, R, o, VW * .02, VW * .98, VH * .72, VH * .88);
      const by = VH * .66, bx = sx + (by - VH * .5) * .5;
      for (let t = -12; t <= 12; t++) { const y = by - Math.cos(t / 12 * Math.PI / 2) * 5; P.put(bx + t, y, C.inkM, .9, K.sand); P.put(bx + t, y + 1, C.inkL, .6, K.sand); }
      sprite(P, SCHOLAR, bx, by - 5, { K: [C.ink, .9], W: [C.wall, .95] }, K.sand);
      for (let t = 0; t < 4; t++) { const x = VW * (.1 + R() * .8), gr = R() < .5 ? g1 : g2; plant(P, R, o, x, gr(x), 10 + R() * 10, ['leafy', 'pine', 'dead', 'willow', 'conifer']); }
    },
    // 山寺：一座叠石的山，山顶一座几层飞檐的塔，山腰一座亭，几棵松
    sita(P, R, o) {
      const cx = VW * (.35 + R() * .3), m = massif(P, R, { x0: cx - VW * .27, x1: cx + VW * .27, base: VH * .8, top: VH * .3, tone: .6, tex: o.tex, lumps: 4 + ((R() * 3) | 0), peakU: .5, bg: o.bg });
      pagoda(P, R, cx, m(cx) + 2, 4 + ((R() * 3) | 0));
      const px = cx + VW * (R() < .5 ? -.15 : .15); sprite(P, PAV, px, m(px) + 2, HOUSE_PAL(o), K.rock);
      for (let t = 0; t < 4; t++) { const x = cx + VW * (-.22 + R() * .44); plant(P, R, o, x, m(x) + 2, 7 + R() * 7, ['pine', 'conifer']); }
      mist(P, o.bg, VH * .7, VH * .03, R() * 1e6);
    },
    // 松下：后面层叠的大山和云雾，前面两三棵大松，松下牧童骑牛（或者骑驴的人）
    songxia(P, R, o) {
      massif(P, R, { x0: VW * .05, x1: VW * .95, base: VH * .62, top: VH * .04, tone: .55, tex: R() < .5 ? 'fupi' : 'pima', lumps: 6 + ((R() * 3) | 0), flatness: .6, fade: .35, bg: o.bg });
      mist(P, o.bg, VH * .6, VH * .05, R() * 1e6);
      const gr = ground(P, R, o, VW * .02, VW * .98, VH * .78, VH * .93);
      for (const u of [.12 + R() * .15, .7 + R() * .15, ...(R() < .5 ? [.4 + R() * .1] : [])]) { const x = VW * u; pine(P, R, x, gr(x), 34 + R() * 20); }
      const x = VW * (.45 + R() * .15);
      if (R() < .6) herdBoy(P, x, gr(x), R() < .5); else sprite(P, RIDER, x, gr(x), { K: [C.ink, .85], O: [C.ochre, .85] }, K.sand, R() < .5);
    },
    liubai() {},                                               // 留白：什么都不画
  };
  const VIG_W = [['qifeng', 3], ['pubu', 2], ['yuanshan', 3], ['jiangan', 3], ['songlin', 2], ['luting', 2], ['poshi', 3], ['zhulin', 2], ['xiqiao', 2], ['sita', 2], ['songxia', 3], ['liubai', 1]];
  const VIG_SUM = VIG_W.reduce((a, b) => a + b[1], 0);
  const VIG_NAME = { qifeng: '奇峰', pubu: '瀑布崖', yuanshan: '远山云雾', jiangan: '江岸柳村', songlin: '松林坡', luting: '芦汀渔舟', poshi: '坡石', zhulin: '竹林茅屋', xiqiao: '溪桥', sita: '山寺', songxia: '松下', liubai: '留白' };

  // --- 拼：地图按格子摆小景 ------------------------------------------------------------------
  // 格子 CW×CHh 个墨点，小景比格子大一圈（VW×VH），摆的位置再抖一抖；同一行从左往右、行从上往下画，靠下的压住靠上的
  const CW = 150, CHh = 120, SILK_BG = [244, 242, 236];   // 白纸
  const WATERY = ['jiangan', 'luting', 'xiqiao'], HILLY = ['qifeng', 'pubu', 'poshi', 'sita', 'songxia'], WOODY = ['songlin', 'zhulin'];
  let weights = VIG_W, wsum = VIG_SUM;
  // 那段对话的习惯改小景出现的多少：看得多的水多，动手多的山多，改写多的林子多（数字是 0–1 的比例）
  function bias({ water = 0, mountain = 0, forest = 0 } = {}) {
    weights = VIG_W.map(([t, w]) => [t, w * (WATERY.includes(t) ? 1 + water * 3 : HILLY.includes(t) ? 1 + mountain * 3 : WOODY.includes(t) ? 1 + forest * 3 : 1)]);
    wsum = weights.reduce((a, b) => a + b[1], 0);
    cache.clear();
  }
  // 画好的小景压成 8 位存起来（颜色、盖住多少、地形），最多留 48 处
  const cache = new Map();
  function cell(seed, i, j) {
    const k = i + ',' + j;
    let v = cache.get(k);
    if (v) return v;
    const R = rng(hash(i, j, seed) * 4294967296), pick = R() * wsum;
    let acc = 0, type = 'liubai';
    for (const [t, w] of weights) { acc += w; if (pick < acc) { type = t; break; } }
    const P = Pic(VW, VH, SILK_BG, 255, true, true), o = { style: 'ink', tex: ['pima', 'fupi', 'midian'][(R() * 3) | 0], bg: SILK_BG };
    P.falls = [];
    VIG[type](P, R, o);
    const flip = R() < .5, px = new Uint8ClampedArray(VW * VH * 4);
    for (let n = 0; n < VW * VH; n++) { px[n * 4] = P.d[n * 3]; px[n * 4 + 1] = P.d[n * 3 + 1]; px[n * 4 + 2] = P.d[n * 3 + 2]; px[n * 4 + 3] = P.al[n] * 255; }
    v = { px, kd: P.kd, type, x: i * CW + (CW - VW) / 2 + (R() - .5) * 40, y: j * CHh + (CHh - VH) / 2 + (R() - .5) * 30, flip,
      falls: P.falls.map(([fx, y0, y1, w]) => [flip ? VW - 1 - fx : fx, y0, y1, w]) };
    if (cache.size >= 48) cache.delete(cache.keys().next().value);
    cache.set(k, v);
    return v;
  }
  const edge = (x, y) => cl(Math.min(x, VW - 1 - x) / 36) * cl(Math.min(y, VH - 1 - y) / 30);   // 小景四周淡进纸里
  // 盖到这一块的格子，按画的先后排好。小景摆在 i*CW + (CW-VW)/2 ± 20（竖着 ± 15），所以只有这几格够得着
  const cellsOver = (x0, y0, w, h) => {
    const out = [], i0 = Math.floor((x0 - (CW - VW) / 2 - 20 - VW) / CW), i1 = Math.ceil((x0 + w - (CW - VW) / 2 + 20) / CW), j0 = Math.floor((y0 - (CHh - VH) / 2 - 15 - VH) / CHh), j1 = Math.ceil((y0 + h - (CHh - VH) / 2 + 15) / CHh);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) out.push([i, j]);
    return out;
  };
  function paintRegion(seed, x0, y0, w, h) {
    const d = new Float32Array(w * h * 3), kd = new Uint8Array(w * h).fill(K.grass);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {  // 纸：一点点起伏
      const i = (y * w + x) * 3, n = (n2((x0 + x) / 40, (y0 + y) / 40, seed + 3) - .5) * 4 + (hash(x0 + x, y0 + y, seed) - .5) * 4;
      d[i] = SILK_BG[0] + n; d[i + 1] = SILK_BG[1] + n; d[i + 2] = SILK_BG[2] + n;
    }
    for (const [i, j] of cellsOver(x0, y0, w, h)) {
      const v = cell(seed, i, j);
      const ax0 = Math.max(0, Math.floor(v.x - x0)), ax1 = Math.min(w, Math.ceil(v.x + VW - x0)), ay0 = Math.max(0, Math.floor(v.y - y0)), ay1 = Math.min(h, Math.ceil(v.y + VH - y0));
      for (let ay = ay0; ay < ay1; ay++) for (let ax = ax0; ax < ax1; ax++) {
        let px = Math.floor(x0 + ax - v.x), py = Math.floor(y0 + ay - v.y);
        if (px < 0 || py < 0 || px >= VW || py >= VH) continue;
        if (v.flip) px = VW - 1 - px;
        const s = py * VW + px, e = edge(px, py), a = v.px[s * 4 + 3] / 255 * e, o = (ay * w + ax) * 3;
        if (a > .003) { d[o] += (v.px[s * 4] - d[o]) * a; d[o + 1] += (v.px[s * 4 + 1] - d[o + 1]) * a; d[o + 2] += (v.px[s * 4 + 2] - d[o + 2]) * a; }
        if (v.kd[s] !== 255 && e > .5) kd[ay * w + ax] = v.kd[s];
      }
    }
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { rgba[i * 4] = d[i * 3]; rgba[i * 4 + 1] = d[i * 3 + 1]; rgba[i * 4 + 2] = d[i * 3 + 2]; rgba[i * 4 + 3] = 255; }
    return { rgba, kind: kd };
  }
  // 地图上的一块，单位美术像素。sc：一个墨点占几个美术像素（2 就是一格 2×2 个墨点，和别的地貌的像素块一样粗）
  function region(seed, x0, y0, w, h, sc = 2) {
    if (sc === 1) return paintRegion(seed, x0, y0, w, h);
    const X0 = Math.floor(x0 / sc), Y0 = Math.floor(y0 / sc), w2 = Math.floor((x0 + w - 1) / sc) - X0 + 1, h2 = Math.floor((y0 + h - 1) / sc) - Y0 + 1;
    const r = paintRegion(seed, X0, Y0, w2, h2), rgba = new Uint8ClampedArray(w * h * 4), kind = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s2 = (Math.floor((y0 + y) / sc) - Y0) * w2 + Math.floor((x0 + x) / sc) - X0, o = y * w + x;
      rgba[o * 4] = r.rgba[s2 * 4]; rgba[o * 4 + 1] = r.rgba[s2 * 4 + 1]; rgba[o * 4 + 2] = r.rgba[s2 * 4 + 2]; rgba[o * 4 + 3] = 255; kind[o] = r.kind[s2];
    }
    return { rgba, kind };
  }
  // 一个美术像素上是什么地形：和 region 同样的先后，只查不画
  function kindAt(seed, ax, ay, sc = 2) {
    const X = Math.floor(ax / sc), Y = Math.floor(ay / sc);
    let k = K.grass;
    for (const [i, j] of cellsOver(X, Y, 1, 1)) {
      const v = cell(seed, i, j);
      let px = Math.floor(X - v.x);
      const py = Math.floor(Y - v.y);
      if (px < 0 || py < 0 || px >= VW || py >= VH) continue;
      if (v.flip) px = VW - 1 - px;
      const s = py * VW + px;
      if (v.kd[s] !== 255 && edge(px, py) > .5) k = v.kd[s];
    }
    return k;
  }
  // 这一块里的瀑布：[x, 上端 y, 下端 y, 半宽]，单位美术像素
  function falls(seed, x0, y0, w, h, sc = 2) {
    const out = [];
    for (const [i, j] of cellsOver(Math.floor(x0 / sc), Math.floor(y0 / sc), Math.ceil(w / sc), Math.ceil(h / sc))) {
      const v = cell(seed, i, j);
      for (const [fx, a, b, hw] of v.falls) out.push([(v.x + fx) * sc, (v.y + a) * sc, (v.y + b) * sc, hw * sc]);
    }
    return out;
  }
  const cellAt = (seed, x, y, sc = 2) => cellAtRaw(seed, x / sc, y / sc);
  const cellAtRaw = (seed, x, y) => { const v = cell(seed, Math.floor(x / CW), Math.floor(y / CHh)); return VIG_NAME[v.type]; };

  // --- 装裱：整幅外面裱一圈，立轴的样子 -----------------------------------------------------------
  function brocade(P, x0, y0, w, h, c, sd) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if ((x + y * 3) % 7 === 0 && hash(x, y, sd) < .5) P.put(x, y, mix(c, [255, 255, 255], .25), .5);
  }
  function frame(img, iw, ih, seed) {
    const R = rng(seed), M = MOUNT[(R() * MOUNT.length) | 0], s = Math.max(1, Math.round(Math.max(iw, ih) / 500));   // 画越大，边越宽
    const side = 12 * s, head = 60 * s, foot = 34 * s, band = 7 * s, rod = 5 * s, knob = 6 * s;
    const W = iw + side * 2 + knob * 2, H = rod + head + band + ih + band + foot + rod;
    const P = Pic(W, H, PAPER_C), x0 = knob, mw = iw + side * 2;
    P.rect(x0, rod, mw, H - rod * 2, M.face);
    brocade(P, x0, rod, mw, H - rod * 2, M.face, seed);
    P.rect(x0, 0, mw, rod, M.rod);                               // 天杆
    for (const fx of [.3, .7]) P.rect(Math.round(x0 + mw * fx) - s, rod, s * 2, head, M.band, .7);   // 惊燕
    const py = rod + head + band;
    P.rect(x0, py - band, mw, band, M.band); P.rect(x0, py + ih, mw, band, M.band);   // 上下隔水
    P.rect(x0 + side - s, py - s, iw + s * 2, ih + s * 2, mix(M.band, C.ink, .3));      // 局条
    for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) { const i = (y * iw + x) * 4, j = ((py + y) * W + x0 + side + x) * 3; P.d[j] = img[i]; P.d[j + 1] = img[i + 1]; P.d[j + 2] = img[i + 2]; }
    inscription(P, R, x0 + side + iw - 10 * s, py + 8 * s, 2, 8);  // 题款
    const fy = H - rod;
    P.rect(x0, fy - s, mw, rod + s, M.rod);                     // 地杆
    for (const kx of [0, W - knob]) P.rect(kx, fy - 2 * s, knob, rod + 3 * s, M.knob);   // 轴头
    const rgba = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) { rgba[i * 4] = P.d[i * 3]; rgba[i * 4 + 1] = P.d[i * 3 + 1]; rgba[i * 4 + 2] = P.d[i * 3 + 2]; rgba[i * 4 + 3] = 255; }
    return { w: W, h: H, rgba, ix: x0 + side, iy: py };      // ix, iy：画心在装裱里的位置
  }
  return { region, kindAt, falls, bias, frame, cellAt, K };
})();
