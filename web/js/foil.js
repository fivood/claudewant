// 二向箔：压平以后的太阳系，程心看了说像梵高——整张图画成一笔笔短短的油画笔触，顺着一片打着旋的流场排开。
// 每一笔是一个撒下的点，按它那里的流向拉长成一道（用拉长的距离分块，挨着的笔触自然顺成一股）；颜色取那一格的地形，
// 笔触之间留一道暗缝，笔中间亮一点，像颜料的厚边。地形还是原来那套噪声，只是画法换了。
// 偶尔一颗被压平的行星：地核、外核、地幔、地壳、海、大气一圈套一圈全摊开，笔触绕着圈转，像《星月夜》里的星。
const FOIL = (() => {
  const hs = (x, y, s) => {
    let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const vn = (x, y, s) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hs(xi, yi, s), b = hs(xi + 1, yi, s), c = hs(xi, yi + 1, s), d = hs(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  let kindOf = () => 'grass';
  const use = f => { kindOf = f; };                          // 地形从 world.js 的 tile() 来
  const PAL = {
    deep: [[30, 50, 112], [40, 68, 142], [22, 38, 90]], water: [[72, 112, 188], [96, 140, 208], [58, 92, 170], [150, 188, 232]],
    sand: [[214, 180, 100], [198, 158, 80], [232, 204, 124]], grass: [[118, 150, 72], [150, 172, 86], [98, 128, 66]],
    forest: [[38, 70, 52], [58, 94, 62], [28, 52, 40]], rock: [[140, 100, 70], [118, 84, 60], [164, 122, 82]],
    peak: [[108, 98, 134], [88, 82, 122], [132, 122, 154]], snow: [[250, 214, 92], [255, 238, 152], [238, 188, 62]], rift: [[20, 20, 28]],
  };
  // 被压平的行星：每 320 像素一格，四成的格子里有一颗
  const PG = 320;
  const RINGS = [[.2, [[255, 236, 150], [250, 212, 92]]], [.34, [[242, 162, 62], [226, 132, 52]]], [.62, [[202, 92, 52], [178, 72, 46], [216, 112, 62]]],
    [.72, [[132, 98, 72], [112, 82, 60]]], [.84, [[62, 102, 178], [82, 126, 198]]], [1, [[172, 202, 236], [198, 222, 244]]]];
  function planetAt(seed, ax, ay) {
    const i = Math.floor(ax / PG), j = Math.floor(ay / PG);
    if (hs(i, j, seed + 900) > .4) return null;
    const x = (i + .3 + hs(i, j, seed + 901) * .4) * PG, y = (j + .3 + hs(i, j, seed + 902) * .4) * PG, r = 40 + hs(i, j, seed + 903) * 34, d = Math.hypot(ax - x, ay - y);
    if (d > r) return null;
    const k = d / r, ring = RINGS.findIndex(([e]) => k <= e);
    return { x, y, r, d, ring, spin: hs(i, j, seed + 904) < .5 ? 1 : -1 };
  }
  // 流向：大尺度慢慢拐的底流，加上一个个旋涡；行星上就绕着圈转
  function flow(seed, x, y) {
    const p = planetAt(seed, x, y);
    if (p) return Math.atan2(y - p.y, x - p.x) + Math.PI / 2 * p.spin;
    const a0 = vn(x / 260, y / 260, seed + 910) * Math.PI * 3;
    let fx = Math.cos(a0), fy = Math.sin(a0);
    const VG = 110, i0 = Math.floor(x / VG), j0 = Math.floor(y / VG);
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      const vx = (i + .2 + hs(i, j, seed + 911) * .6) * VG, vy = (j + .2 + hs(i, j, seed + 912) * .6) * VG, dx = x - vx, dy = y - vy, d = Math.hypot(dx, dy) || 1;
      const w = 2.4 * Math.exp(-((d / 42) ** 2)) * (hs(i, j, seed + 913) < .5 ? 1 : -1);
      fx += -dy / d * w; fy += dx / d * w;
    }
    return Math.atan2(fy, fx);
  }
  const SG = 6;                                               // 笔触的间距
  // 像画画一样：先按地形铺一层底色，再把一笔笔按随机的先后盖上去（每笔是顺着流向拉长的细椭圆，两边暗、中间一道亮脊）
  function region(seed, x0, y0, w, h) {
    const M = 16, rgba = new Uint8ClampedArray(w * h * 4), strokes = [];
    for (let ty = Math.floor(y0 / 4); ty * 4 < y0 + h; ty++) for (let tx = Math.floor(x0 / 4); tx * 4 < x0 + w; tx++) {   // 底色
      const c = (PAL[kindOf(tx, ty)] || PAL.grass)[0];
      for (let y = Math.max(y0, ty * 4); y < Math.min(y0 + h, ty * 4 + 4); y++) for (let x = Math.max(x0, tx * 4); x < Math.min(x0 + w, tx * 4 + 4); x++) {
        const o = ((y - y0) * w + x - x0) * 4;
        rgba[o] = c[0] * .85; rgba[o + 1] = c[1] * .85; rgba[o + 2] = c[2] * .85; rgba[o + 3] = 255;
      }
    }
    for (let j = Math.floor((y0 - M) / SG); j * SG < y0 + h + M; j++) for (let i = Math.floor((x0 - M) / SG); i * SG < x0 + w + M; i++) {
      const sx = (i + .1 + hs(i, j, seed + 920) * .8) * SG, sy = (j + .1 + hs(i, j, seed + 921) * .8) * SG, p = planetAt(seed, sx, sy);
      const pal = p ? RINGS[p.ring][1] : PAL[kindOf(Math.floor(sx / 4), Math.floor(sy / 4))] || PAL.grass;
      strokes.push([hs(i, j, seed + 925), sx, sy, flow(seed, sx, sy), 7 + hs(i, j, seed + 922) * 6, 1.1 + hs(i, j, seed + 923) * .5, pal[Math.floor(hs(i, j, seed + 924) * pal.length)]]);
    }
    strokes.sort((a, b) => a[0] - b[0]);                      // 先后随机，免得排成格子
    for (const [, sx, sy, a, L, W, c] of strokes) {
      const cs = Math.cos(a), sn = Math.sin(a), ex = L * Math.abs(cs) + W * Math.abs(sn), ey = L * Math.abs(sn) + W * Math.abs(cs);
      const xa = Math.max(x0, Math.floor(sx - ex)), xb = Math.min(x0 + w - 1, Math.ceil(sx + ex)), ya = Math.max(y0, Math.floor(sy - ey)), yb = Math.min(y0 + h - 1, Math.ceil(sy + ey));
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
        const dx = x + .5 - sx, dy = y + .5 - sy, u = (dx * cs + dy * sn) / L, v = (-dx * sn + dy * cs) / W;
        if (u * u + v * v > 1) continue;
        const k = Math.abs(v) > .72 || Math.abs(u) > .9 ? .82 : Math.abs(v) < .35 ? 1.12 : 1, o = ((y - y0) * w + x - x0) * 4;
        rgba[o] = c[0] * k; rgba[o + 1] = c[1] * k; rgba[o + 2] = c[2] * k;
      }
    }
    return { rgba };
  }
  return { region, use, planetAt };
})();
