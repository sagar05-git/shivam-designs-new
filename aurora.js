(() => {
if (customElements.get('aurora-bg')) return;

const VERT = `#version 300 es
in vec2 position;
void main(){ gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x){ return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop { vec3 color; float position; };

#define COLOR_RAMP(colors, factor, finalColor) {                    \\
  int index = 0;                                                    \\
  for (int i = 0; i < 2; i++) {                                     \\
     ColorStop currentColor = colors[i];                            \\
     bool isInBetween = currentColor.position <= factor;            \\
     index = int(mix(float(index), float(i), float(isInBetween)));  \\
  }                                                                 \\
  ColorStop currentColor = colors[index];                           \\
  ColorStop nextColor = colors[index + 1];                          \\
  float range = nextColor.position - currentColor.position;         \\
  float lerpFactor = (factor - currentColor.position) / range;      \\
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor);\\
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);
  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);
  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;
  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);
  vec3 auroraColor = intensity * rampColor;
  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}
`;

const hexToRgb = h => {
  const s = h.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map(c => c + c).join('') : s, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
    .map(c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
};

class AuroraBG extends HTMLElement {
  _num(n, d) { const v = parseFloat(this.getAttribute(n)); return Number.isFinite(v) ? v : d; }

  _stops() {
    const raw = (this.getAttribute('color-stops') || '#3A29FF,#FF94B4,#FF3232').split(',').map(s => s.trim());
    while (raw.length < 3) raw.push(raw[raw.length - 1]);
    return raw.slice(0, 3);
  }

  _boot() {
    this.style.display = 'block';
    const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
    root.innerHTML = '';
    const cvs = document.createElement('canvas');
    cvs.style.cssText = 'display:block;width:100%;height:100%;background:transparent';
    root.appendChild(cvs);

    const gl = cvs.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) return;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const mk = (t, src) => {
      const s = gl.createShader(t);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s));
      return s;
    };
    const pr = gl.createProgram();
    gl.attachShader(pr, mk(gl.VERTEX_SHADER, VERT));
    gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(pr, 0, 'position');
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(pr)); return; }
    gl.useProgram(pr);

    gl.bindVertexArray(gl.createVertexArray());
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const U = n => gl.getUniformLocation(pr, n);
    const u = { time: U('uTime'), amp: U('uAmplitude'), res: U('uResolution'), blend: U('uBlend'), stops: U('uColorStops[0]') };

    const dpr = Math.min(devicePixelRatio || 1, 2);
    const resize = () => {
      const w = Math.max(1, this.offsetWidth), h = Math.max(1, this.offsetHeight);
      cvs.width = Math.floor(w * dpr); cvs.height = Math.floor(h * dpr);
      gl.viewport(0, 0, cvs.width, cvs.height);
      gl.uniform2f(u.res, cvs.width, cvs.height);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(this);

    let vis = true;
    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { rootMargin: '10% 0px' })
      : null;
    if (io) io.observe(this);

    let raf = 0;
    const draw = t => {
      raf = requestAnimationFrame(draw);
      if (!vis || document.hidden) return;
      gl.uniform1f(u.time, t * 0.01 * this._num('speed', 1) * 0.1);
      gl.uniform1f(u.amp, this._num('amplitude', 1));
      gl.uniform1f(u.blend, this._num('blend', 0.5));
      gl.uniform3fv(u.stops, new Float32Array(this._stops().flatMap(hexToRgb)));
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(draw);

    this._teardown = () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (io) io.disconnect();
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      if (cvs.parentNode) cvs.parentNode.removeChild(cvs);
    };
  }

  disconnectedCallback() { if (this._teardown) { this._teardown(); this._teardown = null; } }
}

customElements.define('aurora-bg', AuroraBG);

const sweep = () => {
  document.querySelectorAll('aurora-bg').forEach(el => {
    if (!el.isConnected || !el._boot) return;
    if (el.shadowRoot && el.shadowRoot.querySelector('canvas')) return;
    if (el.offsetWidth > 0 && el.offsetHeight > 0) el._boot();
  });
};
setInterval(sweep, 250);
requestAnimationFrame(sweep);
})();
