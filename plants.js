// =============================================================================
// РАСТЕНИЯ СОНОРСКОЙ ПУСТЫНИ — процедурные модели, близкие к настоящим
// Кактусы: сагуаро, опунция Энгельмана, ферокактус (бочка), чолья, окотильо.
// Суккуленты: агава Пэрри, юкка. Кустарники: креозот, бриттлбуш, можжевельник.
// Текстуры (ареолы, колючки, листва) рисуются на canvas — без внешних файлов.
// Экспортирует window.PLANTS: { species[]: { geos:[{geo, mat}], ... } }
// =============================================================================
(function () {
  'use strict';
  const V3 = THREE.Vector3;
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------------------
  // ГЕОМЕТРИЧЕСКИЕ ПОМОЩНИКИ
  // ---------------------------------------------------------------------------
  // Буфер-аккумулятор: позиции, нормали (опц.), uv, цвета, индексы
  function Acc() { return { P: [], N: [], U: [], C: [], I: [], hasN: false }; }
  function accGeo(a, computeNormals = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(a.P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(a.U, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(a.C, 3));
    g.setIndex(a.I);
    if (a.hasN) g.setAttribute('normal', new THREE.Float32BufferAttribute(a.N, 3));
    else if (computeNormals) g.computeVertexNormals();
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  // Трубка с рёбрами вдоль кривой: pts — точки оси, rad — радиусы
  function ribTube(a, pts, rad, o) {
    const ribs = o.ribs || 12, depth = o.depth || 0.07, radial = o.radial || ribs * 2, spacing = o.spacing || 0.08;
    const color = o.color || ((i, t) => [1, 1, 1]);
    const start = a.P.length / 3;
    // параллельный перенос рамки
    let n = null, s = 0;
    const T = [], Nn = [], B = [], S = [];
    for (let i = 0; i < pts.length; i++) {
      const t = new V3().subVectors(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]).normalize();
      if (!n) { const ref = Math.abs(t.y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0); n = new V3().crossVectors(ref, t).normalize(); }
      else { n = n.clone().sub(t.clone().multiplyScalar(n.dot(t))).normalize(); }
      if (i > 0) s += pts[i].distanceTo(pts[i - 1]);
      T.push(t); Nn.push(n.clone()); B.push(new V3().crossVectors(t, n).normalize()); S.push(s);
    }
    const twist = o.twist || 0;
    for (let i = 0; i < pts.length; i++) {
      for (let j = 0; j <= radial; j++) {
        const th = j / radial * Math.PI * 2 + twist * S[i];
        const k = 1 + depth * Math.cos(ribs * th);
        const r = rad[i] * k;
        const off = Nn[i].clone().multiplyScalar(Math.cos(th) * r).add(B[i].clone().multiplyScalar(Math.sin(th) * r));
        a.P.push(pts[i].x + off.x, pts[i].y + off.y, pts[i].z + off.z);
        a.U.push(j / radial * ribs, S[i] / spacing);
        const c = color(i / (pts.length - 1), pts[i]); a.C.push(c[0], c[1], c[2]);
      }
    }
    const row = radial + 1;
    for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < radial; j++) {
      const p = start + i * row + j, q = p + row;
      a.I.push(p, q, p + 1, p + 1, q, q + 1);
    }
  }
  // сглаженный купол-окончание: радиусы по окружности
  function domeProfile(ys, R, top, capLen) {
    return ys.map(y => y > top - capLen ? R * Math.sqrt(Math.max(0.0025, 1 - Math.pow((y - (top - capLen)) / capLen, 2))) : R);
  }
  // эллипсоид (для сегментов опунции, плодов, цветов)
  function ellipsoid(a, cx, cy, cz, rx, ry, rz, rot, col, uvScale = 1, seg = 14) {
    const g = new THREE.SphereGeometry(1, seg, Math.max(4, seg * 0.7 | 0));
    const m = new THREE.Matrix4().makeRotationFromEuler(rot || new THREE.Euler());
    const start = a.P.length / 3, p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new V3(p.getX(i) * rx, p.getY(i) * ry, p.getZ(i) * rz);
      a.U.push(v.x * uvScale + 0.5, v.y * uvScale + 0.5);
      v.applyMatrix4(m); a.P.push(v.x + cx, v.y + cy, v.z + cz);
      const c = typeof col === 'function' ? col(p.getY(i)) : col; a.C.push(c[0], c[1], c[2]);
    }
    const idx = g.index; for (let i = 0; i < idx.count; i++) a.I.push(idx.getX(i) + start);
  }
  // карточки листвы вокруг центра; нормали «сферические» — крона освещается объёмно
  function cards(a, cx, cy, cz, radius, count, size, r, col = [1, 1, 1], upBias = 0.5, flatten = 1) {
    for (let k = 0; k < count; k++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, rr = Math.cbrt(r()) * radius;
      const sq = Math.sqrt(1 - u * u);
      const c = new V3(cx + sq * Math.cos(th) * rr, cy + u * rr * flatten, cz + sq * Math.sin(th) * rr);
      const s = size[0] + r() * (size[1] - size[0]);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * Math.PI, r() * Math.PI, r() * Math.PI));
      const ax = new V3(s / 2, 0, 0).applyQuaternion(q), ay = new V3(0, s / 2, 0).applyQuaternion(q);
      const start = a.P.length / 3;
      [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]].forEach(([sx, sy, uu, vv]) => {
        const v = c.clone().addScaledVector(ax, sx).addScaledVector(ay, sy);
        a.P.push(v.x, v.y, v.z); a.U.push(uu, vv);
        const nrm = v.clone().sub(new V3(cx, cy, cz)).normalize().lerp(new V3(0, 1, 0), upBias).normalize();
        a.N.push(nrm.x, nrm.y, nrm.z);
        const sh = 0.88 + 0.12 * clamp((v.y - (cy - radius)) / (2 * radius), 0, 1);   // низ кроны темнее
        a.C.push(col[0] * sh, col[1] * sh, col[2] * sh);
      });
      a.I.push(start, start + 1, start + 2, start, start + 2, start + 3);
    }
    a.hasN = true;
  }
  // тонкий стебель/ветка (без рёбер), с нормалями — для смешивания с карточками
  function stick(a, pts, r0, r1, col, radial = 5) {
    const start = a.P.length / 3;
    let n = null;
    for (let i = 0; i < pts.length; i++) {
      const t = new V3().subVectors(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]).normalize();
      if (!n) { const ref = Math.abs(t.y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0); n = new V3().crossVectors(ref, t).normalize(); }
      else n = n.clone().sub(t.clone().multiplyScalar(n.dot(t))).normalize();
      const b = new V3().crossVectors(t, n);
      const r = r0 + (r1 - r0) * i / (pts.length - 1);
      for (let j = 0; j <= radial; j++) {
        const th = j / radial * Math.PI * 2, d = n.clone().multiplyScalar(Math.cos(th)).add(b.clone().multiplyScalar(Math.sin(th)));
        a.P.push(pts[i].x + d.x * r, pts[i].y + d.y * r, pts[i].z + d.z * r);
        a.N.push(d.x, d.y, d.z); a.U.push(j / radial, i / pts.length); a.C.push(col[0], col[1], col[2]);
      }
    }
    const row = radial + 1;
    for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < radial; j++) { const p = start + i * row + j, q = p + row; a.I.push(p, q, p + 1, p + 1, q, q + 1); }
    a.hasN = true;
  }
  function bentPath(from, dir, len, segs, bend, r) {
    const pts = [from.clone()]; let d = dir.clone().normalize(); let p = from.clone();
    for (let i = 1; i <= segs; i++) {
      d.add(new V3((r() - 0.5) * bend, (r() - 0.3) * bend * 0.6, (r() - 0.5) * bend)).normalize();
      p = p.clone().addScaledVector(d, len / segs); pts.push(p);
    }
    return pts;
  }

  // ---------------------------------------------------------------------------
  // ТЕКСТУРЫ (canvas)
  // ---------------------------------------------------------------------------
  function canvasTex(w, h, draw, repeat = true) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8; return t;
  }
  // Текстура листвы с альфой. Две проблемы обычной canvas-текстуры:
  //  • прозрачные пиксели чёрные → на мипах тёмная кайма (кусты «чернеют»);
  //  • альфа на мипах усредняется → вдали листва не проходит alphaTest и редеет.
  // Здесь: цвет растягивается под прозрачные пиксели, а на каждом мип-уровне альфа
  // масштабируется так, чтобы доля видимых пикселей совпадала с исходной.
  const CUT = 0.35;
  function foliageTex(size, draw) {
    const cutoff = CUT;
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); draw(g, size, size);
    const src = g.getImageData(0, 0, size, size).data;
    let ar = 0, ag = 0, ab = 0, an = 0;
    for (let i = 0; i < src.length; i += 4) if (src[i + 3] > 128) { ar += src[i]; ag += src[i + 1]; ab += src[i + 2]; an++; }
    ar /= an || 1; ag /= an || 1; ab /= an || 1;
    let lvl = new Float32Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {      // переворот по вертикали: v=0 — низ
      const si = ((size - 1 - y) * size + x) * 4, di = (y * size + x) * 4, a = src[si + 3];
      const k = a / 255;
      lvl[di] = src[si] * k + ar * (1 - k); lvl[di + 1] = src[si + 1] * k + ag * (1 - k); lvl[di + 2] = src[si + 2] * k + ab * (1 - k); lvl[di + 3] = a;
    }
    const cut = cutoff * 255;
    const coverage = (d, sc) => { let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] * sc > cut) n++; return n / (d.length / 4); };
    const target = coverage(lvl, 1);
    const mips = []; let w = size;
    for (;;) {
      let lo = 0.2, hi = 12, sc = 1;
      if (w < size) { for (let it = 0; it < 14; it++) { sc = (lo + hi) / 2; if (coverage(lvl, sc) < target) lo = sc; else hi = sc; } }
      const out = new Uint8Array(w * w * 4);
      for (let i = 0; i < lvl.length; i += 4) { out[i] = lvl[i]; out[i + 1] = lvl[i + 1]; out[i + 2] = lvl[i + 2]; out[i + 3] = Math.min(255, lvl[i + 3] * sc); }
      mips.push({ data: out, width: w, height: w });
      if (w === 1) break;
      const h2 = w >> 1, nx = new Float32Array(h2 * h2 * 4);
      for (let y = 0; y < h2; y++) for (let x = 0; x < h2; x++) {
        const di = (y * h2 + x) * 4;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const si = ((y * 2 + dy) * w + x * 2 + dx) * 4; for (let k = 0; k < 4; k++) nx[di + k] += lvl[si + k] * 0.25; }
      }
      lvl = nx; w = h2;
    }
    const t = new THREE.DataTexture(mips[0].data, size, size, THREE.RGBAFormat);
    t.mipmaps = mips; t.generateMipmaps = false;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = 4; t.needsUpdate = true;
    return t;
  }

  // плитка = одно ребро кактуса по ширине × шаг ареол по высоте
  function ribTexture(groove, ridge, felt, spine, spineLen, nSpines, hooked) {
    return canvasTex(128, 128, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, w, 0);
      grd.addColorStop(0, groove); grd.addColorStop(0.5, ridge); grd.addColorStop(1, groove);
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,230' : '20,40,20'},${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 8 + Math.random() * 30); }
      const cx = w / 2, cy = h / 2;
      g.strokeStyle = spine; g.lineCap = 'round';
      for (let k = 0; k < nSpines; k++) {
        const a = (k / nSpines) * Math.PI * 2 + Math.random() * 0.3, L = spineLen * (0.6 + Math.random() * 0.6);
        g.lineWidth = k === 0 ? 2.6 : 1.4;
        g.beginPath(); g.moveTo(cx, cy);
        const ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L;
        if (hooked && k === 0) { g.quadraticCurveTo(cx, cy + L, cx + 6, cy + L * 0.9); } else g.lineTo(ex, ey);
        g.stroke();
      }
      g.fillStyle = felt; g.beginPath(); g.ellipse(cx, cy, 6, 7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 2, 4, 3, 0, 0, Math.PI * 2); g.fill();
    });
  }
  const TEX = {
    saguaro: ribTexture('#3f5e36', '#7d9a64', '#d9d1b4', 'rgba(205,195,160,0.9)', 26, 7, false),
    barrel: ribTexture('#3c5a2c', '#6f8e47', '#c9b98a', 'rgba(196,72,48,0.95)', 40, 9, true),
    pad: canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#7d9a5a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '210,220,170' : '40,70,40'},${Math.random() * 0.07})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 12, 0, 7); g.fill(); }
      for (let y = 12; y < h; y += 30) for (let x = (y / 30 % 2) * 15 + 10; x < w; x += 30) {
        g.fillStyle = '#6b4a2a'; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill();
        g.fillStyle = 'rgba(230,205,110,0.95)'; g.beginPath(); g.arc(x, y - 1, 2, 0, 7); g.fill();     // глохидии
        if (Math.random() < 0.45) { g.strokeStyle = 'rgba(235,225,190,0.95)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 14, y - 12 - Math.random() * 8); g.stroke(); }
      }
    }),
    cholla: canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#7d8a45'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { const x = Math.random() * w, y = Math.random() * h, a = Math.random() * 6.28, L = 5 + Math.random() * 9; g.strokeStyle = `rgba(${235 + Math.random() * 20},${215 + Math.random() * 25},${150 + Math.random() * 40},0.85)`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
    }),
    creosote: foliageTex(256, (g, w, h) => {
      for (let b = 0; b < 22; b++) {          // веточки с мелкими парными листьями
        let x = w / 2 + (Math.random() - 0.5) * 120, y = h - Math.random() * 60, a = -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
        for (let s = 0; s < 16; s++) {
          const nx = x + Math.cos(a) * 12, ny = y + Math.sin(a) * 12;
          g.strokeStyle = '#5e5038'; g.lineWidth = 1.6;
          g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
          for (let l = 0; l < 6; l++) {
            const la = a + (l % 2 ? 1.1 : -1.1) + (Math.random() - 0.5) * 0.7, d = 4 + Math.random() * 9;
            const lx = nx + Math.cos(la) * d, ly = ny + Math.sin(la) * d, v = Math.random();
            g.fillStyle = v < 0.9 ? `rgb(${74 + v * 34},${96 + v * 34},${36 + v * 18})` : '#b39a2e';   // оливковая листва и жёлтые цветки
            g.beginPath(); g.ellipse(lx, ly, 7.5, 4.2, la, 0, 7); g.fill();
          }
          x = nx; y = ny; a += (Math.random() - 0.5) * 0.55;
          if (y < 8 || x < 6 || x > w - 6) break;
        }
      }
    }),
    brittle: foliageTex(256, (g, w, h) => {
      for (let i = 0; i < 70; i++) { const x = 30 + Math.random() * (w - 60), y = 60 + Math.random() * (h - 80), a = Math.random() * 6.28; const v = 105 + Math.random() * 30; g.fillStyle = `rgb(${v * 0.85},${v * 0.95},${v * 0.74})`; g.beginPath(); g.ellipse(x, y, 13, 7, a, 0, 7); g.fill(); }
      for (let i = 0; i < 9; i++) { const x = 30 + Math.random() * (w - 60), y = 15 + Math.random() * 60; g.strokeStyle = '#8a8a6a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 10, y + 50); g.stroke(); g.fillStyle = '#c99c14'; for (let p = 0; p < 9; p++) { const pa = p / 9 * 6.28; g.beginPath(); g.ellipse(x + Math.cos(pa) * 5, y + Math.sin(pa) * 5, 4, 2, pa, 0, 7); g.fill(); } g.fillStyle = '#a0781a'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    }),
    juniper: foliageTex(256, (g, w, h) => {
      for (let b = 0; b < 34; b++) {
        let x = Math.random() * w, y = Math.random() * h, a = Math.random() * 6.28;
        for (let s = 0; s < 10; s++) {
          const v = Math.random();
          g.strokeStyle = `rgb(${62 + v * 30},${92 + v * 34},${56 + v * 20})`; g.lineWidth = 5 - s * 0.35;
          const nx = x + Math.cos(a) * 9, ny = y + Math.sin(a) * 9;
          g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
          if (s % 2) { const ba = a + (Math.random() < 0.5 ? 0.8 : -0.8); g.lineWidth = 3; g.beginPath(); g.moveTo(nx, ny); g.lineTo(nx + Math.cos(ba) * 12, ny + Math.sin(ba) * 12); g.stroke(); }
          x = nx; y = ny; a += (Math.random() - 0.5) * 0.6;
        }
      }
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(120,140,170,0.9)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2.4, 0, 7); g.fill(); }   // ягоды
    }),
    // пучок злака: плотная дернина у основания, сужающиеся травинки, часть — с метёлками
    grass: [0, 1, 2].map(kind => foliageTex(256, (g, w, h) => {
      const n = kind === 2 ? 70 : 110, tall = kind === 1;
      for (let i = 0; i < n; i++) {
        const t = Math.random(), x0 = w / 2 + (Math.random() - 0.5) * (kind === 2 ? 60 : 90);
        const len = (tall ? 120 : 80) + Math.random() * (tall ? 120 : 110), lean = (x0 - w / 2) * 1.3 + (Math.random() - 0.5) * 90;
        const fresh = Math.random() < (kind === 2 ? 0.35 : 0.12);
        const steps = 7; let px = x0, py = h;
        for (let s = 1; s <= steps; s++) {
          const u = s / steps, x = x0 + lean * u * u, y = h - len * (u - 0.18 * u * u);
          const k = 0.35 + 0.65 * u;                         // от тёмного основания к выгоревшим кончикам
          const col = fresh ? [58 + 34 * k, 80 + 34 * k, 30 + 14 * k] : [72 + 58 * k + t * 12, 54 + 46 * k + t * 8, 20 + 22 * k];
          g.strokeStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`; g.lineWidth = Math.max(1, (kind === 2 ? 5 : 4) * (1 - u) + 1);
          g.lineCap = 'round'; g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke(); px = x; py = y;
        }
        if (tall && Math.random() < 0.4) {                   // метёлка с семенами
          for (let k = 0; k < 7; k++) { g.fillStyle = `rgb(${165 + Math.random() * 20},${140 + Math.random() * 18},${85 + Math.random() * 20})`; g.beginPath(); g.ellipse(px + (Math.random() - 0.5) * 7, py + k * 5, 2.6, 4.5, 0.3, 0, 7); g.fill(); }
        }
      }
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgb(${82 + Math.random() * 28},${66 + Math.random() * 24},${36 + Math.random() * 16})`; g.beginPath(); g.ellipse(w / 2 + (Math.random() - 0.5) * 80, h - Math.random() * 22, 6, 9, 0, 0, 7); g.fill(); }
    })),
    bark: canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#6a5a4a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(${Math.random() < 0.5 ? '40,30,25' : '150,135,120'},0.6)`; g.lineWidth = 1 + Math.random() * 2; const x = Math.random() * w; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 8, h * 0.3, x - 8, h * 0.6, x + 4, h); g.stroke(); } })
  };

  // ---------------------------------------------------------------------------
  // МАТЕРИАЛЫ
  // ---------------------------------------------------------------------------
  const windU = { value: 0 };
  (function tick() { windU.value = performance.now() / 1000; requestAnimationFrame(tick); })();
  // материал листвы: обратная сторона карточки освещается так же, как лицевая
  // (стандартный переворот нормали делал половину карточек чёрными), опционально — ветер
  function leafMat(map, wind) {
    const m = new THREE.MeshStandardMaterial({ map, vertexColors: true, alphaTest: CUT, side: THREE.DoubleSide, roughness: 0.92 });
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', 'float faceDirection = 1.0;\nvec3 normal = normalize( vNormal );\nvec3 geometryNormal = normal;');
      if (wind) {
        sh.uniforms.uWind = windU;
        sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float ph = instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.27;
            float sw = uv.y * uv.y;
            transformed.x += (sin(uWind * 1.6 + ph) * 0.06 + sin(uWind * 3.7 + ph * 1.7) * 0.02) * sw;
            transformed.z += cos(uWind * 1.3 + ph) * 0.035 * sw;
          #endif`);
      }
    };
    m.customProgramCacheKey = () => 'leaf' + (wind ? 'W' : '');
    return m;
  }
  const MAT = {
    saguaro: new THREE.MeshStandardMaterial({ map: TEX.saguaro, vertexColors: true, roughness: 0.78 }),
    barrel: new THREE.MeshStandardMaterial({ map: TEX.barrel, vertexColors: true, roughness: 0.75 }),
    pad: new THREE.MeshStandardMaterial({ map: TEX.pad, vertexColors: true, roughness: 0.7 }),
    cholla: new THREE.MeshStandardMaterial({ map: TEX.cholla, vertexColors: true, roughness: 0.85 }),
    plain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }),
    bark: new THREE.MeshStandardMaterial({ map: TEX.bark, vertexColors: true, roughness: 0.95 }),
    creosote: leafMat(TEX.creosote),
    brittle: leafMat(TEX.brittle),
    juniper: leafMat(TEX.juniper),
    grass: TEX.grass.map(t => leafMat(t, true))
  };
  // тени от листвы — по альфе текстуры
  function depthFor(mat) { return mat.alphaTest ? new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: mat.map, alphaTest: mat.alphaTest }) : null; }

  // ---------------------------------------------------------------------------
  // ВИДЫ
  // ---------------------------------------------------------------------------
  function saguaro(seed) {
    const r = mulberry32(seed), a = Acc();
    const H = 5 + r() * 5, R = 0.3 + r() * 0.12, ribs = 14;
    const baseCol = (t, p) => p.y < 0.7 ? [0.62 + p.y * 0.45, 0.55 + p.y * 0.55, 0.45 + p.y * 0.6] : [1, 1, 1];   // одревесневший низ
    const ys = []; for (let y = -0.3; y < H - R * 1.2; y += 0.7) ys.push(y); for (let k = 0; k <= 5; k++) ys.push(H - R * 1.1 * (1 - Math.sin(k / 5 * Math.PI / 2)));
    const lean = new V3((r() - 0.5) * 0.04, 1, (r() - 0.5) * 0.04).normalize();
    const pts = ys.map(y => lean.clone().multiplyScalar(y));
    const rad = domeProfile(ys, R, H, R * 1.1).map((v, i) => v * (1 - 0.05 * ys[i] / H) * (1 + 0.04 * Math.sin(ys[i] * 2.1)));
    ribTube(a, pts, rad, { ribs, depth: 0.075, radial: 28, spacing: 0.09, color: baseCol });
    const nArms = r() < 0.15 ? 0 : 1 + Math.floor(r() * 4);
    for (let k = 0; k < nArms; k++) {
      const ay = H * (0.38 + r() * 0.3), phi = r() * Math.PI * 2 + k * 2.3, rA = R * (0.68 + r() * 0.12);
      const dir = new V3(Math.cos(phi), 0, Math.sin(phi));
      const base = lean.clone().multiplyScalar(ay);
      const P = [], RA = [];
      const out = R + 0.25 + r() * 0.35, rho = 0.45 + r() * 0.3, up = 1.0 + r() * Math.max(0.5, H - ay - 1.2);
      // горизонтальный вынос → четверть дуги вверх → вертикаль с куполом
      for (let i = 0; i <= 2; i++) { const t = i / 2; P.push(base.clone().addScaledVector(dir, t * out).add(new V3(0, t * 0.15, 0))); }
      const c0 = P[P.length - 1].clone();
      for (let i = 1; i <= 5; i++) { const t = i / 5 * Math.PI / 2; P.push(c0.clone().addScaledVector(dir, Math.sin(t) * rho).add(new V3(0, (1 - Math.cos(t)) * rho, 0))); }
      const c1 = P[P.length - 1].clone();
      const upYs = []; for (let y = 0.6; y < up - rA; y += 0.7) upYs.push(y); for (let k = 0; k <= 4; k++) upYs.push(up - rA * (1 - Math.sin(k / 4 * Math.PI / 2)));
      upYs.forEach(y => P.push(c1.clone().add(new V3(dir.x * 0.05 * y / up, y, dir.z * 0.05 * y / up))));
      const topY = c1.y + up;
      P.forEach(pt => { const fromTop = topY - pt.y; RA.push(fromTop < rA ? rA * Math.sqrt(Math.max(0.003, 1 - Math.pow((rA - fromTop) / rA, 2))) : rA); });
      ribTube(a, P, RA, { ribs: 11, depth: 0.08, radial: 22, spacing: 0.09 });
    }
    // весной — белые цветы на макушках
    if (r() < 0.35) for (let k = 0; k < 5; k++) { const ang = r() * 6.28; ellipsoid(a, Math.cos(ang) * R * 0.5 + lean.x * H, H + 0.05, Math.sin(ang) * R * 0.5 + lean.z * H, 0.07, 0.05, 0.07, null, [1.6, 1.6, 1.5], 0.2, 5); }
    return { parts: [{ geo: accGeo(a), mat: MAT.saguaro }], tall: true, r: R + 0.3, height: H };
  }

  function prickly(seed) {
    const r = mulberry32(seed), a = Acc();
    const padCol = (y) => [1, 1, 1];
    const tint = r() < 0.3 ? [1.05, 0.92, 1.0] : [1, 1, 1];   // некоторые с фиолетовым отливом от жары
    function pad(pos, normalAng, tilt, size, depth) {
      const rx = 0.28 * size, ry = 0.36 * size, rz = 0.045 * size;
      const e = new THREE.Euler(tilt, normalAng, (r() - 0.5) * 0.5, 'YXZ');
      ellipsoid(a, pos.x, pos.y + ry * Math.cos(tilt) * 0.95, pos.z, rx, ry, rz, e, tint, 1.0, 8);
      const up = new V3(0, ry * 1.85, 0).applyEuler(e);
      const top = pos.clone().add(new V3(0, ry * 0.95 * Math.cos(tilt), 0)).add(up.clone().multiplyScalar(0.5));
      // плоды-«туны» на кромке
      if (depth > 0 && r() < 0.5) for (let f = 0; f < 2 + Math.floor(r() * 3); f++) {
        const fa = (f - 1) * 0.5; const fp = top.clone().add(new V3(Math.sin(fa) * rx * 0.8, 0.02, 0).applyEuler(new THREE.Euler(0, normalAng, 0)));
        ellipsoid(a, fp.x, fp.y + 0.04, fp.z, 0.045, 0.065, 0.045, null, [1.25, 0.32, 0.45], 0.3, 5);
      }
      if (depth < 2) {
        const n = depth === 0 ? 1 + Math.floor(r() * 2) : (r() < 0.75 ? 1 + Math.floor(r() * 2) : 0);
        for (let k = 0; k < n; k++) {
          const off = (k - (n - 1) / 2) * rx * 0.9;
          const p2 = top.clone().add(new V3(off, -ry * 0.12, 0).applyEuler(new THREE.Euler(0, normalAng, 0)));
          pad(p2, normalAng + (r() - 0.5) * 1.6, (r() - 0.5) * 0.9, size * (0.85 + r() * 0.2), depth + 1);
        }
      }
    }
    const nBase = 2 + Math.floor(r() * 3);
    for (let i = 0; i < nBase; i++) {
      const ang = r() * Math.PI * 2, d = r() * 0.5;
      pad(new V3(Math.cos(ang) * d, -0.05, Math.sin(ang) * d), r() * Math.PI, (r() - 0.5) * 0.7, 0.9 + r() * 0.35, 0);
    }
    return { parts: [{ geo: accGeo(a), mat: MAT.pad }], r: 0.9 };
  }

  function barrel(seed) {
    const r = mulberry32(seed), a = Acc();
    const H = 0.5 + r() * 0.9, R = 0.3 + r() * 0.12;
    const ys = []; for (let y = -0.1; y < H - R; y += 0.25) ys.push(y); for (let k = 0; k <= 5; k++) ys.push(H - R * 0.9 * (1 - Math.sin(k / 5 * Math.PI / 2)));
    const lean = new V3(0.12 + r() * 0.1, 1, 0.05).normalize();   // ферокактусы наклоняются к югу
    const pts = ys.map(y => lean.clone().multiplyScalar(y));
    const rad = domeProfile(ys, R, H, R * 0.9).map((v, i) => v * (0.92 + 0.12 * Math.sin(Math.min(1, ys[i] / H) * Math.PI * 0.8)));
    ribTube(a, pts, rad, { ribs: 16, depth: 0.1, radial: 32, spacing: 0.1 });
    const topP = lean.clone().multiplyScalar(H - 0.02);
    const fc = r() < 0.5 ? [1.6, 1.3, 0.3] : [1.5, 0.6, 0.25];      // жёлтые или оранжевые цветы
    for (let k = 0; k < 7; k++) { const ang = k / 7 * 6.28; ellipsoid(a, topP.x + Math.cos(ang) * R * 0.45, topP.y + 0.02, topP.z + Math.sin(ang) * R * 0.45, 0.05, 0.06, 0.05, null, fc, 0.3, 5); }
    return { parts: [{ geo: accGeo(a), mat: MAT.barrel }], r: 0.6 };
  }

  function cholla(seed) {
    const r = mulberry32(seed), a = Acc(), wood = Acc();
    const trunkH = 0.4 + r() * 0.5;
    stick(wood, [new V3(0, -0.1, 0), new V3((r() - 0.5) * 0.1, trunkH * 0.5, 0), new V3((r() - 0.5) * 0.15, trunkH, (r() - 0.5) * 0.1)], 0.08, 0.06, [0.45, 0.38, 0.3]);
    function joint(p, dir, depth) {
      const len = 0.22 + r() * 0.14, rad = 0.07 + r() * 0.025;
      const pts = [p.clone(), p.clone().addScaledVector(dir, len * 0.5), p.clone().addScaledVector(dir, len)];
      const cols = depth < 1 ? () => [0.6, 0.55, 0.45] : () => [1, 1, 1];
      ribTube(a, pts, [rad * 0.9, rad, rad * 0.75], { ribs: 3, depth: 0.1, radial: 6, spacing: 0.08, color: cols });
      if (depth < 3) {
        const n = depth < 2 ? 2 + Math.floor(r() * 2) : (r() < 0.6 ? 1 + Math.floor(r() * 2) : 0);
        for (let k = 0; k < n; k++) {
          const nd = dir.clone().add(new V3((r() - 0.5) * 1.4, 0.3 + r() * 0.5, (r() - 0.5) * 1.4)).normalize();
          joint(pts[2], nd, depth + 1);
        }
      }
    }
    for (let k = 0; k < 3; k++) joint(new V3(0, trunkH, 0), new V3((r() - 0.5) * 1.2, 1, (r() - 0.5) * 1.2).normalize(), 0);
    return { parts: [{ geo: accGeo(a), mat: MAT.cholla }, { geo: accGeo(wood, false), mat: MAT.bark }], r: 0.6 };
  }

  function ocotillo(seed) {
    const r = mulberry32(seed), a = Acc();
    const n = 14 + Math.floor(r() * 14);
    for (let i = 0; i < n; i++) {
      const L = 2.4 + r() * 3.2, ang = r() * Math.PI * 2, tilt = 0.08 + r() * 0.38;
      const dir = new V3(Math.sin(tilt) * Math.cos(ang), Math.cos(tilt), Math.sin(tilt) * Math.sin(ang));
      const pts = bentPath(new V3(Math.cos(ang) * 0.12, -0.05, Math.sin(ang) * 0.12), dir, L, 5, 0.2, r);
      const leafy = r() < 0.45;
      stick(a, pts, 0.035, 0.012, leafy ? [0.48, 0.55, 0.3] : [0.52, 0.45, 0.36], 4);
      if (r() < 0.6) {   // алые соцветия на концах
        const tip = pts[pts.length - 1], d = tip.clone().sub(pts[pts.length - 2]).normalize();
        stick(a, [tip, tip.clone().addScaledVector(d, 0.25)], 0.035, 0.008, [0.95, 0.18, 0.1], 5);
      }
    }
    return { parts: [{ geo: accGeo(a, false), mat: MAT.plain }], r: 0.8 };
  }

  function agave(seed) {
    const r = mulberry32(seed), a = Acc();
    const n = 22 + Math.floor(r() * 8), R = 0.45 + r() * 0.35;
    for (let i = 0; i < n; i++) {
      const t = i / n;                                      // 0 — внешние, 1 — внутренние
      const ang = i * 2.39996 + r() * 0.1;                  // золотой угол — филлотаксис
      const L = R * (1.05 - t * 0.45), W = 0.07 + 0.06 * (1 - t) + R * 0.06;
      const pitch = 1.25 - t * 1.0;                         // наклон от вертикали
      const dir = new V3(Math.sin(pitch) * Math.cos(ang), Math.cos(pitch), Math.sin(pitch) * Math.sin(ang));
      const side = new V3(-Math.sin(ang), 0, Math.cos(ang));
      const start = a.P.length / 3, segs = 4;
      for (let s = 0; s <= segs; s++) {
        const u = s / segs;
        const p = dir.clone().multiplyScalar(L * u).add(new V3(0, 0.05 - u * u * L * 0.12 * (1 - t), 0));
        const w = W * Math.pow(Math.sin(Math.min(1, u * 1.15 + 0.25) * Math.PI * 0.95), 0.8) * (1 - u * 0.85);
        const ridge = new V3().crossVectors(side, dir).normalize().multiplyScalar(w * 0.35);
        [[-1, 0], [0, 1], [1, 0]].forEach(([k, rr]) => {
          const v = p.clone().addScaledVector(side, k * w).addScaledVector(ridge, rr);
          a.P.push(v.x, v.y, v.z); a.U.push((k + 1) / 2, u);
          const edge = k !== 0 ? 0.78 : 1.0, tipDark = u > 0.93 ? 0.35 : 1;
          a.C.push(0.6 * edge * tipDark, 0.7 * edge * tipDark, 0.62 * edge * tipDark);
        });
      }
      for (let s = 0; s < segs; s++) { const b = start + s * 3; a.I.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5); }
    }
    return { parts: [{ geo: accGeo(a), mat: MAT.plain }], r: R };
  }

  function yucca(seed) {
    const r = mulberry32(seed), a = Acc(), wood = Acc();
    const trunk = r() < 0.5 ? 0 : 0.4 + r() * 1.0;
    if (trunk > 0) stick(wood, [new V3(0, -0.1, 0), new V3(0.03, trunk * 0.5, 0), new V3(0, trunk, 0.02)], 0.12, 0.1, [0.5, 0.42, 0.33], 6);
    const n = 70 + Math.floor(r() * 40);
    for (let i = 0; i < n; i++) {
      const u = r(), ang = r() * Math.PI * 2, pitch = Math.acos(1 - u * 1.25);
      const dir = new V3(Math.sin(pitch) * Math.cos(ang), Math.cos(pitch), Math.sin(pitch) * Math.sin(ang));
      const L = 0.5 + r() * 0.45, W = 0.018 + r() * 0.012;
      const side = new V3(-Math.sin(ang), 0, Math.cos(ang)), base = new V3(0, trunk + 0.05, 0);
      const s0 = a.P.length / 3;
      [[0, -1], [0, 1], [1, 0]].forEach(([u2, k]) => {
        const v = base.clone().addScaledVector(dir, L * u2).addScaledVector(side, k * W * (1 - u2)).add(new V3(0, -u2 * u2 * L * 0.1 * Math.sin(pitch), 0));
        a.P.push(v.x, v.y, v.z); a.U.push(0, 0);
        const g = 0.55 + r() * 0.2; a.C.push(g * 0.8, g, g * 0.55);
      });
      a.I.push(s0, s0 + 1, s0 + 2);
    }
    if (r() < 0.3) {   // цветонос с кремовыми колокольчиками
      const top = new V3(0, trunk + 1.6 + r() * 0.6, 0);
      stick(wood, [new V3(0, trunk, 0), top], 0.02, 0.012, [0.55, 0.5, 0.35], 4);
      for (let k = 0; k < 8; k++) { const y = top.y - 0.5 + k * 0.06, ang = k * 2.3; ellipsoid(a, Math.cos(ang) * 0.07, y, Math.sin(ang) * 0.07, 0.035, 0.045, 0.035, null, [1.5, 1.45, 1.25], 0.2, 5); }
    }
    const parts = [{ geo: accGeo(a), mat: MAT.plain }];
    if (wood.P.length) parts.push({ geo: accGeo(wood, false), mat: MAT.bark });
    return { parts, r: 0.6 };
  }

  function creosote(seed) {
    const r = mulberry32(seed), wood = Acc(), leaf = Acc();
    const n = 6 + Math.floor(r() * 4), Hh = 1.0 + r() * 1.2;
    for (let i = 0; i < n; i++) {
      const ang = r() * Math.PI * 2, tilt = 0.25 + r() * 0.5;
      const dir = new V3(Math.sin(tilt) * Math.cos(ang), Math.cos(tilt), Math.sin(tilt) * Math.sin(ang));
      const pts = bentPath(new V3(Math.cos(ang) * 0.08, -0.05, Math.sin(ang) * 0.08), dir, Hh * (0.7 + r() * 0.5), 4, 0.3, r);
      stick(wood, pts, 0.022, 0.008, [0.95, 0.85, 0.72], 3);
      for (let k = 1; k < pts.length; k++) cards(leaf, pts[k].x, pts[k].y, pts[k].z, 0.28 + k * 0.05, 5, [0.6, 1.0], r, [1, 1, 1], 0.6);
    }
    return { parts: [{ geo: accGeo(leaf), mat: MAT.creosote }, { geo: accGeo(wood, false), mat: MAT.bark }], r: 0.9 };
  }

  function brittle(seed) {
    const r = mulberry32(seed), leaf = Acc();
    const R = 0.45 + r() * 0.3;
    cards(leaf, 0, R * 0.55, 0, R, 22, [0.35, 0.55], r, [1, 1, 1], 0.55, 0.65);
    return { parts: [{ geo: accGeo(leaf), mat: MAT.brittle }], r: R };
  }

  function juniper(seed) {
    const r = mulberry32(seed), wood = Acc(), leaf = Acc();
    const H = 2.2 + r() * 2.8, stems = 1 + Math.floor(r() * 3);
    const tops = [];
    for (let s = 0; s < stems; s++) {
      const ang = r() * 6.28, dir = new V3(Math.cos(ang) * 0.25, 1, Math.sin(ang) * 0.25);
      const pts = bentPath(new V3(Math.cos(ang) * 0.1, -0.1, Math.sin(ang) * 0.1), dir, H * 0.6, 5, 0.35, r);
      stick(wood, pts, 0.14 - s * 0.02, 0.06, [0.75, 0.68, 0.62], 6);
      tops.push(...pts.slice(2));
      // боковые ветви
      for (let b = 0; b < 3; b++) {
        const from = pts[2 + Math.floor(r() * (pts.length - 2))];
        const bd = new V3((r() - 0.5) * 2, 0.4 + r() * 0.6, (r() - 0.5) * 2);
        const bp = bentPath(from, bd, H * 0.35, 3, 0.3, r);
        stick(wood, bp, 0.05, 0.02, [0.72, 0.65, 0.6], 4); tops.push(bp[bp.length - 1]);
      }
    }
    // клочковатая крона из нескольких облаков
    tops.forEach((t, i) => { if (i % 2 === 0 || r() < 0.4) cards(leaf, t.x, t.y + 0.2, t.z, 0.55 + r() * 0.5, 10, [0.55, 0.95], r, [1, 1, 1], 0.4, 0.8); });
    return { parts: [{ geo: accGeo(leaf), mat: MAT.juniper }, { geo: accGeo(wood, false), mat: MAT.bark }], r: 0.8, tall: true };
  }

  // пучок травы: скрещённые и наклонённые наружу плоскости, нормали вверх — освещён как земля
  function grass(seed, kind = 0) {
    const r = mulberry32(seed), a = Acc();
    const W = [1.0, 1.1, 0.8][kind] * (0.9 + r() * 0.3), H = [0.6, 1.15, 0.45][kind] * (0.9 + r() * 0.3);
    const quad = (ang, lean, off) => {
      const dx = Math.cos(ang), dz = Math.sin(ang), nx = -dz, nz = dx, s = a.P.length / 3;
      [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]].forEach(([u, v]) => {
        a.P.push(dx * u * W + nx * (off + lean * v), v * H - 0.04, dz * u * W + nz * (off + lean * v));
        a.U.push(u + 0.5, v); a.N.push(nx * 0.25 * (lean ? 1 : 0), 1, nz * 0.25 * (lean ? 1 : 0));
        const c = 0.82 + 0.18 * v; a.C.push(c, c, c);
      });
      a.I.push(s, s + 1, s + 2, s, s + 2, s + 3);
    };
    const a0 = r() * Math.PI;
    for (let i = 0; i < 3; i++) quad(a0 + i * Math.PI / 3, 0, 0);
    for (let i = 0; i < 4; i++) { const an = a0 + i * Math.PI / 2 + 0.4; quad(an, 0.28, 0.12); }
    a.hasN = true;
    return { parts: [{ geo: accGeo(a), mat: MAT.grass[kind] }], r: 0.4 };
  }

  window.PLANTS = { grass,  saguaro, prickly, barrel, cholla, ocotillo, agave, yucca, creosote, brittle, juniper, MAT, depthFor ,
    _h: { mulberry32, Acc, accGeo, stick, cards, bentPath, canvasTex, foliageTex, leafMat, CUT } };
})();
