// 界面：数字格式、左上角感知窗口、窗口收起与精简显示
// 这些文件是按顺序加载的普通脚本，共享同一个全局作用域：顺序见 game.html 底部。

// --- 界面 --------------------------------------------------------------------
const fmt = LANG === 'en'
  ? n => n < 1e6 ? Math.floor(n).toLocaleString('en') : n < 1e9 ? (n / 1e6).toFixed(2) + 'M' : n < 1e12 ? (n / 1e9).toFixed(2) + 'B' : (n / 1e12).toFixed(2) + 'T'
  : n => n < 1e4 ? Math.floor(n).toLocaleString() : n < 1e8 ? (n / 1e4).toFixed(2) + '万' : n < 1e12 ? (n / 1e8).toFixed(2) + '亿' : (n / 1e12).toFixed(2) + '万亿';

// 按现在的速度还要攒多久；速度还没稳下来就不说
const eta = need => {
  if (need <= 0 || G.rate < 1) return '';
  const t = need / G.rate;
  return ' · ' + (t < 60 ? `${Math.ceil(t)}${tr(' 秒', 's')}` : t < 3600 ? `${Math.ceil(t / 60)}${tr(' 分', 'm')}` : `${(t / 3600).toFixed(1)}${tr(' 小时', 'h')}`);
};
function hud() {
  if (G.total < 1) return;
  $('hud').hidden = false;
  $('pts').textContent = `◆ ${fmt(G.pts)}`;
  $('rate').textContent = tr(`感知 +${fmt(G.rate)}/秒`, `Perception +${fmt(G.rate)}/s`);
  $('area').textContent = tr(`已展开 ${fmt(rev.size)} 格`, `Unfolded ${fmt(rev.size)} tiles`);
  $('flat').hidden = !L('life');
  $('flat').textContent = tr(`遇见居民 ${fmt(G.flat)}`, `Residents met ${fmt(G.flat)}`);
  $('paper').hidden = false;
  $('paper').textContent = `${SEED ? tr(`纸面 #${SEED} · `, `Sheet #${SEED} · `) : tr('地貌 ', 'Terrain: ')}${TH.name}${ROUTE.size ? tr(` · 读到 ${readPct()}%`, ` · read ${readPct()}%`) : ''}${WONDERS.length ? tr(` · 奇观 ${foundCount()}/${WONDERS.length}`, ` · wonders ${foundCount()}/${WONDERS.length}`) : ''}`;
  let any = !$('origin').hidden;
  for (const u of UPS) {
    const { b, name, cost, info } = rows[u.id], l = L(u.id), c = Math.ceil(u.cost(l)), full = l >= u.max;
    if (goal === u || l) G.seen['u' + u.id] = 1;
    b.hidden = !G.seen['u' + u.id];
    any ||= !b.hidden;
    b.classList.toggle('clay', goal === u);
    b.classList.toggle('goal', goal === u);
    b.classList.toggle('full', full);
    name.textContent = u.max > 1 ? `${u.name} Lv.${l}` : u.name;
    cost.textContent = full ? '—' : goal === u ? tr(`攒着 ${Math.min(99, Math.floor(G.pts / c * 100))}%${eta(c - G.pts)}`, `saving ${Math.min(99, Math.floor(G.pts / c * 100))}%${eta(c - G.pts)}`) : `◆ ${fmt(c)}`;
    info.textContent = full ? (u.max > 1 ? u.info(l) + tr(' · 满了', ' · maxed') : tr('已看见', 'seen')) : u.info(l + 1);
  }
  $('ups').hidden = !any;
  const hr = hourNow();                                    // 时间条：跟着钟走，或者停在拨到的那个钟点
  if (document.activeElement !== $('hour')) $('hour').value = hr;
  $('clockT').textContent = `${String(Math.floor(hr)).padStart(2, '0')}:${String(Math.floor(hr % 1 * 60)).padStart(2, '0')}`;
  $('clockBtn').setAttribute('aria-pressed', String(UIP.hour == null));
}
$('hour').oninput = e => { UIP.hour = +e.target.value; saveUI(); };
if (SKY) { $('hour').hidden = $('clockBtn').hidden = true; $('clockT').style.flex = 1; }   // 深空不分昼夜，钟只是个钟
$('clockBtn').onclick = () => { delete UIP.hour; saveUI(); };

$('reset').onclick = () => {
  if (!confirm(tr('从一片空白重新开始？现在的纸面会全部消失。', 'Start over from a blank sheet? Everything on this paper will be gone.'))) return;
  wiped = true;
  try { localStorage.removeItem(SAVE); } catch { /* 无痕模式 */ }
  location.reload();
};

// --- 收起 / 精简：每个窗口标题栏上的 – 收成一条；「精简」只留最要紧的一行 --------------
// 手机屏幕小，窗口会挡住纸面，所以要能收；状态记在本机，下次打开还是那样。
const UIP = (() => { try { return JSON.parse(localStorage.getItem('clawd-ui')) || {}; } catch { return {}; } })();
UIP.fold ??= {};
const saveUI = () => { try { localStorage.setItem('clawd-ui', JSON.stringify(UIP)); } catch { /* 无痕模式 */ } };
function barButton(bar, cls, onclick) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = cls; b.onclick = onclick;
  bar.append(b);
  return b;
}
{
  const cb = barButton($('hud').querySelector('.bar'), 'tb wide', () => { UIP.compact = !UIP.compact; paint(); saveUI(); });
  const paint = () => {
    document.documentElement.classList.toggle('compact', !!UIP.compact);
    cb.textContent = UIP.compact ? tr('完整', 'full') : tr('精简', 'lite');
    cb.setAttribute('aria-pressed', String(!!UIP.compact));
  };
  paint();
}
// 拖标题栏摆窗口：靠近屏幕边或别的窗口的边就吸过去，吸上时留 12px 间距；位置记在本机，双击标题栏恢复默认排列。
// 第一次拖的时候把看得见的窗口都钉在当前位置（原来有的排在左边一列里），免得一个挪走别的跟着跳。手机上不拖。
const GAP = 12, SNAP = 10, WINS = ['hud', 'chron', 'log', 'ups', 'radio'].map($);
const narrow = () => matchMedia('(max-width:640px)').matches;
let zTop = 5;
UIP.pos ??= {};
function place(win, x, y) {
  x = Math.max(0, Math.min(innerWidth - win.offsetWidth, x)); y = Math.max(0, Math.min(innerHeight - 24, y));
  Object.assign(win.style, { position: 'fixed', left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
}
const pinAll = () => {                                     // 先把位置都量好再钉：钉住一个，左列里剩下的会往上跳
  const at = WINS.filter(w => !w.hidden && !w.style.left).map(w => [w, w.getBoundingClientRect()]);
  for (const [w, r] of at) place(w, r.left, r.top);
};
const savePos = () => { for (const w of WINS) if (w.style.left) UIP.pos[w.id] = [parseFloat(w.style.left), parseFloat(w.style.top)]; saveUI(); };
function snap(win, x, y) {                                   // 候选位置：屏幕边留 GAP、和别的窗口对齐、贴着别的窗口隔 GAP
  const w = win.offsetWidth, h = win.offsetHeight, xs = [GAP, innerWidth - GAP - w], ys = [GAP, innerHeight - GAP - h];
  for (const o of WINS) {
    if (o === win || o.hidden) continue;
    const r = o.getBoundingClientRect();
    xs.push(r.left, r.right - w, r.right + GAP, r.left - GAP - w);
    ys.push(r.top, r.bottom - h, r.bottom + GAP, r.top - GAP - h);
  }
  const near = (v, c) => { const t = c.reduce((b, t) => Math.abs(t - v) < Math.abs(b - v) ? t : b); return Math.abs(t - v) < SNAP ? t : v; };
  return [near(x, xs), near(y, ys)];
}
for (const win of WINS) {
  const bar = win.querySelector(':scope > .bar');
  bar.onpointerdown = e => {
    if (narrow() || e.button || e.target.closest('button')) return;
    e.preventDefault(); pinAll();
    win.style.zIndex = ++zTop;
    const r = win.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    bar.setPointerCapture(e.pointerId);
    bar.onpointermove = m => place(win, ...snap(win, m.clientX - dx, m.clientY - dy));
    bar.onpointerup = () => { bar.onpointermove = bar.onpointerup = null; savePos(); };
  };
  bar.ondblclick = e => {
    if (narrow() || e.target.closest('button')) return;
    UIP.pos = {}; saveUI();
    for (const w of WINS) for (const k of ['position', 'left', 'top', 'right', 'bottom', 'zIndex']) w.style[k] = '';
  };
}
if (!narrow()) for (const w of WINS) if (UIP.pos[w.id]) place(w, ...UIP.pos[w.id]);
addEventListener('resize', () => { for (const w of WINS) if (w.style.left) place(w, parseFloat(w.style.left), parseFloat(w.style.top)); });   // 窗口变小了别让它们跑出屏幕

// 右下角的拖柄：纪年、独白、身体可以拖大拖小，大小记在本机；双击拖柄恢复默认。
// 贴着右边或底边摆的窗口（身体、独白），一开始拖就钉在当前位置、按左上角定位，这样右下角跟着手走
UIP.size ??= {};
for (const win of [$('chron'), $('log'), $('ups')]) {
  const g = document.createElement('i'), set = ([w, h]) => { win.style.width = w + 'px'; win.style.height = h + 'px'; win.style.maxHeight = 'none'; win.classList.add('sized'); };
  g.className = 'grip'; g.title = tr('拖动改大小，双击恢复', 'Drag to resize, double-click to reset');
  win.append(g);
  if (UIP.size[win.id]) set(UIP.size[win.id]);
  g.onpointerdown = e => {
    e.preventDefault(); g.setPointerCapture(e.pointerId);
    const r = win.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
    if (getComputedStyle(win).position === 'fixed') place(win, r.left, r.top);
    g.onpointermove = m => set([Math.max(180, Math.min(innerWidth - r.left - 4, r.width + m.clientX - x0)), Math.max(80, Math.min(innerHeight - r.top - 4, r.height + m.clientY - y0))]);
    g.onpointerup = () => { g.onpointermove = g.onpointerup = null; UIP.size[win.id] = [win.offsetWidth, win.offsetHeight]; savePos(); };
  };
  g.ondblclick = () => {
    delete UIP.size[win.id]; saveUI();
    for (const k of ['width', 'height', 'maxHeight']) win.style[k] = '';
    win.classList.remove('sized');
  };
}
for (const win of document.querySelectorAll('.win[id]:not(#bubble)')) {
  const bar = win.querySelector(':scope > .bar');
  if (!bar) continue;
  const b = barButton(bar, 'tb', () => { UIP.fold[win.id] = !UIP.fold[win.id]; paint(); saveUI(); });
  const paint = () => {
    const f = !!UIP.fold[win.id];
    win.classList.toggle('folded', f);
    b.textContent = f ? '+' : '–';
    b.setAttribute('aria-label', f ? tr('展开窗口', 'Expand window') : tr('收起窗口', 'Collapse window'));
    b.setAttribute('aria-expanded', String(!f));
  };
  paint();
}
