(function () {
  "use strict";

  var canvas = document.getElementById("globe");
  var fallback = document.getElementById("globe-fallback");
  var stage = document.getElementById("globe-stage");
  if (!canvas) return;

  function showFallback() {
    canvas.hidden = true;
    canvas.setAttribute("aria-hidden", "true");
    if (fallback) {
      fallback.hidden = false;
      fallback.removeAttribute("hidden");
    }
  }

  if (typeof THREE === "undefined") {
    showFallback();
    return;
  }

  var reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (err) {}

  function isMobile() {
    return window.matchMedia("(max-width: 720px)").matches ||
      (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
  }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: !isMobile(),
      alpha: true,
      powerPreference: "low-power"
    });
  } catch (err) {
    showFallback();
    return;
  }
  if (!renderer.getContext()) {
    showFallback();
    return;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
  camera.position.set(0, 0.22, 2.55);

  var root = new THREE.Group();
  scene.add(root);

  var R = 1;
  var mobile = isMobile();
  var segs = mobile ? 48 : 96;

  function latLonToVec3(lat, lon, radius) {
    var phi = (90 - lat) * Math.PI / 180;
    var theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  function makeEarthTextures() {
    var w = mobile ? 1024 : 1536;
    var h = w / 2;
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    var ctx = c.getContext("2d");

    // Deep ocean base — green-tinted so the sphere reads as a planet
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#041210");
    g.addColorStop(0.18, "#062a22");
    g.addColorStop(0.5, "#08382c");
    g.addColorStop(0.82, "#062a22");
    g.addColorStop(1, "#041210");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Subtle ocean depth bands (latitude shading helps the sphere read)
    ctx.globalAlpha = 0.18;
    for (var band = 0; band < 8; band++) {
      var by = (band / 8) * h;
      ctx.fillStyle = band % 2 === 0 ? "#0a4a38" : "#052820";
      ctx.fillRect(0, by, w, h / 8);
    }
    ctx.globalAlpha = 1;

    function lonLatToXY(lon, lat) {
      return [(lon + 180) / 360 * w, (90 - lat) / 180 * h];
    }

    // Land masses — brighter green so continents are obvious
    var lands = [
      { lon: -100, lat: 45, rx: 0.17, ry: 0.15, color: "#248a52" },
      { lon: -100, lat: 55, rx: 0.19, ry: 0.11, color: "#1f7a48" },
      { lon: -62, lat: -10, rx: 0.10, ry: 0.19, color: "#269456" },
      { lon: 15, lat: 10, rx: 0.13, ry: 0.19, color: "#228850" },
      { lon: 20, lat: 50, rx: 0.11, ry: 0.09, color: "#1e7644" },
      { lon: 90, lat: 45, rx: 0.23, ry: 0.15, color: "#1c7342" },
      { lon: 105, lat: 25, rx: 0.17, ry: 0.13, color: "#21864e" },
      { lon: 135, lat: -25, rx: 0.09, ry: 0.08, color: "#249052" },
      { lon: 25, lat: -25, rx: 0.07, ry: 0.09, color: "#20824c" },
      { lon: -45, lat: 70, rx: 0.11, ry: 0.07, color: "#1a6840" },
      { lon: -70, lat: -40, rx: 0.05, ry: 0.12, color: "#1e7846" },
      { lon: 38, lat: -5, rx: 0.05, ry: 0.06, color: "#248c50" }
    ];
    lands.forEach(function (L) {
      var p = lonLatToXY(L.lon, L.lat);
      // Soft outer glow for continent edges
      var rg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], L.rx * w);
      rg.addColorStop(0, L.color);
      rg.addColorStop(0.55, L.color);
      rg.addColorStop(1, "rgba(8, 40, 28, 0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], L.rx * w, L.ry * h, 0, 0, Math.PI * 2);
      ctx.fill();
      // Core fill for solid land read
      ctx.fillStyle = L.color;
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], L.rx * w * 0.72, L.ry * h * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Ice caps — pale mint so poles read as globe features
    ctx.fillStyle = "rgba(180, 220, 200, 0.35)";
    ctx.fillRect(0, 0, w, h * 0.06);
    ctx.fillRect(0, h * 0.94, w, h * 0.06);
    ctx.fillStyle = "rgba(160, 210, 190, 0.22)";
    ctx.fillRect(0, h * 0.06, w, h * 0.04);
    ctx.fillRect(0, h * 0.90, w, h * 0.04);

    // Lat/lon grid — stronger so curvature is obvious
    ctx.strokeStyle = "rgba(110, 200, 160, 0.22)";
    ctx.lineWidth = 1;
    var i;
    for (i = 1; i < 12; i++) {
      var y = (i / 12) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(110, 200, 160, 0.16)";
    for (i = 1; i < 24; i++) {
      var x = (i / 24) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    // Equator + prime meridian emphasis
    ctx.strokeStyle = "rgba(150, 230, 190, 0.28)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();

    // City-light speckles on land
    var img = ctx.getImageData(0, 0, w, h);
    var d = img.data;
    var n = mobile ? 5000 : 11000;
    for (i = 0; i < n; i++) {
      var px = (Math.random() * w) | 0;
      var py = (Math.random() * h) | 0;
      var idx = (py * w + px) * 4;
      if (d[idx + 1] > 55) {
        var a = Math.random();
        if (a > 0.5) {
          d[idx] = 200 + (Math.random() * 40) | 0;
          d[idx + 1] = 180 + (Math.random() * 50) | 0;
          d[idx + 2] = 90 + (Math.random() * 40) | 0;
          d[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);

    var colorTex = new THREE.CanvasTexture(c);
    colorTex.encoding = THREE.sRGBEncoding;
    colorTex.anisotropy = 4;
    colorTex.wrapS = THREE.ClampToEdgeWrapping;
    colorTex.wrapT = THREE.ClampToEdgeWrapping;

    // Specular map: oceans shiny, land matte
    var sc = document.createElement("canvas");
    sc.width = w;
    sc.height = h;
    var sctx = sc.getContext("2d");
    sctx.fillStyle = "#888888";
    sctx.fillRect(0, 0, w, h);
    lands.forEach(function (L) {
      var p = lonLatToXY(L.lon, L.lat);
      sctx.fillStyle = "#111111";
      sctx.beginPath();
      sctx.ellipse(p[0], p[1], L.rx * w * 0.85, L.ry * h * 0.85, 0, 0, Math.PI * 2);
      sctx.fill();
    });
    // Ice caps less specular
    sctx.fillStyle = "#333333";
    sctx.fillRect(0, 0, w, h * 0.08);
    sctx.fillRect(0, h * 0.92, w, h * 0.08);
    var specTex = new THREE.CanvasTexture(sc);
    specTex.wrapS = THREE.ClampToEdgeWrapping;
    specTex.wrapT = THREE.ClampToEdgeWrapping;

    // Bump from land silhouettes
    var bc = document.createElement("canvas");
    bc.width = w;
    bc.height = h;
    var bctx = bc.getContext("2d");
    bctx.fillStyle = "#404040";
    bctx.fillRect(0, 0, w, h);
    lands.forEach(function (L) {
      var p = lonLatToXY(L.lon, L.lat);
      bctx.fillStyle = "#a0a0a0";
      bctx.beginPath();
      bctx.ellipse(p[0], p[1], L.rx * w * 0.8, L.ry * h * 0.8, 0, 0, Math.PI * 2);
      bctx.fill();
    });
    var bumpTex = new THREE.CanvasTexture(bc);
    bumpTex.wrapS = THREE.ClampToEdgeWrapping;
    bumpTex.wrapT = THREE.ClampToEdgeWrapping;

    return { color: colorTex, specular: specTex, bump: bumpTex };
  }

  var tex = makeEarthTextures();
  var earthMat = new THREE.MeshPhongMaterial({
    map: tex.color,
    specularMap: tex.specular,
    bumpMap: tex.bump,
    bumpScale: 0.035,
    color: 0xffffff,
    specular: 0x4a8f6e,
    shininess: 42,
    emissive: 0x041a12,
    emissiveIntensity: 0.22
  });
  var earth = new THREE.Mesh(
    new THREE.SphereGeometry(R, segs, segs),
    earthMat
  );
  root.add(earth);

  // Soft cloud layer for depth / spherical read
  (function clouds() {
    var cw = mobile ? 512 : 768;
    var ch = cw / 2;
    var cc = document.createElement("canvas");
    cc.width = cw;
    cc.height = ch;
    var cctx = cc.getContext("2d");
    cctx.clearRect(0, 0, cw, ch);
    cctx.fillStyle = "rgba(200, 240, 220, 0.55)";
    var cn = mobile ? 40 : 70;
    for (var i = 0; i < cn; i++) {
      var cx = Math.random() * cw;
      var cy = Math.random() * ch;
      var crx = (0.02 + Math.random() * 0.08) * cw;
      var cry = crx * (0.25 + Math.random() * 0.35);
      cctx.globalAlpha = 0.15 + Math.random() * 0.25;
      cctx.beginPath();
      cctx.ellipse(cx, cy, crx, cry, Math.random() * Math.PI, 0, Math.PI * 2);
      cctx.fill();
    }
    cctx.globalAlpha = 1;
    var cloudTex = new THREE.CanvasTexture(cc);
    cloudTex.encoding = THREE.sRGBEncoding;
    var cloudMesh = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.012, segs, segs),
      new THREE.MeshPhongMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        specular: 0x222222,
        shininess: 4,
        emissive: 0x000000
      })
    );
    root.add(cloudMesh);
    earth.userData.clouds = cloudMesh;
  })();

  // Atmosphere rim — BackSide glow for clear limb / spherical silhouette
  var atmos = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.08, segs, segs),
    new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.14,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  root.add(atmos);

  var atmos2 = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.035, segs, segs),
    new THREE.MeshBasicMaterial({
      color: 0x6ee7b7,
      transparent: true,
      opacity: 0.10,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  root.add(atmos2);

  // Thin bright limb ring (helps silhouette against dark bg)
  var limb = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.002, segs, segs),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        glowColor: { value: new THREE.Color(0x5eead4) }
      },
      vertexShader: [
        "varying vec3 vNormal;",
        "varying vec3 vView;",
        "void main() {",
        "  vNormal = normalize(normalMatrix * normal);",
        "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
        "  vView = normalize(-mv.xyz);",
        "  gl_Position = projectionMatrix * mv;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 glowColor;",
        "varying vec3 vNormal;",
        "varying vec3 vView;",
        "void main() {",
        "  float fresnel = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.2);",
        "  gl_FragColor = vec4(glowColor, fresnel * 0.55);",
        "}"
      ].join("\n")
    })
  );
  root.add(limb);

  // Lighting: strong key + fill so day/night terminator reads as a sphere
  scene.add(new THREE.AmbientLight(0x3d5c4a, 0.28));
  var hemi = new THREE.HemisphereLight(0xa8e6c8, 0x04120e, 0.45);
  scene.add(hemi);

  var sun = new THREE.DirectionalLight(0xe8fff0, 1.15);
  sun.position.set(-2.4, 0.85, 1.6);
  scene.add(sun);

  var sun2 = new THREE.DirectionalLight(0x9fd4b8, 0.35);
  sun2.position.set(-1.2, -0.6, 2.0);
  scene.add(sun2);

  var rim = new THREE.DirectionalLight(0x10b981, 0.55);
  rim.position.set(2.8, 0.15, -1.4);
  scene.add(rim);

  var amberFill = new THREE.PointLight(0xd97706, 0.22, 6);
  amberFill.position.set(0.8, 0.4, 2.2);
  scene.add(amberFill);

  // Starfield
  (function stars() {
    var count = mobile ? 350 : 900;
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      var r = 8 + Math.random() * 12;
      var u = Math.random();
      var v = Math.random();
      var theta = 2 * Math.PI * u;
      var phi = Math.acos(2 * v - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    var pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xb7c4b8,
        size: mobile ? 0.018 : 0.012,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.7,
        depthWrite: false
      })
    );
    scene.add(pts);
  })();

  var CITIES = [
    [40.6553, -111.9073],
    [37.44, -122.16],
    [34.05, -118.24],
    [47.61, -122.33],
    [40.71, -74.01],
    [41.88, -87.63],
    [29.76, -95.37],
    [25.76, -80.19],
    [51.51, -0.13],
    [48.86, 2.35],
    [48.14, 11.58],
    [52.52, 13.40],
    [52.41, -1.51],
    [41.90, 12.50],
    [40.42, -3.70],
    [55.76, 37.62],
    [25.20, 55.27],
    [24.45, 54.38],
    [1.35, 103.82],
    [35.68, 139.69],
    [37.57, 126.98],
    [31.23, 121.47],
    [23.13, 113.26],
    [22.32, 114.17],
    [39.90, 116.41],
    [-33.87, 151.21],
    [-27.47, 153.03],
    [-37.81, 144.96],
    [-23.55, -46.63],
    [-34.60, -58.38],
    [19.43, -99.13],
    [45.50, -73.57],
    [43.65, -79.38],
    [35.68, -105.94],
    [39.74, -104.99],
    [32.78, -96.80],
    [33.45, -112.07],
    [49.28, -123.12],
    [59.33, 18.07],
    [50.11, 8.68]
  ];

  (function cityLights() {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(CITIES.length * 3);
    var cols = new Float32Array(CITIES.length * 3);
    for (var i = 0; i < CITIES.length; i++) {
      var v = latLonToVec3(CITIES[i][0], CITIES[i][1], R * 1.006);
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;
      var murray = i === 0;
      cols[i * 3] = murray ? 0.85 : 0.45;
      cols[i * 3 + 1] = murray ? 0.47 : 0.85;
      cols[i * 3 + 2] = murray ? 0.04 : 0.55;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    earth.add(new THREE.Points(geo, new THREE.PointsMaterial({
      size: mobile ? 0.028 : 0.018,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    })));
  })();

  function greatCircle(from, to, n) {
    n = n || 64;
    var a = latLonToVec3(from[0], from[1], 1).normalize();
    var b = latLonToVec3(to[0], to[1], 1).normalize();
    var dot = Math.min(1, Math.max(-1, a.dot(b)));
    var omega = Math.acos(dot);
    var sin = Math.sin(omega);
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var p;
      if (sin < 1e-5) p = a.clone();
      else {
        p = a.clone().multiplyScalar(Math.sin((1 - t) * omega) / sin)
          .add(b.clone().multiplyScalar(Math.sin(t * omega) / sin));
      }
      var lift = 1 + 0.09 * Math.sin(Math.PI * t);
      pts.push(p.normalize().multiplyScalar(R * lift));
    }
    return pts;
  }

  // ——— Vehicle meshes ———
  // Nose is -Z, belly is -Y, so lookAt (which aims -Z) flies them along the arc
  // with the belly toward the globe. Rotors spin on local +Y.
  function mat(color, opts) {
    opts = opts || {};
    return new THREE.MeshPhongMaterial({
      color: color,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.ei || 0.18,
      specular: opts.specular || 0x9fb4c4,
      shininess: opts.shininess != null ? opts.shininess : 48,
      flatShading: !!opts.flat
    });
  }

  function paint(color, ei) {
    return mat(color, { emissive: color, ei: ei == null ? 0.22 : ei, shininess: 28 });
  }

  function addRotor(g, rotors, x, y, z, radius, tint) {
    var motor = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.22, radius * 0.26, radius * 0.38, 8),
      mat(0x1f2937, { emissive: 0x0f172a, ei: 0.3, shininess: 20 })
    );
    motor.position.set(x, y - radius * 0.12, z);
    g.add(motor);

    var hub = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.1, radius * 0.1, radius * 0.16, 8),
      mat(tint || 0xe2e8f0, { emissive: tint || 0xe2e8f0, ei: 0.25 })
    );
    hub.position.set(x, y + radius * 0.08, z);
    g.add(hub);

    var spin = new THREE.Group();
    spin.position.set(x, y + radius * 0.16, z);
    var bladeMat = mat(0xf8fafc, { emissive: 0xdbe4ee, ei: 0.35, shininess: 16 });
    var blade = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.85, radius * 0.06, radius * 0.22), bladeMat);
    spin.add(blade);
    var bladeB = blade.clone();
    bladeB.rotation.y = Math.PI / 2;
    spin.add(bladeB);
    g.add(spin);
    rotors.push(spin);

    var disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.92, 18),
      new THREE.MeshBasicMaterial({
        color: tint || 0xd1fae5,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, y + radius * 0.2, z);
    g.add(disc);
  }

  function fuselage(g, len, rad, color) {
    var body = new THREE.Mesh(
      new THREE.CylinderGeometry(rad * 0.72, rad, len, 12),
      paint(color, 0.28)
    );
    body.rotation.x = Math.PI / 2;
    body.position.z = len * 0.05;
    g.add(body);
    var nose = new THREE.Mesh(
      new THREE.ConeGeometry(rad * 0.72, len * 0.38, 12),
      paint(color, 0.3)
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.z = -len * 0.55;
    g.add(nose);
    var canopy = new THREE.Mesh(
      new THREE.SphereGeometry(rad * 0.78, 12, 8),
      mat(0x0f172a, { emissive: 0x164e63, ei: 0.45, shininess: 80, specular: 0xb6e3f4 })
    );
    canopy.scale.set(0.85, 0.62, 1.25);
    canopy.position.set(0, rad * 0.35, -len * 0.12);
    g.add(canopy);
  }

  function wingHalf(g, span, chord, thick, color, y, z, dihedral) {
    var wing = new THREE.Mesh(
      new THREE.BoxGeometry(span, thick, chord),
      paint(color, 0.16)
    );
    wing.position.set((span / 2) * (dihedral >= 0 ? 1 : -1), y, z);
    wing.rotation.z = dihedral;
    g.add(wing);
  }

  // Joby-style tilt-six: wing plus two tail rotors, six discs total.
  function makeJoby(accent) {
    var g = new THREE.Group();
    var rotors = [];
    var white = 0xf4f7fb;
    var wingC = 0xd7dee8;
    fuselage(g, 0.062, 0.009, white);
    wingHalf(g, 0.034, 0.014, 0.0024, wingC, 0.004, -0.004, 0.08);
    wingHalf(g, 0.034, 0.014, 0.0024, wingC, 0.004, -0.004, -0.08);
    // V-tail
    [-1, 1].forEach(function (s) {
      var fin = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.016, 0.012), paint(wingC, 0.16));
      fin.position.set(s * 0.008, 0.008, 0.03);
      fin.rotation.z = s * -0.7;
      g.add(fin);
    });
    [[-0.014, -0.006], [0.014, -0.006], [-0.03, -0.004], [0.03, -0.004]].forEach(function (p) {
      addRotor(g, rotors, p[0], 0.01, p[1], 0.009, accent);
    });
    addRotor(g, rotors, -0.012, 0.012, 0.03, 0.008, accent);
    addRotor(g, rotors, 0.012, 0.012, 0.03, 0.008, accent);
    g.userData.rotors = rotors;
    g.scale.setScalar(2.15);
    return g;
  }

  // Archer-style lift-plus-cruise: long wing, a row of lift rotors, tail.
  function makeArcher(accent) {
    var g = new THREE.Group();
    var rotors = [];
    var white = 0xf8fafc;
    var wingC = 0xc5d0dc;
    fuselage(g, 0.058, 0.0085, white);
    wingHalf(g, 0.042, 0.016, 0.0022, wingC, 0.003, -0.002, 0.05);
    wingHalf(g, 0.042, 0.016, 0.0022, wingC, 0.003, -0.002, -0.05);
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.0016, 0.008), paint(wingC, 0.16));
    tail.position.set(0, 0.002, 0.032);
    g.add(tail);
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.014, 0.01), paint(wingC, 0.16));
    fin.position.set(0, 0.008, 0.032);
    g.add(fin);
    [-0.036, -0.022, -0.01, 0.01, 0.022, 0.036].forEach(function (x, i) {
      addRotor(g, rotors, x, 0.009, i % 2 ? 0.002 : -0.006, 0.0072, accent);
    });
    g.userData.rotors = rotors;
    g.scale.setScalar(2.15);
    return g;
  }

  // Winged tricopter: two rotors on the wing, one tilting rotor on the tail boom.
  function makeTriWing(accent) {
    var g = new THREE.Group();
    var rotors = [];
    var bodyC = 0xe8eef5;
    var carbon = 0x334155;
    var pod = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 12, 10),
      paint(bodyC, 0.3)
    );
    pod.scale.set(0.85, 0.7, 1.45);
    pod.position.z = -0.004;
    g.add(pod);
    var canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.006, 10, 8),
      mat(0x0f172a, { emissive: 0x155e75, ei: 0.5, shininess: 70 })
    );
    canopy.scale.set(1, 0.7, 1.2);
    canopy.position.set(0, 0.005, -0.006);
    g.add(canopy);
    wingHalf(g, 0.03, 0.012, 0.0022, carbon, 0.001, -0.002, 0.12);
    wingHalf(g, 0.03, 0.012, 0.0022, carbon, 0.001, -0.002, -0.12);
    var boom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0016, 0.0016, 0.034, 6),
      mat(carbon, { emissive: 0x1e293b, ei: 0.2 })
    );
    boom.rotation.x = Math.PI / 2;
    boom.position.z = 0.016;
    g.add(boom);
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.0014, 0.012, 0.008), paint(carbon, 0.15));
    fin.position.set(0, 0.006, 0.03);
    g.add(fin);
    // Front pair sits on the wing; rear rotor is the yaw-tilt prop.
    addRotor(g, rotors, -0.026, 0.008, -0.004, 0.011, accent);
    addRotor(g, rotors, 0.026, 0.008, -0.004, 0.011, accent);
    addRotor(g, rotors, 0, 0.01, 0.032, 0.01, accent);
    // Skids
    [-0.006, 0.006].forEach(function (x) {
      var skid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0007, 0.0007, 0.02, 5),
        mat(0x94a3b8, { shininess: 40 })
      );
      skid.rotation.x = Math.PI / 2;
      skid.position.set(x, -0.008, -0.002);
      g.add(skid);
    });
    g.userData.rotors = rotors;
    g.scale.setScalar(2.25);
    return g;
  }

  // Shop hexacopter: carbon hub, six arms, motor bells, real two-blade props.
  function makeHexacopter(accent) {
    var g = new THREE.Group();
    var rotors = [];
    var hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.013, 0.008, 6),
      mat(0x1e293b, { emissive: 0x0f172a, ei: 0.35, flat: true, shininess: 12 })
    );
    g.add(hub);
    var deck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.003, 12),
      paint(0xcbd5e1, 0.2)
    );
    deck.position.y = 0.005;
    g.add(deck);
    for (var i = 0; i < 6; i++) {
      var ang = (i / 6) * Math.PI * 2 + 0.15;
      var reach = 0.03;
      var ax = Math.cos(ang) * reach;
      var az = Math.sin(ang) * reach;
      var arm = new THREE.Mesh(
        new THREE.BoxGeometry(reach, 0.0022, 0.0032),
        mat(0x334155, { emissive: 0x1e293b, ei: 0.15 })
      );
      arm.position.set(ax * 0.5, 0.001, az * 0.5);
      arm.rotation.y = -ang;
      g.add(arm);
      addRotor(g, rotors, ax, 0.006, az, 0.01, accent);
    }
    g.userData.rotors = rotors;
    g.scale.setScalar(2.2);
    return g;
  }

  var VEHICLE_BUILDERS = [
    makeJoby,
    makeArcher,
    makeTriWing,
    makeHexacopter,
    makeJoby,
    makeArcher,
    makeTriWing,
    makeHexacopter
  ];

  // World eVTOL-hub arcs — context, not Flight Enabled routes.
  var ARCS = [
    [[37.44, -122.16], [48.86, 2.35]],
    [[48.14, 11.58], [25.20, 55.27]],
    [[35.68, 139.69], [1.35, 103.82]],
    [[23.13, 113.26], [37.57, 126.98]],
    [[51.51, -0.13], [40.71, -74.01]],
    [[-33.87, 151.21], [35.68, 139.69]],
    [[34.05, -118.24], [40.6553, -111.9073]],
    [[48.86, 2.35], [40.6553, -111.9073]]
  ];

  var _fwd = new THREE.Vector3();

  var travelers = [];
  ARCS.forEach(function (pair, idx) {
    var pts = greatCircle(pair[0], pair[1], mobile ? 40 : 72);
    var geo = new THREE.BufferGeometry().setFromPoints(pts);
    var isMurray = idx >= 6;
    var matLine = new THREE.LineBasicMaterial({
      color: isMurray ? 0xd97706 : 0x34d399,
      transparent: true,
      opacity: isMurray ? 0.38 : 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    var line = new THREE.Line(geo, matLine);
    earth.add(line);

    var accent = isMurray ? 0xd97706 : 0x6ee7b7;
    var craft = VEHICLE_BUILDERS[idx % VEHICLE_BUILDERS.length](accent);
    earth.add(craft);

    travelers.push({
      mesh: craft,
      pts: pts,
      t: idx / ARCS.length,
      speed: 0.00032 + idx * 0.000035,
      kind: idx % 4,
      isRocket: false
    });
  });

  // Murray marker
  var murray = latLonToVec3(40.6553, -111.9073, R * 1.02);
  var pin = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xd97706 })
  );
  pin.position.copy(murray);
  earth.add(pin);

  var ringGeo = new THREE.RingGeometry(0.04, 0.048, 32);
  var ringMat = new THREE.MeshBasicMaterial({
    color: 0xd97706,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  });
  var ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(murray);
  ring.lookAt(0, 0, 0);
  earth.add(ring);

  var ring2 = ring.clone();
  ring2.material = ringMat.clone();
  ring2.material.opacity = 0.4;
  earth.add(ring2);

  // Face Murray at start
  var face = latLonToVec3(40.6553, -111.9073, 1);
  root.rotation.y = Math.atan2(face.x, face.z);
  root.rotation.x = 0.18;

  function resize() {
    var w = stage ? stage.clientWidth : canvas.clientWidth;
    var h = stage ? stage.clientHeight : canvas.clientHeight;
    if (!w || !h) {
      w = window.innerWidth;
      h = window.innerHeight;
    }
    var pr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", function () {
    mobile = isMobile();
    resize();
  }, { passive: true });

  var visible = true;
  if (stage && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      visible = entries[0] && entries[0].isIntersecting;
    }, { threshold: 0.05 });
    io.observe(stage);
  }

  var running = true;
  document.addEventListener("visibilitychange", function () {
    running = document.visibilityState !== "hidden";
  });

  var t0 = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    if (!visible || !running) return;
    var dt = Math.min(40, now - t0);
    t0 = now;

    if (!reduced) {
      root.rotation.y += 0.00018 * dt;
      if (earth.userData.clouds) {
        earth.userData.clouds.rotation.y += 0.00005 * dt;
      }
      var pulse = (Math.sin(now * 0.0024) + 1) * 0.5;
      ring.scale.setScalar(1 + pulse * 0.55);
      ring.material.opacity = 0.75 - pulse * 0.45;
      ring2.scale.setScalar(1.4 + pulse * 0.9);
      ring2.material.opacity = 0.35 - pulse * 0.25;

      travelers.forEach(function (tr) {
        tr.t = (tr.t + tr.speed * dt) % 1;
        var pts = tr.pts;
        var f = tr.t * (pts.length - 1);
        var i = Math.floor(f);
        var frac = f - i;
        var a = pts[i];
        var b = pts[Math.min(i + 1, pts.length - 1)];
        tr.mesh.position.lerpVectors(a, b, frac);

        // Orient craft along path; rockets nose-forward, drones belly-to-globe
        _fwd.subVectors(b, a);
        if (_fwd.lengthSq() > 1e-10) {
          _fwd.normalize();
          var radial = tr.mesh.position.clone().normalize();
          tr.mesh.up.copy(radial);
          tr.mesh.lookAt(tr.mesh.position.clone().add(_fwd));
          if (tr.isRocket) {
            // Rocket mesh nose is +Y; lookAt aims -Z, so tip nose into flight
            tr.mesh.rotateX(-Math.PI / 2);
          }
        }

        // Spin rotors / flicker rocket exhaust
        if (tr.mesh.userData.rotors) {
          tr.mesh.userData.rotors.forEach(function (r, ri) {
            r.rotation.y += (0.22 + (ri % 5) * 0.03) * dt * (ri % 2 ? 1 : -1);
          });
        }
        if (tr.mesh.userData.flame) {
          var flicker = 0.55 + 0.35 * Math.sin(now * 0.02 + tr.t * 20);
          tr.mesh.userData.flame.scale.setScalar(0.85 + flicker * 0.4);
          tr.mesh.userData.flame.material.opacity = 0.45 + flicker * 0.4;
          if (tr.mesh.userData.glow) {
            tr.mesh.userData.glow.material.opacity = 0.3 + flicker * 0.35;
          }
        }
      });
    } else {
      ring.scale.setScalar(1.15);
      ring2.scale.setScalar(1.7);
      ring2.material.opacity = 0.25;
      travelers.forEach(function (tr) {
        tr.mesh.visible = false;
      });
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);

  if (reduced) {
    renderer.render(scene, camera);
  }
})();
