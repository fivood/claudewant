// 电路板按真正的板子画：绿色阻焊层下面走着铜线（只转直角和 45°），芯片四边一排引脚，小电阻电容两头是焊盘，
// 接插件是一排镀金的方焊盘，还有晶振、LED、大片铺铜和过孔，元件旁边印着白色的丝印标号（U7、R12、C3……）。
// 纸面按 48×48 美术像素分成一格格，每格放一个模块（或者只是几条线穿过去）；格子的每条边上开几个口，
// 两边的格子用同一组口，线就能一格接一格地连下去。每格画一次存起来，按像素查它是什么。
const BOARD = (() => {
  const CS = 48;
  const hs = (x, y, s) => {
    let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  // 像素是什么：0 基板 1 走线 2 焊盘 3 芯片 4 电阻 5 丝印 6 铺铜 7 镀金焊盘 8 过孔 9 LED 10 电容 11 钻孔 12 芯片上的凹点
  const KIND = ['grass', 'forest', 'snow', 'peak', 'rock', 'sand', 'deep', 'water', 'snow', 'rock', 'rock', 'snow', 'peak'];
  const COL = [[26, 100, 58], [64, 152, 90], [212, 214, 220], [30, 30, 34], [44, 44, 50], [232, 236, 226], [38, 118, 70], [216, 170, 82], [196, 198, 204], [226, 64, 52], [196, 150, 94], [14, 20, 16], [56, 56, 62]];
  const GLYPH = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111',
    U: '101101101101111', R: '110101110101101', C: '111100100100111', D: '110101101101110', J: '001001001101111', Y: '101101010010010' };
  const TYPES = ['qfp', 'qfp', 'soic', 'soic', 'passive', 'passive', 'passive', 'pour', 'conn', 'xtal', 'led', 'empty', 'empty'];
  const ports = (i, j, s) => {                                 // 一条边上的口：几个、从哪开始，每隔 4 个像素一个
    const n = [0, 1, 1, 2, 2, 3, 4][Math.floor(hs(i, j, s) * 7)], o = 6 + Math.floor(hs(i, j, s + 1) * (CS - 12 - 4 * Math.max(0, n - 1)));
    return Array.from({ length: n }, (_, k) => o + 4 * k);
  };
  const cells = new Map();
  let lastK = '', lastB = null;
  function cell(seed, ci, cj) {
    const k = seed + ':' + ci + ',' + cj;
    if (k === lastK) return lastB;
    let b = cells.get(k);
    if (!b) { b = build(seed, ci, cj); if (cells.size > 4096) cells.clear(); cells.set(k, b); }
    lastK = k; lastB = b;
    return b;
  }
  function build(seed, ci, cj) {
    const b = new Uint8Array(CS * CS), r = n => hs(ci * 13 + n, cj, seed + 800), id = n => 1 + Math.floor(r(n) * 39);
    const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < CS && y < CS) b[y * CS + x] = c; };
    const get = (x, y) => x >= 0 && y >= 0 && x < CS && y < CS ? b[y * CS + x] : -1;
    const rect = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, c); };
    const type = TYPES[Math.floor(r(1) * TYPES.length)], ops = [], labels = [], anc = [[], [], [], []];   // 东南西北四边的引脚（线往这接）
    const side = [ports(ci, cj, seed + 810).map(y => [CS - 1, y]), ports(ci, cj, seed + 812).map(x => [x, CS - 1]), ports(ci - 1, cj, seed + 810).map(y => [0, y]), ports(ci, cj - 1, seed + 812).map(x => [x, 0])];
    const part = (x, y, vert, c, s, label) => {               // 小电阻电容：两头焊盘，中间本体；焊盘朝哪边就接哪边的线
      if (vert) { ops.push([x, y, 2, 2, 2], [x, y + 2, 2, 3, c], [x, y + 5, 2, 2, 2]); anc[3].push([x, y - 1]); anc[1].push([x, y + 7]); labels.push([label + s, x + 3, y + 1]); }
      else { ops.push([x, y, 2, 2, 2], [x + 2, y, 3, 2, c], [x + 5, y, 2, 2, 2]); anc[2].push([x - 1, y]); anc[0].push([x + 7, y]); labels.push([label + s, x, y + 3]); }
    };
    if (type === 'pour') rect(0, 0, CS, CS, 6);
    if (type === 'qfp' || type === 'soic') {                  // 芯片：黑色本体，引脚每隔 2 个像素一根；小的只有两边有脚
      const q = type === 'qfp', w = q ? 12 + 2 * Math.floor(r(2) * 5) : 8, h = q ? w : 12 + 2 * Math.floor(r(2) * 4), rot = !q && r(3) < .5;
      const W = rot ? h : w, H = rot ? w : h, x0 = Math.floor((CS - W) / 2 + (r(4) - .5) * 8), y0 = Math.floor((CS - H) / 2 + (r(5) - .5) * 8);
      ops.push([x0, y0, W, H, 3], [x0 + 2, y0 + 2, 2, 2, 12], [x0 + 3, y0 + H - 4, W - 6, 1, 12]);
      const L = q ? 3 : 2;
      if (q || rot) for (let k = 2; k < W - 1; k += 2) { ops.push([x0 + k, y0 - L, 1, L, 2], [x0 + k, y0 + H, 1, L, 2]); anc[3].push([x0 + k, y0 - L - 1]); anc[1].push([x0 + k, y0 + H + L]); }
      if (q || !rot) for (let k = 2; k < H - 1; k += 2) { ops.push([x0 - L, y0 + k, L, 1, 2], [x0 + W, y0 + k, L, 1, 2]); anc[2].push([x0 - L - 1, y0 + k]); anc[0].push([x0 + W + L, y0 + k]); }
      labels.push(['U' + id(6), x0, y0 - L - 7]);
    } else if (type === 'passive') {
      const n = 2 + Math.floor(r(2) * 3);
      for (let k = 0; k < n; k++) part(6 + Math.floor(r(10 + k) * 30), 6 + k * Math.floor(36 / n) + Math.floor(r(20 + k) * 4), r(30 + k) < .4, r(40 + k) < .5 ? 4 : 10, id(50 + k), r(40 + k) < .5 ? 'R' : 'C');
    } else if (type === 'conn') {                             // 接插件：一排镀金方焊盘，外面一圈丝印框
      const n = 4 + Math.floor(r(2) * 4), top = r(3) < .5, y = top ? 8 : CS - 11, x0 = Math.floor((CS - n * 4) / 2);
      for (let k = 0; k < n; k++) { ops.push([x0 + k * 4, y, 3, 3, 7], [x0 + k * 4 + 1, y + 1, 1, 1, 11]); anc[top ? 1 : 3].push([x0 + k * 4 + 1, top ? y + 3 : y - 1]); }
      ops.push(['box', x0 - 2, y - 2, n * 4 + 3, 7]);
      labels.push(['J' + id(6), x0 - 2, top ? y - 8 : y + 6]);
    } else if (type === 'xtal') {                             // 晶振：银色的壳，两边两个小电容
      const x0 = 14 + Math.floor(r(2) * 8), y0 = 18 + Math.floor(r(3) * 8);
      ops.push([x0, y0, 12, 6, 2], [x0 + 1, y0 + 1, 10, 4, 8]);
      anc[2].push([x0 - 1, y0 + 2]); anc[0].push([x0 + 12, y0 + 3]);
      part(x0 - 2, y0 + 9, true, 10, id(7), 'C'); part(x0 + 12, y0 + 9, true, 10, id(8), 'C');
      labels.push(['Y' + id(6), x0, y0 - 7]);
    } else if (type === 'led') {
      const x0 = 16 + Math.floor(r(2) * 12), y0 = 16 + Math.floor(r(3) * 12);
      ops.push([x0, y0, 2, 3, 2], [x0 + 2, y0, 4, 3, 9], [x0 + 6, y0, 2, 3, 2]);
      anc[2].push([x0 - 1, y0 + 1]); anc[0].push([x0 + 8, y0 + 1]);
      labels.push(['D' + id(6), x0, y0 + 4]);
      part(x0 + 12, y0 - 1, false, 4, id(7), 'R');
    }
    for (const a of anc) a.sort((p, q) => p[0] + p[1] - q[0] - q[1]);
    // 走线：先直走一段，斜 45° 把横竖差补上，再直走进去——出来和进去都是正对着的
    const dot = (x, y, wide) => {
      set(x, y, 1);
      if (wide) set(x + 1, y, 1), set(x, y + 1, 1);
      for (let dy = -1; dy <= 1 + wide; dy++) for (let dx = -1; dx <= 1 + wide; dx++) if (get(x + dx, y + dy) === 6) set(x + dx, y + dy, 0);   // 铺铜给线让出一圈
    };
    const route = ([x, y], [tx, ty], horiz, wide) => {
      const along = horiz ? Math.abs(tx - x) : Math.abs(ty - y), cross = horiz ? Math.abs(ty - y) : Math.abs(tx - x), sx = Math.sign(tx - x), sy = Math.sign(ty - y);
      const s1 = Math.max(0, Math.floor((along - cross) / 2)), dg = Math.min(along, cross);
      dot(x, y, wide);
      const go = (dx, dy, n) => { for (let i = 0; i < n; i++) { x += dx; y += dy; dot(x, y, wide); } };
      if (horiz) { go(sx, 0, s1); go(sx, sy, dg); go(sx, 0, Math.abs(tx - x)); go(0, sy, Math.abs(ty - y)); }
      else { go(0, sy, s1); go(sx, sy, dg); go(0, sy, Math.abs(ty - y)); go(sx, 0, Math.abs(tx - x)); }
    };
    const vias = [];
    side.forEach((ps, s) => ps.forEach((p, k) => {           // 每个口：接到这边的引脚上；这边没脚就穿到对边的口；对边也没有，就打一个过孔下到别的层
      const horiz = s % 2 === 0, wide = k === 0 && hs(ci + s, cj, seed + 820) < .3, a = anc[s];
      if (a.length) { route(p, a[Math.round(k * (a.length - 1) / Math.max(1, ps.length - 1))], horiz, wide); return; }
      const o = side[(s + 2) % 4];
      if (o[k] && !anc[(s + 2) % 4].length) { if (s < 2) route(p, o[k], horiz, wide); return; }   // 穿过去的线只从东、南两边画一次
      const d = 8 + Math.floor(hs(ci * 7 + s, cj + k, seed + 821) * 12), q = [p[0] + [-d, 0, d, 0][s], p[1] + [0, -d, 0, d][s]];
      route(p, q, horiz, wide); vias.push(q);
    }));
    for (const o of ops) {
      if (o[0] === 'box') { const [, x0, y0, w, h] = o; for (let x = x0; x < x0 + w; x++) { set(x, y0, 5); set(x, y0 + h - 1, 5); } for (let y = y0; y < y0 + h; y++) { set(x0, y, 5); set(x0 + w - 1, y, 5); } continue; }
      rect(...o);
    }
    if (type === 'pour') for (let y = 4; y < CS - 3; y += 8) for (let x = 4; x < CS - 3; x += 8) if (get(x, y) === 6 && get(x - 1, y - 1) === 6 && get(x + 1, y + 1) === 6) vias.push([x, y]);   // 铺铜上一排排过孔
    for (const [x, y] of vias) { rect(x - 1, y - 1, 3, 3, 8); set(x, y, 11); }
    for (const [txt, x0, y0] of labels) [...txt].forEach((ch, n) => {   // 丝印只印在基板、走线和铺铜上
      const g = GLYPH[ch];
      for (let k = 0; k < 15; k++) if (g[k] === '1') { const x = x0 + n * 4 + k % 3, y = y0 + Math.floor(k / 3), c = get(x, y); if (c === 0 || c === 1 || c === 6) set(x, y, 5); }
    });
    return b;
  }
  const cls = (seed, ax, ay) => { const ci = Math.floor(ax / CS), cj = Math.floor(ay / CS); return cell(seed, ci, cj)[(ay - cj * CS) * CS + ax - ci * CS]; };
  const kindAt = (seed, ax, ay) => KIND[cls(seed, ax, ay)];
  function region(seed, x0, y0, w, h) {
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ax = x0 + x, ay = y0 + y, k = cls(seed, ax, ay), c = COL[k], o = (y * w + x) * 4;
      const n = k === 0 || k === 6 ? (hs(ax >> 1, ay, seed + 830) - .5) * 8 : k === 2 && (ax + ay) % 5 === 0 ? 18 : 0;   // 基板上一点玻纤的纹，焊锡上一点反光
      rgba[o] = c[0] + n; rgba[o + 1] = c[1] + n; rgba[o + 2] = c[2] + n; rgba[o + 3] = 255;
    }
    return { rgba };
  }
  return { region, kindAt, cls };
})();
