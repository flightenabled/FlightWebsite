/* Flight Enabled hero globe (Oct 2026 redesign).
   Photoreal Earth: NASA Blue Marble (day) + Black Marble 2016 (night lights), both public domain, self-hosted WebP.
   Thin great-circle arcs for regional hops out of Salt Lake City, each with one small point of light that fades in and out.
   Light on phones: DPR cap, 30 fps cap, pauses off-screen and in hidden tabs. prefers-reduced-motion: one static frame. */
(function () {
  "use strict";

  var canvas = document.getElementById("globe");
  var stage = document.getElementById("globe-stage");
  var fallback = document.getElementById("globe-fallback");
  if (!canvas) return;

  function showFallback() {
    canvas.hidden = true;
    if (fallback) fallback.hidden = false;
    if (stage) stage.classList.add("is-ready");
  }
  if (typeof THREE === "undefined") { showFallback(); return; }

  var reduced = false;
  try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  function isMobile() {
    return window.matchMedia("(max-width: 720px)").matches || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
  }
  var mobile = isMobile();
  var lowMem = (navigator.deviceMemory && navigator.deviceMemory <= 2);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !mobile, alpha: true, powerPreference: "low-power" });
  } catch (e) { showFallback(); return; }
  if (!renderer.getContext()) { showFallback(); return; }
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 4.2);

  var root = new THREE.Group();          // positions the globe in the frame
  var globe = new THREE.Group();         // rotates (yaw/pitch); everything on the Earth lives here
  root.add(globe);
  scene.add(root);

  function ll(lat, lon, r) {
    var phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
  }

  // Sun from the upper left, a little behind the viewer's plane: the right side of the globe falls into night.
  var SUN = new THREE.Vector3(-0.82, 0.36, 0.45).normalize();

  var dayRes = lowMem ? 1024 : 2048;
  var nightRes = (mobile || lowMem) ? 1024 : 2048;
  var loader = new THREE.TextureLoader();
  var pending = 2;
  var uniforms = {
    dayMap: { value: null },
    nightMap: { value: null },
    sunDir: { value: SUN }
  };
  function loaded() {
    pending -= 1;
    if (pending === 0) { ready(); }
  }
  function fail() { showFallback(); }
  uniforms.dayMap.value = loader.load("assets/globe/earth-day-" + dayRes + ".webp", loaded, undefined, fail);
  uniforms.nightMap.value = loader.load("assets/globe/earth-night-" + nightRes + ".webp", loaded, undefined, fail);
  [uniforms.dayMap.value, uniforms.nightMap.value].forEach(function (t) {
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  });

  var segs = mobile ? 72 : 112;
  var earthMat = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: [
      "varying vec2 vUv; varying vec3 vN; varying vec3 vV;",
      "void main(){",
      "  vUv = uv;",
      "  vN = normalize(mat3(modelMatrix) * normal);",
      "  vec4 wp = modelMatrix * vec4(position, 1.0);",
      "  vV = normalize(cameraPosition - wp.xyz);",
      "  gl_Position = projectionMatrix * viewMatrix * wp;",
      "}"
    ].join("\n"),
    fragmentShader: [
      "uniform sampler2D dayMap; uniform sampler2D nightMap; uniform vec3 sunDir;",
      "varying vec2 vUv; varying vec3 vN; varying vec3 vV;",
      "void main(){",
      "  vec3 n = normalize(vN);",
      "  float d = dot(n, sunDir);",
      "  float dayK = smoothstep(-0.12, 0.28, d);",
      "  vec3 day = texture2D(dayMap, vUv).rgb;",
      "  float lights = texture2D(nightMap, vUv).r;",
      "  float ocean = smoothstep(0.0, 0.22, day.b - day.r);",
      "  vec3 h = normalize(sunDir + normalize(vV));",
      "  float spec = pow(max(dot(n, h), 0.0), 30.0) * ocean * 0.22 * dayK;",
      "  vec3 lit = day * (0.18 + 0.95 * max(d, 0.0)) + vec3(0.75, 0.82, 0.9) * spec;",
      "  vec3 night = day * 0.025 + vec3(1.0, 0.80, 0.55) * pow(lights, 1.6) * 0.95;",
      "  vec3 col = mix(night, lit, dayK);",
      "  float rim = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 3.0);",
      "  col += vec3(0.30, 0.55, 1.0) * rim * (0.12 + 0.55 * smoothstep(-0.2, 0.6, d));",
      "  gl_FragColor = vec4(col, 1.0);",
      "}"
    ].join("\n")
  });
  var earth = new THREE.Mesh(new THREE.SphereGeometry(1, segs, segs / 2), earthMat);
  globe.add(earth);

  // Thin atmosphere: soft blue halo just outside the limb, brighter on the day side.
  var atmo = new THREE.Mesh(new THREE.SphereGeometry(1.03, segs, segs / 2), new THREE.ShaderMaterial({
    uniforms: { sunDir: uniforms.sunDir },
    vertexShader: [
      "varying vec3 vN; varying vec3 vV;",
      "void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position,1.0);",
      "  vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }"
    ].join("\n"),
    fragmentShader: [
      "uniform vec3 sunDir; varying vec3 vN; varying vec3 vV;",
      "void main(){ float f = pow(clamp(1.0 + dot(normalize(vN), normalize(vV)), 0.0, 1.0), 3.2);",
      "  float s = 0.25 + 0.75 * smoothstep(-0.3, 0.7, dot(normalize(vN), sunDir));",
      "  gl_FragColor = vec4(vec3(0.35, 0.62, 1.0) * f * s * 0.9, f * s * 0.8); }"
    ].join("\n"),
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  root.add(atmo); // not rotated: the halo is view-dependent only

  // Faint stars on a far shell.
  (function stars() {
    var n = mobile ? 420 : 900, pos = new Float32Array(n * 3), i, v = new THREE.Vector3();
    for (i = 0; i < n; i++) {
      v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(40);
      if (v.z > 30) v.z = -v.z;
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfd8e3, size: mobile ? 1.1 : 1.3, sizeAttenuation: false, transparent: true, opacity: 0.45, depthWrite: false })));
  })();

  // Regional hops from Salt Lake City.
  var SLC = [40.7608, -111.8910];
  var CITIES = {
    boise: [43.6150, -116.2023], denver: [39.7392, -104.9903], vegas: [36.1699, -115.1398],
    phoenix: [33.4484, -112.0740], reno: [39.5296, -119.8138], jackson: [43.4799, -110.7624],
    stgeorge: [37.0965, -113.5684], albuquerque: [35.0844, -106.6504]
  };
  var HOPS = [
    [SLC, CITIES.boise], [SLC, CITIES.denver], [SLC, CITIES.vegas], [SLC, CITIES.phoenix],
    [SLC, CITIES.reno], [SLC, CITIES.jackson], [SLC, CITIES.stgeorge], [CITIES.denver, CITIES.albuquerque]
  ];

  var glowTex = (function () {
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.18, "rgba(220,255,235,0.85)");
    g.addColorStop(0.45, "rgba(120,230,170,0.22)"); g.addColorStop(1, "rgba(120,230,170,0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  function arcPoints(a, b, n) {
    var va = ll(a[0], a[1], 1), vb = ll(b[0], b[1], 1), ang = va.angleTo(vb), pts = [], i;
    for (i = 0; i <= n; i++) {
      var t = i / n, s = Math.sin(ang);
      var p = va.clone().multiplyScalar(Math.sin((1 - t) * ang) / s).add(vb.clone().multiplyScalar(Math.sin(t * ang) / s));
      p.normalize().multiplyScalar(1.002 + Math.sin(Math.PI * t) * (0.006 + ang * 0.22));
      pts.push(p);
    }
    return pts;
  }

  var arcs = [];
  var lineMat = new THREE.LineBasicMaterial({ color: 0xa7f3d0, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false });
  HOPS.forEach(function (hop, i) {
    var pts = arcPoints(hop[0], hop[1], 48);
    globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.setScalar(0.028);
    globe.add(sp);
    arcs.push({ pts: pts, sprite: sp, period: 5200 + (i % 4) * 900, offset: i * 1370, dir: i % 2 ? -1 : 1 });
  });

  // City dots: brighter hub, quiet endpoints.
  (function cityDots() {
    var all = [SLC].concat(Object.keys(CITIES).map(function (k) { return CITIES[k]; }));
    all.forEach(function (c, i) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: i === 0 ? 0.95 : 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      sp.scale.setScalar(i === 0 ? 0.034 : 0.018);
      sp.position.copy(ll(c[0], c[1], 1.003));
      globe.add(sp);
    });
  })();

  function sample(pts, t) {
    var f = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f));
    return pts[i].clone().lerp(pts[i + 1], f - i);
  }

  // Orientation: face the Intermountain West, north up, hub a little above center.
  var face = ll(SLC[0] - 8, SLC[1] + 14, 1);
  var baseYaw = Math.atan2(-face.x, face.z);
  var zAfter = -face.x * Math.sin(baseYaw) + face.z * Math.cos(baseYaw);
  var basePitch = Math.atan2(face.y, zAfter);
  globe.rotation.order = "XYZ";

  function frame() {
    var w = stage ? stage.clientWidth : window.innerWidth, h = stage ? stage.clientHeight : window.innerHeight;
    if (!w || !h) { w = window.innerWidth; h = window.innerHeight; }
    mobile = isMobile();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (w / h >= 1) {          // landscape: globe large on the right, copy on the left
      camera.fov = 30; camera.position.z = 4.0;
      root.position.set(0.25 + 0.55 * Math.min(1.8, w / h) / 1.6, -0.12, 0);
    } else {                   // portrait: globe in the top half, copy below it
      camera.fov = 38; camera.position.z = 5.4;
      root.position.set(0.16, 0.42, 0);
    }
    camera.updateProjectionMatrix();
  }
  frame();
  var rt;
  if (stage && "ResizeObserver" in window) { new ResizeObserver(function () { clearTimeout(rt); rt = setTimeout(function () { frame(); if (reduced || !looping) draw(performance.now()); }, 80); }).observe(stage); }
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { frame(); if (reduced || !looping) draw(0); }, 120); }, { passive: true });

  var start = performance.now();
  function draw(now) {
    var t = now - start;
    globe.rotation.y = baseYaw + (reduced ? 0 : Math.sin(t / 90000 * Math.PI * 2) * 0.10);
    globe.rotation.x = basePitch;
    arcs.forEach(function (a) {
      if (reduced) { a.sprite.material.opacity = 0; return; }
      var u = ((t + a.offset) % (a.period + 2400)) / a.period; // travel, then a rest
      if (u > 1) { a.sprite.material.opacity = 0; return; }
      var e = u * u * (3 - 2 * u);
      a.sprite.position.copy(sample(a.pts, a.dir > 0 ? e : 1 - e));
      a.sprite.material.opacity = Math.sin(Math.PI * u) * 0.95;
    });
    renderer.render(scene, camera);
  }

  var visible = true, shown = document.visibilityState !== "hidden", looping = false, last = 0;
  function loop(now) {
    if (!(visible && shown)) { looping = false; return; }
    requestAnimationFrame(loop);
    if (mobile && now - last < 32) return; // ~30 fps on phones
    last = now;
    draw(now);
  }
  function kick() {
    if (reduced || pending > 0 || looping || !(visible && shown)) return;
    looping = true; requestAnimationFrame(loop);
  }
  if (stage && "IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { visible = !!(en[0] && en[0].isIntersecting); kick(); }, { threshold: 0.02 }).observe(stage);
  }
  document.addEventListener("visibilitychange", function () { shown = document.visibilityState !== "hidden"; kick(); });

  function ready() {
    draw(performance.now());
    if (stage) stage.classList.add("is-ready");
    kick();
  }
})();
