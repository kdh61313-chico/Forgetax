/* EMBER TITHE — 3D forge scene (dark realism) */
'use strict';
(function (ET) {
  const M = ET.M, U = ET.U, X = ET.X;
  const F = ET.Forge = {};
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  F.STATIONS = {
    anvil: { pos: V(.1, 1.78, .92), look: V(.02, .9, -.18) },
    furnace: { pos: V(-1.15, 1.72, 1.05), look: V(-2.9, 1.0, -.45) },
    rack: { pos: V(4.35, 1.85, .3), look: V(6.4, 1.6, .3) },
    tribute: { pos: V(1.15, 1.95, -.35), look: V(2.75, 1.05, -3.1) },
    shop: { pos: V(-2.0, 1.7, 1.45), look: V(-4.3, 1.25, 3.2) },
    dragon: { pos: V(0, 2.0, -1.4), look: V(0, 2.3, -7) },
    title: { pos: V(3.3, 2.3, 3.0), look: V(-.6, 1.4, -3.0) }
  };
  const ANV_HIT = V(.08, 0, 0);
  F.SPOTS = {
    anvil: { c: V(0, 0, 0), r: 1.9, stand: V(.02, 0, 1.05), look: V(0, .95, -.05) },
    furnace: { c: V(-2.95, 0, -.45), r: 2.3, stand: V(-1.55, 0, -.3), look: V(-2.9, 1.0, -.45) },
    rack: { c: V(6.35, 0, .3), r: 2.4, stand: V(4.55, 0, .3), look: V(6.35, 1.6, .3) },
    tribute: { c: V(2.75, 0, -2.6), r: 2.2, stand: V(2.75, 0, -1.3), look: V(2.75, 1.0, -2.6) },
    shop: { c: V(-4.1, 0, 3.0), r: 2.5, stand: V(-2.75, 0, 2.05), look: V(-4.2, 1.2, 3.3) },
    relics: { c: V(-1.2, 0, 4.15), r: 2.3, stand: V(-1.2, 0, 1.95), look: V(-1.2, 1.25, 4.2) },
    quests: { c: V(1.55, 0, 4.2), r: 2.1, stand: V(1.55, 0, 2.55), look: V(1.55, 1.5, 4.4) }
  };
  F.P = { x: .02, z: 1.05, yaw: 0, pitch: -.35, bob: 0, stepAcc: 0, vx: 0, vz: 0 };
  F.input = { f: 0, b: 0, l: 0, r: 0, run: 0, jx: 0, jy: 0 };
  F.mode = 'title';
  const COL = { circles: [[0, 0, .55], [-2.25, 1.35, .45], [-4.4, 3.4, .6], [-3.9, 2.8, .75], [5.2, 2.6, .5], [-3.9, 1.0, .6], [-2.8, .8, .5], [3.95, -2.6, .3]], boxes: [[-3.5, -2.4, -1.25, .35], [1.67, 3.83, -3.06, -2.14], [2.0, 4.4, 3.1, 3.9], [-2.4, 0, 3.85, 4.5], [.7, 2.4, 4.3, 4.6], [-4.6, 4.6, -3.6, -3.2]], bounds: [-6.15, 5.95, -3.05, 4.15] };

  F.init = function (renderer, hi) {
    const scene = F.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030202);
    scene.fog = new THREE.FogExp2(0x070403, .045);
    const cam = F.cam = new THREE.PerspectiveCamera(50, 1, .03, 80); cam.rotation.order = 'YXZ'; scene.add(cam);
    F.camPos = F.STATIONS.title.pos.clone(); F.camLook = F.STATIONS.title.look.clone(); F.camPosT = F.camPos.clone(); F.camLookT = F.camLook.clone(); F.shake = 0; F.sheet = 0;
    F.clickables = []; F.hi = hi;
    const click = (obj, action) => obj.traverse(o => { if (o.isMesh) { o.userData.action = action; F.clickables.push(o); } });
    // ---- lights ----
    scene.add(new THREE.HemisphereLight(0x3a2a22, 0x050304, .5));
    const fire = F.fireLight = new THREE.PointLight(0xff6a24, 7, 11, 2); fire.position.set(-2.35, 1.7, -.4);
    if (hi) { fire.castShadow = true; fire.shadow.mapSize.set(1024, 1024); fire.shadow.bias = -.004; fire.shadow.radius = 3; }
    scene.add(fire);
    const moon = F.moon = new THREE.SpotLight(0x7f9cff, 7, 22, .32, .5, 1.2); moon.position.set(-9.5, 7, -.8); moon.target.position.set(-1.2, 0, .6); moon.castShadow = true; moon.shadow.mapSize.set(hi ? 1024 : 512, hi ? 1024 : 512); moon.shadow.bias = -.0015; scene.add(moon, moon.target);
    const lair = F.lairLight = new THREE.PointLight(0xff3a0c, 4, 14, 2); lair.position.set(0, .8, -7.5); scene.add(lair);
    const hoardL = new THREE.PointLight(0xffaa40, 2.5, 6, 2); hoardL.position.set(1.5, 2.2, -6); scene.add(hoardL);
    F.anvilLight = new THREE.PointLight(0xff8a40, 0, 2.5, 2); F.anvilLight.position.set(0, 1.25, .05); scene.add(F.anvilLight);
    const key = new THREE.SpotLight(0xffc89a, 2.4, 9, .5, .8, 1.5); key.position.set(1.2, 4.6, 1.6); key.target.position.set(0, .9, 0); if (hi) { key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.001; } scene.add(key, key.target);
    // ---- room shell ----
    const floorSet = X.rep(M.set.flag, 13 / 3, 8 / 3);
    const floor = M.mesh(new THREE.PlaneGeometry(13, 8), X.mat(floorSet), false); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, .55); scene.add(floor);
    const wallSet = X.rep(M.set.ashlar, 7.9 / 2.6, 5.5 / 2.6);
    const wallMat = X.mat(wallSet, { vertexColors: true });
    const sootWall = (geo, h) => { const pa = geo.attributes.position, cols = []; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) + h / 2; const k = Math.max(.18, 1 - Math.pow(y / h, 1.3) * .85); cols.push(k, k * .95, k * .9); } geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); return geo; };
    // left wall with window
    const lw = new THREE.Shape(); lw.moveTo(-3.4, 0); lw.lineTo(4.5, 0); lw.lineTo(4.5, 5.5); lw.lineTo(-3.4, 5.5); lw.lineTo(-3.4, 0);
    const hole = new THREE.Path(); hole.moveTo(-1.3, 2.9); hole.lineTo(-.1, 2.9); hole.lineTo(-.1, 4.1); hole.absarc(-.7, 4.1, .6, 0, Math.PI, false); hole.lineTo(-1.3, 2.9); lw.holes.push(hole);
    const lwg = new THREE.ShapeGeometry(lw, 24); const lp = lwg.attributes.position, luv = []; for (let i = 0; i < lp.count; i++) luv.push(lp.getX(i) / 7.9 * 1, lp.getY(i) / 5.5 * 1);
    lwg.setAttribute('uv', new THREE.Float32BufferAttribute(luv, 2)); lwg.translate(0, -2.75, 0); sootWall(lwg, 5.5); lwg.translate(0, 2.75, 0);
    const leftWall = M.mesh(lwg, wallMat, false); leftWall.rotation.y = Math.PI / 2; leftWall.position.set(-6.5, 0, 0); leftWall.scale.z = -1; scene.add(leftWall);
    // window reveal + bars + sky
    const rev = M.mesh(new THREE.BoxGeometry(.6, .06, 1.3), M.mat.stone); rev.position.set(-6.55, 2.87, -.7); scene.add(rev);
    for (let i = 0; i < 4; i++) { const b = M.box(.04, 1.8, .04, M.mat.ironDark); b.position.set(-6.45, 3.75, -1.15 + i * .3); scene.add(b); }
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 0x0c1630, toneMapped: false })); sky.position.set(-7.4, 3.6, -.7); sky.rotation.y = Math.PI / 2; scene.add(sky);
    const moonS = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.glow('rgba(170,190,255,.7)'), toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending })); moonS.scale.setScalar(1.6); moonS.position.set(-7.3, 4.1, -.4); scene.add(moonS);
    const shaft = M.makeShaft(.5, 1.6, 5.6, 0x8fa8ff, .09); shaft.position.set(-6.3, 3.6, -.7); shaft.lookAt(-1.2, 0, .6); shaft.rotateX(Math.PI / 2); scene.add(shaft); F.shaft = shaft;
    // other walls
    const rwg = sootWall(new THREE.PlaneGeometry(7.9, 5.5, 1, 8), 5.5); const rightWall = M.mesh(rwg, wallMat, false); rightWall.rotation.y = -Math.PI / 2; rightWall.position.set(6.5, 2.75, .55); scene.add(rightWall);
    const fwg = sootWall(M.tile(new THREE.PlaneGeometry(13, 5.5, 1, 8), 13 / 7.9, 1), 5.5); const frontWall = M.mesh(fwg, wallMat, false); frontWall.rotation.y = Math.PI; frontWall.position.set(0, 2.75, 4.5); scene.add(frontWall);
    // back wall stubs around the cage
    [[-5.35, 2.3], [5.35, 2.3]].forEach(([x, w]) => { const g = sootWall(M.tile(new THREE.PlaneGeometry(w, 5.5, 1, 8), w / 7.9, 1), 5.5); const m = M.mesh(g, wallMat, false); m.position.set(x, 2.75, -3.45); scene.add(m); });
    const lintel = M.box(8.6, .7, .6, M.mat.stone, .4); lintel.position.set(0, 5.2, -3.45); scene.add(lintel);
    const ceil = M.mesh(new THREE.PlaneGeometry(13, 8), new THREE.MeshStandardMaterial({ color: 0x0a0706, roughness: 1, map: M.set.wood.map }), false); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 5.5, .55); scene.add(ceil);
    for (let i = -2; i <= 2; i++) { const b = M.box(.3, .36, 8, M.mat.woodDark); b.position.set(i * 2.6, 5.3, .55); scene.add(b); }
    for (let i = 0; i < 3; i++) { const b = M.box(13, .3, .3, M.mat.woodDark); b.position.set(0, 5.05, 3.6 - i * 2.9); scene.add(b); }
    // columns at cage corners
    [-4.25, 4.25].forEach(x => { const c = M.box(.6, 5.5, .6, M.mat.stone, .45); c.position.set(x, 2.75, -3.45); scene.add(c); });
    // ---- lair ----
    const caveSet = M.set.cave;
    const domeG = new THREE.SphereGeometry(8, 48, 24, Math.PI, Math.PI, 0, Math.PI / 2);
    const dp = domeG.attributes.position; for (let i = 0; i < dp.count; i++) { const x = dp.getX(i), y = dp.getY(i), z = dp.getZ(i); const n = X.fbm((x + 20) * .15, (z + 20) * .15, 64, 4) - .5; const k = 1 + n * .35; dp.setXYZ(i, x * k, y * k, z * k); }
    domeG.computeVertexNormals();
    const dome = M.mesh(domeG, X.mat(X.rep(caveSet, 9, 4), { side: THREE.BackSide, emissive: 0xff4010, emissiveIntensity: .2, normalScale: new THREE.Vector2(2, 2), color: 0x8a7a70 }), false); dome.scale.set(.62, .7, 1.1); dome.position.set(0, -.2, -3.45); scene.add(dome);
    const lairFloor = M.mesh(new THREE.PlaneGeometry(10, 10, 40, 40), X.mat(X.rep(caveSet, 3, 3), { emissive: 0xff5010, emissiveIntensity: 1.3 }), false);
    const lfp = lairFloor.geometry.attributes.position; for (let i = 0; i < lfp.count; i++) lfp.setZ(i, (X.fbm(lfp.getX(i) * .3 + 9, lfp.getY(i) * .3 + 9, 64, 4) - .5) * .4); lairFloor.geometry.computeVertexNormals();
    lairFloor.rotation.x = -Math.PI / 2; lairFloor.position.set(0, -.05, -8.4); scene.add(lairFloor); F.lairFloor = lairFloor;
    // gold hoard mound
    const hg = new THREE.SphereGeometry(2.6, 48, 18, 0, Math.PI * 2, 0, Math.PI / 2); const hp = hg.attributes.position; for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), z = hp.getZ(i); hp.setY(i, hp.getY(i) * .32 + (X.fbm(x * .7 + 3, z * .7 + 3, 64, 4) - .5) * .25); } hg.computeVertexNormals();
    const hoard = M.mesh(hg, X.mat(X.rep(M.set.gold, 8, 5), { metalness: 1, color: 0xb09060 }), true); hoard.position.set(.6, -.05, -8.2); hoard.scale.set(1.5, 1, 1.15); scene.add(hoard);
    const coinG = new THREE.CylinderGeometry(.05, .05, .01, 14), coinM = new THREE.MeshStandardMaterial({ color: 0xffc860, metalness: 1, roughness: .28 }), coins = new THREE.InstancedMesh(coinG, coinM, 420); const dd = new THREE.Object3D();
    for (let i = 0; i < 420; i++) { const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 3.2; dd.position.set(.6 + Math.cos(a) * r * 1.3, .02 + Math.random() * .04, -8.2 + Math.sin(a) * r * .8); if (dd.position.z > -3.6) dd.position.z = -3.7 - Math.random(); dd.rotation.set(Math.random() * .4, Math.random() * 6, Math.random() * .4); dd.updateMatrix(); coins.setMatrixAt(i, dd.matrix); }
    scene.add(coins);
    for (let i = 0; i < 6; i++) { const cup = M.lathe([[0, 0], [.07, 0], [.03, .02], [.02, .1], [.06, .14], [.08, .22], [.075, .23], [0, .12]], coinM, 20); cup.position.set(-1.5 + Math.random() * 4, .05, -5.4 - Math.random() * 3); cup.rotation.z = Math.random() < .5 ? Math.PI / 2.2 : 0; scene.add(cup); }
    // ---- cage bars (thick forged iron) ----
    const barMat = M.mat.iron;
    for (let i = -13; i <= 13; i++) { const b = M.mesh(new THREE.BoxGeometry(.07, 5.5, .07), barMat); b.position.set(i * .3, 2.75, -3.45); b.rotation.y = .785; scene.add(b); }
    [.25, 2.6, 4.75].forEach(y => { const h = M.box(8, .1, .12, barMat); h.position.set(0, y, -3.45); scene.add(h); for (let i = -13; i <= 13; i++) { const r = M.mesh(new THREE.SphereGeometry(.03, 6, 4), M.mat.ironDark); r.position.set(i * .3, y, -3.38); scene.add(r); } });
    const chainM = M.mat.ironDark;
    for (let k = 0; k < 2; k++) for (let i = 0; i < 18; i++) { const r = M.mesh(new THREE.TorusGeometry(.045, .012, 6, 14), chainM, false); r.position.set(-3.2 + k * 6.6, 4.5 - i * .075 - Math.abs(Math.sin(i * .2)) * .3, -3.32); r.rotation.y = i % 2 ? Math.PI / 2 : 0; scene.add(r); }
    const barHit = new THREE.Mesh(new THREE.PlaneGeometry(8, 5.5), new THREE.MeshBasicMaterial({ visible: false })); barHit.position.set(0, 2.75, -3.4); barHit.userData.action = 'dragon'; scene.add(barHit); F.clickables.push(barHit);
    // ---- dragon ----
    const D = F.dragon = M.makeDragon(); M.dragonLie(D, true); D.position.set(.2, -.62 * .74, -8.55); D.scale.setScalar(.74); D.rotation.y = .1; scene.add(D);
    F.ds = { fwd: 0, tfwd: 0, mouth: 0, tmouth: 0, roarT: 0 };
    // ---- anvil, hammer ----
    const anvil = F.anvil = M.makeAnvil(); scene.add(anvil); F.anvilTop = anvil.userData.topY; click(anvil, 'strike');
    // first-person view model: gloved hand holding the hammer
    const vm = F.vm = new THREE.Group(); cam.add(vm); vm.position.set(.13, -.25, -.56); vm.rotation.set(0, -.2, -.38);
    const vmArm = F.vmArm = new THREE.Group(); vm.add(vmArm);
    const hammer = F.hammer = M.makeHammer(); hammer.rotation.set(0, Math.PI / 2, 0); hammer.position.set(0, .22, -.02); hammer.scale.setScalar(.72); vmArm.add(hammer);
    const glove = M.makeGlove(); glove.position.set(0, -.16, -.03); glove.scale.setScalar(.85); vmArm.add(glove);
    hammer.traverse(o => { o.castShadow = false; }); glove.traverse(o => { o.castShadow = false; });
    const vmL = new THREE.PointLight(0xffb070, .35, 1.2, 2); vmL.position.set(-.2, .2, .2); vm.add(vmL);
    F.hammerAnim = 0;
    // ---- furnace ----
    const fur = F.furnace = M.makeFurnace(); fur.position.set(-2.95, 0, -.45); fur.rotation.y = Math.PI / 2; scene.add(fur); click(fur, 'heat');
    // quench barrel
    const barrel = new THREE.Group(); barrel.position.set(-2.25, 0, 1.35); scene.add(barrel);
    const staves = M.mesh(new THREE.CylinderGeometry(.34, .3, .78, 24, 1, true), new THREE.MeshStandardMaterial({ map: M.set.wood.map, normalMap: M.set.wood.normalMap, roughnessMap: M.set.wood.roughnessMap, color: 0x8a6a50, side: THREE.DoubleSide })); staves.position.y = .39; barrel.add(staves);
    [.12, .66].forEach(y => { const h = M.mesh(new THREE.CylinderGeometry(.345 - y * .03, .345 - y * .03, .04, 24, 1, true), M.mat.ironDark); h.position.y = y; barrel.add(h); });
    const water = M.mesh(new THREE.CircleGeometry(.32, 24), M.mat.water, false); water.rotation.x = -Math.PI / 2; water.position.y = .7; barrel.add(water); barrel.add(M.blob(1, 1, .8));
    // coal pile
    const cp = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.06, 0), new THREE.MeshStandardMaterial({ color: 0x0b0a0a, roughness: .5, normalMap: M.set.coal.normalMap }), 160); const d2 = new THREE.Object3D();
    for (let i = 0; i < 160; i++) { const a = Math.random() * 6.28, r = Math.pow(Math.random(), .7) * .7; d2.position.set(-3.9 + Math.cos(a) * r, (.7 - r) * .35 * Math.random() + .03, 1.0 + Math.sin(a) * r * .8); d2.rotation.set(Math.random() * 3, Math.random() * 3, 0); d2.scale.setScalar(.6 + Math.random()); d2.updateMatrix(); cp.setMatrixAt(i, d2.matrix); } cp.castShadow = true; scene.add(cp);
    // workbench + tools (front right)
    const bench = new THREE.Group(); bench.position.set(3.2, 0, 3.5); scene.add(bench);
    const top = M.box(2.4, .12, .8, M.mat.wood); top.position.y = .9; bench.add(top);
    [[-1.1, -.3], [1.1, -.3], [-1.1, .3], [1.1, .3]].forEach(([x, z]) => { const l = M.box(.12, .9, .12, M.mat.woodDark); l.position.set(x, .45, z); bench.add(l); });
    for (let i = 0; i < 3; i++) { const t = M.makeTongs(); t.position.set(-.6 + i * .5, .97, 0); t.rotation.set(Math.PI / 2, 0, .3 * i); bench.add(t); }
    const vice = M.box(.2, .18, .16, M.mat.iron); vice.position.set(.9, 1.05, -.2); bench.add(vice);
    bench.add(M.blob(2.8, 1.2, .7));
    // grindstone
    const gs = new THREE.Group(); gs.position.set(5.2, 0, 2.6); scene.add(gs);
    const wheel = M.mesh(new THREE.CylinderGeometry(.45, .45, .14, 32), M.mat.stone); wheel.rotation.x = Math.PI / 2; wheel.position.y = .75; gs.add(wheel);
    const frm = M.box(.12, .7, .5, M.mat.woodDark); frm.position.set(0, .35, 0); gs.add(frm);
    // ---- tribute altar + bell ----
    const ctr = F.counter = M.makeCounter(); ctr.position.set(2.75, 0, -2.6); scene.add(ctr); click(ctr, 'tribute');
    const bell = F.bell = M.makeBell(); bell.position.set(3.95, 1.0, -2.6); scene.add(bell); click(bell, 'bell');
    // ---- rack ----
    const rack = F.rack = M.makeRack(10); rack.position.set(6.35, 0, .3); scene.add(rack); click(rack, 'rackview'); click(floor, 'floor');
    // ---- merchant + pedestal ----
    const mer = F.merchant = M.makeMerchant(); mer.position.set(-4.4, 0, 3.4); mer.rotation.y = Math.PI * .78; scene.add(mer); click(mer, 'shop');
    F.altarIcons = new THREE.Group(); F.altarIcons.position.set(0, .93, .78); mer.add(F.altarIcons);
    const cab = F.cabinet = M.makeCabinet(); cab.position.set(-1.2, 0, 4.42); cab.rotation.y = Math.PI; scene.add(cab); click(cab, 'relics');
    F.relicSlots = cab.userData.slots;
    const board = F.board = M.makeBoard(); board.position.set(1.55, 0, 4.44); board.rotation.y = Math.PI; scene.add(board); click(board, 'quests');
    // ---- torches ----
    F.torches = [];
    [[6.4, 2.7, -2.2, -1], [-6.4, 2.7, 2.8, 1], [6.4, 2.7, 3.2, -1]].forEach(([x, y, z, s]) => {
      const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
      const br = M.box(.06, .06, .3, M.mat.ironDark); br.rotation.y = Math.PI / 2; br.position.x = s * .12; g.add(br);
      const cup = M.mesh(new THREE.CylinderGeometry(.07, .04, .14, 10, 1, true), M.mat.ironDark); cup.position.set(s * .26, .06, 0); g.add(cup);
      const st = M.cyl(.025, .03, .4, M.mat.woodDark, 8); st.position.set(s * .26, -.06, 0); g.add(st);
      const f = M.makeFire(.22, .42, 1.6, null, x * .1 + z); f.position.set(s * .26, .1, 0); g.add(f);
      const l = new THREE.PointLight(0xff8a3a, 2.4, 7, 2); l.position.set(s * .3, .35, 0); g.add(l); F.torches.push(l);
    });
    // ---- particles ----
    F.sparks = new M.Particles(scene, 300, 'rgba(255,190,90,.95)');
    F.embers = new M.Particles(scene, 120, 'rgba(255,110,30,.95)');
    F.smoke = new M.Particles(scene, 60, null, false, X.smoke());
    F.gold = new M.Particles(scene, 140, 'rgba(255,215,120,.95)');
    F.dust = new M.Particles(scene, 90, 'rgba(160,180,255,.5)');
    F.flameP = new M.Particles(scene, 160, 'rgba(255,120,30,.9)');
    for (let i = 0; i < 90; i++) F.dust.emit(V(-3 + Math.random() * 4, Math.random() * 4, -1 + Math.random() * 2), V((Math.random() - .5) * .03, (Math.random() - .5) * .02, (Math.random() - .5) * .03), 9999, .015 + Math.random() * .015, 0xc0d0ff, 0, 1);
    F.shards = []; F.anvilSword = null; F.rackMeshes = {}; F.counterMeshes = {}; F.floorMeshes = {}; F.handMesh = null; F.time = 0;
    M.lin(scene);
    return scene;
  };
  F.setStation = function (name, instant) { const s = F.STATIONS[name]; if (!s) return; F.station = name; F.camPosT.copy(s.pos); F.camLookT.copy(s.look); if (instant) { F.camPos.copy(s.pos); F.camLook.copy(s.look); } };
  F.enterPlay = function () { F.mode = 'play'; F.station = 'play'; const P = F.P; P.x = .02; P.z = 1.15; P.yaw = 0; P.pitch = -.42; F.walk = null; F.vm.visible = !(ET.G.S && ET.G.S.hand); };
  F.enterTitle = function () { F.mode = 'title'; F.setStation('title'); F.vm.visible = false; F.walk = null; if (F.handMesh) { F.cam.remove(F.handMesh); F.handMesh = null; } };
  F.look = function (dx, dy) { const P = F.P; P.yaw -= dx; P.pitch = U.clamp(P.pitch - dy, -1.35, 1.2); if (dx || dy) F.walkLook = false; };
  F.dist = st => { const sp = F.SPOTS[st]; return sp ? Math.hypot(F.P.x - sp.c.x, F.P.z - sp.c.z) : 99; };
  F.near = st => F.mode !== 'play' || F.dist(st) < F.SPOTS[st].r;
  F.nearest = function () { if (F.mode !== 'play') return null; let best = null, bd = 99; for (const k in F.SPOTS) { const d = F.dist(k); if (d < F.SPOTS[k].r && d < bd) { bd = d; best = k; } } return best === 'furnace' ? 'anvil' : best; };
  // grid A* so auto-walk routes around the anvil / counter / furnace instead of getting stuck
  const GS = .2;
  function blocked(x, z) {
    const pr = .36, b = COL.bounds; if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) return true;
    for (const [cx, cz, r] of COL.circles) if (Math.hypot(x - cx, z - cz) < r + pr) return true;
    for (const [x0, x1, z0, z1] of COL.boxes) if (Math.hypot(x - U.clamp(x, x0, x1), z - U.clamp(z, z0, z1)) < pr) return true;
    return false;
  }
  function findPath(ax, az, bx, bz) {
    const b = COL.bounds, nx = Math.ceil((b[1] - b[0]) / GS) + 1, nz = Math.ceil((b[3] - b[2]) / GS) + 1;
    const id = (i, j) => j * nx + i, ci = x => U.clamp(Math.round((x - b[0]) / GS), 0, nx - 1), cj = z => U.clamp(Math.round((z - b[2]) / GS), 0, nz - 1);
    const px = i => b[0] + i * GS, pz = j => b[2] + j * GS;
    if (!F._grid) { F._grid = new Uint8Array(nx * nz); for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) F._grid[id(i, j)] = blocked(px(i), pz(j)) ? 1 : 0; }
    const G = F._grid, s0 = id(ci(ax), cj(az)), t0 = id(ci(bx), cj(bz));
    const gS = new Float32Array(nx * nz).fill(1e9), from = new Int32Array(nx * nz).fill(-1), open = [s0]; gS[s0] = 0;
    const hf = k => Math.hypot((k % nx) - (t0 % nx), ((k / nx) | 0) - ((t0 / nx) | 0));
    const closed = new Uint8Array(nx * nz); let it = 0;
    while (open.length && it++ < 6000) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (gS[open[k]] + hf(open[k]) < gS[open[bi]] + hf(open[bi])) bi = k;
      const cur = open.splice(bi, 1)[0]; if (cur === t0) break; closed[cur] = 1;
      const ci0 = cur % nx, cj0 = (cur / nx) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const i2 = ci0 + di, j2 = cj0 + dj; if (i2 < 0 || j2 < 0 || i2 >= nx || j2 >= nz) continue;
        const n = id(i2, j2); if (closed[n] || (G[n] && n !== t0)) continue; if (di && dj && (G[id(ci0 + di, cj0)] || G[id(ci0, cj0 + dj)])) continue;
        const g2 = gS[cur] + (di && dj ? 1.414 : 1); if (g2 < gS[n]) { gS[n] = g2; from[n] = cur; if (!open.includes(n)) open.push(n); }
      }
    }
    if (from[t0] < 0) return null;
    const cells = []; for (let k = t0; k >= 0 && k !== s0; k = from[k]) cells.push(k); cells.reverse();
    // string-pull: keep only points where straight line becomes blocked
    const pts = cells.map(k => V(px(k % nx), 0, pz((k / nx) | 0))), out = []; let a = V(ax, 0, az);
    const clear = (p, q) => { const d = p.distanceTo(q), n = Math.ceil(d / .1); for (let k = 1; k < n; k++) { const t = k / n; if (blocked(p.x + (q.x - p.x) * t, p.z + (q.z - p.z) * t)) return false; } return true; };
    let i = 0; while (i < pts.length) { let j = pts.length - 1; while (j > i && !clear(a, pts[j])) j--; out.push(pts[j]); a = pts[j]; i = j + 1; }
    return out;
  }
  F.walkTo = function (st, then) {
    const sp = F.SPOTS[st]; if (!sp || F.mode !== 'play') return; const P = F.P;
    if (F.near(st) && then) { then(); return; }
    let path = null; try { path = findPath(P.x, P.z, sp.stand.x, sp.stand.z); } catch (e) { }
    if (path && path.length) path[path.length - 1] = sp.stand.clone(); else path = [sp.stand.clone()];
    F.walk = { to: path.shift(), path, look: sp.look.clone(), st, t: 0, then }; F.walkLook = true;
  };
  F.relicIcons = [];
  F.syncBoard = function (qs) {
    if (!F.board) return; (F.board.userData.papers || []).forEach((p, i) => { const q = qs && qs[i]; const key = q ? q.t + '|' + q.prog + '|' + q.done + '|' + q.failed : '-'; if (p.userData.key === key) return; p.userData.key = key; if (p.material.map) p.material.map.dispose(); p.material.map = M.questTex(q ? q.t : '', q ? (q.done ? '' : q.failed ? '실패' : (q.k === 'offer' || q.k === 'nobreak' ? '정산 때 확인' : Math.min(q.prog, q.n) + ' / ' + q.n)) : '', q && q.done); p.material.needsUpdate = true; });
  };
  F.syncRelics = function (list) {
    F.relicIcons.forEach(o => o.parent && o.parent.remove(o)); F.relicIcons = [];
    (F.relicSlots || []).forEach((slot, i) => { const id = list[i]; slot.userData.label.material.map = M.labelTex(id ? ET.RELIC[id].name : '— 비어 있음 —', id ? ET.RELIC[id].r : 0); slot.userData.label.material.needsUpdate = true; slot.userData.glow.intensity = id ? .55 : .08; if (!id) return; const ic = M.makeRelicIcon(ET.RELIC[id].tag); ic.position.y = .2; ic.scale.setScalar(1.25); M.lin(ic); slot.add(ic); F.relicIcons.push(ic); });
  };
  F.resize = function (w, h, sheetW) {
    F.W = w; F.H = h; F.sheet = 0;
    const s = F.sheet / w, fullW = w * (1 + s);
    F.cam.fov = h > w ? 62 : 50; F.cam.aspect = fullW / h;
    if (s > 0) F.cam.setViewOffset(fullW, h, w * s, 0, w, h); else F.cam.clearViewOffset();
    F.cam.updateProjectionMatrix();
  };
  // ---- placement helpers ----
  const basis = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  const Q_ANVIL = basis(V(0, 0, -1), V(-1, 0, 0), V(0, 1, 0));
  const Q_RACK = basis(V(0, 0, -1), V(0, -1, 0), V(-1, 0, 0));
  const Q_TRAY = basis(V(0, 0, 1), V(1, 0, 0), V(0, 1, 0));
  const swKey = sw => sw.type + ET.tierOf(sw.lv) + (sw.lv >= ET.FINAL_LV ? 'f' : '');
  F.setAnvilSword = function (sw) {
    if (F.anvilSword && (!sw || F.anvilSword.userData.key !== swKey(sw) || F.anvilSword.userData.id !== sw.id)) { F.scene.remove(F.anvilSword); F.anvilSword = null; }
    if (!sw) { F.anvilLight.intensity = 0; return; }
    if (!F.anvilSword) {
      const m = M.makeSword(sw.type, sw.lv); m.userData.key = swKey(sw); m.userData.id = sw.id;
      m.quaternion.copy(Q_ANVIL); m.position.set(.52, F.anvilTop + .012, .0);
      m.traverse(o => { if (o.isMesh) { o.userData.action = 'strike'; o.userData.id = sw.id; F.clickables.push(o); } });
      F.scene.add(m); F.anvilSword = m; m.userData.drop = 1;
    }
    M.setHeat(F.anvilSword, sw.heat);
    const h = (sw.heat || 0) / 100; F.anvilLight.intensity = h * h * 2.2 + (F.anvilSword.userData.fin ? .6 : 0);
    F.anvilLight.color.set(0xff6a20).lerp(F.anvilSword.userData.glow, F.anvilSword.userData.fin ? .5 : 0);
  };
  function mk(map, sw, holder) {
    let m = map[sw.id];
    if (m && m.userData.key !== swKey(sw)) { F.scene.remove(m); m = null; }
    if (!m) { m = M.makeSword(sw.type, sw.lv); m.userData.key = swKey(sw); m.userData.id = sw.id; m.traverse(o => { if (o.isMesh) { o.userData.action = holder; o.userData.id = sw.id; F.clickables.push(o); } }); F.scene.add(m); map[sw.id] = m; }
    return m;
  }
  function syncGroup(map, list, place, holder) {
    const seen = {};
    list.forEach((sw, i) => { seen[sw.id] = 1; const m = mk(map, sw, holder); if (!m.userData.flyT) place(m, i, list.length); M.setHeat(m, sw.heat || 0); });
    for (const id in map) if (!seen[id]) { F.scene.remove(map[id]); delete map[id]; }
  }
  const Q_FLOOR = Q_TRAY.clone(), _qy = new THREE.Quaternion();
  function floorPose(m, p) { _qy.setFromAxisAngle(V(0, 1, 0), p[2]); m.quaternion.copy(_qy).multiply(Q_FLOOR); m.position.set(p[0], .028, p[1]); }
  F.syncFloor = function (list) { syncGroup(F.floorMeshes, list, (m, i) => floorPose(m, list[i].p || [0, 1, 0]), 'sword'); };
  F.blockedAt = (x, z) => blocked(x, z);
  // a free spot on the floor in front of the player
  F.dropPoint = function () {
    const P = F.P, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    for (const d of [.9, .65, .45, 1.2]) { const x = P.x + fx * d, z = P.z + fz * d; if (!blocked(x, z)) return { x, z, r: P.yaw + Math.PI / 2 + (Math.random() - .5) * .5 }; }
    return { x: P.x, z: P.z, r: P.yaw + Math.PI / 2 };
  };
  // where the dragon's tossed swords land: open floor between the cage and the anvil
  F.floorSpot = function () {
    const S = ET.G.S, others = (S && S.floor) || [];
    for (let k = 0; k < 40; k++) { const x = -1.5 + Math.random() * 2.9, z = -2.6 + Math.random() * 1.45; if (blocked(x, z) || (Math.abs(x) < .8 && z > -2.35)) continue; if (others.some(o => o.p && Math.hypot(o.p[0] - x, o.p[1] - z) < .42)) continue; return { x, z, r: Math.random() * 6.28 }; }
    return { x: -1 + Math.random() * 2, z: -1.8, r: Math.random() * 6.28 };
  };
  F.throwSword = function (sw, delay) {
    const m = mk(F.floorMeshes, sw, 'sword'); const hw = V(0, 2.2, -5.5); try { F.dragon.userData.head.getWorldPosition(hw); } catch (e) { }
    m.visible = false; m.userData.flyT = -(delay || 0); m.userData.from = hw.clone().add(V(0, -.1, .4)); m.userData.p = sw.p.slice();
    floorPose(m, sw.p); m.userData.q1 = m.quaternion.clone();
  };
  function updateThrown(dt) {
    for (const id in F.floorMeshes) {
      const m = F.floorMeshes[id], u = m.userData; if (!u.flyT) continue;
      u.flyT += dt; if (u.flyT < 0) continue;
      if (!m.visible) { m.visible = true; ET.Audio.play('whoosh', .8); }
      const T = 1.05, k = Math.min(1, u.flyT / T), to = V(u.p[0], .028, u.p[1]);
      m.position.lerpVectors(u.from, to, k); m.position.y += Math.sin(k * Math.PI) * 1.5;
      m.quaternion.copy(u.q1); m.rotateZ((1 - k) * 9); m.rotateX((1 - k) * 4);
      if (k >= 1) { u.flyT = 0; floorPose(m, u.p); ET.Audio.play('clang', .55); F.shake = Math.max(F.shake, .012); for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28; F.sparks.emit(to.clone().add(V(0, .03, 0)), V(Math.cos(a) * 1.2, .5 + Math.random() * 1.2, Math.sin(a) * 1.2), .3 + Math.random() * .3, .01, 0xffa050, 7, .98); } for (let i = 0; i < 6; i++) F.smoke.emit(to.clone(), V((Math.random() - .5) * .3, .15, (Math.random() - .5) * .3), 1.2, .18, 0x5a5048, -.03, .99, 3); }
    }
  }
  F.updateThrown = updateThrown;
  // ---- the sword in your hand (first-person) ----
  const HAND_POS = V(.19, -.2, -.5), HAND_Q = (() => { const y = V(-.24, .7, -.67).normalize(), z0 = V(.45, .15, .88), z = z0.sub(y.clone().multiplyScalar(z0.dot(y))).normalize(), x = new THREE.Vector3().crossVectors(y, z); return basis(x, y, z); })();
  F.setHandSword = function (sw) {
    if (F.handMesh && (!sw || F.handMesh.userData.key !== swKey(sw) || F.handMesh.userData.id !== sw.id)) { F.cam.remove(F.handMesh); F.handMesh = null; }
    F.vm.visible = F.mode === 'play' && !sw;
    if (!sw) return;
    if (!F.handMesh) { const m = M.makeSword(sw.type, sw.lv); m.userData.key = swKey(sw); m.userData.id = sw.id; m.scale.setScalar(.56); m.position.copy(HAND_POS); m.quaternion.copy(HAND_Q); m.traverse(o => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 2; } }); F.cam.add(m); F.handMesh = m; m.userData.lift = 1; }
    M.setHeat(F.handMesh, sw.heat || 0);
  };
  F.setHandHeat = h => { if (F.handMesh) M.setHeat(F.handMesh, h); };
  // while dragging, the held sword follows the cursor
  F.dragAt = function (x, y) { if (!F.handMesh) return; const v = V(x / F.W * 2 - 1, -(y / F.H) * 2 + 1, .5).applyMatrix4(F.cam.projectionMatrixInverse).normalize().multiplyScalar(.75); F.handMesh.userData.drag = v; };
  F.dragEnd = function () { if (F.handMesh) F.handMesh.userData.drag = null; };
  F.nearFurnace = () => F.mode === 'play' && Math.hypot(F.P.x - (-2.6), F.P.z - (-.45)) < 1.75;
  F.syncRack = function (rack) { syncGroup(F.rackMeshes, rack, (m, i) => { const p = M.rackSlotPos(i % 10), L = Math.floor(i / 10); m.quaternion.copy(Q_RACK); m.position.set(F.rack.position.x + p.x - L * .085, p.y - L * .04, F.rack.position.z + p.z + (L % 2 ? .14 : 0)); }, 'sword'); };
  F.syncCounter = function (counter) { syncGroup(F.counterMeshes, counter, (m, i, n) => { const sp = Math.min(.09, .48 / Math.max(1, n)); m.quaternion.copy(Q_TRAY); m.position.set(F.counter.position.x - .45, F.counter.userData.trayY + .008 + i * .002, F.counter.position.z - (n - 1) * sp / 2 + i * sp); m.userData.fly = 0; }, 'sword'); };
  F.syncAltar = function (offers) { while (F.altarIcons.children.length) F.altarIcons.remove(F.altarIcons.children[0]); (offers || []).forEach((r, i) => { if (!r || r.sold) return; const ic = M.makeRelicIcon(ET.RELIC[r.id].tag); ic.position.set((i - 1) * .36, .06, 0); ic.scale.setScalar(1.1); M.lin(ic); F.altarIcons.add(ic); }); };
  F.goldenFx = function (on) { F.golden = on; if (F.anvilSword) { const bm = F.anvilSword.userData.bladeMat; if (on) { bm.userData.prevEm = bm.emissive.clone(); bm.emissive.set(0x7a5010); } else if (bm.userData.prevEm) { bm.emissive.copy(bm.userData.prevEm); } } };
  F.evolveFx = function () { F.shake = .08; F.flashLight = 2.4; const top = V(0, F.anvilTop + .05, 0); for (let i = 0; i < 90; i++) { const a = i / 90 * Math.PI * 2; F.gold.emit(top, V(Math.cos(a) * 2.6, .4 + Math.random() * 1.5, Math.sin(a) * 2.6), 1, .05, 0xfff0c0, 0, .94); } for (let i = 0; i < 40; i++) F.flameP.emit(top, V((Math.random() - .5) * .6, 1.5 + Math.random() * 2, (Math.random() - .5) * .6), .9, .12, 0xffc060, -.6, .96); };
  // ---- first-person movement ----
  function collide(P) {
    const pr = .3, b = COL.bounds;
    P.x = U.clamp(P.x, b[0], b[1]); P.z = U.clamp(P.z, b[2], b[3]);
    for (const [cx, cz, r] of COL.circles) { const dx = P.x - cx, dz = P.z - cz, d = Math.hypot(dx, dz), m = r + pr; if (d < m && d > 1e-5) { P.x = cx + dx / d * m; P.z = cz + dz / d * m; } }
    for (const [x0, x1, z0, z1] of COL.boxes) { const qx = U.clamp(P.x, x0, x1), qz = U.clamp(P.z, z0, z1), dx = P.x - qx, dz = P.z - qz, d = Math.hypot(dx, dz); if (d < pr) { if (d > 1e-5) { P.x = qx + dx / d * pr; P.z = qz + dz / d * pr; } else { const opts = [[x0 - pr - P.x, 0], [x1 + pr - P.x, 0], [0, z0 - pr - P.z], [0, z1 + pr - P.z]].sort((a, c) => Math.abs(a[0] + a[1]) - Math.abs(c[0] + c[1])); P.x += opts[0][0]; P.z += opts[0][1]; } } }
  }
  F.movePlayer = function (dt) {
    const P = F.P, I = F.input;
    if (F.turnL || F.turnR) { P.yaw += ((F.turnL || 0) - (F.turnR || 0)) * dt * 2.2; F.walkLook = false; }
    let mx = (I.r - I.l) + I.jx, mz = (I.f - I.b) - I.jy;
    const manual = Math.abs(mx) > .05 || Math.abs(mz) > .05;
    if (manual) F.walk = null;
    let vx = 0, vz = 0;
    const sp = I.run ? 4.2 : 2.7;
    if (F.walk) {
      const dx = F.walk.to.x - P.x, dz = F.walk.to.z - P.z, d = Math.hypot(dx, dz);
      F.walk.t += dt;
      if (d < (F.walk.path.length ? .3 : .1) || F.walk.t > 9) { if (F.walk.path.length && F.walk.t <= 9) { F.walk.to = F.walk.path.shift(); } else { const st = F.walk.st, then = F.walk.then; F.walk = null; if (then) then(); else if (st && ET.G.S) ET.G.go(st); } }
      else { vx = dx / d * Math.min(sp, d * 4); vz = dz / d * Math.min(sp, d * 4); }
      if (F.walkLook) { const tgt = (F.walk || {}).look || F.lastLook; }
    } else if (manual) {
      const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
      const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
      vx = (-sy * mz + cy * mx) * sp; vz = (-cy * mz - sy * mx) * sp;
    }
    P.vx += (vx - P.vx) * Math.min(1, dt * 12); P.vz += (vz - P.vz) * Math.min(1, dt * 12);
    const ox = P.x, oz = P.z; P.x += P.vx * dt; P.z += P.vz * dt; collide(P);
    const moved = Math.hypot(P.x - ox, P.z - oz);
    // turn toward the walk target's look point
    const lk = F.walk ? (F.walk.path.length ? V(F.walk.to.x, 1.5, F.walk.to.z) : F.walk.look) : (F.walkLook ? F.lastLook : null);
    if (F.walk && !F.walk.path.length) F.lastLook = F.walk.look;
    if (lk && F.walkLook) { const dx = lk.x - P.x, dz = lk.z - P.z, ty = Math.atan2(-dx, -dz), tp = Math.atan2(lk.y - 1.62, Math.hypot(dx, dz)); let dy = ty - P.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); P.yaw += dy * Math.min(1, dt * 5); P.pitch += (tp - P.pitch) * Math.min(1, dt * 5); if (!F.walk && Math.abs(dy) < .01) F.walkLook = false; }
    // head bob & steps
    const spd = moved / Math.max(dt, 1e-4); P.bobT = (P.bobT || 0) + spd * dt * 5.5; P.bob = Math.sin(P.bobT) * .025 * Math.min(1, spd / 2.5);
    P.stepAcc += moved; if (P.stepAcc > .62) { P.stepAcc = 0; ET.Audio.play('step'); }
    F.cam.position.set(P.x, 1.62 + P.bob, P.z); F.cam.rotation.set(P.pitch, P.yaw, 0);
  };

  // ---- effects ----
  F.strike = function (onImpact) { F.hammerAnim = .001; F.hammerStart = performance.now(); F.onImpact = onImpact; };
  F.impactFx = function (res) {
    const top = V(ANV_HIT.x, F.anvilTop + .03, 0);
    const col = { gs: 0xffe39a, s: 0xffb050, h: 0xffc890, d: 0xff6a30, b: 0xffffff }[res];
    const n = { gs: 110, s: 60, h: 26, d: 36, b: 20 }[res] * (F.hi ? 1 : .6);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 1.2 + Math.random() * (res === 'gs' ? 5 : 3.2); F.sparks.emit(top, V(Math.cos(a) * sp, .6 + Math.random() * 3, Math.sin(a) * sp), .25 + Math.random() * .6, .012 + Math.random() * .02, col, 7, .985); }
    F.shake = Math.max(F.shake, res === 'gs' ? .035 : res === 'b' ? .06 : .015);
    F.flashLight = res === 'gs' ? 1.2 : .5;
    if (res === 'gs') for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2; F.gold.emit(top, V(Math.cos(a) * 1.6, .5, Math.sin(a) * 1.6), .7, .04, 0xffe0a0, 0, .93); }
    if (res === 'b' && F.anvilSword) F.shatter(F.anvilSword);
  };
  F.shatter = function (m) {
    const bm = m.userData.bladeMat, mat = new THREE.MeshStandardMaterial({ map: bm.map, metalness: bm.metalness, roughness: .3, emissive: 0x401000, side: THREE.DoubleSide, transparent: true });
    for (let i = 0; i < 34; i++) {
      const g = new THREE.BufferGeometry(), s = .02 + Math.random() * .06;
      g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, s, Math.random() * s * .4, 0, Math.random() * s, s * .3, s * 1.6], 3)); g.computeVertexNormals();
      const sh = new THREE.Mesh(g, mat); sh.castShadow = true; sh.position.set(-.4 + Math.random() * .9, F.anvilTop + .03, (Math.random() - .5) * .06);
      sh.userData.v = V((Math.random() - .5) * 3.5, 1 + Math.random() * 2.5, (Math.random() - .5) * 3.5); sh.userData.r = V(Math.random() * 12, Math.random() * 12, 0); sh.userData.life = 2.2;
      F.scene.add(sh); F.shards.push(sh);
    }
    for (let i = 0; i < 14; i++) F.smoke.emit(V((Math.random() - .5) * .6, F.anvilTop + .1, 0), V((Math.random() - .5) * .3, .3 + Math.random() * .3, (Math.random() - .5) * .3), 2.2, .3, 0x6a6060, -.05, .99, 3);
    F.scene.remove(m); F.anvilSword = null; F.anvilLight.intensity = 0;
  };
  F.rushFx = function (on) { F.rush = on; };
  F.dragonReact = function (kind) {
    const d = F.ds;
    if (kind === 'happy') { d.tfwd = .5; d.tmouth = .15; clearTimeout(d.to); d.to = setTimeout(() => { d.tfwd = 0; d.tmouth = 0; }, 1800); }
    if (kind === 'peek') { d.tfwd = .8; d.tmouth = .05; clearTimeout(d.to); d.to = setTimeout(() => { d.tfwd = 0; d.tmouth = 0; }, 2600); }
    if (kind === 'toss') { d.tfwd = 1; d.tmouth = .55; ET.Audio.play('roar', .35); clearTimeout(d.to); d.to = setTimeout(() => { d.tfwd = 0; d.tmouth = 0; }, 2000); }
    if (kind === 'angry') { d.tfwd = 1; d.tmouth = 1; d.roarT = 1.6; F.shake = .12; ET.Audio.play('roar'); clearTimeout(d.to); d.to = setTimeout(() => { d.tfwd = 0; d.tmouth = 0; }, 2400); }
  };
  F.tributeFly = function () {
    for (const id in F.counterMeshes) F.counterMeshes[id].userData.fly = .001;
    for (let i = 0; i < 60; i++) F.gold.emit(V(F.counter.position.x + (Math.random() - .5) * 1.4, 1.05, F.counter.position.z), V((Math.random() - .5) * .6, .6 + Math.random() * 1.6, -1.5 - Math.random() * 2), 1.4, .035, 0xffd070, 1, .98);
  };
  F.bellRing = function () { F.bellT = 1; };
  // ---- picking ----
  const ray = new THREE.Raycaster(), mv = new THREE.Vector2();
  F.pick = function (x, y, maxD) {
    mv.set(x / F.W * 2 - 1, -(y / F.H) * 2 + 1); ray.setFromCamera(mv, F.cam); ray.far = maxD || 100;
    const hit = ray.intersectObjects(F.clickables.filter(o => inScene(o)), false)[0];
    F.hitPoint = hit ? hit.point : null; return hit ? hit.object.userData : null;
  };
  F.centerX = () => (F.W - (F.sheet || 0)) / 2;
  F.pickCenter = () => F.pick(F.centerX(), F.H / 2, 3.2);
  function inScene(o) { while (o.parent) o = o.parent; return o === F.scene; }

  // ---- update ----
  F.update = function (dt) {
    F.time += dt; const t = F.time;
    if (F.mode === 'play') F.movePlayer(dt);
    else {
      const k = 1 - Math.pow(.002, dt);
      F.camPos.lerp(F.camPosT, k); F.camLook.lerp(F.camLookT, k);
      F.cam.position.copy(F.camPos); F.cam.position.y += Math.sin(t * .9) * .004;
      F.cam.lookAt(F.camLook);
    }
    if (F.shake > 0) { F.cam.position.x += (Math.random() - .5) * F.shake; F.cam.position.y += (Math.random() - .5) * F.shake; F.shake *= Math.pow(.01, dt); if (F.shake < .001) F.shake = 0; }
    // fire & lights
    M.updateFire(t); M.billboard(F.scene, F.cam);
    const fl = 1 + Math.sin(t * 11) * .06 + Math.sin(t * 6.7) * .08 + (Math.random() - .5) * .1;
    F.fireLight.intensity = 7 * fl * (F.heating ? 1.5 : 1);
    F.furnace.userData.fires.children.forEach((f, i) => { f.material.uniforms.uInt.value = (F.heating ? 1.8 : .9) * (1 + Math.sin(t * 3 + i) * .1); f.scale.y = F.heating ? 1.45 : 1; });
    M.mat.coal.emissiveIntensity = 1.4 + Math.sin(t * 2.3) * .3 + (F.heating ? 1.5 : 0);
    F.torches.forEach((l, i) => l.intensity = 2.3 + Math.sin(t * 9 + i * 2) * .25 + (Math.random() - .5) * .25);
    F.lairLight.intensity = 3.8 + Math.sin(t * .7) * .9;
    const fb = F.furnace.userData.bellows, bag = F.furnace.userData.bellowsBag, pump = F.heating ? Math.abs(Math.sin(t * 7)) : 0;
    fb.position.y = -pump * .12; bag.scale.y = 1 - pump * .55; bag.position.y = -.11 - pump * .06;
    // furnace sparks & smoke
    const fp = F.furnace.position;
    if (Math.random() < (F.heating ? .9 : .3)) F.embers.emit(V(fp.x + (Math.random() - .5) * .3, 1.1, fp.z + (Math.random() - .5) * .4), V((Math.random() - .5) * .3, .5 + Math.random() * 1.2, (Math.random() - .5) * .3), 2.4, .012 + Math.random() * .012, 0xff8a30, -.15, .99);
    if (Math.random() < .08) F.smoke.emit(V(fp.x, 2.6, fp.z), V((Math.random() - .5) * .1, .35, (Math.random() - .5) * .1), 4, .35, 0x302a28, -.02, .995, 4);
    if (Math.random() < .12) F.embers.emit(V(-3 + Math.random() * 6, .05, -5 - Math.random() * 4), V((Math.random() - .5) * .2, .4 + Math.random() * .6, 0), 3, .025, 0xff5a10, -.05, .995);
    if (F.rush && F.anvilSword && Math.random() < .9) { const a = Math.random() * 6.28; F.flameP.emit(V(Math.cos(a) * .4, F.anvilTop + .03, Math.sin(a) * .12), V(0, .6 + Math.random(), 0), .5, .06, 0xffc040, -.4, .96); }
    // dust drifting in moonlight
    for (const p of F.dust.items) { const s = p.s.position; if (s.y > 4.2) s.y = 0; if (s.y < 0) s.y = 4.2; s.x += Math.sin(t * .3 + s.y) * .0006; }
    // lava breathing
    if (F.lairFloor) F.lairFloor.material.emissiveIntensity = 1.1 + Math.sin(t * .8) * .25;
    // dragon
    const d = F.ds, kk = 1 - Math.pow(.04, dt);
    d.fwd += (d.tfwd - d.fwd) * kk; d.mouth += (d.tmouth - d.mouth) * kk * 1.6;
    const D = F.dragon; const hw = new THREE.Vector3(); D.userData.head.getWorldPosition(hw);
    const toCam = F.camPos.clone().sub(hw); const yaw = Math.atan2(toCam.x, toCam.z) - D.rotation.y;
    M.animDragon(D, dt, { mouth: d.mouth, neckYaw: THREE.MathUtils.clamp(yaw, -.9, .9) * (.4 + d.fwd * .5), neckPitch: -.2 + d.fwd * .35, headPitch: -.05 - d.fwd * .1, breathe: 1 + d.fwd, sway: 1 - d.fwd * .5, tailWhip: d.mouth * .3, fold: 0 });
    if (d.roarT > 0) { d.roarT -= dt; for (let i = 0; i < 6; i++) { const dir = V(F.camPos.x - hw.x, -.3, F.camPos.z - hw.z).normalize().multiplyScalar(6 + Math.random() * 3); dir.x += (Math.random() - .5) * 1.5; dir.y += (Math.random() - .5) * .8; F.flameP.emit(hw.clone().add(V(0, -.1, .3)), dir, .55, .35, Math.random() < .5 ? 0xff6a18 : 0xffb040, -.5, .965); } }
    if (Math.random() < .015) for (let i = 0; i < 4; i++) F.smoke.emit(hw.clone().add(V(0, 0, .5)), V((Math.random() - .5) * .2, .25, .3), 2.5, .2, 0x2a2420, -.05, .99, 3);
    // merchant & altar
    F.merchant.position.y = Math.sin(t * 1.2) * .02; F.merchant.userData.light.intensity = 1.5 + Math.sin(t * 7) * .15;
    F.altarIcons.children.forEach((c, i) => { c.rotation.y = t * .8 + i; c.position.y = .06 + Math.sin(t * 1.6 + i) * .02; });
    F.relicIcons.forEach((c, i) => { c.rotation.y = t * .5 + i; c.position.y = .2 + Math.sin(t * 1.2 + i) * .015; });
    // hammer
    const arm = F.vmArm, UP = .35, DOWN = -1.05;
    if (F.hammerAnim > 0) {
      const ha = (performance.now() - F.hammerStart) / 1000; F.hammerAnim = Math.max(.001, ha);
      const down = .09, up = .27;
      if (ha < down) { arm.rotation.x = UP + (DOWN - UP) * U.ease(ha / down); arm.position.z = -.12 * (ha / down); }
      else if (ha < up) { if (F.onImpact) { const f = F.onImpact; F.onImpact = null; f(); } const k2 = U.ease((ha - down) / (up - down)); arm.rotation.x = DOWN + (UP - DOWN) * k2; arm.position.z = -.12 * (1 - k2); }
      else { if (F.onImpact) { const f = F.onImpact; F.onImpact = null; f(); } F.hammerAnim = 0; arm.rotation.x = UP; arm.position.z = 0; }
    } else { arm.rotation.x = UP + Math.sin(t * 1.5) * .02 + F.P.bob * .4; arm.position.y = Math.sin(F.P.bobT || 0) * .01; }
    if (F.golden && F.anvilSword && Math.random() < .7) F.gold.emit(V((Math.random() - .5) * .8, F.anvilTop + .05, (Math.random() - .5) * .1), V(0, .5 + Math.random(), 0), .6, .03, 0xffe090, -.2, .97);
    // anvil sword
    if (F.anvilSword) { const u = F.anvilSword.userData; if (u.drop > 0) { u.drop = Math.max(0, u.drop - dt * 4); F.anvilSword.position.y = F.anvilTop + .012 + u.drop * u.drop * .4; } if (u.orb) u.orb.rotation.y = t * 1.2; if (u.rune) u.rune.opacity = (.35 + u.tier * .1) * (.8 + Math.sin(t * 2.5) * .2); }
    for (const id in F.rackMeshes) { const u = F.rackMeshes[id].userData; if (u.orb) u.orb.rotation.y = t; }
    updateThrown(dt);
    if (F.handMesh) { const u = F.handMesh.userData, tgt = u.drag || HAND_POS; u.lift = Math.max(0, (u.lift || 0) - dt * 4); F.handMesh.position.lerp(tgt, Math.min(1, dt * 16)); if (!u.drag) { F.handMesh.position.y += Math.sin(F.P.bobT || 0) * .006 - u.lift * u.lift * .25; } if (F.heating) F.handMesh.position.x += (Math.random() - .5) * .002; if (u.orb) u.orb.rotation.y = t; if (F.heating && Math.random() < .5) { const wp = new THREE.Vector3(); F.handMesh.getWorldPosition(wp); F.embers.emit(wp.add(V((Math.random() - .5) * .2, .2 + Math.random() * .2, (Math.random() - .5) * .2)), V((Math.random() - .5) * .3, .5 + Math.random() * .6, (Math.random() - .5) * .3), .7, .01, 0xffa040, -.2, .98); } }
    for (const id in F.counterMeshes) { const m = F.counterMeshes[id]; if (m.userData.fly) { m.userData.fly += dt; m.position.z -= dt * 2.4 * m.userData.fly; m.position.y += dt * (1.2 - m.userData.fly); m.rotation.z += dt * 2; } }
    if (F.flashLight) { F.flashLight = Math.max(0, F.flashLight - dt * 3); F.anvilLight.intensity += F.flashLight * 3; }
    if (F.bellT > 0) { F.bellT = Math.max(0, F.bellT - dt * .7); F.bell.userData.bell.rotation.z = Math.sin(t * 20) * .3 * F.bellT; }
    for (let i = F.shards.length - 1; i >= 0; i--) { const s = F.shards[i], u = s.userData; u.life -= dt; u.v.y -= 9 * dt; s.position.addScaledVector(u.v, dt); if (s.position.y < .01) { s.position.y = .01; u.v.multiplyScalar(.35); u.v.y = Math.abs(u.v.y) * .3; u.r.multiplyScalar(.5); } s.rotation.x += u.r.x * dt; s.rotation.y += u.r.y * dt; s.material.opacity = Math.min(1, u.life); if (u.life <= 0) { F.scene.remove(s); F.shards.splice(i, 1); } }
    F.sparks.update(dt); F.embers.update(dt); F.smoke.update(dt); F.gold.update(dt); F.flameP.update(dt);
  };
})(window.ET);
