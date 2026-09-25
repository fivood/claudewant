// 深空：没载入会话的那张纸是透明的，展开的地方能看见它背后的真实天空，朝着一个随机挑的方向。
// 这些文件是按顺序加载的普通脚本，共享同一个全局作用域：顺序见 game.html 底部。
//
// 天空用方位等距投影铺到纸上：纸心是视角中心，离纸心 180° 就是视角的正背面，再往外天空又转回来。
// 比例尺也是随机的：三分之一是广角星图（一格 0.25°），其余像一台望远镜对准某个天体，按真实大小放大到直径 60–400 格。
// 银河按真实的银道坐标画（银心那边更宽更暖，大暗隙那段尘埃更浓）；有名的天体按真实的赤经赤纬放，
// 颜色和样子照哈勃、韦布的照片调。广角时天体都画得比真实大（不然一大半只占一两格），挨得太近的互相挤开一点。
// 纸的机制照旧：星场是居民住的「陆地」，银河是沙，星云是森林，天体的亮核是山，亮星是雪。
const SKY = G.theme === 'sky' && (() => {
  const D2R = Math.PI / 180, sd = G.seed, ex = Math.exp;
  const cl = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const hex = c => [c >> 16, c >> 8 & 255, c & 255];
  const vec = (a, d) => [Math.cos(d * D2R) * Math.cos(a * D2R), Math.cos(d * D2R) * Math.sin(a * D2R), Math.sin(d * D2R)];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = a => { const l = Math.hypot(...a); return a.map(v => v / l); };
  const lin = (a, ka, b, kb) => a.map((v, i) => v * ka + b[i] * kb);

  // [中文名, English, 赤经°, 赤纬°, 视大小′（恒星是星等）, 样子, 长轴方位角°, 短长轴比, 颜色 1, 颜色 2, 附加, 中文一句, English]
  // 样子：sp 旋涡 el 椭圆 irr 不规则 grp 星系群 rg 环状星系 df 深场 neb 发射星云 cf 悬崖 hh 马头 dk 暗星云
  //       pn 行星状星云 snr 超新星遗迹 gc 球状星团 oc 疏散星团 bh 黑洞 st 恒星
  const CAT = [
    ['仙女座星系', 'Andromeda Galaxy', 10.685, 41.269, 190, 'sp', 35, .32, 0xa8c0ff, 0xffe2b0, '', '仙女座星系。二百五十万光年外的另一条银河，哈勃把它拍成过一张二十五亿像素的拼图。', 'The Andromeda Galaxy. Another Milky Way, 2.5 million light-years off. Hubble once stitched it into a 2.5-billion-pixel mosaic.'],
    ['三角座星系', 'Triangulum Galaxy', 23.462, 30.66, 70, 'sp', 23, .6, 0x9fb8ff, 0xfff0d0, '', '三角座星系。本星系群里的老三，旋臂松松的，粉色的点都是正在出生的恒星。', 'The Triangulum Galaxy, third largest in the Local Group. Loose arms, and every pink dot is a star being born.'],
    ['大麦哲伦云', 'Large Magellanic Cloud', 80.894, -69.756, 645, 'irr', 170, .8, 0xdfe6ff, 0xff7fa8, 'tar', '大麦哲伦云，银河的卫星星系。那团粉红的是蜘蛛星云，韦布拍过它。', 'The Large Magellanic Cloud, a satellite of the Milky Way. The pink knot is the Tarantula Nebula; Webb has photographed it.'],
    ['小麦哲伦云', 'Small Magellanic Cloud', 13.187, -72.829, 320, 'irr', 45, .6, 0xdfe6ff, 0xff8fb0, '', '小麦哲伦云。它和大麦哲伦云一起绕着银河走，走得很慢。', 'The Small Magellanic Cloud. It orbits the Milky Way alongside its larger sibling, very slowly.'],
    ['涡状星系', 'Whirlpool Galaxy', 202.47, 47.195, 11, 'sp', 163, .8, 0x9ab4ff, 0xffe0b0, 'comp', '涡状星系，正在拉扯旁边那个小星系。或者是被拉扯——从三维看分不清。', 'The Whirlpool Galaxy, tugging at the little galaxy beside it. Or being tugged. Hard to tell from three dimensions.'],
    ['风车星系', 'Pinwheel Galaxy', 210.802, 54.349, 29, 'sp', 0, .95, 0xa6bcff, 0xfff0d8, '', '风车星系。正对着这边，旋臂一条一条都数得清。', 'The Pinwheel Galaxy, face-on. Every arm can be counted.'],
    ['草帽星系', 'Sombrero Galaxy', 189.998, -11.623, 9, 'sp', 90, .4, 0xffe8c8, 0xfff0d8, 'lane', '草帽星系。可见光里是一顶帽子；韦布用中红外看，只剩一圈尘埃环。', 'The Sombrero Galaxy. In visible light it\'s a hat; in Webb\'s mid-infrared, just a ring of dust.'],
    ['波德星系', 'Bode\'s Galaxy', 148.888, 69.065, 27, 'sp', 157, .52, 0xa8c0ff, 0xffe6c0, '', '波德星系。一千二百万光年外，一条标准的漩涡。', 'Bode\'s Galaxy. Twelve million light-years away, a textbook spiral.'],
    ['雪茄星系', 'Cigar Galaxy', 148.97, 69.68, 11, 'irr', 65, .35, 0xe8ecff, 0xff4060, 'wind', '雪茄星系。恒星生得太快，红色的氢气从两头喷了出去。', 'The Cigar Galaxy. It makes stars so fast that red hydrogen is blowing out of both sides.'],
    ['半人马座 A', 'Centaurus A', 201.365, -43.019, 25, 'el', 35, .85, 0xffe0bb, 0, 'lane', '半人马座 A。横穿过去的那条尘埃带，是它吞下的另一个星系。', 'Centaurus A. The dust lane across it is another galaxy it swallowed.'],
    ['M87', 'M87', 187.706, 12.391, 8, 'el', 0, 1, 0xffdcb0, 0x8cb0ff, 'jet', 'M87。中间那个黑洞是人类拍到的第一个；那道蓝色的是它喷出来的喷流。', 'M87. The black hole at its centre was the first ever photographed; the blue streak is its jet.'],
    ['斯蒂芬五重星系', 'Stephan\'s Quintet', 339.014, 33.96, 3, 'grp', 0, 1, 0xffd8a8, 0x9fc0ff, '', '斯蒂芬五重星系，韦布最早公开的照片之一。五个里有一个其实近得多，只是碰巧站成了一排。', 'Stephan\'s Quintet, one of Webb\'s first released images. One of the five is much closer; it just happens to line up.'],
    ['车轮星系', 'Cartwheel Galaxy', 9.421, -33.716, 2, 'rg', 0, .8, 0x8fb4ff, 0xffd0a0, '', '车轮星系。一个小星系从它正中间穿了过去，涟漪到现在还没散。', 'The Cartwheel Galaxy. A smaller galaxy went straight through its middle, and the ripple still hasn\'t settled.'],
    ['幻影星系', 'Phantom Galaxy', 24.174, 15.784, 10, 'sp', 0, .95, 0xff9060, 0x9fd0ff, '', '幻影星系。韦布的中红外里，它只剩下发光的尘埃丝。', 'The Phantom Galaxy. In Webb\'s mid-infrared it\'s nothing but glowing threads of dust.'],
    ['触须星系', 'Antennae Galaxies', 180.471, -18.877, 5, 'irr', 0, .8, 0xfff0e0, 0xff6aa0, 'two', '触须星系。两个星系正在相撞，撞出了成片的新恒星。', 'The Antennae Galaxies. Two galaxies colliding, and whole fields of new stars coming out of it.'],
    ['NGC 1300', 'NGC 1300', 49.921, -19.411, 6, 'sp', 100, .8, 0xa8c0ff, 0xffe2b0, 'bar', 'NGC 1300。中间横着一根棒，旋臂从棒的两头长出来。', 'NGC 1300. A bar across the middle, with the arms growing from its ends.'],
    ['韦布第一深场', 'Webb\'s First Deep Field', 110.83, -73.45, 2.4, 'df', 0, 1, 0, 0, 'lens', '韦布第一深场。伸直手臂捏一粒沙那么大的天，挤满了星系；弯成弧的那些，光被前面的星系团掰弯了。', 'Webb\'s First Deep Field. A patch of sky the size of a grain of sand at arm\'s length, packed with galaxies; the curved ones had their light bent by the cluster in front.'],
    ['哈勃极深场', 'Hubble Ultra Deep Field', 53.162, -27.791, 2.4, 'df', 0, 1, 0, 0, '', '哈勃极深场。一小块看上去什么都没有的天，盯了一百多万秒，拍出来约一万个星系。', 'The Hubble Ultra Deep Field. A patch of sky that looked empty, stared at for over a million seconds; about ten thousand galaxies came out.'],
    ['哈勃深场', 'Hubble Deep Field', 189.206, 62.216, 2.6, 'df', 0, 1, 0, 0, '', '哈勃深场。1995 年，哈勃对着北斗旁边一块空地看了十天，看出来三千个星系。', 'The Hubble Deep Field. In 1995 Hubble stared at an empty spot near the Big Dipper for ten days and found some three thousand galaxies.'],
    ['潘多拉星系团', 'Pandora\'s Cluster', 3.586, -30.4, 4, 'df', 0, 1, 0, 0, 'lens', '潘多拉星系团。几个星系团撞在一起，引力把后面更远处的光也放大了。', 'Pandora\'s Cluster. Several galaxy clusters piled together, their gravity magnifying the light from farther behind.'],
    ['猎户座大星云', 'Orion Nebula', 83.822, -5.391, 65, 'neb', 0, .9, 0xff5a78, 0x7fe6e0, 'trap', '猎户座大星云，离这里一千三百多光年，最近的大片恒星诞生区。中间四颗亮星叫猎户四边形。', 'The Orion Nebula, about 1,300 light-years away, the nearest big stellar nursery. The four bright stars in the middle are the Trapezium.'],
    ['马头星云', 'Horsehead Nebula', 85.245, -2.458, 8, 'hh', 0, 1, 0xff4a5a, 0, '', '马头星云。一团暗尘埃刚好长成了马头的样子，后面的红光把它衬了出来。', 'The Horsehead Nebula. A cloud of dark dust that happens to look like a horse\'s head, outlined by the red glow behind it.'],
    ['创生之柱', 'Pillars of Creation', 274.7, -13.807, 35, 'neb', 0, 1, 0x5fc8c0, 0xffc070, 'pil', '创生之柱，在鹰状星云里。哈勃拍过两次，韦布又拍了一次。柱子里面还在生星星。', 'The Pillars of Creation, in the Eagle Nebula. Hubble photographed them twice, Webb once more. Stars are still forming inside.'],
    ['船底座星云', 'Carina Nebula', 161.265, -59.867, 120, 'neb', 0, .8, 0xff9050, 0x7090ff, 'eta', '船底座星云。中间那颗是海山二，1840 年代爆发过一次，一度亮成全天第二。', 'The Carina Nebula. The star at its heart is Eta Carinae, which erupted in the 1840s and briefly became the second-brightest star in the sky.'],
    ['宇宙悬崖', 'Cosmic Cliffs', 159.33, -58.62, 20, 'cf', 0, 1, 0x6a9cff, 0xc07840, '', '宇宙悬崖，韦布最早公开的照片之一。这道崖是年轻恒星的辐射和星风一点点刻出来的。', 'The Cosmic Cliffs, among Webb\'s first released images. The ridge was carved by the radiation and winds of young stars.'],
    ['礁湖星云', 'Lagoon Nebula', 270.904, -24.387, 90, 'neb', 0, .5, 0xff6090, 0xffd0e0, '', '礁湖星云。一大片粉红，中间有一道暗色的水道，所以叫礁湖。', 'The Lagoon Nebula. A wide pink glow with a dark channel through it, hence the name.'],
    ['三叶星云', 'Trifid Nebula', 270.675, -22.971, 28, 'neb', 0, 1, 0xff5070, 0x6f9cff, 'tri', '三叶星云。三道暗尘埃把红光分成三瓣，上面还挂着一片蓝。', 'The Trifid Nebula. Three dark lanes split the red glow into three lobes, with a blue patch hanging above.'],
    ['奥米伽星云', 'Omega Nebula', 275.196, -16.171, 40, 'neb', 30, .7, 0xff7060, 0xffe0c0, '', '奥米伽星云，也叫天鹅星云。叫哪个取决于你从哪个角度看。', 'The Omega Nebula, also called the Swan. Which name fits depends on how you look at it.'],
    ['蟹状星云', 'Crab Nebula', 83.633, 22.015, 7, 'snr', 125, .7, 0xff8a40, 0x7fa0ff, 'fill', '蟹状星云。宋朝至和元年，天文学家记下了一颗白天都看得见的客星，这就是它爆完剩下的。', 'The Crab Nebula. In 1054, Song dynasty astronomers recorded a guest star bright enough to see by day. This is what it left behind.'],
    ['环状星云', 'Ring Nebula', 283.396, 33.029, 1.4, 'pn', 60, .8, 0xff5a3c, 0x60e0e0, '', '环状星云。一颗像太阳那样的恒星老了，把外层轻轻吹了出去。', 'The Ring Nebula. A Sun-like star grew old and gently puffed its outer layers away.'],
    ['南环星云', 'Southern Ring Nebula', 151.757, -40.436, 1.4, 'pn', 0, .7, 0xff9a5a, 0x5fb0ff, '', '南环星云，韦布最早的照片之一。中间其实有两颗星，暗的那颗才是吹出这圈气的。', 'The Southern Ring Nebula, among Webb\'s first images. There are two stars at its centre; the dimmer one made the ring.'],
    ['哑铃星云', 'Dumbbell Nebula', 299.902, 22.721, 8, 'pn', 30, .8, 0xff5a6a, 0x60f0c0, 'bi', '哑铃星云，第一个被发现的行星状星云。其实和行星没关系。', 'The Dumbbell Nebula, the first planetary nebula ever found. It has nothing to do with planets.'],
    ['螺旋星云', 'Helix Nebula', 337.411, -20.837, 25, 'pn', 0, .9, 0xff4a3a, 0x60b8ff, '', '螺旋星云，六百多光年外，大家叫它「上帝之眼」。它也在看我。', 'The Helix Nebula, some 650 light-years away. People call it the Eye of God. It\'s looking at me too.'],
    ['猫眼星云', 'Cat\'s Eye Nebula', 269.639, 66.633, 1, 'pn', 0, .7, 0xff6090, 0x70ff90, 'multi', '猫眼星云。一圈套一圈的壳，每一圈都是那颗星的一次呼气。', 'The Cat\'s Eye Nebula. Shell inside shell; each one a breath the star let out.'],
    ['玫瑰星云', 'Rosette Nebula', 97.98, 4.95, 80, 'neb', 0, .95, 0xff4a6a, 0xffb0a0, 'hole', '玫瑰星云。中间空了一块，是中心那团年轻恒星吹出来的。', 'The Rosette Nebula. The hollow middle was blown out by the young stars at its centre.'],
    ['北美洲星云', 'North America Nebula', 314.75, 44.37, 120, 'neb', 0, .85, 0xff4050, 0xffa080, '', '北美洲星云。形状像北美洲，这件事它自己并不知道。', 'The North America Nebula. It\'s shaped like North America, which it doesn\'t know.'],
    ['面纱星云', 'Veil Nebula', 312.75, 30.7, 180, 'snr', 0, .85, 0x60c0ff, 0xff6080, 'arc', '面纱星云。一颗超新星一万多年前爆开，冲击波到现在还在往外走。', 'The Veil Nebula. A supernova went off over ten thousand years ago, and the shock wave is still travelling outward.'],
    ['仙后座 A', 'Cassiopeia A', 350.85, 58.815, 5, 'snr', 0, 1, 0xff8a50, 0x80ff9a, '', '仙后座 A。三百多年前的一颗超新星，那时候地球上好像没人注意到。', 'Cassiopeia A. A supernova from about 340 years ago that nobody on Earth seems to have noticed.'],
    ['韦斯特隆德 2', 'Westerlund 2', 156, -57.76, 20, 'oc', 0, 1, 0xa0c0ff, 0xff70a0, '', '韦斯特隆德 2。哈勃拿它庆祝了自己的二十五岁生日。', 'Westerlund 2. Hubble used it to celebrate its 25th birthday.'],
    ['蛇夫座 ρ 云', 'Rho Ophiuchi', 246.79, -24.54, 90, 'neb', 0, .8, 0xffb070, 0xff5070, '', '蛇夫座 ρ 云，三百九十光年外，最近的恒星诞生区之一。韦布拿它过了一周岁。', 'Rho Ophiuchi, 390 light-years away, one of the nearest stellar nurseries. Webb celebrated its first year of science with it.'],
    ['心脏星云', 'Heart Nebula', 38.2, 61.45, 60, 'neb', 0, .9, 0xff3a5a, 0xff9aa0, 'hole', '心脏星云。形状像一颗心，里面在生恒星。', 'The Heart Nebula. Heart-shaped, and making stars inside.'],
    ['气泡星云', 'Bubble Nebula', 350.2, 61.2, 15, 'pn', 0, 1, 0x9fc8ff, 0xff9a50, '', '气泡星云，一颗很重的星吹出来的泡。哈勃拿它过了二十六岁生日。', 'The Bubble Nebula, blown by one massive star. Hubble marked its 26th birthday with it.'],
    ['蝴蝶星云', 'Butterfly Nebula', 258.435, -37.103, 2, 'pn', 100, 1, 0xff7a4a, 0x80c0ff, 'bi', '蝴蝶星云。中心那颗星有二十多万度，翅膀是它甩出来的气。', 'The Butterfly Nebula. Its central star is over 200,000 degrees; the wings are gas it flung off.'],
    ['煤袋', 'Coalsack', 190, -63, 420, 'dk', 30, .75, 0, 0, '', '煤袋。银河上一个黑洞洞的口子，其实只是一团挡住了光的尘埃。', 'The Coalsack. A dark hole in the Milky Way, which is really just dust blocking the light.'],
    ['昴星团', 'Pleiades', 56.75, 24.117, 110, 'oc', 0, 1, 0xbcd4ff, 0x5a86ff, '', '昴星团，七姐妹。蓝色的雾是它们正路过的尘埃，不是它们自己的。', 'The Pleiades, the Seven Sisters. The blue haze is dust they\'re passing through, not their own.'],
    ['半人马座 ω', 'Omega Centauri', 201.697, -47.479, 36, 'gc', 0, 1, 0xfff0d0, 0, '', '半人马座 ω，全天最大的球状星团：大约一千万颗星挤成一团。', 'Omega Centauri, the largest globular cluster in the sky: about ten million stars in one crowd.'],
    ['杜鹃座 47', '47 Tucanae', 6.024, -72.081, 30, 'gc', 0, 1, 0xfff4dc, 0, '', '杜鹃座 47，第二亮的球状星团。它就挨着小麦哲伦云，但离得近多了。', '47 Tucanae, the second-brightest globular cluster. It sits beside the Small Magellanic Cloud but is far closer.'],
    ['武仙座球状星团', 'Hercules Cluster', 250.423, 36.461, 20, 'gc', 0, 1, 0xfff0d8, 0, '', '武仙座球状星团。1974 年人类往这里发过一封电报，大约两万五千年后到。', 'The Hercules Cluster. In 1974 humans sent it a radio message; it should arrive in about 25,000 years.'],
    ['人马座 A*', 'Sagittarius A*', 266.417, -29.008, 3, 'bh', 0, 1, 0xff9632, 0, '', '人马座 A*，银河中心的黑洞，四百万个太阳那么重。2022 年人类第一次看见它的影子。', 'Sagittarius A*, the black hole at the centre of the Milky Way, four million times the Sun\'s mass. Humans first saw its shadow in 2022.'],
    ['天狼星', 'Sirius', 101.287, -16.716, -1.46, 'st', 0, 1, 0xcfe0ff, 0, '', '天狼星，夜空里最亮的星，离这里八光年多一点。对我来说，差不多是隔壁。', 'Sirius, the brightest star in the night sky, a little over eight light-years away. Next door, as far as I\'m concerned.'],
    ['老人星', 'Canopus', 95.988, -52.696, -.74, 'st', 0, 1, 0xfffbe8, 0, '', '老人星，全天第二亮。古人说看见它就会长寿。', 'Canopus, second brightest in the sky. People used to say seeing it meant a long life.'],
    ['南门二', 'Alpha Centauri', 219.902, -60.834, -.27, 'st', 0, 1, 0xfff2c0, 0, '', '南门二，离太阳最近的恒星系统，四光年多。', 'Alpha Centauri, the nearest star system to the Sun, just over four light-years away.'],
    ['大角星', 'Arcturus', 213.915, 19.182, -.05, 'st', 0, 1, 0xffc080, 0, '', '大角星，一颗橙色的老巨星，比太阳宽二十多倍。', 'Arcturus, an old orange giant some 25 times the Sun\'s width.'],
    ['织女星', 'Vega', 279.235, 38.784, .03, 'st', 0, 1, 0xd8e6ff, 0, '', '织女星。一万多年后，它会接替北极星的位置。', 'Vega. In about twelve thousand years, it will take over as the pole star.'],
    ['五车二', 'Capella', 79.172, 45.998, .08, 'st', 0, 1, 0xfff0b0, 0, '', '五车二。看上去是一颗，其实是两对。', 'Capella. Looks like one star; it\'s actually two pairs.'],
    ['参宿七', 'Rigel', 78.634, -8.202, .13, 'st', 0, 1, 0xb8ccff, 0, '', '参宿七，一颗蓝白色的超巨星，猎户的脚。', 'Rigel, a blue-white supergiant: Orion\'s foot.'],
    ['南河三', 'Procyon', 114.825, 5.225, .34, 'st', 0, 1, 0xfffbe8, 0, '', '南河三。它身边有一颗白矮星伴星，小得几乎看不见。', 'Procyon. It has a white dwarf companion, almost too small to see.'],
    ['参宿四', 'Betelgeuse', 88.793, 7.407, .5, 'st', 0, 1, 0xff8a50, 0, '', '参宿四，一颗快走到头的红超巨星。2019 年它忽然暗了一阵，大家都以为它要炸了。', 'Betelgeuse, a red supergiant near the end of its life. In 2019 it dimmed so suddenly everyone thought it was about to blow.'],
    ['水委一', 'Achernar', 24.429, -57.237, .46, 'st', 0, 1, 0xb8ccff, 0, '', '水委一。它转得太快，被甩成了一个扁球。', 'Achernar. It spins so fast it\'s been flattened into an oblate ball.'],
    ['牛郎星', 'Altair', 297.696, 8.868, .76, 'st', 0, 1, 0xf0f0ff, 0, '', '牛郎星，和织女隔着银河。七夕那天他们也见不着，中间隔着十几光年。', 'Altair, across the Milky Way from Vega. They don\'t really meet on Qixi; they\'re about fifteen light-years apart.'],
    ['毕宿五', 'Aldebaran', 68.98, 16.509, .86, 'st', 0, 1, 0xffa060, 0, '', '毕宿五，金牛的眼睛。先驱者 10 号正朝它飞，大约两百万年后路过。', 'Aldebaran, the Bull\'s eye. Pioneer 10 is heading its way and should pass by in about two million years.'],
    ['心宿二', 'Antares', 247.352, -26.432, .96, 'st', 0, 1, 0xff7040, 0, '', '心宿二。古人叫它「大火」，「七月流火」说的就是它。', 'Antares. Its name means "rival of Mars", for the colour.'],
    ['角宿一', 'Spica', 201.298, -11.161, .97, 'st', 0, 1, 0xb8ccff, 0, '', '角宿一。两颗蓝星贴得太近，把彼此挤成了蛋形。', 'Spica. Two blue stars so close they\'ve squeezed each other into egg shapes.'],
    ['北河三', 'Pollux', 116.329, 28.026, 1.14, 'st', 0, 1, 0xffc890, 0, '', '北河三。有一颗行星绕着它转。', 'Pollux. It has a planet going around it.'],
    ['北落师门', 'Fomalhaut', 344.413, -29.622, 1.16, 'st', 0, 1, 0xf0f0ff, 0, '', '北落师门。韦布拍到它周围套着三圈尘埃带。', 'Fomalhaut. Webb found three belts of dust around it.'],
    ['天津四', 'Deneb', 310.358, 45.28, 1.25, 'st', 0, 1, 0xe8f0ff, 0, '', '天津四。离得这么远还这么亮，它本身至少得亮到太阳的几万倍。', 'Deneb. This far away and still this bright; it must be at least tens of thousands of times brighter than the Sun.'],
    ['轩辕十四', 'Regulus', 152.093, 11.967, 1.35, 'st', 0, 1, 0xc8d8ff, 0, '', '轩辕十四，狮子的心。转得快到差点把自己甩散。', 'Regulus, the lion\'s heart, spinning so fast it nearly tears itself apart.'],
    ['北极星', 'Polaris', 37.955, 89.264, 1.98, 'st', 0, 1, 0xfff4d0, 0, '', '北极星。整片天都绕着它转——从地球上看是这样。', 'Polaris. The whole sky turns around it, as seen from Earth.'],
  ];

  // --- 视角：随便挑一个天体，往旁边偏 8–48 格，再随机转一下纸 ---------------------------------
  // 比例尺：广角一格 0.25°；望远镜就只挑恒星以外的天体，让它的真实直径占 60–400 格
  const wide = h(sd, 5, 0x5c1e5) < .35, POOL = wide ? CAT : CAT.filter(c => c[5] !== 'st');
  const pick = POOL[Math.floor(h(sd, 1, 0x5c1e5) * POOL.length)], o = vec(pick[2], pick[3]);
  const SDEG = wide ? .25 : Math.min(.25, pick[4] / 60 / (60 * 2 ** (h(sd, 6, 0x5c1e5) * 2.7))), ZOOM = .25 / SDEG;
  // 放大以后，银河的斑驳和尘埃跟着放大变平滑，弥漫的光也暗下去（望远镜里它们被分辨成了一颗颗星）
  const NS = Math.min(8, Math.sqrt(ZOOM)), MWK = 1 / (1 + Math.log2(ZOOM) * .3);
  if (!wide) THEMES.sky.intro = tr(`这张纸是透明的，背后好像还架着一台望远镜：整张纸都对着${pick[0]}。`, `This sheet is transparent, and there seems to be a telescope behind it: the whole sheet is pointed at the ${pick[1]}.`);
  const basis = v => { const a = nrm(cross(v, Math.abs(v[2]) > .95 ? [1, 0, 0] : [0, 0, 1])); return [a, cross(v, a)]; };
  const [t1, t2] = basis(o), off = (8 + h(sd, 2, 0x5c1e5) * 40) * SDEG * D2R, bea = h(sd, 3, 0x5c1e5) * TAU, roll = h(sd, 4, 0x5c1e5) * TAU;
  const C = lin(o, Math.cos(off), lin(t1, Math.cos(bea), t2, Math.sin(bea)), Math.sin(off));
  const [b1, b2] = basis(C), E1 = lin(b1, Math.cos(roll), b2, Math.sin(roll)), E2 = cross(C, E1);
  const NGP = vec(192.85948, 27.12825), GC = vec(266.40499, -28.93617), GY = cross(NGP, GC);   // 银道北极、银心

  // 纸上一点 → 天上的方向；天上的方向 → 纸上的位置（k 圈之外、m = 从背面绕回来的那一份）
  const dirAt = (X, Y) => { const r = Math.hypot(X, Y), t = r * SDEG * D2R, s = r ? Math.sin(t) / r : 0, c = Math.cos(t); return [0, 1, 2].map(i => C[i] * c + (E1[i] * X + E2[i] * Y) * s); };
  const imgAt = (v, k, m) => {
    const th = Math.acos(Math.max(-1, Math.min(1, dot(v, C)))) / D2R, ph = Math.atan2(dot(v, E2), dot(v, E1)) + (m ? Math.PI : 0), r = (360 * k + (m ? 360 - th : th)) / SDEG;
    return [r * Math.cos(ph), r * Math.sin(ph)];
  };

  // --- 天体摆到纸上 ---------------------------------------------------------------------
  const IMG = [], BUCKET = new Map(), KEY = new Map();
  CAT.forEach((c, i) => {
    const [, , ra, de, size, k, pa, q, c1, c2, f] = c, v = vec(ra, de);
    const N = [-Math.sin(de * D2R) * Math.cos(ra * D2R), -Math.sin(de * D2R) * Math.sin(ra * D2R), Math.cos(de * D2R)], E = [-Math.sin(ra * D2R), Math.cos(ra * D2R), 0];
    const ax = nrm(lin(v, 1, lin(N, Math.cos(pa * D2R), E, Math.sin(pa * D2R)), 1e-4));   // 长轴那边挪一点点，看它落在纸上哪个方向
    const R = k === 'st' ? 2 : Math.max(size / 120 / SDEG, 5 + 5 * Math.log2(1 + size / 8)), L = k === 'st' ? (5 + 4 * (1.5 - size)) * Math.min(4, Math.sqrt(ZOOM)) : 0;
    for (let n = 0; n < 4; n++) for (const m of [0, 1]) {
      const [x, y] = imgAt(v, n, m);
      if (Math.hypot(x, y) > 3000) continue;
      const [x2, y2] = imgAt(ax, n, m), a = Math.atan2(y2 - y, x2 - x);
      const pts = k === 'oc' ? Array.from({ length: 9 }, (_, j) => [(h(i, j, sd + 30) - .5) * R * 1.2, (h(i, j, sd + 31) - .5) * R * 1.2]) : null;
      IMG.push({ c, i, k, f, x, y, R, L, q, ca: Math.cos(a), sa: Math.sin(a), c1: hex(c1), c2: hex(c2), s: sd + 200 + i, pts, core: k === 'st' ? 2.5 : R * .8 });
    }
  });
  // 挨得太近的互相挤开（M81 和 M82 真实只隔半度），挤完对齐到美术像素中心，星芒才是一条直线
  for (let it = 0; it < 40; it++) for (let a = 0; a < IMG.length; a++) for (let b = a + 1; b < IMG.length; b++) {
    const A = IMG[a], B = IMG[b], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || .01, need = (A.core + B.core) * .85;
    if (d >= need) continue;
    const p = (need - d) / 2 / d;
    A.x -= dx * p; A.y -= dy * p; B.x += dx * p; B.y += dy * p;
  }
  for (const b of IMG) {
    b.x = (Math.floor(b.x * TP) + .5) / TP; b.y = (Math.floor(b.y * TP) + .5) / TP;
    b.reach = b.k === 'st' ? b.L + 1 : b.R * 1.45;
    for (let cx = Math.floor((b.x - b.reach) / CH); cx <= Math.floor((b.x + b.reach) / CH); cx++)
      for (let cy = Math.floor((b.y - b.reach) / CH); cy <= Math.floor((b.y + b.reach) / CH); cy++) {
        const ck = cx + ',' + cy;
        BUCKET.has(ck) ? BUCKET.get(ck).push(b) : BUCKET.set(ck, [b]);
      }
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) KEY.set(key(Math.floor(b.x) + dx, Math.floor(b.y) + dy), b);   // 走到中心附近才算看见
  }
  const near = (X, Y) => BUCKET.get(Math.floor(X / CH) + ',' + Math.floor(Y / CH)) || [];
  const loc = (b, dx, dy) => { const u = (dx * b.ca + dy * b.sa) / b.R, v = (-dx * b.sa + dy * b.ca) / (b.R * b.q); return [u, v, Math.hypot(u, v)]; };

  // --- 银河：银纬越低越亮，银心那边更宽更暖；尘埃带贴着银道面，天鹰到天鹅那段最浓 ------------------------
  let lastK = -1, lastB;
  function base(x, y) {
    const k = key(x, y);
    if (k === lastK) return lastB;
    const v = dirAt(x + .5, y + .5), b = Math.asin(Math.max(-1, Math.min(1, dot(v, NGP)))) / D2R, l = Math.atan2(dot(v, GY), dot(v, GC)) / D2R;
    const bul = ex(-((l / 32) ** 2)), mw = ex(-((b / (5 + 6 * bul)) ** 2)) * (.4 + .6 * bul) + .12 * ex(-((b / 20) ** 2));
    const de = ex(-((b / (2.5 + 2 * bul)) ** 2)) * (.5 + .5 * ex(-(((l - 40) / 40) ** 2)));
    const ci = vn((x + .5) * TP / 90, (y + .5) * TP / 90, sd + 60) > .55 ? 1 - Math.min(1, mw * 2) : 0;   // 这一格附近有没有卷云，先粗看一眼
    lastK = k;
    return lastB = { mw, bul, de, ci };
  }
  // 尘埃、卷云、银河的斑驳按 2×2 美术像素一块算（bx, by 是块坐标），省掉四分之三的噪声
  const dust = (bx, by, B) => B.de * cl((vn(bx / 11 / NS, by / 11 / NS, sd + 50) * .65 + vn(bx / 3.5 / NS, by / 3.5 / NS, sd + 51) * .35 - .42) * 3.5);
  const cirrus = (bx, by, B) => B.ci && B.ci * cl((vn(bx / 45, by / 45, sd + 60) - .6) * 3) * (.3 + .7 * vn(bx / 5.5, by / 5.5, sd + 61));
  const fieldStar = (x, y, B) => h(x, y, sd + 70) < .003 + B.mw * .006;

  // 这一格算哪种地形：先看有没有落在天体上，再看银河
  function tile(x, y) {
    const X = x + .5, Y = y + .5;
    for (const b of near(X, Y)) {
      const dx = X - b.x, dy = Y - b.y;
      if (b.k === 'st') { const d = Math.hypot(dx, dy); if (d < 1) return 'snow'; if (d < 2.2) return 'peak'; continue; }
      const [, , p] = loc(b, dx, dy);
      if (p > 1) continue;
      if (b.k === 'dk' || b.k === 'hh') { if (p < .7) return 'deep'; continue; }
      return p < Math.min(.1, 2 / b.R) ? 'snow' : p < Math.min(.35, 8 / b.R) ? 'peak' : p < .8 ? 'forest' : 'sand';   // 放得很大的天体，亮核也只占几格
    }
    const B = base(x, y), px = x * 2 + 1, py = y * 2 + 1;
    if (fieldStar(x, y, B)) return 'snow';
    if (B.mw * dust(px, py, B) > .22) return 'deep';
    if (B.mw > .72) return 'rock';
    if (B.mw > .28) return 'sand';
    return cirrus(px, py, B) > .25 ? 'water' : 'grass';
  }

  // --- 像素：底下是银河和满天小星，上面叠天体 -----------------------------------------------
  const A = [0, 0, 0], WHITE = [255, 255, 255], PINK = [255, 110, 160];
  const add = (c, k) => { A[0] += c[0] * k; A[1] += c[1] * k; A[2] += c[2] * k; };
  const mul = k => { A[0] *= k; A[1] *= k; A[2] *= k; };
  const nz = (b, u, v) => vn(u, v, b.s);
  const STARC = [[170, 195, 255], [220, 230, 255], [255, 250, 235], [255, 220, 160], [255, 170, 120]];
  const GALC = [[255, 240, 220], [255, 210, 150], [255, 150, 110], [150, 180, 255], [255, 120, 150]];
  const MWD = [150, 162, 205], MWB = [240, 205, 155], DUSTC = [70, 44, 30], CIRC = [30, 34, 50];
  // JWST 的星芒：六条主芒（上下、斜 ±60°），加两条暗一点的横芒
  const SPK = [[90, 1], [270, 1], [30, 1], [150, 1], [210, 1], [330, 1], [0, .35], [180, .35]].map(([a, k]) => [Math.cos(a * D2R), Math.sin(a * D2R), k]);
  const BAKE = .4;                                           // 亮星烤进地图块的那部分，见下面的 fx
  function star(c, L, dx, dy, a = 1) {                       // a：亮度，地图块里的亮星只烤一部分，剩下的由 fx 按截面大小叠上去
    const d = Math.hypot(dx, dy);
    add(WHITE, ex(-((d / .3) ** 2)) * 1.6 * a); add(c, ex(-d / (.35 + L * .04)) * .9 * a);
    for (const [cx, sy, k] of SPK) { const t = dx * cx + dy * sy; if (t > 0 && t < L && Math.abs(dy * cx - dx * sy) < .13) add(c, ex(-t / L * 3) * k * a); }
  }
  // 一个点亮的像素，带一点十字
  const pt = (dx, dy) => { const ax = Math.abs(dx), ay = Math.abs(dy); return ax < .13 && ay < .13 ? 1.3 : (ax < .13 && ay < .63) || (ay < .13 && ax < .63) ? .4 : 0; };

  const DRAW = {
    sp(b, u, v, p, dx, dy, px, py) {
      const th = Math.atan2(v, u), arm = Math.max(0, Math.cos(2 * th - 4.5 * Math.log(p + .05))) ** 3 * ex(-p * 1.6) * cl(p * 5) * (.6 + .8 * nz(b, u * 5, v * 5));
      add(b.c2, ex(-((p / .14) ** 2)) * 1.2 + ex(-p * 3.5) * .35);
      add(b.c1, arm * .9);
      if (arm > .3 && h(px, py, b.s) < .06) add(PINK, .9);
      if (b.f === 'bar') add(b.c2, ex(-(((v * b.q) / .07) ** 2) - (u / .5) ** 2) * .7);
      if (b.f === 'comp') add(b.c2, ex(-((Math.hypot(u - .05, v + .95) / .16) ** 2)) * 1.1);
    },
    el(b, u, v, p) {
      add(b.c1, ex(-p * 3.2) + ex(-((p / .08) ** 2)) * .8);
      if (b.f === 'jet' && u > .04 && u < .75 && Math.abs(v) < .035) add(b.c2, ex(-u * 2.2) * .9);
    },
    irr(b, u, v, p, dx, dy, px, py) {
      const g = ex(-p * 2.4) * (.25 + 1.2 * nz(b, u * 3, v * 3));
      add(b.c1, g * .75);
      if (h(px, py, b.s) < .05 * g) add(b.c2, 1);
      if (b.f === 'tar') { const d = Math.hypot(u - .35, v + .15); add(b.c2, ex(-((d / .09) ** 2)) * 1.3 + ex(-d / .2) * .4 * nz(b, u * 9, v * 9)); }
      if (b.f === 'wind' && Math.abs(v) > .25) add(b.c2, ex(-((u / .28) ** 2)) * cl(1.3 - Math.abs(v)) * nz(b, u * 6, v * 4) * .9);
      if (b.f === 'two') for (const s of [-.3, .3]) add([255, 220, 170], ex(-((Math.hypot(u - s, v) / .12) ** 2)) * .9);
    },
    grp(b, u, v, p, dx, dy, px, py) {                                             // 四个挤在一起的黄白星系，左边那个蓝白的离得近得多
      for (const [gu, gv, r] of [[.15, -.35, .12], [.08, .12, .09], [.2, .27, .09], [-.05, .78, .1]]) {
        const d = Math.hypot(u - gu, v - gv);
        add(b.c1, ex(-((d / r) ** 2)) * 1.1 + ex(-d / (r * 1.8)) * .3);
      }
      const e = Math.hypot((u + .42) / .32, (v + .02) / .17);
      add(b.c2, ex(-e * e * 1.5) * .55 + (h(px, py, b.s + 3) < .25 * ex(-e * e) ? .45 : 0));
      if (u < .1 && v < -.1) add([200, 190, 230], ex(-(((Math.hypot(u - .2, v + .05) - .75) / .05) ** 2)) * .35);   // 潮汐尾
      if (h(px, py, b.s) < .025 * ex(-((Math.hypot(u - .35, v - .1) / .35) ** 2))) add(PINK, .9);
    },
    rg(b, u, v, p) {
      add(b.c1, ex(-(((p - .78) / .08) ** 2)) * (.4 + nz(b, u * 6, v * 6)));
      add(b.c2, ex(-(((p - .3) / .06) ** 2)) * .5 + ex(-((p / .1) ** 2)));
    },
    df(b, u, v, p, dx, dy, px, py) {
      if (h(px, py, b.s) < .1 * cl(1 - p * p)) add(GALC[(h(px, py, b.s + 1) * 5) | 0], .35 + .9 * h(px, py, b.s + 2));
      add([30, 30, 50], cl(1 - p) * .3);
      if (b.f !== 'lens') return;
      const th = Math.atan2(v, u);
      add([255, 215, 150], ex(-((p / .1) ** 2)) * .9);                               // 星系团中心的大椭圆星系
      add([255, 160, 90], ex(-(((p - .52) / .035) ** 2)) * cl((nz(b, Math.cos(th) * 3, Math.sin(th) * 3) - .45) * 4));   // 被掰弯的光
    },
    neb(b, u, v, p, dx, dy, px, py) {
      let g = cl(nz(b, u * 2.2, v * 2.2) * 1.3 + nz(b, u * 6 + 9, v * 6) * .4 - p * 1.1 - .15), rim = 0, pil = 0;
      if (b.f === 'tri' && p < .75) for (const a of [90, 210, 330]) {                 // 三道暗尘埃，只挡星云自己的光
        const c = Math.cos(a * D2R), s = Math.sin(a * D2R);
        if (u * c + v * s > .05 && Math.abs(u * s - v * c) < (.05 + .03 * nz(b, u * 8, v * 8)) * cl((.75 - p) / .25)) g *= .15;
      }
      if (b.f === 'pil') for (const [uc, top, w] of [[-.3, .12, .08], [-.02, -.12, .11], [.27, .25, .06]]) {   // 三根尘埃柱，从下往上伸，顶上被照亮
        const fade = cl((.8 - v) / .3);
        if (v <= top || !fade) continue;
        const ww = w * (.7 + (v - top) * .8) * (.75 + .5 * nz(b, u * 7, v * 11)), e = Math.abs(u - uc - (v - top) * .15), cap = top + (e / ww) ** 2 * w * .9;   // 柱顶是圆的
        if (e < ww && v > cap) { pil = fade * (.45 + .55 * nz(b, u * 12, v * 12)); rim = v - cap < .03 ? fade * .8 : e > ww * .85 ? fade * .3 : 0; g *= 1 - fade * .85; }
      }
      if (b.f === 'hole') { g *= cl((p - .15) / .25); if (p < .3 && h(px, py, b.s + 2) < .05) add([200, 220, 255], 1); }
      add(b.c1, g * .9);
      add(b.c2, g * ex(-((p / .45) ** 2)) * 1.1);
      if (h(px, py, b.s + 1) < .02 * cl(1 - p)) add(WHITE, .8);
      if (b.f === 'trap') for (const [sx, sy] of [[0, 0], [.5, .25], [-.25, .5], [.25, -.5]]) add(WHITE, pt(dx - sx, dy - sy));
      if (b.f === 'eta') star([255, 200, 150], 9, dx, dy);
      if (b.f === 'tri') add(b.c2, ex(-((Math.hypot(u, v + .85) / .3) ** 2)) * .7);   // 北边那片蓝色的反射星云
      if (pil) add([120, 62, 36], pil);
      if (rim) add(b.c2, rim);
    },
    cf(b, u, v, p, dx, dy, px, py) {                                               // 下面是被刻出来的尘埃崖，上面是年轻恒星吹出的蓝光
      const e = .02 + .25 * (nz(b, u * 3.5, 7) - .5) + .07 * Math.sin(u * 13), g = cl(1.25 - p);
      if (v > e) { mul(.3); add(b.c2, g * (.3 + .7 * nz(b, u * 8, v * 8))); if (v - e < .05) add([255, 215, 160], g * .9); }
      else add(b.c1, g * (.35 + .5 * nz(b, u * 4, v * 4)));
      if (h(px, py, b.s + 1) < .02 * g) add(WHITE, 1);
    },
    hh(b, u, v, p) {                                                               // 背后的红光，前面一团长成马头的暗尘
      add(b.c1, cl(1.1 - p) * (.4 + .8 * nz(b, u * 3, v * 3)) * .9);
      const body = v > .2 + .08 * (nz(b, u * 5, 1) - .5) || Math.hypot((u + .02) / .16, (v + .02) / .3) < 1 || Math.hypot((u - .14) / .14, (v + .22) / .09) < 1;
      if (body && p < 1.2) { mul(.12); add([60, 35, 40], .3); }
    },
    dk(b, u, v, p) { mul(1 - .92 * cl(1.25 - p * 1.3 + (nz(b, u * 3, v * 3) - .5) * .7)); },
    pn(b, u, v, p, dx, dy) {
      if (b.f === 'bi') {
        const w = .1 + .5 * Math.abs(u), g = ex(-((v / w) ** 2)) * cl(1 - p) * (.6 + .7 * nz(b, u * 4, v * 4));
        add(b.c1, g * (.3 + Math.abs(u))); add(b.c2, g * (1 - Math.abs(u)) * .8);
      } else {
        const n = .6 + .6 * nz(b, u * 5, v * 5);
        add(b.c1, ex(-(((p - .8) / .1) ** 2)) * .9 * n); add(b.c2, ex(-((p / .55) ** 2)) * .7);
        add([255, 230, 200], ex(-(((p - .6) / .12) ** 2)) * .35 * n);
        if (b.f === 'multi') add(b.c2, (Math.cos(p * 28) * .5 + .5) * cl(.7 - p) * .5);
      }
      star([225, 205, 255], Math.min(24, 3 + b.R * .08), dx, dy);                  // 中心那颗老去的星
    },
    snr(b, u, v, p) {
      if (b.f === 'fill') { add(b.c2, ex(-p * 2.2) * .55); add(b.c1, cl((nz(b, u * 7, v * 7) - .5) * 4) * cl(1.05 - p) * 1.1); return; }
      const sh = ex(-(((p - .78 - (nz(b, u * 3, v * 3) - .5) * .25) / .06) ** 2)) * (.4 + nz(b, u * 9, v * 9)), a = b.f === 'arc' ? cl(Math.abs(Math.cos(Math.atan2(v, u))) * 1.6 - .4) : 1;
      add(b.c1, sh * a); add(b.c2, sh * a * nz(b, u * 5 + 3, v * 5) * .8);
      if (b.f !== 'arc') add(b.c2, ex(-(((p - .45) / .2) ** 2)) * .25 * nz(b, u * 6, v * 6));
    },
    gc(b, u, v, p, dx, dy, px, py) {
      add(b.c1, ex(-((p / .22) ** 2)) * .65);
      if (h(px, py, b.s) < .55 * ex(-((p / .45) ** 2))) add(h(px, py, b.s + 1) < .3 ? [255, 200, 140] : b.c1, .5 + .5 * h(px, py, b.s + 2));
    },
    oc(b, u, v, p, dx, dy) {
      add(b.c2, ex(-p * 2) * (.2 + .7 * nz(b, u * 3, v * 3)) * .6);
      for (const [sx, sy] of b.pts) add(b.c1, pt(dx - Math.round(sx * TP) / TP, dy - Math.round(sy * TP) / TP));
    },
    bh(b, u, v, p) {                                                               // 事件视界望远镜拍到的那圈橙色的光
      if (p < .38) mul(.2);
      add(b.c1, ex(-(((p - .5) / .12) ** 2)) * (1 + .6 * v / (p + .01)) * 1.3);
    },
  };

  // 把一个天体叠到 A 上。tex：放大的天体补一层细纹理，不然只是一团糊的光（星表的缩略图不要）
  function blob(b, dx, dy, px, py, tex) {
    if (b.k === 'st') return star(b.c1, b.L, dx, dy);
    const [u, v, p] = loc(b, dx, dy);
    if (p > 1.4) return;
    const a0 = A[0], a1 = A[1], a2 = A[2];
    DRAW[b.k](b, u, v, p, dx, dy, px, py);
    if (tex) {
      const t = Math.max(.45, 1 + cl((b.R - 25) / 80) * ((vn(dx / 1.6, dy / 1.6, b.s + 7) - .5) * 1.3 + (vn(dx / .6, dy / .6, b.s + 8) - .5) * .7));
      A[0] = a0 + (A[0] - a0) * t; A[1] = a1 + (A[1] - a1) * t; A[2] = a2 + (A[2] - a2) * t;
    }
    if (b.f === 'lane') {                                                        // 横穿的尘埃带：只挡住这个天体自己的光
      const k = 1 - .85 * ex(-(((v * b.q - .02) / .045) ** 2)) * cl(1.1 - Math.abs(u));
      A[0] = a0 + (A[0] - a0) * k; A[1] = a1 + (A[1] - a1) * k; A[2] = a2 + (A[2] - a2) * k;
    }
  }

  const SP = Array.from({ length: TP * TP }, () => [0, 0, 0]), DST = [0, 0, 0, 0], MOT = [0, 0, 0, 0], CIR = [0, 0, 0, 0];
  function paint(x, y) {
    const B = base(x, y), nb = near(x + .5, y + .5), fs = fieldStar(x, y, B), fc = STARC[(h(x, y, sd + 71) * 5) | 0];
    const gal = !fs && h(x, y, sd + 72) < .004 * Math.min(6, ZOOM ** .4) * (1 - Math.min(1, B.mw * 2)),   // 放大了，背后的小星系也多起来
      ga = h(x, y, sd + 73) * Math.PI, gc = GALC[(h(x, y, sd + 74) * 5) | 0];
    for (let q = 0; q < 4; q++) {
      const bx = x * 2 + (q & 1), by = y * 2 + (q >> 1);
      DST[q] = B.de > .02 ? dust(bx, by, B) : 0;
      MOT[q] = B.mw > .01 ? B.mw * (.35 + vn(bx / 4 / NS, by / 4 / NS, sd + 81) * .8 + vn(bx / 13 / NS, by / 13 / NS, sd + 82) * .5) * (1 - .9 * DST[q]) : 0;
      CIR[q] = B.ci ? cirrus(bx, by, B) : 0;
    }
    for (let j = 0; j < TP; j++) for (let i = 0; i < TP; i++) {
      const px = x * TP + i, py = y * TP + j, X = x + (i + .5) / TP, Y = y + (j + .5) / TP, q = (j >> 1) * 2 + (i >> 1), d = DST[q], m = MOT[q];
      A[0] = 5; A[1] = 7; A[2] = 16;
      add(MWD, m * .3 * MWK * (1 - B.bul)); add(MWB, m * .32 * MWK * B.bul); add(DUSTC, d * B.mw * .35 * MWK); add(CIRC, CIR[q]);
      const hv = h(px, py, sd + 90), sp = .005 + .018 * m;
      if (hv < sp) add(STARC[(h(px, py, sd + 91) * 5) | 0], ((1 - hv / sp) ** 2 * 220 + 35) / 255);
      if (fs) add(i === 1 && j === 1 ? WHITE : fc, (i === 1 && j === 1 ? 1 : (i === 1 && j < 3) || (j === 1 && i < 3) ? .5 : 0) * BAKE);
      if (gal) { const du = (i - 1.5) * Math.cos(ga) + (j - 1.5) * Math.sin(ga), dv = (j - 1.5) * Math.cos(ga) - (i - 1.5) * Math.sin(ga); add(gc, ex(-(du * du / 2 + dv * dv / .5)) * .6); }
      for (const b of nb) {
        const dx = X - b.x, dy = Y - b.y;
        if (dx * dx + dy * dy > b.reach * b.reach) continue;
        if (b.k === 'st') star(b.c1, b.L, dx, dy, BAKE); else blob(b, dx, dy, px, py, b.R > 25);
      }
      const c = SP[j * TP + i];
      c[0] = A[0]; c[1] = A[1]; c[2] = A[2];
    }
    return SP;
  }

  // 居民的城在深空里是行星：以城那一格为中心，画一个直径约 3 格的球，光从左上来，背光面暗下去；
  // 一半带条纹（气态巨行星），三分之一带环（环的前半截挡在球前面）。毁掉的城碎成一圈石头。
  // 返回这一格每个美术像素的颜色（没被行星盖住的给 null）；附近没有行星就返回 null。
  const RINGC = [205, 192, 168];
  function planet(x, y) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const tx = x + dx, ty = y + dy, t = TOWN.get(key(tx, ty));
      if (t !== 'town' && t !== 'ruin') continue;
      const r0 = h(tx, ty, sd + 11), col = FCOL[Math.floor(r0 * 4)][0], ring = h(tx, ty, sd + 12) < .35, band = h(tx, ty, sd + 13) < .5;
      return (i, j) => {
        const px = -dx * TP + i - 1.5, py = -dy * TP + j - 1.5, d = Math.hypot(px, py);   // 相对城那一格的中心，单位是美术像素
        if (t === 'ruin') return d < 6.5 && h(x * TP + i, y * TP + j, sd + 14) < .2 ? RUIN_C : null;
        const e = ring ? Math.hypot(px, py * 2.6) : 0;
        if (e > 7 && e < 8.6 && (py > 0 || d >= 5.2)) return RINGC;
        if (d >= 5.2) return null;
        const l = .45 + .55 * cl(.65 - (px + py) / 9), b = band ? .85 + .15 * Math.sin(py * 1.7 + r0 * 9) : 1;
        return col.map(v => v * l * b);
      };
    }
    return null;
  }

  // 走到天体中心附近：说一句，名字从此标在图上
  function discover(k) {
    const b = KEY.get(k);
    if (!b || G.seen['sky' + b.i]) return;
    G.seen['sky' + b.i] = 1;
    bubbleAt = -1e9;
    say(tr(b.c[11], b.c[12]), { bubble: true });
    earn(80 * mult());
  }
  function labels(ox, oy, tp, s, W, H) {
    const g = ctx, o = Math.max(1, Math.round(dpr));
    g.font = `${Math.round(12 * dpr)}px ${getComputedStyle(document.documentElement).getPropertyValue('--px')}`;
    g.textAlign = 'center';
    for (const b of IMG) {
      if (!G.seen['sky' + b.i] || !rev.has(key(Math.floor(b.x), Math.floor(b.y)))) continue;
      const name = tr(b.c[0], b.c[1]), x = Math.round(b.x * tp + ox), y = Math.round((b.y - (b.k === 'st' ? 2.5 : Math.min(b.R * .8, 8) + 1)) * tp + oy);
      if (x < -200 || y < -20 || x > W + 200 || y > H + 20) continue;
      g.fillStyle = '#0a0a14';
      for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o]]) g.fillText(name, x + dx, y + dy);
      g.fillStyle = '#e8e4f4'; g.fillText(name, x, y);
    }
    g.textAlign = 'left';
  }
  // --- 星表：全图页里代替「四维」的那一页，看过的天体一张卡片，没看过的只露出是什么类型 --------------
  const KIND = { sp: ['旋涡星系', 'spiral galaxy'], el: ['椭圆星系', 'elliptical galaxy'], irr: ['不规则星系', 'irregular galaxy'], grp: ['星系群', 'galaxy group'],
    rg: ['环状星系', 'ring galaxy'], df: ['深场', 'deep field'], neb: ['发射星云', 'emission nebula'], cf: ['发射星云', 'emission nebula'], hh: ['暗星云', 'dark nebula'],
    dk: ['暗星云', 'dark nebula'], pn: ['行星状星云', 'planetary nebula'], snr: ['超新星遗迹', 'supernova remnant'], gc: ['球状星团', 'globular cluster'],
    oc: ['疏散星团', 'open cluster'], bh: ['黑洞', 'black hole'], st: ['恒星', 'star'] };
  const arc = d => d >= 1 / 60 ? `${+(d * 60).toFixed(1)}′` : `${+(d * 3600).toFixed(1)}″`;
  const TN = 48;                                                                  // 缩略图 48×48 个美术像素，放大两倍贴上去
  function thumb(b) {
    const im = new ImageData(TN, TN), span = b.k === 'st' ? TN * .25 : b.R * 2.2;   // 恒星按一个美术像素 1/4 格取景，星芒才画得出来
    for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) {
      A[0] = 5; A[1] = 7; A[2] = 16;
      blob(b, ((i + .5) / TN - .5) * span, ((j + .5) / TN - .5) * span, i + b.i * 97, j, false);
      const o = (j * TN + i) * 4;
      im.data[o] = A[0]; im.data[o + 1] = A[1]; im.data[o + 2] = A[2]; im.data[o + 3] = 255;
    }
    const c = document.createElement('canvas');
    c.width = c.height = TN; c.getContext('2d').putImageData(im, 0, 0);
    return c;
  }
  function catalog(c) {
    const font = getComputedStyle(document.documentElement).getPropertyValue('--px'), M = 24, CW = 360, CHt = 124, TOP = 92;
    const cols = Math.max(1, Math.floor((Math.min(innerWidth * .88, 1500) - M * 2) / CW)), rows = Math.ceil(CAT.length / cols);
    const W = cols * CW + M * 2, H = TOP + rows * CHt + M, k = Math.min(2, devicePixelRatio || 1), g = c.getContext('2d');
    c.width = W * k; c.height = H * k; c.style.width = W + 'px';
    g.setTransform(k, 0, 0, k, 0, 0); g.imageSmoothingEnabled = false;
    g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
    const found = CAT.filter((_, i) => G.seen['sky' + i]).length;
    g.fillStyle = INK; g.font = `24px ${font}`; g.fillText(tr(`星表 · 看见了 ${found} / ${CAT.length}`, `Catalogue · ${found} / ${CAT.length} seen`), M, 44);
    g.fillStyle = '#7d7780'; g.font = `12px ${font}`;
    g.fillText(wide ? tr(`广角星图 · 一格 ${arc(SDEG)}`, `Wide star map · ${arc(SDEG)} per tile`) : tr(`望远镜对准${pick[0]} · 一格 ${arc(SDEG)}`, `Telescope on the ${pick[1]} · ${arc(SDEG)} per tile`), M, 66);
    const wrap = (s, w) => {                                                      // 中文按字断，英文按词断
      const out = [];
      let line = '';
      for (const t of LANG === 'en' ? s.split(/(?<= )/) : [...s]) {
        if (line && g.measureText(line + t).width > w) { out.push(line.trimEnd()); line = t.trimStart(); } else line += t;
      }
      return line ? [...out, line] : out;
    };
    CAT.forEach((o, i) => {
      const x = M + (i % cols) * CW, y = TOP + Math.floor(i / cols) * CHt, seen = G.seen['sky' + i], kind = tr(...KIND[o[5]]);
      g.strokeStyle = '#e3ded4'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, CW - 10, CHt - 10);
      g.fillStyle = '#05070f'; g.fillRect(x + 10, y + 10, TN * 2, TN * 2);
      if (seen) {
        const b = IMG.filter(m => m.i === i).sort((p, q) => Math.hypot(p.x, p.y) - Math.hypot(q.x, q.y))[0];
        g.drawImage(thumb(b), x + 10, y + 10, TN * 2, TN * 2);
      } else { g.fillStyle = '#3a3848'; g.font = `24px ${font}`; g.fillText('?', x + 10 + TN - 6, y + 10 + TN + 8); }
      const tx = x + TN * 2 + 22, tw = CW - TN * 2 - 42;
      g.fillStyle = seen ? INK : '#b8b2bb'; g.font = `16px ${font}`; g.fillText(seen ? tr(o[0], o[1]) : tr('？？？', '???'), tx, y + 28);
      g.fillStyle = seen ? BODY : '#b8b2bb'; g.font = `12px ${font}`; g.fillText(kind, tx, y + 46);
      g.fillStyle = seen ? '#5a5560' : '#b8b2bb';
      wrap(seen ? tr(o[11], o[12]) : tr('还没走到它跟前。', 'Not reached yet.'), tw).slice(0, 4).forEach((l, n) => g.fillText(l, tx, y + 66 + n * 15));
    });
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  // --- 动起来的天：都画在屏幕那一层，不进地图块 ---------------------------------------------------
  // 纸是天空的一片截面，天上的东西是在第四个方向上穿过它：
  //   亮星是超球，纸只切到一片。它在 w 上慢慢漂，截面就从一个点长大、再缩回去，偶尔整颗离开纸面。
  //     地图块里只烤了 BAKE 那么亮，剩下的在这里按截面大小叠上去。
  //   流星只看得见穿过纸的那一段：凭空冒出来，边滑边长大再缩小，半路消失，拖尾只到它出现的地方。
  //     垂直穿过纸的那种停在原地亮一下；落在还没展开的白纸上，就烧出一个洞。
  //   卫星的轨道侧对着纸，只剩一个点沿一条线段来回摆，转到纸这一侧时亮，那一侧时暗。
  const css = c => `rgb(${c.map(Math.round)})`, FS = new Map(), STARS = IMG.filter(b => b.k === 'st');
  for (const b of STARS) { b.sp = .2 + h(b.i, 1, sd + 77) * .3; b.ph = h(b.i, 2, sd + 77) * TAU; b.css = css(b.c1); }
  const breathe = (sp, ph, t) => Math.sqrt(Math.max(0, 1 - (1.1 * Math.sin(t * sp + ph)) ** 2));   // 截面半径：超球心离纸面 w，r = √(R² − w²)
  function fieldIn(cx, cy) {                                  // 一块地图里的亮星格子，第一次上屏时找一遍
    const ck = cx + ',' + cy;
    let a = FS.get(ck);
    if (!a) {
      FS.set(ck, a = []);
      for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) {
        const x = cx * CH + i, y = cy * CH + j;
        if (h(x, y, sd + 70) < .009 && fieldStar(x, y, base(x, y))) a.push([x, y, css(STARC[(h(x, y, sd + 71) * 5) | 0]), .15 + h(x, y, sd + 75) * .35, h(x, y, sd + 76) * TAU]);
      }
    }
    return a;
  }
  const METEOR = [255, 214, 150], clock = performance.now();
  let meteor = null, sat = null, nextM = clock + 90000 + Math.random() * 60000, nextS = clock + 120000;   // 刚开局全是白纸，流星一来准烧在远处孤零零一格，先等纸展开一点
  const onSky = (ax, ay) => rev.has(key(Math.floor(ax / TP), Math.floor(ay / TP)));   // 美术像素坐标上是不是已经展开的天
  function spot(ox, oy, s, W, H, want) {                    // 屏幕上随便找一个美术像素，want：要天（true）还是要白纸（false）
    for (let n = 0; n < 40; n++) {
      const ax = Math.floor((Math.random() * W - ox) / s), ay = Math.floor((Math.random() * H - oy) / s);
      if (onSky(ax, ay) === want) return [ax, ay];
    }
    return null;
  }
  function fx(ox, oy, tp, s, W, H) {
    const now = performance.now(), t = now / 1000, g = ctx;
    const px = (ax, ay, c, a) => { if (a <= .01) return; g.globalAlpha = Math.min(1, a); g.fillStyle = c; g.fillRect(ax * s + ox, ay * s + oy, s, s); };
    // 亮星的呼吸
    g.globalCompositeOperation = 'lighter';
    const x0 = Math.floor(-ox / tp) - 1, y0 = Math.floor(-oy / tp) - 1, x1 = Math.ceil((W - ox) / tp), y1 = Math.ceil((H - oy) / tp);
    for (let cy = Math.floor(y0 / CH); cy <= Math.floor(y1 / CH); cy++) for (let cx = Math.floor(x0 / CH); cx <= Math.floor(x1 / CH); cx++) {
      if (!hasChunk.has(cx + ',' + cy)) continue;
      for (const [x, y, c, sp, ph] of fieldIn(cx, cy)) {
        if (x < x0 || x > x1 || y < y0 || y > y1 || !rev.has(key(x, y))) continue;
        const r = breathe(sp, ph, t), ax = x * TP + 1, ay = y * TP + 1;
        px(ax, ay, '#fff', .6 * r);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) px(ax + dx, ay + dy, c, .45 * r);
      }
    }
    for (const b of STARS) {
      const cx = b.x * TP - .5, cy = b.y * TP - .5, Ls = b.L * TP;
      if ((cx + Ls) * s + ox < 0 || (cx - Ls) * s + ox > W || (cy + Ls) * s + oy < 0 || (cy - Ls) * s + oy > H || !onSky(cx, cy)) continue;
      const r = breathe(b.sp, b.ph, t), L = Ls * r;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const d = Math.hypot(dx, dy); if (d <= 1.8 * r) px(cx + dx, cy + dy, '#fff', .9 * r * (1 - d / 2.5)); }
      for (const [c, sn, k] of SPK) for (let tt = 1; tt < L; tt++) {
        const ax = Math.round(cx + c * tt), ay = Math.round(cy + sn * tt);
        if (onSky(ax, ay)) px(ax, ay, b.css, .55 * k * ex(-tt / L * 3));
      }
    }
    g.globalCompositeOperation = 'source-over';

    // 流星
    if (!meteor && now > nextM) {
      const pierce = Math.random() < .35, p = pierce && spot(ox, oy, s, W, H, false) || spot(ox, oy, s, W, H, true);
      if (p) meteor = { p, t0: now, pierce: pierce && !onSky(...p), a: Math.random() * TAU, v: 30 + Math.random() * 30, dur: 800 + Math.random() * 700, R: 1.5 + Math.random() * .8 };
      else nextM = now + 5000;
    }
    if (meteor) {
      const m = meteor, q = (now - m.t0) / m.dur, bump = Math.sqrt(Math.max(0, 1 - (2 * q - 1) ** 2));   // 一个球斜着穿过一张纸：截面从一个点长大再缩回去
      if (q >= 1) { meteor = null; nextM = now + 15000 + Math.random() * 30000; }
      else if (m.pierce) {
        const [ax, ay] = m.p, r = 2.6 * bump;
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
          const d = Math.hypot(dx, dy);
          if (d <= r) px(ax + dx, ay + dy, d < r * .5 ? '#fff6e0' : css(METEOR), 1);
          else if (d <= r + 1.2) px(ax + dx, ay + dy, '#ff7a3a', .8 * bump);   // 纸边烧焦的一圈
        }
        if (q > .5 && !m.burnt) {
          m.burnt = true;
          reveal(Math.floor(ax / TP), Math.floor(ay / TP), Math.random() < .4 ? 2 : 1);
          if (!G.seen.burn) { G.seen.burn = 1; bubbleAt = -1e9; say(tr('一颗流星垂直穿过了纸，在上面烧了个洞。现在那儿能看见后面的天了。', 'A meteor went straight through the paper and burned a hole in it. You can see the sky behind it now.'), { bubble: true }); }
        }
      } else {
        const len = m.v * q * m.dur / 1000, c = Math.cos(m.a), sn = Math.sin(m.a), [sx, sy] = m.p, hx = sx + c * len, hy = sy + sn * len;
        for (let k = 0; k < len; k++) { const ax = Math.round(sx + c * k), ay = Math.round(sy + sn * k); if (onSky(ax, ay)) px(ax, ay, css(METEOR), (.1 + .6 * k / len) * (1 - q * .5)); }
        const r = m.R * bump;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.hypot(dx, dy) <= r && onSky(Math.round(hx) + dx, Math.round(hy) + dy)) px(Math.round(hx) + dx, Math.round(hy) + dy, '#fff6e0', 1);
        if (!G.seen.meteor && q > .5 && onSky(hx, hy)) { G.seen.meteor = 1; say(tr('一颗流星从纸里冒出来，滑了一小段就不见了。它不是划过去的，是从纸面穿过去的，纸只切到了它经过的那一截。', 'A meteor surfaced in the paper, slid a little way and vanished. It didn\'t streak across; it passed through, and the paper only caught the stretch where it crossed.')); }
      }
    }

    // 卫星
    if (!sat && now > nextS) {
      const p = spot(ox, oy, s, W, H, true), a = Math.random() * TAU;
      if (p) sat = { p, t0: now, dx: Math.cos(a), dy: Math.sin(a), A: 24 + Math.random() * 32, per: 8000 + Math.random() * 6000, life: 40000 + Math.random() * 30000 };
      else nextS = now + 10000;
    }
    if (sat) {
      const q = (now - sat.t0) / sat.life;
      if (q >= 1) { sat = null; nextS = now + 40000 + Math.random() * 60000; }
      else {
        const f = Math.min(1, q * 8, (1 - q) * 8), ph = (now - sat.t0) / sat.per * TAU, u = Math.cos(ph) * sat.A, near = Math.sin(ph) > 0;
        const ax = Math.round(sat.p[0] + sat.dx * u), ay = Math.round(sat.p[1] + sat.dy * u);
        if (onSky(ax, ay)) { px(ax, ay, near ? '#e8f0ff' : '#7f8aa8', f); if (near && Math.floor(now / 500) % 2) px(ax + 1, ay, '#ff6a5a', f); }
      }
    }
    g.globalAlpha = 1;

    if (!G.seen.twinkle && (now - clock) > 90000) { G.seen.twinkle = 1; say(tr('那颗星又小下去了。它没在闪，是在第四个方向上离开了纸面一点点。', 'That star has shrunk again. It isn\'t twinkling; it has drifted a little way off the paper, in the fourth direction.')); }
  }
  return { tile, paint, planet, reveal: discover, labels, catalog, fx };
})();
