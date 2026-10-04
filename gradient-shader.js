(() => {
if (customElements.get('gradient-shader')) return;
const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAG = `precision highp float;
uniform vec2 r;uniform float t;uniform vec2 m;
uniform vec3 c1;uniform vec3 c2;uniform vec3 c3;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}
void main(){
vec2 uv=gl_FragCoord.xy/r;
vec2 asp=vec2(r.x/r.y,1.);
vec2 q=uv*asp;
float T=t*.12;
float w=fbm(vec2(q.x*1.4+T,q.y*2.-T*.6)+m*.4);
float wave=uv.y-(.42+ .22*sin(q.x*2.2+T*2.+w*2.5)+.12*w+m.y*.08);
float band=smoothstep(.34,-.22,wave);
float core=smoothstep(.12,-.3,wave);
float glow=smoothstep(.55,-.1,wave)*.5;
vec3 col=vec3(.04,.035,.03);
col=mix(col,c1,glow*.6);
col=mix(col,c1,band);
col=mix(col,c2,core*fbm(q*3.+T));
col=mix(col,c3,pow(core,2.2)*(.55+.45*sin(q.x*3.-T*3.)));
float gr=hash(gl_FragCoord.xy+fract(t))*.05;
col+=gr-.025;
gl_FragColor=vec4(col,1.);}`;
class GradientShader extends HTMLElement {
  connectedCallback() {
    if (this._init) return; this._init = true;
    if (!this.style.display) this.style.display = 'block';
    const cv = document.createElement('canvas');
    cv.style.cssText = 'width:100%;height:100%;display:block';
    this.appendChild(cv);
    const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) { this.style.background = 'radial-gradient(60% 80% at 50% 100%,#e8322a,transparent 70%)'; return; }
    const sh = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(pr, n);
    const uR = U('r'), uT = U('t'), uM = U('m'), u1 = U('c1'), u2 = U('c2'), u3 = U('c3');
    const hex = h => { const n = parseInt(h.replace('#',''), 16); return [(n>>16&255)/255, (n>>8&255)/255, (n&255)/255]; };
    const setCols = () => {
      gl.uniform3fv(u1, hex(this.getAttribute('c1') || '#b81d15'));
      gl.uniform3fv(u2, hex(this.getAttribute('c2') || '#ff4b38'));
      gl.uniform3fv(u3, hex(this.getAttribute('c3') || '#ffd9cf'));
    };
    setCols();
    this._setCols = setCols;
    const size = () => {
      const d = Math.min(devicePixelRatio, 1.5);
      cv.width = Math.max(1, this.clientWidth * d * .75); cv.height = Math.max(1, this.clientHeight * d * .75);
      gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(uR, cv.width, cv.height);
    };
    size(); new ResizeObserver(size).observe(this);
    let mx = 0, my = 0, sx = 0, sy = 0;
    if (matchMedia('(pointer:fine)').matches)
      addEventListener('mousemove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    const tick = now => {
      if (this._dead) return;
      this._raf = requestAnimationFrame(tick);
      if (this.hasAttribute('static')) return;
      sx += (mx - sx) * .04; sy += (my - sy) * .04;
      gl.uniform1f(uT, reduced ? 0 : (now - t0) / 1000);
      gl.uniform2f(uM, sx, sy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    tick(t0);
  }
  attributeChangedCallback() { if (this._setCols) this._setCols(); }
  static get observedAttributes() { return ['c1', 'c2', 'c3']; }
  disconnectedCallback() { this._dead = true; if (this._raf) cancelAnimationFrame(this._raf); }
}
customElements.define('gradient-shader', GradientShader);
})();
