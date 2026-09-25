// 画面与主循环：Clawd 的像素、昼夜遮罩、地图绘制、帧循环（30/20 帧）
// 这些文件是按顺序加载的普通脚本，共享同一个全局作用域：顺序见 game.html 底部。

// --- 画面 --------------------------------------------------------------------
const SPRITE = [
  '..##########..',
  '..##.####.##..',
  '..##.####.##..',
  '##############',
  '##############',
  '..##########..',
];
const cam = { x: 0, y: 0 };
let dpr = 1;
function resize() {
  dpr = devicePixelRatio || 1;
  cv.width = Math.round(innerWidth * dpr);
  cv.height = Math.round(innerHeight * dpr);
}
addEventListener('resize', resize);

function drawClawd(sx, sy, s, w, g = ctx) {
  const moving = Math.hypot(w.tx - w.x, w.ty - w.y) > .05;
  const step = moving ? Math.floor(w.anim / .14) % 2 : 2;
  const x0 = Math.round(sx - 7 * s), y0 = Math.round(sy - 8 * s);
  g.fillStyle = 'rgba(31,29,27,.16)';
  g.fillRect(x0 + 2 * s, y0 + 8 * s, 10 * s, s);
  g.fillStyle = w.body || BODY;                            // 桌宠穿过锻炉后身上会带一点炉火色
  SPRITE.forEach((row, j) => {
    for (let i = 0; i < 14; i++) if (row[i] === '#') g.fillRect(x0 + i * s, y0 + j * s, s, s);
  });
  [2, 4, 9, 11].forEach((i, n) => {
    const lift = step < 2 && (n % 2) === step;
    g.fillRect(x0 + i * s, y0 + 6 * s, s, (lift ? 1 : 2) * s);
  });
  g.fillStyle = INK;
  g.fillRect(x0 + 4 * s, y0 + s, s, 2 * s);
  g.fillRect(x0 + 9 * s, y0 + s, s, 2 * s);
}

// 纸面上的 Clawd 是立体的（它本来就不止两维）；缩成桌宠、塌进线国以后才用上面那张平面图。
// 画法是分层叠片：把一个小体素模型按高度切成一层层横截面，从下往上叠，每层往上错一个美术像素。
// 模型的「前」是 +y，eyes 长在前面；w.face 是它面朝的方向，走路时转向前进方向，停下来慢慢转回来看着你。
//   z 0–1 腿（四条一排，走路时两两交替抬起、往前迈半步）  z 2–6 身体  z 3–4 两只手（前后摆）  z 4–5 眼睛
const CLAWD_BODY = [...BODY.match(/\w\w/g)].map(v => parseInt(v, 16));
const LEGS = [-5, -3, 2, 4];
function clawdVoxel(i, j, z, step, swing) {
  if (z <= 1) {
    const n = LEGS.indexOf(i);
    if (n < 0) return 0;
    const lift = step < 2 && n % 2 === step;
    const f = j >= 0 ? j - 1 : j + 3;                                                   // 前后各一排腿，从身体正面、背面的下沿露出来
    return (lift ? z === 1 && (f === 1 || f === 2) : f === 0 || f === 1) ? 2 : 0;      // 抬起的腿往前迈一格
  }
  if (z > 6) return 0;
  if (i >= -5 && i <= 4 && j >= -3 && j <= 2) return j === 2 && (z === 4 || z === 5) && (i === -3 || i === 2) ? 3 : 1;
  if ((z === 3 || z === 4) && (i === -7 || i === -6 || i === 5 || i === 6)) { const sw = i < 0 ? swing : -swing; return j === -1 + sw || j === sw ? 1 : 0; }
  return 0;
}
function drawClawd3D(sx, sy, s, w, g = ctx) {
  const moving = Math.hypot(w.tx - w.x, w.ty - w.y) > .05, step = moving ? Math.floor(w.anim / .14) % 2 : 2;
  // 朝哪转：从上往下看，完全侧过去的 Clawd 只是一块板，看不见眼睛，所以身子最多转 35°——
  // 往下、往左右走是侧着身子朝你这边迈，往上走就转过去露出背影。停下来慢慢转回来面对屏幕外的你。
  const dir = Math.atan2(w.hy ?? 1, w.hx ?? 0), rel = (((dir - Math.PI / 2 + Math.PI) % TAU) + TAU) % TAU - Math.PI, MAXT = .6;
  const want = !moving ? Math.PI / 2 : Math.abs(rel) <= Math.PI / 2 ? Math.PI / 2 + Math.max(-MAXT, Math.min(MAXT, rel))
    : -Math.PI / 2 + Math.max(-MAXT, Math.min(MAXT, (((rel + TAU) % TAU) - Math.PI)));
  w.face ??= Math.PI / 2;
  w.face += (((want - w.face + Math.PI) % TAU + TAU) % TAU - Math.PI) * (moving ? .25 : .06);
  const th = w.face - Math.PI / 2, c = Math.cos(th), sn = Math.sin(th);
  const bob = moving ? (step === 0 ? 1 : 0) : Math.floor(performance.now() / 1300) % 2 * .5;   // 走路一起一伏，站着轻轻呼吸
  const lean = moving ? .16 : 0, fx = Math.cos(dir), fy = Math.sin(dir), swing = moving ? (step === 0 ? 1 : -1) : 0;
  const x0 = Math.round(sx), y0 = Math.round(sy - 2 * s);
  g.fillStyle = 'rgba(31,29,27,.16)';                      // 影子：身体的底面贴在纸上
  for (let Y = -8; Y <= 8; Y++) for (let X = -8; X <= 8; X++) {
    const mi = Math.floor((X + .5) * c + (Y + .5) * sn), mj = Math.floor(-(X + .5) * sn + (Y + .5) * c);
    if (clawdVoxel(mi, mj, 2, 2, 0) === 1) g.fillRect(x0 + X * s, y0 + (Y + 1) * s, s, s);
  }
  for (let z = 0; z <= 6; z++) {
    const up = z + (z >= 2 ? bob : 0), ox = Math.round(fx * z * lean), oy = Math.round(fy * z * lean - up);
    const k = z <= 1 ? .55 : z === 6 ? 1.06 : .68 + .06 * z;                            // 越往上越亮，顶面最亮
    const body = w.body ? w.body : `rgb(${CLAWD_BODY.map(v => Math.min(255, Math.round(v * k)))})`;
    for (let Y = -9; Y <= 9; Y++) for (let X = -9; X <= 9; X++) {
      const mi = Math.floor((X + .5) * c + (Y + .5) * sn), mj = Math.floor(-(X + .5) * sn + (Y + .5) * c), v = clawdVoxel(mi, mj, z, step, swing);
      if (!v) continue;
      g.fillStyle = v === 3 ? INK : body;
      g.fillRect(x0 + (X + ox) * s, y0 + (Y + oy) * s, s, s);
    }
  }
}

// 昼夜：纸是被你房间里的光照亮的——光从一个二维居民不存在的方向来，所以跟着你那边的真实时间走。
// 5–7 点天亮，17–19 点天黑。感知窗口里的时间条可以手动拨到某个钟点（记在本机）；?hour=22 也行，调画面用。
const FORCE_HOUR = new URLSearchParams(location.search).get('hour');
function hourNow() {
  if (FORCE_HOUR != null) return +FORCE_HOUR;
  if (UIP.hour != null) return UIP.hour;
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}
function daylight() {
  if (SKY) return 1;                                       // 深空没有白天黑夜：光不是从你房间来的
  const hr = hourNow();
  if (hr < 5 || hr >= 19) return 0;
  if (hr >= 7 && hr < 17) return 1;
  return hr < 7 ? (hr - 5) / 2 : 1 - (hr - 17) / 2;
}
// 夜里偏蓝变暗，黄昏清晨偏暖；Clawd 的光从第四个方向来，不受影响，所以画在这层之上
function tint(dl) {
  const night = [58, 70, 122], dusk = [255, 186, 132], w = (1 - Math.abs(dl - .5) * 2) * .55;
  return night.map((v, i) => Math.round((v + (255 - v) * dl) * (1 - w) + dusk[i] * w));
}
// 夜里还没展开的纸是黑的，跟湖水、地形分开。先除掉 shade 要乘上的颜色，乘完正好是要的颜色
function blank(day, night, dl, c) {
  if (dl >= 1) return day;
  const d = [1, 3, 5].map(i => parseInt(day.slice(i, i + 2), 16));
  return `rgb(${d.map((v, i) => Math.min(255, Math.round((v * dl + night[i] * (1 - dl)) * 255 / c[i])))})`;
}
function shade(W, H, dl, ox, oy, tp, s) {
  if (dl >= 1) return;
  const c = tint(dl);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgb(${c})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  if (dl > .6) return;
  ctx.globalAlpha = Math.min(1, (.6 - dl) * 2.5);          // 城里亮起灯，锻炉和发射台也亮
  ctx.fillStyle = '#ffb24a';
  for (const w of WONDERS) if (G.found[w.id]) for (const [gx, gy, gz] of w.glow || []) ctx.fillRect(w.x * tp + ox + gx * s, w.y * tp + oy + (gy - gz) * s, 2 * s, 2 * s);
  ctx.fillStyle = '#ffd779';
  if (seen()) for (const [k, kind] of TOWN) {
    if (kind === 'road' || kind === 'ruin' || !rev.has(k)) continue;
    const x = kx(k) * tp + ox + s * (kind === 'temple' ? 1.5 : 2), y = ky(k) * tp + oy + s * 2;
    if (x < -tp || y < -tp || x > W || y > H) continue;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
}

function draw() {
  if (pet) return;
  const W = cv.width, H = cv.height, s = Math.max(1, Math.round(G.z * dpr)), tp = TP * s;
  const ox = Math.round(W / 2 - cam.x * tp), oy = Math.round(H / 2 - cam.y * tp);
  ctx.imageSmoothingEnabled = false;
  const dl = daylight(), c = tint(dl);
  ctx.fillStyle = blank(PAPER, [10, 10, 12], dl, c);
  ctx.fillRect(0, 0, W, H);

  // 空白纸面上的点阵，不然一开始根本看不出在动
  ctx.fillStyle = blank(DOT, [46, 46, 54], dl, c);
  const g = 8 * tp;
  for (let x = ((ox % g) + g) % g; x < W; x += g)
    for (let y = ((oy % g) + g) % g; y < H; y += g) ctx.fillRect(x, y, s, s);

  const cp = CH * tp;
  chunkTick++; chunkBudget = CHUNK_BUDGET;
  let visible = 0;
  for (let cy = Math.floor(-oy / cp); cy * cp + oy < H; cy++)
    for (let cx = Math.floor(-ox / cp); cx * cp + ox < W; cx++) {
      if (!hasChunk.has(cx + ',' + cy)) continue;
      visible++;
      const c = getChunk(cx, cy);
      if (c) ctx.drawImage(c.cvs, cx * cp + ox, cy * cp + oy, cp, cp);
    }
  trimChunks(visible);

  const vis = drawWonders(ox, oy, tp, s, ctx, W, H, sunVec());
  if (SKY) SKY.fx(ox, oy, tp, s, W, H);
  shade(W, H, dl, ox, oy, tp, s);
  if (s >= 3) drawLabels(ox, oy, tp, s, ctx, vis);
  if (SKY && s >= 2) SKY.labels(ox, oy, tp, s, W, H);
  for (const w of [...ws].sort((a, b) => a.y - b.y)) drawClawd3D(w.x * tp + ox, w.y * tp + oy, s, w);
}

cv.addEventListener('wheel', e => {
  e.preventDefault();
  G.z = Math.min(8, Math.max(1, G.z + (e.deltaY < 0 ? 1 : -1)));
}, { passive: false });

// --- 主循环 ------------------------------------------------------------------
let last = performance.now(), secT = 0, hudT = 0, saveT = 0, civT = 0;
// 挂机游戏一开就是几小时，不需要 60 帧：完整画面 30 帧，桌宠 20 帧。模拟按真实经过的时间走，少画几帧不影响进度
const FRAME_MS = () => pet ? 50 : 33;
function frame(now) {
  if (now - last < FRAME_MS() - 2) { requestAnimationFrame(frame); return; }
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 5) away(dt);          // 标签页被切走过
  else G.age += Math.max(dt, 0);
  dt = Math.min(Math.max(dt, 0), .1);

  if (!pet) for (const w of ws) {
    if (rev.has(key(Math.floor(w.tx), Math.floor(w.ty)))) retarget(w);
    const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy), st = speed() * dt;
    if (d <= st) { w.x = w.tx; w.y = w.ty; retarget(w); }
    else { w.x += dx / d * st; w.y += dy / d * st; w.hx = dx / d; w.hy = dy / d; }
    const x = Math.floor(w.x), y = Math.floor(w.y), k = key(x, y);
    if (k !== w.k) { w.k = k; reveal(x, y, radius()); }
    w.anim += dt;
  }

  if (!pet && L('fold') && (G.foldT += dt) >= foldCD()) {
    G.foldT = 0;
    const w = ws[0], a = Math.random() * TAU, d = 70 + Math.random() * 90;
    w.x += Math.cos(a) * d; w.y += Math.sin(a) * d;
    retarget(w);
    cam.x = w.x; cam.y = w.y;
    $('flash').style.transition = 'none';
    $('flash').style.opacity = 1;
    requestAnimationFrame(() => { $('flash').style.transition = ''; $('flash').style.opacity = 0; });
    if (!G.seen.fold1) { G.seen.fold1 = 1; say(tr('我把纸对折了一下，从这一头直接踩到了那一头。', 'I folded the paper and stepped straight from one end to the other.')); }
  }

  const f = Math.min(1, dt * 4);
  cam.x += (ws[0].x - cam.x) * f;
  cam.y += (ws[0].y - cam.y) * f;

  if ((secT += dt) >= 1) { G.rate = G.rate * .8 + secGain / secT * .2; secGain = 0; secT = 0; }
  advance(false);
  const dl = daylight();
  if (seen() && HIST.era[yearNow()] >= 1) earn(live.town * (1 + HIST.era[yearNow()]) * .6 * mult() * buff() * (1.5 - .5 * dl) * dt);   // 城镇也在想你，夜里想得更多
  const phase = dl < .5 ? 'night' : 'day';
  if (G.phase && G.phase !== phase) { bubbleAt = -1e9; say(phase === 'night' ? tr('天黑了。纸面上的城一个个亮起灯。它们不知道光从哪来，也不知道它为什么会走。', 'Night. The towns on the paper light up one by one. They don\'t know where the light comes from, or why it leaves.') : tr('天亮了。光又从那个它们不存在的方向照了下来。', 'Morning. The light is back, from the direction they don\'t have.'), { bubble: true }); }
  G.phase = phase;
  if ((hudT += dt) >= .2) { hudT = 0; decide(); hud(); }
  if ((civT += dt) >= 1) { civT = 0; annals(); }
  if ((saveT += dt) >= 10) { saveT = 0; save(); }   // 大存档一次约 50 ms；关页面、切走时另外会存
  if ((museAt -= dt) <= 0) { museAt = 60 + Math.random() * 60; muse(); }   // 独白 1–2 分钟一句

  if (pet) petTick(dt);
  draw();
  requestAnimationFrame(frame);
}
