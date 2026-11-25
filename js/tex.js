/* EMBER TITHE — procedural PBR texture generator (albedo / normal / roughness / emissive) */
'use strict';
(function (ET) {
  const X = ET.X = { cache: {}, size: 512 };
  // ---------- noise ----------
  function perm(seed) { const p = new Uint8Array(512); const r = ET.U.rng(seed); const a = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } for (let i = 0; i < 512; i++) p[i] = a[i & 255]; return p; }
  const P = perm(1337), P2 = perm(4242);
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  // tileable value noise, period in lattice units
  function vnoise(x, y, per, p) {
    p = p || P; const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const w = i => ((i % per) + per) % per;
    const h = (i, j) => p[p[w(i) & 255] + (w(j) & 255)] / 255;
    const u = fade(xf), v = fade(yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  X.fbm = function (x, y, per, oct, p) { let s = 0, a = .5, f = 1, n = 0; for (let i = 0; i < (oct || 5); i++) { s += vnoise(x * f, y * f, per * f, p) * a; n += a; a *= .5; f *= 2; } return s / n; };
  X.ridged = function (x, y, per, oct, p) { let s = 0, a = .5, f = 1, n = 0; for (let i = 0; i < (oct || 5); i++) { s += (1 - Math.abs(vnoise(x * f, y * f, per * f, p) * 2 - 1)) * a; n += a; a *= .5; f *= 2; } return s / n; };
  // tileable cellular: N cells per side, returns [f1, f2, id]
  function cellPts(N, seed) { const r = ET.U.rng(seed), pts = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) pts.push([i + .1 + r() * .8, j + .1 + r() * .8, r()]); return pts; }
  X.cell = function (x, y, N, pts, sx, sy) {
    sx = sx || 1; sy = sy || 1;
    const ci = Math.floor(x), cj = Math.floor(y); let f1 = 9, f2 = 9, id = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = ci + di, jj = cj + dj, wi = ((ii % N) + N) % N, wj = ((jj % N) + N) % N, p = pts[wj * N + wi];
      const px = p[0] + (ii - wi), py = p[1] + (jj - wj), dx = (px - x) * sx, dy = (py - y) * sy, d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) { f2 = f1; f1 = d; id = p[2]; } else if (d < f2) f2 = d;
    }
    return [f1, f2, id];
  };
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  X.sm = sm; X.mix = mix;

  // ---------- builder ----------
  // fn(u,v,x,y) -> sets o.r,o.g,o.b (0..1 linear-ish albedo), o.h (height 0..1), o.ro (roughness 0..1), o.e (emissive 0..1), o.m (metal)
  X.build = function (key, W, H, fn, opt) {
    if (X.cache[key]) return X.cache[key];
    opt = opt || {};
    const n = W * H, alb = new Uint8ClampedArray(n * 4), hgt = new Float32Array(n), rough = new Uint8ClampedArray(n * 4), em = opt.emissive ? new Uint8ClampedArray(n * 4) : null;
    const o = {};
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      o.r = o.g = o.b = .5; o.h = .5; o.ro = .8; o.e = 0; o.er = 1; o.eg = .4; o.eb = .1; o.m = 0;
      fn(x / W, y / H, x, y, o);
      const i = y * W + x, k = i * 4;
      alb[k] = Math.pow(Math.max(0, o.r), 1 / 2.2) * 255; alb[k + 1] = Math.pow(Math.max(0, o.g), 1 / 2.2) * 255; alb[k + 2] = Math.pow(Math.max(0, o.b), 1 / 2.2) * 255; alb[k + 3] = 255;
      hgt[i] = o.h; rough[k] = 255; rough[k + 1] = o.ro * 255; rough[k + 2] = o.m * 255; rough[k + 3] = 255;
      if (em) { em[k] = o.e * o.er * 255; em[k + 1] = o.e * o.eg * 255; em[k + 2] = o.e * o.eb * 255; em[k + 3] = 255; }
    }
    // normal from height (wrap)
    const nrm = new Uint8ClampedArray(n * 4), s = opt.normal || 4;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const xl = (x - 1 + W) % W, xr = (x + 1) % W, yu = (y - 1 + H) % H, yd = (y + 1) % H;
      const dx = (hgt[y * W + xr] - hgt[y * W + xl]) * s, dy = (hgt[yd * W + x] - hgt[yu * W + x]) * s;
      let nx = -dx, ny = dy, nz = 1; const l = Math.sqrt(nx * nx + ny * ny + nz * nz); nx /= l; ny /= l; nz /= l;
      const k = (y * W + x) * 4; nrm[k] = (nx * .5 + .5) * 255; nrm[k + 1] = (ny * .5 + .5) * 255; nrm[k + 2] = (nz * .5 + .5) * 255; nrm[k + 3] = 255;
    }
    const mk = (data, srgb) => { const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(new ImageData(data, W, H), 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = X.aniso || 4; if (srgb) t.encoding = THREE.sRGBEncoding; return t; };
    const r = { map: mk(alb, true), normalMap: mk(nrm), roughnessMap: mk(rough), emissiveMap: em ? mk(em, true) : null, metalnessMap: null };
    if (opt.metalMap) r.metalnessMap = r.roughnessMap;
    X.cache[key] = r; return r;
  };
  // clone a texture set with a repeat
  X.rep = function (set, rx, ry) {
    const out = {}; for (const k in set) { if (!set[k]) { out[k] = null; continue; } const t = set[k].clone(); t.needsUpdate = true; t.repeat.set(rx, ry); out[k] = t; } return out;
  };
  X.mat = function (set, o) {
    const m = new THREE.MeshStandardMaterial(Object.assign({ map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, roughness: 1, metalness: 0 }, o || {}));
    if (set.emissiveMap && !(o && o.noEm)) { m.emissiveMap = set.emissiveMap; if (!(o && o.emissive)) m.emissive = new THREE.Color(1, 1, 1); }
    if (set.metalnessMap) m.metalnessMap = set.metalnessMap;
    delete m.noEm; return m;
  };

  // ---------- library ----------
  const S = () => X.size;
  X.lib = {};
  X.lib.ashlar = () => {
    const W = S() * (X.big ? 2 : 1), H = W, rows = 6, rh = H / rows, r = ET.U.rng(7), blocks = [];
    for (let i = 0; i < rows; i++) { const xs = [0]; let x = 0; const off = r() * W; while (x < W - 60) { x += 90 + r() * 110; if (x > W - 50) break; xs.push(x); } xs.push(W); blocks.push({ xs: xs.map(v => (v + off) % W).sort((a, b) => a - b), off, cols: xs.map(() => [.8 + r() * .4, r()]) }); }
    return X.build('ashlar', W, H, (u, v, x, y, o) => {
      const ri = Math.floor(y / rh), b = blocks[ri], ly = y - ri * rh;
      let xs = b.xs, k = 0; while (k < xs.length - 1 && x >= xs[k + 1]) k++;
      const x0 = k < xs.length - 1 ? xs[k] : xs[xs.length - 1], x1 = k < xs.length - 1 ? xs[k + 1] : xs[0] + W;
      let lx = x - x0; if (lx < 0) lx += W; const bw = (x1 - x0 + W) % W || W;
      const d = Math.min(lx, bw - lx, ly, rh - ly) + (X.fbm(u * 16, v * 16, 16, 3) - .5) * 6;
      const cc = b.cols[k % b.cols.length], n = X.fbm(u * 8, v * 8, 8, 5), n2 = X.fbm(u * 40, v * 40, 40, 3);
      const mortar = d < 4;
      if (mortar) { o.h = .05 + n2 * .1; o.r = .06; o.g = .055; o.b = .05; o.ro = .98; }
      else { o.h = .45 + sm(3, 14, d) * .35 + n * .2 + n2 * .05; const l = (.06 + n * .06) * cc[0]; o.r = l * 1.06; o.g = l * .98; o.b = l * .9 + cc[1] * .01; o.ro = .82 + n2 * .15; }
    }, { normal: 6 });
  };
  X.lib.flag = () => {
    const W = S() * (X.big ? 2 : 1), H = W, rows = 4, rh = H / rows, r = ET.U.rng(19), rowsD = [];
    for (let i = 0; i < rows; i++) { const xs = [0]; let x = 0; while (x < W - 80) { x += W * (.16 + r() * .22); if (x > W - W * .1) break; xs.push(x); } xs.push(W); const off = r() * W; rowsD.push({ xs, off, t: xs.map(() => r()) }); }
    return X.build('flag', W, H, (u, v, x, y, o) => {
      const ri = Math.floor(y / rh), R = rowsD[ri], ly = y - ri * rh; let xx = (x + R.off) % W, k = 0; while (k < R.xs.length - 2 && xx >= R.xs[k + 1]) k++;
      const x0 = R.xs[k], x1 = R.xs[k + 1], lx = xx - x0, bw = x1 - x0;
      const wob = (X.fbm(u * 24, v * 24, 24, 3) - .5) * W * .012;
      const d = Math.min(lx, bw - lx, ly, rh - ly) + wob;
      const n = X.fbm(u * 10 + R.t[k] * 5, v * 10, 10, 5), n2 = X.fbm(u * 60, v * 60, 60, 3), dirt = X.fbm(u * 4, v * 4, 4, 5, P2), wear = X.fbm(u * 2, v * 2, 2, 3);
      const crack = sm(.968, .99, X.ridged(u * 8 + R.t[k], v * 8, 8, 4));
      const slab = sm(W * .004, W * .014, d);
      o.h = slab * (.55 + n * .3 + n2 * .08 + sm(0, W * .03, d) * .1) - crack * .3;
      const tone = .02 + R.t[k] * .02 + n * .03;
      const l = mix(.006, tone * (1 - dirt * .75) * (1 + wear * .3), slab) * (1 - crack * .65);
      o.r = l * 1.08; o.g = l * .98; o.b = l * .9; o.ro = mix(.97, .7 + n2 * .2 + dirt * .1 - wear * .1, slab);
    }, { normal: 6 });
  };
  X.lib.wood = () => X.build('wood', S() / 2, S(), (u, v, x, y, o) => {
    const g = X.fbm(u * 6, v * 1.5, 6, 5), fine = X.fbm(u * 64, v * 4, 64, 3);
    const ring = Math.sin((u * 18 + g * 6) * Math.PI * 2) * .5 + .5;
    const crack = sm(.94, .985, X.ridged(u * 12, v * 1, 12, 3, P2));
    o.h = ring * .25 + fine * .5 - crack * .6; const l = (.06 + ring * .03 + fine * .03) * (1 - crack * .7);
    o.r = l * 1.6; o.g = l * 1.05; o.b = l * .62; o.ro = .78 + fine * .2;
  }, { normal: 5 });
  X.lib.endgrain = () => X.build('endgrain', S() / 2, S() / 2, (u, v, x, y, o) => {
    const dx = u - .5, dy = v - .5, r = Math.sqrt(dx * dx + dy * dy) + X.fbm(u * 6, v * 6, 6, 4) * .04;
    const ring = Math.sin(r * 90) * .5 + .5, crack = sm(.92, .98, X.ridged(Math.atan2(dy, dx) * 3, r * 4, 64, 2));
    const l = (.045 + ring * .025) * (1 - crack * .8) * (r > .48 ? .4 : 1); o.r = l * 1.5; o.g = l * 1.05; o.b = l * .65; o.h = ring * .3 - crack * .5; o.ro = .85;
  });
  X.lib.bark = () => { const N = 8, pts = cellPts(N, 21); return X.build('bark', S() / 2, S(), (u, v, x, y, o) => { const [f1, f2] = X.cell(u * N, v * N * .35, N, pts, 1, 2.8); const e = f2 - f1, n = X.fbm(u * 16, v * 16, 16, 4); o.h = sm(0, .25, e) * .8 + n * .2; const l = (.03 + o.h * .06); o.r = l * 1.2; o.g = l * 1.05; o.b = l * .9; o.ro = .95; }, { normal: 7 }); };
  X.lib.iron = () => {
    const r = ET.U.rng(5), dents = Array.from({ length: 70 }, () => [r(), r(), .01 + r() * .035]);
    return X.build('iron', S(), S(), (u, v, x, y, o) => {
      let h = X.fbm(u * 10, v * 10, 10, 5) * .35;
      for (const [cx, cy, rr] of dents) { let dx = Math.abs(u - cx), dy = Math.abs(v - cy); dx = Math.min(dx, 1 - dx); dy = Math.min(dy, 1 - dy); const d = Math.sqrt(dx * dx + dy * dy) / rr; if (d < 1) h -= (1 - d * d) * .18; }
      const scale = X.fbm(u * 5, v * 5, 5, 4, P2), rust = sm(.6, .75, X.fbm(u * 7 + 3, v * 7, 7, 5)) * sm(.45, .25, h);
      o.h = h + .5; const l = .035 + scale * .035;
      o.r = mix(l, .09, rust); o.g = mix(l * 1.01, .04, rust); o.b = mix(l * 1.08, .02, rust); o.ro = mix(.5 + scale * .3, .95, rust); o.m = 1 - rust * .9;
    }, { normal: 3, metalMap: true });
  };
  X.lib.steelFace = () => X.build('steelFace', S(), S() / 4, (u, v, x, y, o) => { const b = X.fbm(u * 64, v * 4, 64, 3), s = X.fbm(u * 8, v * 2, 8, 4); o.h = .5 + b * .1; const l = .45 + s * .15; o.r = l; o.g = l * 1.01; o.b = l * 1.03; o.ro = .22 + b * .2 + s * .1; o.m = 1; }, { normal: 2, metalMap: true });
  X.lib.brass = () => X.build('brass', S() / 2, S() / 2, (u, v, x, y, o) => { const t = sm(.55, .75, X.fbm(u * 6, v * 6, 6, 5)), n = X.fbm(u * 40, v * 40, 40, 3); o.h = .5 + n * .1; o.r = mix(.55, .12, t); o.g = mix(.4, .11, t); o.b = mix(.16, .06, t); o.ro = mix(.3 + n * .15, .7, t); o.m = 1 - t * .4; }, { normal: 2, metalMap: true });
  X.lib.leather = () => X.build('leather', S() / 4, S() / 2, (u, v, x, y, o) => { const s = ((u * 1 + v * 4) % 1 + 1) % 1, groove = sm(.0, .08, s) * sm(1, .92, s), n = X.fbm(u * 32, v * 64, 32, 4); o.h = groove * .7 + n * .3; const l = (.035 + n * .03) * (.5 + groove * .5); o.r = l * 1.7; o.g = l * 1.1; o.b = l * .75; o.ro = .62 + n * .25; }, { normal: 6 });
  X.lib.brick = () => X.build('brick', S(), S() / 2, (u, v, x, y, o) => {
    const rows = 8, cols = 4, ry = v * rows, row = Math.floor(ry), rx = u * cols + (row % 2) * .5, col = Math.floor(rx), fx = rx - col, fy = ry - row;
    const d = Math.min(fx * 2.4, (1 - fx) * 2.4, fy, 1 - fy) + (X.fbm(u * 30, v * 30, 30, 3) - .5) * .05;
    const id = (Math.sin(col * 12.9 + row * 78.2) * 43758.5) % 1, n = X.fbm(u * 24, v * 12, 24, 4), soot = X.fbm(u * 3, v * 3, 3, 4, P2);
    const m = sm(.04, .09, d); o.h = m * (.6 + n * .3);
    const l = mix(.015, (.06 + Math.abs(id) * .05 + n * .04) * (1 - soot * .8), m); o.r = l * 1.45; o.g = l * .78; o.b = l * .58; o.ro = mix(.97, .85, m);
  }, { normal: 6 });
  X.lib.coal = () => X.build('coal', S() / 2, S() / 2, (u, v, x, y, o) => { const r = X.ridged(u * 8, v * 8, 8, 5), c = X.fbm(u * 4, v * 4, 4, 4, P2); o.h = r; const l = .015 + r * .03; o.r = o.g = o.b = l; o.ro = .55 + (1 - r) * .4; o.e = sm(.42, .2, r) * (.4 + c); o.er = 1; o.eg = .28 + c * .25; o.eb = .05; }, { normal: 8, emissive: true });
  X.lib.cave = () => X.build('cave', S(), S(), (u, v, x, y, o) => { const r = X.ridged(u * 5, v * 5, 5, 6), f = X.fbm(u * 3, v * 3, 3, 5, P2); o.h = r * .8 + f * .2; const l = .02 + r * .045; o.r = l * 1.15; o.g = l; o.b = l * .92; o.ro = .9; const lav = sm(.32, .18, r) * sm(.45, .6, f); o.e = lav; o.er = 1; o.eg = .3 + lav * .2; o.eb = .04; }, { normal: 8, emissive: true });
  X.lib.lava = () => X.build('lava', S() / 2, S() / 2, (u, v, x, y, o) => { const r = X.ridged(u * 4, v * 4, 4, 6), f = X.fbm(u * 6, v * 6, 6, 5, P2); const crust = sm(.55, .75, r); o.h = crust; const l = .02 + crust * .02; o.r = l; o.g = l * .9; o.b = l * .8; o.ro = .9; o.e = (1 - crust) * (.6 + f * .6); o.er = 1; o.eg = .25 + (1 - crust) * .35 * f; o.eb = .03; }, { normal: 6, emissive: true });
  X.lib.gold = () => { const r = ET.U.rng(9), coins = Array.from({ length: 260 }, () => [r(), r(), .02 + r() * .02, r()]); return X.build('gold', S() / 2, S() / 2, (u, v, x, y, o) => { let h = .1, top = -1; for (let i = 0; i < coins.length; i++) { const c = coins[i]; let dx = Math.abs(u - c[0]), dy = Math.abs(v - c[1]); dx = Math.min(dx, 1 - dx); dy = Math.min(dy, 1 - dy); const d = Math.sqrt(dx * dx + dy * dy) / c[2]; if (d < 1) { top = i; h = .3 + c[3] * .5 + (d > .8 ? -.15 : 0) + (d < .5 ? .05 : 0); } } const n = X.fbm(u * 30, v * 30, 30, 3); o.h = h; const l = top < 0 ? .06 : .5 + n * .2; o.r = l * 1; o.g = l * .7; o.b = l * .25; o.ro = top < 0 ? .7 : .25 + n * .2; o.m = top < 0 ? .3 : 1; }, { normal: 5, metalMap: true }); };
  // dragon scales: u = around body (belly at .75), v = along body
  X.lib.scales = () => {
    const W = S(), H = S(), cols = 22, rows = 22, sw = W / cols, sh = H / rows;
    const rnd = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
    return X.build('scales', W, H, (u, v, x, y, o) => {
      // belly plates band
      const bd = Math.abs(u - .75), belly = sm(.085, .06, bd);
      // scales
      let best = null;
      const r0 = Math.floor(y / sh);
      for (let rr = r0 - 2; rr <= r0; rr++) {
        const off = (rr & 1) * .5, c0 = Math.floor(x / sw - off);
        for (let cc = c0 - 1; cc <= c0 + 1; cc++) {
          const cx = (cc + off + .5) * sw, cy = (rr + .3) * sh;
          let dx = x - cx; dx -= Math.round(dx / W) * W; let dy = y - cy; dy -= Math.round(dy / H) * H;
          const lx = dx / sw, ly = dy / (sh * 1.9);
          if (ly < -.15 || ly > 1) continue;
          const half = .62 * (1 - Math.pow(Math.max(0, ly), 2.2) * .85);
          if (Math.abs(lx) > half) continue;
          if (!best || rr > best.rr) { const edge = Math.min((half - Math.abs(lx)) / half, (1 - ly) * 3, (ly + .15) * 6); best = { rr, lx, ly, edge, id: rnd(cc, rr) }; }
        }
      }
      let h = .2, a = .03, ro = .85, e = 0;
      const n = X.fbm(u * 40, v * 40, 40, 3);
      if (best) { const k = sm(0, .25, best.edge); h = .35 + best.ly * .35 + (1 - Math.abs(best.lx) * 2.2) * .12 * k + k * .15 + n * .04; a = (.018 + best.id * .022 + n * .012) * (.55 + k * .45) * (1 + best.ly * .5); ro = .32 + (1 - k) * .35 + n * .1; e = (1 - k) * sm(.52, .75, X.fbm(u * 4, v * 6, 4, 3, P2)) * 1.0; }
      else { e = sm(.55, .8, X.fbm(u * 4, v * 6, 4, 3, P2)) * .9; }
      // belly: transverse plates
      const pv = (v * rows / 1.6) % 1, plate = sm(0, .1, pv) * sm(1, .9, pv);
      const bh = .38 + plate * .14 + n * .05, ba = (.03 + n * .012) * (.8 + plate * .2);
      o.h = mix(h, bh, belly); const al = mix(a, ba, belly);
      o.r = al * 1.18; o.g = al * .92; o.b = al * .9; o.ro = mix(ro, .55 + (1 - plate) * .3, belly); o.e = e * (1 - belly); o.er = 1; o.eg = .32; o.eb = .06;
    }, { normal: 7, emissive: true });
  };
  X.lib.membrane = () => {
    if (X.cache.membrane) return X.cache.membrane;
    const W = S(), c = document.createElement('canvas'); c.width = c.height = W; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, W); gr.addColorStop(0, '#2a0b08'); gr.addColorStop(1, '#4a140c'); g.fillStyle = gr; g.fillRect(0, 0, W, W);
    const r = ET.U.rng(31);
    function vein(x, y, a, w, d) { if (d > 6 || w < .4) return; const len = 30 + r() * 60; const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len; g.strokeStyle = 'rgba(12,2,2,.75)'; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + nx) / 2 + (r() - .5) * 20, (y + ny) / 2 + (r() - .5) * 20, nx, ny); g.stroke(); vein(nx, ny, a + (r() - .5) * .9, w * .72, d + 1); if (r() < .6) vein(nx, ny, a + (r() < .5 ? -1 : 1) * (.4 + r() * .6), w * .55, d + 1); }
    for (let i = 0; i < 9; i++) vein(r() * W, 0, Math.PI / 2 + (r() - .5) * .6, 5, 0);
    const img = g.getImageData(0, 0, W, W); for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - .5) * 10; img.data[i] += n; img.data[i + 1] += n * .5; } g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return (X.cache.membrane = { map: t });
  };
  X.lib.horn = () => X.build('horn', S() / 4, S() / 2, (u, v, x, y, o) => { const ridge = Math.sin(v * 80 + X.fbm(u * 4, v * 8, 4, 3) * 4) * .5 + .5, n = X.fbm(u * 16, v * 32, 16, 4); o.h = ridge * .5 + n * .3; const l = mix(.12, .02, v) * (.7 + n * .4); o.r = l * 1.1; o.g = l; o.b = l * .85; o.ro = .45 + n * .2; }, { normal: 5 });
  X.lib.ivory = () => X.build('ivory', S() / 2, S() / 2, (u, v, x, y, o) => { const n = X.fbm(u * 12, v * 12, 12, 5), p = X.fbm(u * 60, v * 60, 60, 2), crack = sm(.95, .99, X.ridged(u * 6, v * 6, 6, 4)); o.h = n * .4 + p * .2 - crack * .5; const l = (.45 + n * .15) * (1 - crack * .7) * (.85 + p * .15); o.r = l * 1.05; o.g = l * .95; o.b = l * .78; o.ro = .55 + p * .25; }, { normal: 4 });
  // blades: u across, v along
  X.lib.blade = function (kind) {
    const W = S() / 4, H = S();
    const k = 'blade_' + kind;
    if (kind === 'rust') return X.build(k, W, H, (u, v, x, y, o) => { const r = sm(.45, .7, X.fbm(u * 3, v * 10, 3, 5)), b = X.fbm(u * 40, v * 3, 40, 3); o.h = .5 + b * .1 + r * .2 * X.fbm(u * 20, v * 40, 20, 3); o.r = mix(.28, .085, r); o.g = mix(.29, .045, r); o.b = mix(.3, .025, r); o.ro = mix(.4 + b * .2, .9, r); o.m = 1 - r * .85; }, { normal: 3, metalMap: true });
    if (kind === 'steel') return X.build(k, W, H, (u, v, x, y, o) => { const b = X.fbm(u * 60, v * 2, 60, 3), s = X.fbm(u * 4, v * 8, 4, 4); o.h = .5 + b * .05; const l = .5 + s * .12; o.r = l; o.g = l * 1.01; o.b = l * 1.04; o.ro = .18 + b * .14 + s * .06; o.m = 1; }, { normal: 1.5, metalMap: true });
    if (kind === 'damascus') return X.build(k, W, H, (u, v, x, y, o) => { const w = Math.sin((u * 8 + X.fbm(u * 3, v * 6, 3, 5) * 5 + v * 3) * Math.PI * 2) * .5 + .5, b = X.fbm(u * 60, v * 2, 60, 3); o.h = .5 + w * .06; const l = mix(.16, .62, w); o.r = l; o.g = l * 1.0; o.b = l * 1.03; o.ro = mix(.3, .16, w) + b * .08; o.m = 1; }, { normal: 2, metalMap: true });
    if (kind === 'obsidian') return X.build(k, W, H, (u, v, x, y, o) => { const r = X.ridged(u * 3, v * 10, 3, 4), c = Math.sin(r * 30) * .5 + .5; o.h = c * .3; const l = .012 + c * .01; o.r = l; o.g = l * .95; o.b = l * 1.25; o.ro = .05 + (1 - c) * .08; o.e = sm(.9, .97, r) * .9; o.er = .65; o.eg = .25; o.eb = 1; }, { normal: 3, emissive: true });
    if (kind === 'frost') { const N = 6, pts = cellPts(N, 41); return X.build(k, W, H, (u, v, x, y, o) => { const [f1, f2] = X.cell(u * N, v * N * 4, N, pts, 1, .25), e = f2 - f1, b = X.fbm(u * 60, v * 2, 60, 3); const crys = sm(.06, 0, e); o.h = .5 + crys * .3; const l = .62 + b * .1; o.r = l * .92; o.g = l * .98; o.b = l * 1.1; o.ro = .14 + crys * .4; o.m = 1 - crys * .6; o.e = crys * .7; o.er = .4; o.eg = .8; o.eb = 1; }, { normal: 3, metalMap: true, emissive: true }); }
    if (kind === 'storm') return X.build(k, W, H, (u, v, x, y, o) => { const b = X.fbm(u * 60, v * 2, 60, 3), bolt = sm(.985, 1, X.ridged(u * 2 + 1, v * 6, 2, 3)); o.h = .5 - bolt * .2 + b * .04; const l = .16 + b * .06; o.r = l * .85; o.g = l * .95; o.b = l * 1.3; o.ro = .2 + b * .1; o.m = 1; o.e = bolt; o.er = 1; o.eg = .9; o.eb = .35; }, { normal: 2, metalMap: true, emissive: true });
    if (kind === 'meteor') { const N = 7, pts = cellPts(N, 51); return X.build(k, W, H, (u, v, x, y, o) => { const [f1, f2, id] = X.cell(u * N, v * N * 4, N, pts, 1, .25), a = id * Math.PI; const t = (u * Math.cos(a) * 9 + v * 4 * Math.sin(a) * 9), s1 = Math.abs(Math.sin(t * 6)), s2 = Math.abs(Math.sin((u * Math.cos(a + 1.05) * 9 + v * 4 * Math.sin(a + 1.05) * 9) * 6)); const lam = Math.min(s1, s2), bd = sm(.03, 0, f2 - f1); o.h = .5 + lam * .05; const l = mix(.25, .6, lam) * (1 - bd * .5); o.r = l * .95; o.g = l; o.b = l * 1.1; o.ro = .2 + (1 - lam) * .15; o.m = 1; }, { normal: 2, metalMap: true }); }
    if (kind === 'bone') return X.lib.ivory();
    if (kind === 'wood') return X.build(k, W, H, (u, v, x, y, o) => { const g = X.fbm(u * 3, v * 14, 3, 5), ring = Math.sin((u * 6 + g * 5) * Math.PI * 2) * .5 + .5, f = X.fbm(u * 40, v * 6, 40, 3); o.h = .5 + ring * .1 + f * .05; const l = .1 + ring * .05 + f * .03; o.r = l * 1.55; o.g = l * 1.05; o.b = l * .62; o.ro = .7 + f * .2; }, { normal: 3 });
    if (kind === 'blood') return X.build(k, W, H, (u, v, x, y, o) => { const b = X.fbm(u * 50, v * 3, 50, 3), vein = sm(.93, .99, X.ridged(u * 3, v * 9, 3, 4)); o.h = .5 + b * .05 - vein * .1; const l = .12 + b * .05; o.r = l * 2.1; o.g = l * .45; o.b = l * .45; o.ro = .22 + b * .12; o.m = 1; o.e = vein * .8; o.er = 1; o.eg = .12; o.eb = .08; }, { normal: 2, metalMap: true, emissive: true });
    if (kind === 'gold') return X.build(k, W, H, (u, v, x, y, o) => { const b = X.fbm(u * 60, v * 3, 60, 3), filig = sm(.9, .97, X.ridged(u * 4 + 2, v * 12, 4, 3)); o.h = .5 + filig * .15 + b * .03; const l = .62 + b * .1 - filig * .15; o.r = l; o.g = l * .74; o.b = l * .3; o.ro = .14 + b * .1 + filig * .2; o.m = 1; }, { normal: 3, metalMap: true });
    if (kind === 'crystal') { const N = 5, pts = cellPts(N, 61); return X.build(k, W, H, (u, v, x, y, o) => { const [f1, f2] = X.cell(u * N, v * N * 3, N, pts, 1, .33), e = f2 - f1; const facet = sm(.05, 0, e); o.h = .5 + f1 * .3; const l = .7 + f1 * .2; o.r = l * .9; o.g = l * .97; o.b = l * 1.05; o.ro = .02 + facet * .1; o.m = .1; o.e = facet * .6; o.er = .55; o.eg = .9; o.eb = 1; }, { normal: 6, metalMap: true, emissive: true }); }
    if (kind === 'shadow') return X.build(k, W, H, (u, v, x, y, o) => { const sm1 = X.fbm(u * 4, v * 8 - 0, 4, 5), b = X.fbm(u * 50, v * 3, 50, 3); o.h = .5 + b * .03; const l = .02 + b * .015; o.r = l * .9; o.g = l * .8; o.b = l * 1.3; o.ro = .5 + b * .2; o.m = .6; o.e = sm(.55, .8, sm1) * .7; o.er = .55; o.eg = .35; o.eb = 1; }, { normal: 2, metalMap: true, emissive: true });
    if (kind === 'jade') return X.build(k, W, H, (u, v, x, y, o) => { const n = X.fbm(u * 5, v * 10, 5, 5), vein = sm(.9, .98, X.ridged(u * 4, v * 6, 4, 4)); o.h = .5 + n * .1; const l = .18 + n * .12; o.r = l * .45 + vein * .3; o.g = l * 1.25 + vein * .3; o.b = l * .7 + vein * .25; o.ro = .12 + n * .1; o.m = 0; }, { normal: 2 });
    if (kind === 'magma') return X.build(k, W, H, (u, v, x, y, o) => { const r = X.ridged(u * 3, v * 9, 3, 6), f = X.fbm(u * 5, v * 14, 5, 4, P2), crust = sm(.5, .7, r); o.h = crust * .6; const l = .025 + crust * .03; o.r = l * 1.2; o.g = l; o.b = l * .9; o.ro = .85; o.e = (1 - crust) * (.7 + f * .5); o.er = 1; o.eg = .3 + (1 - crust) * .3; o.eb = .04; }, { normal: 6, emissive: true });
    if (kind === 'rune') return X.build(k, W, H, (u, v, x, y, o) => { const n = X.fbm(u * 8, v * 20, 8, 5), cell = Math.floor(v * 14), gx = (u * 3) % 1, gy = (v * 14) % 1, glyph = ((cell * 7) % 5 > 1 && Math.abs(gx - .5) < .08 && gy > .2 && gy < .8) || ((cell * 3) % 4 === 1 && Math.abs(gy - .5) < .06 && gx > .2 && gx < .8) ? 1 : 0; o.h = .5 + n * .2 - glyph * .2; const l = .09 + n * .06; o.r = l; o.g = l * 1.02; o.b = l * 1.1; o.ro = .75; o.e = glyph * .9; o.er = .35; o.eg = .65; o.eb = 1; }, { normal: 5, emissive: true });
    if (kind === 'cursed') return X.build(k, W, H, (u, v, x, y, o) => { const b = X.fbm(u * 40, v * 3, 40, 3), vein = sm(.9, .985, X.ridged(u * 2.5, v * 7, 2, 4, P2)); o.h = .5 + b * .05 - vein * .12; const l = .06 + b * .04; o.r = l * .85; o.g = l; o.b = l * .8; o.ro = .4 + b * .2; o.m = .9; o.e = vein; o.er = .45; o.eg = 1; o.eb = .2; }, { normal: 2, metalMap: true, emissive: true });
    return X.lib.blade('steel');
  };
  X.runes = function () {
    if (X.cache.runes) return X.cache.runes;
    const c = document.createElement('canvas'); c.width = 64; c.height = 512; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 64, 512);
    g.strokeStyle = '#fff'; g.lineWidth = 2.4; g.shadowColor = '#fff'; g.shadowBlur = 4; const r = ET.U.rng(77);
    for (let y = 30; y < 480; y += 34) { g.beginPath(); const n = 2 + Math.floor(r() * 3); for (let k = 0; k < n; k++) { g.moveTo(20 + r() * 24, y + r() * 22); g.lineTo(20 + r() * 24, y + r() * 22); } g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return (X.cache.runes = t);
  };
  X.glow = function (rgba) { const k = 'g' + rgba; if (X.cache[k]) return X.cache[k]; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, rgba); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (X.cache[k] = new THREE.CanvasTexture(c)); };
  X.smoke = function () { if (X.cache.smoke) return X.cache.smoke; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const img = g.createImageData(64, 64); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const dx = x / 32 - 1, dy = y / 32 - 1, d = Math.sqrt(dx * dx + dy * dy), n = X.fbm(x / 64 * 4, y / 64 * 4, 4, 4); const a = Math.max(0, 1 - d) * n * 1.6; const k = (y * 64 + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 200; img.data[k + 3] = Math.min(255, a * 255); } g.putImageData(img, 0, 0); return (X.cache.smoke = new THREE.CanvasTexture(c)); };
  X.eye = function () { if (X.cache.eye) return X.cache.eye; const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, '#fff2a0'); gr.addColorStop(.35, '#ffb020'); gr.addColorStop(.75, '#a83a06'); gr.addColorStop(1, '#200400'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 60; i++) { const a = Math.random() * Math.PI * 2; g.strokeStyle = 'rgba(80,20,0,.4)'; g.beginPath(); g.moveTo(64 + Math.cos(a) * 14, 64 + Math.sin(a) * 14); g.lineTo(64 + Math.cos(a) * 60, 64 + Math.sin(a) * 60); g.stroke(); } g.fillStyle = '#050000'; g.beginPath(); g.ellipse(64, 64, 7, 46, 0, 0, Math.PI * 2); g.fill(); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return (X.cache.eye = t); };
  X.parchment = null;
})(window.ET);
