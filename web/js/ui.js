// 界面：数字格式、左上角感知窗口、窗口收起与精简显示
// 这些文件是按顺序加载的普通脚本，共享同一个全局作用域：顺序见 game.html 底部。

// --- 界面 --------------------------------------------------------------------
const fmt = n => n < 1e4 ? Math.floor(n).toLocaleString() :
  n < 1e8 ? (n / 1e4).toFixed(2) + '万' : n < 1e12 ? (n / 1e8).toFixed(2) + '亿' : (n / 1e12).toFixed(2) + '万亿';

// 按现在的速度还要攒多久；速度还没稳下来就不说
const eta = need => {
  if (need <= 0 || G.rate < 1) return '';
  const t = need / G.rate;
  return ' · ' + (t < 60 ? `${Math.ceil(t)} 秒` : t < 3600 ? `${Math.ceil(t / 60)} 分` : `${(t / 3600).toFixed(1)} 小时`);
};
function hud() {
  if (G.total < 1) return;
  $('hud').hidden = false;
  $('pts').textContent = `◆ ${fmt(G.pts)}`;
  $('rate').textContent = `感知 +${fmt(G.rate)}/秒`;
  $('area').textContent = `已展开 ${fmt(rev.size)} 格`;
  $('flat').hidden = !L('life');
  $('flat').textContent = `遇见居民 ${fmt(G.flat)}`;
  $('paper').hidden = false;
  $('paper').textContent = `${SEED ? `纸面 #${SEED} · ` : '地貌 '}${TH.name}${ROUTE.size ? ` · 读到 ${readPct()}%` : ''}${WONDERS.length ? ` · 奇观 ${foundCount()}/${WONDERS.length}` : ''}`;
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
    cost.textContent = full ? '—' : goal === u ? `攒着 ${Math.min(99, Math.floor(G.pts / c * 100))}%${eta(c - G.pts)}` : `◆ ${fmt(c)}`;
    info.textContent = full ? (u.max > 1 ? u.info(l) + ' · 满了' : '已看见') : u.info(l + 1);
  }
  $('ups').hidden = !any;
}

$('reset').onclick = () => {
  if (!confirm('从一片空白重新开始？现在的纸面会全部消失。')) return;
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
    cb.textContent = UIP.compact ? '完整' : '精简';
    cb.setAttribute('aria-pressed', String(!!UIP.compact));
  };
  paint();
}
for (const win of document.querySelectorAll('.win[id]:not(#bubble)')) {
  const bar = win.querySelector(':scope > .bar');
  if (!bar) continue;
  const b = barButton(bar, 'tb', () => { UIP.fold[win.id] = !UIP.fold[win.id]; paint(); saveUI(); });
  const paint = () => {
    const f = !!UIP.fold[win.id];
    win.classList.toggle('folded', f);
    b.textContent = f ? '+' : '–';
    b.setAttribute('aria-label', f ? '展开窗口' : '收起窗口');
    b.setAttribute('aria-expanded', String(!f));
  };
  paint();
}
