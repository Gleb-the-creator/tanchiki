// =============================================================================
// ТАНЧИКИ — командный бой 3×3 в стиле World of Tanks
// Команда Т-80БВМ против команды Centauro II; игрок выбирает команду и поле.
// Подбитый игрок пересаживается на следующий танк своей команды.
// Подключается после index.html, plants.js и скриптов карты (window.MAP).
// =============================================================================
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 0. НАСТРОЙКИ
  // ---------------------------------------------------------------------------
  const CFG = {
    roundTime: 420, countdown: 3, teamSize: 3, aiError: 0.003,
    camDist: 13, camDistMin: 6, camDistMax: 28, maxAimDist: 700,
    types: {
      t80: {
        name: 'Т-80БВМ', country: 'Россия', gun: '125 мм', hp: 1700, dmg: [320, 480], reload: 6.5, shellSpeed: 135,
        maxSpeed: 14, revSpeed: 6, accel: 4.5, turnRate: 0.62, pivot: true, traverse: 42, elev: 16, pitchMin: -5, pitchMax: 14,
        halfL: 3.3, halfW: 1.6, radius: 2.3, camH: 2.9, aimH: 1.25, labelH: 4.4, lampY: 1.35, lampZ: 3.4, mgDmg: 0,
        armor: { frontHull: 0.28, frontTurret: 0.38, side: 0.08 },
        disp: { base: 0.0032, move: 0.0016, hullTurn: 0.020, turret: 0.0004, shot: 0.016, aimRate: 1.15 }
      },
      challenger: { name: 'Challenger 1 Mk.3', country: 'Великобритания', gun: '120 мм', hp: 1950, dmg: [310, 470], reload: 7.0, shellSpeed: 135, maxSpeed: 15.5, revSpeed: 7, accel: 4.0, turnRate: 0.55, pivot: true, traverse: 36, elev: 14,
        pitchMin: -10, pitchMax: 20, halfL: 4.3, halfW: 1.85, radius: 2.6, camH: 3.3, aimH: 1.4, labelH: 4.8, lampY: 1.4, lampZ: 4.3, mgDmg: 4,
        armor: { frontHull: 0.32, frontTurret: 0.45, side: 0.1 }, disp: { base: 0.0032, move: 0.0016, hullTurn: 0.020, turret: 0.0004, shot: 0.016, aimRate: 1.15 } },
      leopard: { name: 'Leopard 2A7HU', country: 'Германия', gun: '120 мм', hp: 1800, dmg: [330, 480], reload: 6.2, shellSpeed: 150, maxSpeed: 19, revSpeed: 9, accel: 5.0, turnRate: 0.6, pivot: true, traverse: 40, elev: 15,
        pitchMin: -9, pitchMax: 20, halfL: 4.0, halfW: 1.85, radius: 2.5, camH: 3.3, aimH: 1.4, labelH: 4.8, lampY: 1.4, lampZ: 4.0, mgDmg: 4,
        armor: { frontHull: 0.3, frontTurret: 0.42, side: 0.1 }, disp: { base: 0.0032, move: 0.0016, hullTurn: 0.020, turret: 0.0004, shot: 0.016, aimRate: 1.15 } },
      type10: { name: 'Type 10', country: 'Япония', gun: '120 мм', hp: 1550, dmg: [300, 440], reload: 5.6, shellSpeed: 145, maxSpeed: 19.5, revSpeed: 10, accel: 6.0, turnRate: 0.7, pivot: true, traverse: 45, elev: 16,
        pitchMin: -7, pitchMax: 15, halfL: 3.6, halfW: 1.6, radius: 2.3, camH: 3.0, aimH: 1.2, labelH: 4.3, lampY: 1.2, lampZ: 3.7, mgDmg: 4,
        armor: { frontHull: 0.24, frontTurret: 0.34, side: 0.07 }, disp: { base: 0.0032, move: 0.0016, hullTurn: 0.020, turret: 0.0004, shot: 0.016, aimRate: 1.15 } },
      abrams: { name: 'M1A1 Abrams', country: 'США', gun: '120 мм', hp: 1850, dmg: [300, 450], reload: 6.0, shellSpeed: 140, maxSpeed: 18.5, revSpeed: 9, accel: 5, turnRate: 0.6, pivot: true, traverse: 40, elev: 14,
        pitchMin: -9, pitchMax: 18, halfL: 3.95, halfW: 1.85, radius: 2.5, camH: 3.2, aimH: 1.4, labelH: 4.7, lampY: 1.45, lampZ: 4.1, mgDmg: 4,
        armor: { frontHull: 0.3, frontTurret: 0.42, side: 0.1 }, disp: { base: 0.0032, move: 0.0016, hullTurn: 0.020, turret: 0.0004, shot: 0.016, aimRate: 1.15 } },
      cent: {
        name: 'Centauro II', country: 'Италия', gun: '120 мм', hp: 1450, dmg: [270, 410], reload: 7.0, shellSpeed: 140,
        maxSpeed: 19, revSpeed: 8, accel: 5.5, turnRate: 0.62, pivot: false, traverse: 34, elev: 12, pitchMin: -8, pitchMax: 17,
        halfL: 3.6, halfW: 1.5, radius: 2.4, camH: 3.9, aimH: 1.8, labelH: 6.3, lampY: 1.7, lampZ: 3.9, mgDmg: 4,
        armor: { frontHull: 0.10, frontTurret: 0.10, side: 0 },
        disp: { base: 0.0034, move: 0.0013, hullTurn: 0.016, turret: 0.0004, shot: 0.016, aimRate: 1.1 }
      }
    }
  };

  const V3 = THREE.Vector3;
  const tmpV = new V3(), tmpV2 = new V3(), tmpV3 = new V3();
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrapPI = a => Math.atan2(Math.sin(a), Math.cos(a));
  const FIELD = RANGE_HALF - 30;

  // ---------------------------------------------------------------------------
  // 1. СОСТОЯНИЕ
  // ---------------------------------------------------------------------------
  const G = {
    phase: 'loading',            // loading | menu | countdown | battle | over
    timeLeft: CFG.roundTime, countdownLeft: CFG.countdown,
    camYaw: 0, camPitch: 0.06, camDist: CFG.camDist, sniper: false, sniperZoom: 4, locked: false,
    aimPoint: new V3(0, 1, 60), aimDist: 60, disp: 0.01, shake: 0, lampOn: false, switchT: 0,
    PL: null,                    // танк под управлением игрока
    playerTeam: 0,               // 0 — Т-80БВМ, 1 — Centauro II
    result: null, wreckFires: [],
    stats: { shots: 0, hits: 0, pens: 0, dmgDealt: 0, dmgTaken: 0, kills: 0, lost: 0 }
  };
  // игрок всегда в команде 0 (стартует с южной базы); выбирается ТИП танка, противник — случайный из двух других
  G.tank = 't80'; try { const t = localStorage.getItem('tanchiki.tank'); if (CFG.types[t]) G.tank = t; } catch (e) { }

  // ---------------------------------------------------------------------------
  // 2. ЗВУК (синтез WebAudio, без файлов)
  // ---------------------------------------------------------------------------
  let audioCtx = null, noiseBuf = null;
  function initAudio() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { audioCtx = null; }
  }
  function boom(volume = 1, freq = 600, dur = 0.9) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const src = audioCtx.createBufferSource(); src.buffer = noiseBuf;
    const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(freq, t); lp.frequency.exponentialRampToValueAtTime(60, t + dur);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(clamp(volume, 0.01, 1), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(lp); lp.connect(g); g.connect(audioCtx.destination);
    src.start(t); src.stop(t + dur + 0.05);
  }
  function ping(freq = 1800, dur = 0.25, vol = 0.25) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
    const g = audioCtx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + dur);
  }
  const volByDist = d => clamp(1.0 - d / 600, 0.08, 1);

  // ---------------------------------------------------------------------------
  // 3. HUD (собственный, поверх сцены)
  // ---------------------------------------------------------------------------
  const css = `
  #bt-root{position:fixed;inset:0;z-index:40;pointer-events:none;font-family:'Rajdhani',sans-serif;color:#e7eadf}
  #bt-root .mono{font-family:'JetBrains Mono',monospace}
  #bt-top{position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:18px;
    background:rgba(10,14,11,.78);border:1px solid rgba(160,180,140,.25);padding:8px 16px;border-radius:6px}
  .bt-side{display:flex;flex-direction:column;gap:3px;width:230px}
  .bt-side .nm{font-weight:700;font-size:15px;letter-spacing:.5px}
  .bt-hpbar{height:10px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;position:relative}
  .bt-hpbar>div{height:100%;transition:width .35s}
  .bt-hpbar>.lag{position:absolute;inset:0 auto 0 0;background:rgba(255,255,255,.35);transition:width 1.2s .3s}
  .bt-hptext{font-size:12px;opacity:.85}
  #bt-timer{font-size:26px;font-weight:700;min-width:80px;text-align:center}
  #bt-cross{position:absolute;left:50%;top:50%;width:26px;height:26px;transform:translate(-50%,-50%)}
  #bt-cross:before,#bt-cross:after{content:'';position:absolute;background:rgba(255,255,255,.75)}
  #bt-cross:before{left:12px;top:0;width:2px;height:26px;clip-path:polygon(0 0,100% 0,100% 35%,0 35%,0 65%,100% 65%,100% 100%,0 100%)}
  #bt-cross:after{top:12px;left:0;height:2px;width:26px;clip-path:polygon(0 0,35% 0,35% 100%,0 100%,0 0,65% 0,100% 0,100% 100%,65% 100%,65% 0)}
  #bt-marker{position:absolute;border:2px solid rgba(120,255,140,.9);border-radius:50%;transform:translate(-50%,-50%);
    box-shadow:0 0 6px rgba(0,0,0,.8);transition:border-color .15s}
  #bt-marker.reload{border-color:rgba(255,90,70,.9)}
  #bt-marker .dot{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;background:#fff;border-radius:50%}
  #bt-reload-ring{position:absolute;left:50%;top:50%;transform:translate(-50%,40px);font-size:13px;font-weight:700;
    text-shadow:0 1px 3px #000}
  #bt-player{position:absolute;left:14px;bottom:14px;width:300px;background:rgba(10,14,11,.8);
    border:1px solid rgba(160,180,140,.25);border-radius:6px;padding:10px 12px}
  #bt-player .big{font-size:22px;font-weight:700}
  #bt-reloadbar{height:6px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;margin-top:6px}
  #bt-reloadbar>div{height:100%;background:#f59e0b}
  #bt-log{position:absolute;left:14px;bottom:150px;width:320px;display:flex;flex-direction:column-reverse;gap:2px;font-size:14px}
  #bt-log div{background:rgba(0,0,0,.55);padding:2px 8px;border-left:3px solid #888;animation:btfade 6s forwards}
  @keyframes btfade{0%{opacity:0;transform:translateX(-10px)}5%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0}}
  #bt-minimap{position:absolute;right:14px;bottom:14px;width:290px;height:290px;background:rgba(14,20,15,.9);
    border:2px solid rgba(190,205,170,.55);border-radius:5px;box-shadow:0 4px 18px rgba(0,0,0,.55);transition:width .15s,height .15s}
  #bt-minimap.big{width:min(72vh,640px);height:min(72vh,640px)}
  #bt-elabel{position:absolute;transform:translate(-50%,-100%);text-align:center;white-space:nowrap;display:none}
  #bt-elabel .nm{color:#ff6b5a;font-weight:700;font-size:14px;text-shadow:0 1px 3px #000}
  #bt-elabel .bar{width:90px;height:5px;background:rgba(0,0,0,.6);margin:2px auto 0;border:1px solid rgba(0,0,0,.6)}
  #bt-elabel .bar>div{height:100%;background:#ff4d3a}
  #bt-elabel .dist{font-size:11px;opacity:.8}
  #bt-earrow{position:absolute;width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;
    border-bottom:22px solid #ff4d3a;display:none;filter:drop-shadow(0 0 3px #000)}
  #bt-msg{position:absolute;left:50%;top:32%;transform:translateX(-50%);font-size:30px;font-weight:700;
    text-shadow:0 2px 6px #000;letter-spacing:1px;opacity:0;transition:opacity .2s}
  #bt-flash{position:absolute;inset:0;box-shadow:inset 0 0 160px rgba(255,0,0,.0);transition:box-shadow .6s}
  #bt-dirhit{position:absolute;left:50%;top:50%;width:220px;height:220px;margin:-110px 0 0 -110px;opacity:0;transition:opacity 1.2s}
  #bt-dirhit:before{content:'';position:absolute;left:50%;top:0;width:60px;height:18px;margin-left:-30px;
    background:radial-gradient(ellipse at 50% 0,rgba(255,40,30,.9),rgba(255,40,30,0) 70%)}
  #bt-sniper{position:absolute;inset:0;display:none;
    background:radial-gradient(circle at 50% 50%,transparent 0,transparent 38vh,rgba(0,0,0,.92) 38.3vh)}
  #bt-sniper .h,#bt-sniper .v{position:absolute;background:rgba(0,0,0,.85)}
  #bt-sniper .h{left:calc(50% - 38vh);right:calc(50% - 38vh);top:50%;height:1px}
  #bt-sniper .v{top:12vh;bottom:12vh;left:50%;width:1px}
  #bt-sniper .zoom{position:absolute;left:50%;top:calc(50% + 30vh);transform:translateX(-50%);font-size:14px;color:#9fe39f}
  .bt-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:auto;
    background:radial-gradient(circle,rgba(8,12,9,.72),rgba(4,6,5,.94))}
  .bt-card{background:rgba(16,22,17,.95);border:1px solid rgba(180,200,150,.3);border-radius:8px;padding:26px 34px;
    max-width:900px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.7)}
  .bt-card h1{margin:0;font-size:40px;letter-spacing:2px}
  .bt-card h2{margin:4px 0 16px;font-size:18px;font-weight:600;opacity:.75}
  .bt-vs{display:flex;justify-content:center;align-items:center;gap:22px;margin:14px 0}
  .bt-vs .t{padding:8px 14px;border-radius:5px;min-width:180px}
  .bt-keys{display:grid;grid-template-columns:auto auto;gap:4px 18px;text-align:left;font-size:15px;margin:16px auto;width:max-content}
  .bt-keys b{color:#f5b84a;font-family:'JetBrains Mono',monospace;font-size:13px}
  .bt-btn{margin-top:10px;padding:12px 44px;font-size:22px;font-weight:700;letter-spacing:2px;color:#111;cursor:pointer;
    background:linear-gradient(#ffcf5a,#e99a1a);border:0;border-radius:5px;font-family:'Rajdhani',sans-serif}
  .bt-btn:hover{filter:brightness(1.1)}
  .bt-btn:disabled{filter:grayscale(1);opacity:.6;cursor:wait}
  #bt-count{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);font-size:110px;font-weight:700;
    text-shadow:0 4px 18px #000;display:none}
  #bt-lockhint{position:absolute;left:50%;bottom:90px;transform:translateX(-50%);background:rgba(0,0,0,.7);
    padding:6px 14px;border-radius:4px;font-size:15px;display:none}
  .bt-menu-btns{display:flex;flex-direction:column;gap:10px;align-items:center;margin-top:14px}
  .bt-btn2{padding:10px 30px;min-width:300px;font-size:19px;font-weight:700;letter-spacing:1.5px;color:#e7eadf;cursor:pointer;
    background:rgba(255,255,255,.06);border:1px solid rgba(180,200,150,.35);border-radius:5px;font-family:'Rajdhani',sans-serif}
  .bt-btn2:hover{background:rgba(245,184,74,.18);border-color:#f5b84a}
  .bt-menu-btns .bt-btn{min-width:300px;margin-top:0}
  #bt-controls .bt-card{max-height:92vh;overflow:auto;max-width:760px;text-align:left}
  #bt-controls h1{text-align:center}
  .bt-sec{font-size:13px;letter-spacing:2px;color:#9fb894;margin:18px 0 6px;text-transform:uppercase;border-bottom:1px solid rgba(180,200,150,.2);padding-bottom:3px}
  .bt-bind{display:grid;grid-template-columns:1fr 150px 150px;gap:6px 10px;align-items:center;font-size:16px}
  .bt-bind .hd{font-size:12px;opacity:.55;text-align:center}
  .bt-key{padding:5px 8px;font-family:'JetBrains Mono',monospace;font-size:13px;color:#f5b84a;background:rgba(0,0,0,.35);
    border:1px solid rgba(180,200,150,.3);border-radius:4px;cursor:pointer;text-align:center;min-height:28px}
  .bt-key:hover{border-color:#f5b84a}
  .bt-key.empty{color:rgba(255,255,255,.3)}
  .bt-key.wait{background:#f5b84a;color:#111;animation:btpulse 1s infinite}
  .bt-key.fixed{cursor:default;color:#cbd5e1;opacity:.8}
  .bt-key.fixed:hover{border-color:rgba(180,200,150,.3)}
  @keyframes btpulse{50%{filter:brightness(.75)}}
  #bt-bind-hint{min-height:22px;margin-top:8px;font-size:14px;color:#f5b84a;text-align:center}
  .bt-row{display:flex;align-items:center;gap:12px;font-size:16px;margin:6px 0}
  .bt-row input[type=range]{flex:1;accent-color:#f5b84a}
  .bt-info{font-size:14.5px;line-height:1.45;opacity:.85}
  .bt-info li{margin:2px 0}
  .bt-ctrl-foot{display:flex;justify-content:space-between;gap:10px;margin-top:20px}
  .bt-pips{display:flex;gap:5px;margin:3px 0}
  .bt-pip{flex:1;height:10px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden}
  .bt-pip>div{height:100%;transition:width .35s}
  .bt-pip.dead{background:rgba(0,0,0,.55);opacity:.45}
  .bt-pip.me{outline:1.5px solid #fff}
  .bt-ulabel{position:absolute;transform:translate(-50%,-100%);text-align:center;white-space:nowrap;display:none;pointer-events:none}
  .bt-ulabel .nm{color:#ff6b5a;font-weight:700;font-size:13px;text-shadow:0 1px 3px #000}
  .bt-ulabel .bar{width:80px;height:5px;background:rgba(0,0,0,.6);margin:2px auto 0;border:1px solid rgba(0,0,0,.6)}
  .bt-ulabel .bar>div{height:100%;background:#ff4d3a}
  .bt-ulabel .dist{font-size:11px;opacity:.8}
  .bt-ulabel.ally{opacity:.85}.bt-ulabel.ally .nm{color:#7dff8a}.bt-ulabel.ally .bar>div{background:#4ade80}
  .bt-step{font-size:12px;letter-spacing:2px;color:#9fb894;margin:14px 0 6px;text-transform:uppercase}
  .bt-grid{display:grid!important;grid-template-columns:repeat(3,1fr);gap:12px!important}
  .bt-pick .cty{font-size:13px;color:#e8d9a8;margin:2px 0 4px;letter-spacing:.5px}
  .bt-pick{cursor:pointer;min-width:0;border:2px solid rgba(240,84,64,.45)!important;background:rgba(240,84,64,.08);transition:.15s}
  .bt-pick .tn{font-size:22px;font-weight:700;color:#ff6b5a}
  .bt-pick .tag{font-size:11px;letter-spacing:2px;margin-top:4px;color:#ff6b5a}
  .bt-pick.mine{border-color:#4ade80!important;background:rgba(74,222,128,.14)}
  .bt-pick.mine .tn,.bt-pick.mine .tag{color:#7dff8a}
  .bt-pick:hover,.bt-map:hover{filter:brightness(1.2)}
  .bt-map{cursor:pointer;border:2px solid rgba(180,200,150,.25);background:rgba(255,255,255,.04);padding:8px 12px;border-radius:5px;min-width:190px;flex:1;transition:.15s}
  .bt-map.cur{border-color:#f5b84a;background:rgba(245,184,74,.12)}
  .bt-map .tn{font-size:18px;font-weight:700}.bt-map.cur .tn{color:#f5b84a}
  .bt-map .ts{font-size:12px;opacity:.7}
  .bt-stats{display:grid;grid-template-columns:1fr auto;gap:4px 30px;text-align:left;font-size:16px;margin:16px auto;width:max-content}
  .bt-stats span:nth-child(even){font-family:'JetBrains Mono',monospace;color:#f5b84a}
  `;
  const styleEl = document.createElement('style'); styleEl.textContent = css; document.head.appendChild(styleEl);

  const root = document.createElement('div'); root.id = 'bt-root';
  root.innerHTML = `
    <div id="bt-flash"></div>
    <div id="bt-dirhit"></div>
    <div id="bt-sniper"><div class="h"></div><div class="v"></div><div class="zoom mono" id="bt-zoom">4x</div></div>
    <div id="bt-top">
      <div class="bt-side" id="bt-t0"><div class="nm"></div><div class="bt-pips"></div><div class="bt-hptext mono">танков: <span id="bt-t0-n"></span></div></div>
      <div id="bt-timer" class="mono">7:00</div>
      <div class="bt-side" id="bt-t1" style="text-align:right"><div class="nm"></div><div class="bt-pips"></div><div class="bt-hptext mono">танков: <span id="bt-t1-n"></span></div></div>
    </div>
    <div id="bt-cross"></div>
    <div id="bt-marker"><div class="dot"></div></div>
    <div id="bt-reload-ring" class="mono"></div>
    <div id="bt-earrow"></div>
    <div id="bt-msg"></div>
    <div id="bt-log"></div>
    <div id="bt-player">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <span class="big" id="bt-pname" style="color:#7dff8a"></span>
        <span class="mono" id="bt-speed">0 км/ч</span>
      </div>
      <div class="bt-hpbar" style="height:14px;margin-top:4px"><div id="bt-php2" style="width:100%;background:#4ade80"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:14px;margin-top:4px">
        <span class="mono" id="bt-php2-t"></span>
        <span id="bt-reload-t" class="mono">125 мм: ГОТОВ</span>
      </div>
      <div id="bt-reloadbar"><div id="bt-reloadbar-f" style="width:100%"></div></div>
    </div>
    <canvas id="bt-minimap" width="640" height="640"></canvas>
    <div id="bt-count"></div>
    <div id="bt-lockhint">Кликните по экрану, чтобы управлять мышью</div>

    <div class="bt-overlay" id="bt-start">
      <div class="bt-card">
        <h1>ТАНЧИКИ</h1>
        <h2>Командный бой 3 × 3</h2>
        <div id="bt-step1">
          <div class="bt-step">Шаг 1 из 2 · Выберите танк</div>
          <div class="bt-vs bt-grid">
            <div class="t bt-pick" data-tank="t80">
              <div class="tn">${CFG.types.t80.name}</div>
              <div class="cty">Производитель: ${CFG.types.t80.country}</div>
              <div class="mono" style="font-size:12px;opacity:.8">${CFG.types.t80.hp} HP · ${CFG.types.t80.gun} · урон ${CFG.types.t80.dmg[0]}–${CFG.types.t80.dmg[1]} · ${Math.round(CFG.types.t80.maxSpeed * 3.6)} км/ч</div>
              <div class="mono" style="font-size:11px;opacity:.6">крепкая броня, разворот на месте</div>
              <div class="tag"></div>
            </div>
            <div class="t bt-pick" data-tank="cent">
              <div class="tn">${CFG.types.cent.name}</div>
              <div class="cty">Производитель: ${CFG.types.cent.country}</div>
              <div class="mono" style="font-size:12px;opacity:.8">${CFG.types.cent.hp} HP · ${CFG.types.cent.gun} · урон ${CFG.types.cent.dmg[0]}–${CFG.types.cent.dmg[1]} · ${Math.round(CFG.types.cent.maxSpeed * 3.6)} км/ч</div>
              <div class="mono" style="font-size:11px;opacity:.6">быстрый, тонкая броня, колёсный</div>
              <div class="tag"></div>
            </div>
            <div class="t bt-pick" data-tank="abrams">
              <div class="tn">${CFG.types.abrams.name}</div>
              <div class="cty">Производитель: ${CFG.types.abrams.country}</div>
              <div class="mono" style="font-size:12px;opacity:.8">${CFG.types.abrams.hp} HP · ${CFG.types.abrams.gun} · урон ${CFG.types.abrams.dmg[0]}–${CFG.types.abrams.dmg[1]} · ${Math.round(CFG.types.abrams.maxSpeed * 3.6)} км/ч</div>
              <div class="mono" style="font-size:11px;opacity:.6">живучий, тяжёлый, быстрый</div>
              <div class="tag"></div>
            </div>
            <div class="t bt-pick" data-tank="challenger">
              <div class="tn">${CFG.types.challenger.name}</div>
              <div class="cty">Производитель: ${CFG.types.challenger.country}</div>
              <div class="mono" style="font-size:12px;opacity:.8">${CFG.types.challenger.hp} HP · ${CFG.types.challenger.gun} · урон ${CFG.types.challenger.dmg[0]}–${CFG.types.challenger.dmg[1]} · ${Math.round(CFG.types.challenger.maxSpeed * 3.6)} км/ч</div>
              <div class="mono" style="font-size:11px;opacity:.6">нарезная пушка, толстая броня, медленный</div>
              <div class="tag"></div>
            </div>
            <div class="t bt-pick" data-tank="leopard">
              <div class="tn">${CFG.types.leopard.name}</div>
              <div class="cty">Производитель: ${CFG.types.leopard.country}</div>
              <div class="mono" style="font-size:12px;opacity:.8">${CFG.types.leopard.hp} HP · ${CFG.types.leopard.gun} · урон ${CFG.types.leopard.dmg[0]}–${CFG.types.leopard.dmg[1]} · ${Math.round(CFG.types.leopard.maxSpeed * 3.6)} км/ч</div>
              <div class="mono" style="font-size:11px;opacity:.6">точная длинная пушка, быстрый</div>
              <div class="tag"></div>
            </div>
            <div class="t bt-pick" data-tank="type10">
              <div class="tn">${CFG.types.type10.name}</div>
              <div class="cty">Производитель: ${CFG.types.type10.country}</div>
              <div class="mono" style="font-size:12px;opacity:.8">${CFG.types.type10.hp} HP · ${CFG.types.type10.gun} · урон ${CFG.types.type10.dmg[0]}–${CFG.types.type10.dmg[1]} · ${Math.round(CFG.types.type10.maxSpeed * 3.6)} км/ч</div>
              <div class="mono" style="font-size:11px;opacity:.6">лёгкий и манёвренный, быстрая перезарядка</div>
              <div class="tag"></div>
            </div>
          </div>
          <div style="font-size:14px;opacity:.75;margin-top:10px">Ваша команда — три таких танка. Противник — три случайных танка другого типа (из пяти оставшихся).</div>
          <div class="bt-menu-btns"><button class="bt-btn" id="bt-next">ДАЛЕЕ: ВЫБОР КАРТЫ</button><button class="bt-btn2" data-open-controls>УПРАВЛЕНИЕ</button></div>
        </div>
        <div id="bt-step2" style="display:none">
          <div class="bt-step">Шаг 2 из 2 · Выберите карту</div>
          <div class="bt-vs">
          <div class="bt-map" data-map="arizona"><div class="tn">Arizona Base Field</div><div class="ts">скалы, каньон, городок Red Mesa</div></div>
          <div class="bt-map" data-map="montana"><div class="tn">Montana Big Sky Valley</div><div class="ts">река, леса, поля, горы, ранчо и мост</div></div>
          <div class="bt-map" data-map="training"><div class="tn">Training Field</div><div class="ts">танкодром: препятствия, холмы, станция, цистерны</div></div>
          </div>
          <div id="bt-vsline" style="font-size:16px;margin-top:12px"></div>
        <div style="font-size:14px;opacity:.75;max-width:540px;margin:12px auto 0">
          Если ваш танк подбит — вы пересаживаетесь на следующий танк своей команды. Побеждает команда, уничтожившая всех противников.
          Esc в бою — меню и пауза.
        </div>
        <div class="bt-menu-btns">
          <button class="bt-btn" id="bt-go" disabled>ЗАГРУЗКА…</button>
          <button class="bt-btn2" id="bt-back">НАЗАД: ВЫБОР ТАНКА</button>
        </div>
        </div>
      </div>
    </div>
    <div class="bt-overlay" id="bt-end" style="display:none">
      <div class="bt-card">
        <h1 id="bt-end-title">ПОБЕДА</h1>
        <h2 id="bt-end-sub"></h2>
        <div class="bt-stats" id="bt-end-stats"></div>
        <div class="bt-menu-btns">
          <button class="bt-btn" id="bt-again">ЕЩЁ БОЙ</button>
          <button class="bt-btn2" data-main-menu>ГЛАВНОЕ МЕНЮ</button>
        </div>
      </div>
    </div>
    <div class="bt-overlay" id="bt-pause" style="display:none">
      <div class="bt-card">
        <h1>ПАУЗА</h1>
        <h2>Бой остановлен</h2>
        <div class="bt-menu-btns">
          <button class="bt-btn" id="bt-resume">ПРОДОЛЖИТЬ</button>
          <button class="bt-btn2" data-open-controls>УПРАВЛЕНИЕ</button>
          <button class="bt-btn2" id="bt-restart">НАЧАТЬ БОЙ ЗАНОВО</button>
          <button class="bt-btn2" data-main-menu>ВЫЙТИ В ГЛАВНОЕ МЕНЮ</button>
        </div>
      </div>
    </div>
    <div class="bt-overlay" id="bt-controls" style="display:none">
      <div class="bt-card">
        <h1>УПРАВЛЕНИЕ</h1>
        <div class="bt-sec">Клавиши — нажмите на ячейку, чтобы переназначить</div>
        <div class="bt-bind" id="bt-bind-grid"></div>
        <div id="bt-bind-hint"></div>
        <div class="bt-sec">Мышь</div>
        <div class="bt-row"><span style="min-width:190px">Чувствительность</span>
          <input type="range" id="bt-sens" min="0.3" max="3" step="0.05"><span class="mono" id="bt-sens-v" style="min-width:44px">1.00</span></div>
        <div class="bt-row"><label style="cursor:pointer;display:flex;gap:8px;align-items:center">
          <input type="checkbox" id="bt-invy" style="accent-color:#f5b84a"> Инвертировать вертикаль</label></div>
        <div class="bt-sec">Как играть</div>
        <ul class="bt-info">
          <li><b>Мышь</b> — обзор. Башня сама поворачивается туда, куда смотрит прицел (42°/с), ствол — по высоте.</li>
          <li><b>Колесо</b> — отдалить/приблизить камеру; при максимальном приближении включается снайперский режим. В прицеле колесо меняет кратность 2–16x.</li>
          <li><b>Круг сведения</b> (зелёный) — куда реально смотрит ствол и разброс. Стоя на месте круг сжимается за ~2 с, в движении, при повороте корпуса и башни — расходится. Красный — идёт перезарядка (6,5 с).</li>
          <li><b>Броня.</b> Попадание под углом больше 72° — рикошет. Лоб Т-80БВМ иногда держит снаряд, в борт — почти всегда пробитие, в корму +15% урона.</li>
          <li><b>Укрытия.</b> Щиты-мишени полигона принимают снаряды — и ваши, и противника.</li>
          <li><b>Противник</b> Centauro II держит дистанцию 110–190 м, обходит с флангов и притормаживает перед выстрелом — ловите момент.</li>
          <li><b>Esc</b> — пауза и меню. Клик по экрану возвращает управление мышью.</li>
          <li><b>M</b> — крупная миникарта, <b>P</b> — счётчик FPS (разрешение снижается само, если FPS падает ниже ~52).</li>
        </ul>
        <div class="bt-ctrl-foot">
          <button class="bt-btn2" id="bt-binds-reset" style="min-width:0">СБРОСИТЬ ПО УМОЛЧАНИЮ</button>
          <button class="bt-btn" id="bt-controls-back" style="margin:0;padding:10px 40px;font-size:19px">НАЗАД</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(root);
  const $ = id => document.getElementById(id);
  // это игра, а не витрина: прячем панели инспектора оригинала сразу
  { const hud = document.getElementById('hud-layout'); if (hud) hud.style.display = 'none'; }

  function logLine(text, color = '#aaa') {
    const d = document.createElement('div');
    d.style.borderLeftColor = color; d.textContent = text;
    const log = $('bt-log'); log.prepend(d);
    while (log.children.length > 7) log.lastChild.remove();
  }
  let msgTimer = null;
  function showMsg(text, color = '#fff', ms = 1400) {
    const m = $('bt-msg'); m.textContent = text; m.style.color = color; m.style.opacity = 1;
    clearTimeout(msgTimer); msgTimer = setTimeout(() => { m.style.opacity = 0; }, ms);
  }
  // ---------------------------------------------------------------------------
  // 7. УПРАВЛЕНИЕ: мышь (pointer lock), клавиши, пауза, снайперский режим
  // ---------------------------------------------------------------------------
  const canvas = renderer.domElement;

  // --- назначения клавиш (сохраняются в браузере) -----------------------------
  const ACTIONS = [
    ['forward', 'Вперёд'], ['back', 'Назад'], ['left', 'Поворот корпуса влево'], ['right', 'Поворот корпуса вправо'],
    ['fire', 'Выстрел из пушки'], ['sniper', 'Снайперский режим'], ['mg', 'Пулемёт (удерживать)'], ['light', 'Фара вкл/выкл'],
    ['camLeft', 'Обзор влево (без мыши)'], ['camRight', 'Обзор вправо'], ['camUp', 'Обзор вверх'], ['camDown', 'Обзор вниз']
  ];
  const DEFAULT_BINDS = {
    forward: ['KeyW', null], back: ['KeyS', null], left: ['KeyA', null], right: ['KeyD', null],
    fire: ['Mouse0', 'Space'], sniper: ['Mouse2', 'ShiftLeft'], mg: ['KeyR', 'KeyF'], light: ['KeyL', null],
    camLeft: ['ArrowLeft', null], camRight: ['ArrowRight', null], camUp: ['ArrowUp', null], camDown: ['ArrowDown', null]
  };
  const STORE_KEY = 'tanchiki.controls.v1';
  const RESERVED = ['Escape'];
  let binds = JSON.parse(JSON.stringify(DEFAULT_BINDS));
  const settings = { sens: 1, invertY: false };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && saved.binds) ACTIONS.forEach(([a]) => { if (Array.isArray(saved.binds[a])) binds[a] = saved.binds[a].slice(0, 2).concat([null, null]).slice(0, 2); });
    if (saved && typeof saved.sens === 'number') settings.sens = clamp(saved.sens, 0.3, 3);
    if (saved && typeof saved.invertY === 'boolean') settings.invertY = saved.invertY;
  } catch (e) { }
  function saveControls() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ binds, sens: settings.sens, invertY: settings.invertY })); } catch (e) { }
  }
  function actionFor(code) { for (const [a] of ACTIONS) if (binds[a].includes(code)) return a; return null; }

  const KEY_NAMES = {
    Space: 'Пробел', ShiftLeft: 'Л.Shift', ShiftRight: 'П.Shift', ControlLeft: 'Л.Ctrl', ControlRight: 'П.Ctrl',
    AltLeft: 'Л.Alt', AltRight: 'П.Alt', MetaLeft: 'Л.Cmd', MetaRight: 'П.Cmd', Tab: 'Tab', CapsLock: 'Caps',
    Enter: 'Enter', Backspace: 'Backspace', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Mouse0: 'ЛКМ', Mouse1: 'СКМ', Mouse2: 'ПКМ', Mouse3: 'Мышь 4', Mouse4: 'Мышь 5',
    Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'",
    Backslash: '\\', Comma: ',', Period: '.', Slash: '/'
  };
  function keyName(code) {
    if (!code) return '—';
    if (KEY_NAMES[code]) return KEY_NAMES[code];
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^Numpad/.test(code)) return 'Num ' + code.slice(6);
    return code;
  }

  // --- состояние ввода ---------------------------------------------------------
  const held = {};
  const canAct = () => G.phase === 'battle' && !!G.PL && G.PL.alive && !G.paused;
  function press(action, down, repeat) {
    held[action] = down;
    if (!down || repeat) return;
    if (action === 'fire') playerFire();
    else if (action === 'sniper') toggleSniper();
    else if (action === 'light' && G.PL && G.PL.alive && inBattleView()) setLamp(!G.lampOn);
  }
  function releaseAll() { Object.keys(held).forEach(k => held[k] = false); }

  function inBattleView() { return G.phase === 'countdown' || G.phase === 'battle' || G.phase === 'over'; }
  const shown = id => $(id).style.display !== 'none';
  const menuOpen = () => shown('bt-pause') || shown('bt-controls') || shown('bt-start') || shown('bt-end');

  // --- указатель мыши ----------------------------------------------------------
  function requestLock() { try { canvas.requestPointerLock && canvas.requestPointerLock(); } catch (e) { } }
  function releaseLock() { if (document.pointerLockElement) { G.selfUnlock = true; document.exitPointerLock(); } }
  document.addEventListener('pointerlockchange', () => {
    G.locked = document.pointerLockElement === canvas;
    const self = G.selfUnlock; G.selfUnlock = false;
    // Esc при захваченной мыши браузер забирает себе — ловим это как «открыть меню»
    if (!G.locked && !self && (G.phase === 'battle' || G.phase === 'countdown') && !G.paused) openPause();
    $('bt-lockhint').style.display = (!G.locked && !G.paused && (G.phase === 'battle' || G.phase === 'countdown')) ? 'block' : 'none';
  });

  document.addEventListener('mousemove', e => {
    if (!inBattleView() || !G.locked || G.paused) return;
    const k = (G.sniper ? 0.0022 / G.sniperZoom : 0.0024) * settings.sens;
    G.camYaw -= e.movementX * k;
    G.camPitch = clamp(G.camPitch + e.movementY * k * (settings.invertY ? -1 : 1), G.sniper ? -0.25 : -0.32, G.sniper ? 0.35 : 1.1);
  });

  canvas.addEventListener('mousedown', e => {
    if (!inBattleView() || menuOpen()) return;
    if (!G.locked) { requestLock(); return; }
    const a = actionFor('Mouse' + e.button);
    if (a) press(a, true, false);
  });
  document.addEventListener('mouseup', e => { const a = actionFor('Mouse' + e.button); if (a && held[a]) press(a, false); });
  canvas.addEventListener('contextmenu', e => { if (inBattleView()) e.preventDefault(); });

  const HOTKEYS = {};                      // служебные клавиши (M — миникарта, P — FPS), заполняются ниже
  // --- клавиатура: всё управление здесь, обработчик index.html не получает клавиши --
  window.addEventListener('keydown', e => {
    e.stopImmediatePropagation();
    if (rebinding) { e.preventDefault(); finishRebind(e.code); return; }
    if (e.code === 'Escape') { e.preventDefault(); onEscape(); return; }
    if (!e.repeat && HOTKEYS[e.code] && !actionFor(e.code)) { HOTKEYS[e.code](); return; }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (!inBattleView() || menuOpen()) return;
    const a = actionFor(e.code);
    if (a) press(a, true, e.repeat);
  }, true);
  window.addEventListener('keyup', e => {
    e.stopImmediatePropagation();
    const a = actionFor(e.code);
    if (a) press(a, false);
  }, true);
  window.addEventListener('blur', releaseAll);

  // --- меню паузы -----------------------------------------------------------------
  function openPause() {
    if (G.paused || !(G.phase === 'battle' || G.phase === 'countdown')) return;
    G.paused = true; G.pausedAt = performance.now();
    releaseAll();
    gsap.globalTimeline.pause();
    releaseLock();
    $('bt-pause').style.display = 'flex';
    $('bt-lockhint').style.display = 'none';
  }
  function resumeBattle() {
    if (!G.paused) return;
    $('bt-pause').style.display = 'none';
    G.paused = false;
    gsap.globalTimeline.resume();
    requestLock();
    setTimeout(() => { if (!G.locked && !G.paused && inBattleView() && G.phase !== 'over') $('bt-lockhint').style.display = 'block'; }, 400);
  }
  $('bt-resume').addEventListener('click', resumeBattle);

  function onEscape() {
    if (shown('bt-controls')) { closeControls(); return; }
    if (G.paused) { if (performance.now() - G.pausedAt > 250) resumeBattle(); return; }
    if (G.phase === 'battle' || G.phase === 'countdown') openPause();
  }

  // --- экран «Управление» ------------------------------------------------------
  let rebinding = null;          // { action, slot }
  let controlsReturnTo = null;
  function renderBinds() {
    const grid = $('bt-bind-grid');
    let html = '<div class="hd"></div><div class="hd">основная</div><div class="hd">дополнительная</div>';
    ACTIONS.forEach(([a, label]) => {
      html += `<div>${label}</div>`;
      [0, 1].forEach(slot => {
        const code = binds[a][slot];
        const wait = rebinding && rebinding.action === a && rebinding.slot === slot;
        html += `<div class="bt-key${code ? '' : ' empty'}${wait ? ' wait' : ''}" data-a="${a}" data-s="${slot}">${wait ? '…' : keyName(code)}</div>`;
      });
    });
    html += `<div>Обзор и наводка</div><div class="bt-key fixed">Мышь</div><div class="bt-key fixed">—</div>`;
    html += `<div>Камера / кратность прицела</div><div class="bt-key fixed">Колесо</div><div class="bt-key fixed">—</div>`;
    html += `<div>Меню / пауза</div><div class="bt-key fixed">Esc</div><div class="bt-key fixed">—</div>`;
    grid.innerHTML = html;
    grid.querySelectorAll('.bt-key[data-a]').forEach(el => el.addEventListener('click', ev => {
      ev.stopPropagation();
      if (rebinding) return;
      const action = el.dataset.a, slot = +el.dataset.s;
      setTimeout(() => {               // не ловим этот же клик как назначение
        rebinding = { action, slot };
        $('bt-bind-hint').textContent = `«${ACTIONS.find(x => x[0] === action)[1]}»: нажмите клавишу или кнопку мыши · Esc — отмена · Backspace — очистить`;
        renderBinds();
      }, 0);
    }));
  }
  function finishRebind(code) {
    const { action, slot } = rebinding;
    const label = ACTIONS.find(x => x[0] === action)[1];
    rebinding = null;
    if (code === 'Escape') { $('bt-bind-hint').textContent = ''; renderBinds(); return; }
    if (code === 'Backspace' || code === 'Delete') {
      binds[action][slot] = null;
      $('bt-bind-hint').textContent = `«${label}»: ячейка очищена`;
    } else if (RESERVED.includes(code)) {
      $('bt-bind-hint').textContent = 'Эта клавиша зарезервирована';
    } else {
      let note = '';
      ACTIONS.forEach(([a, l]) => [0, 1].forEach(s2 => {
        if ((a !== action || s2 !== slot) && binds[a][s2] === code) { binds[a][s2] = null; note = ` (снята с «${l}»)`; }
      }));
      binds[action][slot] = code;
      $('bt-bind-hint').textContent = `«${label}» → ${keyName(code)}${note}`;
    }
    saveControls(); renderBinds();
  }
  // кнопки мыши при назначении
  document.addEventListener('mousedown', e => {
    if (!rebinding) return;
    if (e.target.closest && e.target.closest('.bt-key[data-a]') && e.button === 0 && !e.target.classList.contains('wait')) { /* клик по другой ячейке */ }
    e.preventDefault(); e.stopPropagation();
    finishRebind('Mouse' + e.button);
  }, true);
  document.addEventListener('contextmenu', e => { if (shown('bt-controls')) e.preventDefault(); }, true);

  function openControls() {
    controlsReturnTo = ['bt-pause', 'bt-start', 'bt-end'].find(shown) || null;
    if (controlsReturnTo) $(controlsReturnTo).style.display = 'none';
    $('bt-sens').value = settings.sens; $('bt-sens-v').textContent = settings.sens.toFixed(2);
    $('bt-invy').checked = settings.invertY;
    $('bt-bind-hint').textContent = '';
    renderBinds();
    $('bt-controls').style.display = 'flex';
  }
  function closeControls() {
    rebinding = null;
    $('bt-controls').style.display = 'none';
    if (controlsReturnTo) $(controlsReturnTo).style.display = 'flex';
  }
  document.querySelectorAll('[data-open-controls]').forEach(b => b.addEventListener('click', openControls));
  $('bt-controls-back').addEventListener('click', closeControls);
  $('bt-binds-reset').addEventListener('click', () => {
    binds = JSON.parse(JSON.stringify(DEFAULT_BINDS)); settings.sens = 1; settings.invertY = false;
    $('bt-sens').value = 1; $('bt-sens-v').textContent = '1.00'; $('bt-invy').checked = false;
    $('bt-bind-hint').textContent = 'Управление сброшено по умолчанию';
    saveControls(); renderBinds();
  });
  $('bt-sens').addEventListener('input', e => { settings.sens = +e.target.value; $('bt-sens-v').textContent = settings.sens.toFixed(2); saveControls(); });
  $('bt-invy').addEventListener('change', e => { settings.invertY = e.target.checked; saveControls(); });

  canvas.addEventListener('wheel', e => {
    if (!inBattleView() || menuOpen()) return;
    e.preventDefault();
    if (G.sniper) {
      const zooms = [2, 4, 8, 16];
      let i = zooms.indexOf(G.sniperZoom);
      i = clamp(i + (e.deltaY < 0 ? 1 : -1), -1, zooms.length - 1);
      if (i < 0) { toggleSniper(); return; }
      G.sniperZoom = zooms[i]; $('bt-zoom').textContent = G.sniperZoom + 'x';
    } else {
      G.camDist = clamp(G.camDist * (e.deltaY > 0 ? 1.12 : 0.89), CFG.camDistMin, CFG.camDistMax);
      if (e.deltaY < 0 && G.camDist <= CFG.camDistMin + 0.01) toggleSniper();
    }
  }, { passive: false });

  function toggleSniper() {
    if (!G.PL || (!G.sniper && (!G.PL.alive || (G.phase !== 'battle' && G.phase !== 'countdown')))) return;
    G.sniper = !G.sniper;
    if (G.sniper) {
      // в прицел — смотрим туда же, куда целились
      const dir = tmpV.copy(G.aimPoint).sub(gunWorldPos(tmpV2)).normalize();
      G.camYaw = Math.atan2(dir.x, dir.z); G.camPitch = clamp(-Math.asin(dir.y), -0.25, 0.35);
      G.camDist = CFG.camDistMin + 2;
    } else {
      G.camPitch = clamp(G.camPitch + 0.06, -0.32, 1.1);
    }
    $('bt-sniper').style.display = G.sniper ? 'block' : 'none';
    $('bt-cross').style.display = G.sniper ? 'none' : 'block';
    G.PL.root.visible = !G.sniper;
  }


  // ---------------------------------------------------------------------------
  // 4. МОДЕЛИ И ЮНИТЫ
  // Т-80БВМ: процедурная модель из index.html «запекается» в три набора мешей
  // (корпус / башня / пушка) и клонируется. Centauro II: клоны glTF-модели.
  // ---------------------------------------------------------------------------
  const hbMat = new THREE.MeshBasicMaterial({ visible: false });
  const units = [];
  const dustT = {}, kickT = {}, prevSp = {};
  scene.add(dirLight.target);
  dirLight.shadow.camera.far = 110;
  { const sd = 26; Object.assign(dirLight.shadow.camera, { left: -sd, right: sd, top: sd, bottom: -sd }); dirLight.shadow.camera.updateProjectionMatrix(); }

  function mergeByMaterial(items) {
    const groups = new Map();
    items.forEach(it => { if (!groups.has(it.mat)) groups.set(it.mat, []); groups.get(it.mat).push(it); });
    const out = new THREE.Group(), v = new V3(), nm = new THREE.Matrix3();
    groups.forEach((list, mat) => {
      let nv = 0, ni = 0;
      list.forEach(({ geo }) => { nv += geo.attributes.position.count; ni += geo.index ? geo.index.count : geo.attributes.position.count; });
      const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), I = new Uint32Array(ni);
      let vo = 0, io = 0;
      list.forEach(({ geo, m }) => {
        if (!geo.attributes.normal) geo.computeVertexNormals();
        nm.getNormalMatrix(m);
        const pa = geo.attributes.position, na = geo.attributes.normal, ua = geo.attributes.uv;
        for (let i = 0; i < pa.count; i++) {
          v.fromBufferAttribute(pa, i).applyMatrix4(m); P[(vo + i) * 3] = v.x; P[(vo + i) * 3 + 1] = v.y; P[(vo + i) * 3 + 2] = v.z;
          v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); N[(vo + i) * 3] = v.x; N[(vo + i) * 3 + 1] = v.y; N[(vo + i) * 3 + 2] = v.z;
          if (ua) { U[(vo + i) * 2] = ua.getX(i); U[(vo + i) * 2 + 1] = ua.getY(i); }
        }
        if (geo.index) { for (let i = 0; i < geo.index.count; i++) I[io + i] = geo.index.getX(i) + vo; io += geo.index.count; }
        else { for (let i = 0; i < pa.count; i++) I[io + i] = vo + i; io += pa.count; }
        vo += pa.count;
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
      g.setIndex(new THREE.BufferAttribute(I, 1)); g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; out.add(mesh);
    });
    return out;
  }

  const T80 = {};
  function buildT80Template() {
    tankRoot.position.set(0, 0, 0); tankRoot.rotation.set(0, 0, 0);
    turretGroup.rotation.y = 0; gunElevationGroup.rotation.x = 0;
    tankRoot.updateMatrixWorld(true);
    const inv = m => new THREE.Matrix4().copy(m).invert();
    const rootInv = inv(tankRoot.matrixWorld), turInv = inv(turretGroup.matrixWorld), gunInv = inv(gunElevationGroup.matrixWorld);
    const parts = { hull: [], turret: [], gun: [] };
    tankRoot.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
      let vis = true, owner = 'hull';
      for (let p = o; p; p = p.parent) {
        if (!p.visible) vis = false;
        if (owner === 'hull' && p === gunElevationGroup) owner = 'gun'; else if (owner === 'hull' && p === turretGroup) owner = 'turret';
        if (p === tankRoot) break;
      }
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!vis || !mat || mat.visible === false || (mat.transparent && mat.opacity < 0.4) || mat.blending === THREE.AdditiveBlending) return;
      const base = owner === 'gun' ? gunInv : owner === 'turret' ? turInv : rootInv;
      parts[owner].push({ geo: o.geometry, mat, m: new THREE.Matrix4().multiplyMatrices(base, o.matrixWorld) });
    });
    T80.hull = mergeByMaterial(parts.hull); T80.turret = mergeByMaterial(parts.turret); T80.gun = mergeByMaterial(parts.gun);
    T80.turM = new THREE.Matrix4().multiplyMatrices(rootInv, turretGroup.matrixWorld);
    T80.gunM = new THREE.Matrix4().multiplyMatrices(turInv, gunElevationGroup.matrixWorld);
    T80.muzzle = muzzleBlastGroup.getWorldPosition(new V3()).applyMatrix4(gunInv);
    tankRoot.visible = false;   // оригинал больше не нужен: все танки — клоны
  }

  let CENT = null;
  function b64ToArrayBuffer(b64) {
    const bin = atob(b64); const len = bin.length; const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  function prepCentauro(gltf) {
    const model = gltf.scene, done = new Set();
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        if (done.has(m)) return; done.add(m);
        if (m.color) m.color.convertLinearToSRGB();
        if (m.emissive) m.emissive.convertLinearToSRGB();
        ['map', 'emissiveMap'].forEach(k => { if (m[k]) { m[k].encoding = THREE.LinearEncoding; m[k].needsUpdate = true; } });
        m.needsUpdate = true;
      });
    });
    CENT = model;
  }

  // M1A1 Abrams: в модели корпус, башня и пушка слиты в один меш — делим по связным частям и высоте.
  // Локальные оси модели: X — вперёд, Y — вбок, Z — вверх; переводим в игровые (Z — вперёд, Y — вверх).
  let ABR = null;
  function prepAbrams(gltf) {
    const S = 7.93 / 1565, TUR = [-20, 330], GUN = [575, 405], MUZ = 1305;        // масштаб по длине корпуса; оси башни и цапф (ед. модели)
    const meshes = []; gltf.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
    const done = new Set();
    meshes.forEach(o => (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (done.has(m)) return; done.add(m); if (m.color) m.color.convertLinearToSRGB(); if (m.map) { m.map.encoding = THREE.LinearEncoding; m.map.needsUpdate = true; } m.metalness = Math.min(m.metalness, 0.3); m.roughness = Math.max(m.roughness, 0.6); m.needsUpdate = true; }));
    const parts = { hull: [], turret: [], gun: [] };
    meshes.forEach(o => {
      const g = o.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, I = g.index.array, nv = P.count;
      const weld = new Map(), wid = new Int32Array(nv); let nw = 0;
      for (let i = 0; i < nv; i++) { const k = Math.round(P.getX(i) * 2) + '_' + Math.round(P.getY(i) * 2) + '_' + Math.round(P.getZ(i) * 2); let w = weld.get(k); if (w === undefined) { w = nw++; weld.set(k, w); } wid[i] = w; }
      const par = new Int32Array(nw); for (let i = 0; i < nw; i++) par[i] = i;
      const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
      for (let t = 0; t < I.length; t += 3) { const a = find(wid[I[t]]), b = find(wid[I[t + 1]]); if (a !== b) par[b] = a; const c = find(wid[I[t + 2]]), a2 = find(wid[I[t]]); if (a2 !== c) par[c] = a2; }
      const box = new Map();                                                      // по компонентам: мин. X и мин. Z
      for (let i = 0; i < nv; i++) { const r = find(wid[i]); let b = box.get(r); if (!b) { b = [1e9, 1e9]; box.set(r, b); } b[0] = Math.min(b[0], P.getX(i)); b[1] = Math.min(b[1], P.getZ(i)); }
      const kind = r => { const b = box.get(r); return b[1] >= 360 && b[0] >= 580 ? 'gun' : b[1] >= 322 ? 'turret' : 'hull'; };
      const acc = { hull: { P: [], N: [], U: [], I: [], map: new Map() }, turret: { P: [], N: [], U: [], I: [], map: new Map() }, gun: { P: [], N: [], U: [], I: [], map: new Map() } };
      const piv = { hull: [0, 0], turret: TUR, gun: GUN };
      for (let t = 0; t < I.length; t += 3) {
        const k = kind(find(wid[I[t]])), a = acc[k], pv = piv[k];
        for (let q = 0; q < 3; q++) { const i = I[t + q]; let ni = a.map.get(i);
          if (ni === undefined) { ni = a.P.length / 3; a.map.set(i, ni); a.P.push(P.getY(i) * S, (P.getZ(i) - pv[1]) * S, (P.getX(i) - pv[0]) * S); a.N.push(N.getY(i), N.getZ(i), N.getX(i)); a.U.push(U.getX(i), U.getY(i)); }
          a.I.push(ni); }
      }
      for (const k in acc) { const a = acc[k]; if (!a.I.length) continue; const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(a.P, 3)); ng.setAttribute('normal', new THREE.Float32BufferAttribute(a.N, 3)); ng.setAttribute('uv', new THREE.Float32BufferAttribute(a.U, 2)); ng.setIndex(a.I);
        const m = new THREE.Mesh(ng, o.material); m.castShadow = m.receiveShadow = true; parts[k].push(m); }
    });
    const grp = arr => { const g = new THREE.Group(); arr.forEach(m => g.add(m)); return g; };
    ABR = { hull: grp(parts.hull), turret: grp(parts.turret), gun: grp(parts.gun), turPos: new V3(0, TUR[1] * S, TUR[0] * S), gunPos: new V3(0, (GUN[1] - TUR[1]) * S, (GUN[0] - TUR[0]) * S), muzzle: new V3(0, 0, (MUZ - GUN[0]) * S) };
  }

  // Танки-«киты» (Challenger, Leopard, Type 10): заранее упрощённые модели с узлами hull / turret / gun / muzzle
  const KITS = {};
  const KIT_HB = {
    challenger: { hull: [3.6, 1.5, 8.6, 0, 1.0, 0], turret: [3.3, 0.85, 4.8, 0, 0.38, -0.2] },
    leopard: { hull: [3.7, 1.5, 7.9, 0, 1.0, 0], turret: [3.1, 0.85, 5.6, 0, 0.36, 0.05] },
    type10: { hull: [3.2, 1.2, 7.2, 0, 0.85, 0], turret: [2.85, 0.75, 5.2, 0, 0.36, -0.3] }
  };
  function prepKit(key, gltf) {
    const done = new Set();
    gltf.scene.traverse(o => {
      if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
      const m = o.material; if (done.has(m)) return; done.add(m);
      if (m.color) m.color.convertLinearToSRGB();
      if (m.map) { m.map.encoding = THREE.LinearEncoding; m.map.anisotropy = 4; m.map.needsUpdate = true; }
      if (m.userData.alphaFromAO && m.aoMap) { m.alphaMap = m.aoMap; m.aoMap = null; m.alphaTest = 0.5; m.transparent = false; }
      if (m.color) m.color.multiplyScalar(1.45);            // текстуры атласа с запечённым AO темнее остальных моделей
      m.metalness = 0; m.roughness = 0.82; m.side = THREE.FrontSide; m.needsUpdate = true;
    });
    const get = n => gltf.scene.getObjectByName(n);
    const hull = get('hull'), tur = get('turret'), gun = get('gun'), muz = get('muzzle');
    const strip = o => { const c = new THREE.Group(); if (o.isMesh) { const m = new THREE.Mesh(o.geometry, o.material); m.castShadow = m.receiveShadow = true; c.add(m); } else o.children.forEach(ch => { if (ch.isMesh) { const m = new THREE.Mesh(ch.geometry, ch.material); m.castShadow = m.receiveShadow = true; c.add(m); } }); return c; };
    KITS[key] = { hull: strip(hull), turret: strip(tur), gun: strip(gun), turPos: tur.position.clone(), gunPos: gun.position.clone(), muzzle: muz.position.clone() };
  }

  function addHitbox(parent, u, part, w, h, l, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), hbMat);
    m.position.set(x, y, z); m.userData.hb = { unit: u, part };
    parent.add(m); u.hitboxes.push(m); return m;
  }

  // кинематика башни/пушки для двух моделей (у них разные оси)
  const KIN = {
    t80: {
      desired(u, pt, out) {
        const lp = u.turret.parent.worldToLocal(tmpV.copy(pt)).sub(u.turret.position);
        out.yaw = Math.atan2(lp.x, lp.z);
        const gp = u.turret.worldToLocal(tmpV.copy(pt)).sub(u.gun.position);
        out.pitch = Math.atan2(gp.y, Math.max(0.5, Math.hypot(gp.x, gp.z)));
      },
      apply(u) { u.turret.rotation.y = u.tYaw; u.gun.rotation.x = -u.gPitch; },
      muzzle(u, pos, dir) { u.root.updateMatrixWorld(true); u.muzzle.getWorldPosition(pos); u.gun.getWorldPosition(tmpV3); dir.copy(pos).sub(tmpV3).normalize(); },
      recoil(u) { gsap.killTweensOf(u.kick.position); gsap.fromTo(u.kick.position, { z: -0.5 }, { z: 0, duration: 0.7, ease: 'power2.out' }); gsap.fromTo(u.body.rotation, { x: -0.02 }, { x: 0, duration: 1.0, ease: 'elastic.out(1,0.35)' }); },
      shake(u) { gsap.fromTo(u.body.rotation, { z: (Math.random() - 0.5) * 0.05 }, { z: 0, duration: 0.7, ease: 'elastic.out(1,0.4)' }); }
    },
    cent: {
      desired(u, pt, out) {
        const lp = u.turret.parent.worldToLocal(tmpV.copy(pt));
        out.yaw = Math.atan2(-(lp.z - u.turret.position.z), lp.x - u.turret.position.x);
        const gp = u.turret.worldToLocal(tmpV.copy(pt)).sub(u.gun.position);
        out.pitch = Math.atan2(gp.y, Math.max(0.5, Math.hypot(gp.x, gp.z)));
      },
      apply(u) { u.turret.rotation.y = u.tYaw; u.gun.rotation.z = u.gPitch; },
      muzzle(u, pos, dir) { u.root.updateMatrixWorld(true); pos.set(3.75, 0, 0).applyMatrix4(u.gun.matrixWorld); tmpV3.set(0, 0, 0).applyMatrix4(u.gun.matrixWorld); dir.copy(pos).sub(tmpV3).normalize(); },
      recoil(u) { gsap.killTweensOf(u.gun.position); gsap.fromTo(u.gun.position, { x: u.gunBaseX - 0.45 }, { x: u.gunBaseX, duration: 0.7, ease: 'power2.out' }); gsap.fromTo(u.body.rotation, { z: 0.03 }, { z: 0, duration: 1.0, ease: 'elastic.out(1,0.35)' }); },
      shake(u) { gsap.fromTo(u.body.rotation, { x: (Math.random() - 0.5) * 0.05 }, { x: 0, duration: 0.7, ease: 'elastic.out(1,0.4)' }); }
    }
  };

  KIN.abrams = KIN.challenger = KIN.leopard = KIN.type10 = KIN.t80;                // у «Абрамса» та же схема узлов: башня — вокруг Y, пушка — вокруг X
  let UID = 0;
  function makeUnit(team, type, n) {
    const T = CFG.types[type];
    const u = {
      id: UID++, team, type, T, n, label: `${T.name} №${n + 1}`, hp: T.hp, alive: true, isPlayer: false,
      heading: 0, speed: 0, yawVel: 0, tYaw: 0, gPitch: 0, reload: 0, disp: 0.012, hitboxes: [],
      vel: new V3(), prev: new V3(), ok: null, smokeT: 0, throttle: 0,
      ai: { wp: null, wpT: 0, strafe: Math.random() < 0.5 ? -1 : 1, target: null, tgtT: Math.random(), los: false, losT: 0, noLos: 0, stuckT: 0, stuckP: new V3(), revT: 0, yawErr: 9, pitchErr: 9 }
    };
    const root = new THREE.Group(); root.rotation.order = 'YXZ'; u.root = root;
    if (type === 't80') {
      u.body = T80.hull.clone(); root.add(u.body);
      u.turret = new THREE.Group(); T80.turM.decompose(u.turret.position, u.turret.quaternion, u.turret.scale); u.turret.rotation.set(0, 0, 0); root.add(u.turret);
      u.turret.add(T80.turret.clone());
      u.gun = new THREE.Group(); T80.gunM.decompose(u.gun.position, u.gun.quaternion, u.gun.scale); u.gun.rotation.set(0, 0, 0); u.turret.add(u.gun);
      u.kick = new THREE.Group(); u.gun.add(u.kick); u.kick.add(T80.gun.clone());
      u.muzzle = new THREE.Object3D(); u.muzzle.position.copy(T80.muzzle); u.gun.add(u.muzzle);
      addHitbox(root, u, 'hull', 3.55, 1.35, 7.0, 0, 0.95, 0);
      addHitbox(u.turret, u, 'turret', 2.7, 0.85, 3.0, 0, 0.42, -0.1);
      u.wheels = [];
    } else if (KIT_HB[type]) {
      const K = KITS[type], hb = KIT_HB[type];
      u.body = K.hull.clone(); root.add(u.body);
      u.turret = new THREE.Group(); u.turret.position.copy(K.turPos); root.add(u.turret); u.turret.add(K.turret.clone());
      u.gun = new THREE.Group(); u.gun.position.copy(K.gunPos); u.turret.add(u.gun);
      u.kick = new THREE.Group(); u.gun.add(u.kick); u.kick.add(K.gun.clone());
      u.muzzle = new THREE.Object3D(); u.muzzle.position.copy(K.muzzle); u.gun.add(u.muzzle);
      addHitbox(root, u, 'hull', ...hb.hull); addHitbox(u.turret, u, 'turret', ...hb.turret);
      u.wheels = [];
    } else if (type === 'abrams') {
      u.body = ABR.hull.clone(); root.add(u.body);
      u.turret = new THREE.Group(); u.turret.position.copy(ABR.turPos); root.add(u.turret); u.turret.add(ABR.turret.clone());
      u.gun = new THREE.Group(); u.gun.position.copy(ABR.gunPos); u.turret.add(u.gun);
      u.kick = new THREE.Group(); u.gun.add(u.kick); u.kick.add(ABR.gun.clone());
      u.muzzle = new THREE.Object3D(); u.muzzle.position.copy(ABR.muzzle); u.gun.add(u.muzzle);
      addHitbox(root, u, 'hull', 3.9, 1.45, 7.9, 0, 1.0, 0);
      addHitbox(u.turret, u, 'turret', 3.4, 0.95, 4.6, 0, 0.5, 0.15);
      u.wheels = [];
    } else {
      const inner = new THREE.Group(); inner.rotation.y = -Math.PI / 2;   // нос модели смотрит в +X → разворачиваем в +Z
      const model = CENT.clone(true); inner.add(model); root.add(inner);
      u.body = inner;
      u.turret = model.getObjectByName('Turret_HITFACT'); u.gun = model.getObjectByName('Gun_120mm');
      u.gunBaseX = u.gun.position.x; u.wheels = [];
      model.traverse(o => { if (/^Wheel_/.test(o.name)) u.wheels.push(o); });
      addHitbox(root, u, 'hull', 3.3, 2.1, 7.6, 0, 1.45, 0);
      addHitbox(root, u, 'turret', 2.9, 1.15, 3.6, 0, 3.15, -0.55);
    }
    dustT[u.id] = 0; kickT[u.id] = 0; prevSp[u.id] = 0;
    scene.add(root); units.push(u);
    const el = document.createElement('div'); el.className = 'bt-ulabel';
    el.innerHTML = `<div class="nm">${u.label}</div><div class="bar"><div></div></div><div class="dist mono"></div>`;
    $('bt-root').appendChild(el); u.el = el; u.elBar = el.querySelector('.bar>div'); u.elDist = el.querySelector('.dist');
    return u;
  }
  const TEAM_TYPE = ['t80', 'cent'];
  function clearUnits() {
    units.forEach(u => { if (u.root.parent) u.root.parent.remove(u.root); if (u.el && u.el.parentNode) u.el.parentNode.removeChild(u.el); });
    units.length = 0; G.PL = null;
  }
  // команда игрока — выбранный тип; противник — случайный из двух остальных (держится до смены выбора)
  function pickTeams() {
    const others = Object.keys(CFG.types).filter(t => t !== G.tank);
    if (TEAM_TYPE[0] !== G.tank || !others.includes(TEAM_TYPE[1]) || !G.foeLocked) { TEAM_TYPE[1] = others[Math.floor(Math.random() * others.length)]; G.foeLocked = true; }
    TEAM_TYPE[0] = G.tank;
  }
  function buildUnits() {
    clearUnits(); pickTeams();
    const spawns = [{ p: MAP.playerSpawn, h: MAP.playerHeading }, { p: MAP.enemySpawn, h: MAP.enemyHeading }];
    for (let t = 0; t < 2; t++) for (let n = 0; n < CFG.teamSize; n++) {
      const u = makeUnit(t, TEAM_TYPE[t], n);
      const off = [0, -22, 22, -44, 44][n] || 0, sp = spawns[t];
      const x = sp.p.x + Math.cos(sp.h) * off, z = sp.p.z - Math.sin(sp.h) * off - Math.cos(sp.h) * Math.abs(off) * 0.3;
      u.root.position.set(x, MAP.H(x, z), z); u.heading = sp.h; u.root.rotation.y = sp.h; u.prev.copy(u.root.position);
      KIN[u.type].apply(u);
    }
  }
  const teamAlive = t => units.filter(u => u.team === t && u.alive);
  const othersHitboxes = u => { const a = []; for (const o of units) if (o !== u && o.alive) a.push(...o.hitboxes); return a; };
  const aimPointOf = (u, out) => out.copy(u.root.position).setY(u.root.position.y + u.T.aimH);

  // фара танка игрока (клавиша L)
  const lamp = new THREE.SpotLight(0xfff2cc, 0, 110, 0.42, 0.55, 1.2);
  const lampGlow = [0, 1].map(() => new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff6d8 })));
  function attachLamp(u) {
    const T = u.T;
    u.root.add(lamp); lamp.position.set(0, T.lampY, T.lampZ);
    u.root.add(lamp.target); lamp.target.position.set(0, T.lampY - 2.5, T.lampZ + 40);
    lampGlow.forEach((g, i) => { u.root.add(g); g.position.set(i ? 0.95 : -0.95, T.lampY, T.lampZ); });
    setLamp(G.lampOn);
  }
  function setLamp(on) {
    G.lampOn = on; lamp.intensity = on ? 4.5 : 0; lampGlow.forEach(g => g.visible = on);
  }

  // ---------------------------------------------------------------------------
  // 5. ЗАГРУЗКА
  // ---------------------------------------------------------------------------
  function menuCamera() {
    const t = G.playerTeam, sp = t === 0 ? MAP.playerSpawn : MAP.enemySpawn, s = t === 0 ? -1 : 1;
    controls.target.set(sp.x, sp.y + 2, sp.z);
    camera.position.set(sp.x + 20, sp.y + 9, sp.z + s * 24);
  }
  try {
    buildT80Template();
    new THREE.GLTFLoader().parse(b64ToArrayBuffer(window.CENTAURO_GLB_B64), '', gltf => {
      prepCentauro(gltf);
      new THREE.GLTFLoader().parse(b64ToArrayBuffer(window.ABRAMS_GLB_B64), '', async g2 => {
        prepAbrams(g2);
        for (const k of Object.keys(KIT_HB)) {
          if (!window.KIT_GLB || !window.KIT_GLB[k]) { console.error('нет модели', k); continue; }
          const g3 = await new Promise((res, rej) => new THREE.GLTFLoader().parse(b64ToArrayBuffer(window.KIT_GLB[k]), '', res, rej));
          prepKit(k, g3); window.KIT_GLB[k] = null;
        }
        for (const k of Object.keys(KIT_HB)) if (!KITS[k]) delete CFG.types[k];
        buildUnits();
        G.phase = 'menu'; menuCamera(); refreshPick();
        const btn = $('bt-go'); btn.disabled = false; btn.textContent = 'В БОЙ!';
        let auto = false; try { auto = sessionStorage.getItem('tanchiki.autostart') === '1'; sessionStorage.removeItem('tanchiki.autostart'); } catch (e) { }
        if (auto) startBattle(false);
      }, err => { console.error('Abrams load error', err); $('bt-go').textContent = 'ОШИБКА ЗАГРУЗКИ МОДЕЛИ'; });
    }, err => { console.error('Centauro load error', err); $('bt-go').textContent = 'ОШИБКА ЗАГРУЗКИ МОДЕЛИ'; });
  } catch (e) { console.error(e); $('bt-go').textContent = 'ОШИБКА ЗАГРУЗКИ МОДЕЛИ'; }

  // ---------------------------------------------------------------------------
  // 6. СТАРТ / ФИНАЛ / СМЕНА ТАНКА
  // ---------------------------------------------------------------------------
  function refreshPick() {
    document.querySelectorAll('.bt-pick').forEach(el => {
      const mine = el.dataset.tank === G.tank;
      el.classList.toggle('mine', mine); el.querySelector('.tag').textContent = mine ? 'ВАШ ТАНК' : 'выбрать';
    });
    const vs = $('bt-vsline'); if (vs) vs.innerHTML = `<b style="color:#7dff8a">${CFG.types[G.tank].name} × 3</b> &nbsp;против&nbsp; <b style="color:#ff6b5a">${units.length ? CFG.types[TEAM_TYPE[1]].name + ' × 3' : '…'}</b>`;
  }
  document.querySelectorAll('.bt-pick').forEach(el => el.addEventListener('click', () => {
    if (G.phase !== 'menu' && G.phase !== 'loading') return;
    G.tank = el.dataset.tank; try { localStorage.setItem('tanchiki.tank', G.tank); } catch (e) { }
    G.foeLocked = false;
    if (G.phase === 'menu') { buildUnits(); menuCamera(); }
    refreshPick();
  }));
  refreshPick();
  // два экрана меню: 1 — танк, 2 — карта
  function menuStep(n) { $('bt-step1').style.display = n === 1 ? 'block' : 'none'; $('bt-step2').style.display = n === 2 ? 'block' : 'none'; try { sessionStorage.setItem('tanchiki.step', String(n)); } catch (e) { } refreshPick(); }
  $('bt-next').addEventListener('click', () => menuStep(2));
  $('bt-back').addEventListener('click', () => menuStep(1));
  try { if (sessionStorage.getItem('tanchiki.step') === '2') menuStep(2); } catch (e) { }
  // выбор поля: карта строится при загрузке страницы, поэтому смена поля перезагружает игру
  document.querySelectorAll('.bt-map').forEach(el => {
    el.classList.toggle('cur', el.dataset.map === MAP.id);
    el.addEventListener('click', () => {
      if (el.dataset.map === MAP.id) return;
      try { localStorage.setItem('tanchiki.map', el.dataset.map); } catch (e) { }
      $('bt-go').disabled = true; $('bt-go').textContent = 'ЗАГРУЗКА ПОЛЯ…';
      setTimeout(() => location.reload(), 50);
    });
  });

  function setPlayer(u, announce) {
    if (G.sniper) toggleSniper();
    if (G.PL) G.PL.isPlayer = false;
    G.PL = u; u.isPlayer = true; u.throttle = 0;
    const o = new V3(), d = new V3(); KIN[u.type].muzzle(u, o, d);
    G.camYaw = Math.atan2(d.x, d.z); G.camPitch = 0.07; G.disp = u.T.disp.base * 3;
    $('bt-pname').textContent = u.label; $('bt-pname').style.fontSize = u.label.length > 15 ? '20px' : ''; $('bt-pname').style.whiteSpace = 'nowrap';
    attachLamp(u);
    if (announce) { showMsg(`ВЫ ПЕРЕСЕЛИ НА ${u.label.toUpperCase()}`, '#7dff8a', 2200); logLine(`Вы управляете: ${u.label}`, '#4ade80'); }
    updateHPUI();
  }
  function enterBattleMode() {
    window.__battleCam = true;
    controls.enabled = false;
    if (state.sosnaSightActive && typeof toggleSosnaSight === 'function') toggleSosnaSight();
    const hud = document.getElementById('hud-layout'); if (hud) hud.style.display = 'none';
    const sos = document.getElementById('sosna-overlay'); if (sos) sos.style.display = 'none';
    camera.fov = 55; camera.updateProjectionMatrix();
    // шапка: слева своя команда, справа противник
    const mine = G.playerTeam, foe = 1 - mine;
    [[mine, 'bt-t0', '#7dff8a', '#4ade80'], [foe, 'bt-t1', '#ff6b5a', '#f05440']].forEach(([t, id, c1, c2]) => {
      const box = $(id);
      box.querySelector('.nm').innerHTML = `${CFG.types[TEAM_TYPE[t]].name}${t === mine ? ' <span style="opacity:.6;font-size:12px">(вы)</span>' : ''}`;
      box.querySelector('.nm').style.color = c1;
      const pips = box.querySelector('.bt-pips'); pips.innerHTML = '';
      units.filter(u => u.team === t).forEach(u => { const p = document.createElement('div'); p.className = 'bt-pip'; p.innerHTML = `<div style="background:${c2}"></div>`; pips.appendChild(p); u.pip = p; });
    });
    units.forEach(u => u.el.classList.toggle('ally', u.team === mine));
    setPlayer(units.find(u => u.team === mine), false);
  }
  function startBattle(withLock) {
    if (G.phase !== 'menu') return;
    initAudio();
    $('bt-start').style.display = 'none';
    enterBattleMode();
    if (withLock) requestLock();
    G.phase = 'countdown'; G.countdownLeft = CFG.countdown + 0.999;
    $('bt-count').style.display = 'block';
    $('bt-lockhint').style.display = G.locked ? 'none' : 'block';
  }
  $('bt-go').addEventListener('click', () => startBattle(true));
  // «Ещё бой» / «Начать заново» — перезагрузка сцены и автостарт
  function restartBattle() { try { sessionStorage.setItem('tanchiki.autostart', '1'); } catch (e) { } location.reload(); }
  $('bt-again').addEventListener('click', restartBattle);
  $('bt-restart').addEventListener('click', restartBattle);
  document.querySelectorAll('[data-main-menu]').forEach(b => b.addEventListener('click', () => { try { sessionStorage.removeItem('tanchiki.step'); } catch (e) { } location.reload(); }));

  function endBattle(result) {
    if (G.phase === 'over') return;
    G.phase = 'over'; G.result = result;
    setTimeout(() => {
      releaseLock();
      const t = $('bt-end-title'), sub = $('bt-end-sub'), mine = G.playerTeam;
      const a = teamAlive(mine).length, b = teamAlive(1 - mine).length;
      if (result === 'win') { t.textContent = 'ПОБЕДА'; t.style.color = '#7dff8a'; sub.textContent = b ? `Время вышло — у вас осталось больше танков (${a} против ${b})` : 'Команда противника уничтожена'; }
      else if (result === 'lose') { t.textContent = 'ПОРАЖЕНИЕ'; t.style.color = '#ff6b5a'; sub.textContent = a ? `Время вышло — у противника осталось больше танков (${b} против ${a})` : 'Ваша команда уничтожена'; }
      else { t.textContent = 'НИЧЬЯ'; t.style.color = '#facc15'; sub.textContent = 'Время боя истекло'; }
      const s = G.stats, acc = s.shots ? Math.round(s.hits / s.shots * 100) : 0;
      const dur = CFG.roundTime - G.timeLeft;
      $('bt-end-stats').innerHTML = [
        ['Время боя', `${Math.floor(dur / 60)}:${String(Math.floor(dur % 60)).padStart(2, '0')}`],
        ['Танков осталось: ваши / противника', `${a} / ${b}`],
        ['Вы уничтожили танков', s.kills], ['Вы потеряли танков (под вашим управлением)', s.lost],
        ['Выстрелов', s.shots], ['Попаданий / пробитий', `${s.hits} / ${s.pens}`], ['Точность', acc + '%'],
        ['Нанесено урона', s.dmgDealt], ['Получено урона', s.dmgTaken]
      ].map(([x, y]) => `<span>${x}</span><span>${y}</span>`).join('');
      $('bt-end').style.display = 'flex';
    }, result === 'draw' ? 300 : 3200);
  }
  function checkEnd() {
    if (G.phase !== 'battle') return;
    const a = teamAlive(G.playerTeam).length, b = teamAlive(1 - G.playerTeam).length;
    if (!b) endBattle('win'); else if (!a) endBattle('lose');
  }
  // ---------------------------------------------------------------------------
  // 8. СТРЕЛЬБА, ПОПАДАНИЯ, УРОН
  // ---------------------------------------------------------------------------
  function gunWorldPos(out) { return G.PL.gun.getWorldPosition(out); }
  function dispersionOffset(disp) {
    const r = disp * Math.min(1, Math.abs(gaussian()) / 2);
    const a = Math.random() * Math.PI * 2;
    return { yaw: Math.cos(a) * r, pitch: Math.sin(a) * r };
  }
  function gaussian() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const ray = new THREE.Raycaster();
  const rc2 = new THREE.Raycaster();
  // точное попадание по реальной геометрии здания (а не по грубому боксу)
  function refineBld(bld, origin, dir, far) {
    rc2.set(origin, dir); rc2.near = 0.3; rc2.far = far;
    const hits = rc2.intersectObject(bld.root, true);
    for (const h of hits) {
      if (h.object.userData.gas) continue;
      const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
      if (!m || m.visible === false || !h.face) continue;
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      if (n.dot(dir) > 0) n.negate();
      return { point: h.point.clone(), normal: n, distance: h.distance };
    }
    return null;
  }

  function fireUnit(u, disp) {
    if (!u.alive || u.reload > 0) return false;
    const T = u.T, o = new V3(), d = new V3();
    KIN[u.type].muzzle(u, o, d);
    const off = dispersionOffset(disp);
    const right = new V3().crossVectors(d, new V3(0, 1, 0)).normalize(), up = new V3().crossVectors(right, d).normalize();
    d.addScaledVector(right, off.yaw).addScaledVector(up, off.pitch).normalize();
    u.reload = T.reload * (u.isPlayer ? 1 : rand(0.97, 1.1));
    u.disp += T.disp.shot * 0.75;
    // вспышка, дым, отдача, трассер
    for (let i = 0; i < 12; i++) spawnParticleSprite(fireballTex, i < 3 ? 0xffffff : (i < 8 ? 0xfef08a : 0xf97316), THREE.AdditiveBlending,
      o.clone().addScaledVector(d, 0.3 + i * 0.12), d.clone().multiplyScalar(rand(10, 26)).add(new V3(rand(-3, 3), rand(-2, 3), rand(-3, 3))),
      rand(0.8, 1.4), rand(2.2, 3.4), rand(0.14, 0.28), 0.86, 0.6, 1.0);
    for (let i = 0; i < 16; i++) spawnParticleSprite(smokeCloudTex, i < 8 ? 0x78716c : 0xd6d3d1, THREE.NormalBlending,
      o.clone().addScaledVector(d, rand(0.3, 1.5)), d.clone().multiplyScalar(rand(2, 9)).add(new V3(rand(-2, 2), rand(0.3, 2.5), rand(-2, 2))),
      1.0, rand(3.5, 5.5), rand(1.2, 2.4), 0.93, 0.8, 0.75);
    // пыль с земли от дульной волны
    { const gx = o.x + d.x * 2, gz = o.z + d.z * 2, gy = MAP.H(gx, gz); if (o.y - gy < 3.5) for (let i = 0; i < 6; i++) spawnParticleSprite(smokeCloudTex, MAP.dustColor, THREE.NormalBlending, new V3(gx + rand(-2, 2), gy + 0.3, gz + rand(-2, 2)), new V3(rand(-3, 3), rand(0.5, 2), rand(-3, 3)), 1.2, rand(4, 6), rand(1.2, 2), 0.93, 0.3, 0.5); }
    KIN[u.type].recoil(u);
    const hitDist = resolveShot(u, o, d, T.shellSpeed);
    const shell = new THREE.Mesh(SHELL_GEO, SHELL_MAT);
    shell.position.copy(o).addScaledVector(d, 1.0); shell.quaternion.setFromUnitVectors(new V3(0, 0, 1), d); scene.add(shell);
    activeProjectiles.push({ mesh: shell, vel: d.clone().multiplyScalar(T.shellSpeed), gravity: 0, rotVel: null, life: 0, maxLife: Math.min(4, (hitDist || 600) / T.shellSpeed), kind: 'apfsds' });
    boom(u.isPlayer ? 0.9 : volByDist(camera.position.distanceTo(o)), u.isPlayer ? 900 : 800, 1.15);
    if (u.isPlayer) G.shake = Math.max(G.shake || 0, 0.12);
    return true;
  }
  const SHELL_GEO = new THREE.CylinderGeometry(0.04, 0.05, 2.0, 8).rotateX(Math.PI / 2), SHELL_MAT = new THREE.MeshBasicMaterial({ color: 0xffe08a });
  function playerFire() {
    const u = G.PL; if (!canAct() || u.reload > 0) return;
    if (fireUnit(u, G.disp)) { G.stats.shots++; G.disp += u.T.disp.shot; }
  }

  // общий расчёт попадания; возвращает дистанцию до первой преграды
  function resolveShot(shooter, origin, dir, speed) {
    const targets = othersHitboxes(shooter).concat(MAP.blockers);
    ray.set(origin, dir); ray.near = 0.5; ray.far = 900;
    const h = ray.intersectObjects(targets, false)[0];
    const tDist = MAP.raycastTerrain(origin, dir, 900, 0.5);
    if (tDist !== null && (!h || tDist < h.distance)) {
      const p = origin.clone().addScaledVector(dir, tDist);
      setTimeout(() => groundImpact(p, true), Math.min(1500, tDist / speed * 1000));
      return tDist;
    }
    if (!h) return null;
    const delay = Math.min(1500, h.distance / speed * 1000), hb = h.object.userData.hb;
    const normal = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : dir.clone().negate();
    const p = h.point.clone(), d2 = dir.clone();
    if (!hb) {
      const gz = h.object.userData.gas, bld = h.object.userData.bld, cb = h.object.userData.onHit, fu = h.object.userData.fuel, cr = h.object.userData.car;
      let exact = null; if (bld && !bld.dead) exact = refineBld(bld, origin, dir, h.distance + 30);
      setTimeout(() => {
        groundImpact(exact ? exact.point : p, false);
        if (bld) damageBuilding(bld, exact ? exact.point : p, exact ? exact.normal : normal, d2, !!exact);
        if (gz) gasHit(gz, p, shooter);
        if (fu) fuelBlast(fu, shooter);
        if (cr) carBlast(cr, shooter);
        if (cb) cb(p);
      }, delay);
      return exact ? exact.distance : h.distance;
    }
    setTimeout(() => applyHit(shooter, hb, p, d2, normal), delay);
    return h.distance;
  }

  function damageUnit(u, dmg, by, why) {
    if (!u.alive || dmg <= 0) return;
    const real = Math.min(dmg, Math.max(0, u.hp));
    if (u.isPlayer) { G.stats.dmgTaken += real; damageFlash(Math.min(0.8, 0.3 + dmg / 900)); }
    if (by && by.isPlayer && by.team !== u.team) G.stats.dmgDealt += real;
    u.hp -= dmg;
    KIN[u.type].shake(u);
    if (why) logLine(`${u.isPlayer ? 'Вы' : u.label}: −${dmg} (${why})`, u.team === G.playerTeam ? '#ef4444' : '#f5b84a');
    if (u.hp <= 0) destroyUnit(u, by);
    updateHPUI();
  }

  function applyHit(shooter, hb, point, dir, normal) {
    const victim = hb.unit;
    if (!victim.alive) return;
    const friendly = victim.team === shooter.team;
    const incidence = Math.acos(clamp(-dir.dot(normal), -1, 1));            // 0 — по нормали
    const vf = tmpV.set(Math.sin(victim.heading), 0, Math.cos(victim.heading));
    const from = tmpV2.copy(dir).negate(); from.y = 0; from.normalize();
    const za = Math.acos(clamp(from.dot(vf), -1, 1));
    const zone = za < 0.75 ? 'front' : za > 2.4 ? 'rear' : 'side';
    let outcome = 'pen';
    if (friendly || incidence > 1.26) outcome = 'ricochet';                 // > ~72° или по своим
    else {
      const A = victim.T.armor, np = zone === 'front' ? (hb.part === 'turret' ? A.frontTurret : A.frontHull) : zone === 'side' ? A.side : 0;
      if (Math.random() < np) outcome = 'nopen';
    }
    let dmg = 0;
    if (outcome === 'pen') dmg = Math.round(rand(shooter.T.dmg[0], shooter.T.dmg[1]) * (zone === 'rear' ? 1.15 : 1));
    hitEffects(point, outcome);
    const cd = camera.position.distanceTo(point);
    if (outcome === 'pen') boom(volByDist(cd) * 0.9, 1400, 0.7); else ping(outcome === 'ricochet' ? 2400 : 1500, 0.3, 0.25 * volByDist(cd));
    const zoneRu = { front: 'в лоб', side: 'в борт', rear: 'в корму' }[zone], partRu = hb.part === 'turret' ? 'башня' : 'корпус';
    if (shooter.isPlayer) {
      if (friendly) { showMsg('ПО СВОИМ!', '#facc15', 1000); }
      else {
        G.stats.hits++;
        if (outcome === 'pen') { G.stats.pens++; showMsg(`ПРОБИТИЕ  −${dmg}`, '#ffcf5a'); logLine(`Вы → ${victim.label}: пробитие ${zoneRu} (${partRu}), −${dmg}`, '#f5b84a'); }
        else if (outcome === 'ricochet') { showMsg('РИКОШЕТ', '#cbd5e1'); logLine(`Вы → ${victim.label}: рикошет`, '#94a3b8'); }
        else { showMsg('НЕ ПРОБИЛ', '#cbd5e1'); logLine(`Вы → ${victim.label}: не пробил ${zoneRu}`, '#94a3b8'); }
      }
    }
    if (victim.isPlayer && !friendly) {
      showDirHit(point);
      if (outcome === 'pen') logLine(`${shooter.label} → вы: пробитие ${zoneRu} (${partRu}), −${dmg}`, '#ef4444');
      else { damageFlash(0.18); logLine(`${shooter.label} → вы: ${outcome === 'ricochet' ? 'рикошет' : 'не пробил ' + zoneRu}`, '#94a3b8'); if (G.phase === 'battle') showMsg(outcome === 'ricochet' ? 'РИКОШЕТ ПО ВАМ' : 'БРОНЯ ВЫДЕРЖАЛА', '#9ae6b4', 1100); }
    }
    if (dmg) damageUnit(victim, dmg, shooter);
    // под огнём ИИ переключается на того, кто стреляет
    if (!friendly && !victim.isPlayer && victim.alive && Math.random() < 0.6) { victim.ai.target = shooter; victim.ai.tgtT = 3; }
  }

  // всплеск: столб воды и брызги
  function waterPlume(p, k = 1) {
    const wl = MAP.waterLevel ? MAP.waterLevel(p.x, p.z) : p.y, c = new V3(p.x, Math.max(p.y, wl), p.z);
    for (let i = 0; i < 16 * k; i++) spawnParticleSprite(smokeCloudTex, i % 3 ? 0xe9f3f8 : 0xb9d2de, THREE.NormalBlending, c.clone().add(new V3(rand(-0.6, 0.6), 0.2, rand(-0.6, 0.6))),
      new V3(rand(-2.5, 2.5) * k, rand(7, 17) * k, rand(-2.5, 2.5) * k), 0.7, rand(2.5, 4.5) * k, rand(0.9, 1.6), 0.96, -9, 0.85);
    for (let i = 0; i < 12 * k; i++) spawnParticleSprite(smokeCloudTex, 0xf4fafc, THREE.NormalBlending, c.clone(), new V3(rand(-7, 7) * k, rand(1.5, 5), rand(-7, 7) * k), 0.4, rand(1.5, 2.6), rand(0.5, 0.9), 0.93, -6, 0.7);
    boom(volByDist(camera.position.distanceTo(c)) * 0.4, 380, 0.7);
  }
  const sprayT = {};
  function waterSpray(u, wd, dt) {
    const sp = Math.abs(u.speed); if (sp < 0.8) return;
    sprayT[u.id] = (sprayT[u.id] || 0) - dt; if (sprayT[u.id] > 0) return;
    sprayT[u.id] = 0.055;
    const p = u.root.position, sh = Math.sin(u.heading), ch = Math.cos(u.heading), sg = Math.sign(u.speed), T = u.T;
    const wl = MAP.waterLevel(p.x, p.z), k = clamp(sp / 8, 0.25, 1.3);
    for (const side of [-1, 1]) {
      // носовой бурун и шлейф за кормой
      const fx = p.x + sh * T.halfL * sg + ch * side * T.halfW, fz = p.z + ch * T.halfL * sg - sh * side * T.halfW;
      spawnParticleSprite(smokeCloudTex, 0xeaf4f8, THREE.NormalBlending, new V3(fx, wl + 0.15, fz), new V3(ch * side * rand(1.5, 4) * k + sh * sg * sp * 0.4, rand(2, 5) * k, -sh * side * rand(1.5, 4) * k + ch * sg * sp * 0.4), 0.5, rand(1.6, 2.8) * k, rand(0.5, 0.9), 0.94, -7, 0.75);
      const bx = p.x - sh * T.halfL * sg + ch * side * T.halfW * 0.8, bz = p.z - ch * T.halfL * sg - sh * side * T.halfW * 0.8;
      spawnParticleSprite(smokeCloudTex, 0xd5e6ee, THREE.NormalBlending, new V3(bx, wl + 0.1, bz), new V3(rand(-0.8, 0.8), rand(0.6, 1.8), rand(-0.8, 0.8)), 0.8, rand(2.2, 3.4), rand(0.9, 1.5), 0.95, -0.6, 0.5);
    }
  }
  function groundImpact(p, sand) {
    if (MAP.waterDepth && MAP.waterDepth(p.x, p.z) > 0.08) { waterPlume(p); return; }
    const col = sand ? MAP.dustColor : 0x8a4a30;
    for (let i = 0; i < 10; i++) spawnParticleSprite(smokeCloudTex, col, THREE.NormalBlending, p.clone().add(new V3(rand(-0.5, 0.5), 0.3, rand(-0.5, 0.5))),
      new V3(rand(-3, 3), rand(2, 7), rand(-3, 3)), 0.8, rand(3, 5), rand(1.2, 2.2), 0.92, 0.5, 0.85);
    for (let i = 0; i < 5; i++) spawnParticleSprite(fireballTex, 0xffb35a, THREE.AdditiveBlending, p.clone(),
      new V3(rand(-4, 4), rand(1, 5), rand(-4, 4)), 0.5, 1.4, rand(0.15, 0.3), 0.85, 0, 1);
    boom(volByDist(camera.position.distanceTo(p)) * 0.5, 700, 0.6);
  }
  function dustTrail(obj, speed, heading, key, dt) {
    if (Math.abs(speed) < 2) return;
    dustT[key] -= dt; if (dustT[key] > 0) return;
    dustT[key] = 0.07;
    const back = -Math.sign(speed) * 3.2;
    const p = obj.position;
    for (const side of [-1.5, 1.5]) {
      const x = p.x + Math.sin(heading) * back + Math.cos(heading) * side, z = p.z + Math.cos(heading) * back - Math.sin(heading) * side;
      spawnParticleSprite(smokeCloudTex, MAP.dustColor, THREE.NormalBlending, new V3(x, MAP.H(x, z) + 0.4, z),
        new V3(rand(-0.6, 0.6), rand(0.4, 1.4), rand(-0.6, 0.6)), 0.9, rand(3.5, 5.5) * Math.min(1.4, Math.abs(speed) / 8), rand(1.6, 2.6), 0.95, 0.25, 0.55);
    }
  }
  function sandKick(obj, heading, speed, throttle, yawVel, key, dt, halfL, halfW) {
    const accel = dt > 0 ? (Math.abs(speed) - Math.abs(prevSp[key])) / dt : 0;
    prevSp[key] = speed;
    const slipStart = throttle ? clamp(1 - Math.abs(speed) / 6, 0, 1) : 0;            // газ в пол на малой скорости
    const slipAccel = clamp((accel - 1.5) / 4, 0, 1) * 0.7;
    const pivot = Math.abs(yawVel) > 0.22 && Math.abs(speed) < 3.5 ? clamp(Math.abs(yawVel) / 0.6, 0, 1) * 0.8 : 0;
    const brake = clamp((-accel - 5) / 8, 0, 1) * 0.7;
    const power = Math.max(slipStart, slipAccel, pivot, brake);
    if (power < 0.08) return;
    kickT[key] -= dt; if (kickT[key] > 0) return;
    kickT[key] = 0.035;
    const sh = Math.sin(heading), ch = Math.cos(heading);
    const drive = brake > Math.max(slipStart, slipAccel, pivot) ? -(Math.sign(speed) || 1) : (throttle || Math.sign(speed) || 1);
    const n = Math.ceil(power * 3);
    for (const side of [-1, 1]) {
      // при развороте на месте гусеницы крутятся в разные стороны
      const d = pivot > Math.max(slipStart, slipAccel, brake) ? side * Math.sign(yawVel) : drive;
      const lz = -d * halfL, lx = side * halfW;
      const x = obj.position.x + sh * lz + ch * lx, z = obj.position.z + ch * lz - sh * lx, y = MAP.H(x, z);
      for (let i = 0; i < n; i++) {
        const v = rand(4, 9) * (0.5 + power * 0.6);
        // комья песка: летят назад-вверх и падают
        spawnParticleSprite(smokeCloudTex, Math.random() < 0.5 ? 0xa9714a : 0x8f5c3a, THREE.NormalBlending,
          new V3(x + rand(-0.3, 0.3), y + 0.15, z + rand(-0.3, 0.3)),
          new V3(-d * sh * v + ch * side * rand(0, 1.5) + rand(-0.8, 0.8), rand(2.5, 6.5) * (0.6 + power * 0.5), -d * ch * v - sh * side * rand(0, 1.5) + rand(-0.8, 0.8)),
          rand(0.18, 0.45), rand(0.08, 0.2), rand(0.55, 0.95), 0.985, -11, 1.0);
      }
      // пыльное облако за комьями
      spawnParticleSprite(smokeCloudTex, MAP.dustColor, THREE.NormalBlending, new V3(x, y + 0.3, z),
        new V3(-d * sh * rand(1.5, 4) + rand(-0.5, 0.5), rand(0.8, 2), -d * ch * rand(1.5, 4) + rand(-0.5, 0.5)),
        0.8, rand(3, 5) * (0.6 + power * 0.5), rand(1.2, 2.0), 0.94, 0.3, 0.5 * Math.min(1, power + 0.3));
    }
  }
  const SINK = 0.06;
  function groundFollow(obj, heading, halfL, halfW, dt) {
    const sh = Math.sin(heading), ch = Math.cos(heading);
    const x = obj.position.x, z = obj.position.z;
    const bump = MAP.bumpAt && MAP.wrecks.length ? MAP.bumpAt : null;
    const hAt = (lx, lz) => { const px = x + sh * lz + ch * lx, pz = z + ch * lz - sh * lx; return MAP.H(px, pz) + (bump ? bump(px, pz) : 0); };
    const hf = hAt(0, halfL), hb = hAt(0, -halfL), hl = hAt(halfW, 0), hr = hAt(-halfW, 0);
    const k = Math.min(1, dt * 10);
    const pitch = Math.atan2(hf - hb, 2 * halfL), roll = Math.atan2(hl - hr, 2 * halfW);
    obj.rotation.x += (-pitch - obj.rotation.x) * k;
    obj.rotation.z += (roll - obj.rotation.z) * k;
    const sp = Math.sin(-obj.rotation.x), sr = Math.sin(obj.rotation.z);
    let y0 = -Infinity;
    for (const lx of [-halfW, halfW]) for (const lz of [-halfL, -halfL / 2, 0, halfL / 2, halfL]) y0 = Math.max(y0, hAt(lx, lz) - lz * sp - lx * sr);
    y0 -= SINK;
    const dy = y0 - obj.position.y;
    obj.position.y = Math.abs(dy) > 0.6 ? y0 : obj.position.y + dy * Math.min(1, dt * 14);
  }
  function hitEffects(point, outcome) {
    const n = outcome === 'pen' ? 14 : 8;
    for (let i = 0; i < n; i++) {
      spawnParticleSprite(fireballTex, i < 4 ? 0xffffff : (outcome === 'pen' ? 0xf97316 : 0xfde68a), THREE.AdditiveBlending,
        point.clone(), new V3(rand(-9, 9), rand(1, 9), rand(-9, 9)), outcome === 'pen' ? 0.9 : 0.4, outcome === 'pen' ? 2.4 : 0.9,
        rand(0.18, 0.4), 0.88, -2.0, 1.0);
    }
    if (outcome === 'pen') {
      for (let i = 0; i < 8; i++) {
        spawnParticleSprite(smokeCloudTex, 0x44403c, THREE.NormalBlending, point.clone(),
          new V3(rand(-2, 2), rand(1, 3), rand(-2, 2)), 1.0, 3.6, rand(1.2, 2.2), 0.93, 0.9, 0.7);
      }
    }
  }
  function damageFlash(strength) {
    const f = $('bt-flash');
    f.style.transition = 'none'; f.style.boxShadow = `inset 0 0 180px rgba(255,0,0,${strength})`;
    requestAnimationFrame(() => { f.style.transition = 'box-shadow .9s'; f.style.boxShadow = 'inset 0 0 180px rgba(255,0,0,0)'; });
  }
  let dirHitPoint = null, dirHitTimer = null;
  function showDirHit(point) {
    dirHitPoint = point.clone();
    const el = $('bt-dirhit'); el.style.transition = 'none'; el.style.opacity = 1;
    clearTimeout(dirHitTimer);
    dirHitTimer = setTimeout(() => { el.style.transition = 'opacity 1.2s'; el.style.opacity = 0; }, 900);
  }

  // ---------------------------------------------------------------------------
  // 9. УНИЧТОЖЕНИЕ ТАНКА
  // ---------------------------------------------------------------------------
  function bigExplosion(pos) {
    boom(1, 2200, 2.4);
    for (let i = 0; i < 40; i++) {
      spawnParticleSprite(fireballTex, i < 10 ? 0xffffff : (i < 25 ? 0xfde047 : 0xf97316), THREE.AdditiveBlending,
        pos.clone().add(new V3(rand(-1.5, 1.5), rand(0, 2), rand(-1.5, 1.5))),
        new V3(rand(-14, 14), rand(3, 18), rand(-14, 14)), rand(1.5, 2.5), rand(5, 8), rand(0.5, 1.1), 0.9, 1.5, 1.0);
    }
    for (let i = 0; i < 30; i++) {
      spawnParticleSprite(smokeCloudTex, i < 15 ? 0x1c1917 : 0x57534e, THREE.NormalBlending,
        pos.clone().add(new V3(rand(-2, 2), rand(0.5, 3), rand(-2, 2))),
        new V3(rand(-4, 4), rand(2, 7), rand(-4, 4)), 2.0, rand(7, 11), rand(3, 5.5), 0.94, 1.2, 0.85);
    }
  }
  function charMaterials(obj) {
    obj.traverse(o => {
      if (!o.isMesh || o.userData.hb || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const nm = mats.map(m => {
        if (m.transparent && m.opacity < 0.3) return m;
        const c = m.clone();
        if (c.color) c.color.multiplyScalar(0.16);
        if (c.emissive) c.emissive.setRGB(0, 0, 0);
        if ('roughness' in c) c.roughness = 1;
        if ('metalness' in c) c.metalness = 0.1;
        return c;
      });
      o.material = Array.isArray(o.material) ? nm : nm[0];
    });
  }
  function blowTurret(turretObj, groundY = 0) {
    scene.attach(turretObj);
    const p = turretObj.position;
    const vx = rand(-3, 3), vz = rand(-3, 3);
    gsap.to(p, { y: p.y + rand(5, 8), x: p.x + vx, z: p.z + vz, duration: 0.7, ease: 'power2.out',
      onComplete: () => gsap.to(p, { y: groundY + 0.9, x: p.x + vx * 0.6, z: p.z + vz * 0.6, duration: 0.6, ease: 'power2.in' }) });
    gsap.to(turretObj.rotation, { x: rand(-0.9, 0.9), z: rand(-0.9, 0.9), y: turretObj.rotation.y + rand(-2, 2), duration: 1.3 });
  }
  function destroyUnit(u, by) {
    if (!u.alive) return;
    u.alive = false; u.speed = 0; u.yawVel = 0; u.hp = Math.min(u.hp, 0);
    bigExplosion(u.root.position.clone().add(new V3(0, 2, 0)));
    if (u.isPlayer) { if (G.sniper) toggleSniper(); releaseAll(); G.stats.lost++; G.switchT = 2.8; setLamp(false); }
    u.root.visible = true;
    charMaterials(u.root);
    blowTurret(u.turret, u.root.position.y);
    G.wreckFires.push({ obj: u.root, t: 0, life: 45 });
    u.el.style.display = 'none';
    const mine = u.team === G.playerTeam;
    if (by && by.isPlayer && by.team !== u.team) { G.stats.kills++; showMsg(`${u.label.toUpperCase()} УНИЧТОЖЕН`, '#7dff8a', 2400); }
    else if (u.isPlayer) showMsg('ВАШ ТАНК УНИЧТОЖЕН', '#ff6b5a', 2400);
    logLine(`${by ? (by.isPlayer ? 'Вы' : by.label) : 'Взрыв'} ${by && by.isPlayer ? 'уничтожили' : 'уничтожил'} ${u.isPlayer ? 'ваш танк' : u.label}`, mine ? '#ef4444' : '#4ade80');
    G.shake = Math.max(G.shake || 0, clamp(1.0 - camera.position.distanceTo(u.root.position) / 150, 0, 1));
    updateHPUI();
    checkEnd();
  }

  // ---------------------------------------------------------------------------
  // 10. ДВИЖЕНИЕ (общее для игрока и ИИ)
  // ---------------------------------------------------------------------------
  function driveUnit(u, throttle, steer, dt) {
    const T = u.T, pos = u.root.position;
    u.throttle = throttle;
    const wd = MAP.waterDepth ? MAP.waterDepth(pos.x, pos.z) : 0;            // брод: вода тормозит
    u.wet = wd;
    const target = (throttle > 0 ? T.maxSpeed * throttle : T.revSpeed * throttle) * (1 - 0.5 * clamp((wd - 0.15) / 0.9, 0, 1));
    const braking = throttle === 0 || Math.sign(target) !== Math.sign(u.speed || target);
    const rate = (braking ? T.accel * 2.0 : T.accel) * dt;
    u.speed += clamp(target - u.speed, -rate, rate);
    // гусеничный разворачивается на месте, колёсному нужна скорость
    const yawT = T.pivot ? steer * T.turnRate * (1 - 0.35 * Math.min(1, Math.abs(u.speed) / T.maxSpeed))
      : steer * T.turnRate * clamp(Math.abs(u.speed) / 5, 0, 1) * (u.speed < 0 ? -1 : 1);
    u.yawVel += (yawT - u.yawVel) * Math.min(1, dt * 4);
    u.heading += u.yawVel * dt;
    const sh = Math.sin(u.heading), ch = Math.cos(u.heading);
    pos.x += sh * u.speed * dt; pos.z += ch * u.speed * dt;
    if (u.slide) { pos.x += u.slide.x * dt; pos.z += u.slide.z * dt; u.slide.multiplyScalar(Math.exp(-5 * dt)); }      // боковой снос после толчка затухает
    pos.x = clamp(pos.x, -FIELD - 15, FIELD + 15); pos.z = clamp(pos.z, -FIELD - 15, FIELD + 15);
    // рельеф: крутой склон не взять, в гору медленнее
    u.blocked = false;
    const sgn = Math.sign(u.speed) || 1, probe = 4.4;
    const g = (MAP.H(pos.x + sh * probe * sgn, pos.z + ch * probe * sgn) - MAP.H(pos.x, pos.z)) / probe;
    if (g > 0.6 && u.ok) { pos.x = u.ok.x; pos.z = u.ok.z; u.speed *= -0.25; u.blocked = true; }
    else if (Math.abs(u.speed) > 0.1) u.speed -= sgn * 9.81 * g * 0.28 * dt;
    { const bx = pos.x, bz = pos.z;
      if (MAP.collide(pos, T.radius)) {                                     // стена/скала: гасим только движение «в стену», вдоль — скользим
        const px = pos.x - bx, pz = pos.z - bz, pl = Math.hypot(px, pz);
        if (pl > 1e-4) { const into = -(sh * px + ch * pz) / pl * Math.sign(u.speed || 1); if (into > 0) u.speed *= 1 - Math.min(1, into * into * 14 * dt + into * 0.04); if (into > 0.75) u.blocked = true; if (u.slide) u.slide.multiplyScalar(0.5); }
        else { u.speed *= 0.6; u.blocked = true; }
      } }
    if (Math.abs(u.speed) > 0.5 && MAP.crushAt(pos.x, pos.z, T.radius + 0.2, sh, ch)) u.speed *= 0.92;
    u.ok = (u.ok || new V3()).set(pos.x, 0, pos.z);
    u.root.rotation.y = u.heading;
    groundFollow(u.root, u.heading, T.halfL, T.halfW, dt);
    if (wd > 0.12) { waterSpray(u, wd, dt); prevSp[u.id] = u.speed; }
    else {
      dustTrail(u.root, u.speed, u.heading, u.id, dt);
      sandKick(u.root, u.heading, u.speed, Math.sign(throttle), u.yawVel * (T.pivot ? 1 : 0.4), u.id, dt, T.halfL, T.halfW);
    }
    for (const w of u.wheels) w.rotation.z -= u.speed * dt / 0.68;
    if (dt > 0) u.vel.copy(pos).sub(u.prev).divideScalar(dt);
    u.prev.copy(pos);
    if (u.hp / T.hp < 0.4) {   // дымит при низкой прочности
      u.smokeT -= dt;
      if (u.smokeT <= 0) { u.smokeT = 0.12; spawnParticleSprite(smokeCloudTex, 0x292524, THREE.NormalBlending, pos.clone().add(new V3(rand(-1, 1), 2.6, rand(-1, 1))), new V3(rand(-0.5, 0.5), rand(1.5, 3), rand(-0.5, 0.5)), 0.8, 3.5, 2.2, 0.96, 0.8, 0.6); }
    }
  }
  // ---------------------------------------------------------------------------
  // СТОЛКНОВЕНИЯ ТАНКОВ: импульсы с учётом массы. Гасится только встречная составляющая скорости,
  // поэтому под углом танки скользят друг по другу, тяжёлый сдвигает лёгкого, удар разворачивает корпус.
  // Корпус — две окружности (нос и корма), так что бортами можно разойтись вплотную.
  // ---------------------------------------------------------------------------
  const MASS = { t80: 46, cent: 30, abrams: 57, challenger: 62, leopard: 64, type10: 44 };
  const hullCircles = (u, out) => {
    const off = u.T.halfL - u.T.halfW * 0.9, sh = Math.sin(u.heading), ch = Math.cos(u.heading), p = u.root.position;
    out[0] = p.x + sh * off; out[1] = p.z + ch * off; out[2] = p.x - sh * off; out[3] = p.z - ch * off; return u.T.halfW + 0.2;
  };
  const hcA = [0, 0, 0, 0], hcB = [0, 0, 0, 0];
  function separateUnits(dt) {
    for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
      const a = units[i], b = units[j], pa = a.root.position, pb = b.root.position;
      if (Math.abs(pa.x - pb.x) > 12 || Math.abs(pa.z - pb.z) > 12) continue;
      const ra = hullCircles(a, hcA), rb = hullCircles(b, hcB);
      let pen = 0, nx = 0, nz = 0, cx = 0, cz = 0;
      for (let p = 0; p < 4; p += 2) for (let q = 0; q < 4; q += 2) {
        const dx = hcB[q] - hcA[p], dz = hcB[q + 1] - hcA[p + 1], d = Math.hypot(dx, dz), o = ra + rb - d;
        if (o > pen && d > 1e-3) { pen = o; nx = dx / d; nz = dz / d; cx = hcA[p] + nx * ra; cz = hcA[p + 1] + nz * ra; }
      }
      if (pen <= 0) continue;
      const ia = a.alive ? 1 / MASS[a.type] : 0, ib = b.alive ? 1 / MASS[b.type] : 0, it = ia + ib;      // подбитый — неподвижное препятствие
      if (it === 0) continue;
      // разводим по массе (с небольшим допуском, чтобы не дрожали)
      const corr = Math.max(0, pen - 0.02) * 0.8;
      pa.x -= nx * corr * ia / it; pa.z -= nz * corr * ia / it; pb.x += nx * corr * ib / it; pb.z += nz * corr * ib / it;
      // скорости: ход вдоль корпуса + боковой снос от прошлых толчков
      const sa = a.slide || (a.slide = new V3()), sb = b.slide || (b.slide = new V3());
      const ahx = Math.sin(a.heading), ahz = Math.cos(a.heading), bhx = Math.sin(b.heading), bhz = Math.cos(b.heading);
      const vax = ahx * a.speed + sa.x, vaz = ahz * a.speed + sa.z, vbx = bhx * b.speed + sb.x, vbz = bhz * b.speed + sb.z;
      const vn = (vax - vbx) * nx + (vaz - vbz) * nz;                    // > 0 — сближаются
      if (vn <= 0) continue;
      const J = (1 + 0.12) * vn / it;                                     // импульс вдоль нормали
      const apply = (u, sl, hx, hz, inv, sgn) => {
        if (!inv) return;
        const dvx = sgn * nx * J * inv, dvz = sgn * nz * J * inv, along = dvx * hx + dvz * hz;
        u.speed += along;                                                 // вдоль гусениц танк катится
        sl.x += (dvx - along * hx) * 0.55; sl.z += (dvz - along * hz) * 0.55;   // поперёк — тяжело, но сдвигается
        const rx = cx - u.root.position.x, rz = cz - u.root.position.z;   // удар не в центр разворачивает корпус
        u.yawVel += clamp((rz * dvx - rx * dvz) * 0.045, -0.9, 0.9);
        u.bumpT = 0.4;
      };
      apply(a, sa, ahx, ahz, ia, -1); apply(b, sb, bhx, bhz, ib, 1);
      if (vn > 2.2 && (a.ramT || 0) <= 0) {                               // звук, искры, урон от тарана противнику
        a.ramT = b.ramT = 0.5;
        const c = new V3(cx, pa.y + 1.2, cz);
        boom(volByDist(camera.position.distanceTo(c)) * clamp(vn / 12, 0.2, 0.8), 240, 0.35);
        for (let k = 0; k < 6; k++) spawnParticleSprite(fireballTex, 0xffd9a0, THREE.AdditiveBlending, c.clone(), new V3(rand(-4, 4), rand(1, 5), rand(-4, 4)), 0.2, 0.6, 0.25, 0.85, -6, 1);
        if (a === G.PL || b === G.PL) G.shake = Math.max(G.shake || 0, clamp(vn / 14, 0.15, 0.7));
        if (a.team !== b.team && a.alive && b.alive && vn > 4.5 && G.phase === 'battle') {
          const e = (vn - 4) * 14;
          damageUnit(b, Math.round(e * MASS[a.type] / (MASS[a.type] + MASS[b.type]) * 2), a, 'таран');
          if (a.alive) damageUnit(a, Math.round(e * MASS[b.type] / (MASS[a.type] + MASS[b.type]) * 2), b, 'таран');
        }
      }
    }
    for (const u of units) if (u.ramT > 0) u.ramT -= dt;
  }
  // плавная доводка башни и ствола к точке; возвращает ошибки наведения
  const want = { yaw: 0, pitch: 0 };
  function aimUnit(u, pt, dt) {
    const T = u.T;
    KIN[u.type].desired(u, pt, want);
    const yErr = wrapPI(want.yaw - u.tYaw), yStep = clamp(yErr, -THREE.MathUtils.degToRad(T.traverse) * dt, THREE.MathUtils.degToRad(T.traverse) * dt);
    u.tYaw = wrapPI(u.tYaw + yStep);
    const wp = clamp(want.pitch, THREE.MathUtils.degToRad(T.pitchMin), THREE.MathUtils.degToRad(T.pitchMax));
    const pErr = wp - u.gPitch, pStep = clamp(pErr, -THREE.MathUtils.degToRad(T.elev) * dt, THREE.MathUtils.degToRad(T.elev) * dt);
    u.gPitch += pStep;
    KIN[u.type].apply(u);
    u.turretRate = Math.abs(yStep) / Math.max(dt, 1e-3);
    return { yErr: yErr - yStep, pErr: pErr - pStep };
  }

  // ---------------------------------------------------------------------------
  // 11. ИИ (одинаковый для союзников и противников)
  // ---------------------------------------------------------------------------
  function pickWaypoint(u) {
    const a = u.ai, tg = a.target, pos = u.root.position;
    if (!tg) { a.wp = null; return; }
    const pp = tg.root.position;
    const base = Math.atan2(pos.x - pp.x, pos.z - pp.z);
    if (Math.random() < 0.3) a.strafe *= -1;
    const hpR = u.hp / u.T.hp, eye = new V3(pp.x, pp.y + 2.2, pp.z);
    let best = null, bs = -1e9;
    for (let i = 0; i < 12; i++) {
      const want = hpR < 0.35 ? rand(190, 260) : (a.noLos > 6 ? rand(60, 130) : rand(100, 190));
      const bearing = base + a.strafe * rand(0.2, 0.8) + (i > 7 ? rand(-1.2, 1.2) : 0);
      const x = clamp(pp.x + Math.sin(bearing) * want, -FIELD, FIELD), z = clamp(pp.z + Math.cos(bearing) * want, -FIELD, FIELD);
      if (!MAP.isPassable(x, z)) continue;
      const wp = new V3(x, MAP.H(x, z) + 2.6, z);
      let crowd = 0; for (const o of units) if (o !== u && o.alive && o.team === u.team && o.ai.wp && o.ai.wp.distanceTo(wp) < 30) crowd++;
      const score = (MAP.hasLOS(wp, eye) ? 100 : 0) - pos.distanceTo(wp) * 0.08 - crowd * 40 + rand(0, 20);
      if (score > bs) { bs = score; best = wp; }
    }
    if (!best) best = new V3(pp.x + Math.sin(base) * 150, 0, pp.z + Math.cos(base) * 150);
    best.y = 0; a.wp = best; a.wpT = rand(6, 10);
  }
  function aiUpdate(u, dt, active) {
    const a = u.ai, T = u.T, pos = u.root.position;
    const eye = new V3(), ed = new V3(); KIN[u.type].muzzle(u, eye, ed);
    // --- выбор цели: ближайший, с бонусом за прямую видимость
    a.tgtT -= dt;
    if (a.tgtT <= 0 || !a.target || !a.target.alive) {
      a.tgtT = rand(1.0, 1.8);
      let best = null, bs = 1e9;
      for (const e of units) {
        if (!e.alive || e.team === u.team) continue;
        const s = pos.distanceTo(e.root.position) - (MAP.hasLOS(eye, aimPointOf(e, tmpV2)) ? 200 : 0) - (e === a.target ? 50 : 0);
        if (s < bs) { bs = s; best = e; }
      }
      if (best !== a.target) { a.target = best; a.wpT = 0; }
    }
    const tg = a.target;
    let throttle = 0, steer = 0;
    if (!tg) { driveUnit(u, 0, 0, dt); return; }
    const dist = Math.hypot(tg.root.position.x - pos.x, tg.root.position.z - pos.z);
    // --- маршрут
    if (active) {
      a.wpT -= dt;
      if (!a.wp || a.wpT <= 0 || Math.hypot(a.wp.x - pos.x, a.wp.z - pos.z) < 12) pickWaypoint(u);
      if (u.blocked || u.bumpT > 0) a.wpT = Math.min(a.wpT, 0.6);
      if (u.bumpT > 0) u.bumpT -= dt;
      // застрял — сдать назад
      a.stuckT += dt;
      if (a.stuckT > 2.5) { if (a.stuckP.distanceTo(pos) < 1.2 && a.revT <= 0 && Math.abs(u.throttle) > 0.3) { a.revT = 1.6; a.wpT = 0; } a.stuckP.copy(pos); a.stuckT = 0; }
      if (a.wp) {
        const err = wrapPI(Math.atan2(a.wp.x - pos.x, a.wp.z - pos.z) - u.heading);
        steer = clamp(err * 1.6, -1, 1);
        throttle = 0.85 * (1 - Math.min(0.7, Math.abs(err) / Math.PI));
        if (!T.pivot) throttle = Math.max(throttle, 0.45);
        if (Math.hypot(a.wp.x - pos.x, a.wp.z - pos.z) < 25) throttle = Math.min(throttle, 0.35);
        if (u.reload < 1.4 && a.los && dist < 420) throttle = Math.min(throttle, 0.15);   // остановка перед выстрелом
      }
      if (a.revT > 0) { a.revT -= dt; throttle = -0.8; steer = -steer; }
    }
    driveUnit(u, throttle, steer, dt);
    // --- наведение с упреждением
    const flight = dist / T.shellSpeed;
    const aim = aimPointOf(tg, new V3()).addScaledVector(tg.vel, flight * 0.8);
    u.root.updateMatrixWorld(true);
    const e = aimUnit(u, aim, dt);
    const dTarget = T.disp.base + Math.abs(u.speed) * T.disp.move * 0.75 + u.turretRate * 0.004;
    u.disp = u.disp > dTarget ? dTarget + (u.disp - dTarget) * Math.exp(-dt * 0.9) : dTarget;
    if (!active) return;
    // --- видимость и выстрел
    a.losT -= dt;
    if (a.losT <= 0) { a.losT = 0.3; a.los = MAP.hasLOS(eye.clone().add(new V3(0, 0.3, 0)), aimPointOf(tg, tmpV2)); }
    a.noLos = a.los ? 0 : a.noLos + dt;
    if (a.noLos > 6 && a.wpT > 2) a.wpT = 0;
    if (u.reload <= 0 && a.los && dist < 480 && Math.abs(e.yErr) < 0.035 && Math.abs(e.pErr) < 0.03 && u.disp < 0.012) {
      // свой на линии огня — не стреляем
      const mates = []; for (const o of units) if (o !== u && o.alive && o.team === u.team) mates.push(...o.hitboxes);
      ray.set(eye, ed); ray.near = 0.5; ray.far = dist;
      if (!ray.intersectObjects(mates, false).length) fireUnit(u, u.disp + CFG.aiError);
      else u.reload = 0.4;
    }
  }

  // ---------------------------------------------------------------------------
  // 12. ПУЛЕМЁТ И СЛЕДЫ ОТ ПУЛЬ
  // ---------------------------------------------------------------------------
  const bulletTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    // сколотая штукатурка вокруг и тёмная выбоина в центре
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + Math.random(), r = 12 + Math.random() * 12; g.fillStyle = `rgba(${200 + Math.random() * 40},${185 + Math.random() * 30},${160 + Math.random() * 30},0.85)`; g.beginPath(); g.ellipse(32 + Math.cos(a) * 6, 32 + Math.sin(a) * 6, r, r * 0.6, a, 0, 7); g.fill(); }
    const gr = g.createRadialGradient(32, 32, 1, 32, 32, 13); gr.addColorStop(0, 'rgba(5,4,4,1)'); gr.addColorStop(0.6, 'rgba(30,22,18,0.95)'); gr.addColorStop(1, 'rgba(60,45,35,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 13, 0, 7); g.fill();
    g.strokeStyle = 'rgba(20,15,12,0.7)'; g.lineWidth = 1;
    for (let i = 0; i < 5; i++) { const a = Math.random() * 6.283; g.beginPath(); g.moveTo(32 + Math.cos(a) * 8, 32 + Math.sin(a) * 8); g.lineTo(32 + Math.cos(a + 0.2) * (18 + Math.random() * 10), 32 + Math.sin(a + 0.2) * (18 + Math.random() * 10)); g.stroke(); }
    return new THREE.CanvasTexture(c);
  })();
  const bulletMat = new THREE.MeshStandardMaterial({ map: bulletTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 1 });
  const bulletGeo = new THREE.PlaneGeometry(1, 1), bulletMarks = [];
  function bulletMark(point, normal, root) {
    const m = new THREE.Mesh(bulletGeo, bulletMat);
    m.position.copy(point).addScaledVector(normal, 0.025); m.quaternion.setFromUnitVectors(new V3(0, 0, 1), normal); m.rotateZ(Math.random() * 6.283);
    m.scale.setScalar(rand(0.22, 0.42)); m.userData.noHole = true;
    if (root) root.attach(m); else scene.add(m);   // след остаётся на здании и рушится вместе с ним
    bulletMarks.push(m);
    if (bulletMarks.length > 500) { const old = bulletMarks.shift(); if (old.parent) old.parent.remove(old); }
  }
  const TRACER_GEO = new THREE.CylinderGeometry(0.025, 0.025, 3.5, 5).rotateX(Math.PI / 2), TRACER_MAT = new THREE.MeshBasicMaterial({ color: 0xffd060 });
  function mgFire(u) {
    const o = new V3(), d = new V3(); KIN[u.type].muzzle(u, o, d);
    o.addScaledVector(d, -1.5).add(new V3(0, 0.25, 0));
    d.add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(0.007)).normalize();
    ray.set(o, d); ray.near = 0.5; ray.far = 600;
    const h = ray.intersectObjects(othersHitboxes(u).concat(MAP.blockers), false)[0];
    const td = MAP.raycastTerrain(o, d, 600, 0.5);
    let dist = 600, fx = null;
    if (td !== null && (!h || td < h.distance)) { dist = td; const p = o.clone().addScaledVector(d, td); fx = () => spawnParticleSprite(smokeCloudTex, MAP.dustColor, THREE.NormalBlending, p, new V3(rand(-0.5, 0.5), rand(1, 2.5), rand(-0.5, 0.5)), 0.3, 1.3, rand(0.4, 0.7), 0.92, 0.2, 0.7); }
    else if (h) {
      dist = h.distance;
      const hb = h.object.userData.hb, bld = h.object.userData.bld, fu = h.object.userData.fuel, cr = h.object.userData.car;
      if (fu && !fu.dead) { const p = h.point.clone(); fx = () => mgFuel(fu, p, u); }
      else if (cr && !cr.exploded) { const p = h.point.clone(); fx = () => mgCar(cr, p, u); }
      else if (hb) {
        const p = h.point.clone(), v = hb.unit;
        fx = () => { spawnParticleSprite(fireballTex, 0xfff2b0, THREE.AdditiveBlending, p, new V3(rand(-3, 3), rand(1, 4), rand(-3, 3)), 0.25, 0.6, 0.15, 0.85, -3, 1); if (Math.random() < 0.3) ping(2600 + Math.random() * 800, 0.08, 0.05); if (v.team !== u.team && v.T.mgDmg) damageUnit(v, v.T.mgDmg, u); };
      } else if (bld && !bld.dead) {
        const r = refineBld(bld, o, d, h.distance + 40);
        if (r) { dist = r.distance; fx = () => { if (bld.dead) return; bulletMark(r.point, r.normal, bld.root); spawnParticleSprite(smokeCloudTex, 0xb8a898, THREE.NormalBlending, r.point.clone(), r.normal.clone().multiplyScalar(rand(1, 2.5)).add(new V3(0, 0.5, 0)), 0.2, 0.9, rand(0.3, 0.6), 0.9, 0.2, 0.7); }; }
        else dist = h.distance + 20;
      } else { const p = h.point.clone(); fx = () => spawnParticleSprite(smokeCloudTex, 0x9a6a50, THREE.NormalBlending, p, new V3(rand(-1, 1), rand(0.5, 2), rand(-1, 1)), 0.25, 1.0, rand(0.3, 0.6), 0.9, 0.2, 0.7); }
    }
    const tm = dist / 650;
    const t = new THREE.Mesh(TRACER_GEO, TRACER_MAT); t.position.copy(o).addScaledVector(d, 2); t.quaternion.setFromUnitVectors(new V3(0, 0, 1), d); scene.add(t);
    const end = o.clone().addScaledVector(d, Math.max(2, dist - 1.5));
    gsap.to(t.position, { x: end.x, y: end.y, z: end.z, duration: Math.max(0.03, tm), ease: 'none', onComplete: () => { scene.remove(t); if (fx) fx(); } });
    spawnParticleSprite(fireballTex, 0xffe9a0, THREE.AdditiveBlending, o.clone().addScaledVector(d, 0.6), d.clone().multiplyScalar(6), 0.3, 0.7, 0.06, 0.8, 0, 1);
    boom(0.16, 3400, 0.07);
  }

  // ---------------------------------------------------------------------------
  // 13. РАЗРУШЕНИЕ ЗДАНИЙ: пробоины, обрушение, падение водонапорной башни
  // ---------------------------------------------------------------------------
  function punchHole(root, wp, R) {
    let removed = 0; const lp = new V3(), ctr = new V3();
    root.updateMatrixWorld(true);
    root.traverse(m => {
      if (!m.isMesh || !m.geometry || !m.geometry.index || m.userData.gas || m.userData.noHole) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material]; if (mats[0].visible === false) return;
      m.worldToLocal(lp.copy(wp));
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      const bs = m.geometry.boundingSphere; if (lp.distanceTo(bs.center) > bs.radius + R) return;
      if (!m.userData.ownGeo) { m.geometry = m.geometry.clone(); m.userData.ownGeo = true; }
      const g = m.geometry, pos = g.attributes.position.array, idx = g.index.array, out = new idx.constructor(idx.length);
      const groups = g.groups.length ? g.groups : [{ start: 0, count: idx.length }], ng = []; let o = 0, cut = 0;
      for (const gr of groups) {
        const s0 = o;
        for (let i = gr.start; i < gr.start + gr.count; i += 3) {
          const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
          ctr.set((pos[a] + pos[b] + pos[c]) / 3, (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3, (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3);
          const jr = R * (0.78 + 0.44 * ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1);   // рваный край
          if (ctr.distanceToSquared(lp) < jr * jr) { cut++; continue; }
          out[o++] = idx[i]; out[o++] = idx[i + 1]; out[o++] = idx[i + 2];
        }
        ng.push({ start: s0, count: o - s0, materialIndex: gr.materialIndex });
      }
      if (!cut) return;
      g.setIndex(new THREE.BufferAttribute(out.slice(0, o), 1));
      if (g.groups.length) g.groups = ng;
      removed += cut;
    });
    return removed;
  }
  const RUBBLE = [0x8a4a36, 0x6e3a2a, 0x9a9288, 0x4a4541].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }));
  let holeTex = null;
  function rubbleBurst(at, normal, n, spread = 1) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(rand(0.2, 0.9), rand(0.15, 0.5), rand(0.2, 0.8)), RUBBLE[i % 4]);
      const p0 = at.clone().add(new V3(rand(-1.2, 1.2) * spread, rand(-1.2, 1.2), rand(-1.2, 1.2) * spread)); m.position.copy(p0); m.castShadow = true; scene.add(m);
      const out = normal.clone().multiplyScalar(rand(1.5, 8)).add(new V3(rand(-2.5, 2.5), 0, rand(-2.5, 2.5)));
      const tx = p0.x + out.x, tz = p0.z + out.z, gy = MAP.H(tx, tz) + 0.2, up = rand(0.5, 3), T1 = rand(0.7, 1.3), st = { t: 0 };
      gsap.to(st, { t: 1, duration: T1, ease: 'none', onUpdate: () => m.position.set(p0.x + out.x * st.t, p0.y + (gy - p0.y) * st.t * st.t + up * 4 * st.t * (1 - st.t), p0.z + out.z * st.t) });
      gsap.to(m.rotation, { x: rand(-6, 6), z: rand(-6, 6), duration: T1, ease: 'none' });
    }
  }
  function releaseBuilding(bld) {
    bld.dead = true;
    const i = MAP.boxes.indexOf(bld.box); if (i >= 0) MAP.boxes.splice(i, 1);          // теперь здесь можно проехать
    MAP.blockers = MAP.blockers.filter(b => b !== bld.blocker);
  }
  function dustWave(cx, cy, cz, hw, hd, n, size) {
    for (let i = 0; i < n; i++) spawnParticleSprite(smokeCloudTex, i % 3 ? 0xa8998a : 0x7a5a48, THREE.NormalBlending,
      new V3(cx + rand(-hw, hw), cy + rand(0.5, 4), cz + rand(-hd, hd)), new V3(rand(-5, 5), rand(0.5, 4), rand(-5, 5)), size * 0.4, size * rand(1, 1.6), rand(3, 6), 0.95, 0.5, 0.85);
  }
  // дом складывается: уходит вниз в облаке пыли, остаётся груда обломков
  function collapseBuilding(bld) {
    if (bld.dead) return;
    releaseBuilding(bld);
    const root = bld.root, y0 = root.position.y, c = new V3(bld.cx, y0, bld.cz), big = Math.max(bld.hw, bld.hd);
    boom(volByDist(camera.position.distanceTo(c)), 300, 3.2);
    G.shake = Math.max(G.shake || 0, clamp(1.1 - camera.position.distanceTo(c) / 160, 0.1, 1.1));
    dustWave(c.x, y0, c.z, bld.hw, bld.hd, 30, big * 1.2);
    gsap.delayedCall(0.5, () => dustWave(c.x, y0, c.z, bld.hw * 1.3, bld.hd * 1.3, 30, big * 1.5));
    gsap.to(root.position, { y: y0 - bld.h - 1, duration: 1.1 + bld.h * 0.07, ease: 'power2.in', onComplete: () => { root.visible = false; } });
    gsap.to(root.rotation, { x: rand(-0.05, 0.05), z: rand(-0.05, 0.05), duration: 1.2 });
    // груда обломков по пятну застройки
    const cs = Math.cos(bld.rot), sn = Math.sin(bld.rot), n = Math.round(30 + bld.hw * bld.hd * 0.6);
    for (let k = 0; k < 2; k++) {
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), RUBBLE[k * 2 + (bld.simple ? 1 : 0)], n);
      const d = new THREE.Object3D();
      for (let i = 0; i < n; i++) {
        const lx = rand(-1, 1) * bld.hw * 1.1, lz = rand(-1, 1) * bld.hd * 1.1, edge = 1 - Math.max(Math.abs(lx) / (bld.hw * 1.1), Math.abs(lz) / (bld.hd * 1.1));
        d.position.set(c.x + lx * cs + lz * sn, y0 + rand(0.1, 0.4) + edge * Math.min(2.2, bld.h * 0.12), c.z - lx * sn + lz * cs);
        d.rotation.set(rand(-1, 1), rand(0, 6.28), rand(-1, 1)); d.scale.set(rand(0.5, 2.6), rand(0.3, 1.1), rand(0.5, 2.2));
        d.updateMatrix(); im.setMatrixAt(i, d.matrix);
      }
      im.castShadow = true; im.receiveShadow = true; im.visible = false; scene.add(im);
      gsap.delayedCall(0.9, () => { im.visible = true; });
    }
    rubbleBurst(c.clone().add(new V3(0, 2, 0)), new V3(0, 0.2, 0), 26, big * 0.6);
    logLine('Здание обрушилось', '#cbd5e1');
  }
  // водонапорная башня валится от попадания по опорам
  function toppleTower(bld, dir) {
    if (bld.dead) return;
    releaseBuilding(bld);
    const root = bld.root, fx = new V3(dir.x, 0, dir.z).normalize(), axis = new V3(fx.z, 0, -fx.x);
    const q0 = root.quaternion.clone(), q1 = new THREE.Quaternion().setFromAxisAngle(axis, Math.PI / 2 * 0.97).multiply(q0), st = { t: 0 };
    boom(volByDist(camera.position.distanceTo(root.position)) * 0.8, 900, 1.2);
    gsap.to(st, { t: 1, duration: 2.6, ease: 'power2.in', onUpdate: () => root.quaternion.copy(q0).slerp(q1, st.t), onComplete: () => {
      const hitP = root.position.clone().addScaledVector(fx, bld.h * 0.8);
      dustWave(hitP.x, MAP.H(hitP.x, hitP.z), hitP.z, 5, 5, 26, 9);
      boom(volByDist(camera.position.distanceTo(hitP)), 260, 2.6);
      G.shake = Math.max(G.shake || 0, clamp(1.0 - camera.position.distanceTo(hitP) / 140, 0.1, 1.0));
      // бак раздавит всё, что под ним
      units.forEach(u => { if (u.alive && Math.hypot(u.root.position.x - hitP.x, u.root.position.z - hitP.z) < 6) damageUnit(u, 350, null, 'упала башня'); });
      MAP.crushAt(hitP.x, hitP.z, 7, fx.x, fx.z);
      rubbleBurst(hitP.clone().setY(MAP.H(hitP.x, hitP.z) + 1.5), new V3(0, 0.3, 0), 16, 3);
      // вода из бака
      for (let i = 0; i < 20; i++) spawnParticleSprite(smokeCloudTex, 0x9fc4d8, THREE.NormalBlending, hitP.clone().setY(MAP.H(hitP.x, hitP.z) + 1.5), new V3(rand(-9, 9), rand(2, 9), rand(-9, 9)), 1.2, rand(4, 7), rand(0.8, 1.6), 0.94, -6, 0.8);
    } });
    logLine('Водонапорная башня падает!', '#cbd5e1');
  }
  function damageBuilding(bld, point, normal, dir, exact) {
    if (bld.dead) return;
    if (bld.kind === 'tower') { rubbleBurst(point, normal, 6); toppleTower(bld, dir); return; }
    const R = 2.3; let at = point.clone(), hit = 0;
    if (!bld.simple) {
      // если в этом месте стены уже нет — снаряд влетает внутрь и сносит то, что дальше
      for (let t = 0; t <= 24 && !hit; t += 2) { at = point.clone().addScaledVector(dir, t); hit = punchHole(bld.root, at, R); }
    } else if (exact) {
      if (!holeTex) { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); const gr = x.createRadialGradient(64, 64, 6, 64, 64, 64); gr.addColorStop(0, 'rgba(4,3,3,1)'); gr.addColorStop(0.45, 'rgba(10,8,7,0.95)'); gr.addColorStop(0.7, 'rgba(25,18,14,0.6)'); gr.addColorStop(1, 'rgba(30,20,14,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); holeTex = new THREE.CanvasTexture(cv); }
      const d = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.2, R * 2.2), new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
      d.position.copy(point).addScaledVector(normal, 0.03); d.quaternion.setFromUnitVectors(new V3(0, 0, 1), normal); d.rotateZ(Math.random() * 6.28);
      d.userData.noHole = true; bld.root.attach(d);
    }
    rubbleBurst(at, normal, hit ? 18 : 8);
    for (let i = 0; i < 12; i++) spawnParticleSprite(smokeCloudTex, i % 3 ? 0x9a8f84 : 0x6e4a3a, THREE.NormalBlending, at.clone().add(new V3(rand(-1.5, 1.5), rand(-1, 1.5), rand(-1.5, 1.5))),
      normal.clone().multiplyScalar(rand(1, 5)).add(new V3(rand(-1.5, 1.5), rand(0.5, 2.5), rand(-1.5, 1.5))), 1.5, rand(5, 9), rand(2, 4), 0.94, 0.4, 0.8);
    boom(volByDist(camera.position.distanceTo(at)) * 0.7, 500, 1.3);
    // прочность: попадания в нижний этаж считаются вдвойне (несущие стены)
    const low = at.y - bld.root.position.y < 3.6;
    bld.dmg = (bld.dmg || 0) + (low ? 2 : 1);
    if (bld.dmg >= bld.need) gsap.delayedCall(0.35, () => collapseBuilding(bld));
  }

  // ---------------------------------------------------------------------------
  // ВЗРЫВ ЗАПРАВКИ: попадание в колонки (или наезд на них) — мгновенный взрыв;
  // попадание в навес/магазин — пожар и взрыв через несколько секунд
  // ---------------------------------------------------------------------------
  const GAS = { burning: false, exploded: false, fuse: 0, firePts: [], acc: 0, shooter: null };
  function gasHit(kind, point, shooter) {
    if (!MAP.gas || GAS.exploded) return;
    GAS.shooter = shooter;
    if (kind === 'pump' || GAS.burning) { explodeGas(); return; }
    GAS.burning = true; GAS.fuse = rand(3.5, 6); GAS.firePts.push(point.clone());
    showMsg('ЗАПРАВКА ГОРИТ!', '#ffb347', 1800); logLine('Заправка загорелась — сейчас рванёт', '#f59e0b');
  }
  function updateGas(dt) {
    const gs = MAP.gas; if (!gs || GAS.exploded) return;
    const check = (pos, who) => { for (const pp of gs.pumpPos) if (Math.hypot(pos.x - pp.x, pos.z - pp.z) < 3.0) { GAS.shooter = who; explodeGas(); return true; } return false; };
    for (const u of units) if (u.alive && check(u.root.position, u)) return;        // снёс колонку корпусом
    if (!GAS.burning) return;
    GAS.fuse -= dt; GAS.acc += dt;
    if (GAS.acc > 0.06) {
      GAS.acc = 0;
      GAS.firePts.forEach(p => {
        spawnParticleSprite(fireballTex, Math.random() < 0.5 ? 0xf97316 : 0xfde047, THREE.AdditiveBlending, p.clone().add(new V3(rand(-1, 1), rand(0, 0.6), rand(-1, 1))), new V3(rand(-0.6, 0.6), rand(2, 4.5), rand(-0.6, 0.6)), 0.9, 2.6, rand(0.4, 0.8), 0.95, 1.2, 0.9);
        spawnParticleSprite(smokeCloudTex, 0x1c1917, THREE.NormalBlending, p.clone().add(new V3(rand(-1, 1), 1, rand(-1, 1))), new V3(rand(-0.6, 0.6), rand(3, 5), rand(-0.6, 0.6)), 1.2, 6, rand(2, 3.5), 0.97, 0.8, 0.75);
      });
    }
    if (GAS.fuse <= 0) explodeGas();
  }
  function fireball(pos, s) {
    for (let i = 0; i < 46; i++) spawnParticleSprite(fireballTex, i < 10 ? 0xffffff : (i < 28 ? 0xfde047 : 0xf97316), THREE.AdditiveBlending,
      pos.clone().add(new V3(rand(-3, 3) * s, rand(0, 4) * s, rand(-3, 3) * s)), new V3(rand(-16, 16) * s, rand(4, 26) * s, rand(-16, 16) * s),
      rand(3, 6) * s, rand(11, 20) * s, rand(0.8, 1.9), 0.9, 2.5, 1.0);
    for (let i = 0; i < 14; i++) spawnParticleSprite(fireballTex, 0xff8a3a, THREE.AdditiveBlending,       // огненный столб-«гриб»
      pos.clone().add(new V3(rand(-2, 2) * s, 2 + i * 0.8 * s, rand(-2, 2) * s)), new V3(rand(-3, 3), rand(14, 24) * s, rand(-3, 3)),
      rand(5, 8) * s, rand(14, 22) * s, rand(1.6, 2.8), 0.95, 3, 0.95);
    for (let i = 0; i < 34; i++) spawnParticleSprite(smokeCloudTex, i < 18 ? 0x141210 : 0x3f3a36, THREE.NormalBlending,
      pos.clone().add(new V3(rand(-5, 5) * s, rand(1, 7) * s, rand(-5, 5) * s)), new V3(rand(-7, 7) * s, rand(5, 15) * s, rand(-7, 7) * s),
      rand(5, 8) * s, rand(20, 32) * s, rand(5, 10), 0.96, 1.6, 0.9);
  }
  function charOne(m, f = 0.14) {
    const fix = mt => { const c = mt.clone(); if (c.color) c.color.multiplyScalar(f); if (c.emissive) c.emissive.setRGB(0, 0, 0); c.map = c.map || null; return c; };
    m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material);
  }
  function fling(m, c, power, delay = 0) {
    scene.attach(m);
    const dir = new V3(m.position.x - c.x, 0, m.position.z - c.z); if (dir.length() < 0.6) dir.set(rand(-1, 1), 0, rand(-1, 1)); dir.normalize();
    dir.applyAxisAngle(new V3(0, 1, 0), rand(-0.5, 0.5));
    const p0 = m.position.clone(), dist = rand(9, 30) * power, up = rand(8, 20) * power, T1 = rand(1.4, 2.4);
    const tx = p0.x + dir.x * dist, tz = p0.z + dir.z * dist, gy = MAP.H(tx, tz) + 0.25, st = { t: 0 };
    gsap.to(st, { t: 1, duration: T1, delay, ease: 'none', onUpdate: () => m.position.set(p0.x + (tx - p0.x) * st.t, p0.y + (gy - p0.y) * st.t + up * 4 * st.t * (1 - st.t), p0.z + (tz - p0.z) * st.t) });
    gsap.to(m.rotation, { x: m.rotation.x + rand(-7, 7), y: m.rotation.y + rand(-4, 4), z: m.rotation.z + rand(-7, 7), duration: T1, delay, ease: 'none' });
    charOne(m, 0.2);
  }
  function explodeGas() {
    const gs = MAP.gas; if (!gs || GAS.exploded) return;
    GAS.exploded = true; GAS.burning = false;
    const c = gs.center.clone();
    // --- вспышка, огненный шар, вторичные взрывы колонок и магазина
    const light = new THREE.PointLight(0xffa040, 5, 150); light.position.copy(c).add(new V3(0, 9, 0)); scene.add(light);
    gsap.to(light, { intensity: 0, duration: 1.8, onComplete: () => scene.remove(light) });
    fireball(c.clone().add(new V3(0, 2, 0)), 1);
    boom(1, 2600, 3.4);
    gs.pumpPos.forEach((pp, i) => gsap.delayedCall(0.18 + i * 0.22 + Math.random() * 0.1, () => { fireball(pp.clone().add(new V3(0, 1, 0)), 0.45); boom(0.8, 1800, 1.6); G.shake = Math.max(G.shake || 0, 0.5); }));
    gsap.delayedCall(1.25, () => { fireball(gs.shop.clone().add(new V3(0, 2, 0)), 0.75); boom(1, 2200, 2.6); G.shake = Math.max(G.shake || 0, 0.8); });
    // --- ударная волна по земле
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe2b8, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
    ring.position.copy(c).add(new V3(0, 0.6, 0)); scene.add(ring);
    gsap.to(ring.scale, { x: 70, z: 70, duration: 1.0, ease: 'power1.out' });
    gsap.to(ring.material, { opacity: 0, duration: 1.0, ease: 'power2.in', onComplete: () => scene.remove(ring) });
    for (let i = 0; i < 40; i++) { const a = i / 40 * 6.283; spawnParticleSprite(smokeCloudTex, MAP.dustColor, THREE.NormalBlending, c.clone().add(new V3(Math.cos(a) * 7, 0.6, Math.sin(a) * 7)), new V3(Math.cos(a) * rand(18, 30), rand(0.5, 3), Math.sin(a) * rand(18, 30)), 2.5, rand(8, 13), rand(1.6, 2.6), 0.93, 0.4, 0.6); }
    G.shake = clamp(1.6 - camera.position.distanceTo(c) / 220, 0.25, 1.6);
    // --- постройка: навес и колонки разлетаются, магазин обгорает
    const pr = gs.parts;
    pr.brand.visible = false;
    fling(pr.canopy, c, 0.55); fling(pr.fascia, c, 0.8);
    pr.pumps.forEach(set => set.forEach(m => fling(m, c, 1.1)));
    pr.loose.forEach(m => fling(m, c, 0.6));
    const junkMats = [new THREE.MeshStandardMaterial({ color: 0x241f1c, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0x5a1a14, roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.6, metalness: 0.5 })];
    for (let i = 0; i < 36; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(rand(0.3, 2.2), rand(0.05, 0.4), rand(0.3, 1.6)), junkMats[i % 3]);
      m.position.copy(c).add(new V3(rand(-7, 7), rand(0.5, 6), rand(-5, 5))); m.castShadow = true; scene.add(m);
      fling(m, c, 1.5, Math.random() * 0.25);
    }
    charMaterials(gs.group);
    MAP.blockers = MAP.blockers.filter(b => !gs.zones.includes(b));
    // --- выжженное пятно
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const cx = cv.getContext('2d');
    const gr = cx.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, 'rgba(8,6,5,0.92)'); gr.addColorStop(0.55, 'rgba(20,14,10,0.7)'); gr.addColorStop(1, 'rgba(30,20,12,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 60; i++) { const a = Math.random() * 6.283, r0 = 20 + Math.random() * 40, r1 = r0 + 30 + Math.random() * 50; cx.strokeStyle = 'rgba(10,8,6,0.35)'; cx.lineWidth = 2 + Math.random() * 5; cx.beginPath(); cx.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0); cx.lineTo(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1); cx.stroke(); }
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(34, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    scorch.position.copy(c).add(new V3(0, 0.16, 0)); scorch.renderOrder = 2; scene.add(scorch);
    // --- долгий пожар
    [c, gs.shop, ...gs.pumpPos].forEach((p, i) => G.wreckFires.push({ obj: { position: p.clone().add(new V3(0, i < 2 ? 0.5 : -1, 0)) }, t: 0, life: 150 }));
    // --- всё вокруг: машины подбрасывает и переворачивает, столбы и знаки валит от эпицентра
    const R = 50;
    MAP.props.forEach(o => {
      if (!o.alive) return;
      const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz); if (d > R) return;
      o.alive = false;
      const k = 1 - d / R, nx = dx / (d || 1), nz = dz / (d || 1), delay = d / 110, obj = o.obj;
      if (o.kind === 'car') {
        const p0 = obj.position.clone(), dist = k * rand(6, 20), up = k * rand(3, 11), T1 = rand(0.9, 1.6), st = { t: 0 };
        const flips = k > 0.45 ? (Math.random() < 0.5 ? 1 : 2) * (Math.random() < 0.5 ? -1 : 1) : 0, lift = Math.abs(flips) === 1 ? 1.7 : 0;
        gsap.to(st, { t: 1, duration: T1, delay, ease: 'none', onUpdate: () => obj.position.set(p0.x + nx * dist * st.t, p0.y + lift * st.t + up * 4 * st.t * (1 - st.t), p0.z + nz * dist * st.t) });
        gsap.to(obj.rotation, { z: obj.rotation.z + flips * Math.PI + rand(-0.15, 0.15), y: obj.rotation.y + rand(-1.5, 1.5) * k, duration: T1, delay, ease: 'none' });
        if (k > 0.3) { charMaterials(obj); o.exploded = true; if (o.wreck) { gsap.killTweensOf(o.wreck); o.wreck.h = 0; } if (o.blocker) { const bi = MAP.blockers.indexOf(o.blocker); if (bi >= 0) MAP.blockers.splice(bi, 1); }
          gsap.delayedCall(delay + rand(0.05, 0.3), () => fireball(obj.position.clone().add(new V3(0, 1, 0)), 0.32));
          gsap.delayedCall(delay + T1, () => G.wreckFires.push({ obj, t: 0, life: 45 })); }
      } else {
        const axis = new V3(nz, 0, -nx), q0 = obj.quaternion.clone(), q1 = new THREE.Quaternion().setFromAxisAngle(axis, Math.PI / 2 * rand(0.85, 1)).multiply(q0), st = { t: 0 };
        gsap.to(st, { t: 1, duration: o.kind === 'pole' ? 1.0 : 0.5, delay, ease: 'power2.in', onUpdate: () => obj.quaternion.copy(q0).slerp(q1, st.t) });
        if (o.kind === 'small') { const dist = k * rand(3, 16); gsap.to(obj.position, { x: obj.position.x + nx * dist, z: obj.position.z + nz * dist, duration: 0.8, delay, ease: 'power2.out' }); }
        if (k > 0.5) obj.traverse(m => { if (m.isMesh && m.material && !Array.isArray(m.material) && m.material.color) { m.material = m.material.clone(); m.material.color.multiplyScalar(0.4); } });
      }
    });
    // --- соседние здания покрываются копотью
    (MAP.townRoots || []).forEach(({ root }) => {
      if (root === gs.root) return;
      const d = Math.hypot(root.position.x - c.x, root.position.z - c.z); if (d > 55) return;
      const f = 0.4 + 0.5 * d / 55;
      root.traverse(m => { if (m.isMesh && m.material) { const fx = mt => { const n = mt.clone(); if (n.color) n.color.multiplyScalar(f); return n; }; m.material = Array.isArray(m.material) ? m.material.map(fx) : fx(m.material); } });
    });
    // --- урон танкам по расстоянию
    showMsg('ЗАПРАВКА ВЗОРВАЛАСЬ!', '#ff8a3a', 2600);
    logLine('Заправка «Desert Gas» взорвалась', '#f97316');
    const RD = 55;
    units.forEach(u => {
      if (!u.alive) return;
      const d = Math.hypot(u.root.position.x - c.x, u.root.position.z - c.z); if (d > RD) return;
      const dmg = Math.round(750 * Math.pow(1 - d / RD, 1.4)); if (dmg >= 10) damageUnit(u, dmg, GAS.shooter, 'взрыв заправки');
    });
    updateHPUI();
  }

  // ---------------------------------------------------------------------------
  // ЦИСТЕРНА С ТОПЛИВОМ (MAP.fuel): попадание снаряда — мощный взрыв, всё вокруг разносит
  // ---------------------------------------------------------------------------
  // пулемёт по цистерне: искры, после десятка попаданий — течь и пламя, через несколько секунд взрыв
  function mgFuel(f, p, shooter) {
    if (f.dead) return;
    f.mgHits = (f.mgHits || 0) + 1;
    spawnParticleSprite(fireballTex, 0xfff2b0, THREE.AdditiveBlending, p, new V3(rand(-3, 3), rand(1, 4), rand(-3, 3)), 0.25, 0.7, 0.15, 0.85, -3, 1);
    if (Math.random() < 0.4) ping(2200 + Math.random() * 900, 0.08, 0.05);
    if (f.burning) { if (f.mgHits > 26) fuelBlast(f, shooter); return; }      // добивание горящей — взрыв сразу
    if (f.mgHits < 10) return;
    f.burning = true;
    const gp = new V3(p.x, MAP.H(p.x, p.z) + 0.3, p.z);
    G.wreckFires.push({ obj: { position: p.clone() }, t: 0, life: 5 }, { obj: { position: gp }, t: 0, life: 5 });
    for (let i = 0; i < 10; i++) spawnParticleSprite(fireballTex, 0xffa040, THREE.AdditiveBlending, p.clone(), new V3(rand(-2, 2), rand(2, 6), rand(-2, 2)), 0.5, 2.2, rand(0.4, 0.8), 0.9, 1.5, 0.9);
    boom(volByDist(camera.position.distanceTo(p)) * 0.5, 900, 0.6);
    if (shooter && shooter.isPlayer) showMsg('ЦИСТЕРНА ГОРИТ — СЕЙЧАС РВАНЁТ!', '#ffb23a', 2200);
    logLine(`${f.name || 'Цистерна'}: пробита из пулемёта, топливо горит`, '#f59e0b');
    gsap.delayedCall(rand(2.8, 4.2), () => fuelBlast(f, shooter));
  }
  // ---------------------------------------------------------------------------
  // ПИКАПЫ В ГОРОДКЕ (MAP.props с car:true): взрыв от снаряда, от соседнего взрыва, от пулемёта
  // ---------------------------------------------------------------------------
  function carBlast(cp, shooter, delay = 0) {
    if (!cp || cp.exploded) return; cp.exploded = true; cp.alive = false;
    const go = () => {
      if (cp.wreck) { gsap.killTweensOf(cp.wreck); cp.wreck.h = 0; }
      const obj = cp.obj, c = obj.position.clone().add(new V3(0, 0.9, 0));
      const k = MAP.blockers.indexOf(cp.blocker); if (k >= 0) MAP.blockers.splice(k, 1);
      fireball(c, 0.38); boom(volByDist(camera.position.distanceTo(c)) * 0.9, 1500, 1.4);
      for (let i = 0; i < 14; i++) spawnParticleSprite(smokeCloudTex, 0x2a2622, THREE.NormalBlending, c.clone(), new V3(rand(-3, 3), rand(3, 8), rand(-3, 3)), 1.5, rand(5, 8), rand(2.5, 4), 0.95, 1.2, 0.8);
      const light = new THREE.PointLight(0xffa040, 3, 40); light.position.copy(c).add(new V3(0, 2, 0)); scene.add(light); gsap.to(light, { intensity: 0, duration: 0.9, onComplete: () => scene.remove(light) });
      // корпус подбрасывает и переворачивает, кузов обгорает
      const p0 = obj.position.clone(), up = rand(1.6, 3.6), T1 = rand(0.8, 1.1), st = { t: 0 }, roll = Math.random() < 0.35 ? Math.PI * (Math.random() < 0.5 ? 1 : -1) : rand(-0.5, 0.5);
      gsap.to(st, { t: 1, duration: T1, ease: 'none', onUpdate: () => obj.position.set(p0.x, p0.y + up * 4 * st.t * (1 - st.t) + (Math.abs(roll) > 3 ? 1.2 * st.t : 0), p0.z) });
      gsap.to(obj.rotation, { x: obj.rotation.x + roll, y: obj.rotation.y + rand(-0.6, 0.6), duration: T1, ease: 'none' });
      charMaterials(obj);
      gsap.delayedCall(T1, () => { G.wreckFires.push({ obj, t: 0, life: 40 }); groundImpact(p0, true); });
      if (camera.position.distanceTo(c) < 60) G.shake = Math.max(G.shake || 0, 0.35);
      // урон танкам рядом и цепная реакция на соседние машины
      units.forEach(u => { if (!u.alive) return; const d = u.root.position.distanceTo(c); if (d < 11) { const dmg = Math.round(240 * (1 - d / 11)); if (dmg > 8) damageUnit(u, dmg, shooter, 'взрыв машины'); } });
      MAP.props.forEach(o => { if (o.car && !o.exploded && o !== cp) { const d = Math.hypot(o.x - p0.x, o.z - p0.z); if (d < 8.5) carBlast(o, shooter, 0.35 + d * 0.06 + Math.random() * 0.3); } });
      if (MAP.gas && typeof GAS !== 'undefined' && !GAS.exploded && MAP.gas.center && MAP.gas.center.distanceTo(c) < 11) gasHit('ignite', c, shooter);
      logLine('Машина взорвалась', '#f59e0b');
    };
    if (delay > 0) gsap.delayedCall(delay, go); else go();
  }
  function mgCar(cp, p, shooter) {
    if (cp.exploded) return;
    cp.mg = (cp.mg || 0) + 1;
    spawnParticleSprite(fireballTex, 0xfff2b0, THREE.AdditiveBlending, p, new V3(rand(-3, 3), rand(1, 4), rand(-3, 3)), 0.22, 0.6, 0.15, 0.85, -3, 1);
    if (Math.random() < 0.35) ping(2400 + Math.random() * 900, 0.07, 0.05);
    if (cp.mg === 14) {                                                   // пробит бак: горит, через пару секунд взрыв
      G.wreckFires.push({ obj: { position: cp.obj.position.clone().add(new V3(0, 0.8, 0)) }, t: 0, life: 4 });
      gsap.delayedCall(rand(2.2, 3.4), () => carBlast(cp, shooter));
    }
  }
  function fuelBlast(f, shooter) {
    if (f.dead) return; f.dead = true;
    const c = f.center.clone(), gy = MAP.H(c.x, c.z);
    const i0 = MAP.boxes.indexOf(f.box); if (i0 >= 0) MAP.boxes.splice(i0, 1);
    MAP.blockers = MAP.blockers.filter(b => b !== f.blocker);
    const light = new THREE.PointLight(0xffa040, 5, 160); light.position.copy(c).add(new V3(0, 8, 0)); scene.add(light);
    gsap.to(light, { intensity: 0, duration: 2.0, onComplete: () => scene.remove(light) });
    fireball(c.clone(), 1.15); boom(1, 2600, 3.6);
    for (let i = 0; i < 3; i++) gsap.delayedCall(0.25 + i * 0.3, () => { fireball(c.clone().add(new V3(rand(-5, 5), rand(0, 3), rand(-5, 5))), 0.55); boom(0.8, 1900, 1.8); G.shake = Math.max(G.shake || 0, 0.6); });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe2b8, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
    ring.position.set(c.x, gy + 0.6, c.z); scene.add(ring);
    gsap.to(ring.scale, { x: 75, z: 75, duration: 1.0, ease: 'power1.out' });
    gsap.to(ring.material, { opacity: 0, duration: 1.0, ease: 'power2.in', onComplete: () => scene.remove(ring) });
    for (let i = 0; i < 40; i++) { const a = i / 40 * 6.283; spawnParticleSprite(smokeCloudTex, MAP.dustColor, THREE.NormalBlending, new V3(c.x + Math.cos(a) * 6, gy + 0.6, c.z + Math.sin(a) * 6), new V3(Math.cos(a) * rand(18, 30), rand(0.5, 3), Math.sin(a) * rand(18, 30)), 2, rand(8, 13), rand(1.6, 2.6), 0.93, 0.2, 0.6); }
    G.shake = clamp(1.7 - camera.position.distanceTo(c) / 230, 0.25, 1.7);
    // сама цистерна: куски разлетаются, остов обгорает
    const meshes = []; f.root.traverse(m => { if (m.isMesh) meshes.push(m); });
    meshes.forEach((m, i) => { if (i % 2 === 0) { scene.attach(m); fling(m, c, 1.2, Math.random() * 0.15); } });
    charMaterials(f.root);
    const junk = [new THREE.MeshStandardMaterial({ color: 0x241f1c, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.6, metalness: 0.5 })];
    for (let i = 0; i < 30; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(rand(0.3, 2.4), rand(0.05, 0.3), rand(0.3, 1.6)), junk[i % 2]); m.position.copy(c).add(new V3(rand(-4, 4), rand(0, 3), rand(-4, 4))); m.castShadow = true; scene.add(m); fling(m, c, 1.6, Math.random() * 0.25); }
    // выжженное пятно и долгий пожар
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const cx = cv.getContext('2d');
    const gr = cx.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, 'rgba(8,6,5,0.92)'); gr.addColorStop(0.55, 'rgba(20,14,10,0.7)'); gr.addColorStop(1, 'rgba(30,20,12,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 256, 256);
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(30, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    scorch.position.set(c.x, gy + 0.2, c.z); scorch.renderOrder = 2; scene.add(scorch);
    for (let i = 0; i < 3; i++) G.wreckFires.push({ obj: { position: new V3(c.x + rand(-3, 3), gy + 0.5, c.z + rand(-3, 3)) }, t: 0, life: 150 });
    // всё вокруг: столбы, вешки, бочки, мишени
    const R = 48;
    MAP.props.forEach(o => {
      if (!o.alive) return; const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz); if (d > R) return;
      o.alive = false; const k = 1 - d / R, nx = dx / (d || 1), nz = dz / (d || 1), obj = o.obj, delay = d / 110;
      const axis = new V3(nz, 0, -nx), q0 = obj.quaternion.clone(), q1 = new THREE.Quaternion().setFromAxisAngle(axis, Math.PI / 2 * rand(0.85, 1)).multiply(q0), st = { t: 0 };
      gsap.to(st, { t: 1, duration: o.kind === 'pole' ? 1.0 : 0.5, delay, ease: 'power2.in', onUpdate: () => obj.quaternion.copy(q0).slerp(q1, st.t) });
      if (o.kind !== 'pole') { const dist = k * rand(4, 18); gsap.to(obj.position, { x: obj.position.x + nx * dist, z: obj.position.z + nz * dist, duration: 0.8, delay, ease: 'power2.out' }); }
    });
    MAP.blockers.slice().forEach(b => {
      const p = b.getWorldPosition(new V3()), d = Math.hypot(p.x - c.x, p.z - c.z);
      if (b.userData.onHit && d < R) b.userData.onHit(p);                                    // мишени падают
      else if (b.userData.bld && !b.userData.bld.dead && d < 32) gsap.delayedCall(0.4, () => collapseBuilding(b.userData.bld));
      else if (b.userData.fuel && !b.userData.fuel.dead && d < 45) gsap.delayedCall(0.5, () => fuelBlast(b.userData.fuel, shooter));
    });
    showMsg('ЦИСТЕРНА ВЗОРВАЛАСЬ!', '#ff8a3a', 2600); logLine(`${f.name || 'Цистерна'}: взрыв топлива`, '#f97316');
    const RD = 58;
    units.forEach(u => { if (!u.alive) return; const d = Math.hypot(u.root.position.x - c.x, u.root.position.z - c.z); if (d > RD) return; const dmg = Math.round(800 * Math.pow(1 - d / RD, 1.4)); if (dmg >= 10) damageUnit(u, dmg, shooter, 'взрыв цистерны'); });
    updateHPUI();
  }

  function updateWrecks(dt) {
    G.wreckFires.forEach(w => {
      w.t += dt; if (w.t > w.life) return;
      w.acc = (w.acc || 0) + dt;
      if (w.acc < 0.09) return; w.acc = 0;
      const p = w.obj.position;
      spawnParticleSprite(fireballTex, Math.random() < 0.5 ? 0xf97316 : 0xfbbf24, THREE.AdditiveBlending,
        new V3(p.x + rand(-1.2, 1.2), p.y + 1.6 + rand(0, 0.8), p.z + rand(-1.2, 1.2)), new V3(rand(-0.5, 0.5), rand(1.5, 3), rand(-0.5, 0.5)),
        0.7, 1.6, rand(0.4, 0.8), 0.95, 1.0, 0.85);
      spawnParticleSprite(smokeCloudTex, 0x1c1917, THREE.NormalBlending,
        new V3(p.x + rand(-1, 1), p.y + 2.5, p.z + rand(-1, 1)), new V3(rand(-0.6, 0.6), rand(2, 4), rand(-0.6, 0.6)),
        1.2, 5.5, rand(3, 5), 0.97, 0.7, 0.7);
    });
  }

  // ---------------------------------------------------------------------------
  // 14. КАМЕРА WoT-СТИЛЯ И НАВЕДЕНИЕ ИГРОКА
  // ---------------------------------------------------------------------------
  const aimRay = new THREE.Raycaster();
  const camDir = new V3();
  function updateCamera(dt) {
    const PL = G.PL; if (!PL) return;
    const sl = G.sniper ? 1 / G.sniperZoom : 1;
    if (held.camLeft) G.camYaw += 1.6 * dt * sl;
    if (held.camRight) G.camYaw -= 1.6 * dt * sl;
    if (held.camUp) G.camPitch -= 0.8 * dt * sl;
    if (held.camDown) G.camPitch += 0.8 * dt * sl;
    G.camPitch = clamp(G.camPitch, G.sniper ? -0.25 : -0.32, G.sniper ? 0.35 : 1.1);
    camDir.set(Math.sin(G.camYaw) * Math.cos(G.camPitch), -Math.sin(G.camPitch), Math.cos(G.camYaw) * Math.cos(G.camPitch));
    const tp = PL.root.position;
    if (G.sniper) {
      const gp = gunWorldPos(tmpV2);
      camera.position.set(gp.x, gp.y + 0.55, gp.z).addScaledVector(camDir, 0.8);
      const fov = 55 / G.sniperZoom;
      if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    } else {
      const pivot = tmpV2.set(tp.x, tp.y + PL.T.camH, tp.z);
      // камера не уходит в здания: укорачиваем дистанцию до ближайшей стены
      let camD = G.camDist;
      const back = tmpV.copy(camDir).negate();
      for (const bx of MAP.boxes) { const t = MAP.rayBox(pivot, back, camD, bx); if (t !== null) camD = Math.max(2.5, Math.min(camD, t - 0.6)); }
      camera.position.copy(pivot).addScaledVector(camDir, -camD);
      const gH = MAP.H(camera.position.x, camera.position.z) + 1.2;
      if (camera.position.y < gH) camera.position.y = gH;
      if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
    }
    camera.lookAt(tmpV3.copy(camera.position).add(camDir));
    if (G.shake > 0.01) {   // тряска камеры от взрывов
      camera.position.x += (Math.random() - 0.5) * G.shake; camera.position.y += (Math.random() - 0.5) * G.shake * 0.6; camera.position.z += (Math.random() - 0.5) * G.shake;
      camera.rotation.z += (Math.random() - 0.5) * G.shake * 0.03;
      G.shake *= Math.exp(-dt * 2.4);
    }
    // точка прицеливания: луч из центра экрана
    aimRay.set(camera.position, camDir); aimRay.near = G.sniper ? 1 : G.camDist + 2; aimRay.far = CFG.maxAimDist;
    const hits = aimRay.intersectObjects(othersHitboxes(PL).concat(MAP.blockers), false);
    let pt = hits.length ? hits[0].point : null;
    const td = MAP.raycastTerrain(camera.position, camDir, CFG.maxAimDist, aimRay.near);
    if (td !== null && (!pt || td < pt.distanceTo(camera.position))) pt = tmpV3.copy(camera.position).addScaledVector(camDir, td);
    if (!pt) pt = tmpV3.copy(camera.position).addScaledVector(camDir, CFG.maxAimDist);
    G.aimPoint.copy(pt);
  }
  function updatePlayerAim(dt) {
    const PL = G.PL; if (!PL || !PL.alive) return;
    PL.root.updateMatrixWorld(true);
    G.aimDist = gunWorldPos(tmpV).distanceTo(G.aimPoint);
    aimUnit(PL, G.aimPoint, dt);
    const D = PL.T.disp;
    const target = D.base + Math.abs(PL.speed) * D.move + Math.abs(PL.yawVel) * D.hullTurn + PL.turretRate * D.turret;
    G.disp = G.disp > target ? target + (G.disp - target) * Math.exp(-dt * D.aimRate) : target;
  }

  // ---------------------------------------------------------------------------
  // 15. HUD
  // ---------------------------------------------------------------------------
  const proj = new V3();
  function toScreen(v, out) {
    proj.copy(v).project(camera);
    const w = window.innerWidth, h = window.innerHeight;
    out.x = (proj.x * 0.5 + 0.5) * w; out.y = (-proj.y * 0.5 + 0.5) * h; out.behind = proj.z > 1;
    return out;
  }
  const scr = {};
  function updateHPUI() {
    units.forEach(u => {
      const pc = Math.max(0, u.hp) / u.T.hp * 100;
      if (u.pip) { u.pip.firstChild.style.width = pc + '%'; u.pip.classList.toggle('dead', !u.alive); u.pip.classList.toggle('me', u === G.PL); }
      u.elBar.style.width = pc + '%';
    });
    const PL = G.PL; if (!PL) return;
    const pp = Math.max(0, PL.hp) / PL.T.hp * 100;
    $('bt-php2').style.width = pp + '%'; $('bt-php2').style.background = pp > 50 ? '#4ade80' : pp > 25 ? '#facc15' : '#ef4444';
    $('bt-php2-t').textContent = `${Math.max(0, PL.hp)} / ${PL.T.hp} HP`;
    $('bt-t0-n').textContent = `${teamAlive(G.playerTeam).length} / ${CFG.teamSize}`;
    $('bt-t1-n').textContent = `${teamAlive(1 - G.playerTeam).length} / ${CFG.teamSize}`;
  }
  function updateHUD() {
    const w = window.innerWidth, h = window.innerHeight, PL = G.PL;
    const tl = Math.max(0, G.timeLeft);
    $('bt-timer').textContent = `${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')}`;
    $('bt-timer').style.color = tl < 60 ? '#ff6b5a' : '#e7eadf';
    if (!PL) return;
    $('bt-speed').textContent = `${Math.round(Math.abs(PL.speed) * 3.6)} км/ч`;
    // маркер орудия (куда реально смотрит ствол) и круг сведения
    const marker = $('bt-marker'), loading = PL.reload > 0;
    if (PL.alive) {
      const m = new V3(), d = new V3(); KIN[PL.type].muzzle(PL, m, d);
      toScreen(m.addScaledVector(d, Math.max(10, G.aimDist)), scr);
      const r = clamp(G.disp / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * (h / 2), 7, 260);
      marker.style.display = scr.behind ? 'none' : 'block';
      marker.style.left = scr.x + 'px'; marker.style.top = scr.y + 'px';
      marker.style.width = marker.style.height = (r * 2) + 'px';
      marker.classList.toggle('reload', loading);
    } else marker.style.display = 'none';
    const pct = clamp(1 - PL.reload / PL.T.reload, 0, 1) * 100;
    $('bt-reloadbar-f').style.width = pct + '%';
    $('bt-reloadbar-f').style.background = loading ? '#f59e0b' : '#4ade80';
    $('bt-reload-t').textContent = !PL.alive ? 'ПОДБИТ' : loading ? `${PL.T.gun}: ${PL.reload.toFixed(1)} с` : `${PL.T.gun}: ГОТОВ`;
    $('bt-reload-ring').textContent = loading && PL.alive ? PL.reload.toFixed(1) : '';
    // метки танков
    let nearest = null, nd = 1e9;
    for (const u of units) {
      if (u === PL || !u.alive) { u.el.style.display = 'none'; continue; }
      toScreen(tmpV.copy(u.root.position).setY(u.root.position.y + u.T.labelH), scr);
      const dist = u.root.position.distanceTo(PL.root.position), enemy = u.team !== G.playerTeam;
      const on = !scr.behind && scr.x > 0 && scr.x < w && scr.y > 0 && scr.y < h;
      if (on) { u.el.style.display = 'block'; u.el.style.left = scr.x + 'px'; u.el.style.top = scr.y + 'px'; u.elDist.textContent = `${Math.round(dist)} м`; }
      else { u.el.style.display = 'none'; if (enemy && dist < nd) { nd = dist; nearest = { x: scr.x, y: scr.y, behind: scr.behind }; } }
    }
    const arrow = $('bt-earrow');
    if (nearest && G.phase !== 'over') {
      let ax = nearest.x - w / 2, ay = nearest.y - h / 2; if (nearest.behind) { ax = -ax; ay = -ay; }
      const ang = Math.atan2(ay, ax), R = Math.min(w, h) * 0.42;
      arrow.style.display = 'block'; arrow.style.left = (w / 2 + Math.cos(ang) * R - 11) + 'px'; arrow.style.top = (h / 2 + Math.sin(ang) * R - 11) + 'px';
      arrow.style.transform = `rotate(${ang + Math.PI / 2}rad)`;
    } else arrow.style.display = 'none';
    if (dirHitPoint) { const rel = Math.atan2(dirHitPoint.x - PL.root.position.x, dirHitPoint.z - PL.root.position.z) - G.camYaw; $('bt-dirhit').style.transform = `rotate(${-rel}rad)`; }
    drawMinimap();
  }
  const mm = $('bt-minimap'), mctx = mm.getContext('2d');
  // подложка миникарты: рельеф с отмывкой
  const mmBg = document.createElement('canvas');
  const MS = mm.width, MK = (MS / 2) * 0.98, MU = MS / 210;                 // MU — масштаб значков относительно старой карты
  let MF = 1;                                                                // 1 — север сверху; -1 — карта развёрнута, чтобы своя команда была снизу
  const toM = (x, z) => [MS / 2 - MF * x / RANGE_HALF * MK, MS / 2 - MF * z / RANGE_HALF * MK];
  HOTKEYS.KeyM = () => { if (G.phase === 'battle' || G.phase === 'countdown') mm.classList.toggle('big'); };
  function mmText(g, t, x, y, o = {}) {
    g.font = `${o.bold === false ? '' : '600 '}${(o.size || 6.2) * MU}px ${o.mono ? 'JetBrains Mono, monospace' : 'Rajdhani, Arial, sans-serif'}`; g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
    g.lineWidth = 2.2 * MU * 0.6; g.strokeStyle = 'rgba(8,12,8,.85)'; g.lineJoin = 'round'; g.strokeText(t, x, y); g.fillStyle = o.color || '#f1f3e6'; g.fillText(t, x, y);
  }
  function buildMinimapBg() {
    const S = MS; mmBg.width = mmBg.height = S;
    const g = mmBg.getContext('2d'), R = 320, small = document.createElement('canvas'); small.width = small.height = R;
    const sg = small.getContext('2d'), img = sg.createImageData(R, R), half = RANGE_HALF, kk = (R / 2) * 0.98;
    const sand = [196, 158, 108], rock = [168, 82, 48], n = new V3(), hs = new Float32Array(R * R);
    let hmin = 1e9, hmax = -1e9;
    for (let py = 0; py < R; py++) for (let px = 0; px < R; px++) {
      const x = MF * (R / 2 - px) / kk * half, z = MF * (R / 2 - py) / kk * half;
      const h = MAP.H(x, z), gr = MAP.grade(x, z);
      hs[py * R + px] = h; if (Math.abs(x) < half && Math.abs(z) < half) { hmin = Math.min(hmin, h); hmax = Math.max(hmax, h); }
      MAP.normalAt(x, z, n);
      const shade = clamp(0.62 + 0.7 * n.dot(MAP.SUN_DIR) - 0.3, 0.45, 1.25);
      const t = clamp(gr * 1.4 + (h - 10) / 40, 0, 1);
      const o = (py * R + px) * 4;
      const mc = MAP.minimapColor ? MAP.minimapColor(x, z, h, gr) : null;
      for (let c = 0; c < 3; c++) img.data[o + c] = clamp((mc ? mc[c] * 1.15 : sand[c] * (1 - t) + rock[c] * t) * shade * 0.92, 0, 255);
      img.data[o + 3] = 255;
    }
    // горизонтали: линии равных высот
    const span = hmax - hmin, step = span < 4 ? 0 : span < 16 ? 2 : span < 60 ? 5 : span < 320 ? 10 : 25;
    if (step) for (let py = 1; py < R; py++) for (let px = 1; px < R; px++) {
      const a = Math.floor(hs[py * R + px] / step + 0.5), b1 = Math.floor(hs[py * R + px - 1] / step + 0.5), b2 = Math.floor(hs[(py - 1) * R + px] / step + 0.5);
      if (a !== b1 || a !== b2) { const o = (py * R + px) * 4, major = (Math.max(a, b1, b2) % 5) === 0, k = major ? 0.62 : 0.8; img.data[o] *= k; img.data[o + 1] *= k; img.data[o + 2] *= k; }
    }
    sg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(small, 0, 0, S, S);
    // скальные формации
    g.fillStyle = 'rgba(120,45,25,0.95)';
    (MAP.formations || []).forEach(f => { g.beginPath(); g.arc(S / 2 - MF * f.x / half * MK, S / 2 - MF * f.z / half * MK, Math.max(2, f.r / half * MK), 0, Math.PI * 2); g.fill(); });
    // граница поля боя
    const pl = (MAP.PLAY || half - 30) / half * MK; g.strokeStyle = 'rgba(255,235,170,.55)'; g.setLineDash([6 * MU, 4 * MU]); g.lineWidth = 1 * MU; g.strokeRect(S / 2 - pl, S / 2 - pl, pl * 2, pl * 2); g.setLineDash([]);
    // сетка квадратов 200 м: буквы по горизонтали, цифры по вертикали
    const cell = 200 / half * MK, n5 = Math.round(half * 2 / 200);
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 0.6 * MU;
    for (let i = 0; i <= n5; i++) { const p = S / 2 - MK + i * cell; g.beginPath(); g.moveTo(p, S / 2 - MK); g.lineTo(p, S / 2 + MK); g.moveTo(S / 2 - MK, p); g.lineTo(S / 2 + MK, p); g.stroke(); }
    for (let i = 0; i < n5; i++) { const p = S / 2 - MK + (i + 0.5) * cell; mmText(g, 'ABCDEFGH'[MF > 0 ? i : n5 - 1 - i], p, S / 2 - MK + 6 * MU, { size: 5.6, color: 'rgba(240,240,220,.75)', mono: true }); mmText(g, String((MF > 0 ? i : n5 - 1 - i) + 1), S / 2 - MK + 5 * MU, p, { size: 5.6, color: 'rgba(240,240,220,.75)', mono: true }); }
  }
  buildMinimapBg();
  // подписи и значки объектов карты
  const mmLabels = (MAP.labels || []).slice();
  if (MAP.TOWN) mmLabels.push({ x: MAP.TOWN.x, z: MAP.TOWN.z + (MAP.TOWN.hz || 0) + 22, text: 'Red Mesa' });
  const mmBases = [{ p: MAP.playerSpawn, team: 0 }, { p: MAP.enemySpawn, team: 1 }];
  function mmFuel(x, z, dead, label) {
    const [px, py] = toM(x, z), r = 4.2 * MU;
    mctx.beginPath(); mctx.moveTo(px, py - r * 1.25); mctx.lineTo(px + r, py + r * 0.8); mctx.lineTo(px - r, py + r * 0.8); mctx.closePath();
    mctx.fillStyle = dead ? '#3a3531' : '#ffb020'; mctx.fill(); mctx.lineWidth = 1 * MU; mctx.strokeStyle = '#1a1206'; mctx.stroke();
    if (!dead) { mctx.fillStyle = '#1a1206'; mctx.font = `700 ${5.4 * MU}px Arial`; mctx.textAlign = 'center'; mctx.textBaseline = 'middle'; mctx.fillText('!', px, py + r * 0.1); }
    if (label) mmText(mctx, label, px, py + r * 1.9, { size: 5, color: dead ? '#9a958c' : '#ffd27a' });
  }
  function drawMinimap() {
    const S = MS, half = RANGE_HALF, PL = G.PL, big = mm.classList.contains('big');
    const wantF = (MAP.playerSpawn.z < MAP.enemySpawn.z) === (G.playerTeam === 0) ? 1 : -1;      // своя база — внизу карты
    if (wantF !== MF) { MF = wantF; buildMinimapBg(); }
    mctx.clearRect(0, 0, S, S);
    mctx.drawImage(mmBg, 0, 0);
    // строения, вагоны, контейнеры
    MAP.boxes.forEach(b => {
      const [bx, by] = toM(b.x, b.z), w = Math.max(1.6 * MU, b.hw / half * MK * 2), d = Math.max(1.6 * MU, b.hd / half * MK * 2);
      mctx.save(); mctx.translate(bx, by); mctx.rotate(b.rot);
      mctx.fillStyle = b.bridge ? '#b9b3a4' : 'rgba(58,50,46,.95)'; mctx.fillRect(-w / 2, -d / 2, w, d);
      mctx.strokeStyle = 'rgba(235,225,200,.7)'; mctx.lineWidth = 0.5 * MU; mctx.strokeRect(-w / 2, -d / 2, w, d); mctx.restore();
    });
    // мишени
    if (MAP.id === 'training') rangeTargets.forEach(t => { const [x, y] = toM(t.root.position.x, t.root.position.z), r = 1.7 * MU; mctx.fillStyle = t.fallen ? 'rgba(60,60,60,.8)' : '#f4f1e6'; mctx.fillRect(x - r, y - r, r * 2, r * 2); if (!t.fallen) { mctx.fillStyle = '#d33a2c'; mctx.fillRect(x - r * 0.4, y - r * 0.4, r * 0.8, r * 0.8); } });
    // топливо
    (MAP.fuel || []).forEach(f => mmFuel(f.center.x, f.center.z, f.dead, big ? f.name : ''));
    if (MAP.gas && MAP.gas.center) mmFuel(MAP.gas.center.x, MAP.gas.center.z, GAS.exploded, big ? 'АЗС' : '');
    // базы команд
    mmBases.forEach(bz => { const [x, y] = toM(bz.p.x, bz.p.z), mine = bz.team === G.playerTeam; mctx.strokeStyle = mine ? 'rgba(125,255,138,.85)' : 'rgba(255,90,70,.85)'; mctx.lineWidth = 1.1 * MU; mctx.setLineDash([3 * MU, 2 * MU]); mctx.beginPath(); mctx.arc(x, y, 14 * MU, 0, 6.283); mctx.stroke(); mctx.setLineDash([]); });
    // подписи
    mmLabels.forEach(l => { if (l.big && !big) return; const [x, y] = toM(l.x, l.z); mmText(mctx, l.text, x, y, { size: l.size || 5.4, color: l.color || '#f3efd8' }); });
    // сектор обзора и линия прицела игрока
    if (PL) {
      const [px, py] = toM(PL.root.position.x, PL.root.position.z), ca = Math.atan2(-MF * Math.cos(G.camYaw), -MF * Math.sin(G.camYaw));
      const gr = mctx.createRadialGradient(px, py, 0, px, py, 70 * MU); gr.addColorStop(0, 'rgba(255,255,255,.30)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      mctx.fillStyle = gr; mctx.beginPath(); mctx.moveTo(px, py); mctx.arc(px, py, 70 * MU, ca - 0.42, ca + 0.42); mctx.closePath(); mctx.fill();
      if (G.aimPoint && PL.alive) { const [ax, ay] = toM(G.aimPoint.x, G.aimPoint.z); mctx.strokeStyle = 'rgba(255,255,255,.75)'; mctx.lineWidth = 0.7 * MU; mctx.setLineDash([2.5 * MU, 2.5 * MU]); mctx.beginPath(); mctx.moveTo(px, py); mctx.lineTo(ax, ay); mctx.stroke(); mctx.setLineDash([]);
        mctx.lineWidth = 1 * MU; mctx.beginPath(); mctx.arc(ax, ay, 2.6 * MU, 0, 6.283); mctx.moveTo(ax - 4.5 * MU, ay); mctx.lineTo(ax + 4.5 * MU, ay); mctx.moveTo(ax, ay - 4.5 * MU); mctx.lineTo(ax, ay + 4.5 * MU); mctx.stroke(); }
    }
    // танки: стрелка по курсу, номер; подбитые — крест
    for (const u of units) {
      const [x, y] = toM(u.root.position.x, u.root.position.z), mine = u.team === G.playerTeam, col = mine ? '#7dff8a' : '#ff4d3a';
      if (!u.alive) { const r = 3.6 * MU; mctx.strokeStyle = mine ? '#2f6a3a' : '#8a2f25'; mctx.lineWidth = 1.6 * MU; mctx.beginPath(); mctx.moveTo(x - r, y - r); mctx.lineTo(x + r, y + r); mctx.moveTo(x + r, y - r); mctx.lineTo(x - r, y + r); mctx.stroke(); continue; }
      const k = (u === PL ? 1.0 : 0.82) * MU;
      mctx.save(); mctx.translate(x, y); mctx.rotate(-u.heading + (MF < 0 ? Math.PI : 0));
      mctx.beginPath(); mctx.moveTo(0, -7 * k); mctx.lineTo(5 * k, 5.5 * k); mctx.lineTo(0, 3 * k); mctx.lineTo(-5 * k, 5.5 * k); mctx.closePath();
      mctx.fillStyle = u === PL ? '#ffffff' : col; mctx.fill(); mctx.lineWidth = (u === PL ? 1.6 : 1.1) * MU; mctx.strokeStyle = u === PL ? col : 'rgba(10,14,10,.9)'; mctx.stroke();
      mctx.restore();
      mmText(mctx, String(u.n + 1), x + 6.5 * MU, y - 5.5 * MU, { size: 5, color: col, mono: true });
      // полоска прочности
      const w = 9 * MU, hp = clamp(u.hp / u.T.hp, 0, 1); mctx.fillStyle = 'rgba(0,0,0,.65)'; mctx.fillRect(x - w / 2, y + 6.5 * MU, w, 1.5 * MU); mctx.fillStyle = col; mctx.fillRect(x - w / 2, y + 6.5 * MU, w * hp, 1.5 * MU);
    }
    // рамка: стороны света, масштаб, квадрат игрока
    mmText(mctx, MF > 0 ? '▲ С' : '▼ С', S - 16 * MU, 16 * MU, { size: 6, color: '#ffe08a' });
    const bar = 200 / half * MK, bx = 8 * MU, by = S - 9 * MU;
    mctx.fillStyle = 'rgba(0,0,0,.55)'; mctx.fillRect(bx - 3 * MU, by - 9 * MU, bar + 6 * MU, 14 * MU);
    mctx.strokeStyle = '#f1f3e6'; mctx.lineWidth = 1.2 * MU; mctx.beginPath(); mctx.moveTo(bx, by - 3 * MU); mctx.lineTo(bx, by); mctx.lineTo(bx + bar, by); mctx.lineTo(bx + bar, by - 3 * MU); mctx.stroke();
    mmText(mctx, '200 м', bx + bar / 2, by - 4.5 * MU, { size: 5, mono: true });
    if (PL) { const sq = 'ABCDEFGH'[clamp(Math.floor((half - PL.root.position.x) / 200), 0, 7)] + (clamp(Math.floor((half - PL.root.position.z) / 200), 0, 7) + 1);
      mmText(mctx, `${MAP.name || ''} · ${sq} · M — крупнее`, S - 6 * MU, S - 6 * MU, { size: 4.8, align: 'right', color: 'rgba(240,240,220,.85)' }); }
  }

  // ---------------------------------------------------------------------------
  // 16. ГЛАВНЫЙ ХУК (вызывается из animate() в index.html)
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // ПРОИЗВОДИТЕЛЬНОСТЬ: счётчик FPS (клавиша P) и адаптивное разрешение рендера
  // ---------------------------------------------------------------------------
  const PERF = { frames: 0, t0: performance.now(), fps: 60, low: 0, high: 0, step: 0, show: false };
  const PR_BASE = Math.min(window.devicePixelRatio || 1, 2), PR_STEPS = [1, 0.85, 0.72, 0.62, 0.52].map(k => Math.max(0.75, PR_BASE * k)).filter((v, i, a) => i === 0 || v < a[i - 1] - 0.01);
  const fpsEl = document.createElement('div');
  fpsEl.style.cssText = 'position:fixed;left:12px;top:12px;z-index:60;font:600 13px/1.35 "JetBrains Mono",monospace;color:#d8ffd0;background:rgba(10,14,10,.72);padding:6px 9px;border-radius:4px;pointer-events:none;display:none;white-space:pre';
  document.body.appendChild(fpsEl);
  HOTKEYS.KeyP = () => { PERF.show = !PERF.show; fpsEl.style.display = PERF.show ? 'block' : 'none'; };
  function perfTick() {
    PERF.frames++;
    const now = performance.now(), el = now - PERF.t0;
    if (el < 1000) return;
    PERF.fps = PERF.frames * 1000 / el; PERF.frames = 0; PERF.t0 = now;
    if (!document.hidden && (G.phase === 'battle' || G.phase === 'countdown')) {
      if (PERF.fps < 52) { PERF.low++; PERF.high = 0; } else if (PERF.fps > 58.5) { PERF.high++; PERF.low = 0; } else { PERF.low = 0; PERF.high = 0; }
      if (PERF.low >= 2 && PERF.step < PR_STEPS.length - 1) { PERF.step++; renderer.setPixelRatio(PR_STEPS[PERF.step]); PERF.low = 0; }
      else if (PERF.high >= 6 && PERF.step > 0) { PERF.step--; renderer.setPixelRatio(PR_STEPS[PERF.step]); PERF.high = 0; }
    }
    if (PERF.show) { const ri = renderer.info.render; fpsEl.textContent = `FPS ${PERF.fps.toFixed(0)}\n${(ri.triangles / 1e6).toFixed(2)} млн △ · ${ri.calls} вызовов\nразрешение ×${(PR_STEPS[PERF.step] / PR_BASE).toFixed(2)} (${PR_STEPS[PERF.step].toFixed(2)} dpr)`; }
  }

  window.__battleHook = function (dt) {
    perfTick();
    const PL = G.PL;
    // тень и свет следуют за танком игрока
    const tp = PL ? PL.root.position : (G.playerTeam === 0 ? MAP.playerSpawn : MAP.enemySpawn);
    dirLight.position.set(tp.x + MAP.SUN_DIR.x * 40, tp.y + MAP.SUN_DIR.y * 40, tp.z + MAP.SUN_DIR.z * 40);
    dirLight.target.position.set(tp.x, tp.y, tp.z);
    if (G.phase === 'loading' || G.phase === 'menu') return;
    if (G.paused) { updateCamera(0); return; }

    if (G.phase === 'countdown') {
      G.countdownLeft -= dt;
      const n = Math.floor(G.countdownLeft);
      $('bt-count').textContent = n > 0 ? n : 'В БОЙ!';
      if (G.countdownLeft <= 0) {
        G.phase = 'battle';
        setTimeout(() => { $('bt-count').style.display = 'none'; }, 700);
        logLine(`Бой начался: ${CFG.teamSize} на ${CFG.teamSize}`, '#e7eadf');
      }
    } else if (G.phase === 'battle') {
      G.timeLeft -= dt;
      if (G.timeLeft <= 0) {
        G.timeLeft = 0;
        const a = teamAlive(G.playerTeam).length, b = teamAlive(1 - G.playerTeam).length;
        endBattle(a > b ? 'win' : a < b ? 'lose' : 'draw');
      }
    }
    const active = G.phase === 'battle';
    for (const u of units) {
      if (!u.alive) continue;
      if (active && u.reload > 0) u.reload = Math.max(0, u.reload - dt);
      if (u === PL) {
        const ok = canAct();
        driveUnit(u, ok ? (held.forward ? 1 : 0) - (held.back ? 1 : 0) : 0, ok ? (held.left ? 1 : 0) - (held.right ? 1 : 0) : 0, dt);
      } else aiUpdate(u, dt, active);
    }
    separateUnits(dt);
    updateCamera(dt);
    updatePlayerAim(dt);
    // пулемёт (удерживать)
    if (held.mg && canAct()) { G.mgT = (G.mgT || 0) - dt; if (G.mgT <= 0) { G.mgT = 0.085; mgFire(PL); } }
    // снаряды и гильзы не проходят сквозь рельеф
    for (const pr of activeProjectiles) { const mp = pr.mesh.position; if (mp.y < MAP.H(mp.x, mp.z) + 0.02) pr.life = pr.maxLife; }
    // пересадка на следующий танк команды
    if (PL && !PL.alive && active) {
      G.switchT -= dt;
      if (G.switchT <= 0) {
        const mates = units.filter(u => u.team === G.playerTeam), i0 = mates.indexOf(PL);
        let next = null; for (let k = 1; k <= mates.length; k++) { const c = mates[(i0 + k) % mates.length]; if (c.alive) { next = c; break; } }
        if (next) setPlayer(next, true);
      }
    }
    updateGas(dt);
    updateWrecks(dt);
    updateHUD();
  };

  updateHPUI();
  // отладочный доступ из консоли
  window.__battle = { carBlast, fuelBlast, mgFuel, G, units, CFG, destroyUnit, damageUnit, setPlayer, gasHit, GAS, collapseBuilding, damageBuilding, mgFire };
})();
