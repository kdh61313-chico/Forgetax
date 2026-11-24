/* EMBER TITHE — boot, render loop, menus, input */
'use strict';
(function (ET) {
  const U = ET.U, $ = U.$, A = ET.Audio, F = ET.Forge, G = ET.G, N = ET.Net, FT = ET.Fight;
  const Main = ET.Main = {};
  let renderer, composer, rpass, bloom, view = 'forge';

  const GRADE = {
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uVig: { value: 1.1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: ['uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform float uVig; varying vec2 vUv;',
      'float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233)))*43758.5453); }',
      'void main(){ vec2 uv=vUv; vec2 d=uv-.5; float r=dot(d,d); float ca=.0025*r*4.;',
      ' vec3 c=vec3(texture2D(tDiffuse,uv+d*ca).r, texture2D(tDiffuse,uv).g, texture2D(tDiffuse,uv-d*ca).b);',
      ' c=pow(max(c,0.), vec3(1./2.2));',
      ' float l=dot(c, vec3(.299,.587,.114)); c=mix(vec3(l), c, .86);',
      ' c=(c-.5)*1.1+.5; c+=vec3(-.012,.003,.018)*(1.-l)+vec3(.03,.008,-.022)*l;',
      ' c*=1.-r*uVig; c+=(rand(uv*uRes+fract(uTime))-.5)*.04;',
      ' gl_FragColor=vec4(clamp(c,0.,1.),1.); }'].join('\n')
  };
  let ssao = null, grade = null, fxaa = null;
  const tick = () => new Promise(r => setTimeout(r, 16));
  const prog = (p, t) => { const b = $('#loadBar'); if (b) b.style.width = (p * 100) + '%'; if (t) { const s = document.querySelector('#load span'); if (s) s.textContent = t; } };
  async function boot() {
    const touch = matchMedia('(pointer: coarse)').matches; Main.touch = touch; if (touch) document.body.classList.add('touch');
    const hi = !touch && (navigator.hardwareConcurrency || 4) >= 4; Main.hi = hi;
    ET.X.size = hi ? 512 : 256; ET.X.big = hi;
    const canvas = $('#c');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, hi ? 1.5 : 1.25));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.physicallyCorrectLights = false;
    ET.X.aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    prog(.1, '돌과 쇠를 깎는 중…'); await tick();
    ET.M.initMats();
    prog(.6, '대장간을 짓는 중…'); await tick();
    F.init(renderer, hi); prog(.8, '용을 깨우는 중…'); await tick();
    FT.init(hi);
    try { F.scene.environment = ET.M.makeEnv ? ET.M.makeEnv(renderer) : null; } catch (e) { }
    try {
      if (THREE.EffectComposer) {
        composer = new THREE.EffectComposer(renderer);
        if (hi && THREE.SSAOPass && THREE.SimplexNoise) { ssao = new THREE.SSAOPass(F.scene, F.cam, innerWidth, innerHeight); ssao.kernelRadius = .22; ssao.minDistance = .0004; ssao.maxDistance = .012; composer.addPass(ssao); }
        else { rpass = new THREE.RenderPass(F.scene, F.cam); composer.addPass(rpass); }
        bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .55, .6, .86); composer.addPass(bloom);
        grade = new THREE.ShaderPass(GRADE); composer.addPass(grade);
        if (THREE.FXAAShader) { fxaa = new THREE.ShaderPass(THREE.FXAAShader); composer.addPass(fxaa); }
      }
    } catch (e) { console.warn(e); composer = null; }
    resize(); addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 300));
    F.setStation('title', true);
    prog(1); const ld = $('#load'); if (ld) ld.remove();
    if (U.store.get('save', null)) $('#bCont').hidden = false;
    $('#nick').value = U.store.get('nick', '');
    $('#bSound').textContent = U.store.get('mute', false) ? '소리 꺼짐' : '소리 켜짐'; A.on = !U.store.get('mute', false);
    bindMenus(); bindInput();
    N.init().then(r => { Main.mpOk = !!r; });
    let last = performance.now(), frames = 0, acc = 0, lowered = false;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      // adaptive quality: drop SSAO / pixel ratio if slow
      acc += dt; frames++; if (acc > 3) { const fps = frames / acc; if (fps < 32 && !lowered) { lowered = true; if (ssao) { ssao.enabled = false; } renderer.setPixelRatio(1); resize(); } acc = 0; frames = 0; }
      if (FT.active) { FT.update(dt); draw(FT.scene, FT.cam, now); }
      else {
        if (F.station === 'title') { const t = now / 1000; F.camPosT.set(Math.sin(t * .07) * 1.0 + 3.0, 2.2 + Math.sin(t * .11) * .15, 3.0); }
        G.tick(dt); F.update(dt); draw(F.scene, F.cam, now);
      }
    };
    requestAnimationFrame(loop);
  }
  function draw(scene, cam, now) {
    if (composer) {
      if (ssao) { ssao.scene = scene; ssao.camera = cam; if (ssao.enabled === false && !rpass) { rpass = new THREE.RenderPass(scene, cam); composer.insertPass(rpass, 0); } }
      if (rpass) { rpass.scene = scene; rpass.camera = cam; }
      if (grade) { grade.uniforms.uTime.value = now / 1000; grade.uniforms.uVig.value = scene === FT.scene ? 1.3 : 1.15; }
      bloom.strength = scene === FT.scene ? .7 : .55;
      composer.render();
    } else renderer.render(scene, cam);
  }
  function sheetWidth() { const sh = $('#sheet'); if (!sh || !$('#hud').classList.contains('show') || document.body.classList.contains('bottom')) return 0; return sh.getBoundingClientRect().width; }
  function resize() {
    const w = innerWidth, h = innerHeight;
    document.body.classList.toggle('bottom', h > w * 1.05 && !Main.touch);
    renderer.setSize(w, h, false);
    const pr = renderer.getPixelRatio();
    if (composer) { composer.setSize(w, h); if (ssao) ssao.setSize(w * pr, h * pr); if (fxaa) fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr)); if (grade) grade.uniforms.uRes.value.set(w, h); }
    F.resize(w, h, sheetWidth()); FT.resize(w, h);
  }
  Main.resize = () => resize();

  // ---------- screens ----------
  Main.show = function (id) { U.$$('.screen').forEach(s => s.classList.toggle('show', s.id === id)); $('#hud').classList.toggle('show', !id); requestAnimationFrame(() => Main.resize && Main.resize()); };
  Main.toTitle = function () {
    if (FT.active) FT.stop(); G.closeModal(); G.S = null; Main.show('title'); F.setStation('title');
    $('#rivals').classList.remove('show'); $('#emoteBar').classList.remove('show'); $('#timer').hidden = true; $('#bCont').hidden = !U.store.get('save', null);
    F.syncRack([]); F.syncCounter([]); F.setAnvilSword(null);
  };
  function startSolo(days) { A.init(); Main.show(null); G.newRun({ mode: 'solo', days }); }
  Main.startMP = function (g, playing) {
    A.init(); G.closeModal(); Main.show(null);
    G.newRun({ mode: 'mp', seed: g.seed, days: g.days });
    if (!playing) { G.S.alive = false; G.S.phase = 'dead'; G.render(true); G.toast('이미 시작된 판이라 관전합니다', 'bad'); }
    G.banner('계약 시작', (g.mode === 'team' ? '팀전' : '개인전') + ' · ' + g.days + '일 · 하루 ' + g.len + '초');
  };
  Main.backToLobby = function () { if (FT.active) FT.stop(); G.closeModal(); G.S = null; F.syncRack([]); F.syncCounter([]); F.setAnvilSword(null); $('#rivals').classList.remove('show'); $('#emoteBar').classList.remove('show'); $('#timer').hidden = true; Main.show('lobby'); F.setStation('title'); };

  Main.renderLobby = function () {
    if (!N.r || N.inGame) return;
    const g = N.g; $('#lobCode').textContent = N.code || '-----';
    if (!g) { $('#lobSlots').innerHTML = '<p class="muted" style="text-align:center">방장을 찾는 중… 코드가 맞는지 확인하세요.</p>'; $('#lobHost').style.display = 'none'; return; }
    const v = N.peers.filter(p => p.kind === 'viewer' && p.presence && typeof p.presence.ja === 'number').sort((a, b) => a.presence.ja - b.presence.ja);
    const hostId = (N.hostPeer() || {}).peer;
    const players = v.slice(0, g.max - g.bots.length), watchers = v.slice(g.max - g.bots.length);
    $('#lobInfo').textContent = (g.mode === 'team' ? '팀전' : '개인전') + ' · ' + g.max + '인 · ' + g.days + '일 · 하루 ' + g.len + '초';
    const ent = players.map(p => ({ id: p.peer, name: String(p.presence.nick || '대장장이').slice(0, 12), team: p.presence.team, me: p.sameTab, host: p.peer === hostId })).concat(g.bots.map(b => ({ id: b.id, name: b.n, team: b.team, bot: true })));
    const slot = e => '<div class="slot" style="--tc:' + (g.mode === 'team' ? (N.TEAM[e.team] ? N.TEAM[e.team].c : '#777') : '#e9c46f') + '"><span>' + U.esc(e.name) + (e.me ? ' (나)' : '') + '</span><span class="muted small">' + (e.host ? '방장' : e.bot ? '봇' : '대장장이') + '</span></div>';
    let h = '';
    if (g.mode === 'team') {
      const col = t => ent.filter(e => e.team === t).map(slot).join('') || '<div class="slot empty">비어 있음</div>';
      h = '<div class="teams"><div><h4 style="color:' + N.TEAM.A.c + '">' + N.TEAM.A.n + '</h4>' + col('A') + '<button class="btn sm ghost" data-team="A" style="width:100%;margin-top:6px">이 팀으로</button></div><div><h4 style="color:' + N.TEAM.B.c + '">' + N.TEAM.B.n + '</h4>' + col('B') + '<button class="btn sm ghost" data-team="B" style="width:100%;margin-top:6px">이 팀으로</button></div></div>' + (ent.some(e => !e.team) ? '<p class="muted small">팀 미정: ' + ent.filter(e => !e.team).map(e => U.esc(e.name)).join(', ') + ' — 시작할 때 자동 배정</p>' : '');
    } else {
      h = '<div class="slots">' + ent.map(slot).join('') + Array.from({ length: Math.max(0, g.max - ent.length) }, () => '<div class="slot empty">빈 대장간 — 코드를 친구에게 알려 주세요</div>').join('') + '</div>';
    }
    if (watchers.length) h += '<p class="muted small">관전: ' + watchers.map(p => U.esc(String(p.presence.nick || '?').slice(0, 12))).join(', ') + '</p>';
    if (Main._lobH === h) { $('#lobHost').style.display = N.isHost ? 'flex' : 'none'; return; } Main._lobH = h;
    $('#lobSlots').innerHTML = h;
    U.$$('#lobSlots [data-team]').forEach(b => b.onclick = () => { N.setTeam(b.dataset.team); A.play('click'); });
    $('#lobHost').style.display = N.isHost ? 'flex' : 'none';
    $('#lobWait').textContent = N.isHost ? '인원은 ' + ent.length + ' / ' + g.max + '명. 한 명당 대장간 하나가 열립니다.' : '방장이 시작하기를 기다리는 중…';
  };

  function bindMenus() {
    const click = (id, f) => $(id).addEventListener('click', () => { A.init(); A.play('click'); f(); });
    $('#nick').addEventListener('input', e => U.store.set('nick', e.target.value));
    click('#bSolo', () => Main.show('soloMenu'));
    click('#bCont', () => { A.init(); Main.show(null); if (!G.load()) { G.toast('저장이 없습니다'); Main.toTitle(); } });
    click('#bSoloGo', () => { const d = +($('#soloDays .on') || {}).dataset.v || 20; U.store.del('save'); startSolo(d); });
    U.$$('[data-back]').forEach(b => b.addEventListener('click', () => { A.play('click'); Main.show('title'); }));
    U.$$('.seg').forEach(seg => seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }));
    click('#bMulti', () => {
      Main.show('mpMenu'); const w = $('#mpWarn');
      if (!N.ready) { w.style.display = 'block'; w.textContent = '연결을 확인하는 중… 잠시 뒤 다시 눌러 주세요.'; }
      else if (!N.room) { w.style.display = 'block'; w.textContent = '멀티플레이 연결 모듈을 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요. 솔로 플레이는 그대로 됩니다.'; }
      else if (N.transport === 'p2p') { w.style.display = 'block'; w.className = 'toast'; w.textContent = 'P2P 모드: 방을 만든 사람이 방장(서버)이 됩니다. 방장이 나가면 방이 닫혀요. 일부 회사·학교 네트워크에서는 연결이 막힐 수 있어요.'; }
      else w.style.display = 'none';
    });
    click('#bCreate', async () => {
      if (!N.room) return G.toast('멀티플레이 연결이 없습니다', 'bad');
      try { await N.create({ mode: $('#mpMode .on').dataset.v, max: +$('#mpMax').value, days: +$('#mpDays').value, len: +$('#mpLen').value }); Main.show('lobby'); Main.renderLobby(); } catch (e) { G.toast('방을 만들지 못했습니다: ' + (e.code || e.message), 'bad'); }
    });
    click('#bJoin', async () => {
      if (!N.room) return G.toast('멀티플레이 연결이 없습니다', 'bad');
      const c = $('#joinCode').value; if (c.replace(/[^a-z0-9]/gi, '').length !== 5) return G.toast('코드 5자리를 입력하세요', 'bad');
      try { await N.enter(c, null); Main.show('lobby'); Main.renderLobby(); } catch (e) { G.toast(e.code === 'notfound' ? '그 코드의 방을 찾을 수 없습니다' : e.code === 'timeout' ? '연결 시간이 초과됐습니다. 네트워크를 확인해 주세요' : '들어가지 못했습니다: ' + (e.code || e.message), 'bad'); }
    });
    $('#joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('#bJoin').click(); });
    click('#bCopy', () => { try { navigator.clipboard.writeText(N.code); G.toast('코드를 복사했습니다', 'good'); } catch (e) { G.toast('복사 실패 — 코드를 직접 알려 주세요'); } });
    click('#bLeave', () => { N.leave(); Main.show('mpMenu'); });
    click('#bStart', () => N.hostStart());
    click('#bBot', () => N.addBot()); click('#bBotDel', () => N.delBot());
    click('#bSound', () => { A.on = !A.on; U.store.set('mute', !A.on); $('#bSound').textContent = A.on ? '소리 켜짐' : '소리 꺼짐'; A.ambLevel(A.on ? .12 : 0); });
    click('#bHow', howTo); click('#bCodex', codex);
    click('#bFull', () => { const d = document.documentElement; try { const p = d.requestFullscreen ? d.requestFullscreen() : d.webkitRequestFullscreen && d.webkitRequestFullscreen(); if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }).catch(() => G.toast('이 화면에서는 전체화면을 쓸 수 없어요')); } catch (e) { G.toast('이 화면에서는 전체화면을 쓸 수 없어요'); } });
    click('#bRiv', () => { const r = $('#rivals'); r.classList.toggle('hide'); $('#bRiv').textContent = r.classList.contains('hide') ? '라이벌 보기' : '라이벌 접기'; });
    U.$$('#nav button').forEach(b => b.addEventListener('click', () => { A.play('click'); if (G.S) G.go(b.dataset.st); }));
  }
  function howTo() {
    G.modal('<h2 class="h">플레이 방법</h2>' +
      '<p><b>하루의 흐름</b> — 아침마다 철검 3자루를 받습니다. 검을 모루에 올리고 <b>타격</b>해 강화하세요. 강화할수록 가치가 1.45배씩 오르지만 <b>파괴</b> 확률도 오릅니다. 바칠 검을 공물대에 올리고 <b>종</b>을 치면 하루가 끝납니다.</p>' +
      '<p><b>타격 결과</b> — 대성공 +2 · 성공 +1 · 유지 · 손상 -1 · 파괴(검 소멸). 모루 패널의 막대가 지금 확률입니다.</p>' +
      '<p><b>타이밍</b> — 움직이는 바늘이 가운데 금빛 칸에 있을 때 치면 <b>완벽</b>: 파괴 확률이 크게 줄고 폭주 게이지가 2칸 찹니다. 빗나가면 위험이 커집니다.</p>' +
      '<p><b>열기</b> — 칠 때마다 식습니다. 25% 아래로 식으면 대성공이 나오지 않으니 화로에서 다시 달구세요.</p>' +
      '<p><b>불꽃 폭주</b> — 게이지 14칸을 채우면 4초 동안 파괴가 사라집니다. 이때 몰아치세요.</p>' +
      '<p><b>공물</b> — 요구량을 못 채우면 용의 인내심이 1 줄고, 0이 되면 끝. 초과분의 절반은 골드로 돌려받습니다. 골드로 유물·특수 검·도구를 사세요.</p>' +
      '<p><b>결전</b> — 마지막 날 공물을 바친 뒤, 남겨 둔 검으로 이그나르와 싸웁니다. 검 가치가 곧 공격력. +15 최종 형태 검은 고유 스킬을 씁니다. 붉은 표식을 피하세요!</p>' +
      '<p><b>멀티플레이</b> — 방 코드로 모여 각자 자기 대장간에서 같은 날, 같은 상점, 같은 사건으로 경쟁합니다. 하루는 제한시간이 있고, 상인에게 <b>저주</b>를 사서 라이벌을 방해할 수 있어요. 팀전은 팀원에게 검·골드를 보내고 탄원으로 인내심을 채워 줄 수 있고, 결전에서는 팀이 한 마리 용을 함께 잡습니다.</p>' +
      (Main.touch ? '<p class="muted small">가로 화면 전용 · 3D 화면의 물건을 눌러도 이동/조작할 수 있어요</p>' : '<p class="muted small">단축키: Space 타격 · H 가열 · R 거치대로 · T 공물대로 · B 종 · 1~5 장소 이동</p>'), [{ t: '알겠다', cls: 'pri' }]);
  }
  function codex() {
    const ach = U.store.get('ach', {}), sr = U.store.get('seen_relic', {}), stp = U.store.get('seen_type', {});
    const best = U.store.get('best', 0);
    G.modal('<h2 class="h">도감 · 업적</h2><p class="muted small">최고 점수 ' + U.fmt(best) + '</p>' +
      '<h4>업적 ' + Object.keys(ach).length + ' / ' + ET.ACH.length + '</h4><div class="swlist">' + ET.ACH.map(a => '<div class="sw" style="opacity:' + (ach[a.id] ? 1 : .45) + '"><div class="t"><span>' + a.n + '</span><i>' + (ach[a.id] ? '달성' : '') + '</i></div><div class="v">' + a.d + '</div></div>').join('') + '</div>' +
      '<h4>검</h4><div class="swlist">' + Object.entries(ET.TYPES).map(([k, T]) => '<div class="sw" style="opacity:' + (k === 'iron' || stp[k] ? 1 : .45) + '"><div class="t"><span>' + T.name + '</span><i>' + T.base + ' G</i></div><div class="v">' + T.desc + '<br>최종 고유기: ' + T.abName + ' — ' + T.abDesc + '</div></div>').join('') + '</div>' +
      '<h4>유물</h4><div class="swlist">' + ET.RELICS.map(R => '<div class="sw" style="opacity:' + (sr[R.id] ? 1 : .45) + '"><div class="t"><span>' + R.name + '</span><i class="r' + R.r + 't">' + ET.RAR[R.r] + '</i></div><div class="v">' + (sr[R.id] ? R.d : '아직 손에 넣지 못했다') + (R.mp ? ' (멀티 전용)' : '') + '</div></div>').join('') + '</div>', [{ t: '닫기', cls: 'pri' }]);
  }

  function bindInput() {
    addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || FT.active || !G.S || $('#modal').classList.contains('show')) return;
      const k = e.key.toLowerCase();
      if (k === ' ') { e.preventDefault(); G.strike(); }
      else if (k === 'h') G.heat();
      else if (k === 'r' && G.S.anvil) G.toRack(G.S.anvil.id);
      else if (k === 't' && G.S.anvil) G.toCounter(G.S.anvil.id);
      else if (k === 'b') G.ringBell();
      else if ('12345'.includes(k) && k) G.go(['furnace', 'anvil', 'rack', 'tribute', 'shop'][+k - 1]);
    });
    const cv = $('#c'); let down = null;
    cv.addEventListener('pointerdown', e => { A.init(); down = { x: e.clientX, y: e.clientY }; if (FT.active) { FT.attack(); FT.mouseHold = true; } });
    addEventListener('pointerup', () => { FT.mouseHold = false; });
    cv.addEventListener('pointerup', e => {
      if (FT.active || !G.S || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return;
      const hit = F.pick(e.clientX, e.clientY); if (!hit || !hit.action) return;
      const a = hit.action;
      if (a === 'strike') { if (G.station !== 'anvil') G.go('anvil'); else G.strike(); }
      else if (a === 'heat') { if (G.station !== 'furnace') G.go('furnace'); else G.heat(); }
      else if (a === 'bell') { if (G.station !== 'tribute') G.go('tribute'); else G.ringBell(); }
      else if (a === 'tribute') G.go('tribute');
      else if (a === 'rack' && hit.id) { if (G.station === 'rack') G.toAnvil(hit.id); else G.go('rack'); }
      else if (a === 'rackview') G.go('rack');
      else if (a === 'counter' && hit.id) { if (G.station === 'tribute') G.toRack(hit.id); else G.go('tribute'); }
      else if (a === 'shop') G.go('shop');
      else if (a === 'dragon') { F.dragonReact('peek'); A.play('roar', .4); }
    });
    cv.addEventListener('pointermove', e => { if (FT.active || !G.S) return; if (Main.touch) return; const hit = F.pick(e.clientX, e.clientY); cv.style.cursor = hit && hit.action ? 'pointer' : 'default'; });
  }

  addEventListener('load', () => { try { boot().catch(e => { const l = $('#load'); if (l) l.textContent = '시작하지 못했습니다: ' + e.message; console.error(e); }); } catch (e) { const l = $('#load'); if (l) l.textContent = '그래픽을 시작하지 못했습니다: ' + e.message; console.error(e); } });
})(window.ET);
