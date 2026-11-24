/* EMBER TITHE — core: rng, data tables, odds, audio, utils */
'use strict';
window.ET = window.ET || {};
(function (ET) {
  // ---------- utils ----------
  const U = ET.U = {};
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const UNITS = [[1e48, '극'], [1e44, '재'], [1e40, '정'], [1e36, '간'], [1e32, '구'], [1e28, '양'], [1e24, '자'], [1e20, '해'], [1e16, '경'], [1e12, '조'], [1e8, '억']];
  U.fmt = n => {
    if (!isFinite(n)) return '∞'; n = Math.round(n); const a = Math.abs(n);
    if (a >= 1e52) return n.toExponential(2).replace('e+', 'e');
    for (const [v, u] of UNITS) if (a >= v) { const x = n / v; return (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)) + u; }
    if (a >= 1e6) return Math.round(n / 1e4).toLocaleString('ko-KR') + '만';
    if (a >= 1e5) return (n / 1e4).toFixed(1) + '만';
    return n.toLocaleString('ko-KR');
  };
  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  U.$ = s => document.querySelector(s);
  U.$$ = s => Array.from(document.querySelectorAll(s));
  U.store = {
    get(k, d) { try { const v = localStorage.getItem('et.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('et.' + k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem('et.' + k); } catch (e) { } }
  };
  // seeded rng
  U.rng = function (seed) {
    let a = (seed >>> 0) || 1;
    const f = function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    f.int = n => Math.floor(f() * n);
    f.pick = arr => arr[Math.floor(f() * arr.length)];
    return f;
  };
  U.hash = function () { let h = 2166136261; for (const x of arguments) { const s = String(x); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= 124; } return h >>> 0; };

  // ---------- sword types ----------
  ET.TYPES = {
    iron: { name: '철검', base: 300, col: 0xa9b2bc, glow: 0xff8a3d, brk: 1, grt: 1, dmg: 1, val: 1, ab: 'quake', abName: '대지 가르기', abDesc: '전방에 충격파를 일으켜 큰 피해', price: 260, desc: '평범하지만 정직한 강철.' },
    obsidian: { name: '흑요석검', base: 390, col: 0x221d2b, glow: 0xb45cff, brk: 1.22, grt: 1, dmg: .95, val: 1.12, ab: 'fireball', abName: '흑염구', abDesc: '거리 무관 화염구 + 화상', price: 470, desc: '가치가 높지만 잘 깨진다.' },
    frost: { name: '서리강철검', base: 330, col: 0xcbe9ff, glow: 0x5fd0ff, brk: .93, grt: 1, dmg: .6, val: 1, ab: 'frost', abName: '서리 감옥', abDesc: '용을 3초간 얼리고 피해', price: 420, desc: '손상이 잘 일어나지 않는다.' },
    storm: { name: '뇌철검', base: 320, col: 0x7d8899, glow: 0xffe45c, brk: 1.1, grt: 1.9, dmg: 1, val: 1, ab: 'storm', abName: '연쇄 뇌격', abDesc: '낙뢰 5연타', price: 440, desc: '대성공이 거의 두 배로 잦다.' },
    bone: { name: '용골검', base: 290, col: 0xeadfc4, glow: 0x7dff9a, brk: 1, grt: 1, dmg: 1.1, val: 1, revive: true, ab: 'skeleton', abName: '해골 군단', abDesc: '해골 전사 3기 소환', price: 400, desc: '처음 부서질 때 한 번 되살아난다(-3강).' },
    star: { name: '별철검', base: 520, col: 0x283a86, glow: 0xffffff, brk: 1.05, grt: 1.35, dmg: .9, val: 1.1, ab: 'meteor', abName: '유성우', abDesc: '유성 6발을 떨어뜨린다', price: 980, rare: true, desc: '하늘에서 떨어진 쇠. 모든 면이 조금씩 좋다.' }
  };
  ET.FINAL_LV = 15;
  // evolution stages: the sword keeps changing shape as it climbs
  ET.STAGES = [[0, '녹슨'], [5, '단련된'], [10, '장인의'], [15, '룬각인'], [20, '명검'], [25, '영웅의'], [30, '전설의'], [35, '신화의'], [40, '용살'], [50, '별빛'], [60, '천공의'], [80, '태초의'], [100, '신의']];
  ET.stageOf = lv => { let s = 0; for (let i = 0; i < ET.STAGES.length; i++) if (lv >= ET.STAGES[i][0]) s = i; return s; };
  ET.tierOf = ET.stageOf;
  ET.stageName = (lv, type) => { const st = ET.STAGES[ET.stageOf(lv)][1], n = (ET.TYPES[type] || ET.TYPES.iron).name; return lv < 5 && type === 'iron' ? n : st + ' ' + n; };
  ET.nextStage = lv => { const i = ET.stageOf(lv) + 1; return i < ET.STAGES.length ? ET.STAGES[i][0] : null; };

  // ---------- relics ----------
  // tag = icon shape
  ET.RELICS = [
    { id: 'glove', name: '숙련공의 장갑', r: 1, p: 220, tag: 'glove', d: '완벽 타이밍 구간이 50% 넓어진다.' },
    { id: 'whet', name: '붉은 숫돌', r: 1, p: 260, tag: 'stone', d: '성공 확률 +6%p (유지에서 차감).' },
    { id: 'bellows', name: '불씨 풀무', r: 1, p: 240, tag: 'bellows', d: '불꽃 폭주 게이지 충전량 +50%.' },
    { id: 'tooth', name: '탐욕의 금니', r: 1, p: 200, tag: 'tooth', d: '초과 공물의 환급률 50% → 90%.' },
    { id: 'seal', name: '상인의 인장', r: 1, p: 260, tag: 'seal', d: '상점 가격 -25%, 검 판매가 +25%.' },
    { id: 'cloak', name: '용비늘 망토', r: 2, p: 380, tag: 'cloak', d: '파괴 확률 ×0.85.' },
    { id: 'shoe', name: '행운의 편자', r: 2, p: 340, tag: 'shoe', d: '대성공 확률 ×1.7.' },
    { id: 'heart', name: '폭주 심장', r: 2, p: 320, tag: 'heart', d: '불꽃 폭주 지속 +2.5초.' },
    { id: 'scale', name: '감정사의 저울', r: 2, p: 400, tag: 'scale', d: '모든 검의 가치 +18%.' },
    { id: 'will', name: '강철 의지', r: 2, p: 360, tag: 'shield', d: '손상 결과의 45%가 유지로 바뀐다.' },
    { id: 'crucible', name: '연금 도가니', r: 2, p: 420, tag: 'pot', d: '매일 아침 검 1자루를 더 받는다.' },
    { id: 'bell', name: '고요한 종', r: 2, p: 450, tag: 'bell', d: '용의 인내심 최대치 +1 (즉시 1 회복).' },
    { id: 'twin', name: '쌍둥이 모루', r: 3, p: 520, tag: 'anvil', d: '성공 시 15% 확률로 1강 더.' },
    { id: 'phoenix', name: '불사조 깃털', r: 3, p: 600, tag: 'feather', d: '하루 한 번, 파괴를 -2강으로 대신한다.' },
    { id: 'tear', name: '용의 눈물', r: 3, p: 560, tag: 'tear', d: '공물 요구량 -12%.' },
    { id: 'dice', name: '도박사의 주사위', r: 3, p: 480, tag: 'dice', d: '파괴 ×1.3, 대성공 ×2.4, 검 가치 +20%.' },
    { id: 'stard', name: '별가루 주머니', r: 3, p: 540, tag: 'star', d: '+10강 이상인 검은 1강마다 가치 +4%.' },
    { id: 'giant', name: '거인의 망치머리', r: 3, p: 620, tag: 'hammer', d: '대성공이 +2 대신 +3강.' },
    { id: 'chain', name: '연쇄의 고리', r: 2, p: 420, tag: 'chain', d: '연타 보너스가 한 단계 일찍 시작되고 +1강 더.' },
    { id: 'hourglass', name: '재의 모래시계', r: 2, p: 380, tag: 'hourglass', d: '불꽃 폭주 지속시간 2배.' },
    { id: 'immortal', name: '불멸의 모루석', r: 3, p: 700, tag: 'anvilstone', d: '파괴의 절반이 유지로 바뀐다.' },
    { id: 'crown', name: '대장장이 왕관', r: 3, p: 560, tag: 'crown', d: '숙련도를 두 배로 얻는다.' },
    { id: 'eye', name: '용의 눈알', r: 2, p: 360, tag: 'eye', d: '황금 불꽃이 세 배 자주 튄다.' },
    { id: 'ward', name: '거울 방패', r: 2, p: 380, tag: 'mirror', d: '하루 한 번, 받은 저주를 시전자에게 반사.', mp: true }
  ];
  ET.RELIC = Object.fromEntries(ET.RELICS.map(r => [r.id, r]));
  ET.RAR = ['', '일반', '희귀', '전설'];
  ET.MAX_RELICS = 6;
  ET.UPGRADES = {
    hammer: { name: '망치 단련', max: 12, p: 300, d: '단계마다 파괴 ×0.94, 대성공 +0.6%p' },
    anvil: { name: '모루 보강', max: 10, p: 260, d: '단계마다 손상 ×0.93' },
    forge: { name: '화로 개량', max: 6, p: 240, d: '단계마다 열기 소모 -15%, 폭주 게이지 +12%' },
    rack: { name: '거치대 증축', max: 4, p: 200, d: '단계마다 거치대 +2칸' }
  };
  ET.masteryOf = strikes => Math.min(40, Math.floor(Math.sqrt((strikes || 0) / 8)));
  // combo bonus unlocks with mastery: early game is steady, late game snowballs
  ET.comboCap = (M, chain) => M < 4 ? (chain ? 1 : 0) : 1 + Math.floor(M / 10) + (chain ? 1 : 0);
  ET.comboBonus = (combo, M, chain) => Math.min(ET.comboCap(M, chain), Math.floor((combo + (chain ? 2 : 0)) / 5));

  ET.ITEMS = {
    chip: { name: '숫돌 조각', p: 180, d: '다음 타격 1회 확정 성공.', tag: 'stone' },
    charm: { name: '수호 부적', p: 260, d: '다음 파괴 1회를 손상으로 막는다.', tag: 'shield' },
    salt: { name: '정화 소금', p: 160, d: '다음으로 받는 저주 1회 차단.', tag: 'pot', mp: true }
  };
  ET.CURSES = {
    rust: { name: '녹의 저주', p: 300, d: '상대의 다음 6번 타격 파괴 확률 ×1.5' },
    chill: { name: '냉기 바람', p: 220, d: '상대의 화로 열기와 폭주 게이지를 0으로' },
    raven: { name: '까마귀 도둑', p: 260, d: '상대 골드의 15%를 훔친다' },
    gaze: { name: '용의 시선', p: 340, d: '상대의 오늘 공물 요구량 +12%' }
  };

  // ---------- daily events ----------
  ET.EVENTS = [
    { id: 'calm', name: '조용한 아침', d: '특별한 일은 없다.' },
    { id: 'nap', name: '용의 낮잠', d: '오늘 공물 요구량 -25%.' },
    { id: 'rage', name: '용의 짜증', d: '요구량 +15%, 대신 초과 환급 2배.' },
    { id: 'meteor', name: '별똥별 밤', d: '대성공 확률 ×2.' },
    { id: 'rust', name: '녹슨 안개', d: '손상 확률 ×1.5.' },
    { id: 'market', name: '장날', d: '상점 가격 -40%.' },
    { id: 'fest', name: '대장간 축제', d: '폭주 게이지 충전 ×2.' },
    { id: 'clear', name: '맑은 불길', d: '타격당 열기 소모 절반.' },
    { id: 'gold', name: '금화 비', d: '아침에 골드를 받는다.' },
    { id: 'iron', name: '쇠비', d: '검 1자루를 더 받는다.' },
    { id: 'shaky', name: '흔들리는 모루', d: '파괴 확률 ×1.2, 검 가치 +15%.' }
  ];
  ET.EVENT = Object.fromEntries(ET.EVENTS.map(e => [e.id, e]));
  ET.eventFor = (seed, day) => {
    if (day === 1) return 'calm';
    const r = U.rng(U.hash(seed, 'ev', day));
    return ET.EVENTS[r.int(ET.EVENTS.length)].id;
  };
  // tribute: log-quadratic curve so the late game demands +40..+100 swords
  ET.tributeFor = (day) => { const d = Math.max(0, day - 1), lg = 2.9 + .16 * d + .009 * d * d; const v = Math.pow(10, lg), mag = Math.pow(10, Math.floor(lg) - 2); return Math.round(v / mag) * mag; };
  ET.priceScale = day => ET.tributeFor(day) / 800;

  // ---------- value & odds ----------
  ET.swordValue = function (sw, st) {
    const T = ET.TYPES[sw.type];
    let m = T.val;
    if (st) {
      if (st.has('scale')) m *= 1.18;
      if (st.has('dice')) m *= 1.2;
      if (st.event === 'shaky') m *= 1.15;
      if (st.has('stard') && sw.lv >= 10) m *= 1 + .04 * (sw.lv - 9);
    }
    return Math.round((T.base * Math.pow(1.45, sw.lv) + (sw.flat || 0)) * m);
  };
  // returns probabilities object
  ET.odds = function (sw, st, q) {
    const T = ET.TYPES[sw.type], L = sw.lv;
    let b = L <= 2 ? 0 : (.05 + .27 * (1 - Math.exp(-(L - 2) / 14))) * T.brk;
    let gs = .07 * T.grt;
    let d = Math.min(.24, .10 + .002 * L) * T.dmg;
    let h = .12;
    if (st) {
      const up = st.upg || {}, M = ET.masteryOf(st.strikes);
      b *= Math.pow(.94, up.hammer || 0) * Math.pow(.975, M);
      d *= Math.pow(.93, up.anvil || 0);
      gs += .006 * (up.hammer || 0) + .004 * M;
      if (st.has('cloak')) b *= .85;
      if (st.has('dice')) { b *= 1.3; gs *= 2.4; }
      if (st.has('shoe')) gs *= 1.7;
      if (st.event === 'meteor') gs *= 2;
      if (st.event === 'rust') d *= 1.5;
      if (st.event === 'shaky') b *= 1.2;
      if (st.rustHex > 0) b *= 1.5;
      if (st.has('will')) { h += d * .45; d *= .55; }
      if (st.has('immortal')) { h += b * .5; b *= .5; }
      if (st.has('whet')) { const t = Math.min(h, .06); h -= t; }
    }
    if (q === 'perfect') { b *= .55; const t = Math.min(h, .07); h -= t; }
    else if (q === 'miss') { b *= 1.25; gs *= .5; }
    if (sw.heat != null && sw.heat < 25) { gs = 0; d *= 1.5; }
    if (st && st.rushT > 0) { h += b; b = 0; }
    gs = Math.min(gs, .45);
    let s = 1 - (b + gs + d + h);
    if (s < .08) { const k = (1 - .08) / (b + gs + d + h); b *= k; gs *= k; d *= k; h *= k; s = .08; }
    if (st && (st.chipNext || st.goldenNow)) { return { gs: st.goldenNow ? 1 : gs, s: st.goldenNow ? 0 : 1 - gs, h: 0, d: 0, b: 0 }; }
    return { gs, s, h, d, b };
  };
  ET.drawOutcome = function (o, rnd) {
    const t = Math.floor(rnd() * 1000);
    const c = [['gs', o.gs], ['s', o.s], ['h', o.h], ['d', o.d], ['b', o.b]];
    let acc = 0;
    for (const [k, p] of c) { acc += Math.round(p * 1000); if (t < acc) return k; }
    return 's';
  };
  ET.dmgOf = value => Math.round(8 + 10 * Math.pow(Math.max(0, Math.log10(Math.max(1, value)) - 2.4), 1.5));

  // ---------- audio ----------
  const A = ET.Audio = { ctx: null, master: null, on: true, amb: null };
  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext; A.ctx = new C();
      A.master = A.ctx.createGain(); A.master.gain.value = U.store.get('vol', .7); A.master.connect(A.ctx.destination);
      A.comp = A.ctx.createDynamicsCompressor(); A.comp.connect(A.master);
      const len = A.ctx.sampleRate * 2, buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      A.noise = buf;
      // brown noise for fire
      const bb = A.ctx.createBuffer(1, len, A.ctx.sampleRate), bd = bb.getChannelData(0); let last = 0;
      for (let i = 0; i < len; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
      A.brown = bb;
      A.startAmb();
    } catch (e) { A.ctx = null; }
  };
  A.setVol = v => { U.store.set('vol', v); if (A.master) A.master.gain.value = v; };
  A.t = () => A.ctx.currentTime;
  A.env = function (node, t0, a, peak, dec) { const g = A.ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec); node.connect(g); g.connect(A.comp); return g; };
  A.tone = function (f, type, t0, a, peak, dec, fEnd) { const o = A.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t0 + a + dec); A.env(o, t0, a, peak, dec); o.start(t0); o.stop(t0 + a + dec + .05); return o; };
  A.noiseBurst = function (t0, dur, peak, ftype, freq, q, fEnd) { const s = A.ctx.createBufferSource(); s.buffer = A.noise; const f = A.ctx.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(freq, t0); if (fEnd) f.frequency.exponentialRampToValueAtTime(fEnd, t0 + dur); f.Q.value = q || 1; s.connect(f); A.env(f, t0, .003, peak, dur); s.start(t0, Math.random()); s.stop(t0 + dur + .1); };
  A.play = function (name, k) {
    if (!A.ctx || !A.on) return; const t = A.t(); k = k || 1;
    switch (name) {
      case 'clang': {
        const base = 430 + Math.random() * 60;
        [1, 2.76, 5.4, 8.93].forEach((m, i) => A.tone(base * m, 'sine', t, .002, .22 / (i + 1) * k, .5 + .9 / (i + 1)));
        A.noiseBurst(t, .08, .5 * k, 'bandpass', 3200, 1.2);
        A.tone(110, 'sine', t, .002, .4 * k, .18, 60); break;
      }
      case 'gs': [0, 4, 7, 12, 16].forEach((s, i) => A.tone(523 * Math.pow(2, s / 12), 'triangle', t + i * .06, .01, .16, .7)); A.tone(1046, 'sine', t + .3, .01, .1, 1.4); break;
      case 'succ': A.tone(660, 'triangle', t, .005, .12, .35); A.tone(990, 'sine', t + .05, .005, .08, .4); break;
      case 'hold': A.tone(300, 'sine', t, .005, .08, .2); break;
      case 'dmg': A.tone(220, 'sawtooth', t, .005, .12, .35, 90); A.noiseBurst(t, .2, .2, 'lowpass', 900, 1); break;
      case 'break': A.noiseBurst(t, .7, .7, 'highpass', 2500, .7, 6000); for (let i = 0; i < 9; i++) A.tone(1800 + Math.random() * 4000, 'sine', t + Math.random() * .35, .002, .08, .25); A.tone(90, 'sine', t, .003, .5, .5, 40); break;
      case 'bell': [1, 2, 2.76, 5.4, 8.9].forEach((m, i) => A.tone(392 * m, 'sine', t, .003, .2 / (i + 1), 2.8 / (1 + i * .4))); break;
      case 'coin': A.tone(1568, 'square', t, .002, .04, .08); A.tone(2093, 'square', t + .07, .002, .04, .18); break;
      case 'click': A.tone(900, 'square', t, .001, .03, .04); break;
      case 'whoosh': A.noiseBurst(t, .35, .25, 'bandpass', 400, 2, 2400); break;
      case 'fire': A.noiseBurst(t, .9, .35, 'lowpass', 600, 1, 2500); A.tone(80, 'sine', t, .05, .2, .8); break;
      case 'roar': {
        const o = A.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(48, t + 1.6);
        const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(1400, t + .4); f.frequency.exponentialRampToValueAtTime(200, t + 1.7);
        o.connect(f); A.env(f, t, .15, .5 * k, 1.6); o.start(t); o.stop(t + 1.9);
        A.noiseBurst(t, 1.5, .35 * k, 'bandpass', 500, .8, 150); break;
      }
      case 'hurt': A.tone(160, 'square', t, .005, .2, .3, 70); A.noiseBurst(t, .25, .3, 'lowpass', 1200, 1); break;
      case 'rush': [0, 7, 12, 19].forEach((s, i) => A.tone(220 * Math.pow(2, s / 12), 'sawtooth', t + i * .05, .02, .05, .9)); A.noiseBurst(t, 1, .3, 'bandpass', 800, 1, 4000); break;
      case 'curse': A.tone(180, 'sawtooth', t, .05, .12, 1.2, 60); A.tone(187, 'sawtooth', t, .05, .12, 1.2, 64); break;
      case 'slash': A.noiseBurst(t, .18, .35, 'bandpass', 1800, 3, 500); break;
      case 'boom': A.tone(70, 'sine', t, .005, .7, .9, 30); A.noiseBurst(t, .8, .5, 'lowpass', 1200, 1, 100); break;
      case 'zap': A.noiseBurst(t, .25, .5, 'highpass', 3000, 1); A.tone(1200, 'sawtooth', t, .002, .1, .2, 200); break;
      case 'step': A.noiseBurst(t, .07, .06 + Math.random() * .03, 'lowpass', 380 + Math.random() * 120, 1); break;
      case 'win': [0, 4, 7, 12, 7, 12, 16, 19].forEach((s, i) => A.tone(392 * Math.pow(2, s / 12), 'triangle', t + i * .12, .01, .15, .8)); break;
    }
  };
  A.startAmb = function () {
    if (!A.ctx || A.amb) return;
    const s = A.ctx.createBufferSource(); s.buffer = A.brown; s.loop = true;
    const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = A.ctx.createGain(); g.gain.value = .12; s.connect(f); f.connect(g); g.connect(A.master); s.start();
    A.amb = { s, g, f };
    // crackles
    A.crackle = setInterval(() => { if (A.on && A.ctx && Math.random() < .5) A.noiseBurst(A.t(), .03, .05 + Math.random() * .08, 'highpass', 2000 + Math.random() * 3000, 1); }, 180);
  };
  A.ambLevel = v => { if (A.amb) A.amb.g.gain.setTargetAtTime(v, A.t(), .5); };
})(window.ET);
