/* EMBER TITHE — game logic & forge UI */
'use strict';
(function (ET) {
  const U = ET.U, $ = U.$, A = ET.Audio, F = ET.Forge;
  const G = ET.G = { S: null, station: 'anvil', busy: false, timing: { t: 0, pos: .5 }, lastPanelKey: '' };
  const RACK_BASE = 10; G.rackMax = () => RACK_BASE + 2 * ((G.S && G.S.upg && G.S.upg.rack) || 0);
  G.prefs = Object.assign({ autoHeat: true, target: 0, safeB: 0, sens: 1, invert: false }, U.store.get('prefs', {}));
  G.savePrefs = () => U.store.set('prefs', G.prefs);
  const OUT_COL = { gs: 'var(--gs)', s: 'var(--s)', h: 'var(--h)', d: 'var(--d)', b: 'var(--b)' };
  const OUT_NAME = { gs: '대성공', s: '성공', h: '유지', d: '손상', b: '파괴' };
  const TIER_COL = ['#6a6460', '#9aa2aa', '#8fb0c8', '#7fa6c4', '#9a84c0', '#b87cc0', '#d6aa5a', '#e0b850', '#d0652a', '#ff7040', '#ff9ad0', '#9ff0ff', '#ffffff'];

  // ---------- achievements ----------
  ET.ACH = [
    { id: 'first_gs', n: '첫 대성공', d: '대성공을 처음 띄웠다.' },
    { id: 'lv10', n: '장인의 손', d: '+10강 검을 만들었다.' },
    { id: 'lv15', n: '최종 형태', d: '+15강, 검의 최종 형태를 보았다.' },
    { id: 'lv25', n: '신화의 대장장이', d: '+25강 검을 만들었다.' },
    { id: 'break10', n: '고철 수집가', d: '한 판에 검 10자루를 부쉈다.' },
    { id: 'rush3', n: '불꽃 중독', d: '하루에 불꽃 폭주를 3번 일으켰다.' },
    { id: 'rich', n: '용보다 부자', d: '골드 50,000 이상을 모았다.' },
    { id: 'relic6', n: '수집광', d: '유물 칸을 가득 채웠다.' },
    { id: 'lv50', n: '별을 벼린 자', d: '+50강 검을 만들었다.' },
    { id: 'lv100', n: '신의 대장장이', d: '+100강 검을 만들었다.' },
    { id: 'quest', n: '첫 의뢰', d: '의뢰를 처음 완료했다.' },
    { id: 'quest15', n: '단골 대장장이', d: '한 계약에서 의뢰를 15개 완료했다.' },
    { id: 'dragon', n: '용살자', d: '이그나르를 쓰러뜨렸다.' },
    { id: 'flawless', n: '완벽한 납세자', d: '공물을 한 번도 놓치지 않고 계약을 마쳤다.' },
    { id: 'mpwin', n: '대장간의 왕', d: '멀티플레이에서 1위를 했다.' },
    { id: 'curse', n: '음흉한 이웃', d: '라이벌에게 저주를 걸었다.' }
  ];
  G.ach = function (id) {
    const got = U.store.get('ach', {}); if (got[id]) return; got[id] = Date.now(); U.store.set('ach', got);
    const a = ET.ACH.find(x => x.id === id); if (a) G.toast('업적 · ' + a.n, 'good');
  };
  G.seen = function (kind, id) { const s = U.store.get('seen_' + kind, {}); if (!s[id]) { s[id] = 1; U.store.set('seen_' + kind, s); } };

  // ---------- state ----------
  function attach(S) { Object.defineProperty(S, 'has', { value: id => S.relics.includes(id), enumerable: false, configurable: true }); return S; }
  G.newRun = function (o) {
    const S = G.S = attach({
      v: 3, mode: o.mode || 'solo', seed: o.seed || (Math.random() * 1e9 | 0), contract: o.days || 20, day: 0, lives: 3, maxLives: 3, gold: 150,
      rack: [], anvil: null, counter: [], relics: [], items: { chip: 0, charm: 0, salt: 0 }, event: 'calm', rushG: 0, rushT: 0, rushes: 0,
      phoenixUsed: false, wardUsed: false, rustHex: 0, gazeMul: 1, chipNext: false, totalPaid: 0, broken: 0, fails: 0, bestLv: 0,
      shop: null, rerolls: 0, settled: false, endless: false, dragonDmg: 0, dragonKills: 0, fightHP: null, nextId: 1, extraSword: 0,
      phase: 'forge', alive: true, fightDone: false, strikes: 0, combo: 0, upg: { hammer: 0, anvil: 0, forge: 0, rack: 0 }, golden: 0, goldenNow: false
    });
    G.station = 'anvil'; F.enterPlay && F.enterPlay();
    G.startDay(1);
    return S;
  };
  G.load = function () { const s = U.store.get('save', null); if (!s || s.v !== 3) return false; G.S = attach(s); G.S.phase = 'forge'; G.afterLoad(); return true; };
  G.save = function () { if (G.S && G.S.mode === 'solo' && G.S.alive) U.store.set('save', G.S); };
  G.afterLoad = function () { if (G.S && !G.S.quests) { G.S.quests = ET.questsFor(G.S.seed, G.S.day); G.S.dq = { broken: 0 }; } setTimeout(() => { F.syncBoard && F.syncBoard(G.S && G.S.quests); G.renderQuests(); }, 0); const S = G.S; S.golden = 0; S.goldenNow = false; F.enterPlay && F.enterPlay(); G.syncAll(); F.syncAltar(S.shop && S.shop.relics); G.go('anvil'); G.render(); };
  const sword = (type, lv) => ({ id: 's' + (G.S.nextId++), type: type || 'iron', lv: lv || 0, flat: 0, heat: 100, revived: false });
  G.val = sw => ET.swordValue(sw, G.S);
  G.req = function () {
    const S = G.S; let r = ET.tributeFor(S.day, S.contract);
    if (S.has('tear')) r *= .88; if (S.event === 'nap') r *= .75; if (S.event === 'rage') r *= 1.15; r *= S.gazeMul;
    return Math.round(r / 10) * 10;
  };
  G.counterTotal = () => G.S.counter.reduce((a, s) => a + G.val(s), 0);
  G.allSwords = () => { const S = G.S; return S.rack.concat(S.anvil ? [S.anvil] : [], S.counter); };

  G.startDay = function (d) {
    const S = G.S; S.day = d; S.event = ET.eventFor(S.seed, d); S.settled = false; S.phoenixUsed = false; S.wardUsed = false; S.gazeMul = 1; S.rushes = 0; S.rerolls = 0; S.phase = 'forge';
    let n = 3 + (S.has('crucible') ? 1 : 0) + (S.event === 'iron' ? 1 : 0) + S.extraSword; S.extraSword = 0;
    let lost = 0;
    for (let i = 0; i < n; i++) { if (S.rack.length + (S.anvil ? 1 : 0) < G.rackMax() + 1 && S.rack.length < G.rackMax()) S.rack.push(sword('iron')); else lost++; }
    G.allSwords().forEach(s => s.heat = 100);
    if (S.event === 'gold') S.gold += Math.round(220 * ET.priceScale(d));
    S.shop = G.genShop(d, 0);
    S.quests = ET.questsFor(S.seed, d); S.dq = { broken: 0 }; F.syncBoard && F.syncBoard(S.quests);
    G.syncAll(); F.syncAltar(S.shop.relics);
    G.render(true);
    const ev = ET.EVENT[S.event];
    G.banner(d + '일차', ev.name + ' · ' + ev.d);
    if (lost) G.toast('거치대가 가득 차 검 ' + lost + '자루를 받지 못했다', 'bad');
    if (d === S.contract && !S.endless) setTimeout(() => G.toast('마지막 날! 공물을 바친 뒤 이그나르와 싸울 검을 남겨 두세요', 'bad'), 1600);
    F.dragonReact('peek');
    G.save(); G.pushNet(true);
  };

  // ---------- shop ----------
  G.genShop = function (d, rr) {
    const S = G.S, r = U.rng(U.hash(S.seed, 'shop', d, rr)), mp = S.mode === 'mp';
    const pool = ET.RELICS.filter(x => !S.relics.includes(x.id) && (mp || !x.mp));
    const relics = [];
    for (let k = 0; k < 3 && pool.length; k++) {
      const w = pool.map(x => x.r === 1 ? 5 : x.r === 2 ? 3 : 1.2 + d * .08), tot = w.reduce((a, b) => a + b, 0); let p = r() * tot, i = 0;
      while (p > w[i]) { p -= w[i]; i++; } relics.push({ id: pool[i].id, sold: false }); pool.splice(i, 1);
    }
    const types = Object.keys(ET.TYPES).filter(t => t !== 'iron'), swords = [];
    while (swords.length < 3) { let t = r.pick(types); if (ET.TYPES[t].rare && r() > .3) continue; if (swords.some(x => x.type === t)) continue; swords.push({ type: t, sold: false }); }
    return { relics, swords, items: Object.keys(ET.ITEMS).filter(k => mp || !ET.ITEMS[k].mp) };
  };
  G.price = function (base) { const S = G.S; let p = base * ET.priceScale(S.day) * .55; if (S.has('seal')) p *= .75; if (S.event === 'market') p *= .6; return Math.round(p / 10) * 10; };
  G.rerollPrice = () => G.price(110 * (1 + G.S.rerolls * .5));
  G.buyRelic = function (i) {
    const S = G.S, o = S.shop.relics[i]; if (!o || o.sold) return; if (!F.near('shop')) return G.needWalk('shop'); const R = ET.RELIC[o.id], p = G.price(R.p);
    if (S.gold < p) return G.toast('골드가 부족합니다', 'bad');
    if (S.relics.length >= ET.MAX_RELICS) return G.toast('유물 칸이 가득 찼습니다. 유물을 눌러 버릴 수 있어요', 'bad');
    S.gold -= p; S.relics.push(o.id); o.sold = true; A.play('coin'); G.seen('relic', o.id);
    if (o.id === 'bell') { S.maxLives++; S.lives = Math.min(S.maxLives, S.lives + 1); }
    if (S.relics.length >= ET.MAX_RELICS) G.ach('relic6');
    G.toast(R.name + ' 획득 · 유물 전시장에 놓였다', 'good'); F.syncAltar(S.shop.relics); F.syncRelics && F.syncRelics(S.relics); G.render();
  };
  G.dropRelic = function (id) {
    const S = G.S, R = ET.RELIC[id];
    G.modal('<h2 class="h">' + U.esc(R.name) + '</h2><p class="muted">' + U.esc(R.d) + '</p><p>이 유물을 버릴까요? 되돌릴 수 없습니다.</p>', [{ t: '취소' }, { t: '버리기', cls: 'pri', f: () => { S.relics = S.relics.filter(x => x !== id); if (id === 'bell') { S.maxLives--; S.lives = Math.min(S.lives, S.maxLives); } F.syncRelics && F.syncRelics(S.relics); G.render(); } }]);
  };
  G.buySword = function (i) {
    const S = G.S, o = S.shop.swords[i]; if (!o || o.sold) return; if (!F.near('shop')) return G.needWalk('shop'); const p = G.price(ET.TYPES[o.type].price);
    if (S.gold < p) return G.toast('골드가 부족합니다', 'bad');
    if (S.rack.length >= G.rackMax()) return G.toast('거치대가 가득 찼습니다', 'bad');
    S.gold -= p; o.sold = true; S.rack.push(sword(o.type)); A.play('coin'); G.seen('type', o.type); F.syncRack(S.rack); G.toast(ET.TYPES[o.type].name + '을(를) 거치대에 걸었다', 'good'); G.render();
  };
  G.buyItem = function (k) {
    if (!F.near('shop')) return G.needWalk('shop'); const S = G.S, it = ET.ITEMS[k], p = G.price(it.p); if (S.gold < p) return G.toast('골드가 부족합니다', 'bad');
    if (k === 'chest' && S.rack.length >= G.rackMax()) return G.toast('거치대가 가득 차 상자를 열 수 없습니다', 'bad');
    S.gold -= p; A.play('coin'); if (k === 'chest') { G.openChest(true); } else S.items[k] = (S.items[k] || 0) + 1; G.render();
  };
  G.useChip = function () { const S = G.S; if (S.items.chip > 0 && !S.chipNext) { S.items.chip--; S.chipNext = true; G.toast('숫돌 조각: 다음 타격은 확정 성공', 'good'); G.render(); } };
  G.reroll = function () { const S = G.S, p = G.rerollPrice(); if (S.gold < p) return G.toast('골드가 부족합니다', 'bad'); S.gold -= p; S.rerolls++; const keep = S.shop.items; S.shop = G.genShop(S.day, S.rerolls); S.shop.items = keep; A.play('coin'); F.syncAltar(S.shop.relics); G.render(); };

  // ---------- sword moves ----------
  function take(id) { const S = G.S; let i = S.rack.findIndex(s => s.id === id); if (i >= 0) return S.rack.splice(i, 1)[0]; i = S.counter.findIndex(s => s.id === id); if (i >= 0) return S.counter.splice(i, 1)[0]; if (S.anvil && S.anvil.id === id) { const s = S.anvil; S.anvil = null; return s; } return null; }
  G.toAnvil = function (id) {
    const S = G.S; if (!G.canAct()) return; if (S.anvil && S.anvil.id === id) return G.go('anvil');
    const sw = take(id); if (!sw) return;
    if (S.anvil) S.rack.push(S.anvil);
    S.anvil = sw; A.play('click'); A.play('whoosh'); G.syncAll(); G.go('anvil');
  };
  G.toRack = function (id) { const S = G.S; if (!G.canAct()) return; const sw = take(id); if (!sw) return; S.rack.push(sw); A.play('click'); G.syncAll(); G.render(); };
  G.toCounter = function (id) { const S = G.S; if (!G.canAct() || S.settled) return; const sw = take(id); if (!sw) return; S.counter.push(sw); A.play('click'); G.syncAll(); G.render(); };
  G.sell = function (id) {
    const S = G.S; if (!G.canAct()) return; const sw = S.rack.find(s => s.id === id); if (!sw) return;
    const g = Math.round(G.val(sw) * (ET.TYPES[sw.type].sell || .4) * (S.has('seal') ? 1.25 : 1));
    G.modal('<h2 class="h">검 판매</h2><p>' + U.esc(ET.TYPES[sw.type].name) + ' +' + sw.lv + '을(를) <b class="gold">' + U.fmt(g) + ' G</b>에 재의 상인에게 넘길까요?</p><p class="muted small">판 검은 공물로 쓸 수 없습니다.</p>', [{ t: '취소' }, { t: '판매', cls: 'gold', f: () => { take(id); S.gold += g; A.play('coin'); G.qp('sell', 1); G.syncAll(); G.render(); } }]);
  };
  G.syncAll = function () { const S = G.S; F.syncRack(S.rack); F.syncCounter(S.counter); F.setAnvilSword(S.anvil); F.syncRelics && F.syncRelics(S.relics); };
  // upgrades (gold sink that makes the late game snowball)
  G.upPrice = k => { const S = G.S, U0 = ET.UPGRADES[k]; return G.price(U0.p * Math.pow(1.45, S.upg[k] || 0)); };
  G.buyUp = function (k) { const S = G.S, U0 = ET.UPGRADES[k]; if ((S.upg[k] || 0) >= U0.max) return; if (!F.near('shop')) return G.needWalk('shop'); const p = G.upPrice(k); if (S.gold < p) return G.toast('골드가 부족합니다', 'bad'); S.gold -= p; S.upg[k] = (S.upg[k] || 0) + 1; A.play('coin'); A.play('clang', .6); G.toast(U0.name + ' ' + S.upg[k] + '단계', 'good'); G.render(); };
  let walkHintT = 0;
  G.needWalk = function (st) { if (performance.now() - walkHintT > 1500) { walkHintT = performance.now(); const n = { anvil: '모루', furnace: '화로', tribute: '공물대', shop: '상인', rack: '거치대', relics: '유물 전시장' }[st]; G.toast(n + ' 가까이 가야 합니다 · [걸어가기]를 누르면 자동으로 이동해요'); } return false; };
  G.canAct = () => G.S && G.S.phase === 'forge' && !G.busy;

  // ---------- heat ----------
  G.heat = function () {
    const S = G.S; if (!S.anvil || G.heating || !G.canAct()) return; if (!F.near('anvil') && !F.near('furnace')) return G.needWalk('anvil'); if (S.anvil.heat >= 99) return;
    G.heating = true; F.heating = true; A.play('fire'); A.play('whoosh'); G.render();
    setTimeout(() => { G.heating = false; F.heating = false; if (S.anvil) { S.anvil.heat = 100; F.setAnvilSword(S.anvil); } G.render(); }, Math.max(350, 850 - (S.upg.forge || 0) * 80));
  };

  // ---------- timing ----------
  G.timingZones = function () {
    const S = G.S; let wp = .06; if (S.has('glove')) wp *= 1.5; if (S.rushT > 0) wp *= 2; return { wp, wg: .2 };
  };
  G.timingQ = function () { const z = G.timingZones(), d = Math.abs(G.timing.pos - .5); return d <= z.wp ? 'perfect' : d <= z.wg ? 'good' : 'miss'; };

  // ---------- strike ----------
  G.strike = function () {
    const S = G.S; if (!S || !S.anvil || G.busy || G.heating || S.phase !== 'forge') return;
    if (F.hammerAnim > 0) return;
    if (!F.near('anvil')) { G.hold = false; return G.needWalk('anvil'); }
    const q = G.timingQ(); G.busy = true;
    F.strike(() => { G.busy = false; G.impact(q); });
  };
  G.impact = function (q) {
    const S = G.S, sw = S.anvil; if (!sw) return;
    const T = ET.TYPES[sw.type], o = ET.odds(sw, S, q);
    const golden = S.golden > 0;
    let res = golden ? 'gs' : ET.drawOutcome(o, Math.random), note = golden ? '황금 불꽃' : '';
    if (golden) { S.golden = 0; F.goldenFx && F.goldenFx(false); }
    S.strikes = (S.strikes || 0) + (S.has('crown') ? 2 : 1) * (T.mast2 ? 2 : 1);
    const M = ET.masteryOf(S.strikes), chain = S.has('chain');
    if (S.chipNext) { S.chipNext = false; res = Math.random() < o.gs ? 'gs' : 's'; note = '숫돌'; }
    if (res === 'h' && T.holdUp && Math.random() < T.holdUp) { res = 's'; note = '그림자'; }
    let vis = res;
    if (res === 'b') {
      if (S.items.charm > 0) { S.items.charm--; res = 'd'; vis = 'd'; note = '수호 부적이 막았다'; }
      else if (S.has('phoenix') && !S.phoenixUsed) { S.phoenixUsed = true; res = 'p'; vis = 'd'; note = '불사조 깃털'; }
      else if (T.revive && !sw.revived) { sw.revived = true; res = 'rv'; vis = 'd'; note = '용골이 되살아났다'; }
    }
    const before = sw.lv; let bonus = 0;
    if (res === 'gs' || res === 's') { S.combo = (S.combo || 0) + 1; bonus = ET.comboBonus(S.combo, M, chain); if (T.extra && Math.random() < T.extra) { bonus++; note = '피의 맥동'; } } else if (res !== 'h' && !(res === 'd' && S.has('quench'))) S.combo = 0;
    if (res === 'gs') sw.lv += (S.has('giant') ? 3 : 2) + bonus + (golden ? 2 : 0);
    else if (res === 's') { sw.lv += 1 + bonus; if (S.has('twin') && Math.random() < .15) { sw.lv += 1; note = '쌍둥이 모루'; } }
    else if (res === 'd') sw.lv = Math.max(0, sw.lv - 1);
    else if (res === 'p') sw.lv = Math.max(0, sw.lv - 2);
    else if (res === 'rv') sw.lv = Math.max(0, sw.lv - 3);
    // rush
    if (S.rushT <= 0) {
      let g = q === 'perfect' ? 2 : q === 'good' ? 1 : 0; if (S.has('bellows')) g *= 1.5; if (S.event === 'fest') g *= 2; g *= 1 + .12 * (S.upg.forge || 0);
      S.rushG = Math.min(14, S.rushG + g); if (res === 'd') S.rushG = Math.max(0, S.rushG - 2);
      if (S.rushG >= 14) { S.rushG = 0; S.rushT = (4 + (S.has('heart') ? 2.5 : 0)) * (S.has('hourglass') ? 2 : 1); S.rushes++; G.qp('rush', 1); A.play('rush'); F.rushFx(true); G.float('불꽃 폭주!', 'var(--gs)', '파괴 없음 · ' + S.rushT + '초'); if (S.rushes >= 3) G.ach('rush3'); G.notable('불꽃 폭주 발동!'); }
      if (!T.noHeat) sw.heat = Math.max(0, sw.heat - 7 * (S.event === 'clear' ? .5 : 1) * Math.pow(.85, S.upg.forge || 0));
    }
    if (S.rustHex > 0) S.rustHex--;
    if (res !== 'b' && !golden && Math.random() < .035 * (S.has('eye') ? 3 : 1)) { S.golden = 1.3 + (S.has('clover') ? 1 : 0); F.goldenFx && F.goldenFx(true); A.play('coin'); G.float('황금 불꽃!', 'var(--gs)', '1.3초 안에 내려치면 확정 대성공 +2'); }
    // fx & ui
    F.impactFx(vis, sw);
    A.play('clang', vis === 'gs' ? 1.3 : 1);
    const val = G.val(sw);
    if (res === 'b') {
      A.play('break'); S.anvil = null; S.broken++; S.dq && S.dq.broken++; G.qfail('nobreak'); G.hold = false; S.combo = 0; G.float('파괴', '#c6c8e0', U.esc(T.name) + ' +' + before + ' · ' + U.fmt(val) + ' G 증발'); if (S.broken >= 10) G.ach('break10');
      F.flashScreen('rgba(255,255,255,.35)');
      if (before >= 8) G.notable(T.name + ' +' + before + '을(를) 부숴 먹었다');
    } else {
      F.setAnvilSword(sw);
      const bn = bonus ? ' · 연타 +' + bonus : '';
      if (vis === 'gs') { A.play('gs'); G.float(golden ? '황금 대성공!' : '대성공!', 'var(--gs)', '+' + sw.lv + ' · ' + U.fmt(val) + ' G' + bn + (note ? ' · ' + note : '')); G.ach('first_gs'); G.qp('gs', 1); }
      else if (res === 's') { A.play('succ'); G.float(S.combo >= 5 ? '연타 ' + S.combo : '성공', 'var(--s)', '+' + sw.lv + ' · ' + U.fmt(val) + ' G' + bn + (note ? ' · ' + note : '')); }
      else if (res === 'h') { A.play('hold'); G.float('유지', 'var(--h)', '+' + sw.lv); }
      else { A.play('dmg'); G.float(res === 'd' ? '손상' : '파괴 회피', 'var(--d)', '+' + sw.lv + (note ? ' · ' + note : '')); }
      if (q === 'perfect' && vis !== 'b') G.qflash = 1;
      if (sw.lv > S.bestLv) { S.bestLv = sw.lv; }
      G.qmax('combo', S.combo || 0); G.qmax('reach', sw.lv); if (q === 'perfect') G.qp('perfect', 1);
      if (sw.lv >= 10) G.ach('lv10'); if (sw.lv >= 15) G.ach('lv15'); if (sw.lv >= 25) G.ach('lv25'); if (sw.lv >= 50) G.ach('lv50'); if (sw.lv >= 100) G.ach('lv100');
      if (ET.stageOf(sw.lv) > ET.stageOf(before)) { G.qp('evolve', 1); setTimeout(() => { G.float('진화!', 'var(--gs)', U.esc(ET.stageName(sw.lv, sw.type)) + ' +' + sw.lv); A.play('rush'); F.evolveFx && F.evolveFx(); }, 380); G.notable(ET.stageName(sw.lv, sw.type) + '(으)로 진화! +' + sw.lv); }
      if (G.prefs.target && sw.lv >= G.prefs.target && G.hold) { G.hold = false; G.toast('목표 +' + G.prefs.target + ' 도달 — 자동 타격 정지', 'good'); }
      if (vis === 'gs' && sw.lv >= 8) G.notable('대성공! ' + T.name + ' +' + sw.lv);
    }
    G.lastRes = { res: vis, q, t: performance.now() };
    G.render(); G.pushNet();
  };

  // ---------- settle ----------
  G.ringBell = function () {
    const S = G.S; if (!S || S.settled || S.phase !== 'forge') return;
    const tot = G.counterTotal(), req = G.req();
    if (tot < req) {
      G.modal('<h2 class="h">공물이 모자랍니다</h2><p>공물대 <b class="gold">' + U.fmt(tot) + '</b> / 필요 <b>' + U.fmt(req) + ' G</b></p><p class="muted">이대로 종을 치면 용의 인내심이 1 줄어듭니다. (남은 인내심 ' + S.lives + ')</p>', [{ t: '돌아가기' }, { t: '그래도 친다', cls: 'pri', f: () => G.settle() }]);
    } else G.settle();
  };
  G.settle = function (auto) {
    const S = G.S; if (!S || S.settled) return; S.settled = true; S.phase = 'settle';
    G.busy = false; G.heating = false; F.heating = false; S.rushT = 0; F.rushFx(false);
    const tot = G.counterTotal(), req = G.req();
    F.bellRing(); A.play('bell'); G.go('tribute');
    setTimeout(() => {
      G.questSettle(); S.totalPaid += tot; F.tributeFly();
      if (tot >= req) {
        let refund = (tot - req) * (S.has('tooth') ? .9 : .5) * (S.event === 'rage' ? 2 : 1); refund = Math.round(refund);
        S.gold += refund; F.dragonReact('happy'); A.play('coin');
        G.float('공물 완납', 'var(--good)', refund > 0 ? '초과분 환급 +' + U.fmt(refund) + ' G' : '이그나르가 만족한다');
      } else {
        S.lives--; S.fails++; S.extraSword = 1; F.dragonReact('angry'); F.flashScreen('rgba(200,20,10,.45)');
        G.float('공물 부족', 'var(--blood)', '인내심 -1 · 남은 ' + Math.max(0, S.lives)); G.notable('공물을 못 바쳤다! (인내심 ' + Math.max(0, S.lives) + ')');
      }
      if (S.gold >= 50000) G.ach('rich');
      setTimeout(() => { S.counter = []; F.syncCounter([]); G.render(); }, 1300);
      setTimeout(() => G.afterSettle(), 2300);
      G.render(); G.pushNet(true);
    }, 700);
  };
  G.afterSettle = function () {
    const S = G.S;
    if (S.lives <= 0) return G.gameOver('용의 인내심이 바닥났다');
    if (S.mode === 'mp') { S.phase = 'wait'; G.render(true); G.pushNet(true); ET.Net && ET.Net.checkFlow(); return; }
    if (S.day >= S.contract && !S.endless) return G.prepareFight();
    G.startDay(S.day + 1);
  };

  // ---------- fight ----------
  G.prepareFight = function (extra) {
    const S = G.S; S.phase = 'prefight'; G.render(true);
    const list = S.rack.concat(S.anvil ? [S.anvil] : []).sort((a, b) => G.val(b) - G.val(a));
    const hp = S.fightHP != null ? S.fightHP : G.dragonMaxHP();
    S.fightHP = hp;
    F.dragonReact('angry'); F.setStation('dragon');
    const rows = list.length ? list.map(s => '<button class="offer btn ghost" style="width:100%;text-align:left" data-pick="' + s.id + '"><div class="ic">' + swordSVG(s) + '</div><div><div class="n">' + U.esc(ET.TYPES[s.type].name) + ' <span class="lv">+' + s.lv + '</span></div><div class="d">피해 ' + ET.dmgOf(G.val(s)) + ' · ' + (s.lv >= ET.FINAL_LV ? '고유기 ' + ET.TYPES[s.type].abName : '기본기 강타') + '</div></div><div class="price gold">' + U.fmt(G.val(s)) + '</div></button>').join('') : '<p class="muted">남은 검이 없다… 녹슨 부지깽이로 싸운다.</p>';
    G.modal('<h2 class="h">' + (extra || '이그나르가 철창을 부순다!') + '</h2><p class="muted">싸울 검을 고르세요. 지면 남은 검으로 다시 도전할 수 있고, 용의 상처는 그대로 남습니다.</p><div style="margin-top:10px">' + rows + '</div>', list.length ? [] : [{ t: '싸운다', cls: 'pri', f: () => G.fight(null) }], true);
    U.$$('#modalCard [data-pick]').forEach(b => b.onclick = () => { G.closeModal(); G.fight(b.dataset.pick); });
  };
  G.dragonMaxHP = function () { const S = G.S; let hp = 1500 + 450 * Math.log10(ET.tributeFor(S.contract)); if (S.mode === 'mp' && ET.Net) hp = ET.Net.fightHP(hp); if (S.endless) hp *= Math.pow(1.6, S.dragonKills); return Math.round(hp); };
  G.fight = function (id) {
    const S = G.S; let sw = id ? take(id) : null; if (!sw) sw = { id: 'poker', type: 'iron', lv: 0, flat: 0 };
    G.syncAll(); S.phase = 'fight'; S.fightSword = sw;
    $('#hud').classList.remove('show');
    ET.Fight.start({
      sword: sw, value: G.val(sw), hp: S.fightHP, maxHp: G.dragonMaxHP(), mp: S.mode === 'mp',
      extDmg: () => (S.mode === 'mp' && ET.Net) ? ET.Net.teamDmgOthers() : 0,
      timeLeft: () => (S.mode === 'mp' && ET.Net) ? ET.Net.fightTimeLeft() : null,
      onDmg: d => { S.dragonDmg += d; G.pushNet(); },
      onEnd: r => G.fightEnd(r, sw)
    });
    G.pushNet(true);
  };
  G.fightEnd = function (r, sw) {
    const S = G.S; S.fightHP = r.hp; $('#hud').classList.add('show');
    if (r.win) {
      S.dragonKills++; G.ach('dragon'); if (!S.fails) G.ach('flawless'); A.play('win');
      if (S.mode === 'mp') { S.phase = 'fightdone'; S.fightDone = true; G.pushNet(true); G.render(true); ET.Net.checkFlow(); return; }
      G.modal('<h2 class="h">자유!</h2><p>이그나르가 쓰러졌다. ' + S.day + '일간의 계약이 끝났다.</p>' + statsHTML() + '<p class="muted small">무한 단조: 대장간에 남아 매일 30%씩 늘어나는 공물을 계속 바치며 점수를 올릴 수 있습니다. 용은 더 강해져 돌아옵니다.</p>', [{ t: '타이틀로', f: () => G.toTitle(true) }, { t: '무한 단조 계속', cls: 'pri', f: () => { S.endless = true; S.fightHP = null; S.phase = 'forge'; F.setStation('anvil'); G.startDay(S.day + 1); } }], true);
    } else {
      if (S.mode === 'mp') {
        const left = S.rack.length + (S.anvil ? 1 : 0);
        if (left && r.reason !== 'time') return G.prepareFight('다시 일어선다 — 다른 검을 들어라');
        S.phase = 'fightdone'; S.fightDone = true; G.pushNet(true); G.render(true); ET.Net.checkFlow(); return;
      }
      const left = S.rack.length + (S.anvil ? 1 : 0);
      if (left) return G.prepareFight('쓰러졌다… 다른 검을 들어라');
      G.gameOver('검이 남지 않았다. 이그나르 남은 체력 ' + Math.round(r.hp));
    }
  };
  G.rematch = function () { const S = G.S; if (!S.endless) return; S.fightHP = null; G.prepareFight('이그나르가 더 강해져 돌아왔다!'); };

  // ---------- end ----------
  G.score = function () { const S = G.S; if (!S) return 0; return Math.round(S.totalPaid / 10 + Math.max(0, S.day - (S.settled ? 0 : 1)) * 500 + S.dragonDmg * 5 + S.dragonKills * 20000); };
  function statsHTML() { const S = G.S; return '<div class="rank"><div><span></span><span>버틴 날</span><b>' + S.day + '일</b></div><div><span></span><span>바친 공물</span><b>' + U.fmt(S.totalPaid) + ' G</b></div><div><span></span><span>최고 강화</span><b>+' + S.bestLv + '</b></div><div><span></span><span>부순 검</span><b>' + S.broken + '</b></div><div><span></span><span>용에게 준 피해</span><b>' + U.fmt(S.dragonDmg) + '</b></div><div><span></span><span>점수</span><b class="gold">' + U.fmt(G.score()) + '</b></div></div>'; }
  G.gameOver = function (why) {
    const S = G.S; S.alive = false; S.phase = 'dead'; U.store.del('save');
    const best = U.store.get('best', 0); const sc = G.score(); if (sc > best) U.store.set('best', sc);
    F.dragonReact('angry'); F.flashScreen('rgba(160,0,0,.6)');
    if (S.mode === 'mp') { G.pushNet(true); G.render(true); G.toast('탈락… 관전 모드로 라이벌을 지켜봅니다', 'bad'); ET.Net && ET.Net.checkFlow(); return; }
    G.modal('<h2 class="h">계약 종료</h2><p>' + U.esc(why) + '</p>' + statsHTML() + '<p class="muted small">최고 점수 ' + U.fmt(Math.max(best, sc)) + '</p>', [{ t: '타이틀로', f: () => G.toTitle(true) }, { t: '새 계약', cls: 'pri', f: () => { G.closeModal(); G.newRun({ days: S.contract }); } }], true);
  };
  G.toTitle = function (wipe) { if (wipe) U.store.del('save'); else G.save(); location.hash = ''; ET.Main.toTitle(); };

  // ---------- multiplayer hooks ----------
  G.notable = function (txt) { if (G.S && G.S.mode === 'mp' && ET.Net) ET.Net.feed(txt); };
  G.pushNet = function (force) { if (G.S && G.S.mode === 'mp' && ET.Net) ET.Net.pushStatus(force); };
  G.status = function () {
    const S = G.S, best = G.allSwords().reduce((b, s) => s.lv > (b ? b.lv : -1) ? s : b, null);
    return { alive: S.alive, day: S.day, lives: S.lives, gold: Math.round(S.gold), paid: Math.round(G.counterTotal()), req: G.req(), settled: S.settled, phase: S.phase, best: best ? [best.type, best.lv] : null, anv: S.anvil ? [S.anvil.type, S.anvil.lv] : null, score: G.score(), dmg: Math.round(S.dragonDmg), fd: S.fightDone ? 1 : 0, kills: S.dragonKills };
  };
  G.receive = function (a, fromName) {
    const S = G.S; if (!S || !S.alive) return;
    const nm = U.esc(fromName || '누군가');
    if (a.k === 'gift') { if (S.rack.length >= G.rackMax()) { G.toast(nm + '의 선물을 받을 자리가 없다', 'bad'); return; } const s = sword(a.d.t, a.d.l); s.flat = a.d.f || 0; S.rack.push(s); F.syncRack(S.rack); G.toast(nm + '이(가) ' + U.esc(ET.TYPES[a.d.t] ? ET.TYPES[a.d.t].name : '검') + ' +' + (a.d.l | 0) + '을(를) 보냈다', 'good'); A.play('coin'); G.render(); return; }
    if (a.k === 'gold') { S.gold += Math.max(0, a.d.n | 0); G.toast(nm + '이(가) ' + U.fmt(a.d.n | 0) + ' G를 보냈다', 'good'); A.play('coin'); G.render(); return; }
    if (a.k === 'plea') { S.lives = Math.min(S.maxLives, S.lives + 1); G.toast(nm + '의 탄원으로 인내심 +1', 'good'); G.render(); return; }
    if (a.k === 'steal') { S.gold += Math.max(0, a.d.n | 0); G.toast('까마귀가 ' + U.fmt(a.d.n | 0) + ' G를 물어왔다', 'good'); G.render(); return; }
    if (!ET.CURSES[a.k]) return;
    const C = ET.CURSES[a.k];
    if (S.items.salt > 0) { S.items.salt--; G.toast(nm + '의 ' + C.name + '을(를) 정화 소금이 막았다', 'good'); G.render(); return; }
    if (S.has('ward') && !S.wardUsed && !a.refl) { S.wardUsed = true; ET.Net.sendAction(a.from, a.k, a.d, true); G.toast('거울 방패가 ' + C.name + '을(를) ' + nm + '에게 되돌렸다!', 'good'); return; }
    A.play('curse'); F.flashScreen('rgba(140,40,200,.35)');
    if (a.k === 'rust') S.rustHex = 6;
    if (a.k === 'chill') { if (S.anvil) { S.anvil.heat = 0; F.setAnvilSword(S.anvil); } S.rushG = 0; }
    if (a.k === 'raven') { const n = Math.round(S.gold * .15); S.gold -= n; ET.Net.sendAction(a.from, 'steal', { n }); }
    if (a.k === 'gaze' && !S.settled) S.gazeMul *= 1.12;
    G.toast((a.refl ? '반사된 ' : '') + nm + '의 ' + C.name + '! ' + C.d.replace('상대의 ', '').replace('상대 ', ''), 'curse');
    G.render(); G.pushNet();
  };
  G.castCurse = function (k) {
    const S = G.S, C = ET.CURSES[k], p = G.price(C.p); if (S.gold < p) return G.toast('골드가 부족합니다', 'bad');
    const foes = ET.Net.targets('foe'); if (!foes.length) return G.toast('저주할 상대가 없다', 'bad');
    G.modal('<h2 class="h">' + C.name + '</h2><p class="muted">' + C.d + ' · ' + U.fmt(p) + ' G</p><div class="slots">' + foes.map(f => '<button class="slot btn ghost" data-t="' + U.esc(f.id) + '" style="--tc:' + f.col + '"><span>' + U.esc(f.name) + '</span><span class="muted small">+' + (f.best || 0) + ' · ' + U.fmt(f.gold || 0) + ' G</span></button>').join('') + '</div>', [{ t: '취소' }]);
    U.$$('#modalCard [data-t]').forEach(b => b.onclick = () => { if (S.gold < p) return; S.gold -= p; ET.Net.sendAction(b.dataset.t, k, {}); G.ach('curse'); A.play('curse'); G.toast(C.name + ' 시전!', 'curse'); G.closeModal(); G.render(); });
  };
  G.gift = function (id) {
    const S = G.S, sw = S.rack.find(s => s.id === id); if (!sw) return; const mates = ET.Net.targets('mate'); if (!mates.length) return G.toast('선물할 팀원이 없다', 'bad');
    G.modal('<h2 class="h">검 선물</h2><p>' + U.esc(ET.TYPES[sw.type].name) + ' +' + sw.lv + '을(를) 누구에게?</p><div class="slots">' + mates.map(f => '<button class="slot btn ghost" data-t="' + U.esc(f.id) + '" style="--tc:' + f.col + '"><span>' + U.esc(f.name) + '</span><span class="muted small">' + U.fmt(f.paid || 0) + ' / ' + U.fmt(f.req || 0) + '</span></button>').join('') + '</div>', [{ t: '취소' }]);
    U.$$('#modalCard [data-t]').forEach(b => b.onclick = () => { const s = take(id); if (!s) return; ET.Net.sendAction(b.dataset.t, 'gift', { t: s.type, l: s.lv, f: s.flat }); G.syncAll(); G.closeModal(); G.toast('검을 보냈다', 'good'); G.render(); });
  };

  // ---------- UI helpers ----------
  G.toast = function (txt, cls) { const el = document.createElement('div'); el.className = 'toast ' + (cls || ''); el.textContent = txt; $('#toasts').appendChild(el); setTimeout(() => el.remove(), 3600); while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove(); };
  G.float = function (big, col, small) { const f = $('#float'); f.innerHTML = '<div style="color:' + col + '">' + U.esc(big) + (small ? '<small>' + small + '</small>' : '') + '</div>'; };
  G.banner = function (big, small) { G.float(big, '#ffe2b8', U.esc(small)); };
  F.flashScreen = function (col) { col = col.replace('.45)', '.3)').replace('.35)', '.22)'); const f = $('#flash'); f.style.transition = 'none'; f.style.background = col; f.style.opacity = 1; requestAnimationFrame(() => { f.style.transition = 'opacity .6s'; f.style.opacity = 0; }); };
  G.modal = function (html, btns, sticky) {
    const c = $('#modalCard'); c.innerHTML = html + (btns && btns.length ? '<div class="row" style="justify-content:flex-end;margin-top:14px">' + btns.map((b, i) => '<button class="btn ' + (b.cls || 'ghost') + '" data-mb="' + i + '">' + U.esc(b.t) + '</button>').join('') + '</div>' : '');
    (btns || []).forEach((b, i) => c.querySelector('[data-mb="' + i + '"]').onclick = () => { A.play('click'); G.closeModal(); b.f && b.f(); });
    const m = $('#modal'); m.classList.add('show'); m.onclick = e => { if (e.target === m && !sticky) G.closeModal(); };
  };
  G.closeModal = () => $('#modal').classList.remove('show');
  const heart = (on, col) => '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" fill="' + (on ? (col || '#a8372b') : 'rgba(255,255,255,.1)') + '"/></svg>';
  G.heartsHTML = (n, max, col) => Array.from({ length: max }, (_, i) => heart(i < n, col)).join('');
  // relic svg icons
  const ICON = {
    book: '<path d="M4 4h7c1 0 1 1 1 1v15s0-1-1-1H4zM20 4h-7c-1 0-1 1-1 1v15s0-1 1-1h7z"/>', clover: '<circle cx="9" cy="9" r="3.5"/><circle cx="15" cy="9" r="3.5"/><circle cx="9" cy="15" r="3.5"/><circle cx="15" cy="15" r="3.5"/><path d="M12 12l5 9" stroke-width="1.5"/>', oil: '<path d="M10 3h4v4l3 3v10H7V10l3-3z"/>', lens: '<path fill-rule="evenodd" d="M10 3a7 7 0 1 1 0 14a7 7 0 1 1 0-14zM10 6a4 4 0 1 0 0 8a4 4 0 1 0 0-8z"/><path d="M14.5 15.5l2-2 5 5-2 2z"/>', chest: '<path d="M3 10h18v10H3zM3 10c0-5 18-5 18 0M11 13h2v3h-2z"/>',
    glove: '<path d="M7 21v-8l-2-3 2-1 2 2V4h2v7-8h2v8-7h2v8-5h2v10l-2 6z"/>', stone: '<path d="M3 15l4-6h10l4 6-4 3H7z"/>', bellows: '<path d="M4 8l12-3 4 7-4 7-12-3z M20 12h2"/>', tooth: '<path d="M6 4c3-1 9-1 12 0 1 5-1 7-2 16-1 1-2 0-2-1l-1-6h-2l-1 6c0 1-1 2-2 1-1-9-3-11-2-16z"/>',
    seal: '<circle cx="12" cy="10" r="6"/><path d="M8 15l-2 6 6-3 6 3-2-6"/>', cloak: '<path d="M12 3l7 4-2 14H7L5 7z M9 7l3 3 3-3"/>', shoe: '<path d="M6 20V9a6 6 0 0 1 12 0v11h-3V9a3 3 0 0 0-6 0v11z"/>', heart: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>',
    scale: '<path d="M12 3v18M5 21h14M4 7h16M4 7l-2 6h6zM20 7l-2 6h6z"/>', shield: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>', pot: '<path d="M5 9h14l-2 11H7zM8 9c0-3 8-3 8 0M4 9h16"/>', bell: '<path d="M6 16a6 6 0 0 1 12 0v1H6zM12 5v4M10 20h4"/>',
    anvil: '<path d="M3 8h13l5-2v3h-4l-2 3H9L7 9H3zM9 12v4h6v-4M7 20h10l-2-4H9z"/>', feather: '<path d="M20 4C10 4 6 10 5 19l2 1c2-6 6-9 9-10-3 0-6 2-8 4 2-5 6-8 12-10z"/>', tear: '<path d="M12 3c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12z"/>',
    hammer: '<path d="M4 6h10v6H4zM14 7h3v4h-3zM8 12h2v9H8z"/>', chain: '<path d="M5 9a3 3 0 0 1 6 0v2a3 3 0 0 1-6 0zM13 13a3 3 0 0 1 6 0v2a3 3 0 0 1-6 0zM9 12l6 0"/>', hourglass: '<path d="M6 3h12v2l-5 7 5 7v2H6v-2l5-7-5-7z"/>', anvilstone: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/>', crown: '<path d="M3 18l2-10 4 5 3-7 3 7 4-5 2 10z"/>', eye: '<path d="M2 12c4-6 16-6 20 0-4 6-16 6-20 0z"/><ellipse cx="12" cy="12" rx="1.6" ry="4" fill="#120a07"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.3" fill="#120a07"/><circle cx="15" cy="15" r="1.3" fill="#120a07"/><circle cx="12" cy="12" r="1.3" fill="#120a07"/>', star: '<path d="M12 2l3 7 7 .5-5.5 4.5L18 21l-6-4-6 4 1.5-7L2 9.5 9 9z"/>', mirror: '<ellipse cx="12" cy="10" rx="6" ry="7"/><path d="M12 17v5M9 22h6"/>'
  };
  G.relicSVG = (tag, col) => '<svg viewBox="0 0 24 24" fill="' + (col || '#c9a66b') + '" stroke="rgba(0,0,0,.35)" stroke-width=".6">' + (ICON[tag] || ICON.star) + '</svg>';
  function swordSVG(s) { const T = ET.TYPES[s.type], c = '#' + T.glow.toString(16).padStart(6, '0'), tc = TIER_COL[ET.tierOf(s.lv)]; return '<svg viewBox="0 0 24 24"><path d="M19 2l3 1-1 3-11 11-3-3z" fill="' + tc + '" stroke="' + c + '" stroke-width="1"/><path d="M5 13l6 6M6 18l-3 3" stroke="' + c + '" stroke-width="2" fill="none"/></svg>'; }
  G.swordSVG = swordSVG;
  G.tierCol = lv => TIER_COL[ET.tierOf(lv)];

  // ---------- rendering ----------
  G.go = function (st, auto) { if (!auto) G.manualT = performance.now(); if (st === 'furnace') st = 'anvil'; G.station = st; U.$$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.st === st)); G.render(true); };
  G.render = function (force) {
    const S = G.S; if (!S) return; if (force) G.renderQuests();
    // top
    $('#dayN').textContent = S.day + '일차' + (S.endless ? ' · 무한' : ' / ' + S.contract);
    $('#evName').textContent = ET.EVENT[S.event].name;
    const tot = G.counterTotal(), req = G.req();
    $('#tribTxt').textContent = U.fmt(tot) + ' / ' + U.fmt(req) + ' G';
    const m = $('#tribMeter'); m.querySelector('i').style.width = Math.min(100, tot / Math.max(1, req) * 100) + '%'; m.classList.toggle('ok', tot >= req);
    $('#hearts').innerHTML = G.heartsHTML(Math.max(0, S.lives), S.maxLives);
    $('#goldTxt').textContent = U.fmt(S.gold) + ' G';
    $('#relicStrip').innerHTML = S.relics.map(id => { const R = ET.RELIC[id]; return '<button class="rel r' + R.r + '" data-rel="' + id + '">' + G.relicSVG(R.tag, R.r === 3 ? '#d6aa5a' : R.r === 2 ? '#9ec0e0' : '#c9a66b') + '</button>'; }).join('') + (S.rustHex > 0 ? '<div class="rel" title="녹의 저주" style="border-color:#b45cff">' + G.relicSVG('shield', '#b45cff') + '</div>' : '');
    U.$$('#relicStrip [data-rel]').forEach(b => { const R = ET.RELIC[b.dataset.rel]; tipOn(b, '<b>' + U.esc(R.name) + '</b> <span class="r' + R.r + 't">' + ET.RAR[R.r] + '</span><br>' + U.esc(R.d) + '<br><span class="muted small">눌러서 버리기</span>'); b.onclick = () => G.dropRelic(R.id); });
    const nb = $('#nav [data-st="tribute"]'); nb.querySelector('.badge') && nb.querySelector('.badge').remove(); if (S.counter.length) nb.insertAdjacentHTML('beforeend', '<span class="badge">' + S.counter.length + '</span>');
    renderPanel(force);
  };
  function tipOn(el, html) { const t = $('#tip'); el.onmouseenter = e => { t.innerHTML = html; t.style.display = 'block'; const r = el.getBoundingClientRect(); t.style.left = Math.min(innerWidth - 270, r.left) + 'px'; t.style.top = (r.bottom + 6) + 'px'; }; el.onmouseleave = () => t.style.display = 'none'; }
  function oddsHTML(o) { return '<div class="odds">' + ['gs', 's', 'h', 'd', 'b'].map(k => '<div style="flex-basis:' + (o[k] * 100).toFixed(1) + '%;background:' + OUT_COL[k] + '">' + (o[k] > .06 ? Math.round(o[k] * 100) + '%' : '') + '</div>').join('') + '</div><div class="legend">' + ['gs', 's', 'h', 'd', 'b'].map(k => '<span style="--c:' + OUT_COL[k] + '">' + OUT_NAME[k] + ' ' + (o[k] * 100).toFixed(1) + '%</span>').join('') + '</div>'; }
  function swCard(s, btns) { return '<div class="sw"><div class="tierbar" style="--tc:' + G.tierCol(s.lv) + '"></div><div class="t"><span>' + U.esc(ET.stageName(s.lv, s.type)) + '</span><i>+' + s.lv + '</i></div><div class="v">' + U.fmt(G.val(s)) + ' G' + (s.lv >= ET.FINAL_LV ? ' · 고유기' : '') + '</div><div class="r">' + btns + '</div></div>'; }
  function waitHTML() {
    const S = G.S;
    if (S.phase === 'wait') return '<h3 class="h">공물 정산 완료</h3><p class="muted">다른 대장장이들이 종을 칠 때까지 기다리는 중… 다음 날은 모두 준비되거나 제한시간이 끝나면 시작됩니다.</p>';
    if (S.phase === 'dead') return '<h3 class="h">탈락</h3><p class="muted">용의 인내심이 바닥났습니다. 오른쪽에서 라이벌들의 대장간을 지켜보세요.</p>';
    if (S.phase === 'fightdone') return '<h3 class="h">전투 종료</h3><p class="muted">다른 대장장이들의 전투가 끝나길 기다리는 중…</p>';
    if (S.phase === 'settle') return '<h3 class="h">종이 울린다…</h3>';
    if (S.phase === 'prefight') return '<h3 class="h">결전 준비</h3><p class="muted">싸울 검을 고르세요.</p><button class="btn pri" id="pfAgain">검 고르기</button>';
    return '';
  }
  function renderPanel(force) {
    const S = G.S, P = $('#panel'), st = G.station;
    if (S.phase !== 'forge') { const h = waitHTML(); if (P.dataset.k !== 'w' + S.phase || force) { P.innerHTML = h; P.dataset.k = 'w' + S.phase; const b = $('#pfAgain'); if (b) b.onclick = () => G.prepareFight(); } return; }
    P.dataset.k = st;
    let h = '';
    if (st === 'anvil' || st === 'furnace') {
      const sw = S.anvil;
      if (!sw) {
        h = '<h3 class="h">모루가 비어 있다</h3><p class="muted small" style="margin:0 0 10px">거치대의 검을 골라 모루에 올리세요.</p>' + (S.rack.length ? '<div class="swlist">' + S.rack.map(s => swCard(s, '<button class="btn pri" data-anv="' + s.id + '">모루로</button>')).join('') + '</div>' : '<div class="empty">거치대에 검이 없다. 상인에게서 사거나 내일을 기다리세요.</div>');
      } else {
        const T = ET.TYPES[sw.type], o = ET.odds(sw, S, 'good'), heatC = sw.heat < 25, M = ET.masteryOf(S.strikes), nxt = ET.nextStage(sw.lv), chain = S.has('chain');
        const nextM = Math.pow(M + 1, 2) * 8 - (S.strikes || 0), cap = ET.comboCap(M, chain), cb = ET.comboBonus(S.combo || 0, M, chain);
        h = (F.near('anvil') ? '' : '<button class="btn" data-walk="anvil" style="width:100%;margin-bottom:8px">모루 앞으로 걸어가기</button>') +
          '<div class="swhead"><div><div class="swname">' + U.esc(ET.stageName(sw.lv, sw.type)) + ' <span class="lv">+' + sw.lv + '</span></div><div class="muted small">' + (nxt != null ? '+' + nxt + '에서 진화' : '최종 진화') + (sw.lv >= ET.FINAL_LV ? ' · 결전 고유기 ' + T.abName : ' · +' + ET.FINAL_LV + '부터 결전 고유기') + '</div></div><div class="val">' + U.fmt(G.val(sw)) + ' G</div></div>' +
          oddsHTML(o) +
          '<div class="statline"><span>연타 <b>' + (S.combo || 0) + '</b>' + (cb ? ' <i>+' + cb + '강</i>' : '') + '</span><span>숙련 <b>' + M + '</b>' + (M < 40 ? ' <small>(' + nextM + '타 남음)</small>' : '') + '</span><span>연타 보너스 최대 <b>+' + cap + '</b></span>' + (S.golden > 0 ? '<span class="goldtag">황금 불꽃!</span>' : '') + '</div>' +
          '<div class="stick"><div id="timing"><div class="good" id="tg"></div><div class="perf" id="tp"></div><div class="needle" id="tn"></div><div class="lbl" id="tl">타이밍</div></div>' +
          '<div class="bars"><div>열기 ' + (heatC ? '<b style="color:var(--blood)">식었다! 대성공 불가</b>' : '') + '<div class="bar"><i id="heatBar" style="width:' + sw.heat + '%"></i></div></div><div>불꽃 폭주' + (S.rustHex > 0 ? ' · <b style="color:#c88cff">녹의 저주 ' + S.rustHex + '</b>' : '') + '<div class="pips' + (S.rushT > 0 ? ' rush' : '') + '" id="pips">' + Array.from({ length: 14 }, (_, i) => '<b class="' + (i < S.rushG ? 'on' : '') + '"></b>').join('') + '</div></div></div>' +
          '<div class="acts"><button class="btn pri" id="bStrike"' + (G.heating ? ' disabled' : '') + '>' + (G.heating ? '가열 중…' : G.hold ? '자동 타격 중…' : '타격') + '<kbd>Space · 꾹 누르면 연속</kbd></button><button class="btn" id="bHeat">가열<kbd>H</kbd></button>' + (S.items.chip ? '<button class="btn" id="bChip"' + (S.chipNext ? ' disabled' : '') + '>숫돌 ' + S.items.chip + '</button>' : '') + '<button class="btn ghost" id="bOff">거치대로<kbd>R</kbd></button><button class="btn ghost" id="bTo">공물대로<kbd>T</kbd></button></div>' +
          '<div class="auto"><label>목표 <select id="pTarget">' + [0, 10, 15, 20, 30, 40, 50, 75, 100, 150].map(v => '<option value="' + v + '"' + (G.prefs.target === v ? ' selected' : '') + '>' + (v ? '+' + v + '에서 멈춤' : '목표 없음') + '</option>').join('') + '</select></label><label>안전 정지 <select id="pSafe">' + [0, 5, 10, 15, 20, 30].map(v => '<option value="' + v + '"' + (G.prefs.safeB === v ? ' selected' : '') + '>' + (v ? '파괴 ' + v + '% 초과 시' : '끔') + '</option>').join('') + '</select></label><label class="chk"><input type="checkbox" id="pHeat"' + (G.prefs.autoHeat ? ' checked' : '') + '> 자동 가열</label></div></div>';
      }
    } else if (st === 'rack') {
      const team = S.mode === 'mp' && ET.Net && ET.Net.mode === 'team';
      h = '<div class="swhead"><h3 class="h">검 거치대 <span class="muted small">' + S.rack.length + ' / ' + G.rackMax() + '</span></h3><div class="row"><button class="btn sm ghost" id="bSort">가치순 정렬</button><button class="btn sm ghost" id="bAllCtr">전부 공물대로</button><button class="btn sm ghost" id="bJunk">잡검 판매</button></div></div>' + (S.rack.length ? '<div class="swlist">' + S.rack.map(s => swCard(s, '<button class="btn pri" data-anv="' + s.id + '">모루</button><button class="btn" data-ctr="' + s.id + '">공물</button><button class="btn ghost" data-sell="' + s.id + '">판매</button>' + (team ? '<button class="btn ghost" data-gift="' + s.id + '">선물</button>' : ''))).join('') + '</div>' : '<div class="empty">거치대가 비어 있다.</div>') + (S.anvil ? '<p class="muted small">모루 위: ' + U.esc(ET.TYPES[S.anvil.type].name) + ' +' + S.anvil.lv + '</p>' : '');
    } else if (st === 'tribute') {
      const tot = G.counterTotal(), req = G.req();
      h = '<div class="swhead"><h3 class="h">공물대</h3><div class="val">' + U.fmt(tot) + ' <span class="muted small">/ ' + U.fmt(req) + ' G</span></div></div>' +
        (S.counter.length ? '<div class="swlist">' + S.counter.map(s => swCard(s, '<button class="btn ghost" data-rack="' + s.id + '">빼기</button>')).join('') + '</div>' : '<div class="empty">공물대가 비어 있다. 바칠 검을 올리세요.</div>') +
        (S.rack.length ? '<p class="muted small" style="margin:10px 0 6px">거치대에서 올리기</p><div class="row">' + S.rack.map(s => '<button class="btn sm" data-ctr="' + s.id + '">' + U.esc(ET.TYPES[s.type].name) + ' +' + s.lv + ' · ' + U.fmt(G.val(s)) + '</button>').join('') + '</div>' : '') +
        '<div class="row" style="margin-top:8px"><button class="btn sm" id="bAutoT">최소 가치로 자동 선택</button><button class="btn sm ghost" id="bClearT">공물대 비우기</button></div>' +
        (F.near('tribute') ? '' : '<button class="btn" data-walk="tribute" style="width:100%;margin-top:8px">공물대로 걸어가기</button>') +
        '<div class="acts" style="margin-top:8px"><button class="btn ' + (tot >= req ? 'gold' : 'pri') + '" id="bBell">종 치기 · 공물 바치기<kbd>B</kbd></button>' + (S.endless && S.dragonKills ? '<button class="btn ghost" id="bRematch">이그나르 재대결</button>' : '') + '</div>' +
        '<p class="muted small">초과분의 ' + (S.has('tooth') ? 90 : 50) + '%는 골드로 돌려받습니다. 종을 치기 전에는 언제든 뺄 수 있어요.</p>' +
        '<p class="muted small">내일 공물 <b>' + U.fmt(ET.tributeFor(S.day + 1)) + ' G</b> · 내일 사건 「' + ET.EVENT[ET.eventFor(S.seed, S.day + 1)].name + '」</p>';
    } else if (st === 'quests') {
      h = '<h3 class="h">오늘의 의뢰</h3><p class="muted small">의뢰 게시판의 일거리. 완료하면 바로 보상을 받습니다. 의뢰는 매일 바뀌어요.</p>' + (S.quests || []).map(q => '<div class="offer"><div class="ic">' + G.relicSVG(q.done ? 'book' : 'seal', q.done ? '#8fb78f' : '#c9a66b') + '</div><div><div class="n">' + U.esc(q.t) + '</div><div class="d">보상 ' + U.esc(G.questRewardText(q)) + (q.k === 'offer' ? ' · 공물대에 올리고 종을 치면 완료' : q.k === 'nobreak' ? ' · 종을 칠 때까지 파괴 0' : '') + '</div></div><b class="price">' + (q.done ? '완료' : q.failed ? '실패' : (q.k === 'offer' || q.k === 'nobreak' ? '…' : Math.min(q.prog, q.n) + '/' + q.n)) + '</b></div>').join('') + '<p class="muted small">완료한 의뢰 ' + (S.questsDone || 0) + '개</p>';
    } else if (st === 'relics') {
      h = '<h3 class="h">유물 전시장</h3><p class="muted small">가진 유물은 모두 이 진열장에 놓입니다. 눌러서 버릴 수 있어요.</p>' + (S.relics.length ? S.relics.map(id => { const R0 = ET.RELIC[id]; return '<div class="offer"><div class="ic">' + G.relicSVG(R0.tag, R0.r === 3 ? '#d6aa5a' : R0.r === 2 ? '#9ec0e0' : '#c9a66b') + '</div><div><div class="n">' + U.esc(R0.name) + '<small class="r' + R0.r + 't">' + ET.RAR[R0.r] + '</small></div><div class="d">' + U.esc(R0.d) + '</div></div><button class="btn sm ghost" data-drop="' + id + '">버리기</button></div>'; }).join('') : '<div class="empty">아직 유물이 없다. 재의 상인에게서 사 오세요.</div>') +
        '<p class="muted small">단련 상태 · 망치 ' + (S.upg.hammer || 0) + ' · 모루 ' + (S.upg.anvil || 0) + ' · 화로 ' + (S.upg.forge || 0) + ' · 거치대 ' + (S.upg.rack || 0) + ' · 숙련 ' + ET.masteryOf(S.strikes) + '</p>';
    } else if (st === 'shop') {
      const tab = G.shopTab || 'relic', mp = S.mode === 'mp';
      h = (F.near('shop') ? '' : '<button class="btn" data-walk="shop" style="width:100%;margin-bottom:8px">상인에게 걸어가기</button>') + '<div class="swhead"><h3 class="h">재의 상인</h3><button class="btn sm ghost" id="bReroll">새로고침 · ' + U.fmt(G.rerollPrice()) + ' G</button></div><div class="seg shoptabs" style="margin-top:8px">' + [['relic', '유물'], ['up', '단련'], ['sword', '검'], ['item', '도구']].concat(mp ? [['curse', '저주']] : []).map(([k, n]) => '<button data-tab="' + k + '" class="' + (tab === k ? 'on' : '') + '">' + n + '</button>').join('') + '</div>';
      if (tab === 'relic') h += S.shop.relics.map((o, i) => { const R = ET.RELIC[o.id], p = G.price(R.p); return '<div class="offer"><div class="ic">' + G.relicSVG(R.tag, R.r === 3 ? '#d6aa5a' : R.r === 2 ? '#9ec0e0' : '#c9a66b') + '</div><div><div class="n">' + U.esc(R.name) + '<small class="r' + R.r + 't">' + ET.RAR[R.r] + '</small></div><div class="d">' + U.esc(R.d) + '</div></div><button class="btn sm ' + (o.sold ? 'ghost' : 'gold') + '" data-br="' + i + '"' + (o.sold || S.gold < p ? ' disabled' : '') + '>' + (o.sold ? '판매됨' : U.fmt(p) + ' G') + '</button></div>'; }).join('') + '<p class="muted small">유물 ' + S.relics.length + ' / ' + ET.MAX_RELICS + '칸 · 상점은 매일 바뀝니다</p>';
      if (tab === 'up') h += Object.keys(ET.UPGRADES).map(k => { const u0 = ET.UPGRADES[k], lv = S.upg[k] || 0, mx = lv >= u0.max, p = mx ? 0 : G.upPrice(k); return '<div class="offer"><div class="ic">' + G.relicSVG(k === 'hammer' ? 'hammer' : k === 'anvil' ? 'anvil' : k === 'forge' ? 'bellows' : 'chain', '#c9a66b') + '</div><div><div class="n">' + u0.name + ' <small>' + lv + ' / ' + u0.max + '</small></div><div class="d">' + u0.d + '</div></div><button class="btn sm gold" data-up="' + k + '"' + (mx || S.gold < p ? ' disabled' : '') + '>' + (mx ? '최대' : U.fmt(p) + ' G') + '</button></div>'; }).join('') + '<p class="muted small">단련은 계약이 끝날 때까지 유지됩니다. 후반으로 갈수록 강화가 폭발적으로 쉬워져요.</p>';
      if (tab === 'sword') h += S.shop.swords.map((o, i) => { const T = ET.TYPES[o.type], p = G.price(T.price); return '<div class="offer"><div class="ic">' + swordSVG({ type: o.type, lv: 0 }) + '</div><div><div class="n">' + U.esc(T.name) + (T.rare ? '<small class="r3t">희귀</small>' : '') + '</div><div class="d">' + U.esc(T.desc) + ' 기본가 ' + T.base + ' G · 최종 고유기 「' + T.abName + '」</div></div><button class="btn sm ' + (o.sold ? 'ghost' : 'gold') + '" data-bs="' + i + '"' + (o.sold || S.gold < p ? ' disabled' : '') + '>' + (o.sold ? '판매됨' : U.fmt(p) + ' G') + '</button></div>'; }).join('');
      if (tab === 'item') h += S.shop.items.map(k => { const it = ET.ITEMS[k], p = G.price(it.p); return '<div class="offer"><div class="ic">' + G.relicSVG(it.tag) + '</div><div><div class="n">' + it.name + (k === 'chest' ? ' <small>즉시 개봉</small>' : ' <small>보유 ' + (S.items[k] || 0) + '</small>') + '</div><div class="d">' + it.d + '</div></div><button class="btn sm gold" data-bi="' + k + '"' + (S.gold < p ? ' disabled' : '') + '>' + U.fmt(p) + ' G</button></div>'; }).join('');
      if (tab === 'curse') h += Object.keys(ET.CURSES).map(k => { const c = ET.CURSES[k], p = G.price(c.p); return '<div class="offer"><div class="ic">' + G.relicSVG('tear', '#c88cff') + '</div><div><div class="n">' + c.name + '</div><div class="d">' + c.d + '</div></div><button class="btn sm pri" data-bc="' + k + '"' + (S.gold < p ? ' disabled' : '') + '>' + U.fmt(p) + ' G</button></div>'; }).join('') + '<p class="muted small">정화 소금(도구)과 거울 방패(유물)로 막을 수 있습니다.</p>';
    }
    P.innerHTML = h;
    // bind
    const on = (sel, f) => U.$$('#panel ' + sel).forEach(b => b.onclick = () => { A.play('click'); f(b); });
    on('[data-anv]', b => G.toAnvil(b.dataset.anv)); on('[data-ctr]', b => G.toCounter(b.dataset.ctr)); on('[data-rack]', b => G.toRack(b.dataset.rack)); on('[data-sell]', b => G.sell(b.dataset.sell)); on('[data-gift]', b => G.gift(b.dataset.gift));
    on('[data-br]', b => G.buyRelic(+b.dataset.br)); on('[data-bs]', b => G.buySword(+b.dataset.bs)); on('[data-bi]', b => G.buyItem(b.dataset.bi)); on('[data-bc]', b => G.castCurse(b.dataset.bc));
    on('[data-tab]', b => { G.shopTab = b.dataset.tab; G.render(); });
    on('[data-up]', b => G.buyUp(b.dataset.up)); on('[data-walk]', b => F.walkTo(b.dataset.walk)); on('[data-drop]', b => G.dropRelic(b.dataset.drop));
    const sel = (id, f) => { const e = $('#' + id); if (e) e.onchange = () => { f(e); G.savePrefs(); }; };
    sel('pTarget', e => G.prefs.target = +e.value); sel('pSafe', e => G.prefs.safeB = +e.value); sel('pHeat', e => G.prefs.autoHeat = e.checked);
    const sb = $('#bStrike'); if (sb) { sb.onclick = null; sb.onpointerdown = e => { e.preventDefault(); G.strike(); G.holdT = performance.now(); G.hold = true; }; const up = () => { if (G.hold && performance.now() - G.holdT < 350) G.hold = false; else G.hold = false; }; sb.onpointerup = up; sb.onpointerleave = up; sb.onpointercancel = up; }
    const bind = (id, f) => { const e = $('#' + id); if (e) e.onclick = f; };
    bind('bHeat', () => G.heat()); bind('bOff', () => S.anvil && G.toRack(S.anvil.id)); bind('bTo', () => S.anvil && G.toCounter(S.anvil.id)); bind('bChip', () => G.useChip());
    bind('bBell', () => G.ringBell()); bind('bSort', () => { S.rack.sort((a, b) => G.val(b) - G.val(a)); G.syncAll(); G.render(); }); bind('bAllCtr', () => { S.rack.slice().forEach(x => G.toCounter(x.id)); }); bind('bAutoT', () => G.autoTribute()); bind('bJunk', () => G.sellJunk()); bind('bClearT', () => { S.counter.slice().forEach(x => G.toRack(x.id)); }); bind('bReroll', () => G.reroll()); bind('bRematch', () => G.rematch());
    G.layoutTiming();
  }
  G.layoutTiming = function () { const z = G.timingZones(); const g = $('#tg'), p = $('#tp'); if (!g) return; g.style.left = (50 - z.wg * 100) + '%'; g.style.width = (z.wg * 200) + '%'; p.style.left = (50 - z.wp * 100) + '%'; p.style.width = (z.wp * 200) + '%'; };

  // ---- daily commissions ----
  G.questRewardText = q => q.rw.gold ? U.fmt(G.questGold(q)) + ' G' : (ET.ITEMS[q.rw.item] ? ET.ITEMS[q.rw.item].name : '') + ' ×' + q.rw.n;
  G.questGold = q => Math.round(q.rw.gold * ET.tributeFor(G.S.day) * (G.S.has('ledger') ? 1.6 : 1) / 10) * 10;
  G.qdone = function (q) {
    if (q.done) return; q.done = true; const S = G.S;
    if (q.rw.gold) S.gold += G.questGold(q); else if (q.rw.item === 'chest') G.openChest(true); else S.items[q.rw.item] = (S.items[q.rw.item] || 0) + q.rw.n * (S.has('ledger') ? 2 : 1);
    A.play('win'); G.toast('의뢰 완료 · ' + q.t + ' → ' + G.questRewardText(q), 'good'); G.ach('quest');
    S.questsDone = (S.questsDone || 0) + 1; if (S.questsDone >= 15) G.ach('quest15');
    F.syncBoard && F.syncBoard(S.quests); G.renderQuests();
  };
  G.qp = function (k, n) { const S = G.S; if (!S || !S.quests) return; S.quests.forEach(q => { if (q.k === k && !q.done) { q.prog += n; if (q.prog >= q.n) G.qdone(q); else G.renderQuests(); } }); };
  G.qmax = function (k, v) { const S = G.S; if (!S || !S.quests) return; S.quests.forEach(q => { if (q.k === k && !q.done && v > q.prog) { q.prog = v; if (q.prog >= q.n) G.qdone(q); else G.renderQuests(); } }); };
  G.qfail = function (k) { const S = G.S; if (!S || !S.quests) return; S.quests.forEach(q => { if (q.k === k && !q.done) { q.failed = true; G.renderQuests(); } }); };
  G.questSettle = function () {
    const S = G.S; if (!S.quests) return;
    S.quests.forEach(q => {
      if (q.done) return;
      if (q.k === 'offer' && S.counter.some(x => x.type === q.ty && x.lv >= q.n)) G.qdone(q);
      if (q.k === 'nobreak' && !q.failed) G.qdone(q);
    });
  };
  G.renderQuests = function () {
    const S = G.S, el = $('#quests'); if (!el) return; if (!S || !S.quests) { el.innerHTML = ''; return; }
    el.innerHTML = S.quests.map(q => '<div class="q' + (q.done ? ' done' : q.failed ? ' fail' : '') + '"><span>' + U.esc(q.t) + '</span><b>' + (q.done ? '완료' : q.failed ? '실패' : (q.k === 'offer' || q.k === 'nobreak' ? '정산 때' : Math.min(q.prog, q.n) + '/' + q.n)) + '</b></div>').join('');
    F.syncBoard && F.syncBoard(S.quests);
  };
  G.openChest = function (free) {
    const S = G.S; if (S.rack.length >= G.rackMax()) { S.gold += free ? 0 : G.price(ET.ITEMS.chest.p); return G.toast('거치대가 가득 차 상자를 열 수 없어 환불했다', 'bad'); }
    const r = Math.random(), keys = ET.TYPE_KEYS.filter(k => k !== 'iron');
    let t = keys[Math.floor(Math.random() * keys.length)]; if (ET.TYPES[t].rare && Math.random() < .5) t = keys[Math.floor(Math.random() * keys.length)];
    const lv = Math.floor(Math.pow(r, 2.2) * (4 + S.day * 1.4)); const sw2 = sword(t, lv); S.rack.push(sw2); G.seen('type', t);
    F.syncRack(S.rack); A.play('gs'); G.float('상자 개봉!', 'var(--gs)', U.esc(ET.stageName(lv, t)) + ' +' + lv);
  };
  G.sellJunk = function () {
    const S = G.S, req = G.req(); const keep = S.rack.slice().sort((a, b) => G.val(b) - G.val(a)).slice(0, 3).map(x => x.id);
    const junk = S.rack.filter(x => !keep.includes(x.id) && G.val(x) < req * .08); if (!junk.length) return G.toast('팔 만한 잡검이 없다');
    const total = junk.reduce((a, x) => a + Math.round(G.val(x) * (ET.TYPES[x.type].sell || .4) * (S.has('seal') ? 1.25 : 1)), 0);
    G.modal('<h2 class="h">잡검 일괄 판매</h2><p>오늘 공물의 8%도 안 되는 검 ' + junk.length + '자루를 <b class="gold">' + U.fmt(total) + ' G</b>에 팝니다. (가장 비싼 3자루는 남김)</p>', [{ t: '취소' }, { t: '판매', cls: 'gold', f: () => { junk.forEach(x => take(x.id)); S.gold += total; G.qp('sell', junk.length); A.play('coin'); G.syncAll(); G.render(); } }]);
  };
  G.autoTribute = function () {
    const S = G.S; if (!G.canAct() || S.settled) return; const req = G.req();
    const pool = S.rack.concat(S.counter); S.counter.slice().forEach(x => G.toRack(x.id));
    const byV = pool.slice().sort((a, b) => G.val(a) - G.val(b));
    const single = byV.find(x => G.val(x) >= req); let pick = [];
    if (single) pick = [single]; else { let t = 0; for (const x of byV.slice().reverse()) { if (t >= req) break; pick.push(x); t += G.val(x); } for (let i = pick.length - 1; i >= 0; i--) { const v = G.val(pick[i]); if (t - v >= req) { t -= v; pick.splice(i, 1); } } }
    pick.forEach(x => G.toCounter(x.id));
    G.toast(pick.length ? '검 ' + pick.length + '자루를 골랐다 · ' + U.fmt(G.counterTotal()) + ' / ' + U.fmt(req) : '고를 검이 없다', pick.length && G.counterTotal() >= req ? 'good' : 'bad');
  };
  // per-frame
  G.tick = function (dt) {
    const S = G.S; if (!S) return;
    if (S.golden > 0) { S.golden -= dt; if (S.golden <= 0) { S.golden = 0; F.goldenFx && F.goldenFx(false); } }
    if (S.phase === 'forge' && S.anvil) {
      const sw = S.anvil, nearA = F.near('anvil');
      if (G.prefs.autoHeat && nearA && sw.heat < 25 && !G.heating && !G.busy && !(F.hammerAnim > 0)) G.heat();
      if (G.hold && !G.busy && !G.heating && !(F.hammerAnim > 0)) {
        if (!nearA) G.hold = false;
        else if (G.prefs.safeB && ET.odds(sw, S, 'good').b * 100 > G.prefs.safeB && S.rushT <= 0 && S.golden <= 0) { G.hold = false; G.toast('안전 정지 — 파괴 확률이 ' + G.prefs.safeB + '%를 넘었다', 'bad'); G.render(); }
        else if (G.prefs.target && sw.lv >= G.prefs.target) { G.hold = false; G.render(); }
        else G.strike();
      }
    } else G.hold = false;
    // panel follows where you stand
    const ns = F.nearest && F.nearest(); if (ns !== G.lastNear) { G.lastNear = ns; if (ns && ns !== G.station && !F.walk && performance.now() - (G.manualT || 0) > 800) G.go(ns, true); }
    if (performance.now() - (G.nearRT || 0) > 600) { G.nearRT = performance.now(); const key = ['anvil', 'tribute', 'shop'].map(k => F.near(k) ? 1 : 0).join(''); if (key !== G.nearKey) { G.nearKey = key; G.render(); } }
    if (S.rushT > 0) { S.rushT -= dt; if (S.rushT <= 0) { S.rushT = 0; F.rushFx(false); G.render(); } }
    if (S.anvil && S.phase === 'forge') {
      const sp = Math.min(2.1, .85 + S.anvil.lv * .03) * (S.rushT > 0 ? .8 : 1) * Math.pow(.985, ET.masteryOf(S.strikes));
      G.timing.t += dt * sp; const x = G.timing.t % 2; G.timing.pos = x < 1 ? x : 2 - x;
      const n = $('#tn'); if (n) { n.style.left = (G.timing.pos * 100) + '%'; const q = G.timingQ(); const l = $('#tl'); if (l) l.textContent = q === 'perfect' ? '완벽!' : q === 'good' ? '좋음' : '빗나감'; }
      const pp = $('#pips'); if (pp && S.rushT > 0) pp.style.opacity = .6 + .4 * Math.sin(performance.now() / 80);
    }
  };
})(window.ET);
