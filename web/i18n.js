// 中英切换：默认跟浏览器语言，页面上的「中 / EN」按钮切换并记在本机，切完重新载入（世界由种子决定，重载后一模一样）。
// 脚本里的话写成 tr('中文', 'English')，两种语言挨在一起；页面上的静态文字：
//   data-en="…"        英文下换掉 textContent（<title> 也行）      data-en-title / -label / -placeholder  换 title / aria-label / placeholder
//   data-lang="zh|en"  整块只在那种语言下显示（带标签的长段落用这个）
// 普通脚本，放在各页其他脚本前面加载；parse.js 是模块，读 globalThis.tr，在 node 里没有就用中文。
const LANG = (() => { try { return localStorage.getItem('clawd-lang'); } catch { return null; } })() || (/^zh/i.test(navigator.language) ? 'zh' : 'en');
const tr = (zh, en) => LANG === 'en' ? en : zh;
document.documentElement.lang = LANG === 'en' ? 'en' : 'zh-CN';
function setLang(l) {
  try { localStorage.setItem('clawd-lang', l); } catch { /* 无痕模式：只切这一次 */ }
  location.reload();
}
if (LANG === 'en') {
  for (const e of document.querySelectorAll('[data-en]')) e.textContent = e.dataset.en;
  for (const e of document.querySelectorAll('[data-en-title]')) e.title = e.dataset.enTitle;
  for (const e of document.querySelectorAll('[data-en-label]')) e.setAttribute('aria-label', e.dataset.enLabel);
  for (const e of document.querySelectorAll('[data-en-placeholder]')) e.placeholder = e.dataset.enPlaceholder;
}
// 「中 / EN」按钮：放在带 .lang 的地方，显示要切到的那种
for (const b of document.querySelectorAll('button.lang')) {
  b.textContent = LANG === 'en' ? '中' : 'EN';
  b.setAttribute('aria-label', LANG === 'en' ? '切换到中文' : 'Switch to English');
  b.onclick = () => setLang(LANG === 'en' ? 'zh' : 'en');
}
