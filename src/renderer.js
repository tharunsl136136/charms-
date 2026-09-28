// Desk Charms renderer: a Verlet rope hanging from the top of the screen with a charm on the end.
(() => {
  const api = window.charmsApi;
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');

  const CORD_COLORS = { gold: '#d4af5a', silver: '#c7c9cc', red: '#c8322f', cotton: '#ece2cc' };
  const CHAIN_CORDS = new Set(['gold', 'silver']);
  const SEGMENTS = { short: 10, medium: 18, long: 30 };
  const SIZES = { small: 72, medium: 96, large: 128 };   // charm width in CSS px (height = 4/3 of it)
  const SEG_LEN = 9;
  const GRAVITY = 1400;        // px/s^2
  const DAMPING = 0.994;
  const ITERATIONS = 18;
  const STEP = 1 / 120;
  const CHARM_INV_MASS = 0.18; // the charm is heavier than a bit of string
  const RING_Y = 10 / 160;     // jump ring position inside the 120x160 charm art

  let W = 0, H = 0, dpr = 1;
  let settings = null;
  let pts = [];
  let charmImg = null;
  let charmW = SIZES.medium, charmH = charmW * 4 / 3;

  // interaction state
  const mouse = { x: -9999, y: -9999, history: [] };
  let dragging = null;          // 'charm' | 'pin' | null
  let grab = { dx: 0, dy: 0, sx: 0, sy: 0, moved: false };
  let ignoring = true;
  let lastClick = 0;
  let time = 0;

  // ---------- setup ----------
  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function anchor() {
    return { x: Math.max(20, Math.min(W - 20, settings.anchorX * W)), y: 0 };
  }

  function buildRope() {
    const n = SEGMENTS[settings.length] || SEGMENTS.medium;
    const a = anchor();
    pts = [];
    for (let i = 0; i <= n; i++) {
      const p = { x: a.x, y: a.y + i * SEG_LEN, inv: i === 0 ? 0 : 1 };
      p.px = p.x; p.py = p.y;
      pts.push(p);
    }
    pts[n].inv = CHARM_INV_MASS;
    // a little starting swing so it doesn't look frozen
    pts[n].px -= 6;
  }

  function loadCharm() {
    const c = window.CHARMS.find((x) => x.id === settings.charm) || window.CHARMS[0];
    const svg = c.svg.split('__CORD__').join(CORD_COLORS[settings.cord] || CORD_COLORS.gold);
    const img = new Image();
    img.onload = () => { charmImg = img; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    charmW = SIZES[settings.size] || SIZES.medium;
    charmH = charmW * 4 / 3;
  }

  api.onSettings((s) => {
    const prev = settings;
    settings = s;
    if (!prev || prev.length !== s.length) buildRope();
    else if (prev.anchorX !== s.anchorX && dragging !== 'pin') pts[0].x = pts[0].px = anchor().x;
    if (!prev || prev.charm !== s.charm || prev.cord !== s.cord || prev.size !== s.size) loadCharm();
  });

  // ---------- physics ----------
  function simulate(dt) {
    const last = pts.length - 1;
    const a = anchor();
    if (dragging === 'pin') a.x = Math.max(20, Math.min(W - 20, mouse.x));
    pts[0].x = pts[0].px = a.x; pts[0].y = pts[0].py = 0;

    const breeze = settings.breeze
      ? (Math.sin(time * 0.6) * 0.6 + Math.sin(time * 1.7 + 1.3) * 0.4) * 18
      : 0;

    for (let i = 1; i <= last; i++) {
      const p = pts[i];
      const vx = (p.x - p.px) * DAMPING;
      const vy = (p.y - p.py) * DAMPING;
      p.px = p.x; p.py = p.y;
      p.x += vx + breeze * dt * dt * (i / last);
      p.y += vy + GRAVITY * dt * dt;
    }

    if (dragging === 'charm') {
      pts[last].x = mouse.x - grab.dx;
      pts[last].y = mouse.y - grab.dy;
    }

    for (let k = 0; k < ITERATIONS; k++) {
      for (let i = 0; i < last; i++) {
        const p = pts[i], q = pts[i + 1];
        const dx = q.x - p.x, dy = q.y - p.y;
        const d = Math.hypot(dx, dy) || 0.0001;
        const invP = p.inv, invQ = (dragging === 'charm' && i + 1 === last) ? 0 : q.inv;
        const sum = invP + invQ;
        if (!sum) continue;
        const diff = (d - SEG_LEN) / d / sum;
        p.x += dx * diff * invP; p.y += dy * diff * invP;
        q.x -= dx * diff * invQ; q.y -= dy * diff * invQ;
      }
    }

    // keep everything on screen
    const floor = H - charmH - 4;
    for (let i = 1; i <= last; i++) {
      const p = pts[i];
      if (p.y > floor) { p.y = floor; }
      if (p.x < 4) p.x = 4; else if (p.x > W - 4) p.x = W - 4;
      if (p.y < 0) p.y = 0;
    }
  }

  function charmAngle() {
    const n = pts.length - 1;
    const a = pts[n - 1], b = pts[n];
    return Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2;
  }

  function charmCenter() {
    const e = pts[pts.length - 1];
    const ang = charmAngle();
    const off = charmH * (0.5 - RING_Y);
    return { x: e.x - Math.sin(ang) * off, y: e.y + Math.cos(ang) * off };
  }

  // ---------- drawing ----------
  function drawCord() {
    const color = CORD_COLORS[settings.cord] || CORD_COLORS.gold;
    if (CHAIN_CORDS.has(settings.cord)) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i], q = pts[i + 1];
        const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
        const ang = Math.atan2(q.y - p.y, q.x - p.x);
        ctx.save();
        ctx.translate(mx, my); ctx.rotate(ang);
        ctx.beginPath();
        // alternate links face-on and edge-on so it reads as a chain
        if (i % 2 === 0) ctx.ellipse(0, 0, SEG_LEN * 0.62, 2.6, 0, 0, Math.PI * 2);
        else { ctx.moveTo(-SEG_LEN * 0.62, 0); ctx.lineTo(SEG_LEN * 0.62, 0); }
        ctx.stroke();
        ctx.restore();
      }
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      const e = pts[pts.length - 1];
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    }
  }

  function drawPin() {
    const a = pts[0];
    const hot = dragging === 'pin' || hitPin(mouse.x, mouse.y);
    ctx.fillStyle = CORD_COLORS[settings.cord] || CORD_COLORS.gold;
    ctx.beginPath();
    ctx.roundRect(a.x - 7, 0, 14, hot ? 7 : 5, [0, 0, 4, 4]);
    ctx.fill();
  }

  function drawCharm() {
    if (!charmImg) return;
    const e = pts[pts.length - 1];
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(charmAngle());
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(charmImg, -charmW / 2, -charmH * RING_Y, charmW, charmH);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawCord();
    drawCharm();
    drawPin();
  }

  // ---------- hit testing + click-through ----------
  function hitCharm(x, y) {
    const c = charmCenter();
    return Math.hypot(x - c.x, y - c.y) < charmW * 0.55;
  }
  function hitPin(x, y) {
    return Math.abs(x - pts[0].x) < 14 && y < 16;
  }
  function refreshIgnore() {
    const over = dragging || hitCharm(mouse.x, mouse.y) || hitPin(mouse.x, mouse.y);
    const ignore = !over;
    if (ignore !== ignoring) { ignoring = ignore; api.setIgnore(ignore); }
    document.body.style.cursor = dragging ? 'grabbing' : over ? (hitPin(mouse.x, mouse.y) ? 'ew-resize' : 'grab') : 'default';
  }

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.history.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (mouse.history.length > 6) mouse.history.shift();
    if (dragging === 'charm' && Math.hypot(mouse.x - grab.sx, mouse.y - grab.sy) > 4) grab.moved = true;
    refreshIgnore();
  });

  window.addEventListener('mousedown', (e) => {
    if (e.button === 2) { api.showMenu(); return; }
    if (e.button !== 0) return;
    if (hitPin(e.clientX, e.clientY)) { dragging = 'pin'; return; }
    if (hitCharm(e.clientX, e.clientY)) {
      const last = pts[pts.length - 1];
      dragging = 'charm';
      grab = { dx: e.clientX - last.x, dy: e.clientY - last.y, sx: e.clientX, sy: e.clientY, moved: false };
      mouse.history = [];
    }
  });

  window.addEventListener('mouseup', () => {
    if (dragging === 'pin') {
      settings.anchorX = pts[0].x / W;
      api.updateSettings({ anchorX: settings.anchorX });
    } else if (dragging === 'charm') {
      const last = pts[pts.length - 1];
      const h = mouse.history;
      if (grab.moved && h.length >= 2) {
        // fling: hand the pointer's velocity to the charm
        const a = h[0], b = h[h.length - 1];
        const dt = Math.max(1, b.t - a.t) / 1000;
        const vx = Math.max(-2500, Math.min(2500, (b.x - a.x) / dt));
        const vy = Math.max(-2500, Math.min(2500, (b.y - a.y) / dt));
        last.px = last.x - vx * STEP;
        last.py = last.y - vy * STEP;
      } else {
        const now = performance.now();
        if (now - lastClick < 320) {
          // double-click: next charm
          const ids = window.CHARMS.map((c) => c.id);
          const next = ids[(ids.indexOf(settings.charm) + 1) % ids.length];
          api.updateSettings({ charm: next });
        } else {
          // single click: a little flick
          last.px = last.x + (Math.random() < 0.5 ? -1 : 1) * 10;
        }
        lastClick = now;
      }
    }
    dragging = null;
    refreshIgnore();
  });

  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('resize', () => { resize(); if (settings) buildRope(); });

  // ---------- loop ----------
  let acc = 0, prevT = performance.now();
  function frame(t) {
    const dt = Math.min(0.05, (t - prevT) / 1000);
    prevT = t;
    if (settings && pts.length) {
      acc += dt;
      while (acc >= STEP) { simulate(STEP); time += STEP; acc -= STEP; }
      draw();
    }
    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);
})();
