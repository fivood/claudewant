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
  const SG = 5;                                               // 笔触的间距
  function region(seed, x0, y0, w, h) {
    const M = 12, gi0 = Math.floor((x0 - M) / SG), gj0 = Math.floor((y0 - M) / SG), GW = Math.floor((x0 + w + M) / SG) - gi0 + 1, GH = Math.floor((y0 + h + M) / SG) - gj0 + 1;
    const S = new Float32Array(GW * GH * 6), col = new Array(GW * GH);   // 每一笔：位置、方向、长、宽
    for (let gj = 0; gj < GH; gj++) for (let gi = 0; gi < GW; gi++) {
      const i = gi0 + gi, j = gj0 + gj, sx = (i + .1 + hs(i, j, seed + 920) * .8) * SG, sy = (j + .1 + hs(i, j, seed + 921) * .8) * SG, a = flow(seed, sx, sy), n = gj * GW + gi, o = n * 6;
      const p = planetAt(seed, sx, sy), pal = p ? RINGS[p.ring][1] : PAL[kindOf(Math.floor(sx / 4), Math.floor(sy / 4))] || PAL.grass;
      S[o] = sx; S[o + 1] = sy; S[o + 2] = Math.cos(a); S[o + 3] = Math.sin(a); S[o + 4] = 1 / (4.5 + hs(i, j, seed + 922) * 4); S[o + 5] = 1 / (1.6 + hs(i, j, seed + 923) * .7);   // 存倒数，下面省除法
      col[n] = pal[Math.floor(hs(i, j, seed + 924) * pal.length)];
    }
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ax = x0 + x, ay = y0 + y, ci = Math.floor(ax / SG) - gi0, cj = Math.floor(ay / SG) - gj0;
      let d1 = 1e9, d2 = 1e9, best = 0, bv = 0;
      for (let gj = cj - 2; gj <= cj + 2; gj++) for (let gi = ci - 2; gi <= ci + 2; gi++) {
        const o = (gj * GW + gi) * 6, dx = ax - S[o], dy = ay - S[o + 1];
        if (dx * dx + dy * dy > 100) continue;                // 太远的笔够不着这个像素
        const u = (dx * S[o + 2] + dy * S[o + 3]) * S[o + 4], v = (-dx * S[o + 3] + dy * S[o + 2]) * S[o + 5], d = u * u + v * v;
        if (d < d1) { d2 = d1; d1 = d; best = gj * GW + gi; bv = v; } else if (d < d2) d2 = d;
      }
      const c = col[best], k = d1 / d2 > .78 ? .8 : Math.abs(bv) < .45 && d1 < .7 ? 1.12 : 1, o = (y * w + x) * 4;   // 笔缝暗一点，笔脊亮一点
      rgba[o] = c[0] * k; rgba[o + 1] = c[1] * k; rgba[o + 2] = c[2] * k; rgba[o + 3] = 255;
    }
    return { rgba };
  }
  return { region, use, planetAt };
})();
