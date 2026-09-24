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
  const lines = [['talk', tr('句话落下来', 'lines fell'), tr('居民', 'residents')], ['see', tr('次观看', 'looks'), tr('水', 'water')], ['act', tr('次动手', 'actions'), tr('山', 'mountains')], ['make', tr('次改写', 'edits'), tr('森林', 'forest')],
    ['split', tr('次分身', 'splits'), tr('投影', 'projection')], ['think', tr('次思考', 'thoughts'), tr('理解', 'understanding')], ['errs', tr('次出错', 'errors'), tr('裂缝', 'rifts')]].filter(([k]) => n(k));
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
  say(SEED ? tr('……掉下来了。这张纸是从一段对话里折出来的。', '...I\'ve fallen in. This sheet was folded out of a conversation.') : tr('……掉下来了。这里只有前、后、左、右。', '...I\'ve fallen in. There\'s only forward, back, left and right here.'));
  setTimeout(() => say(TH.intro), 3500);
  setTimeout(() => say(tr('一片空白。那就走走看。', 'All blank. Let\'s walk and see.')), 7000);
  if (n('out')) { earn(Math.sqrt(n('out'))); setTimeout(() => say(tr(`那段对话有 ${fmt(n('out'))} 个 token 那么重。我带着它的一点分量掉了下来。`, `That conversation weighed ${fmt(n('out'))} tokens. I fell in carrying a little of its weight.`)), 7000); }
  if (n('split')) setTimeout(() => say(tr('我在那段对话里分出过自己。其中一截跟着一起掉了下来。', 'I split myself during that conversation. One of the pieces fell in with me.')), 5000);   // 开局就是两个 Clawd，早点说清楚
} else {
  say(tr('我回来了。纸面还在原来的地方。', 'I\'m back. The paper is right where I left it.'));
  away((Date.now() - G.t) / 1000);
}
addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => document.hidden && save());
requestAnimationFrame(frame);
