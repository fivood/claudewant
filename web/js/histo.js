// 切片按真正的 HE 染色切片画：细胞质染成粉，细胞核染成紫。地面按噪声分成几种组织，每种组织按像素画出自己的样子——
// 上皮是一个个挤在一起的多边形细胞，每个一颗核；腺体是一圈柱状细胞围着一个空腔；纤维是顺着一个方向的波纹，夹着梭形的核；
// 淋巴组织是密密的小紫点；软骨是紫蓝的基质里一个个白色小窝，窝里一颗核；脂肪是大大的白泡，只剩一圈膜。
// 血管是弯弯曲曲的一条条（脊状噪声），管壁一圈，里面是空的——红细胞由 fx.js 让它们流起来。
const HISTO = (() => {
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
  const fbm = (x, y, s) => (vn(x / 40, y / 40, s) * 4 + vn(x / 17, y / 17, s + 1) * 2 + vn(x / 7, y / 7, s + 2)) / 7;
  let W = 0, HARD = 0, GREEN = 0;
  const bias = b => { W = b.water || 0; HARD = b.mountain || 0; GREEN = b.forest || 0; };
  const vessel = (seed, x, y) => Math.abs(vn(x / 23, y / 23, seed + 50) - .5);   // 离血管中线多远（格子坐标）
  // 格子坐标（可以带小数）上是什么组织
  function kindF(seed, x, y) {
    const w = vessel(seed, x, y), vw = .028 + W * .3;
    if (w < vw) return 'water';                               // 血管腔
    if (w < vw + .014) return 'sand';                         // 管壁
    const e = fbm(x, y, seed);
    if (e < .36) return 'deep';                               // 淋巴组织
    if (e < .43 + GREEN * .2) return 'forest';                // 腺体
    if (e < .59 - HARD) return 'grass';                       // 上皮
    return e < .65 - HARD / 2 ? 'rock' : e < .72 - HARD / 3 ? 'peak' : 'snow';   // 纤维、软骨、脂肪
  }
  const kindAt = (seed, x, y) => kindF(seed, x, y);
  // 撒点分块：离最近的点多远、离第二近的点多远、最近的是哪个点
  const vor = new Float64Array(5);
  function voronoi(ax, ay, D, s) {
    const i0 = Math.floor(ax / D), j0 = Math.floor(ay / D);
    let d1 = 1e9, d2 = 1e9, bi = 0, bj = 0, bx = 0, by = 0;
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      const sx = (i + .15 + hs(i, j, s) * .7) * D, sy = (j + .15 + hs(i, j, s + 1) * .7) * D, d = Math.hypot(sx - ax, sy - ay);
      if (d < d1) { d2 = d1; d1 = d; bi = i; bj = j; bx = sx; by = sy; } else if (d < d2) d2 = d;
    }
    vor[0] = d1; vor[1] = d2; vor[2] = hs(bi, bj, s + 2); vor[3] = ax - bx; vor[4] = ay - by;
    return vor;
  }
  const C = {                                                 // 褪过色的 HE：粉和紫都压低了饱和度，对比也放软，看久了不累
    cyto: [226, 192, 204], memb: [202, 164, 182], nuc: [128, 98, 146], nucL: [152, 124, 164],
    lymph: [208, 178, 198], lumen: [246, 238, 240], stroma: [234, 210, 216],
    fib: [224, 188, 198], fibD: [208, 170, 184], matrix: [188, 174, 200], lac: [241, 235, 240],
    fat: [248, 244, 243], fatM: [216, 188, 200], wall: [212, 170, 186], blood: [244, 233, 236],
  };
  function pixel(seed, ax, ay, k) {
    switch (k) {
      case 'grass': {                                         // 上皮：多边形细胞，一颗核，细胞质深浅不一
        const [d1, d2, r, qx, qy] = voronoi(ax, ay, 9, seed + 60);
        if (d2 - d1 < 1.1) return C.memb;
        if ((qx / 1.9) ** 2 + (qy / 1.4) ** 2 < 1) return r < .08 ? C.nucL : C.nuc;
        return shade(C.cyto, (r - .5) * 10);
      }
      case 'deep': {                                          // 淋巴组织：一颗颗小核挤着
        const [d1] = voronoi(ax, ay, 5, seed + 61);
        return d1 < 1.7 ? C.nuc : d1 < 2.3 ? C.nucL : C.lymph;
      }
      case 'forest': {                                        // 腺体：空腔，外面一圈柱状细胞，核排在靠外的一侧
        const D = 34, i = Math.floor(ax / D), j = Math.floor(ay / D), cx = (i + .5) * D + (hs(i, j, seed + 62) - .5) * 8, cy = (j + .5) * D + (hs(i, j, seed + 63) - .5) * 8;
        const dx = ax - cx, dy = ay - cy, a = Math.atan2(dy, dx), wob = vn(Math.cos(a) * 2 + i * 7, Math.sin(a) * 2 + j * 7, seed + 64);
        const r = Math.hypot(dx, dy), R1 = 5 + hs(i, j, seed + 65) * 3 + wob * 2, R2 = R1 + 7;
        if (r < R1) return C.lumen;
        if (r < R2) {
          const seg = a * R2 / 2.6;
          if (seg - Math.floor(seg) < .28) return C.memb;
          if (r > R2 - 3 && r < R2 - 1) return C.nuc;
          return C.cyto;
        }
        if (r < R2 + 1) return C.memb;
        return vn(ax / 3, ay / 9, seed + 66) > .62 ? C.fibD : C.stroma;
      }
      case 'rock': {                                          // 纤维：顺一个方向的波纹，梭形核
        const a = vn(ax / 60, ay / 60, seed + 67) * 3, c = Math.cos(a), s = Math.sin(a), u = ax * c + ay * s, v = -ax * s + ay * c;
        const [d1, , , qx, qy] = voronoi(u, v * 2.6, 16, seed + 68);
        if (d1 < 3.4 && Math.abs(qy) < 1.4) return C.nuc;
        const ph = v / 2.6 + Math.sin(u / 7 + v / 11) * 1.2;
        return ph - Math.floor(ph) < .38 ? C.fibD : C.fib;
      }
      case 'peak': {                                          // 软骨：基质里一个个小窝，窝里一颗核，偶尔两个挨着
        const [d1, , r, qx, qy] = voronoi(ax, ay, 10, seed + 69);
        const R = 2.4 + r * 1.2;
        if (d1 < R) return Math.abs(qx - (r < .4 ? 0 : .8)) < 1.2 && Math.abs(qy) < 1 ? C.nuc : C.lac;
        if (d1 < R + .9) return C.nucL;
        return shade(C.matrix, (vn(ax / 5, ay / 5, seed + 70) - .5) * 8);
      }
      case 'snow': {                                          // 脂肪：大白泡，一圈膜，偶尔膜上贴着一颗扁核
        const [d1, d2, r] = voronoi(ax, ay, 15, seed + 71);
        if (d2 - d1 < 1) return r < .15 && d1 > 5 ? C.nuc : C.fatM;
        return C.fat;
      }
      case 'sand': {                                          // 血管壁：一层，贴着扁扁的内皮细胞核
        return hs(ax >> 2, ay >> 1, seed + 72) < .08 ? C.nuc : C.wall;
      }
      default: return C.blood;                                // 血管腔：淡淡的血浆
    }
  }
  const shade = (c, d) => [c[0] + d, c[1] + d, c[2] + d];
  function region(seed, x0, y0, w, h) {
    const rgba = new Uint8ClampedArray(w * h * 4), ks = [];
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) ks.push(kindF(seed, (x0 + x - 1) / 4, (y0 + y - 1) / 4));   // 组织的边界按两个像素一步算，省一半多
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ax = x0 + x, ay = y0 + y, c = pixel(seed, ax, ay, ks[(y >> 1) * ((w + 1) >> 1) + (x >> 1)]), o = (y * w + x) * 4;
      rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = 255;
    }
    return { rgba };
  }
  // 血管里往哪流：沿着脊线走（垂直于噪声的梯度），再往中线拉一点，别撞到管壁上
  function flow(seed, ax, ay) {
    const x = (ax - 1.5) / 4, y = (ay - 1.5) / 4, e = .05, n = (px, py) => vn(px / 23, py / 23, seed + 50);
    const gx = (n(x + e, y) - n(x - e, y)) / (2 * e), gy = (n(x, y + e) - n(x, y - e)) / (2 * e), g = Math.hypot(gx, gy) || 1, off = n(x, y) - .5;
    return [-gy / g, gx / g, -gx / g * Math.sign(off), -gy / g * Math.sign(off), Math.abs(off)];   // 顺流方向，回中线的方向，离中线多远
  }
  const inVessel = (seed, ax, ay) => vessel(seed, (ax - 1.5) / 4, (ay - 1.5) / 4) < .028 + W * .3;
  return { region, kindAt, bias, flow, inVessel };
})();
