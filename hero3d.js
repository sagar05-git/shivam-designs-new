(() => {
if (customElements.get('hero-3d')) return;
class Hero3D extends HTMLElement {
  connectedCallback() {
    if (this._init) return; this._init = true;
    if (!this.style.display) this.style.display = 'block';
    this._reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js')
      .then(m => this._setup(m)).catch(() => this._fallback());
  }
  disconnectedCallback() { this._dead = true; if (this._raf) cancelAnimationFrame(this._raf); if (this._renderer) this._renderer.dispose(); }
  _fallback() {
    if (!this.style.position) this.style.position = 'relative';
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;inset:10%;border-radius:50%;filter:blur(70px);opacity:.5;background:radial-gradient(circle at 35% 30%,var(--a1,#5a5cff),transparent 62%),radial-gradient(circle at 68% 70%,var(--a2,#ff4fd8),transparent 62%)';
    this.appendChild(d);
  }
  _envTexture(THREE) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#2c2c36'); grad.addColorStop(.5, '#0c0c0f'); grad.addColorStop(1, '#000000');
    g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
    const blob = (x, y, r, col) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); };
    const cs = getComputedStyle(this);
    const a1 = cs.getPropertyValue('--a1').trim() || '#5a5cff';
    const a2 = cs.getPropertyValue('--a2').trim() || '#ff4fd8';
    blob(120, 70, 95, a1); blob(400, 62, 85, a2); blob(256, 205, 130, 'rgba(255,255,255,0.14)'); blob(56, 220, 70, '#f2efe9');
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
  }
  _setup(THREE) {
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch (e) { return this._fallback(); }
    if (!renderer.getContext()) return this._fallback();
    this._renderer = renderer;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(38, 1, .1, 50); cam.position.set(0, 0, 7);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromEquirectangular(this._envTexture(THREE)).texture;
    const chrome = new THREE.MeshPhysicalMaterial({ color: 0xf5f2ec, metalness: 1, roughness: .16, envMapIntensity: 1.5 });
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.35, .42, 260, 40, 2, 3), chrome);
    scene.add(knot);
    const orbs = new THREE.Group();
    [[2.5, 1.5, -1, .26], [-2.3, -1.5, -.6, .19], [1.9, -2.1, .4, .13]].forEach(([x, y, z, r]) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 48), new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: .05, envMapIntensity: 2 }));
      s.position.set(x, y, z); orbs.add(s);
    });
    scene.add(orbs);
    scene.add(new THREE.AmbientLight(0x404050, .6));
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
    this.appendChild(renderer.domElement);
    const size = () => {
      const w = this.clientWidth || 1, h = this.clientHeight || 1;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    };
    size(); new ResizeObserver(size).observe(this);
    let mx = 0, my = 0, tx = 0, ty = 0;
    if (matchMedia('(pointer:fine)').matches)
      addEventListener('mousemove', e => { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; }, { passive: true });
    const clock = new THREE.Clock();
    const tick = () => {
      if (this._dead) return;
      this._raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      const still = this._reduced || this.hasAttribute('static');
      mx += (tx - mx) * .04; my += (ty - my) * .04;
      const sp = Math.min(1, scrollY / innerHeight);
      knot.rotation.y = (still ? 0 : t * .12) + mx * .7 + sp * 1.6;
      knot.rotation.x = .4 + my * .5 + sp * .8;
      knot.position.y = still ? 0 : Math.sin(t * .6) * .15;
      knot.scale.setScalar(1 - sp * .25);
      orbs.rotation.z = still ? 0 : t * .05;
      renderer.render(scene, cam);
    };
    tick();
  }
}
customElements.define('hero-3d', Hero3D);
})();
