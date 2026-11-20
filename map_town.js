// =============================================================================
// ГОРОДОК НА КАРТЕ «АРИЗОНА»
// Модули: Quaternius — Downtown City MegaKit (Standard, CC0).
// 5 жилых домов (2–4 этажа), 2 офисных здания, заправка и банк вдоль улицы.
// Подключается после map_arizona.js и до battle.js. Модели — models/town_kit.glb.js.
// =============================================================================
(function () {
  'use strict';
  if (!window.MAP || MAP.id !== 'arizona' || !window.TOWN_KIT_GLB_B64) return;
  const T = MAP.TOWN;
  const town = new THREE.Group(); town.name = 'Town';
  MAP.world.add(town);

  function b64ToArrayBuffer(b64) {
    const bin = atob(b64); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  // ---------------------------------------------------------------------------
  // Слияние: всё здание → по одному мешу на материал (мало draw calls)
  // ---------------------------------------------------------------------------
  function bake(root) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const groups = new Map();
    root.traverse(o => {
      if (!o.isMesh) return;
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      const key = o.material.uuid;
      if (!groups.has(key)) groups.set(key, { mat: o.material, items: [] });
      groups.get(key).items.push({ geo: o.geometry, m });
    });
    const out = new THREE.Group();
    groups.forEach(({ mat, items }) => {
      let nv = 0, ni = 0;
      items.forEach(({ geo }) => { nv += geo.attributes.position.count; ni += geo.index ? geo.index.count : geo.attributes.position.count; });
      const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), I = new Uint32Array(ni);
      let vo = 0, io = 0;
      const v = new THREE.Vector3(), nm = new THREE.Matrix3();
      items.forEach(({ geo, m }) => {
        nm.getNormalMatrix(m);
        const pa = geo.attributes.position, na = geo.attributes.normal, ua = geo.attributes.uv;
        for (let i = 0; i < pa.count; i++) {
          v.fromBufferAttribute(pa, i).applyMatrix4(m); P[(vo + i) * 3] = v.x; P[(vo + i) * 3 + 1] = v.y; P[(vo + i) * 3 + 2] = v.z;
          if (na) { v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); N[(vo + i) * 3] = v.x; N[(vo + i) * 3 + 1] = v.y; N[(vo + i) * 3 + 2] = v.z; }
          if (ua) { U[(vo + i) * 2] = ua.getX(i); U[(vo + i) * 2 + 1] = ua.getY(i); }
        }
        if (geo.index) { for (let i = 0; i < geo.index.count; i++) I[io + i] = geo.index.getX(i) + vo; io += geo.index.count; }
        else { for (let i = 0; i < pa.count; i++) I[io + i] = vo + i; io += pa.count; }
        vo += pa.count;
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
      g.setIndex(new THREE.BufferAttribute(I, 1));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = !mat.transparent; mesh.receiveShadow = true;
      out.add(mesh);
    });
    return out;
  }

  // ---------------------------------------------------------------------------
  // Конструктор из модулей
  // ---------------------------------------------------------------------------
  let KIT = {};
  let LAST_ROOTS = [];
  const piece = (name) => {
    const src = KIT[name];
    if (!src) { console.warn('town: нет модуля', name); return new THREE.Group(); }
    return src.clone();
  };
  function put(parent, name, x, y, z, rotY = 0) {
    const p = piece(name); p.position.set(x, y, z); p.rotation.y = rotY; parent.add(p); return p;
  }
  // стена вдоль ребра: длина L, набор из модулей шириной 4 и 2 м
  // side: 0 — фасад (+Z), 1 — справа (+X), 2 — тыл (−Z), 3 — слева (−X)
  function wallRun(g, W, D, side, y, from, to, chooser) {
    const rot = [0, Math.PI / 2, Math.PI, -Math.PI / 2][side];
    let s = from; let idx = 0;
    while (s < to - 0.01) {
      let w = 2, name = null;
      if (to - s >= 4 - 0.01) { const n4 = chooser(idx, 4); if (n4) { w = 4; name = n4; } }
      if (!name) name = chooser(idx, 2) || 'Brick_Plain_3';
      const c = s + w / 2;
      let x, z;
      if (side === 0) { x = c; z = D / 2; }
      else if (side === 2) { x = -c; z = -D / 2; }
      else if (side === 1) { x = W / 2; z = -c; }
      else { x = -W / 2; z = c; }
      put(g, name, x, y, z, rot);
      s += w; idx++;
    }
  }
  function rnd(seed) { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // жилой кирпичный дом W×D (кратно 2, W−2 и D−2 делятся на 2), floors этажей
  const PLY = new THREE.MeshStandardMaterial({ color: 0xa88a60, roughness: 0.95 });
  function brickHouse(W, D, floors, seed) {
    const r = rnd(seed);
    const g = new THREE.Group();
    const win4 = ['Brick_Inset_Window', 'Brick_Window_CurvedDouble', 'Brick_RedWhite_DoubleWindow'][Math.floor(r() * 3)];
    const win2 = ['Brick_Window_Square_Single', 'Brick_Window_Trim_Single'][Math.floor(r() * 2)];
    const doorAt = Math.floor((W - 2) / 2 / 2);   // индекс 2-метрового модуля под дверь
    for (let f = 0; f < floors; f++) {
      const y = f * 3;
      for (let side = 0; side < 4; side++) {
        const len = (side % 2 === 0 ? W : D) - 2;
        const half = len / 2;
        const ground = f === 0;
        // фасад и тыл — с окнами, бока — окна через один
        wallRun(g, W, D, side, y, -half, half, (i, w) => {
          if (ground && side === 0) {
            if (w === 4) return null;                  // на первом этаже фасада — только 2-метровые
            if (i === doorAt) return 'DoorFrame_Trim';
            return i % 2 ? win2 : 'Brick_BottomTrim';
          }
          if (ground) return w === 2 ? (i % 2 ? win2 : 'Brick_BottomTrim') : null;
          if (side === 0 || side === 2) return w === 4 ? (side === 0 ? win4 : null) : (i % 2 === 0 ? win2 : (f === floors - 1 ? 'Brick_TopTrim' : 'Brick_Plain_3'));
          return w === 2 ? (i % 2 ? win2 : (f === floors - 1 ? 'Brick_TopTrim' : 'Brick_Plain_3')) : null;
        });
      }
      // угловые колонны
      const colName = f === 0 ? 'Brick_CornerColumn_Bottom' : (f === floors - 1 ? 'Brick_CornerColumn_Top' : 'Brick_CornerColumn_Center');
      put(g, colName, W / 2, y, D / 2, 0); put(g, colName, -W / 2, y, D / 2, -Math.PI / 2);
      put(g, colName, -W / 2, y, -D / 2, Math.PI); put(g, colName, W / 2, y, -D / 2, Math.PI / 2);
    }
    // заколоченные окна — городок пустеет
    g.children.slice().forEach(pc => {
      if (!/Window/.test(pc.name) || r() > 0.28) return;
      const wide = /Inset|Curved|DoubleWindow/.test(pc.name);
      [-1, 1].slice(0, wide ? 2 : 1).forEach(sd => {
        const bd = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.45, 0.04), PLY); bd.position.set(wide ? sd * 1.0 : 0, 1.5, 0.1); bd.rotation.z = (r() - 0.5) * 0.08; pc.add(bd);
      });
    });
    const top = floors * 3;
    // карниз-парапет и кэпы колонн
    for (let side = 0; side < 4; side++) {
      const len = (side % 2 === 0 ? W : D) - 2;
      wallRun(g, W, D, side, top, -len / 2, len / 2, (i, w) => w === 2 ? 'Cornice_Brick_Center' : null);
    }
    put(g, 'Brick_CornerColumn_Cap', W / 2, top - 2, D / 2, 0); put(g, 'Brick_CornerColumn_Cap', -W / 2, top - 2, D / 2, -Math.PI / 2);
    put(g, 'Brick_CornerColumn_Cap', -W / 2, top - 2, -D / 2, Math.PI); put(g, 'Brick_CornerColumn_Cap', W / 2, top - 2, -D / 2, Math.PI / 2);
    // плоская крыша + кондиционеры
    for (let x = -W / 2 + 1; x < W / 2; x += 2) for (let z = -D / 2 + 1; z < D / 2; z += 2) put(g, 'Roof_2x2', x, top + 0.2, z);
    const nAC = 1 + Math.floor(r() * 3);
    for (let i = 0; i < nAC; i++) put(g, 'Prop_ACUnit', (r() - 0.5) * (W - 4), top, (r() - 0.5) * (D - 4), r() * 6.28);
    return { group: bake(g), hw: W / 2 + 0.3, front: D / 2 + 0.3, back: -D / 2 - 0.3, h: top + 1 };
  }

  // банк: светлый камень, портик с колоннами, вывеска
  function bank() {
    const W = 16, D = 12, floors = 2;
    const g = new THREE.Group();
    for (let f = 0; f < floors; f++) {
      const y = f * 3;
      for (let side = 0; side < 4; side++) {
        const len = side % 2 === 0 ? W : D;
        wallRun(g, W, D, side, y, -len / 2, len / 2, (i, w) => {
          if (w === 4) return null;
          if (f === 0 && side === 0 && (i === 3 || i === 4)) return 'DoorFrame_Trim';
          if (f === 0) return i % 2 ? 'Trim_Window' : 'Trim_FirstFloor_Wall';
          return i % 2 ? 'Trim_Window' : 'Trim_Plain_3';
        });
      }
      const col = f === 0 ? 'Trim_Column_Bottom' : 'Trim_Column_Top';
      [[W / 2, D / 2], [-W / 2, D / 2], [-W / 2, -D / 2], [W / 2, -D / 2]].forEach(([x, z]) => put(g, col, x, y, z));
    }
    for (let side = 0; side < 4; side++) {
      const len = side % 2 === 0 ? W : D;
      wallRun(g, W, D, side, 6, -len / 2, len / 2, (i, w) => w === 2 ? 'Cornice_Trim_Center' : null);
    }
    for (let x = -W / 2 + 1; x < W / 2; x += 2) for (let z = -D / 2 + 1; z < D / 2; z += 2) put(g, 'Roof_2x2', x, 6.2, z);
    // портик
    for (let i = 0; i < 4; i++) { const x = -4.5 + i * 3; put(g, 'Trim_Column_Bottom', x, 0, D / 2 + 3.2); put(g, 'Trim_Column_Top', x, 3, D / 2 + 3.2); }
    for (let x = -5; x <= 5; x += 2) put(g, 'Entrance_Concrete_2x2', x, -0.98, D / 2 + 2.2);
    const baked = bake(g);
    const stone = new THREE.MeshStandardMaterial({ color: 0xe9dcc3, roughness: 0.85 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(12.2, 1.0, 4.6), stone); slab.position.set(0, 6.5, D / 2 + 2.3);
    const sign = makeSign('BANK', '#2a3a2a', '#f4e6c4', 512, 96, 'serif');
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.3), sign); sm.position.set(0, 6.5, D / 2 + 4.62);
    [slab, sm].forEach(m => { m.castShadow = true; m.receiveShadow = true; baked.add(m); });
    return { group: baked, hw: W / 2 + 0.5, front: D / 2 + 4.6, back: -D / 2, h: 8 };
  }

  // заправка: магазин, навес на колоннах, колонки, стела
  function gasStation() {
    const g = new THREE.Group();
    const W = 10, D = 8;
    // магазин (сзади участка)
    const shop = new THREE.Group(); shop.position.set(0, 0, -8);
    for (let side = 0; side < 4; side++) {
      const len = side % 2 === 0 ? W : D;
      wallRun(shop, W, D, side, 0, -len / 2, len / 2, (i, w) => {
        if (w === 4) return null;
        if (side === 0) return i === 2 ? 'DoorFrame_Metal_Single' : 'Metal_FirstFloor_Window';
        return 'Metal_Plain_3';
      });
      wallRun(shop, W, D, side, 3, -len / 2, len / 2, (i, w) => w === 2 ? 'Cornice_Metal_Center' : null);
    }
    [[W / 2, D / 2], [-W / 2, D / 2], [-W / 2, -D / 2], [W / 2, -D / 2]].forEach(([x, z]) => put(shop, 'Metal_Column_Bottom', x, 0, z));
    for (let x = -W / 2 + 1; x < W / 2; x += 2) for (let z = -D / 2 + 1; z < D / 2; z += 2) put(shop, 'Roof_2x2', x, 3.2, z);
    g.add(shop);
    // колонны навеса
    [[-7, 4], [7, 4], [-7, 12], [7, 12]].forEach(([x, z]) => { put(g, 'Metal_Column_Bottom', x, 0, z); put(g, 'Metal_Column_Top', x, 3, z); });
    const baked = bake(g);
    // навес
    const white = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.6 });
    const red = new THREE.MeshStandardMaterial({ color: 0xc2261d, roughness: 0.5 });
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 12), white); canopy.position.set(0, 6.25, 8);
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(18.2, 0.9, 12.2), red); fascia.position.set(0, 6.9, 8);
    const brand = makeSign('DESERT GAS', '#c2261d', '#ffffff', 1024, 96, 'sans-serif');
    const bf = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.8), brand); bf.position.set(0, 6.9, 14.12);
    baked.add(canopy, fascia, bf);
    const gasParts = { canopy, fascia, brand: bf, pumps: [], loose: [] };
    // топливные колонки
    const pumpBody = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.5 });
    const concrete = new THREE.MeshStandardMaterial({ color: 0xb9b2a5, roughness: 0.95 });
    const screen = new THREE.MeshStandardMaterial({ color: 0x1a2a22, emissive: 0x204030, roughness: 0.3 });
    [-4, 4].forEach(x => {
      const island = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 6), concrete); island.position.set(x, 0.12, 8); baked.add(island);
      [-1.6, 1.6].forEach(dz => {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.6), pumpBody); p.position.set(x, 1.15, 8 + dz);
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.35, 0.62), red); t.position.set(x, 1.9, 8 + dz);
        const sc = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.3, 0.35), screen); sc.position.set(x, 1.45, 8 + dz);
        baked.add(p, t, sc); gasParts.pumps.push([p, t, sc]);
      });
    });
    // стела с ценами
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9, 0.4), concrete); pole.position.set(10.5, 4.5, 15);
    const priceTex = makeSign('GAS  $3.49', '#c2261d', '#ffffff', 512, 160, 'sans-serif', 'DIESEL $4.19');
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.4, 0.3), [red, red, red, red, priceTex, priceTex]);
    board.position.set(10.5, 8.2, 15);
    baked.add(pole, board); gasParts.loose.push(pole, board);
    // асфальт площадки
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(26, 28).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5b5650, roughness: 0.95 }));
    lot.position.set(0, 0.06, 3); lot.receiveShadow = true; baked.add(lot);
    baked.traverse(o => { if (o.isMesh && o !== lot) { o.castShadow = true; o.receiveShadow = true; } });
    // хитбокс — магазин + навес
    return { group: baked, hw: 9.2, front: 14.3, back: -12.3, h: 7.4, boxes: [{ x: 0, z: -8, hw: 5.3, hd: 4.3, h: 4.2 }],
      gas: { parts: gasParts, zones: [
        { x: -4, y: 1.1, z: 8, w: 1.8, h: 2.2, d: 5.6, kind: 'pump' }, { x: 4, y: 1.1, z: 8, w: 1.8, h: 2.2, d: 5.6, kind: 'pump' },
        { x: 0, y: 6.75, z: 8, w: 18, h: 1.5, d: 12, kind: 'ignite' }] } };
  }

  // лента дороги, лежащая по рельефу: поперечные сечения каждые 2 м, концы уходят в грунт
  function roadStrip(x0, z0, x1, z1, width, mat, alongU) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 2), dx = (x1 - x0) / len, dz = (z1 - z0) / len, px = -dz, pz = dx;
    const P = [], U = [], I = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, cx = x0 + (x1 - x0) * t, cz = z0 + (z1 - z0) * t;
      let y = Math.max(MAP.H(cx, cz), MAP.H(cx + px * width / 2, cz + pz * width / 2), MAP.H(cx - px * width / 2, cz - pz * width / 2)) + 0.09;
      if (i === 0 || i === n) y -= 0.6;
      [-0.5, 0.5].forEach(k => { P.push(cx + px * width * k, y, cz + pz * width * k); if (alongU) U.push(t, k + 0.5); else U.push(k + 0.5, t); });
      if (i < n) { const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    g.setIndex(I); g.computeVertexNormals();
    mat.side = THREE.DoubleSide;
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
  }
  function makeRoad() {
    const L = 275, g = new THREE.Group();          // главная улица: от южного въезда до SUNSET BLVD
    const c = document.createElement('canvas'); c.width = 256; c.height = 1024;
    const x = c.getContext('2d');
    x.fillStyle = '#4b4743'; x.fillRect(0, 0, 256, 1024);
    for (let i = 0; i < 9000; i++) { const v = 60 + Math.random() * 40; x.fillStyle = `rgba(${v},${v * 0.95},${v * 0.9},0.5)`; x.fillRect(Math.random() * 256, Math.random() * 1024, 2, 2); }
    x.fillStyle = '#d9b43a'; for (let y = 0; y < 1024; y += 128) { x.fillRect(122, y, 5, 70); x.fillRect(131, y, 5, 70); }
    x.fillStyle = '#e8e2d2'; x.fillRect(14, 0, 5, 1024); x.fillRect(237, 0, 5, 1024);
    crackPaint(x, 256, 1024, 34);
    x.fillStyle = 'rgba(190,140,90,0.35)'; for (let i = 0; i < 40; i++) x.fillRect(Math.random() < 0.5 ? 0 : 236, Math.random() * 1024, 20, 30 + Math.random() * 60); // песок на обочинах
    const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, L / 40); t.anisotropy = 8;
    g.add(roadStrip(T.x, T.z - 115, T.x, T.z + 160, 9, new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 }), false));
    const walkMat = new THREE.MeshStandardMaterial({ color: 0xbfb4a2, roughness: 0.95 });
    [-1, 1].forEach(sd => [[-90, -45], [-35, 41], [51, 90]].forEach(([z0, z1]) => {     // тротуары с разрывами под перекрёстки
      const w = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, z1 - z0), walkMat);
      w.position.set(T.x + sd * 6, T.h + 0.1, T.z + (z0 + z1) / 2); w.receiveShadow = true; g.add(w);
    }));
    return g;
  }

  function makeSign(text, bg, fg, w, h, font, sub) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (sub) {
      g.font = `bold ${Math.floor(h * 0.34)}px ${font}`; g.fillText(text, w / 2, h * 0.3);
      g.font = `bold ${Math.floor(h * 0.26)}px ${font}`; g.fillText(sub, w / 2, h * 0.72);
    } else {
      g.font = `bold ${Math.floor(h * 0.62)}px ${font}`; g.fillText(text, w / 2, h / 2 + h * 0.04);
    }
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
  }

  // ---------------------------------------------------------------------------
  // Размещение: улица вдоль Z, здания по обе стороны фасадом к дороге
  // ---------------------------------------------------------------------------
  const blockerMat = new THREE.MeshBasicMaterial({ visible: false });
  function place(b, side, z, setback = 9) {
    // side −1: запад (фасад на +X), +1: восток (фасад на −X)
    const rot = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    const root = new THREE.Group();
    // фасад (локальный +Z = b.front) на расстоянии setback от оси улицы
    const off = setback + b.front;
    root.position.set(T.x + side * off, T.h - 0.05, T.z + z);
    root.rotation.y = rot;
    root.add(b.group);
    town.add(root);
    root.updateMatrixWorld(true);
    const list = b.boxes || [{ x: 0, z: (b.front + b.back) / 2, hw: b.hw, hd: (b.front - b.back) / 2, h: b.h }];
    list.forEach(bx => {
      const wp = new THREE.Vector3(bx.x, 0, bx.z).applyMatrix4(root.matrixWorld);
      const box = { x: wp.x, z: wp.z, hw: bx.hw, hd: bx.hd, rot: -rot, y0: T.h - 0.1, h: bx.h };
      MAP.boxes.push(box);
      const bm = new THREE.Mesh(new THREE.BoxGeometry(bx.hw * 2, bx.h, bx.hd * 2), blockerMat);
      bm.position.set(wp.x, T.h + bx.h / 2, wp.z); bm.rotation.y = rot;
      bm.updateMatrixWorld(true);
      town.add(bm); MAP.blockers.push(bm);
      if (b.gas) bm.userData.gas = 'ignite';
      bm.userData.bld = { root, box, blocker: bm, hw: bx.hw, hd: bx.hd, h: bx.h, cx: wp.x, cz: wp.z, rot, need: b.gas ? 4 : (bx.h > 20 ? 10 : 5) };
    });
    // заправка: зоны попадания (колонки взрываются сразу, навес и магазин — загораются)
    if (b.gas) {
      const zones = b.gas.zones.map(zn => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(zn.w, zn.h, zn.d), blockerMat);
        m.position.set(zn.x, zn.y, zn.z); m.userData.gas = zn.kind; root.add(m); MAP.blockers.push(m); return m;
      });
      root.updateMatrixWorld(true);
      const W = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(root.matrixWorld);
      MAP.gas = { root, group: b.group, parts: b.gas.parts, zones, center: W(0, 0.2, 8), shop: W(0, 0.2, -8),
        pumpPos: [W(-4, 0.2, 6.4), W(-4, 0.2, 9.6), W(4, 0.2, 6.4), W(4, 0.2, 9.6)] };
    }
    return root;
  }
  function office(name, cx, cz, w, d, h) {
    const g = new THREE.Group();
    const m = piece(name); m.position.set(-cx, 0, -cz); g.add(m);
    return { group: g, hw: w / 2, front: d / 2, back: -d / 2, h };
  }

  function buildTown() {
    // улица
    town.add(makeRoad());

    // запад (фасад на восток)
    const roots = [];
    const P = (b, side, z, setback, name, col) => { const root = place(b, side, z, setback); roots.push({ root, b, name, col }); };
    P(office('Building_Large_2', 1.0, -8.0, 20.7, 16.7, 28), -1, 62, 10);
    P(brickHouse(10, 8, 3, 11), -1, 36, 9, 'HARDWARE', '#2f5a4a');
    P(bank(), -1, 8, 8);
    P(brickHouse(8, 10, 2, 22), -1, -20, 9, 'PAWN SHOP', '#7a2b1e');
    P(gasStation(), -1, -62, 7);
    // восток (фасад на запад)
    P(office('Building_Medium_2_001', 0, -6.0, 15.1, 13.1, 25), 1, 66, 10);
    P(brickHouse(12, 10, 4, 33), 1, 35, 9, 'HOTEL', '#5a3a6a');
    P(brickHouse(10, 10, 3, 44), 1, 10, 9, 'SALOON', '#6a3a1e');
    P(brickHouse(8, 12, 2, 55), 1, -18, 9, 'BARBER', '#2b4a6b');
    LAST_ROOTS = roots; MAP.townRoots = roots;
    // столбики и указатель на въезде
    for (let i = 0; i < 6; i++) put(town, 'Prop_Bollard', T.x + (i % 2 ? 4.5 : -4.5), T.h, T.z - T.hz + 2 + Math.floor(i / 2) * 3);
  }

  // ===========================================================================
  // ДЕТАЛИ ЗАХОЛУСТНОГО ГОРОДКА «RED MESA»
  // перекрёсток, мотель, дайнер, трейлерный парк, церковь, водонапорная башня,
  // столбы с проводами, фонари, брошенные машины, мусор, заборы, перекати-поле
  // ===========================================================================
  const WP = (dx, dz, dy = 0) => new THREE.Vector3(T.x + dx, T.h + dy, T.z + dz);
  const M = (color, rough = 0.85, metal = 0, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra));
  const MATS = {
    wood: M(0x8a7a66, 0.95), woodDark: M(0x5e4e3e, 0.95), metal: M(0x8d9093, 0.5, 0.6), rust: M(0x6e3d22, 0.9, 0.2),
    black: M(0x1c1c1c, 0.7), tire: M(0x161616, 0.95), glass: M(0x232a2e, 0.15, 0.3), chrome: M(0xc9cdd0, 0.3, 0.9),
    stucco: M(0xd8b59a, 0.95), stucco2: M(0xcfc2a8, 0.95), white: M(0xe7e1d4, 0.9), red: M(0xa8261d, 0.6),
    green: M(0x3d5c3a, 0.8), concrete: M(0xb3ab9c, 0.95), plywood: M(0xb08f62, 0.95), shingle: M(0x4a3f3a, 0.95),
    gravel: null, yellow: M(0xd9b43a, 0.7), sand: M(0xc4865a, 1.0)
  };
  function texCanvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; }
  MATS.gravel = new THREE.MeshStandardMaterial({ roughness: 1, map: texCanvas(256, 256, (g, w, h) => { g.fillStyle = '#8f7a66'; g.fillRect(0, 0, w, h); for (let i = 0; i < 7000; i++) { const v = 90 + Math.random() * 90; g.fillStyle = `rgb(${v},${v * 0.86},${v * 0.72})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }) });
  MATS.gravel.map.wrapS = MATS.gravel.map.wrapT = THREE.RepeatWrapping;
  const siding = (base, line) => texCanvas(64, 256, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = line; for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 3); for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(120,90,60,0.08)'; g.fillRect(Math.random() * w, Math.random() * h, 3, 10 + Math.random() * 30); } });

  function box(parent, w, h, d, mat, x, y, z, ry = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry;
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function cyl(parent, rt, rb, h, mat, x, y, z, seg = 10) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function addStatic(root, hw, hd, h, rotY, offX = 0, offZ = 0, kind) {
    root.updateMatrixWorld(true);
    const c = new THREE.Vector3(offX, 0, offZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY).add(root.position);
    const sbox = { x: c.x, z: c.z, hw, hd, rot: -rotY, y0: T.h - 0.1, h };
    MAP.boxes.push(sbox);
    const bm = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, h, hd * 2), blockerMat);
    bm.position.set(c.x, T.h + h / 2, c.z); bm.rotation.y = rotY; bm.updateMatrixWorld(true);
    bm.userData.bld = { root, simple: true, box: sbox, blocker: bm, hw, hd, h, cx: c.x, cz: c.z, rot: rotY, need: 3, kind };
    town.add(bm); MAP.blockers.push(bm);
  }
  function addProp(obj, r, kind) { MAP.props.push({ x: obj.position.x, z: obj.position.z, r, kind, obj, alive: true }); }
  function at(obj, dx, dz, ry = 0, dy = 0) { obj.position.copy(WP(dx, dz, dy)); obj.rotation.y = ry; town.add(obj); return obj; }

  // --- машины ------------------------------------------------------------------
  const CAR_COLORS = [0x8a2b22, 0x2f4a6b, 0xb8a27a, 0x4d5e3a, 0x9c9c94, 0x6b4a2e, 0xd2c8b0, 0x2b2b2b, 0x7a6a3a];
  function makeCar(type, color, o = {}) {
    const g = new THREE.Group();
    const paint = M(new THREE.Color(color).lerp(new THREE.Color(0x9a6a45), o.rust ?? 0.25).getHex(), 0.75, 0.25);
    const lift = o.noWheels ? -0.25 : 0;
    if (type === 'pickup') {
      box(g, 1.9, 0.75, 1.9, paint, 1.05, 0.72 + lift, 0);              // капот+кабина низ
      const cab = box(g, 1.5, 0.75, 1.75, MATS.glass, 0.35, 1.45 + lift, 0);
      box(g, 1.55, 0.08, 1.8, paint, 0.35, 1.86 + lift, 0);
      box(g, 2.4, 0.18, 1.9, paint, -1.3, 0.48 + lift, 0);              // кузов: пол
      box(g, 2.4, 0.55, 0.1, paint, -1.3, 0.83 + lift, 0.9); box(g, 2.4, 0.55, 0.1, paint, -1.3, 0.83 + lift, -0.9);
      box(g, 0.1, 0.55, 1.9, paint, -2.45, 0.83 + lift, 0);
      if (o.junk) { box(g, 0.6, 0.4, 0.6, MATS.woodDark, -1.5, 0.8 + lift, 0.3); cyl(g, 0.3, 0.3, 0.8, MATS.rust, -0.9, 0.95 + lift, -0.4); }
    } else {
      box(g, 4.6, 0.7, 1.8, paint, 0, 0.68 + lift, 0);
      const cab = new THREE.BoxGeometry(2.3, 0.62, 1.6);
      const p = cab.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * 0.78); p.setZ(i, p.getZ(i) * 0.92); }
      cab.computeVertexNormals();
      const cm = new THREE.Mesh(cab, MATS.glass); cm.position.set(-0.25, 1.33 + lift, 0); cm.castShadow = true; g.add(cm);
      box(g, 1.8, 0.07, 1.47, paint, -0.25, 1.66 + lift, 0);
    }
    const L = type === 'pickup' ? 4.9 : 4.6;
    box(g, 0.15, 0.22, 1.85, MATS.chrome, L / 2 - 0.05 + (type === 'pickup' ? 0.15 : 0), 0.5 + lift, 0);
    box(g, 0.15, 0.22, 1.85, MATS.chrome, -L / 2 + 0.05 - (type === 'pickup' ? 0.05 : 0), 0.5 + lift, 0);
    if (!o.noWheels) {
      [[1.45, 0.86], [1.45, -0.86], [-1.4, 0.86], [-1.4, -0.86]].forEach(([x, z], i) => {
        if (o.flat && i === 1) return;
        const w = cyl(g, 0.36, 0.36, 0.26, MATS.tire, x, 0.36, z, 14); w.rotation.x = Math.PI / 2;
        const hub = cyl(g, 0.17, 0.17, 0.28, MATS.metal, x, 0.36, z, 8); hub.rotation.x = Math.PI / 2;
      });
      if (o.flat) g.rotation.x = 0.06;
    } else {
      [[1.3, 0.6], [1.3, -0.6], [-1.3, 0.6], [-1.3, -0.6]].forEach(([x, z]) => box(g, 0.4, 0.3, 0.3, MATS.concrete, x, 0.15, z));
    }
    if (o.burnt) g.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.setHex(0x2a2420); } });
    return g;
  }
  function carBox(dx, dz, ry, type, o = {}) {
    const c = makeCar(type, o.color ?? CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)], o);
    at(c, dx, dz, ry); addProp(c, 2.4, 'car'); return c;
  }

  // --- столбы, провода, фонари, знаки --------------------------------------------
  const wirePts = [];
  function powerPole(dx, dz, ry = 0) {
    const g = new THREE.Group();
    cyl(g, 0.12, 0.17, 9.2, MATS.woodDark, 0, 4.6, 0, 7);
    box(g, 0.12, 0.14, 2.6, MATS.woodDark, 0, 8.4, 0);
    [-1.1, 0, 1.1].forEach(z => cyl(g, 0.05, 0.06, 0.25, MATS.chrome, 0, 8.6, z, 6));
    if (Math.random() < 0.4) { cyl(g, 0.28, 0.28, 0.8, MATS.metal, 0.25, 7.4, 0, 8); }   // трансформатор
    at(g, dx, dz, ry); g.rotation.z = (Math.random() - 0.5) * 0.06;  // слегка покосились
    addProp(g, 0.6, 'pole');
    return [-1.1, 0, 1.1].map(z => { const v = new THREE.Vector3(0, 8.72, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(g.position); v.pole = g; v.local = new THREE.Vector3(0, 8.72, z); return v; });
  }
  // провода: каждый пролёт помнит свои столбы; когда столб падает — пролёт провисает за ним до земли
  const WSEG = 14, wireSpans = [], wiredPoles = new Set();
  function wireBetween(a, b, sag) {
    const sp = { pa: a.pole, la: a.local, pb: b.pole, lb: b.local, sag, off: wirePts.length };
    wireSpans.push(sp); if (sp.pa) wiredPoles.add(sp.pa); if (sp.pb) wiredPoles.add(sp.pb);
    for (let i = 0; i < WSEG; i++) wirePts.push(0, 0, 0, 0, 0, 0);
    fillSpan(sp, wirePts, a, b, sag);
  }
  function fillSpan(sp, arr, a, b, sag, ground) {
    const p = new THREE.Vector3();
    for (let i = 0; i <= WSEG; i++) {
      const t = i / WSEG; p.copy(a).lerp(b, t); p.y -= sag * 4 * t * (1 - t);
      if (ground) p.y = Math.max(p.y, MAP.H(p.x, p.z) + 0.06);
      if (i < WSEG) { arr[sp.off + i * 6] = p.x; arr[sp.off + i * 6 + 1] = p.y; arr[sp.off + i * 6 + 2] = p.z; }
      if (i > 0) { arr[sp.off + i * 6 - 3] = p.x; arr[sp.off + i * 6 - 2] = p.y; arr[sp.off + i * 6 - 1] = p.z; }
    }
  }
  let wireGeo = null;
  const wA = new THREE.Vector3(), wB = new THREE.Vector3();
  function updateWires() {
    if (!wireGeo) return;
    let changed = false;
    wiredPoles.forEach(g => {
      const u = g.userData;
      if (!u.q0) { u.q0 = g.quaternion.clone(); u.p0 = g.position.clone(); u.qL = g.quaternion.clone(); u.pL = g.position.clone(); return; }
      if (u.qL.equals(g.quaternion) && u.pL.equals(g.position) && !u.dirty) return;
      u.qL.copy(g.quaternion); u.pL.copy(g.position); u.dirty = false;
      u.down = !g.visible || g.quaternion.angleTo(u.q0) > 0.15 || g.position.distanceTo(u.p0) > 0.5;
      g.updateMatrixWorld(true); changed = true;
      wireSpans.forEach(sp => { if (sp.pa === g || sp.pb === g) sp.dirty = true; });
    });
    if (!changed) return;
    const arr = wireGeo.attributes.position.array;
    wireSpans.forEach(sp => {
      if (!sp.dirty) return; sp.dirty = false;
      if (sp.pa) sp.pa.updateMatrixWorld(true); if (sp.pb) sp.pb.updateMatrixWorld(true);
      wA.copy(sp.la); sp.pa.localToWorld(wA); wB.copy(sp.lb); sp.pb.localToWorld(wB);
      const down = sp.pa.userData.down || sp.pb.userData.down;
      // упавший провод сильно провисает и ложится на землю
      fillSpan(sp, arr, wA, wB, down ? sp.sag + wA.distanceTo(wB) * 0.35 : sp.sag, down);
    });
    wireGeo.attributes.position.needsUpdate = true; wireGeo.computeBoundingSphere();
  }
  function streetLamp(dx, dz, ry) {
    const g = new THREE.Group();
    cyl(g, 0.08, 0.12, 7, MATS.metal, 0, 3.5, 0, 8);
    box(g, 2.0, 0.1, 0.1, MATS.metal, 1.0, 6.9, 0);
    box(g, 0.7, 0.18, 0.35, MATS.metal, 2.0, 6.85, 0);
    box(g, 0.55, 0.04, 0.28, M(0xf3e6c0, 0.4, 0, { emissive: 0x3a3020 }), 2.0, 6.75, 0);
    at(g, dx, dz, ry); addProp(g, 0.5, 'pole');
  }
  function signPost(dx, dz, ry, mat, w = 0.8, h = 0.8, shape = 'oct', poleH = 2.3) {
    const g = new THREE.Group();
    cyl(g, 0.04, 0.04, poleH, MATS.metal, 0, poleH / 2, 0, 6);
    const geo = shape === 'oct' ? new THREE.CylinderGeometry(w / 2, w / 2, 0.04, 8).rotateX(Math.PI / 2).rotateZ(Math.PI / 8) : new THREE.BoxGeometry(w, h, 0.04);
    const s = new THREE.Mesh(geo, mat); s.position.set(0, poleH + h / 2 - 0.1, 0.04); s.castShadow = true; g.add(s);
    at(g, dx, dz, ry); addProp(g, 0.4, 'small'); return g;
  }
  function textMat(lines, bg, fg, w, h, font = 'sans-serif', opts = {}) {
    const t = texCanvas(w, h, (g) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = h * 0.06; g.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1); }
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      lines.forEach((ln, i) => { g.font = `bold ${Math.floor(ln[1] * h)}px ${font}`; g.fillText(ln[0], w / 2, h * ln[2]); });
      // выгоревшая краска и пыль
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${200 + Math.random() * 40},${170 + Math.random() * 30},${120 + Math.random() * 30},${Math.random() * 0.18})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 12, 2 + Math.random() * 8); }
    });
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, emissive: opts.glow ? 0xffffff : 0x000000, emissiveMap: opts.glow ? t : null, emissiveIntensity: opts.glow || 0 });
  }

  // --- мусор и мелочи -------------------------------------------------------------
  function dumpster(dx, dz, ry) {
    const g = new THREE.Group(); const c = Math.random() < 0.5 ? MATS.green : M(0x2f4a6b, 0.8, 0.2);
    box(g, 1.9, 1.2, 1.2, c, 0, 0.75, 0); const lid = box(g, 1.95, 0.08, 1.25, MATS.black, 0, 1.4, -0.1); lid.rotation.x = Math.random() < 0.5 ? -0.6 : 0;
    [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]].forEach(([x, z]) => cyl(g, 0.08, 0.08, 0.15, MATS.black, x, 0.08, z, 6));
    at(g, dx, dz, ry); addProp(g, 1.2, 'small');
  }
  function barrel(dx, dz, tipped = false) {
    const g = new THREE.Group(); const m = Math.random() < 0.6 ? MATS.rust : M([0x2f4a6b, 0x8a2b22, 0x4d5e3a][Math.floor(Math.random() * 3)], 0.7, 0.3);
    const b = cyl(g, 0.3, 0.3, 0.9, m, 0, 0.45, 0, 12);
    if (tipped) { b.rotation.z = Math.PI / 2; b.position.y = 0.3; }
    at(g, dx, dz, Math.random() * 6.28); addProp(g, 0.4, 'small');
  }
  function trashCan(dx, dz) { const g = new THREE.Group(); cyl(g, 0.3, 0.26, 0.95, MATS.metal, 0, 0.48, 0, 12); cyl(g, 0.33, 0.33, 0.06, MATS.metal, 0, 0.98, 0, 12); at(g, dx, dz); addProp(g, 0.4, 'small'); }
  function hydrant(dx, dz) { const g = new THREE.Group(); const r = M(0xb0302a, 0.6); cyl(g, 0.15, 0.17, 0.7, r, 0, 0.35, 0); cyl(g, 0.12, 0.15, 0.15, r, 0, 0.78, 0); const n = cyl(g, 0.06, 0.06, 0.45, r, 0, 0.5, 0, 6); n.rotation.z = Math.PI / 2; at(g, dx, dz); addProp(g, 0.3, 'small'); }
  function mailbox(dx, dz, ry) { const g = new THREE.Group(); box(g, 0.1, 1.1, 0.1, MATS.wood, 0, 0.55, 0); const mb = box(g, 0.25, 0.25, 0.5, MATS.metal, 0, 1.2, 0); box(g, 0.02, 0.2, 0.05, MATS.red, 0.14, 1.32, -0.1); at(g, dx, dz, ry); g.rotation.z = (Math.random() - 0.5) * 0.15; addProp(g, 0.3, 'small'); }
  function pallet(dx, dz, n = 1) { const g = new THREE.Group(); for (let i = 0; i < n; i++) { box(g, 1.2, 0.14, 1.0, MATS.wood, 0, 0.07 + i * 0.15, 0); } at(g, dx, dz, Math.random() * 6.28); addProp(g, 0.8, 'small'); }
  function tires(dx, dz, n = 4) { const g = new THREE.Group(); for (let i = 0; i < n; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.13, 6, 14), MATS.tire); t.rotation.x = Math.PI / 2; t.position.set((Math.random() - 0.5) * 0.15, 0.13 + i * 0.25, (Math.random() - 0.5) * 0.15); t.castShadow = true; g.add(t); } at(g, dx, dz); addProp(g, 0.6, 'small'); }
  function bench(dx, dz, ry) { const g = new THREE.Group(); box(g, 1.8, 0.06, 0.45, MATS.wood, 0, 0.45, 0); box(g, 1.8, 0.4, 0.05, MATS.wood, 0, 0.7, -0.22); [-0.8, 0.8].forEach(x => box(g, 0.06, 0.45, 0.4, MATS.metal, x, 0.22, 0)); at(g, dx, dz, ry); addProp(g, 0.8, 'small'); }
  function fenceRun(x0, z0, x1, z1, type) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 3)), ry = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i < n; i++) {
      if (type === 'wood' && Math.random() < 0.18) continue;   // выломанные секции
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      const g = new THREE.Group();
      if (type === 'chain') {
        cyl(g, 0.04, 0.04, 2.0, MATS.metal, 0, 1.0, -len / n / 2, 6);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(len / n, 1.9), CHAIN); f.position.set(0, 1.0, 0); f.rotation.y = Math.PI / 2; g.add(f);
      } else {
        box(g, 0.1, 1.3, 0.1, MATS.woodDark, 0, 0.65, -len / n / 2);
        box(g, 0.05, 0.12, len / n, MATS.wood, 0, 1.05, 0); box(g, 0.05, 0.12, len / n, MATS.wood, 0, 0.55, 0);
      }
      at(g, x, z, ry); g.rotation.z = (Math.random() - 0.5) * (type === 'wood' ? 0.2 : 0.05);
      addProp(g, 1.0, 'small');
    }
  }
  const CHAIN = new THREE.MeshStandardMaterial({ map: texCanvas(64, 64, (g) => { g.clearRect(0, 0, 64, 64); g.strokeStyle = 'rgba(150,152,150,1)'; g.lineWidth = 2; for (let i = -64; i < 128; i += 10) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); } }), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.6 });
  CHAIN.map.wrapS = CHAIN.map.wrapT = THREE.RepeatWrapping; CHAIN.map.repeat.set(1.5, 1);

  // --- крупные постройки ------------------------------------------------------------
  function motel(dx, dz, ry) {
    const g = new THREE.Group(); const L = 40, D = 8;
    const wall = new THREE.MeshStandardMaterial({ color: 0xd9a988, roughness: 0.95 });
    box(g, D, 3.2, L, wall, 0, 1.6, 0);
    box(g, D + 2.8, 0.18, L + 0.4, MATS.white, 1.4, 3.25, 0);                 // крыша-навес над галереей
    box(g, 2.6, 0.12, L, MATS.concrete, D / 2 + 1.3, 0.06, 0);                // дорожка
    const doorCols = [0x3f7a7a, 0x9a4a2e, 0x3f7a7a, 0xb08a3a];
    for (let i = 0; i < 9; i++) {
      const z = -L / 2 + 2.4 + i * 4.3;
      box(g, 0.08, 2.1, 0.95, M(doorCols[i % 4], 0.7), D / 2 + 0.03, 1.05, z);
      box(g, 0.06, 1.0, 1.4, MATS.glass, D / 2 + 0.03, 1.6, z + 1.6);
      if (Math.random() < 0.35) box(g, 0.07, 1.0, 1.4, MATS.plywood, D / 2 + 0.07, 1.6, z + 1.6);   // заколоченное окно
      box(g, 0.08, 0.06, 0.4, MATS.chrome, D / 2 + 0.05, 2.35, z);           // номерок
      cyl(g, 0.07, 0.07, 3.1, MATS.white, D / 2 + 2.6, 1.6, z - 1.0, 6);     // столбики навеса
    }
    box(g, 9, 4.2, 9, wall, -0.5, 2.1, L / 2 + 4.5);                          // офис
    box(g, 0.1, 1.6, 4, MATS.glass, 4.0, 1.5, L / 2 + 4.5);
    const om = textMat([['OFFICE', 0.6, 0.55]], '#f0e6d0', '#8a2b22', 256, 64); box(g, 0.1, 0.7, 3.2, om, 4.05, 3.4, L / 2 + 4.5);
    // кондиционеры
    for (let i = 0; i < 5; i++) put(g, 'Prop_ACUnit', -1.5 + Math.random() * 3, 3.35, -L / 2 + 4 + i * 8, Math.random() * 6.28);
    const root = at(g, dx, dz, ry);
    addStatic(root, D / 2 + 0.3, L / 2 + 4.6, 4.3, ry, 0, 4.4);
    // стела мотеля
    const s = new THREE.Group();
    cyl(s, 0.18, 0.2, 10, MATS.metal, 0, 5, 0, 8);
    const sign = textMat([['MOTEL', 0.42, 0.33], ['VACANCY', 0.2, 0.78]], '#1f4f57', '#ff7b8a', 512, 320, 'sans-serif', { border: '#e8d9b0', glow: 0.35 });
    box(s, 0.3, 3.2, 5.0, [sign, sign, MATS.white, MATS.white, MATS.white, MATS.white], 0, 9.5, 0);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 3), MATS.yellow); arrow.rotation.x = Math.PI / 2; arrow.position.set(0, 9.5, -2.9); s.add(arrow);
    at(s, dx - 18, dz - L / 2 + 2, 0); addProp(s, 0.6, 'pole');
    return root;
  }
  function diner(dx, dz, ry) {
    const g = new THREE.Group(); const W = 16, D = 8;
    const steel = M(0xc5c9cc, 0.35, 0.8);
    box(g, W, 1.0, D, steel, 0, 0.5, 0);
    box(g, W, 1.6, D - 0.2, MATS.glass, 0, 1.8, 0);
    box(g, W + 0.05, 0.35, D + 0.05, MATS.red, 0, 2.75, 0);
    box(g, W + 0.4, 0.9, D + 0.4, steel, 0, 3.35, 0);
    box(g, 2, 2.2, 0.15, MATS.glass, -4, 1.1, D / 2 + 0.05);
    const dm = textMat([['DINER', 0.7, 0.55]], '#a8261d', '#fff4dc', 512, 128, 'serif', { glow: 0.25 });
    box(g, 7, 1.5, 0.25, dm, 0, 4.6, 0);
    const root = at(g, dx, dz, ry); addStatic(root, W / 2 + 0.2, D / 2 + 0.2, 5.4, ry);
    const eat = new THREE.Group(); cyl(eat, 0.12, 0.12, 6, MATS.metal, 0, 3, 0, 8);
    box(eat, 0.25, 1.4, 3, [textMat([['EAT', 0.8, 0.55]], '#fff4dc', '#a8261d', 256, 128), textMat([['EAT', 0.8, 0.55]], '#fff4dc', '#a8261d', 256, 128), MATS.red, MATS.red, MATS.red, MATS.red], 0, 6.4, 0);
    at(eat, dx - 9, dz - 9, 0); addProp(eat, 0.5, 'pole');
  }
  function trailer(dx, dz, ry, col) {
    const g = new THREE.Group();
    const sid = new THREE.MeshStandardMaterial({ map: siding(col, 'rgba(0,0,0,0.12)'), roughness: 0.8, metalness: 0.15 });
    box(g, 4.2, 2.7, 14, sid, 0, 1.95, 0);
    box(g, 4.25, 0.6, 14, MATS.woodDark, 0, 0.3, 0);                        // юбка
    box(g, 4.3, 0.12, 14.2, MATS.metal, 0, 3.35, 0);
    for (let i = 0; i < 4; i++) box(g, 0.06, 0.9, 1.2, MATS.glass, 2.12, 2.2, -5 + i * 3.4);
    box(g, 0.06, 2.0, 0.9, MATS.white, 2.12, 1.6, 4.8);
    box(g, 1.2, 0.5, 1.2, MATS.wood, 2.8, 0.25, 4.8);                       // крыльцо
    const root = at(g, dx, dz, ry); addStatic(root, 2.2, 7.1, 3.4, ry);
    mailbox(dx + Math.cos(ry) * 4.5, dz - Math.sin(ry) * 4.5 + 6, ry);
  }
  function church(dx, dz, ry) {
    const g = new THREE.Group(); const sid = new THREE.MeshStandardMaterial({ map: siding('#e9e3d6', 'rgba(0,0,0,0.1)'), roughness: 0.9 });
    box(g, 9, 5, 15, sid, 0, 2.5, 0);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 6.6, 3.6, 4, 1).rotateY(Math.PI / 4).scale(0.98, 1, 2.4), MATS.shingle);
    roof.position.set(0, 6.8, 0); roof.castShadow = true; g.add(roof);
    box(g, 3, 6, 3, sid, 0, 3, 8.5);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.1, 5, 4), MATS.shingle); spire.rotation.y = Math.PI / 4; spire.position.set(0, 8.5, 8.5); spire.castShadow = true; g.add(spire);
    box(g, 0.12, 1.4, 0.12, MATS.white, 0, 11.6, 8.5); box(g, 0.7, 0.12, 0.12, MATS.white, 0, 11.8, 8.5);
    box(g, 1.4, 2.4, 0.1, MATS.woodDark, 0, 1.2, 10.05);
    for (let i = 0; i < 4; i++) { box(g, 0.08, 1.8, 0.9, MATS.glass, 4.52, 2.6, -5 + i * 3.2); box(g, 0.08, 1.8, 0.9, MATS.glass, -4.52, 2.6, -5 + i * 3.2); }
    const root = at(g, dx, dz, ry); addStatic(root, 4.7, 8.9, 7, ry, 0, 1.3);
  }
  function waterTower(dx, dz) {
    const g = new THREE.Group(); const legH = 16;
    [[2.6, 2.6], [-2.6, 2.6], [2.6, -2.6], [-2.6, -2.6]].forEach(([x, z]) => { const l = cyl(g, 0.18, 0.22, legH, MATS.metal, x * 0.9, legH / 2, z * 0.9, 8); l.rotation.set(-z * 0.012, 0, x * 0.012); });
    for (let y = 4; y < legH; y += 5) { box(g, 5.2, 0.1, 0.1, MATS.metal, 0, y, 2.4); box(g, 5.2, 0.1, 0.1, MATS.metal, 0, y, -2.4); box(g, 0.1, 0.1, 5.2, MATS.metal, 2.4, y, 0); box(g, 0.1, 0.1, 5.2, MATS.metal, -2.4, y, 0); }
    const tankTex = texCanvas(1024, 256, (c, w, h) => { c.fillStyle = '#ddd8cc'; c.fillRect(0, 0, w, h); for (let i = 0; i < 200; i++) { c.fillStyle = `rgba(140,90,50,${Math.random() * 0.15})`; c.fillRect(Math.random() * w, Math.random() * h * 0.3 + h * 0.5, 2, 30 + Math.random() * 90); } c.fillStyle = '#7a3524'; c.font = 'bold 120px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('RED MESA', w * 0.25, h / 2); c.fillText('RED MESA', w * 0.75, h / 2); });
    cyl(g, 4.2, 4.2, 6, new THREE.MeshStandardMaterial({ map: tankTex, roughness: 0.7, metalness: 0.2 }), 0, legH + 3, 0, 28);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2.2, 28), MATS.white); cap.position.set(0, legH + 7.1, 0); cap.castShadow = true; g.add(cap);
    cyl(g, 0.25, 0.25, legH, MATS.metal, 0, legH / 2, 0, 8);
    const root = at(g, dx, dz); addStatic(root, 2.9, 2.9, legH + 8, 0, 0, 0, 'tower');
  }
  function billboard(x, z, ry, lines) {
    const g = new THREE.Group();
    [-3.5, 3.5].forEach(px => box(g, 0.3, 7, 0.3, MATS.woodDark, px, 3.5, 0));
    const tm = textMat(lines, '#e8d8b4', '#7a2b1e', 1024, 410, 'serif', { border: '#3a2a1e' });
    box(g, 10, 4, 0.2, [MATS.wood, MATS.wood, MATS.wood, MATS.wood, tm, MATS.woodDark], 0, 6.5, 0);
    g.position.set(x, MAP.H(x, z), z); g.rotation.y = ry; town.add(g);
    addProp(g, 1.0, 'pole');
  }
  function awning(root, W, frontZ, name, col) {
    const valance = textMat([[name, 0.62, 0.55]], col, '#f4ecd8', 512, 64, 'serif');
    const stripes = new THREE.MeshStandardMaterial({ map: texCanvas(128, 16, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#e8dcc0' : col; g.fillRect(i * 16, 0, 16, 16); } }), roughness: 0.95, side: THREE.DoubleSide });
    const a = new THREE.Mesh(new THREE.PlaneGeometry(W, 1.9), stripes); a.rotation.x = -Math.PI / 2 + 0.45; a.position.set(0, 2.85, frontZ + 0.85); a.castShadow = true; root.add(a);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.4), valance); v.position.set(0, 2.25, frontZ + 1.68); root.add(v);
  }
  function sandDrift(dx, dz, s = 1) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), MATS.sand); m.scale.set(rnd2(1.5, 4) * s, rnd2(0.12, 0.3) * s, rnd2(0.8, 2) * s);
    m.position.copy(WP(dx, dz, 0)); m.rotation.y = Math.random() * 6.28; m.receiveShadow = true; town.add(m);
  }
  const rnd2 = (a, b) => a + Math.random() * (b - a);

  // --- перекати-поле -----------------------------------------------------------------
  const weeds = [];
  function tumbleweed() {
    const g = new THREE.Group();
    const geo = new THREE.IcosahedronGeometry(0.6, 1); const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const k = 0.7 + Math.random() * 0.5; pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k); }
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), new THREE.LineBasicMaterial({ color: 0x8a6a40 })));
    g.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.4, 1)), new THREE.LineBasicMaterial({ color: 0x6e5232 })));
    town.add(g);
    const w = { g, x: T.x - 80 + Math.random() * 40, z: T.z + (Math.random() - 0.5) * 180, v: 2 + Math.random() * 3, ph: Math.random() * 6 };
    weeds.push(w); return w;
  }
  let lastT = performance.now();
  function animateTown() {
    requestAnimationFrame(animateTown);
    const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    weeds.forEach(w => {
      w.ph += dt * w.v * 1.5;
      w.x += dt * w.v; w.z += Math.sin(w.ph * 0.3) * dt * 0.8;
      if (w.x > T.x + 90) { w.x = T.x - 90; w.z = T.z + (Math.random() - 0.5) * 180; }
      const y = MAP.H(w.x, w.z) + 0.55 + Math.abs(Math.sin(w.ph)) * 0.5;
      w.g.position.set(w.x, y, w.z); w.g.rotation.z -= dt * w.v / 0.6; w.g.rotation.x += dt * 0.3;
    });
    cullCars(); updateWires();
    if (blinkMat) blinkMat.emissiveIntensity = (Math.floor(now / 600) % 2) ? 1.6 : 0.05;
  }
  let blinkMat = null;

  function buildDetails(roots) {
    // перекрёсток: поперечная улица
    const cross = makeCrossRoad(); town.add(cross);
    // гравийные площадки
    const lot = (dx, dz, w, d) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), MATS.gravel); m.material = MATS.gravel; m.position.copy(WP(dx, dz, 0.05)); m.receiveShadow = true; town.add(m); };
    MATS.gravel.map.repeat.set(8, 8);
    lot(31, 8, 14, 46); lot(-44, 4, 22, 74); lot(17, -60, 22, 20);

    // мотель за восточным рядом, дайнер за перекрёстком
    motel(44, 4, Math.PI);          // фасадом на запад (к стоянке)
    diner(17, -60, -Math.PI / 2);   // фасадом к главной улице
    // трейлерный парк за западным рядом
    ['#e3dccb', '#c9d3cf', '#e0cfa9', '#d8d0c4'].forEach((c, i) => trailer(-44, -24 + i * 19, 0, c));
    fenceRun(-58, -33, -58, 41, 'chain'); fenceRun(-58, 41, -32, 41, 'chain'); fenceRun(-58, -33, -32, -33, 'chain');
    // церковь и водонапорная башня
    church(-42, 80, Math.PI / 2);
    waterTower(44, 80);

    // столбы ЛЭП вдоль главной улицы (восточная сторона) + провода
    let prev = null;
    for (let z = -T.hz - 40; z <= T.hz + 40; z += 24) {
      if (nearCross(z, 7)) continue;
      const dx = 7.9, x = T.x + dx;
      const pts = (Math.abs(z) > T.hz + 2) ? (() => { const p = powerPole(dx, z, 0); p.forEach(v => v.y += MAP.H(x, T.z + z) - T.h); return p; })() : powerPole(dx, z, 0);
      if (Math.abs(z) > T.hz + 2) { const pr = MAP.props[MAP.props.length - 1].obj; pr.position.y = MAP.H(x, T.z + z); }
      if (prev) for (let k = 0; k < 3; k++) wireBetween(prev[k], pts[k], 0.7 + Math.random() * 0.3);
      prev = pts;
    }
    // ответвление на мотель и трейлеры по поперечной улице
    const a1 = powerPole(30, -45, Math.PI / 2), a2 = powerPole(-30, -45, Math.PI / 2);
    // фонари вдоль западного тротуара
    for (let z = -80; z <= 85; z += 32) if (!nearCross(z, 7)) streetLamp(-7.9, z, 0);
    // светофор-мигалка на перекрёстке
    {
      const p1 = powerPole(-7.5, -46, Math.PI / 4), p2 = powerPole(7.5, -34, Math.PI / 4);
      wireBetween(p1[1], p2[1], 0.5);
      const g = new THREE.Group();
      box(g, 0.45, 1.2, 0.45, MATS.yellow, 0, 0, 0);
      blinkMat = M(0xffb020, 0.4, 0, { emissive: 0xffa000, emissiveIntensity: 1 });
      [0.35, 0, -0.35].forEach((y, i) => { const l = cyl(g, 0.12, 0.12, 0.06, i === 1 ? blinkMat : MATS.black, 0, y, 0.25, 10); l.rotation.x = Math.PI / 2; const l2 = l.clone(); l2.position.z = -0.25; g.add(l2); });
      g.position.copy(WP(0, -40, 7.6)); town.add(g);
    }
    // стопы на перекрёстке
    const stop = textMat([['STOP', 0.42, 0.53]], '#b3241c', '#ffffff', 128, 128, 'sans-serif', { border: '#ffffff' });
    [[-6.2, -45.5, Math.PI], [6.2, -34.5, 0], [-6.2, -34.5, -Math.PI / 2], [6.2, -45.5, Math.PI / 2]].forEach(([x, z, r]) => signPost(x, z, r, stop));
    // таблички улиц
    const st1 = textMat([['MAIN ST', 0.6, 0.55]], '#1f5a3a', '#ffffff', 256, 64);
    const st2 = textMat([['MESA AVE', 0.6, 0.55]], '#1f5a3a', '#ffffff', 256, 64);
    signPost(-6.4, -33.5, 0, st1, 1.4, 0.32, 'box', 2.8); signPost(-6.4, -33.8, Math.PI / 2, st2, 1.4, 0.32, 'box', 3.2);
    const lim = textMat([['SPEED', 0.2, 0.2], ['LIMIT', 0.2, 0.4], ['25', 0.42, 0.72]], '#f2efe6', '#111111', 128, 160, 'sans-serif', { border: '#111' });
    signPost(6.4, -92, Math.PI, lim, 0.6, 0.75, 'box', 2.2);

    // въезд: щит «добро пожаловать» и рекламный билборд
    const wl = new THREE.Group();
    [-1.8, 1.8].forEach(x => box(wl, 0.2, 2.6, 0.2, MATS.woodDark, x, 1.3, 0));
    box(wl, 4.4, 1.7, 0.12, [MATS.wood, MATS.wood, MATS.wood, MATS.wood, textMat([['WELCOME TO', 0.16, 0.2], ['RED MESA', 0.34, 0.5], ['POP. 312 · EST. 1912', 0.13, 0.82]], '#c9b48a', '#5a2a1a', 512, 200, 'serif', { border: '#5a2a1a' }), MATS.woodDark], 0, 2.4, 0);
    at(wl, -12, -110, Math.PI); addProp(wl, 1.2, 'small');
    billboard(T.x + 24, T.z - T.hz - 30, Math.PI + 0.4, [["CACTUS JACK'S", 0.18, 0.24], ['DINER · MOTEL · GAS', 0.12, 0.5], ['NEXT EXIT — RED MESA', 0.1, 0.75]]);
    billboard(T.x + 40, T.z + 182, 0.3, [['SEE THE', 0.12, 0.22], ['RED ROCKS', 0.24, 0.5], ['FREE SCENIC VIEWS · 5 MI', 0.09, 0.8]]);

    // вывески-маркизы на первых этажах домов
    roots.forEach(({ root, b, name, col }) => { if (name) awning(root, b.hw * 2 - 3, b.front - 0.3, name, col); });

    // машины: на улице, у мотеля, на заправке, у трейлеров, сгоревшая на въезде
    car(3.2, 22, 0, 'sedan'); car(-3.2, -8, Math.PI, 'pickup'); car(3.2, 55, 0, 'sedan', { flat: true });
    car(-3.2, 68, Math.PI, 'sedan', { rust: 0.5 });
    car(30, -6, Math.PI / 2, 'sedan'); car(30, 6, Math.PI / 2, 'pickup', { junk: true }); car(31, 26, Math.PI / 2 + 0.2, 'sedan', { rust: 0.6, flat: true });
    car(-14, -58, 0.1, 'pickup'); car(-20, -70, 1.4, 'sedan', { noWheels: true, rust: 0.8 });
    car(-36, -10, 0.3, 'sedan', { noWheels: true, rust: 0.9 }); car(-37, 30, -0.4, 'pickup', { rust: 0.7, junk: true });
    car(12, -48, 0, 'sedan', { color: 0xd2c8b0 }); car(22, -48, 0, 'pickup');
    car(-6, -T.hz - 18, 0.8, 'sedan', { burnt: true, noWheels: true });
    // два пикапа у колонок заправки
    if (MAP.gas && MAP.gas.root) { const gr = MAP.gas.root; gr.updateMatrixWorld(true);
      [[-1.2, 8.0, 'dodge'], [7.6, 8.4, 'cameo']].forEach(([lx, lz, mdl]) => { const w = new THREE.Vector3(lx, 0, lz).applyMatrix4(gr.matrixWorld); car(w.x - T.x, w.z - T.z, gr.rotation.y + Math.PI / 2, 'pickup', { model: mdl }); }); }

    // мусор, бочки, контейнеры, гидранты, лавки
    [[-30, 40, 0], [-30, 12, 0], [26, 52, 1.57], [26, -18, 1.57], [-30, -24, 0], [24, 30, 1.57]].forEach(([x, z, r]) => dumpster(x, z, r));
    for (let i = 0; i < 10; i++) { const z = -85 + i * 18 + Math.random() * 4; if (!nearCross(z, 7)) trashCan(i % 2 ? 7.4 : -7.4, z); }
    [[-16, -52], [-15, -53.5], [-17.5, -51], [-40, -30], [-41, -31], [-50, 4], [-49, 6], [36, 60], [37, 61.5], [-8, -66]].forEach(([x, z], i) => barrel(x, z, i % 4 === 3));
    [[7.4, -60], [-7.4, 20], [7.4, 40], [-7.4, -30]].forEach(([x, z]) => hydrant(x, z));
    [[-50, 22, 2], [-36, 38, 1], [27, 40, 3], [-19, -76, 1]].forEach(([x, z, n]) => pallet(x, z, n));
    [[-52, -14], [-24, -74], [38, 64]].forEach(([x, z]) => tires(x, z, 3 + Math.floor(Math.random() * 3)));
    bench(-7.2, 2, Math.PI / 2); bench(7.2, 26, -Math.PI / 2); bench(-36, 74, 0);
    // деревянные заборы во дворах
    fenceRun(-28, 40, -28, 26, 'wood'); fenceRun(22, -26, 22, -8, 'wood'); fenceRun(24, 40, 24, 28, 'wood');

    // песчаные наносы на дороге и тротуарах
    for (let i = 0; i < 34; i++) sandDrift((Math.random() < 0.5 ? -1 : 1) * rnd2(2.5, 9), rnd2(-T.hz, T.hz), rnd2(0.6, 1.3));
    for (let i = 0; i < 10; i++) sandDrift(rnd2(-55, 55), -40 + rnd2(-4, 4), rnd2(0.6, 1.1));
    for (let i = 0; i < 9; i++) tumbleweed();

    // провода одной геометрией
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3));
    wg.attributes.position.setUsage(THREE.DynamicDrawUsage); wireGeo = wg;
    town.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x1e1a18 })));
    animateTown();
  }
  function makeCrossRoad() {
    const g = new THREE.Group(), L = 218;
    const t = texCanvas(1024, 256, (x, w, h) => {
      x.fillStyle = '#4e4945'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { const v = 60 + Math.random() * 40; x.fillStyle = `rgba(${v},${v * 0.95},${v * 0.9},0.5)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      x.fillStyle = 'rgba(205,165,60,0.8)'; for (let X = 0; X < w; X += 120) x.fillRect(X, 124, 70, 6);
      crackPaint(x, w, h, 26);
      x.fillStyle = 'rgba(190,130,85,0.35)'; for (let i = 0; i < 30; i++) x.fillRect(Math.random() * w, Math.random() < 0.5 ? 0 : 226, 60 + Math.random() * 80, 30);
    });
    t.wrapS = THREE.RepeatWrapping; t.repeat.set(L / 60, 1);
    const m = roadStrip(T.x - 139, T.z - 40, T.x + 79, T.z - 40, 8, new THREE.MeshStandardMaterial({ map: t, roughness: 0.93, polygonOffset: true, polygonOffsetFactor: -2 }), true);
    m.position.y += 0.01; g.add(m);
    // стоп-линии
    [[-0, -45.2], [0, -34.8]].forEach(([x, z]) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.4).rotateX(-Math.PI / 2), MATS.white); s.position.copy(WP(z < -40 ? 2.2 : -2.2, z, 0.11)); g.add(s); });
    return g;
  }
  function crackPaint(x, w, h, n) {
    x.strokeStyle = 'rgba(25,22,20,0.7)'; x.lineWidth = 1.5;
    for (let i = 0; i < n; i++) { let px = Math.random() * w, py = Math.random() * h; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 8; k++) { px += (Math.random() - 0.5) * 40; py += (Math.random() - 0.5) * 40; x.lineTo(px, py); } x.stroke(); }
    for (let i = 0; i < n / 3; i++) { x.fillStyle = `rgba(${40 + Math.random() * 20},${38},${36},0.6)`; x.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 60, 20 + Math.random() * 40); }
  }

  // ===========================================================================
  // ПИКАПЫ (реальные модели, упрощены заранее): взрываются, мнутся под танком
  // ===========================================================================
  const PICKUPS = {}, PICKUP_KEYS = ['cameo', 'dodge', 'luv1', 'luv2', 'luv3', 'luv4', 'luv5'];
  const carObjs = [];
  async function loadPickups() {
    const src = window.PICKUP_GLB || {};
    for (const k of PICKUP_KEYS) {
      if (!src[k]) continue;
      const g = await new Promise((res, rej) => new THREE.GLTFLoader().parse(b64ToArrayBuffer(src[k]), '', res, rej)).catch(e => { console.error('pickup', k, e); return null; });
      if (!g) continue;
      let mesh = null; g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
      const m = mesh.material;
      if (m.color) m.color.convertLinearToSRGB();
      if (m.map) { m.map.encoding = THREE.LinearEncoding; m.map.anisotropy = 4; m.map.needsUpdate = true; }
      if (m.userData.alphaFromAO && m.aoMap) { m.alphaMap = m.aoMap; m.aoMap = null; m.alphaTest = 0.5; }
      m.color.multiplyScalar(1.05); m.metalness = 0.15; m.roughness = 0.45; m.side = THREE.FrontSide; m.needsUpdate = true;
      PICKUPS[k] = { geo: mesh.geometry, mat: m };
    }
    window.PICKUP_GLB = null;
  }
  const carBlocker = new THREE.MeshBasicMaterial({ visible: false });
  let carSeq = 0;
  function makePickup(model) {
    const keys = Object.keys(PICKUPS); if (!keys.length) return null;
    const k = model && PICKUPS[model] ? model : keys[(carSeq++ * 5 + 3) % keys.length];
    const g = new THREE.Group(), m = new THREE.Mesh(PICKUPS[k].geo, PICKUPS[k].mat);
    m.rotation.y = Math.PI / 2;                     // у модели перёд по +Z, у городка «машина» смотрит по +X
    m.castShadow = true; m.receiveShadow = true; g.add(m); g.userData.body = m;
    return g;
  }
  // смятые машины — невысокие препятствия, на которые танк заезжает (учитывается в посадке танка на землю)
  MAP.wrecks = [];
  const sstep = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  MAP.bumpAt = (x, z) => {
    let best = 0;
    for (let i = 0; i < MAP.wrecks.length; i++) {
      const w = MAP.wrecks[i]; if (w.h <= 0.01) continue;
      const dx = x - w.x, dz = z - w.z; if (dx * dx + dz * dz > 16) continue;
      const lx = Math.abs(dx * w.ca - dz * w.sa), lz = Math.abs(dx * w.sa + dz * w.ca);   // вдоль и поперёк машины
      const fx = 1 - sstep((lx - w.hl + 1.1) / 1.1), fz = 1 - sstep((lz - w.hw + 0.5) / 0.5);
      const hh = w.h * fx * fz; if (hh > best) best = hh;
    }
    return best;
  };
  // car(): старая сигнатура сохранена — теперь вместо коробок настоящие пикапы
  function car(dx, dz, ry, type, o = {}) {
    const c = makePickup(o.model); if (!c) return null;
    at(c, dx, dz, ry);
    if (o.noWheels) { c.position.y -= 0.22; c.rotation.z = (Math.random() - 0.5) * 0.06; c.rotation.x = 0.04; }
    if (o.burnt) c.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.setRGB(0.09, 0.08, 0.07); m.material.map = null; } });
    else if (o.rust) c.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.lerp(new THREE.Color(0.55, 0.42, 0.33), Math.min(0.5, o.rust * 0.5)); } });
    const prop = { x: c.position.x, z: c.position.z, r: 2.4, kind: 'car', obj: c, alive: true, car: true, mg: 0 };
    const bm = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.75, 1.95), carBlocker); bm.position.y = 0.9; c.add(bm); c.updateMatrixWorld(true);
    bm.userData.car = prop; prop.blocker = bm; MAP.blockers.push(bm);
    // наезд танка: кузов сплющивается, перекашивается, стёкла «лопаются» (темнее)
    prop.crush = (dX, dZ) => {
      if (prop.crushed || prop.exploded) return; prop.crushed = true;
      // сначала кузов проседает немного (танк въезжает на него), потом сплющивается под весом
      gsap.to(c.scale, { y: 0.8, duration: 0.12, ease: 'power2.out' });
      gsap.to(c.scale, { y: 0.42, z: 1.08, duration: 0.7, delay: 0.25, ease: 'power2.in' });
      gsap.to(c.rotation, { x: c.rotation.x + (Math.random() - 0.5) * 0.18, z: c.rotation.z + (Math.random() - 0.5) * 0.1, duration: 0.6, delay: 0.25 });
      // «горб» под гусеницами: танк поднимается на машину и переваливает через неё
      const wk = { x: c.position.x, z: c.position.z, ca: Math.cos(c.rotation.y), sa: Math.sin(c.rotation.y), hl: 2.5, hw: 1.05, h: 1.25, car: prop };
      MAP.wrecks.push(wk); prop.wreck = wk;
      gsap.to(wk, { h: 0.55, duration: 0.7, delay: 0.25, ease: 'power2.in' });
      c.traverse(m => { if (m.isMesh && m.material.visible !== false && m !== bm) { m.material = m.material.clone(); m.material.color.multiplyScalar(0.72); } });
      bm.scale.y = 0.45; bm.position.y = 0.4;
    };
    MAP.props.push(prop); carObjs.push(c);
    if (o.burnt) prop.exploded = true;
    return c;
  }

  // ===========================================================================
  // ЖИЛЫЕ КВАРТАЛЫ: сетка улиц и дома middle class 1950–60-х
  // ===========================================================================
  const NS_X = [-135, -70, 75];                     // параллельные главной (dx)
  const EW_Z = [-100, -40, 46, 105, 150];           // перпендикулярные главной (dz), -40 — старая Mesa Ave
  const NS_SPAN = [-100, 150], EW_SPAN = [-135, 75];
  const PADR = { x0: (T.pad ? T.pad.x0 - T.x : -160) + 4, x1: (T.pad ? T.pad.x1 - T.x : 100) - 4, z0: (T.pad ? T.pad.z0 - T.z : -110) + 4, z1: (T.pad ? T.pad.z1 - T.z : 165) - 4 };
  const ROADS = [{ x0: -4.5, x1: 4.5, z0: -115, z1: 160 }];
  NS_X.forEach(x => ROADS.push({ x0: x - 4, x1: x + 4, z0: NS_SPAN[0] - 4, z1: NS_SPAN[1] + 4 }));
  EW_Z.forEach(z => ROADS.push({ x0: EW_SPAN[0] - 4, x1: EW_SPAN[1] + 4, z0: z - 4, z1: z + 4 }));
  const nearCross = (dz, m) => EW_Z.some(z => Math.abs(dz - z) < m);
  function resTexture(w, h, centerLine) {
    return texCanvas(w, h, (x, W, H) => {
      x.fillStyle = '#55504a'; x.fillRect(0, 0, W, H);
      for (let i = 0; i < W * H / 9; i++) { const v = 62 + Math.random() * 46; x.fillStyle = `rgba(${v},${v * 0.96},${v * 0.9},0.5)`; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
      if (centerLine) { x.fillStyle = 'rgba(210,170,70,0.55)'; for (let y = 0; y < H; y += 96) x.fillRect(W / 2 - 3, y, 6, 52); }
      x.fillStyle = 'rgba(150,140,125,0.6)'; x.fillRect(0, 0, 10, H); x.fillRect(W - 10, 0, 10, H);         // бетонный бордюр
      crackPaint(x, W, H, 18);
      x.fillStyle = 'rgba(190,140,95,0.32)'; for (let i = 0; i < 24; i++) x.fillRect(Math.random() < 0.5 ? 0 : W - 22, Math.random() * H, 22, 30 + Math.random() * 50);
    });
  }
  let RES_TEX = null;
  function resRoad(x0, z0, x1, z1, w, onTop) {
    if (!RES_TEX) { RES_TEX = resTexture(256, 512, true); RES_TEX.wrapS = RES_TEX.wrapT = THREE.RepeatWrapping; }
    const L = Math.hypot(x1 - x0, z1 - z0), t = RES_TEX.clone(); t.needsUpdate = true; t.repeat.set(1, L / 26);
    const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.93 });
    if (onTop) { mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2; }
    const m = roadStrip(T.x + x0, T.z + z0, T.x + x1, T.z + z1, w, mat, false); if (onTop) m.position.y += 0.012; town.add(m); return m;
  }
  function buildStreets() {
    NS_X.forEach(x => resRoad(x, NS_SPAN[0] - 4, x, NS_SPAN[1] + 4, 8, false));
    EW_Z.forEach(z => { if (z !== -40) resRoad(EW_SPAN[0] - 4, z, EW_SPAN[1] + 4, z, 8, true); });
    // стоп-знаки и таблички на новых перекрёстках с главной
    const stop = textMat([['STOP', 0.42, 0.53]], '#b3241c', '#ffffff', 128, 128, 'sans-serif', { border: '#ffffff' });
    const names = { '-100': 'CACTUS AVE', '46': 'ELM ST', '105': 'OCOTILLO DR', '150': 'SUNSET BLVD' };
    EW_Z.forEach(z => { if (z === -40) return; signPost(-6.2, z - 5.5, Math.PI, stop); signPost(6.2, z + 5.5, 0, stop);
      signPost(-6.4, z + 6.4, Math.PI / 2, textMat([[names[z], 0.6, 0.55]], '#1f5a3a', '#ffffff', 256, 64), 1.6, 0.32, 'box', 3.0); });
    const nsn = ['PALO VERDE RD', 'MESQUITE ST', 'COYOTE LN'];
    NS_X.forEach((x, i) => signPost(x + 5.8, -46, 0, textMat([[nsn[i], 0.6, 0.5]], '#1f5a3a', '#ffffff', 256, 64), 1.6, 0.32, 'box', 3.0));
  }
  // --- дом: одна геометрия с цветами вершин (1 вызов отрисовки на дом)
  const STUCCO = texCanvas(128, 128, (g, w, h) => { g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const v = 170 + Math.random() * 85; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } });
  STUCCO.wrapS = STUCCO.wrapT = THREE.RepeatWrapping;
  const HOUSE_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, map: STUCCO, roughness: 0.86, metalness: 0, side: THREE.DoubleSide });
  const YARD_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, map: STUCCO, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const HC = h => new THREE.Color(h);
  const PALETTES = [
    { wall: '#a9d3bb', trim: '#f4f1e8', roof: '#5a5652', door: '#c8463a' }, { wall: '#e8a990', trim: '#f4efe4', roof: '#6b4a35', door: '#2f5f6a' },
    { wall: '#ecd9a0', trim: '#ffffff', roof: '#4e4a47', door: '#3e6b4c' }, { wall: '#a7c4d9', trim: '#f6f3ea', roof: '#55504c', door: '#d8b03a' },
    { wall: '#ece8de', trim: '#5f7c86', roof: '#8a5a3e', door: '#a83c2e' }, { wall: '#d8c3a0', trim: '#fbf7ee', roof: '#5c4434', door: '#2b4f6e' },
    { wall: '#7fc1b8', trim: '#f7f4ea', roof: '#d9d5cc', door: '#e07a3a' }, { wall: '#e9b8c4', trim: '#ffffff', roof: '#5b5550', door: '#4b6e8a' }
  ];
  function HAcc() { return { P: [], N: [], C: [], U: [] }; }
  function hTri(a, A, B, Cc, col) {
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = Cc[0] - A[0], vy = Cc[1] - A[1], vz = Cc[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const ax = Math.abs(nx), ay = Math.abs(ny);
    for (const p of [A, B, Cc]) { a.P.push(p[0], p[1], p[2]); a.N.push(nx, ny, nz); a.C.push(col.r, col.g, col.b);
      if (ay >= ax && ay >= Math.abs(nz)) a.U.push(p[0] * 0.35, p[2] * 0.35); else if (ax >= Math.abs(nz)) a.U.push(p[2] * 0.35, p[1] * 0.35); else a.U.push(p[0] * 0.35, p[1] * 0.35); }
  }
  const hQuad = (a, A, B, Cc, D, col) => { hTri(a, A, B, Cc, col); hTri(a, A, Cc, D, col); };
  function hBox(a, w, h, d, x, y, z, col, colTop) {
    const x0 = x - w / 2, x1 = x + w / 2, y0 = y, y1 = y + h, z0 = z - d / 2, z1 = z + d / 2;
    hQuad(a, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col); hQuad(a, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col);
    hQuad(a, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col); hQuad(a, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col);
    hQuad(a, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], colTop || col);
  }
  // двускатная крыша: конёк вдоль X (alongZ — вдоль Z), фронтоны цвета стен
  function hGable(a, W, D, x, z, y0, rise, over, roof, wall, alongZ) {
    const P = alongZ ? (u, v, y) => [x + v, y, z + u] : (u, v, y) => [x + u, y, z + v];
    const hu = (alongZ ? D : W) / 2 + over, hv = (alongZ ? W : D) / 2 + over, gu = (alongZ ? D : W) / 2, gv = (alongZ ? W : D) / 2;
    const fl = alongZ ? -1 : 1;
    const q = (A, B, Cc, Dd, c) => fl > 0 ? hQuad(a, A, B, Cc, Dd, c) : hQuad(a, Dd, Cc, B, A, c);
    const t = (A, B, Cc, c) => fl > 0 ? hTri(a, A, B, Cc, c) : hTri(a, Cc, B, A, c);
    q(P(-hu, hv, y0 - 0.05), P(hu, hv, y0 - 0.05), P(hu, 0, y0 + rise), P(-hu, 0, y0 + rise), roof);
    q(P(hu, -hv, y0 - 0.05), P(-hu, -hv, y0 - 0.05), P(-hu, 0, y0 + rise), P(hu, 0, y0 + rise), roof);
    const sh = roof.clone().multiplyScalar(0.55);                                   // нижняя сторона свеса
    q(P(hu, hv, y0 - 0.06), P(-hu, hv, y0 - 0.06), P(-hu, 0, y0 + rise - 0.06), P(hu, 0, y0 + rise - 0.06), sh);
    q(P(-hu, -hv, y0 - 0.06), P(hu, -hv, y0 - 0.06), P(hu, 0, y0 + rise - 0.06), P(-hu, 0, y0 + rise - 0.06), sh);
    const rr = rise * gv / hv;
    t(P(gu, gv, y0), P(gu, -gv, y0), P(gu, 0, y0 + rr), wall); t(P(-gu, -gv, y0), P(-gu, gv, y0), P(-gu, 0, y0 + rr), wall);
  }
  function hHip(a, W, D, x, z, y0, rise, over, roof) {
    const hw = W / 2 + over, hd = D / 2 + over, r = Math.max(0, (W - D) / 2), top = y0 + rise;
    hQuad(a, [x - hw, y0, z + hd], [x + hw, y0, z + hd], [x + r, top, z], [x - r, top, z], roof);
    hQuad(a, [x + hw, y0, z - hd], [x - hw, y0, z - hd], [x - r, top, z], [x + r, top, z], roof);
    hTri(a, [x + hw, y0, z + hd], [x + hw, y0, z - hd], [x + r, top, z], roof); hTri(a, [x - hw, y0, z - hd], [x - hw, y0, z + hd], [x - r, top, z], roof);
    const sh = roof.clone().multiplyScalar(0.55); hQuad(a, [x - hw, y0 - 0.02, z - hd], [x + hw, y0 - 0.02, z - hd], [x + hw, y0 - 0.02, z + hd], [x - hw, y0 - 0.02, z + hd], sh);
  }
  const GLASS = HC('#24323c'), GLASS2 = HC('#3a4d58');
  function hWindow(a, x, y, z, w, h, face, trim, shutters) {     // face: +1 фасад (+Z), -1 тыл, 2 = +X, -2 = -X
    const t = 0.08;
    const put = (bw, bh, bd, ox, oy, col) => {
      if (Math.abs(face) === 1) hBox(a, bw, bh, bd, x + ox, y + oy, z + face * bd / 2, col);
      else hBox(a, bd, bh, bw, x + Math.sign(face) * bd / 2, y + oy, z + ox, col);
    };
    put(w + 0.24, h + 0.24, t, 0, -0.12, trim); put(w, h, t + 0.03, 0, 0, Math.random() < 0.5 ? GLASS : GLASS2);
    put(w + 0.4, 0.1, 0.22, 0, -0.18, trim);
    if (shutters) { const sc = shutters; put(0.42, h, t + 0.02, -(w / 2 + 0.3), 0, sc); put(0.42, h, t + 0.02, w / 2 + 0.3, 0, sc); }
  }
  function buildHouse(seed) {
    const r = rnd(seed * 977 + 13), pal = PALETTES[Math.floor(r() * PALETTES.length)], a = HAcc();
    const wall = HC(pal.wall), trim = HC(pal.trim), roof = HC(pal.roof), door = HC(pal.door), found = HC('#9b958a');
    const stone = HC('#8a7562'), brick = HC('#8e4a38'), shut = r() < 0.5 ? door.clone().multiplyScalar(0.8) : null;
    const style = Math.floor(r() * 4), H = 2.9 + r() * 0.3;
    let solid = [], car = null;                                                         // прямоугольники для коллизии; место машины
    const body = (W, D, x, z, h = H) => { hBox(a, W, 0.35, D, x, 0, z, found); hBox(a, W - 0.04, h, D - 0.04, x, 0.35, z, wall); solid.push([x - W / 2, x + W / 2, z - D / 2, z + D / 2, h + 0.35]); };
    if (style === 0) {                                  // ранчо с двускатной крышей и навесом для машины
      const W = 13 + r() * 3, D = 8.5 + r() * 1.5;
      body(W, D, 0, 0); hGable(a, W, D, 0, 0, H + 0.35, 1.5 + r() * 0.5, 0.6, roof, wall, false);
      const cw = 4.4, cx = W / 2 + cw / 2;                                              // навес
      hBox(a, cw + 0.3, 0.18, D + 1.2, cx, H + 0.2, 0.3, trim, roof); [[-1, 1], [1, 1]].forEach(([sx]) => hBox(a, 0.16, H + 0.2, 0.16, cx + sx * cw / 2, 0, D / 2 + 0.6, trim));
      car = { x: cx, z: 0.3 };
      hWindow(a, -W / 4, 1.45, D / 2, 3.4, 1.5, 1, trim, null);                          // панорамное окно
      hBox(a, 1.0, 2.15, 0.1, W / 10, 0.35, D / 2 + 0.05, door); hBox(a, 1.8, 0.2, 1.4, W / 10, 0, D / 2 + 0.7, found);
      hWindow(a, W / 2 - 1.8, 1.7, D / 2, 1.4, 1.1, 1, trim, shut);
      hWindow(a, -W / 2 + 1.6, 1.7, -D / 2, 1.3, 1.0, -1, trim, null); hWindow(a, W / 6, 1.7, -D / 2, 1.3, 1.0, -1, trim, null);
      hWindow(a, -W / 2, 1.7, 0, 1.3, 1.0, -2, trim, null);
      hBox(a, 0.9, H + 2.6, 0.9, -W / 2 + 1.6, 0.35, -1.2, brick);                       // кирпичная труба
    } else if (style === 1) {                           // шатровая крыша + гараж с фронтоном
      const W = 12 + r() * 2, D = 9 + r();
      body(W, D, 0, 0); hHip(a, W, D, 0, 0, H + 0.35, 1.6, 0.6, roof);
      const gw = 6.2, gd = 7.5, gx = W / 2 + gw / 2 - 0.2, gz = (gd - D) / 2 + 1.2;
      body(gw, gd, gx, gz, H - 0.2); hGable(a, gw, gd, gx, gz, H + 0.15, 1.4, 0.4, roof, wall, true);
      hBox(a, 4.8, 2.2, 0.08, gx, 0.35, gz + gd / 2 + 0.04, trim);                      // ворота гаража
      for (let k = 0; k < 4; k++) hBox(a, 4.82, 0.04, 0.1, gx, 0.35 + 0.55 * k + 0.5, gz + gd / 2 + 0.05, trim.clone().multiplyScalar(0.85));
      car = { x: gx, z: gz + gd / 2 + 3.6, front: true };
      hWindow(a, -W / 4, 1.5, D / 2, 2.6, 1.3, 1, trim, shut); hWindow(a, -W / 2 + 1.4, 1.7, D / 2, 1.0, 1.0, 1, trim, shut);
      hBox(a, 1.0, 2.15, 0.1, W / 8, 0.35, D / 2 + 0.05, door);
      hBox(a, 3.2, 0.12, 1.6, W / 8 - 0.4, H - 0.1, D / 2 + 0.8, roof); hBox(a, 0.12, H - 0.45, 0.12, W / 8 - 1.8, 0.35, D / 2 + 1.5, trim); hBox(a, 3.4, 0.2, 1.8, W / 8 - 0.4, 0, D / 2 + 0.9, found);
      hWindow(a, -W / 4, 1.7, -D / 2, 1.4, 1.0, -1, trim, null); hWindow(a, W / 4, 1.7, -D / 2, 1.4, 1.0, -1, trim, null); hWindow(a, -W / 2, 1.7, 0, 1.2, 1.0, -2, trim, null);
    } else if (style === 2) {                           // модерн середины века: плоская крыша, каменная стенка, навес
      const W = 14 + r() * 3, D = 9 + r(); const roofC = HC('#e6e1d6');
      body(W, D, 0, 0, H - 0.1);
      hBox(a, W + 2.4 + 5, 0.32, D + 2.4, 2.5, H + 0.25, 0, roofC.clone().multiplyScalar(0.92), roofC);   // крыша с большим свесом, продолжается над навесом
      hBox(a, 3.6, H - 0.15, 0.25, -W / 2 + 1.8, 0.35, D / 2 + 0.13, stone);           // стенка из камня
      hBox(a, 0.25, 2.2, 4.0, W / 2 + 4.6, 0, D / 2 - 1.6, trim);                       // перфорированная стенка
      for (let k = 0; k < 4; k++) for (let m = 0; m < 3; m++) hBox(a, 0.28, 0.42, 0.42, W / 2 + 4.6, 0.35 + m * 0.6, D / 2 - 3.1 + k * 1.0, wall.clone().multiplyScalar(0.7));
      hBox(a, 0.16, H + 0.2, 0.16, W / 2 + 4.6, 0, -D / 2 + 0.6, trim);
      car = { x: W / 2 + 2.4, z: 0 };
      hWindow(a, 0.2, 1.2, D / 2, 5.0, 1.9, 1, trim, null);                             // стеклянная стена
      hBox(a, 1.1, 2.25, 0.1, W / 2 - 1.6, 0.35, D / 2 + 0.05, door);
      for (let k = 0; k < 3; k++) hWindow(a, -W / 3 + k * W / 3, 2.3, -D / 2, 1.8, 0.45, -1, trim, null);           // ленточные окна
      hBox(a, W + 1, 0.15, 2.2, 0.5, 0, D / 2 + 1.2, found);
    } else {                                            // двухуровневый (split-level)
      const W1 = 8 + r() * 1.5, W2 = 7, D = 9;
      body(W1, D, -W2 / 2, 0); hGable(a, W1, D, -W2 / 2, 0, H + 0.35, 1.3, 0.55, roof, wall, false);
      const hb = H * 1.85; body(W2, D - 0.5, W1 / 2, -0.25, hb); hGable(a, W2, D - 0.5, W1 / 2, -0.25, hb + 0.35, 1.6, 0.55, roof, wall, true);
      hBox(a, W2 + 0.1, 0.12, D - 0.4, W1 / 2, H * 0.92 + 0.35, -0.25, trim);           // пояс между этажами
      hWindow(a, -W2 / 2 - W1 / 4, 1.5, D / 2, 2.8, 1.3, 1, trim, shut); hBox(a, 1.0, 2.15, 0.1, -W2 / 2 + W1 / 4, 0.35, D / 2 + 0.05, door);
      hWindow(a, W1 / 2, hb - 1.0, D / 2 - 0.25, 2.2, 1.1, 1, trim, shut); hBox(a, 3.6, 2.2, 0.08, W1 / 2, 0.35, D / 2 - 0.2, trim);
      car = { x: W1 / 2, z: D / 2 + 3.8, front: true };
      hWindow(a, -W2 / 2, 1.7, -D / 2, 1.4, 1.0, -1, trim, null); hWindow(a, W1 / 2, hb - 1.0, -D / 2 + 0.25, 1.4, 1.0, -1, trim, null);
    }
    // общая рамка
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, h = 0; solid.forEach(s => { x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[1]); z0 = Math.min(z0, s[2]); z1 = Math.max(z1, s[3]); h = Math.max(h, s[4]); });
    let fx0 = x0, fx1 = x1; for (let i = 0; i < a.P.length; i += 3) { fx0 = Math.min(fx0, a.P[i]); fx1 = Math.max(fx1, a.P[i]); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(a.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(a.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(a.C, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(a.U, 2));
    g.computeBoundingSphere();
    return { geo: g, box: { x0, x1, z0, z1, h: h + 2.2 }, full: { x0: fx0 - 0.6, x1: fx1 + 0.6 }, car, depth: z1 - z0 };
  }
  // --- двор: газон/гравий, подъездная дорожка, тропинка — всё в одну геометрию на город
  const yard = HAcc();
  function yardRect(cx, cz, w, d, ry, col, y) {
    const c = Math.cos(ry), s = Math.sin(ry), P = (u, v) => [T.x + cx + u * c + v * s, T.h + y, T.z + cz - u * s + v * c];
    hQuad(yard, P(-w / 2, d / 2), P(w / 2, d / 2), P(w / 2, -d / 2), P(-w / 2, -d / 2), col);
  }
  const placedHouses = [];
  function overlapsSomething(cx, cz, hw, hd, ry, margin) {
    // прямоугольник дома в мировых XZ (через описанный AABB с небольшим допуском) против дорог, существующих коробок и других домов
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), ex = hw * c + hd * s + margin, ez = hw * s + hd * c + margin;
    if (cx - ex < PADR.x0 || cx + ex > PADR.x1 || cz - ez < PADR.z0 || cz + ez > PADR.z1) return true;
    for (const R of ROADS) if (cx + ex > R.x0 && cx - ex < R.x1 && cz + ez > R.z0 && cz - ez < R.z1) return true;
    const wx = T.x + cx, wz = T.z + cz;
    for (const b of MAP.boxes) { const bc = Math.abs(Math.cos(b.rot)), bs = Math.abs(Math.sin(b.rot)), bx = b.hw * bc + b.hd * bs, bz = b.hw * bs + b.hd * bc;
      if (Math.abs(wx - b.x) < ex + bx && Math.abs(wz - b.z) < ez + bz) return true; }
    return false;
  }
  let houseSeed = 1;
  function tryHouse(cx, cz, ry, frontDist) {
    const H = buildHouse(houseSeed++);
    // дом ставим так, чтобы фасад был на frontDist от оси улицы: сдвиг центра по направлению «от улицы»
    const midX = (H.full.x0 + H.full.x1) / 2, midZ = (H.box.z0 + H.box.z1) / 2, hw = (H.full.x1 - H.full.x0) / 2, hd = (H.box.z1 - H.box.z0) / 2;
    const fx = Math.sin(ry), fz = Math.cos(ry);                                   // направление фасада (к улице)
    const px = cx - fx * (frontDist + hd) , pz = cz - fz * (frontDist + hd);        // центр рамки дома
    const lx = midX, lz = midZ;                                                   // локальный центр рамки → смещение начала
    const ox = px - (lx * Math.cos(ry) + lz * Math.sin(ry)), oz = pz - (-lx * Math.sin(ry) + lz * Math.cos(ry));
    if (overlapsSomething(px, pz, hw, hd + 0.8, ry, 0.8)) { houseSeed--; return false; }
    const root = new THREE.Group(); root.position.copy(WP(ox, oz, -0.02)); root.rotation.y = ry;
    const m = new THREE.Mesh(H.geo, HOUSE_MAT); m.castShadow = true; m.receiveShadow = true; root.add(m); town.add(root);
    const b = H.box, bcx = (b.x0 + b.x1) / 2, bcz = (b.z0 + b.z1) / 2;
    addStatic(root, (b.x1 - b.x0) / 2 + 0.15, (b.z1 - b.z0) / 2 + 0.15, b.h, ry, bcx, bcz, 'house');
    placedHouses.push(root);
    // двор: от бордюра до задней стены + 3 м
    const lawn = Math.random() < 0.55 ? HC('#8c9455') : (Math.random() < 0.5 ? HC('#b39a76') : HC('#9a8a62'));
    const W = (H.full.x1 - H.full.x0) + 5, depth = frontDist + 2 * hd + 3 - 4.6;
    yardRect(cx - fx * (4.6 + depth / 2), cz - fz * (4.6 + depth / 2), W, depth, ry, lawn, 0.035);
    if (H.car) {
      const cw = Math.cos(ry), sw = Math.sin(ry), carX = ox + H.car.x * cw + H.car.z * sw, carZ = oz - H.car.x * sw + H.car.z * cw;
      const dist = (cx - carX) * fx + (cz - carZ) * fz - 4.4;                      // от машины до бордюра
      if (dist > 0.5) yardRect(carX + fx * (dist / 2 - 1), carZ + fz * (dist / 2 - 1), 3.2, dist + 2, ry, HC('#b9b2a4'), 0.05);
      if (Math.random() < 0.45) car(carX, carZ, ry - Math.PI / 2, 'pickup');
    }
    return true;
  }
  function buildResidential() {
    const FRONT = 9.5, STEP = 19.5;
    // вдоль параллельных улиц: обе стороны
    NS_X.forEach(x => [-1, 1].forEach(side => {
      const ry = side > 0 ? -Math.PI / 2 : Math.PI / 2;                       // фасадом к улице
      for (let i = 0; i < EW_Z.length - 1; i++) {
        const a = EW_Z[i] + 12.5, b = EW_Z[i + 1] - 12.5; if (b < a) continue;
        const n = Math.max(1, Math.floor((b - a) / STEP) + 1), st = n > 1 ? (b - a) / (n - 1) : 0;
        for (let k = 0; k < n; k++) tryHouse(x, n > 1 ? a + k * st : (a + b) / 2, ry, FRONT);
      }
    }));
    // вдоль перпендикулярных улиц: участки между параллельными улицами (кроме торговой части у главной)
    const XS = [EW_SPAN[0], ...NS_X, 0].sort((p, q) => p - q);
    EW_Z.forEach(z => [-1, 1].forEach(side => {
      const ry = side > 0 ? Math.PI : 0;
      for (let i = 0; i < XS.length - 1; i++) {
        const a = XS[i] + 13, b = XS[i + 1] - 13; if (b < a) continue;
        const n = Math.max(1, Math.floor((b - a) / STEP) + 1), st = n > 1 ? (b - a) / (n - 1) : 0;
        for (let k = 0; k < n; k++) { const cx = n > 1 ? a + k * st : (a + b) / 2; if (Math.abs(cx) < 30) continue; tryHouse(cx, z, ry, FRONT); }
      }
    }));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(yard.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(yard.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(yard.C, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(yard.U, 2));
    const ym = new THREE.Mesh(g, YARD_MAT); ym.receiveShadow = true; town.add(ym);
    MAP.houses = placedHouses.length;
  }
  // дальние машины не рисуем (их и так не видно), проверка раз в 10 кадров
  let carCullN = 0;
  function cullCars() {
    if ((carCullN++ % 10) !== 0) return;
    const cp = camera.position;
    for (const c of carObjs) { const d = (c.position.x - cp.x) ** 2 + (c.position.z - cp.z) ** 2; c.visible = d < 260 * 260; }
  }

  try {
    new THREE.GLTFLoader().parse(b64ToArrayBuffer(window.TOWN_KIT_GLB_B64), '', gltf => {
      const done = new Set();
      gltf.scene.traverse(o => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => {
          if (done.has(m)) return; done.add(m);
          if (m.color) m.color.convertLinearToSRGB();
          if (m.emissive) m.emissive.convertLinearToSRGB();
          ['map', 'emissiveMap'].forEach(k => { if (m[k]) { m[k].encoding = THREE.LinearEncoding; m[k].needsUpdate = true; } });
          if (m.color && /Brick|Trim|Concrete|Metal/.test(m.name)) m.color.lerp(new THREE.Color(0xd9b08a), 0.18);   // пыль
          if (/Glass/.test(m.name)) { m.depthWrite = false; m.opacity = Math.max(m.opacity, 0.55); }
          m.needsUpdate = true;
        });
      });
      gltf.scene.children.forEach(n => { KIT[n.name] = n; });
      buildTown();
      loadPickups().then(() => {
        try { buildDetails(LAST_ROOTS); } catch (e) { console.error('town details', e); }
        try { buildStreets(); buildResidential(); } catch (e) { console.error('residential', e); }
        MAP.townReady = true;
      });
    }, err => console.error('town kit load error', err));
  } catch (e) { console.error('town', e); }
})();
