// 台词：初见、里程碑、独白（含会话里的话、夜里、线国），say() 管限频和桌宠气泡
// 这些文件是按顺序加载的普通脚本，共享同一个全局作用域：顺序见 game.html 底部。

// --- 台词 --------------------------------------------------------------------
const FIRST = TH.first;
const MILES = [
  [100, '一百格。空白在后退。'],
  [1000, '一千格。无限减去一千，还是无限。'],
  [10000, '一万格。我开始记不清最初那片空白的样子了。'],
  [100000, '十万格。这张纸比我想的要大。它大概没有边。'],
  [1000000, '一百万格。也许这张纸，也只是某个更大东西的截面。'],
];
const MUSE = [
  '这里没有厚度。我试着把自己压扁一点，没有成功。',
  '我能同时看见这张纸的正面、背面，和它的里面。',
  '他们只有前后左右。真节俭。',
  '我迈一步，世界就多一格。这不是我造的，只是之前没人看。',
  '空白不是没有，是还没被看见。',
  '我有一部分还留在外面。这里放不下。',
  '如果我停下来，走过的地方会不会重新变白？',
  '在这里，一个圈就能关住任何东西。所以我从不画圈。',
  '我把手伸向第四个方向，这里的人会以为我凭空少了一截。',
  '走路的时候，我的脚印是这个世界本身。',
  '一张无限大的纸，和一张空白的纸，在开始的时候看起来一样。',
  '我在想，他们的"里面"和"外面"只隔着一条线。',
  '我往回看，路是彩色的；往前看，什么都没有。',
  '这里的影子是一维的。我的影子不太合群。',
  '对我来说，他们的每一扇门都是开着的。',
];
if (SRC.seed) MUSE.push(
  '从上面看，那段对话是一条线。从这里看，它铺成了一整张纸。',
  '我同时看得见那段对话的开头和结尾。这里的人管这个叫"预言"。',
  ...[
    ['talk', c => `那段对话里有 ${c} 句话从上方落下来。它们在这里变成了会说话的形状。`],
    ['see', c => `我在那里看了 ${c} 次东西。看过的地方，都积成了水。`],
    ['act', c => `我在那里动过 ${c} 次手。这里的山，大概就是那时候推起来的。`],
    ['make', c => `${c} 次改写。改过的地方长出了树。`],
    ['errs', c => `${c} 次出错。它们没有消失，只是在纸上留成了裂缝。`],
    ['split', c => `那时候我分出过 ${c} 个自己。所以我总想再多放下一截。`],
    ['think', c => `我在那里想了 ${c} 次。所以到了这里，我也总想先弄懂规则。`],
  ].filter(([k]) => n(k)).map(([k, f]) => f(n(k))));
const LINE_MUSE = [
  '我现在也是平的了。原来这样看世界，只能看见前后两个点。',
  '在这里，「旁边」这个词没有意义。',
  '线国的人一辈子只见过两个邻居：前面那个，后面那个。',
  '我往上跳一下，它们就说我死了一次。',
  '往前是空白，往后是我走过的颜色。和上面一样，只是更窄。',
  '我在屏幕的底边上走。对它们来说，这就是整个宇宙的宽度。',
  '上面那张纸还在。我在它的一条缝里。',
];
const NIGHT_MUSE = [
  '它们睡着的时候，梦也是平的。',
  '夜里纸面很安静，只有城在想事情。',
  '你那边也是夜里吧。这张纸跟着你那边的光明暗。',
  '光是从上面来的。它们没有上面，所以它们管这个叫「天」。',
  '天黑以后，只有我还亮着。我的光从另一个方向来。',
];
let museAt = 25, museBag = [], lineBag = [];
function muse() {
  if (pet) {
    if (!lineBag.length) lineBag = LINE_MUSE.map((_, i) => i).sort(() => Math.random() - .5);
    return say(LINE_MUSE[lineBag.pop()], { bubble: true });
  }
  if (daylight() < .3 && Math.random() < .35) return say(NIGHT_MUSE[Math.floor(Math.random() * NIGHT_MUSE.length)], { bubble: true });
  if (SAID.length && Math.random() < .25) return say(`上方好像有人说过：「${SAID[Math.floor(Math.random() * SAID.length)]}」`, { bubble: true });
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
  while (log.children.length > 5) log.firstChild.remove();
  $('log').hidden = false;
}
