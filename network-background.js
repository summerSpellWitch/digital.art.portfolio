(() => {
  const canvas = document.querySelector('canvas.page-network');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const LINE_STYLE = 'rgba(52, 56, 60, 0.42)';
  const DOT_FILL = 'rgba(44, 48, 52, 0.78)';
  const DOT_STROKE = 'rgba(38, 42, 46, 0.55)';

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0;
  let h = 0;
  /** Padding beyond viewport so nodes and edges read as continuing off-screen */
  let worldExt = 64;
  let points = [];
  let last = 0;

  function pointCountForSize(cw, ch) {
    const area = Math.max(1, cw * ch);
    const n = Math.round(Math.sqrt(area) / 68);
    return Math.max(18, Math.min(36, n));
  }

  function worldBounds() {
    return {
      minX: -worldExt,
      maxX: w + worldExt,
      minY: -worldExt,
      maxY: h + worldExt,
    };
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function circumcenter(a, b, c) {
    const ax = a[0];
    const ay = a[1];
    const bx = b[0];
    const by = b[1];
    const cx = c[0];
    const cy = c[1];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-12) return null;
    const a2 = ax * ax + ay * ay;
    const b2 = bx * bx + by * by;
    const c2 = cx * cx + cy * cy;
    const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
    const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
    return [ux, uy];
  }

  function insideCircumcircle(d, a, b, c) {
    const o = circumcenter(a, b, c);
    if (!o) return false;
    const r2 = (a[0] - o[0]) ** 2 + (a[1] - o[1]) ** 2;
    const dist2 = (d[0] - o[0]) ** 2 + (d[1] - o[1]) ** 2;
    return dist2 < r2 - 1e-6;
  }

  function delaunayEdges(coords) {
    const n = coords.length;
    if (n < 2) return [];
    if (n === 2) return [[0, 1]];

    const edgeMap = new Map();

    function addEdge(i, j) {
      const a = Math.min(i, j);
      const b = Math.max(i, j);
      edgeMap.set(`${a},${b}`, [a, b]);
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          const a = coords[i];
          const b = coords[j];
          const c = coords[k];
          const bx = b[0] - a[0];
          const by = b[1] - a[1];
          const cx = c[0] - a[0];
          const cy = c[1] - a[1];
          if (Math.abs(bx * cy - by * cx) < 1e-9) continue;

          let ok = true;
          for (let p = 0; p < n; p++) {
            if (p === i || p === j || p === k) continue;
            if (insideCircumcircle(coords[p], a, b, c)) {
              ok = false;
              break;
            }
          }
          if (!ok) continue;
          addEdge(i, j);
          addEdge(j, k);
          addEdge(k, i);
        }
      }
    }

    return Array.from(edgeMap.values());
  }

  function initPoints() {
    const n = pointCountForSize(w, h);
    const { minX, maxX, minY, maxY } = worldBounds();
    const effW = Math.max(1, maxX - minX);
    const effH = Math.max(1, maxY - minY);
    const aspect = effW / effH;
    let cols = Math.max(2, Math.round(Math.sqrt(n * aspect)));
    let rows = Math.max(2, Math.ceil(n / cols));
    while (cols * rows < n) rows += 1;

    const cellW = effW / cols;
    const cellH = effH / rows;
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) cells.push([r, c]);
    }
    shuffleInPlace(cells);

    const vScale = prefersReducedMotion ? 0.35 : 1;
    points = [];
    for (let idx = 0; idx < n; idx++) {
      const [r, c] = cells[idx];
      const jx = rand(-0.42, 0.42) * cellW;
      const jy = rand(-0.42, 0.42) * cellH;
      let x = minX + (c + 0.5) * cellW + jx;
      let y = minY + (r + 0.5) * cellH + jy;
      x = Math.min(maxX, Math.max(minX, x));
      y = Math.min(maxY, Math.max(minY, y));
      points.push({
        x,
        y,
        vx: rand(-48, 48) * vScale,
        vy: rand(-48, 48) * vScale,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function resize() {
    const nextW = Math.max(1, Math.floor(window.innerWidth));
    const nextH = Math.max(1, Math.floor(window.innerHeight));
    if (nextW === w && nextH === h) return;
    w = nextW;
    h = nextH;
    worldExt = Math.max(72, Math.floor(Math.min(w, h) * 0.2));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    last = 0;
    initPoints();
  }

  function step(ts) {
    if (!last) last = ts;
    const dt = Math.min(32, ts - last) / 1000;
    last = ts;

    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;
    ctx.strokeStyle = LINE_STYLE;
    ctx.fillStyle = DOT_FILL;

    const speedMul = prefersReducedMotion ? 0.45 : 1;
    const { minX, maxX, minY, maxY } = worldBounds();
    const steer = prefersReducedMotion ? 7.5 : 14;
    const phaseSpeed = prefersReducedMotion ? 0.45 : 1.35;
    const damping = prefersReducedMotion ? 0.988 : 0.992;

    for (const p of points) {
      p.phase += dt * phaseSpeed;
      p.vx += Math.cos(p.phase) * steer * dt * speedMul;
      p.vy += Math.sin(p.phase * 1.07) * steer * dt * speedMul;
      p.vx *= damping;
      p.vy *= damping;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.x < minX) {
        p.x = minX;
        p.vx *= -1;
      } else if (p.x > maxX) {
        p.x = maxX;
        p.vx *= -1;
      }
      if (p.y < minY) {
        p.y = minY;
        p.vy *= -1;
      } else if (p.y > maxY) {
        p.y = maxY;
        p.vy *= -1;
      }
    }

    const coords = points.map((p) => [p.x, p.y]);
    const edges = delaunayEdges(coords);
    for (const [i, j] of edges) {
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[j].x, points[j].y);
      ctx.stroke();
    }

    const r = 2.6;
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = DOT_STROKE;
      ctx.stroke();
      ctx.strokeStyle = LINE_STYLE;
    }

    requestAnimationFrame(step);
  }

  resize();
  requestAnimationFrame(step);
  window.addEventListener('resize', resize);
})();
