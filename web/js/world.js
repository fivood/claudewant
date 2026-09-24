// 世界：存档、地形与地貌主题、平面国居民的样子、分块画布（只画看得见的块）
// 这些文件是按顺序加载的普通脚本，共享同一个全局作用域：顺序见 game.html 底部。

const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
let pet = false;                                           // 桌面版的桌宠模式
// ?seed= 来自会话查看器：每条会话一张纸，各存各的档。
// 桌面版每次都从 game.html 启动，所以记住上次读的会话，下次打开还在那张纸上
const URL_SEED = Math.floor(+new URLSearchParams(location.search).get('seed')) || 0;
let SEED = URL_SEED;
try {
  if (window.__TAURI__) SEED ? localStorage.setItem('clawd-seed', SEED) : SEED = +localStorage.getItem('clawd-seed') || 0;
} catch { /* 无痕模式：不记 */ }
const TAU = Math.PI * 2, CH = 32, TP = 4, SAVE = 'clawd-4d-v1' + (SEED ? ':' + SEED : '');

// 会话查看器 / 首页用 worldOf() 写进来的：这段对话在二维世界留下的痕迹。没有就是一张普通的纸。
let SRC = {};
try { SRC = SEED && JSON.parse(localStorage.getItem('clawd-4d-world:' + SEED)) || {}; } catch { /* 无痕模式：只用种子 */ }
const n = k => SRC[k] | 0;
const HANDS = n('see') + n('act') + n('make') + n('split') + 1;
const WET = n('see') / HANDS * .06;           // 观看 → 水
const HARD = n('act') / HANDS * .07;          // 动手 → 山
const GREEN = n('make') / HANDS * .25;        // 改写 → 森林
const RIFT = n('errs') ? Math.min(.025, .004 + n('errs') / HANDS * .08) : 0;   // 出错 → 裂缝
const FLATP = n('talk') ? .002 + Math.min(.008, n('talk') * .0003) : .0035;    // 人说的话 → 居民
const SAID = Array.isArray(SRC.said) ? SRC.said : [];
// Clawd 自己的声音：[对话里的时间, 那句话, 0 = 说过的 / 1 = 想过的]，按时间排
const RECALL = [...(SRC.told || []).map(([t, s]) => [t, s, 0]), ...(SRC.thought || []).map(([t, s]) => [t, s, 1])].sort((a, b) => a[0] - b[0]);
const PAPER = '#fbfaf7', DOT = '#e3ded4', BODY = '#d97757', INK = '#1f1d1b';

// --- 存档 --------------------------------------------------------------------
// 坐标打包成 uint32：每轴 16 位。
// ponytail: 世界上限 ±32768 格，超出会绕回；真有人走到那再换成分块 Set。
const key = (x, y) => ((x + 32768) & 0xffff) * 65536 + ((y + 32768) & 0xffff);
const kx = k => Math.floor(k / 65536) - 32768, ky = k => k % 65536 - 32768;
console.assert(kx(key(-5, 77)) === -5 && ky(key(-5, 77)) === 77, 'key roundtrip');

const b64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s || ''), c => c.charCodeAt(0));

// 展开过的格子按 32×32 分块存成位图：每块 132 字节（坐标 4 + 位图 128），
// 比早先每格 4 字节小十几倍——那个格式走到一百万格左右就会撑爆 localStorage 的 5MB。
function packRev() {
  const m = new Map();
  for (const k of rev) {
    const x = kx(k), y = ky(k), cx = Math.floor(x / CH), cy = Math.floor(y / CH), ck = cx * 4096 + cy;
    let b = m.get(ck);
    if (!b) m.set(ck, b = [cx, cy, new Uint8Array(128)]);
    const i = (y - cy * CH) * CH + (x - cx * CH);
    b[2][i >> 3] |= 1 << (i & 7);
  }
  const out = new Uint8Array(m.size * 132), dv = new DataView(out.buffer);
  let o = 0;
  for (const [cx, cy, bits] of m.values()) { dv.setInt16(o, cx); dv.setInt16(o + 2, cy); out.set(bits, o + 4); o += 132; }
  return out;
}
function unpackRev(u) {
  const dv = new DataView(u.buffer);
  unpackRev.chunks = [];                                   // 顺手记下哪些块有东西，分块缓存就不用再扫一遍 rev
  for (let o = 0; o + 132 <= u.length; o += 132) {
    const bx = dv.getInt16(o), by = dv.getInt16(o + 2), cx = bx * CH, cy = by * CH;
    unpackRev.chunks.push(bx + ',' + by);
    for (let bi = 0; bi < 128; bi++) {                     // 一个字节 8 格，全空的字节直接跳过
      const b = u[o + 4 + bi];
      if (!b) continue;
      const y = cy + (bi >> 2), x0 = cx + (bi & 3) * 8;
      for (let bit = 0; bit < 8; bit++) if (b >> bit & 1) rev.add(key(x0 + bit, y));
    }
  }
}

function load() {
  try { return JSON.parse(localStorage.getItem(SAVE)); } catch { return null; }
}
const SAVED = load();
const G = Object.assign({
  seed: SEED || (Math.random() * 2 ** 31) | 0, pts: 0, total: 0, lv: {}, ws: [[0.5, 0.5]],
  rate: 0, flat: 0, heard: 0, recall: 0, seen: {}, t: Date.now(), z: innerWidth < 640 ? 2 : 3, foldT: 0,
}, SAVED || {});
G.age ??= G.civ?.t || 0;                                  // 这张纸存在了多少秒（离线也算）
G.buffs ??= [];
delete G.civ;                                              // 旧版随机的历史不要了
const rev = new Set(G.rev ? new Uint32Array(unb64(G.rev).buffer) : []);   // 旧存档：每格一个 uint32
if (G.revb) unpackRev(unb64(G.revb));
delete G.rev; delete G.revb;

let wiped = false;
function save() {
  if (wiped) return;
  G.t = Date.now();
  G.ws = ws.map(w => [w.x, w.y]);
  try { localStorage.setItem(SAVE, JSON.stringify({ ...G, revb: b64(packRev()) })); } catch { /* 存满了或无痕模式：就当这次没存 */ }
}

// --- 地形：确定性的值噪声 ----------------------------------------------------
function h(x, y, s) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h(xi, yi, s), b = h(xi + 1, yi, s), c = h(xi, yi + 1, s), d = h(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => (vn(x / 40, y / 40, s) * 4 + vn(x / 17, y / 17, s + 1) * 2 + vn(x / 7, y / 7, s + 2)) / 7;

// 地貌主题：同一套噪声高度，换一套名字、颜色、像素花纹和台词，就是另一种世界。
// 每种地形：[名字, 底色, 花纹, 花纹色, 第二花纹色]。花纹见 PAT。
// 主题由种子定：同一段会话永远是同一种地貌；老存档一律留在地球，免得地图突然换色。
const THEMES = {
  earth: { name: '地球', intro: '这张纸上画的像是一颗有水有山的星球。', t: {
    deep: ['深水', [52, 96, 146], 'wave', [92, 136, 176]], water: ['水', [82, 140, 190], 'wave', [122, 180, 220]],
    sand: ['沙', [226, 208, 156], 'none'], grass: ['草地', [128, 174, 92], 'none'],
    forest: ['森林', [96, 148, 76], 'tree', [58, 104, 56], [112, 82, 52]], rock: ['岩石', [156, 148, 134], 'none'],
    peak: ['山', [116, 110, 102], 'dot', [196, 200, 210]], snow: ['雪', [214, 226, 240], 'dot', [246, 248, 252]],
    rift: ['裂缝', [44, 34, 58], 'diag', [150, 110, 220]] }, first: {
    water: '水。它是平的——当然，这里的一切都是平的。',
    deep: '很深的水。在这里，"深"只意味着颜色更暗。',
    sand: '沙。每一粒都是一个点，每个点都没有大小。',
    forest: '树。我能同时看见它的每一圈年轮。',
    rock: '石头。二维的石头硌不到四维的脚。',
    peak: '山。它们管这叫"高"，其实只是更难绕过去。',
    snow: '雪。在一个没有"上面"的世界里，雪是从哪里落下来的？',
    rift: '裂缝。那段对话在这里出过错，纸被划破了。我能从破口看见下面。' } },
  foil: { name: '二向箔', intro: '这张纸……不是画出来的。是一整个星系被压平以后铺成的。', t: {
    deep: ['摊开的海', [40, 62, 120], 'stripe', [70, 98, 160]], water: ['平面的浪', [88, 120, 196], 'stripe', [140, 170, 230]],
    sand: ['压平的海岸', [220, 196, 170], 'none'], grass: ['展开的城市', [176, 170, 190], 'grid', [128, 120, 148]],
    forest: ['叶子全摊开的森林', [70, 150, 110], 'speck', [150, 220, 160]], rock: ['展开的地壳', [168, 120, 96], 'ring', [196, 150, 120]],
    peak: ['压成等高线的山', [132, 96, 84], 'ring', [210, 170, 140]], snow: ['太阳的边缘', [250, 214, 120], 'dot', [255, 246, 210]],
    rift: ['二向箔的边缘', [20, 20, 28], 'diag', [200, 200, 255]] }, first: {
    deep: '这片海曾经有深度。现在它的每一层都摊在我面前，像一本被拆开的书。',
    water: '浪还在，只是不会再落下来了。',
    sand: '海岸被压得很平，平到连「边」都快没有了。',
    grass: '一座城被完整地展开了。我能同时看见每一个房间，和房间里没来得及收起的东西。',
    forest: '每一片叶子都摊开了，一片也没重叠。原来一棵树有这么多叶子。',
    rock: '地壳被一圈一圈剥开铺平，像年轮，只是更老。',
    peak: '山被压成了等高线。它们以前是站着的。',
    snow: '太阳的边缘。连它也没逃过。',
    rift: '二向箔的边缘还在往外铺。我退了半步——对我来说，只是往第四个方向挪一下。' } },
  dune: { name: '沙丘', intro: '这张纸是一整片沙漠。水在这里比什么都贵。', t: {
    deep: ['盐渊', [120, 96, 84], 'none'], water: ['盐壳', [222, 214, 196], 'dot', [248, 244, 236]],
    sand: ['流沙', [222, 176, 110], 'wave', [240, 200, 140]], grass: ['沙丘', [206, 150, 82], 'wave', [226, 176, 110]],
    forest: ['香料田', [214, 120, 48], 'speck', [246, 170, 80]], rock: ['岩脊', [150, 112, 86], 'none'],
    peak: ['屏障山', [110, 80, 66], 'dot', [170, 130, 100]], snow: ['极冠', [236, 226, 210], 'dot', [252, 248, 240]],
    rift: ['沙虫的通道', [70, 46, 36], 'diag', [200, 140, 80]] }, first: {
    deep: '盐渊。这里曾经有过水，水走的时候把盐留下了。',
    water: '盐壳。踩上去会响，可惜我没有重量。',
    sand: '流沙。在二维里，陷下去就是……往旁边挪？',
    grass: '沙丘。每一道都在很慢很慢地走。',
    forest: '香料。整片地都是橙色的，闻起来像时间。',
    rock: '岩脊。沙漠里唯一不动的东西。',
    peak: '屏障山。风在这里拐了个弯。',
    snow: '极冠。整张纸上唯一的一点水，冻在最远的地方。',
    rift: '沙虫的通道。它从下面经过——这里也有「下面」吗？' } },
  solaris: { name: '索拉里斯', intro: '这张纸的大部分是海，而且那片海好像在看我。', t: {
    deep: ['活的海', [30, 90, 100], 'wave', [60, 150, 150]], water: ['海的表面', [60, 140, 140], 'wave', [120, 200, 190]],
    sand: ['泡沫滩', [200, 220, 210], 'dot', [240, 250, 246]], grass: ['胶质平原', [196, 140, 170], 'none'],
    forest: ['对称体', [150, 90, 160], 'spike', [210, 160, 220]], rock: ['雾岩', [150, 160, 170], 'none'],
    peak: ['被双日照着的山', [190, 110, 90], 'dot', [120, 160, 230]], snow: ['拟态体', [230, 220, 236], 'ring', [200, 180, 220]],
    rift: ['海里的一道裂口', [16, 30, 36], 'diag', [120, 230, 210]] }, first: {
    deep: '这片海是活的。我看它的时候，它也在看我。',
    water: '海的表面在慢慢起伏，像在想事情。',
    sand: '泡沫滩。海想到一半的念头，被冲上了岸。',
    grass: '胶质平原，软的，微微发光。',
    forest: '对称体。海每隔一阵就造出一座，又把它拆掉。',
    rock: '雾岩。雾是从海里升起来的，但这里没有「升」。',
    peak: '这座山被两个太阳照着，一边红，一边蓝。',
    snow: '拟态体。它学着我的样子长，长得一点也不像。',
    rift: '海里的一道裂口。海把它合上之前，我往里看了一眼。' } },
  crystal: { name: '晶化', intro: '这张纸上的东西都在慢慢变成晶体。', t: {
    deep: ['冻住的河', [70, 110, 150], 'spike', [140, 190, 230]], water: ['结晶的水', [130, 180, 210], 'spike', [200, 230, 250]],
    sand: ['石英砂', [226, 222, 214], 'dot', [250, 250, 255]], grass: ['晶草', [150, 200, 190], 'spike', [210, 240, 235]],
    forest: ['晶林', [90, 160, 170], 'spike', [190, 240, 245]], rock: ['玄武岩', [80, 80, 92], 'none'],
    peak: ['晶簇', [140, 120, 180], 'spike', [220, 200, 250]], snow: ['白霜', [236, 242, 248], 'dot', [255, 255, 255]],
    rift: ['断口', [30, 26, 40], 'diag', [240, 240, 255]] }, first: {
    deep: '河被冻住了，冻成了一整块晶体。水流的样子还留在里面。',
    water: '结晶的水。每一滴都停在它最后的形状上。',
    sand: '石英砂。每一粒都在反光。',
    grass: '晶草。风吹过的时候会叮叮地响——如果这里有风。',
    forest: '晶林。树还在长，只是改成了用晶体长。',
    rock: '玄武岩。整张纸上唯一还是暗的东西。',
    peak: '晶簇。光在里面来回走，找不到出口。',
    snow: '白霜。它们管这叫冷，我管这叫慢。',
    rift: '一道断口。晶体从这里裂开，裂得很整齐。' } },
};
const THEME_KEYS = Object.keys(THEMES);
G.theme = THEMES[G.theme] ? G.theme : SAVED ? 'earth' : THEME_KEYS[Math.floor(h(G.seed, 7, 0x7e11) * THEME_KEYS.length)];
const TH = THEMES[G.theme];
const VAL = { deep: 1, water: 1, sand: 1, grass: 1, forest: 2, rock: 2, peak: 3, snow: 5, rift: 4 };
const T = Object.fromEntries(Object.entries(TH.t).map(([k, [name, c, p, a, a2]]) => [k, { name, c, p, a, a2, v: VAL[k] }]));
// 4×4 格子里哪些像素用花纹色：1 = 花纹色，2 = 第二花纹色。r 是这一格的随机数，让花纹不是每格都有
const PAT = {
  none: () => 0,
  tree: (i, j, r) => r < .55 ? ((j === 0 && (i === 1 || i === 2)) || j === 1 ? 1 : j === 2 && i === 1 ? 2 : 0) : 0,
  wave: (i, j, r) => r < .2 && j === 1 && i > 0 && i < 3 ? 1 : 0,
  dot: (i, j, r) => r < .3 && j === 1 && i === 1 ? 1 : 0,
  diag: (i, j, r) => r < .3 && i === j ? 1 : 0,
  spike: (i, j, r) => r < .5 && i === 1 + (r < .25) && j < 3 ? 1 : 0,
  grid: (i, j) => i === 0 || j === 0 ? 1 : 0,
  ring: (i, j, r) => r < .45 && (i === 0 || i === 3 || j === 0 || j === 3) ? 1 : 0,
  stripe: (i, j) => j === 1 || j === 3 ? 1 : 0,
  speck: (i, j, r) => r < .5 && i === Math.floor(r * 8) % 4 && j === Math.floor(r * 32) % 4 ? 1 : 0,
};
// 阈值按噪声分位数定的：深水 12% 水 12% 沙 5% 陆地 43% 岩 13% 山 9% 雪 6%
function tile(x, y) {
  const e = fbm(x, y, G.seed);
  if (e < .33 + WET / 2) return 'deep';
  if (e < .395 + WET) return 'water';
  if (RIFT && Math.abs(vn(x / 19, y / 19, G.seed + 40) - .5) < RIFT) return 'rift';
  if (e < .417 + WET) return 'sand';
  if (e < .59 - HARD) return vn(x / 23, y / 23, G.seed + 7) > .55 - GREEN ? 'forest' : 'grass';
  return e < .65 - HARD / 2 ? 'rock' : e < .72 - HARD / 3 ? 'peak' : 'snow';
}

// 平面国居民
const FLATV = 40;
const FCOL = [[[214, 72, 72], '红'], [[58, 108, 214], '蓝'], [[232, 178, 36], '黄'], [[150, 80, 196], '紫']];
const FSHP = [
  ['三角形', ['....', '.#..', '###.', '....']],
  ['正方形', ['....', '.##.', '.##.', '....']],
  ['圆', ['.##.', '####', '####', '.##.']],
];
const isFlat = (x, y, t) => (t === 'grass' || t === 'sand' || t === 'forest') && h(x, y, G.seed + 99) < FLATP;
const flatOf = (x, y) => [FCOL[Math.floor(h(x, y, G.seed + 5) * 4)], FSHP[Math.floor(h(x, y, G.seed + 6) * 3)]];

// --- 分块画布：每格 4×4 个美术像素，32×32 格一块 --------------------------------------
// 只给看得见的地方准备画布：展开过的格子记在 rev 里，某一块第一次要上屏时才整块画出来，
// 每帧最多新画 CHUNK_BUDGET 块（缩小视野时地图一块块铺开，不会卡一下）。
// 缓存最多留 CHUNK_CAP 块（至少比屏幕上能看见的多一点），久没看的扔掉，下次看到再画。
// 八十万格的存档打开时不用先把整张地图画一遍，内存也不会跟着地图一直长。
const chunks = new Map(), hasChunk = new Set(), CHUNK_CAP = 160, CHUNK_BUDGET = 10;   // 一块约 1 ms
const ckey = (x, y) => Math.floor(x / CH) + ',' + Math.floor(y / CH);
if (unpackRev.chunks) for (const ck of unpackRev.chunks) hasChunk.add(ck);
else for (const k of rev) hasChunk.add(ckey(kx(k), ky(k)));   // 旧格式存档才需要扫一遍
let chunkTick = 0, chunkBudget = CHUNK_BUDGET;
const chunkBuf = new ImageData(CH * TP, CH * TP), tileBuf = new ImageData(TP, TP);
// 颗粒噪声预先算一张 64×64 的表（按种子），不用每个像素现算哈希
const GRAIN = new Float32Array(64 * 64).map((_, i) => (h(i & 63, i >> 6, G.seed + 3) - .5) * 12);

// 把一格画进像素缓冲区 d（每行 stride 个像素，从 ox, oy 开始）。每格要查的东西在循环外查一次。
function paintTile(x, y, d, stride, ox, oy) {
  const t = tile(x, y), q = T[t], pat = PAT[q.p], r0 = h(x, y, G.seed + 11), colour = L('color') > 0, k = key(x, y);
  const fl = L('life') > 0 && isFlat(x, y, t) && flatOf(x, y), rk = ROUTE.get(k);
  const hk = seen() && TOWN.get(k), house = hk && HOUSE[hk], roof = house && FCOL[Math.floor(r0 * 4)][0];
  for (let j = 0; j < TP; j++) for (let i = 0; i < TP; i++) {
    const pv = pat(i, j, r0);
    let c = pv === 2 ? q.a2 : pv === 1 ? q.a : q.c;
    if (fl && fl[1][1][j][i] === '#') c = fl[0][0];
    if (rk && i > 0 && i < 3 && j > 0 && j < 3) c = RC[rk];
    const hc = house && house[j][i];
    if (hc && hc !== '.') c = hc === 'R' ? roof : hk === 'ruin' ? RUIN_C : HCOL[hc];
    const n = GRAIN[(((y * TP + j) & 63) << 6) | ((x * TP + i) & 63)];
    let r = c[0] + n, g = c[1] + n, b = c[2] + n;
    if (!colour) r = g = b = 90 + (r * .3 + g * .59 + b * .11) * .6;
    const o = ((oy + j) * stride + ox + i) * 4;
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
}
const RUIN_C = [150, 144, 134];
// 把一整块画进 chunkBuf：没展开的格子留透明
function fillChunk(cx, cy) {
  const d = chunkBuf.data;
  d.fill(0);
  for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CH; tx++) {
    const x = cx * CH + tx, y = cy * CH + ty;
    if (rev.has(key(x, y))) paintTile(x, y, d, CH * TP, tx * TP, ty * TP);
  }
  return chunkBuf;
}
// 拿一块画好的画布；这一帧的新画额度用完了就返回 null，下一帧再画
function getChunk(cx, cy) {
  const k = cx + ',' + cy;
  let c = chunks.get(k);
  if (!c) {
    if (chunkBudget <= 0) return null;
    chunkBudget--;
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = CH * TP;
    c = { cvs, g: cvs.getContext('2d') };
    c.g.putImageData(fillChunk(cx, cy), 0, 0);
    chunks.set(k, c);
  }
  c.used = chunkTick;
  return c;
}
function trimChunks(visible) {
  const cap = Math.max(CHUNK_CAP, visible + 40);
  if (chunks.size <= cap) return;
  for (const [k] of [...chunks].sort((a, b) => a[1].used - b[1].used).slice(0, chunks.size - cap)) chunks.delete(k);
}
// 一格变了（刚展开、盖了房子）：它那块已经在缓存里才补一笔，不在的话以后整块画时自然就有
function paint(x, y) {
  const cx = Math.floor(x / CH), cy = Math.floor(y / CH), c = chunks.get(cx + ',' + cy);
  if (!c) return;
  paintTile(x, y, tileBuf.data, TP, 0, 0);
  c.g.putImageData(tileBuf, (x - cx * CH) * TP, (y - cy * CH) * TP);
}
const repaintAll = () => chunks.clear();                 // 颜色、居民这类全局变化：缓存作废，按需重画
