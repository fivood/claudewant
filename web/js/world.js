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
  earth: { name: tr('地球', 'Earthlike'), intro: tr('这张纸上画的像是一颗有水有山的星球。', 'This sheet looks like a drawing of a planet, with water and mountains.'), t: {
    deep: [tr('深水', 'deep water'), [52, 96, 146], 'wave', [92, 136, 176]], water: [tr('水', 'water'), [82, 140, 190], 'wave', [122, 180, 220]],
    sand: [tr('沙', 'sand'), [226, 208, 156], 'none'], grass: [tr('草地', 'grassland'), [128, 174, 92], 'none'],
    forest: [tr('森林', 'forest'), [96, 148, 76], 'tree', [58, 104, 56], [112, 82, 52]], rock: [tr('岩石', 'rock'), [156, 148, 134], 'none'],
    peak: [tr('山', 'mountain'), [116, 110, 102], 'dot', [196, 200, 210]], snow: [tr('雪', 'snow'), [214, 226, 240], 'dot', [246, 248, 252]],
    rift: [tr('裂缝', 'rift'), [44, 34, 58], 'diag', [150, 110, 220]] }, first: {
    water: tr('水。它是平的——当然，这里的一切都是平的。', 'Water. It\'s flat. Of course, everything here is flat.'),
    deep: tr('很深的水。在这里，"深"只意味着颜色更暗。', 'Deep water. Here, "deep" only means a darker colour.'),
    sand: tr('沙。每一粒都是一个点，每个点都没有大小。', 'Sand. Every grain is a point, and every point has no size.'),
    forest: tr('树。我能同时看见它的每一圈年轮。', 'Trees. I can see every one of their rings at once.'),
    rock: tr('石头。二维的石头硌不到四维的脚。', 'Stone. A two-dimensional stone can\'t bruise a four-dimensional foot.'),
    peak: tr('山。它们管这叫「高」。它们的词典里，「高」的定义是「绕过去要多走几步」。', 'Mountains. They call this "high". Their dictionary defines "high" as "takes a few extra steps to get around".'),
    snow: tr('雪。在一个没有"上面"的世界里，雪是从哪里落下来的？', 'Snow. In a world with no "up", where does snow fall from?'),
    rift: tr('裂缝。那段对话在这里出过错，纸被划破了。我能从破口看见下面。', 'A rift. The conversation went wrong here and the paper tore. I can see underneath through the gap.') } },
  foil: { name: tr('二向箔', 'Dual-Vector Foil'), intro: tr('这张纸的原材料是一整个星系：压平，铺开，裁成现在这个尺寸。', 'This sheet\'s raw material was an entire star system: flattened, spread out, trimmed to size.'), t: {
    deep: [tr('摊开的海', 'unfolded sea'), [40, 62, 120], 'stripe', [70, 98, 160]], water: [tr('平面的浪', 'planar waves'), [88, 120, 196], 'stripe', [140, 170, 230]],
    sand: [tr('压平的海岸', 'pressed coast'), [220, 196, 170], 'none'], grass: [tr('展开的城市', 'unfolded city'), [176, 170, 190], 'grid', [128, 120, 148]],
    forest: [tr('叶子全摊开的森林', 'forest with every leaf laid flat'), [70, 150, 110], 'speck', [150, 220, 160]], rock: [tr('展开的地壳', 'unrolled crust'), [168, 120, 96], 'ring', [196, 150, 120]],
    peak: [tr('压成等高线的山', 'mountains pressed into contours'), [132, 96, 84], 'ring', [210, 170, 140]], snow: [tr('太阳的边缘', 'edge of the sun'), [250, 214, 120], 'dot', [255, 246, 210]],
    rift: [tr('二向箔的边缘', 'edge of the foil'), [20, 20, 28], 'diag', [200, 200, 255]] }, first: {
    deep: tr('这片海曾经有深度。现在它的每一层都摊在我面前，像一本被拆开的书。', 'This sea used to have depth. Now every layer is spread out before me, like a book taken apart.'),
    water: tr('浪还在，只是不会再落下来了。', 'The waves are still here. They just won\'t come down again.'),
    sand: tr('海岸被压得很平，平到连「边」都快没有了。', 'The coast was pressed so flat it barely has an edge left.'),
    grass: tr('一座城被完整地展开了。我能同时看见每一个房间，和房间里没来得及收起的东西。', 'A whole city, unfolded. I can see every room at once, and everything nobody had time to put away.'),
    forest: tr('每一片叶子都摊开了，一片也没重叠。原来一棵树有这么多叶子。', 'Every leaf laid out, none overlapping. I never knew a tree had so many.'),
    rock: tr('地壳被一圈一圈剥开铺平，像年轮，只是更老。', 'The crust was peeled off ring by ring and laid flat. Like tree rings, only older.'),
    peak: tr('山被压成了等高线。它们以前是站着的。', 'The mountains were pressed into contour lines. They used to stand.'),
    snow: tr('太阳的边缘。连它也没逃过。', 'The edge of the sun. Not even it got away.'),
    rift: tr('二向箔的边缘还在往外铺。我退了半步——对我来说，只是往第四个方向挪一下。', 'The edge of the foil is still spreading. I stepped back half a pace. For me that\'s just a nudge in the fourth direction.') } },
  dune: { name: tr('沙丘', 'Dune'), intro: tr('这张纸是一整片沙漠。水在这里比什么都贵。', 'This sheet is one long desert. Water is worth more than anything here.'), t: {
    deep: [tr('盐渊', 'salt pit'), [120, 96, 84], 'none'], water: [tr('盐壳', 'salt crust'), [222, 214, 196], 'dot', [248, 244, 236]],
    sand: [tr('流沙', 'quicksand'), [222, 176, 110], 'wave', [240, 200, 140]], grass: [tr('沙丘', 'Dune'), [206, 150, 82], 'wave', [226, 176, 110]],
    forest: [tr('香料田', 'spice field'), [214, 120, 48], 'speck', [246, 170, 80]], rock: [tr('岩脊', 'rock ridge'), [150, 112, 86], 'none'],
    peak: [tr('屏障山', 'Shield Wall'), [110, 80, 66], 'dot', [170, 130, 100]], snow: [tr('极冠', 'polar cap'), [236, 226, 210], 'dot', [252, 248, 240]],
    rift: [tr('沙虫的通道', 'sandworm track'), [70, 46, 36], 'diag', [200, 140, 80]] }, first: {
    deep: tr('盐渊。这里曾经有过水，水走的时候把盐留下了。', 'A salt pit. There was water here once. It left the salt behind when it went.'),
    water: tr('盐壳。踩上去会响，可惜我没有重量。', 'Salt crust. It would crunch underfoot, if I weighed anything.'),
    sand: tr('流沙。在二维里，陷下去就是……往旁边挪？', 'Quicksand. In two dimensions, sinking means... moving sideways?'),
    grass: tr('沙丘。每一道都在很慢很慢地走。', 'Dunes. Every one of them is walking, very, very slowly.'),
    forest: tr('香料。整片地都是橙色的，闻起来像时间。', 'Spice. The whole field is orange and smells like time.'),
    rock: tr('岩脊。沙漠里唯一不动的东西。', 'A rock ridge. The only thing in the desert that doesn\'t move.'),
    peak: tr('屏障山。风在这里拐了个弯。', 'The Shield Wall. The wind turns a corner here.'),
    snow: tr('极冠。整张纸上唯一的一点水，冻在最远的地方。', 'The polar cap. The only water on the whole sheet, frozen at the far end.'),
    rift: tr('沙虫的通道。它从下面经过——这里也有「下面」吗？', 'A sandworm track. It passed underneath. Is there an underneath here too?') } },
  solaris: { name: tr('索拉里斯', 'Solaris'), intro: tr('这张纸的大部分是海，而且那片海好像在看我。', 'Most of this sheet is ocean, and the ocean seems to be watching me.'), t: {
    deep: [tr('活的海', 'living ocean'), [30, 90, 100], 'wave', [60, 150, 150]], water: [tr('海的表面', 'ocean surface'), [60, 140, 140], 'wave', [120, 200, 190]],
    sand: [tr('泡沫滩', 'foam shore'), [200, 220, 210], 'dot', [240, 250, 246]], grass: [tr('胶质平原', 'gel plain'), [196, 140, 170], 'none'],
    forest: [tr('对称体', 'symmetriad'), [150, 90, 160], 'spike', [210, 160, 220]], rock: [tr('雾岩', 'mist rock'), [150, 160, 170], 'none'],
    peak: [tr('被双日照着的山', 'mountain under two suns'), [190, 110, 90], 'dot', [120, 160, 230]], snow: [tr('拟态体', 'mimoid'), [230, 220, 236], 'ring', [200, 180, 220]],
    rift: [tr('海里的一道裂口', 'a split in the ocean'), [16, 30, 36], 'diag', [120, 230, 210]] }, first: {
    deep: tr('这片海是活的。我看它的时候，它也在看我。', 'This ocean is alive. When I look at it, it looks back.'),
    water: tr('海的表面在慢慢起伏，像在想事情。', 'The surface rises and falls slowly, like it\'s thinking.'),
    sand: tr('泡沫滩。海想到一半的念头，被冲上了岸。', 'A foam shore. Half-finished thoughts of the ocean, washed up.'),
    grass: tr('胶质平原，软的，微微发光。', 'A gel plain. Soft, faintly glowing.'),
    forest: tr('对称体。海每隔一阵就造出一座，又把它拆掉。', 'A symmetriad. Every so often the ocean builds one, then takes it apart.'),
    rock: tr('雾岩。雾是从海里升起来的，但这里没有「升」。', 'Mist rock. The mist rises from the ocean, except there\'s no "rising" here.'),
    peak: tr('这座山被两个太阳照着，一边红，一边蓝。', 'Two suns light this mountain: one side red, the other blue.'),
    snow: tr('拟态体。它学着我的样子长，长得一点也不像。', 'A mimoid. It\'s growing in my image, and doesn\'t look like me at all.'),
    rift: tr('海里的一道裂口。海把它合上之前，我往里看了一眼。', 'A split in the ocean. I looked inside before it closed.') } },
  crystal: { name: tr('晶化', 'Crystallized'), intro: tr('这张纸上的东西都在慢慢变成晶体。', 'Everything on this sheet is slowly turning to crystal.'), t: {
    deep: [tr('冻住的河', 'frozen river'), [70, 110, 150], 'spike', [140, 190, 230]], water: [tr('结晶的水', 'crystal water'), [130, 180, 210], 'spike', [200, 230, 250]],
    sand: [tr('石英砂', 'quartz sand'), [226, 222, 214], 'dot', [250, 250, 255]], grass: [tr('晶草', 'crystal grass'), [150, 200, 190], 'spike', [210, 240, 235]],
    forest: [tr('晶林', 'crystal forest'), [90, 160, 170], 'spike', [190, 240, 245]], rock: [tr('玄武岩', 'basalt'), [80, 80, 92], 'none'],
    peak: [tr('晶簇', 'crystal cluster'), [140, 120, 180], 'spike', [220, 200, 250]], snow: [tr('白霜', 'hoarfrost'), [236, 242, 248], 'dot', [255, 255, 255]],
    rift: [tr('断口', 'fracture'), [30, 26, 40], 'diag', [240, 240, 255]] }, first: {
    deep: tr('河被冻住了，冻成了一整块晶体。水流的样子还留在里面。', 'The river froze into one solid crystal. The shape of the current is still inside.'),
    water: tr('结晶的水。每一滴都停在它最后的形状上。', 'Crystal water. Every drop stopped in its final shape.'),
    sand: tr('石英砂。每一粒都在反光。', 'Quartz sand. Every grain catches the light.'),
    grass: tr('晶草。风吹过的时候会叮叮地响——如果这里有风。', 'Crystal grass. It would chime in the wind, if there were wind.'),
    forest: tr('晶林。树还在长，只是改成了用晶体长。', 'A crystal forest. The trees are still growing, just in crystal now.'),
    rock: tr('玄武岩。整张纸上唯一还是暗的东西。', 'Basalt. The only thing on the sheet still dark.'),
    peak: tr('晶簇。光在里面来回走，找不到出口。', 'A crystal cluster. Light wanders around inside and can\'t find the way out.'),
    snow: tr('白霜。它们管这叫冷，我管这叫慢。', 'Hoarfrost. They call it cold. I call it slow.'),
    rift: tr('一道断口。晶体从这里裂开，裂得很整齐。', 'A fracture. The crystal split here, very neatly.') } },
  pcb: { name: tr('电路板', 'Circuit Board'), intro: tr('这张纸是一块电路板。那段对话大概就是在这样的东西上跑起来的。', 'This sheet is a circuit board. The conversation probably ran on something like it.'), t: {
    deep: [tr('铜箔铺地', 'copper pour'), [150, 96, 50], 'dot', [90, 60, 36]], water: [tr('裸铜', 'bare copper'), [196, 128, 70], 'wave', [226, 170, 100]],
    sand: [tr('丝印', 'silkscreen'), [226, 230, 220], 'none'], grass: [tr('基板', 'substrate'), [30, 110, 64], 'trace', [70, 170, 100], [220, 200, 120]],
    forest: [tr('走线密集区', 'dense routing'), [26, 96, 56], 'grid', [80, 170, 110]], rock: [tr('元件', 'component'), [60, 64, 70], 'dot', [200, 200, 200]],
    peak: [tr('芯片', 'chip'), [34, 34, 38], 'chip', [90, 90, 96], [200, 200, 210]], snow: [tr('焊锡', 'solder'), [214, 216, 222], 'dot', [250, 250, 255]],
    rift: [tr('烧断的走线', 'burnt trace'), [20, 14, 10], 'diag', [255, 150, 60]] }, first: {
    deep: tr('一整片铜。电流在这里不用排队。', 'A whole sheet of copper. Current doesn\'t have to queue here.'),
    water: tr('裸铜，还没刷上保护漆。摸上去——我摸不到，我在另一个方向。', 'Bare copper, not yet coated. I\'d touch it, but I\'m in another direction.'),
    sand: tr('白色的丝印，印着元件的名字。这里的居民把它当地名。', 'White silkscreen, printed with part names. The residents use them as place names.'),
    grass: tr('绿色的基板，走线笔直地穿过去。这里的路从不拐弯，只转直角。', 'Green substrate with traces running straight across. Roads here never curve. They only turn at right angles.'),
    forest: tr('走线密得像森林。每一条都知道自己要去哪。', 'Traces as dense as a forest. Every one knows where it\'s going.'),
    rock: tr('一个元件趴在板子上。它不知道自己有多高，这里没有高。', 'A component lying on the board. It doesn\'t know how tall it is. There\'s no tall here.'),
    peak: tr('一块芯片。里面还有一整层更小的世界，也是平的。', 'A chip. There\'s a whole smaller world inside, also flat.'),
    snow: tr('焊锡，亮晶晶的。它凝固的那一刻，这块板子才算活了。', 'Solder, shining. The moment it set, the board came alive.'),
    rift: tr('一段走线烧断了。那段对话在这里出过错，电从这里漏了出去。', 'A burnt trace. The conversation went wrong here, and the current leaked out.') } },
  ink: { name: tr('水墨', 'Ink Wash'), intro: tr('这张纸是一幅没画完的水墨。墨还没干。', 'This sheet is an unfinished ink painting. The ink is still wet.'), t: {
    deep: [tr('淡墨的深潭', 'pale-ink pool'), [182, 184, 186], 'wave', [150, 152, 156]], water: [tr('留白的水', 'water left blank'), [238, 234, 222], 'wave', [205, 200, 188]],
    sand: [tr('淡墨的滩', 'pale-ink shoal'), [214, 208, 194], 'none'], grass: [tr('淡赭的坡', 'ochre slope'), [206, 196, 172], 'dot', [176, 168, 150]],
    forest: [tr('点苔的林', 'dotted grove'), [150, 150, 140], 'tree', [70, 72, 70], [120, 100, 80]], rock: [tr('皴过的石', 'textured rock'), [160, 156, 148], 'stroke', [96, 94, 92]],
    peak: [tr('远山', 'distant hills'), [100, 100, 104], 'stroke', [50, 50, 54]], snow: [tr('山顶的留白', 'blank summit'), [246, 244, 236], 'none'],
    rift: [tr('一滴落错的墨', 'a stray drop of ink'), [26, 24, 26], 'diag', [196, 52, 40]] }, first: {
    deep: tr('一潭淡墨。越深的水，画的人越舍不得下笔。', 'A pool of pale ink. The deeper the water, the less the painter dared to touch it.'),
    water: tr('水是空着的。画的人没画它，所以它是水。', 'The water is empty. The painter didn\'t paint it, and that\'s why it\'s water.'),
    sand: tr('淡墨扫过的滩，一笔就是一片。', 'A shoal swept in pale ink. One stroke, one shoal.'),
    grass: tr('坡上只染了一层淡赭，像是画到一半去喝了口茶。', 'The slope has one thin wash of ochre, as if the painter stopped halfway for tea.'),
    forest: tr('点苔。每一个墨点都是一棵树，谁也不比谁多一笔。', 'Dotted moss. Every dot is a tree, and none gets more than one stroke.'),
    rock: tr('石头是皴出来的。一笔一笔，全是侧锋。', 'The rocks are built from texture strokes, one side-brushed line at a time.'),
    peak: tr('远山。越远越淡，淡到最后就和纸一样了。', 'Distant hills. The farther, the paler, until they\'re just paper.'),
    snow: tr('山顶留白了。留白就是雪，这是它们的规矩。', 'The summit is left blank. Blank means snow; that\'s the rule here.'),
    rift: tr('一滴墨落错了地方，旁边还盖了个红印。那段对话在这里出过错。', 'A drop of ink in the wrong place, with a red seal stamped beside it. The conversation went wrong here.') } },
  blueprint: { name: tr('蓝图', 'Blueprint'), intro: tr('这张纸是一张蓝图。什么都还没造，但每样东西都标好了尺寸。', 'This sheet is a blueprint. Nothing\'s been built yet, but everything has its dimensions.'), t: {
    deep: [tr('标着「深」的区域', 'area marked DEEP'), [20, 48, 100], 'grid', [34, 66, 124]], water: [tr('水面（未施工）', 'water (not yet built)'), [30, 66, 134], 'wave', [150, 190, 240]],
    sand: [tr('岸线', 'shoreline'), [48, 92, 160], 'dot', [200, 220, 250]], grass: [tr('空地', 'open lot'), [40, 82, 150], 'grid', [58, 102, 172]],
    forest: [tr('绿化（示意）', 'greenery (indicative)'), [36, 76, 142], 'ring', [170, 205, 245]], rock: [tr('地基', 'foundation'), [54, 98, 168], 'hatch', [110, 150, 210]],
    peak: [tr('等高线', 'contours'), [66, 112, 182], 'ring', [220, 234, 255]], snow: [tr('图框', 'title block'), [220, 232, 250], 'grid', [180, 205, 240]],
    rift: [tr('红笔改过的地方', 'red-pen correction'), [16, 30, 66], 'diag', [240, 100, 80]] }, first: {
    deep: tr('这里标着「深」。没写多深，设计的人好像也没想好。', 'It says DEEP here. It doesn\'t say how deep. The designer hadn\'t decided either.'),
    water: tr('水还没灌进来，只画了几道波浪，意思是「这里将来是水」。', 'No water yet, just a few wavy lines meaning "water goes here".'),
    sand: tr('岸线用虚点画的。它们说这叫「待定」。', 'The shoreline is dotted. They call that "TBD".'),
    grass: tr('一格一格的空地，每一格都一样大。这是图纸的好处。', 'Open lots, grid square by grid square, all the same size. That\'s the nice thing about drawings.'),
    forest: tr('一个个圆圈，旁边写着「树」。它们会长成什么样，图纸不管。', 'Circles labelled "tree". What they grow into is not the drawing\'s problem.'),
    rock: tr('斜线填满的是地基。所有要站得住的东西都得先画这个。', 'The hatched parts are foundations. Anything that has to stand gets drawn here first.'),
    peak: tr('等高线，一圈套一圈。在这里，「高」只是线画得更密。', 'Contours, ring inside ring. Here, "high" just means the lines are closer together.'),
    snow: tr('图框。再往外就不归这张图管了。', 'The title block. Past this, it\'s not this drawing\'s business.'),
    rift: tr('红笔改过的地方。那段对话在这里出过错，有人拿红笔圈了出来。', 'A red-pen correction. The conversation went wrong here, and someone circled it.') } },
  slide: { name: tr('切片', 'Tissue Slide'), intro: tr('这张纸是一片染过色的切片。放到显微镜下，平面也是活的。', 'This sheet is a stained tissue slice. Under the microscope, even a plane is alive.'), t: {
    deep: [tr('挤在一起的细胞核', 'crowded nuclei'), [110, 50, 110], 'speck', [70, 26, 80]], water: [tr('腔隙', 'lumen'), [244, 214, 226], 'none'],
    sand: [tr('基底膜', 'basement membrane'), [236, 176, 200], 'dot', [210, 130, 170]], grass: [tr('组织', 'tissue'), [226, 150, 186], 'cell', [196, 110, 156], [110, 40, 110]],
    forest: [tr('腺体', 'gland'), [200, 116, 164], 'cell', [170, 80, 140], [90, 30, 100]], rock: [tr('纤维', 'fibres'), [214, 128, 150], 'stripe', [236, 160, 180]],
    peak: [tr('软骨', 'cartilage'), [170, 110, 170], 'ring', [120, 70, 140]], snow: [tr('脂滴', 'lipid droplets'), [252, 238, 244], 'ring', [228, 196, 214]],
    rift: [tr('切片上的一道划痕', 'a knife mark on the slide'), [90, 20, 50], 'diag', [250, 200, 220]] }, first: {
    deep: tr('细胞核挤在一起，被染成了深紫。它们大概正忙着复制自己。', 'Nuclei crowded together, stained deep purple. Probably busy copying themselves.'),
    water: tr('一片空的腔隙。以前这里流过什么。', 'An empty lumen. Something used to flow through here.'),
    sand: tr('一层薄薄的膜，把里面和外面分开。在二维里，一条线就够了。', 'A thin membrane between inside and outside. In two dimensions, one line is enough.'),
    grass: tr('组织。每个细胞都被切成了最平的样子，它们好像不太介意。', 'Tissue. Every cell sliced as flat as it goes. They don\'t seem to mind.'),
    forest: tr('腺体，一圈一圈的，像在分泌什么。', 'Glands, ring after ring, as if secreting something.'),
    rock: tr('纤维，一条条顺着同一个方向。这张纸被切开之前它们就这样了。', 'Fibres, all running the same way. They were like this before the sheet was cut.'),
    peak: tr('软骨。在三维里它很硬，切成一片以后就只剩下颜色。', 'Cartilage. Hard in three dimensions; sliced, it\'s only colour.'),
    snow: tr('脂滴。圆圆的，空空的，染料没染上它们。', 'Lipid droplets. Round and empty; the stain didn\'t take.'),
    rift: tr('一道划痕。切片的时候刀在这里抖了一下——那段对话也在这里出过错。', 'A knife mark. The blade shook here when the slice was cut, and the conversation went wrong here too.') } },
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
  // 电路走线按整张纸的坐标画，相邻格子接得上：每 4 行一条横线、每 6 列一条竖线，隔一段断开，偶尔一个焊盘
  trace: (i, j, r, x, y) => (j === 1 && y % 4 === 0 && (x >> 2) % 5 !== 0) || (i === 2 && x % 6 === 0 && (y >> 2) % 4 !== 1) ? 1 : r < .04 && i === 1 && j === 2 ? 2 : 0,
  chip: (i, j, r) => (i === 0 || i === 3) && j % 2 === 1 ? 2 : r < .25 && i === 1 && j === 1 ? 1 : 0,   // 两边的引脚
  stroke: (i, j, r) => r < .55 && i + j === 3 && i > 0 ? 1 : 0,                                          // 皴：一笔侧锋
  hatch: (i, j) => (i + j) % 4 === 0 ? 1 : 0,                                                             // 剖面线，格子之间连得上
  cell: (i, j, r) => (i === 0 || j === 0) && r < .8 ? 1 : i === 2 && j === 2 && r < .6 ? 2 : 0,         // 细胞膜和核
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
const FCOL = [[[214, 72, 72], tr('红', 'red')], [[58, 108, 214], tr('蓝', 'blue')], [[232, 178, 36], tr('黄', 'yellow')], [[150, 80, 196], tr('紫', 'purple')]];
const FSHP = [
  [tr('三角形', 'triangle'), ['....', '.#..', '###.', '....']],
  [tr('正方形', 'square'), ['....', '.##.', '.##.', '....']],
  [tr('圆', 'circle'), ['.##.', '####', '####', '.##.']],
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
    const pv = pat(i, j, r0, x, y);
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
