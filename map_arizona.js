// =============================================================================
// КАРТА «АРИЗОНА» — процедурная, полностью вымышленная
// Знойная пустыня: красные столовые горы и останцы, сухие русла (арройо),
// осыпи, сагуаро, опунции, окотильо, кусты креозота, пучки сухой травы.
// Подключается после основного скрипта index.html и ДО battle.js.
// Экспортирует window.MAP: высоты, лучи по рельефу, укрытия, коллайдеры.
// =============================================================================
(function () {
  'use strict';
  { let pick = 'arizona'; try { pick = localStorage.getItem('tanchiki.map') || 'arizona'; } catch (e) { } if (pick !== 'arizona') return; }

  // ---------------------------------------------------------------------------
  // 0. ПАРАМЕТРЫ
  // ---------------------------------------------------------------------------
  const SEED = 1912;                 // год, когда Аризона стала штатом :)
  const SIZE = 1400;                 // сторона террейна, м
  const HALF = SIZE / 2;
  const SEG = 466;                   // ячейка 3 м
  const CELL = SIZE / SEG;
  const PLAY = 470;                  // зона боя (дальше — стены каньона)
  const BASE = 6;                    // подъём всего рельефа, чтобы низины были > 0
  const PLAYER_SPAWN = { x: 0, z: -260, heading: 0 };
  const ENEMY_SPAWN = { x: 20, z: 260, heading: Math.PI };
  const SUN_DIR = new THREE.Vector3(-0.42, 0.78, -0.46).normalize();
  // городок у дороги: выровненная площадка
  // x, z — ось главной улицы; pad — ровная площадка всего города вместе с жилыми кварталами
  const TOWN = { x: -240, z: 30, hx: 60, hz: 95, h: BASE + 1.0, fall: 35, pad: { x0: -402, x1: -138, z0: -84, z1: 198 } };

  // ---------------------------------------------------------------------------
  // 1. ШУМ (seeded simplex 2D) и утилиты
  // ---------------------------------------------------------------------------
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const rnd = mulberry32(SEED);
  const rr = (a, b) => a + rnd() * (b - a);
  const perm = new Uint8Array(512);
  { const p = new Uint8Array(256); for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
  const GR = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  function sn(xin, yin) {
    const s = (xin + yin) * F2; const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2; const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, tt;
    tt = 0.5 - x0 * x0 - y0 * y0; if (tt > 0) { const g = GR[perm[ii + perm[jj]] & 7]; tt *= tt; n += tt * tt * (g[0] * x0 + g[1] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1; if (tt > 0) { const g = GR[perm[ii + i1 + perm[jj + j1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x1 + g[1] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2; if (tt > 0) { const g = GR[perm[ii + 1 + perm[jj + 1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x2 + g[1] * y2); }
    return 70 * n;
  }
  function fbm(x, z, oct) { let a = 1, f = 1, s = 0, n = 0; for (let o = 0; o < oct; o++) { s += a * sn(x * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }
  const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const gauss = (x, z, cx, cz, r) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------------------
  // 2. РЕЛЬЕФ
  // ---------------------------------------------------------------------------
  // Останцы-«бьютты» в зоне боя — гарантированные укрытия между базами
  const BUTTES = [
    { x: -70, z: -60, r: 22, h: 32, type: 'courthouse' }, { x: 95, z: 25, r: 26, h: 26, type: 'butte' },
    { x: -25, z: 115, r: 17, h: 40, type: 'cathedral' }, { x: 170, z: -150, r: 34, h: 24, type: 'butte' },
    { x: -60, z: 238, r: 30, h: 34, type: 'bell' }, { x: 45, z: -165, r: 8, h: 24, type: 'spire' },
    { x: -110, z: -125, r: 16, h: 22, type: 'bell' }, { x: 205, z: 165, r: 24, h: 38, type: 'cathedral' },
    { x: 15, z: 40, r: 7, h: 19, type: 'spire' }, { x: -250, z: -200, r: 28, h: 30, type: 'courthouse' },
    { x: 270, z: -20, r: 18, h: 24, type: 'bell' }, { x: 140, z: 90, r: 6, h: 17, type: 'spire' },
    { x: -175, z: -150, r: 12, h: 20, type: 'butte' }
  ];

  function mesaProfile(m) {
    const talus = smooth(0.16, 0.34, m) * 6;       // осыпь у подножия
    // стена ступенями-уступами: твёрдые пласты песчаника держат полки
    const c = smooth(0.34, 0.40, m), n = 6, k = c * n, fk = k - Math.floor(k);
    const cliff = ((Math.floor(k) + smooth(0.0, 0.42, fk)) / n) * 26;
    const t2 = smooth(0.62, 0.67, m), k2 = t2 * 3, f2 = k2 - Math.floor(k2);
    const tier = ((Math.floor(k2) + smooth(0.0, 0.45, f2)) / 3) * 15;
    return talus + cliff + tier;
  }

  function townFlat(x, z, extra = 0) {
    const P = TOWN.pad, d = Math.max(P.x0 - x - extra, x - P.x1 - extra, P.z0 - z - extra, z - P.z1 - extra, 0);
    return 1 - smooth(0, TOWN.fall, d);
  }
  const inTown = (x, z, margin = 0) => x > TOWN.pad.x0 - margin && x < TOWN.pad.x1 + margin && z > TOWN.pad.z0 - margin && z < TOWN.pad.z1 + margin;
  function rawHeight(x, z) {
    const tf = townFlat(x, z);
    // пологие увалы и мелкая неровность
    let h = fbm(x * 0.0035, z * 0.0035, 4) * 7.5 + fbm(x * 0.02 + 3.1, z * 0.02 - 7.7, 2) * 0.9;
    // сухие русла (арройо)
    const w = Math.abs(sn(x * 0.0028 + 11.3, z * 0.0028 - 4.2) + 0.25 * sn(x * 0.011, z * 0.011));
    h -= (1 - smooth(0.0, 0.075, w)) * 3.2;
    // поле столовых гор
    let m = fbm(x * 0.0042 + 40, z * 0.0042 - 20, 3);
    const r = Math.max(Math.abs(x), Math.abs(z));
    m += smooth(395, 520, r) * 1.5;                 // стены каньона по периметру
    m -= 0.35 * (1 - smooth(150, 300, Math.abs(x))) * (1 - smooth(380, 450, r)); // центральный коридор чище
    m -= 1.1 * gauss(x, z, PLAYER_SPAWN.x, PLAYER_SPAWN.z, 95) + 1.1 * gauss(x, z, ENEMY_SPAWN.x, ENEMY_SPAWN.z, 95);
    m -= tf * 2.5;
    h += mesaProfile(m);
    // кап-рок: мелкая неровность на вершинах
    if (m > 0.38) h += fbm(x * 0.05, z * 0.05, 2) * 0.8;
    // останцы
    for (let i = 0; i < BUTTES.length; i++) {
      const b = BUTTES[i];
      const dx = x - b.x, dz = z - b.z;
      const d0 = Math.sqrt(dx * dx + dz * dz);
      if (d0 > b.r * 2.4 + 10) continue;
      // под скалой — только осыпной конус (сама скала — отдельный детальный меш)
      const d = d0 + sn(x * 0.05, z * 0.05) * b.r * 0.15;
      const mound = 1 - smooth(b.r * 0.4, b.r * 2.0, d);
      h += b.h * 0.13 * mound * mound * (3 - 2 * mound) + (d < b.r * 1.6 ? sn(x * 0.2, z * 0.2) * 0.4 : 0);
    }
    return (h + BASE) * (1 - tf) + TOWN.h * tf;
  }

  const NV = SEG + 1;
  const heights = new Float32Array(NV * NV);
  for (let j = 0; j < NV; j++) {
    const z = -HALF + j * CELL;
    for (let i = 0; i < NV; i++) heights[j * NV + i] = Math.max(0.3, rawHeight(-HALF + i * CELL, z));
  }

  function H(x, z) {
    const gx = clamp((x + HALF) / CELL, 0, SEG - 1e-4), gz = clamp((z + HALF) / CELL, 0, SEG - 1e-4);
    const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
    const a = heights[j * NV + i], b = heights[j * NV + i + 1], c = heights[(j + 1) * NV + i], d = heights[(j + 1) * NV + i + 1];
    return a * (1 - fx) * (1 - fz) + b * fx * (1 - fz) + c * (1 - fx) * fz + d * fx * fz;
  }
  // уклон: модуль градиента (0 — плоско, 1 — 45°)
  function grade(x, z) {
    const e = 2;
    const gx = (H(x + e, z) - H(x - e, z)) / (2 * e), gz = (H(x, z + e) - H(x, z - e)) / (2 * e);
    return Math.sqrt(gx * gx + gz * gz);
  }
  function normalAt(x, z, out) {
    const e = 2;
    out = out || new THREE.Vector3();
    return out.set(H(x - e, z) - H(x + e, z), 2 * e, H(x, z - e) - H(x, z + e)).normalize();
  }

  // ---------------------------------------------------------------------------
  // 3. МЕШ РЕЛЬЕФА + ЦВЕТА ПО ВЫСОТЕ/УКЛОНУ
  // ---------------------------------------------------------------------------
  const pos = new Float32Array(NV * NV * 3), col = new Float32Array(NV * NV * 3), uv = new Float32Array(NV * NV * 2);
  const C = (hex) => new THREE.Color(hex);
  const SAND = C(0xc4865a), SAND2 = C(0xae6a42), CALICHE = C(0xd8b48a), CRUST = C(0xa85a35);
  const ROCK = [C(0xb4512c), C(0x93391f), C(0xc8703c), C(0xa64627), C(0xd59a6a)];
  const VARNISH = C(0x5e2c1c);
  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NV; i++) {
      const k = j * NV + i;
      const x = -HALF + i * CELL, z = -HALF + j * CELL, h = heights[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      uv[k * 2] = i / SEG; uv[k * 2 + 1] = j / SEG;
      const g = grade(x, z);
      const n1 = sn(x * 0.03, z * 0.03), n2 = sn(x * 0.11 + 5, z * 0.11 - 3);
      // песок
      tmpC.copy(SAND).lerp(SAND2, clamp(0.5 + 0.5 * n1, 0, 1));
      // русла — светлый каличе
      const w = Math.abs(sn(x * 0.0028 + 11.3, z * 0.0028 - 4.2) + 0.25 * sn(x * 0.011, z * 0.011));
      tmpC.lerp(CALICHE, (1 - smooth(0.0, 0.06, w)) * 0.75);
      // корка на высоких плоскостях
      tmpC.lerp(CRUST, smooth(18, 30, h) * 0.55);
      // скала: страты по высоте
      const band = Math.floor((h + n2 * 1.6) / 2.3);
      tmpC2.copy(ROCK[((band % 5) + 5) % 5]);
      if (band % 7 === 3) tmpC2.lerp(C(0xe6c7a2), 0.6);          // светлый прослой
      tmpC2.lerp(VARNISH, smooth(1.2, 3.0, g) * 0.45 * (0.6 + 0.4 * n1)); // «пустынный загар» на стенах
      const rockMix = clamp(smooth(0.45, 0.85, g) + smooth(12, 22, h) * 0.35 * smooth(0.15, 0.4, g), 0, 1);
      tmpC.lerp(tmpC2, rockMix);
      // красная почва и осыпь у подножий формаций
      let near = 0; for (const f of BUTTES) { const d = Math.hypot(x - f.x, z - f.z); near = Math.max(near, 1 - smooth(f.r * 0.9, f.r * 2.2, d)); }
      if (near > 0) tmpC.lerp(C(0x94472a), near * 0.65 * (0.8 + 0.2 * n2));
      // мелкая пятнистость
      tmpC.multiplyScalar(0.92 + 0.12 * n2);
      col[k * 3] = tmpC.r; col[k * 3 + 1] = tmpC.g; col[k * 3 + 2] = tmpC.b;
    }
  }
  const idx = new Uint32Array(SEG * SEG * 6);
  { let p = 0; for (let j = 0; j < SEG; j++) for (let i = 0; i < SEG; i++) {
      const a = j * NV + i, b = a + 1, c = a + NV, d = c + 1;
      idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d; } }
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  tGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  tGeo.computeVertexNormals();
  tGeo.computeBoundingSphere();

  // текстура «зерна» песка/камня (мелкая деталь вблизи)
  function grainTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); const img = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const n = 0.55 * sn(x * 0.09, y * 0.09) + 0.3 * sn(x * 0.3, y * 0.3) + 0.15 * (Math.random() * 2 - 1);
      let v = 222 + n * 26;
      if (Math.random() < 0.012) v -= 60;           // камешки
      const o = (y * 256 + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = clamp(v, 0, 255); img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(SIZE / 6, SIZE / 6);
    t.anisotropy = 8; return t;
  }
  // ---------------------------------------------------------------------------
  // ШЕЙДЕР СКАЛ «СЕДОНА»: пласты песчаника, пустынный загар (тёмные потёки),
  // прожилки и трещины, светлый кап-рок, микрорельеф (bump) — всё процедурно
  // ---------------------------------------------------------------------------
  const ROCK_GLSL = `
    varying vec3 vWPos; varying vec3 vWNorm;
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(h21(i), h21(i+vec2(1.0,0.0)), u.x), mix(h21(i+vec2(0.0,1.0)), h21(i+vec2(1.0,1.0)), u.x), u.y); }
    float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a*vn(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }
    void sedona(vec3 p, vec3 n, out vec3 rockCol, out float rockH, out float mask){
      float slope = 1.0 - clamp(n.y, 0.0, 1.0);
      mask = smoothstep(uRockLo, uRockHi, slope);
      float u = abs(n.x) > abs(n.z) ? p.z : p.x;                       // координата вдоль стены
      float warp = (fbm2(p.xz*0.012) - 0.5)*7.0 + (fbm2(vec2(u*0.05, p.y*0.04)) - 0.5)*2.0;
      float y = p.y + warp;
      // крупные пласты песчаника (формация Шнебли-Хилл): красно-оранжевые с вариацией
      float b1 = sin(y*0.9)*0.5+0.5;
      float b2 = sin(y*0.31 + 1.7)*0.5+0.5;
      float b3 = sin(y*3.1 + fbm2(vec2(u*0.15, y*0.3))*3.0)*0.5+0.5;   // тонкая слоистость
      vec3 c = mix(vec3(0.52,0.15,0.07), vec3(0.70,0.27,0.12), b2);
      c = mix(c, vec3(0.40,0.11,0.05), smoothstep(0.6,1.0,b1)*0.5);   // тёмные уступы
      c = mix(c, vec3(0.86,0.52,0.30), smoothstep(0.96,1.0,sin(y*0.23+0.4))*0.55); // светлые прослои
      c *= 0.93 + 0.1*b3;
      // кремовый кап-рок (Коконино) только на вершинах высоких форм
      float cap = smoothstep(uCapY, uCapY + 5.0, y + (fbm2(p.xz*0.03)-0.5)*4.0);
      c = mix(c, vec3(0.84,0.70,0.54) * (0.94 + 0.06*b3), cap*0.7);
      // пустынный загар: вертикальные тёмные потёки, сверху вниз
      float st = vn(vec2(u*0.35, p.y*0.018))*0.6 + vn(vec2(u*1.3, p.y*0.05))*0.4;
      float streak = smoothstep(0.44, 0.8, st) * smoothstep(0.3, 0.75, slope);
      streak *= 0.6 + 0.4 * smoothstep(0.0, 1.0, fract(p.y*0.02 + vn(vec2(u*0.2, 3.0))));   // потёки темнее под уступами
      c = mix(c, vec3(0.16,0.07,0.04), streak*0.7);
      // вертикальные трещины-прожилки (редкие и тонкие)
      float cj = 1.0 - abs(sin(u*0.31 + vn(vec2(u*0.08, p.y*0.03))*7.0));
      float veins = smoothstep(0.93, 1.0, cj) * smoothstep(0.45, 0.6, vn(vec2(u*0.05, p.y*0.06)));
      c *= 1.0 - veins*0.28;
      // затенение ниш и выступов
      float ao = fbm2(vec2(u*0.08, p.y*0.09));
      c *= 0.78 + 0.36*ao;
      // красная пыль на полках и верхах, тень под уступами
      float up = smoothstep(0.5, 0.88, n.y);
      c = mix(c, vec3(0.60,0.30,0.17) * (0.85 + 0.3*vn(p.xz*0.9)), up * uDust);
      c *= mix(1.0, 0.55, smoothstep(0.0, -0.5, n.y));
      rockCol = c;
      rockH = b1*0.6 + b3*0.2 + st*0.3 - veins*0.5 + ao*0.8;
    }`;
  function rockify(mat, opt = {}) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRockLo = { value: opt.lo ?? 0.38 }; sh.uniforms.uRockHi = { value: opt.hi ?? 0.62 };
      sh.uniforms.uCapY = { value: opt.capY ?? 42.0 }; sh.uniforms.uBump = { value: opt.bump ?? 1.0 }; sh.uniforms.uDust = { value: opt.dust ?? 0.0 };
      sh.vertexShader = 'varying vec3 vWPos; varying vec3 vWNorm;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        vec4 rwp = vec4(transformed, 1.0);
        vec3 rwn = objectNormal;
        #ifdef USE_INSTANCING
          rwp = instanceMatrix * rwp; rwn = mat3(instanceMatrix) * rwn;
        #endif
        vWPos = (modelMatrix * rwp).xyz; vWNorm = normalize(mat3(modelMatrix) * rwn);`);
      sh.fragmentShader = 'uniform float uRockLo; uniform float uRockHi; uniform float uCapY; uniform float uBump; uniform float uDust;\n' + ROCK_GLSL + '\n' +
        sh.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        {
          vec3 rc; float rh; float rm;
          sedona(vWPos, normalize(vWNorm), rc, rh, rm);
          ${opt.full ? 'rm = 1.0;' : ''}
          diffuseColor.rgb = mix(diffuseColor.rgb, rc * ${opt.tint ? 'mix(vec3(1.0), diffuseColor.rgb*1.6, 0.35)' : 'vec3(1.0)'}, rm);
          // bump по микрорельефу
          vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
          float dhx = dFdx(rh), dhy = dFdy(rh);
          vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
          float det = dot(dpdx, r1);
          vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
          normal = normalize(mix(normal, normalize(abs(det) * normal - grad * uBump), rm));
        }`);
    };
    mat.extensions = { derivatives: true };
    mat.customProgramCacheKey = () => 'sedona' + JSON.stringify(opt);
    return mat;
  }

  const terrainMat = rockify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, map: grainTexture() }), { capY: 42 });
  const terrain = new THREE.Mesh(tGeo, terrainMat);
  terrain.receiveShadow = true;
  terrain.name = 'ArizonaTerrain';

  const world = new THREE.Group(); world.name = 'ArizonaMap';
  world.add(terrain);

  // ---------------------------------------------------------------------------
  // 4. ОКРУЖЕНИЕ: небо, далёкие горы, свет, дымка
  // ---------------------------------------------------------------------------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: SUN_DIR.clone() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 sunDir; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 horizon = vec3(0.93,0.82,0.66);
        vec3 mid = vec3(0.62,0.74,0.86);
        vec3 zenith = vec3(0.30,0.50,0.78);
        vec3 c = mix(horizon, mid, smoothstep(0.0, 0.18, h));
        c = mix(c, zenith, smoothstep(0.18, 0.75, h));
        if (h < 0.0) c = mix(horizon, vec3(0.80,0.62,0.45), smoothstep(0.0,-0.2,h));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        c += vec3(1.0,0.86,0.6) * pow(s, 9.0) * 0.35;      // ореол
        c += vec3(1.0,0.95,0.85) * smoothstep(0.9985, 0.9995, s) * 2.0;  // диск солнца
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), skyMat);
  sky.renderOrder = -1;
  world.add(sky);

  // далёкие горы — кольцо силуэтов (дальний план, в дымке)
  {
    const N = 220, R = 2300, verts = [], cols = [];
    const near = C(0xa8644a), far = C(0x9a7f8f);
    for (let i = 0; i <= N; i++) {
      const a = i / N * Math.PI * 2;
      const hgt = 90 + 160 * Math.max(0, fbm(Math.cos(a) * 3 + 9, Math.sin(a) * 3 - 2, 4) + 0.35) + 60 * Math.abs(sn(a * 9, 1.3));
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      verts.push(x, -20, z, x, hgt, z);
      const cc = near.clone().lerp(far, 0.5 + 0.5 * sn(a * 4, 7));
      cols.push(cc.r * 0.8, cc.g * 0.8, cc.b * 0.8, cc.r, cc.g, cc.b);
    }
    const ix = [];
    for (let i = 0; i < N; i++) { const a = i * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(ix);
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true });
    world.add(new THREE.Mesh(g, m));
  }

  // ---------------------------------------------------------------------------
  // 5. ГЕОМЕТРИЯ РАСТЕНИЙ И КАМНЕЙ
  // ---------------------------------------------------------------------------
  function merge(geos) {
    let total = 0; const parts = geos.map(g => { const n = g.index ? g.toNonIndexed() : g; total += n.attributes.position.count; return n; });
    const P = new Float32Array(total * 3), N = new Float32Array(total * 3), U = new Float32Array(total * 2); let o = 0;
    const hasUV = parts.every(g => g.attributes.uv);
    parts.forEach(g => { if (!g.attributes.normal) g.computeVertexNormals(); P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); if (hasUV) U.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    if (hasUV) out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    out.computeBoundingSphere(); out.computeBoundingBox(); return out;
  }
  function ribbed(rTop, rBot, h, ribs, depth) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, ribs * 2, 3, true);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x);
      const k = 1 + depth * Math.cos(ribs * a);
      p.setX(i, x * k); p.setZ(i, z * k);
    }
    g.computeVertexNormals(); return g;
  }
  const dome = (r) => new THREE.SphereGeometry(r, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  const M4 = () => new THREE.Matrix4();

  function saguaroGeo(H0, arms, seed) {
    const r = mulberry32(seed);
    const parts = [];
    parts.push(ribbed(0.3, 0.38, H0, 11, 0.09).translate(0, H0 / 2, 0));
    parts.push(dome(0.3).translate(0, H0, 0));
    for (let a = 0; a < arms; a++) {
      const ay = H0 * (0.35 + r() * 0.25), ang = r() * Math.PI * 2 + a * 2.1;
      const out = 0.75 + r() * 0.35, up = 1.4 + r() * 1.6;
      const elbow = new THREE.Vector3(Math.cos(ang) * out, ay, Math.sin(ang) * out);
      const horiz = ribbed(0.2, 0.2, out, 9, 0.09).rotateZ(Math.PI / 2).rotateY(-ang).translate(Math.cos(ang) * out / 2, ay, Math.sin(ang) * out / 2);
      parts.push(horiz);
      parts.push(new THREE.SphereGeometry(0.21, 10, 8).translate(elbow.x, elbow.y, elbow.z));
      parts.push(ribbed(0.2, 0.22, up, 9, 0.09).translate(elbow.x, ay + up / 2, elbow.z));
      parts.push(dome(0.2).translate(elbow.x, ay + up, elbow.z));
    }
    return merge(parts);
  }
  function pricklyGeo(seed) {
    const r = mulberry32(seed); const parts = [];
    const pad = () => new THREE.SphereGeometry(0.42, 9, 7).scale(1, 1.2, 0.2);
    const n = 4 + Math.floor(r() * 3);
    const tops = [];
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = r() * 0.6;
      const m = M4().makeRotationY(a).multiply(M4().makeRotationZ((r() - 0.5) * 0.7));
      m.setPosition(Math.cos(a) * d, 0.42, Math.sin(a) * d);
      parts.push(pad().applyMatrix4(m));
      tops.push(new THREE.Vector3(0, 0.95, 0).applyMatrix4(m));
    }
    tops.slice(0, 3).forEach(t => {
      const m = M4().makeRotationY(r() * Math.PI).multiply(M4().makeRotationZ((r() - 0.5) * 0.9));
      m.setPosition(t.x, t.y + 0.25, t.z);
      parts.push(pad().scale(0.85, 0.85, 0.85).applyMatrix4(m));
    });
    return merge(parts);
  }
  function barrelGeo() { return merge([ribbed(0.32, 0.38, 0.55, 14, 0.12).translate(0, 0.27, 0), dome(0.32).scale(1, 0.6, 1).translate(0, 0.55, 0)]); }
  function ocotilloGeo(seed) {
    const r = mulberry32(seed); const parts = [];
    const n = 11 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++) {
      const L = 2.6 + r() * 2.4, a = r() * Math.PI * 2, tilt = 0.12 + r() * 0.32;
      const g = new THREE.CylinderGeometry(0.025, 0.055, L, 5, 1).translate(0, L / 2, 0);
      g.applyMatrix4(M4().makeRotationY(a).multiply(M4().makeRotationX(tilt)));
      parts.push(g);
    }
    return merge(parts);
  }
  function bushGeo(seed) {
    const r = mulberry32(seed); const parts = [];
    const n = 5 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const s = 0.35 + r() * 0.45, a = r() * Math.PI * 2, d = r() * 0.7;
      parts.push(new THREE.IcosahedronGeometry(s, 0).scale(1, 0.75, 1).translate(Math.cos(a) * d, s * 0.7 + r() * 0.3, Math.sin(a) * d));
    }
    return merge(parts);
  }
  function rockGeo(seed, detail) {
    const r = mulberry32(seed);
    const g = new THREE.IcosahedronGeometry(1, detail).toNonIndexed();
    const p = g.attributes.position; const map = new Map();
    for (let i = 0; i < p.count; i++) {
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      if (!map.has(key)) map.set(key, 0.72 + r() * 0.42 + 0.18 * sn(p.getX(i) * 2.1 + seed, p.getZ(i) * 2.1 + p.getY(i)));
      const k = map.get(key);
      p.setXYZ(i, p.getX(i) * k * 1.15, p.getY(i) * k * 0.7, p.getZ(i) * k);
    }
    g.translate(0, 0.35, 0); g.computeVertexNormals(); return g;
  }
  function tuftTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    for (let i = 0; i < 60; i++) {
      const x0 = 64 + (Math.random() - 0.5) * 50, h = 50 + Math.random() * 70, lean = (Math.random() - 0.5) * 50;
      const shade = 150 + Math.random() * 80;
      g.strokeStyle = `rgb(${shade},${shade * 0.92},${shade * 0.55})`; g.lineWidth = 1.5 + Math.random() * 2;
      g.beginPath(); g.moveTo(x0, 128); g.quadraticCurveTo(x0 + lean * 0.3, 128 - h * 0.6, x0 + lean, 128 - h); g.stroke();
    }
    const t = new THREE.CanvasTexture(c); return t;
  }
  function tuftGeo() {
    const parts = [];
    for (let i = 0; i < 3; i++) parts.push(new THREE.PlaneGeometry(1.2, 0.8).translate(0, 0.4, 0).rotateY(i * Math.PI / 3));
    return merge(parts);
  }
  function hoodooGeo(seed, height, radius) {
    const r = mulberry32(seed); const parts = []; const colors = [];
    let y = 0; const segs = 3 + Math.floor(r() * 2);
    const bandCols = [C(0xb4512c), C(0xc8703c), C(0x9c3f22), C(0xd59a6a)];
    for (let s = 0; s < segs; s++) {
      const h = height / segs;
      const rb = radius * (1 - s * 0.12) * (0.85 + r() * 0.3), rt = rb * (0.7 + r() * 0.25);
      const g = new THREE.CylinderGeometry(rt, rb, h, 10, 3).toNonIndexed();
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const k = 0.85 + 0.3 * Math.abs(sn(p.getX(i) * 0.9 + seed, p.getY(i) * 0.7 + p.getZ(i))); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
      g.translate(0, y + h / 2, 0); g.computeVertexNormals(); parts.push(g);
      const bc = bandCols[(s + seed) % 4]; for (let i = 0; i < p.count; i++) colors.push(bc.r, bc.g, bc.b);
      y += h;
    }
    const cap = new THREE.CylinderGeometry(radius * 1.05, radius * 0.8, radius * 0.55, 9, 1).toNonIndexed();
    cap.translate(0, y + radius * 0.25, 0); cap.computeVertexNormals(); parts.push(cap);
    const cc = C(0x5b3a2c); for (let i = 0; i < cap.attributes.position.count; i++) colors.push(cc.r, cc.g, cc.b);
    const g = merge(parts); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return g;
  }

  // ---------------------------------------------------------------------------
  // 6. РАССТАНОВКА
  // ---------------------------------------------------------------------------
  const colliders = [];     // { x, z, r, kind: 'rock'|'hoodoo'|'cactus', mesh?, index?, alive }
  const blockers = [];      // меши, задерживающие снаряды
  const dummy = new THREE.Object3D();
  const nearSpawn = (x, z, r) => Math.hypot(x - PLAYER_SPAWN.x, z - PLAYER_SPAWN.z) < r || Math.hypot(x - ENEMY_SPAWN.x, z - ENEMY_SPAWN.z) < r;
  const washness = (x, z) => 1 - smooth(0.0, 0.09, Math.abs(sn(x * 0.0028 + 11.3, z * 0.0028 - 4.2) + 0.25 * sn(x * 0.011, z * 0.011)));
  function samplePoints(count, test, extent = PLAY + 40, tries = 30) {
    const pts = [];
    for (let n = 0; n < count * tries && pts.length < count; n++) {
      const x = rr(-extent, extent), z = rr(-extent, extent);
      if (inTown(x, z, 4)) continue;
      let inRock = false; for (const f of BUTTES) if ((x - f.x) ** 2 + (z - f.z) ** 2 < (f.r * 1.05) ** 2) { inRock = true; break; }
      if (inRock) continue;
      const h = H(x, z), g = grade(x, z);
      if (test(x, z, h, g)) pts.push({ x, z, h, g });
    }
    return pts;
  }
  function instanced(geo, mat, pts, place, castShadow = true) {
    const im = new THREE.InstancedMesh(geo, mat, pts.length);
    pts.forEach((p, i) => {
      place(p, dummy, i);
      dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
    });
    im.castShadow = castShadow; im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    world.add(im); return im;
  }
  function setVariedColors(im, base, spread) {
    const c = new THREE.Color();
    for (let i = 0; i < im.count; i++) { c.copy(base).offsetHSL((rnd() - 0.5) * spread[0], (rnd() - 0.5) * spread[1], (rnd() - 0.5) * spread[2]); im.setColorAt(i, c); }
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }

  const cactusMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 });
  const plantMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
  const rockMat = rockify(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), { full: true, tint: true, capY: 999, bump: 0.8 });
  const tuftMat = new THREE.MeshStandardMaterial({ map: tuftTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, color: 0xffffff });
  const hoodooMat = rockify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), { full: true, tint: true, capY: 999, bump: 1.2 });

  // ---------------------------------------------------------------------------
  // СКАЛЬНЫЕ ФОРМАЦИИ (Седона): пласты с полками, вертикальные промоины,
  // типы: butte (столовый останец), courthouse (двухъярусный), bell (колокол),
  // cathedral (группа шпилей на цоколе), spire (одиночный шпиль)
  // ---------------------------------------------------------------------------
  const formMat = rockify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93 }), { full: true, tint: true, capY: 44, bump: 1.1, dust: 0.85 });
  const PROFILES = {
    butte: t => (1 - 0.1 * t) * (t > 0.93 ? 1 - Math.pow((t - 0.93) / 0.07, 2) * 0.22 : 1),
    bell: t => Math.pow(Math.max(0, 1 - Math.pow(t, 2.1)), 0.55) * (1 + 0.28 * Math.pow(1 - t, 4)),
    spire: t => Math.pow(Math.max(0, 1 - t), 0.6) * (1 + 0.35 * Math.pow(1 - t, 6)) + 0.04
  };
  function formationGeo(f, seed) {
    const r = mulberry32(seed);
    const P = [], Cc = [], I = [];
    // пласты: толщина 1.2–3.8 м, твёрдые выступают (полки), мягкие западают
    const layers = []; { let y = -4; while (y < f.h + 6) { const massive = rnd() < 0.3; const t = massive ? rr(4, 8) : rr(0.8, 2.6); layers.push({ y0: y, y1: y + t, off: massive ? rr(0.0, 0.03) : (rnd() < 0.5 ? rr(0.0, 0.035) : rr(-0.055, -0.012)), tint: rr(0.55, 0.8) }); y += t; } }
    const layerAt = y => { for (const L of layers) if (y < L.y1) return L; return layers[layers.length - 1]; };
    function body(cx, cz, rad, hgt, profile, yBase, lobeAmp, sd) {
      const elong = rr(0.08, 0.32), phi = rnd() * Math.PI;   // вытянутость в плане
      const NA = Math.max(48, Math.min(120, Math.round(rad * 5)));
      const dy = 0.42, NY = Math.ceil((hgt - yBase) / dy);
      const start = P.length / 3;
      for (let j = 0; j <= NY; j++) {
        const y = Math.min(hgt, yBase + j * dy);
        const t = clamp(y / hgt, 0, 1);
        const L = layerAt(y), lf = (y - L.y0) / (L.y1 - L.y0);
        // внутри пласта лёгкое сужение кверху, на границе пласта — ступень
        const ledge = 1 + L.off * Math.sin(Math.PI * Math.min(1, lf * 1.25 + 0.1)) - 0.02 * lf;   // скруглённые выветренные кромки
        const base = profile(t);
        for (let i = 0; i < NA; i++) {
          const th = i / NA * Math.PI * 2, cs = Math.cos(th), sn_ = Math.sin(th);
          const lob = sn(cs * 1.2 + sd, sn_ * 1.2 + y * 0.012) * lobeAmp + sn(cs * 2.9 - sd, sn_ * 2.9 + y * 0.03) * lobeAmp * 0.45;
          // вертикальные промоины (флютинг)
          const g = Math.abs(sn(th * rad * 0.42 + sd * 3, y * 0.028));
          const flute = 1 - 0.085 * (1 - smooth(0, 0.3, g)) * smooth(0.05, 0.3, t + 0.2);
          const rough = 1 + sn(th * rad * 1.3, y * 0.35) * 0.012;
          const alc = 1 - 0.12 * smooth(0.6, 0.9, sn(cs * 4.1 + sd, sn_ * 4.1 + y * 0.06));   // ниши-альковы
          const rr_ = Math.max(0.25, rad * base * (1 + lob) * (1 + elong * Math.cos(2 * (th - phi))) * ledge * flute * rough * alc);
          P.push(cx + cs * rr_, y, cz + sn_ * rr_);
          const tn = L.tint * (0.9 + 0.2 * rnd());
          Cc.push(tn, tn, tn);
        }
      }
      for (let j = 0; j < NY; j++) for (let i = 0; i < NA; i++) {
        const a = start + j * NA + i, b = start + j * NA + (i + 1) % NA, c = a + NA, d = b + NA;
        I.push(a, c, b, b, c, d);
      }
      // верх: купол из нескольких колец к центру
      const topRing = start + NY * NA;
      const rings = 4; let prev = topRing;
      for (let k = 1; k <= rings; k++) {
        const s = Math.sqrt(1 - Math.pow(k / (rings + 1), 2)) * (1 - k / (rings + 1)) + 0.0;
        const rs = start + (P.length / 3 - start);
        for (let i = 0; i < NA; i++) {
          const pi = (topRing + i) * 3;
          const px = P[pi] - cx, pz = P[pi + 2] - cz;
          const sc = 1 - k / (rings + 1);
          P.push(cx + px * sc, hgt + (1 - sc * sc) * Math.min(1.2, rad * 0.15) + sn(px * 0.3, pz * 0.3) * 0.25, cz + pz * sc);
          Cc.push(0.75, 0.75, 0.75);
        }
        const cur = P.length / 3 - NA;
        for (let i = 0; i < NA; i++) { const a = prev + i, b = prev + (i + 1) % NA, c = cur + i, d = cur + (i + 1) % NA; I.push(a, c, b, b, c, d); }
        prev = cur;
      }
      const ctr = P.length / 3; P.push(cx, hgt + Math.min(1.3, rad * 0.16), cz); Cc.push(0.75, 0.75, 0.75);
      for (let i = 0; i < NA; i++) I.push(prev + i, ctr, prev + (i + 1) % NA);
    }
    const H0 = f.h, R0 = f.r, sd = seed * 0.37;
    if (f.type === 'butte') body(0, 0, R0, H0, PROFILES.butte, -4, 0.22, sd);
    else if (f.type === 'bell') body(0, 0, R0, H0, PROFILES.bell, -4, 0.16, sd);
    else if (f.type === 'spire') body(0, 0, R0, H0, PROFILES.spire, -4, 0.18, sd);
    else if (f.type === 'courthouse') {
      body(0, 0, R0, H0 * 0.6, PROFILES.butte, -4, 0.2, sd);
      body(rr(-0.15, 0.15) * R0, rr(-0.15, 0.15) * R0, R0 * 0.55, H0, PROFILES.butte, H0 * 0.5, 0.2, sd + 5);
      body(rr(-0.3, 0.3) * R0, rr(-0.3, 0.3) * R0, R0 * 0.2, H0 * 1.12, PROFILES.spire, H0 * 0.85, 0.15, sd + 9);
    } else if (f.type === 'cathedral') {
      body(0, 0, R0, H0 * 0.42, PROFILES.butte, -4, 0.22, sd);
      const n = 3 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const a = r() * Math.PI * 2, d = R0 * rr(0.05, 0.45);
        body(Math.cos(a) * d, Math.sin(a) * d, R0 * rr(0.17, 0.3), H0 * rr(0.68, 1.0), PROFILES.spire, H0 * 0.3, 0.14, sd + k * 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
    g.setIndex(I); g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }
  const cylinders = [];   // для прямой видимости и хитбоксов
  BUTTES.forEach((f, i) => {
    // ставим на самую низкую точку вокруг подножия, чтобы низ был закопан
    let base = Infinity;
    for (let a = 0; a < 12; a++) base = Math.min(base, H(f.x + Math.cos(a / 12 * 6.283) * f.r * 1.05, f.z + Math.sin(a / 12 * 6.283) * f.r * 1.05));
    const m = new THREE.Mesh(formationGeo(f, SEED + 900 + i * 13), formMat);
    m.position.set(f.x, base - 1.2, f.z); m.rotation.y = rnd() * 6.28;
    m.castShadow = true; m.receiveShadow = true;
    world.add(m);
    const ph = (f.type === 'cathedral' || f.type === 'courthouse') ? f.h * 0.75 : f.h * 0.9;
    const prox = new THREE.Mesh(new THREE.CylinderGeometry(f.r * 0.82, f.r * 0.95, ph, 16), new THREE.MeshBasicMaterial({ visible: false }));
    prox.position.set(f.x, base - 1.2 + ph / 2, f.z); prox.updateMatrixWorld(true);
    world.add(prox); blockers.push(prox);
    colliders.push({ x: f.x, z: f.z, r: f.r * 0.98, kind: 'rock', alive: true, formation: true });
    cylinders.push({ x: f.x, z: f.z, r: f.r * 0.8, y0: base - 1.2, h: ph });
  });
  // осыпь крупных глыб у подножий
  {
    const pts = [], scales = [];
    BUTTES.forEach(f => {
      const n = Math.round(10 + f.r * 0.9);
      for (let k = 0; k < n; k++) {
        const a = rnd() * Math.PI * 2, d = f.r * rr(1.0, 1.75);
        const x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d;
        pts.push({ x, z, h: H(x, z) }); scales.push(rr(0.5, 1) ** 2 * 3.2 + 0.4);
      }
    });
    const im = instanced(rockGeo(SEED + 150, 2), rockMat, pts, (p, d, i) => {
      d.position.set(p.x, p.h - scales[i] * 0.25, p.z); d.rotation.set(rr(-0.4, 0.4), rnd() * 6.28, rr(-0.4, 0.4)); d.scale.set(scales[i] * rr(0.8, 1.3), scales[i] * rr(0.6, 1.0), scales[i]);
    });
    setVariedColors(im, C(0x7c3a24), [0.03, 0.12, 0.1]);
    blockers.push(im);
    pts.forEach((p, i) => { if (scales[i] > 1.6) colliders.push({ x: p.x, z: p.z, r: scales[i] * 1.0, kind: 'rock', alive: true }); });
  }

  // --- останцы-«худу» (каменные столбы): укрытия, коллайдеры
  samplePoints(26, (x, z, h, g) => g < 0.25 && !nearSpawn(x, z, 70) && Math.max(Math.abs(x), Math.abs(z)) < PLAY - 30, PLAY).forEach((p, i) => {
    const height = rr(9, 19), radius = rr(2.2, 3.8);
    const m = new THREE.Mesh(hoodooGeo(SEED + i * 7, height, radius), hoodooMat);
    m.position.set(p.x, p.h - 0.8, p.z); m.rotation.y = rnd() * 6.28;
    m.castShadow = true; m.receiveShadow = true;
    world.add(m); blockers.push(m);
    colliders.push({ x: p.x, z: p.z, r: radius * 1.05, kind: 'hoodoo', alive: true });
    // осыпь вокруг
  });

  // --- крупные валуны: укрытия, коллайдеры
  for (let v = 0; v < 4; v++) {
    const pts = samplePoints(22, (x, z, h, g) => g > 0.08 && g < 0.6 && !nearSpawn(x, z, 40));
    const scales = pts.map(() => rr(1.6, 4.2));
    const im = instanced(rockGeo(SEED + 100 + v, 1), rockMat, pts, (p, d, i) => {
      d.position.set(p.x, p.h - scales[i] * 0.3, p.z); d.rotation.set(rr(-0.3, 0.3), rnd() * 6.28, rr(-0.3, 0.3)); d.scale.setScalar(scales[i]);
    });
    setVariedColors(im, C(0x9c4c2e), [0.03, 0.15, 0.12]);
    blockers.push(im);
    pts.forEach((p, i) => colliders.push({ x: p.x, z: p.z, r: scales[i] * 1.05, kind: 'rock', alive: true }));
  }
  // --- мелкие камни (декор)
  for (let v = 0; v < 3; v++) {
    const pts = samplePoints(260, (x, z, h, g) => g < 1.2, PLAY + 120);
    const im = instanced(rockGeo(SEED + 200 + v, 0), rockMat, pts, (p, d) => {
      const s = rr(0.15, 0.7); d.position.set(p.x, p.h - s * 0.2, p.z); d.rotation.set(rr(-0.5, 0.5), rnd() * 6.28, 0); d.scale.setScalar(s);
    }, false);
    setVariedColors(im, C(0xa0583a), [0.04, 0.2, 0.15]);
  }

  // --- растения (plants.js): несколько вариантов каждого вида, инстансинг
  const crushables = [];
  const nearRock = (x, z, k) => BUTTES.some(f => Math.hypot(x - f.x, z - f.z) < f.r * k);
  // растительность режется на пространственные чанки CELL×CELL: каждый чанк — свой InstancedMesh,
  // невидимые (вне кадра или дальше o.far) не рисуются ни в основном проходе, ни в тенях
  const VEG_CELL = 260, vegChunks = [];
  function plantSpecies(make, variants, perVariant, test, o = {}) {
    for (let v = 0; v < variants; v++) {
      const sp = make(SEED + (o.seed || 0) + v * 17);
      const pts = samplePoints(perVariant, test, o.extent || PLAY + 40);
      const sc = pts.map(() => rr(o.smin || 0.85, o.smax || 1.2)), rot = pts.map(() => rnd() * 6.28);
      const tilt = pts.map(() => [rr(-0.04, 0.04), rr(-0.04, 0.04)]);
      // цвета — в том же порядке вызовов rnd(), что и раньше (раскладка остальной карты не меняется)
      const base = C(0xe6e6e6), cols = sp.parts.map(() => pts.map(() => new THREE.Color().copy(base).offsetHSL((rnd() - 0.5) * 0.035, 0, (rnd() - 0.5) * 0.14)));
      const cells = new Map();
      pts.forEach((p, i) => {
        const k = Math.floor(p.x / VEG_CELL) + ',' + Math.floor(p.z / VEG_CELL);
        let c = cells.get(k); if (!c) cells.set(k, c = []); c.push(i);
      });
      cells.forEach(ids => {
        let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y = 0;
        ids.forEach(i => { const p = pts[i]; x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); y += p.h; });
        const meshes = sp.parts.map((part, pi) => {
          const im = new THREE.InstancedMesh(part.geo, part.mat, ids.length);
          ids.forEach((i, j) => {
            const p = pts[i];
            dummy.position.set(p.x, p.h - (o.sink || 0.05), p.z); dummy.rotation.set(tilt[i][0], rot[i], tilt[i][1]); dummy.scale.setScalar(sc[i]);
            dummy.updateMatrix(); im.setMatrixAt(j, dummy.matrix); im.setColorAt(j, cols[pi][i]);
          });
          im.castShadow = o.shadow !== false; im.receiveShadow = true; im.frustumCulled = false;
          im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
          const dm = PLANTS.depthFor(part.mat); if (dm) im.customDepthMaterial = dm;
          world.add(im); return im;
        });
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        vegChunks.push({ meshes, s: new THREE.Sphere(new THREE.Vector3(cx, y / ids.length + 3, cz), Math.hypot(x1 - x0, z1 - z0) / 2 + 14), far: o.far || 1e9, vis: true });
        if (o.crush !== false) ids.forEach((i, j) => {
          const p = pts[i];
          crushables.push({ x: p.x, z: p.z, r: (sp.r || 0.6) * sc[i], kind: 'cactus', meshes, index: j, alive: true, tall: !!sp.tall });
        });
      });
    }
  }
  const vegFr = new THREE.Frustum(), vegM = new THREE.Matrix4();
  function updateVeg(cam) {
    vegM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); vegFr.setFromProjectionMatrix(vegM);
    const px = cam.position.x, pz = cam.position.z;
    for (let i = 0; i < vegChunks.length; i++) {
      const c = vegChunks[i], d = Math.hypot(c.s.center.x - px, c.s.center.z - pz) - c.s.radius;
      const v = d < c.far && vegFr.intersectsSphere(c.s);
      if (v !== c.vis) { c.vis = v; for (let k = 0; k < c.meshes.length; k++) c.meshes[k].visible = v; }
    }
  }
  const flat = (x, z, h, g) => g < 0.3;
  // сагуаро — на пологих склонах-бахадах, не в руслах
  plantSpecies(PLANTS.saguaro, 9, 32, (x, z, h, g) => g < 0.24 && washness(x, z) < 0.35 && !nearSpawn(x, z, 18) && h < 24, { seed: 300, smin: 0.85, smax: 1.15, sink: 0.1 });
  plantSpecies(PLANTS.prickly, 6, 60, (x, z, h, g) => g < 0.4 && !nearSpawn(x, z, 10), { far: 420, seed: 400, smin: 0.8, smax: 1.5 });
  plantSpecies(PLANTS.barrel, 4, 55, (x, z, h, g) => g > 0.04 && g < 0.55 && !nearSpawn(x, z, 10), { far: 380, seed: 450, smin: 0.8, smax: 1.3 });
  plantSpecies(PLANTS.cholla, 5, 40, (x, z, h, g) => g < 0.35 && !nearSpawn(x, z, 10), { far: 420, seed: 480, smin: 0.9, smax: 1.6 });
  plantSpecies(PLANTS.ocotillo, 4, 34, (x, z, h, g) => g > 0.05 && g < 0.5 && !nearSpawn(x, z, 14), { seed: 500, smin: 0.8, smax: 1.2 });
  plantSpecies(PLANTS.agave, 4, 60, (x, z, h, g) => g < 0.6 && (g > 0.1 || nearRock(x, z, 2.2)) && !nearSpawn(x, z, 8), { far: 420, seed: 540, smin: 0.8, smax: 1.5 });
  plantSpecies(PLANTS.yucca, 4, 45, (x, z, h, g) => g < 0.45 && !nearSpawn(x, z, 8), { far: 450, seed: 570, smin: 0.9, smax: 1.4 });
  // креозот — основной кустарник равнины, гуще вдоль сухих русел
  plantSpecies(PLANTS.creosote, 6, 200, (x, z, h, g) => g < 0.5 && rnd() < 0.35 + washness(x, z) * 0.65 && !nearSpawn(x, z, 8), { far: 380, seed: 600, smin: 0.7, smax: 1.5, extent: PLAY + 120 });
  plantSpecies(PLANTS.brittle, 4, 200, (x, z, h, g) => g < 0.6 && !nearSpawn(x, z, 6), { far: 260, seed: 650, smin: 0.7, smax: 1.4, extent: PLAY + 120, shadow: false });
  // можжевельник — у подножий скал и на склонах
  plantSpecies(PLANTS.juniper, 6, 80, (x, z, h, g) => (g > 0.12 || nearRock(x, z, 2.2)) && g < 0.75 && !nearSpawn(x, z, 15) && rnd() < 0.6 + smooth(14, 26, h) * 0.4, { seed: 700, smin: 0.8, smax: 1.4, extent: PLAY + 140, sink: 0.2 });

  // --- злаки: растут куртинами; короткие, высокие с метёлками, свежие у сухих русел
  const patch = (x, z) => sn(x * 0.018 + 5, z * 0.018 - 9) * 0.6 + sn(x * 0.06, z * 0.06) * 0.4;
  for (let v = 0; v < 4; v++) plantSpecies(s => PLANTS.grass(s, 0), 1, 1500, (x, z, h, g) => g < 0.6 && patch(x, z) + rnd() * 0.5 > 0.15, { far: 200, seed: 800 + v, smin: 0.7, smax: 1.5, extent: PLAY + 150, crush: false, shadow: false });
  for (let v = 0; v < 3; v++) plantSpecies(s => PLANTS.grass(s, 1), 1, 700, (x, z, h, g) => g < 0.5 && patch(x + 300, z) + rnd() * 0.4 > 0.25, { far: 200, seed: 830 + v, smin: 0.8, smax: 1.4, extent: PLAY + 150, crush: false, shadow: false });
  for (let v = 0; v < 2; v++) plantSpecies(s => PLANTS.grass(s, 2), 1, 600, (x, z, h, g) => g < 0.5 && washness(x, z) + rnd() * 0.3 > 0.75, { far: 200, seed: 860 + v, smin: 0.8, smax: 1.5, extent: PLAY + 150, crush: false, shadow: false });

  // ---------------------------------------------------------------------------
  // 7. ПРИМЕНЕНИЕ К СЦЕНЕ index.html
  // ---------------------------------------------------------------------------
  // убираем мокрый полигон, сетку, забор и мишени
  groundMesh.visible = false;
  gridHelper.visible = false;
  rangeEnvironmentGroup.visible = false;
  rangeTargets.length = 0;
  scene.add(world);
  const prevSBR = scene.onBeforeRender;
  scene.onBeforeRender = function (r, sc, cam) { if (prevSBR) prevSBR.apply(this, arguments); if (cam && cam.isPerspectiveCamera) updateVeg(cam); };

  scene.background = new THREE.Color(0xe9d3b0);
  scene.fog = new THREE.FogExp2(0xe6cba3, 0.00062);
  camera.far = 6000; camera.updateProjectionMatrix();
  hemiLight.color.set(0xd6e4f0); hemiLight.groundColor.set(0xa0603a); hemiLight.intensity = 0.78;
  dirLight.color.set(0xfff0d6); dirLight.intensity = 1.75;
  dirLight.shadow.bias = -0.0006;
  if ('normalBias' in dirLight.shadow) dirLight.shadow.normalBias = 0.04;
  rimLight.color.set(0xffb27a); rimLight.intensity = 0.22;
  rimLight.position.set(-SUN_DIR.x * 20, 6, -SUN_DIR.z * 20);
  renderer.toneMappingExposure = 0.95;

  // ---------------------------------------------------------------------------
  // 8. ЗАПРОСЫ ДЛЯ ИГРОВОЙ ЛОГИКИ
  // ---------------------------------------------------------------------------
  const MAXH = (() => { let m = 0; for (let i = 0; i < heights.length; i++) m = Math.max(m, heights[i]); return m; })();
  const tv = new THREE.Vector3();
  // расстояние вдоль луча до рельефа или null
  function raycastTerrain(o, d, maxDist, minDist = 0) {
    let t = minDist;
    let above = o.y + d.y * t - H(o.x + d.x * t, o.z + d.z * t);
    if (above < 0) return t;
    while (t < maxDist) {
      const y = o.y + d.y * t;
      if (y > MAXH + 1 && d.y >= 0) return null;
      const step = clamp(above * 0.6, 0.8, 14);
      const t2 = Math.min(maxDist, t + step);
      const a2 = o.y + d.y * t2 - H(o.x + d.x * t2, o.z + d.z * t2);
      if (a2 < 0) {
        let lo = t, hi = t2;
        for (let k = 0; k < 10; k++) { const mid = (lo + hi) / 2; const am = o.y + d.y * mid - H(o.x + d.x * mid, o.z + d.z * mid); if (am < 0) hi = mid; else lo = mid; }
        return hi;
      }
      if (t2 >= maxDist) return null;
      t = t2; above = a2;
    }
    return null;
  }
  // здания: ориентированные боксы { x, z, hw, hd, rot, y0, h }
  const boxes = [];
  function rayBox(o, d, maxDist, b) {
    const c = Math.cos(-b.rot), s = Math.sin(-b.rot);
    const ox = o.x - b.x, oz = o.z - b.z;
    const lx = ox * c - oz * s, lz = ox * s + oz * c, ly = o.y - b.y0;
    const dx = d.x * c - d.z * s, dz = d.x * s + d.z * c, dy = d.y;
    let t0 = 0, t1 = maxDist;
    for (const [p, v, lo, hi] of [[lx, dx, -b.hw, b.hw], [ly, dy, 0, b.h], [lz, dz, -b.hd, b.hd]]) {
      if (Math.abs(v) < 1e-9) { if (p < lo || p > hi) return null; continue; }
      let a1 = (lo - p) / v, a2 = (hi - p) / v; if (a1 > a2) { const t = a1; a1 = a2; a2 = t; }
      t0 = Math.max(t0, a1); t1 = Math.min(t1, a2); if (t0 > t1) return null;
    }
    return t0;
  }
  function hasLOS(a, b) {
    tv.copy(b).sub(a); const dist = tv.length(); tv.divideScalar(dist);
    for (let i = 0; i < boxes.length; i++) if (rayBox(a, tv, dist - 1, boxes[i]) !== null) return false;
    for (let i = 0; i < cylinders.length; i++) {
      const c = cylinders[i];
      // 2D: луч против окружности, затем проверка высоты
      const ox = a.x - c.x, oz = a.z - c.z, dx = tv.x, dz = tv.z;
      const A = dx * dx + dz * dz; if (A < 1e-9) continue;
      const B = 2 * (ox * dx + oz * dz), Cq = ox * ox + oz * oz - c.r * c.r, disc = B * B - 4 * A * Cq;
      if (disc < 0) continue;
      const t = (-B - Math.sqrt(disc)) / (2 * A);
      if (t > 0 && t < dist - 1) { const y = a.y + tv.y * t; if (y > c.y0 && y < c.y0 + c.h) return false; }
    }
    return raycastTerrain(a, tv, dist - 1.5, 1) === null;
  }
  // круговые коллайдеры (валуны, худу, живые сагуаро) — выталкивание
  function collide(p, radius) {
    let hit = null;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i]; if (!c.alive || c.kind === 'cactus') continue;
      const dx = p.x - c.x, dz = p.z - c.z, rr2 = c.r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr2 * rr2 && d2 > 1e-6) {
        const d = Math.sqrt(d2); p.x = c.x + dx / d * rr2; p.z = c.z + dz / d * rr2; hit = c;
      }
    }
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]; const c = Math.cos(-b.rot), s = Math.sin(-b.rot);
      const ox = p.x - b.x, oz = p.z - b.z;
      const lx = ox * c - oz * s, lz = ox * s + oz * c;
      const qx = clamp(lx, -b.hw, b.hw), qz = clamp(lz, -b.hd, b.hd);
      let ddx = lx - qx, ddz = lz - qz; const d2 = ddx * ddx + ddz * ddz;
      if (d2 >= radius * radius) continue;
      let nx, nz;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); nx = qx + ddx / d * radius; nz = qz + ddz / d * radius; }
      else { // центр внутри — выталкиваем к ближайшей грани
        const px = b.hw - Math.abs(lx), pz = b.hd - Math.abs(lz);
        if (px < pz) { nx = Math.sign(lx) * (b.hw + radius); nz = lz; } else { nx = lx; nz = Math.sign(lz) * (b.hd + radius); }
      }
      const c2 = Math.cos(b.rot), s2 = Math.sin(b.rot);
      p.x = b.x + nx * c2 - nz * s2; p.z = b.z + nx * s2 + nz * c2; hit = b;
    }
    return hit;
  }
  // танк давит кактусы: возвращает количество
  const fallQ = new THREE.Quaternion(), mtx = new THREE.Matrix4(), posV = new THREE.Vector3(), quatV = new THREE.Quaternion(), sclV = new THREE.Vector3();
  function crushAt(x, z, radius, dirX, dirZ) {
    let n = 0;
    for (let i = 0; i < crushables.length; i++) {
      const c = crushables[i]; if (!c.alive) continue;
      const dx = x - c.x, dz = z - c.z, rr2 = c.r + radius;
      if (dx * dx + dz * dz > rr2 * rr2) continue;
      c.alive = false; n++;
      const ms = c.meshes || [c.mesh];
      ms[0].getMatrixAt(c.index, mtx); mtx.decompose(posV, quatV, sclV);
      // падает в сторону движения танка
      const axis = new THREE.Vector3(dirZ, 0, -dirX).normalize();
      fallQ.setFromAxisAngle(axis, c.tall ? Math.PI / 2 - 0.08 : Math.PI / 2.3);
      quatV.premultiply(fallQ);
      if (!c.tall) { sclV.y *= 0.55; }
      mtx.compose(posV, quatV, sclV);
      ms.forEach(m => { m.setMatrixAt(c.index, mtx); m.instanceMatrix.needsUpdate = true; });
    }
    // динамические объекты городка: машины сминаются, столбы/знаки/мусор падают
    for (let i = 0; i < props.length; i++) {
      const pr = props[i]; if (!pr.alive) continue;
      const dx = x - pr.x, dz = z - pr.z, rr2 = pr.r + radius;
      if (dx * dx + dz * dz > rr2 * rr2) continue;
      pr.alive = false; n++;
      const o = pr.obj;
      if (pr.crush) pr.crush(dirX, dirZ);
      else if (pr.kind === 'car') {
        gsap.to(o.scale, { y: 0.38, duration: 0.25, ease: 'power2.out' });
        gsap.to(o.rotation, { z: o.rotation.z + (Math.random() - 0.5) * 0.25, duration: 0.25 });
        o.traverse(m => { if (m.isMesh && m.material && m.material.color && !m.userData.dark) { m.material = m.material.clone(); m.material.color.multiplyScalar(0.7); } });
      } else {
        const axis = new THREE.Vector3(dirZ, 0, -dirX).normalize();
        const q0 = o.quaternion.clone(), q1 = new THREE.Quaternion().setFromAxisAngle(axis, Math.PI / 2 * (pr.kind === 'pole' ? 0.97 : 1)).multiply(q0);
        const st = { t: 0 };
        gsap.to(st, { t: 1, duration: pr.kind === 'pole' ? 1.1 : 0.5, ease: 'power2.in', onUpdate: () => { o.quaternion.copy(q0).slerp(q1, st.t); } });
        if (pr.kind === 'small') gsap.to(o.position, { x: o.position.x - dirX * 2, z: o.position.z - dirZ * 2, duration: 0.5 });
      }
    }
    return n;
  }
  const props = [];
  function isPassable(x, z) {
    if (Math.max(Math.abs(x), Math.abs(z)) > PLAY) return false;
    if (grade(x, z) > 0.45) return false;
    for (let i = 0; i < colliders.length; i++) { const c = colliders[i]; if (c.alive && c.kind !== 'cactus' && Math.hypot(x - c.x, z - c.z) < c.r + 5) return false; }
    const p = { x, z }; if (boxes.length && collide(p, 5) && (Math.abs(p.x - x) > 0.01 || Math.abs(p.z - z) > 0.01)) return false;
    return true;
  }

  window.MAP = {
    id: 'arizona', name: 'Arizona Base Field', H, grade, normalAt, raycastTerrain, hasLOS, collide, crushAt, isPassable,
    blockers, colliders, boxes, rayBox, cylinders, props, formations: BUTTES, TOWN, inTown, PLAY, SUN_DIR, MAXH, world,
    playerSpawn: new THREE.Vector3(PLAYER_SPAWN.x, H(PLAYER_SPAWN.x, PLAYER_SPAWN.z), PLAYER_SPAWN.z), playerHeading: PLAYER_SPAWN.heading,
    enemySpawn: new THREE.Vector3(ENEMY_SPAWN.x, H(ENEMY_SPAWN.x, ENEMY_SPAWN.z), ENEMY_SPAWN.z), enemyHeading: ENEMY_SPAWN.heading,
    dustColor: 0xc9a273
  };

  // танк сразу ставим на землю
  tankRoot.rotation.order = 'YXZ';
  tankRoot.position.copy(window.MAP.playerSpawn);
})();
