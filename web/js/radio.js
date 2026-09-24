// 电台：WebAudio 现场合成的九个台，每种地貌一个，默认放这张纸的那个；» 换下一个，「随」每隔几分钟随机换
// 这些文件是按顺序加载的普通脚本，共享同一个全局作用域：顺序见 game.html 底部。

// --- 电台：没有音频文件，全是现场合成，一直放也不会有接缝；每张纸按种子移个调 --------------------
// 共同的规矩：和弦用开放排列，不叠小二度和三全音——叠了听着像「危险区域」；旋律只走音阶里的邻音。
//   地球   FM 4.0 纸面电台   72 BPM lo-fi，Cmaj9 → Am9 → Dm9 → G11，黑胶底噪
//   二向箔 FM 0.2 余温       56 BPM 没有鼓，慢慢起伏的铺底，偶尔几颗星，远处有风
//   沙丘   FM 3.3 香料风     84 BPM D 多利亚，D 和 A 的持续低音，手鼓，乌德琴似的拨弦两小节一句
//   索拉里斯 FM 1.6 海的念头 48 BPM 浪的涨落，很低的持续音，鲸鱼似的滑音
//   晶化   FM 7.2 晶格       92 BPM 八音盒琶音，每两小节一个和弦
//   电路板 FM 8.8 总线       104 BPM 很软的芯片音乐：方波琶音、三角波贝斯
//   水墨   FM 5.1 宫商角徵羽 60 BPM 只用五声，古筝和箫一句一句问答，磬和木鱼
//   蓝图   FM 2.5 草图       96 BPM 极简：一个八音的音型，第二声部每 8 小节错开一拍，慢慢相位
//   切片   FM 6.0 培养液     66 BPM 心跳，温暖的铺底，气泡，每 8 小节一次分裂
(() => {
  const KEY = (G.seed % 7) - 3;
  const TRACKS = {
    earth: { name: tr('FM 4.0 · 纸面电台', 'FM 4.0 · Paper Radio'), bpm: 72, play, vinyl: 1 },
    foil: { name: tr('FM 0.2 · 余温', 'FM 0.2 · Afterglow'), bpm: 56, play: playFoil },
    dune: { name: tr('FM 3.3 · 香料风', 'FM 3.3 · Spice Wind'), bpm: 84, play: playDune },
    solaris: { name: tr('FM 1.6 · 海的念头', 'FM 1.6 · Thoughts of the Ocean'), bpm: 48, play: playSea },
    crystal: { name: tr('FM 7.2 · 晶格', 'FM 7.2 · Lattice'), bpm: 92, play: playCrystal },
    pcb: { name: tr('FM 8.8 · 总线', 'FM 8.8 · Bus Line'), bpm: 104, play: playPcb },
    ink: { name: tr('FM 5.1 · 宫商角徵羽', 'FM 5.1 · Five Tones'), bpm: 60, play: playPenta, vinyl: 1 },
    blueprint: { name: tr('FM 2.5 · 草图', 'FM 2.5 · Draft'), bpm: 96, play: playDraft },
    slide: { name: tr('FM 6.0 · 培养液', 'FM 6.0 · Culture Medium'), bpm: 66, play: playSlide },
  };
  const LIST = Object.values(TRACKS), HOME = LIST.indexOf(TRACKS[G.theme] || TRACKS.earth);
  const saved = k => { try { return localStorage.getItem(k); } catch { return null; } };
  let shuffle = saved('clawd-shuffle') === '1';
  const other = () => (st + 1 + Math.floor(Math.random() * (LIST.length - 1))) % LIST.length;
  let st = HOME;
  if (shuffle) st = other();
  let S16 = 60 / LIST[st].bpm / 4, B;                        // B：当前这个台的总线，换台时整条淡出
  const hz = m => 440 * 2 ** ((m + KEY - 69) / 12);
  const R = () => Math.random(), pickOf = a => a[Math.floor(R() * a.length)];
  const walk = (k, lo, hi, steps = [-2, -1, -1, 1, 1, 2]) => Math.max(lo, Math.min(hi, k + pickOf(steps)));
  let ac, out, dry, wet, echo, noise, vg, timer, step = 0, next = 0;

  function build() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    out = ac.createGain();
    const warm = ac.createBiquadFilter(), comp = ac.createDynamicsCompressor();
    warm.type = 'lowpass'; warm.frequency.value = 4200;       // 收音机那种暖
    dry = ac.createGain(); dry.connect(warm);
    wet = ac.createConvolver(); wet.connect(warm);
    warm.connect(comp).connect(out).connect(ac.destination);
    // 混响：衰减的噪声当冲激响应
    const len = ac.sampleRate * 2.8, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
    wet.buffer = ir;
    // 附点八分的回声，给铃声、星星、气泡用
    echo = ac.createDelay(2); echo.delayTime.value = S16 * 3;
    const fb = ac.createGain(), tn = ac.createBiquadFilter();
    fb.gain.value = .38; tn.type = 'lowpass'; tn.frequency.value = 2200;
    echo.connect(tn).connect(fb).connect(echo); tn.connect(dry);
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const n = noise.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
    // 黑胶底噪：一直循环的轻微沙沙声 + 偶尔的咔哒；只有地球和水墨两个台开
    const vinyl = ac.createBufferSource(), vf = ac.createBiquadFilter();
    vg = ac.createGain();
    const crackle = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate), cd = crackle.getChannelData(0);
    // 偶尔一声轻轻的「啵」：太密会变成盖革计数器
    for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * .25 + (Math.random() < .00003 ? (Math.random() * 2 - 1) * 1.2 : 0);
    vinyl.buffer = crackle; vinyl.loop = true;
    vf.type = 'lowpass'; vf.frequency.value = 2500; vg.gain.value = LIST[st].vinyl ? .014 : 0;
    vinyl.connect(vf).connect(vg).connect(dry); vinyl.start();
    setVol();
    ac.onstatechange = ui;
    B = bus();
    // ponytail: 后台标签页的定时器会被降到每秒一次，所以往前排 1.5 秒的音符
    timer = setInterval(() => { while (next < ac.currentTime + 1.5) { LIST[st].play(step++, next); next += S16; } }, 100);
    next = ac.currentTime + .1;
  }

  // ---- 共用的几样乐器 ----
  function env(g, t, peak, a, d, sus, rel) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sus, .0001), t + a + d);
    g.gain.exponentialRampToValueAtTime(.0001, t + a + d + rel);
  }
  const send = (g, amt, dest = B.wet) => { if (amt) { const s = ac.createGain(); s.gain.value = amt; g.connect(s).connect(dest); } };
  function tone(type, f, t, peak, a, d, sus, rel, dest, amt = .25) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f;
    env(g, t, peak, a, d, sus, rel);
    o.connect(g).connect(dest);
    send(g, amt);
    o.start(t); o.stop(t + a + d + rel + .1);
  }
  function hiss(t, type, f, peak, dur) {
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; fl.type = type; fl.frequency.value = f;
    env(g, t, peak, .003, dur, .0001, .02);
    s.connect(fl).connect(g).connect(B.dry);
    s.start(t, Math.random()); s.stop(t + dur + .1);
  }
  function drum(t, f0, f1, peak, dur) {                     // 音高往下掉的一声：底鼓、手鼓、心跳都是它
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * .6);
    env(g, t, peak, .004, dur, .0001, .05);
    o.connect(g).connect(B.dry); o.start(t); o.stop(t + dur + .2);
  }
  const kick = t => drum(t, 110, 42, .42, .22);
  function pad(ms, t, dur, peak, cut, type = 'sawtooth') {   // 慢起慢收的铺底：每个音两只略微跑调的振荡器，过一个慢慢开合的低通
    const f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cut * .6, t); f.frequency.linearRampToValueAtTime(cut, t + dur * .5); f.frequency.linearRampToValueAtTime(cut * .6, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + dur * .35);
    g.gain.setValueAtTime(peak, t + dur * .65); g.gain.linearRampToValueAtTime(0, t + dur);
    f.connect(g).connect(B.dry); send(g, .5);
    for (const m of ms) for (const d of [-6, 6]) {
      const o = ac.createOscillator();
      o.type = type; o.frequency.value = hz(m); o.detune.value = d;
      o.connect(f); o.start(t); o.stop(t + dur + .1);
    }
  }
  function swell(t, dur, f, peak, type = 'lowpass') {       // 风、浪：滤过的噪声慢慢涨起来再退下去
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; s.loop = true; fl.type = type; fl.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + dur * .45); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(fl).connect(g).connect(B.dry);
    s.start(t, Math.random()); s.stop(t + dur + .1);
  }
  function bell(m, t, peak) {                               // 玻璃似的铃：基音加一个高两个八度的泛音，进回声
    tone('sine', hz(m), t, peak, .003, 1.4, .0001, .6, B.echo, .5);
    tone('sine', hz(m) * 4, t, peak * .18, .002, .3, .0001, .2, B.echo, .3);
  }
  function glide(a, b, t, dur, peak) {                      // 从一个和弦音慢慢滑到另一个
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(hz(a), t); o.frequency.setValueAtTime(hz(a), t + dur * .3); o.frequency.exponentialRampToValueAtTime(hz(b), t + dur * .7);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + dur * .3); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(B.echo); send(g, .6);
    o.start(t); o.stop(t + dur + .1);
  }
  function blip(m, t, peak) {                               // 气泡：从下面滑上来的一小声
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(hz(m) * .8, t); o.frequency.exponentialRampToValueAtTime(hz(m), t + .05);
    env(g, t, peak, .004, .18, .0001, .1);
    o.connect(g).connect(B.echo); send(g, .3);
    o.start(t); o.stop(t + .4);
  }
  function oud(m, t, peak) {                                // 拨弦：锯齿波，起音略高再落回，滤波很快收拢
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(hz(m) * 1.01, t); o.frequency.exponentialRampToValueAtTime(hz(m), t + .05);
    f.type = 'lowpass'; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(500, t + .4);
    env(g, t, peak, .004, .5, .0001, .2);
    o.connect(f).connect(g).connect(B.dry); send(g, .3);
    o.start(t); o.stop(t + .8);
  }
  function chip(m, t, dur, peak, type = 'square', amt = .12) {   // 芯片音：方波过低通，软一点
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = type; o.frequency.value = hz(m);
    f.type = 'lowpass'; f.frequency.value = 1800;
    env(g, t, peak, .003, dur * .35, peak * .45, dur * .65);   // 留一点延音，太短只剩「嗒」
    o.connect(f).connect(g).connect(B.dry); send(g, amt);
    o.start(t); o.stop(t + dur + .1);
  }
  function keys(m, t, peak) {                               // 很干净的一下，像马林巴
    tone('triangle', hz(m), t, peak, .003, .35, .0001, .25, B.dry, .2);
    tone('sine', hz(m) * 2, t, peak * .3, .002, .15, .0001, .1, B.dry, 0);
  }

  // ---- 地球 · FM 4.0 纸面电台 ----
  const CHORDS = [
    [36, [52, 55, 59, 62]], [33, [55, 60, 64, 71]], [38, [53, 57, 60, 64]], [31, [50, 57, 60, 65]],
  ];
  const MEL = [72, 74, 76, 79, 81, 84, 86];                  // 五声音阶，够安静
  let mi = 3;
  function play(i, t) {
    const s = i % 16, bar = Math.floor(i / 16), [root, voice] = CHORDS[Math.floor(i / 32) % 4];
    const swing = s % 4 === 2 ? S16 * .35 : 0;
    if (i % 32 === 0) voice.forEach((m, k) => {                 // 慢慢扫一下和弦
      tone('triangle', hz(m), t + k * .035, .045, .04, .8, .02, 3.2, B.dry, .4);
      tone('sine', hz(m + 12) * 1.002, t + k * .035, .012, .02, .5, .004, 2, B.dry, .4);
    });
    if (i % 32 === 22) voice.forEach((m, k) => tone('triangle', hz(m), t + swing + k * .02, .025, .02, .3, .008, .8, B.dry, .4));
    if (s === 0) tone('sine', hz(root), t, .2, .01, .5, .08, .8, B.dry, 0);
    if (s === 10) tone('sine', hz(root + 7), t + swing, .12, .01, .3, .04, .4, B.dry, 0);
    if (s === 0 || s === 10 || (s === 7 && Math.random() < .3)) kick(t + (s === 10 ? swing : 0));
    if (s === 4 || s === 12) hiss(t, 'bandpass', 1800, .06, .16);
    if (s % 2 === 0) hiss(t + swing, 'highpass', 7000, s % 4 ? .012 : .02, .04);
    // 旋律：每 8 小节里后 4 小节更爱说话
    if (s % 2 === 0 && Math.random() < (bar % 8 >= 4 ? .32 : .12)) {
      mi = walk(mi, 0, MEL.length - 1);
      const f = hz(MEL[mi]);
      tone('sine', f, t + swing, .05, .005, .9, .002, .6, B.echo, .35);
      tone('sine', f * 3, t + swing, .008, .003, .25, .0005, .2, B.echo, 0);
    }
  }

  // ---- 二向箔 · FM 0.2 余温：Am(add9) → F → Csus2 → G(add9)，各两小节 ----
  const FOIL = [[45, [57, 64, 67, 71]], [41, [57, 60, 64, 67]], [48, [55, 60, 62, 67]], [43, [55, 59, 62, 69]]];
  const STARS = [69, 72, 74, 76, 79, 81, 84, 86];
  function playFoil(i, t) {
    const [root, v] = FOIL[Math.floor(i / 32) % 4];
    if (i % 32 === 0) { pad(v, t, S16 * 36, .018, 1100); tone('sine', hz(root - 12), t, .08, 2, 3, .05, 4, B.dry, .2); }
    if (i % 128 === 64) swell(t, S16 * 24, 700, .02, 'bandpass');   // 远处的风
    if (R() < .05) bell(pickOf(STARS), t, .022);
  }

  // ---- 沙丘 · FM 3.3 香料风：D 多利亚 ----
  const DORIAN = [62, 64, 65, 67, 69, 71, 72, 74, 76];       // 旋律只走邻音，F 和 B 不会挨着
  let du = 4;
  function playDune(i, t) {
    const s = i % 16, bar = Math.floor(i / 16);
    if (i % 64 === 0) { tone('triangle', hz(38), t, .08, 1.5, 4, .055, 6, B.dry, .3); tone('sine', hz(45), t + .3, .055, 1.5, 4, .04, 6, B.dry, .3); }
    if (s === 0 || s === 6) drum(t, 110, 60, s ? .2 : .28, .25);                                       // 咚
    if (s === 4 || s === 12 || (s === 10 && R() < .6) || (s === 14 && R() < .3)) hiss(t, 'bandpass', 2600, .035, .05);   // 嗒
    if (bar % 8 === 0 && s === 0) swell(t, S16 * 64, 500, .02, 'bandpass');                            // 沙面上的风
    if (bar % 4 < 2 && s % 2 === 0 && R() < .55) { du = walk(du, 0, DORIAN.length - 1); oud(DORIAN[du], t, .085); }   // 两小节一句
    if (bar % 4 === 2 && s === 0) { du = R() < .5 ? 0 : 4; oud(DORIAN[du], t, .1); oud(DORIAN[du] - 12, t, .055); } // 句尾落在 D 或 A
  }

  // ---- 索拉里斯 · FM 1.6 海的念头：Emaj9 → C#m9 → Amaj9 → Bsus，各两小节 ----
  const SEA = [[40, [56, 59, 63, 66]], [37, [52, 56, 59, 63]], [45, [56, 61, 64, 71]], [47, [54, 59, 64, 68]]];
  function playSea(i, t) {
    const s = i % 16, bar = Math.floor(i / 16), [root, v] = SEA[Math.floor(i / 32) % 4];
    if (i % 32 === 0) { pad(v, t, S16 * 36, .014, 800, 'triangle'); tone('sine', hz(root - 12), t, .09, 3, 4, .05, 5, B.dry, .2); }
    if (s === 0 && bar % 2 === 0) swell(t, S16 * 28, 420, .035);                   // 浪：两小节一次涨落
    if (s === 8 && R() < .45) glide(pickOf(v) + 12, pickOf(v) + 12, t, S16 * 10, .03);
    if (R() < .015) bell(pickOf(v) + 24, t, .012);
  }

  // ---- 晶化 · FM 7.2 晶格：Cmaj9 → Am9 → Fmaj9 → G6/9，八音盒琶音 ----
  const LAT = [[48, [64, 67, 71, 74]], [45, [60, 64, 67, 71]], [41, [57, 60, 64, 67]], [43, [59, 62, 64, 69]]];
  const ARP = [0, 1, 2, 3, 2, 1, 3, 2, 0, 2, 1, 3, 0, 3, 2, 1];
  function playCrystal(i, t) {
    const s = i % 16, bar = Math.floor(i / 16), [root, v] = LAT[Math.floor(i / 32) % 4];
    if (s === 0) tone('sine', hz(root - 12), t, .1, .01, .6, .05, 1, B.dry, .2);
    if (s === 8) tone('sine', hz(root - 5), t, .06, .01, .4, .03, .6, B.dry, .2);
    if (R() < (bar % 8 >= 4 ? .8 : .55)) bell(v[ARP[s]] + (s >= 8 && bar % 2 ? 12 : 0), t, .035);
    if (i % 32 === 0) v.forEach((m, k) => bell(m + 24, t + k * .05, .008));
  }

  // ---- 电路板 · FM 8.8 总线：Am → F → C → G，方波琶音 ----
  const BUS = [[45, [57, 60, 64]], [41, [57, 60, 65]], [48, [55, 60, 64]], [43, [55, 59, 62]]];
  const LEAD = [69, 72, 74, 76, 79, 81];                    // A 小调五声
  let pl = 2;
  function playPcb(i, t) {
    const s = i % 16, bar = Math.floor(i / 16), [root, v] = BUS[Math.floor(i / 32) % 4];
    chip([v[0], v[1], v[2], v[0] + 12][s % 4] + 12, t, S16 * .8, .04);
    if (s % 4 === 0) chip(root - 12 + (s % 8 ? 12 : 0), t, S16 * 1.6, .1, 'triangle', 0);
    if (s === 0 || s === 8) drum(t, 150, 50, .26, .18);
    if (s === 4 || s === 12) hiss(t, 'bandpass', 1500, .045, .08);
    if (s % 4 === 2) hiss(t, 'highpass', 8000, .014, .03);
    if (bar % 8 >= 4 && s % 2 === 0 && R() < .5) { pl = walk(pl, 0, LEAD.length - 1); chip(LEAD[pl], t, S16 * 1.8, .04, 'square', .3); }
  }

  // ---- 水墨 · FM 5.1 宫商角徵羽 ----
  const GONG = 62, PENTA = [0, 2, 4, 7, 9];                  // 以 D 为宫：宫 商 角 徵 羽
  const pn = k => GONG + PENTA[((k % 5) + 5) % 5] + 12 * Math.floor(k / 5);   // 第 k 级，5 是高八度的宫
  let pk = 5;
  function pluck(m, t, peak = .085, slide = false) {         // 古筝：拨一下，起音略高再落回；或从下面滑上来
    const f = hz(m), o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), g2 = ac.createGain();
    o.type = 'triangle'; o2.type = 'sine';
    if (slide) { o.frequency.setValueAtTime(f * .89, t); o.frequency.exponentialRampToValueAtTime(f, t + .12); }
    else { o.frequency.setValueAtTime(f * 1.012, t); o.frequency.exponentialRampToValueAtTime(f, t + .04); }
    o2.frequency.value = f * 2;
    env(g, t, peak, .004, 1.6, .0001, .2);
    env(g2, t, peak * .25, .003, .5, .0001, .1);
    o.connect(g).connect(B.dry); o2.connect(g2).connect(B.dry);
    send(g, .45);
    o.start(t); o2.start(t); o.stop(t + 2); o2.stop(t + 1);
  }
  function xiao(m, t, dur) {                                 // 箫：慢慢吹起来，后半截揉一点，带气声
    const f = hz(m), o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    o.type = 'sine'; o.frequency.value = f;
    lfo.frequency.value = 5;
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * .006, t + dur * .5);
    lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.07, t + .25);
    g.gain.setValueAtTime(.07, t + dur - .3); g.gain.linearRampToValueAtTime(0, t + dur + .2);
    o.connect(g).connect(B.dry); send(g, .6);
    o.start(t); lfo.start(t); o.stop(t + dur + .3); lfo.stop(t + dur + .3);
    const n = ac.createBufferSource(), nf = ac.createBiquadFilter(), ng = ac.createGain();
    n.buffer = noise; nf.type = 'bandpass'; nf.frequency.value = f * 2; nf.Q.value = 2;
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(.012, t + .1);
    ng.gain.linearRampToValueAtTime(.004, t + .5); ng.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(nf).connect(ng).connect(B.dry); n.start(t, Math.random()); n.stop(t + dur + .1);
  }
  const muyu = (t, a) => { tone('sine', 720, t, a, .002, .07, .0001, .02, B.dry, .1); hiss(t, 'bandpass', 1100, a * .5, .03); };
  const qing = (m, t) => { for (const [r, a] of [[1, .035], [2.76, .014], [5.4, .006]]) tone('sine', hz(m) * r, t, a, .005, 3.5, .0001, .5, B.dry, .5); };
  function playPenta(i, t) {
    const s = i % 16, bar = Math.floor(i / 16), pb = bar % 4, zheng = Math.floor(bar / 4) % 2 === 0;   // 四小节一句，筝一句箫一句
    if (s === 0) {                                          // 低音宫 + 徵，像琴的空弦一直在响
      tone('sine', hz(GONG - 24), t, .07, 1, 3, .03, 3, B.dry, .3);
      tone('sine', hz(GONG - 17), t + .5, .04, 1, 3, .02, 3, B.dry, .3);
    }
    if (pb === 0 && s === 0) qing(GONG + 12, t);
    if (s === 0 || (s === 8 && Math.random() < .5)) muyu(t, s ? .03 : .045);
    if (pb === 0 && s === 0 && zheng && Math.random() < .4)  // 刮奏
      for (let k = 0; k < 7; k++) pluck(pn(k + 2), t + k * .06, .035);
    if (pb === 3) {                                          // 句尾：落在宫或徵上，拖长
      if (s === 0) { pk = pk >= 7 ? 8 : 5; zheng ? pluck(pn(pk), t, .1) : xiao(pn(pk - 5), t, 3.5); }
      return;
    }
    if (zheng) {
      if (s % 2 === 0 && Math.random() < (s % 4 === 0 ? .7 : .3)) { pk = walk(pk, 2, 10); pluck(pn(pk), t, .085, Math.random() < .25); }
    } else if (s % 8 === 0 && Math.random() < .8) {
      pk = walk(pk, 2, 10, [-2, -1, 1, 2]);
      xiao(pn(pk - 5), t, S16 * (Math.random() < .5 ? 8 : 12));
    }
  }

  // ---- 蓝图 · FM 2.5 草图：D(add9) → Bm7 → G(add9) → A(add9)，各四小节 ----
  const DRAFT = [[50, [62, 64, 66, 69]], [47, [62, 66, 69, 71]], [43, [62, 67, 69, 71]], [45, [61, 64, 69, 71]]];
  const CELL = [0, 2, 1, 3, 2, 0, 3, 1];
  function playDraft(i, t) {
    const s = i % 16, bar = Math.floor(i / 16), [root, v] = DRAFT[Math.floor(i / 64) % 4];
    if (s % 2 === 0) {
      const k = i / 2, shift = Math.floor(bar / 8) % 8;
      keys(v[CELL[k % 8]], t, .05);
      if (bar % 16 >= 4) keys(v[CELL[(k + shift) % 8]] + 12, t + .004, .022);   // 第二声部：每 8 小节错开一拍，慢慢相位
    }
    if (i % 32 === 0) tone('sine', hz(root - 12), t, .08, .5, 2, .04, 3, B.dry, .2);
    if (s % 4 === 0) hiss(t, 'highpass', 6000, .006, .02);                   // 铅笔在纸上点一下
  }

  // ---- 切片 · FM 6.0 培养液：Fmaj7 → Em7 → Dm9 → Cmaj7，往下走 ----
  const CELLS = [[41, [57, 60, 64, 69]], [40, [55, 59, 62, 67]], [38, [53, 57, 60, 64]], [36, [55, 59, 64, 67]]];
  const BUB = [65, 67, 69, 72, 74, 77, 79];                  // F 大调五声
  function playSlide(i, t) {
    const s = i % 16, bar = Math.floor(i / 16), [root, v] = CELLS[Math.floor(i / 32) % 4];
    if (i % 32 === 0) { pad(v, t, S16 * 36, .016, 650, 'triangle'); tone('sine', hz(root - 12), t, .07, 1.5, 3, .04, 4, B.dry, .2); }
    if (s === 0) drum(t, 75, 45, .2, .2);                    // 心跳：咚——
    if (s === 3) drum(t, 70, 45, .13, .18);                  //       咚
    if (R() < .08) blip(pickOf(BUB), t, .03);
    if (bar % 8 === 7 && s === 8) { const m = pickOf(BUB); blip(m, t, .035); blip(m + 7, t + S16 * 2, .025); blip(m - 5, t + S16 * 2, .025); }   // 一个分成两个
  }

  // 每个台自己一套总线，换台时旧的整条淡出，已经排好的音符也跟着消失
  function bus() {
    const b = { dry: ac.createGain(), wet: ac.createGain(), echo: ac.createGain() };
    b.dry.connect(dry); b.wet.connect(wet); b.echo.connect(echo);
    return b;
  }
  function tuneTo(k) {
    st = k;
    S16 = 60 / LIST[st].bpm / 4;
    if (ac) {
      const old = B, now = ac.currentTime;
      for (const g of Object.values(old)) { g.gain.setValueAtTime(1, now); g.gain.linearRampToValueAtTime(0, now + .6); }
      setTimeout(() => Object.values(old).forEach(g => g.disconnect()), 2500);
      B = bus();
      echo.delayTime.setValueAtTime(S16 * 3, now);
      vg.gain.setTargetAtTime(LIST[st].vinyl ? .014 : 0, now, .3);
      step = 0; next = now + .7;
    }
    ui();
  }
  setInterval(() => { if (shuffle && on()) tuneTo(other()); }, 6 * 60 * 1000);   // 随机：每 6 分钟换一个台

  const on = () => ac?.state === 'running';
  function setVol() { if (out) out.gain.value = ($('vol').value / 100) ** 2 * 1.6; }   // 满音量峰值约 0.9
  function ui() {
    $('play').textContent = on() ? '❚❚' : '▶';
    $('play').setAttribute('aria-label', on() ? tr('暂停电台', 'Pause the radio') : tr('播放电台', 'Play the radio'));
    $('shuf').setAttribute('aria-pressed', String(shuffle));
    $('eq').classList.toggle('live', on());
    const waiting = pref() === 'on' && !on();
    $('tune').classList.toggle('hint', waiting);
    $('tune').textContent = waiting ? tr('▶ 点一下页面开电台', '▶ Click the page to start the radio')
      : `${LIST[st].name}${st === HOME ? tr(' · 这张纸的', ' · this sheet') : ''}${KEY ? ` · ${KEY > 0 ? '+' : ''}${KEY}` : ''}`;
  }
  const pref = (v) => { try { if (v) localStorage.setItem('clawd-radio', v); return localStorage.getItem('clawd-radio') || 'on'; } catch { return 'on'; } };

  $('play').onclick = e => {
    e.stopPropagation();
    if (on()) { ac.suspend(); pref('off'); }
    else { if (!ac) build(); ac.resume(); pref('on'); }
    ui();
  };
  $('next').onclick = e => { e.stopPropagation(); tuneTo((st + 1) % LIST.length); };
  $('shuf').onclick = e => {
    e.stopPropagation();
    shuffle = !shuffle;
    try { localStorage.setItem('clawd-shuffle', shuffle ? '1' : '0'); } catch { /* 无痕模式 */ }
    if (shuffle) tuneTo(other()); else ui();
  };
  $('vol').value = saved('clawd-vol') ?? 60;
  $('vol').oninput = () => { setVol(); try { localStorage.setItem('clawd-vol', $('vol').value); } catch { /* 无痕模式 */ } };
  // 浏览器不让没点过的页面出声：默认开着，等第一次点击/按键再真正响
  if (pref() === 'on') {
    const go = e => {
      if (e.target.closest?.('#radio') || pref() !== 'on' || on()) return;   // 电台自己的按钮自己管
      if (!ac) build();
      ac.resume();
    };
    addEventListener('pointerdown', go);
    addEventListener('keydown', go);
  }
  ui();
})();
