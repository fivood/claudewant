// 开始：把上面这些拼起来，放下 Clawd，开跑
// 这些文件是按顺序加载的普通脚本，共享同一个全局作用域：顺序见 game.html 底部。

// --- 开始 --------------------------------------------------------------------
resize();
const fresh = !rev.size;
advance(true);
annals();
if (fresh && n('split')) { G.lv.clone = 1; G.ws.push([G.ws[0][0], G.ws[0][1]]); }
{
  const o = $('origin');
  const lines = [['talk', '句话落下来', '居民'], ['see', '次观看', '水'], ['act', '次动手', '山'], ['make', '次改写', '森林'],
    ['split', '次分身', '投影'], ['think', '次思考', '理解'], ['errs', '次出错', '裂缝']].filter(([k]) => n(k));
  o.hidden = !lines.length;
  for (const [k, a, b] of lines) {
    const d = document.createElement('div');
    d.textContent = `${fmt(n(k))} ${a} → ${b}`;
    o.append(d);
  }
}
for (const [x, y] of G.ws) addWalker(x, y);
cam.x = ws[0].x; cam.y = ws[0].y;
if (fresh) {
  say(SEED ? '……掉下来了。这张纸是从一段对话里折出来的。' : '……掉下来了。这里只有前、后、左、右。');
  setTimeout(() => say(TH.intro), 3500);
  setTimeout(() => say('一片空白。那就走走看。'), 7000);
  if (n('out')) { earn(Math.sqrt(n('out'))); setTimeout(() => say(`那段对话有 ${fmt(n('out'))} 个 token 那么重。我带着它的一点分量掉了下来。`), 7000); }
  if (n('split')) setTimeout(() => say('我在那段对话里分出过自己。其中一截跟着一起掉了下来。'), 10000);
} else {
  say('我回来了。纸面还在原来的地方。');
  away((Date.now() - G.t) / 1000);
}
addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => document.hidden && save());
requestAnimationFrame(frame);
