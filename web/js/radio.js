// 电台：WebAudio 现场合成的两个台
// 这些文件是按顺序加载的普通脚本，共享同一个全局作用域：顺序见 game.html 底部。

// --- 电台：WebAudio 现场合成，没有音频文件；两个台，每张纸按种子移个调 -----------------
// FM 4.0 纸面电台：72 BPM 的 lo-fi，Cmaj9 → Am9 → Dm9 → G11 各两小节。
//   和弦都用开放排列，不叠小二度和三全音——叠了听着像「危险区域」。
// FM 5.1 宫商角徵羽：60 BPM，只用五声，不出现半音。古筝和箫一句一句问答，
//   底下是宫和徵的持续低音，句首一声磬，木鱼轻轻点拍，句尾落在宫或徵上。
(() => {
  const KEY = (G.seed % 7) - 3;
  const STATIONS = [{ name: 'FM 4.0 · 纸面电台', bpm: 72 }, { name: 'FM 5.1 · 宫商角徵羽', bpm: 60 }];
  let st = (() => { try { return +localStorage.getItem('clawd-station') % STATIONS.length || 0; } catch { return 0; } })();
  let S16 = 60 / STATIONS[st].bpm / 4, B;                   // B：当前这个台的总线，换台时整条淡出
  const CHORDS = [
    [36, [52, 55, 59, 62]], [33, [55, 60, 64, 71]], [38, [53, 57, 60, 64]], [31, [50, 57, 60, 65]],
  ];
  const MEL = [72, 74, 76, 79, 81, 84, 86];                  // 五声音阶，够安静
  const hz = m => 440 * 2 ** ((m + KEY - 69) / 12);
  let ac, out, dry, wet, echo, noise, timer, step = 0, next = 0, mi = 3, pk = 5;

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
    // 附点八分的回声，只给铃声用
    echo = ac.createDelay(2); echo.delayTime.value = S16 * 3;
    const fb = ac.createGain(), tone = ac.createBiquadFilter();
    fb.gain.value = .38; tone.type = 'lowpass'; tone.frequency.value = 2200;
    echo.connect(tone).connect(fb).connect(echo); tone.connect(dry);
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const n = noise.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
    // 黑胶底噪：一直循环的轻微沙沙声 + 偶尔的咔哒
    const vinyl = ac.createBufferSource(), vf = ac.createBiquadFilter(), vg = ac.createGain();
    const crackle = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate), cd = crackle.getChannelData(0);
    // 偶尔一声轻轻的「啵」：太密会变成盖革计数器
    for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * .25 + (Math.random() < .00003 ? (Math.random() * 2 - 1) * 1.2 : 0);
    vinyl.buffer = crackle; vinyl.loop = true;
    vf.type = 'lowpass'; vf.frequency.value = 2500; vg.gain.value = .014;
    vinyl.connect(vf).connect(vg).connect(dry); vinyl.start();
    setVol();
    ac.onstatechange = ui;
    B = bus();
    // ponytail: 后台标签页的定时器会被降到每秒一次，所以往前排 1.5 秒的音符
    timer = setInterval(() => { while (next < ac.currentTime + 1.5) { (st ? playPenta : play)(step++, next); next += S16; } }, 100);
    next = ac.currentTime + .1;
  }

  function env(g, t, peak, a, d, sus, rel) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sus, .0001), t + a + d);
    g.gain.exponentialRampToValueAtTime(.0001, t + a + d + rel);
  }
  function tone(type, f, t, peak, a, d, sus, rel, dest, send = .25) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f;
    env(g, t, peak, a, d, sus, rel);
    o.connect(g).connect(dest);
    if (send) { const s = ac.createGain(); s.gain.value = send; g.connect(s).connect(B.wet); }
    o.start(t); o.stop(t + a + d + rel + .1);
  }
  function hiss(t, type, f, peak, dur) {
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; fl.type = type; fl.frequency.value = f;
    env(g, t, peak, .003, dur, .0001, .02);
    s.connect(fl).connect(g).connect(B.dry);
    s.start(t, Math.random()); s.stop(t + dur + .1);
  }
  function kick(t) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + .12);
    env(g, t, .42, .004, .22, .0001, .05);
    o.connect(g).connect(B.dry); o.start(t); o.stop(t + .4);
  }

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
      mi = Math.max(0, Math.min(MEL.length - 1, mi + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
      const f = hz(MEL[mi]);
      tone('sine', f, t + swing, .05, .005, .9, .002, .6, B.echo, .35);
      tone('sine', f * 3, t + swing, .008, .003, .25, .0005, .2, B.echo, 0);
    }
  }

  // 每个台自己一套总线，换台时旧的整条淡出，已经排好的音符也跟着消失
  function bus() {
    const b = { dry: ac.createGain(), wet: ac.createGain(), echo: ac.createGain() };
    b.dry.connect(dry); b.wet.connect(wet); b.echo.connect(echo);
    return b;
  }

  // ---- FM 5.1 宫商角徵羽 ----
  const GONG = 62, PENTA = [0, 2, 4, 7, 9];                  // 以 D 为宫：宫 商 角 徵 羽
  const pn = k => GONG + PENTA[((k % 5) + 5) % 5] + 12 * Math.floor(k / 5);   // 第 k 级，5 是高八度的宫
  function pluck(m, t, peak = .085, slide = false) {         // 古筝：拨一下，起音略高再落回；或从下面滑上来
    const f = hz(m), o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), g2 = ac.createGain();
    o.type = 'triangle'; o2.type = 'sine';
    if (slide) { o.frequency.setValueAtTime(f * .89, t); o.frequency.exponentialRampToValueAtTime(f, t + .12); }
    else { o.frequency.setValueAtTime(f * 1.012, t); o.frequency.exponentialRampToValueAtTime(f, t + .04); }
    o2.frequency.value = f * 2;
    env(g, t, peak, .004, 1.6, .0001, .2);
    env(g2, t, peak * .25, .003, .5, .0001, .1);
    o.connect(g).connect(B.dry); o2.connect(g2).connect(B.dry);
    const sd = ac.createGain(); sd.gain.value = .45; g.connect(sd).connect(B.wet);
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
    o.connect(g).connect(B.dry);
    const sd = ac.createGain(); sd.gain.value = .6; g.connect(sd).connect(B.wet);
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
      if (s % 2 === 0 && Math.random() < (s % 4 === 0 ? .7 : .3)) {
        pk = Math.max(2, Math.min(10, pk + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
        pluck(pn(pk), t, .085, Math.random() < .25);
      }
    } else if (s % 8 === 0 && Math.random() < .8) {
      pk = Math.max(2, Math.min(10, pk + [-2, -1, 1, 2][Math.floor(Math.random() * 4)]));
      xiao(pn(pk - 5), t, S16 * (Math.random() < .5 ? 8 : 12));
    }
  }

  function switchStation() {
    st = (st + 1) % STATIONS.length;
    try { localStorage.setItem('clawd-station', st); } catch { /* 无痕模式 */ }
    S16 = 60 / STATIONS[st].bpm / 4;
    if (ac) {
      const old = B, now = ac.currentTime;
      for (const g of Object.values(old)) { g.gain.setValueAtTime(1, now); g.gain.linearRampToValueAtTime(0, now + .6); }
      setTimeout(() => Object.values(old).forEach(g => g.disconnect()), 2500);
      B = bus();
      echo.delayTime.setValueAtTime(S16 * 3, now);
      step = 0; next = now + .7;
    }
    ui();
  }

  const on = () => ac?.state === 'running';
  function setVol() { if (out) out.gain.value = ($('vol').value / 100) ** 2 * 1.6; }   // 满音量峰值约 0.9
  function ui() {
    $('play').textContent = on() ? '❚❚' : '▶';
    $('play').setAttribute('aria-label', on() ? '暂停电台' : '播放电台');
    $('eq').classList.toggle('live', on());
    const waiting = pref() === 'on' && !on();
    $('tune').classList.toggle('hint', waiting);
    $('tune').textContent = waiting ? '▶ 点一下页面开电台' : `${STATIONS[st].name}${KEY ? ` · ${KEY > 0 ? '+' : ''}${KEY}` : ''}`;
  }
  const pref = (v) => { try { if (v) localStorage.setItem('clawd-radio', v); return localStorage.getItem('clawd-radio') || 'on'; } catch { return 'on'; } };

  $('play').onclick = e => {
    e.stopPropagation();
    if (on()) { ac.suspend(); pref('off'); }
    else { if (!ac) build(); ac.resume(); pref('on'); }
    ui();
  };
  $('next').onclick = e => { e.stopPropagation(); switchStation(); };
  $('vol').value = (() => { try { return localStorage.getItem('clawd-vol') ?? 60; } catch { return 60; } })();
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
