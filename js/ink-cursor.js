/*
 * Cosmic living-ink cursor v2 (js/ink-cursor.js) · self-initialising, no dependencies, one <script> tag.
 *
 * The idea is Illustrator's offset-path trick (offset out, offset in, round joins) done live: every shape is a
 * signed distance, and shapes are joined with a smooth union, so anything close to the ink grows a fillet to it.
 *
 *   - the head is a soft disc on a spring: it lags a little, stretches along its motion, wobbles like a drop;
 *   - the tail is ONE body, not particles: a towed thread of 10 points behind the head. It lays along the path you
 *     drew, thins toward the tip, and when you slow down it reels back in along its own curve, the tip swelling
 *     into a bead that the head swallows with a small gulp;
 *   - page shapes join the same field: filled controls, bordered boxes, cards and the edges of coloured sections.
 *     Once the ink touches a control it sticks: pull away and a strand stretches between them, then snaps;
 *   - the ink sits BEHIND text and artwork. Two small canvases travel with the pointer: one paints normally, the
 *     other uses mix-blend-mode darken (light ground) or lighten (dark ground) inside text / image boxes, so
 *     letters and line art stay on top of the ink. Text in the ink's own colour gets a light wash instead;
 *   - a link or control without a fill gets the ink as an underline.
 *
 * Colour is per pixel: the brand colour that contrasts with the ground under that pixel (blue on cream, cream on
 * blue), read from the flwr tokens at runtime. Off on touch / coarse pointers, under prefers-reduced-motion and
 * with <html data-ink="off">. data-ink="off" on an element clears the ink inside it; data-ink="on" makes it bigger.
 * Options on the script tag: data-ink-size, -trail, -stretch, -goo, -wobble, -text-tint, data-ink-native="hide";
 * or window.CosmicInkOptions = {...} before it. API: window.CosmicInk.{refresh, stats, stop, start, options}.
 */
(function () {
  'use strict';
  if (window.CosmicInk) return;

  const doc = document;
  const root = doc.documentElement;
  const SCRIPT = doc.currentScript;

  // ------------------------------------------------------------------ options
  // defaults = the values Juan tuned on the demo panel, 2026-11-10
  const O = { dot: 1, hold: 1, underline: 0, size: 0.8, trail: 0.71, stretch: 1.24, goo: 2.15, wobble: 1.5, follow: 1, bounce: 0.8, magnet: 1.95, art: 0.7, traces: 1.85, texture: 0.45, textTint: 1 };
  (function () {
    const src = window.CosmicInkOptions || {};
    Object.keys(O).forEach(function (k) {
      if (typeof src[k] === 'number') O[k] = src[k];
      if (!SCRIPT) return;
      const a = SCRIPT.getAttribute('data-ink-' + k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }));
      if (a !== null && a !== '' && !isNaN(+a)) O[k] = +a;
    });
  })();
  // the ink is the pointer: the system arrow is hidden unless the tag says data-ink-native="show"
  const HIDE_NATIVE = !(SCRIPT && SCRIPT.getAttribute('data-ink-native') === 'show') && (window.CosmicInkOptions || {}).native !== 'show';

  const MAXN = 6, MAXS = 10, MAXM = 12, MAXG = 6, MAXA = 4, MAXD = 6;
  const FPAD = 44, FRANGE = 44;   // art distance fields: padding and encoded range, page px

  // ------------------------------------------------------------------ gate
  const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
  const mqRM = matchMedia('(prefers-reduced-motion: reduce)');
  function allowed() { return mqFine.matches && !mqRM.matches && root.getAttribute('data-ink') !== 'off'; }

  // ------------------------------------------------------------------ colour helpers
  let cctx = null;
  const colorCache = new Map();
  function parseColor(s) {
    if (!s) return null;
    s = String(s).trim();
    if (!s) return null;
    let c = colorCache.get(s);
    if (c) return c;
    const m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
    if (m) {
      const al = m[4] === undefined ? 1 : (m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : +m[4]);
      c = [m[1] / 255, m[2] / 255, m[3] / 255, al];
    } else {
      if (!cctx) {
        const cv = doc.createElement('canvas');
        cv.width = cv.height = 1;
        cctx = cv.getContext('2d', { willReadFrequently: true });
      }
      cctx.fillStyle = '#010203';
      cctx.fillStyle = s;
      if (cctx.fillStyle === '#010203' && !/^#010203$/i.test(s)) return null;
      cctx.clearRect(0, 0, 1, 1);
      cctx.fillRect(0, 0, 1, 1);
      const d = cctx.getImageData(0, 0, 1, 1).data;
      c = [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255];
    }
    colorCache.set(s, c);
    return c;
  }
  function lin(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function lum(c) { return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]); }
  function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function cdist(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]); }

  // Brand colours come from the flwr tokens, resolved by a probe so token expressions are computed by the browser.
  const P = { blue: null, cream: null, ink: null };
  function readPalette() {
    const host = doc.querySelector('[data-flwr]') || doc.body || root;
    const probe = doc.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.setAttribute('data-ink-cursor', 'probe');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    host.appendChild(probe);
    function tok(names) {
      for (let i = 0; i < names.length; i++) {
        probe.style.color = '';
        probe.style.color = 'var(' + names[i] + ')';
        const raw = getComputedStyle(host).getPropertyValue(names[i]).trim();
        if (!raw) continue;
        const c = parseColor(getComputedStyle(probe).color);
        if (c && c[3] > 0.5) return c;
      }
      return null;
    }
    P.blue = tok(['--_palette---core--seed', '--_theme---accent--main', '--_palette---core--500']);
    P.cream = tok(['--_palette---neutral--0', '--_theme---surface--main']);
    P.ink = tok(['--_palette---neutral--900', '--_theme---text--main']);
    const hs = getComputedStyle(host);
    if (!P.cream) P.cream = parseColor(hs.backgroundColor);
    if (!P.ink) P.ink = parseColor(hs.color);
    if (!P.blue) P.blue = P.ink;
    host.removeChild(probe);
  }
  // The ink colour for a ground: blue leads, cream on dark grounds, ink when neither reads.
  function inkFor(bg) {
    const list = [P.blue, P.cream, P.ink];
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c && cdist(c, bg) > 0.25 && contrast(c, bg) >= 3) return c;
    }
    return lum(bg) > 0.35 ? (P.ink || [0, 0, 0, 1]) : (P.cream || [1, 1, 1, 1]);
  }
  function polOf(bg, ink) { return lum(ink) > lum(bg) ? 1 : 0; }   // 1 = light ink on a dark ground

  // ------------------------------------------------------------------ shaders
  const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';
  const FS = [
    'precision highp float;',
    '#define MAXN ' + MAXN, '#define MAXS ' + MAXS, '#define MAXM ' + MAXM, '#define MAXG ' + MAXG,
    'uniform vec4 uView;',          // canvas px height, dpr, origin x, origin y (client px)
    'uniform vec4 uHead;',          // x y rx ry
    'uniform vec4 uHeadX;',         // cos sin hugT hugRadius
    'uniform vec4 uHug;',           // cx cy hw hh
    'uniform vec4 uNode[MAXN];',
    'uniform vec4 uDrop[6];',       // traces: x y r -    // x y r -
    'uniform vec4 uSA[MAXS];',      // cx cy hw hh
    'uniform vec4 uSB[MAXS];',      // radius ring - bulge
    'uniform vec4 uSC[MAXS];',      // r g b k
    'uniform vec4 uSD[MAXS];',      // mode aux rot -
    'uniform vec4 uSE[MAXS];',      // parent ground rgb (edges)
    'uniform vec4 uM[MAXM];',       // x0 y0 x1 y1
    'uniform vec4 uG[MAXG];',       // x0 y0 x1 y1
    'uniform vec4 uGC[MAXG];',      // ink rgb for that ground, polarity
    'uniform vec4 uBase;',          // base ink rgb, base polarity
    'uniform vec4 uPar;',           // pointer x y, tail k, wobble clock
    'uniform vec4 uCount;',         // nodes solids masks grounds
    'uniform vec4 uPass;',          // pass (0 normal, 1 blend), blend polarity, regular mask count, wobble px
    'uniform vec4 uTint;',          // same-colour text wash alpha, art count, art range
    'uniform vec4 uInkT;',          // colour the whole ink takes from what it is joined to, amount
    'uniform sampler2D uT0;','uniform sampler2D uT1;','uniform sampler2D uT2;','uniform sampler2D uT3;',
    'uniform vec4 uAR[4];',         // shape field rect x0 y0 x1 y1
    'uniform vec4 uAC[4];',         // - - - k
    'uniform vec4 uDotP;',          // click dot: x y r -
    'uniform vec4 uDotC;',          // click dot: rgb, alpha
    'uniform vec4 uLead;',          // the nose, exactly under the pointer: x y r k
    'float artD(sampler2D t,vec4 r,vec2 p){vec2 uv=(p-r.xy)/(r.zw-r.xy);',
    ' if(uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0)return 1000.0;return (0.5-texture2D(t,uv).r)*2.0*uTint.z;}',
    'float sdBox(vec2 p,vec2 c,vec2 h,float r){vec2 q=abs(p-c)-h+r;return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r;}',
    'float smin(float a,float b,float k){float h=max(k-abs(a-b),0.0)/k;return min(a,b)-h*h*k*0.25;}',
    'float sdSeg(vec2 p,vec2 a,vec2 b,float ra,float rb){vec2 pa=p-a,ba=b-a;',
    ' float t=clamp(dot(pa,ba)/max(dot(ba,ba),0.001),0.0,1.0);return length(pa-ba*t)-mix(ra,rb,t);}',
    'float cover(vec2 p,vec4 r,float s){vec2 d=min(p-r.xy,r.zw-p);return clamp(min(d.x,d.y)/s+0.5,0.0,1.0);}',
    'void main(){',
    ' float dpr=uView.y;',
    ' vec2 p=vec2(gl_FragCoord.x,uView.x-gl_FragCoord.y)/dpr+uView.zw;',
    // head: a rotated ellipse with two slow lobes travelling round it, so it never reads as a perfect circle
    ' vec2 q=p-uHead.xy;q=vec2(dot(q,uHeadX.xy),dot(q,vec2(-uHeadX.y,uHeadX.x)));',
    ' vec2 ab=max(uHead.zw,vec2(0.05));',
    ' float th=atan(q.y,q.x+0.0001);',
    ' float wob=sin(th*2.0+uPar.w*1.1)*0.55+sin(th*3.0-uPar.w*1.7+1.3)*0.45;',
    ' float d=(length(q/ab)-1.0)*min(ab.x,ab.y)-wob*uPass.w;',
    ' if(uHeadX.z>0.001){float t=uHeadX.z;float r0=min(ab.x,ab.y);vec2 hh=max(mix(vec2(r0),uHug.zw,t),vec2(1.0));',
    '  float rr=min(mix(r0,uHeadX.w,t),min(hh.x,hh.y));',
    '  d=mix(d,sdBox(p,mix(uHead.xy,uHug.xy,t),hh,rr),smoothstep(0.0,0.12,t));}',
    ' {float lr=uLead.z*(1.0-clamp(uHeadX.z,0.0,1.0));if(lr>0.5)d=smin(d,sdSeg(p,uLead.xy,uHead.xy,lr,min(ab.x,ab.y)*0.92),uLead.w);}',
    // tail: tapered capsules, one body
    ' vec2 prev=uHead.xy;float pr=min(ab.x,ab.y)*0.82*(1.0-uHeadX.z);',
    ' int nn=int(uCount.x);',
    ' for(int i=0;i<MAXN;i++){if(i>=nn)break;vec4 n=uNode[i];',
    '  d=smin(d,sdSeg(p,prev,n.xy,pr,n.z),uPar.z);prev=n.xy;pr=n.z;}',
    ' for(int i=0;i<6;i++){vec4 dr=uDrop[i];if(dr.z>0.3)d=smin(d,length(p-dr.xy)-dr.z,max(uPar.z*0.7,dr.z*0.9));}',
    ' float dInk=d;',
    // ground under this pixel: ink colour and polarity
    ' vec3 g=uBase.rgb;float pol=uBase.a;int ng=int(uCount.w);',
    ' for(int i=0;i<MAXG;i++){if(i>=ng)break;float c=cover(p,uG[i],1.0);g=mix(g,uGC[i].rgb,c);pol=mix(pol,uGC[i].a,c);}',
    ' pol=step(0.5,pol);g=mix(g,uInkT.rgb,uInkT.a);',
    ' vec3 col=g;float clip=1.0;',
    ' vec2 dp=p-uPar.xy;float lobe=exp(-dot(dp,dp)/4200.0);',
    ' int ns=int(uCount.y);',
    ' for(int i=0;i<MAXS;i++){if(i>=ns)break;vec4 A=uSA[i];vec4 B=uSB[i];vec4 C=uSC[i];vec4 D=uSD[i];',
    '  vec2 pp=p;if(D.z!=0.0){vec2 v=p-A.xy;float c=cos(D.z),s=sin(D.z);pp=A.xy+vec2(c*v.x+s*v.y,-s*v.x+c*v.y);}',
    '  float db=sdBox(pp,A.xy,A.zw,B.x);',
    '  vec3 sc=C.rgb;float sh=db;',
    '  if(D.x>4.5){',                                   // edge of a coloured section: merges from either side
    '   if(db>=0.0){if(mod(D.y,2.0)<0.5)continue;}',
    '   else{if(D.y<1.5)continue;sh=-db;sc=uSE[i].rgb;}',
    '  }else{',
    '   if(D.x!=2.0){float off=D.x>2.5&&D.x<3.5?1.0:0.0;float same=max(D.w,off);',
    '    clip=min(clip,clamp(db+D.y*same+(D.w>0.5?2.0:0.5),0.0,1.0));}',
    '   else if(D.w<0.5){clip=min(clip,clamp(abs(db+B.y*0.5)-B.y*0.5+0.5,0.0,1.0));}',   // the inside of a control is never painted
    '   if(D.x>2.5&&D.x<3.5)continue;',                             // data-ink="off" zone
    '   if(B.y>0.0)sh=abs(db+B.y*0.5)-B.y*0.5;',
    '  }',
    '  sh=max(sh,0.0)+0.6-B.w*lobe;',
    // each page shape merges with the ink only, never with its neighbours
    '  d=min(d,smin(dInk,sh,C.w));}',
    // artwork (icons, logo, illustrations): a distance field made from the image itself, joined like any shape
    ' float mf=0.0;float ko=1.0;',
    ' if(uTint.y>0.5){float s=artD(uT0,uAR[0],p);if(s<900.0){ko=min(ko,clamp(s+3.0,0.0,1.0));if(uAC[0].x>0.5){mf=max(mf,1.0-clamp((s-1.0)/2.0,0.0,1.0));}if(uAC[0].z>0.5){d=min(d,smin(dInk,max(s,0.0)+uAC[0].y,uAC[0].a));}}}',
    ' if(uTint.y>1.5){float s=artD(uT1,uAR[1],p);if(s<900.0){ko=min(ko,clamp(s+3.0,0.0,1.0));if(uAC[1].x>0.5){mf=max(mf,1.0-clamp((s-1.0)/2.0,0.0,1.0));}if(uAC[1].z>0.5){d=min(d,smin(dInk,max(s,0.0)+uAC[1].y,uAC[1].a));}}}',
    ' if(uTint.y>2.5){float s=artD(uT2,uAR[2],p);if(s<900.0){ko=min(ko,clamp(s+3.0,0.0,1.0));if(uAC[2].x>0.5){mf=max(mf,1.0-clamp((s-1.0)/2.0,0.0,1.0));}if(uAC[2].z>0.5){d=min(d,smin(dInk,max(s,0.0)+uAC[2].y,uAC[2].a));}}}',
    ' if(uTint.y>3.5){float s=artD(uT3,uAR[3],p);if(s<900.0){ko=min(ko,clamp(s+3.0,0.0,1.0));if(uAC[3].x>0.5){mf=max(mf,1.0-clamp((s-1.0)/2.0,0.0,1.0));}if(uAC[3].z>0.5){d=min(d,smin(dInk,max(s,0.0)+uAC[3].y,uAC[3].a));}}}',
    ' float a=clamp(0.5-d*dpr,0.0,1.0)*clip*ko;',
    // text / art boxes: m = behind (blend layer), ms = same-colour text (wash)
    ' float m=0.0;float ms=0.0;int nm=int(uCount.z);',
    ' for(int i=0;i<MAXM;i++){if(i>=nm)break;vec4 r=uM[i]+vec4(-8.0,-8.0,8.0,8.0);vec2 e=min(p-r.xy,r.zw-p);',
    '  float c=clamp(min(e.x,e.y)/16.0,0.0,1.0);if(float(i)<uPass.z)m=max(m,c);else ms=max(ms,c);}',
    ' a*=1.0-(1.0-uTint.x)*ms;m*=1.0-ms;m=max(m,mf);',
    // behind-text pixels: the blend layer paints them in full, the normal layer fades out over them (no ground leaks in the feather)
    ' float mt=1.0-abs(pol-uPass.y);',
    ' float o=uPass.x<0.5?a*(1.0-m*mt):a*step(0.004,m)*mt;',
    ' vec4 outc=vec4(col*o,o);',
    ' if(uPass.x<0.5&&uDotP.z>0.3){float da=clamp(0.5-(length(p-uDotP.xy)-uDotP.z)*dpr,0.0,1.0)*uDotC.a;outc=outc*(1.0-da)+vec4(uDotC.rgb*da,da);}',
    ' gl_FragColor=outc;',
    '}'
  ].join('\n');

  // ------------------------------------------------------------------ state
  let on = false, raf = 0, last = 0, frameNo = 0;
  let layers = [];                 // [{canvas, gl, U, dirty}]  0 = normal, 1 = blend
  let W = 0, H = 0, DPR = 1, SX = 0, SY = 0, BOX = 560, baseR = 24, blendPol = -1;
  let px = 0, py = 0, pin = false, seen = false, kb = false, modal = false;
  let hx = 0, hy = 0, hvx = 0, hvy = 0;
  const nx = new Float32Array(MAXN), ny = new Float32Array(MAXN), nr = new Float32Array(MAXN), nvx = new Float32Array(MAXN), nvy = new Float32Array(MAXN);
  let lastS = 0, lastM = [], lastInk = [0, 0, 0], heldTint = null;
  const dpx = new Float32Array(MAXD), dpy = new Float32Array(MAXD), dvx = new Float32Array(MAXD), dvy = new Float32Array(MAXD);
  const dR = new Float32Array(MAXD), dAge = new Float32Array(MAXD).fill(1), dLife = new Float32Array(MAXD), bufD = new Float32Array(MAXD * 4);
  let clickable = false, dotA = 0, dotV = 0, dotBusy = false;
  const dotC = [1, 1, 1];
  let elongV = 0, tintA = 0, liveArts = [], artTimer = 0;
  const tintC = [0, 0, 0];
  const bufAR = new Float32Array(16), bufAC = new Float32Array(16);
  let llx = 0, lly = 0, lvx = 0, lvy = 0, lastTextField = 0;
  let mass = 0, strength = 1, elong = 0, dirC = 1, dirS = 0, pulse = 0, pulseV = 0;
  let tailL = 0, retract = 0, gulped = true, life = 0, clock = 0;
  let hugT = 0, hugV = 0, hugRec = null, hugR = 0;
  const hug = [0, 0, 0, 0];
  const skin = new Map();          // control record -> {s, v, stick, on, f}
  let absorbed = null;
  let map = { grounds: [], solids: [], hugs: [], masks: [], off: [], on: [], all: [], scopes: [], hiddenSkipped: 0, base: [1, 1, 1, 1], basePol: 0 };
  let byEl = new WeakMap();
  let scopeSet = new WeakSet(), curScope = null, ptScope = null, viewGen = 0, viewKey = '', viewCache = null;
  let dirty = true, idleId = 0, measureTimer = 0, scrollTimer = 0, lastBuild = 0;
  let mo = null, ro = null, styleEl = null, lateBuild = 0, away = false;
  const stats = { frames: 0, cpu: [], build: 0, measure: 0, gpu: '' };

  const bufN = new Float32Array(MAXN * 4), bufSA = new Float32Array(MAXS * 4), bufSB = new Float32Array(MAXS * 4);
  const bufSC = new Float32Array(MAXS * 4), bufSD = new Float32Array(MAXS * 4), bufSE = new Float32Array(MAXS * 4);
  const bufM = new Float32Array(MAXM * 4), bufG = new Float32Array(MAXG * 4), bufGC = new Float32Array(MAXG * 4);

  // ------------------------------------------------------------------ rect map (built off the loop)
  function isInteractive(el, tag) {
    if (tag === 'A') return el.hasAttribute('href');
    if (tag === 'BUTTON' || tag === 'SUMMARY' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'LABEL') return true;
    if (tag === 'INPUT') return el.type !== 'hidden';
    const role = el.getAttribute('role');
    return role === 'button' || role === 'link' || role === 'tab' || el.hasAttribute('data-estimate-open') ||
      (el.hasAttribute('tabindex') && el.tabIndex >= 0);
  }
  function hasDirectText(el) {
    for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.data)) return true;
    return false;
  }
  let range = null;
  function rectOf(rec) {
    if (rec.text) {
      if (!range) range = doc.createRange();
      range.selectNodeContents(rec.el);
      const r = range.getBoundingClientRect();
      if (r.width > 1 && r.height > 1) return r;
    }
    return rec.el.getBoundingClientRect();
  }
  function place(rec, r) {
    const ox = rec.fixed ? 0 : SX, oy = rec.fixed ? 0 : SY;
    rec.x0 = r.left + ox; rec.y0 = r.top + oy; rec.x1 = r.right + ox; rec.y1 = r.bottom + oy;
  }
  function radiusOf(cs, r) {
    const v = cs.borderTopLeftRadius || '0';
    let n = parseFloat(v) || 0;
    if (v.indexOf('%') > 0) n = n / 100 * Math.min(r.width, r.height);
    return Math.min(n, Math.min(r.width, r.height) / 2);
  }
  function add(list, rec) { rec.scope = curScope; list.push(rec); map.all.push(rec); if (!byEl.has(rec.el) || rec.kind === 'solid') byEl.set(rec.el, rec); return rec; }
  // A rotated control (cecf1.is-tilted): keep its own box and angle so the join follows the tilt.
  function warps(t) {      // a transform that is more than a move
    return !!t && t !== 'none' && !/^matrix\(1, 0, 0, 1, /.test(t) && !/^matrix3d\(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, /.test(t);
  }
  // angle and scale of a chain of transformed ancestors (2D part)
  function orient(rec) {
    let a = 0, sc = 1;
    for (let i = 0; i < rec.chain.length; i++) {
      const t = getComputedStyle(rec.chain[i]).transform;
      const m = t && t.match(/^matrix\(([^,]+),\s*([^,]+)/);
      if (!m) continue;
      a += Math.atan2(+m[2], +m[1]); sc *= Math.hypot(+m[1], +m[2]) || 1;
    }
    rec.rot = Math.abs(a) < 0.002 ? 0 : a; rec.ow = rec.ow0 * sc; rec.oh = rec.oh0 * sc; rec.tilted = true;
  }
  function tilt(rec, cs) {
    if (rec.chain) { orient(rec); return; }
    rec.rot = 0;
    const t = cs.transform;
    if (!t || t === 'none') return;
    const m = t.match(/^matrix\(([^,]+),\s*([^,]+)/);
    if (!m) return;
    const a = Math.atan2(+m[2], +m[1]);
    if (Math.abs(a) < 0.002) return;
    rec.chain = [rec.el]; rec.ow0 = rec.el.offsetWidth; rec.oh0 = rec.el.offsetHeight;
    orient(rec);
  }
  // A coloured area: a ground (decides the ink colour inside it) plus an edge the ink can merge with.
  function addGround(el, fixed, r, bg, parent, rad) {
    const gi = inkFor(bg);
    const gr = add(map.grounds, { el: el, fixed: fixed, kind: 'ground', ink: gi, bg: bg, pol: polOf(bg, gi) });
    place(gr, r);
    let side = 0;
    if (cdist(bg, inkFor(parent)) < 0.3) side += 1;   // seen from outside, this fill is the ink's colour
    if (cdist(parent, gi) < 0.3) side += 2;           // seen from inside, the surround is the ink's colour
    if (side) {
      const ed = add(map.solids, { el: el, fixed: fixed, kind: 'edge', mode: 5, ring: 0, radius: rad, col: bg, pcol: parent, side: side });
      place(ed, r);
    }
  }

  function build() {
    if (!on) return;
    const t0 = performance.now();
    SX = window.scrollX; SY = window.scrollY;
    readPalette();
    map = { grounds: [], solids: [], hugs: [], masks: [], off: [], on: [], all: [], scopes: [], hiddenSkipped: 0, base: null, basePol: 0 };
    byEl = new WeakMap();
    scopeSet = new WeakSet(); curScope = null;
    temps = [];
    let start = parseColor(getComputedStyle(root).backgroundColor);
    if (!start || start[3] < 0.85) start = parseColor(getComputedStyle(doc.body).backgroundColor);
    if (!start || start[3] < 0.85) {
      const host = doc.querySelector('[data-flwr]');
      start = host ? parseColor(getComputedStyle(host).backgroundColor) : null;
    }
    if (!start || start[3] < 0.85) start = [1, 1, 1, 1];
    map.base = inkFor(start);
    map.baseBg = start;
    map.basePol = polOf(start, map.base);
    function visit(el, ground, fixed, flags, scope, clip, chain) {
      if (el.hasAttribute('data-ink-cursor')) return;
      const tag = el.tagName, local = el.localName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEMPLATE' || tag === 'NOSCRIPT' || tag === 'LINK' || tag === 'META') return;
      if (tag === 'DIALOG' && !el.open) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return;
      // not rendered at all: the body of a closed <details>, content-visibility: hidden (it still reports a box)
      if (el.checkVisibility && !el.checkVisibility()) { map.hiddenSkipped++; return; }
      const r = el.getBoundingClientRect();
      const inkAttr = el.getAttribute('data-ink');
      if (cs.position === 'fixed' && r.width > 1 && r.height > 1) {
        fixed = true; scope = el;
        const sb = parseColor(cs.backgroundColor);
        scopeSet.add(el);
        map.scopes.push({ el: el, fixed: true, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, radius: radiusOf(cs, r), ring: 0, col: [0, 0, 0], opaque: !!sb && sb[3] > 0.85 });
      }
      curScope = scope;
      if (cs.position === 'fixed') clip = null;                     // a fixed element escapes its ancestors' clipping
      if (+cs.opacity <= 0.05) { map.hiddenSkipped++; return; }      // nothing inside a transparent element shows
      if (clip && cs.display !== 'contents' && (r.right <= clip[0] + 1 || r.left >= clip[2] - 1 || r.bottom <= clip[1] + 1 || r.top >= clip[3] - 1)) {
        map.hiddenSkipped++;
        return;
      }
      if (warps(cs.transform) || (cs.rotate && cs.rotate !== 'none') || (cs.scale && cs.scale !== 'none')) chain = (chain || []).concat([el]);
      const warped = !!chain;
      let kidClip = clip;
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        kidClip = clip ? [Math.max(clip[0], r.left), Math.max(clip[1], r.top), Math.min(clip[2], r.right), Math.min(clip[3], r.bottom)] : [r.left, r.top, r.right, r.bottom];
      }
      if (inkAttr === 'off') {
        if (r.width > 1 && r.height > 1) { const z = add(map.off, { el: el, fixed: fixed, kind: 'off' }); place(z, r); }
        return;
      }
      if (inkAttr === 'on') { const zo = add(map.on, { el: el, fixed: fixed, kind: 'on' }); place(zo, r); }
      let g = ground;
      const visible = cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width >= 2 && r.height >= 2;
      if (visible) {
        const area = r.width * r.height;
        const small = area <= 70000 && Math.max(r.width, r.height) <= 560;
        const bg = parseColor(cs.backgroundColor);
        const opaqueBg = bg && bg[3] > 0.85 && cdist(bg, ground) > 0.08;
        const bw = cs.borderTopStyle !== 'none' ? parseFloat(cs.borderTopWidth) || 0 : 0;
        const bc = bw >= 2 ? parseColor(cs.borderTopColor) : null;
        const opaqueBorder = bc && bc[3] > 0.85 && cdist(bc, ground) > 0.08;
        const rad = radiusOf(cs, r);
        const inter = isInteractive(el, tag);
        // An inline SVG whose first shape is a rect is a drawn panel (the contact band chrome): a ground.
        if (local === 'svg' && !(flags & 3)) {
          const first = el.firstElementChild;
          if (first && first.localName === 'rect' && area > 70000) {
            const fc = parseColor(getComputedStyle(first).fill);
            if (fc && fc[3] > 0.85) {
              const vb = el.viewBox && el.viewBox.baseVal;
              const rx = (parseFloat(first.getAttribute('rx')) || 0) * (vb && vb.height ? r.height / vb.height : 1);
              addGround(el, fixed, r, fc, ground, Math.min(rx, r.height / 2));
              return;
            }
          }
        }
        if (opaqueBg) {
          if (!small) {
            if (!warped) addGround(el, fixed, r, bg, ground, rad);
            g = bg;
          } else {
            const so = add(map.solids, { el: el, fixed: fixed, kind: 'solid', mode: 1, ring: 0, radius: rad, col: bg, inter: inter });
            place(so, r); if (warped) { so.chain = chain; so.ow0 = el.offsetWidth; so.oh0 = el.offsetHeight; orient(so); }
            flags |= 1;
          }
        } else if (opaqueBorder) {
          const ri = add(map.solids, { el: el, fixed: fixed, kind: small ? 'solid' : 'panel', mode: small ? 4 : 2, ring: bw, radius: rad, col: bc, inter: inter });
          place(ri, r); if (warped) { ri.chain = chain; ri.ow0 = el.offsetWidth; ri.oh0 = el.offsetHeight; orient(ri); }
          if (small) flags |= 1;
        } else if (inter && !warped && !(flags & 3) && area < 160000 && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || /\S/.test(el.textContent))) {
          const hu = add(map.hugs, { el: el, fixed: fixed, kind: 'hug', ground: ground, text: tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' });
          place(hu, rectOf(hu));
        }
        if (!(flags & 3) && !warped) {
          if (tag === 'IMG' || local === 'svg' || tag === 'VIDEO' || tag === 'CANVAS' || tag === 'PICTURE' || tag === 'IFRAME') {
            if ((tag === 'IMG' || local === 'svg') && Math.max(r.width, r.height) <= 1600 && r.width > 6 && r.height > 6) {
              const me = add(map.masks, { el: el, fixed: fixed, kind: 'mask', gInk: inkFor(g), art: true });
              place(me, r);
            }
          } else if (hasDirectText(el)) {
            const tc = parseColor(cs.color);
            const tm = { el: el, fixed: fixed, kind: 'mask', text: true, gInk: inkFor(g), same: O.textTint < 0.999 && !!tc && cdist(tc, inkFor(g)) < 0.3 };
            const tr = rectOf(tm);
            const shown = !kidClip || (tr.right > kidClip[0] + 1 && tr.left < kidClip[2] - 1 && tr.bottom > kidClip[1] + 1 && tr.top < kidClip[3] - 1);
            if (tr.width > 1 && tr.height > 1 && shown) { add(map.masks, tm); place(tm, tr); }
          }
        }
      }
      if (local === 'svg' || tag === 'IMG' || tag === 'VIDEO' || tag === 'IFRAME') return;
      const shut = tag === 'DETAILS' && !el.open;
      for (let c = el.firstElementChild; c; c = c.nextElementSibling) { if (shut && c.tagName !== 'SUMMARY') continue; visit(c, g, fixed, flags, scope, kidClip, chain); }
    }
    for (let c = doc.body.firstElementChild; c; c = c.nextElementSibling) visit(c, start, false, 0, null, null, null);
    curScope = null; viewGen++;
    modal = !!doc.querySelector('dialog[open]');
    dirty = false;
    lastBuild = performance.now();
    stats.build = lastBuild - t0;
    wake();
  }
  function measure() {
    if (!on) return;
    const t0 = performance.now();
    SX = window.scrollX; SY = window.scrollY;
    const a = map.all;
    let moved = false;
    for (let i = 0; i < a.length; i++) {
      const rec = a[i], x0 = rec.x0, y0 = rec.y0, x1 = rec.x1, y1 = rec.y1;
      if (!rec.el.isConnected) { rec.x0 = rec.y0 = rec.x1 = rec.y1 = -1e6; continue; }
      place(rec, rectOf(rec));
      if (rec.tilted) tilt(rec, getComputedStyle(rec.el));
      if (Math.abs(rec.x0 - x0) + Math.abs(rec.y0 - y0) + Math.abs(rec.x1 - x1) + Math.abs(rec.y1 - y1) > 1) moved = true;
    }
    stats.measure = performance.now() - t0;
    if (moved) wake();
  }
  const ric = window.requestIdleCallback || function (f) { return setTimeout(f, 60); };
  const cic = window.cancelIdleCallback || clearTimeout;
  function scheduleBuild(delay) {
    dirty = true;
    if (idleId) return;
    const wait = Math.max(delay || 0, 1200 - (performance.now() - lastBuild));
    idleId = setTimeout(function () { idleId = ric(function () { idleId = 0; if (pin || !seen) build(); }, { timeout: 800 }); }, wait);
  }
  // Moving things (carousels, scroll-driven reveals) drift; re-measure the cached rects in idle time while the
  // pointer is in the window. Never in the rAF loop. Stops 2 s after the pointer last moved.
  let lastMove = 0, measuring = false;
  function scheduleMeasure() {
    clearTimeout(measureTimer);
    measuring = true;
    measureTimer = setTimeout(function () {
      ric(function () {
        if (pin && on) { if (dirty) build(); else measure(); }
        if (pin && on && performance.now() - lastMove < 2000) scheduleMeasure(); else measuring = false;
      }, { timeout: 500 });
    }, 700);
  }

  // ------------------------------------------------------------------ art fields
  // An image or inline SVG is drawn once into a small canvas; its alpha becomes a signed distance field (two-pass
  // chamfer), stored as bytes. The shader samples it, so the ink fillets to the real outline of an icon or drawing.
  const fields = new WeakMap();
  function chamfer(inside, w, h) {
    const d = new Float32Array(w * h), BIG = 1e6, A = 1, B = 1.4142;
    let x, y, i, v;
    for (i = 0; i < w * h; i++) d[i] = inside[i] ? 0 : BIG;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x; v = d[i];
      if (v === 0) continue;
      if (x > 0) v = Math.min(v, d[i - 1] + A);
      if (y > 0) { v = Math.min(v, d[i - w] + A); if (x > 0) v = Math.min(v, d[i - w - 1] + B); if (x < w - 1) v = Math.min(v, d[i - w + 1] + B); }
      d[i] = v;
    }
    for (y = h - 1; y >= 0; y--) for (x = w - 1; x >= 0; x--) {
      i = y * w + x; v = d[i];
      if (v === 0) continue;
      if (x < w - 1) v = Math.min(v, d[i + 1] + A);
      if (y < h - 1) { v = Math.min(v, d[i + w] + A); if (x < w - 1) v = Math.min(v, d[i + w + 1] + B); if (x > 0) v = Math.min(v, d[i + w - 1] + B); }
      d[i] = v;
    }
    return d;
  }
  function artColor(el, f) {
    if (f.current) { const c = parseColor(getComputedStyle(el).color); if (c && c[3] > 0.3) f.col = c; }
  }
  // alpha in a 2D canvas -> signed distance bytes
  function fieldFromCanvas(f, cx, tw, th, scale, innerArea, isText) {
    const px4 = cx.getImageData(0, 0, tw, th).data;
    const n = tw * th, inside = new Uint8Array(n), outside = new Uint8Array(n);
    let cnt = 0, cr = 0, cg = 0, cb = 0, i;
    for (i = 0; i < n; i++) {
      if (px4[i * 4 + 3] > 127) { inside[i] = 1; cnt++; cr += px4[i * 4]; cg += px4[i * 4 + 1]; cb += px4[i * 4 + 2]; } else outside[i] = 1;
    }
    // a photo (a filled rectangle) or an empty image has no outline worth joining
    if (cnt < 12 || (!isText && cnt > innerArea * 0.96)) { f.state = 'dead'; f.photo = cnt >= 12; return; }
    const dOut = chamfer(inside, tw, th), dIn = chamfer(outside, tw, th);
    const sd = new Float32Array(n);
    for (i = 0; i < n; i++) sd[i] = (dOut[i] > 0 ? dOut[i] - 0.5 : 0.5 - dIn[i]) / scale;
    const out = new Uint8Array(n);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      // 3x3 box: takes the stair-steps out of the chamfer
      let acc = 0, k = 0;
      for (let j = -1; j <= 1; j++) { const yy = y + j; if (yy < 0 || yy >= th) continue; for (let q = -1; q <= 1; q++) { const xx = x + q; if (xx < 0 || xx >= tw) continue; acc += sd[yy * tw + xx]; k++; } }
      const v = 127.5 - (acc / k) / FRANGE * 127.5;
      out[y * tw + x] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    f.data = out; f.w = tw; f.h = th; f.sc = scale;
    f.col = [cr / cnt / 255, cg / cnt / 255, cb / cnt / 255, 1];
    f.state = 'ready';
    wake();
  }
  // Text: the element's own words are drawn into the canvas where the browser laid them out (one range rect per
  // word, the element's computed font), so letters become a shape the ink can fillet to, like an icon.
  function ensureTextField(rec) {
    const el = rec.el;
    const wpx = rec.x1 - rec.x0, hpx = rec.y1 - rec.y0;
    if (wpx < 4 || hpx < 4 || wpx > 2400 || hpx > 1000) return null;
    const key = 't' + Math.round(wpx) + 'x' + Math.round(hpx) + ':' + el.textContent.length;
    let f = fields.get(el);
    if (f && f.key === key) return f;
    const now = performance.now();
    if (now - lastTextField < 45) return null;        // one at a time: each costs a few milliseconds
    lastTextField = now;
    f = { key: key, state: 'pending', data: null, w: 0, h: 0, sc: 1, col: null, current: true, isText: true, tex: [] };
    fields.set(el, f);
    setTimeout(function () {
      try {
        const br = rectOf(rec);
        const scale = Math.min(1, Math.sqrt(300000 / ((wpx + 2 * FPAD) * (hpx + 2 * FPAD))));
        const tw = Math.ceil((wpx + 2 * FPAD) * scale), th = Math.ceil((hpx + 2 * FPAD) * scale);
        const cv = doc.createElement('canvas');
        cv.width = tw; cv.height = th;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        const cs = getComputedStyle(el);
        const fs = parseFloat(cs.fontSize) || 16;
        cx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + (fs * scale) + 'px ' + cs.fontFamily;
        const ls = parseFloat(cs.letterSpacing) || 0;
        if ('letterSpacing' in cx) cx.letterSpacing = (ls * scale) + 'px';
        if ('fontKerning' in cx && cs.fontKerning) cx.fontKerning = cs.fontKerning;
        cx.textBaseline = 'alphabetic';
        cx.fillStyle = '#000';
        const asc = cx.measureText('Hg').fontBoundingBoxAscent || fs * scale * 0.8;
        const tt = cs.textTransform;
        const r2 = doc.createRange();
        for (let node = el.firstChild; node; node = node.nextSibling) {
          if (node.nodeType !== 3) continue;
          const re = /\S+/g;
          let m;
          while ((m = re.exec(node.data))) {
            r2.setStart(node, m.index); r2.setEnd(node, m.index + m[0].length);
            const rects = r2.getClientRects();
            if (!rects.length) continue;
            let word = m[0];
            if (tt === 'uppercase') word = word.toUpperCase();
            else if (tt === 'lowercase') word = word.toLowerCase();
            else if (tt === 'capitalize') word = word.charAt(0).toUpperCase() + word.slice(1);
            cx.fillText(word, (rects[0].left - br.left + FPAD) * scale, (rects[0].top - br.top + FPAD) * scale + asc);
          }
        }
        fieldFromCanvas(f, cx, tw, th, scale, 0, true);
        if (f.state === 'ready') artColor(el, f);
      } catch (err) { f.state = 'dead'; }
    }, 0);
    return f;
  }
  function ensureField(rec) {
    if (rec.text) return ensureTextField(rec);
    const el = rec.el;
    const isImg = el.tagName === 'IMG';
    const wpx = rec.x1 - rec.x0, hpx = rec.y1 - rec.y0;
    if (wpx < 6 || hpx < 6) return null;
    const key = Math.round(wpx) + 'x' + Math.round(hpx) + (isImg ? el.currentSrc || el.src : '');
    let f = fields.get(el);
    if (f && f.key === key) return f;
    f = { key: key, state: 'pending', data: null, w: 0, h: 0, sc: 1, col: null, current: false, tex: [] };
    fields.set(el, f);
    const scale = Math.min(1, Math.sqrt(300000 / ((wpx + 2 * FPAD) * (hpx + 2 * FPAD))));   // by area: a long strip of lettering keeps full detail
    const tw = Math.ceil((wpx + 2 * FPAD) * scale), th = Math.ceil((hpx + 2 * FPAD) * scale);
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onerror = function () { f.state = 'dead'; };
    im.onload = function () {
      try {
        const cv = doc.createElement('canvas');
        cv.width = tw; cv.height = th;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        let dx = 0, dy = 0, dw = wpx, dh = hpx;
        if (isImg && im.naturalWidth && im.naturalHeight) {
          const ics = getComputedStyle(el), fit = ics.objectFit || 'fill';
          if (fit !== 'fill') {
            const iw = im.naturalWidth, ih = im.naturalHeight;
            let k = fit === 'cover' ? Math.max(wpx / iw, hpx / ih) : fit === 'none' ? 1 : Math.min(wpx / iw, hpx / ih);
            if (fit === 'scale-down') k = Math.min(1, k);
            dw = iw * k; dh = ih * k;
            const pos = (ics.objectPosition || '50% 50%').split(' ');
            const fx = /%$/.test(pos[0]) ? parseFloat(pos[0]) / 100 : 0.5, fy = pos[1] && /%$/.test(pos[1]) ? parseFloat(pos[1]) / 100 : 0.5;
            dx = (wpx - dw) * fx; dy = (hpx - dh) * fy;
          }
        }
        cx.save();
        cx.beginPath(); cx.rect(FPAD * scale, FPAD * scale, wpx * scale, hpx * scale); cx.clip();
        cx.drawImage(im, (FPAD + dx) * scale, (FPAD + dy) * scale, dw * scale, dh * scale);
        cx.restore();
        f.current = !isImg && /currentColor/i.test(el.outerHTML);
        fieldFromCanvas(f, cx, tw, th, scale, wpx * scale * hpx * scale, false);
        if (f.state === 'ready') artColor(el, f);
      } catch (err) { f.state = 'dead'; }
    };
    if (isImg) im.src = el.currentSrc || el.src;
    else {
      const clone = el.cloneNode(true);
      const cs = getComputedStyle(el);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', wpx); clone.setAttribute('height', hpx);
      clone.removeAttribute('class');
      clone.style.color = cs.color;
      if (cs.fill && cs.fill !== 'none' && !el.getAttribute('fill')) clone.style.fill = cs.fill;
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    }
    return f;
  }
  // distance (page px) from a client point to the artwork's outline, from the CPU copy of the field
  function fieldAt(rec, f, x, y) {
    const ox = rec.fixed ? 0 : SX, oy = rec.fixed ? 0 : SY;
    const u = Math.round((x - (rec.x0 - ox - FPAD)) * f.sc), v = Math.round((y - (rec.y0 - oy - FPAD)) * f.sc);
    if (u < 0 || v < 0 || u >= f.w || v >= f.h) return 1e3;
    return (0.5 - f.data[v * f.w + u] / 255) * 2 * FRANGE;
  }
  function fieldTex(L, li, f) {
    const gl = L.gl;
    const t = f.tex[li];
    if (t && t.gen === L.gen) return t.tex;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, f.w, f.h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, f.data);
    f.tex[li] = { tex: tex, gen: L.gen };
    return tex;
  }
  // a hover can recolour an icon or the logo (currentColor): read the colour again a few times after the pointer
  // crosses an element, so the ink joins it in the hover colour
  function rereadArts() {
    for (let i = 0; i < liveArts.length; i++) artColor(liveArts[i][0].el, liveArts[i][1]);
    wake();
  }
  function scheduleArtColors() {
    if (!liveArts.length || artTimer) return;
    artTimer = setTimeout(function () { artTimer = 0; rereadArts(); setTimeout(rereadArts, 190); setTimeout(rereadArts, 420); }, 30);
  }

  // ------------------------------------------------------------------ GL (two small canvases that travel with the ink)
  const UNI = ['uDotP', 'uDotC', 'uLead', 'uDrop', 'uT0', 'uT1', 'uT2', 'uT3', 'uAR', 'uAC', 'uInkT', 'uView', 'uHead', 'uHeadX', 'uHug', 'uNode', 'uSA', 'uSB', 'uSC', 'uSD', 'uSE', 'uM', 'uG', 'uGC', 'uBase', 'uPar', 'uCount', 'uPass', 'uTint'];
  function initGL(L) {
    const opts = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' };
    const gl = L.canvas.getContext('webgl', opts) || L.canvas.getContext('experimental-webgl', opts);
    if (!gl) return false;
    if (gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) < 128) return false;
    function sh(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('[ink-cursor] shader:', gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    const v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS);
    if (!v || !f) return false;
    const prog = gl.createProgram();
    gl.attachShader(prog, v); gl.attachShader(prog, f);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('[ink-cursor] link:', gl.getProgramInfoLog(prog)); return false; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    L.U = {};
    UNI.forEach(function (n) { L.U[n] = gl.getUniformLocation(prog, n) || gl.getUniformLocation(prog, n + '[0]'); });
    gl.uniform1i(L.U.uT0, 0); gl.uniform1i(L.U.uT1, 1); gl.uniform1i(L.U.uT2, 2); gl.uniform1i(L.U.uT3, 3);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    L.gen = (L.gen || 0) + 1;
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    stats.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
    L.gl = gl;
    L.dirty = true;
    return true;
  }
  function makeLayer(blend) {
    const canvas = doc.createElement('canvas');
    canvas.className = 'ink-cursor_canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('data-ink-cursor', blend ? 'blend' : 'normal');
    const s = canvas.style;
    s.position = 'fixed'; s.top = '0'; s.left = '0'; s.display = 'block';
    s.pointerEvents = 'none'; s.zIndex = blend ? '2147483000' : '2147483001';
    s.willChange = 'transform';
    doc.body.appendChild(canvas);
    let top = false;
    if (typeof canvas.showPopover === 'function') {
      try {
        canvas.setAttribute('popover', 'manual');
        s.margin = '0'; s.borderWidth = '0'; s.padding = '0'; s.background = 'transparent'; s.right = 'auto'; s.bottom = 'auto'; s.overflow = 'visible'; s.maxWidth = 'none'; s.maxHeight = 'none';
        canvas.showPopover();
        top = true;
      } catch (e) { canvas.removeAttribute('popover'); }
    }
    const L = { canvas: canvas, gl: null, U: null, dirty: true, blend: blend, top: top };
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; });
    canvas.addEventListener('webglcontextrestored', function () { if (initGL(L)) { resize(); wake(); } });
    return L;
  }
  // put the canvases back on top of the top layer: blend first, normal above it
  function raise() {
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i];
      if (!L.top) continue;
      try { L.canvas.hidePopover(); L.canvas.showPopover(); } catch (e) { /* not connected */ }
    }
    wake();
  }
  function onToggle(e) {
    const t = e.target;
    if (!t || t.nodeType !== 1 || t.hasAttribute('data-ink-cursor') || t.tagName === 'DETAILS') return;
    if (e.newState === 'open') raise();
  }
  function resize() {
    if (!layers.length) return;
    W = root.clientWidth; H = root.clientHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    baseR = Math.max(22, Math.min(36, W * 0.015)) * O.size;
    // room for the body plus the longest strand: a join reaches about one union radius along a button's edge
    BOX = Math.round(Math.max(baseR * 11, baseR * 8 + 26 * O.goo * 1.3 * 3 + 24)) * 2;
    layers.forEach(function (L) {
      L.canvas.width = L.canvas.height = Math.round(BOX * DPR);
      L.canvas.style.width = L.canvas.style.height = BOX + 'px';
      if (L.gl) L.gl.viewport(0, 0, L.canvas.width, L.canvas.height);
      L.dirty = true;
    });
  }

  // ------------------------------------------------------------------ loop
  function wake() { if (on && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function sat(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function within(rec, x, y, pad) {
    const ox = rec.fixed ? 0 : SX, oy = rec.fixed ? 0 : SY;
    return x >= rec.x0 - ox - pad && x <= rec.x1 - ox + pad && y >= rec.y0 - oy - pad && y <= rec.y1 - oy + pad;
  }
  function areaOf(rec) { return (rec.x1 - rec.x0) * (rec.y1 - rec.y0); }
  function boxDist(rec, x, y) {
    const ox = rec.fixed ? 0 : SX, oy = rec.fixed ? 0 : SY;
    const dx = Math.max(rec.x0 - ox - x, 0, x - (rec.x1 - ox)), dy = Math.max(rec.y0 - oy - y, 0, y - (rec.y1 - oy));
    return Math.hypot(dx, dy);
  }

  function live(rec) {
    if (rec.hidden) return false;
    if (ptScope) return rec.scope === ptScope;
    if (rec.scope || rec.kind === 'ground' || rec.kind === 'edge' || rec.kind === 'panel') return true;
    const sc = map.scopes;
    if (!sc.length) return true;
    const ox = rec.fixed ? 0 : SX, oy = rec.fixed ? 0 : SY;
    const cx = (rec.x0 + rec.x1) / 2 - ox, cy = (rec.y0 + rec.y1) / 2 - oy;
    for (let i = 0; i < sc.length; i++) if (sc[i].opaque && cx > sc[i].x0 && cx < sc[i].x1 && cy > sc[i].y0 && cy < sc[i].y1) return false;
    return true;
  }
  // the part of the map the ink can see from where the pointer is (cached until the pointer changes layer, the
  // page scrolls or the map changes)
  function viewOf() {
    const key = viewGen + ':' + SX + ':' + SY + ':' + map.solids.length;
    if (key === viewKey && viewCache) return viewCache;
    viewKey = key;
    viewCache = { grounds: map.grounds.filter(live), solids: map.solids.filter(live), hugs: map.hugs.filter(live), masks: map.masks.filter(live), off: map.off.filter(live), on: map.on.filter(live) };
    return viewCache;
  }
  function frame(now) {
    raf = 0;
    frameNo++;
    let V = viewOf();
    // things move (carousels, the card wheel, reveals): what is near the pointer is measured again now, at most
    // 90 boxes a frame. The rest of the map keeps its idle re-measure.
    if (pin && !doc.hidden) {
      const reach = BOX * 0.5;
      let budget = 90;
      const lists = [map.solids, map.masks, map.hugs];
      for (let li = 0; li < 3 && budget > 0; li++) {
        const L = lists[li];
        for (let q = 0; q < L.length && budget > 0; q++) {
          const rec = L[q];
          if (!within(rec, px, py, reach) || !rec.el.isConnected || (ptScope ? rec.scope !== ptScope : false)) continue;
          const rr = rectOf(rec);
          place(rec, rr);
          if (rec.chain) orient(rec);
          if (now - (rec.seenAt || 0) > 350) {
            rec.seenAt = now + (budget % 7) * 12;
            const mx = (rr.left + rr.right) / 2, my = (rr.top + rr.bottom) / 2;
            let hid = false;
            if (mx > 0 && my > 0 && mx < W && my < H) {
              const t = doc.elementFromPoint(mx, my);
              hid = !!t && t !== rec.el && !rec.el.contains(t) && !t.contains(rec.el);
            }
            if (hid !== !!rec.hidden) { rec.hidden = hid; viewGen++; }
          }
          budget--;
        }
      }
      V = viewOf();
    }
    const t0 = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    let i;

    // ---- what is under the pointer (cached map only)
    let off = !pin || kb || (modal && !(layers[0] && layers[0].top));
    let strengthT = 1, hugTarget = null, absorbT = null;
    if (!off) for (i = 0; i < V.off.length; i++) if (within(V.off[i], px, py, 0)) { off = true; break; }
    if (off !== away) { away = off; if (off) root.setAttribute('data-ink-away', ''); else root.removeAttribute('data-ink-away'); }
    if (!off) {
      for (i = 0; i < V.on.length; i++) if (within(V.on[i], px, py, 0)) strengthT = 1.35;
      let best = Infinity;
      for (i = 0; i < V.solids.length; i++) {
        const s = V.solids[i];
        if ((s.mode === 1 || s.mode === 4) && within(s, px, py, 0) && areaOf(s) < best) { best = areaOf(s); absorbT = s; }
      }
      if (!absorbT) {
        best = Infinity;
        for (i = 0; i < V.hugs.length; i++) {
          const hrec = V.hugs[i];
          if (O.underline > 0 && !hrec.fills && within(hrec, px, py, 4) && areaOf(hrec) < best) { best = areaOf(hrec); hugTarget = hrec; }
        }
      }
    }
    absorbed = absorbT;
    const massT = off ? 0 : 1;
    mass = ease(mass, massT, massT > mass ? 10 : 7, dt);
    if (Math.abs(mass - massT) < 0.002) mass = massT;
    strength = ease(strength, strengthT, 5, dt);
    const R = baseR * strength;
    const idle = now - lastMove;
    life = ease(life, pin && idle < 2600 ? 1 : 0, 3, dt);
    clock += dt * life;

    // ---- magnetism: the head leans toward the nearest control, and toward the centre of the one it is in
    let tx = px, ty = py;
    if (!off && O.magnet > 0) {
      if (absorbT) {
        const aox = absorbT.fixed ? 0 : SX, aoy = absorbT.fixed ? 0 : SY;
        tx += ((absorbT.x0 + absorbT.x1) / 2 - aox - px) * 0.25 * O.magnet; ty += ((absorbT.y0 + absorbT.y1) / 2 - aoy - py) * 0.25 * O.magnet;
      } else {
        const reach = R * 3.2;
        let bd = reach, mx = 0, my = 0;
        for (i = 0; i < V.solids.length; i++) {
          const s = V.solids[i];
          if (s.mode !== 1 && s.mode !== 4) continue;
          const mox = s.fixed ? 0 : SX, moy = s.fixed ? 0 : SY;
          const qx = Math.max(s.x0 - mox, Math.min(px, s.x1 - mox)), qy = Math.max(s.y0 - moy, Math.min(py, s.y1 - moy));
          const dd = Math.hypot(px - qx, py - qy);
          if (dd < bd) { bd = dd; mx = qx; my = qy; }
        }
        if (bd < reach) { const f = 0.7 * O.magnet * Math.pow(1 - bd / reach, 1.4); tx += (mx - px) * f; ty += (my - py) * f; }
      }
    }

    // ---- nose, belly, tail (fixed sub-steps).
    // The NOSE is the pointer: a stiff, critically damped follower a few milliseconds behind it, so pointing and
    // clicking are exact. The BELLY carries the mass on an underdamped spring: it lags, catches up, overshoots
    // and settles. Each tail blob chases the one before it, softer and softer. Magnetism leans the belly only.
    const steps = Math.ceil(dt / (1 / 240)), h = dt / steps;
    const wL = 70 + 50 * O.follow;
    const wH = 16 + 16 * O.follow, zH = Math.max(0.2, 0.86 - 0.36 * O.bounce);
    const wT = (64 - 44 * O.trail) * (0.6 + 0.4 * O.follow), zT = Math.max(0.2, 0.9 - 0.42 * O.bounce);
    const wE = 26, zE = Math.max(0.15, 0.85 - 0.55 * O.bounce);
    for (let st = 0; st < steps; st++) {
      lvx += (wL * wL * (px - llx) - 2 * wL * lvx) * h;
      lvy += (wL * wL * (py - lly) - 2 * wL * lvy) * h;
      llx += lvx * h; lly += lvy * h;
      hvx += (wH * wH * (tx - hx) - 2 * zH * wH * hvx) * h;
      hvy += (wH * wH * (ty - hy) - 2 * zH * wH * hvy) * h;
      hx += hvx * h; hy += hvy * h;
      let ax = hx, ay = hy;
      for (i = 0; i < MAXN; i++) {
        const w = wT * (1 - 0.07 * i);
        nvx[i] += (w * w * (ax - nx[i]) - 2 * zT * w * nvx[i]) * h;
        nvy[i] += (w * w * (ay - ny[i]) - 2 * zT * w * nvy[i]) * h;
        nx[i] += nvx[i] * h; ny[i] += nvy[i] * h;
        ax = nx[i]; ay = ny[i];
      }
      const eT = Math.min(0.6, Math.hypot(hvx, hvy) / 2200 * O.stretch);
      elongV += (wE * wE * (eT - elong) - 2 * zE * wE * elongV) * h;
      elong += elongV * h;
      pulseV += (-24 * 24 * pulse - 2 * 0.3 * 24 * pulseV) * h;
      pulse += pulseV * h;
      const hT = hugTarget ? 1 : 0;
      hugV += (20 * 20 * (hT - hugT) - 2 * 0.62 * 20 * hugV) * h;
      hugT += hugV * h;
    }
    if (hugT < 0) { hugT = 0; hugV = Math.max(0, hugV); }
    elong = Math.max(-0.32, Math.min(0.7, elong));
    // the belly never falls further behind the nose than the neck can stretch
    {
      const dx = hx - llx, dy = hy - lly, dl = Math.hypot(dx, dy), cap = R * (1.6 + 1.3 * O.stretch);
      if (dl > cap) {
        const ux = dx / dl, uy = dy / dl, vo = (hvx - lvx) * ux + (hvy - lvy) * uy;
        hx = llx + ux * cap; hy = lly + uy * cap;
        if (vo > 0) { hvx -= ux * vo; hvy -= uy * vo; }
      }
    }
    const sp = Math.hypot(hvx, hvy);
    // the body points from the belly to the nose (where it is going), or along its motion when they coincide
    {
      const dx = llx - hx, dy = lly - hy, dl = Math.hypot(dx, dy);
      let ca = 0, sa = 0, wgt = 0;
      if (dl > 3) { ca = dx / dl; sa = dy / dl; wgt = 1; } else if (sp > 30) { ca = hvx / sp; sa = hvy / sp; wgt = 1; }
      if (wgt) {
        const k1 = 1 - Math.exp(-60 * dt);
        dirC += (ca - dirC) * k1; dirS += (sa - dirS) * k1;
        const dn = Math.hypot(dirC, dirS) || 1; dirC /= dn; dirS /= dn;
      }
    }
    const breath = 1 + 0.02 * Math.sin(clock * 2.2) * O.wobble;
    const rh = R * mass * (1 + pulse) * breath;
    const hrx = rh * (1 + elong), hry = rh / (1 + elong * 0.55);
    // the body: fat blobs that shrink gently, kept overlapping so it is always one piece
    const thin = 1 - sat(hugT);
    tailL = 0;
    let lx = hx, ly = hy, lr = rh;
    for (i = 0; i < MAXN; i++) {
      const t = (i + 1) / MAXN;
      nr[i] = R * mass * thin * (0.9 - 0.62 * t);
      const dx = nx[i] - lx, dy = ny[i] - ly;
      const dl = Math.hypot(dx, dy), cap = 1.25 * (lr + nr[i]);
      if (dl > cap) {
        const f = cap / dl, ux = dx / dl, uy = dy / dl, vo = nvx[i] * ux + nvy[i] * uy;
        nx[i] = lx + dx * f; ny[i] = ly + dy * f;
        if (vo > 0) { nvx[i] -= ux * vo * 0.7; nvy[i] -= uy * vo * 0.7; }
      }
      tailL = Math.max(tailL, Math.hypot(nx[i] - hx, ny[i] - hy));
      lx = nx[i]; ly = ny[i]; lr = nr[i];
    }

    // texture: at low values the tail blobs are pulled onto a smooth line, so the outline has fewer lumps
    const calm = sat(1 - O.texture);
    if (calm > 0) {
      const ks = (1 - Math.exp(-26 * dt)) * calm;
      for (i = 0; i < MAXN - 1; i++) {
        const bx = i ? nx[i - 1] : hx, by = i ? ny[i - 1] : hy;
        nx[i] += ((bx + nx[i + 1]) * 0.5 - nx[i]) * ks; ny[i] += ((by + ny[i + 1]) * 0.5 - ny[i]) * ks;
      }
    }
    // traces: the tip of the tail lets go. A drop starts as the tip blob itself (same place, same size, so nothing
    // appears from nowhere), keeps part of the tail's speed, falls behind, and shrinks away while the neck thins.
    if (O.traces > 0 && mass > 0.9 && sp > 520 && tailL > R * 1.6 && !hugTarget) {
      if (Math.random() < 3.2 * O.traces * sat((sp - 520) / 1500) * dt) shed(MAXN - 1, 0.45);
    }
    let dropsAlive = false;
    for (i = 0; i < MAXD; i++) {
      bufD[i * 4 + 2] = 0;
      if (dAge[i] >= dLife[i]) continue;
      dAge[i] += dt;
      const dk = Math.exp(-3.2 * dt), u = dAge[i] / dLife[i];
      dvx[i] *= dk; dvy[i] *= dk; dpx[i] += dvx[i] * dt; dpy[i] += dvy[i] * dt;
      const rr = dR[i] * (1 - u * u * u) * mass;
      if (u >= 1 || Math.abs(dpx[i] - hx) > BOX / 2 - rr || Math.abs(dpy[i] - hy) > BOX / 2 - rr) { dAge[i] = dLife[i]; continue; }
      bufD[i * 4] = dpx[i]; bufD[i * 4 + 1] = dpy[i]; bufD[i * 4 + 2] = rr;
      dropsAlive = true;
    }

    // ---- underline for the unfilled link under the pointer
    if (hugTarget) {
      const hox = hugTarget.fixed ? 0 : SX, hoy = hugTarget.fixed ? 0 : SY;
      const th = Math.max(3, R * 0.15);
      const hcx = (hugTarget.x0 + hugTarget.x1) / 2 - hox, hcy = hugTarget.y1 - hoy + 2 + th / 2;
      const hhw = (hugTarget.x1 - hugTarget.x0) / 2 + 2, hhh = th / 2;
      if (hugT < 0.05 || hugRec !== hugTarget && hugT < 0.2) { hug[0] = hcx; hug[1] = hcy; hug[2] = hhw; hug[3] = hhh; hugR = hhh; }
      else { const kk = 1 - Math.exp(-22 * dt); hug[0] += (hcx - hug[0]) * kk; hug[1] += (hcy - hug[1]) * kk; hug[2] += (hhw - hug[2]) * kk; hug[3] += (hhh - hug[3]) * kk; hugR += (hhh - hugR) * kk; }
      hugRec = hugTarget;
    }

    // ---- ink bounding box (client px)
    let bx0 = Math.min(hx - hrx, llx - rh), by0 = Math.min(hy - hrx, lly - rh), bx1 = Math.max(hx + hrx, llx + rh), by1 = Math.max(hy + hrx, lly + rh);
    for (i = 0; i < MAXN; i++) {
      bx0 = Math.min(bx0, nx[i] - nr[i]); by0 = Math.min(by0, ny[i] - nr[i]);
      bx1 = Math.max(bx1, nx[i] + nr[i]); by1 = Math.max(by1, ny[i] + nr[i]);
    }
    for (i = 0; i < MAXD; i++) { const rr = bufD[i * 4 + 2]; if (rr > 0) { bx0 = Math.min(bx0, bufD[i * 4] - rr); by0 = Math.min(by0, bufD[i * 4 + 1] - rr); bx1 = Math.max(bx1, bufD[i * 4] + rr); by1 = Math.max(by1, bufD[i * 4 + 1] + rr); } }
    if (hugT > 0.001) { bx0 = Math.min(bx0, hug[0] - hug[2]); by0 = Math.min(by0, hug[1] - hug[3]); bx1 = Math.max(bx1, hug[0] + hug[2]); by1 = Math.max(by1, hug[1] + hug[3]); }
    const K = 26 * O.goo, kBase = K * 1.3, kMax = kBase * 3, breakGap = kMax * 0.42;
    const pad = kMax + 14;   // the fillet runs this far along a straight edge; a smaller box cut it off with a straight line
    bx0 -= pad; by0 -= pad; bx1 += pad; by1 += pad;

    // ---- page shapes that matter this frame; controls get the sticky strand
    let sCount = 0, mCount = 0, mRegular = 0, gCount = 0;
    function putSolid(rec, mode, k, bul) {
      if (sCount >= MAXS) return;
      const ox = rec.fixed ? 0 : SX, oy = rec.fixed ? 0 : SY, o = sCount * 4;
      const hw = rec.chain ? rec.ow / 2 : (rec.x1 - rec.x0) / 2, hh = rec.chain ? rec.oh / 2 : (rec.y1 - rec.y0) / 2;
      bufSA[o] = (rec.x0 + rec.x1) / 2 - ox; bufSA[o + 1] = (rec.y0 + rec.y1) / 2 - oy; bufSA[o + 2] = hw; bufSA[o + 3] = hh;
      bufSB[o] = Math.min(rec.radius || 0, Math.min(hw, hh)); bufSB[o + 1] = rec.ring || 0; bufSB[o + 2] = 0; bufSB[o + 3] = bul * mass;
      const c = rec.col || [0, 0, 0];
      bufSC[o] = c[0]; bufSC[o + 1] = c[1]; bufSC[o + 2] = c[2]; bufSC[o + 3] = k;
      bufSD[o] = mode; bufSD[o + 1] = mode === 5 ? rec.side : mode === 4 ? rec.ring : 0; bufSD[o + 2] = rec.rot || 0; bufSD[o + 3] = mode !== 3 && cdist(c, tintA > 0.5 ? tintC : lastInk) < 0.15 ? 1 : 0;
      const pc = rec.pcol || c;
      bufSE[o] = pc[0]; bufSE[o + 1] = pc[1]; bufSE[o + 2] = pc[2]; bufSE[o + 3] = 1;
      sCount++;
    }
    let settledSkin = true, tintT = 0, tintTo = null, touchDef = false;
    if (mass > 0.001) {
      for (i = 0; i < V.off.length && sCount < MAXS; i++) {
        const zr = V.off[i], zx = zr.fixed ? 0 : SX, zy = zr.fixed ? 0 : SY;
        if (zr.x1 - zx < bx0 || zr.x0 - zx > bx1 || zr.y1 - zy < by0 || zr.y0 - zy > by1) continue;
        putSolid({ x0: zr.x0, y0: zr.y0, x1: zr.x1, y1: zr.y1, fixed: zr.fixed, radius: 0, ring: 0, col: [0, 0, 0] }, 3, 1, 0);
      }
      if (!ptScope) {
        for (i = 0; i < map.scopes.length && sCount < MAXS; i++) {
          const sr = map.scopes[i];
          if (!sr.opaque || sr.x1 < bx0 || sr.x0 > bx1 || sr.y1 < by0 || sr.y0 > by1) continue;
          putSolid(sr, 3, 1, 0);
        }
      }
      const cand = [];
      for (i = 0; i < V.solids.length; i++) {
        const r2 = V.solids[i], o2x = r2.fixed ? 0 : SX, o2y = r2.fixed ? 0 : SY;
        if (r2.x1 - o2x < bx0 || r2.x0 - o2x > bx1 || r2.y1 - o2y < by0 || r2.y0 - o2y > by1) continue;
        // an edge matters where its border is, not where its box is
        let dd = boxDist(r2, hx, hy);
        if (r2.mode === 5 || r2.mode === 2) {
          const ox = r2.fixed ? 0 : SX, oy = r2.fixed ? 0 : SY;
          const inx = Math.min(hx - (r2.x0 - ox), r2.x1 - ox - hx), iny = Math.min(hy - (r2.y0 - oy), r2.y1 - oy - hy);
          if (inx > 0 && iny > 0) dd = Math.min(inx, iny);
          if (dd > rh + pad) continue;
        }
        cand.push([dd - (r2 === absorbT ? 1e5 : 0), r2]);
      }
      cand.sort(function (a, b) { return a[0] - b[0]; });
      for (i = 0; i < cand.length && sCount < MAXS; i++) {
        const rec = cand[i][1];
        if (rec.mode === 1 || rec.mode === 4) {
          const gap = boxDist(rec, hx, hy) - R * mass;
          let e = skin.get(rec.el);
          if (!e) { e = { s: 0, v: 0, stick: 0, on: false, f: 0 }; skin.set(rec.el, e); }
          e.f = frameNo;
          if (!e.on && gap < kBase * 0.5 * (0.6 + 0.5 * O.magnet) && mass > 0.5) { e.on = true; e.v += Math.min(70, 14 + sp * 0.05); }
          else if (e.on && gap > breakGap) { e.on = false; e.v -= 26; pulseV += 1.4; if (O.traces > 0) shed(MAXN - 2, 0.2); }   // the strand snaps: both sides recoil
          e.stick = ease(e.stick, e.on ? 1 : 0, e.on ? 12 : 22, dt);
          const pull = sat(gap / breakGap);
          putSolid(rec, rec.mode, kBase * (1 + 2 * e.stick * pull), 5 * e.stick * (1 - 0.4 * pull) + Math.max(e.s, -4) * e.stick);
          const amt = rec === absorbT ? 1 : 0;   // the ink takes a control's colour only while the pointer is in it
          if (amt > tintT) { tintT = amt; tintTo = rec.col; }
          if (e.on && cdist(rec.col, lastInk) < 0.2) touchDef = true;
        } else {
          putSolid(rec, rec.mode, rec.mode === 5 ? Math.min(kBase * 1.25, 52) : Math.min(kBase, 44), rec.mode === 2 ? 4 : 0);
        }
      }
    }
    // control skins: a spring per control, pushed out while the pointer is inside, kicked on click and on a snap
    skin.forEach(function (e, el) {
      const target = absorbT && absorbT.el === el ? 5 * mass : 0;
      for (let j = 0; j < steps; j++) { e.v += (22 * 22 * (target - e.s) - 2 * 0.3 * 22 * e.v) * h; e.s += e.v * h; }
      if (e.f !== frameNo) { e.on = false; e.stick = ease(e.stick, 0, 22, dt); }
      const quiet = Math.abs(e.v) < 0.5 && Math.abs(target - e.s) < 0.05;
      if (!quiet || (e.stick > 0.01 && e.stick < 0.99)) settledSkin = false;
      if (quiet && target === 0 && !e.on && e.stick < 0.01) skin.delete(el);
    });

    // ---- where the canvases sit this frame, and the scissor box inside them
    const org = Math.round((hx - BOX / 2) * DPR) / DPR, orgY = Math.round((hy - BOX / 2) * DPR) / DPR;
    bx0 = Math.max(bx0, org); by0 = Math.max(by0, orgY); bx1 = Math.min(bx1, org + BOX); by1 = Math.min(by1, orgY + BOX);

    let headPol = map.basePol, headInk = map.base || lastInk, headBg = map.baseBg || [1, 1, 1];
    const arts = [];
    if (mass > 0.001) {
      // text / art boxes, regular first then same-colour text
      const mc = [];
      for (i = 0; i < V.masks.length; i++) {
        const mr = V.masks[i], mx = mr.fixed ? 0 : SX, my = mr.fixed ? 0 : SY;
        if (mr.x1 - mx < bx0 - 8 || mr.x0 - mx > bx1 + 8 || mr.y1 - my < by0 - 8 || mr.y0 - my > by1 + 8) continue;
        if (mr.art) { const pf = fields.get(mr.el); if (pf && pf.photo) continue; }
        mc.push([boxDist(mr, hx, hy) + (mr.same ? 1e5 : 0), mr]);
      }
      mc.sort(function (a, b) { return a[0] - b[0]; });
      // artwork near the ink: make its field once, then join the four nearest that are ready
      if (O.art > 0) {
        for (i = 0; i < mc.length; i++) {
          const ar = mc[i][1];
          if (!ar.art && !ar.text) continue;
          const f = ensureField(ar);
          if (!f || f.state !== 'ready' || arts.length >= MAXA) continue;
          arts.push([ar, f]);
          // the pointer is on the drawing itself: the ink takes its colour (its hover colour, if it has one)
          if (!f.isText && tintT < 1 && fieldAt(ar, f, px, py) < 6) { tintT = 1; tintTo = f.col; }
          if (heldTint && cdist(f.col, lastInk) < 0.3 && fieldAt(ar, f, hx, hy) < R * 0.6) touchDef = true;
        }
      }
      liveArts = arts;
      const act = new Set(arts.map(function (x) { return x[0]; }));
      // keep the nearest of each kind when there are too many
      let regular = mc.filter(function (m) { return !m[1].same && !act.has(m[1]); }), same = mc.filter(function (m) { return m[1].same && !act.has(m[1]); });
      while (regular.length + same.length > MAXM) { if (regular.length >= same.length) regular.pop(); else same.pop(); }
      regular.concat(same).forEach(function (pair) {
        const m = pair[1], ox3 = m.fixed ? 0 : SX, oy3 = m.fixed ? 0 : SY, o3 = mCount * 4;
        bufM[o3] = m.x0 - ox3; bufM[o3 + 1] = m.y0 - oy3; bufM[o3 + 2] = m.x1 - ox3; bufM[o3 + 3] = m.y1 - oy3;
        mCount++;
      });
      mRegular = regular.length;
      let gl0 = [];
      for (i = 0; i < V.grounds.length; i++) {
        const gr = V.grounds[i], gx = gr.fixed ? 0 : SX, gy = gr.fixed ? 0 : SY;
        if (within(gr, hx, hy, 0)) { headPol = gr.pol; headInk = gr.ink; headBg = gr.bg || headBg; }
        if (gr.x1 - gx < bx0 || gr.x0 - gx > bx1 || gr.y1 - gy < by0 || gr.y0 - gy > by1) continue;
        gl0.push(gr);
      }
      if (gl0.length > MAXG) gl0 = gl0.slice(gl0.length - MAXG);
      for (i = 0; i < gl0.length; i++) {
        const g2 = gl0[i], gx2 = g2.fixed ? 0 : SX, gy2 = g2.fixed ? 0 : SY, o4 = gCount * 4;
        bufG[o4] = g2.x0 - gx2; bufG[o4 + 1] = g2.y0 - gy2; bufG[o4 + 2] = g2.x1 - gx2; bufG[o4 + 3] = g2.y1 - gy2;
        bufGC[o4] = g2.ink[0]; bufGC[o4 + 1] = g2.ink[1]; bufGC[o4 + 2] = g2.ink[2]; bufGC[o4 + 3] = g2.pol;
        gCount++;
      }
    }
    // A dark colour the ink took (from a dark button or drawing) stays with it after it leaves, as long as it
    // reads on the ground it is on, until the ink touches something of its own colour. A light colour is dropped
    // at once: light ink on a light ground would vanish.
    if (tintTo) {
      heldTint = O.hold > 0 && lum(tintTo) < lum(headInk) - 0.02 && contrast(tintTo, headBg) >= 3 ? [tintTo[0], tintTo[1], tintTo[2]] : null;
    } else if (heldTint) {
      if (touchDef || mass < 0.5 || O.hold <= 0 || contrast(heldTint, headBg) < 3) heldTint = null;
      else { tintT = 1; tintTo = heldTint; }
    }
    if (tintTo) { const kc = tintA < 0.03 ? 1 : 1 - Math.exp(-14 * dt); tintC[0] += (tintTo[0] - tintC[0]) * kc; tintC[1] += (tintTo[1] - tintC[1]) * kc; tintC[2] += (tintTo[2] - tintC[2]) * kc; }
    tintA = ease(tintA, tintT, 16, dt);
    lastInk = headInk; lastS = sCount; lastM = [mCount, mRegular, arts.length];
    if (headPol !== blendPol && layers[1]) { blendPol = headPol; layers[1].canvas.style.mixBlendMode = headPol ? 'lighten' : 'darken'; }

    // ---- click dot
    {
      const want = !off && clickable && O.dot > 0 ? 1 : 0;
      const wD = 30, zD = 0.5;
      for (let st = 0; st < steps; st++) { dotV += (wD * wD * (want - dotA) - 2 * zD * wD * dotV) * h; dotA += dotV * h; }
      if (want) {
        // on a filled control: what reads on its fill; anywhere else: what reads on the ink
        const under = absorbT && absorbT.mode === 1 ? absorbT.col : (tintA > 0.5 ? tintC : headInk);
        const c = inkFor(under), kd = dotA < 0.08 ? 1 : 1 - Math.exp(-18 * dt);
        dotC[0] += (c[0] - dotC[0]) * kd; dotC[1] += (c[1] - dotC[1]) * kd; dotC[2] += (c[2] - dotC[2]) * kd;
      }
      if (Math.abs(dotA - want) > 0.004 || Math.abs(dotV) > 0.02) dotBusy = true; else { dotBusy = false; dotA = want; dotV = 0; }
    }

    // ---- draw
    const visible = mass > 0.001 && bx1 > bx0 && by1 > by0;
    if (visible) for (i = 0; i < MAXN; i++) { const o5 = i * 4; bufN[o5] = nx[i]; bufN[o5 + 1] = ny[i]; bufN[o5 + 2] = nr[i]; bufN[o5 + 3] = 0; }
    const base = map.base || P.blue || [0, 0, 0, 1];
    const tf = 'translate3d(' + org + 'px,' + orgY + 'px,0)';
    for (let li = 0; li < layers.length; li++) {
      const L = layers[li], gl = L.gl;
      if (!gl) continue;
      const need = visible && (li === 0 || mRegular > 0 || arts.length > 0);
      if (!need && !L.dirty) continue;
      gl.disable(gl.SCISSOR_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT);
      L.dirty = need;
      if (!need) continue;
      L.canvas.style.transform = tf;
      const ch = L.canvas.height;
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(Math.floor((bx0 - org) * DPR), Math.floor(ch - (by1 - orgY) * DPR), Math.ceil((bx1 - bx0) * DPR) + 1, Math.ceil((by1 - by0) * DPR) + 1);
      const U = L.U;
      gl.uniform4f(U.uView, ch, DPR, org, orgY);
      gl.uniform4f(U.uHead, hx, hy, hrx, hry);
      gl.uniform4f(U.uLead, llx, lly, rh * 0.74, Math.max(3, R * 0.4));
      gl.uniform4f(U.uDotP, px, py, Math.max(0, dotA) * Math.max(4, R * 0.24) * O.dot * (1 + pulse * 2.2), 0);
      gl.uniform4f(U.uDotC, dotC[0], dotC[1], dotC[2], sat(dotA * 1.4));
      gl.uniform4f(U.uHeadX, dirC, dirS, Math.max(0, Math.min(1.1, hugT)), hugR);
      gl.uniform4f(U.uHug, hug[0], hug[1], hug[2], hug[3]);
      gl.uniform4fv(U.uNode, bufN); gl.uniform4fv(U.uDrop, bufD);
      gl.uniform4fv(U.uSA, bufSA); gl.uniform4fv(U.uSB, bufSB); gl.uniform4fv(U.uSC, bufSC); gl.uniform4fv(U.uSD, bufSD); gl.uniform4fv(U.uSE, bufSE);
      gl.uniform4fv(U.uM, bufM); gl.uniform4fv(U.uG, bufG); gl.uniform4fv(U.uGC, bufGC);
      gl.uniform4f(U.uBase, base[0], base[1], base[2], map.basePol);
      gl.uniform4f(U.uPar, px, py, Math.max(1.5, R * (0.5 + 0.6 * calm) * sat(tailL / (1.2 * R)) * thin), clock);
      gl.uniform4f(U.uCount, MAXN, sCount, mCount, gCount);
      gl.uniform4f(U.uPass, li, blendPol, mRegular, 0.045 * rh * O.wobble * (1 - sat(hugT)) * (1 - 0.85 * calm * sat(sp / 500)));
      for (let ai = 0; ai < arts.length; ai++) {
        const ar = arts[ai][0], fo = ar.fixed ? 0 : SX, foy = ar.fixed ? 0 : SY, oa = ai * 4, fc = arts[ai][1].col;
        bufAR[oa] = ar.x0 - fo - FPAD; bufAR[oa + 1] = ar.y0 - foy - FPAD; bufAR[oa + 2] = ar.x1 - fo + FPAD; bufAR[oa + 3] = ar.y1 - foy + FPAD;
        const inkNow = tintA > 0.5 ? tintC : (ar.gInk || base);
        bufAC[oa] = cdist(fc, inkNow) > 0.3 ? 1 : 0;                 // another colour than the ink right now: it stays on top
        bufAC[oa + 1] = arts[ai][1].isText ? 2.5 : 1.2;               // small bias: no specks on letters that are merely near
        // the ink in its own colour rounds into everything; ink that has taken a colour joins that colour only
        bufAC[oa + 2] = tintA > 0.5 && cdist(fc, tintC) > 0.3 ? 0 : 1; bufAC[oa + 3] = Math.max(4, Math.min(FRANGE - 2, kBase * 1.15 * O.art));
        gl.activeTexture(gl.TEXTURE0 + ai);
        gl.bindTexture(gl.TEXTURE_2D, fieldTex(L, li, arts[ai][1]));
      }
      gl.uniform4fv(U.uAR, bufAR); gl.uniform4fv(U.uAC, bufAC);
      gl.uniform4f(U.uInkT, tintC[0], tintC[1], tintC[2], sat(tintA));
      gl.uniform4f(U.uTint, O.textTint, arts.length, FRANGE, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // ---- sleep when nothing moves
    let settled = Math.abs(mass - massT) < 0.002 && Math.abs(tx - hx) < 0.3 && Math.abs(ty - hy) < 0.3 && Math.abs(px - llx) < 0.3 && Math.abs(py - lly) < 0.3 && sp < 4 &&
      Math.abs(pulse) < 0.002 && Math.abs(pulseV) < 0.02 && Math.abs(hugT - (hugTarget ? 1 : 0)) < 0.003 && Math.abs(hugV) < 0.02 &&
      Math.abs(strength - strengthT) < 0.003 && Math.abs(elong) < 0.003 && Math.abs(elongV) < 0.02 && tailL < 0.5 && life < 0.01 && settledSkin && Math.abs(tintA - tintT) < 0.01 && !dropsAlive && !dotBusy;
    stats.why = settled ? '' : [Math.abs(mass - massT) < 0.002, Math.abs(tx - hx) < 0.3 && Math.abs(ty - hy) < 0.3, sp < 4, Math.abs(pulse) < 0.002 && Math.abs(pulseV) < 0.02, Math.abs(hugT - (hugTarget ? 1 : 0)) < 0.003 && Math.abs(hugV) < 0.02, Math.abs(strength - strengthT) < 0.003, Math.abs(elong) < 0.003 && Math.abs(elongV) < 0.02, tailL < 0.5, life < 0.01, settledSkin, Math.abs(tintA - tintT) < 0.01, !dropsAlive].map(function (v) { return v ? 1 : 0; }).join('');
    if (mass === 0 && massT === 0) settled = true;
    stats.frames++;
    stats.cpu.push(performance.now() - t0);
    if (stats.cpu.length > 600) stats.cpu.shift();
    if (!settled) raf = requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ events
  // a drop leaves the body at tail blob `tip`, keeping `keep` of its speed
  function shed(tip, keep) {
    for (let i = 0; i < MAXD; i++) {
      if (dAge[i] < dLife[i]) continue;
      dpx[i] = nx[tip]; dpy[i] = ny[tip];
      dvx[i] = nvx[tip] * keep; dvy[i] = nvy[tip] * keep;
      dR[i] = Math.max(3, nr[tip] * (0.85 + 0.5 * Math.random())); dAge[i] = 0; dLife[i] = 0.7 + 0.7 * Math.random();
      return;
    }
  }
  function snapTo(x, y) {
    hx = x; hy = y; hvx = hvy = 0; tailL = 0; llx = x; lly = y; lvx = lvy = 0;
    for (let i = 0; i < MAXN; i++) { nx[i] = x; ny[i] = y; nvx[i] = nvy[i] = 0; }
  }
  function onMove(e) {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    px = e.clientX; py = e.clientY;
    let sc = null;
    for (let n = e.target; n && n.nodeType === 1; n = n.parentElement) if (scopeSet.has(n)) { sc = n; break; }
    if (sc !== ptScope) { ptScope = sc; viewGen++; }
    const tg = e.target;
    clickable = !!(tg && tg.closest && tg.closest('a[href],button,summary,select,label,[role="button"],[role="link"],[role="tab"],[data-estimate-open],input:not([type="text"]):not([type="email"]):not([type="tel"]):not([type="search"]):not([type="number"]):not([type="password"]):not([type="url"])')) && !(tg.closest('[disabled],[aria-disabled="true"]'));
    if (!pin && mass < 0.01) snapTo(px, py);
    lastMove = performance.now();
    if (!pin) { pin = true; if (dirty) scheduleBuild(0); }
    if (!measuring) scheduleMeasure();
    seen = true;
    kb = false;
    wake();
  }
  function onLeave(e) { if (!e.relatedTarget) { pin = false; clearTimeout(measureTimer); measuring = false; wake(); } }
  function onDown(e) {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    pulseV -= 6;
    if (absorbed) { const st = skin.get(absorbed.el) || { s: 0, v: 0, stick: 1, on: true, f: frameNo }; st.v += 70; skin.set(absorbed.el, st); }
    lastMove = performance.now();
    wake();
  }
  function onKey(e) { if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ' || e.key === 'Escape' || e.key.indexOf('Arrow') === 0) { kb = true; wake(); } }
  function onFocus(e) {
    const t = e.target;
    try { if (t && t.matches && t.matches(':focus-visible')) { kb = true; wake(); } } catch (err) { /* old engines */ }
  }
  // Hover changes a button's fill; re-read that one colour (a style read, outside the loop).
  let temps = [];
  // The fill is read only once it has stopped changing: a colour caught halfway through a hover transition
  // (cream on its way to blue) is what made the ink go pale for a moment.
  function hoverFill(rec) {
    if (rec.fills && rec.fillCol && !rec.temp && rec.el.matches(':hover')) {
      rec.temp = { el: rec.el, fixed: rec.fixed, kind: 'solid', mode: 1, ring: 0, radius: rec.fillRad || 0, col: rec.fillCol, temp: true, inter: true, owner: rec, scope: rec.scope };
      map.solids.push(rec.temp); map.all.push(rec.temp); temps.push(rec.temp);
      place(rec.temp, rec.el.getBoundingClientRect());
      rec.lastBg = null;
      wake();
    }
    rec.lastBg = null;
    const check = function () {
      if (!on || !rec.el.isConnected) return;
      const cs = getComputedStyle(rec.el), bg = parseColor(cs.backgroundColor);
      const moving = !rec.lastBg || !bg || cdist(bg, rec.lastBg) + Math.abs(bg[3] - rec.lastBg[3]) > 0.004;   // two equal reads in a row = the transition is over
      rec.lastBg = bg;
      if (moving) return;
      const filled = bg && bg[3] > 0.85 && cdist(bg, rec.ground || [1, 1, 1]) > 0.08;
      if (filled) {
        const r = rec.el.getBoundingClientRect();
        if (!rec.temp) {
          rec.temp = { el: rec.el, fixed: rec.fixed, kind: 'solid', mode: 1, ring: 0, radius: 0, col: bg, temp: true, inter: true, owner: rec, scope: rec.scope };
          map.solids.push(rec.temp); map.all.push(rec.temp); temps.push(rec.temp);
        }
        rec.fills = true; rec.fillCol = bg; rec.fillRad = radiusOf(cs, r);
        rec.temp.col = bg; rec.temp.radius = rec.fillRad;
        place(rec.temp, r);
      } else if (rec.temp && !rec.el.matches(':hover')) {
        const t = rec.temp;
        rec.temp = null;
        map.solids = map.solids.filter(function (x) { return x !== t; });
        map.all = map.all.filter(function (x) { return x !== t; });
        temps = temps.filter(function (x) { return x !== t; });
      }
      wake();
    };
    [16, 50, 90, 140, 200, 280, 380, 520].forEach(function (ms) { setTimeout(check, ms); });
  }
  function onOver(e) {
    scheduleArtColors();
    for (let i = 0; i < temps.length; i++) if (!temps[i].el.contains(e.target)) hoverFill(temps[i].owner);
    let el = e.target;
    while (el && el !== doc.body) {
      const rec = byEl.get(el);
      if (rec && rec.kind === 'hug') { hoverFill(rec); return; }
      if (rec && (rec.kind === 'solid' || rec.kind === 'panel')) {
        const reread = function () { const cs = getComputedStyle(rec.el); const c = rec.mode === 1 ? parseColor(cs.backgroundColor) : parseColor(cs.borderTopColor); if (c && c[3] > 0.5) rec.col = c; if (rec.el.isConnected) { place(rec, rectOf(rec)); tilt(rec, cs); } wake(); };
        setTimeout(reread, 30); setTimeout(reread, 110); setTimeout(reread, 220); setTimeout(reread, 450);
        return;
      }
      el = el.parentElement;
    }
  }
  function onScroll() {
    SX = window.scrollX; SY = window.scrollY;
    wake();
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () { ric(function () { if (on && pin) { if (map.hiddenSkipped) scheduleBuild(0); else measure(); } }, { timeout: 400 }); }, 160);
  }
  function onResize() { resize(); scheduleBuild(150); wake(); }
  function onVis() { if (doc.hidden) { pin = false; } }

  // ------------------------------------------------------------------ lifecycle
  function start() {
    if (on || !doc.body) return;
    layers = [makeLayer(false), makeLayer(true)];
    if (!initGL(layers[0])) { layers.forEach(function (L) { L.canvas.remove(); }); layers = []; return; }
    if (!initGL(layers[1])) { layers[1].canvas.remove(); layers.length = 1; }   // no blend layer: the ink simply covers
    on = true;
    blendPol = -1;
    root.setAttribute('data-ink-cursor', 'on');
    if (HIDE_NATIVE) {
      styleEl = doc.createElement('style');
      styleEl.textContent = 'html[data-ink-cursor="on"]:not([data-ink-away]),html[data-ink-cursor="on"]:not([data-ink-away]) *{cursor:none}';
      doc.head.appendChild(styleEl);
    }
    resize();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    doc.addEventListener('pointerout', onLeave, { passive: true });
    doc.addEventListener('pointerover', onOver, { passive: true });
    window.addEventListener('keydown', onKey, { passive: true });
    doc.addEventListener('focusin', onFocus, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    doc.addEventListener('visibilitychange', onVis);
    doc.addEventListener('toggle', onToggle, true);
    mo = new MutationObserver(function (list) {
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        if (r.target.nodeType === 1 && r.target.hasAttribute('data-ink-cursor')) continue;
        if (r.type === 'childList') {
          let ours = r.addedNodes.length + r.removedNodes.length > 0;
          for (let j = 0; ours && j < r.addedNodes.length; j++) ours = r.addedNodes[j].nodeType === 1 && r.addedNodes[j].hasAttribute('data-ink-cursor');
          for (let j = 0; ours && j < r.removedNodes.length; j++) ours = r.removedNodes[j].nodeType === 1 && r.removedNodes[j].hasAttribute('data-ink-cursor');
          if (ours) continue;
        }
        if (r.attributeName === 'open') { modal = !!doc.querySelector('dialog[open]'); if (modal) raise(); }
        scheduleBuild(300);
        clearTimeout(lateBuild); lateBuild = setTimeout(function () { scheduleBuild(0); }, 1600);
        wake();
        return;
      }
    });
    mo.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden', 'data-ink', 'class', 'data-flwr-state', 'aria-expanded', 'aria-hidden'] });
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { scheduleBuild(200); }); ro.observe(doc.body); }
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { scheduleBuild(0); });
    window.addEventListener('load', function () { scheduleBuild(0); }, { once: true });
    ric(build, { timeout: 1000 });
  }
  function stop() {
    if (!on) return;
    on = false;
    cancelAnimationFrame(raf); raf = 0;
    clearTimeout(measureTimer); clearTimeout(scrollTimer);
    if (idleId) { clearTimeout(idleId); cic(idleId); idleId = 0; }
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onDown);
    doc.removeEventListener('pointerout', onLeave);
    doc.removeEventListener('pointerover', onOver);
    window.removeEventListener('keydown', onKey);
    doc.removeEventListener('focusin', onFocus);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    doc.removeEventListener('visibilitychange', onVis);
    doc.removeEventListener('toggle', onToggle, true);
    if (mo) mo.disconnect();
    if (ro) ro.disconnect();
    layers.forEach(function (L) {
      const lose = L.gl && L.gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      L.canvas.remove();
    });
    layers = [];
    if (styleEl) { styleEl.remove(); styleEl = null; }
    pin = false; mass = 0; skin.clear();
    root.removeAttribute('data-ink-cursor'); root.removeAttribute('data-ink-away'); away = false;
  }
  function sync() { const a = allowed(); if (a && !on) start(); else if (!a && on) stop(); }
  function listen(mq) { if (mq.addEventListener) mq.addEventListener('change', sync); else if (mq.addListener) mq.addListener(sync); }
  listen(mqFine); listen(mqRM);
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-ink'] });

  window.CosmicInk = {
    options: O,
    refresh: function () { if (on) { resize(); build(); } },
    resize: function () { if (on) { resize(); wake(); } },
    native: function (hide) {
      if (styleEl) { styleEl.remove(); styleEl = null; }
      if (hide) { styleEl = doc.createElement('style'); styleEl.textContent = 'html[data-ink-cursor="on"]:not([data-ink-away]),html[data-ink-cursor="on"]:not([data-ink-away]) *{cursor:none}'; doc.head.appendChild(styleEl); }
    },
    start: function () { root.removeAttribute('data-ink'); sync(); },
    stop: function () { root.setAttribute('data-ink', 'off'); },
    stats: function () {
      const c = stats.cpu.slice().sort(function (a, b) { return a - b; });
      const mean = c.reduce(function (s, v) { return s + v; }, 0) / (c.length || 1);
      return {
        on: on, sleeping: !raf, mass: +mass.toFixed(3), tail: +tailL.toFixed(1), frames: stats.frames, cpuMeanMs: +mean.toFixed(3), cpuP95Ms: +(c[Math.floor(c.length * 0.95)] || 0).toFixed(3),
        buildMs: +stats.build.toFixed(2), measureMs: +stats.measure.toFixed(2), gpu: stats.gpu, why: stats.why, skin: Array.from(skin.values()).map(function (e) { return [+e.s.toFixed(3), +e.v.toFixed(3), +e.stick.toFixed(3), e.on, frameNo - e.f]; }), tint: [+tintA.toFixed(3)], box: BOX, masks: lastM, head: [Math.round(hx), Math.round(hy)], layers: layers.length,
        active: Array.from({ length: lastS }, function (_, i) { return { mode: bufSD[i * 4], aux: bufSD[i * 4 + 1], box: [bufSA[i * 4], bufSA[i * 4 + 1], bufSA[i * 4 + 2], bufSA[i * 4 + 3]].map(Math.round), ring: bufSB[i * 4 + 1], col: [bufSC[i * 4], bufSC[i * 4 + 1], bufSC[i * 4 + 2]].map(function (v) { return +v.toFixed(2); }), pcol: [bufSE[i * 4], bufSE[i * 4 + 1], bufSE[i * 4 + 2]].map(function (v) { return +v.toFixed(2); }) }; }),
        counts: { grounds: map.grounds.length, solids: map.solids.length, hugs: map.hugs.length, masks: map.masks.length, off: map.off.length }
      };
    }
  };

  (function () {
    let want = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || /[?&]ink-panel\b/.test(location.search);
    try { const v = localStorage.getItem('cosmic-ink-panel'); if (v === 'on') want = true; if (v === 'off') want = false; } catch (e) { /* private mode */ }
    if (!want || !SCRIPT || !SCRIPT.src || !/ink-cursor\.js/.test(SCRIPT.src)) return;
    const tag = doc.createElement('script');
    tag.src = SCRIPT.src.replace(/ink-cursor\.js(\?.*)?$/, 'ink-cursor-panel.js');
    tag.setAttribute('data-ink-cursor', 'panel');
    (doc.head || root).appendChild(tag);
  })();

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', sync, { once: true });
  else sync();
})();
