// =============================================================================
// КАРТА «TRAINING FIELD» — танкодром у грузовой станции.
// Небо и горизонт — панорама freight_station_4k (HDRI), земля — щебень, как на ней.
// Два холма-позиции, полоса препятствий (горка, гребёнка, ров, колейный мост,
// воронки, курган, брод, эскарп), мишени по бокам трассы, пути с вагонами,
// козловой кран, контейнеры, пакгауз и ДВЕ цистерны с топливом (взрываются).
// Даёт тот же интерфейс window.MAP, что и остальные карты.
// =============================================================================
(function () {
  'use strict';
  let pick = 'arizona'; try { pick = localStorage.getItem('tanchiki.map') || 'arizona'; } catch (e) { }
  if (pick !== 'training' || window.MAP) return;
  const V3 = THREE.Vector3, HALF = RANGE_HALF, PLAY = RANGE_HALF - 30;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  let seed = 2024; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const rr = (a, b) => a + rnd() * (b - a);
  const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x, z) => { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); return mix(mix(hash(i, j), hash(i + 1, j), u), mix(hash(i, j + 1), hash(i + 1, j + 1), u), v); };

  // ---------------------------------------------------------------------------
  // РЕЛЬЕФ: аналитическая функция высоты
  // ---------------------------------------------------------------------------
  const HILLS = [{ x: 268, z: -150, R: 54, h: 8.5 }, { x: -262, z: 185, R: 54, h: 8.5 }];     // плоская вершина, пологие въезды
  const LANE = 7.5, WL = -0.3;                                                              // полуширина трассы; уровень воды в броде
  // трапеция вдоль трассы: въезд, площадка, съезд
  const trap = (x, c, up, top, down, h) => { const s = x - (c - top / 2 - up); return s < 0 ? 0 : s < up ? h * smooth(0, up, s) : s < up + top ? h : h * (1 - smooth(0, down, s - up - top)); };
  const OBST = [
    { x: -330, name: 'Горка', f: x => trap(x, -330, 8, 6, 8, 2.2) },
    { x: -245, name: 'Гребёнка', f: x => Math.abs(x + 245) < 13.5 ? 0.55 * Math.pow(Math.sin((x + 245 + 13.5) / 4.5 * Math.PI), 2) : 0 },
    { x: -160, name: 'Ров', f: x => -trap(x, -160, 6, 4, 6, 1.8) },
    { x: -75, name: 'Колейный мост', f: x => trap(x, -75, 5, 14, 5, 1.3) },
    { x: 60, name: 'Воронки', f: (x, z) => { let h = 0; for (const [cx, cz] of [[48, -3], [60, 3.2], [72, -2.4]]) { const d = Math.hypot(x - cx, z - cz); h -= 1.25 * (1 - smooth(1.5, 6, d)) - 0.3 * Math.exp(-Math.pow((d - 6.6) / 1.2, 2)); } return h; }, free: true },
    { x: 150, name: 'Курган', f: x => trap(x, 150, 11, 3, 11, 3.6) },
    { x: 240, name: 'Брод', f: x => -trap(x, 240, 7, 22, 7, 1.15) },
    { x: 330, name: 'Эскарп', f: x => trap(x, 330, 5, 13, 9, 1.6) }
  ];
  // ---------------------------------------------------------------------------
  // «ЗМЕЙКА»: трасса через всю карту (по эскизу): от восточного конца прямой полосы на юг, петля,
  // на север через полосу, петля у северного края, на юг через полосу, петля и по диагонали к станции.
  // ---------------------------------------------------------------------------
  const SNAKE_CTRL = [[400, 0], [424, -40], [432, -130], [432, -300], [412, -388], [352, -436], [270, -444], [188, -436], [128, -388], [107, -300], [107, -120], [107, 0], [107, 150], [107, 300],
    [92, 384], [44, 432], [-6, 444], [-58, 432], [-104, 384], [-120, 300], [-120, 150], [-120, 0], [-120, -150], [-122, -300], [-140, -380], [-178, -424], [-222, -436], [-266, -420], [-296, -366], [-318, -270], [-346, -160], [-376, -66], [-394, -18], [-400, 0]];
  const SNAKE = [];                                   // плотные точки через 1 м: {x, z, s, tx, tz}
  { const C = SNAKE_CTRL, cr = (a, b, c, d, t) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t), raw = [];
    for (let i = 0; i < C.length - 1; i++) { const p0 = C[Math.max(0, i - 1)], p1 = C[i], p2 = C[i + 1], p3 = C[Math.min(C.length - 1, i + 2)]; for (let k = 0; k < 40; k++) { const t = k / 40; raw.push([cr(p0[0], p1[0], p2[0], p3[0], t), cr(p0[1], p1[1], p2[1], p3[1], t)]); } }
    raw.push(C[C.length - 1]);
    let acc = 0, next = 0, sLen = 0;
    for (let i = 1; i < raw.length; i++) { const dx = raw[i][0] - raw[i - 1][0], dz = raw[i][1] - raw[i - 1][1], L = Math.hypot(dx, dz);
      while (next <= acc + L) { const t = (next - acc) / (L || 1); SNAKE.push({ x: raw[i - 1][0] + dx * t, z: raw[i - 1][1] + dz * t, s: next, tx: dx / (L || 1), tz: dz / (L || 1) }); next += 1; }
      acc += L; } }
  const SN_CELL = 2.5, SN_N = Math.ceil(HALF * 2 / SN_CELL), snGrid = new Int32Array(SN_N * SN_N).fill(-1), snD = new Float32Array(SN_N * SN_N).fill(1e9);
  SNAKE.forEach((p, i) => { const R = 15, i0 = Math.max(0, Math.floor((p.x - R + HALF) / SN_CELL)), i1 = Math.min(SN_N - 1, Math.floor((p.x + R + HALF) / SN_CELL)), j0 = Math.max(0, Math.floor((p.z - R + HALF) / SN_CELL)), j1 = Math.min(SN_N - 1, Math.floor((p.z + R + HALF) / SN_CELL));
    for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) { const d = Math.hypot(-HALF + (ii + 0.5) * SN_CELL - p.x, -HALF + (j + 0.5) * SN_CELL - p.z), k = j * SN_N + ii; if (d < snD[k]) { snD[k] = d; snGrid[k] = i; } } });
  const snOut = { d: 1e9, s: 0, lat: 0, i: -1 };
  function snakeAt(x, z) {                              // расстояние до оси змейки, путь вдоль неё, боковое смещение
    const gi = Math.floor((x + HALF) / SN_CELL), gj = Math.floor((z + HALF) / SN_CELL);
    if (gi < 0 || gj < 0 || gi >= SN_N || gj >= SN_N) { snOut.d = 1e9; return snOut; }
    const c = snGrid[gj * SN_N + gi]; if (c < 0) { snOut.d = 1e9; return snOut; }
    let bi = c, bd = 1e9; for (let q = Math.max(0, c - 4); q <= Math.min(SNAKE.length - 1, c + 4); q++) { const p = SNAKE[q], d = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z); if (d < bd) { bd = d; bi = q; } }
    const p = SNAKE[bi], al = (x - p.x) * p.tx + (z - p.z) * p.tz, lat = (x - p.x) * (-p.tz) + (z - p.z) * p.tx;
    snOut.d = Math.sqrt(bd); snOut.s = p.s + al; snOut.lat = lat; snOut.i = bi; return snOut;
  }
  const nearSnake = (x, z, m) => snakeAt(x, z).d < m;
  // препятствия змейки: каждые ~105 м, не ближе 45 м к прямой полосе и к концам
  const SN_KINDS = [
    { name: 'Горка', f: u => trap(u, 0, 8, 6, 8, 2.2) }, { name: 'Ров', f: u => -trap(u, 0, 6, 4, 6, 1.8) },
    { name: 'Гребёнка', f: u => Math.abs(u) < 13.5 ? 0.55 * Math.pow(Math.sin((u + 13.5) / 4.5 * Math.PI), 2) : 0 }, { name: 'Курган', f: u => trap(u, 0, 11, 3, 11, 3.4) },
    { name: 'Эскарп', f: u => trap(u, 0, 5, 13, 9, 1.6) }, { name: 'Двойной вал', f: u => trap(u, -8, 5, 2, 5, 1.5) + trap(u, 8, 5, 2, 5, 1.5) },
    { name: 'Яма', f: u => -trap(u, 0, 7, 9, 7, 1.5) }, { name: 'Колейный мост', f: u => trap(u, 0, 5, 14, 5, 1.3) }
  ];
  const SN_OBST = [];
  { const total = SNAKE[SNAKE.length - 1].s; let k = 0; for (let sc = 70; sc < total - 60; sc += 105) { const p = SNAKE[Math.round(sc)]; if (Math.abs(p.z) < 46) continue; const kd = SN_KINDS[k++ % SN_KINDS.length]; SN_OBST.push({ s: sc, x: p.x, z: p.z, tx: p.tx, tz: p.tz, name: kd.name, f: kd.f }); } }
  function H(x, z) {
    let h = 0;
    { const q = snakeAt(x, z); if (q.d < 13) { const w = 1 - smooth(LANE + 0.5, LANE + 4, q.d), s0 = q.s; for (let i = 0; i < SN_OBST.length; i++) { const u = s0 - SN_OBST[i].s; if (u > -30 && u < 30) h += SN_OBST[i].f(u) * w; } } }
    for (const k of HILLS) { const d = Math.hypot(x - k.x, z - k.z); if (d < k.R) h += k.h * (1 - smooth(k.R * 0.3, k.R, d)); }
    const az = Math.abs(z);
    if (az < 13 && Math.abs(x) < 400) {
      const w = 1 - smooth(LANE + 0.5, LANE + 4, az);
      for (const o of OBST) if (Math.abs(x - o.x) < 30) h += o.f(x, z) * (o.free ? 1 : w);
    }
    h += (vnoise(x * 0.05, z * 0.05) - 0.5) * 0.35 * smooth(14, 30, az) * smooth(0, 40, HALF - 20 - Math.max(Math.abs(x), az));   // лёгкая неровность поля
    return h;
  }
  function grade(x, z) { const e = 1.5; const gx = (H(x + e, z) - H(x - e, z)) / (2 * e), gz = (H(x, z + e) - H(x, z - e)) / (2 * e); return Math.sqrt(gx * gx + gz * gz); }
  function normalAt(x, z, out) { const e = 1.5; out = out || new V3(); return out.set(H(x - e, z) - H(x + e, z), 2 * e, H(x, z - e) - H(x, z + e)).normalize(); }
  const MAXH = 9.5;
  const inFord = (x, z) => Math.abs(x - 240) < 19 && Math.abs(z) < LANE + 3;
  const waterLevel = (x, z) => inFord(x, z) ? WL : -1e3;
  const waterDepth = (x, z) => inFord(x, z) ? Math.max(0, WL - H(x, z)) : 0;

  // ---------------------------------------------------------------------------
  // МЕШ ЗЕМЛИ: мелкая сетка на трассе, крупная в поле
  // ---------------------------------------------------------------------------
  const world = new THREE.Group(); world.name = 'TrainingField';
  const axis = (fine0, fine1, fineStep, coarse) => { const a = []; let v = -HALF; while (v < HALF - 1e-6) { a.push(v); v += (v >= fine0 - 1e-6 && v < fine1 - 1e-6) ? fineStep : Math.min(coarse, v < fine0 ? fine0 - v : HALF - v); } a.push(HALF); return a; };
  const steps = (f) => { const a = []; let v = -HALF; while (v < HALF - 1e-6) { a.push(v); v = Math.min(HALF, v + f(v)); } a.push(HALF); return a; };
  const xs = steps(v => Math.abs(v) < 452 ? 1.25 : 6), zs = steps(v => Math.abs(v) < 15 ? 0.5 : Math.abs(v) < 456 ? 1.25 : 6);
  {
    const nx = xs.length, nz = zs.length, P = new Float32Array(nx * nz * 3), Cc = new Float32Array(nx * nz * 3), U = new Float32Array(nx * nz * 2);
    const c = new THREE.Color(), gravel = new THREE.Color(0x6e5a4c), gravel2 = new THREE.Color(0x58493f), dirt = new THREE.Color(0x4a3b2e), rut = new THREE.Color(0x2f251d), grass = new THREE.Color(0x5b6238), ballast = new THREE.Color(0x565250), mud = new THREE.Color(0x3a3327);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = xs[i], z = zs[j], k = j * nx + i, h = H(x, z), az = Math.abs(z);
      P[k * 3] = x; P[k * 3 + 1] = h; P[k * 3 + 2] = z; U[k * 2] = x / 3; U[k * 2 + 1] = z / 3;
      c.copy(gravel).lerp(gravel2, vnoise(x * 0.03, z * 0.03));
      c.lerp(grass, smooth(0.45, 0.75, vnoise(x * 0.012 + 9, z * 0.012 - 4)) * 0.6);              // пятна бурьяна
      for (const hl of HILLS) { const d = Math.hypot(x - hl.x, z - hl.z); c.lerp(grass, (1 - smooth(hl.R * 0.25, hl.R * 1.05, d)) * 0.55); }
      if (Math.abs(x) < 404) {                                                                       // трасса: разбитый грунт и колеи
        const lane = 1 - smooth(LANE - 0.5, LANE + 2.5, az + (vnoise(x * 0.2, z * 0.2) - 0.5) * 2);
        c.lerp(dirt, lane * 0.9);
        const r = Math.min(Math.abs(az - 1.45), Math.abs(az - 4.4));
        c.lerp(rut, lane * (1 - smooth(0.25, 0.75, r)) * 0.7);
        if (inFord(x, z)) c.lerp(mud, smooth(0.0, 0.5, WL + 0.5 - h));
      }
      { const q = snakeAt(x, z); if (q.d < 12) {                                                    // змейка: тот же разбитый грунт и колеи
          const lane = 1 - smooth(LANE - 0.5, LANE + 2.5, q.d + (vnoise(x * 0.2, z * 0.2) - 0.5) * 2), al = Math.abs(q.lat);
          c.lerp(dirt, lane * 0.9); c.lerp(rut, lane * (1 - smooth(0.3, 1.0, Math.min(Math.abs(al - 1.45), Math.abs(al - 4.4)))) * 0.7); } }
      if (x < -412 && x > -442 && az < 400) c.lerp(ballast, 0.9);                                    // балласт под путями
      c.multiplyScalar(0.9 + 0.2 * hash(x * 3.1, z * 2.7));
      Cc[k * 3] = c.r; Cc[k * 3 + 1] = c.g; Cc[k * 3 + 2] = c.b;
    }
    const I = new Uint32Array((nx - 1) * (nz - 1) * 6); let p = 0;
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, cc = a + nx, d = cc + 1; I[p++] = a; I[p++] = cc; I[p++] = b; I[p++] = b; I[p++] = cc; I[p++] = d; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(Cc, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    g.setIndex(new THREE.BufferAttribute(I, 1)); g.computeVertexNormals();
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x2 = cv.getContext('2d'), img = x2.createImageData(256, 256);
    for (let i = 0; i < 65536; i++) { let v = 205 + (Math.random() - 0.5) * 60; if (Math.random() < 0.03) v -= 70; if (Math.random() < 0.02) v += 40; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = clamp(v, 0, 255); img.data[i * 4 + 3] = 255; }
    x2.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
    const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.95, metalness: 0 }));
    ground.receiveShadow = true; world.add(ground);
    // поле за забором — до горизонта панорамы
    const far = new THREE.Mesh(new THREE.RingGeometry(HALF * 0.98, 5200, 48, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5f5244, roughness: 1 }));
    far.position.y = -0.05; world.add(far);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(38, (LANE + 3) * 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3f4a44, roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.82 }));
    water.position.set(240, WL, 0); world.add(water);
  }

  // ---------------------------------------------------------------------------
  // НЕБО: панорама грузовой станции
  // ---------------------------------------------------------------------------
  const SUN_U = 0.586, SUN_EL = 0.5;
  const SUN_DIR = new V3(-Math.cos(SUN_U * Math.PI * 2) * Math.cos(SUN_EL), Math.sin(SUN_EL), Math.sin(SUN_U * Math.PI * 2) * Math.cos(SUN_EL)).normalize();
  if (window.FREIGHT_SKY_B64) {
    const im = new Image(); const st = new THREE.Texture(im); im.onload = () => { st.needsUpdate = true; }; im.src = 'data:image/jpeg;base64,' + window.FREIGHT_SKY_B64;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), new THREE.MeshBasicMaterial({ map: st, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -1; sky.position.y = -60; sky.frustumCulled = false; world.add(sky);
  }

  // ---------------------------------------------------------------------------
  // ОБЪЕКТЫ
  // ---------------------------------------------------------------------------
  const blockers = [], boxes = [], colliders = [], props = [], fuel = [];
  const M = (color, rough = 0.85, metal = 0.1) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const ribTex = (base, dark) => { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 8) { const gr = g.createLinearGradient(x, 0, x + 8, 0); gr.addColorStop(0, 'rgba(255,255,255,0.14)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0.14)'); g.fillStyle = gr; g.fillRect(x, 0, 8, 128); }
    for (let i = 0; i < 70; i++) { g.fillStyle = dark; g.globalAlpha = Math.random() * 0.35; g.fillRect(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 22, 3 + Math.random() * 40); } g.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const ribM = (base, dark = '#3a1d10', rx = 4) => { const t = ribTex(base, dark); t.repeat.set(rx, 1); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: 0.35 }); };
  const MT = { rust: ribM('#6b3a26'), brown: ribM('#57352a'), blue: ribM('#2f4d6b'), green: ribM('#3d5a3f'), grey: ribM('#7a7c7a', '#4a3a2c'), red: ribM('#8a3327'), ochre: ribM('#a8792c'),
    steel: M(0x2b2b2d, 0.6, 0.6), dark: M(0x1b1b1c, 0.8, 0.3), wood: M(0x4a3a2b, 0.95, 0), concrete: M(0x8d8a84, 0.95, 0), yellow: M(0xc79a1e, 0.6, 0.3), white: M(0xd9d6cc, 0.8, 0), stripe: M(0xb3261e, 0.7, 0), tank: M(0x9aa0a0, 0.45, 0.6), tankDark: M(0x23282a, 0.5, 0.5) };
  const blockerMat = new THREE.MeshBasicMaterial({ visible: false });
  function box(parent, w, h, d, mat, x, y, z, ry = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
  function cyl(parent, r, len, mat, x, y, z, axisZ = true, seg = 20) { const g = new THREE.CylinderGeometry(r, r, len, seg); if (axisZ) g.rotateX(Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
  // твёрдое тело: коллайдер + блокер снарядов; opts.bld — разрушаемое, opts.fuel — взрывается
  function solid(root, hw, hd, h, o = {}) {
    const ry = root.rotation.y, y0 = root.position.y - 0.2;
    const sb = { x: root.position.x, z: root.position.z, hw, hd, rot: -ry, y0, h }; boxes.push(sb);
    const bm = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, h, hd * 2), blockerMat); bm.position.set(sb.x, y0 + h / 2, sb.z); bm.rotation.y = ry; bm.updateMatrixWorld(true); world.add(bm); blockers.push(bm);
    if (o.bld) bm.userData.bld = { root, simple: true, box: sb, blocker: bm, hw, hd, h, cx: sb.x, cz: sb.z, rot: ry, need: 3, kind: o.bld };
    if (o.fuel) { const f = { root, box: sb, blocker: bm, center: new V3(sb.x, y0 + h * 0.6, sb.z), name: o.fuel, dead: false }; bm.userData.fuel = f; fuel.push(f); }
    return bm;
  }
  const put = (g, x, z, ry = 0) => { g.position.set(x, H(x, z), z); g.rotation.y = ry; world.add(g); return g; };
  // тележки и рама вагона
  function bogies(g, L) { for (const s of [-1, 1]) { box(g, 2.0, 0.35, 2.6, MT.dark, 0, 0.75, s * (L / 2 - 2.2)); for (const a of [-0.9, 0.9]) for (const sx of [-0.78, 0.78]) { const w = cyl(g, 0.48, 0.14, MT.steel, sx, 0.48, s * (L / 2 - 2.2) + a, false, 14); w.rotation.z = Math.PI / 2; } } box(g, 2.6, 0.3, L, MT.dark, 0, 1.15, 0); }
  function boxcar(mat) { const g = new THREE.Group(), L = 13.6; bogies(g, L); box(g, 3.0, 2.9, L - 0.3, mat, 0, 2.75, 0); box(g, 3.1, 0.18, L, MT.dark, 0, 4.28, 0); for (const sx of [-1, 1]) box(g, 0.08, 2.5, 2.2, MT.dark, sx * 1.52, 2.6, 0.4); return { g, hw: 1.6, hd: L / 2, h: 4.4 }; }
  function gondola(mat) { const g = new THREE.Group(), L = 13.2; bogies(g, L); box(g, 2.9, 0.2, L - 0.3, mat, 0, 1.4, 0); for (const sx of [-1, 1]) box(g, 0.12, 1.9, L - 0.3, mat, sx * 1.45, 2.35, 0); for (const sz of [-1, 1]) box(g, 2.9, 1.9, 0.12, mat, 0, 2.35, sz * (L / 2 - 0.2)); box(g, 2.6, 0.7, L - 1, M(0x2a2622, 1, 0), 0, 2.6, 0); return { g, hw: 1.55, hd: L / 2, h: 3.4 }; }
  function tankCar() { const g = new THREE.Group(), L = 12.2; bogies(g, L); cyl(g, 1.5, L - 1.2, MT.tankDark, 0, 2.85, 0); for (const sz of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(1.5, 18, 10), MT.tankDark); e.scale.z = 0.35; e.position.set(0, 2.85, sz * (L / 2 - 0.6)); e.castShadow = true; g.add(e); }
    cyl(g, 0.45, 0.6, MT.tankDark, 0, 4.5, 0, false); box(g, 0.9, 0.06, L - 2, MT.steel, 0, 4.42, 0); for (const sz of [-3.5, 0, 3.5]) box(g, 3.05, 0.14, 0.5, MT.yellow, 0, 2.85, sz); box(g, 0.05, 0.9, 2.6, MT.white, 1.5, 2.9, 0); return { g, hw: 1.6, hd: L / 2, h: 4.8 }; }
  function container(mat, L = 6.06) { const g = new THREE.Group(); const b = box(g, 2.44, 2.59, L, mat, 0, 1.3, 0); b.material = mat; box(g, 2.2, 2.3, 0.06, MT.dark, 0, 1.3, L / 2 + 0.02); return { g, hw: 1.22, hd: L / 2, h: 2.6 }; }

  // --- пути вдоль западного края: рельсы, шпалы
  const TRACKS = [-434, -421];
  { const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(2.7, 0.16, 0.26), MT.wood, TRACKS.length * 1280), d = new THREE.Object3D(); let n = 0;
    for (const tx of TRACKS) { for (let z = -384; z < 384; z += 0.6) { d.position.set(tx, 0.1, z); d.rotation.y = (rnd() - 0.5) * 0.04; d.updateMatrix(); sl.setMatrixAt(n++, d.matrix); } for (const sx of [-0.76, 0.76]) box(world, 0.08, 0.16, 768, MT.steel, tx + sx, 0.26, 0).castShadow = false; }
    sl.count = n; sl.receiveShadow = true; world.add(sl); }
  // --- составы
  const CARS = [[0, -300, 'box', 'brown'], [0, -285.6, 'box', 'rust'], [0, -271.4, 'gon', 'rust'], [0, -150, 'gon', 'brown'], [0, -136, 'box', 'green'], [0, 96, 'TANK'], [0, 110.4, 'gon', 'rust'], [0, 124.6, 'box', 'brown'],
    [1, -210, 'gon', 'brown'], [1, -196, 'gon', 'rust'], [1, -110, 'TANK'], [1, -20, 'box', 'rust'], [1, -5.8, 'box', 'brown'], [1, 240, 'box', 'red'], [1, 254.2, 'gon', 'rust'], [1, 268.4, 'box', 'brown']];
  for (const [t, z, kind, col] of CARS) {
    const c = kind === 'TANK' ? tankCar() : kind === 'box' ? boxcar(MT[col]) : gondola(MT[col]);
    c.g.position.set(TRACKS[t], 0.18, z); world.add(c.g); solid(c.g, c.hw, c.hd, c.h, kind === 'TANK' ? { fuel: 'Вагон-цистерна ' + (z > 0 ? '(север)' : '(юг)') } : {});
  }
  // --- козловой кран над путями
  { const g = new THREE.Group(), SP = 34, HT = 13;
    for (const sx of [-1, 1]) { for (const sz of [-1, 1]) { const leg = box(g, 0.7, HT, 0.7, MT.ochre, sx * SP / 2, HT / 2, sz * 3.2); leg.rotation.x = -sz * 0.09; } box(g, 1.0, 0.8, 8.5, MT.ochre, sx * SP / 2, 0.5, 0); box(g, 0.5, 0.5, 6.6, MT.ochre, sx * SP / 2, HT * 0.55, 0); }
    box(g, SP + 9, 1.8, 1.0, MT.ochre, 0, HT + 0.6, -1.4); box(g, SP + 9, 1.8, 1.0, MT.ochre, 0, HT + 0.6, 1.4);
    for (let x = -SP / 2 - 4; x <= SP / 2 + 4; x += 3) box(g, 0.2, 0.2, 2.8, MT.ochre, x, HT + 1.4, 0);
    box(g, 3.2, 2.2, 3.4, MT.yellow, 5, HT - 0.8, 0); box(g, 0.1, 6, 0.1, MT.dark, 5, HT - 4.8, 0); box(g, 1.4, 0.5, 0.5, MT.dark, 5, HT - 8, 0);
    box(g, 2.4, 2.2, 2.2, MT.white, -SP / 2 + 2.6, HT - 1.6, 2.6);
    g.position.set(-427, 0, 190); world.add(g);
    for (const sx of [-1, 1]) { const x = -427 + sx * SP / 2; boxes.push({ x, z: 190, hw: 0.7, hd: 4.2, rot: 0, y0: 0, h: HT }); const bm = new THREE.Mesh(new THREE.BoxGeometry(1.4, HT, 8.4), blockerMat); bm.position.set(x, HT / 2, 190); bm.updateMatrixWorld(true); world.add(bm); blockers.push(bm); } }
  // --- контейнеры: штабели-укрытия
  const CCOL = ['rust', 'blue', 'green', 'grey', 'red', 'ochre'];
  const onHill = (x, z, m = 8) => HILLS.some(h => Math.hypot(x - h.x, z - h.z) < h.R + m);
  function stack(x, z, ry, n, long) { if (nearSnake(x, z, 14) || nearSnake(x + Math.cos(ry) * 6, z - Math.sin(ry) * 6, 14) || onHill(x, z)) return; for (let i = 0; i < n; i++) { const c = container(MT[CCOL[Math.floor(rnd() * 6)]], long ? 12.19 : 6.06), up = i >= 2 && n > 2;
      const ox = up ? 1.3 : i * 2.62, lx = x + Math.cos(ry) * ox, lz = z - Math.sin(ry) * ox;
      c.g.position.set(lx, H(lx, lz) + (up ? 2.62 : 0.02), lz); c.g.rotation.y = ry + (rnd() - 0.5) * 0.05; world.add(c.g); if (!up) solid(c.g, c.hw, c.hd, n > 2 ? 5.3 : c.h); } }
  [[-395, 150, 0, 3, true], [-398, 215, 0, 2, true], [-392, -60, 0, 3, false], [-95, -190, 0.6, 3, false], [70, -160, -0.4, 2, true], [-60, 150, 0.3, 2, true], [110, 205, 1.2, 3, false], [-260, 80, 1.57, 2, false], [270, -70, 1.57, 3, false], [0, 62, 1.57, 2, false], [20, -62, 1.57, 2, false], [-300, -190, 0.9, 2, true], [330, 230, 0.2, 2, true], [-60, -150, 0.5, 3, false], [200, 250, 0.9, 2, true], [-240, -250, 0.2, 2, false], [20, 330, 1.2, 2, false], [-200, 60, 0.4, 3, false], [190, -60, 1.0, 2, true]].forEach(a => stack(...a));
  // --- пакгауз (разрушаемый) и бетонные плиты
  { const g = new THREE.Group(), W = 14, L = 34, HT = 6.5; box(g, W, HT, L, MT.grey, 0, HT / 2, 0); const roof = box(g, W + 1, 0.3, L + 1, MT.brown, 0, HT + 0.6, 0); roof.rotation.z = 0.06;
    for (let z = -12; z <= 12; z += 8) { box(g, 0.1, 3.6, 3.4, MT.dark, -W / 2 - 0.03, 1.9, z); box(g, 0.1, 3.6, 3.4, MT.dark, W / 2 + 0.03, 1.9, z); } box(g, 3.4, 1.1, L + 2, MT.concrete, -W / 2 - 1.7, 0.55, 0);
    put(g, 385, 60, 0); solid(g, W / 2 + 0.2, L / 2 + 0.2, HT + 0.8, { bld: 'warehouse' }); }
  for (let i = 0; i < 16; i++) { const x = rr(-380, 380), z = (rnd() < 0.5 ? -1 : 1) * rr(40, 330); if (nearSnake(x, z, 13) || onHill(x, z, 0)) continue; const s = box(world, 3, 0.18, 6, MT.concrete, x, H(x, z) + 0.07, z, rnd() * 3); s.castShadow = false; }
  // --- наземные резервуары ГСМ с обваловкой: вместе с вагонами-цистернами — 7 ёмкостей с топливом
  function reservoir(x, z, ry, name) { const g = new THREE.Group(); cyl(g, 2.0, 9.5, MT.tank, 0, 2.9, 0); for (const sz of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(2.0, 18, 10), MT.tank); e.scale.z = 0.4; e.position.set(0, 2.9, sz * 4.75); e.castShadow = true; g.add(e); }
    for (const sz of [-3, 3]) box(g, 3.4, 1.5, 0.7, MT.concrete, 0, 0.75, sz); box(g, 4.3, 0.5, 1.1, MT.stripe, 0, 2.9, 0); cyl(g, 0.3, 0.9, MT.tank, 0, 5.2, 1.5, false); box(g, 0.6, 3.6, 0.08, MT.steel, 2.1, 1.9, -2); box(g, 6.5, 0.4, 13, MT.concrete, 0, 0.1, 0);
    put(g, x, z, ry); solid(g, 2.2, 5.6, 5.2, { fuel: name });
    for (const [dx, dz] of [[6, 11], [8, 8.5], [-7, -8]]) { const b = cyl(world, 0.3, 0.9, MT.red, x + dx, H(x + dx, z + dz) + 0.45, z + dz, false, 12); props.push({ x: x + dx, z: z + dz, r: 0.4, kind: 'small', obj: b, alive: true }); } }
  [[330, -318, 0.5], [-230, 300, 1.2], [250, 110, 0.2], [-30, -85, 1.57], [-235, -130, 0.8]].forEach(([x, z, ry], i) => reservoir(x, z, ry, 'Резервуар ГСМ №' + (i + 1)));
  // --- бочки у цистерн, мачты освещения, габаритные ворота и вешки трассы
  const addProp = (obj, r, kind) => props.push({ x: obj.position.x, z: obj.position.z, r, kind, obj, alive: true });
  for (const [bx, bz] of [[-415, 104], [-414, 106.5], [-402, -118], [-401, -115.5]]) { const b = cyl(world, 0.3, 0.9, bx > 0 ? MT.red : MT.blue, bx, H(bx, bz) + 0.45, bz, false, 12); addProp(b, 0.4, 'small'); }
  function mast(x, z, ht = 12) { const g = new THREE.Group(); box(g, 0.22, ht, 0.22, MT.steel, 0, ht / 2, 0); box(g, 2.4, 0.12, 0.12, MT.steel, 0, ht - 0.2, 0); for (const sx of [-1, 0, 1]) box(g, 0.5, 0.3, 0.35, MT.white, sx * 0.9, ht - 0.45, 0.15); put(g, x, z); addProp(g, 0.5, 'pole'); }
  for (let z = -330; z <= 330; z += 110) mast(-408, z);
  for (const [x, z] of [[-60, -260], [60, -260], [-60, 260], [60, 260], [280, 60], [-250, -60], [300, 320], [-250, 330]]) mast(x, z, 10);
  // стойки и вешки вдоль змейки: p — точка оси, off — вбок
  const sideAt = (p, off, f) => { const x = p.x - p.tz * off, z = p.z + p.tx * off; if (Math.abs(z) < LANE + 4 && Math.abs(x) < 404) return; f(x, z, Math.atan2(p.tx, p.tz)); };
  function gateAt(x, z, ry, sd) { const g = new THREE.Group(); box(g, 0.14, 3.4, 0.14, MT.dark, 0, 1.7, 0); box(g, 2.6, 0.1, 0.1, MT.dark, -sd * 1.3, 3.3, 0); box(g, 0.12, 0.9, 0.12, MT.white, -sd * 2.55, 2.9, 0); box(g, 0.13, 0.3, 0.13, MT.stripe, -sd * 2.55, 2.9, 0); put(g, x, z, ry); addProp(g, 0.35, 'pole'); }
  function gate(x, sd) {                                               // Г-образная габаритная стойка, как на танкодроме
    const g = new THREE.Group(); box(g, 0.14, 3.4, 0.14, MT.dark, 0, 1.7, 0); const arm = box(g, 0.1, 0.1, 2.6, MT.dark, 0, 3.3, -sd * 1.3); const tip = box(g, 0.12, 0.9, 0.12, MT.white, 0, 2.9, -sd * 2.55); box(g, 0.13, 0.3, 0.13, MT.stripe, 0, 2.9, -sd * 2.55);
    put(g, x, sd * (LANE + 1.8)); addProp(g, 0.35, 'pole'); }
  function post(x, z) { const g = new THREE.Group(); box(g, 0.12, 1.3, 0.12, MT.white, 0, 0.65, 0); box(g, 0.13, 0.3, 0.13, MT.stripe, 0, 0.5, 0); box(g, 0.13, 0.3, 0.13, MT.stripe, 0, 1.1, 0); put(g, x, z); addProp(g, 0.3, 'small'); }
  OBST.forEach((o, i) => { for (const sd of [-1, 1]) { gate(o.x - 17, sd); gate(o.x + 17, sd); post(o.x - 8, sd * (LANE + 1.5)); post(o.x + 8, sd * (LANE + 1.5)); } });
  SN_OBST.forEach(o => { for (const sd of [-1, 1]) for (const du of [-18, 18]) { const p = SNAKE[clamp(Math.round(o.s + du), 0, SNAKE.length - 1)]; sideAt(p, sd * (LANE + 1.8), (x, z, ry) => gateAt(x, z, ry, sd)); } });
  for (let sc = 12; sc < SNAKE.length - 12; sc += 24) { const p = SNAKE[sc]; for (const sd of [-1, 1]) sideAt(p, sd * (LANE + 1.5), (x, z) => post(x, z)); }
  for (let x = -390; x <= 390; x += 26) if (!OBST.some(o => Math.abs(o.x - x) < 20)) for (const sd of [-1, 1]) post(x, sd * (LANE + 1.5));
  // сигнальная мачта-лестница у «Горки» и рельсы колейного моста
  { const g = new THREE.Group(); for (const sx of [-0.3, 0.3]) box(g, 0.08, 6.5, 0.08, MT.dark, sx, 3.25, 0); for (let y = 0.6; y < 6.4; y += 0.7) box(g, 0.6, 0.06, 0.06, MT.dark, 0, y, 0); put(g, -322, -(LANE + 3.5)); addProp(g, 0.5, 'pole'); }
  for (const sz of [-1.45, 1.45]) box(world, 14, 0.12, 1.0, MT.steel, -75, 1.3 + 0.03, sz).castShadow = false;

  // --- мишени: по обе стороны трассы, часть — за холмами
  rangeEnvironmentGroup.traverse(o => { if (o.isMesh && o.geometry && o.geometry.type === 'RingGeometry') o.visible = false; });
  rangeTargets.forEach((t, i) => {
    const n = rangeTargets.length, sd = i % 2 ? 1 : -1, col = Math.floor(i / 2), per = Math.ceil(n / 2);
    const x = -370 + (col + 0.5) * (740 / per) + (sd > 0 ? 14 : -14), z = sd * (30 + (col % 3) * 9);
    t.root.position.set(x, H(x, z), z); t.root.rotation.y = sd > 0 ? Math.PI : 0; t.root.updateMatrixWorld(true);
    blockers.push(t.boardMesh);
    t.boardMesh.userData.onHit = p => { if (!t.fallen) knockDownRangeTarget(t, p); const k = MAP.blockers.indexOf(t.boardMesh); if (k >= 0) MAP.blockers.splice(k, 1); };
  });

  // ---------------------------------------------------------------------------
  // СЦЕНА И ЗАПРОСЫ
  // ---------------------------------------------------------------------------
  groundMesh.visible = false; gridHelper.visible = false; scene.add(world);
  scene.background = new THREE.Color(0xd9d3c4); scene.fog = new THREE.FogExp2(0xd6cfbf, 0.00042);
  camera.far = 9000; camera.updateProjectionMatrix();
  hemiLight.color.set(0xcfdff2); hemiLight.groundColor.set(0x6b5a4a); hemiLight.intensity = 0.85;
  dirLight.color.set(0xffe9c8); dirLight.intensity = 1.5;
  renderer.toneMappingExposure = 0.95;

  const tv = new V3();
  function raycastTerrain(o, d, maxDist, minDist = 0) {
    let t = minDist, above = o.y + d.y * t - H(o.x + d.x * t, o.z + d.z * t);
    if (above < 0) return t;
    while (t < maxDist) {
      if (o.y + d.y * t > MAXH + 1 && d.y >= 0) return null;
      const t2 = Math.min(maxDist, t + clamp(above * 0.6, 0.5, 12)), a2 = o.y + d.y * t2 - H(o.x + d.x * t2, o.z + d.z * t2);
      if (a2 < 0) { let lo = t, hi = t2; for (let k = 0; k < 10; k++) { const mid = (lo + hi) / 2; if (o.y + d.y * mid - H(o.x + d.x * mid, o.z + d.z * mid) < 0) hi = mid; else lo = mid; } return hi; }
      if (t2 >= maxDist) return null; t = t2; above = a2;
    }
    return null;
  }
  function rayBox(o, d, maxDist, b) {
    const c = Math.cos(-b.rot), s = Math.sin(-b.rot), ox = o.x - b.x, oz = o.z - b.z;
    const lx = ox * c - oz * s, lz = ox * s + oz * c, ly = o.y - b.y0, dx = d.x * c - d.z * s, dz = d.x * s + d.z * c;
    let t0 = 0, t1 = maxDist;
    for (const [p, v, lo, hi] of [[lx, dx, -b.hw, b.hw], [ly, d.y, 0, b.h], [lz, dz, -b.hd, b.hd]]) {
      if (Math.abs(v) < 1e-9) { if (p < lo || p > hi) return null; continue; }
      let a1 = (lo - p) / v, a2 = (hi - p) / v; if (a1 > a2) { const t = a1; a1 = a2; a2 = t; }
      t0 = Math.max(t0, a1); t1 = Math.min(t1, a2); if (t0 > t1) return null;
    }
    return t0;
  }
  function hasLOS(a, b) { tv.copy(b).sub(a); const dist = tv.length(); tv.divideScalar(dist); for (let i = 0; i < boxes.length; i++) if (rayBox(a, tv, dist - 1, boxes[i]) !== null) return false; return raycastTerrain(a, tv, dist - 1.5, 1) === null; }
  function collide(p, radius) {
    let hit = null;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i], c = Math.cos(-b.rot), s = Math.sin(-b.rot), ox = p.x - b.x, oz = p.z - b.z;
      const lx = ox * c - oz * s, lz = ox * s + oz * c, qx = clamp(lx, -b.hw, b.hw), qz = clamp(lz, -b.hd, b.hd), ddx = lx - qx, ddz = lz - qz, d2 = ddx * ddx + ddz * ddz;
      if (d2 >= radius * radius) continue;
      let nx, nz;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); nx = qx + ddx / d * radius; nz = qz + ddz / d * radius; }
      else { const px = b.hw - Math.abs(lx), pz = b.hd - Math.abs(lz); if (px < pz) { nx = Math.sign(lx || 1) * (b.hw + radius); nz = lz; } else { nx = lx; nz = Math.sign(lz || 1) * (b.hd + radius); } }
      const c2 = Math.cos(b.rot), s2 = Math.sin(b.rot); p.x = b.x + nx * c2 - nz * s2; p.z = b.z + nx * s2 + nz * c2; hit = b;
    }
    return hit;
  }
  function crushAt(x, z, radius, dirX, dirZ) {
    let n = 0;
    rangeTargets.forEach(t => { if (t.fallen) return; const dx = t.root.position.x - x, dz = t.root.position.z - z; if (dx * dx + dz * dz < (radius + 1.5) ** 2) { t.boardMesh.userData.onHit(t.root.position.clone().add(new V3(0, 1, 0))); n++; } });
    for (const pr of props) {
      if (!pr.alive) continue; const dx = x - pr.x, dz = z - pr.z, r2 = pr.r + radius; if (dx * dx + dz * dz > r2 * r2) continue;
      pr.alive = false; n++; const o = pr.obj, ax = new V3(dirZ, 0, -dirX).normalize(), q0 = o.quaternion.clone(), q1 = new THREE.Quaternion().setFromAxisAngle(ax, Math.PI / 2 * 0.97).multiply(q0), st = { t: 0 };
      gsap.to(st, { t: 1, duration: pr.kind === 'pole' ? 1.0 : 0.45, ease: 'power2.in', onUpdate: () => o.quaternion.copy(q0).slerp(q1, st.t) });
      if (pr.kind === 'small') gsap.to(o.position, { x: o.position.x + dirX * 1.5, z: o.position.z + dirZ * 1.5, duration: 0.45 });
    }
    return n;
  }
  function isPassable(x, z) {
    if (Math.max(Math.abs(x), Math.abs(z)) > PLAY || x < -400) return false;
    if (grade(x, z) > 0.4 || waterDepth(x, z) > 0.1) return false;
    const p = { x, z }; if (collide(p, 5) && (Math.abs(p.x - x) > 0.01 || Math.abs(p.z - z) > 0.01)) return false;
    return true;
  }
  function minimapColor(x, z, h) {
    if (waterDepth(x, z) > 0.02) return [62, 100, 130];
    if (x < -412 && x > -442 && Math.abs(z) < 386) return [92, 88, 86];
    if ((Math.abs(z) < LANE && Math.abs(x) < 400) || nearSnake(x, z, LANE)) return [96, 78, 62];
    const k = clamp(h / 8.5, 0, 1); return [mix(132, 120, k), mix(112, 124, k), mix(92, 78, k)];
  }
  window.MAP = {
    id: 'training', name: 'Training Field', H, grade, normalAt, raycastTerrain, hasLOS, collide, crushAt, isPassable, rayBox,
    blockers, colliders, boxes, cylinders: [], props, fuel, formations: [], TOWN: null, inTown: () => false,
    PLAY, SUN_DIR, MAXH, world, waterDepth, waterLevel, minimapColor, obstacles: OBST, hills: HILLS, snake: SNAKE, snakeObstacles: SN_OBST,
    labels: [{ x: HILLS[0].x, z: HILLS[0].z, text: 'Холм А', color: '#ffe08a' }, { x: HILLS[1].x, z: HILLS[1].z, text: 'Холм Б', color: '#ffe08a' },
      { x: -395, z: -410, text: 'Станция' }, { x: 385, z: 100, text: 'Пакгауз', big: true }, { x: -427, z: 222, text: 'Кран', big: true },
      { x: 0, z: 16, text: 'Полоса препятствий', size: 4.8 }, { x: -6, z: 418, text: 'Змейка', size: 4.8 }]
      .concat(SN_OBST.map(o => ({ x: o.x - o.tz * 26, z: o.z + o.tx * 26, text: o.name, big: true, size: 3.4 }))).concat(OBST.map((o, i) => ({ x: o.x, z: -15, text: (i + 1) + '. ' + o.name, big: true, size: 3.4 }))),
    playerSpawn: new V3(0, H(0, -220), -220), playerHeading: 0, enemySpawn: new V3(20, H(20, 220), 220), enemyHeading: Math.PI,
    dustColor: 0x8a7868
  };
  tankRoot.rotation.order = 'YXZ'; tankRoot.position.copy(window.MAP.playerSpawn);
})();
