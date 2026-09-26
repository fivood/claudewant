// 蓝图画的是一座地下迷宫：纸面按 16×16 格分成房间格，每格要么是一间房（方的、切角的、十字的、圆的、菱形的、半圆头的），
// 要么只是几条走廊的岔口；相邻两格连不连由迷宫定——每 6×6 格一片，片里用回溯法挖成一棵树（每两格之间只有一条路），
// 片和片之间各开一道门，再零星多打通几处成环。所以整张纸连成一片，从入口一定走得到出口。
// 入口是 Clawd 落下的那间（楼梯间），出口在七到十一间房之外，也是楼梯间。
// 按美术像素画：地面是带方格的蓝，墙是白的粗线（离地面两个像素以内），墙外的岩层点着碎点，越靠墙越密。
// 柱子是房间里没挖开的一块，墙自然就围着它画一圈。Clawd 是四维的截面，墙拦不住它。
const MAZE = (() => {
  const CS = 64, HALF = CS / 2, B = 6, CW = 4;              // 一格房间 64 美术像素（16 格）；走廊半宽 4
  const hs = (x, y, s) => {
    let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const P = { water: .1, pillars: .18, rubble: .1 };
  const bias = b => { P.water = .06 + .12 * Math.min(1, b.water || 0); P.pillars = .12 + .2 * Math.min(1, b.mountain || 0); P.rubble = .06 + .14 * Math.min(1, b.forest || 0); };

  // 一片 6×6 格的迷宫：每格两位，1 = 跟东边通，2 = 跟南边通
  const blocks = new Map();
  function block(seed, bi, bj) {
    const k = seed + ':' + bi + ',' + bj;
    let m = blocks.get(k);
    if (m) return m;
    m = new Uint8Array(B * B);
    let s = hs(bi, bj, seed + 700) * 4294967296 >>> 0;
    const rnd = () => (s = Math.imul(s ^ s >>> 15, 2246822507) + 0x9e3779b9 >>> 0) / 4294967296;
    const seen = new Uint8Array(B * B), st = [Math.floor(rnd() * B * B)];
    seen[st[0]] = 1;
    while (st.length) {
      const c = st[st.length - 1], x = c % B, y = (c / B) | 0, nb = [];
      if (x < B - 1 && !seen[c + 1]) nb.push([c + 1, c, 1]);
      if (x > 0 && !seen[c - 1]) nb.push([c - 1, c - 1, 1]);
      if (y < B - 1 && !seen[c + B]) nb.push([c + B, c, 2]);
      if (y > 0 && !seen[c - B]) nb.push([c - B, c - B, 2]);
      if (!nb.length) { st.pop(); continue; }
      const [n, at, bit] = nb[Math.floor(rnd() * nb.length)];
      m[at] |= bit; seen[n] = 1; st.push(n);
    }
    if (blocks.size > 256) blocks.clear();
    blocks.set(k, m);
    return m;
  }
  const fl = Math.floor;
  function linkE(seed, ci, cj) {                              // (ci, cj) 跟东边那格通不通
    const bi = fl(ci / B), bj = fl(cj / B), li = ci - bi * B, lj = cj - bj * B;
    if (hs(ci, cj, seed + 702) < .07) return true;            // 零星多打通一处，成环
    if (li < B - 1) return !!(block(seed, bi, bj)[lj * B + li] & 1);
    return lj === fl(hs(bi, bj, seed + 703) * B);             // 片和片之间一道门
  }
  function linkS(seed, ci, cj) {
    const bi = fl(ci / B), bj = fl(cj / B), li = ci - bi * B, lj = cj - bj * B;
    if (hs(ci, cj, seed + 704) < .07) return true;
    if (lj < B - 1) return !!(block(seed, bi, bj)[lj * B + li] & 2);
    return li === fl(hs(bi, bj, seed + 705) * B);
  }
  const exitOf = seed => { const a = hs(1, 2, seed + 706) * Math.PI * 2, d = 7 + hs(3, 4, seed + 707) * 4; return [Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d)]; };

  // 一格房间：通哪几边、是什么房
  const SHAPES = ['rect', 'oct', 'cross', 'round', 'diamond', 'apse'];
  const cells = new Map();
  let lastI = NaN, lastJ = NaN, lastS = NaN, lastC = null;     // 一行像素大多落在同一格，上一格记着，省得每个像素查表
  function cell(seed, ci, cj) {
    if (ci === lastI && cj === lastJ && seed === lastS) return lastC;
    const k = seed + ':' + ci + ',' + cj;
    let c = cells.get(k);
    if (c) { lastI = ci; lastJ = cj; lastS = seed; return lastC = c; }
    const r = n => hs(ci * 17 + n, cj, seed + 710), [ex, ey] = exitOf(seed);
    const open = [linkE(seed, ci, cj), linkS(seed, ci, cj), linkE(seed, ci - 1, cj), linkS(seed, ci, cj - 1)], deg = open.filter(Boolean).length;
    const stairs = (ci === 0 && cj === 0) || (ci === ex && cj === ey);
    const dE = (i, j) => Math.round((hs(i, j, seed + 730) - .5) * 20), dS = (i, j) => Math.round((hs(i, j, seed + 731) - .5) * 20);   // 门开在边上哪儿，两边的格子用同一个数
    c = { open, d: [dE(ci, cj), dS(ci, cj), dE(ci - 1, cj), dS(ci, cj - 1)], stairs, exit: ci === ex && cj === ey, room: null };
    if (stairs || deg === 1 || r(1) > .28) {                  // 死胡同的尽头总有一间小屋
      const small = !stairs && deg === 1 && r(2) < .5, a = stairs ? 18 : small ? 8 + r(3) * 5 : 12 + r(3) * 14, b = stairs ? 14 : small ? 8 + r(4) * 5 : 12 + r(4) * 14;
      const shape = stairs ? 'rect' : SHAPES[fl(r(5) * SHAPES.length)];
      c.room = { shape: shape === 'diamond' ? 'diamond' : shape, a: shape === 'diamond' ? a * 1.25 : a, b: shape === 'diamond' ? b * 1.25 : b, dir: fl(r(6) * 4),
        water: !stairs && r(7) < P.water, pillars: !stairs && a > 17 && b > 17 && r(8) < P.pillars, rubble: !stairs && r(9) < P.rubble };
      c.room.a = Math.min(c.room.a, 27); c.room.b = Math.min(c.room.b, 27);
    }
    if (cells.size > 2048) cells.clear();
    cells.set(k, c);
    lastI = ci; lastJ = cj; lastS = seed;
    return lastC = c;
  }
  const inShape = (m, x, y) => {                              // 房间里的点（以房间中心为原点）
    const { a, b } = m, ax = Math.abs(x), ay = Math.abs(y);
    switch (m.shape) {
      case 'rect': return ax <= a && ay <= b;
      case 'oct': return ax <= a && ay <= b && ax + ay <= a + b - Math.min(a, b) * .55;
      case 'cross': return (ax <= a && ay <= b * .42) || (ax <= a * .42 && ay <= b);
      case 'round': return (x / a) ** 2 + (y / b) ** 2 <= 1;
      case 'diamond': return ax / a + ay / b <= 1;
      default: {                                              // 半圆头：一头方一头圆
        const u = [x, y, -x, -y][m.dir], v = m.dir % 2 ? ax : ay, A = m.dir % 2 ? b : a, Bv = m.dir % 2 ? a : b;
        return u <= 0 ? -u <= A && v <= Bv : (u / A) ** 2 + (v / Bv) ** 2 <= 1;
      }
    }
  };
  // 一个像素是什么：0 岩层，1 房间地面，2 走廊，3 积水，4 柱子，5 碎石地，6 楼梯
  function cls(seed, ax, ay) {
    const X = ax - 2 + HALF, Y = ay - 2 + HALF, ci = fl(X / CS), cj = fl(Y / CS), x = X - ci * CS - HALF, y = Y - cj * CS - HALF, c = cell(seed, ci, cj), m = c.room;
    if (m && inShape(m, x, y)) {
      if (m.pillars && (Math.abs(Math.abs(x) - m.a * .5) <= 2.5 && Math.abs(Math.abs(y) - m.b * .5) <= 2.5)) return 4;
      if (c.stairs && Math.abs(x) <= 8 && Math.abs(y) <= 6) return 6;
      return m.water ? 3 : m.rubble ? 5 : 1;
    }
    const o = c.open, d = c.d, span = (v, e) => v >= Math.min(0, e) - CW && v <= Math.max(0, e) + CW;   // 走廊从房间中心拐一下，对上边上的门
    if ((o[0] && ((x >= 0 && Math.abs(y - d[0]) <= CW) || (Math.abs(x) <= CW && span(y, d[0])))) || (o[2] && ((x <= 0 && Math.abs(y - d[2]) <= CW) || (Math.abs(x) <= CW && span(y, d[2]))))
      || (o[1] && ((y >= 0 && Math.abs(x - d[1]) <= CW) || (Math.abs(y) <= CW && span(x, d[1])))) || (o[3] && ((y <= 0 && Math.abs(x - d[3]) <= CW) || (Math.abs(y) <= CW && span(x, d[3]))))) return 2;
    return 0;
  }
  const KIND = ['deep', 'grass', 'sand', 'water', 'peak', 'forest', 'snow'];
  function kindAt(seed, ax, ay) {                             // 一格的地形：看格子中心；岩层里离地面两个像素以内的算墙
    const k = cls(seed, ax, ay);
    if (k) return KIND[k];
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2]]) { const n = cls(seed, ax + dx, ay + dy); if (n && n !== 4) return 'rock'; }
    return 'deep';
  }
  // 往外膨胀 r 个像素（先横后竖，方的）
  function dilate(src, W, H, r) {
    const tmp = new Uint8Array(W * H), out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) { let n = 0; for (let x = -r; x < W + r; x++) { if (x + r < W && src[y * W + x + r]) n++; if (x - r - 1 >= 0 && src[y * W + x - r - 1]) n--; if (x >= 0 && x < W) tmp[y * W + x] = n > 0; } }
    for (let x = 0; x < W; x++) { let n = 0; for (let y = -r; y < H + r; y++) { if (y + r < H && tmp[(y + r) * W + x]) n++; if (y - r - 1 >= 0 && tmp[(y - r - 1) * W + x]) n--; if (y >= 0 && y < H) out[y * W + x] = n > 0; } }
    return out;
  }
  const COL = {
    rock: [20, 46, 98], dot: [92, 132, 200], wall: [226, 236, 255], floor: [36, 78, 146], grid: [52, 96, 168],
    water: [28, 62, 128], wave: [120, 170, 232], stair: [200, 220, 250], rubble: [140, 176, 232], hatch: [96, 136, 204],
  };
  function region(seed, x0, y0, w, h) {                       // 一块 w×h 美术像素的图，rgba
    const M = 8, W = w + 2 * M, H = h + 2 * M, K = new Uint8Array(W * H), F = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = cls(seed, x0 + x - M, y0 + y - M); K[y * W + x] = k; F[y * W + x] = k && k !== 4 ? 1 : 0; }
    const near = dilate(F, W, H, 2), band = dilate(F, W, H, 5), rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y + M) * W + x + M, k = K[i], ax = x0 + x, ay = y0 + y;
      let c;
      if (F[i]) {
        if (k === 3) c = ay % 6 === 0 && (ax + (ay / 6 | 0) * 4) % 10 < 3 ? COL.wave : COL.water;
        else if (k === 6) c = ay % 3 === 0 ? COL.stair : COL.floor;
        else if (k === 5 && hs(ax >> 1, ay >> 1, seed + 720) < .1) c = COL.rubble;
        else c = (ax & 7) === 0 || (ay & 7) === 0 ? COL.grid : COL.floor;
      } else if (near[i]) c = COL.wall;
      else if (k === 4) c = (ax + ay) % 4 === 0 ? COL.hatch : COL.rock;   // 柱子里面打斜线
      else { const p = hs(ax, ay, seed + 721); c = (band[i] ? p < .1 : p < .006) ? COL.dot : COL.rock; }
      const o = (y * w + x) * 4;
      rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = 255;
    }
    return { rgba };
  }
  // 出口在哪（格子坐标，出口楼梯间的中心）
  const exit = seed => { const [ex, ey] = exitOf(seed); return [ex * CS / 4, ey * CS / 4]; };
  const walk = (seed, ax, ay) => { const k = cls(seed, ax, ay); return k > 0 && k !== 4; };   // 这个像素能不能走（居民走得，墙和柱子走不得）
  return { region, kindAt, exit, bias, cell, walk };
})();
