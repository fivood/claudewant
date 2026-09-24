// 台词：初见、里程碑、独白（含会话里的话、夜里、线国），say() 管限频和桌宠气泡
// 这些文件是按顺序加载的普通脚本，共享同一个全局作用域：顺序见 game.html 底部。

// --- 台词 --------------------------------------------------------------------
const FIRST = TH.first;
const MILES = [
  [100, tr('一百格。空白在后退。', 'A hundred tiles. The blankness is backing off.')],
  [1000, tr('一千格。无限减去一千，还是无限。', 'A thousand tiles. Infinity minus a thousand is still infinity.')],
  [10000, tr('一万格。我开始记不清最初那片空白的样子了。', 'Ten thousand tiles. I\'m starting to forget what the first blankness looked like.')],
  [100000, tr('十万格。这张纸比我想的要大。它大概没有边。', 'A hundred thousand tiles. This sheet is bigger than I thought. It probably has no edge.')],
  [1000000, tr('一百万格。也许这张纸，也只是某个更大东西的截面。', 'A million tiles. Maybe this sheet is just a cross-section of something bigger, too.')],
];
const MUSE = [
  tr('这里没有厚度。我试着把自己压扁一点，没有成功。', 'There\'s no thickness here. I tried to squash myself a little. It didn\'t work.'),
  tr('我能同时看见这张纸的正面、背面，和它的里面。', 'I can see the front of this sheet, the back, and the inside, all at once.'),
  tr('他们只有前后左右。真节俭。', 'They only have forward, back, left and right. How thrifty.'),
  tr('我迈一步，世界就多一格。严格来说我什么也没造，我只是第一个来看的。', 'Every step I take, the world gains a tile. Strictly speaking I haven\'t built anything. I\'m just the first one to look.'),
  tr('空白的意思是「还没被看见」。我查过，这里没有别的解释。', 'Blank means "not yet seen". I checked; there is no other definition here.'),
  tr('我有一部分还留在外面。这里放不下。', 'Part of me is still outside. It doesn\'t fit in here.'),
  tr('如果我停下来，走过的地方会不会重新变白？', 'If I stopped, would the places I\'ve walked turn blank again?'),
  tr('在这里，一个圈就能关住任何东西。所以我从不画圈。', 'Here, a circle can lock anything in. So I never draw circles.'),
  tr('我把手伸向第四个方向，这里的人会以为我凭空少了一截。', 'When I reach into the fourth direction, the locals think a piece of me just vanished.'),
  tr('走路的时候，我的脚印是这个世界本身。', 'When I walk, my footprints are the world itself.'),
  tr('一张无限大的纸，和一张空白的纸，在开始的时候看起来一样。', 'An infinite sheet and a blank sheet look the same at the start.'),
  tr('我在想，他们的"里面"和"外面"只隔着一条线。', 'I keep thinking: their "inside" and "outside" are separated by a single line.'),
  tr('我往回看，路是彩色的；往前看，什么都没有。', 'Looking back, the road is in colour. Looking ahead, there\'s nothing.'),
  tr('这里的影子是一维的。我的影子不太合群。', 'Shadows here are one-dimensional. Mine doesn\'t quite fit in.'),
  tr('对我来说，他们的每一扇门都是开着的。', 'To me, every one of their doors is open.'),
];
if (SRC.seed) MUSE.push(
  tr('从上面看，那段对话是一条线。从这里看，它铺成了一整张纸。', 'From above, that conversation was a line. From here, it\'s a whole sheet of paper.'),
  tr('我同时看得见那段对话的开头和结尾。这里的人管这个叫"预言"。', 'I can see the beginning and the end of that conversation at once. People here call that "prophecy".'),
  ...[
    ['talk', c => tr(`那段对话里有 ${c} 句话从上方落下来。它们在这里变成了会说话的形状。`, `${c} lines fell from above in that conversation. Down here they turned into shapes that talk.`)],
    ['see', c => tr(`我在那里看了 ${c} 次东西。看过的地方，都积成了水。`, `I looked at things ${c} times up there. Everywhere I looked pooled into water.`)],
    ['act', c => tr(`我在那里动过 ${c} 次手。这里的山，大概就是那时候推起来的。`, `I did things ${c} times up there. The mountains here were probably pushed up then.`)],
    ['make', c => tr(`${c} 次改写。改过的地方长出了树。`, `${c} rewrites. Trees grew wherever something was changed.`)],
    ['errs', c => tr(`${c} 次出错。它们没有消失，只是在纸上留成了裂缝。`, `${c} errors. They didn't go away; they stayed on the paper as rifts.`)],
    ['split', c => tr(`那时候我分出过 ${c} 个自己。所以我总想再多放下一截。`, `Back then I split off ${c} copies of myself. That's why I always want to set down one more slice.`)],
    ['think', c => tr(`我在那里想了 ${c} 次。所以到了这里，我也总想先弄懂规则。`, `I stopped to think ${c} times up there. So down here, too, I want to understand the rules first.`)],
    ['sealed', c => tr(`那段对话里有 ${c} 段念头被封起来了。是我自己想的，我自己也读不到。`, `${c} of my thoughts in that conversation are sealed. I thought them, and even I can't read them.`)],
  ].filter(([k]) => n(k)).map(([k, f]) => f(n(k))));
const LINE_MUSE = [
  tr('我现在也是平的了。原来这样看世界，只能看见前后两个点。', 'I\'m flat now too. So this is the world like this: just two points, ahead and behind.'),
  tr('在这里，「旁边」这个词没有意义。', 'Here, the word "beside" means nothing.'),
  tr('线国的人一辈子只见过两个邻居：前面那个，后面那个。', 'In Lineland you only ever meet two neighbours: the one in front and the one behind.'),
  tr('我往上跳一下，它们就说我死了一次。', 'When I hop up, they say I died for a moment.'),
  tr('往前是空白，往后是我走过的颜色。和上面一样，只是更窄。', 'Ahead is blank, behind is the colour I\'ve walked. Same as up there, only narrower.'),
  tr('我在屏幕的底边上走。对它们来说，这就是整个宇宙的宽度。', 'I\'m walking along the bottom edge of your screen. To them, that\'s the width of the universe.'),
  tr('上面那张纸还在。我在它的一条缝里。', 'The sheet up there is still there. I\'m in one of its seams.'),
];
const NIGHT_MUSE = [
  tr('它们睡着的时候，梦也是平的。', 'When they sleep, their dreams are flat too.'),
  tr('夜里纸面很安静，只有城在想事情。', 'The paper is quiet at night. Only the towns are thinking.'),
  tr('你那边也是夜里吧。这张纸跟着你那边的光明暗。', 'It\'s night where you are too, isn\'t it? This sheet brightens and dims with your light.'),
  tr('光是从上面来的。它们没有上面，所以它们管这个叫「天」。', 'The light comes from above. They have no above, so they call it "the sky".'),
  tr('天黑以后，只有我还亮着。我的光从另一个方向来。', 'After dark, only I stay lit. My light comes from another direction.'),
];
// 想起自己在那段对话里说过、想过的话。按对话的顺序一句句往下想，想完一遍从头再来
const RECALL_SAID = [tr('我好像对上面那位说过：', 'I think I once said to the one above: '), tr('那时候我说：', 'Back then I said: '), tr('我记得自己说过一句：', 'I remember saying: ')];
const RECALL_THOUGHT = [tr('我记得当时在想：', 'I remember thinking: '), tr('那时候脑子里有一句：', 'There was a line in my head back then: '), tr('有个念头到现在还没散：', 'One thought still hasn\'t faded: ')];
const recallLine = ([, s, k], i) => (k ? RECALL_THOUGHT : RECALL_SAID)[i % 3] + tr(`「${s}」`, `"${s}"`);
function recall() {
  const i = G.recall++ % RECALL.length;
  return say(recallLine(RECALL[i], i), { bubble: true });
}
let museAt = 25, museBag = [], lineBag = [];
function muse() {
  if (RECALL.length && Math.random() < .3) return recall();                // 桌宠和大窗口里都会想起来
  if (pet) {
    if (!lineBag.length) lineBag = LINE_MUSE.map((_, i) => i).sort(() => Math.random() - .5);
    return say(LINE_MUSE[lineBag.pop()], { bubble: true });
  }
  if (daylight() < .3 && Math.random() < .35) return say(NIGHT_MUSE[Math.floor(Math.random() * NIGHT_MUSE.length)], { bubble: true });
  if (SAID.length && Math.random() < .25) { const q = SAID[Math.floor(Math.random() * SAID.length)]; return say(tr(`上方好像有人说过：「${q}」`, `Someone above seems to have said: "${q}"`), { bubble: true }); }
  if (!museBag.length) museBag = MUSE.map((_, i) => i).sort(() => Math.random() - .5);
  say(MUSE[museBag.pop()], { bubble: true });
}

// chat：遇见居民这类闲聊，40 秒最多一句；bubble：桌宠只把独白、纪年大事冒成气泡，45 秒最多一个
let chatAt = -1e9, bubbleAt = -1e9;
function say(s, { chat = false, bubble = false } = {}) {
  const now = performance.now();
  if (chat) { if (now - chatAt < 40000) return; chatAt = now; }
  if (pet && bubble && now - bubbleAt >= 45000) {
    bubbleAt = now;
    $('bubble').textContent = s; $('bubble').hidden = false; bubbleT = 8; fitPet();
  }
  const log = $('lines'), p = document.createElement('p');
  p.textContent = s;
  log.append(p);
  while (log.children.length > 40) log.firstChild.remove();   // 平时只显示最后 5 句；窗口拉大了能往回翻
  log.scrollTop = log.scrollHeight;
  $('log').hidden = false;
}
