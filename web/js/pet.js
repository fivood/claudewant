// 桌面版的桌宠 = 线国，以及自动更新
// 这些文件是按顺序加载的普通脚本，共享同一个全局作用域：顺序见 game.html 底部。

// --- 桌宠 = 线国：缩到任务栏上，Clawd 自己也成了平面生物，世界跟着塌成一条线 ---------------
// 线国就是那张纸的一行：缩成桌宠那一刻 Clawd 所在的那一行。桌宠往哪走，这一行就往哪展开，
// 回到完整游戏时地图上会多出一道横线。二维里的截面在桌宠时停下，只剩这条线在长。
// 一维里谁也绕不过谁：遇到线国居民，Clawd 只能「跳出」这条线从上面跨过去。
// 屏幕边就是这一段线的尽头，走到头把线对折，从屏幕另一头接着走。
// 窗口是贴着任务栏的一长条（300×68），线上有高的奇观时长高，说话时再长高装下气泡。不用鼠标穿透：Windows 上取光标位置不可靠。
// 奇观是三维的：横在线上时看到的是侧面剖面，Clawd 得想办法过去（见 passLine）。
const TAURI = window.__TAURI__;
const TRACK = 300, TILE = 8, STROLL = 36;                  // 窗口宽、线上一格多宽、每秒走多少（逻辑像素）
const ART = TILE / 4;                                     // 奇观的一个美术像素在线国里多宽（横竖一样）
const BASE_H = 64, UNDER = 12;                            // 画布基础高度；线下面留出来画坑的高度
let PW = TRACK, PH = BASE_H + 4, canvasH = BASE_H;
// alt：Clawd 离线多高（美术像素，负的是在坑里）；act：正在做的特殊动作；tint：身上的炉火色还剩几秒
const buddy = { x: 1e9, dir: -1, rest: 1, anim: 0, walking: false, hop: 0, alt: 0, act: null, t: 0, alpha: 1, tint: 0 };
const pctx = $('petcv').getContext('2d');
let bubbleT = 0, moveT = 0, lastX = null, lineCell = null;
G.line ??= { x: 0.5, y: 0, walked: 0 };                    // 线国：在哪一行、走到了哪、一共展开了几格

function fitPet() {
  if (!TAURI || !pet) return;
  PH = canvasH + 4 + ($('bubble').hidden ? 0 : $('bubble').offsetHeight + 6);
  lastX = null;                                            // 下一帧按新大小重新摆位置
  TAURI.window.getCurrentWindow().setSize(new TAURI.dpi.LogicalSize(PW, PH));
}
function sizePet(h = canvasH) {
  const c = $('petcv'), k = devicePixelRatio || 1;
  canvasH = h;
  c.style.height = h + 'px';
  c.width = Math.round(TRACK * k); c.height = Math.round(h * k);
}
const lineFolk = x => { const t = tile(x, G.line.y); return seen() && rev.has(key(x, G.line.y)) && isFlat(x, G.line.y, t); };

// --- 线国里的奇观：三维的东西横在一条线上，看到的是它的侧面剖面 ------------------------------
// 取线国那一行穿过奇观的那条带子，每一列（一个美术像素宽）记下顶有多高、什么颜色，或者是多深的坑。
// 桥在坑上面，顶高 1：有桥的列能走过去，没桥的列会掉下去。
let LINE_W = [];
function lineWonders() {
  const y = G.line.y;
  LINE_W = [];
  for (const w of WONDERS) {
    const top = (y - w.y) * 4, bot = top + 4, cols = new Map();
    for (const [bx, by, bz, bw, bd, bh, c] of w.boxes) {
      if (by + bd <= top || by >= bot) continue;
      for (let ax = Math.floor(bx); ax < Math.ceil(bx + bw); ax++) {
        const cur = cols.get(ax);
        if (!cur || bz + bh > cur.top) cols.set(ax, { top: bz + bh, color: c, pit: cur?.pit || 0 });
      }
    }
    for (const [px, py, pw, pd, depth] of w.pits || []) {
      if (py + pd <= top || py >= bot) continue;
      for (let ax = Math.floor(px); ax < Math.ceil(px + pw); ax++) {
        const cur = cols.get(ax);
        if (cur) cur.pit = Math.max(cur.pit, depth); else cols.set(ax, { top: 0, color: null, pit: depth });
      }
    }
    if (!cols.size) continue;
    const xs = [...cols.keys()], base = w.x * 4;
    LINE_W.push({ w, cols, x0: base + Math.min(...xs), x1: base + Math.max(...xs) + 1, maxTop: Math.max(...[...cols.values()].map(c => c.top)) });
  }
}
const wonderAt = ax => LINE_W.find(l => ax >= l.x0 && ax < l.x1);
// 线上某一列能站的高度：奇观顶上是正的，坑里是负的，别处是 0
function groundAt(ax) {
  const l = wonderAt(ax), c = l && l.cols.get(Math.floor(ax) - l.w.x * 4);
  return !c ? 0 : c.top > 0 ? c.top : -c.pit;
}
// 脚下站得住的高度：看两只脚之间最高的那一列（窄坑掉不下去，窄台子站得上去）
const footing = ax => Math.max(groundAt(ax - 2), groundAt(ax), groundAt(ax + 2));

// 遇到奇观怎么过去：大多数就爬（地面高了往上爬、低了往下落，坑和桥也是这条规矩）；
// 发射台把它发射过去，锻炉从炉门穿过去，太高爬不上去的就往第四个方向迈一步。
const CLIMB_MAX = 22, SAID_AT = new Map();
function passLine(l) {
  const m = l.w.m, n = l.w.name;
  if (m.kindKey === 'deploy') return ['launch', tr(`那段对话从这里发射过 ${m.n} 次。这次发射的是我。三、二、一——`, `The conversation launched from here ${m.n} times. This time it's launching me. Three, two, one...`)];
  if (m.kindKey === 'build') return ['furnace', tr(`我从${n}里穿了过去。进去的时候是橙色的，出来的时候更橙了。`, `I walked straight through the ${n}. I went in orange and came out more orange.`)];
  if (l.maxTop > CLIMB_MAX) return ['phase', tr(`${n}太高了。我往第四个方向迈了一步——线国的人会以为我死了一次。`, `The ${n} is too tall. I stepped into the fourth direction. Lineland will think I died for a moment.`)];
  if (m.k === 'err') return ['climb', m.ok ? tr(`有人修好了「${m.label}」，所以这里有桥。`, `Someone fixed "${m.label}", so there's a bridge here.`) : tr(`「${m.label}」一直没修好。每个经过的人都得下去一趟。`, `"${m.label}" was never fixed. Everyone who passes has to climb down into it.`)];
  return ['climb', tr(`${n}横在线上。在一维里，爬高就是换一种方式往前走。`, `The ${n} lies across the line. In one dimension, climbing is just another way of going forward.`)];
}
function speakOnce(l, text) {                              // 同一个奇观两分钟内只念叨一次
  const now = performance.now();
  if (now - (SAID_AT.get(l.w.id) || -1e9) < 120000) return;
  SAID_AT.set(l.w.id, now);
  bubbleAt = -1e9;
  say(text, { bubble: true });
}

function petTick(dt) {
  const b = buddy, max = Math.max(0, screen.availWidth - TRACK), L1 = G.line;
  const step = d => { b.x += d * TILE; L1.x += d; };        // 在线上挪 d 格，屏幕上的窗口跟着挪
  const ax = () => L1.x * 4;
  b.anim += dt; b.hop = Math.max(0, b.hop - dt); b.tint = Math.max(0, b.tint - dt);
  if (b.act === 'launch') {                                // 发射：先倒数，再沿抛物线飞过去
    b.t += dt; b.walking = false;
    if (b.t > 1.4) {
      const p = Math.min(1, (b.t - 1.4) / 1.3), l = b.l;
      const from = b.from, to = (b.dir > 0 ? l.x1 + 12 : l.x0 - 12) / 4;
      step(from + (to - from) * p - L1.x);
      b.alt = Math.sin(p * Math.PI) * (l.maxTop + 16) + (1 - p) * b.alt0;
      if (p >= 1) { b.act = null; b.alt = 0; }
    }
  } else if (b.act === 'phase') {                          // 往第四个方向迈一步：淡出，挪到另一边，淡入
    b.t += dt; b.walking = false;
    if (b.t < .6) b.alpha = 1 - b.t / .6;
    else if (!b.jumped) { b.jumped = true; step((b.dir > 0 ? b.l.x1 + 6 : b.l.x0 - 6) / 4 - L1.x); b.alt = 0; }
    else if (b.t < 1.4) b.alpha = (b.t - .8) / .6;
    else { b.alpha = 1; b.act = null; }
    b.alpha = Math.max(0, Math.min(1, b.alpha));
  } else if (b.rest > 0 && b.alt === footing(ax())) { b.rest -= dt; b.walking = false; }
  else {
    const here = footing(ax()), ahead = footing(ax() + b.dir * 5);
    const l = wonderAt(ax() + b.dir * 6);
    if (l && !b.act && b.lastL !== l) {                    // 新碰到一个奇观：决定怎么过
      b.lastL = l;
      const [how, text] = passLine(l);
      speakOnce(l, text);
      for (let c = Math.floor(l.x0 / 4); c <= Math.floor((l.x1 - 1) / 4); c++) reveal(c, L1.y, 0);   // 整个奇观一下子露出来
      if (how === 'launch') Object.assign(b, { act: 'launch', t: 0, l, from: L1.x, alt0: b.alt });
      else if (how === 'phase') Object.assign(b, { act: 'phase', t: 0, l, jumped: false });
      else if (how === 'furnace') Object.assign(b, { act: 'furnace', l });
    }
    if (b.act === 'furnace') {                             // 锻炉：地面当 0 走过去，里面半透明，出来染色
      b.walking = true; step(b.dir * STROLL / TILE * dt);
      const inside = ax() >= b.l.x0 && ax() < b.l.x1;
      b.alpha = inside ? .35 : 1;
      if (!inside && (b.dir > 0 ? ax() >= b.l.x1 : ax() < b.l.x0)) { b.act = null; b.alpha = 1; b.tint = 6; }
    } else if (ahead - b.alt > 1.5) { b.walking = false; b.alt = Math.min(ahead, b.alt + 14 * dt); }   // 前面是墙：原地往上爬
    else if (here < b.alt - .1 && ahead < b.alt - .1) { b.walking = true; b.alt = Math.max(Math.max(here, ahead), b.alt - 30 * dt); step(b.dir * STROLL / TILE * dt * .4); }   // 脚下和前面都空了才往下落
    else {
      b.alt = Math.max(b.alt, here, Math.min(ahead, b.alt + 1.5));   // 一级小台阶直接迈上去
      b.walking = true; step(b.dir * STROLL / TILE * dt);
      if (b.alt === 0 && !l && Math.random() < dt / 7) { b.rest = 1 + Math.random() * 5; if (Math.random() < .4) b.dir *= -1; }
      if (b.hop <= 0 && b.alt === 0 && lineFolk(Math.floor(L1.x + b.dir * .8))) b.hop = .5;   // 前面有居民：跳过去
    }
    if (!wonderAt(ax()) && !l) b.lastL = null;
  }
  if (b.x < 0 || b.x > max) {                              // 屏幕到头：把线折一下，从另一头接着走
    b.x = b.x < 0 ? max : 0;
    if (!G.seen.lineFold) { G.seen.lineFold = 1; bubbleAt = -1e9; say(tr('屏幕到头了。我把这条线折了一下，从另一头接着走。', 'End of the screen. I folded the line and carried on from the other end.'), { bubble: true }); }
  }
  const cell = Math.floor(L1.x);
  if (cell !== lineCell) {
    lineCell = cell;
    for (const c of [cell, cell + b.dir, cell + 2 * b.dir])   // 往前多看两格，奇观不会突然冒出来
      if (!rev.has(key(c, L1.y))) { if (c === cell) L1.walked++; reveal(c, L1.y, 0); }
    if (L1.walked >= 80 && !G.seen.lineKing) {
      G.seen.lineKing = 1; bubbleAt = -1e9;
      say(tr('我遇见了线国国王。他坚持世界只有一条线。我往「旁边」挪了一步，他以为我死了。', 'I met the King of Lineland. He insists the world is a single line. I stepped "sideways" and he thought I\'d died.'), { bubble: true });
    }
  }
  // 窗口要够高：看得见的奇观和 Clawd 飞到的高度都要装下；按 32 像素一档变，免得一直改大小
  const need = Math.max(b.alt + (b.act === 'launch' ? b.l.maxTop + 16 : 0), ...LINE_W.filter(l => Math.abs((l.x0 + l.x1) / 2 - ax()) < 90).map(l => l.maxTop), 0) * ART;
  const h = BASE_H + Math.min(128, Math.ceil(need / 32) * 32);
  if (h !== canvasH) { sizePet(h); fitPet(); }
  if (bubbleT > 0 && (bubbleT -= dt) <= 0) { $('bubble').hidden = true; fitPet(); }
  drawLine();
  if (TAURI && (moveT += dt) >= 1 / 30) {                  // 挪窗口 30 次/秒就够了
    moveT = 0;
    const x = Math.round((screen.availLeft || 0) + b.x), y = Math.round((screen.availTop || 0) + screen.availHeight - PH);
    if (x !== lastX) { lastX = x; TAURI.window.getCurrentWindow().setPosition(new TAURI.dpi.LogicalPosition(x, y)); }
  }
}

// 画 Clawd 身边那一段线：展开过的格子是地形的颜色，没展开的是空白纸上的虚线，两头渐隐——一维里只看得见近处。
// 线上的奇观画成侧面剖面，坑画在线下面。
function drawLine() {
  const k = devicePixelRatio || 1, c = $('petcv');
  if (c.width !== Math.round(TRACK * k) || c.height !== Math.round(canvasH * k)) sizePet();        // 画布还是默认的 300×150（没来得及定尺寸），或者窗口换到了缩放不同的屏幕：先定尺寸，不然整只被压扁
  const g = pctx, W = c.width, H = c.height, L1 = G.line;
  const T = TILE * k, cx = W / 2, ly = H - Math.round(UNDER * k), lh = Math.round(4 * k), u = Math.round(4 * k), a1 = ART * k;
  const fade = sx => { const d = Math.abs(sx - cx) / (W / 2); return Math.max(0, 1 - d * d); };
  g.clearRect(0, 0, W, H);
  for (let x = Math.floor(L1.x - cx / T) - 1; x <= Math.ceil(L1.x + cx / T) + 1; x++) {
    const sx = Math.round(cx + (x - L1.x) * T), a = fade(sx + T / 2);
    if (a <= .02) continue;
    g.globalAlpha = a;
    const kk = key(x, L1.y), t = tile(x, L1.y);
    if (!rev.has(kk)) {
      g.fillStyle = DOT;
      if (x % 2 === 0) g.fillRect(sx, ly + Math.round(1.5 * k), Math.ceil(T / 2), Math.max(1, Math.round(k)));
      continue;
    }
    let [r, gg, bb] = T_COL(t);
    g.fillStyle = `rgb(${r},${gg},${bb})`;
    g.fillRect(sx, ly, Math.ceil(T) + 1, lh);
    const hk = seen() && TOWN.get(kk);
    if (hk && hk !== 'road') { g.fillStyle = hk === 'temple' ? '#e3b53b' : hk === 'ruin' ? '#968f86' : '#d6484a'; g.fillRect(sx + 1, ly - 2 * u, Math.ceil(T) - 2, 2 * u); }
    if (lineFolk(x)) { const [[fc]] = flatOf(x, L1.y); g.fillStyle = `rgb(${fc})`; g.fillRect(sx, ly - u, Math.ceil(T), u); }
  }
  for (const l of LINE_W) for (const [dx, col] of l.cols) {  // 奇观的侧面：一列一列立在线上；坑往线下凹
    const axx = l.w.x * 4 + dx, sx = Math.round(cx + (axx / 4 - L1.x) * T), a = fade(sx);
    if (a <= .02 || !rev.has(key(Math.floor(axx / 4), L1.y))) continue;
    g.globalAlpha = a;
    if (col.pit && col.top <= 1) { g.fillStyle = '#2a2430'; g.fillRect(sx, ly, Math.ceil(a1), Math.round(Math.min(col.pit * ART, UNDER - 1) * k)); }
    if (col.top > 0) {
      const cc = C3[col.color] || C3.stone, hgt = Math.round(col.top * a1);
      g.fillStyle = `rgb(${cc.map(v => Math.round(v * .82))})`; g.fillRect(sx, ly - hgt, Math.ceil(a1), hgt);
      g.fillStyle = `rgb(${cc})`; g.fillRect(sx, ly - hgt, Math.ceil(a1), Math.max(1, Math.round(k)));   // 顶上一道亮边
    }
  }
  g.globalAlpha = buddy.alpha;
  const hop = Math.sin(Math.min(1, 1 - buddy.hop / .5) * Math.PI) * (buddy.hop > 0 ? 12 * k : 0);
  const glow = buddy.tint > 0 ? Math.min(1, buddy.tint / 3) : 0;   // 锻炉的火色慢慢褪掉
  drawClawd(cx, ly - buddy.alt * a1 - hop, u, { x: 0, y: 0, tx: buddy.walking ? 1 : 0, ty: 0, anim: buddy.anim,
    body: glow ? `rgb(${Math.round(217 + 38 * glow)},${Math.round(119 - 40 * glow)},${Math.round(87 - 50 * glow)})` : null }, g);
  g.globalAlpha = 1;
}
const T_COL = t => { const [r, g, b] = T[t].c; if (L('color')) return [r, g, b]; const l = 90 + (r * .3 + g * .59 + b * .11) * .6; return [l, l, l]; };

async function setMode(p) {
  if (p === pet) return;
  pet = p;
  document.documentElement.classList.toggle('pet', p);
  if (p) {                                                 // 缩进线国：Clawd 所在的那一行就是这条线
    // 附近有奇观的话，让这条线从它身上穿过去，桌宠挂着的时候才碰得到
    const near = WONDERS.map(w => [w, Math.hypot(w.x + 2 - ws[0].x, w.y + 2 - ws[0].y)]).filter(([, d]) => d < 150).sort((a, b) => a[1] - b[1])[0];
    G.line = { x: ws[0].x, y: near ? near[0].y + 2 : Math.floor(ws[0].y), walked: 0 };
    if (near) buddy.dir = Math.sign(near[0].x + 2 - ws[0].x) || 1;
    lineWonders();
    Object.assign(buddy, { hop: 0, alt: 0, act: null, alpha: 1, lastL: null });
    lineCell = null;
    bubbleAt = -1e9;
    say(tr('我缩成了二维。世界跟着缩成了一条线。', 'I shrank down to two dimensions. The world shrank with me, into a line.'), { bubble: true });
    sizePet();                                             // 先把画布定好尺寸，别等下面那几个窗口调用
  } else {                                                 // 回到纸面：从线国走到的地方接着逛
    ws[0].x = G.line.x; ws[0].y = G.line.y + .5; ws[0].k = -1;
    retarget(ws[0]);
    cam.x = ws[0].x; cam.y = ws[0].y;
    if (G.line.walked) say(tr(`回到上面了。线国在纸上留下了一道 ${G.line.walked} 格长的细线。`, `Back up top. Lineland left a thin line ${G.line.walked} tiles long on the paper.`));
  }
  if (!TAURI) return;
  const w = TAURI.window.getCurrentWindow(), { LogicalSize } = TAURI.dpi;
  // 每个窗口调用各管各的：刚启动时偶尔有一个失败或迟迟不返回，别让它拦住后面的
  const tryAll = (...calls) => Promise.all(calls.map(f => f().catch(e => console.warn('窗口调用失败', e))));
  if (p) {
    fitPet();
    await tryAll(() => w.setDecorations(false), () => w.setResizable(false), () => w.setAlwaysOnTop(true));
    fitPet();
  } else {
    await tryAll(() => w.setAlwaysOnTop(false), () => w.setDecorations(true), () => w.setResizable(true));
    await tryAll(() => w.setSize(new LogicalSize(Math.min(1200, screen.availWidth - 80), Math.min(780, screen.availHeight - 80))));
    await tryAll(() => w.center(), () => w.setFocus());
  }
}

if (TAURI) {
  const w = TAURI.window.getCurrentWindow();
  $('petBtn').hidden = $('quitBtn').hidden = false;
  $('petBtn').onclick = () => setMode(true);
  $('quitBtn').onclick = () => { save(); w.destroy(); };
  $('pet').onclick = () => setMode(false);
  w.onCloseRequested(e => { save(); if (!pet) { e.preventDefault(); setMode(true); } });   // 关窗口 = 缩回桌宠
  // 自动更新：启动时看一次，之后每 6 小时看一次；有新版就静默装好重启，存档在 localStorage 里不受影响
  const update = async () => {
    try {
      const u = await TAURI.updater.check();
      if (!u) return;
      bubbleAt = -1e9;
      say(tr(`发现新版本 ${u.version}，我去换一身新的截面……`, `Version ${u.version} is out. Off to change into a new cross-section...`), { bubble: true });
      save();
      await u.downloadAndInstall();
      await TAURI.process.relaunch();
    } catch (e) { console.warn('检查更新失败，10 分钟后再试', e); setTimeout(update, 10 * 60 * 1000); }   // 网络偶尔抽风，别等 6 小时
  };
  setTimeout(update, 5000);
  setInterval(update, 6 * 3600 * 1000);
  if (!URL_SEED) setTimeout(() => setMode(true));         // 等「开始」那段把 Clawd 放下来再缩进线国；刚读完会话过来的就留在大窗口
}
