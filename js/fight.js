/* EMBER TITHE — dragon boss fight */
'use strict';
(function (ET) {
  const M = ET.M, U = ET.U, A = ET.Audio, $ = U.$, X = ET.X;
  const FT = ET.Fight = { active: false };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const ARENA = 15;

  FT.init = function (hi) {
    const sc = FT.scene = new THREE.Scene();
    sc.background = new THREE.Color(0x050202); sc.fog = new THREE.FogExp2(0x120503, .03);
    const cam = FT.cam = new THREE.PerspectiveCamera(60, 1, .05, 140); sc.add(cam);
    sc.add(new THREE.HemisphereLight(0x5a3428, 0x0a0303, .5));
    const moon = new THREE.DirectionalLight(0x8090c0, .9); moon.position.set(-14, 26, 10); moon.castShadow = true; moon.shadow.mapSize.set(hi ? 2048 : 1024, hi ? 2048 : 1024); const s = moon.shadow.camera; s.left = s.bottom = -22; s.right = s.top = 22; s.far = 80; moon.shadow.bias = -.0008; sc.add(moon);
    FT.redL = new THREE.PointLight(0xff4a10, 4, 40, 1.6); FT.redL.position.set(0, 3, 0); sc.add(FT.redL);
    [[18, 0], [-14, 12], [-10, -16], [12, -14]].forEach(([x, z]) => { const l = new THREE.PointLight(0xff5010, 5, 26, 1.8); l.position.set(x, 1.5, z); sc.add(l); });
    // sky dome with ash glow
    const sky = new THREE.SphereGeometry(110, 32, 16), cols = []; const pa = sky.attributes.position;
    for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) / 110; const c = new THREE.Color().setRGB(.16, .035, .015).multiplyScalar(Math.max(.05, .9 - y * 1.6)); cols.push(c.r, c.g, c.b); }
    sky.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); sc.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, toneMapped: false })));
    // platform
    const fl = X.rep(M.set.flag, 7, 7);
    const ground = M.mesh(new THREE.CircleGeometry(ARENA + 1, 96), X.mat(fl), false); ground.rotation.x = -Math.PI / 2; sc.add(ground);
    const rimG = new THREE.CylinderGeometry(ARENA + 1.4, ARENA + 2.2, 1.6, 96, 1, true); const rim = M.mesh(rimG, X.mat(X.rep(M.set.cave, 12, 1)), false); rim.position.y = -.8; sc.add(rim);
    const lt = X.rep(M.set.lava, 10, 10); FT.lava = M.mesh(new THREE.RingGeometry(ARENA + 1.6, 90, 96, 4), X.mat(lt, { emissive: 0xffffff, emissiveIntensity: 1.6 }), false); FT.lava.rotation.x = -Math.PI / 2; FT.lava.position.y = -1.2; sc.add(FT.lava);
    // carved rune circles
    const runeM = new THREE.MeshBasicMaterial({ color: 0xff6a20, transparent: true, opacity: .28, toneMapped: false });
    [5, 9.5, 13.8].forEach(r => { const m = M.mesh(new THREE.RingGeometry(r, r + .06, 128), runeM, false); m.rotation.x = -Math.PI / 2; m.position.y = .01; sc.add(m); });
    // basalt pillars / ruined columns
    const rockM = X.mat(X.rep(M.set.cave, 1, 2), { emissive: 0xff4010, emissiveIntensity: .8 });
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2 + .2, h = 4 + Math.random() * 9, r = ARENA + 4 + Math.random() * 3;
      const g = new THREE.CylinderGeometry(.9 + Math.random() * .4, 1.4 + Math.random() * .5, h, 7, 6); const gp = g.attributes.position; for (let k = 0; k < gp.count; k++) { const n = X.fbm(gp.getX(k) * .5 + i, gp.getY(k) * .3, 64, 3) - .5; gp.setX(k, gp.getX(k) * (1 + n * .5)); gp.setZ(k, gp.getZ(k) * (1 + n * .5)); } g.computeVertexNormals();
      const p = M.mesh(g, rockM); p.position.set(Math.cos(a) * r, h / 2 - 1.2, Math.sin(a) * r); p.rotation.set((Math.random() - .5) * .2, Math.random() * 3, (Math.random() - .5) * .2); sc.add(p);
    }
    for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, r = ARENA - 1 + Math.random() * 2; const b = M.mesh(new THREE.DodecahedronGeometry(.3 + Math.random() * .6, 1), rockM); b.position.set(Math.cos(a) * r, .1, Math.sin(a) * r); b.scale.y = .6; sc.add(b); }
    // dragon
    FT.D = M.makeDragon(); FT.D.scale.setScalar(1.45); sc.add(FT.D);
    FT.breathFires = new THREE.Group(); sc.add(FT.breathFires);
    for (let i = 0; i < 9; i++) { const f = M.makeFire(2.4 + i * .5, 3 + i * .4, 2.2, null, i * .21); f.visible = false; FT.breathFires.add(f); }
    FT.teleMat = () => new THREE.MeshBasicMaterial({ color: 0xff2a08, transparent: true, opacity: .25, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    FT.fx = new M.Particles(sc, 460, 'rgba(255,120,40,.9)');
    FT.fx2 = new M.Particles(sc, 180, 'rgba(170,220,255,.9)');
    FT.ash = new M.Particles(sc, 160, 'rgba(255,90,20,.8)');
    FT.smoke = new M.Particles(sc, 60, null, false, X.smoke());
    M.lin(sc);
    // view sword holder
    FT.hand = new THREE.Group(); cam.add(FT.hand); FT.hand.position.set(.34, -.34, -.62);
    const handL = new THREE.PointLight(0xffd0a0, .6, 2, 2); handL.position.set(.2, .2, -.2); cam.add(handL);
    // keys
    FT.keys = {};
    addEventListener('keydown', e => { if (!FT.active) return; const k = e.key.toLowerCase(); FT.keys[k] = true; if (k === ' ') { e.preventDefault(); FT.dodge(); } if (k === 'j') FT.attack(); if (k === 'q' || k === 'k') FT.skill(); if (k === 'arrowleft') FT.keys.a = true; if (k === 'arrowright') FT.keys.d = true; if (k === 'arrowup') FT.keys.w = true; if (k === 'arrowdown') FT.keys.s = true; });
    addEventListener('keyup', e => { const k = e.key.toLowerCase(); FT.keys[k] = false; if (k === 'arrowleft') FT.keys.a = false; if (k === 'arrowright') FT.keys.d = false; if (k === 'arrowup') FT.keys.w = false; if (k === 'arrowdown') FT.keys.s = false; });
    U.$$('#pad [data-k]').forEach(b => { const k = b.dataset.k; const on = e => { e.preventDefault(); FT.keys[k] = true; }, off = () => FT.keys[k] = false; b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off); });
    const joy = $('#joy'), knob = $('#joyK'); FT.joy = { x: 0, y: 0 };
    if (joy) { let id = null, cx = 0, cy = 0; const R = 46;
      const mv = e => { const dx = e.clientX - cx, dy = e.clientY - cy, l = Math.min(R, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); FT.joy.x = Math.cos(a) * l / R; FT.joy.y = Math.sin(a) * l / R; knob.style.transform = 'translate(' + (FT.joy.x * R) + 'px,' + (FT.joy.y * R) + 'px)'; };
      joy.addEventListener('pointerdown', e => { e.preventDefault(); id = e.pointerId; const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; joy.setPointerCapture(id); mv(e); });
      joy.addEventListener('pointermove', e => { if (e.pointerId === id) mv(e); });
      const up = e => { if (e.pointerId !== id) return; id = null; FT.joy.x = FT.joy.y = 0; knob.style.transform = ''; };
      joy.addEventListener('pointerup', up); joy.addEventListener('pointercancel', up); }
    $('#fAtk').addEventListener('pointerdown', e => { e.preventDefault(); FT.attack(); FT.holdAtk = true; }); $('#fAtk').addEventListener('pointerup', () => FT.holdAtk = false); $('#fAtk').addEventListener('pointerleave', () => FT.holdAtk = false);
    $('#fSkill').addEventListener('pointerdown', e => { e.preventDefault(); FT.skill(); });
    $('#fDodge').addEventListener('pointerdown', e => { e.preventDefault(); FT.dodge(); });
  };

  FT.start = function (o) {
    FT.o = o; FT.active = true; FT.t = 0; FT.ended = false; M.mat.dragonSkin.emissiveIntensity = .55;
    FT.hp = o.hp; FT.maxHp = o.maxHp; FT.dmgDone = 0;
    FT.pl = { th: 0, r: 11, hearts: 5, inv: 0, dash: 0, dashCd: 0, dashDir: V(0, 0, 0), atkCd: 0, skCd: 0, swing: 0 };
    FT.dr = { state: 'intro', t: 0, attack: null, cd: 2.4, frozen: 0, burn: 0, burnTick: 0, y: 0, dying: 0, hitFlash: 0 };
    FT.teles = []; FT.projs = []; FT.minions = [];
    const T = ET.TYPES[o.sword.type]; FT.T = T; FT.fin = o.sword.lv >= ET.FINAL_LV;
    FT.ab = FT.fin ? T.ab : 'basic';
    FT.skMax = { basic: 7, quake: 8, fireball: 6, frost: 11, storm: 8, skeleton: 15, meteor: 10 }[FT.ab];
    FT.base = ET.dmgOf(o.value);
    while (FT.hand.children.length) FT.hand.remove(FT.hand.children[0]);
    const sw = M.makeSword(o.sword.type, o.sword.lv); sw.rotation.set(-.35, .25, -.35); sw.scale.setScalar(.85); sw.traverse(c => { if (c.isMesh) { c.castShadow = false; } }); FT.hand.add(sw); FT.sw3 = sw;
    FT.D.position.set(0, 0, 0); FT.D.rotation.set(0, 0, 0); M.mat.dragonSkin.color.set(0xffffff);
    $('#fhud').classList.add('show'); $('#fSkillN').textContent = FT.fin ? T.abName : '강타';
    $('#fSword').textContent = T.name + ' +' + o.sword.lv + ' · 기본 피해 ' + FT.base;
    FT.ui(); A.play('roar', 1.2); A.ambLevel(.05);
    FT.shake = .3;
  };
  FT.stop = function () { FT.active = false; M.mat.dragonSkin.color.set(0xffffff); M.mat.dragonSkin.emissiveIntensity = .55; FT.breathFires.children.forEach(f => f.visible = false); $('#fhud').classList.remove('show'); FT.teles.forEach(t => FT.scene.remove(t.m)); FT.teles = []; FT.minions.forEach(m => FT.scene.remove(m.g)); FT.minions = []; FT.projs.forEach(p => FT.scene.remove(p.m)); FT.projs = []; A.ambLevel(.12); };
  FT.end = function (win, reason) {
    if (FT.ended) return; FT.ended = true;
    const res = { win, hp: Math.max(0, FT.hp), dmg: FT.dmgDone, reason };
    if (win) { FT.dr.dying = .001; A.play('roar', .8); setTimeout(() => { FT.stop(); FT.o.onEnd(res); }, 2800); }
    else { A.play('hurt'); setTimeout(() => { FT.stop(); FT.o.onEnd(res); }, 1400); }
  };
  FT.resize = function (w, h) { FT.cam.aspect = w / h; FT.cam.fov = w / h < .8 ? 78 : 62; FT.cam.updateProjectionMatrix(); };
  FT.ppos = () => V(Math.sin(FT.pl.th) * FT.pl.r, 0, Math.cos(FT.pl.th) * FT.pl.r);
  FT.curHP = () => FT.hp - (FT.o.extDmg ? FT.o.extDmg() : 0);

  // ---- player actions ----
  FT.hit = function (mult, label, col) {
    if (!FT.active || FT.ended) return;
    let d = Math.round(FT.base * mult * (FT.dr.frozen > 0 ? 1.25 : 1) * (.9 + Math.random() * .2));
    FT.hp -= d; FT.dmgDone += d; FT.o.onDmg && FT.o.onDmg(d); FT.dr.hitFlash = 1;
    FT.num(d, label, col);
    if (FT.curHP() <= 0) FT.end(true);
  };
  FT.attack = function () {
    const p = FT.pl; if (!FT.active || FT.ended || p.atkCd > 0) return;
    p.atkCd = .42; p.swing = .001; A.play('slash');
    setTimeout(() => { if (FT.pl.r <= 5.2) { FT.hit(1); A.play('clang', .6); const hp = V(0, 3, 0).add(FT.ppos().multiplyScalar(.25)); for (let i = 0; i < 14; i++) FT.fx.emit(hp, V((Math.random() - .5) * 5, Math.random() * 4, (Math.random() - .5) * 5), .4, .15, 0xffc060, 6); } else FT.tip('너무 멀다 — W로 다가가세요'); }, 120);
  };
  FT.dodge = function () {
    const p = FT.pl; if (!FT.active || FT.ended || p.dashCd > 0) return;
    let mx = (FT.keys.d ? 1 : 0) - (FT.keys.a ? 1 : 0) + (FT.joy ? FT.joy.x : 0), mz = (FT.keys.s ? 1 : 0) - (FT.keys.w ? 1 : 0) + (FT.joy ? FT.joy.y : 0);
    if (Math.abs(mx) < .2 && Math.abs(mz) < .2) { mx = 0; mz = 1; } p.dashDir.set(mx, 0, mz).normalize(); p.dash = .25; p.inv = Math.max(p.inv, .4); p.dashCd = 1; A.play('whoosh');
  };
  FT.skill = function () {
    const p = FT.pl; if (!FT.active || FT.ended || p.skCd > 0) return;
    const chest = V(0, 3.2, 0), pp = FT.ppos();
    switch (FT.ab) {
      case 'basic': if (p.r > 5.8) return FT.tip('강타는 가까이서만 — 다가가세요'); p.skCd = FT.skMax; p.swing = .001; A.play('boom'); setTimeout(() => FT.hit(3, '강타'), 150); break;
      case 'quake': if (p.r > 10) return FT.tip('충격파 사거리 밖'); p.skCd = FT.skMax; A.play('boom'); FT.shake = .25; for (let i = 0; i < 60; i++) { const t = i / 60; const q = pp.clone().lerp(V(0, 0, 0), t); FT.fx.emit(q.add(V(0, .2, 0)), V((Math.random() - .5) * 2, 2 + Math.random() * 3, (Math.random() - .5) * 2), .7, .4, 0xffa050, 5); } setTimeout(() => FT.hit(6, '대지 가르기', '#ffb060'), 250); break;
      case 'fireball': { p.skCd = FT.skMax; A.play('fire'); const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.glow('rgba(190,90,255,.9)'), blending: THREE.AdditiveBlending, depthWrite: false })); m.scale.setScalar(1.4); m.position.copy(pp).add(V(0, 1.4, 0)); FT.scene.add(m); FT.projs.push({ m, from: m.position.clone(), to: chest, t: 0, dur: .45, onHit: () => { FT.hit(5, '흑염구', '#d08cff'); FT.dr.burn = 3; A.play('boom'); } }); break; }
      case 'frost': p.skCd = FT.skMax; A.play('zap'); FT.dr.frozen = 3; if (FT.dr.attack) { FT.clearTele(); FT.dr.attack = null; FT.dr.cd = 3.2; } for (let i = 0; i < 80; i++) FT.fx2.emit(chest.clone().add(V((Math.random() - .5) * 4, (Math.random() - .5) * 4, (Math.random() - .5) * 4)), V(0, .5, 0), 1.2, .3, 0xbfe8ff, 0); FT.hit(3, '서리 감옥', '#9fe0ff'); break;
      case 'storm': p.skCd = FT.skMax; for (let i = 0; i < 5; i++) setTimeout(() => { if (!FT.active) return; A.play('zap'); FT.bolt(); FT.hit(1.6, '뇌격', '#ffe45c'); }, i * 200); break;
      case 'skeleton': p.skCd = FT.skMax; A.play('curse'); for (let i = 0; i < 3; i++) FT.spawnSkeleton(pp, i); break;
      case 'meteor': p.skCd = FT.skMax; for (let i = 0; i < 6; i++) setTimeout(() => { if (!FT.active) return; const tgt = V((Math.random() - .5) * 3, 2, (Math.random() - .5) * 3); const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.glow('rgba(200,220,255,.95)'), blending: THREE.AdditiveBlending, depthWrite: false })); m.scale.setScalar(1.6); FT.scene.add(m); FT.projs.push({ m, from: tgt.clone().add(V(6, 22, 4)), to: tgt, t: 0, dur: .5, onHit: () => { FT.hit(1.5, '유성', '#ffffff'); A.play('boom'); FT.shake = .15; for (let k = 0; k < 20; k++) FT.fx2.emit(tgt, V((Math.random() - .5) * 8, Math.random() * 6, (Math.random() - .5) * 8), .6, .3, 0xffffff, 8); } }); }, i * 220); break;
    }
  };
  FT.bolt = function () { const g = new THREE.Group(); let x = (Math.random() - .5) * 3, z = (Math.random() - .5) * 3, y = 18; const mat = new THREE.MeshBasicMaterial({ color: 0xfff6a0 }); while (y > 2) { const ny = y - 2 - Math.random() * 2, nx = x + (Math.random() - .5) * 1.5, nz = z + (Math.random() - .5) * 1.5; const len = Math.hypot(nx - x, ny - y, nz - z); const c = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, len, 4), mat); c.position.set((x + nx) / 2, (y + ny) / 2, (z + nz) / 2); c.lookAt(nx, ny, nz); c.rotateX(Math.PI / 2); g.add(c); x = nx; y = ny; z = nz; } FT.scene.add(g); FT.redL.color.set(0xfff0a0); FT.redL.intensity = 12; setTimeout(() => { FT.scene.remove(g); FT.redL.color.set(0xff4a10); }, 140); };
  FT.spawnSkeleton = function (pp, i) {
    const g = new THREE.Group(), bm = M.mat.bone;
    const skull = M.mesh(new THREE.SphereGeometry(.2, 10, 8), bm); skull.position.y = 1.55; g.add(skull);
    const em = new THREE.MeshBasicMaterial({ color: 0x7dff9a });[-.07, .07].forEach(x => { const e = M.mesh(new THREE.SphereGeometry(.035, 6, 4), em, false); e.position.set(x, 1.57, .17); g.add(e); });
    const spine = M.cyl(.04, .04, .7, bm, 6); spine.position.y = 1.05; g.add(spine);
    for (let k = 0; k < 4; k++) { const r = M.mesh(new THREE.TorusGeometry(.18 - k * .02, .025, 5, 12, Math.PI * 1.4), bm); r.position.y = 1.3 - k * .12; r.rotation.set(Math.PI / 2, 0, Math.PI * .8); g.add(r); }
    const legs = []; [-.1, .1].forEach(x => { const l = M.cyl(.035, .03, .75, bm, 6); l.position.set(x, .38, 0); g.add(l); legs.push(l); });
    const blade = M.box(.05, .7, .02, new THREE.MeshStandardMaterial({ color: 0x8a9a8a, metalness: .8, roughness: .4, emissive: 0x104010 })); blade.position.set(.3, 1.2, .1); g.add(blade);
    const a = FT.pl.th + (i - 1) * .35, rr = Math.max(3.6, FT.pl.r - 3); g.position.set(Math.sin(a) * rr, 0, Math.cos(a) * rr); g.scale.setScalar(.01);
    M.lin(g); FT.scene.add(g); FT.minions.push({ g, life: 10, tick: .8, legs, blade, grow: 0 });
    for (let k = 0; k < 12; k++) FT.fx.emit(g.position.clone().add(V(0, .3, 0)), V((Math.random() - .5) * 2, 2, (Math.random() - .5) * 2), .6, .2, 0x7dff9a, 3);
  };
  FT.tip = function (t) { const el = $('#ftip'); el.textContent = t; el.style.color = '#ffb08a'; clearTimeout(FT.tipT); FT.tipT = setTimeout(() => { el.textContent = 'A·D 회전 · W·S 거리 · 클릭/J 공격 · Q/K 스킬 · Space 회피'; el.style.color = ''; }, 1400); };
  FT.num = function (d, label, col) {
    const p = V(0, 3.4 + Math.random(), 0).add(FT.ppos().multiplyScalar(.2)).project(FT.cam);
    const el = document.createElement('div'); el.textContent = (label ? label + ' ' : '') + d; el.style.left = ((p.x + 1) / 2 * innerWidth + (Math.random() - .5) * 80) + 'px'; el.style.top = ((1 - p.y) / 2 * innerHeight) + 'px'; if (col) el.style.color = col; if (label) el.style.fontSize = '26px';
    $('#dmgNums').appendChild(el); setTimeout(() => el.remove(), 800);
  };
  FT.hurt = function () {
    const p = FT.pl; if (p.inv > 0 || FT.ended) return; p.hearts--; p.inv = 1.1; A.play('hurt'); FT.shake = .35;
    const h = $('#hurt'); h.style.transition = 'none'; h.style.opacity = 1; requestAnimationFrame(() => { h.style.transition = 'opacity .7s'; h.style.opacity = 0; });
    if (p.hearts <= 0) FT.end(false, 'dead');
  };

  // ---- telegraphs ----
  FT.addTele = function (geo, pos, rotY, dur, onFire) {
    const outer = new THREE.Mesh(geo, FT.teleMat()), inner = new THREE.Mesh(geo, FT.teleMat()); inner.material.opacity = .45; inner.scale.setScalar(.01);
    const g = new THREE.Group(); g.add(outer, inner); g.position.copy(pos); g.position.y = .06; g.rotation.y = rotY || 0; outer.rotation.x = inner.rotation.x = -Math.PI / 2;
    FT.scene.add(g); const t = { m: g, inner, t: 0, dur, onFire }; FT.teles.push(t); return t;
  };
  FT.clearTele = function () { FT.teles.forEach(t => FT.scene.remove(t.m)); FT.teles = []; };
  function inCircle(c, r) { const p = FT.ppos(); return Math.hypot(p.x - c.x, p.z - c.z) < r; }
  FT.chooseAttack = function () {
    const dr = FT.dr, p2 = FT.curHP() < FT.maxHp * .5, pp = FT.ppos(), r = FT.pl.r, sp = p2 ? .78 : 1;
    const opts = [];
    if (r < 8) opts.push('sweep', 'stomp'); else opts.push('breath', 'meteors');
    opts.push('breath', 'stomp'); if (p2) opts.push('dive', 'meteors');
    const k = opts[Math.floor(Math.random() * opts.length)];
    dr.attack = k; dr.t = 0;
    if (k === 'breath') { const aim = FT.pl.th; dr.aim = aim; dr.mouth = 0; FT.addTele(new THREE.CircleGeometry(17, 32, -.42 + Math.PI / 2, .84), V(0, 0, 0), aim + Math.PI, 1.15 * sp, () => { dr.breathT = .9; A.play('roar', .9); let d = Math.atan2(Math.sin(FT.pl.th - aim), Math.cos(FT.pl.th - aim)); if (Math.abs(d) < .42) FT.hurt(); }); dr.cd = 2.3 * sp; }
    if (k === 'sweep') { FT.addTele(new THREE.CircleGeometry(7.6, 48), V(0, 0, 0), 0, 1.0 * sp, () => { dr.tailSpin = 1; A.play('whoosh'); FT.shake = .2; if (FT.pl.r < 7.6) FT.hurt(); }); dr.cd = 2.0 * sp; }
    if (k === 'stomp') { const c = pp.clone(); FT.addTele(new THREE.CircleGeometry(3, 32), c, 0, 1.0 * sp, () => { A.play('boom'); FT.shake = .3; for (let i = 0; i < 30; i++) FT.fx.emit(c.clone().add(V(0, .2, 0)), V((Math.random() - .5) * 6, Math.random() * 4, (Math.random() - .5) * 6), .6, .35, 0xff8040, 6); if (inCircle(c, 3)) FT.hurt(); }); dr.cd = 1.8 * sp; }
    if (k === 'meteors') { for (let i = 0; i < 4; i++) { const c = pp.clone().add(V((Math.random() - .5) * 8, 0, (Math.random() - .5) * 8)); if (c.length() > ARENA) c.setLength(ARENA - 1); FT.addTele(new THREE.CircleGeometry(2.3, 28), c, 0, (1.3 + i * .25) * sp, () => { A.play('boom'); for (let j = 0; j < 30; j++) FT.fx.emit(c.clone().add(V(0, .3, 0)), V((Math.random() - .5) * 7, Math.random() * 6, (Math.random() - .5) * 7), .7, .45, 0xff6020, 7); if (inCircle(c, 2.3)) FT.hurt(); }); } dr.cd = 2.6 * sp; }
    if (k === 'dive') { const c = pp.clone(); dr.diveTo = c; dr.flyT = 1; FT.addTele(new THREE.CircleGeometry(5, 40), c, 0, 1.5 * sp, () => { A.play('boom'); FT.shake = .5; dr.flyT = 0; for (let j = 0; j < 60; j++) FT.fx.emit(c.clone().add(V(0, .3, 0)), V((Math.random() - .5) * 10, Math.random() * 7, (Math.random() - .5) * 10), .9, .5, 0xff5010, 7); if (inCircle(c, 5)) FT.hurt(); }); dr.cd = 3 * sp; }
  };

  // ---- update ----
  FT.update = function (dt) {
    if (!FT.active) return; FT.t += dt;
    const p = FT.pl, dr = FT.dr, D = FT.D, keys = FT.keys;
    // timer
    const tl = FT.o.timeLeft ? FT.o.timeLeft() : null;
    if (tl != null && tl <= 0 && !FT.ended) FT.end(false, 'time');
    // movement
    if (!FT.ended) {
      let mx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + (FT.joy ? FT.joy.x : 0), mz = (keys.s ? 1 : 0) - (keys.w ? 1 : 0) + (FT.joy ? FT.joy.y : 0);
      mx = U.clamp(mx, -1, 1); mz = U.clamp(mz, -1, 1); let sp = 5.5;
      if (p.dash > 0) { p.dash -= dt; mx = p.dashDir.x; mz = p.dashDir.z; sp = 17; }
      p.th += mx * sp * dt / Math.max(3, p.r); p.r = U.clamp(p.r + mz * sp * dt, 3.2, ARENA - .5);
    }
    p.inv = Math.max(0, p.inv - dt); p.dashCd = Math.max(0, p.dashCd - dt); p.atkCd = Math.max(0, p.atkCd - dt); p.skCd = Math.max(0, p.skCd - dt);
    if (FT.holdAtk) FT.attack();
    if (FT.mouseHold) FT.attack();
    // camera
    const pp = FT.ppos();
    const cpos = pp.clone().add(V(0, 1.65, 0));
    if (FT.shake > 0) { cpos.x += (Math.random() - .5) * FT.shake; cpos.y += (Math.random() - .5) * FT.shake; FT.shake *= Math.pow(.03, dt); }
    FT.cam.position.copy(cpos); D.userData.head.getWorldPosition(FT._hp || (FT._hp = new THREE.Vector3())); FT._look = (FT._look || FT._hp.clone()).lerp(V(FT._hp.x * .6, THREE.MathUtils.lerp(2.6, FT._hp.y, .6), FT._hp.z * .6), 1 - Math.pow(.02, dt)); FT.cam.lookAt(FT._look); M.updateFire(FT.t); M.billboard(FT.scene, FT.cam);
    // sword swing
    if (p.swing > 0) { p.swing += dt; const s = Math.min(1, p.swing / .28), a = Math.sin(s * Math.PI); FT.hand.rotation.set(-a * 1.1, a * .4, a * .9); FT.hand.position.set(.38 - a * .35, -.42 + a * .1, -.75 - a * .2); if (p.swing > .3) p.swing = 0; }
    else { FT.hand.rotation.set(Math.sin(FT.t * 2) * .02, 0, 0); FT.hand.position.set(.38, -.42 + Math.sin(FT.t * 3) * .01, -.75); }
    if (FT.sw3 && FT.sw3.userData.orb) FT.sw3.userData.orb.rotation.y = FT.t * 2;
    // dragon AI
    if (dr.dying > 0) {
      dr.dying += dt; D.rotation.z = Math.min(1.3, dr.dying * .7); D.position.y = Math.max(-1.5, -dr.dying * .5); M.animDragon(D, dt * .3, { mouth: .8, breathe: 0, sway: 0 });
      M.mat.dragonSkin.emissiveIntensity = Math.max(0, .55 - dr.dying * .2); if (Math.random() < .6) FT.ash.emit(V((Math.random() - .5) * 6, 1 + Math.random() * 4, (Math.random() - .5) * 6), V(0, 2 + Math.random() * 2, 0), 2, .3, 0xff7a30, -.5);
    } else {
      const face = Math.atan2(pp.x, pp.z); let dy = face - D.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      if (dr.frozen > 0) { dr.frozen -= dt; M.mat.dragonSkin.color.set(0x9fd8ff); }
      else {
        M.mat.dragonSkin.color.setScalar(1 + dr.hitFlash * 2);
        D.rotation.y += dy * Math.min(1, dt * (dr.attack === 'breath' ? .6 : 2.5));
        if (dr.state === 'intro') { dr.t += dt; if (dr.t > 1.6) dr.state = 'fight'; }
        else if (!FT.ended) {
          if (!dr.attack) { dr.cd -= dt; if (dr.cd <= 0) FT.chooseAttack(); }
          for (let i = FT.teles.length - 1; i >= 0; i--) { const t = FT.teles[i]; t.t += dt; const k = Math.min(1, t.t / t.dur); t.inner.scale.setScalar(Math.max(.01, k)); t.m.children[0].material.opacity = .18 + Math.sin(FT.t * 20) * .06; if (k >= 1) { t.onFire && t.onFire(); FT.scene.remove(t.m); FT.teles.splice(i, 1); } }
          if (dr.attack && !FT.teles.length) dr.attack = null;
        }
      }
      dr.hitFlash = Math.max(0, dr.hitFlash - dt * 8);
      // burn dot
      if (dr.burn > 0) { dr.burn -= dt; dr.burnTick -= dt; if (dr.burnTick <= 0) { dr.burnTick = .5; FT.hit(.4, '', '#d08cff'); } if (Math.random() < .5) FT.fx.emit(V((Math.random() - .5) * 3, 2 + Math.random() * 2, (Math.random() - .5) * 3), V(0, 2, 0), .6, .4, 0xb45cff, -1); }
      // flying
      const flying = dr.flyT > 0; const ty = flying ? 6 : 0; D.position.y += (ty - D.position.y) * Math.min(1, dt * (flying ? 2 : 8));
      if (flying && dr.diveTo) { D.position.x += (dr.diveTo.x * .5 - D.position.x) * dt; D.position.z += (dr.diveTo.z * .5 - D.position.z) * dt; } else { D.position.x *= Math.pow(.2, dt); D.position.z *= Math.pow(.2, dt); }
      // breath particles
      const tele = FT.teles.find(t => t.onFire) && dr.attack === 'breath';
      FT.breathFires.children.forEach((f, i) => { f.visible = dr.breathT > 0; if (f.visible) { const k = (i + 1) / 9; f.position.set(Math.sin(dr.aim) * k * 15, 0, Math.cos(dr.aim) * k * 15); f.material.uniforms.uInt.value = 2.4 * Math.min(1, dr.breathT * 2); } });
      if (dr.breathT > 0) { dr.breathT -= dt; const hp = new THREE.Vector3(); D.userData.head.getWorldPosition(hp); for (let i = 0; i < 10; i++) { const a = dr.aim + (Math.random() - .5) * .8, s = 14 + Math.random() * 8; FT.fx.emit(hp, V(Math.sin(a) * s, -2 - Math.random() * 2, Math.cos(a) * s), .9, .9, Math.random() < .5 ? 0xff7020 : 0xffc040, 1, .985); } }
      if (dr.tailSpin > 0) { dr.tailSpin -= dt * 1.5; D.rotation.y += dt * 9; }
      M.animDragon(D, dt * (dr.frozen > 0 ? .1 : 1), { mouth: (tele ? .7 : 0) + (dr.breathT > 0 ? 1 : 0), flap: flying ? 1 : 0, fold: flying ? 1 : .35 + (tele ? .3 : 0), neckPitch: (tele ? -.6 : 0) + (dr.breathT > 0 ? .9 : .25), headPitch: dr.breathT > 0 ? .35 : .1, tailWhip: dr.tailSpin > 0 ? .4 : 0 });
    }
    // projectiles
    for (let i = FT.projs.length - 1; i >= 0; i--) { const q = FT.projs[i]; q.t += dt; const k = Math.min(1, q.t / q.dur); q.m.position.lerpVectors(q.from, q.to, k); FT.fx.emit(q.m.position, V(0, 0, 0), .3, .5, 0xffd0a0, 0); if (k >= 1) { q.onHit(); FT.scene.remove(q.m); FT.projs.splice(i, 1); } }
    // minions
    for (let i = FT.minions.length - 1; i >= 0; i--) {
      const m = FT.minions[i]; m.life -= dt; m.grow = Math.min(1, m.grow + dt * 2); m.g.scale.setScalar(m.grow * 1.1);
      const to = V(0, 0, 0).sub(m.g.position); const dist = to.length(); m.g.lookAt(0, 0, 0);
      if (dist > 3.4) { m.g.position.addScaledVector(to.normalize(), dt * 3.5); m.legs[0].rotation.x = Math.sin(FT.t * 10) * .5; m.legs[1].rotation.x = -Math.sin(FT.t * 10) * .5; }
      else { m.tick -= dt; m.blade.rotation.x = Math.sin(FT.t * 12) * .8; if (m.tick <= 0) { m.tick = .8; FT.hit(.5, '', '#7dff9a'); } }
      if (m.life <= 0 || FT.ended) { for (let k = 0; k < 10; k++) FT.fx.emit(m.g.position.clone().add(V(0, 1, 0)), V((Math.random() - .5) * 2, 1, (Math.random() - .5) * 2), .5, .2, 0x7dff9a, 2); FT.scene.remove(m.g); FT.minions.splice(i, 1); }
    }
    // ambience
    if (Math.random() < .5) FT.ash.emit(V((Math.random() - .5) * 40, 0, (Math.random() - .5) * 40), V((Math.random() - .5), 1 + Math.random() * 2, (Math.random() - .5)), 4, .08, 0xff6a20, -.1, .995);
    FT.lava.material.emissiveIntensity = 1.4 + Math.sin(FT.t * 1.3) * .3; FT.lava.material.emissiveMap.offset.y = FT.lava.material.map.offset.y = FT.t * .004;
    FT.redL.intensity = Math.max(3, FT.redL.intensity * .9) + Math.sin(FT.t * 4) * .3;
    FT.fx.update(dt); FT.fx2.update(dt); FT.ash.update(dt); FT.smoke.update(dt);
    FT.ui();
  };
  FT.ui = function () {
    const hp = Math.max(0, FT.curHP());
    $('#bossHp').style.width = (hp / FT.maxHp * 100) + '%';
    const tl = FT.o.timeLeft ? FT.o.timeLeft() : null;
    $('#bossSub').textContent = U.fmt(hp) + ' / ' + U.fmt(FT.maxHp) + (FT.curHP() < FT.maxHp * .5 ? ' · 분노 상태' : '') + ' · 내 피해 ' + U.fmt(FT.dmgDone) + (tl != null ? ' · 남은 시간 ' + Math.max(0, Math.ceil(tl)) + '초' : '');
    $('#fHearts').innerHTML = ET.G.heartsHTML(FT.pl.hearts, 5);
    const cd = (id, v, m) => { $(id + ' .cd').style.transform = 'scaleY(' + (m ? v / m : 0) + ')'; };
    cd('#fSkill', FT.pl.skCd, FT.skMax); cd('#fDodge', FT.pl.dashCd, 1); cd('#fAtk', FT.pl.atkCd, .42);
  };
})(window.ET);
