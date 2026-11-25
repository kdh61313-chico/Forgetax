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
    const q = U.store.get('quality', 'auto'); const hi = q === 'high' || (q === 'auto' && !touch && (navigator.hardwareConcurrency || 4) >= 4); Main.hi = hi;
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
    F.setStation('title', true); F.vm.visible = false;
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
      if (FT.active) { Main.lockCheck(); FT.update(dt); draw(FT.scene, FT.cam, now); }
      else {
        if (F.station === 'title') { const t = now / 1000; F.camPosT.set(Math.sin(t * .07) * 1.0 + 3.0, 2.2 + Math.sin(t * .11) * .15, 3.0); }
        G.tick(dt); F.update(dt); Main.updatePrompt(); Main.lockCheck(); draw(F.scene, F.cam, now);
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
  function sheetWidth() { return 0; }
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
    if (FT.active) FT.stop(); G.closeModal(); G.S = null; Main.show('title'); F.enterTitle();
    $('#rivals').classList.remove('show'); $('#emoteBar').classList.remove('show'); $('#timer').hidden = true; $('#bCont').hidden = !U.store.get('save', null);
    F.syncRack([]); F.syncCounter([]); F.setAnvilSword(null);
  };
  function startSolo(days) { A.init(); Main.show(null); G.newRun({ mode: 'solo', days }); hintOnce(); }
  function hintOnce() { if (U.store.get('hinted2', 0)) return; U.store.set('hinted2', 1); setTimeout(() => G.toast(Main.touch ? '왼쪽 스틱으로 걷고, 화면을 끌어 둘러보세요. 물건을 탭하면 상호작용' : 'WASD로 걷고 마우스를 끌어 둘러보세요. E나 클릭으로 상호작용, Space 꾹 = 연속 타격'), 2200); }
  Main.startMP = function (g, playing) {
    A.init(); G.closeModal(); Main.show(null);
    G.newRun({ mode: 'mp', seed: g.seed, days: g.days }); hintOnce();
    if (!playing) { G.S.alive = false; G.S.phase = 'dead'; G.render(true); G.toast('이미 시작된 판이라 관전합니다', 'bad'); }
    G.banner('계약 시작', (g.mode === 'team' ? '팀전' : '개인전') + ' · ' + g.days + '일 · 하루 ' + g.len + '초');
  };
  Main.backToLobby = function () { if (FT.active) FT.stop(); G.closeModal(); G.S = null; F.syncRack([]); F.syncCounter([]); F.setAnvilSword(null); $('#rivals').classList.remove('show'); $('#emoteBar').classList.remove('show'); $('#timer').hidden = true; Main.show('lobby'); F.enterTitle(); };

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
    click('#bHow', howTo); click('#bCodex', codex); const bs = $('#bSet'); if (bs) bs.addEventListener('click', () => { A.play('click'); settings(); }); const bs2 = $('#bSet2'); if (bs2) bs2.addEventListener('click', () => { A.play('click'); settings(); });
    click('#bFull', () => { const d = document.documentElement; try { const p = d.requestFullscreen ? d.requestFullscreen() : d.webkitRequestFullscreen && d.webkitRequestFullscreen(); if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }).catch(() => G.toast('이 화면에서는 전체화면을 쓸 수 없어요')); } catch (e) { G.toast('이 화면에서는 전체화면을 쓸 수 없어요'); } });
    click('#bRiv', () => { const r = $('#rivals'); r.classList.toggle('hide'); $('#bRiv').textContent = r.classList.contains('hide') ? '라이벌 보기' : '라이벌 접기'; });
    $('#sheetX').addEventListener('click', () => { A.play('click'); G.closePanel(); });
    $('#quests').addEventListener('click', () => { if (G.S) F.walkTo('quests', () => G.go('quests')); });
  }
  function howTo() {
    G.modal('<h2 class="h">플레이 방법</h2>' +
      '<p><b>하루의 흐름</b> — 아침마다 이그나르가 식은 철검을 <b>바닥에 던져 줍니다</b>. 검을 주워(E 또는 끌기) <b>화로 가까이 들고 가서 달구고</b>, <b>모루</b>에 올려 두드리세요. 강화할수록 가치가 1.45배씩 오르지만 <b>파괴</b> 확률도 오릅니다. 바칠 검을 <b>공물대</b>에 올리고 <b>종</b>을 치면 하루가 끝납니다.</p>' +
      '<p><b>검 옮기기</b> — 바닥·거치대·공물대·모루 위의 검은 마우스로 <b>끌어서</b> 원하는 곳에 놓을 수 있어요. 거치대는 칸 제한이 없습니다. 든 검을 상인에게 가져가면 팔 수 있어요.</p>' +
      '<p><b>타격 결과</b> — 대성공 +2 · 성공 +1 · 유지 · 강화 하락 -1 · 파괴(검 소멸). 모루 앞에 서면 아래쪽에 지금 확률이 보입니다.</p>' +
      '<p><b>타이밍</b> — 움직이는 바늘이 가운데 금빛 칸에 있을 때 치면 <b>완벽</b>: 파괴 확률이 크게 줄고 폭주 게이지가 2칸 찹니다. 빗나가면 위험이 커집니다.</p>' +
      '<p><b>열기</b> — 검은 칠 때마다, 그리고 시간이 지나면 식습니다. <b>식은 검을 두드리면 강화 하락 확률이 크게 오르고</b> 대성공이 사라져요. 열기가 60% 아래로 떨어지면 다시 들고 화로로 가세요. 새빨갛게(90%+) 달궈진 검은 대성공이 조금 더 잘 나옵니다.</p>' +
      '<p><b>불꽃 폭주</b> — 게이지 14칸을 채우면 4초 동안 파괴가 사라집니다. 이때 몰아치세요.</p>' +
      '<p><b>공물</b> — 요구량을 못 채우면 용의 인내심이 1 줄고, 0이 되면 끝. 초과분의 절반은 골드로 돌려받습니다. 골드로 유물·특수 검·도구를 사세요.</p>' +
      '<p><b>결전</b> — 마지막 날 공물을 바친 뒤, 남겨 둔 검으로 이그나르와 싸웁니다. 검 가치가 곧 공격력. +15 최종 형태 검은 고유 스킬을 씁니다. 붉은 표식을 피하세요!</p>' +
      '<p><b>멀티플레이</b> — 방 코드로 모여 각자 자기 대장간에서 같은 날, 같은 상점, 같은 사건으로 경쟁합니다. 하루는 제한시간이 있고, 상인에게 <b>저주</b>를 사서 라이벌을 방해할 수 있어요. 팀전은 팀원에게 검·골드를 보내고 탄원으로 인내심을 채워 줄 수 있고, 결전에서는 팀이 한 마리 용을 함께 잡습니다.</p>' +
      (Main.touch ? '<p class="muted small">가로 화면 전용 · 3D 화면의 물건을 눌러도 이동/조작할 수 있어요</p>' : '<p class="muted small">단축키: E 들기/놓기 · Q 내려놓기 · 클릭/Space 타격 · R 거치대 · T 공물대 · B 종 · G 자동 공물 · 1~7 장소 이동 · ? 도움말</p>'), [{ t: '알겠다', cls: 'pri' }]);
  }
  function codex() {
    const ach = U.store.get('ach', {}), sr = U.store.get('seen_relic', {}), stp = U.store.get('seen_type', {});
    const best = U.store.get('best', 0);
    G.modal('<h2 class="h">도감 · 업적</h2><p class="muted small">최고 점수 ' + U.fmt(best) + '</p>' +
      '<h4>업적 ' + Object.keys(ach).length + ' / ' + ET.ACH.length + '</h4><div class="swlist">' + ET.ACH.map(a => '<div class="sw" style="opacity:' + (ach[a.id] ? 1 : .45) + '"><div class="t"><span>' + a.n + '</span><i>' + (ach[a.id] ? '달성' : '') + '</i></div><div class="v">' + a.d + '</div></div>').join('') + '</div>' +
      '<h4>검</h4><div class="swlist">' + Object.entries(ET.TYPES).map(([k, T]) => '<div class="sw" style="opacity:' + (k === 'iron' || stp[k] ? 1 : .45) + '"><div class="t"><span>' + T.name + '</span><i>' + T.base + ' G</i></div><div class="v">' + T.desc + '<br>최종 고유기: ' + T.abName + ' — ' + T.abDesc + '</div></div>').join('') + '</div>' +
      '<h4>유물</h4><div class="swlist">' + ET.RELICS.map(R => '<div class="sw" style="opacity:' + (sr[R.id] ? 1 : .45) + '"><div class="t"><span>' + R.name + '</span><i class="r' + R.r + 't">' + ET.RAR[R.r] + '</i></div><div class="v">' + (sr[R.id] ? R.d : '아직 손에 넣지 못했다') + (R.mp ? ' (멀티 전용)' : '') + '</div></div>').join('') + '</div>', [{ t: '닫기', cls: 'pri' }]);
  }

  // what clicking / E does on the thing under the crosshair, given what you hold
  function label(hit) {
    const S = G.S; if (!hit || !hit.action || !S || S.phase !== 'forge') return '';
    const a = hit.action, held = S.hand;
    const swName = id => { const sw = G.find(id); return sw ? ET.TYPES[sw.type].name + ' +' + sw.lv + ' · ' + U.fmt(G.val(sw)) + ' G' : '검'; };
    if (held) {
      if (a === 'strike') return S.anvil ? '모루 위 검과 바꾸기' : '모루에 올려놓기';
      if (a === 'rackview' || (a === 'sword' && G.where(hit.id) === 'rack')) return '거치대에 걸기';
      if (a === 'tribute' || (a === 'sword' && G.where(hit.id) === 'counter')) return S.settled ? '' : '공물대에 올리기';
      if (a === 'sword') return swName(hit.id) + ' · 바꿔 들기';
      if (a === 'shop') return '상인에게 팔기';
      if (a === 'heat') return '화로 가까이 들고 있으면 달궈져요';
      if (a === 'floor') return '바닥에 내려놓기';
    } else {
      if (a === 'strike') return S.anvil ? (Main.touch ? '두드리기 · 끌어서 들기' : '클릭 두드리기 (꾹=연속) · E 들기') : '';
      if (a === 'sword') return swName(hit.id) + ' · ' + (Main.touch ? '탭해서 들기' : Main.locked && Main.locked() ? '클릭해서 들기' : 'E 들기 · 끌어서 옮기기');
      if (a === 'heat') return '화로 · 검을 들고 오면 달궈짐';
      if (a === 'rackview') return '검 거치대';
      if (a === 'tribute') return '공물대';
    }
    return { bell: '종 치기 · 공물 바치기', shop: '재의 상인', relics: '유물 전시장', quests: '의뢰 게시판', dragon: '이그나르' }[a] || '';
  }
  function interact(hit, opts) {
    if (!hit || !hit.action || !G.S || G.S.phase === 'dead') return;
    const S = G.S, a = hit.action, held = S.hand, open = st => F.walkTo(st, () => G.go(st));
    if (S.phase !== 'forge') { if (a === 'dragon') F.dragonReact('peek'); return; }
    if (held) {
      if (a === 'strike') return G.place('anvil');
      if (a === 'rackview' || (a === 'sword' && G.where(hit.id) === 'rack')) return G.place('rack');
      if (a === 'tribute' || (a === 'sword' && G.where(hit.id) === 'counter')) return G.place('counter');
      if (a === 'sword' && hit.id) return G.grab(hit.id);
      if (a === 'shop') return F.walkTo('shop', () => G.sell(held.id));
      if (a === 'heat') return F.walkTo('furnace');
      if (a === 'floor') { const pt = F.hitPoint; if (pt && Math.hypot(pt.x - F.P.x, pt.z - F.P.z) < 3 && !F.blockedAt(pt.x, pt.z)) return G.place('floor', { x: pt.x, z: pt.z, r: F.P.yaw + Math.PI / 2 + (Math.random() - .5) * .6 }); return G.dropHand(); }
    } else {
      if (a === 'strike') { if (opts && opts.grab && S.anvil) return G.grab(S.anvil.id); if (F.near('anvil')) G.strike(); else F.walkTo('anvil'); return; }
      if (a === 'sword' && hit.id) { const w = G.where(hit.id); const st = w === 'rack' ? 'rack' : w === 'counter' ? 'tribute' : null; if (st && !F.near(st)) return F.walkTo(st, () => G.grab(hit.id)); return G.grab(hit.id); }
      if (a === 'heat') return G.toast('모루 위 검을 들고(E / 끌기) 화로 가까이 가져오면 달궈집니다');
      if (a === 'rackview') return F.walkTo('rack');
      if (a === 'tribute') return F.walkTo('tribute');
    }
    if (a === 'bell') { if (F.near('tribute')) G.ringBell(); else F.walkTo('tribute', () => G.ringBell()); }
    else if (a === 'shop') open('shop');
    else if (a === 'relics') open('relics');
    else if (a === 'quests') open('quests');
    else if (a === 'dragon') { F.dragonReact('peek'); A.play('roar', .4); }
  }
  Main.interact = interact;
  Main.lockCheck = function () { if (Main.locked && Main.locked() && !Main.lockWanted()) document.exitPointerLock(); if (Main.lockHint && ((Main.lhT = (Main.lhT || 0) + 1) % 15 === 0)) Main.lockHint(); };
  Main.keyHelp = function () {
    const rows = [['W A S D', '이동 (Shift 달리기)'], ['마우스 드래그 / ← →', '시선'], ['E · F', '조준한 검 들기 / 든 검 놓기'], ['검을 끌어서 놓기', '바닥의 검을 끌어 모루·거치대·공물대에 놓기'], ['클릭 · Space (꾹)', '모루 위 검 두드리기 / 계속'], ['Q', '든 검 바닥에 내려놓기'], ['화로', '검을 들고 가까이 가면 달궈짐 · 식은 검은 강화 하락 위험'], ['R / T', '든 검 → 거치대 / 공물대'], ['G', '자동 공물 선택'], ['B', '종 치기 (공물대 근처)'], ['J', '잡검 일괄 판매'], ['1 ~ 7', '모루·화로·거치대·공물대·상인·전시장·게시판으로 걷기'], ['? / F1', '이 도움말']];
    G.modal('<h2 class="h">단축키</h2><table class="keys">' + rows.map(r => '<tr><td><kbd>' + r[0] + '</kbd></td><td>' + r[1] + '</td></tr>').join('') + '</table>', [{ t: '닫기' }]);
  };
  addEventListener('beforeunload', () => { try { G.save && G.save(); } catch (e) { } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) try { G.save && G.save(); } catch (e) { } });
  let promptT = 0;
  Main.updatePrompt = function () {
    const el = $('#prompt'), xh = $('#xh'); if (!el) return;
    const show = G.S && !FT.active && F.mode === 'play' && $('#hud').classList.contains('show') && !Main.dragging;
    xh.style.display = show ? 'block' : 'none'; if (!show) { el.style.display = 'none'; return; }
    const cx = F.centerX(); xh.style.left = cx + 'px'; el.style.left = cx + 'px';
    if (performance.now() - promptT < 90) return; promptT = performance.now();
    const hit = F.pickCenter(); const lab = label(hit);
    if (lab) { el.textContent = lab; el.style.display = 'block'; xh.classList.add('on'); } else { el.style.display = 'none'; xh.classList.remove('on'); }
    const ab = $('#bAct'); if (ab) { const S = G.S, t = S.hand ? (lab ? '놓기' : '내려\n놓기') : hit && hit.action === 'strike' && S.anvil ? '두드\n리기' : hit && hit.action === 'sword' ? '들기' : '상호\n작용'; if (ab.dataset.t !== t) { ab.dataset.t = t; ab.textContent = t; } }
    const gb = $('#bGrab'); if (gb) gb.style.display = Main.touch && G.S && G.S.phase === 'forge' && (G.S.hand || (hit && hit.action === 'strike' && G.S.anvil)) ? 'block' : 'none', gb && (gb.textContent = G.S && G.S.hand ? '바닥에' : '들기');
  };
  function bindInput() {
    const I = F.input;
    const setK = (k, v) => { if (k === 'w') I.f = v; else if (k === 's') I.b = v; else if (k === 'a') I.l = v; else if (k === 'd') I.r = v; else if (k === 'shift') I.run = v; else if (k === 'arrowup') I.f = v; else if (k === 'arrowdown') I.b = v; else if (k === 'arrowleft') F.turnL = v; else if (k === 'arrowright') F.turnR = v; };
    addEventListener('keydown', e => {
      const tg = e.target.tagName; if (tg === 'INPUT' || tg === 'SELECT' || FT.active || !G.S) return;
      if ($('#modal').classList.contains('show')) return;
      const k = e.key.toLowerCase(); setK(k, 1);
      if (k === ' ') { e.preventDefault(); if (!e.repeat) { if (G.S.hand) interact(F.pickCenter()); else { G.strike(); G.hold = true; } } }
      else if (k === 'e' || k === 'f') { const hit = F.pickCenter(); if (!G.S.hand && hit && hit.action === 'strike') interact(hit, { grab: 1 }); else if (G.S.hand && (!hit || !label(hit))) G.dropHand(); else interact(hit); }
      else if (k === 'q') { if (G.S.hand) G.dropHand(); }
      else if (k === 'h') { if (G.S.hand) F.walkTo('furnace'); else G.heat(); }
      else if (k === 'r') { if (G.S.hand) G.place('rack'); }
      else if (k === 't') { if (G.S.hand) G.place('counter'); }
      else if (k === 'b') { F.walkTo('tribute', () => G.ringBell()); }
      else if (k === 'g') G.autoTribute();
      else if (k === '?' || k === 'f1') { e.preventDefault(); Main.keyHelp(); }
      else if (k === 'j') G.sellJunk();
      else if ('1234567'.includes(k) && k) { const st = ['anvil', 'furnace', 'rack', 'tribute', 'shop', 'relics', 'quests'][+k - 1]; F.walkTo(st, () => G.go(st)); }
      else if (k === 'escape') { G.hold = false; G.closePanel(); }
    });
    addEventListener('keyup', e => { const k = e.key.toLowerCase(); setK(k, 0); if (k === ' ') G.hold = false; });
    addEventListener('blur', () => { for (const k in I) I[k] = 0; F.turnL = F.turnR = 0; G.hold = false; });
    const cv = $('#c'); let drag = null;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    // ---- mouse lock (FPS look). First click locks the cursor; Esc releases it. ----
    Main.locked = () => document.pointerLockElement === cv;
    Main.lockWanted = () => !Main.touch && !Main.lockFailed && G.prefs.lock !== false && G.S && F.mode === 'play' && !FT.active && !G.panel && !$('#modal').classList.contains('show') && $('#hud').classList.contains('show');
    Main.lock = function () { try { const r = cv.requestPointerLock({ unadjustedMovement: false }); if (r && r.catch) r.catch(() => lockErr()); } catch (er) { lockErr(); } };
    function lockErr() { if (Main.lockOk || Main.lockFailed) return; Main.lockFailed = true; G.toast('이 화면에서는 마우스 고정이 막혀 있어요. 드래그로 시점을 돌리거나, GitHub 페이지에서 열면 고정됩니다.', 'bad'); }
    document.addEventListener('pointerlockchange', () => { if (Main.locked()) { Main.lockOk = true; drag = null; } else { G.hold = false; lk = null; Main.dragging = false; F.dragEnd && F.dragEnd(); Main.dropHint(''); } Main.lockHint(); });
    document.addEventListener('pointerlockerror', lockErr);
    Main.lockHint = function () { const el = $('#lockHint'); if (!el) return; el.style.display = !Main.locked() && Main.lockWanted() ? 'block' : 'none'; };
    let lk = null;
    const centerHint = () => { const S = G.S; Main.dropHint(S && S.hand && lk && lk.grab ? label(F.pickCenter()) : '', innerWidth / 2, innerHeight / 2 + 24); };
    cv.addEventListener('pointerdown', e => {
      A.init();
      if (FT.active) { FT.attack(); FT.mouseHold = true; return; }
      if (!G.S || F.mode !== 'play') return;
      if (!Main.locked() && Main.lockWanted() && e.pointerType === 'mouse') { Main.lock(); if (!Main.lockFailed) return; }
      if (Main.locked()) {
        if (e.button !== 0) return;
        const S = G.S, hit = F.pickCenter();
        if (S.phase !== 'forge' || S.hand) { interact(hit); return; }
        if (hit && hit.action === 'strike' && S.anvil) { lk = { anvil: 1, mv: 0, t0: performance.now() }; clearTimeout(Main.holdTO); Main.holdTO = setTimeout(() => { if (lk && lk.anvil && !lk.grab) { lk.striking = true; G.strike(); G.hold = true; } }, 200); return; }
        if (hit && hit.action === 'sword' && hit.id) { const w = G.where(hit.id), st = w === 'rack' ? 'rack' : w === 'counter' ? 'tribute' : null; if (st && !F.near(st)) { interact(hit); return; } if (G.grab(hit.id)) { lk = { grab: 1, mv: 0, t0: performance.now() }; Main.dragging = true; } return; }
        interact(hit); return;
      }
      const hit = F.pick(e.clientX, e.clientY, 4.5), S = G.S;
      const item = S.phase === 'forge' && hit && ((hit.action === 'sword' && hit.id) || (hit.action === 'strike' && S.anvil)) ? hit : null;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: 0, item, t0: performance.now(), held: !!S.hand }; try { cv.setPointerCapture(e.pointerId); } catch (er) { }
      // hold the mouse on the anvil sword = keep striking
      if (item && item.action === 'strike' && !S.hand) { clearTimeout(Main.holdTO); Main.holdTO = setTimeout(() => { if (drag && drag.item === item && drag.moved < 10 && !G.S.hand) { drag.striking = true; G.strike(); G.hold = true; } }, 230); }
    });
    cv.addEventListener('pointermove', e => {
      if (Main.locked()) {
        const sn = .0023 * (G.prefs.sens || 1), mx = e.movementX || 0, my = e.movementY || 0;
        if (Math.abs(mx) < 400 && Math.abs(my) < 400) F.look(mx * sn, my * sn * (G.prefs.invert ? -1 : 1));
        if (lk) { lk.mv += Math.abs(mx) + Math.abs(my);
          if (lk.anvil && !lk.striking && !lk.grab && lk.mv > 30) { clearTimeout(Main.holdTO); if (G.S.anvil && G.grab(G.S.anvil.id)) { lk.grab = 1; Main.dragging = true; } }
          if (lk.grab) centerHint(); }
        return;
      }
      if (drag && e.pointerId === drag.id && drag.item && !drag.held && !drag.striking) {
        drag.moved = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
        if (!drag.grabbed && drag.moved > 10) { clearTimeout(Main.holdTO); const id = drag.item.action === 'strike' ? G.S.anvil && G.S.anvil.id : drag.item.id; if (id && G.grab(id)) { drag.grabbed = true; Main.dragging = true; } else drag.item = null; }
        if (drag.grabbed) { F.dragAt(e.clientX, e.clientY); const h = F.pick(e.clientX, e.clientY, 4.5); cv.style.cursor = 'grabbing'; Main.dropHint(label(h), e.clientX, e.clientY); }
        return;
      }
      if (drag && e.pointerId === drag.id) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy); const sn = .0045 * (G.prefs.sens || 1) * (Main.touch ? 1.25 : 1); F.look(dx * sn, dy * sn * (G.prefs.invert ? -1 : 1)); }
      else if (!Main.touch && G.S && !FT.active && F.mode === 'play') { const hit = F.pick(e.clientX, e.clientY, 4.5); cv.style.cursor = hit && (hit.action === 'sword' || (hit.action === 'strike' && G.S.anvil)) && !G.S.hand ? 'grab' : label(hit) ? 'pointer' : 'default'; }
    });
    const end = e => {
      FT.mouseHold = false;
      if (Main.locked() || lk) {
        const l = lk; lk = null; clearTimeout(Main.holdTO); if (!l) return;
        if (l.striking) { G.hold = false; return; }
        if (l.anvil && !l.grab) { G.strike(); return; }
        if (l.grab) { Main.dragging = false; Main.dropHint(''); // held & turned to a target → put it there; a quick click just keeps it in hand
          if (performance.now() - l.t0 > 280 && l.mv > 40) { const h = F.pickCenter(); if (h && label(h)) interact(h); } }
        return;
      } if (!drag || e.pointerId !== drag.id) return; const d = drag; drag = null; clearTimeout(Main.holdTO);
      if (d.striking) { G.hold = false; return; }
      if (d.grabbed) { Main.dragging = false; F.dragEnd(); Main.dropHint(''); cv.style.cursor = 'default'; const h = F.pick(e.clientX, e.clientY, 4.5); if (h && label(h)) interact(h); return; }
      if (d.moved < 10 && e.type === 'pointerup') interact(F.pick(e.clientX, e.clientY, 4.5));
    };
    Main.dropHint = function (txt, x, y) { const el = $('#dropHint'); if (!el) return; if (!txt) { el.style.display = 'none'; return; } el.textContent = txt; el.style.display = 'block'; el.style.left = x + 'px'; el.style.top = (y + 22) + 'px'; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    addEventListener('pointerup', () => { FT.mouseHold = false; });
    // touch movement stick
    const mj = $('#mjoy'), mk = $('#mjoyK');
    if (mj) { let id = null, cx = 0, cy = 0; const Rr = 44;
      const mv = e => { const dx = e.clientX - cx, dy = e.clientY - cy, l = Math.min(Rr, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); I.jx = Math.cos(a) * l / Rr; I.jy = Math.sin(a) * l / Rr; I.run = l > Rr * .92 ? 1 : 0; mk.style.transform = 'translate(' + (I.jx * Rr) + 'px,' + (I.jy * Rr) + 'px)'; };
      mj.addEventListener('pointerdown', e => { e.preventDefault(); id = e.pointerId; const r = mj.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; mj.setPointerCapture(id); mv(e); });
      mj.addEventListener('pointermove', e => { if (e.pointerId === id) mv(e); });
      const up = e => { if (e.pointerId !== id) return; id = null; I.jx = I.jy = 0; I.run = 0; mk.style.transform = ''; };
      mj.addEventListener('pointerup', up); mj.addEventListener('pointercancel', up); }
    const ib = $('#bAct'); if (ib) { ib.addEventListener('pointerdown', e => { e.preventDefault(); const hit = F.pickCenter(); if (!G.S.hand && hit && hit.action === 'strike' && G.S.anvil) { G.strike(); G.hold = true; } else if (G.S.hand && !label(hit)) G.dropHand(); else interact(hit); }); const stop = () => { G.hold = false; }; ib.addEventListener('pointerup', stop); ib.addEventListener('pointercancel', stop); ib.addEventListener('pointerleave', stop); }
    const gb = $('#bGrab'); if (gb) gb.addEventListener('pointerdown', e => { e.preventDefault(); if (!G.S) return; if (G.S.hand) G.dropHand(); else if (G.S.anvil) G.grab(G.S.anvil.id); });
  }
  function settings() {
    const p = G.prefs;
    G.modal('<h2 class="h">설정</h2><div class="grid2" style="margin-top:10px">' +
      '<label class="f">소리 크기<input type="range" id="sVol" min="0" max="1" step=".05" value="' + U.store.get('vol', .7) + '"></label>' +
      '<label class="f">시점 감도<input type="range" id="sSens" min=".3" max="2.5" step=".1" value="' + (p.sens || 1) + '"></label>' +
      '<label class="f chk"><span><input type="checkbox" id="sInv"' + (p.invert ? ' checked' : '') + '> 상하 반전</span></label>' +
      '<label class="f chk"><span><input type="checkbox" id="sLock"' + (p.lock !== false ? ' checked' : '') + '> 마우스 고정 (클릭하면 커서가 잠기고 마우스로 시점 회전)</span></label>' +
      '<label class="f chk"><span><input type="checkbox" id="sHeat"' + (p.autoHeat ? ' checked' : '') + '> 식으면 연속 타격 멈춤</span></label>' +
      '<label class="f">연속 타격 목표<select id="sTarget">' + [0, 10, 15, 20, 30, 40, 50, 75, 100, 150].map(v => '<option value="' + v + '"' + (p.target === v ? ' selected' : '') + '>' + (v ? '+' + v + '에서 멈춤' : '목표 없음') + '</option>').join('') + '</select></label>' +
      '<label class="f">안전 정지<select id="sSafe">' + [0, 5, 10, 15, 20, 30].map(v => '<option value="' + v + '"' + (p.safeB === v ? ' selected' : '') + '>' + (v ? '파괴 ' + v + '% 초과 시' : '끔') + '</option>').join('') + '</select></label>' +
      '<label class="f">그래픽<select id="sQ"><option value="auto">자동</option><option value="low">가볍게</option><option value="high">높게</option></select></label>' +
      '</div><p class="muted small">조작: WASD 이동 · 마우스 드래그 시점 · 검을 끌어서 옮기기 · E 들기/놓기 · Q 내려놓기 · 클릭/Space 두드리기 · 화로 가까이 들고 가면 가열 · G 공물 자동 선택 · B 종 · 1~7 장소로 걸어가기 · ? 도움말</p>', [{ t: '닫기', cls: 'pri' }]);
    $('#sQ').value = U.store.get('quality', 'auto');
    $('#sTarget').onchange = e => { p.target = +e.target.value; G.savePrefs(); }; $('#sSafe').onchange = e => { p.safeB = +e.target.value; G.savePrefs(); };
    $('#sVol').oninput = e => A.setVol(+e.target.value);
    $('#sSens').oninput = e => { p.sens = +e.target.value; G.savePrefs(); };
    $('#sInv').onchange = e => { p.invert = e.target.checked; G.savePrefs(); };
    $('#sLock').onchange = e => { p.lock = e.target.checked; G.savePrefs(); Main.lockFailed = false; };
    $('#sHeat').onchange = e => { p.autoHeat = e.target.checked; G.savePrefs(); };
    $('#sQ').onchange = e => { U.store.set('quality', e.target.value); G.toast('그래픽 설정은 새로고침하면 적용돼요'); };
  }
  Main.settings = settings;

  addEventListener('load', () => { try { boot().catch(e => { const l = $('#load'); if (l) l.textContent = '시작하지 못했습니다: ' + e.message; console.error(e); }); } catch (e) { const l = $('#load'); if (l) l.textContent = '그래픽을 시작하지 못했습니다: ' + e.message; console.error(e); } });
})(window.ET);
