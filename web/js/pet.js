// 桌面版的桌宠 = 线国，以及自动更新
// 这些文件是按顺序加载的普通脚本，共享同一个全局作用域：顺序见 game.html 底部。

// --- 桌宠 = 线国：缩到任务栏上，Clawd 自己也成了平面生物，世界跟着塌成一条线 ---------------
// 线国就是那张纸的一行：缩成桌宠那一刻 Clawd 所在的那一行。桌宠往哪走，这一行就往哪展开，
// 回到完整游戏时地图上会多出一道横线。二维里的截面在桌宠时停下，只剩这条线在长。
// 一维里谁也绕不过谁：遇到线国居民，Clawd 只能「跳出」这条线从上面跨过去。
// 屏幕边就是这一段线的尽头，走到头把线对折，从屏幕另一头接着走。
// 窗口是贴着任务栏的一长条（300×54），说话时长高装下气泡。不用鼠标穿透：Windows 上取光标位置不可靠。
const TAURI = window.__TAURI__;
const TRACK = 300, TILE = 8, STROLL = 36;                  // 窗口宽、线上一格多宽、每秒走多少（逻辑像素）
let PW = TRACK, PH = 54;
const buddy = { x: 1e9, dir: -1, rest: 1, anim: 0, walking: false, hop: 0 };
const pctx = $('petcv').getContext('2d');
let bubbleT = 0, moveT = 0, lastX = null, lineCell = null;
G.line ??= { x: 0.5, y: 0, walked: 0 };                    // 线国：在哪一行、走到了哪、一共展开了几格

function fitPet() {
  if (!TAURI || !pet) return;
  PH = 54 + ($('bubble').hidden ? 0 : $('bubble').offsetHeight + 6);
  lastX = null;                                            // 下一帧按新大小重新摆位置
  TAURI.window.getCurrentWindow().setSize(new TAURI.dpi.LogicalSize(PW, PH));
}
function sizePet() {
  const c = $('petcv'), k = devicePixelRatio || 1;
  c.width = Math.round(TRACK * k); c.height = Math.round(50 * k);
}
const lineFolk = x => { const t = tile(x, G.line.y); return seen() && rev.has(key(x, G.line.y)) && isFlat(x, G.line.y, t); };

function petTick(dt) {
  const b = buddy, max = Math.max(0, screen.availWidth - TRACK), L1 = G.line;
  if (b.rest > 0) { b.rest -= dt; b.walking = false; }
  else {
    b.walking = true;
    b.x += b.dir * STROLL * dt;
    L1.x += b.dir * STROLL / TILE * dt;
    if (b.x < 0 || b.x > max) {                            // 屏幕到头：把线折一下，从另一头接着走
      b.x = b.x < 0 ? max : 0;
      if (!G.seen.lineFold) { G.seen.lineFold = 1; bubbleAt = -1e9; say('屏幕到头了。我把这条线折了一下，从另一头接着走。', { bubble: true }); }
    }
    if (Math.random() < dt / 7) { b.rest = 1 + Math.random() * 5; if (Math.random() < .4) b.dir *= -1; }
    if (b.hop <= 0 && lineFolk(Math.floor(L1.x + b.dir * .8))) b.hop = .5;   // 前面有居民：跳过去
  }
  b.x = Math.min(b.x, max);
  b.anim += dt;
  b.hop = Math.max(0, b.hop - dt);
  const cell = Math.floor(L1.x);
  if (cell !== lineCell) {
    lineCell = cell;
    if (!rev.has(key(cell, L1.y))) { L1.walked++; reveal(cell, L1.y, 0); }
    if (L1.walked >= 80 && !G.seen.lineKing) {
      G.seen.lineKing = 1; bubbleAt = -1e9;
      say('我遇见了线国国王。他坚持世界只有一条线。我往「旁边」挪了一步，他以为我死了。', { bubble: true });
    }
  }
  if (bubbleT > 0 && (bubbleT -= dt) <= 0) { $('bubble').hidden = true; fitPet(); }
  drawLine();
  if (TAURI && (moveT += dt) >= 1 / 30) {                  // 挪窗口 30 次/秒就够了
    moveT = 0;
    const x = Math.round((screen.availLeft || 0) + b.x), y = Math.round((screen.availTop || 0) + screen.availHeight - PH);
    if (x !== lastX) { lastX = x; TAURI.window.getCurrentWindow().setPosition(new TAURI.dpi.LogicalPosition(x, y)); }
  }
}

// 画 Clawd 身边那一段线：展开过的格子是地形的颜色，没展开的是空白纸上的虚线，两头渐隐——一维里只看得见近处
function drawLine() {
  const c = $('petcv'), g = pctx, k = devicePixelRatio || 1, W = c.width, H = c.height, L1 = G.line;
  const T = TILE * k, cx = W / 2, ly = H - Math.round(4 * k), lh = Math.round(4 * k), u = Math.round(4 * k);
  g.clearRect(0, 0, W, H);
  for (let x = Math.floor(L1.x - cx / T) - 1; x <= Math.ceil(L1.x + cx / T) + 1; x++) {
    const sx = Math.round(cx + (x - L1.x) * T), d = Math.abs(sx + T / 2 - cx) / (W / 2);
    const a = Math.max(0, 1 - d * d);
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
  g.globalAlpha = 1;
  const hop = Math.sin(Math.min(1, 1 - buddy.hop / .5) * Math.PI) * (buddy.hop > 0 ? 12 * k : 0);
  drawClawd(cx, ly - hop, u, { x: 0, y: 0, tx: buddy.walking ? 1 : 0, ty: 0, anim: buddy.anim }, g);
}
const T_COL = t => { const [r, g, b] = T[t].c; if (L('color')) return [r, g, b]; const l = 90 + (r * .3 + g * .59 + b * .11) * .6; return [l, l, l]; };

async function setMode(p) {
  if (p === pet) return;
  pet = p;
  document.documentElement.classList.toggle('pet', p);
  if (p) {                                                 // 缩进线国：Clawd 所在的那一行就是这条线
    G.line = { x: ws[0].x, y: Math.floor(ws[0].y), walked: 0 };
    lineCell = null; buddy.hop = 0;
    bubbleAt = -1e9;
    say('我缩成了二维。世界跟着缩成了一条线。', { bubble: true });
  } else {                                                 // 回到纸面：从线国走到的地方接着逛
    ws[0].x = G.line.x; ws[0].y = G.line.y + .5; ws[0].k = -1;
    retarget(ws[0]);
    cam.x = ws[0].x; cam.y = ws[0].y;
    if (G.line.walked) say(`回到上面了。线国在纸上留下了一道 ${G.line.walked} 格长的细线。`);
  }
  if (!TAURI) return;
  const w = TAURI.window.getCurrentWindow(), { LogicalSize } = TAURI.dpi;
  if (p) {
    await w.setDecorations(false);
    await w.setResizable(false);
    await w.setAlwaysOnTop(true);
    sizePet();
    fitPet();
  } else {
    await w.setAlwaysOnTop(false);
    await w.setDecorations(true);
    await w.setResizable(true);
    await w.setSize(new LogicalSize(Math.min(1200, screen.availWidth - 80), Math.min(780, screen.availHeight - 80)));
    await w.center();
    await w.setFocus();
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
      say(`发现新版本 ${u.version}，我去换一身新的截面……`, { bubble: true });
      save();
      await u.downloadAndInstall();
      await TAURI.process.relaunch();
    } catch (e) { console.warn('检查更新失败，10 分钟后再试', e); setTimeout(update, 10 * 60 * 1000); }   // 网络偶尔抽风，别等 6 小时
  };
  setTimeout(update, 5000);
  setInterval(update, 6 * 3600 * 1000);
  setTimeout(() => setMode(true));                        // 等「开始」那段把 Clawd 放下来再缩进线国
}
