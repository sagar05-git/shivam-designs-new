/* ParticleText (React Bits) ported to a self-registering web component.
   Same sampling / gather / repel logic; attributes mirror the React props. */
(function () {
  if (customElements.get('particle-text')) return;

  const hexToRgb = hex => {
    const clean = String(hex || '').replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  };
  const mixRgb = (from, to, amount) => ({
    r: Math.round(from.r + (to.r - from.r) * amount),
    g: Math.round(from.g + (to.g - from.g) * amount),
    b: Math.round(from.b + (to.b - from.b) * amount)
  });
  const rgbToCss = c => 'rgb(' + c.r + ', ' + c.g + ', ' + c.b + ')';
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

  const resolveFontSize = (value, host, weight, family) => {
    if (typeof value === 'number') return value;
    const probe = document.createElement('span');
    probe.textContent = 'M';
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
    probe.style.fontSize = value;
    probe.style.fontWeight = String(weight);
    probe.style.fontFamily = family;
    host.appendChild(probe);
    const size = parseFloat(getComputedStyle(probe).fontSize) || 96;
    probe.remove();
    return size;
  };

  const waitForFonts = async font => {
    if (!('fonts' in document)) return;
    try { await document.fonts.load(font); } catch (e) {}
    try { await document.fonts.ready; } catch (e) {}
  };

  class ParticleText extends HTMLElement {
    connectedCallback() {
      if (this._wired) return;
      this._wired = true;

      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML =
        '<style>' +
        ':host{position:relative;display:block;width:100%;height:100%;min-height:120px;overflow:hidden;touch-action:none;isolation:isolate}' +
        'canvas{position:absolute;inset:0;display:block;width:100%;height:100%}' +
        '</style><canvas aria-hidden="true"></canvas>';

      this.canvas = root.querySelector('canvas');
      this.ctx = this.canvas.getContext('2d');
      if (!this.ctx) return;

      // start immediately; sampleText() guards a zero-size box and the
      // ResizeObserver re-samples once the host is laid out. Retries are
      // belt-and-braces in case attributes land after the initial mount.
      this._start();
      setTimeout(() => { if (!this._teardown) this._start(); }, 0);
      setTimeout(() => { if (!this._teardown) this._start(); }, 300);
    }

    _num(name, dflt) {
      const v = parseFloat(this.getAttribute(name));
      return Number.isFinite(v) ? v : dflt;
    }

    _start() {
      if (this._started) return;
      this._started = true;
      const num = (n, d) => this._num(n, d);
      const o = {
        text: this.getAttribute('text') || 'React Bits',
        particleSize: num('particle-size', 2),
        density: num('density', 4),
        color: this.getAttribute('color') || '#ffffff',
        highlightColor: this.getAttribute('highlight-color') || '#8b5cf6',
        scatter: num('scatter', 180),
        gatherDuration: num('gather-duration', 1600),
        stagger: num('stagger', 420),
        pointerRepel: num('pointer-repel', 40),
        repelRadius: num('repel-radius', 120),
        idleDrift: num('idle-drift', 0.7),
        trigger: this.getAttribute('trigger') || 'mount',
        fontSize: this.getAttribute('font-size') || 'clamp(3rem, 12vw, 8rem)',
        fontWeight: this.getAttribute('font-weight') || 800,
        fontFamily: this.getAttribute('font-family') || 'inherit',
        glow: this.getAttribute('glow') !== 'false'
      };
      this.setAttribute('aria-label', o.text);

      const host = this, canvas = this.canvas, ctx = this.ctx;
      let particles = [], animationFrame = null, resizeFrame = null, buildId = 0;
      let gathering = false, gatherStart = 0;
      let reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      let width = 0, height = 0, dpr = 1;
      const pointer = { active: false, x: 0, y: 0, smoothX: 0, smoothY: 0 };

      const startGather = (fromScatter) => {
        if (!particles.length) return;
        const now = performance.now();
        const spread = reducedMotion ? 0 : o.scatter;
        particles.forEach(p => {
          if (fromScatter) {
            const angle = p.seed * Math.PI * 2;
            const distance = spread * (0.35 + p.depth * 0.75);
            p.x = p.targetX + Math.cos(angle) * distance + (p.depth - 0.5) * spread * 0.55;
            p.y = p.targetY + Math.sin(angle) * distance + (p.seed - 0.5) * spread * 0.55;
          }
          p.startX = p.x; p.startY = p.y;
          p.delay = reducedMotion ? 0 : p.seed * o.stagger;
        });
        gatherStart = now;
        gathering = true;
      };

      const drawParticle = p => {
        const size = p.size;
        ctx.fillStyle = p.color;
        if (size <= 2.1) { ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size); return; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
        ctx.fill();
      };

      const render = now => {
        ctx.clearRect(0, 0, width, height);
        if (o.glow && !reducedMotion) { ctx.shadowBlur = o.particleSize * 3; ctx.shadowColor = o.highlightColor; }
        else ctx.shadowBlur = 0;

        pointer.smoothX += (pointer.x - pointer.smoothX) * 0.18;
        pointer.smoothY += (pointer.y - pointer.smoothY) * 0.18;

        let complete = true;
        particles.forEach(p => {
          let baseX = p.targetX, baseY = p.targetY, progress = 1;
          if (gathering) {
            const local = (now - gatherStart - p.delay) / Math.max(1, reducedMotion ? 1 : o.gatherDuration);
            progress = clamp(local, 0, 1);
            const eased = easeOutCubic(progress);
            baseX = p.startX + (p.targetX - p.startX) * eased;
            baseY = p.startY + (p.targetY - p.startY) * eased;
            if (progress < 1) complete = false;
          } else if (!reducedMotion && o.idleDrift > 0) {
            const t = now * 0.001;
            baseX += Math.sin(t * 0.9 + p.seed * 10) * o.idleDrift * p.depth;
            baseY += Math.cos(t * 0.75 + p.depth * 10) * o.idleDrift * p.depth;
          }
          if (pointer.active && !reducedMotion && o.pointerRepel > 0 && o.repelRadius > 0) {
            const dx = baseX - pointer.smoothX, dy = baseY - pointer.smoothY;
            const d = Math.hypot(dx, dy);
            if (d > 0 && d < o.repelRadius) {
              const force = Math.pow(1 - d / o.repelRadius, 2) * o.pointerRepel;
              baseX += (dx / d) * force;
              baseY += (dy / d) * force;
            }
          }
          const follow = reducedMotion ? 1 : 0.22;
          p.x += (baseX - p.x) * follow;
          p.y += (baseY - p.y) * follow;
          ctx.globalAlpha = clamp(0.35 + progress * 0.65, 0, 1);
          drawParticle(p);
        });
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        if (gathering && complete) gathering = false;
        animationFrame = requestAnimationFrame(render);
      };

      const ensureRenderLoop = () => { if (animationFrame === null) animationFrame = requestAnimationFrame(render); };

      const sampleText = async () => {
        const currentBuild = ++buildId;
        const rect = host.getBoundingClientRect();
        width = Math.floor(rect.width);
        height = Math.floor(rect.height);
        if (width <= 0 || height <= 0) return;

        dpr = Math.min(devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const computed = getComputedStyle(host);
        const family = o.fontFamily === 'inherit' ? (computed.fontFamily || 'sans-serif') : o.fontFamily;
        let size = resolveFontSize(o.fontSize, host, o.fontWeight, family);
        let font = o.fontWeight + ' ' + size + 'px ' + family;

        await waitForFonts(font);
        if (currentBuild !== buildId) return;

        const off = document.createElement('canvas');
        const offCtx = off.getContext('2d', { willReadFrequently: true });
        if (!offCtx) return;

        const content = String(o.text || ' ');
        const maxTextWidth = width * 0.92;
        offCtx.font = font;
        let m = offCtx.measureText(content);
        const measured = Math.max(1, m.width);
        if (measured > maxTextWidth) {
          size = Math.max(18, size * (maxTextWidth / measured));
          font = o.fontWeight + ' ' + size + 'px ' + family;
          await waitForFonts(font);
          if (currentBuild !== buildId) return;
          offCtx.font = font;
          m = offCtx.measureText(content);
        }

        const left = Math.ceil(m.actualBoundingBoxLeft || 0);
        const right = Math.ceil(m.actualBoundingBoxRight || m.width);
        const ascent = Math.ceil(m.actualBoundingBoxAscent || size * 0.78);
        const descent = Math.ceil(m.actualBoundingBoxDescent || size * 0.22);
        const pad = Math.max(12, Math.ceil(size * 0.08));

        off.width = Math.max(1, left + right) + pad * 2;
        off.height = Math.max(1, ascent + descent) + pad * 2;
        offCtx.clearRect(0, 0, off.width, off.height);
        offCtx.font = font;
        offCtx.textAlign = 'left';
        offCtx.textBaseline = 'alphabetic';
        offCtx.fillStyle = '#ffffff';
        offCtx.fillText(content, pad - left, pad + ascent);

        const data = offCtx.getImageData(0, 0, off.width, off.height).data;
        const targets = [];
        const step = Math.max(2, Math.floor(o.density));
        for (let y = 0; y < off.height; y += step) {
          for (let x = 0; x < off.width; x += step) {
            const alpha = data[(y * off.width + x) * 4 + 3];
            if (alpha > 40) targets.push({
              x: width / 2 - off.width / 2 + x,
              y: height / 2 - off.height / 2 + y,
              alpha: alpha / 255
            });
          }
        }

        const maxParticles = Math.max(900, Math.min(5200, Math.floor((width * height) / 90)));
        const stride = Math.max(1, Math.ceil(targets.length / maxParticles));
        const baseRgb = hexToRgb(o.color);
        const hiRgb = hexToRgb(o.highlightColor);
        const selected = targets.filter((_, i) => i % stride === 0);

        particles = selected.map((t, i) => {
          const seed = ((i * 9301 + 49297) % 233280) / 233280;
          const depth = 0.45 + (((i * 233 + 97) % 1000) / 1000) * 0.9;
          const blend = baseRgb && hiRgb ? clamp(t.x / Math.max(1, width) + (seed - 0.5) * 0.35, 0, 1) : 0;
          const col = baseRgb && hiRgb ? rgbToCss(mixRgb(baseRgb, hiRgb, blend)) : o.color;
          const angle = seed * Math.PI * 2;
          const distance = (reducedMotion ? 0 : o.scatter) * (0.35 + depth * 0.75);
          const startX = t.x + Math.cos(angle) * distance + (seed - 0.5) * o.scatter * 0.45;
          const startY = t.y + Math.sin(angle) * distance + (depth - 0.9) * o.scatter * 0.45;
          return {
            x: reducedMotion ? t.x : startX,
            y: reducedMotion ? t.y : startY,
            startX, startY,
            targetX: t.x, targetY: t.y,
            size: Math.max(0.6, o.particleSize * (0.75 + t.alpha * 0.45)),
            color: col, seed, depth,
            delay: seed * o.stagger
          };
        });

        pointer.x = width / 2; pointer.y = height / 2;
        pointer.smoothX = pointer.x; pointer.smoothY = pointer.y;

        if (reducedMotion) {
          particles.forEach(p => { p.x = p.targetX; p.y = p.targetY; p.startX = p.targetX; p.startY = p.targetY; p.delay = 0; });
          gathering = false;
        } else {
          startGather(false);
        }
        ensureRenderLoop();
      };

      const queueSample = () => {
        if (resizeFrame) cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(sampleText);
      };

      // pointer tracked on window: the host may sit under pointer-events:none layers
      const onMove = e => {
        const r = host.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        pointer.active = inside;
        if (!inside) return;
        pointer.x = e.clientX - r.left;
        pointer.y = e.clientY - r.top;
        if (o.trigger === 'hover' && !host._hovering) { host._hovering = true; startGather(true); }
        if (!inside) host._hovering = false;
      };
      const onLeave = () => { pointer.active = false; host._hovering = false; };
      const onClick = () => { if (o.trigger === 'click') startGather(true); };

      addEventListener('pointermove', onMove, { passive: true });
      host.addEventListener('pointerleave', onLeave);
      host.addEventListener('click', onClick);

      const ro = new ResizeObserver(queueSample);
      ro.observe(host);
      sampleText();

      this._teardown = () => {
        buildId += 1;
        ro.disconnect();
        removeEventListener('pointermove', onMove);
        host.removeEventListener('pointerleave', onLeave);
        host.removeEventListener('click', onClick);
        if (animationFrame !== null) cancelAnimationFrame(animationFrame);
        if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      };
    }

    disconnectedCallback() { if (this._teardown) this._teardown(); this._started = false; this._teardown = null; }
  }

  customElements.define('particle-text', ParticleText);
})();
