(() => {
  if (customElements.get('sticker-pile')) return;

  const LABELS = [
    { t: 'BRAND IDENTITY', bg: '#E8312F', fg: '#FCFAF8' },
    { t: 'UI / UX', bg: '#FCFAF8', fg: '#0D0A0A' },
    { t: 'FIGMA', bg: '#1C1817', fg: '#FCFAF8', ring: '#2E2927' },
    { t: 'ART DIRECTION', bg: '#FCFAF8', fg: '#0D0A0A' },
    { t: 'MOTION', bg: '#FF6B69', fg: '#4A0F0E' },
    { t: 'PACKAGING', bg: '#1C1817', fg: '#FCFAF8', ring: '#2E2927' },
    { t: 'CAMPAIGN', bg: '#C41F1E', fg: '#FFECEB' },
    { t: 'DESIGN SYSTEMS', bg: '#FCFAF8', fg: '#0D0A0A' },
    { t: 'AI WORKFLOWS', bg: '#E8312F', fg: '#FCFAF8' },
    { t: 'TYPOGRAPHY', bg: '#1C1817', fg: '#FCFAF8', ring: '#2E2927' },
    { t: 'SOCIAL', bg: '#FF6B69', fg: '#4A0F0E' },
    { t: 'WEB', bg: '#FCFAF8', fg: '#0D0A0A' },
    { t: '3D', bg: '#C41F1E', fg: '#FFECEB', circle: true },
    { t: '★', bg: '#FCFAF8', fg: '#E8312F', circle: true },
    { t: 'SP', bg: '#E8312F', fg: '#FCFAF8', circle: true },
    { t: '10 YRS', bg: '#1C1817', fg: '#FF6B69', ring: '#2E2927', circle: true },
    { t: 'WIREFRAME', bg: '#FCFAF8', fg: '#0D0A0A' },
    { t: 'STRATEGY', bg: '#1C1817', fg: '#FCFAF8', ring: '#2E2927' },
    { t: 'LOGO', bg: '#FF6B69', fg: '#4A0F0E', circle: true },
    { t: 'PRINT', bg: '#E8312F', fg: '#FCFAF8' }
  ];

  class StickerPile extends HTMLElement {
    connectedCallback() {
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML =
        '<style>:host{display:block;width:100%;height:100%;touch-action:none}' +
        'canvas{display:block;width:100%;height:100%;cursor:grab}' +
        'canvas.drag{cursor:grabbing}</style><canvas></canvas>';
      const cv = root.querySelector('canvas');
      const ctx = cv.getContext('2d');
      this._stop = false;

      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      let W = 0, H = 0, dpr = 1;
      let bodies = [], spawned = 0, spawnClock = 0, started = false;
      const FONT = w => w + ' 13px "Switzer", system-ui, sans-serif';

      const size = () => {
        const r = this.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        dpr = Math.min(devicePixelRatio || 1, 2);
        W = r.width; H = r.height;
        cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return true;
      };

      const build = () => {
        ctx.font = FONT(600);
        bodies = LABELS.map((L, i) => {
          const tw = ctx.measureText(L.t).width;
          const hw = L.circle ? Math.max(26, tw / 2 + 16) : tw / 2 + 18;
          const hh = L.circle ? hw : 19;
          return {
            L, hw, hh, circle: !!L.circle,
            x: W * (0.12 + 0.76 * ((i * 0.37 + 0.11) % 1)),
            y: -80 - i * 46,
            vx: 0, vy: 0, held: false, live: false
          };
        });
        spawned = 0; spawnClock = 0;
      };

      const G = 0.62, REST = 0.1, AIR = 0.994, GROUND_F = 0.86;

      const step = () => {
        if (spawned < bodies.length) {
          spawnClock++;
          if (spawnClock % 5 === 0) bodies[spawned++].live = true;
        }
        for (const b of bodies) {
          if (!b.live || b.held) continue;
          b.vy += G; b.vx *= AIR; b.vy *= AIR;
          b.x += b.vx; b.y += b.vy;
        }
        for (let it = 0; it < 6; it++) {
          for (let i = 0; i < bodies.length; i++) {
            const a = bodies[i];
            if (!a.live) continue;
            for (let j = i + 1; j < bodies.length; j++) {
              const c = bodies[j];
              if (!c.live) continue;
              const dx = c.x - a.x, dy = c.y - a.y;
              const ox = a.hw + c.hw - Math.abs(dx), oy = a.hh + c.hh - Math.abs(dy);
              if (ox <= 0 || oy <= 0) continue;
              const aw = a.held ? 0 : 1, cw = c.held ? 0 : 1, tw = aw + cw || 1;
              if (ox < oy) {
                const s = (dx < 0 ? -1 : 1) * ox;
                a.x -= s * (aw / tw); c.x += s * (cw / tw);
                const rv = c.vx - a.vx;
                if (!a.held) a.vx += rv * 0.5 * (1 - REST) * (aw / tw);
                if (!c.held) c.vx -= rv * 0.5 * (1 - REST) * (cw / tw);
              } else {
                const s = (dy < 0 ? -1 : 1) * oy;
                a.y -= s * (aw / tw); c.y += s * (cw / tw);
                const rv = c.vy - a.vy;
                if (!a.held) { a.vy += rv * 0.5 * (1 - REST) * (aw / tw); a.vx *= GROUND_F; }
                if (!c.held) { c.vy -= rv * 0.5 * (1 - REST) * (cw / tw); c.vx *= GROUND_F; }
              }
            }
          }
          for (const b of bodies) {
            if (!b.live || b.held) continue;
            if (b.x - b.hw < 0) { b.x = b.hw; b.vx = Math.abs(b.vx) * REST; }
            if (b.x + b.hw > W) { b.x = W - b.hw; b.vx = -Math.abs(b.vx) * REST; }
            if (b.y + b.hh > H) { b.y = H - b.hh; b.vy = -Math.abs(b.vy) * REST; b.vx *= GROUND_F; }
          }
        }
      };

      const roundRect = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      };

      const draw = () => {
        ctx.clearRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const b of bodies) {
          if (!b.live) continue;
          ctx.save();
          ctx.translate(b.x, b.y);
          if (b.circle) {
            ctx.beginPath();
            ctx.arc(0, 0, b.hw, 0, Math.PI * 2);
          } else {
            roundRect(-b.hw, -b.hh, b.hw * 2, b.hh * 2, b.hh);
          }
          ctx.fillStyle = b.L.bg;
          ctx.fill();
          if (b.L.ring) { ctx.strokeStyle = b.L.ring; ctx.lineWidth = 1; ctx.stroke(); }
          ctx.fillStyle = b.L.fg;
          ctx.font = FONT(b.circle ? 700 : 600);
          ctx.fillText(b.L.t, 0, 1);
          ctx.restore();
        }
      };

      let raf = null;
      const loop = () => {
        if (this._stop) return;
        step(); draw();
        raf = requestAnimationFrame(loop);
      };

      // pointer drag
      let held = null, px = 0, py = 0, lx = 0, ly = 0;
      const local = e => {
        const r = cv.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      const down = e => {
        const p = local(e);
        for (let i = bodies.length - 1; i >= 0; i--) {
          const b = bodies[i];
          if (!b.live) continue;
          const hit = b.circle
            ? Math.hypot(p.x - b.x, p.y - b.y) < b.hw
            : Math.abs(p.x - b.x) < b.hw && Math.abs(p.y - b.y) < b.hh;
          if (hit) {
            held = b; b.held = true;
            px = p.x - b.x; py = p.y - b.y; lx = p.x; ly = p.y;
            cv.classList.add('drag');
            cv.setPointerCapture(e.pointerId);
            bodies.splice(i, 1); bodies.push(b);
            break;
          }
        }
      };
      const move = e => {
        if (!held) return;
        const p = local(e);
        held.x = p.x - px; held.y = p.y - py;
        held.vx = (p.x - lx) * 0.9; held.vy = (p.y - ly) * 0.9;
        lx = p.x; ly = p.y;
      };
      const up = () => {
        if (held) held.held = false;
        held = null;
        cv.classList.remove('drag');
      };
      cv.addEventListener('pointerdown', down);
      cv.addEventListener('pointermove', move);
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);

      const ro = new ResizeObserver(() => {
        if (!size()) return;
        if (!bodies.length) build();
        else for (const b of bodies) { b.x = Math.min(Math.max(b.hw, b.x), Math.max(b.hw, W - b.hw)); }
      });
      ro.observe(this);
      this._ro = ro;

      const kick = () => {
        if (started) return;
        const r = this.getBoundingClientRect();
        if (r.top < innerHeight * 1.05 && r.bottom > 0) {
          started = true;
          if (!W && !size()) { started = false; return; }
          if (!bodies.length) build();
          if (reduced) {
            bodies.forEach((b, i) => {
              b.live = true;
              b.x = b.hw + 18 + (i * 137) % Math.max(1, W - b.hw * 2 - 36);
              b.y = H - b.hh - 12 - Math.floor(i / 6) * 46;
            });
            spawned = bodies.length;
            draw();
            return;
          }
          loop();
        }
      };
      kick();
      addEventListener('scroll', kick, { passive: true });
      this._kick = kick;
      this._raf = () => raf;
    }

    disconnectedCallback() {
      this._stop = true;
      this._ro && this._ro.disconnect();
      this._kick && removeEventListener('scroll', this._kick);
    }
  }

  customElements.define('sticker-pile', StickerPile);
})();
