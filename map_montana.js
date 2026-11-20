// =============================================================================
// КАРТА «МОНТАНА» — Big Sky Valley. Процедурная, вымышленная.
// Широкая речная долина: меандрирующая река с перекатами и галечными косами,
// ручей с гор, пойменные поля (пшеница, сенокос, пар), сухие террасы-«бенчи»
// с полынью, хвойные предгорья, скальные хребты со снежниками.
// Рельеф: аналитическая геоморфология + гидравлическая эрозия (капельная),
// запечённые тени от гор, шейдер поверхности по уклону/высоте/влажности.
// Подключается после plants.js и ДО battle.js. Экспортирует window.MAP.
// =============================================================================
(function () {
  'use strict';
  { let pick = 'arizona'; try { pick = localStorage.getItem('tanchiki.map') || 'arizona'; } catch (e) { } if (pick !== 'montana' || window.MAP) return; }
  if (!window.PLANTS || !PLANTS._h) { console.error('map_montana: нужен plants.js с PLANTS._h'); return; }
  const now = () => performance.now();
  const T_START = now();
  // ---------------------------------------------------------------------------
  // 0. ПАРАМЕТРЫ
  // ---------------------------------------------------------------------------
  const SEED = 1889;                 // год, когда Монтана стала штатом
  const SIZE = 1400, HALF = SIZE / 2, SEG = 466, CELL = SIZE / SEG, NV = SEG + 1;
  const PLAY = 470;
  const PLAYER_SPAWN = { x: 0, z: -270, heading: 0 };
  const ENEMY_SPAWN = { x: 20, z: 270, heading: Math.PI };
  const SUN = (() => { const v = [-0.52, 0.60, -0.56], l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();
  const TREELINE = 148, SNOWLINE = 176;

  // ---------------------------------------------------------------------------
  // 1. ШУМ
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
  // гребневой мультифрактал: острые хребты, 0..~1
  function ridged(x, z, oct) { let a = 0.5, f = 1, s = 0, w = 1; for (let o = 0; o < oct; o++) { let n = 1 - Math.abs(sn(x * f, z * f)); n *= n * w; w = Math.min(1, n * 2.2); s += n * a; a *= 0.5; f *= 2.07; } return s; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;

  // ---------------------------------------------------------------------------
  // 2. РЕКА, РУЧЕЙ, ДОРОГИ — осевые линии
  // ---------------------------------------------------------------------------
  // Река течёт с запада на восток, меандрируя между базами команд
  const zr = x => 78 * Math.sin(x * 0.0056 - 0.35) + 30 * Math.sin(x * 0.0137 + 2.1) + 10 * Math.sin(x * 0.029 + 1.0) - 14;
  const dzr = x => 78 * 0.0056 * Math.cos(x * 0.0056 - 0.35) + 30 * 0.0137 * Math.cos(x * 0.0137 + 2.1) + 10 * 0.029 * Math.cos(x * 0.029 + 1.0);
  const WLr = x => 13 - 0.0035 * x;                 // уровень воды: падение ~5 м на карту
  // мост — там, где река течёт ровно на восток (dz/dx = 0)
  let BX = 31; { let b = 1e9; for (let x = 10; x <= 60; x += 0.25) { const v = Math.abs(dzr(x)); if (v < b) { b = v; BX = x; } } }
  const BZ = zr(BX), DECK_Y = WLr(BX) + 3.5, DECK_HW = 5.0;
  // ручей с северо-западных гор впадает в реку
  const xc = z => -246 + 34 * Math.sin(z * 0.011 + 0.7) + 12 * Math.sin(z * 0.029 + 2.0);
  const dxc = z => 34 * 0.011 * Math.cos(z * 0.011 + 0.7) + 12 * 0.029 * Math.cos(z * 0.029 + 2.0);
  let CJZ = -110; for (let i = 0; i < 30; i++) CJZ = zr(xc(CJZ));      // точка впадения
  // главная гравийная дорога: с юга на север через мост
  const roadX = z => BX + 26 * Math.sin((z - BZ) * 0.008) * smooth(0, 70, Math.abs(z - BZ));
  const RANCH = { x: -168, z: zr(-168) + 128 };
  const KNOBS = [   // моренные холмы со скальными выходами — укрытия
    { x: -70, z: -172, r: 30, h: 10 }, { x: 132, z: -142, r: 36, h: 12 }, { x: 252, z: -98, r: 26, h: 9 }, { x: -335, z: -252, r: 32, h: 12 },
    { x: 96, z: -78, r: 21, h: 7 }, { x: -62, z: 112, r: 30, h: 10 }, { x: 152, z: 152, r: 34, h: 12 }, { x: 304, z: 214, r: 28, h: 10 },
    { x: -118, z: 232, r: 30, h: 11 }, { x: 108, z: 72, r: 20, h: 7 }, { x: 392, z: -30, r: 30, h: 11 }, { x: -404, z: 96, r: 30, h: 11 }
  ];
  const riverDistA = (x, z) => Math.abs(z - zr(x)) / Math.sqrt(1 + dzr(x) * dzr(x));       // приближённо, для крупных форм
  function warpDist(x, z) {
    const dR = riverDistA(x, z);
    const warp = 38 * sn(x * 0.0035 + 3, z * 0.0035 - 8) + 12 * sn(x * 0.012, z * 0.012 + 4);
    return Math.max(0, dR + warp * smooth(40, 160, dR));
  }
  function knobAt(x, z) { let v = 0; for (let i = 0; i < KNOBS.length; i++) { const k = KNOBS[i], dx = x - k.x, dz = z - k.z, d2 = dx * dx + dz * dz; if (d2 < k.r * k.r * 6.3) v = Math.max(v, Math.exp(-d2 / (k.r * k.r))); } return v; }

  // ---------------------------------------------------------------------------
  // 3. БАЗОВЫЙ РЕЛЬЕФ: пойма → террасы → предгорья → хребты
  // ---------------------------------------------------------------------------
  const N2 = NV * NV;
  const heights = new Float32Array(N2), gDW = new Float32Array(N2), gFoot = new Float32Array(N2), gMt = new Float32Array(N2);
  function baseHeight(x, z, k) {
    const d = warpDist(x, z), wl = WLr(clamp(x, -HALF, HALF));
    let h = wl + 1.4 + 1.2 * smooth(30, 120, d);                 // пойма
    h += 3.6 * smooth(172, 204, d);                              // уступ первой террасы
    h += 5.2 * smooth(296, 342, d);                              // вторая терраса
    h += fbm(x * 0.004 + 1, z * 0.004 + 2, 3) * 1.7 * smooth(60, 210, d) + fbm(x * 0.021, z * 0.021, 2) * 0.22 * smooth(20, 80, d);
    // предгорья
    const foot = smooth(255, 540, d);
    h += foot * (14 + 30 * (0.5 + 0.5 * fbm(x * 0.0032 + 20, z * 0.0032 - 11, 4)) + 16 * ridged(x * 0.0055, z * 0.0055, 3));
    // хребты по периметру; у западного и восточного края долина сужается в каньон
    const rad = Math.hypot(x, z) + 70 * sn(x * 0.0017 - 5, z * 0.0017 + 9);
    const gap = mix(330, 70, smooth(470, 680, Math.abs(x)));
    const mt = smooth(430, 705, rad) * smooth(gap * 0.3, gap, d);
    const rg = ridged(x * 0.0021 + 4, z * 0.0021 - 6, 4);
    h += mt * (34 + 165 * rg * (0.75 + 0.5 * (0.5 + 0.5 * sn(x * 0.0011 + 2, z * 0.0011))));
    // моренные холмы
    for (let i = 0; i < KNOBS.length; i++) {
      const kb = KNOBS[i], dx = x - kb.x, dz = z - kb.z, d2 = dx * dx + dz * dz; if (d2 > kb.r * kb.r * 7) continue;
      const w = 1 + 0.22 * sn(x * 0.03 + i * 7, z * 0.03), e = Math.exp(-d2 / (kb.r * kb.r * w * w));
      h += kb.h * e + e * e * 2.4 * ridged(x * 0.045 + i, z * 0.045, 2);
    }
    // долина ручья: V-образный врез, дно монотонно поднимается к горам
    if (z > CJZ - 20) {
      const dC = Math.abs(x - xc(z)) / Math.sqrt(1 + dxc(z) * dxc(z));
      const W = 26 + 70 * foot + 60 * mt;
      if (dC < W) {
        const sC = Math.max(0, z - CJZ);
        const floorH = WLr(clamp(xc(z), -HALF, HALF)) + 1.0 + 0.012 * sC + 0.085 * Math.max(0, sC - 330) + 0.11 * Math.max(0, sC - 520);
        h = Math.min(h, mix(floorH, Math.max(h, floorH), Math.pow(dC / W, 1.5)));
      }
    }
    if (k !== undefined) { gDW[k] = d; gFoot[k] = foot; gMt[k] = mt; }
    return h;
  }
  for (let j = 0; j < NV; j++) { const z = -HALF + j * CELL; for (let i = 0; i < NV; i++) { const k = j * NV + i; heights[k] = baseHeight(-HALF + i * CELL, z, k); } }
  const T_BASE = now();

  // ---------------------------------------------------------------------------
  // 4. ГИДРАВЛИЧЕСКАЯ ЭРОЗИЯ (капельная, по Х. Бейеру): овраги, гребни, конусы выноса
  // ---------------------------------------------------------------------------
  const eroded = new Float32Array(N2);
  (function erode() {
    const NORM = 260, N = NV, map = eroded;
    for (let i = 0; i < N2; i++) map[i] = heights[i] / NORM;
    const inertia = 0.06, capF = 4.5, minCap = 0.008, erodeS = 0.32, depS = 0.3, evap = 0.012, grav = 4, maxLife = 42, R = 3;
    const bo = [], bw = []; { let ws = 0; for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const d = Math.hypot(dx, dy); if (d < R) { bo.push(dy * N + dx); bw.push(1 - d / R); ws += 1 - d / R; } } for (let i = 0; i < bw.length; i++) bw[i] /= ws; }
    const er = mulberry32(SEED * 7 + 3), DROPS = 330000, lim = N - 1 - R;
    for (let it = 0; it < DROPS; it++) {
      let px = R + er() * (N - 1 - 2 * R), py = R + er() * (N - 1 - 2 * R), dx = 0, dy = 0, speed = 1, water = 1, sed = 0;
      for (let life = 0; life < maxLife; life++) {
        const nx = px | 0, ny = py | 0, di = ny * N + nx, cx = px - nx, cy = py - ny;
        const h00 = map[di], h10 = map[di + 1], h01 = map[di + N], h11 = map[di + N + 1];
        const gx = (h10 - h00) * (1 - cy) + (h11 - h01) * cy, gy = (h01 - h00) * (1 - cx) + (h11 - h10) * cx;
        const h = h00 * (1 - cx) * (1 - cy) + h10 * cx * (1 - cy) + h01 * (1 - cx) * cy + h11 * cx * cy;
        dx = dx * inertia - gx * (1 - inertia); dy = dy * inertia - gy * (1 - inertia);
        const len = Math.hypot(dx, dy); if (len < 1e-12) break; dx /= len; dy /= len;
        px += dx; py += dy;
        if (px < R || px >= lim || py < R || py >= lim) break;
        const mx = px | 0, my = py | 0, mi = my * N + mx, ux = px - mx, uy = py - my;
        const nh = map[mi] * (1 - ux) * (1 - uy) + map[mi + 1] * ux * (1 - uy) + map[mi + N] * (1 - ux) * uy + map[mi + N + 1] * ux * uy;
        const dh = nh - h;
        const cap = Math.max(-dh * speed * water * capF, minCap);
        if (sed > cap || dh > 0) {
          const dep = dh > 0 ? Math.min(dh, sed) : (sed - cap) * depS;
          sed -= dep;
          map[di] += dep * (1 - cx) * (1 - cy); map[di + 1] += dep * cx * (1 - cy); map[di + N] += dep * (1 - cx) * cy; map[di + N + 1] += dep * cx * cy;
        } else {
          const amt = Math.min((cap - sed) * erodeS, -dh);
          for (let b = 0; b < bo.length; b++) { const q = di + bo[b], wa = amt * bw[b]; map[q] -= wa; }
          sed += amt;
        }
        speed = Math.sqrt(Math.max(0.01, speed * speed - dh * grav)); water *= 1 - evap;
      }
    }
    // термическая эрозия: склон круче угла естественного откоса осыпается; прочные пласты держат утёсы
    {
      const TAL = CELL / NORM, off = [1, -1, N, -N, N + 1, N - 1, -N + 1, -N - 1], od = [1, 1, 1, 1, 1.4142, 1.4142, 1.4142, 1.4142];
      const lim = new Float32Array(N2);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -HALF + i * CELL, z = -HALF + j * CELL, k = j * N + i, hm = map[k] * NORM;
        const hard = smooth(0.1, 0.5, sn(x * 0.006 + 40, z * 0.006 - 17) + 0.6 * Math.sin(hm * 0.11 + 3 * sn(x * 0.003, z * 0.003)));
        lim[k] = TAL * (0.74 + 0.75 * hard); }
      for (let pass = 0; pass < 46; pass++) for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
        const k = j * N + i, h = map[k]; let dm = 0, kn = -1;
        for (let q = 0; q < 8; q++) { const d = (h - map[k + off[q]]) / od[q]; if (d > dm) { dm = d; kn = k + off[q]; } }
        if (dm > lim[k]) { const mv = (dm - lim[k]) * 0.3; map[k] -= mv; map[kn] += mv; }
      }
    }
    // лёгкое сглаживание одиночных выбросов и смешивание: в пойме эрозии нет
    const tmp = new Float32Array(N2);
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) { const k = j * N + i; tmp[k] = map[k] * 0.5 + (map[k - 1] + map[k + 1] + map[k - N] + map[k + N]) * 0.125; }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, edge = Math.min(i, j, N - 1 - i, N - 1 - j);
      const e = (edge < 1 ? map[k] : tmp[k]) * NORM;
      const m = smooth(165, 300, gDW[k]) * smooth(R, R + 6, edge);
      eroded[k] = (e - heights[k]) * m;                // дельта эрозии (м): <0 — вымыто, >0 — намыто
      heights[k] += eroded[k];
    }
  })();
  const T_ERODE = now();

  // сеточные помощники
  function Hgrid(x, z) {
    const gx = clamp((x + HALF) / CELL, 0, SEG - 1e-4), gz = clamp((z + HALF) / CELL, 0, SEG - 1e-4);
    const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, k = j * NV + i;
    return heights[k] * (1 - fx) * (1 - fz) + heights[k + 1] * fx * (1 - fz) + heights[k + NV] * (1 - fx) * fz + heights[k + NV + 1] * fx * fz;
  }
  function bil(arr, x, z) {
    const gx = clamp((x + HALF) / CELL, 0, SEG - 1e-4), gz = clamp((z + HALF) / CELL, 0, SEG - 1e-4);
    const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, k = j * NV + i;
    return arr[k] * (1 - fx) * (1 - fz) + arr[k + 1] * fx * (1 - fz) + arr[k + NV] * (1 - fx) * fz + arr[k + NV + 1] * fx * fz;
  }
  // «разбрызгивание» ломаной по сетке: расстояние до оси и индекс ближайшей точки
  function splat(samples, radiusOf, D, I) {
    for (let s = 0; s < samples.length; s++) {
      const p = samples[s], R = radiusOf(p);
      const i0 = Math.max(0, Math.floor((p.x - R + HALF) / CELL)), i1 = Math.min(SEG, Math.ceil((p.x + R + HALF) / CELL));
      const j0 = Math.max(0, Math.floor((p.z - R + HALF) / CELL)), j1 = Math.min(SEG, Math.ceil((p.z + R + HALF) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const dx = -HALF + i * CELL - p.x, dz = -HALF + j * CELL - p.z, d = Math.sqrt(dx * dx + dz * dz), k = j * NV + i;
        if (d < D[k]) { D[k] = d; I[k] = s; }
      }
    }
  }
  const newD = () => new Float32Array(N2).fill(1e9), newI = () => new Int32Array(N2).fill(-1);

  // ---------------------------------------------------------------------------
  // 5. ДОРОГИ: выравнивание полотна, насыпь к мосту
  // ---------------------------------------------------------------------------
  const roadD = newD(), roadI = newI(), ROADS = [];
  function buildRoad(pts, halfW, deck) {
    // сглаженный продольный профиль
    const raw = pts.map(p => Hgrid(p.x, p.z)), n = pts.length, W = 7;
    const out = [];
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0; for (let k = -W; k <= W; k++) { const q = clamp(i + k, 0, n - 1); s += raw[q]; c++; }
      let h = s / c;
      if (deck) { const dz = Math.abs(pts[i].z - BZ); h = mix(DECK_Y, h, smooth(27, 80, dz)); }
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      out.push({ x: pts[i].x, z: pts[i].z, h, tx: (b.x - a.x) / L, tz: (b.z - a.z) / L, hw: halfW, end: Math.min(i, n - 1 - i) * 2 });
    }
    ROADS.push(out); return out;
  }
  const allRoad = [];
  { const pts = []; for (let z = -342; z <= 334; z += 2) pts.push({ x: roadX(z), z }); allRoad.push(...buildRoad(pts, 3.4, true)); }
  { const z0 = BZ + 58, x0 = roadX(z0), pts = []; const n = Math.ceil((x0 - RANCH.x - 6) / 2);
    for (let i = 0; i <= n; i++) { const t = i / n, x = mix(x0, RANCH.x + 6, t); pts.push({ x, z: mix(z0, RANCH.z - 4, smooth(0, 1, t)) + 5 * Math.sin(t * 9) * Math.sin(t * Math.PI) }); }
    allRoad.push(...buildRoad(pts, 2.3, false)); }
  splat(allRoad, p => p.hw + 9, roadD, roadI);
  for (let k = 0; k < N2; k++) {
    const d = roadD[k]; if (d > 1e8) continue; const p = allRoad[roadI[k]];
    const t = smooth(p.hw + 0.4, p.hw + 8, d) , fade = smooth(0, 14, p.end);
    heights[k] = mix(heights[k], mix(p.h, heights[k], t), fade);
  }

  // ось реки (врезка — после ручья)
  const rvD = newD(), rvI = newI(), RIVER = [];
  {
    let s = 0, px = null, pz = null;
    for (let x = -HALF - 40; x <= HALF + 40; x += 1.5) {
      const z = zr(x), sl = dzr(x), L = Math.sqrt(1 + sl * sl);
      const curv = (dzr(x + 0.5) - dzr(x - 0.5)) / (L * L * L);
      if (px !== null) s += Math.hypot(x - px, z - pz); px = x; pz = z;
      const nb = smooth(18, 55, Math.abs(x - BX));                       // у моста русло прямое и симметричное
      const o = -0.5 * Math.tanh(curv * 170) * nb;
      const riffle = 0.5 + 0.5 * sn(x * 0.011, 7.7);                      // перекаты (броды) и плёсы
      RIVER.push({ x, z, tx: 1 / L, tz: sl / L, s, o, nb, hw: 14 + 3.4 * sn(x * 0.008, 3.3) + 1.6 * sn(x * 0.031, 9.1), D: 0.5 + 0.78 * riffle, wl: WLr(clamp(x, -HALF, HALF)) });
    }
    splat(RIVER, p => p.hw + 24, rvD, rvI);
  }
  // ---------------------------------------------------------------------------
  // 6. РУЧЕЙ: уровень воды по рельефу (монотонно вниз по течению), врезка русла
  // ---------------------------------------------------------------------------
  const crD = newD(), crI = newI(), CREEK = [];
  {
    for (let z = CJZ; z <= HALF + 30; z += 1.5) { const s = dxc(z), L = Math.sqrt(1 + s * s); CREEK.push({ x: xc(z), z, tx: s / L, tz: 1 / L, hw: 2.7 + 0.8 * sn(z * 0.03, 1.5), D: 0.36 }); }
    const n = CREEK.length, t = new Float32Array(n), W = new Float32Array(n);
    for (let i = 0; i < n; i++) { const p = CREEK[i]; t[i] = Math.min(Hgrid(p.x, p.z), Hgrid(p.x - p.tz * 3, p.z + p.tx * 3), Hgrid(p.x + p.tz * 3, p.z - p.tx * 3)); }
    let m = 1e9; for (let i = n - 1; i >= 0; i--) { m = Math.min(m, t[i] - 0.5); W[i] = m; }            // вода не выше земли выше по течению
    const wj = WLr(CREEK[0].x);
    const jhw = (() => { let b = 1e9, q = RIVER[0]; for (const p of RIVER) { const d = Math.hypot(p.x - CREEK[0].x, p.z - CREEK[0].z); if (d < b) { b = d; q = p; } } return q.hw; })();
    for (let i = 0; i < n; i++) { CREEK[i].inRiver = i * 1.5 < jhw - 4; if (i * 1.5 < 90) W[i] = Math.min(W[i], wj + 0.02 + Math.max(0, i * 1.5 - jhw) * 0.03); }
    for (let pass = 0; pass < 2; pass++) { const c = Float32Array.from(W); for (let i = 0; i < n; i++) { let s = 0, q = 0; for (let k = -6; k <= 6; k++) { s += c[clamp(i + k, 0, n - 1)]; q++; } W[i] = s / q; } }
    W[0] = wj; for (let i = 1; i < n; i++) W[i] = Math.max(W[i], W[i - 1]);
    for (let i = 0; i < n; i++) { CREEK[i].wl = W[i]; CREEK[i].cut = Math.max(0, t[i] - W[i]); CREEK[i].s = i * 1.5; }
    splat(CREEK, p => p.hw + 8 + 2.4 * p.cut, crD, crI);
    for (let k = 0; k < N2; k++) {
      const d = crD[k]; if (d > 1e8) continue; const p = CREEK[crI[k]];
      if (d <= p.hw) { const u = d / p.hw; heights[k] = p.wl - p.D * (1 - u * u) - 0.04; }
      else {
        const e = d - p.hw, bw = 5 + 2.4 * p.cut, kk = smooth(0, bw, e);
        heights[k] = (p.wl + e * 0.2) * (1 - kk) + Math.max(heights[k], p.wl + Math.min(0.3, e * 0.2)) * kk;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 7. РЕКА: тальвег у внешнего берега, галечные косы на внутреннем, перекаты
  // ---------------------------------------------------------------------------
  {
    for (let k = 0; k < N2; k++) {
      const d = rvD[k]; if (d > 1e8) continue; const p = RIVER[rvI[k]];
      const i = k % NV, j = (k / NV) | 0, x = -HALF + i * CELL, z = -HALF + j * CELL;
      const side = ((x - p.x) * (-p.tz) + (z - p.z) * p.tx) >= 0 ? 1 : -1;
      if (d <= p.hw) {
        const u = side * d / p.hw, t = u < p.o ? (u - p.o) / (1 + p.o) : (u - p.o) / (1 - p.o);
        heights[k] = p.wl - p.D * (1 - t * t) - 0.05 + sn(x * 0.22, z * 0.22) * 0.05;
      } else {
        const outer = side * p.o > 0;                                      // подмываемый берег — крутой
        const bw = outer ? 5 : 5 + 22 * Math.abs(p.o), e = d - p.hw, kk = smooth(0, bw, e);
        heights[k] = (p.wl + e * 0.1) * (1 - kk) + Math.max(heights[k], p.wl + Math.min(0.3, e * 0.1)) * kk;
      }
    }
  }
  const BRIDGE_HL = (() => { let i = 0, b = 1e9; RIVER.forEach((p, q) => { const d = Math.abs(p.x - BX); if (d < b) { b = d; i = q; } }); return RIVER[i].hw + 9; })();

  // стартовые площадки — ровные
  for (const sp of [PLAYER_SPAWN, ENEMY_SPAWN]) {
    const hc = Hgrid(sp.x, sp.z);
    const i0 = Math.floor((sp.x - 70 + HALF) / CELL), i1 = Math.ceil((sp.x + 70 + HALF) / CELL), j0 = Math.floor((sp.z - 70 + HALF) / CELL), j1 = Math.ceil((sp.z + 70 + HALF) / CELL);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * NV + i, d = Math.hypot(-HALF + i * CELL - sp.x, -HALF + j * CELL - sp.z); heights[k] = mix(hc, heights[k], smooth(30, 66, d) * 0.85 + 0.15); }
  }
  for (let k = 0; k < N2; k++) if (heights[k] < 0.3) heights[k] = 0.3;

  // ---------------------------------------------------------------------------
  // 8. ЗАПРОСЫ ВЫСОТЫ (с настилом моста), уклон, нормаль
  // ---------------------------------------------------------------------------
  function H(x, z) {
    const h = Hgrid(x, z);
    if (Math.abs(x - BX) < DECK_HW && Math.abs(z - BZ) < BRIDGE_HL && h < DECK_Y) return DECK_Y;
    return h;
  }
  function grade(x, z) { const e = 2; const gx = (H(x + e, z) - H(x - e, z)) / (2 * e), gz = (H(x, z + e) - H(x, z - e)) / (2 * e); return Math.sqrt(gx * gx + gz * gz); }
  let MAXH = 0; for (let k = 0; k < N2; k++) if (heights[k] > MAXH) MAXH = heights[k];
  // вода: глубина и уровень
  function streamAt(x, z) {
    const gx = clamp(Math.round((x + HALF) / CELL), 0, SEG), gz = clamp(Math.round((z + HALF) / CELL), 0, SEG), k = gz * NV + gx;
    let best = null, bd = 1e9;
    if (rvI[k] >= 0) { const b = RIVER[rvI[k]]; for (let q = Math.max(0, rvI[k] - 3); q <= Math.min(RIVER.length - 1, rvI[k] + 3); q++) { const p = RIVER[q], d = Math.hypot(x - p.x, z - p.z); if (d < bd) { bd = d; best = p; } } if (bd > b.hw + 6) { best = null; bd = 1e9; } }
    if (!best && crI[k] >= 0) { for (let q = Math.max(0, crI[k] - 3); q <= Math.min(CREEK.length - 1, crI[k] + 3); q++) { const p = CREEK[q], d = Math.hypot(x - p.x, z - p.z); if (d < bd) { bd = d; best = p; } } if (best && bd > best.hw + 4) best = null; }
    return best;
  }
  function waterLevel(x, z) { const p = streamAt(x, z); return p ? p.wl : -1e3; }
  function waterDepth(x, z) { const p = streamAt(x, z); if (!p) return 0; if (Math.abs(x - BX) < DECK_HW && Math.abs(z - BZ) < BRIDGE_HL) return 0; return Math.max(0, p.wl - Hgrid(x, z)); }

  // ---------------------------------------------------------------------------
  // 9. ЗАПЕКАНИЕ: тени от гор (мягкие), затенение ложбин, маски полей и леса
  // ---------------------------------------------------------------------------
  const gShade = new Float32Array(N2), gAO = new Float32Array(N2);
  for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
    const k = j * NV + i, x = -HALF + i * CELL, z = -HALF + j * CELL, h0 = heights[k] + 0.4;
    let vis = 1, t = 5;
    while (t < 700) {
      const px = x + SUN[0] * t, pz = z + SUN[2] * t, py = h0 + SUN[1] * t;
      if (py > MAXH || Math.abs(px) > HALF || Math.abs(pz) > HALF) break;
      const c = (py - Hgrid(px, pz)) / t;                  // угловой зазор до рельефа
      if (c < vis * 0.09) { vis = Math.max(0, c / 0.09); if (vis <= 0) break; }
      t += 4 + t * 0.06;
    }
    gShade[k] = vis;
    let s = 0; const R1 = 9, R2 = 24;
    for (let a = 0; a < 8; a++) { const ca = Math.cos(a * 0.7854), sa = Math.sin(a * 0.7854); s += Hgrid(x + ca * R1, z + sa * R1) * 0.6 + Hgrid(x + ca * R2, z + sa * R2) * 0.4; }
    gAO[k] = clamp(1 - (s / 8 - heights[k]) * 0.075, 0.55, 1.08);
  }
  const T_BAKE = now();

  // пахотная пойма: участки-«парцеллы» в повёрнутой сетке
  const PA = 0.31, PCOS = Math.cos(PA), PSIN = Math.sin(PA), PW = 118, PH = 86, PN = 32;
  const parcelData = new Uint8Array(PN * PN * 4);
  { const pr = mulberry32(SEED + 55); for (let i = 0; i < PN * PN; i++) { const v = pr(); parcelData[i * 4] = v < 0.24 ? 0 : v < 0.52 ? 85 : v < 0.84 ? 170 : 255; parcelData[i * 4 + 1] = pr() < 0.5 ? 0 : 255; parcelData[i * 4 + 2] = Math.floor(pr() * 255); parcelData[i * 4 + 3] = 255; } }
  // тип участка: 0 пастбище, 1 сенокос, 2 пшеница, 3 пар; edge — расстояние до межи
  function parcelAt(x, z) {
    const qx = (x * PCOS + z * PSIN) / PW, qz = (-x * PSIN + z * PCOS) / PH;
    const cx = Math.floor(qx), cz = Math.floor(qz), fx = qx - cx, fz = qz - cz;
    const o = (((cz + PN / 2) & (PN - 1)) * PN + ((cx + PN / 2) & (PN - 1))) * 4;
    return { type: Math.round(parcelData[o] / 85), dir: parcelData[o + 1] > 127 ? 1 : 0, tone: parcelData[o + 2] / 255, edge: Math.min(fx * PW, (1 - fx) * PW, fz * PH, (1 - fz) * PH) };
  }
  const inRanch = (x, z, m = 0) => Math.abs(x - RANCH.x) < 46 + m && Math.abs(z - RANCH.z) < 40 + m;
  const nearSpawn = (x, z, r) => Math.hypot(x - PLAYER_SPAWN.x, z - PLAYER_SPAWN.z) < r || Math.hypot(x - ENEMY_SPAWN.x, z - ENEMY_SPAWN.z) < r;
  const gField = new Float32Array(N2), gForest = new Float32Array(N2), gWet = new Float32Array(N2), gKind = new Uint8Array(N2);
  for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
    const k = j * NV + i, x = -HALF + i * CELL, z = -HALF + j * CELL, h = heights[k];
    const rd = rvD[k] < 1e8 ? rvD[k] - RIVER[rvI[k]].hw : riverDistA(x, z) - 14, cd = crD[k] < 1e8 ? crD[k] - CREEK[crI[k]].hw : 1e3, road = roadD[k] < 1e8 ? roadD[k] - allRoad[roadI[k]].hw : 1e3;
    const dW = gDW[k], kn = knobAt(x, z);
    const e = 3, g = Math.hypot(Hgrid(x + e, z) - Hgrid(x - e, z), Hgrid(x, z + e) - Hgrid(x, z - e)) / (2 * e);
    // поля
    let f = smooth(16, 30, rd) * (1 - smooth(148, 170, dW)) * (1 - smooth(0.05, 0.3, kn)) * smooth(8, 20, cd) * smooth(1.5, 5, road) * (1 - smooth(0.1, 0.2, g));
    if (inRanch(x, z)) f = 0;
    gField[k] = f;
    // лес
    const patch = fbm(x * 0.0075 + 7, z * 0.0075 - 3, 3);
    let v = smooth(0.06, 0.36, patch) * smooth(176, 214, dW);                                             // рощи на террасах
    v = Math.max(v, smooth(0.1, 0.5, gFoot[k]) * smooth(-0.5, 0.0, fbm(x * 0.006 - 9, z * 0.006 + 4, 3)));  // предгорья: лес с полянами
    v = Math.max(v, smooth(0.15, 0.5, gMt[k]) * 0.95);
    const rip = (1 - smooth(3, 30, rd)) * smooth(-0.25, 0.25, sn(x * 0.013 + 50, z * 0.013)) * 0.8;        // тополя вдоль реки
    const ripC = (1 - smooth(2, 16, cd)) * smooth(-0.3, 0.2, sn(x * 0.02 + 20, z * 0.02 + 8)) * 0.75 * (1 - gMt[k]);
    let kind = 1;                                                                                           // 1 хвойный, 2 опушка (осина/сосна), 3 прибрежный
    if (v < 0.42) kind = 2;
    if (Math.max(rip, ripC) > v) { v = Math.max(rip, ripC); kind = 3; }
    v *= 1 - smooth(TREELINE - 24, TREELINE + 8, h + 13 * sn(x * 0.011, z * 0.011 + 3));
    v *= 1 - smooth(0.62, 1.05, g);
    v *= smooth(1.0, 3.5, rd) * smooth(0.5, 2.5, cd) * smooth(3, 7, road) * (1 - f);
    if (nearSpawn(x, z, 46) || inRanch(x, z, 6)) v = 0;
    if (kn > 0.55) v *= 0.3;
    gForest[k] = v; gKind[k] = kind;
    // влажность: у воды и в ложбинах зеленее, на террасах суше
    gWet[k] = clamp(0.25 + 0.75 * (1 - smooth(4, 150, Math.min(rd, cd * 3))) + (1 - gAO[k]) * 1.6 - 0.25 * smooth(170, 260, dW) * (1 - gFoot[k]) + 0.35 * gFoot[k], 0, 1);
  }
  const T_MASK = now();

  // ===========================================================================
  // СЦЕНА
  // ===========================================================================
  const V3 = THREE.Vector3, C = (hex) => new THREE.Color(hex);
  const SUN_DIR = new V3(SUN[0], SUN[1], SUN[2]);
  const world = new THREE.Group(); world.name = 'MontanaMap';
  const uTime = { value: 0 };
  (function tick() { uTime.value = performance.now() / 1000; requestAnimationFrame(tick); })();
  const HOR = [0.78, 0.86, 0.93];               // цвет дымки у горизонта

  const NOISE_GLSL = `
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(h21(i), h21(i+vec2(1.0,0.0)), u.x), mix(h21(i+vec2(0.0,1.0)), h21(i+vec2(1.0,1.0)), u.x), u.y); }
    float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a*vn(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }
    vec2 cell2(vec2 p){ vec2 i = floor(p), f = fract(p); float md = 9.0, id = 0.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){ vec2 g = vec2(float(x), float(y)); vec2 o = vec2(h21(i+g), h21(i+g+17.3)); vec2 r = g + o - f; float d = dot(r, r); if (d < md){ md = d; id = h21(i+g+3.7); } }
      return vec2(sqrt(md), id); }`;
  // скала Скалистых гор: серый известняк, тёмные сланцы, бордовый и зелёный аргиллит, лишайник
  const ROCK_GLSL = `
    void rockMT(vec3 p, vec3 n, out vec3 c, out float hgt){
      float u = abs(n.x) > abs(n.z) ? p.z : p.x;
      float warp = (fbm2(p.xz*0.01) - 0.5)*18.0 + (fbm2(vec2(u*0.04, p.y*0.05)) - 0.5)*3.0;
      float y = p.y + warp + u*0.07;
      float b1 = sin(y*0.55)*0.5+0.5, b2 = sin(y*0.17 + 1.3)*0.5+0.5;
      float b3 = sin(y*2.6 + fbm2(vec2(u*0.12, y*0.3))*3.0)*0.5+0.5;
      c = mix(vec3(0.33,0.32,0.31), vec3(0.47,0.44,0.40), b2);
      c = mix(c, vec3(0.25,0.25,0.26), smoothstep(0.62, 1.0, b1)*0.5);
      c = mix(c, vec3(0.40,0.27,0.25), smoothstep(0.92, 1.0, sin(y*0.093 + 2.0))*0.4);
      c = mix(c, vec3(0.33,0.39,0.35), smoothstep(0.94, 1.0, sin(y*0.071 + 4.4))*0.35);
      c *= 0.80 + 0.12*b3;
      float slope = 1.0 - clamp(n.y, 0.0, 1.0);
      float st = vn(vec2(u*0.3, p.y*0.02))*0.6 + vn(vec2(u*1.1, p.y*0.06))*0.4;
      c = mix(c, vec3(0.15,0.14,0.14), smoothstep(0.5, 0.82, st)*smoothstep(0.25, 0.55, slope)*0.5);
      float cr = 1.0 - abs(sin(u*0.5 + vn(vec2(u*0.1, p.y*0.05))*6.0));
      float crack = smoothstep(0.94, 1.0, cr);
      c *= 1.0 - crack*0.3;
      float blocks = vn(vec2(u*0.45, y*0.9));
      c *= 0.84 + 0.3*blocks;
      float li = fbm2(p.xz*0.6 + p.y*0.37);
      c = mix(c, vec3(0.50,0.42,0.18), smoothstep(0.66, 0.8, li)*0.3);
      c = mix(c, vec3(0.36,0.42,0.34), smoothstep(0.32, 0.2, li)*0.22);
      c *= mix(1.0, 0.6, smoothstep(0.0, -0.5, n.y)) * 0.66;
      hgt = b1*0.5 + b3*0.25 + blocks*0.8 - crack*0.6 + st*0.2;
    }`;
  const BUMP_GLSL = `
        { vec3 dpdx_ = dFdx(-vViewPosition), dpdy_ = dFdy(-vViewPosition);
          float dhx_ = dFdx(bumpH), dhy_ = dFdy(bumpH);
          vec3 r1_ = cross(dpdy_, normal), r2_ = cross(normal, dpdx_);
          float det_ = dot(dpdx_, r1_);
          vec3 grad_ = sign(det_) * (dhx_ * r1_ + dhy_ * r2_);
          normal = normalize(abs(det_) * normal - grad_ * bumpK); }`;
  const WPOS_VERT = `#include <project_vertex>
        vec4 rwp = vec4(transformed, 1.0); vec3 rwn = objectNormal;
        #ifdef USE_INSTANCING
          rwp = instanceMatrix * rwp; rwn = mat3(instanceMatrix) * rwn;
        #endif
        vWPos = (modelMatrix * rwp).xyz; vWNorm = normalize(mat3(modelMatrix) * rwn);`;
  // материал камней/валунов/выходов: та же порода, что и на склонах
  function rockify(mat, bump = 1.0) {
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying vec3 vWPos; varying vec3 vWNorm;\n' + sh.vertexShader.replace('#include <project_vertex>', WPOS_VERT);
      sh.fragmentShader = 'varying vec3 vWPos; varying vec3 vWNorm;\n' + NOISE_GLSL + ROCK_GLSL + '\n' + sh.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        { vec3 rc; float bumpH; rockMT(vWPos, normalize(vWNorm), rc, bumpH);
          float up = smoothstep(0.55, 0.95, normalize(vWNorm).y);
          rc = mix(rc, vec3(0.36,0.40,0.22) * (0.8 + 0.4*vn(vWPos.xz*1.3)), up * smoothstep(0.45, 0.7, fbm2(vWPos.xz*0.35)) * 0.8);   // мох и дёрн на верхушках
          diffuseColor.rgb = rc * diffuseColor.rgb * 1.18;
          float bumpK = ${bump.toFixed(2)} * (1.0 - smoothstep(120.0, 400.0, length(vViewPosition)));
          ${BUMP_GLSL} }`);
    };
    mat.extensions = { derivatives: true };
    mat.customProgramCacheKey = () => 'mtrock' + bump;
    return mat;
  }

  // ---------------------------------------------------------------------------
  // 10. МЕШ РЕЛЬЕФА
  // ---------------------------------------------------------------------------
  const tGeo = new THREE.BufferGeometry();
  {
    const pos = new Float32Array(N2 * 3), aA = new Float32Array(N2 * 4), aB = new Float32Array(N2 * 4), aWL = new Float32Array(N2);
    for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
      const k = j * NV + i, x = -HALF + i * CELL, z = -HALF + j * CELL, h = heights[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      aA[k * 4] = gShade[k]; aA[k * 4 + 1] = gAO[k]; aA[k * 4 + 2] = gForest[k]; aA[k * 4 + 3] = gField[k];
      let gravel = 0, wl = h - 5;
      if (rvD[k] < 1e8) {
        const p = RIVER[rvI[k]], side = ((x - p.x) * (-p.tz) + (z - p.z) * p.tx) >= 0 ? 1 : -1, outer = side * p.o > 0;
        const bw = outer ? 3.5 : 4 + 22 * Math.abs(p.o);
        gravel = 1 - smooth(1.0, bw + 2.5, rvD[k] - p.hw); wl = p.wl;
      }
      if (crD[k] < 1e8) { const p = CREEK[crI[k]], g2 = 1 - smooth(0.6, 4.5, crD[k] - p.hw); if (g2 > gravel) { gravel = g2; if (rvD[k] > 1e8 || rvD[k] > RIVER[rvI[k]].hw + 3) wl = p.wl; } else if (rvD[k] > 1e8) wl = Math.min(p.wl, h - 0.5); }
      let road = 0; if (roadD[k] < 1e8) { const p = allRoad[roadI[k]]; road = (1 - smooth(p.hw - 0.8, p.hw + 2.0, roadD[k])) * smooth(0, 14, p.end); }
      { const yd = Math.hypot((x - RANCH.x - 2) / 1.25, z - RANCH.z - 2); if (yd < 30) road = Math.max(road, (1 - smooth(15, 27, yd + 6 * sn(x * 0.08, z * 0.08))) * 0.85); }   // двор ранчо
      aB[k * 4] = gravel; aB[k * 4 + 1] = road; aB[k * 4 + 2] = clamp(eroded[k] / 5, -1, 1) * 0.5 + 0.5; aB[k * 4 + 3] = gWet[k];
      aWL[k] = wl;
    }
    const idx = new Uint32Array(SEG * SEG * 6); let p = 0;
    for (let j = 0; j < SEG; j++) for (let i = 0; i < SEG; i++) { const a = j * NV + i, b = a + 1, c = a + NV, d = c + 1; idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d; }
    tGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    tGeo.setAttribute('aA', new THREE.BufferAttribute(aA, 4));
    tGeo.setAttribute('aB', new THREE.BufferAttribute(aB, 4));
    tGeo.setAttribute('aWL', new THREE.BufferAttribute(aWL, 1));
    tGeo.setIndex(new THREE.BufferAttribute(idx, 1));
    tGeo.computeVertexNormals(); tGeo.computeBoundingSphere();
  }
  const parcelTex = new THREE.DataTexture(parcelData, PN, PN, THREE.RGBAFormat);
  parcelTex.magFilter = parcelTex.minFilter = THREE.NearestFilter; parcelTex.needsUpdate = true;
  function grainTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); const img = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const n = 0.5 * sn(x * 0.07, y * 0.07) + 0.3 * sn(x * 0.25, y * 0.25) + 0.2 * (Math.random() * 2 - 1);
      const v = clamp(200 + n * 50, 0, 255); const o = (y * 256 + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
  }
  const terrainMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  terrainMat.onBeforeCompile = (sh) => {
    sh.uniforms.uParcel = { value: parcelTex }; sh.uniforms.uGrain = { value: grainTexture() };
    sh.vertexShader = 'attribute vec4 aA; attribute vec4 aB; attribute float aWL; varying vec3 vWPos; varying vec3 vWNorm; varying vec4 vA; varying vec4 vB; varying float vWL;\n' +
      sh.vertexShader.replace('#include <project_vertex>', WPOS_VERT + '\n vA = aA; vB = aB; vWL = aWL;');
    sh.fragmentShader = 'uniform sampler2D uParcel; uniform sampler2D uGrain; varying vec3 vWPos; varying vec3 vWNorm; varying vec4 vA; varying vec4 vB; varying float vWL;\n' + NOISE_GLSL + ROCK_GLSL + '\n' +
      sh.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      {
        vec3 P = vWPos; vec3 Nw = normalize(vWNorm);
        float slope = 1.0 - clamp(Nw.y, 0.0, 1.0);
        float dist = length(vViewPosition);
        float nearK = 1.0 - smoothstep(30.0, 110.0, dist);
        float n1 = fbm2(P.xz*0.018), n2 = fbm2(P.xz*0.11 + 7.3), n3 = vn(P.xz*0.9), n4 = vn(P.xz*4.3);
        float bumpH = n4*0.25 + n3*0.2, bumpK = 0.5;
        // ---------------- травостой: от сухого бенча к сочной пойме
        float wet = clamp(vB.w + (n1 - 0.5)*0.8, 0.0, 1.0);
        vec3 grass = mix(vec3(0.50,0.43,0.22), vec3(0.30,0.38,0.14), smoothstep(0.18, 0.6, wet));
        grass = mix(grass, vec3(0.19,0.33,0.10), smoothstep(0.66, 1.0, wet));
        grass *= 0.80 + 0.40*n2;
        grass = mix(grass, grass*vec3(1.14,1.05,0.76), smoothstep(0.55, 0.9, n3)*0.35);
        // цветы куртинами: бальзамориза (жёлтые), люпин (сиреневые), тысячелистник (белые)
        { vec2 fc = floor(P.xz*2.4); float fh = h21(fc);
          float on = step(0.90, fh) * smoothstep(0.52, 0.72, fbm2(P.xz*0.045 + 31.0)) * nearK * (1.0 - vA.w) * (1.0 - smoothstep(0.1, 0.4, vA.z));
          float kind = h21(fc + 9.1);
          vec3 fcol = kind < 0.5 ? vec3(0.90,0.74,0.10) : (kind < 0.82 ? vec3(0.45,0.36,0.78) : vec3(0.92,0.92,0.86));
          grass = mix(grass, fcol, on * smoothstep(0.34, 0.14, length(fract(P.xz*2.4) - 0.5)) * 0.9); }
        vec3 col = grass;
        // ---------------- поля поймы
        if (vA.w > 0.01) {
          vec2 q = vec2(P.x*${PCOS.toFixed(6)} + P.z*${PSIN.toFixed(6)}, -P.x*${PSIN.toFixed(6)} + P.z*${PCOS.toFixed(6)}) / vec2(${PW.toFixed(1)}, ${PH.toFixed(1)});
          vec2 pc = floor(q), pm = fract(q) * vec2(${PW.toFixed(1)}, ${PH.toFixed(1)});
          vec4 pd = texture2D(uParcel, (mod(pc + 16.0, 32.0) + 0.5) / 32.0);
          float type = floor(pd.r*3.0 + 0.5);
          float edge = min(min(pm.x, ${PW.toFixed(1)} - pm.x), min(pm.y, ${PH.toFixed(1)} - pm.y));
          float row = pd.g > 0.5 ? pm.x : pm.y;
          float tone = 0.9 + 0.2*pd.b;
          float rowK = 1.0 - smoothstep(18.0, 70.0, dist);
          vec3 fcol; float fb = 0.0;
          if (type < 0.5) { fcol = mix(vec3(0.24,0.37,0.12), vec3(0.33,0.42,0.15), n2) * tone; }
          else if (type < 1.5) {                              // сенокос: полосы прокосов и валки
            float sw = smoothstep(-0.25, 0.25, sin(row*0.6283));
            fcol = mix(vec3(0.38,0.45,0.17), vec3(0.47,0.52,0.22), sw) * tone * (0.92 + 0.16*n2);
            float wr = 1.0 - smoothstep(0.25, 0.6 + dist*0.002, abs(fract(row/10.0) - 0.5)*10.0);
            fcol = mix(fcol, vec3(0.58,0.53,0.28), wr*0.55); fb = wr*0.5;
          } else if (type < 2.5) {                            // пшеница: рядки и технологическая колея
            fcol = vec3(0.72,0.56,0.24) * (0.9 + 0.14*n2) * tone;
            fcol *= 1.0 + 0.07*sin(row*8.378)*rowK;
            float tr = fract(row/21.0)*21.0, tt = min(abs(tr - 9.6), abs(tr - 11.4));
            fcol *= 1.0 - 0.22*(1.0 - smoothstep(0.12 + dist*0.0010, 0.4 + dist*0.0022, tt));
          } else {                                            // пар: борозды
            float fur = sin(row*5.712);
            fcol = mix(vec3(0.25,0.19,0.13), vec3(0.36,0.28,0.19), 0.5 + 0.5*fur*rowK) * (0.88 + 0.24*n2) * tone; fb = fur*0.6*rowK;
          }
          float border = 1.0 - smoothstep(0.9, 2.4, edge + (n3 - 0.5)*1.2);
          float fk = vA.w * (1.0 - border);
          col = mix(col, fcol, fk); bumpH = mix(bumpH, fb + n4*0.15, fk);
        }
        // ---------------- лесная подстилка
        { vec3 duff = mix(vec3(0.24,0.19,0.12), vec3(0.17,0.22,0.11), n2) * (0.82 + 0.36*n3);
          col = mix(col, duff, smoothstep(0.08, 0.5, vA.z + (n2 - 0.5)*0.25) * 0.92); }
        // ---------------- высотные пояса: альпийская тундра
        float alt = P.y + (n1 - 0.5)*26.0;
        col = mix(col, mix(vec3(0.40,0.38,0.23), vec3(0.31,0.35,0.20), n2), smoothstep(${(TREELINE - 12).toFixed(1)}, ${(TREELINE + 18).toFixed(1)}, alt));
        // ---------------- следы эрозии: промоины и осыпи
        float gul = smoothstep(0.44, 0.22, vB.z), dep = smoothstep(0.56, 0.8, vB.z);
        col = mix(col, vec3(0.44,0.38,0.29) * (0.85 + 0.3*n3), gul * 0.45 * smoothstep(0.1, 0.25, slope));
        { float dk = dep * smoothstep(55.0, 100.0, P.y) * 0.7; if (dk > 0.003) col = mix(col, vec3(0.42,0.40,0.37) * (0.8 + 0.4*cell2(P.xz*0.9).y), dk); }
        // ---------------- скала по уклону
        float rockMask = smoothstep(0.23, 0.36, slope + (n2 - 0.5)*0.14 + gul*0.05);
        if (rockMask > 0.003) { vec3 rc; float rh; rockMT(P, Nw, rc, rh);
          col = mix(col, rc, rockMask); bumpH = mix(bumpH, rh, rockMask); bumpK = mix(bumpK, 1.3, rockMask); }
        // ---------------- галька и дно у воды
        float gr = smoothstep(0.02, 0.5, vB.x + (n2 - 0.5)*0.3*step(0.01, vB.x));
        if (gr > 0.0) {
          vec2 cb = cell2(P.xz*5.5);
          vec3 stone = mix(vec3(0.42,0.42,0.41), vec3(0.56,0.52,0.44), cb.y);
          stone = mix(stone, vec3(0.42,0.30,0.27), step(0.86, cb.y)); stone = mix(stone, vec3(0.29,0.33,0.32), step(cb.y, 0.12));
          stone *= 1.05 - 0.35*cb.x;
          vec3 gravel = mix(vec3(0.47,0.45,0.41) * (0.9 + 0.2*n3), stone, 0.75 * (1.0 - smoothstep(12.0, 45.0, dist)));
          gravel = mix(gravel, vec3(0.57,0.51,0.38) * (0.9 + 0.2*n4), smoothstep(0.58, 0.72, n2));       // песчаные линзы
          float depth = vWL - P.y;
          float wetK = smoothstep(-0.4, -0.04, depth);
          gravel *= mix(1.0, 0.6, wetK);
          gravel = mix(gravel, vec3(0.27,0.29,0.19) * (0.8 + 0.4*cb.y), smoothstep(0.0, 0.7, depth) * 0.55);  // водоросли на дне
          col = mix(col, gravel, gr); bumpH = mix(bumpH, (1.0 - cb.x)*0.9, gr); bumpK = mix(bumpK, 0.5 * nearK, gr);
          roughnessFactor = mix(roughnessFactor, 0.5, wetK * gr);
        }
        // ---------------- гравийная дорога
        if (vB.y > 0.01) {
          vec3 rg = vec3(0.50,0.45,0.37) * (0.84 + 0.22*vn(P.xz*1.3) + 0.12*n2);
          rg = mix(rg, vec3(0.38,0.35,0.30), step(0.72, cell2(P.xz*6.0).y) * 0.45 * nearK);
          float rk = smoothstep(0.05, 0.6, vB.y + (n3 - 0.5)*0.2);
          col = mix(col, rg, rk); bumpH = mix(bumpH, n4*0.12, rk); bumpK = mix(bumpK, 0.35, rk);
        }
        // ---------------- снежники
        float snow = smoothstep(${(SNOWLINE - 8).toFixed(1)}, ${(SNOWLINE + 16).toFixed(1)}, P.y + (n1 - 0.5)*36.0 + (0.5 - vB.z)*34.0) * smoothstep(0.5, 0.28, slope);
        col = mix(col, vec3(0.93,0.95,0.98), snow); bumpK *= 1.0 - snow*0.8;
        roughnessFactor = mix(roughnessFactor, 0.6, snow);
        // зерно вблизи, запечённые тени от гор (в тени — холоднее) и затенение ложбин
        col *= mix(1.0, texture2D(uGrain, P.xz*0.19).r * 1.22, nearK * 0.7 * (1.0 - snow));
        col *= mix(vec3(0.40,0.45,0.55), vec3(1.0), vA.x) * clamp(vA.y, 0.0, 1.1);
        diffuseColor.rgb = col;
        bumpK *= 1.0 - smoothstep(140.0, 480.0, dist);
        ${BUMP_GLSL}
      }`);
  };
  terrainMat.extensions = { derivatives: true };
  terrainMat.customProgramCacheKey = () => 'mtterrain';
  const terrain = new THREE.Mesh(tGeo, terrainMat);
  terrain.receiveShadow = true; terrain.name = 'MontanaTerrain';
  world.add(terrain);

  // ---------------------------------------------------------------------------
  // 11. НЕБО «BIG SKY» С КУЧЕВЫМИ ОБЛАКАМИ, ДАЛЬНИЕ ХРЕБТЫ
  // ---------------------------------------------------------------------------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: SUN_DIR.clone() }, uTime },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 sunDir; uniform float uTime; varying vec3 vDir;` + NOISE_GLSL + `
      float fbm5(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a*vn(p); p = p*2.07 + 13.7; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 hor = vec3(${HOR.join(',')}), mid = vec3(0.47,0.67,0.90), zen = vec3(0.20,0.41,0.77);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.2, h)); c = mix(c, zen, smoothstep(0.18, 0.85, h));
        float s = max(dot(d, sunDir), 0.0);
        c += vec3(1.0,0.9,0.72) * pow(s, 12.0) * 0.22;
        if (h > 0.015) {
          vec2 uv = d.xz / (h + 0.14) * 1.15 + vec2(uTime*0.0035, uTime*0.0012);
          float n = fbm5(uv*0.9), nd = fbm5(uv*3.1 + 5.0);
          float cov = smoothstep(0.50, 0.70, n + nd*0.2 - 0.04);
          float ns = fbm5((uv + sunDir.xz*0.16)*0.9);
          float lit = clamp(0.55 + (n - ns)*3.2, 0.0, 1.0);
          vec3 cc = mix(vec3(0.60,0.65,0.74), vec3(1.0,0.99,0.96), lit);
          cc = mix(cc, vec3(0.50,0.56,0.66), smoothstep(0.75, 1.0, cov)*(1.0 - lit)*0.6);   // плотные тёмные основания
          cc = mix(cc, hor, smoothstep(0.30, 0.03, h)*0.85);
          c = mix(c, cc, cov * smoothstep(0.015, 0.1, h) * 0.94);
        } else c = mix(hor, vec3(0.60,0.68,0.72), smoothstep(0.0, -0.2, h));
        c += vec3(1.0,0.96,0.86) * smoothstep(0.9988, 0.9996, s) * 2.0;
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4600, 40, 20), skyMat);
  sky.renderOrder = -1; sky.frustumCulled = false; world.add(sky);

  // подложка и кольцо лесистых холмов за краем карты, затем два дальних хребта со снегом
  {
    const NA = 120, NR = 9, P = [], Cc = [], I = [];
    const hz = C(0x000000).setRGB(HOR[0], HOR[1], HOR[2]);
    for (let a = 0; a <= NA; a++) {
      const th = a / NA * Math.PI * 2, cs = Math.cos(th), sn_ = Math.sin(th);
      const Rin = HALF / Math.max(Math.abs(cs), Math.abs(sn_));                 // внутренний край — по квадрату карты
      const ex = clamp(cs * Rin, -HALF, HALF), ez = clamp(sn_ * Rin, -HALF, HALF), edgeH = Hgrid(ex, ez);
      for (let r = 0; r <= NR; r++) {
        const t = r / NR, R = Rin - 8 + 1500 * t * t + 240 * t, x = cs * R, z = sn_ * R;
        const val = smooth(0.02, 0.3, riverDistA(clamp(x, -900, 900), z) / 600);                 // долина реки остаётся низкой
        const hills = WLr(clamp(x, -HALF, HALF)) + 2 + (60 + 260 * (0.5 + 0.5 * fbm(x * 0.0011 + 5, z * 0.0011 - 3, 4)) * (0.4 + t)) * (0.04 + 0.96 * val) + 14 * sn(x * 0.006, z * 0.006) * val;
        const hgt = r === 0 ? edgeH - 22 : mix(Math.min(edgeH - 6, hills), hills, smooth(0.0, 0.3, t));
        P.push(x, hgt, z);
        const cc = C(0x2c4a33).lerp(C(0x556b4a), 0.5 + 0.5 * sn(x * 0.004, z * 0.004)).lerp(C(0x6b6f66), smooth(170, 300, hgt)).lerp(hz, 0.12 + 0.5 * t);
        Cc.push(cc.r, cc.g, cc.b);
      }
    }
    for (let a = 0; a < NA; a++) for (let r = 0; r < NR; r++) { const p = a * (NR + 1) + r, q = p + NR + 1; I.push(p, p + 1, q, p + 1, q + 1, q); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
    g.setIndex(I); g.computeVertexNormals();
    world.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    // дальние хребты: силуэты в дымке, снег выше ломаной границы
    // дальние хребты: рельефные (гребни, кулуары, свет/тень от солнца), лес понизу, снег с рваной границей, дымка сгущается к подножию
    const ridgeMat = (haze) => new THREE.ShaderMaterial({
      side: THREE.DoubleSide, fog: false, uniforms: { uSun: { value: SUN_DIR.clone() }, uHaze: { value: haze } },
      vertexShader: `attribute vec4 aR; varying vec4 vR; varying vec3 vP; void main(){ vR = aR; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uSun; uniform float uHaze; varying vec4 vR; varying vec3 vP;` + NOISE_GLSL + `
        float rdg(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ float n = 1.0 - abs(vn(p)*2.0 - 1.0); s += a*n*n; p = p*2.05 + 9.1; a *= 0.5; } return s; }
        // условная высота склона: гребни расходятся вниз от вершин
        float hf(float u, float y, float top){ float d = (top - y)/max(top, 1.0); return rdg(vec2(u*0.0021, d*2.2 + u*0.0006)) * (0.35 + 0.65*d) ; }
        void main(){
          float u = vR.x, y = vP.y, top = vR.y, snowY = vR.z, base = vR.w;
          float e = 14.0;
          float h0 = hf(u, y, top), hu = hf(u + e, y, top), hy = hf(u, y + e, top);
          vec2 g = vec2(hu - h0, hy - h0) / e * 420.0;
          vec3 rad = normalize(vec3(vP.x, 0.0, vP.z));                 // наружу от карты
          vec3 tan = vec3(-rad.z, 0.0, rad.x);
          vec3 N = normalize(-rad * 0.75 + vec3(0.0, 0.85, 0.0) - tan * g.x - vec3(0.0, 1.0, 0.0) * g.y * 0.6);
          float lit = clamp(dot(N, uSun) * 0.75 + 0.35, 0.0, 1.0);
          float n1 = fbm2(vec2(u*0.004, y*0.006)), n2 = fbm2(vec2(u*0.02, y*0.02) + 3.0);
          vec3 rock = mix(vec3(0.27,0.29,0.34), vec3(0.40,0.39,0.40), n1);
          rock *= 0.85 + 0.3*sin(y*0.045 + n1*5.0)*0.5;                  // пласты
          vec3 forest = mix(vec3(0.10,0.19,0.15), vec3(0.16,0.25,0.17), n2);
          float tl = base * 0.62 + (n1 - 0.5) * 150.0 + h0 * 90.0;       // граница леса рваная, выше по гребням
          vec3 col = mix(forest, rock, smoothstep(tl - 30.0, tl + 40.0, y));
          float sl = snowY + (n2 - 0.5) * 120.0 - (h0 - 0.45) * 160.0;   // снег держится в кулуарах
          float snow = smoothstep(sl - 18.0, sl + 30.0, y);
          col = mix(col, vec3(0.94,0.96,0.99), snow);
          vec3 shade = mix(vec3(0.42,0.50,0.66), vec3(1.06,1.02,0.95), lit);
          col *= shade;
          float hz = clamp(uHaze + 0.22 * (1.0 - clamp(y / max(top, 1.0), 0.0, 1.0)), 0.0, 1.0);
          col = mix(col, vec3(${HOR.join(',')}), hz);
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    for (const ring of [{ R: 1900, base: 150, amp: 300, seed: 7, haze: 0.30 }, { R: 2700, base: 200, amp: 460, seed: 3, haze: 0.50 }, { R: 3600, base: 340, amp: 680, seed: 11, haze: 0.68 }]) {
      const N = 900, ROWS = 14, verts = [], aR = [], ix = [];
      // линия гребня: сначала считаем, затем сглаживаем — округлые плечи и купола вместо игл
      let tops = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const a = i / N * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const big = 0.5 + 0.5 * fbm(ca * 1.7 + ring.seed, sa * 1.7 - ring.seed, 3);
        let top = ring.base + ring.amp * 1.15 * (0.25 + 0.75 * big) * (0.62 + 0.42 * ridged(ca * 4.2 + ring.seed, sa * 4.2, 3) + 0.2 * fbm(ca * 9 - ring.seed, sa * 9, 2));
        if (ring.R < 2000) top *= 0.35 + 0.65 * smooth(0.05, 0.3, Math.abs(sa));          // ближний хребет расступается у выходов долины
        tops[i] = top;
      }
      for (let pass = 0; pass < 2; pass++) { const c = Float32Array.from(tops), W = 4; for (let i = 0; i < N; i++) { let q = 0, w = 0; for (let k = -W; k <= W; k++) { const ww = W + 1 - Math.abs(k); q += c[(i + k + N) % N] * ww; w += ww; } tops[i] = q / w; } }
      for (let i = 0; i <= N; i++) {
        const a = i / N * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const top = tops[i % N] + 7 * sn(ca * 40, sa * 40 + ring.seed);
        const snowY = ring.base + ring.amp * 0.5;
        for (let r = 0; r <= ROWS; r++) {
          const t = r / ROWS, y = -60 + (top + 60) * t, R = ring.R + (1 - t) * (1 - t) * -ring.R * 0.16;   // подножие ближе к зрителю — склон, а не стена
          verts.push(ca * R, y, sa * R); aR.push(a * ring.R, top, snowY, ring.base);
        }
      }
      for (let i = 0; i < N; i++) for (let r = 0; r < ROWS; r++) { const p = i * (ROWS + 1) + r, q = p + ROWS + 1; ix.push(p, p + 1, q, p + 1, q + 1, q); }
      const g2 = new THREE.BufferGeometry();
      g2.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g2.setAttribute('aR', new THREE.Float32BufferAttribute(aR, 4)); g2.setIndex(ix);
      const m = new THREE.Mesh(g2, ridgeMat(ring.haze)); m.frustumCulled = false; world.add(m);
    }
  }

  // ---------------------------------------------------------------------------
  // 12. ВОДА: лента по руслу, течение, перекаты, отражение неба, блик солнца
  // ---------------------------------------------------------------------------
  const waterMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSun: { value: SUN_DIR.clone() } }]),
    vertexShader: `attribute vec3 aFlow; attribute vec2 aSL; attribute float aShade; varying vec3 vW; varying vec3 vFlow; varying vec2 vSL; varying float vShade;
      #include <fog_pars_vertex>
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vFlow = aFlow; vSL = aSL; vShade = aShade;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uSun; varying vec3 vW; varying vec3 vFlow; varying vec2 vSL; varying float vShade;
      #include <fog_pars_fragment>
      ` + NOISE_GLSL + `
      float wave(vec2 p, float t){ return fbm2(vec2(p.x - t*1.5, p.y)*vec2(0.55, 1.1)) * 0.6 + vn(vec2(p.x - t*2.3, p.y + t*0.2)*vec2(1.6, 3.1)) * 0.4; }
      void main(){
        float depth = vFlow.z;
        float edge = smoothstep(-0.03, 0.10, depth);
        if (edge <= 0.002) discard;
        vec2 T = normalize(vFlow.xy), B = vec2(-T.y, T.x);
        float sp = 0.7 + 0.5*smoothstep(1.1, 0.3, depth);                       // на перекатах течение быстрее
        vec2 p = vec2(vSL.x, vSL.y);
        float t = uTime * sp;
        float e = 0.35;
        float h0 = wave(p, t), hx = wave(p + vec2(e, 0.0), t), hy = wave(p + vec2(0.0, e), t);
        float amp = (0.05 + 0.10*smoothstep(0.9, 0.25, depth)) * (1.0 - 0.7*smoothstep(40.0, 200.0, length(cameraPosition - vW)));
        vec2 g = vec2(hx - h0, hy - h0) / e * amp;
        vec3 N = normalize(vec3(-(T.x*g.x + B.x*g.y), 1.0, -(T.y*g.x + B.y*g.y)));
        vec3 V = normalize(cameraPosition - vW);
        float fres = 0.03 + 0.97*pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        vec3 skyc = mix(vec3(${HOR.join(',')}), vec3(0.36,0.58,0.88), smoothstep(0.0, 0.55, R.y));
        skyc = mix(skyc, vec3(0.97), smoothstep(0.55, 0.72, fbm2(R.xz/(R.y + 0.15)*1.0 + uTime*0.003)) * 0.5);   // отражение облаков
        vec3 body = mix(vec3(0.30,0.36,0.26), vec3(0.07,0.20,0.22), smoothstep(0.15, 1.15, depth));
        vec3 c = mix(body, skyc, fres);
        float sd = max(dot(R, uSun), 0.0);
        c += vec3(1.0,0.95,0.82) * (pow(sd, 380.0)*5.0 + pow(sd, 40.0)*0.25) * vShade;
        // пена: перекаты и кромка берега
        float rif = smoothstep(0.62, 0.12, depth) * smoothstep(0.52, 0.78, wave(p*1.7 + 9.0, t*1.25)) ;
        float bank = smoothstep(0.10, 0.02, depth) * smoothstep(0.45, 0.8, vn(p*2.2 + vec2(-t*0.6, 0.0)));
        float foam = clamp(rif*0.7 + bank*0.45, 0.0, 1.0);
        c = mix(c, vec3(0.93,0.96,0.97), foam);
        c *= mix(vec3(0.50,0.56,0.68), vec3(1.0), vShade);
        float alpha = mix(0.30, 0.90, smoothstep(0.0, 1.0, depth));
        alpha = max(max(alpha, fres*0.95), foam) * edge;
        gl_FragColor = vec4(c, alpha);
        #include <fog_fragment>
      }`
  });
  waterMat.uniforms.uTime = uTime;
  function waterRibbon(samples, across, extra, dir) {
    const P = [], F = [], SL = [], SH = [], I = []; let rows = 0;
    for (let i = 0; i < samples.length; i += 1) {
      const p = samples[i]; if (p.inRiver) continue;
      if (Math.abs(p.x) > HALF + 2 || Math.abs(p.z) > HALF + 2) continue;
      const w = p.hw + extra, s = p.s;
      for (let a = 0; a <= across; a++) {
        const u = a / across * 2 - 1, x = p.x - p.tz * u * w, z = p.z + p.tx * u * w;
        const inside = Math.abs(x) <= HALF && Math.abs(z) <= HALF;
        P.push(x, p.wl, z); F.push(p.tx, p.tz, inside ? p.wl - Hgrid(x, z) : -1); SL.push(s * dir, u * w); SH.push(bil(gShade, x, z));
      }
      if (rows > 0) for (let a = 0; a < across; a++) { const q = (rows - 1) * (across + 1) + a, r = q + across + 1; I.push(q, r, q + 1, q + 1, r, r + 1); }
      rows++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aFlow', new THREE.Float32BufferAttribute(F, 3));
    g.setAttribute('aSL', new THREE.Float32BufferAttribute(SL, 2)); g.setAttribute('aShade', new THREE.Float32BufferAttribute(SH, 1));
    g.setIndex(I); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, waterMat); m.renderOrder = -0.5; m.frustumCulled = false; world.add(m); return m;
  }
  waterRibbon(RIVER, 14, 5, 1);
  waterRibbon(CREEK, 6, 2.5, -1);      // у ручья точки идут вверх по течению

  // ---------------------------------------------------------------------------
  // 13. ФЛОРА МОНТАНЫ: ель/пихта, сосна жёлтая, осина, тополь, ива
  // Каждое дерево — один меш с одним материалом (кора и хвоя в одном атласе).
  // ---------------------------------------------------------------------------
  const PH_ = PLANTS._h, Acc = PH_.Acc, accGeo = PH_.accGeo;
  const BARK_U = [0.012, 0.105], LEAF_U = [0.17, 0.995];
  function remapU(a, fromVert, u0, u1) { for (let i = fromVert; i < a.U.length / 2; i++) a.U[i * 2] = u0 + a.U[i * 2] * (u1 - u0); }
  // Атлас: слева полоса коры, справа листва. Полоса коры залита СРЕДНИМ цветом листвы (с яркостным
  // рисунком), а настоящий цвет коры задают цвета вершин — иначе на мипах кора «красит» кроны в бурый.
  function atlas(barkLum, drawLeaf) {
    let avg = [80, 110, 60];
    const t = PH_.foliageTex(512, (g, w, h) => {
      g.save(); g.translate(82, 0); drawLeaf(g, w - 86, h); g.restore();
      const d = g.getImageData(82, 0, w - 82, h).data; let r = 0, gg = 0, bb = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += d[i]; gg += d[i + 1]; bb += d[i + 2]; n++; }
      avg = [r / n, gg / n, bb / n];
      g.fillStyle = `rgb(${avg[0] | 0},${avg[1] | 0},${avg[2] | 0})`; g.fillRect(0, 0, 62, h);
      barkLum(g, 62, h);
    });
    t.wrapT = THREE.RepeatWrapping; t.avg = avg.map(v => v / 255); return t;
  }
  const R_ = Math.random;
  const barkStreaks = (g, bw, h, n, horiz, strength = 0.3) => {
    for (let i = 0; i < n; i++) {
      g.strokeStyle = '#000'; g.lineWidth = 1 + R_() * 2.5; g.globalAlpha = strength * (0.4 + R_() * 0.6);
      const x = R_() * bw, y = R_() * h; g.beginPath();
      if (horiz) { g.moveTo(x - 8 - R_() * 14, y); g.quadraticCurveTo(x, y - 3 + R_() * 6, x + 8 + R_() * 14, y); }
      else { g.moveTo(x, y); g.bezierCurveTo(x + 5, y + 12, x - 5, y + 26, x + (R_() - 0.5) * 6, y + 30 + R_() * 40); }
      g.stroke();
    }
    g.globalAlpha = 1;
  };
  // еловая лапа: ось снизу вверх, веточки с хвоей
  function drawBough(g, w, h, pal) {
    const cx = w / 2;
    for (let pass = 0; pass < 2; pass++) for (let y = h - 4; y > 14; y -= 10) {
      const t = (h - y) / h, L = (w * 0.47) * Math.pow(Math.sin(Math.PI * (0.12 + 0.86 * t)), 0.7) * (0.75 + R_() * 0.35);
      for (const sd of [-1, 1]) {
        const ang = -Math.PI / 2 + sd * (0.95 + R_() * 0.3 - t * 0.25), ex = cx + Math.cos(ang) * L, ey = y + Math.sin(ang) * L * 0.75 + L * 0.18;
        const v = R_(), c = pal[pass][0].map((c0, i) => Math.round(c0 + (pal[pass][1][i] - c0) * v));
        g.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.lineWidth = pass ? 5 : 12; g.lineCap = 'round';
        g.beginPath(); g.moveTo(cx, y); g.quadraticCurveTo((cx + ex) / 2, y - 4, ex, ey); g.stroke();
        const nn = Math.max(4, L / 4 | 0);                                      // хвоинки
        for (let k = 0; k < nn; k++) {
          const u = (k + R_()) / nn, px = cx + (ex - cx) * u, py = y + (ey - y) * u, na = ang + (R_() < 0.5 ? 1 : -1) * (0.7 + R_() * 0.6), nl = 7 + R_() * 9;
          const c2 = pal[pass][0].map((c0, i) => Math.round(c0 + (pal[pass][1][i] - c0) * (0.3 + 0.7 * R_()) + (u > 0.75 ? 14 : 0)));
          g.strokeStyle = `rgb(${c2[0]},${c2[1]},${c2[2]})`; g.lineWidth = 2.2;
          g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(na) * nl, py + Math.sin(na) * nl); g.stroke();
        }
      }
    }
  }
  const puffs = (g, w, h, n, draw) => { for (let i = 0; i < n; i++) { const a = R_() * 6.283, d = Math.pow(R_(), 0.62) * 0.46 * (0.8 + 0.2 * Math.sin(a * 5 + 1)); draw(w / 2 + Math.cos(a) * d * w, h / 2 + Math.sin(a) * d * h); } };
  const leaves = (n, r0, r1, col) => (g, w, h) => {
    // гроздья листьев на веточках: сначала тёмная глубина, сверху светлые листья
    for (let pass = 0; pass < 2; pass++) puffs(g, w, h, pass ? n : n * 0.45, (x, y) => { const c = col(R_(), pass); g.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; const rad = r0 + R_() * (r1 - r0); g.beginPath(); g.ellipse(x, y, rad * (pass ? 1 : 2.4), rad * (pass ? 0.72 : 2.0), R_() * 3.14, 0, 7); g.fill(); });
  };
  const TEXS = {
    spruce: atlas((g, bw, h) => barkStreaks(g, bw, h, 150, false, 0.35),
      (g, w, h) => drawBough(g, w, h, [[[16, 36, 26], [30, 56, 38]], [[30, 60, 42], [58, 92, 62]]])),
    pine: atlas((g, bw, h) => { barkStreaks(g, bw, h, 110, false, 0.3); for (let i = 0; i < 26; i++) { g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2.5; const y = R_() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(bw * 0.3, y + 8, bw * 0.6, y - 8, bw, y + 4); g.stroke(); } },
      (g, w, h) => puffs(g, w, h, 62, (x, y) => {                                  // пучки длинной хвои
        const n = 30; for (let k = 0; k < n; k++) { const a = R_() * 6.28, L = 24 + R_() * 30, v = R_(); g.strokeStyle = `rgb(${34 + v * 40 | 0},${62 + v * 46 | 0},${30 + v * 24 | 0})`; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
      })),
    aspen: atlas((g, bw, h) => { barkStreaks(g, bw, h, 50, true, 0.16); for (let i = 0; i < 16; i++) { const y = R_() * h, x = R_() * bw; g.fillStyle = 'rgba(0,0,0,0.85)'; g.beginPath(); g.ellipse(x, y, 5 + R_() * 9, 2 + R_() * 3, 0, 0, 7); g.fill(); } },
      leaves(1500, 4.2, 6.2, (v, top) => top ? (R_() < 0.05 ? [176 + v * 30, 160 + v * 20, 44] : [62 + v * 46, 104 + v * 44, 30 + v * 24]) : [38 + v * 14, 66 + v * 16, 22])),
    cotton: atlas((g, bw, h) => barkStreaks(g, bw, h, 170, false, 0.4),
      leaves(1650, 4.6, 7.0, (v, top) => top ? [40 + v * 40, 80 + v * 42, 24 + v * 22] : [26 + v * 12, 52 + v * 14, 18]))
  };
  const BARK = { spruce: [0.30, 0.25, 0.21], pine: [0.60, 0.34, 0.18], aspen: [0.84, 0.83, 0.74], cotton: [0.42, 0.39, 0.35] };
  const barkCol = (k, m = 1) => BARK[k].map((c, i) => c * m / Math.max(0.05, TEXS[k].avg[i]));
  const TMAT = {}; for (const k in TEXS) TMAT[k] = PH_.leafMat(TEXS[k], false);

  function trunk(a, pts, r0, r1, col, radial = 6) { const s = a.P.length / 3; PH_.stick(a, pts, r0, r1, col, radial); remapU(a, s, BARK_U[0], BARK_U[1]); for (let i = s; i < a.U.length / 2; i++) a.U[i * 2 + 1] *= 3; }
  function cloud(a, c, radius, count, size, r, col, flat = 0.8) { const s = a.P.length / 3; PH_.cards(a, c.x, c.y, c.z, radius, count, size, r, col, 0.45, flat); remapU(a, s, LEAF_U[0], LEAF_U[1]); }
  // ветвь-лапа: «домик» из двух плоскостей (низ кроны) или одна плоскость (верх)
  function bough(a, y, ang, len, droop, shade, tent) {
    const cs = Math.cos(ang), sn_ = Math.sin(ang), w = len * 0.66;
    const tip = new V3(cs * len * Math.cos(droop), y - len * Math.sin(droop) + len * 0.06, sn_ * len * Math.cos(droop));
    const sx = -sn_ * w / 2, sz = cs * w / 2, sag = tent ? w * 0.2 : 0, s = a.P.length / 3;
    const n = new V3(cs * 0.5, 0.86, sn_ * 0.5).normalize();
    const put = (x, yy, z, u, v, sh) => { a.P.push(x, yy, z); a.U.push(LEAF_U[0] + u * (LEAF_U[1] - LEAF_U[0]), v); a.N.push(n.x, n.y, n.z); a.C.push(sh, sh, sh); };
    const inner = shade * 0.5, outer = shade;
    if (tent) {
      put(-sx * 0.5, y - sag, -sz * 0.5, 0, 0.02, inner); put(0, y, 0, 0.5, 0.02, inner); put(sx * 0.5, y - sag, sz * 0.5, 1, 0.02, inner);
      put(tip.x - sx, tip.y - sag, tip.z - sz, 0, 1, outer); put(tip.x, tip.y, tip.z, 0.5, 1, outer); put(tip.x + sx, tip.y - sag, tip.z + sz, 1, 1, outer);
      a.I.push(s, s + 1, s + 4, s, s + 4, s + 3, s + 1, s + 2, s + 5, s + 1, s + 5, s + 4);
    } else {
      put(-sx * 0.5, y, -sz * 0.5, 0, 0.02, inner); put(sx * 0.5, y, sz * 0.5, 1, 0.02, inner); put(tip.x + sx, tip.y, tip.z + sz, 1, 1, outer); put(tip.x - sx, tip.y, tip.z - sz, 0, 1, outer);
      a.I.push(s, s + 1, s + 2, s, s + 2, s + 3);
    }
    a.hasN = true;
  }
  function spruce(seed, slim) {
    const r = PH_.mulberry32(seed), a = Acc();
    const H0 = (slim ? 9 : 12) + r() * (slim ? 6 : 9), R = H0 * (slim ? 0.105 : 0.15 + r() * 0.05), clear = 0.07 + r() * 0.1;
    trunk(a, [new V3(0, -0.5, 0), new V3(0, H0 * 0.5, 0), new V3(0, H0 * 0.96, 0)], 0.13 + H0 * 0.012, 0.03, barkCol('spruce'));
    const levels = Math.round(H0 * (slim ? 0.8 : 0.66));
    for (let L = 0; L < levels; L++) {
      const t = L / (levels - 1), y = H0 * (clear + (0.97 - clear) * t);
      const rad = Math.max(0.45, R * Math.pow(1 - t, 0.85) * (0.85 + r() * 0.32) + 0.35);
      const n = t > 0.8 ? 3 : t > 0.4 ? 4 : 5, a0 = r() * 6.28;
      for (let k = 0; k < n; k++) bough(a, y, a0 + (k + (r() - 0.5) * 0.6) / n * 6.28, rad * (0.82 + r() * 0.36), (0.5 - 0.42 * t) + (r() - 0.5) * 0.16, 0.66 + 0.34 * t, t < 0.45);
    }
    for (let k = 0; k < 2; k++) bough(a, H0 * 0.93, k * 1.57 + r(), H0 * 0.085, -1.45, 1, false);     // вершинка
    return { geo: accGeo(a), mat: TMAT.spruce, r: 0.5, h: H0 };
  }
  function pine(seed) {
    const r = PH_.mulberry32(seed), a = Acc();
    const H0 = 13 + r() * 8;
    const pts = PH_.bentPath(new V3(0, -0.5, 0), new V3((r() - 0.5) * 0.12, 1, (r() - 0.5) * 0.12), H0, 5, 0.07, r);
    trunk(a, pts, 0.2 + H0 * 0.012, 0.07, barkCol('pine'), 7);
    const top = pts[pts.length - 1];
    const nb = 7 + Math.floor(r() * 4);
    for (let b = 0; b < nb; b++) {
      const t = 0.48 + 0.5 * (b / nb), i = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1))), f = t * (pts.length - 1) - i;
      const from = pts[i].clone().lerp(pts[i + 1], f), ang = r() * 6.28, len = (1.6 + r() * 2.2) * (1.25 - t * 0.6);
      const bp = PH_.bentPath(from, new V3(Math.cos(ang), 0.25 + r() * 0.4, Math.sin(ang)), len, 3, 0.25, r);
      trunk(a, bp, 0.07, 0.025, barkCol('pine', 0.7), 4);
      cloud(a, bp[bp.length - 1], 0.9 + r() * 0.6, 7, [1.5, 2.3], r, [1, 1, 1], 0.6);
    }
    cloud(a, new V3(top.x, top.y - 0.3, top.z), 1.2, 9, [1.5, 2.2], r, [1, 1, 1], 0.9);
    return { geo: accGeo(a), mat: TMAT.pine, r: 0.55, h: H0 };
  }
  function broadleaf(seed, kind) {
    const r = PH_.mulberry32(seed), a = Acc(), big = kind === 'cotton';
    const H0 = big ? 12 + r() * 7 : 8 + r() * 5, cr = big ? 2.1 + r() * 0.8 : 1.15 + r() * 0.45;
    const pts = PH_.bentPath(new V3(0, -0.5, 0), new V3((r() - 0.5) * 0.2, 1, (r() - 0.5) * 0.2), H0 * 0.82, 5, big ? 0.14 : 0.08, r);
    trunk(a, pts, big ? 0.36 + r() * 0.2 : 0.11 + r() * 0.05, big ? 0.1 : 0.04, barkCol(kind), big ? 8 : 6);
    const nb = big ? 7 : 5, top = pts[pts.length - 1];
    for (let b = 0; b < nb; b++) {
      const t = 0.42 + 0.55 * (b / nb), i = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
      const from = pts[i].clone().lerp(pts[i + 1], t * (pts.length - 1) - i), ang = r() * 6.28 + b * 2.4, len = (big ? 2.6 : 1.2) * (0.7 + r() * 0.7);
      const bp = PH_.bentPath(from, new V3(Math.cos(ang), 0.5 + r() * 0.5, Math.sin(ang)), len, 3, 0.3, r);
      trunk(a, bp, big ? 0.1 : 0.04, 0.02, barkCol(kind, 0.8), 4);
      cloud(a, bp[bp.length - 1], cr * (0.75 + r() * 0.4), big ? 9 : 8, big ? [1.7, 2.6] : [1.0, 1.5], r, [1, 1, 1], 0.85);
    }
    cloud(a, new V3(top.x, top.y + cr * 0.3, top.z), cr, 10, big ? [1.7, 2.6] : [1.0, 1.5], r, [1, 1, 1], 0.9);
    return { geo: accGeo(a), mat: TMAT[kind], r: big ? 0.7 : 0.4, h: H0 };
  }
  function willow(seed) {
    const r = PH_.mulberry32(seed), a = Acc();
    const n = 4 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) { const ang = r() * 6.28, d = r() * 0.9, rad = 0.7 + r() * 0.6; cloud(a, new V3(Math.cos(ang) * d, rad * 0.75 + r() * 0.5, Math.sin(ang) * d), rad, 7, [0.9, 1.4], r, [0.92, 1, 0.86], 0.75); }
    return { parts: [{ geo: accGeo(a), mat: TMAT.cotton }], r: 1.0 };
  }

  // ---------------------------------------------------------------------------
  // 14. РАССТАНОВКА ДЕРЕВЬЕВ (чанки с отсечением), дальний лес — дешёвые конусы
  // ---------------------------------------------------------------------------
  const colliders = [], blockers = [], crushables = [], cylinders = [], boxes = [], props = [];
  const dummy = new THREE.Object3D(), tmpCol = new THREE.Color();
  const gridK = (x, z) => clamp(Math.round((z + HALF) / CELL), 0, SEG) * NV + clamp(Math.round((x + HALF) / CELL), 0, SEG);
  const shadeAt = (x, z) => { const s = bil(gShade, x, z); return 0.46 + 0.54 * s; };
  function shareGeo(g, sphere) { const n = new THREE.BufferGeometry(); for (const k in g.attributes) n.setAttribute(k, g.attributes[k]); n.setIndex(g.index); n.boundingSphere = sphere; return n; }
  const TREE_SPEC = {
    spruce: [0, 1].map(i => spruce(SEED + 100 + i * 13, false)), fir: [0].map(i => spruce(SEED + 160 + i * 13, true)),
    pine: [0, 1].map(i => pine(SEED + 200 + i * 13)), aspen: [0, 1].map(i => broadleaf(SEED + 300 + i * 13, 'aspen')), cotton: [0].map(i => broadleaf(SEED + 400 + i * 13, 'cotton'))
  };
  const treeList = {}, farTrees = [];
  let treeLOD = () => { };
  let treeCount = 0;
  {
    const tr = mulberry32(SEED + 777), STEP = 5.6, CH = 8, PLAYR = 522;      // 8×8 участков по ~130 м: отсечение и LOD по участкам
    for (let z = -HALF + 5; z < HALF - 5; z += STEP) for (let x = -HALF + 5; x < HALF - 5; x += STEP) {
      const jx = x + (tr() - 0.5) * STEP * 0.92, jz = z + (tr() - 0.5) * STEP * 0.92, k = gridK(jx, jz);
      const v = bil(gForest, jx, jz); if (tr() > v * 0.82) continue;
      const h = Hgrid(jx, jz), kind = gKind[k];
      if (Math.abs(jx) > PLAYR || Math.abs(jz) > PLAYR) { farTrees.push({ x: jx, z: jz, h, s: 0.8 + tr() * 0.5, leafy: kind === 3 }); continue; }
      let sp; const q = tr(), high = h > 96 + 14 * tr();
      if (kind === 3) sp = q < 0.72 ? 'cotton' : 'aspen';
      else if (high) sp = q < 0.6 ? 'fir' : 'spruce';
      else if (kind === 2) sp = q < 0.48 ? 'aspen' : q < 0.8 ? 'pine' : 'spruce';
      else sp = q < 0.6 ? 'spruce' : q < 0.88 ? 'pine' : q < 0.95 ? 'fir' : 'aspen';
      const variant = Math.floor(tr() * TREE_SPEC[sp].length);
      const cx = clamp(Math.floor((jx + PLAYR) / (2 * PLAYR) * CH), 0, CH - 1), cz = clamp(Math.floor((jz + PLAYR) / (2 * PLAYR) * CH), 0, CH - 1);
      const key = sp + ':' + variant + ':' + (cz * CH + cx);
      (treeList[key] = treeList[key] || []).push({ chunk: cz * CH + cx, x: jx, z: jz, h, s: (0.78 + tr() * 0.5) * (high ? 0.8 : 1), rot: tr() * 6.28, tx: (tr() - 0.5) * 0.07, tz: (tr() - 0.5) * 0.07 });
    }
    // дальний лес на склонах за пределами поля боя
    const cone = (() => { const a = new THREE.ConeGeometry(0.5, 0.62, 6, 1, true).translate(0, 0.69, 0), b = new THREE.ConeGeometry(0.62, 0.7, 6, 1, true).translate(0, 0.35, 0);
      const g = new THREE.BufferGeometry(), P = [], Cc = [];
      for (const q of [a, b]) { const n = q.toNonIndexed(), p = n.attributes.position; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); const sh = 0.55 + 0.6 * p.getY(i); Cc.push(sh, sh, sh); } }
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.computeVertexNormals(); return g; })();
    const farMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const CHUNKS = Array.from({ length: CH * CH }, (_, k) => ({ x: -PLAYR + ((k % CH) + 0.5) * (2 * PLAYR / CH), z: -PLAYR + (Math.floor(k / CH) + 0.5) * (2 * PLAYR / CH), detail: [], lodPts: [], far: null, near: true }));
    for (const key in treeList) {
      const [sp, variant] = key.split(':'), spec = TREE_SPEC[sp][+variant], pts = treeList[key];
      const c = new V3(); pts.forEach(p => c.add(new V3(p.x, p.h, p.z))); c.divideScalar(pts.length);
      let rad = 0; pts.forEach(p => { rad = Math.max(rad, Math.hypot(p.x - c.x, p.h - c.y, p.z - c.z)); });
      const im = new THREE.InstancedMesh(shareGeo(spec.geo, new THREE.Sphere(c, rad + spec.h * 1.4)), spec.mat, pts.length);
      pts.forEach((p, i) => {
        dummy.position.set(p.x, p.h - 0.15, p.z); dummy.rotation.set(p.tx, p.rot, p.tz); dummy.scale.setScalar(p.s); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
        const sh = shadeAt(p.x, p.z) * (0.86 + 0.24 * rnd()); tmpCol.setRGB(sh * (0.96 + 0.08 * rnd()), sh, sh * (0.94 + 0.1 * rnd())); im.setColorAt(i, tmpCol);
        const ch = CHUNKS[p.chunk], lp = { x: p.x, z: p.z, h: p.h, hh: spec.h * p.s, leafy: sp === 'aspen' || sp === 'cotton', sh }; ch.lodPts.push(lp);
        crushables.push({ x: p.x, z: p.z, r: spec.r * p.s, kind: 'tree', meshes: [im], index: i, alive: true, tall: true, lod: lp });
      });
      CHUNKS[pts[0].chunk].detail.push(im);
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
      im.frustumCulled = true; im.castShadow = true; im.receiveShadow = false;
      const dm = PLANTS.depthFor(spec.mat); if (dm) im.customDepthMaterial = dm;
      world.add(im); treeCount += pts.length;
    }
    // дальний LOD участка: те же деревья дешёвыми конусами (2 конуса = 24 треугольника вместо ~2000)
    CHUNKS.forEach(ch => {
      if (!ch.lodPts.length) return;
      const im = new THREE.InstancedMesh(shareGeo(cone, new THREE.Sphere(new V3(ch.x, Hgrid(ch.x, ch.z), ch.z), 130)), farMat, ch.lodPts.length);
      ch.lodPts.forEach((p, i) => {
        dummy.position.set(p.x, p.h - 0.3, p.z); dummy.rotation.set(0, (i * 2.399) % 6.28, 0); const w = p.hh * (p.leafy ? 0.42 : 0.3); dummy.scale.set(w, p.hh, w); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
        if (p.leafy) tmpCol.setRGB(0.27 * p.sh, 0.42 * p.sh, 0.17 * p.sh); else tmpCol.setRGB(0.12 * p.sh, 0.23 * p.sh, 0.15 * p.sh); im.setColorAt(i, tmpCol);
        p.mesh = im; p.index = i;
      });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.visible = false; im.castShadow = false; world.add(im); ch.far = im;
    });
    // переключение по расстоянию от камеры (с гистерезисом), раз в несколько кадров
    let lodFrame = 0;
    treeLOD = (cam) => {
      if ((lodFrame++ & 7) !== 0) return;
      const cx = cam.position.x, cz = cam.position.z;
      for (const ch of CHUNKS) {
        if (!ch.far) continue;
        const d = Math.hypot(ch.x - cx, ch.z - cz) - 92;                 // до ближнего края участка
        const near = ch.near ? d < 300 : d < 250;
        if (near === ch.near) continue;
        ch.near = near; ch.detail.forEach(m => { m.visible = near; }); ch.far.visible = !near;
      }
    };
    const quads = [[], [], [], []];
    farTrees.forEach(p => quads[(p.x > 0 ? 1 : 0) + (p.z > 0 ? 2 : 0)].push(p));
    quads.forEach(pts => {
      if (!pts.length) return;
      const c = new V3(); pts.forEach(p => c.add(new V3(p.x, p.h, p.z))); c.divideScalar(pts.length);
      let rad = 0; pts.forEach(p => { rad = Math.max(rad, Math.hypot(p.x - c.x, p.h - c.y, p.z - c.z)); });
      const im = new THREE.InstancedMesh(shareGeo(cone, new THREE.Sphere(c, rad + 30)), farMat, pts.length);
      pts.forEach((p, i) => {
        const hh = (p.leafy ? 11 : 15) * p.s; dummy.position.set(p.x, p.h - 0.3, p.z); dummy.rotation.set(0, rnd() * 6.28, 0); dummy.scale.set(hh * (p.leafy ? 0.7 : 0.36), hh, hh * (p.leafy ? 0.7 : 0.36)); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
        const sh = shadeAt(p.x, p.z) * (0.85 + 0.3 * rnd()); if (p.leafy) tmpCol.setRGB(0.26 * sh, 0.40 * sh, 0.17 * sh); else tmpCol.setRGB(0.13 * sh, 0.25 * sh, 0.16 * sh); im.setColorAt(i, tmpCol);
      });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.frustumCulled = true; world.add(im);
    });
  }

  // ---------------------------------------------------------------------------
  // 15. КУСТАРНИК, КАМНИ, СКАЛЬНЫЕ ВЫХОДЫ
  // ---------------------------------------------------------------------------
  function samplePoints(count, test, extent = PLAY + 40, tries = 40) {
    const pts = [];
    for (let n = 0; n < count * tries && pts.length < count; n++) {
      const x = rr(-extent, extent), z = rr(-extent, extent), k = gridK(x, z);
      if (roadD[k] < 6 || inRanch(x, z, 4) || nearSpawn(x, z, 9)) continue;
      const h = Hgrid(x, z); if (waterLevel(x, z) > h - 0.25) continue;
      const g = grade(x, z);
      if (test(x, z, h, g, k)) pts.push({ x, z, h, g });
    }
    return pts;
  }
  function instanced(geo, mat, pts, place, castShadow = true) {
    const im = new THREE.InstancedMesh(geo, mat, pts.length);
    pts.forEach((p, i) => { place(p, dummy, i); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    im.castShadow = castShadow; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; world.add(im); return im;
  }
  function shadeColors(im, pts, base, spread) {
    pts.forEach((p, i) => { const sh = shadeAt(p.x, p.z); tmpCol.copy(base).offsetHSL((rnd() - 0.5) * spread[0], (rnd() - 0.5) * spread[1], (rnd() - 0.5) * spread[2]).multiplyScalar(sh); im.setColorAt(i, tmpCol); });
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }
  function plantSpecies(make, variants, perVariant, test, o = {}) {
    for (let v = 0; v < variants; v++) {
      const sp = make(SEED + (o.seed || 0) + v * 17), pts = samplePoints(perVariant, test, o.extent || PLAY + 40);
      if (!pts.length) continue;
      const sc = pts.map(() => rr(o.smin || 0.85, o.smax || 1.2)), rot = pts.map(() => rnd() * 6.28);
      const meshes = sp.parts.map(part => {
        const im = instanced(part.geo, part.mat, pts, (p, d, i) => { d.position.set(p.x, p.h - (o.sink || 0.05), p.z); d.rotation.set(0, rot[i], 0); d.scale.setScalar(sc[i]); }, o.shadow !== false);
        const dm = PLANTS.depthFor(part.mat); if (dm) im.customDepthMaterial = dm;
        shadeColors(im, pts, o.tint || C(0xe8e8e8), [0.03, 0.0, 0.12]); return im;
      });
      pts.forEach((p, i) => crushables.push({ x: p.x, z: p.z, r: (sp.r || 0.6) * sc[i], kind: 'bush', meshes, index: i, alive: true, tall: !!sp.tall }));
    }
  }
  const fo = k => gForest[k], fi = k => gField[k];
  // ива по берегам, «кроличий куст» и полынь на сухих террасах, можжевельник на каменистых склонах
  plantSpecies(willow, 4, 85, (x, z, h, g, k) => { const rd = rvD[k] < 1e8 ? rvD[k] - RIVER[rvI[k]].hw : 99, cd = crD[k] < 1e8 ? crD[k] - CREEK[crI[k]].hw : 99; return Math.min(rd, cd) < 14 && Math.min(rd, cd) > 1.5 && g < 0.5; }, { seed: 500, smin: 0.8, smax: 1.7, extent: PLAY + 60 });
  plantSpecies(willow, 3, 120, (x, z, h, g, k) => fo(k) > 0.12 && fo(k) < 0.6 && g < 0.6, { seed: 540, smin: 0.7, smax: 1.3, extent: PLAY + 40, tint: C(0xd8e8c8) });
  plantSpecies(PLANTS.brittle, 4, 230, (x, z, h, g, k) => fi(k) < 0.05 && fo(k) < 0.3 && gWet[k] < 0.55 && g < 0.55 && h < 110, { seed: 600, smin: 0.7, smax: 1.4, extent: PLAY + 60, shadow: false, tint: C(0xd4dccb) });
  plantSpecies(PLANTS.juniper, 5, 46, (x, z, h, g, k) => (g > 0.2 || knobAt(x, z) > 0.35) && g < 0.8 && fi(k) < 0.05 && h < 120, { seed: 700, smin: 0.7, smax: 1.2, extent: PLAY + 60, sink: 0.2, tint: C(0xcfe0c6) });

  function rockGeo(seed, detail) {
    const r = mulberry32(seed), g = new THREE.IcosahedronGeometry(1, detail).toNonIndexed(), p = g.attributes.position, map = new Map();
    for (let i = 0; i < p.count; i++) {
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      if (!map.has(key)) map.set(key, 0.74 + r() * 0.4 + 0.2 * sn(p.getX(i) * 2.1 + seed, p.getZ(i) * 2.1 + p.getY(i)));
      const k = map.get(key); p.setXYZ(i, p.getX(i) * k * 1.12, p.getY(i) * k * 0.72, p.getZ(i) * k);
    }
    g.translate(0, 0.3, 0); g.computeVertexNormals(); return g;
  }
  const rockMat = rockify(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), 1.0);
  // скальные выходы на моренных холмах: крупные глыбы — укрытие от снарядов
  {
    const pts = [], sc = [];
    KNOBS.forEach(kb => { const n = 5 + Math.round(kb.r * 0.16); for (let i = 0; i < n; i++) { const a = rnd() * 6.28, d = kb.r * rr(0.0, 0.55), x = kb.x + Math.cos(a) * d, z = kb.z + Math.sin(a) * d; pts.push({ x, z, h: Hgrid(x, z) }); sc.push(rr(1.8, 4.6) * (1 - d / kb.r * 0.5)); } });
    for (let v = 0; v < 2; v++) {
      const sub = pts.filter((_, i) => i % 2 === v), ss = sc.filter((_, i) => i % 2 === v);
      const im = instanced(rockGeo(SEED + 30 + v, 2), rockMat, sub, (p, d, i) => { d.position.set(p.x, p.h - ss[i] * 0.3, p.z); d.rotation.set(rr(-0.25, 0.25), rnd() * 6.28, rr(-0.25, 0.25)); d.scale.set(ss[i] * rr(0.9, 1.4), ss[i] * rr(0.8, 1.25), ss[i]); });
      shadeColors(im, sub, C(0xdcdcdc), [0, 0, 0.1]); blockers.push(im);
      sub.forEach((p, i) => colliders.push({ x: p.x, z: p.z, r: ss[i] * 0.98, kind: 'rock', alive: true }));
    }
  }
  // валуны-эрратики и глыбы на склонах
  for (let v = 0; v < 3; v++) {
    const pts = samplePoints(26, (x, z, h, g, k) => fi(k) < 0.05 && ((g > 0.22 && g < 0.75) || (gDW[k] > 200 && rnd() < 0.06)), PLAY + 30);
    const ss = pts.map(() => rr(1.2, 3.4));
    const im = instanced(rockGeo(SEED + 60 + v, 1), rockMat, pts, (p, d, i) => { d.position.set(p.x, p.h - ss[i] * 0.32, p.z); d.rotation.set(rr(-0.3, 0.3), rnd() * 6.28, rr(-0.3, 0.3)); d.scale.setScalar(ss[i]); });
    shadeColors(im, pts, C(0xd6d6d6), [0, 0, 0.12]); blockers.push(im);
    pts.forEach((p, i) => colliders.push({ x: p.x, z: p.z, r: ss[i] * 1.0, kind: 'rock', alive: true }));
  }
  // мелкие камни: на галечных косах и осыпях
  for (let v = 0; v < 3; v++) {
    const pts = [];
    for (let n = 0; n < 60000 && pts.length < 420; n++) { const x = rr(-PLAY - 60, PLAY + 60), z = rr(-PLAY - 60, PLAY + 60), k = gridK(x, z); const rd = rvD[k] < 1e8 ? rvD[k] - RIVER[rvI[k]].hw : 99; const g = grade(x, z); if ((rd > -3 && rd < 9 && rnd() < 0.9) || (g > 0.3 && g < 0.9 && rnd() < 0.08)) pts.push({ x, z, h: Hgrid(x, z) }); }
    const im = instanced(rockGeo(SEED + 90 + v, 0), rockMat, pts, (p, d) => { const s = rr(0.12, 0.55); d.position.set(p.x, p.h - s * 0.15, p.z); d.rotation.set(rr(-0.5, 0.5), rnd() * 6.28, 0); d.scale.set(s * rr(0.9, 1.5), s * rr(0.6, 1), s); }, false);
    shadeColors(im, pts, C(0xdedede), [0, 0, 0.15]);
  }

  // ---------------------------------------------------------------------------
  // 16. ТРАВА: плотное «кольцо» пучков вокруг камеры (GPU-инстансинг),
  // высота и тип берутся из текстур рельефа; дальше — цвет шейдера рельефа
  // ---------------------------------------------------------------------------
  let grassRing = null;
  (function buildGrass() {
    if (!renderer.capabilities.isWebGL2) return;
    const L = 124, N = 27000;
    const hTex = new THREE.DataTexture(Float32Array.from(heights), NV, NV, THREE.RedFormat, THREE.FloatType);
    hTex.magFilter = hTex.minFilter = THREE.NearestFilter; hTex.needsUpdate = true;
    const md = new Uint8Array(N2 * 4);
    for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
      const k = j * NV + i, x = -HALF + i * CELL, z = -HALF + j * CELL, h = heights[k];
      let size = 1, wheat = 0;
      const e = 3, g = Math.hypot(Hgrid(x + e, z) - Hgrid(x - e, z), Hgrid(x, z + e) - Hgrid(x, z - e)) / (2 * e);
      size *= 1 - smooth(0.42, 0.62, g);
      size *= 1 - 0.55 * smooth(0.1, 0.5, gForest[k]);
      size *= 1 - 0.6 * smooth(TREELINE - 10, TREELINE + 25, h);
      if (gField[k] > 0.5) { const p = parcelAt(x, z); if (p.edge > 2.2) { if (p.type === 3) size = 0; else if (p.type === 2) { wheat = 1; size = 1; } else if (p.type === 1) size *= 0.5; else size *= 0.8; } }
      const rdv = rvD[k] < 1e8 ? rvD[k] - RIVER[rvI[k]].hw : 99, cdv = crD[k] < 1e8 ? crD[k] - CREEK[crI[k]].hw : 99;
      if (rdv < 2.5 || cdv < 1.2) size = 0; else size *= smooth(2.5, 9, rdv) * 0.6 + 0.4;
      if (roadD[k] < 1e8) size *= smooth(0.3, 2.2, roadD[k] - allRoad[roadI[k]].hw);
      { const yd = Math.hypot((x - RANCH.x - 2) / 1.25, z - RANCH.z - 2); size *= smooth(14, 24, yd); }
      if (Math.abs(x - BX) < DECK_HW + 1 && Math.abs(z - BZ) < BRIDGE_HL + 2) size = 0;
      md[k * 4] = clamp(size, 0, 1) * 255; md[k * 4 + 1] = gWet[k] * 255; md[k * 4 + 2] = wheat * 255; md[k * 4 + 3] = clamp((0.46 + 0.54 * gShade[k]) * Math.min(1, gAO[k]), 0, 1) * 255;
    }
    const mTex = new THREE.DataTexture(md, NV, NV, THREE.RGBAFormat); mTex.magFilter = mTex.minFilter = THREE.LinearFilter; mTex.needsUpdate = true;
    // атлас: слева — луговая трава, справа — колосья пшеницы (светлые, цвет задаёт шейдер)
    const gTex = PH_.foliageTex(512, (g, w, h) => {
      for (let i = 0; i < 260; i++) {
        const x0 = 128 + (R_() - 0.5) * 190, len = 130 + R_() * 350, lean = (x0 - 128) * 0.45 + (R_() - 0.5) * 110, v = R_(), dry = R_() < 0.3;
        let px = x0, py = h; const steps = 8;
        for (let s = 1; s <= steps; s++) {
          const u = s / steps, x = clamp(x0 + lean * u * u, 5, 251), y = h - len * (u - 0.2 * u * u), k = 0.35 + 0.65 * u;
          g.strokeStyle = dry ? `rgb(${170 + 70 * k | 0},${160 + 60 * k | 0},${105 + 50 * k | 0})` : `rgb(${105 + 90 * k + v * 30 | 0},${125 + 100 * k + v * 20 | 0},${80 + 70 * k | 0})`; g.lineWidth = Math.max(1.2, 4.2 * (1 - u) + 1.2); g.lineCap = 'round';
          g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke(); px = x; py = y;
        }
        if (R_() < 0.16) for (let k = 0; k < 6; k++) { g.fillStyle = `rgb(${215 + R_() * 25 | 0},${200 + R_() * 20 | 0},${150 + R_() * 30 | 0})`; g.beginPath(); g.ellipse(clamp(px + (R_() - 0.5) * 7, 5, 251), py + k * 6, 2.6, 5, 0.3, 0, 7); g.fill(); }
      }
      for (let i = 0; i < 95; i++) {
        const x0 = 384 + (R_() - 0.5) * 190, len = 400 + R_() * 80, lean = (R_() - 0.5) * 50, v = R_();
        const x1 = clamp(x0 + lean, 262, 506), y1 = h - len;
        g.strokeStyle = `rgb(${205 + v * 30 | 0},${190 + v * 30 | 0},${140 + v * 30 | 0})`; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, h); g.lineTo(x1, y1 + 40); g.stroke();
        g.fillStyle = `rgb(${235 + v * 20 | 0},${222 + v * 20 | 0},${170 + v * 30 | 0})`; g.beginPath(); g.ellipse(x1, y1 + 4, 7, 44, lean * 0.004, 0, 7); g.fill();
        g.strokeStyle = 'rgba(250,240,200,0.9)'; g.lineWidth = 1.2; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(x1, y1 + k * 12); g.lineTo(x1 + (k % 2 ? 12 : -12), y1 - 30 + k * 10); g.stroke(); }
      }
      for (let i = 0; i < 80; i++) { g.fillStyle = `rgb(${150 + R_() * 40 | 0},${150 + R_() * 40 | 0},${110 + R_() * 30 | 0})`; g.beginPath(); g.ellipse(20 + R_() * 470, h - R_() * 26, 9, 13, 0, 0, 7); g.fill(); }
    });
    const base = new THREE.BufferGeometry();
    { const P = [], U = [], I = [];
      for (let q = 0; q < 3; q++) { const a = q * Math.PI / 3 + 0.2, dx = Math.cos(a) * 0.5, dz = Math.sin(a) * 0.5, s = q * 4; P.push(-dx, 0, -dz, dx, 0, dz, dx, 1, dz, -dx, 1, -dz); U.push(0, 0, 1, 0, 1, 1, 0, 1); I.push(s, s + 1, s + 2, s, s + 2, s + 3); }
      base.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); base.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); base.setIndex(I); }
    const ig = new THREE.InstancedBufferGeometry(); ig.index = base.index; ig.attributes.position = base.attributes.position; ig.attributes.uv = base.attributes.uv;
    const off = new Float32Array(N * 4), gr = mulberry32(SEED + 4242);
    for (let i = 0; i < N; i++) { off[i * 4] = gr() * L; off[i * 4 + 1] = gr() * L; off[i * 4 + 2] = gr(); off[i * 4 + 3] = gr(); }
    ig.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4)); ig.instanceCount = N;
    const uC = { value: new V3() };
    const mat = new THREE.MeshStandardMaterial({ map: gTex, alphaTest: PH_.CUT, side: THREE.DoubleSide, roughness: 1, metalness: 0, vertexColors: true });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uC = uC; sh.uniforms.uHT = { value: hTex }; sh.uniforms.uMK = { value: mTex }; sh.uniforms.uTime = uTime;
      sh.vertexShader = `uniform vec3 uC; uniform sampler2D uHT; uniform sampler2D uMK; uniform float uTime; attribute vec4 aOff;\n` + NOISE_GLSL + '\n' + sh.vertexShader
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          vec2 gw = uC.xz + mod(aOff.xy - uC.xz, ${L.toFixed(1)}) - ${(L / 2).toFixed(1)};
          vec2 gg = (gw + ${HALF.toFixed(1)}) / ${CELL.toFixed(6)};
          vec2 gi = floor(gg), gf = gg - gi;
          float h00 = texture2D(uHT, (gi + 0.5) / ${NV.toFixed(1)}).r, h10 = texture2D(uHT, (gi + vec2(1.5, 0.5)) / ${NV.toFixed(1)}).r;
          float h01 = texture2D(uHT, (gi + vec2(0.5, 1.5)) / ${NV.toFixed(1)}).r, h11 = texture2D(uHT, (gi + 1.5) / ${NV.toFixed(1)}).r;
          float gh = mix(mix(h00, h10, gf.x), mix(h01, h11, gf.x), gf.y);
          vec4 mk = texture2D(uMK, (gg + 0.5) / ${NV.toFixed(1)});
          float wheat = step(0.5, mk.b);
          float gs = mk.r * step(aOff.z * 0.42, mk.r - 0.04) * (1.0 - smoothstep(${(L * 0.36).toFixed(1)}, ${(L * 0.49).toFixed(1)}, length(gw - uC.xz)));
          gs *= step(abs(gw.x), ${(HALF - 3).toFixed(1)}) * step(abs(gw.y), ${(HALF - 3).toFixed(1)});
          float ga = aOff.w * 6.2832, gc = cos(ga), gsn = sin(ga);
          float gwid = mix(1.25, 1.0, wheat) * (0.75 + 0.5 * aOff.z), ghei = mix(0.62 + 0.4 * aOff.w, 1.02 + 0.12 * aOff.w, wheat);
          vec3 gloc = vec3((position.x * gc - position.z * gsn) * gwid, position.y * ghei, (position.x * gsn + position.z * gc) * gwid) * gs;
          float gsw = position.y * position.y * gs;
          gloc.x += (sin(uTime * 1.5 + gw.x * 0.35 + gw.y * 0.21) * 0.10 + sin(uTime * 3.4 + gw.x * 0.9) * 0.03) * gsw;
          gloc.z += cos(uTime * 1.2 + gw.y * 0.31) * 0.06 * gsw;
          vec3 gPos = vec3(gw.x + gloc.x, gh - 0.05 + gloc.y, gw.y + gloc.z);
          vUv.x = vUv.x * 0.5 + 0.5 * wheat;
          float n1 = fbm2(gw * 0.018), n2 = fbm2(gw * 0.11 + 7.3);
          float wetv = clamp(mk.g + (n1 - 0.5) * 0.8, 0.0, 1.0);
          vec3 gcol = mix(vec3(0.50,0.43,0.22), vec3(0.30,0.38,0.14), smoothstep(0.18, 0.6, wetv));
          gcol = mix(gcol, vec3(0.19,0.33,0.10), smoothstep(0.66, 1.0, wetv)) * (0.80 + 0.40 * n2);
          gcol = mix(gcol, vec3(0.72,0.56,0.24) * (0.9 + 0.14 * n2), wheat);
          gcol *= (1.22 + 0.34 * (aOff.z - 0.5)) * mix(0.62, 1.15, position.y) * mk.a;`)
        .replace('#include <color_vertex>', '#include <color_vertex>\n vColor.xyz = gcol;')
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
        .replace('#include <begin_vertex>', 'vec3 transformed = gPos;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', 'float faceDirection = 1.0;\nvec3 normal = normalize( vNormal );\nvec3 geometryNormal = normal;');
    };
    mat.customProgramCacheKey = () => 'mtgrass';
    const mesh = new THREE.Mesh(ig, mat); mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = false;
    const fw = new V3();
    mesh.onBeforeRender = (r, s, cam) => { cam.getWorldDirection(fw); fw.y = 0; const l = fw.length() || 1; uC.value.set(cam.position.x + fw.x / l * L * 0.3, 0, cam.position.z + fw.z / l * L * 0.3); };
    world.add(mesh); grassRing = mesh;
  })();

  // ---------------------------------------------------------------------------
  // 17. РАНЧО, МОСТ, ТЮКИ СЕНА, ИЗГОРОДИ
  // ---------------------------------------------------------------------------
  const ctex = (w, h, draw, rx = 1, ry = 1) => { const t = PH_.canvasTex(w, h, draw); t.repeat.set(rx, ry); return t; };
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9, metalness: 0 }, o));
  const boards = (base, dark, light) => (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { g.fillStyle = `rgba(0,0,0,${0.05 + R_() * 0.18})`; g.fillRect(x, 0, 16, h); g.fillStyle = dark; g.fillRect(x, 0, 1.5, h); }
    for (let i = 0; i < 260; i++) { g.fillStyle = R_() < 0.5 ? light : dark; g.globalAlpha = 0.12 + R_() * 0.2; g.fillRect(R_() * w, R_() * h, 1 + R_() * 2, 6 + R_() * 40); } g.globalAlpha = 1;
  };
  const RM = {
    red: std({ map: ctex(256, 256, boards('#8e2b22', '#4a1410', '#c4675a'), 3, 1) }),
    white: std({ color: 0xe9e4d6, roughness: 0.8 }),
    tin: std({ map: ctex(128, 128, (g, w, h) => { g.fillStyle = '#8f979a'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 8) { const gr = g.createLinearGradient(x, 0, x + 8, 0); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0.22)'); g.fillStyle = gr; g.fillRect(x, 0, 8, h); } for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,70,40,${R_() * 0.25})`; g.fillRect(R_() * w, R_() * h, 6 + R_() * 20, 3 + R_() * 30); } }, 4, 2), roughness: 0.55, metalness: 0.5 }),
    log: std({ map: ctex(128, 128, (g, w, h) => { for (let y = 0; y < h; y += 32) { const gr = g.createLinearGradient(0, y, 0, y + 32); gr.addColorStop(0, '#3a2a1c'); gr.addColorStop(0.45, '#8a6a48'); gr.addColorStop(1, '#2e2016'); g.fillStyle = gr; g.fillRect(0, y, w, 32); } for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(30,20,10,${R_() * 0.3})`; g.fillRect(R_() * w, R_() * h, 10 + R_() * 40, 1.5); } }, 3, 3) }),
    green: std({ color: 0x3f5a44, roughness: 0.6, metalness: 0.3 }),
    stone: std({ color: 0x8a857c, roughness: 1 }),
    wood: std({ map: ctex(128, 128, boards('#7b6a55', '#3b3026', '#a8977c'), 1, 1) }),
    dark: std({ color: 0x1c1a17, roughness: 0.7 }),
    steel: std({ color: 0x5f6f66, roughness: 0.62, metalness: 0.45 }),
    concrete: std({ color: 0x9c9a92, roughness: 0.95 }),
    plank: std({ map: ctex(128, 128, boards('#6f6253', '#2e2720', '#93856f'), 2, 12) }),
    hay: std({ map: ctex(128, 128, (g, w, h) => { g.fillStyle = '#b79a4c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.strokeStyle = `rgba(${R_() < 0.5 ? '230,205,120' : '110,85,35'},${0.3 + R_() * 0.4})`; g.lineWidth = 1; const x = R_() * w, y = R_() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R_() - 0.5) * 6, y + 6 + R_() * 14); g.stroke(); } }, 2, 1) })
  };
  const blockerMat = new THREE.MeshBasicMaterial({ visible: false });
  function boxAt(parent, w, h, d, mat, x, y, z, ry = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  function prism(profile, depth, mats) {            // выдавливание профиля фронтона вдоль Z
    const sh = new THREE.Shape(); profile.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2);
    const m = new THREE.Mesh(g, mats); m.castShadow = true; m.receiveShadow = true; return m;
  }
  // статичное строение: коллайдер, блокер снарядов, разрушаемость (как в городке Аризоны)
  function addStatic(root, hw, hd, h, rotY, kind) {
    const y0 = root.position.y - 0.3;
    const sbox = { x: root.position.x, z: root.position.z, hw, hd, rot: -rotY, y0, h };
    boxes.push(sbox);
    const bm = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, h, hd * 2), blockerMat);
    bm.position.set(root.position.x, y0 + h / 2, root.position.z); bm.rotation.y = rotY; bm.updateMatrixWorld(true);
    bm.userData.bld = { root, simple: true, box: sbox, blocker: bm, hw, hd, h, cx: root.position.x, cz: root.position.z, rot: rotY, need: 3, kind };
    world.add(bm); blockers.push(bm);
  }
  const ranchRoots = [];
  function placeRoot(g, x, z, ry) { g.position.set(x, Math.min(Hgrid(x, z), Hgrid(x + 4, z + 4), Hgrid(x - 4, z - 4)) - 0.05, z); g.rotation.y = ry; world.add(g); ranchRoots.push({ root: g }); return g; }
  {
    // --- красный амбар с ломаной (голландской) крышей
    const barn = new THREE.Group(), W = 11, L = 18, WH = 4.6;
    boxAt(barn, W, WH + 0.8, L, RM.red, 0, WH / 2 - 0.4, 0);
    const roofP = [[-W / 2 - 0.5, WH - 0.2], [W / 2 + 0.5, WH - 0.2], [W * 0.31, WH + 2.9], [0, WH + 4.5], [-W * 0.31, WH + 2.9]];
    const roof = prism(roofP, L + 1.2, [RM.red, RM.tin]); barn.add(roof);
    for (const sz of [-1, 1]) {
      boxAt(barn, 3.6, 3.6, 0.12, RM.white, 0, 1.8, sz * (L / 2 + 0.07));                   // ворота
      boxAt(barn, 3.2, 3.2, 0.14, RM.red, 0, 1.8, sz * (L / 2 + 0.08));
      for (const d of [-1, 1]) { const x = boxAt(barn, 0.16, 4.4, 0.16, RM.white, 0, 1.8, sz * (L / 2 + 0.12)); x.rotation.z = d * 0.78; }
      boxAt(barn, 1.5, 1.3, 0.14, RM.white, 0, WH + 1.7, sz * (L / 2 + 0.62));              // люк сеновала
      boxAt(barn, 1.2, 1.0, 0.16, RM.dark, 0, WH + 1.7, sz * (L / 2 + 0.63));
    }
    for (const sx of [-1, 1]) for (let i = -2; i <= 2; i++) { boxAt(barn, 0.12, 1.1, 1.0, RM.white, sx * (W / 2 + 0.05), 2.4, i * 3.4); boxAt(barn, 0.14, 0.9, 0.8, RM.dark, sx * (W / 2 + 0.06), 2.4, i * 3.4); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxAt(barn, 0.22, WH + 0.8, 0.22, RM.white, sx * (W / 2 + 0.03), WH / 2 - 0.4, sz * (L / 2 + 0.03));
    placeRoot(barn, RANCH.x - 15, RANCH.z + 12, 0.14); addStatic(barn, W / 2 + 0.3, L / 2 + 0.3, WH + 4.4, 0.14, 'barn');
    // --- бревенчатый дом с зелёной крышей, верандой и каменной трубой
    const cab = new THREE.Group(), CW = 8, CL = 10, CH = 3.1;
    boxAt(cab, CW, CH + 0.8, CL, RM.log, 0, CH / 2 - 0.4, 0);
    cab.add(prism([[-CW / 2 - 0.6, CH - 0.1], [CW / 2 + 0.6, CH - 0.1], [0, CH + 2.6]], CL + 1.4, [RM.log, RM.green]));
    boxAt(cab, 1.1, CH + 4, 1.1, RM.stone, CW / 2 - 1.2, (CH + 4) / 2 - 0.4, -CL / 4);
    boxAt(cab, CW + 1.2, 0.25, 2.4, RM.wood, 0, 0.15, CL / 2 + 1.2); boxAt(cab, CW + 1.6, 0.14, 2.9, RM.green, 0, CH - 0.25, CL / 2 + 1.3).rotation.x = 0.16;
    for (const sx of [-1, 0, 1]) boxAt(cab, 0.16, CH - 0.5, 0.16, RM.wood, sx * (CW / 2 + 0.3), CH / 2 - 0.15, CL / 2 + 2.3);
    boxAt(cab, 1.0, 2.1, 0.12, RM.wood, -1.2, 1.05, CL / 2 + 0.06);
    for (const [x, z, ry] of [[1.8, CL / 2 + 0.06, 0], [-CW / 2 - 0.06, 1.5, 1.57], [CW / 2 + 0.06, 2.2, 1.57], [-CW / 2 - 0.06, -2.2, 1.57]]) { boxAt(cab, 1.3, 1.1, 0.12, RM.white, x, 1.7, z, ry); boxAt(cab, 1.05, 0.85, 0.14, RM.dark, x, 1.7, z, ry); }
    placeRoot(cab, RANCH.x + 19, RANCH.z - 13, -0.3); addStatic(cab, CW / 2 + 0.3, CL / 2 + 0.3, CH + 2.6, -0.3, 'cabin');
    // --- зернохранилища из гофролиста
    for (const [dx, dz, r, h] of [[-31, -14, 2.9, 6.4], [-31, -22.5, 2.5, 5.2]]) {
      const x = RANCH.x + dx, z = RANCH.z + dz, y = Hgrid(x, z) - 0.3, g = new THREE.Group();
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), RM.tin); cyl.position.y = h / 2; cyl.castShadow = cyl.receiveShadow = true; g.add(cyl);
      const top = new THREE.Mesh(new THREE.ConeGeometry(r + 0.15, r * 0.6, 20), RM.tin); top.position.y = h + r * 0.3; top.castShadow = true; g.add(top);
      g.position.set(x, y, z); world.add(g); blockers.push(cyl); cyl.updateMatrixWorld(true);
      colliders.push({ x, z, r: r + 0.1, kind: 'rock', alive: true }); cylinders.push({ x, z, r, y0: y, h: h + r * 0.5 });
    }
    // --- ветряк-водокачка (падает при наезде) и поилка
    { const x = RANCH.x + 27, z = RANCH.z + 15, g = new THREE.Group(), TH = 9;
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const leg = boxAt(g, 0.1, TH + 0.2, 0.1, RM.steel, sx * 0.55, TH / 2, sz * 0.55); leg.rotation.z = -sx * 0.1; leg.rotation.x = sz * 0.1; }
      for (let y = 1.5; y < TH; y += 2.2) { const w = 2.1 * (1 - y / TH) + 0.3; boxAt(g, w, 0.06, 0.06, RM.steel, 0, y, w / 2); boxAt(g, w, 0.06, 0.06, RM.steel, 0, y, -w / 2); boxAt(g, 0.06, 0.06, w, RM.steel, w / 2, y, 0); boxAt(g, 0.06, 0.06, w, RM.steel, -w / 2, y, 0); }
      const rotor = new THREE.Group(); for (let b = 0; b < 16; b++) { const bl = boxAt(rotor, 0.34, 1.25, 0.03, RM.tin, 0, 0, 0); bl.geometry = bl.geometry.clone().translate(0, 0.95, 0); bl.rotation.z = b / 16 * 6.283; bl.rotation.y = 0.35; }
      rotor.position.set(0, TH + 0.3, 0.45); g.add(rotor); boxAt(g, 0.04, 0.9, 1.6, RM.tin, 0, TH + 0.3, -1.1);
      gsap.to(rotor.rotation, { z: Math.PI * 2, duration: 5, repeat: -1, ease: 'none' });
      g.position.set(x, Hgrid(x, z) - 0.1, z); g.rotation.y = 0.9; world.add(g); props.push({ x, z, r: 0.9, kind: 'pole', obj: g, alive: true });
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.7, 18), RM.tin); tank.position.set(x + 3.2, Hgrid(x + 3.2, z + 1) + 0.3, z + 1); tank.castShadow = true; world.add(tank); props.push({ x: x + 3.2, z: z + 1, r: 1.4, kind: 'car', obj: tank, alive: true });
    }
  }
  // --- изгороди из жердей вдоль дороги у полей и загон у амбара; тюки сена на покосах
  {
    const seg = (() => { const parts = [new THREE.BoxGeometry(0.14, 1.35, 0.14).translate(-1.5, 0.6, 0)]; for (const y of [0.45, 0.8, 1.15]) parts.push(new THREE.BoxGeometry(3.0, 0.09, 0.05).translate(0, y, 0.06));
      let n = 0; parts.forEach(p => n += p.toNonIndexed().attributes.position.count); const P = new Float32Array(n * 3), Nn = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
      parts.forEach(p => { const q = p.toNonIndexed(); P.set(q.attributes.position.array, o * 3); Nn.set(q.attributes.normal.array, o * 3); U.set(q.attributes.uv.array, o * 2); o += q.attributes.position.count; });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); return g; })();
    const pts = [];
    const line = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 3), ang = Math.atan2(-(z1 - z0), x1 - x0); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = mix(x0, x1, t), z = mix(z0, z1, t); pts.push({ x, z, h: Hgrid(x, z), ang }); } };
    const R0 = ROADS[0];
    for (const sd of [-1, 1]) for (let i = 2; i + 3 < R0.length; i += 3) {       // сегменты по 6 м вдоль дороги, только у полей
      const a = R0[i], b = R0[Math.min(R0.length - 1, i + 3)], off = 6.2 * sd;
      const ax = a.x - a.tz * off, az = a.z + a.tx * off, bx = b.x - b.tz * off, bz = b.z + b.tx * off;
      if (bil(gField, ax + sd * 6, az) < 0.5 || Math.abs(a.z - BZ) < 46 || Math.abs(a.z - (BZ + 58)) < 9) continue;
      line(ax, az, (ax + bx) / 2, (az + bz) / 2); line((ax + bx) / 2, (az + bz) / 2, bx, bz);
    }
    { const cx = RANCH.x + 4, cz = RANCH.z + 16, w = 12, d = 9, c = Math.cos(0.14), s = Math.sin(0.14), P = (x, z) => [cx + x * c + z * s, cz - x * s + z * c];
      const cs = [P(-w, -d), P(w, -d), P(w, d), P(-w, d)]; for (let i = 0; i < 4; i++) { const a = cs[i], b = cs[(i + 1) % 4]; if (i === 0) { line(a[0], a[1], mix(a[0], b[0], 0.35), mix(a[1], b[1], 0.35)); line(mix(a[0], b[0], 0.6), mix(a[1], b[1], 0.6), b[0], b[1]); } else line(a[0], a[1], b[0], b[1]); } }
    const im = instanced(seg, RM.wood, pts, (p, d) => { d.position.set(p.x, p.h - 0.08, p.z); d.rotation.set(0, p.ang, 0); d.scale.setScalar(1); });
    shadeColors(im, pts, C(0xd8d2c4), [0, 0, 0.1]);
    pts.forEach((p, i) => crushables.push({ x: p.x, z: p.z, r: 1.3, kind: 'fence', meshes: [im], index: i, alive: true, tall: false, fence: true }));
    // рулоны сена
    const bales = [];
    for (let n = 0; n < 40000 && bales.length < 110; n++) { const x = rr(-PLAY, PLAY), z = rr(-PLAY, PLAY); if (bil(gField, x, z) < 0.9) continue; const p = parcelAt(x, z); if (p.type !== 1 || p.edge < 7) continue; if (bales.some(b => Math.hypot(b.x - x, b.z - z) < 11)) continue; bales.push({ x, z, h: Hgrid(x, z), ang: PA * -1 + (p.dir ? 0 : Math.PI / 2) + rr(-0.15, 0.15) }); }
    for (let i = 0; i < 7; i++) bales.push({ x: RANCH.x - 24 + (i % 4) * 1.7, z: RANCH.z + 26 + Math.floor(i / 4) * 1.6, h: Hgrid(RANCH.x - 22, RANCH.z + 26), ang: 0.14 });
    const bg = new THREE.CylinderGeometry(0.78, 0.78, 1.5, 16).rotateZ(Math.PI / 2).translate(0, 0.74, 0);
    const bim = instanced(bg, RM.hay, bales, (p, d) => { d.position.set(p.x, p.h - 0.05, p.z); d.rotation.set(0, p.ang, 0); d.scale.setScalar(1); });
    shadeColors(bim, bales, C(0xe6e0d0), [0, 0, 0.08]);
    bales.forEach((p, i) => crushables.push({ x: p.x, z: p.z, r: 0.9, kind: 'bale', meshes: [bim], index: i, alive: true, tall: false, flat: true }));
  }
  // --- мост: стальная сквозная ферма Пратта на бетонных опорах, дощатый настил
  {
    const br = new THREE.Group(), HL = BRIDGE_HL, TH = 5.4, X = DECK_HW - 0.2;
    boxAt(br, DECK_HW * 2, 0.5, HL * 2, RM.plank, 0, -0.25, 0);
    for (const sx of [-1, 1]) boxAt(br, 0.5, 0.9, HL * 2, RM.steel, sx * (DECK_HW - 0.25), -0.7, 0);
    for (let z = -HL + 1; z <= HL - 1; z += 2.6) boxAt(br, DECK_HW * 2 - 0.6, 0.35, 0.22, RM.steel, 0, -0.68, z);
    const panels = Math.max(6, Math.round((HL * 2 - 2) / 5.4)), pl = (HL * 2 - 2) / panels, z0 = -HL + 1;
    const member = (x, y1, z1, y2, z2, t) => { const L = Math.hypot(y2 - y1, z2 - z1), m = boxAt(br, t, t, L, RM.steel, x, (y1 + y2) / 2, (z1 + z2) / 2); m.rotation.x = -Math.atan2(y2 - y1, z2 - z1); return m; };
    for (const sx of [-1, 1]) {
      const x = sx * X;
      member(x, 0.25, z0, 0.25, z0 + panels * pl, 0.32);                                 // нижний пояс
      member(x, TH, z0 + pl, TH, z0 + (panels - 1) * pl, 0.34);                           // верхний пояс
      member(x, 0.25, z0, TH, z0 + pl, 0.34); member(x, 0.25, z0 + panels * pl, TH, z0 + (panels - 1) * pl, 0.34);   // наклонные порталы
      for (let i = 1; i < panels; i++) {
        member(x, 0.25, z0 + i * pl, TH, z0 + i * pl, 0.2);                               // стойки
        if (i < panels - 1) { const toMid = i < panels / 2; member(x, toMid ? TH : 0.25, z0 + i * pl, toMid ? 0.25 : TH, z0 + (i + 1) * pl, 0.13); }   // раскосы к середине
      }
      for (let z = -HL + 1; z < HL - 1; z += 1.3) boxAt(br, 0.06, 1.0, 0.06, RM.steel, sx * (X - 0.45), 0.5, z);
      boxAt(br, 0.08, 0.08, HL * 2 - 2, RM.steel, sx * (X - 0.45), 1.0, 0);
    }
    for (let i = 1; i < panels; i++) { boxAt(br, X * 2, 0.2, 0.2, RM.steel, 0, TH, z0 + i * pl); if (i < panels - 1) { const d = boxAt(br, 0.09, 0.09, Math.hypot(X * 2, pl), RM.steel, 0, TH, z0 + (i + 0.5) * pl); d.rotation.y = Math.atan2(X * 2, pl) * (i % 2 ? 1 : -1); } }
    for (const sz of [-1, 1]) {
      boxAt(br, DECK_HW * 2 + 1.2, 5.5, 2.4, RM.concrete, 0, -3.25, sz * (HL - 1.0));       // устои
      boxAt(br, DECK_HW * 2 - 1, 6.5, 1.5, RM.concrete, 0, -3.9, sz * HL * 0.34);           // русловые опоры
      boxAt(br, DECK_HW * 2, 0.5, 2.0, RM.concrete, 0, -0.9, sz * HL * 0.34);
    }
    br.position.set(BX, DECK_Y, BZ); world.add(br);
    for (const sx of [-1, 1]) boxes.push({ x: BX + sx * (DECK_HW - 0.1), z: BZ, hw: 0.3, hd: HL - 0.8, rot: 0, y0: DECK_Y - 1, h: TH + 1.2, bridge: true });
  }

  // ---------------------------------------------------------------------------
  // 18. ПРИМЕНЕНИЕ К СЦЕНЕ index.html
  // ---------------------------------------------------------------------------
  groundMesh.visible = false; gridHelper.visible = false; rangeEnvironmentGroup.visible = false; rangeTargets.length = 0;
  scene.add(world);
  terrain.onBeforeRender = (r, s, cam) => treeLOD(cam);
  scene.background = new THREE.Color().setRGB(HOR[0], HOR[1], HOR[2]);
  scene.fog = new THREE.FogExp2(scene.background.getHex(), 0.00052);
  camera.far = 7000; camera.updateProjectionMatrix();
  hemiLight.color.set(0xd2e3fb); hemiLight.groundColor.set(0x6c7548); hemiLight.intensity = 0.86;
  dirLight.color.set(0xfff2da); dirLight.intensity = 1.72;
  dirLight.shadow.bias = -0.0006; if ('normalBias' in dirLight.shadow) dirLight.shadow.normalBias = 0.04;
  rimLight.color.set(0xbcd4ff); rimLight.intensity = 0.2; rimLight.position.set(-SUN_DIR.x * 20, 6, -SUN_DIR.z * 20);
  renderer.toneMappingExposure = 0.95;

  // ---------------------------------------------------------------------------
  // 19. ЗАПРОСЫ ДЛЯ ИГРОВОЙ ЛОГИКИ
  // ---------------------------------------------------------------------------
  function normalAt(x, z, out) { const e = 2; out = out || new V3(); return out.set(H(x - e, z) - H(x + e, z), 2 * e, H(x, z - e) - H(x, z + e)).normalize(); }
  const tv = new V3();
  function raycastTerrain(o, d, maxDist, minDist = 0) {
    let t = minDist, above = o.y + d.y * t - H(o.x + d.x * t, o.z + d.z * t);
    if (above < 0) return t;
    while (t < maxDist) {
      if (o.y + d.y * t > MAXH + 1 && d.y >= 0) return null;
      const t2 = Math.min(maxDist, t + clamp(above * 0.6, 0.8, 14));
      const a2 = o.y + d.y * t2 - H(o.x + d.x * t2, o.z + d.z * t2);
      if (a2 < 0) { let lo = t, hi = t2; for (let k = 0; k < 10; k++) { const mid = (lo + hi) / 2; if (o.y + d.y * mid - H(o.x + d.x * mid, o.z + d.z * mid) < 0) hi = mid; else lo = mid; } return hi; }
      if (t2 >= maxDist) return null;
      t = t2; above = a2;
    }
    return null;
  }
  function rayBox(o, d, maxDist, b) {
    const c = Math.cos(-b.rot), s = Math.sin(-b.rot), ox = o.x - b.x, oz = o.z - b.z;
    const lx = ox * c - oz * s, lz = ox * s + oz * c, ly = o.y - b.y0, dx = d.x * c - d.z * s, dz = d.x * s + d.z * c, dy = d.y;
    let t0 = 0, t1 = maxDist;
    for (const [p, v, lo, hi] of [[lx, dx, -b.hw, b.hw], [ly, dy, 0, b.h], [lz, dz, -b.hd, b.hd]]) {
      if (Math.abs(v) < 1e-9) { if (p < lo || p > hi) return null; continue; }
      let a1 = (lo - p) / v, a2 = (hi - p) / v; if (a1 > a2) { const t = a1; a1 = a2; a2 = t; }
      t0 = Math.max(t0, a1); t1 = Math.min(t1, a2); if (t0 > t1) return null;
    }
    return t0;
  }
  // прямая видимость: рельеф, строения, силосы и… лес — сквозь чащу не видно
  function hasLOS(a, b) {
    tv.copy(b).sub(a); const dist = tv.length(); tv.divideScalar(dist);
    for (let i = 0; i < boxes.length; i++) if (!boxes[i].bridge && rayBox(a, tv, dist - 1, boxes[i]) !== null) return false;
    for (let i = 0; i < cylinders.length; i++) {
      const c = cylinders[i], ox = a.x - c.x, oz = a.z - c.z, A = tv.x * tv.x + tv.z * tv.z; if (A < 1e-9) continue;
      const B = 2 * (ox * tv.x + oz * tv.z), disc = B * B - 4 * A * (ox * ox + oz * oz - c.r * c.r); if (disc < 0) continue;
      const t = (-B - Math.sqrt(disc)) / (2 * A);
      if (t > 0 && t < dist - 1) { const y = a.y + tv.y * t; if (y > c.y0 && y < c.y0 + c.h) return false; }
    }
    if (raycastTerrain(a, tv, dist - 1.5, 1) !== null) return false;
    let acc = 0;
    for (let t = 7; t < dist - 7; t += 7) {
      const x = a.x + tv.x * t, z = a.z + tv.z * t, f = gForest[gridK(x, z)];
      if (f > 0.25 && a.y + tv.y * t - Hgrid(x, z) < 11) { acc += 7 * f; if (acc > 46) return false; }
    }
    return true;
  }
  function collide(p, radius) {
    let hit = null;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i]; if (!c.alive) continue;
      const dx = p.x - c.x, dz = p.z - c.z, rr2 = c.r + radius, d2 = dx * dx + dz * dz;
      if (d2 < rr2 * rr2 && d2 > 1e-6) { const d = Math.sqrt(d2); p.x = c.x + dx / d * rr2; p.z = c.z + dz / d * rr2; hit = c; }
    }
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i], c = Math.cos(-b.rot), s = Math.sin(-b.rot), ox = p.x - b.x, oz = p.z - b.z;
      const lx = ox * c - oz * s, lz = ox * s + oz * c, qx = clamp(lx, -b.hw, b.hw), qz = clamp(lz, -b.hd, b.hd);
      const ddx = lx - qx, ddz = lz - qz, d2 = ddx * ddx + ddz * ddz, rad = b.bridge ? Math.min(radius, 1.9) : radius;
      if (d2 >= rad * rad) continue;
      let nx, nz;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); nx = qx + ddx / d * rad; nz = qz + ddz / d * rad; }
      else { const px = b.hw - Math.abs(lx), pz = b.hd - Math.abs(lz); if (px < pz) { nx = Math.sign(lx || 1) * (b.hw + rad); nz = lz; } else { nx = lx; nz = Math.sign(lz || 1) * (b.hd + rad); } }
      const c2 = Math.cos(b.rot), s2 = Math.sin(b.rot);
      p.x = b.x + nx * c2 - nz * s2; p.z = b.z + nx * s2 + nz * c2; hit = b;
    }
    return hit;
  }
  // танк валит деревья, кусты, изгороди, давит тюки
  const mtx = new THREE.Matrix4(), posV = new V3(), quatV = new THREE.Quaternion(), sclV = new V3();
  function crushAt(x, z, radius, dirX, dirZ) {
    let n = 0;
    for (let i = 0; i < crushables.length; i++) {
      const c = crushables[i]; if (!c.alive) continue;
      const dx = x - c.x, dz = z - c.z, rr2 = c.r + radius;
      if (dx * dx + dz * dz > rr2 * rr2) continue;
      c.alive = false; n++;
      if (c.lod && c.lod.mesh) { mtx.makeScale(0, 0, 0); c.lod.mesh.setMatrixAt(c.lod.index, mtx); c.lod.mesh.instanceMatrix.needsUpdate = true; }
      const ms = c.meshes; ms[0].getMatrixAt(c.index, mtx);
      const p0 = new V3(), q0 = new THREE.Quaternion(), s0 = new V3(); mtx.decompose(p0, q0, s0);
      const axis = new V3(dirZ, 0, -dirX).normalize();
      const q1 = new THREE.Quaternion().setFromAxisAngle(axis, c.flat ? 0 : c.tall ? Math.PI / 2 - 0.06 : Math.PI / 2.25).multiply(q0);
      const sy = c.flat ? 0.34 : c.tall ? 1 : 0.6, st = { t: 0 }, m2 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3();
      gsap.to(st, { t: 1, duration: c.tall ? 1.15 : 0.3, ease: c.tall ? 'power2.in' : 'power1.out', onUpdate: () => {
        q.copy(q0).slerp(q1, st.t); s.set(s0.x * (c.flat ? 1 + 0.25 * st.t : 1), s0.y * mix(1, sy, st.t), s0.z * (c.flat ? 1 + 0.25 * st.t : 1));
        m2.compose(p0, q, s); ms.forEach(m => { m.setMatrixAt(c.index, m2); m.instanceMatrix.needsUpdate = true; });
      } });
    }
    for (let i = 0; i < props.length; i++) {
      const pr = props[i]; if (!pr.alive) continue;
      const dx = x - pr.x, dz = z - pr.z, rr2 = pr.r + radius;
      if (dx * dx + dz * dz > rr2 * rr2) continue;
      pr.alive = false; n++;
      const o = pr.obj;
      if (pr.kind === 'car') gsap.to(o.scale, { y: 0.38, duration: 0.25, ease: 'power2.out' });
      else {
        const axis = new V3(dirZ, 0, -dirX).normalize(), q0 = o.quaternion.clone(), q1 = new THREE.Quaternion().setFromAxisAngle(axis, Math.PI / 2 * 0.97).multiply(q0), st = { t: 0 };
        gsap.to(st, { t: 1, duration: 1.1, ease: 'power2.in', onUpdate: () => { o.quaternion.copy(q0).slerp(q1, st.t); } });
      }
    }
    return n;
  }
  function isPassable(x, z) {
    if (Math.max(Math.abs(x), Math.abs(z)) > PLAY) return false;
    if (grade(x, z) > 0.42) return false;
    if (gForest[gridK(x, z)] > 0.55) return false;                    // ИИ не выбирает позиции в чаще
    if (waterDepth(x, z) > 0.15) return false;                         // и не встаёт в воде (но вброд переходит)
    for (let i = 0; i < colliders.length; i++) { const c = colliders[i]; if (c.alive && Math.hypot(x - c.x, z - c.z) < c.r + 5) return false; }
    const p = { x, z }; if (collide(p, 5) && (Math.abs(p.x - x) > 0.01 || Math.abs(p.z - z) > 0.01)) return false;
    return true;
  }
  // цвет миникарты
  function minimapColor(x, z, h, gr) {
    const k = gridK(x, z);
    if (waterDepth(x, z) > 0.02) return [62, 112, 170];
    if (Math.abs(x - BX) < DECK_HW && Math.abs(z - BZ) < BRIDGE_HL) return [120, 112, 100];
    if (roadD[k] < 1e8 && roadD[k] < allRoad[roadI[k]].hw + 1) return [196, 184, 158];
    if (h > SNOWLINE + 12 && gr < 0.8) return [235, 238, 244];
    if (gr > 0.62) return [128, 126, 120];
    if (gForest[k] > 0.3) return gKind[k] === 1 ? [44, 82, 50] : [74, 118, 58];
    if (gField[k] > 0.5) { const p = parcelAt(x, z); if (p.edge > 2) return [[112, 150, 74], [156, 172, 90], [206, 176, 92], [118, 92, 66]][p.type]; }
    const w = gWet[k]; return [mix(172, 108, w), mix(160, 142, w), mix(100, 72, w)];
  }

  window.MAP = {
    id: 'montana', name: 'Montana Big Sky Valley', H, grade, normalAt, raycastTerrain, hasLOS, collide, crushAt, isPassable,
    blockers, colliders, boxes, rayBox, cylinders, props, formations: [], TOWN: null, inTown: () => false, PLAY, SUN_DIR, MAXH, world,
    waterDepth, waterLevel, minimapColor,
    labels: [{ x: BX, z: BZ - 22, text: 'Мост', color: '#ffe08a' }, { x: RANCH.x, z: RANCH.z - 46, text: 'Ранчо' }, { x: 250, z: zr(250) - 16, text: 'Река (брод)', color: '#bfe0ff', size: 4.8 },
      { x: xc(250) - 22, z: 250, text: 'Ручей', color: '#bfe0ff', size: 4.6, big: true }].concat(KNOBS.map(k => ({ x: k.x, z: k.z, text: '▲', size: 4.2, color: '#e8e2cf' }))),
    playerSpawn: new V3(PLAYER_SPAWN.x, H(PLAYER_SPAWN.x, PLAYER_SPAWN.z), PLAYER_SPAWN.z), playerHeading: PLAYER_SPAWN.heading,
    enemySpawn: new V3(ENEMY_SPAWN.x, H(ENEMY_SPAWN.x, ENEMY_SPAWN.z), ENEMY_SPAWN.z), enemyHeading: ENEMY_SPAWN.heading,
    dustColor: 0xa59c80,
    stats: { trees: treeCount, farTrees: farTrees.length, crushables: crushables.length, buildMs: Math.round(now() - T_START), erodeMs: Math.round(T_ERODE - T_BASE) }
  };
  tankRoot.rotation.order = 'YXZ';
  tankRoot.position.copy(window.MAP.playerSpawn);
})();
