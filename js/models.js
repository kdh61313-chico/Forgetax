/* EMBER TITHE — realistic procedural models (dark realism). Everything is built in code. */
'use strict';
(function (ET) {
  const M = ET.M = {}, X = ET.X, TAU = Math.PI * 2;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  M.mat = {};

  // ---------- geometry helpers ----------
  // loft along control points with elliptical sections. radii: array of [rx, ry] or numbers. opts: {seg, rings, up, uvScaleV, cap, closedTip, onVertex}
  M.loft = function (pts, radii, opts) {
    opts = opts || {}; const seg = opts.seg || 16, N = opts.rings || Math.max(pts.length * 8, 24), up = opts.up || V(0, 1, 0);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .5);
    const pos = [], uv = [], idx = [], tArr = [];
    let arc = 0, prev = null;
    const T = new THREE.Vector3(), side = new THREE.Vector3(), nrm = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = curve.getPoint(t); curve.getTangent(t, T);
      if (prev) arc += p.distanceTo(prev); prev = p;
      side.crossVectors(T, up); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize(); nrm.crossVectors(side, T).normalize();
      const fi = t * (radii.length - 1), i0 = Math.min(radii.length - 2, Math.floor(fi)), f = fi - i0;
      const ra = radii[i0], rb = radii[i0 + 1];
      const rx = THREE.MathUtils.lerp(ra[0] != null ? ra[0] : ra, rb[0] != null ? rb[0] : rb, f), ry = THREE.MathUtils.lerp(ra[1] != null ? ra[1] : ra, rb[1] != null ? rb[1] : rb, f);
      for (let j = 0; j <= seg; j++) {
        const a = j / seg * TAU, cs = opts.shape ? opts.shape(a, t) : null, c = cs ? cs[0] : Math.cos(a), s = cs ? cs[1] : Math.sin(a);
        const v = V(p.x + side.x * c * rx + nrm.x * s * ry, p.y + side.y * c * rx + nrm.y * s * ry, p.z + side.z * c * rx + nrm.z * s * ry);
        if (opts.onVertex) opts.onVertex(v, t, a, p, side, nrm);
        pos.push(v.x, v.y, v.z); uv.push(j / seg, arc / (opts.uvScaleV || 1)); tArr.push(t);
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    g.userData.t = tArr; g.userData.rings = N; g.userData.seg = seg; return g;
  };
  M.mesh = function (g, m, cast, recv) { const o = new THREE.Mesh(g, m); o.castShadow = cast !== false; o.receiveShadow = recv !== false; return o; };
  M.DENS = .75;
  M.tile = function (g, du, dv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * du, uv.getY(i) * dv); uv.needsUpdate = true; return g; };
  M.boxGeo = function (w, h, d, dens) { const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, D = dens || M.DENS, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] * D, uv.getY(i) * dims[f][1] * D); } return g; };
  M.box = (w, h, d, m, dens) => M.mesh(M.boxGeo(w, h, d, dens), m);
  M.cyl = (rt, rb, h, m, s, dens) => M.mesh(M.tile(new THREE.CylinderGeometry(rt, rb, h, s || 16), Math.PI * (rt + rb) * (dens || M.DENS), h * (dens || M.DENS)), m);
  // hex colors are authored in sRGB; convert material colors to linear once
  M.lin = function (root) { root.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { if (!m || m.userData.lin || m.isShaderMaterial) continue; m.userData.lin = 1; if (m.color) m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear(); } }); return root; };
  M.lathe = (pts, m, seg) => M.mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg || 32), m);
  function setUV2(g) { g.setAttribute('uv2', g.attributes.uv); return g; }

  // ---------- materials ----------
  M.initMats = function () {
    const R = (k, rx, ry) => X.rep(X.lib[k](), rx, ry);
    M.set = {
      iron: X.lib.iron(), steelFace: X.lib.steelFace(), brass: X.lib.brass(), leather: X.lib.leather(), wood: X.lib.wood(), bark: X.lib.bark(), endgrain: X.lib.endgrain(),
      brick: X.lib.brick(), coal: X.lib.coal(), cave: X.lib.cave(), lava: X.lib.lava(), gold: X.lib.gold(), scales: X.lib.scales(), horn: X.lib.horn(), ivory: X.lib.ivory(), ashlar: X.lib.ashlar(), flag: X.lib.flag()
    };
    const s = M.set;
    M.mat.iron = X.mat(s.iron, { metalness: 1, roughness: 1, color: 0xffffff });
    M.mat.ironDark = X.mat(s.iron, { metalness: 1, color: 0x9a9690 });
    M.mat.steelFace = X.mat(s.steelFace, { metalness: 1 });
    M.mat.brass = X.mat(s.brass, { metalness: 1 });
    M.mat.gold = X.mat(X.rep(s.brass, 1, 1), { metalness: 1, color: 0xffd27a, roughness: .7 });
    M.mat.leather = X.mat(s.leather);
    M.mat.wood = X.mat(s.wood, { color: 0xd8c0a8 });
    M.mat.woodDark = X.mat(s.wood, { color: 0x6a5a4e });
    M.mat.bark = X.mat(s.bark);
    M.mat.endgrain = X.mat(s.endgrain);
    M.mat.brick = X.mat(X.rep(s.brick, 1.6, 1.6));
    M.mat.coal = X.mat(s.coal, { emissive: 0xff6a20, emissiveIntensity: 1.6 });
    M.mat.stone = X.mat(s.ashlar, { color: 0xc8c0b8 });
    M.mat.horn = X.mat(s.horn);
    M.mat.ivory = X.mat(s.ivory);
    M.mat.cloth = new THREE.MeshStandardMaterial({ color: 0x14100f, roughness: 1, side: THREE.DoubleSide, normalMap: s.leather.normalMap, normalScale: new THREE.Vector2(.3, .3) });
    M.mat.candle = new THREE.MeshStandardMaterial({ color: 0xd8cbb0, roughness: .6, emissive: 0x2a1404 });
    M.mat.glass = new THREE.MeshStandardMaterial({ color: 0x2a3a30, roughness: .08, metalness: .2, transparent: true, opacity: .55 });
    M.mat.water = new THREE.MeshStandardMaterial({ color: 0x050808, roughness: .03, metalness: .6 });
    M.mat.rope = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1, normalMap: s.leather.normalMap });
    M.mat.black = new THREE.MeshBasicMaterial({ color: 0x000000 });
    // dragon
    const sc = s.scales;
    M.mat.dragonSkin = X.mat(sc, { emissive: 0xff4a10, emissiveIntensity: .8, normalScale: new THREE.Vector2(1.5, 1.5), color: 0xffffff, envMapIntensity: 1.4 });
    M.mat.dragonSkin.skinning = true;
    M.mat.dragonHead = X.mat(X.rep(sc, 3, 3), { emissive: 0xff4a10, emissiveIntensity: .55, normalScale: new THREE.Vector2(1.3, 1.3), envMapIntensity: 1.4 });
    M.mat.dragonLimb = X.mat(X.rep(sc, 1, 2), { emissive: 0xff4a10, emissiveIntensity: .5, normalScale: new THREE.Vector2(1.3, 1.3), envMapIntensity: 1.4 });
    const mem = X.lib.membrane();
    M.mat.membrane = new THREE.MeshStandardMaterial({ map: mem.map, color: 0xcc8070, roughness: .65, side: THREE.DoubleSide, emissive: 0x3a0804, emissiveIntensity: .5, normalMap: s.leather.normalMap, normalScale: new THREE.Vector2(.25, .25) });
    M.mat.eye = new THREE.MeshStandardMaterial({ map: X.eye(), emissiveMap: X.eye(), emissive: 0xffffff, emissiveIntensity: 1.4, roughness: .05 });
  };

  // dim, warm environment for metal reflections
  M.makeEnv = function (renderer) {
    const sc = new THREE.Scene(), geo = new THREE.SphereGeometry(10, 32, 16), cols = [];
    const pa = geo.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i) / 10, y = pa.getY(i) / 10, z = pa.getZ(i) / 10; const c = new THREE.Color(0x0a0706).lerp(new THREE.Color(0x6a2a10), Math.max(0, -x) * .7).lerp(new THREE.Color(0x10141e), Math.max(0, y) * .5).lerp(new THREE.Color(0x401206), Math.max(0, -z) * .4); cols.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    sc.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const panel = (c, x, y, z, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m); };
    panel(0xff9040, -8, 0, -1, 3, 2); panel(0x9fb4ff, -6, 6, 0, 2, 2); panel(0xffc080, 3, 7, 4, 4, 1.5);
    const pm = new THREE.PMREMGenerator(renderer); const t = pm.fromScene(sc, .02).texture; pm.dispose(); return t;
  };
  // ---------- fire shader ----------
  const FIRE_V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
  const FIRE_F = [
    'uniform float uTime; uniform float uSeed; uniform float uInt; uniform vec3 uTint; varying vec2 vUv;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }',
    'float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x), f.y); }',
    'float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=.5; } return s; }',
    'void main(){ vec2 uv=vUv; float t=uTime*1.7+uSeed*17.;',
    ' vec2 q=vec2(uv.x*3.2+uSeed*3., uv.y*2.4-t); float n=fbm(q+vec2(fbm(q*1.6+t*.25), 0.));',
    ' float x=abs(uv.x-.5)*2.; float shape=(1.-uv.y)*1.35 - x*x*1.9;',
    ' float f=clamp(shape+(n-.5)*1.25-uv.y*.25, 0., 1.); f*=smoothstep(0.,.1,uv.y+.02)*smoothstep(1.,.75,x);',
    ' vec3 c=mix(vec3(.3,.02,0.), vec3(1.,.33,.04), smoothstep(.04,.3,f)); c=mix(c, vec3(1.,.72,.3), smoothstep(.3,.65,f)); c=mix(c, vec3(1.,.95,.82), smoothstep(.7,1.,f));',
    ' float a=smoothstep(.02,.22,f); gl_FragColor=vec4(c*uTint*uInt*a, a); }'].join('\n');
  M.fireMats = [];
  M.makeFire = function (w, h, intensity, tint, seed) {
    const m = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uSeed: { value: seed != null ? seed : Math.random() }, uInt: { value: intensity || 1.5 }, uTint: { value: new THREE.Color(tint || 0xffffff) } }, vertexShader: FIRE_V, fragmentShader: FIRE_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    M.fireMats.push(m);
    const g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2, 0);
    const o = new THREE.Mesh(g, m); o.userData.billboard = true; o.renderOrder = 5; return o;
  };
  M.updateFire = function (t, cam) {
    for (const m of M.fireMats) m.uniforms.uTime.value = t;
  };
  M.billboard = function (root, cam) {
    const wp = new THREE.Vector3();
    root.traverse(o => { if (o.userData.billboard && o.visible) { o.getWorldPosition(wp); o.lookAt(cam.position.x, wp.y, cam.position.z); } });
  };
  // god-ray shaft
  M.makeShaft = function (r0, r1, h, col, op) {
    const g = new THREE.CylinderGeometry(r0, r1, h, 24, 1, true); g.translate(0, -h / 2, 0);
    const m = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(col) }, uOp: { value: op || .12 }, uTime: { value: 0 } }, vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY=uv.y; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }', fragmentShader: 'uniform vec3 uCol; uniform float uOp; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float e=pow(abs(dot(vN,vV)),1.6); float a=uOp*e*smoothstep(0.,.35,vY)*smoothstep(1.,.85,vY); gl_FragColor=vec4(uCol*a,a); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    return new THREE.Mesh(g, m);
  };
  // soft contact shadow decal
  M.blob = function (w, d, op) { const m = new THREE.MeshBasicMaterial({ map: X.glow('rgba(0,0,0,.6)'), transparent: true, depthWrite: false, opacity: op || .8, color: 0x000000, blending: THREE.MultiplyBlending, premultipliedAlpha: true }); m.blending = THREE.NormalBlending; m.color.set(0x000000); const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); p.rotation.x = -Math.PI / 2; p.position.y = .006; p.renderOrder = 1; return p; };

  // ---------- anvil (London pattern) ----------
  M.makeAnvil = function () {
    const g = new THREE.Group(), mi = M.mat.iron, top = .98;
    // body silhouette (side), extruded
    const body = new THREE.Shape();
    body.moveTo(-.2, 0); body.lineTo(.36, 0); body.lineTo(.36, -.05); body.quadraticCurveTo(.24, -.06, .16, -.13); body.lineTo(.13, -.2);
    body.quadraticCurveTo(.12, -.27, .2, -.3); body.lineTo(.24, -.34); body.lineTo(-.24, -.34); body.lineTo(-.2, -.3); body.quadraticCurveTo(-.12, -.27, -.13, -.2);
    body.lineTo(-.16, -.13); body.quadraticCurveTo(-.2, -.06, -.2, 0);
    const eg = new THREE.ExtrudeGeometry(body, { depth: .15, bevelEnabled: true, bevelThickness: .012, bevelSize: .01, bevelSegments: 3, curveSegments: 18 }); eg.translate(0, 0, -.075);
    const bm = M.mesh(eg, mi); bm.position.y = top - .01; g.add(bm);
    // waist narrowing: feet flare
    const feet = M.box(.52, .05, .26, mi); feet.position.y = top - .35 + .02; g.add(feet);
    [[-.25, .12], [-.25, -.12], [.25, .12], [.25, -.12]].forEach(([x, z]) => { const f = M.mesh(new THREE.CylinderGeometry(.03, .05, .06, 6), mi); f.position.set(x, top - .34, z); g.add(f); });
    // face plate
    const face = M.box(.58, .03, .16, M.mat.steelFace, 1.6); face.position.set(.08, top + .005, 0); g.add(face);
    // step / table
    const step = M.box(.1, .05, .14, mi); step.position.set(-.25, top - .03, 0); g.add(step);
    // horn: lofted curving cone
    const horn = M.mesh(M.loft([V(-.29, top - .03, 0), V(-.42, top - .035, 0), V(-.55, top - .05, 0), V(-.66, top - .08, 0)], [[.065, .055], [.05, .042], [.028, .025], [.004, .004]], { seg: 20, rings: 30, up: V(0, 1, 0) }), mi); g.add(horn);
    // heel holes
    const hole = M.box(.028, .006, .028, M.mat.black); hole.position.set(.3, top + .02, .03); g.add(hole);
    const ph = M.mesh(new THREE.CylinderGeometry(.009, .009, .006, 10), M.mat.black); ph.position.set(.24, top + .02, -.035); g.add(ph);
    // stump
    const stump = M.mesh(new THREE.CylinderGeometry(.3, .34, top - .36, 28, 1), M.mat.bark); stump.position.y = (top - .36) / 2; g.add(stump);
    const cap = M.mesh(new THREE.CircleGeometry(.3, 28), M.mat.endgrain); cap.rotation.x = -Math.PI / 2; cap.position.y = top - .36 + .001; g.add(cap);
    [.12, .46].forEach(y => { const b = M.mesh(new THREE.CylinderGeometry(.315 + y * .02, .315 + y * .02, .05, 28, 1, true), M.mat.ironDark); b.position.y = y; g.add(b); for (let k = 0; k < 8; k++) { const r = M.mesh(new THREE.SphereGeometry(.011, 6, 4), M.mat.ironDark); const a = k / 8 * TAU; r.position.set(Math.cos(a) * (.32 + y * .02), y, Math.sin(a) * (.32 + y * .02)); g.add(r); } });
    // straps holding anvil
    [-.18, .18].forEach(x => { const s = M.box(.03, .12, .3, M.mat.ironDark); s.position.set(x, top - .4, 0); g.add(s); });
    g.add(M.blob(1.1, 1.0, .9));
    g.userData.topY = top + .02;
    return g;
  };
  // ---------- hammer (cross-peen) ----------
  M.makeHammer = function () {
    const g = new THREE.Group();
    const handle = M.mesh(M.loft([V(0, -.62, 0), V(0, -.45, 0), V(0, -.2, 0), V(0, 0, 0)], [[.017, .022], [.014, .019], [.013, .017], [.016, .02]], { seg: 12, rings: 20, up: V(0, 0, 1) }), M.mat.wood); g.add(handle);
    const head = new THREE.Group(); g.add(head);
    const hm = M.mat.iron;
    const oct = M.mesh(new THREE.CylinderGeometry(.026, .026, .1, 8), hm); oct.rotation.z = Math.PI / 2; oct.position.x = .03; head.add(oct);
    const fc = M.mesh(new THREE.CylinderGeometry(.028, .026, .012, 16), M.mat.steelFace); fc.rotation.z = Math.PI / 2; fc.position.x = .086; head.add(fc);
    const peen = new THREE.Shape(); peen.moveTo(0, -.025); peen.lineTo(.07, -.006); peen.lineTo(.07, .006); peen.lineTo(0, .025);
    const pg = new THREE.ExtrudeGeometry(peen, { depth: .046, bevelEnabled: true, bevelThickness: .003, bevelSize: .003, bevelSegments: 1 }); pg.translate(0, 0, -.023);
    const pm = M.mesh(pg, hm); pm.rotation.y = Math.PI; pm.position.x = -.02; head.add(pm);
    const wedge = M.box(.004, .004, .03, M.mat.ironDark); wedge.position.set(.02, .027, 0); head.add(wedge);
    return g;
  };
  // ---------- furnace (brick hearth + iron hood) ----------
  M.makeFurnace = function () {
    const g = new THREE.Group(), bm = M.mat.brick;
    // hearth table
    const base = M.box(1.6, .78, 1.1, bm); base.position.y = .39; g.add(base);
    const lip = M.box(1.7, .07, 1.2, M.mat.ironDark); lip.position.y = .8; g.add(lip);
    // fire pot
    const pot = M.mesh(new THREE.CylinderGeometry(.36, .3, .14, 24, 1, true), M.mat.ironDark); pot.position.y = .84; g.add(pot);
    // coals (instanced)
    const cg = new THREE.DodecahedronGeometry(.05, 0), inst = new THREE.InstancedMesh(cg, M.mat.coal, 70); const d = new THREE.Object3D();
    for (let i = 0; i < 70; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * .4; d.position.set(Math.cos(a) * r, .86 + Math.random() * .05 + (.4 - r) * .1, Math.sin(a) * r * .9); d.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); d.scale.setScalar(.6 + Math.random() * .9); d.updateMatrix(); inst.setMatrixAt(i, d.matrix); }
    inst.castShadow = false; g.add(inst);
    // back wall bricks
    const back = M.box(1.6, 1.0, .3, bm); back.position.set(0, 1.32, -.4); g.add(back);
    // hood: tapered riveted iron
    const hood = M.mesh(new THREE.CylinderGeometry(.28, .95, 1.0, 4, 1, true), new THREE.MeshStandardMaterial({ map: M.set.iron.map, normalMap: M.set.iron.normalMap, roughnessMap: M.set.iron.roughnessMap, metalness: 1, roughness: 1, side: THREE.DoubleSide, color: 0x6a6460 }));
    hood.rotation.y = Math.PI / 4; hood.position.y = 2.25; hood.scale.z = .78; g.add(hood);
    for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) { const r = M.mesh(new THREE.SphereGeometry(.012, 5, 4), M.mat.ironDark); const a = k * Math.PI / 2 + Math.PI / 4; const y = 1.8 + i * .16, rr = .95 - (y - 1.75) * .67; r.position.set(Math.cos(a) * rr * .72, y, Math.sin(a) * rr * .72 * .78); g.add(r); }
    const pipe = M.cyl(.22, .22, 3.2, M.mat.ironDark, 20); pipe.position.y = 4.3; g.add(pipe);
    // flames
    const fires = new THREE.Group(); fires.position.y = .86; g.add(fires);
    for (let i = 0; i < 5; i++) { const f = M.makeFire(.42 + Math.random() * .16, .5 + Math.random() * .3, .9, null, i * .37); f.position.set((Math.random() - .5) * .35, 0, (Math.random() - .5) * .25); fires.add(f); }
    g.userData.fires = fires;
    // bellows (big, leather)
    const bel = new THREE.Group();
    const bTop = M.mesh(new THREE.CylinderGeometry(.45, .45, .04, 3, 1), M.mat.woodDark); bTop.scale.set(1, 1, .55); bTop.rotation.y = Math.PI / 6; bel.add(bTop);
    const bBot = bTop.clone(); bBot.position.y = -.22; bel.add(bBot);
    const bag = M.mesh(new THREE.CylinderGeometry(.38, .38, .2, 3, 3, true), M.mat.leather); bag.scale.set(1, 1, .5); bag.rotation.y = Math.PI / 6; bag.position.y = -.11; bel.add(bag);
    const noz = M.mesh(new THREE.CylinderGeometry(.03, .05, .5, 10), M.mat.brass); noz.rotation.z = Math.PI / 2; noz.position.set(.6, -.11, 0); bel.add(noz);
    bel.position.set(-1.25, .75, .15); bel.rotation.z = -.08; g.add(bel); g.userData.bellows = bTop; g.userData.bellowsBag = bag;
    // tools on lip
    const tong = M.makeTongs(); tong.position.set(.65, .87, .4); tong.rotation.set(0, .6, Math.PI / 2); g.add(tong);
    g.add(M.blob(2.2, 1.6, .7));
    return g;
  };
  M.makeTongs = function () {
    const g = new THREE.Group();
    [-1, 1].forEach(s => { const l = M.mesh(M.loft([V(0, 0, 0), V(s * .015, .25, 0), V(s * .012, .5, 0), V(s * -.01, .58, 0)], [.008, .008, .009, .012], { seg: 6, rings: 12, up: V(0, 0, 1) }), M.mat.ironDark); g.add(l); });
    return g;
  };
  // ---------- bell ----------
  M.makeBell = function () {
    const g = new THREE.Group();
    const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; const r = .025 + .1 * Math.pow(t, 1.6) + (t > .86 ? (t - .86) * .35 : 0); pts.push([r, .24 - t * .24]); }
    pts.push([.13, -.005]); pts.push([.115, 0]);
    const bell = M.lathe(pts, M.mat.brass, 40); bell.position.y = .3; g.add(bell);
    const clap = M.mesh(new THREE.SphereGeometry(.02, 10, 8), M.mat.ironDark); clap.position.y = .3; g.add(clap);
    const bracket = M.mesh(M.loft([V(-.22, 0, 0), V(-.22, .5, 0), V(-.1, .62, 0), V(0, .58, 0)], [.012, .012, .012, .012], { seg: 6, rings: 20, up: V(0, 0, 1) }), M.mat.ironDark); g.add(bracket);
    const base = M.box(.14, .03, .1, M.mat.ironDark); base.position.set(-.22, .015, 0); g.add(base);
    g.userData.bell = bell; return g;
  };
  // ---------- tribute altar (stone + iron tray) ----------
  M.makeCounter = function () {
    const g = new THREE.Group();
    const body = M.box(2, .86, .8, M.mat.stone); body.position.y = .43; g.add(body);
    const slab = M.box(2.16, .1, .92, M.mat.stone); slab.position.y = .91; g.add(slab);
    const tray = M.box(1.6, .025, .56, M.mat.ironDark); tray.position.y = .97; g.add(tray);
    [[0, .28], [0, -.28]].forEach(([x, z]) => { const r = M.box(1.6, .04, .02, M.mat.brass); r.position.set(x, .985, z); g.add(r); });
    [[.8, 0], [-.8, 0]].forEach(([x]) => { const r = M.box(.02, .04, .58, M.mat.brass); r.position.set(x, .985, 0); g.add(r); });
    // candles
    g.userData.flames = [];
    [[-.95, -.3], [-.85, .3]].forEach(([x, z], i) => { const c = M.cyl(.03, .034, .16 + i * .05, M.mat.candle, 12); c.position.set(x, .96 + (.08 + i * .025), z); g.add(c); const f = M.makeFire(.05, .12, 1.4, 0xffd8a0, i * .5); f.position.set(x, .96 + .16 + i * .05, z); g.add(f); g.userData.flames.push(f); });
    g.add(M.blob(2.6, 1.3, .8));
    g.userData.trayY = .99; return g;
  };
  // ---------- weapon rack ----------
  M.makeRack = function (slots) {
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) { const p = M.box(.06, 2.3, .44, M.mat.woodDark); p.position.set(0, 1.45, -1.32 + i * .44); p.rotation.x = (Math.random() - .5) * .01; g.add(p); }
    [2.42, .45].forEach(y => { const r = M.box(.1, .12, 3.2, M.mat.woodDark); r.position.set(-.06, y, 0); g.add(r); for (let i = 0; i < 12; i++) { const n = M.mesh(new THREE.SphereGeometry(.012, 6, 4), M.mat.ironDark); n.position.set(-.115, y, -1.5 + i * .27); g.add(n); } });
    for (let i = 0; i < slots; i++) { const pp = M.rackSlotPos(i); const hk = M.mesh(M.loft([V(0, 0, 0), V(-.08, 0, 0), V(-.11, .03, 0)], [.008, .008, .007], { seg: 6, rings: 8, up: V(0, 0, 1) }), M.mat.ironDark); hk.position.set(-.03, pp.y + .06, pp.z - .035); g.add(hk); const hk2 = hk.clone(); hk2.position.z = pp.z + .035; g.add(hk2); }
    const plaque = M.box(.04, .2, .8, M.mat.brass); plaque.position.set(-.05, 2.68, 0); g.add(plaque);
    return g;
  };
  const RACK_ORDER = [4, 5, 3, 6, 2, 7, 1, 8, 0, 9];
  M.rackSlotPos = function (i) { return new THREE.Vector3(-.12, 2.18, -1.26 + RACK_ORDER[i % 10] * .28); };
  // ---------- merchant (hooded ash-spirit) ----------
  M.makeMerchant = function () {
    const g = new THREE.Group();
    // robe: lathe with folds
    const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([.2 + .38 * Math.pow(1 - t, 1.5), t * 1.6]); }
    const rg = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 48);
    const pa = rg.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i), y = pa.getY(i), a = Math.atan2(z, x), k = 1 + Math.sin(a * 9 + y * 1.5) * .06 * (1 - y / 1.7); pa.setX(i, x * k); pa.setZ(i, z * k); }
    rg.computeVertexNormals();
    const robe = M.mesh(rg, M.mat.cloth); g.add(robe);
    // shoulders + hood
    const sh = M.mesh(new THREE.SphereGeometry(.3, 24, 16, 0, TAU, 0, Math.PI / 2), M.mat.cloth); sh.scale.set(1.15, .55, .8); sh.position.y = 1.55; g.add(sh);
    const hg = new THREE.SphereGeometry(.24, 32, 24, 0, TAU, 0, Math.PI * .72); const hp = hg.attributes.position;
    for (let i = 0; i < hp.count; i++) { const y = hp.getY(i), z = hp.getZ(i); if (z > 0 && y < .12) hp.setZ(i, z * .55); if (y > .1) hp.setZ(i, z - (y - .1) * .5); }
    hg.computeVertexNormals();
    const hood = M.mesh(hg, M.mat.cloth); hood.position.set(0, 1.8, 0); hood.rotation.x = -.15; g.add(hood);
    const face = M.mesh(new THREE.SphereGeometry(.17, 16, 12), M.mat.black, false, false); face.position.set(0, 1.77, .04); g.add(face);
    const em = new THREE.MeshBasicMaterial({ color: 0xbff6ff });
    [-.055, .055].forEach(x => { const e = M.mesh(new THREE.SphereGeometry(.012, 8, 6), em, false, false); e.position.set(x, 1.79, .2); e.scale.x = 1.6; g.add(e); });
    // arm + gaunt hand holding lantern
    const arm = M.mesh(M.loft([V(.28, 1.5, 0), V(.38, 1.2, .1), V(.4, 1.02, .28)], [.09, .1, .12], { seg: 12, rings: 12, up: V(0, 0, 1) }), M.mat.cloth); g.add(arm);
    const hand = M.mesh(new THREE.SphereGeometry(.035, 8, 6), new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: .8 })); hand.position.set(.4, .98, .32); g.add(hand);
    const lan = new THREE.Group(); lan.position.set(.4, .82, .34); g.add(lan);
    const frame = M.mesh(new THREE.CylinderGeometry(.06, .07, .17, 6, 1, true), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: .8, roughness: .5, wireframe: true })); lan.add(frame);
    const glassL = M.mesh(new THREE.CylinderGeometry(.055, .065, .16, 6), M.mat.glass, false); lan.add(glassL);
    const capL = M.mesh(new THREE.ConeGeometry(.08, .07, 6), M.mat.ironDark); capL.position.y = .12; lan.add(capL);
    const fl = M.makeFire(.06, .12, 2.2, 0x7fe0ff, .3); fl.position.y = -.07; lan.add(fl);
    const light = new THREE.PointLight(0x8fdcff, 1.6, 5, 2); lan.add(light);
    // wares table
    const table = M.box(1.3, .06, .6, M.mat.woodDark); table.position.set(0, .85, .8); g.add(table);
    [[-.6, -.25], [.6, -.25], [-.6, .25], [.6, .25]].forEach(([x, z]) => { const l = M.box(.06, .85, .06, M.mat.woodDark); l.position.set(x, .42, .8 + z); g.add(l); });
    const cloth = M.box(1.34, .012, .64, new THREE.MeshStandardMaterial({ color: 0x1e0a0c, roughness: 1, normalMap: M.set.leather.normalMap })); cloth.position.set(0, .885, .8); g.add(cloth);
    for (let i = 0; i < 5; i++) { const b = M.lathe([[0, 0], [.035, 0], [.04, .05], [.03, .1], [.012, .13], [.012, .16], [0, .16]], new THREE.MeshStandardMaterial({ color: [0x1a3a2a, 0x3a1a1a, 0x1a2a3a, 0x2a2418, 0x301a3a][i], roughness: .1, metalness: .2, transparent: true, opacity: .8 }), 16); b.position.set(-.5 + i * .22, .89, .65 + (i % 2) * .2); g.add(b); }
    const scroll = M.cyl(.03, .03, .35, new THREE.MeshStandardMaterial({ color: 0xb8a580, roughness: .9 }), 12); scroll.rotation.z = Math.PI / 2; scroll.position.set(.3, .92, .95); g.add(scroll);
    g.add(M.blob(1.8, 1.8, .8));
    g.userData.eyes = em; g.userData.lantern = lan; g.userData.light = light; g.userData.table = table;
    return g;
  };
  // ---------- relic pedestal ----------
  M.makeAltar = function () {
    const g = new THREE.Group();
    const base = M.lathe([[0, 0], [.5, 0], [.5, .12], [.36, .2], [.28, .25], [.26, .95], [.36, 1.02], [.44, 1.1], [.44, 1.16], [0, 1.16]], M.mat.stone, 10); g.add(base);
    const rune = M.mesh(new THREE.TorusGeometry(.4, .008, 6, 60), new THREE.MeshBasicMaterial({ color: 0xff7a2a, toneMapped: false })); rune.rotation.x = Math.PI / 2; rune.position.y = 1.165; g.add(rune);
    g.add(M.blob(1.2, 1.2, .8));
    g.userData.rune = rune; return g;
  };
  M.labelTex = function (text, r) {
    const key = 'lbl' + text + r; M._lbl = M._lbl || {}; if (M._lbl[key]) return M._lbl[key];
    const c = document.createElement('canvas'); c.width = 256; c.height = 56; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 56); gr.addColorStop(0, '#5a4628'); gr.addColorStop(1, '#2e2414'); g.fillStyle = gr; g.fillRect(0, 0, 256, 56);
    g.strokeStyle = 'rgba(255,220,150,.45)'; g.lineWidth = 2; g.strokeRect(4, 4, 248, 48);
    g.fillStyle = ['#8a7a66', '#e8d6b0', '#b8d4f0', '#ffd27a'][r || 0]; g.font = '600 22px "Nanum Myeongjo", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 29);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return (M._lbl[key] = t);
  };
  M.makeGlove = function () {
    const g = new THREE.Group(), lm = M.mat.leather;
    const palm = M.mesh(new THREE.SphereGeometry(.05, 14, 10), lm); palm.scale.set(1.1, 1.25, .9); g.add(palm);
    for (let i = 0; i < 4; i++) { const f = M.mesh(new THREE.CylinderGeometry(.013, .014, .05, 8), lm); f.rotation.x = Math.PI / 2; f.position.set(-.012, .03 - i * .021, .045); g.add(f); const k = M.mesh(new THREE.SphereGeometry(.014, 8, 6), lm); k.position.set(-.012, .03 - i * .021, .07); g.add(k); }
    const th = M.mesh(new THREE.CylinderGeometry(.013, .015, .05, 8), lm); th.rotation.set(.4, 0, .9); th.position.set(.035, .03, .03); g.add(th);
    const cuff = M.mesh(new THREE.CylinderGeometry(.055, .065, .1, 14), M.mat.leather); cuff.position.y = -.09; cuff.rotation.x = .25; g.add(cuff);
    const sleeve = M.mesh(new THREE.CylinderGeometry(.065, .08, .35, 14), M.mat.cloth); sleeve.position.set(0, -.3, .05); sleeve.rotation.x = .35; g.add(sleeve);
    return g;
  };
  M.makeCabinet = function () {
    const g = new THREE.Group(), wd = M.mat.woodDark, W = 2.3, H = 2.15, D = .5;
    const velvet = new THREE.MeshStandardMaterial({ color: 0x2a0608, roughness: 1, normalMap: M.set.leather.normalMap, normalScale: new THREE.Vector2(.4, .4) });
    const back = M.box(W - .1, H - .3, .03, velvet); back.position.set(0, H / 2 + .1, -D / 2 + .04); g.add(back);
    [[-W / 2, 0], [W / 2, 0]].forEach(([x]) => { const p = M.box(.1, H, D, wd); p.position.set(x, H / 2, 0); g.add(p); });
    const top = M.box(W + .16, .1, D + .1, wd); top.position.set(0, H + .02, .02); g.add(top);
    const crown = M.box(W + .24, .06, D + .16, wd); crown.position.set(0, H + .1, .03); g.add(crown);
    const base = M.box(W, .3, D, wd); base.position.set(0, .15, 0); g.add(base);
    [.66, 1.25].forEach(y => { const sh = M.box(W - .1, .04, D - .06, wd); sh.position.set(0, y, 0); g.add(sh); });
    const glass = new THREE.MeshStandardMaterial({ color: 0x8aa0a8, roughness: .02, metalness: .9, transparent: true, opacity: .14, depthWrite: false });
    const gl = M.mesh(new THREE.PlaneGeometry(W - .1, H - .3), glass, false, false); gl.position.set(0, H / 2 + .1, D / 2 - .01); gl.renderOrder = 3; g.add(gl);
    [-W / 6, W / 6].forEach(x => { const m = M.box(.03, H - .3, .03, M.mat.brass); m.position.set(x, H / 2 + .1, D / 2); g.add(m); });
    const plq = new THREE.Mesh(new THREE.PlaneGeometry(.9, .18), new THREE.MeshStandardMaterial({ map: M.labelTex('유물 전시장', 1), metalness: .6, roughness: .4 })); plq.position.set(0, H - .05, D / 2 + .065); g.add(plq);
    const slots = [];
    [[1.68, -1], [1.68, 0], [1.68, 1], [.69, -1], [.69, 0], [.69, 1]].forEach(([y, c]) => {
      const sl = new THREE.Group(); sl.position.set(c * .72, y, .02); g.add(sl);
      const ped = M.lathe([[0, 0], [.11, 0], [.11, .02], [.07, .05], [.05, .1], [.08, .12], [.08, .14], [0, .14]], M.mat.brass, 20); sl.add(ped);
      const lb = new THREE.Mesh(new THREE.PlaneGeometry(.44, .095), new THREE.MeshStandardMaterial({ map: M.labelTex('— 비어 있음 —', 0), metalness: .5, roughness: .45 })); lb.position.set(0, -.03, .2); lb.rotation.x = -.5; sl.add(lb);
      const gl2 = new THREE.PointLight(0xffd8a0, .1, .9, 2); gl2.position.set(0, .5, .12); sl.add(gl2);
      sl.userData.label = lb; sl.userData.glow = gl2; slots.push(sl);
    });
    g.add(M.blob(2.8, 1.1, .7)); g.userData.slots = slots; return g;
  };
  M.makeRelicIcon = function (tag) {
    const g = new THREE.Group();
    const gold = M.mat.gold, brass = M.mat.brass, iron = M.mat.iron, ivory = M.mat.ivory, leather = M.mat.leather, wood = M.mat.wood;
    const gem = (c, e) => new THREE.MeshStandardMaterial({ color: c, emissive: e || c, emissiveIntensity: .35, roughness: .05, metalness: .1, transparent: true, opacity: .92 });
    const add = (m, x, y, z) => { m.position.set(x || 0, y || 0, z || 0); g.add(m); return m; };
    switch (tag) {
      case 'glove': { const pm = add(M.mesh(new THREE.SphereGeometry(.045, 14, 10), leather)); pm.scale.set(1, 1.3, .55); for (let i = 0; i < 4; i++) { const f = add(M.mesh(new THREE.CylinderGeometry(.009, .01, .07, 8), leather), -.03 + i * .02, .085 + (i === 1 || i === 2 ? .008 : 0), 0); } add(M.mesh(new THREE.CylinderGeometry(.01, .011, .055, 8), leather), .05, .02, 0).rotation.z = -.9; add(M.mesh(new THREE.CylinderGeometry(.05, .055, .05, 14), M.mat.cloth), 0, -.07, 0); break; }
      case 'stone': { const st = add(M.box(.16, .045, .055, new THREE.MeshStandardMaterial({ color: 0x5a1a14, roughness: .55, normalMap: M.set.ashlar.normalMap }), 2)); st.rotation.y = .3; add(M.box(.05, .05, .06, leather), .03, 0, 0).rotation.y = .3; break; }
      case 'bellows': { [1, -1].forEach(sg => { const b = add(M.mesh(new THREE.CylinderGeometry(.07, .07, .008, 3), wood), 0, sg * .025, 0); b.scale.z = .55; }); add(M.mesh(new THREE.CylinderGeometry(.06, .06, .04, 3, 1, true), leather)).scale.z = .5; add(M.mesh(new THREE.CylinderGeometry(.008, .014, .07, 8), brass), .07, 0, 0).rotation.z = Math.PI / 2; g.rotation.x = .3; break; }
      case 'tooth': { const t = add(M.mesh(M.loft([V(0, .05, 0), V(.005, -.01, 0), V(-.005, -.06, 0)], [.022, .016, .002], { seg: 10, rings: 10, up: V(0, 0, 1) }), gold)); for (let i = 0; i < 7; i++) { const l = add(M.mesh(new THREE.TorusGeometry(.01, .0025, 6, 10), gold), Math.sin(i * .5) * .05, .07 + Math.cos(i * .5) * .02, 0); l.rotation.y = i % 2 ? Math.PI / 2 : 0; } break; }
      case 'seal': { add(M.lathe([[0, 0], [.03, 0], [.032, .01], [.02, .03], [.016, .07], [.028, .1], [0, .11]], wood, 16), 0, .02, 0); add(M.mesh(new THREE.CylinderGeometry(.035, .035, .02, 20), brass), 0, .01, 0); add(M.mesh(new THREE.CylinderGeometry(.05, .052, .008, 20), new THREE.MeshStandardMaterial({ color: 0x6a0a0a, roughness: .35 })), .07, -.005, .02); break; }
      case 'cloak': { const cg = new THREE.ConeGeometry(.07, .16, 24, 4, true); const cp = cg.attributes.position; for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), z = cp.getZ(i), a = Math.atan2(z, x), k = 1 + Math.sin(a * 7) * .12 * (.5 - cp.getY(i) / .16); cp.setX(i, x * k); cp.setZ(i, z * k); } cg.computeVertexNormals(); add(M.mesh(cg, new THREE.MeshStandardMaterial({ color: 0x3a0c0a, roughness: .7, side: THREE.DoubleSide, normalMap: M.set.scales.normalMap }))); add(M.mesh(new THREE.TorusGeometry(.012, .004, 6, 12), gold), 0, .065, .02); break; }
      case 'shoe': { const sh = add(M.mesh(new THREE.TorusGeometry(.06, .014, 10, 28, Math.PI * 1.35), iron)); sh.rotation.z = -Math.PI * .17 + Math.PI / 2; for (let i = 0; i < 6; i++) { const a = -Math.PI * .17 + Math.PI / 2 + (i + .5) / 6 * Math.PI * 1.35; add(M.mesh(new THREE.SphereGeometry(.004, 6, 4), M.mat.black), Math.cos(a) * .06, Math.sin(a) * .06, .013); } break; }
      case 'heart': { const m = gem(0x8a0810, 0x600408); [-1, 1].forEach(sg => add(M.mesh(new THREE.SphereGeometry(.035, 16, 12), m), sg * .025, .02, 0)); const c = add(M.mesh(new THREE.ConeGeometry(.058, .07, 16), m), 0, -.03, 0); c.rotation.z = Math.PI; for (let i = 0; i < 3; i++) { const r = add(M.mesh(new THREE.TorusGeometry(.065, .003, 6, 32), gold)); r.rotation.y = i * Math.PI / 3; } break; }
      case 'tear': { const t = add(M.mesh(new THREE.SphereGeometry(.04, 20, 16), gem(0x5fb0d8, 0x0a3048))); t.scale.y = 1.4; const tp = add(M.mesh(new THREE.ConeGeometry(.028, .05, 16), t.material), 0, .06, 0); for (let i = 0; i < 4; i++) { const cl = add(M.mesh(new THREE.ConeGeometry(.006, .05, 6), M.mat.steelFace), Math.cos(i * 1.57) * .038, -.035, Math.sin(i * 1.57) * .038); cl.rotation.set(Math.sin(i * 1.57) * .6, 0, -Math.cos(i * 1.57) * .6); } add(M.mesh(new THREE.CylinderGeometry(.02, .03, .02, 12), M.mat.steelFace), 0, -.06, 0); break; }
      case 'dice': { const d = add(M.box(.09, .09, .09, ivory, 3)); d.rotation.set(.5, .6, .1); const pip = new THREE.SphereGeometry(.008, 6, 4), pm = M.mat.black; [[0, 0, .046], [.022, .022, .046], [-.022, -.022, .046], [.046, .02, 0], [.046, -.02, 0], [0, .046, 0]].forEach(([x, y, z]) => d.add(Object.assign(M.mesh(pip, pm, false), { position: V(x, y, z) }))); break; }
      case 'star': { const pg = add(M.lathe([[0, -.06], [.05, -.055], [.06, -.02], [.05, .03], [.02, .045], [.03, .06], [0, .06]], new THREE.MeshStandardMaterial({ color: 0x2a2040, roughness: .9, normalMap: M.set.leather.normalMap }), 18)); add(M.mesh(new THREE.TorusGeometry(.022, .004, 6, 14), gold), 0, .045, 0).rotation.x = Math.PI / 2; const sm = new THREE.MeshBasicMaterial({ color: 0xcfe0ff, toneMapped: false }); for (let i = 0; i < 6; i++) add(M.mesh(new THREE.OctahedronGeometry(.008, 0), sm, false), (Math.random() - .5) * .08, .07 + Math.random() * .05, (Math.random() - .5) * .08); break; }
      case 'bell': { add(M.lathe([[.006, .08], [.02, .075], [.045, .02], [.05, 0], [0, 0]], brass, 20)); add(M.mesh(new THREE.CylinderGeometry(.008, .01, .06, 8), wood), 0, .11, 0); break; }
      case 'anvil': { const sh = new THREE.Shape(); sh.moveTo(-.09, .03); sh.lineTo(.06, .03); sh.lineTo(.06, .0); sh.lineTo(.03, -.01); sh.lineTo(.03, -.04); sh.lineTo(-.03, -.04); sh.lineTo(-.03, -.01); sh.quadraticCurveTo(-.06, .0, -.09, .03); add(M.mesh(new THREE.ExtrudeGeometry(sh, { depth: .04, bevelEnabled: true, bevelSize: .003, bevelThickness: .003, bevelSegments: 1 }), iron), 0, 0, -.02); break; }
      case 'feather': { const fm = new THREE.MeshStandardMaterial({ color: 0x9a2a08, emissive: 0xc04010, emissiveIntensity: .6, side: THREE.DoubleSide, roughness: .6 }); add(M.mesh(M.loft([V(0, -.09, 0), V(0, .02, 0), V(.01, .1, 0)], [.003, .003, .001], { seg: 6, rings: 10 }), ivory)); [-1, 1].forEach(sg => { const vg = M.loft([V(sg * .002, -.05, 0), V(sg * .02, .0, 0), V(sg * .015, .06, 0), V(.008, .1, 0)], [[.002, .016], [.002, .024], [.002, .018], [.001, .002]], { seg: 6, rings: 14, up: V(0, 0, 1) }); add(M.mesh(vg, fm)); }); g.rotation.z = .4; break; }
      case 'pot': { add(M.lathe([[0, 0], [.05, .005], [.065, .04], [.06, .08], [.064, .085], [.05, .082], [0, .03]], new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: .6, metalness: .3, side: THREE.DoubleSide }), 20), 0, -.04, 0); add(M.mesh(new THREE.CircleGeometry(.05, 20), new THREE.MeshBasicMaterial({ color: 0xffa030, toneMapped: false })), 0, .035, 0).rotation.x = -Math.PI / 2; add(M.mesh(new THREE.TorusGeometry(.04, .004, 6, 16, Math.PI), iron), 0, .045, 0); break; }
      case 'scale': { add(M.cyl(.004, .005, .14, brass, 8), 0, 0, 0); add(M.box(.16, .006, .006, brass), 0, .07, 0); [-1, 1].forEach(sg => { add(M.lathe([[0, 0], [.03, .002], [.035, .01], [0, .006]], brass, 16), sg * .075, -.01, 0); for (let k = 0; k < 3; k++) { const c = add(M.cyl(.0012, .0012, .08, brass, 4), sg * .075 + Math.cos(k * 2.1) * .02, .03, Math.sin(k * 2.1) * .02); c.rotation.z = Math.cos(k * 2.1) * -.25; } }); add(M.lathe([[0, 0], [.03, 0], [.02, .01], [0, .012]], brass, 16), 0, -.07, 0); break; }
      case 'shield': { const sh = new THREE.Shape(); sh.moveTo(-.055, .06); sh.lineTo(.055, .06); sh.lineTo(.055, .0); sh.quadraticCurveTo(.05, -.05, 0, -.08); sh.quadraticCurveTo(-.05, -.05, -.055, 0); sh.lineTo(-.055, .06); add(M.mesh(new THREE.ExtrudeGeometry(sh, { depth: .01, bevelEnabled: true, bevelSize: .006, bevelThickness: .004, bevelSegments: 2 }), iron)); add(M.mesh(new THREE.SphereGeometry(.018, 12, 8), gold), 0, .005, .012).scale.z = .6; break; }
      case 'mirror': { add(M.mesh(new THREE.CircleGeometry(.05, 28), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .02 })), 0, .03, .003); add(M.mesh(new THREE.TorusGeometry(.053, .008, 8, 32), gold), 0, .03, 0); add(M.cyl(.007, .009, .07, gold, 8), 0, -.055, 0); break; }
      case 'hammer': { const hd = add(M.box(.12, .055, .055, iron, 4)); hd.position.y = .04; add(M.box(.02, .06, .06, gold, 4), .065, .04, 0); add(M.box(.02, .06, .06, gold, 4), -.065, .04, 0); add(M.cyl(.008, .01, .12, wood, 8), 0, -.03, 0); add(M.mesh(new THREE.PlaneGeometry(.07, .03), new THREE.MeshBasicMaterial({ map: X.runes(), color: 0xff8a3a, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false })), 0, .04, .029); break; }
      case 'chain': { for (let i = 0; i < 3; i++) { const l = add(M.mesh(new THREE.TorusGeometry(.028, .007, 8, 18), gold), (i - 1) * .04, 0, 0); l.scale.y = 1.4; l.rotation.set(0, i % 2 ? Math.PI / 2 : 0, Math.PI / 2); } break; }
      case 'hourglass': { const glass = new THREE.MeshStandardMaterial({ color: 0xc0d8e0, transparent: true, opacity: .3, roughness: .02, metalness: .2 }); add(M.lathe([[0, -.06], [.035, -.055], [.032, -.03], [.006, 0], [.032, .03], [.035, .055], [0, .06]], glass, 20)); const sand = new THREE.MeshBasicMaterial({ color: 0xff8030, toneMapped: false }); add(M.mesh(new THREE.ConeGeometry(.026, .03, 16), sand), 0, -.045, 0); add(M.mesh(new THREE.ConeGeometry(.02, .02, 16), sand), 0, .035, 0).rotation.z = Math.PI; [.065, -.065].forEach(y => add(M.cyl(.045, .045, .008, wood, 16), 0, y, 0)); for (let k = 0; k < 3; k++) add(M.cyl(.004, .004, .13, wood, 6), Math.cos(k * 2.1) * .04, 0, Math.sin(k * 2.1) * .04); break; }
      case 'anvilstone': { add(M.box(.1, .07, .07, new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: .5, normalMap: M.set.cave.normalMap }), 3)); const rm = new THREE.MeshBasicMaterial({ map: X.runes(), color: 0x6fd0ff, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false }); [.036, -.036].forEach(z => add(M.mesh(new THREE.PlaneGeometry(.08, .05), rm), 0, 0, z).rotation.y = z < 0 ? Math.PI : 0); break; }
      case 'crown': { add(M.mesh(new THREE.CylinderGeometry(.05, .05, .03, 24, 1, true), gold)); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(M.mesh(new THREE.ConeGeometry(.012, .04, 6), gold), Math.cos(a) * .05, .034, Math.sin(a) * .05); add(M.mesh(new THREE.OctahedronGeometry(.007, 0), gem(i % 2 ? 0xa01010 : 0x1040a0)), Math.cos(a + .52) * .051, 0, Math.sin(a + .52) * .051); } break; }
      case 'eye': { const e = add(M.mesh(new THREE.SphereGeometry(.035, 20, 16), M.mat.eye), 0, .02, 0); e.rotation.y = Math.PI / 2; for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const c = add(M.mesh(M.loft([V(Math.cos(a) * .03, -.04, Math.sin(a) * .03), V(Math.cos(a) * .045, 0, Math.sin(a) * .045), V(Math.cos(a) * .025, .04, Math.sin(a) * .025)], [.008, .006, .001], { seg: 6, rings: 8 }), M.mat.horn)); } break; }
      default: add(M.mesh(new THREE.TorusKnotGeometry(.04, .012, 48, 6), brass));
    }
    return g;
  };

  // ---------- swords ----------
  const BLADE_TEX = { iron: ['rust', 'steel', 'damascus'], obsidian: ['obsidian'], frost: ['frost'], storm: ['storm'], bone: ['bone'], star: ['meteor'] };
  const bladeCache = {};
  // realistic blade: lenticular/diamond section with fuller, distal taper
  function bladeGeo(type, tier) {
    const key = type + tier; if (bladeCache[key]) return bladeCache[key];
    const L = .74 + tier * .068 + (type === 'star' ? .04 : 0), W0 = ((type === 'star' ? .062 : type === 'bone' ? .058 : type === 'frost' ? .038 : .048) + tier * .0028) * (tier >= 8 ? 1.18 : 1), T0 = (type === 'obsidian' ? .012 : .0075) * (1 + tier * .03);
    const NS = 56, pos = [], uvs = [], idx = [];
    const prof = s => { // returns [halfWidth, thick, centerX]
      let w = W0 * (1 - s * .38); if (s > .82) w *= Math.sqrt(Math.max(0, (1 - s) / .18));
      if (type === 'obsidian') w *= 1 - .18 * Math.abs(Math.sin(s * 34)) * (s < .9 ? 1 : 0);
      let cx = 0;
      if (type === 'storm') cx = Math.sin(s * Math.PI * 7) * W0 * .18 * (s < .85 ? 1 : (1 - s) / .15);
      if (type === 'bone') cx = Math.pow(s, 2) * .09;
      return [w / 2, T0 * (1 - s * .5), cx];
    };
    // cross-section points (x across, y thickness) for top side; bottom mirrored. fuller in first 70%
    const sec = (s, w, t) => { const ful = s < .7 ? sm(.7, .62, s) * sm(0, .06, s) : 0; return [[-w, 0], [-w * .55, t * .7], [-w * .18, t * (1 - ful * .55)], [0, t * (1 - ful * .7)], [w * .18, t * (1 - ful * .55)], [w * .55, t * .7], [w, 0]]; };
    // build facets with duplicated verts for crisp bevels
    for (const side of [1, -1]) {
      for (let f = 0; f < 6; f++) {
        const base = pos.length / 3;
        for (let i = 0; i <= NS; i++) {
          const s = i / NS, [w, t, cx] = prof(s), p = sec(s, w, t);
          const serr = type === 'bone' ? (Math.abs(Math.sin(s * 40)) * .012 * (s < .85 ? 1 : 0)) : 0;
          for (const k of [f, f + 1]) {
            let x = p[k][0], y = p[k][1] * side;
            if (type === 'bone' && k === 6) x += serr;
            pos.push(x + cx, s * L, y); uvs.push((x / (W0 * .5) + 1) / 2, s);
          }
        }
        for (let i = 0; i < NS; i++) { const a = base + i * 2, b = a + 2; if (side > 0) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b, a + 1, a + 1, b, b + 1); }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx); g.computeVertexNormals();
    g.userData.L = L; g.userData.W = W0;
    return (bladeCache[key] = g);
  }
  function sm(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  M.makeSword = function (type, lv) {
    const T = ET.TYPES[type] || ET.TYPES.iron, tier = ET.tierOf(lv), fin = lv >= ET.FINAL_LV;
    const g = new THREE.Group(), geo = bladeGeo(type, tier), L = geo.userData.L, W = geo.userData.W;
    const kinds = BLADE_TEX[type]; const kind = type === 'iron' ? (tier === 0 ? 'rust' : tier < 3 ? 'steel' : 'damascus') : kinds[0];
    const addM = (m, glowMat) => { if (glowMat) m.userData.lin = 1; return m; };
    const set = X.lib.blade(kind), glow = new THREE.Color(T.glow).convertSRGBToLinear();
    const bm = new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, metalnessMap: set.metalnessMap || null, metalness: kind === 'bone' ? 0 : 1, roughness: 1, emissive: new THREE.Color(0, 0, 0), envMapIntensity: 1.3 });
    if (set.emissiveMap) { bm.emissiveMap = set.emissiveMap; }
    if (kind === 'frost') { bm.transparent = true; bm.opacity = .93; }
    const blade = M.mesh(geo, bm); g.add(blade);
    // etched runes (tier>=2) as a decal on both faces
    if (tier >= 2) {
      const rm = new THREE.MeshBasicMaterial({ map: X.runes(), color: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .15 + tier * .1 + (fin ? .25 : 0), toneMapped: false }); rm.userData.lin = 1;
      [1, -1].forEach(sd => { const pl = new THREE.Mesh(new THREE.PlaneGeometry(W * .3, L * .55), rm); pl.position.set(0, L * .36, sd * .0062); if (sd < 0) pl.rotation.y = Math.PI; g.add(pl); });
      g.userData.rune = rm;
    }
    // guard: lofted crossguard, quillons curve toward blade at higher tiers
    const gm = type === 'bone' ? M.mat.ivory : tier >= 3 ? M.mat.gold : M.mat.ironDark;
    const gw = W * 1.7 + .07 + tier * .012, curl = tier >= 2 ? .025 + tier * .006 : .006;
    const guard = M.mesh(M.loft([V(-gw, curl, 0), V(-gw * .5, .004, 0), V(0, 0, 0), V(gw * .5, .004, 0), V(gw, curl, 0)], [[.009, .007], [.011, .009], [.016, .013], [.011, .009], [.009, .007]], { seg: 10, rings: 24, up: V(0, 0, 1) }), gm);
    g.add(guard);
    [-gw, gw].forEach(x => { const k = M.mesh(new THREE.SphereGeometry(.012 + tier * .001, 10, 8), gm); k.position.set(x, curl, 0); g.add(k); });
    if (type === 'frost') for (let i = 0; i < 3 + tier; i++) { const c = M.mesh(new THREE.OctahedronGeometry(.008 + Math.random() * .01, 0), new THREE.MeshStandardMaterial({ color: 0xcfefff, emissive: 0x2a80b0, emissiveIntensity: .4, roughness: .05, transparent: true, opacity: .85 })); c.position.set((Math.random() - .5) * gw * 1.6, .01, (Math.random() - .5) * .02); c.scale.y = 2; g.add(c); }
    // ricasso block + gem
    const esc = M.box(.03, .022, .022, gm); esc.position.y = .004; g.add(esc);
    if (tier >= 2) { const gmat = new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: .5 + tier * .1, roughness: .05, metalness: .1 }); gmat.userData.lin = 1; const gem = M.mesh(new THREE.OctahedronGeometry(.011, 0), gmat); gem.position.set(0, .004, .013); gem.scale.z = .6; g.add(gem); const gem2 = gem.clone(); gem2.position.z = -.013; g.add(gem2); }
    // grip: barrel loft with leather wrap, risers
    const gl = .16 + tier * .008;
    const grip = M.mesh(M.loft([V(0, -.012, 0), V(0, -gl * .5, 0), V(0, -gl, 0)], [[.0125, .011], [.0145, .0125], [.0125, .011]], { seg: 14, rings: 16, up: V(0, 0, 1), uvScaleV: .05 }), tier >= 4 ? M.mat.gold : M.mat.leather); g.add(grip);
    if (tier >= 1) for (let i = 1; i < 4; i++) { const r = M.mesh(new THREE.TorusGeometry(.0145, .0022, 6, 18), gm); r.rotation.x = Math.PI / 2; r.position.y = -.012 - gl * i / 4; g.add(r); }
    // pommel: wheel
    const pom = M.lathe([[0, -.02], [.014, -.02], [.026, -.012], [.028, 0], [.026, .012], [.014, .02], [0, .02]], gm, 24); pom.rotation.x = Math.PI / 2; pom.position.y = -.012 - gl - .022; g.add(pom);
    const peen = M.cyl(.006, .008, .012, gm, 8); peen.position.y = -.012 - gl - .046; g.add(peen);
    if (tier >= 3) { const pmat = new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: .7, roughness: .05 }); pmat.userData.lin = 1; const pg = M.mesh(new THREE.SphereGeometry(.011, 12, 8), pmat); pg.position.set(0, -.012 - gl - .022, .016); pg.scale.z = .5; g.add(pg); }
    // ---- evolution features by stage ----
    const additive = (op) => { const m = new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }); m.userData.lin = 1; return m; };
    if (tier >= 5) { const rim = new THREE.Mesh(geo, additive(.18 + (tier - 5) * .03)); rim.scale.set(1.12, 1.005, 2.2); g.add(rim); g.userData.rim = rim; }
    if (tier >= 6) { const cm = new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: .8, roughness: .05, metalness: .2, transparent: true, opacity: .9 }); cm.userData.lin = 1; const n = 4 + tier; for (let i = 0; i < n; i++) { const t2 = .12 + i / n * .7; for (const sd of [-1, 1]) { const c = M.mesh(new THREE.OctahedronGeometry(.008 + tier * .0007, 0), cm, false); c.scale.set(1, 2.2, .6); c.position.set(sd * W * (.5 - t2 * .19) * 1.05, t2 * L, 0); c.rotation.z = sd * -.6; g.add(c); } } }
    if (tier >= 7) { const ring = new THREE.Group(); ring.position.y = L * .5; const tm2 = additive(.55); for (let k = 0; k < 2; k++) { const tr = new THREE.Mesh(new THREE.TorusGeometry(W * (1.6 + k * .5), .0025, 6, 48), tm2); tr.rotation.x = Math.PI / 2 + k * .4; ring.add(tr); } g.add(ring); g.userData.ring = ring; }
    if (tier >= 8) { const fl = new THREE.Group(); for (let k = 0; k < 2; k++) { const f = M.makeFire(W * 3.4, L * 1.05, .55 + (tier - 8) * .12, T.glow, k * .5 + tier); f.userData.billboard = false; f.rotation.y = k * Math.PI / 2; f.material.uniforms.uTint.value.copy(glow); fl.add(f); } fl.position.y = 0; g.add(fl); }
    if (tier >= 10) { const sh = new THREE.Mesh(geo, additive(.12)); sh.scale.set(1.5, 1.14, 3); sh.position.y = -.01; g.add(sh); g.userData.shell = sh; }
    if (tier >= 11) { const wm = new THREE.MeshStandardMaterial({ color: tier >= 12 ? 0xffffff : 0xffd890, metalness: .9, roughness: .15, emissive: glow, emissiveIntensity: .5 }); wm.userData.lin = 1; for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) { const len = .12 + k * .05; const w2 = M.mesh(M.loft([V(sd * gw * .6, .01, 0), V(sd * (gw * .8 + k * .03), len * .5, -.01), V(sd * (gw * .5 + k * .05), len, 0)], [[.012, .003], [.009, .002], [.001, .001]], { seg: 6, rings: 10, up: V(0, 0, 1) }), wm); w2.rotation.z = sd * k * .12; g.add(w2); } }
    if (tier >= 12) { const halo = new THREE.Mesh(new THREE.TorusGeometry(gw * .9, .004, 8, 64), additive(.8)); halo.position.y = -.05; g.add(halo); g.userData.halo = halo; const pl = new THREE.PointLight(glow, .8, 2.5, 2); pl.position.y = L * .5; g.add(pl); }
    // final form: drifting embers around blade
    if (fin) {
      const orb = new THREE.Group(); const om = new THREE.MeshBasicMaterial({ color: glow, toneMapped: false }); om.userData.lin = 1;
      for (let i = 0; i < 7; i++) { const sh = M.mesh(new THREE.OctahedronGeometry(.006, 0), om, false, false); const a = i / 7 * TAU; sh.position.set(Math.cos(a) * W * 1.4, L * (.15 + i * .1), Math.sin(a) * W * 1.4); orb.add(sh); }
      g.add(orb); g.userData.orb = orb;
    }
    M.lin(g); g.userData.bladeMat = bm; g.userData.len = L; g.userData.glow = glow; g.userData.tier = tier; g.userData.fin = fin;
    g.userData.baseEm = set.emissiveMap ? .5 + tier * .12 + (fin ? .5 : 0) : 0;
    M.setHeat(g, 0);
    return g;
  };
  // blackbody-ish heat color on the blade
  const HEAT = [0x000000, 0x2a0400, 0x7a1602, 0xd04406, 0xff8424].map(c => new THREE.Color(c).convertSRGBToLinear().multiplyScalar(1.4));
  M.setHeat = function (sw3, heat) {
    const bm = sw3.userData.bladeMat; if (!bm) return;
    const h = Math.max(0, Math.min(100, heat || 0)) / 100 * (HEAT.length - 1), i = Math.min(HEAT.length - 2, Math.floor(h)), f = h - i;
    const hc = HEAT[i].clone().lerp(HEAT[i + 1], f);
    if (bm.emissiveMap) { bm.emissive.copy(sw3.userData.glow).multiplyScalar(sw3.userData.baseEm).add(hc); }
    else bm.emissive.copy(hc).add(sw3.userData.glow.clone().multiplyScalar(sw3.userData.tier * .02 + (sw3.userData.fin ? .08 : 0)));
    bm.emissiveIntensity = 1;
  };

  // ---------- dragon (skinned, realistic) ----------
  const gauss = (x, w) => Math.exp(-(x * x) / (w * w));
  const SE = n => a => { const c = Math.cos(a), s = Math.sin(a); return [Math.sign(c) * Math.pow(Math.abs(c), 2 / n), Math.sign(s) * Math.pow(Math.abs(s), 2 / n)]; };
  const radialPush = (blobs) => (v, t, a, p) => { for (const [x, y, z, r, k] of blobs) { const d = Math.hypot(v.x - x, v.y - y, v.z - z); if (d < r) { const f = Math.pow(1 - d / r, 2) * k; const dir = v.clone().sub(p); dir.z = 0; dir.normalize(); v.addScaledVector(dir, f); } } };
  M.makeDragon = function () {
    const D = new THREE.Group();
    const P = [V(0, 3.4, 4.3), V(0, 3.45, 3.8), V(0, 3.2, 3.35), V(0, 2.78, 3.0), V(0, 2.38, 2.6), V(0, 2.06, 2.1),
    V(0, 1.96, 1.5), V(0, 1.9, .8), V(0, 1.82, 0), V(0, 1.76, -.8), V(0, 1.82, -1.5),
    V(0, 1.66, -2.2), V(0, 1.36, -3.0), V(.15, 1.0, -3.8), V(.5, .7, -4.6), V(1.1, .45, -5.3), V(1.9, .3, -5.8), V(2.8, .22, -6.0), V(3.6, .18, -5.8), V(4.3, .15, -5.3), V(4.8, .12, -4.6)];
    const RAD = [[.25, .29], [.28, .32], [.32, .37], [.37, .43], [.44, .51], [.54, .64], [.68, .84], [.78, .98], [.7, .87], [.58, .7], [.66, .76],
    [.52, .58], [.42, .47], [.34, .38], [.27, .3], [.21, .23], [.16, .17], [.12, .12], [.08, .08], [.05, .05], [.015, .015]];
    const n = P.length;
    const geo = M.loft(P, RAD, {
      seg: 36, rings: 220, up: V(0, 1, 0), uvScaleV: 1.3,
      shape: (a) => { const c = Math.cos(a), s = Math.sin(a); const ridge = 1 + .07 * gauss(a - Math.PI / 2, .22); return [c * (1 + .04 * gauss(s + .3, .4)), s > 0 ? s * ridge : s * .9]; },
      onVertex: (v, t, a, p, side) => { const i = t * (n - 1), c = Math.cos(a); const bul = gauss(i - 6.2, .8) * .16 + gauss(i - 10, .9) * .18; v.addScaledVector(side, c * bul); if (Math.sin(a) > .2) v.y += (gauss(i - 6.3, .7) * .08 + gauss(i - 10, .7) * .06) * Math.sin(a); }
    });
    const tArr = geo.userData.t, vc = tArr.length, si = new Uint16Array(vc * 4), sw = new Float32Array(vc * 4);
    for (let i = 0; i < vc; i++) { const fi = tArr[i] * (n - 1), i0 = Math.min(n - 2, Math.floor(fi)), f = fi - i0; si[i * 4] = i0; si[i * 4 + 1] = i0 + 1; sw[i * 4] = 1 - f; sw[i * 4 + 1] = f; }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    const bones = P.map(() => new THREE.Bone()), ROOT = 8;
    bones[ROOT].position.copy(P[ROOT]);
    for (let i = ROOT - 1; i >= 0; i--) { bones[i].position.copy(P[i]).sub(P[i + 1]); bones[i + 1].add(bones[i]); }
    for (let i = ROOT + 1; i < n; i++) { bones[i].position.copy(P[i]).sub(P[i - 1]); bones[i - 1].add(bones[i]); }
    const body = new THREE.SkinnedMesh(geo, M.mat.dragonSkin); body.castShadow = true; body.receiveShadow = true; body.frustumCulled = false;
    body.add(bones[ROOT]); body.bind(new THREE.Skeleton(bones)); D.add(body);
    // dorsal thorns (hooked), two sizes
    const thorn = new THREE.Shape(); thorn.moveTo(-.5, 0); thorn.bezierCurveTo(-.35, .45, -.05, .8, .55, 1.05); thorn.bezierCurveTo(.2, .7, .3, .3, .5, 0); thorn.lineTo(-.5, 0);
    const thornG = new THREE.ExtrudeGeometry(thorn, { depth: .05, bevelEnabled: true, bevelThickness: .03, bevelSize: .025, bevelSegments: 3, curveSegments: 10 }); thornG.translate(0, 0, -.025);
    const prof = [0, .2, .26, .32, .38, .44, .5, .58, .55, .5, .52, .46, .4, .34, .28, .22, .17, .12, .08, 0, 0];
    for (let i = 1; i < n - 2; i++) { const sz = prof[i]; if (!sz) continue; const f = M.mesh(thornG, M.mat.horn); f.scale.set(sz, sz, sz * .9); f.rotation.y = -Math.PI / 2; f.position.set(0, RAD[i][1] * .93 + (i >= 6 && i <= 10 ? .08 : 0), 0); bones[i].add(f);
      if (i >= 2 && i <= 11) [-1, 1].forEach(sg => { const sm = M.mesh(new THREE.ConeGeometry(.035, .16, 5), M.mat.horn); sm.position.set(sg * RAD[i][0] * .42, RAD[i][1] * .84, 0); sm.rotation.set(-.9, 0, sg * -.5); bones[i].add(sm); }); }
    // tail spade
    const sp = new THREE.Shape(); sp.moveTo(0, -.1); sp.lineTo(.32, -.35); sp.lineTo(.12, .2); sp.lineTo(0, .7); sp.lineTo(-.12, .2); sp.lineTo(-.32, -.35); sp.lineTo(0, -.1);
    const spade = M.mesh(new THREE.ExtrudeGeometry(sp, { depth: .03, bevelEnabled: true, bevelThickness: .015, bevelSize: .015, bevelSegments: 2 }), M.mat.horn);
    const tg = new THREE.Group(); tg.rotation.y = Math.atan2(P[n - 1].x - P[n - 2].x, P[n - 1].z - P[n - 2].z); spade.rotation.x = -Math.PI / 2; spade.position.z = -.05; tg.add(spade); bones[n - 1].add(tg);
    // head
    const head = M.makeDragonHead(); head.scale.setScalar(1.18); head.position.set(0, .02, .08); head.rotation.x = .25; bones[0].add(head);
    // legs (attach to shoulder / hip bones)
    const legs = [];
    [[6, 1, false], [6, -1, false], [10, 1, true], [10, -1, true]].forEach(([bi, sg, hind]) => { const L = M.makeDragonLeg(sg, hind); L.position.set(sg * RAD[bi][0] * .78, -RAD[bi][1] * .3, hind ? -.05 : .1); bones[bi].add(L); legs.push(L); });
    // wings
    const wings = [-1, 1].map(sg => { const w = M.makeWing(sg); w.position.set(sg * .4, RAD[6][1] * .8, -.05); bones[6].add(w); return w; });
    D.userData = { body, bones, head, jaw: head.userData.jaw, mouthGlow: head.userData.mouthGlow, eyeLight: head.userData.light, lids: head.userData.lids, legs, wings, t: Math.random() * 10, P, blink: 0 };
    return D;
  };
  // lying pose for the lair
  M.dragonLie = function (D, on) {
    const L = D.userData.legs;
    L.forEach((l, i) => { const hind = i >= 2, sg = i % 2 ? -1 : 1; if (on) { l.rotation.set(hind ? .55 : -1.05, 0, sg * (hind ? .35 : .25)); } else l.rotation.set(0, 0, 0); });
    D.userData.lie = on;
  };
  M.makeDragonHead = function () {
    const h = new THREE.Group(), mat = M.mat.dragonHead;
    const skullBlobs = [[.18, .2, .27, .13, .075], [-.18, .2, .27, .13, .075], [.24, .02, .08, .14, .05], [-.24, .02, .08, .14, .05], [.06, .07, 1.34, .05, .025], [-.06, .07, 1.34, .05, .025], [.21, -.04, -.14, .14, .05], [-.21, -.04, -.14, .14, .05], [0, .14, .75, .12, .02]];
    const push = radialPush(skullBlobs);
    const skullG = M.loft([V(0, .06, -.3), V(0, .1, 0), V(0, .11, .28), V(0, .07, .55), V(0, .03, .85), V(0, 0, 1.12), V(0, -.02, 1.34), V(0, -.03, 1.46)],
      [[.19, .2], [.25, .22], [.26, .2], [.2, .16], [.16, .13], [.135, .105], [.115, .09], [.035, .035]], {
        seg: 32, rings: 56, up: V(0, 1, 0), uvScaleV: .5, shape: SE(2.7),
        onVertex: (v, t, a, p) => { const dy = v.y - p.y; if (dy < -.05) v.y = p.y - .05 + (dy + .05) * .18; push(v, t, a, p); if (Math.abs(v.x) < .045 && dy > 0 && v.z > .45) v.y += .018 * (1 - Math.abs(v.x) / .045); }
      });
    h.add(M.mesh(skullG, mat));
    const jaw = new THREE.Group(); jaw.position.set(0, -.07, -.1); h.add(jaw);
    const jawG = M.loft([V(0, -.03, -.08), V(0, -.06, .3), V(0, -.055, .72), V(0, -.045, 1.12), V(0, -.04, 1.38)], [[.19, .085], [.16, .075], [.125, .06], [.1, .05], [.035, .03]], {
      seg: 24, rings: 36, up: V(0, 1, 0), uvScaleV: .5, shape: SE(2.6),
      onVertex: (v, t, a, p) => { if (v.y > p.y + .015) v.y = p.y + .015; }
    });
    jaw.add(M.mesh(jawG, mat));
    const inner = M.mesh(new THREE.PlaneGeometry(.26, 1.25), new THREE.MeshStandardMaterial({ color: 0x220405, roughness: .35, emissive: 0x150101 })); inner.rotation.x = -Math.PI / 2; inner.position.set(0, -.03, .62); jaw.add(inner);
    const tongue = M.mesh(M.loft([V(0, -.02, .1), V(0, -.01, .5), V(0, 0, .85)], [[.07, .025], [.06, .02], [.02, .01]], { seg: 10, rings: 12 }), new THREE.MeshStandardMaterial({ color: 0x3a0a0c, roughness: .3 })); jaw.add(tongue);
    // teeth: rows + fangs that overlap the lower jaw
    const tm = M.mat.ivory, tg = new THREE.ConeGeometry(.014, .08, 6);
    for (let i = 0; i < 10; i++) for (const sg of [-1, 1]) {
      const z = .38 + i * .098, w = .2 - i * .011;
      const fang = i === 7;
      const t1 = M.mesh(tg, tm); t1.position.set(sg * (w - .03), -.07, z); t1.rotation.x = Math.PI; t1.scale.y = fang ? 2.2 : .75 + (i % 3) * .2; if (fang) t1.position.y -= .05; h.add(t1);
      const t2 = M.mesh(tg, tm); t2.position.set(sg * (w - .05), -.0, z - .04); t2.scale.y = i === 1 ? 1.7 : .65 + (i % 2) * .25; jaw.add(t2);
    }
    const mouthGlow = M.mesh(new THREE.SphereGeometry(.12, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff6a18, transparent: true, opacity: 0, toneMapped: false }), false, false); mouthGlow.position.set(0, -.07, .5); h.add(mouthGlow);
    // eyes + lids
    const lids = [];
    [-1, 1].forEach(sg => {
      const e = M.mesh(new THREE.SphereGeometry(.042, 18, 12), M.mat.eye, false); e.position.set(sg * .2, .115, .33); e.rotation.y = sg * 1.15; e.scale.set(1, .62, 1); h.add(e);
      const lid = M.mesh(new THREE.SphereGeometry(.05, 14, 8, 0, TAU, 0, Math.PI / 2), mat); lid.position.set(sg * .198, .118, .33); lid.rotation.set(0, sg * 1.15, sg * -.2); lid.scale.set(1.05, .35, 1.1); h.add(lid); lids.push(lid);
    });
    // horns: main sweep, secondary, cheek frill spines, jaw spikes, nose horn
    [-1, 1].forEach(sg => {
      h.add(M.mesh(M.loft([V(sg * .15, .22, .02), V(sg * .23, .37, -.3), V(sg * .33, .43, -.7), V(sg * .4, .33, -1.06), V(sg * .38, .12, -1.34)], [.085, .07, .052, .03, .005], { seg: 14, rings: 44, up: V(0, 1, 0), uvScaleV: .4 }), M.mat.horn));
      h.add(M.mesh(M.loft([V(sg * .23, .1, -.08), V(sg * .38, .06, -.36), V(sg * .5, -.06, -.6), V(sg * .55, -.18, -.72)], [.05, .038, .02, .004], { seg: 10, rings: 26, up: V(0, 1, 0) }), M.mat.horn));
      const frill = new THREE.Group(); frill.position.set(sg * .24, -.04, -.18); h.add(frill);
      const tips = [];
      for (let k = 0; k < 4; k++) { const ang = -.3 - k * .32, len = .42 - k * .06; const tip = V(sg * (.14 + k * .02), Math.sin(ang) * len, -Math.cos(ang) * len * .9 - .05); tips.push(tip); frill.add(M.mesh(M.loft([V(0, 0, 0), tip.clone().multiplyScalar(.55), tip], [.022, .014, .003], { seg: 6, rings: 10 }), M.mat.horn)); }
      const fv = []; for (let k = 0; k < tips.length - 1; k++) { fv.push(0, 0, 0, tips[k].x, tips[k].y, tips[k].z, tips[k + 1].x, tips[k + 1].y, tips[k + 1].z); }
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fv, 3)); fg.computeVertexNormals();
      frill.add(M.mesh(fg, M.mat.membrane));
      for (let k = 0; k < 4; k++) { const sp = M.mesh(new THREE.ConeGeometry(.018, .12 - k * .015, 5), M.mat.horn); sp.position.set(sg * (.17 - k * .005), -.06, .1 + k * .17); sp.rotation.set(-1.3, 0, sg * -.9); jaw.add(sp); }
    });
    const nose = M.mesh(new THREE.ConeGeometry(.03, .14, 7), M.mat.horn); nose.position.set(0, .12, 1.2); nose.rotation.x = -.7; h.add(nose);
    const light = new THREE.PointLight(0xffa040, .5, 3.5, 2); light.position.set(0, .1, .9); h.add(light);
    h.userData.jaw = jaw; h.userData.mouthGlow = mouthGlow; h.userData.light = light; h.userData.lids = lids;
    return h;
  };
  const limb = (pts, rad, mat) => M.mesh(M.loft(pts, rad, { seg: 18, rings: 22, up: V(0, 0, 1), uvScaleV: .8 }), mat);
  function claws(foot, sg, toes, m) {
    toes.forEach(([dx, dz, len], k) => {
      const base = V(0, 0, 0), mid = V(sg * dx * .5, -.02, dz * .5 + .02), end = V(sg * dx, -.06, dz);
      foot.add(limb([base, mid, end], [.07, .055, .042], m));
      foot.add(M.mesh(M.loft([end, V(sg * dx * 1.08, -.05, dz + .08), V(sg * dx * 1.12, -.1, dz + .15), V(sg * dx * 1.13, -.17, dz + .17)], [.04, .03, .016, .002], { seg: 8, rings: 12 }), M.mat.horn));
      const kn = M.mesh(new THREE.SphereGeometry(.05, 10, 8), m); kn.position.copy(mid); foot.add(kn);
    });
  }
  M.makeDragonLeg = function (sg, hind) {
    const g = new THREE.Group(), m = M.mat.dragonLimb;
    if (!hind) {
      const sh = M.mesh(new THREE.SphereGeometry(.42, 18, 14), m); sh.scale.set(.9, 1.1, 1.1); g.add(sh);
      const elbow = V(sg * .3, -.76, -.3), wrist = V(sg * .2, -1.36, .18), palm = V(sg * .16, -1.52, .42);
      g.add(limb([V(0, 0, 0), V(sg * .2, -.4, -.14), elbow], [.44, .36, .28], m));
      const ek = M.mesh(new THREE.SphereGeometry(.26, 14, 10), m); ek.position.copy(elbow); g.add(ek);
      g.add(limb([elbow, V(sg * .26, -1.08, -.06), wrist], [.27, .21, .17], m));
      g.add(limb([wrist, palm], [.17, .15], m));
      const foot = new THREE.Group(); foot.position.copy(palm); g.add(foot);
      claws(foot, sg, [[-.1, .26, 1], [0, .3, 1], [.1, .26, 1], [.16, .1, 1]], m);
      g.userData.foot = foot;
    } else {
      const hip = M.mesh(new THREE.SphereGeometry(.52, 18, 14), m); hip.scale.set(.85, 1.1, 1.2); g.add(hip);
      const knee = V(sg * .26, -.62, .52), hock = V(sg * .22, -1.12, -.2), ankle = V(sg * .2, -1.6, .12);
      g.add(limb([V(0, 0, 0), V(sg * .18, -.35, .3), knee], [.55, .45, .3], m));
      const kk = M.mesh(new THREE.SphereGeometry(.28, 14, 10), m); kk.position.copy(knee); g.add(kk);
      g.add(limb([knee, V(sg * .25, -.9, .15), hock], [.28, .22, .16], m));
      const hk = M.mesh(new THREE.SphereGeometry(.15, 12, 8), m); hk.position.copy(hock); g.add(hk);
      g.add(limb([hock, V(sg * .21, -1.38, -.05), ankle], [.15, .13, .12], m));
      const foot = new THREE.Group(); foot.position.copy(ankle); g.add(foot);
      claws(foot, sg, [[-.11, .32, 1], [0, .38, 1], [.11, .32, 1]], m);
      g.userData.foot = foot;
    }
    return g;
  };
  // wing with procedural membrane (scalloped trailing edge) updated per pose
  M.makeWing = function (sg) {
    const root = new THREE.Group(); root.scale.x = sg;
    const m = M.mat.dragonLimb, bone = (len, r0, r1) => { const gg = new THREE.Group(); gg.add(M.mesh(M.loft([V(0, 0, 0), V(len * .5, .015, 0), V(len, 0, 0)], [r0, (r0 + r1) * .45, r1], { seg: 10, rings: 14, up: V(0, 1, 0) }), m)); const k = M.mesh(new THREE.SphereGeometry(r1 * 1.35, 10, 8), m); k.position.x = len; gg.add(k); return gg; };
    const hum = new THREE.Group(); root.add(hum); hum.add(bone(1.3, .17, .11));
    const fore = new THREE.Group(); fore.position.x = 1.3; hum.add(fore); fore.add(bone(1.8, .11, .075));
    const wrist = new THREE.Group(); wrist.position.x = 1.8; fore.add(wrist);
    const thumb = M.mesh(M.loft([V(0, 0, 0), V(.06, .14, .04), V(.04, .26, .1)], [.04, .022, .003], { seg: 8, rings: 10 }), M.mat.horn); wrist.add(thumb);
    const fl = [3.2, 3.5, 3.0, 2.4], fingers = [];
    for (let i = 0; i < 4; i++) { const f = new THREE.Group(); wrist.add(f); const b = bone(fl[i], .06, .014); f.add(b); f.userData.len = fl[i]; f.userData.b = b; fingers.push(f); }
    const K = 12, Mx = 6, panels = 5, vcount = panels * (Mx + 1) * (K + 1);
    const pos = new Float32Array(vcount * 3), uv = [], idx = [];
    for (let p = 0; p < panels; p++) for (let mm = 0; mm <= Mx; mm++) for (let k = 0; k <= K; k++) uv.push((p + mm / Mx) / panels, k / K);
    for (let p = 0; p < panels; p++) for (let mm = 0; mm < Mx; mm++) for (let k = 0; k < K; k++) { const a = p * (Mx + 1) * (K + 1) + mm * (K + 1) + k, b = a + K + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); mg.setIndex(idx);
    const mem = new THREE.Mesh(mg, M.mat.membrane); mem.castShadow = true; mem.receiveShadow = true; mem.frustumCulled = false; root.add(mem);
    root.userData = { hum, fore, wrist, fingers, mem, K, Mx, panels, sg, fold: 0, flap: 0 };
    M.poseWing(root, 0, 0);
    return root;
  };
  const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3();
  const WD = {
    fold: { h: [.3, .8, -.5], f: [.05, -.12, -1], g: [[.1, -.15, -1], [.08, -.3, -.95], [.06, -.45, -.9], [.04, -.6, -.8]] },
    open: { h: [1, .4, .12], f: [1, .05, -.45], g: [[.7, .45, .3], [.9, -.05, -.35], [.55, -.35, -.8], [.15, -.45, -.9]] }
  };
  const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _X = new THREE.Vector3(1, 0, 0), _d = new THREE.Vector3(), _e = new THREE.Euler();
  const dirQ = (a, b, t, out) => { _d.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t).normalize(); return out.setFromUnitVectors(_X, _d); };
  M.poseWing = function (w, fold, flap) {
    const u = w.userData; u.fold = fold; const A = WD.fold, B = WD.open;
    const qh = dirQ(A.h, B.h, fold, new THREE.Quaternion());
    if (flap) { _e.set(0, 0, flap * .7 * (.3 + fold * .7)); qh.premultiply(_q.setFromEuler(_e)); }
    u.hum.quaternion.copy(qh);
    const qf = dirQ(A.f, B.f, fold, new THREE.Quaternion()); if (flap) qf.premultiply(_q.setFromEuler(_e.set(0, 0, flap * .35 * fold)));
    _qi.copy(qh).invert(); u.fore.quaternion.copy(_qi).multiply(qf);
    u.wrist.quaternion.identity();
    const qfi = _qi.copy(qf).invert();
    u.fingers.forEach((f, i) => { const qg = dirQ(A.g[i], B.g[i], fold, new THREE.Quaternion()); if (flap) qg.premultiply(_q.setFromEuler(_e.set(0, 0, flap * .3 * fold))); f.quaternion.copy(qfi).multiply(qg); });
    w.updateMatrixWorld(true);
    const inv = tmpM.copy(w.matrixWorld).invert();
    const pt = (obj, x) => tmpV.set(x, 0, 0).applyMatrix4(obj.matrixWorld).applyMatrix4(inv).clone();
    const K = u.K, ribs = [];
    const shoulder = pt(u.hum, 0), wristP = pt(u.wrist, 0), lead = [], body = [];
    for (let k = 0; k <= K; k++) { lead.push(shoulder.clone().lerp(wristP, k / K)); body.push(V(-.05 + fold * .05, -.1 - k / K * (.35 + (1 - fold) * .2), -.2 - k / K * 2.7)); }
    ribs.push(lead);
    u.fingers.forEach(f => { const r = []; for (let k = 0; k <= K; k++) r.push(pt(f.userData.b, f.userData.len * k / K)); ribs.push(r); });
    ribs.push(body);
    const SC = [.06, .26, .3, .28, .22];
    const pa = u.mem.geometry.attributes.position, Mx = u.Mx; let vi = 0;
    for (let p = 0; p < u.panels; p++) {
      const A2 = ribs[p], B2 = ribs[p + 1];
      for (let mm = 0; mm <= Mx; mm++) {
        const s = mm / Mx, base = A2[0].clone().lerp(B2[0], s);
        for (let k = 0; k <= K; k++) {
          const a = A2[k], b = B2[k], q = a.clone().lerp(b, s);
          const sc = Math.sin(s * Math.PI) * Math.pow(k / K, 2.2) * SC[p];
          q.lerp(base, sc);
          const sag = Math.sin(s * Math.PI) * Math.sin(k / K * Math.PI * .9) * .18 * (.4 + fold * .6);
          pa.setXYZ(vi++, q.x, q.y - sag, q.z - sag * .3);
        }
      }
    }
    pa.needsUpdate = true; u.mem.geometry.computeVertexNormals();
  };
  // animate: o = {neckYaw, neckPitch, headPitch, headYaw, mouth, breathe, sway, tailWhip, fold, flap}
  M.animDragon = function (D, dt, o) {
    o = o || {}; const u = D.userData; u.t += dt; const t = u.t, b = u.bones;
    const sway = o.sway == null ? 1 : o.sway;
    for (let i = 0; i <= 5; i++) { const w = (6 - i) / 6; b[i].rotation.x = (o.neckPitch || 0) * w * .32 + Math.sin(t * .8 + i * .4) * .02 * sway; b[i].rotation.y = (o.neckYaw || 0) * w * .3 + Math.sin(t * .55 + i * .5) * .03 * sway; }
    for (let i = 11; i < b.length; i++) { const w = (i - 10) / 10; b[i].rotation.y = Math.sin(t * .9 - i * .5) * (.035 + (o.tailWhip || 0) * .5) * w; b[i].rotation.x = Math.sin(t * .6 - i * .4) * .012; }
    const br = 1 + Math.sin(t * 1.15) * .028 * (o.breathe == null ? 1 : o.breathe);
    b[6].scale.set(br, br, 1); b[7].scale.set(br * 1.01, br * 1.01, 1);
    u.head.rotation.x = .25 + (o.headPitch || 0); u.head.rotation.y = (o.headYaw || 0);
    const m = o.mouth || 0; u.jaw.rotation.x = .03 + m * .62 + Math.max(0, Math.sin(t * .33)) * .02;
    u.mouthGlow.material.opacity = Math.min(1, m * 1.2); u.eyeLight.intensity = .45 + m * 2.5;
    // blink
    u.blink -= dt; if (u.blink < -4 - Math.random() * 3) u.blink = .16; const bl = u.blink > 0 ? 1 : 0;
    u.lids.forEach(l => l.scale.y = .35 + bl * .6);
    const fold = o.fold == null ? 0 : o.fold, flap = (o.flap || 0) > 0 ? Math.sin(t * 6) * o.flap : Math.sin(t * .9) * .03;
    u.wings.forEach(w => M.poseWing(w, fold, flap));
  };

  // ---------- particle pool ----------
  M.Particles = function (scene, max, rgba, additive, tex) {
    this.items = []; const tx = tex || X.glow(rgba || 'rgba(255,150,60,.9)'); this.max = max; this.i = 0;
    for (let i = 0; i < max; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, blending: additive === false ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: additive === false })); s.visible = false; scene.add(s); this.items.push({ s, life: 0, max: 1, v: new THREE.Vector3(), g: 0, size: .1, drag: 1, grow: 0 }); }
  };
  M.Particles.prototype.emit = function (pos, vel, life, size, col, grav, drag, grow) {
    const p = this.items[this.i = (this.i + 1) % this.max]; p.s.visible = true; p.s.position.copy(pos); p.v.copy(vel); p.life = p.max = life; p.size = size; p.g = grav || 0; p.drag = drag == null ? .98 : drag; p.grow = grow || 0;
    p.s.material.color.set(col == null ? 0xffffff : col); p.s.material.rotation = Math.random() * 6; p.s.scale.setScalar(size); return p;
  };
  M.Particles.prototype.update = function (dt) {
    for (const p of this.items) { if (p.life <= 0) continue; p.life -= dt; if (p.life <= 0) { p.s.visible = false; continue; } p.v.y -= p.g * dt; p.v.multiplyScalar(Math.pow(p.drag, dt * 60)); p.s.position.addScaledVector(p.v, dt); const k = p.life / p.max; p.s.material.opacity = Math.min(1, k * 1.6) * (p.grow ? .55 : 1); p.s.scale.setScalar(p.size * (p.grow ? (1 + (1 - k) * p.grow) : (.4 + k * .6))); }
  };
})(window.ET);
