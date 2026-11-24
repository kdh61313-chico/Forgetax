/* EMBER TITHE — multiplayer over the artifact room (presence-only protocol) */
'use strict';
(function (ET) {
  const U = ET.U, $ = U.$, A = ET.Audio;
  const N = ET.Net = { room: null, r: null, code: null, peers: [], g: null, isHost: false, mode: 'ffa', seen: new Set(), out: [], inGame: false, myPeer: null, lastSt: {}, feedSeen: new Set(), emSeen: new Set(), ready: false };
  const PAL = ['#cf8a3e', '#7f9fc4', '#8fb78f', '#a88ac8', '#d6b45a', '#c47080', '#6fb0a8', '#a8a49c'];
  const TEAM = { A: { n: '홍염단', c: '#c4503c' }, B: { n: '청강단', c: '#5f8fc4' } };
  const EMOTES = ['ㅋㅋㅋ', '살려줘', '부숴라!', 'GG', '대박', '억까', '고마워', '덤벼'];
  const BOTN = ['쇠망치 철수', '화덕 영희', '모루지기', '불씨 돌쇠', '녹슨 박씨', '용비늘 김씨', '숯검댕이'];
  N.TEAM = TEAM;

  N.init = async function () {
    try { if (window.claude && window.claude.use) N.room = await window.claude.use('room'); } catch (e) { N.room = null; }
    if (N.room) N.transport = 'claude';
    else if (ET.P2P && ET.P2P.available()) { N.room = ET.P2P; N.transport = 'p2p'; }
    N.ready = true; return N.room;
  };
  const genCode = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };
  N.nick = () => (($('#nick').value || '').trim().slice(0, 12)) || '이름 없는 대장장이';

  N.create = async function (cfg) { for (let i = 0; i < 4; i++) { try { return await N.enter(genCode(), cfg); } catch (e) { if (e.code !== 'taken') throw e; } } throw new Error('방 코드를 만들지 못했습니다'); };
  N.enter = async function (code, cfg) {
    if (!N.room) throw new Error('no room');
    code = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); if (code.length !== 5) throw new Error('code');
    N.code = code; N.seen = new Set(); N.out = []; N.inGame = false; N.g = null; N.resultsShown = false;
    N.r = await N.room.join('et-' + code.toLowerCase(), { host: !!cfg });
    if (N.r.onDrop) N.r.onDrop(() => { if (!N.r) return; ET.G.toast('방장과의 연결이 끊겼습니다', 'bad'); N.leave(); ET.Main.toTitle(); ET.G.modal('<h2 class="h">연결 끊김</h2><p>방장이 나갔거나 네트워크가 끊겨 방이 닫혔습니다.</p>', [{ t: '확인', cls: 'pri' }]); });
    N.ja = Date.now();
    const p = { v: 1, nick: N.nick(), ja: N.ja, team: null, st: null, out: [], fd: null, em: null };
    if (cfg) { N.g = { ph: 'lobby', mode: cfg.mode, max: cfg.max, days: cfg.days, len: cfg.len, seed: 0, day: 0, end: 0, fEnd: 0, bots: [], ros: [], ep: 1, created: Date.now(), now: Date.now() }; p.g = N.g; }
    N.off = 0;
    await N.r.presence(p);
    N.unsub = N.r.onPeers(ch => { N.peers = ch.peers; N.flow(); });
    clearInterval(N.iv); N.iv = setInterval(() => N.flow(), 400);
    return code;
  };
  N.leave = async function () { clearInterval(N.iv); try { N.unsub && N.unsub(); await (N.r && N.r.leave()); } catch (e) { } N.r = null; N.code = null; N.g = null; N.inGame = false; N.peers = []; };

  // ---------- helpers ----------
  const viewers = () => N.peers.filter(p => p.kind === 'viewer' && p.presence && typeof p.presence.ja === 'number');
  // host = the P2P hub if there is one; otherwise whoever already carries the game object (oldest), then the earliest joiner
  N.hostPeer = function () {
    if (N.r && N.r.hubId) { const h = N.r.hubId(); const p = N.peers.find(x => x.peer === h); if (p) return p; }
    const v = viewers();
    const withG = v.filter(p => p.presence.g && typeof p.presence.g === 'object').sort((a, b) => (+a.presence.g.created || 0) - (+b.presence.g.created || 0) || (a.peer < b.peer ? -1 : 1));
    if (withG.length) return withG[0];
    return v.slice().sort((a, b) => a.presence.ja - b.presence.ja || (a.peer < b.peer ? -1 : 1))[0] || null;
  };
  N.now = () => Date.now() + (N.isHost ? 0 : (N.off || 0));
  N.me = () => N.peers.find(p => p.sameTab);
  N.peerById = id => N.peers.find(p => p.peer === id);
  N.nameOf = function (id) { if (!id) return '누군가'; if (id.startsWith('bot')) { const b = (N.g && N.g.bots || []).find(x => x.id === id); return b ? b.n : '봇'; } const p = N.peerById(id); if (p && p.presence.nick) return String(p.presence.nick).slice(0, 12); const r = N.g && N.g.ros.find(x => x[0] === id); return r ? r[1] : '누군가'; };
  N.colorOf = function (id, team) { if (N.g && N.g.mode === 'team') return team && TEAM[team] ? TEAM[team].c : '#aaa'; const i = N.g ? N.g.ros.findIndex(x => x[0] === id) : 0; return PAL[(i < 0 ? 0 : i) % PAL.length]; };
  function setP(patch) { if (N.r) N.r.presence(patch).catch(() => { }); }

  // entries in the match (humans + bots)
  N.entries = function () {
    const g = N.g; if (!g) return [];
    return g.ros.map(([id, name, team, bot]) => {
      if (bot) { const b = g.bots.find(x => x.id === id) || {}; return { id, name, team, bot: true, st: b.st || {}, present: true }; }
      const p = N.peerById(id); const st = (p && p.presence.st) || N.lastSt[id] || {}; if (p && p.presence.st) N.lastSt[id] = p.presence.st;
      return { id, name: p && p.presence.nick ? String(p.presence.nick).slice(0, 12) : name, team, st, present: !!p, me: p && p.sameTab, peer: p };
    });
  };
  N.myTeam = () => { const e = N.g && N.g.ros.find(x => x[0] === N.myPeer); return e ? e[2] : null; };
  N.targets = function (kind) {
    const mt = N.myTeam(), team = N.g.mode === 'team';
    return N.entries().filter(e => e.id !== N.myPeer && e.st.alive !== false && (kind === 'foe' ? (!team || e.team !== mt) : (team && e.team === mt))).map(e => ({ id: e.id, name: e.name, col: N.colorOf(e.id, e.team), best: e.st.best ? e.st.best[1] : 0, gold: e.st.gold, paid: e.st.paid, req: e.st.req }));
  };
  N.fightHP = function (base) { if (!N.g || N.g.mode !== 'team') return base; const mt = N.myTeam(); const n = N.g.ros.filter(x => x[2] === mt).length; return base * Math.max(1, n); };
  N.teamDmgOthers = function () { if (!N.g || N.g.mode !== 'team') return 0; const mt = N.myTeam(); return N.entries().filter(e => e.team === mt && e.id !== N.myPeer).reduce((a, e) => a + (e.st.dmg || 0), 0); };
  N.fightTimeLeft = () => N.g && N.g.ph === 'fight' ? (N.g.fEnd - N.now()) / 1000 : (N.g && N.g.ph === 'end' ? 0 : null);

  // ---------- outgoing ----------
  let lastPush = 0, pushT = null;
  N.pushStatus = function (force) {
    if (!N.r || !ET.G.S) return; const now = Date.now();
    const go = () => { lastPush = Date.now(); pushT = null; setP({ st: ET.G.status() }); };
    if (force || now - lastPush > 300) { clearTimeout(pushT); go(); } else if (!pushT) pushT = setTimeout(go, 300);
  };
  N.sendAction = function (to, k, d, refl, from) {
    const now = Date.now(); N.out = N.out.filter(a => now - a.ts < 25000).slice(-10);
    const a = { i: U.uid(), to, k, d: d || {}, ts: now }; if (refl) a.refl = 1; if (from) a.fr = from;
    N.out.push(a); setP({ out: N.out });
    if (to && to.startsWith('bot') && N.isHost) N.botReceive(a, N.myPeer);
  };
  N.feed = function (txt) { const f = { i: U.uid(), t: String(txt).slice(0, 60) }; setP({ fd: f }); N.feedSeen.add(f.i); N.ticker(N.nick(), f.t, true); };
  N.emote = function (k) { const e = { i: U.uid(), k }; setP({ em: e }); N.emSeen.add(e.i); N.myEm = { k, t: Date.now() }; N.renderRivals(); };
  N.ticker = function (who, txt, me) { const el = document.createElement('div'); el.textContent = who + ' · ' + txt; if (me) el.style.borderLeftColor = 'var(--ember)'; const tk = $('#ticker'); tk.appendChild(el); while (tk.children.length > 5) tk.firstChild.remove(); setTimeout(() => el.remove(), 7000); };

  // ---------- incoming ----------
  function scanIncoming() {
    const now = Date.now();
    for (const p of N.peers) {
      const pr = p.presence || {};
      if (Array.isArray(pr.out)) for (const a of pr.out) {
        if (!a || typeof a !== 'object' || typeof a.i !== 'string' || N.seen.has(a.i) || now - (a.ts || 0) > 30000) continue;
        const from = (typeof a.fr === 'string' && p.peer === (N.hostPeer() || {}).peer) ? a.fr : p.peer;
        if (a.to === N.myPeer && N.inGame) { N.seen.add(a.i); ET.G.receive({ k: String(a.k), d: a.d || {}, refl: a.refl, from }, N.nameOf(from)); }
        else if (N.isHost && typeof a.to === 'string' && a.to.startsWith('bot')) { N.seen.add(a.i); N.botReceive(a, from); }
      }
      if (!p.sameTab && pr.fd && typeof pr.fd.i === 'string' && !N.feedSeen.has(pr.fd.i)) { N.feedSeen.add(pr.fd.i); if (N.inGame) N.ticker(String(pr.nick || '?').slice(0, 12), String(pr.fd.t || '').slice(0, 60)); }
      if (!p.sameTab && pr.em && typeof pr.em.i === 'string' && !N.emSeen.has(pr.em.i)) { N.emSeen.add(pr.em.i); N.bubbles[p.peer] = { k: String(pr.em.k).slice(0, 8), t: now }; if (N.inGame) A.play('click'); }
    }
    // host-originated bot feed
    const hp = N.hostPeer(); if (hp && hp.presence.bfd && !N.feedSeen.has(hp.presence.bfd.i)) { N.feedSeen.add(hp.presence.bfd.i); if (N.inGame) N.ticker(String(hp.presence.bfd.n || '봇'), String(hp.presence.bfd.t || '')); }
  }
  N.bubbles = {};

  // ---------- flow ----------
  N.flow = function () {
    if (!N.r) return;
    const me = N.me(); if (me) N.myPeer = me.peer;
    const host = N.hostPeer(); N.isHost = !!(host && host.sameTab);
    if (host && host.presence.g && typeof host.presence.g === 'object') { if (!N.isHost || !N.g) N.g = sanitizeG(host.presence.g); }
    if (N.isHost && N.g && !(host.presence.g)) setP({ g: N.g }); // took over as host
    scanIncoming();
    if (N.isHost) N.hostTick();
    const g = N.g; if (!g) { ET.Main.renderLobby(); return; }
    N.mode = g.mode;
    if (g.ph === 'lobby') { if (N.inGame) { N.inGame = false; N.resultsShown = false; ET.Main.backToLobby(); } ET.Main.renderLobby(); return; }
    if (!N.inGame) {
      N.inGame = true; N.resultsShown = false; N.lastSt = {};
      const mine = g.ros.find(x => x[0] === N.myPeer);
      ET.Main.startMP(g, !!mine);
    }
    N.checkFlow();
    N.renderRivals();
    N.renderTimer();
  };
  function sanitizeG(g) {
    if (+g.now) { const o = +g.now - Date.now(); N.off = N.off == null || Math.abs(o - N.off) > 2000 ? o : N.off * .8 + o * .2; }
    return { created: +g.created || 0, now: +g.now || 0, ph: String(g.ph || 'lobby'), mode: g.mode === 'team' ? 'team' : 'ffa', max: U.clamp(g.max | 0, 2, 8), days: U.clamp(g.days | 0, 2, 40), len: U.clamp(g.len | 0, 20, 300), seed: g.seed | 0, day: g.day | 0, end: +g.end || 0, fEnd: +g.fEnd || 0, dayStart: +g.dayStart || 0, bots: Array.isArray(g.bots) ? g.bots.slice(0, 8) : [], ros: Array.isArray(g.ros) ? g.ros.slice(0, 8).map(r => [String(r[0]), String(r[1]).slice(0, 12), r[2] === 'B' ? 'B' : r[2] === 'A' ? 'A' : null, r[3] ? 1 : 0]) : [], ep: g.ep | 0 };
  }
  N.checkFlow = function () {
    const g = N.g, G = ET.G, S = G.S; if (!g || !N.inGame || !S || S.mode !== 'mp') return;
    if (!S.alive) { if (g.ph === 'end') N.showResults(); return; }
    if (g.ph === 'play') {
      if (g.day > S.day) {
        if (S.phase === 'forge' && !S.settled) G.settle(true);
        else if (S.phase === 'wait') G.startDay(g.day);
      }
    } else if (g.ph === 'fight') {
      if (S.phase === 'forge' && !S.settled) G.settle(true);
      else if (S.phase === 'wait') G.prepareFight();
    } else if (g.ph === 'end') {
      if (ET.Fight.active) { ET.Fight.stop(); $('#hud').classList.add('show'); }
      G.closeModal && S.phase === 'prefight' && G.closeModal();
      N.showResults();
    }
  };

  // ---------- host ----------
  let lastG = '';
  N.hostTick = function () {
    const g = N.g; if (!g) return; const now = Date.now();
    const simDt = Math.min(2, (now - (N.lastSim || now)) / 1000); const doSim = now - (N.lastSim || 0) >= 380; if (doSim) N.lastSim = now;
    if (g.ph === 'play') {
      const E = N.entries();
      const humans = E.filter(e => !e.bot && e.present && e.st.alive !== false);
      const allReady = humans.every(e => e.st.day === g.day && e.st.settled);
      const botsAlive = g.bots.filter(b => b.st.alive);
      if (!humans.length && !botsAlive.length) { g.ph = 'end'; }
      else if (now >= g.end || (allReady && humans.length && now > g.dayStart + 4000)) {
        g.bots.forEach(b => botSettle(b, g));
        if (g.day >= g.days) { g.ph = 'fight'; g.fEnd = now + 110000; }
        else { g.day++; g.end = now + g.len * 1000 + 3500; g.dayStart = now; g.bots.forEach(b => botDay(b, g)); }
      } else if (doSim) g.bots.forEach(b => botTick(b, g));
    } else if (g.ph === 'fight') {
      const E = N.entries(); const humans = E.filter(e => !e.bot && e.present && e.st.alive !== false);
      if (doSim) g.bots.forEach(b => { if (b.st.alive && !b.st.fd && now > g.fEnd - 104000) { b.st.dmg += Math.round(ET.dmgOf(300 * Math.pow(1.45, b.lv) * 1.1) * (.5 + Math.random()) * 1.1 * simDt * b.sk * 1.6); if (Math.random() < .003) b.st.fd = 1; } });
      const done = humans.every(e => e.st.fd) ;
      // team dragon defeated → done
      if (now >= g.fEnd || (done && humans.length) || (!humans.length && now > g.fEnd - 100000)) { g.ph = 'end'; g.bots.forEach(b => { b.st.fd = 1; b.st.score = botScore(b); }); }
    }
    const s = JSON.stringify(Object.assign({}, g, { now: 0 })); if (s !== lastG || now - (N.lastBeat || 0) > 1500) { lastG = s; N.lastBeat = now; g.now = now; setP({ g }); }
  };
  N.hostStart = function () {
    const g = N.g; if (!N.isHost || g.ph !== 'lobby') return;
    const v = viewers().slice().sort((a, b) => a.presence.ja - b.presence.ja).slice(0, g.max - g.bots.length);
    let ros = v.map(p => [p.peer, String(p.presence.nick || '대장장이').slice(0, 12), p.presence.team === 'B' ? 'B' : p.presence.team === 'A' ? 'A' : null, 0]);
    g.bots.forEach(b => ros.push([b.id, b.n, b.team, 1]));
    if (g.mode === 'team') { ros.forEach(r => { if (!r[2]) { const a = ros.filter(x => x[2] === 'A').length, b = ros.filter(x => x[2] === 'B').length; r[2] = a <= b ? 'A' : 'B'; } }); g.bots.forEach(b => { const r = ros.find(x => x[0] === b.id); b.team = r[2]; }); }
    else ros.forEach(r => r[2] = null);
    if (ros.length < 2) return ET.G.toast('최소 2명(봇 포함)이 필요합니다', 'bad');
    g.ros = ros; g.seed = (Math.random() * 1e9) | 0; g.day = 1; g.end = Date.now() + g.len * 1000 + 3000; g.dayStart = Date.now(); g.ph = 'play'; g.ep++;
    g.bots.forEach(b => { b.lv = 0; b.st = { alive: true, day: 1, lives: 3, gold: 150, paid: 0, req: ET.tributeFor(1, g.days), settled: false, best: ['iron', 0], anv: ['iron', 0], score: 0, dmg: 0, fd: 0 }; botDay(b, g); });
    setP({ g }); N.flow();
  };
  N.hostReset = function () { const g = N.g; if (!N.isHost) return; g.ph = 'lobby'; g.day = 0; g.ros = []; g.bots.forEach(b => b.st = {}); setP({ g }); };
  N.addBot = function () { const g = N.g; if (!N.isHost || g.ph !== 'lobby') return; if (viewers().length + g.bots.length >= g.max) return ET.G.toast('방이 가득 찼습니다', 'bad'); const used = g.bots.map(b => b.n); const n = BOTN.find(x => !used.includes(x)) || '봇'; g.bots.push({ id: 'bot' + U.uid().slice(0, 5), n, team: g.mode === 'team' ? (g.bots.length % 2 ? 'A' : 'B') : null, sk: .45 + Math.random() * .4, lv: 0, st: {} }); setP({ g }); N.flow(); };
  N.delBot = function () { const g = N.g; if (!N.isHost || !g.bots.length) return; g.bots.pop(); setP({ g }); N.flow(); };
  N.setCfg = function (k, v) { if (!N.isHost || N.g.ph !== 'lobby') return; N.g[k] = v; setP({ g: N.g }); N.flow(); };
  N.setTeam = function (t) { setP({ team: t }); };
  // bots
  function botVal(b) { return 300 * Math.pow(1.45, b.lv) * 1.15; }
  function botScore(b) { return Math.round((b.paid || 0) / 10 + b.st.day * 500 + (b.st.dmg || 0) * 5); }
  function botDay(b, g) {
    if (!b.st.alive) return; b.st.day = g.day; b.st.settled = false; b.st.req = ET.tributeFor(g.day, g.days); b.st.paid = 0; b.readyAt = Date.now() + (g.len * (.4 + Math.random() * .5)) * 1000; b.st.gold += 100 * g.day;
  }
  function botTick(b, g) {
    if (!b.st.alive || b.st.settled) return;
    if (Math.random() < .05) { const r = Math.random(); if (r < .55 * b.sk + .2) b.lv += r < .08 ? 2 : 1; else if (r > .92) { const old = b.lv; b.lv = Math.max(0, b.lv - 4); if (old >= 8 && Math.random() < .5) setP({ bfd: { i: U.uid(), n: b.n, t: '+' + old + ' 검을 부숴 먹었다' } }); } b.st.anv = ['iron', b.lv]; b.st.best = ['iron', b.lv]; b.st.paid = Math.round(Math.min(botVal(b), b.st.req * (.5 + Math.random()))); b.st.score = botScore(b); }
    if (Math.random() < .0025) { const foes = N.entries().filter(e => !e.bot && e.st.alive !== false && (g.mode !== 'team' || e.team !== b.team)); if (foes.length) { const t = foes[Math.floor(Math.random() * foes.length)]; const ks = Object.keys(ET.CURSES); N.sendAction(t.id, ks[Math.floor(Math.random() * ks.length)], {}, false, b.id); } }
    if (Date.now() > b.readyAt) botSettle(b, g);
  }
  function botSettle(b, g) {
    if (!b.st.alive || b.st.settled) return; b.st.settled = true;
    const v = botVal(b) * (.7 + Math.random() * .9) * (g.day < 3 ? 1.6 : 1);
    if (v >= b.st.req) { b.paid = (b.paid || 0) + b.st.req; b.lv = Math.max(0, b.lv - Math.floor(Math.random() * 3)); } else { b.st.lives--; if (b.st.lives <= 0) b.st.alive = false; }
    b.lv += 1; b.st.score = botScore(b); b.st.paid = 0;
  }
  N.botReceive = function (a, from) {
    const b = N.g.bots.find(x => x.id === a.to); if (!b) return;
    if (a.k === 'raven') { const n = Math.round((b.st.gold || 0) * .15); b.st.gold -= n; N.sendAction(from, 'steal', { n }, false, b.id); }
    if (a.k === 'rust') b.lv = Math.max(0, b.lv - 1);
    if (a.k === 'gift') b.lv = Math.max(b.lv, (a.d && a.d.l) | 0);
    if (a.k === 'plea') b.st.lives = Math.min(3, b.st.lives + 1);
  };

  // ---------- UI ----------
  N.renderTimer = function () {
    const g = N.g, el = $('#timer'); if (!g || !N.inGame) { el.hidden = true; return; }
    el.hidden = false; let s;
    if (g.ph === 'play') s = Math.max(0, Math.ceil((g.end - N.now()) / 1000)); else if (g.ph === 'fight') s = Math.max(0, Math.ceil((g.fEnd - N.now()) / 1000)); else s = 0;
    el.textContent = s + '초'; el.classList.toggle('warn', s <= 10 && g.ph !== 'end');
    if (g.ph === 'play' && s <= 10 && s > 0 && N.lastBeep !== s && ET.G.S && ET.G.S.phase === 'forge') { N.lastBeep = s; A.play('click'); }
  };
  N.renderRivals = function () {
    const box = $('#rivList'); if (!N.inGame || !N.g) { $('#rivals').classList.remove('show'); return; }
    $('#rivals').classList.add('show');
    const E = N.entries(), mt = N.myTeam(), team = N.g.mode === 'team', now = Date.now();
    let head = '';
    if (team) { const sum = t => E.filter(e => e.team === t).reduce((a, e) => a + (e.st.score || 0), 0); head = '<div class="riv" style="--tc:#e9c46f"><div class="n"><span style="color:' + TEAM.A.c + '">' + TEAM.A.n + ' ' + U.fmt(sum('A')) + '</span><span style="color:' + TEAM.B.c + '">' + U.fmt(sum('B')) + ' ' + TEAM.B.n + '</span></div></div>'; }
    const sorted = E.slice().sort((a, b) => (b.st.score || 0) - (a.st.score || 0));
    const html = head + sorted.map(e => {
      const st = e.st, col = N.colorOf(e.id, e.team), dead = st.alive === false;
      const bub = e.me ? (N.myEm && now - N.myEm.t < 3500 ? N.myEm.k : null) : (N.bubbles[e.id] && now - N.bubbles[e.id].t < 3500 ? N.bubbles[e.id].k : null);
      const anv = st.anv ? (ET.TYPES[st.anv[0]] ? ET.TYPES[st.anv[0]].name : '검') + ' +' + (st.anv[1] | 0) : '빈 모루';
      const state = dead ? '탈락' : st.phase === 'fight' ? '전투 중' : st.fd ? '전투 끝' : st.settled ? '납부 완료' : (U.fmt(st.paid || 0) + '/' + U.fmt(st.req || 0));
      const mate = team && e.team === mt && !e.me && !dead && !e.bot;
      return '<div class="riv' + (e.me ? ' me' : '') + (dead ? ' dead' : '') + '" style="--tc:' + col + '"><div class="n"><span>' + U.esc(e.name) + (e.me ? ' (나)' : '') + (e.bot ? ' · 봇' : '') + (!e.present && !e.bot ? ' · 끊김' : '') + '</span><span class="gold">' + U.fmt(st.score || 0) + '</span></div>' +
        '<div class="s"><span class="hearts" style="gap:1px">' + ET.G.heartsHTML(Math.max(0, st.lives | 0), Math.max(3, st.lives | 0), col).replace(/<svg /g, '<svg style="width:12px;height:12px" ') + '</span><span>' + U.esc(state) + '</span></div>' +
        '<div class="s"><span>' + U.esc(anv) + '</span><span>최고 +' + (st.best ? st.best[1] | 0 : 0) + '</span></div>' +
        (N.g.ph === 'fight' || N.g.ph === 'end' ? '<div class="s"><span>용 피해</span><span>' + U.fmt(st.dmg || 0) + '</span></div>' : '') +
        (bub ? '<div class="bub">' + U.esc(bub) + '</div>' : '') +
        (mate && N.g.ph === 'play' ? '<div class="acts2"><button class="btn ghost" data-gg="' + U.esc(e.id) + '">골드 25%</button>' + ((st.lives | 0) < 3 ? '<button class="btn ghost" data-pl="' + U.esc(e.id) + '">탄원 +1</button>' : '') + '</div>' : '') + '</div>';
    }).join('');
    if (N._rivH === html) return; N._rivH = html; box.innerHTML = html;
    U.$$('#rivals [data-gg]').forEach(b => b.onclick = () => { const S = ET.G.S; const n = Math.floor(S.gold * .25); if (n <= 0) return; S.gold -= n; N.sendAction(b.dataset.gg, 'gold', { n }); ET.G.toast(U.fmt(n) + ' G를 보냈다', 'good'); ET.G.render(); });
    U.$$('#rivals [data-pl]').forEach(b => b.onclick = () => { const S = ET.G.S, p = ET.G.price(500); if (S.gold < p) return ET.G.toast('탄원 비용 ' + U.fmt(p) + ' G가 필요합니다', 'bad'); S.gold -= p; N.sendAction(b.dataset.pl, 'plea', {}); ET.G.toast('탄원서를 올렸다', 'good'); ET.G.render(); });
    const eb = $('#emoteBar'); if (!eb.dataset.ok) { eb.dataset.ok = 1; eb.innerHTML = EMOTES.map(k => '<button class="btn ghost" data-em="' + k + '">' + k + '</button>').join(''); U.$$('#emoteBar [data-em]').forEach(b => b.onclick = () => N.emote(b.dataset.em)); }
  };
  N.results = function () {
    const E = N.entries().map(e => ({ ...e, score: e.st.score || 0 }));
    E.sort((a, b) => b.score - a.score); return E;
  };
  N.showResults = function () {
    if (N.resultsShown) return; N.resultsShown = true;
    const E = N.results(), team = N.g.mode === 'team', G = ET.G;
    let head = '';
    let iWon = false;
    if (team) { const s = t => E.filter(e => e.team === t).reduce((a, e) => a + e.score, 0); const a = s('A'), b = s('B'), w = a === b ? null : a > b ? 'A' : 'B'; head = '<p style="font-size:18px">' + (w ? '<b style="color:' + TEAM[w].c + '">' + TEAM[w].n + '</b> 승리!' : '무승부!') + ' <span class="muted">' + U.fmt(a) + ' : ' + U.fmt(b) + '</span></p>'; iWon = w && w === N.myTeam(); }
    else iWon = E[0] && E[0].id === N.myPeer;
    if (iWon) { G.ach('mpwin'); A.play('win'); }
    const html = '<h2 class="h">' + (iWon ? '승리!' : '계약 종료') + '</h2>' + head + '<div class="rank">' + E.map((e, i) => '<div style="--tc:' + N.colorOf(e.id, e.team) + '"><b>' + (i + 1) + '</b><span>' + U.esc(e.name) + (e.id === N.myPeer ? ' (나)' : '') + (e.bot ? ' · 봇' : '') + '<br><span class="muted small">' + (e.st.day | 0) + '일 · 최고 +' + (e.st.best ? e.st.best[1] | 0 : 0) + ' · 용 피해 ' + U.fmt(e.st.dmg || 0) + (e.st.alive === false ? ' · 탈락' : '') + '</span></span><b class="gold">' + U.fmt(e.score) + '</b></div>').join('') + '</div><p class="muted small">점수 = 바친 공물/10 + 버틴 날×500 + 용 피해×5 (+처치 보너스)</p>';
    const btns = [{ t: '나가기', f: () => { N.leave(); ET.Main.toTitle(); } }];
    if (N.isHost) btns.push({ t: '같은 방에서 다시', cls: 'pri', f: () => N.hostReset() }); else btns.push({ t: '방에 남기', cls: 'pri', f: () => { } });
    G.modal(html, btns, true);
  };
})(window.ET);
