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
  var segs = mobile ? 32 : 64;

  function latLonToVec3(lat, lon, radius) {
    var phi = (90 - lat) * Math.PI / 180;
    var theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  function makeEarthTexture() {
    var w = mobile ? 1024 : 1536;
    var h = w / 2;
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    var ctx = c.getContext("2d");
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#071018");
    g.addColorStop(0.5, "#05080f");
    g.addColorStop(1, "#071018");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    function lonLatToXY(lon, lat) {
      return [(lon + 180) / 360 * w, (90 - lat) / 180 * h];
    }

    // Soft land masses — dark, not a political map.
    var lands = [
      { lon: -100, lat: 45, rx: 0.16, ry: 0.14, color: "#0c1c18" },
      { lon: -100, lat: 55, rx: 0.18, ry: 0.10, color: "#0b1916" },
      { lon: -62, lat: -10, rx: 0.09, ry: 0.18, color: "#0c1a16" },
      { lon: 15, lat: 10, rx: 0.12, ry: 0.18, color: "#0d1c14" },
      { lon: 20, lat: 50, rx: 0.10, ry: 0.08, color: "#0c1a18" },
      { lon: 90, lat: 45, rx: 0.22, ry: 0.14, color: "#0b1915" },
      { lon: 105, lat: 25, rx: 0.16, ry: 0.12, color: "#0c1b16" },
      { lon: 135, lat: -25, rx: 0.08, ry: 0.07, color: "#0c1a16" },
      { lon: 25, lat: -25, rx: 0.06, ry: 0.08, color: "#0c1a14" },
      { lon: -45, lat: 70, rx: 0.10, ry: 0.06, color: "#0a1618" }
    ];
    lands.forEach(function (L) {
      var p = lonLatToXY(L.lon, L.lat);
      ctx.fillStyle = L.color;
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], L.rx * w, L.ry * h, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Faint lat/lon grid
    ctx.strokeStyle = "rgba(80, 140, 110, 0.12)";
    ctx.lineWidth = 1;
    var i;
    for (i = 1; i < 12; i++) {
      var y = (i / 12) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(80, 140, 110, 0.10)";
    for (i = 1; i < 24; i++) {
      var x = (i / 24) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Speckle / city-light noise on land bands
    var img = ctx.getImageData(0, 0, w, h);
    var d = img.data;
    var n = mobile ? 4000 : 9000;
    for (i = 0; i < n; i++) {
      var px = (Math.random() * w) | 0;
      var py = (Math.random() * h) | 0;
      var idx = (py * w + px) * 4;
      if (d[idx + 1] > 12) {
        var a = Math.random();
        if (a > 0.55) {
          d[idx] = 180 + (Math.random() * 50) | 0;
          d[idx + 1] = 160 + (Math.random() * 40) | 0;
          d[idx + 2] = 80 + (Math.random() * 40) | 0;
          d[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);

    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  var earthMat = new THREE.MeshPhongMaterial({
    map: makeEarthTexture(),
    color: 0xffffff,
    specular: 0x1a2a22,
    shininess: 8,
    emissive: 0x07140f,
    emissiveIntensity: 0.35
  });
  var earth = new THREE.Mesh(
    new THREE.SphereGeometry(R, segs, segs),
    earthMat
  );
  root.add(earth);

  var atmos = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.045, segs, segs),
    new THREE.MeshBasicMaterial({
      color: 0x15803d,
      transparent: true,
      opacity: 0.11,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  root.add(atmos);

  var atmos2 = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.018, segs, segs),
    new THREE.MeshBasicMaterial({
      color: 0x5eead4,
      transparent: true,
      opacity: 0.07,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  root.add(atmos2);

  scene.add(new THREE.AmbientLight(0x6b8f7a, 0.55));
  var sun = new THREE.DirectionalLight(0xcfe8d8, 0.85);
  sun.position.set(-2.2, 0.6, 1.4);
  scene.add(sun);
  var rim = new THREE.DirectionalLight(0x15803d, 0.35);
  rim.position.set(2.5, 0.2, -1.2);
  scene.add(rim);
  var amberFill = new THREE.PointLight(0xd97706, 0.25, 6);
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

  var travelers = [];
  ARCS.forEach(function (pair, idx) {
    var pts = greatCircle(pair[0], pair[1], mobile ? 40 : 72);
    var geo = new THREE.BufferGeometry().setFromPoints(pts);
    var mat = new THREE.LineBasicMaterial({
      color: idx >= 6 ? 0xd97706 : 0x34d399,
      transparent: true,
      opacity: idx >= 6 ? 0.38 : 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    var line = new THREE.Line(geo, mat);
    earth.add(line);

    var dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 8, 8),
      new THREE.MeshBasicMaterial({
        color: idx >= 6 ? 0xd97706 : 0x6ee7b7,
        transparent: true,
        opacity: 0.95
      })
    );
    earth.add(dot);
    travelers.push({
      mesh: dot,
      pts: pts,
      t: idx / ARCS.length,
      speed: 0.00035 + idx * 0.00004
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
