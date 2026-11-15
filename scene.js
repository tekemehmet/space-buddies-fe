/*
 * Astro Adventures: The Forgotten Explorers
 * Animated welcome-screen background built with Three.js (r160).
 *
 * Everything here is generated in code: no image files needed.
 *   - Twinkling, glowing star field with occasional shooting stars
 *   - Moon (bottom left) and Mars (bottom right) with painted surfaces
 *   - A "warp" transition when Start Adventure is pressed
 *
 * The scene is fixed (no mouse or tap interaction), so the screen reads as a flat poster.
 *
 * This is a classic script that loads Three.js with a dynamic import(), so the
 * page also works when index.html is opened straight from the file system.
 * It exposes window.astroScene = { launch(), reset() } for script.js.
 */
(async function () {
  "use strict";

  const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

  // NASA Space Apps brand palette
  const BRAND = {
    white: 0xffffff,
    blueYonder: 0x2e96f5,
    neonBlue: 0x0960e1,
    electricBlue: 0x0042a6,
    deepBlue: 0x07173f,
  };

  const screen = document.getElementById("welcomeScreen");
  const canvas = document.getElementById("spaceCanvas");

  let THREE;
  try {
    THREE = await new Function("u", "return import(u)")(THREE_URL); // (so dev servers like Vite leave this classic script alone)
  } catch (err) {
    console.warn("Astro Adventures: could not load Three.js, showing the fallback stars.", err);
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (err) {
    console.warn("Astro Adventures: WebGL is not available, showing the fallback stars.", err);
    return;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MOTION = reduceMotion ? 0.3 : 1;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const FOV = 35;
  const CAM_Z = 20;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  camera.position.set(0, 0, CAM_Z);

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 3D value noise + fractal noise, used to paint the planet surfaces.
  function createNoise(seed) {
    const rand = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const val = new Float32Array(256);
    for (let i = 0; i < 256; i++) val[i] = rand();

    const h = (x, y, z) => val[perm[perm[perm[x] + y] + z]];
    const fade = (t) => t * t * (3 - 2 * t);
    const lerp = (a, b, t) => a + (b - a) * t;

    function noise(x, y, z) {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
      const X = xi & 255, Y = yi & 255, Z = zi & 255;
      return lerp(
        lerp(lerp(h(X, Y, Z), h(X + 1, Y, Z), u), lerp(h(X, Y + 1, Z), h(X + 1, Y + 1, Z), u), v),
        lerp(lerp(h(X, Y, Z + 1), h(X + 1, Y, Z + 1), u), lerp(h(X, Y + 1, Z + 1), h(X + 1, Y + 1, Z + 1), u), v),
        w
      );
    }

    function fbm(x, y, z, octaves) {
      let amp = 0.5, freq = 1, sum = 0, norm = 0;
      for (let o = 0; o < octaves; o++) {
        sum += amp * noise(x * freq, y * freq, z * freq);
        norm += amp;
        amp *= 0.5;
        freq *= 2.03;
      }
      return sum / norm;
    }

    return { noise, fbm };
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smoothstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const mix = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  /*
   * Paints an equirectangular texture that matches THREE.SphereGeometry's UVs.
   * `shade(x, y, z, index)` returns [r, g, b, height] in 0..1 for a point on the unit sphere.
   */
  function paintSphere(width, height, shade) {
    const colorCanvas = document.createElement("canvas");
    const bumpCanvas = document.createElement("canvas");
    colorCanvas.width = bumpCanvas.width = width;
    colorCanvas.height = bumpCanvas.height = height;
    const cctx = colorCanvas.getContext("2d");
    const bctx = bumpCanvas.getContext("2d");
    const cimg = cctx.createImageData(width, height);
    const bimg = bctx.createImageData(width, height);

    const cosPhi = new Float32Array(width), sinPhi = new Float32Array(width);
    for (let i = 0; i < width; i++) {
      const phi = (i / width) * Math.PI * 2;
      cosPhi[i] = Math.cos(phi);
      sinPhi[i] = Math.sin(phi);
    }

    for (let j = 0; j < height; j++) {
      const theta = (j / (height - 1)) * Math.PI;
      const sinT = Math.sin(theta), cosT = Math.cos(theta);
      for (let i = 0; i < width; i++) {
        const idx = j * width + i;
        const out = shade(-cosPhi[i] * sinT, cosT, sinPhi[i] * sinT, idx);
        const k = idx * 4;
        cimg.data[k] = clamp(out[0], 0, 1) * 255;
        cimg.data[k + 1] = clamp(out[1], 0, 1) * 255;
        cimg.data[k + 2] = clamp(out[2], 0, 1) * 255;
        cimg.data[k + 3] = 255;
        const b = clamp(out[3], 0, 1) * 255;
        bimg.data[k] = bimg.data[k + 1] = bimg.data[k + 2] = b;
        bimg.data[k + 3] = 255;
      }
    }
    cctx.putImageData(cimg, 0, 0);
    bctx.putImageData(bimg, 0, 0);

    const map = new THREE.CanvasTexture(colorCanvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const bump = new THREE.CanvasTexture(bumpCanvas);
    return { map, bump };
  }

  /*
   * Stamps bowl-shaped craters into a height buffer (only touching nearby rows,
   * so even ~150 craters stay fast).
   */
  function stampCraters(buffer, width, height, craters) {
    for (const c of craters) {
      const reach = c.radius * 1.6;
      const thetaC = Math.acos(c.y);
      const j0 = Math.max(0, Math.floor(((thetaC - reach) / Math.PI) * (height - 1)));
      const j1 = Math.min(height - 1, Math.ceil(((thetaC + reach) / Math.PI) * (height - 1)));
      const cosReach = Math.cos(reach);
      for (let j = j0; j <= j1; j++) {
        const theta = (j / (height - 1)) * Math.PI;
        const sinT = Math.sin(theta), cosT = Math.cos(theta);
        for (let i = 0; i < width; i++) {
          const phi = (i / width) * Math.PI * 2;
          const x = -Math.cos(phi) * sinT, z = Math.sin(phi) * sinT;
          const dot = x * c.x + cosT * c.y + z * c.z;
          if (dot < cosReach) continue;
          const d = Math.acos(Math.min(1, dot)) / c.radius;
          let hgt = 0;
          if (d < 1) hgt += (d * d - 1) * 0.9;                  // bowl
          hgt += Math.exp(-Math.pow((d - 1) / 0.22, 2)) * 0.45; // raised rim
          buffer[j * width + i] += hgt * c.depth;
        }
      }
    }
  }

  function randomCraters(rand, count, minR, maxR, power) {
    const list = [];
    for (let n = 0; n < count; n++) {
      const y = rand() * 2 - 1;
      const phi = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - y * y);
      const radius = minR + Math.pow(rand(), power) * (maxR - minR);
      list.push({ x: -Math.cos(phi) * s, y, z: Math.sin(phi) * s, radius, depth: 0.6 + rand() * 0.5 });
    }
    return list;
  }

  /* ------------------------------------------------------------------ */
  /* The Forgotten Explorers                                             */
  /* Tiny models of real spacecraft that are still sitting on the Moon   */
  /* and Mars, placed at their real landing coordinates.                 */
  /* ------------------------------------------------------------------ */

  const EX = {
    gold: new THREE.MeshStandardMaterial({ color: 0xd9a521, metalness: 0.75, roughness: 0.35 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xd3d9e3, metalness: 0.5, roughness: 0.4 }),
    white: new THREE.MeshStandardMaterial({ color: BRAND.white, roughness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2b303b, roughness: 0.7 }),
    solar: new THREE.MeshStandardMaterial({ color: BRAND.deepBlue, metalness: 0.4, roughness: 0.3, emissive: BRAND.electricBlue, emissiveIntensity: 0.3 }),
    flag: (function () {
      const c = document.createElement("canvas");
      c.width = 76; c.height = 40;
      const ctx = c.getContext("2d");
      for (let i = 0; i < 13; i++) {
        ctx.fillStyle = i % 2 ? "#FFFFFF" : "#B22234";
        ctx.fillRect(0, (i * 40) / 13, 76, 40 / 13 + 0.5);
      }
      ctx.fillStyle = "#3C3B6E";
      ctx.fillRect(0, 0, 30, 21.5);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 });
    })(),
  };

  const UP = new THREE.Vector3(0, 1, 0);

  function part(geo, mat, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  function strut(parent, a, b, r, mat) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 6), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(UP, dir.normalize());
    parent.add(m);
    return m;
  }

  function landingLegs(g, count, topR, topY, footR, mat, startAngle = 0) {
    for (let k = 0; k < count; k++) {
      const a = startAngle + (k * Math.PI * 2) / count;
      const top = new THREE.Vector3(Math.cos(a) * topR, topY, Math.sin(a) * topR);
      const foot = new THREE.Vector3(Math.cos(a) * footR, 0.03, Math.sin(a) * footR);
      strut(g, top, foot, 0.035, mat);
      part(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 10), mat, g, foot.x, 0.015, foot.z);
    }
  }

  function wheels(g, xs, zOff, r) {
    xs.forEach((x) => [-1, 1].forEach((s) => {
      part(new THREE.CylinderGeometry(r, r, 0.08, 12), EX.dark, g, x, r, s * zOff).rotation.x = Math.PI / 2;
    }));
  }

  function dish(g, x, y, z, r) {
    const d = part(new THREE.SphereGeometry(r, 16, 6, 0, Math.PI * 2, 0, 0.7), EX.silver, g, x, y, z);
    d.rotation.x = Math.PI; // open side up
    return d;
  }

  // Each builder makes a model about 1 unit tall, standing on y = 0.
  const BUILD = {
    // Apollo Lunar Module descent stage (left behind by every Apollo landing) + flag
    apolloLander() {
      const g = new THREE.Group();
      part(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 8), EX.gold, g, 0, 0.55, 0);
      part(new THREE.CylinderGeometry(0.3, 0.42, 0.06, 8), EX.silver, g, 0, 0.74, 0);
      landingLegs(g, 4, 0.4, 0.45, 0.78, EX.silver, Math.PI / 4);
      part(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6), EX.white, g, 1.0, 0.45, 0.3);
      part(new THREE.PlaneGeometry(0.45, 0.25), EX.flag, g, 1.225, 0.77, 0.3);
      return g;
    },
    // Lunar Roving Vehicle (Apollo 15, 16, 17)
    lrv() {
      const g = new THREE.Group();
      part(new THREE.BoxGeometry(1.0, 0.07, 0.55), EX.silver, g, 0, 0.28, 0);
      part(new THREE.BoxGeometry(0.35, 0.2, 0.42), EX.dark, g, -0.08, 0.4, 0);
      wheels(g, [-0.38, 0.38], 0.33, 0.14);
      part(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 6), EX.silver, g, 0.42, 0.58, 0);
      dish(g, 0.42, 0.95, 0, 0.2);
      return g;
    },
    // Surveyor robotic lander
    surveyor() {
      const g = new THREE.Group();
      part(new THREE.CylinderGeometry(0.3, 0.36, 0.25, 3), EX.silver, g, 0, 0.45, 0);
      landingLegs(g, 3, 0.3, 0.38, 0.7, EX.silver);
      part(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6), EX.silver, g, 0, 0.85, 0);
      part(new THREE.BoxGeometry(0.5, 0.02, 0.35), EX.solar, g, 0, 1.15, 0).rotation.x = 0.4;
      return g;
    },
    // Lunokhod 1 rover
    lunokhod() {
      const g = new THREE.Group();
      part(new THREE.CylinderGeometry(0.45, 0.32, 0.3, 20), EX.silver, g, 0, 0.42, 0).scale.set(1, 1, 0.7);
      const lid = part(new THREE.CylinderGeometry(0.46, 0.46, 0.03, 20), EX.solar, g, 0, 0.66, -0.12);
      lid.scale.set(1, 1, 0.7);
      lid.rotation.x = -0.5;
      wheels(g, [-0.3, -0.1, 0.1, 0.3], 0.3, 0.1);
      return g;
    },
    // Viking 1 and 2 landers
    viking() {
      const g = new THREE.Group();
      part(new THREE.CylinderGeometry(0.38, 0.38, 0.2, 6), EX.silver, g, 0, 0.5, 0);
      landingLegs(g, 3, 0.35, 0.42, 0.7, EX.silver);
      part(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), EX.silver, g, -0.15, 0.8, 0);
      dish(g, -0.15, 1.02, 0, 0.22);
      [-1, 1].forEach((s) => part(new THREE.BoxGeometry(0.12, 0.2, 0.12), EX.dark, g, 0.2, 0.7, s * 0.18));
      return g;
    },
    // Sojourner, the first Mars rover
    sojourner() {
      const g = new THREE.Group();
      part(new THREE.BoxGeometry(0.5, 0.12, 0.34), EX.gold, g, 0, 0.3, 0);
      part(new THREE.BoxGeometry(0.56, 0.02, 0.4), EX.solar, g, 0, 0.38, 0);
      wheels(g, [-0.22, 0, 0.22], 0.2, 0.08);
      return g;
    },
    // Spirit and Opportunity rovers
    mer() {
      const g = new THREE.Group();
      part(new THREE.BoxGeometry(0.55, 0.22, 0.45), EX.white, g, 0, 0.42, 0);
      part(new THREE.BoxGeometry(1.0, 0.03, 0.8), EX.solar, g, 0, 0.56, 0);
      part(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), EX.white, g, 0.3, 0.8, 0);
      part(new THREE.BoxGeometry(0.18, 0.08, 0.08), EX.white, g, 0.3, 1.07, 0);
      wheels(g, [-0.32, 0, 0.32], 0.33, 0.1);
      return g;
    },
    // Phoenix lander (two round solar panels)
    phoenix(withSeismometer = false) {
      const g = new THREE.Group();
      part(new THREE.CylinderGeometry(0.33, 0.33, 0.12, 10), EX.gold, g, 0, 0.5, 0);
      [-1, 1].forEach((s) => part(new THREE.CylinderGeometry(0.38, 0.38, 0.02, 10), EX.solar, g, s * 0.75, 0.52, 0));
      landingLegs(g, 3, 0.3, 0.44, 0.55, EX.silver, Math.PI / 2);
      strut(g, new THREE.Vector3(0.1, 0.55, 0.25), new THREE.Vector3(0.35, 0.25, 0.7), 0.025, EX.silver);
      if (withSeismometer) part(new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), EX.white, g, 0.15, 0, 0.75);
      return g;
    },
    // InSight lander (Phoenix design + dome-covered seismometer)
    insight() {
      return BUILD.phoenix(true);
    },
  };

  // [model, latitude °N, longitude °E, name shown on hover, year it landed]
  const MOON_EXPLORERS = [
    ["apolloLander", 0.67, 23.47, "Apollo 11 Lunar Module", 1969],     // Tranquility Base
    ["apolloLander", -3.01, -23.42, "Apollo 12 Lunar Module", 1969],
    ["apolloLander", -3.65, -17.47, "Apollo 14 Lunar Module", 1971],
    ["apolloLander", 26.13, 3.63, "Apollo 15 Lunar Module", 1971],
    ["lrv", 24.5, 7.2, "Apollo 15 Lunar Roving Vehicle", 1971],        // nudged so both stay visible
    ["apolloLander", -8.97, 15.5, "Apollo 16 Lunar Module", 1972],
    ["lrv", -12.3, 18.6, "Apollo 16 Lunar Roving Vehicle", 1972],      // nudged
    ["apolloLander", 20.19, 30.77, "Apollo 17 Lunar Module", 1972],
    ["lrv", 16.8, 33.9, "Apollo 17 Lunar Roving Vehicle", 1972],       // nudged
    ["surveyor", -2.47, -43.34, "Surveyor 1", 1966],
    ["lunokhod", 38.24, -35.0, "Lunokhod 1 Rover", 1970],
  ];

  const MARS_EXPLORERS = [
    ["viking", 22.27, -47.95, "Viking 1 Lander", 1976],
    ["viking", 47.64, 134.29, "Viking 2 Lander", 1976],
    ["sojourner", 19.13, -33.22, "Sojourner Rover", 1997],              // Mars Pathfinder
    ["mer", -14.57, 175.47, "Spirit Rover", 2004],
    ["mer", -1.95, -5.53, "Opportunity Rover", 2004],
    ["phoenix", 68.22, -125.75, "Phoenix Lander", 2008],
    ["insight", 4.5, 135.62, "InSight Lander", 2018],
  ];

  // Invisible, slightly oversized "hover target" so tiny models are easy to point at
  const HIT_GEO = new THREE.SphereGeometry(1.05, 10, 8);
  const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });

  // Latitude/longitude → point on the unit sphere (same mapping as the painted textures).
  // `frontLon` is the longitude that faces the viewer at the start.
  function latLonToVector(lat, lon, frontLon) {
    const theta = THREE.MathUtils.degToRad(90 - lat);
    const phi = THREE.MathUtils.degToRad(lon - frontLon) + Math.PI / 2;
    return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
  }

  function placeExplorers(sphere, list, frontLon, size) {
    const rand = mulberry32(5);
    for (const [type, lat, lon, name, year] of list) {
      const obj = BUILD[type]();
      obj.userData.explorer = { name, year };
      part(HIT_GEO, HIT_MAT, obj, 0, 0.45, 0);
      const n = latLonToVector(lat, lon, frontLon);
      obj.position.copy(n).multiplyScalar(0.995);
      obj.quaternion.setFromUnitVectors(UP, n);
      obj.rotateY(rand() * Math.PI * 2);
      obj.scale.setScalar(size);
      sphere.add(obj);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Lighting + a soft environment in the brand blues                    */
  /* ------------------------------------------------------------------ */

  scene.add(new THREE.HemisphereLight(BRAND.white, BRAND.electricBlue, 1.25));

  const keyLight = new THREE.DirectionalLight(BRAND.white, 2.6);
  keyLight.position.set(-6, 7, 9);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(BRAND.blueYonder, 2.4);
  rimLight.position.set(7, 4, -6);
  scene.add(rimLight);

  (function buildEnvironment() {
    const envScene = new THREE.Scene();
    const geo = new THREE.SphereGeometry(10, 32, 16);
    const colors = [];
    const top = new THREE.Color(BRAND.white), mid = new THREE.Color(BRAND.blueYonder), bottom = new THREE.Color(BRAND.deepBlue);
    const pos = geo.attributes.position;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getY(i) / 10;
      if (t > 0) c.copy(mid).lerp(top, t); else c.copy(mid).lerp(bottom, -t);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    envScene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
  })();

  /* ------------------------------------------------------------------ */
  /* Glow shells (planet halos + soft rim light)                         */
  /* ------------------------------------------------------------------ */

  const glowVertex = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `;

  // Soft halo around the planet (rendered on the inside of a bigger sphere).
  function makeHalo(color, scale, strength) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
      vertexShader: glowVertex,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uStrength;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float i = pow(clamp(-dot(vNormal, vView), 0.0, 1.0), 2.2) * uStrength;
          gl_FragColor = vec4(uColor, clamp(i, 0.0, 1.0));
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat);
    mesh.scale.setScalar(scale);
    return mesh;
  }

  // Bright fresnel edge on the planet itself, for an illustrated look.
  function makeRim(color, power, strength) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: power }, uStrength: { value: strength } },
      vertexShader: glowVertex,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uPower;
        uniform float uStrength;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float i = pow(1.0 - clamp(dot(vNormal, vView), 0.0, 1.0), uPower) * uStrength;
          gl_FragColor = vec4(uColor, clamp(i, 0.0, 1.0));
        }
      `,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat);
    mesh.scale.setScalar(1.004);
    return mesh;
  }

  /* ------------------------------------------------------------------ */
  /* Stars                                                               */
  /* ------------------------------------------------------------------ */

  const starUniforms = {
    uTime: { value: 0 },
    uTravel: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
  };

  const stars = (function buildStars() {
    const rand = mulberry32(7);
    const COUNT = 2200;
    const positions = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    const phases = new Float32Array(COUNT);
    const sparkles = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    const white = new THREE.Color(BRAND.white);
    const blue = new THREE.Color(BRAND.blueYonder).lerp(white, 0.4);
    const halfTan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

    for (let i = 0; i < COUNT; i++) {
      const z = -40 + rand() * 37; // -40 .. -3
      const halfH = (CAM_Z - z) * halfTan * 1.1;
      const halfW = halfH * 2.4; // wide enough for ultra-wide screens
      positions[i * 3] = (rand() * 2 - 1) * halfW;
      positions[i * 3 + 1] = (rand() * 2 - 1) * halfH;
      positions[i * 3 + 2] = z;

      const isSparkle = rand() < 0.035;
      sparkles[i] = isSparkle ? 1 : 0;
      sizes[i] = isSparkle ? 26 + rand() * 20 : 5 + Math.pow(rand(), 3) * 14;
      phases[i] = rand();
      const col = rand() < 0.8 ? white : blue;
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geo.setAttribute("aSparkle", new THREE.BufferAttribute(sparkles, 1));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.ShaderMaterial({
      uniforms: starUniforms,
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aPhase;
        attribute float aSparkle;
        attribute vec3 aColor;
        uniform float uTime;
        uniform float uTravel;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vTwinkle;
        varying float vSparkle;
        void main() {
          vec3 p = position;
          p.z = mod(p.z + uTravel + 40.0, 50.0) - 40.0; // stars stream toward us during warp
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float speed = 0.6 + aPhase * 1.8;
          float tw = 0.55 + 0.45 * sin(uTime * speed + aPhase * 6.2831);
          vTwinkle = tw;
          vColor = aColor;
          vSparkle = aSparkle;
          gl_PointSize = aSize * uPixelRatio * (0.75 + 0.35 * tw) * (26.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vTwinkle;
        varying float vSparkle;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d2 = dot(uv, uv);
          float core = exp(-d2 * 90.0);
          float glow = exp(-d2 * 16.0) * 0.45;
          float a = core + glow;
          if (vSparkle > 0.5) {
            // four-point twinkle flare
            float flare = exp(-abs(uv.x) * 70.0) * exp(-abs(uv.y) * 5.5)
                        + exp(-abs(uv.y) * 70.0) * exp(-abs(uv.x) * 5.5);
            a = core * 1.2 + glow * 0.8 + flare * (0.6 + 0.6 * vTwinkle);
          }
          a *= mix(0.55, 1.0, vTwinkle) * smoothstep(0.5, 0.42, length(uv));
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor, clamp(a, 0.0, 1.0));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    return points;
  })();

  // Occasional shooting star
  const shootingStar = (function () {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float across = 1.0 - abs(vUv.y - 0.5) * 2.0;
          float a = pow(vUv.x, 2.5) * pow(across, 2.0) * uOpacity;
          gl_FragColor = vec4(vec3(1.0), a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.scale.set(4.5, 0.07, 1);
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, mat, active: false, start: 0, from: new THREE.Vector3(), dir: new THREE.Vector3(), next: 3 };
  })();

  /* ------------------------------------------------------------------ */
  /* Moon                                                                */
  /* ------------------------------------------------------------------ */

  function buildMoon() {
    const W = 1024, H = 512;
    const noise = createNoise(11);
    const rand = mulberry32(42);
    const craterH = new Float32Array(W * H);
    stampCraters(craterH, W, H, randomCraters(rand, 140, 0.025, 0.09, 2));
    stampCraters(craterH, W, H, randomCraters(rand, 14, 0.12, 0.26, 1.5));

    const tex = paintSphere(W, H, (x, y, z, idx) => {
      const base = noise.fbm(x * 3 + 5, y * 3, z * 3, 5);
      const maria = smoothstep(0.52, 0.62, noise.fbm(x * 1.4 + 20, y * 1.4, z * 1.4, 4));
      const ch = craterH[idx];
      let g = 0.74 + (base - 0.5) * 0.35 - maria * 0.2 + ch * 0.16;
      g = clamp(g, 0.2, 1);
      return [g * 0.93, g * 0.94, g * 1.0, 0.5 + ch * 0.35 + (base - 0.5) * 0.25];
    });

    const mat = new THREE.MeshStandardMaterial({
      map: tex.map,
      bumpMap: tex.bump,
      bumpScale: 3,
      roughness: 0.95,
      metalness: 0,
      envMapIntensity: 0.25,
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), mat);
    placeExplorers(sphere, MOON_EXPLORERS, 0, 0.077); // Moon's near side faces us
    return assemblePlanet(sphere, 0.15, 0.07, makeRim(BRAND.white, 3.0, 0.45), makeHalo(BRAND.blueYonder, 1.22, 1.1));
  }

  /* ------------------------------------------------------------------ */
  /* Mars                                                                */
  /* ------------------------------------------------------------------ */

  function buildMars() {
    const W = 1024, H = 512;
    const noise = createNoise(23);
    const rand = mulberry32(99);
    const craterH = new Float32Array(W * H);
    stampCraters(craterH, W, H, randomCraters(rand, 70, 0.02, 0.07, 2));

    // A tall volcano, a nod to Olympus Mons
    const volcano = { x: -Math.cos(1.2) * 0.9, y: 0.32, z: Math.sin(1.2) * 0.9 };
    const vl = Math.hypot(volcano.x, volcano.y, volcano.z);
    volcano.x /= vl; volcano.y /= vl; volcano.z /= vl;

    const light = [0.98, 0.62, 0.36], mid = [0.86, 0.4, 0.2], dark = [0.55, 0.22, 0.13];

    const tex = paintSphere(W, H, (x, y, z, idx) => {
      const n = noise.fbm(x * 2.2, y * 2.2, z * 2.2, 5);
      const patches = smoothstep(0.5, 0.64, noise.fbm(x * 1.3 + 9, y * 1.6, z * 1.3, 4));
      const fine = noise.fbm(x * 9, y * 9, z * 9, 3);

      let r = mix(light[0], mid[0], n), g = mix(light[1], mid[1], n), b = mix(light[2], mid[2], n);
      r = mix(r, dark[0], patches * 0.85); g = mix(g, dark[1], patches * 0.85); b = mix(b, dark[2], patches * 0.85);
      const grain = (fine - 0.5) * 0.12;
      r += grain; g += grain * 0.8; b += grain * 0.6;

      let hgt = 0.5 + (n - 0.5) * 0.4 + craterH[idx] * 0.3;

      // Long canyon near the equator, a nod to Valles Marineris
      const phi = Math.atan2(z, -x);
      const along = smoothstep(1.9, 2.2, phi) * (1 - smoothstep(3.1, 3.4, phi));
      const wobble = (noise.noise(x * 6, y * 6, z * 6) - 0.5) * 0.05;
      const canyon = along * (1 - smoothstep(0.0, 0.025, Math.abs(y + 0.12 + wobble)));
      r = mix(r, dark[0] * 0.8, canyon * 0.8); g = mix(g, dark[1] * 0.8, canyon * 0.8); b = mix(b, dark[2] * 0.8, canyon * 0.8);
      hgt -= canyon * 0.4;

      // Volcano
      const vd = Math.acos(clamp(x * volcano.x + y * volcano.y + z * volcano.z, -1, 1));
      const cone = Math.exp(-Math.pow(vd / 0.14, 2));
      const caldera = Math.exp(-Math.pow(vd / 0.025, 2));
      hgt += cone * 0.5 - caldera * 0.35;
      r = mix(r, 0.93, cone * 0.25); g = mix(g, 0.55, cone * 0.25); b = mix(b, 0.33, cone * 0.25);

      // Polar ice caps
      const capEdge = 0.86 + (noise.noise(x * 8, y * 8, z * 8) - 0.5) * 0.08;
      const ice = smoothstep(capEdge, capEdge + 0.04, Math.abs(y));
      r = mix(r, 1, ice); g = mix(g, 1, ice); b = mix(b, 1, ice);
      hgt += ice * 0.15;

      return [r, g, b, hgt];
    });

    const mat = new THREE.MeshStandardMaterial({
      map: tex.map,
      bumpMap: tex.bump,
      bumpScale: 2,
      roughness: 0.9,
      metalness: 0,
      envMapIntensity: 0.25,
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), mat);
    placeExplorers(sphere, MARS_EXPLORERS, -25, 0.07); // Viking 1, Sojourner & Opportunity face us
    // Mars is tilted about 25°
    return assemblePlanet(sphere, -0.44, 0.1, makeRim(0xffb27a, 2.6, 0.75), makeHalo(0xff8a4c, 1.2, 1.2));
  }

  /*
   * group (position + size)
   *   ├─ turn   ← rotated when you drag the planet
   *   │   └─ tilt  ← axial tilt
   *   │       └─ sphere (+ explorers) ← slow automatic spin
   *   ├─ rim glow
   *   └─ halo
   */
  function assemblePlanet(sphere, tiltZ, spinSpeed, rim, halo) {
    const group = new THREE.Group();
    const turn = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.rotation.z = tiltZ;
    tilt.add(sphere);
    turn.add(tilt);
    group.add(turn, rim, halo);
    group.userData = {
      spin: sphere,
      spinSpeed,
      turn,
      velocity: new THREE.Vector2(), // drag "fling" speed (rad/s)
      idle: 99,                      // seconds since last touched
    };
    return group;
  }

  const moon = buildMoon();
  const mars = buildMars();
  moon.position.z = -1;
  mars.position.z = -1;
  scene.add(moon, mars);

  /* ------------------------------------------------------------------ */
  /* Our rocket: waits on the Moon, flies over to Mars, lands, repeats   */
  /* ------------------------------------------------------------------ */

  const ship = (function buildShip() {
    const white = new THREE.MeshPhysicalMaterial({ color: BRAND.white, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3, envMapIntensity: 0.8 });
    const blue = new THREE.MeshStandardMaterial({ color: BRAND.electricBlue, roughness: 0.35, metalness: 0.2 });
    const yonder = new THREE.MeshStandardMaterial({ color: BRAND.blueYonder, roughness: 0.15, metalness: 0.3, emissive: BRAND.blueYonder, emissiveIntensity: 0.35 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xc4c8cf, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide });
    const g = new THREE.Group();       // pivot at the rocket's feet
    const radius = (t) => (t < 0.62 ? 0.17 + Math.sin(t * Math.PI * 0.8) * 0.03 : 0.2 * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.62) / 0.38, 2))));
    const body = [], nose = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; body.push(new THREE.Vector2(Math.max(radius(t), 0.001), 0.08 + t * 0.92)); }
    for (let i = 0; i <= 12; i++) { const t = 0.8 + (i / 12) * 0.2; nose.push(new THREE.Vector2(Math.max(radius(t) * 1.02, 0.001), 0.08 + t * 0.92)); }
    part(new THREE.LatheGeometry(body, 40), white, g);
    part(new THREE.LatheGeometry(nose, 40), blue, g);
    part(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 40), blue, g, 0, 0.36, 0);
    const win = part(new THREE.CircleGeometry(0.075, 32), yonder, g, 0, 0.58, 0.2);
    part(new THREE.TorusGeometry(0.08, 0.018, 10, 32), metal, win, 0, 0, 0.005);
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3 + Math.PI / 6;
      const fin = new THREE.Shape();
      fin.moveTo(0, 0.3); fin.lineTo(0.17, 0.05); fin.lineTo(0.17, -0.06); fin.lineTo(0, 0.06);
      const m = part(new THREE.ExtrudeGeometry(fin, { depth: 0.035, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 }), blue, g, 0, 0.06, 0);
      m.rotation.y = -a;
      m.translateX(0.14);
      m.translateZ(-0.0175);
      const foot = new THREE.Vector3(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
      strut(g, new THREE.Vector3(Math.cos(a) * 0.15, 0.14, Math.sin(a) * 0.15), foot, 0.012, metal);
      part(new THREE.CylinderGeometry(0.04, 0.045, 0.015, 14), metal, g, foot.x, 0.007, foot.z);
    }
    part(new THREE.CylinderGeometry(0.09, 0.12, 0.08, 24, 1, true), metal, g, 0, 0.06, 0);
    // Engine flame (only while flying)
    const fc = document.createElement("canvas");
    fc.width = 64; fc.height = 128;
    const fx = fc.getContext("2d");
    const grad = fx.createRadialGradient(32, 18, 2, 32, 50, 64);
    grad.addColorStop(0, "rgba(255,255,235,1)");
    grad.addColorStop(0.3, "rgba(255,205,90,0.95)");
    grad.addColorStop(0.7, "rgba(255,120,40,0.5)");
    grad.addColorStop(1, "rgba(255,90,20,0)");
    fx.fillStyle = grad;
    fx.fillRect(0, 0, 64, 128);
    const ftex = new THREE.CanvasTexture(fc);
    ftex.colorSpace = THREE.SRGBColorSpace;
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: ftex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    flame.center.set(0.5, 1);
    flame.position.y = 0.04;
    flame.scale.set(0.22, 0.5, 1);
    g.add(flame);
    g.userData.flame = flame;
    g.rotation.y = 0.35; // porthole toward us
    const holder = new THREE.Group(); // holder tilts along the flight path
    holder.add(g);
    holder.userData.flame = flame;
    scene.add(holder);
    return holder;
  })();
  // The flight, on a loop: fly in from the left and land on the Moon, wait, fly over the
  // title letters to Mars, land, wait, then take off and fly away to the right.
  const SHIP = [
    { name: "arrive", secs: 3.6 },
    { name: "moon", secs: 2.0 },
    { name: "over", secs: 5.6 },
    { name: "mars", secs: 2.4 },
    { name: "leave", secs: 2.6 },
    { name: "gone", secs: 1.2 },
  ];
  const SHIP_TOTAL = SHIP.reduce((n, p) => n + p.secs, 0);
  const shipA = new THREE.Vector3(), shipB = new THREE.Vector3(), shipC = new THREE.Vector3(), shipP = new THREE.Vector3(), shipQ = new THREE.Vector3();
  const shipFrom = new THREE.Vector3(), shipTo = new THREE.Vector3();
  const titleEl = document.querySelector("#titleContainer h1");
  const bezier = (out, a, c, b, t) => out.set(
    (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
    (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
    (1 - t) * (1 - t) * a.z + 2 * (1 - t) * t * c.z + t * t * b.z);
  // Fly along a curve from `a` (through control `c`) to `b`; turn tail-first to land if asked
  function flyShip(a, c, b, u, landing) {
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    bezier(shipP, a, c, b, e);
    bezier(shipQ, a, c, b, Math.min(1, e + 0.01));
    ship.position.copy(shipP);
    const along = Math.atan2(-(shipQ.x - shipP.x), shipQ.y - shipP.y);
    const upright = landing ? smoothstep(0.75, 0.96, u) : 0;
    ship.rotation.z = along * (1 - upright);
    const flame = ship.userData.flame;
    flame.visible = true;
    flame.scale.set(0.2, (landing && u > 0.88 ? 0.3 : 0.55) + Math.random() * 0.1, 1);
  }
  function updateShip(t, launching) {
    ship.visible = !launching;
    if (launching) return;
    const w = screen.clientWidth || window.innerWidth, h = screen.clientHeight || window.innerHeight;
    const viewH = visibleHeightAt(-0.6), viewW = viewH * camera.aspect;
    const size = moon.scale.y * 0.42;
    ship.scale.setScalar(size);
    // The top of each planet (they bob gently, so follow them)
    shipA.copy(moon.position).add(new THREE.Vector3(0, moon.scale.y * 0.985, 0.15 * moon.scale.y));
    shipB.copy(mars.position).add(new THREE.Vector3(0, mars.scale.y * 0.985, 0.15 * mars.scale.y));
    let k = t % SHIP_TOTAL, phase = SHIP[0];
    for (const p of SHIP) { if (k < p.secs) { phase = p; break; } k -= p.secs; }
    const u = k / phase.secs;
    const flame = ship.userData.flame;
    if (phase.name === "arrive") { // in from the left edge, landing on top of the Moon
      shipFrom.set(-viewW / 2 - size * 2, shipA.y + viewH * 0.2, -0.6);
      shipC.set(shipA.x - viewW * 0.08, shipA.y + viewH * 0.28, -0.6);
      flyShip(shipFrom, shipC, shipA, u, true);
    } else if (phase.name === "moon" || phase.name === "mars") { // resting on the planet
      ship.position.copy(phase.name === "moon" ? shipA : shipB);
      ship.rotation.z = 0;
      flame.visible = phase.name === "moon" && u > 0.75; // engines light up just before liftoff
      flame.scale.set(0.16, 0.25 + Math.random() * 0.06, 1);
    } else if (phase.name === "over") { // high over the title letters, then down onto Mars
      const r = titleEl ? titleEl.getBoundingClientRect() : null;
      const titleTop = r ? pxToWorld(0, r.top, -0.6, w, h).y : viewH * 0.2;
      const apex = titleTop + size * 0.45;
      shipC.set((shipA.x + shipB.x) / 2, 2 * apex - (shipA.y + shipB.y) / 2, -0.6);
      flyShip(shipA, shipC, shipB, u, true);
    } else if (phase.name === "leave") { // off to the right
      shipTo.set(viewW / 2 + size * 2, shipB.y + viewH * 0.3, -0.6);
      shipC.set(shipB.x + viewW * 0.05, shipB.y + viewH * 0.32, -0.6);
      flyShip(shipB, shipC, shipTo, u, false);
    } else { // out of sight for a moment
      ship.position.set(-viewW, 0, -0.6);
      flame.visible = false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Layout: keep the planets in the bottom corners on any screen size   */
  /* ------------------------------------------------------------------ */

  const moonBase = new THREE.Vector3();
  const marsBase = new THREE.Vector3();
  const halfTan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

  function visibleHeightAt(z) {
    return 2 * halfTan * (CAM_Z - z);
  }

  // Screen pixels -> world position on the plane at depth z
  function pxToWorld(px, py, z, w, h) {
    const vh = visibleHeightAt(z);
    const vw = vh * (w / h);
    return new THREE.Vector3((px / w - 0.5) * vw, -(py / h - 0.5) * vh, z);
  }

  function layout() {
    const w = screen.clientWidth || window.innerWidth;
    const h = screen.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const portrait = w < h * 0.9;
    const pxPerWorld = h / visibleHeightAt(-1);
    const moonRpx = portrait ? Math.min(w * 0.17, h * 0.13) : Math.min(h * 0.17, w * 0.13);
    const marsRpx = moonRpx * 1.15;
    moon.scale.setScalar(moonRpx / pxPerWorld);
    mars.scale.setScalar(marsRpx / pxPerWorld);
    // Pulled in from the corners: both planets fully on screen with breathing room,
    // sitting at the same height on either side of the title.
    const inset = (r) => Math.max(w * 0.16, r * 1.5);
    const planetY = h - Math.max(h * 0.22, marsRpx * 1.7);
    moonBase.copy(pxToWorld(inset(moonRpx), planetY, -1, w, h));
    marsBase.copy(pxToWorld(w - inset(marsRpx), planetY, -1, w, h));
  }

  layout();
  window.addEventListener("resize", layout);

  screen.classList.add("webgl-ready");

  /* ------------------------------------------------------------------ */
  /* Drag to turn the Moon and Mars (mouse or touch)                     */
  /* ------------------------------------------------------------------ */

  const html = document.documentElement;
  const tmpV = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const AXIS_X = new THREE.Vector3(1, 0, 0);
  const drag = { planet: null, pointerId: null, x: 0, y: 0, time: 0, radiusPx: 1 };

  // Is the pointer over a planet? (simple on-screen circle test)
  function planetAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    for (const planet of [moon, mars]) {
      tmpV.copy(planet.position).project(camera);
      const px = rect.left + (tmpV.x * 0.5 + 0.5) * rect.width;
      const py = rect.top + (-tmpV.y * 0.5 + 0.5) * rect.height;
      const radiusPx = (planet.scale.x * rect.height) / visibleHeightAt(planet.position.z);
      if (Math.hypot(clientX - px, clientY - py) < radiusPx * 1.05) return { planet, radiusPx };
    }
    return null;
  }

  function turnPlanet(planet, ax, ay) {
    const turn = planet.userData.turn;
    turn.quaternion.premultiply(tmpQ.setFromAxisAngle(UP, ax));
    turn.quaternion.premultiply(tmpQ.setFromAxisAngle(AXIS_X, ay));
  }

  /* Explorer name labels: on hover (mouse) or on a quick tap (touch) */

  const label = document.getElementById("explorerLabel");
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hover = { inside: false, x: 0, y: 0, lastCheck: 0, current: null, hideTimer: 0 };

  // Returns the explorer under the pointer, but only if it is on the side of the planet facing us
  function explorerAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects([moon.userData.spin, mars.userData.spin], true);
    for (const hit of hits) {
      // Walk up from the mesh that was hit to find its explorer and its planet
      let o = hit.object, explorer = null;
      while (o && o !== moon && o !== mars) {
        if (o.userData.explorer) explorer = o;
        o = o.parent;
      }
      if (!explorer) return null; // the planet surface is in front, so nothing to label
      // Only label explorers on the side facing us (not ones peeking over the edge from behind)
      explorer.getWorldPosition(tmpP);
      tmpN.copy(tmpP).sub(o.position).normalize();
      tmpD.copy(camera.position).sub(tmpP).normalize();
      if (tmpN.dot(tmpD) > 0.15) return explorer.userData.explorer;
    }
    return null;
  }
  const tmpP = new THREE.Vector3(), tmpN = new THREE.Vector3(), tmpD = new THREE.Vector3();

  function showLabel(info, clientX, clientY) {
    if (hover.current !== info) {
      hover.current = info;
      label.innerHTML = "";
      const title = document.createElement("strong");
      title.textContent = info.name;
      const sub = document.createElement("span");
      sub.textContent = `Landed in ${info.year}`;
      label.append(title, sub);
    }
    label.classList.add("is-visible");
    const w = label.offsetWidth, h = label.offsetHeight;
    const left = clamp(clientX - w / 2, 16, window.innerWidth - w - 16);
    let top = clientY - h - 18;
    if (top < 16) top = clientY + 22;
    label.style.left = `${left}px`;
    label.style.top = `${top}px`;
  }

  function hideLabel() {
    hover.current = null;
    label.classList.remove("is-visible");
  }

  function updateHover() {
    if (!hover.inside || launch.active) { if (hover.current) hideLabel(); return; }
    const info = explorerAt(hover.x, hover.y);
    if (info) showLabel(info, hover.x, hover.y);
    else if (hover.current) hideLabel();
  }

  function endDrag() {
    if (drag.planet) drag.planet.userData.idle = 0;
    drag.planet = null;
    drag.pointerId = null;
    html.classList.remove("is-grabbing");
  }

  window.addEventListener("pointerdown", (e) => {
    if (launch.active || e.button > 0 || e.target.closest("button")) return;
    const hit = planetAt(e.clientX, e.clientY);
    if (!hit) return;
    e.preventDefault();
    drag.planet = hit.planet;
    drag.radiusPx = hit.radiusPx;
    drag.pointerId = e.pointerId;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.time = performance.now();
    drag.startX = e.clientX;
    drag.startY = e.clientY;
    drag.pointerType = e.pointerType;
    hit.planet.userData.velocity.set(0, 0);
    hit.planet.userData.idle = 0;
    html.classList.add("is-grabbing");
  });

  window.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") {
      hover.inside = !e.target.closest("button");
      hover.x = e.clientX;
      hover.y = e.clientY;
      updateHover();
    }
    if (drag.planet && e.pointerId === drag.pointerId) {
      const now = performance.now();
      // Moving the pointer by one planet radius turns it about one radian, so the surface follows your finger
      const ax = (e.clientX - drag.x) / drag.radiusPx;
      const ay = (e.clientY - drag.y) / drag.radiusPx;
      turnPlanet(drag.planet, ax, ay);
      const dtSec = Math.max((now - drag.time) / 1000, 1 / 120);
      drag.planet.userData.velocity.set(ax / dtSec, ay / dtSec).clampLength(0, 6);
      drag.planet.userData.idle = 0;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.time = now;
    } else if (e.pointerType === "mouse" && !drag.planet) {
      const over = !launch.active && !e.target.closest("button") && planetAt(e.clientX, e.clientY);
      html.classList.toggle("can-grab", !!over);
    }
  });

  window.addEventListener("pointerup", (e) => {
    if (e.pointerId !== drag.pointerId) return;
    // A quick release after a pause shouldn't fling
    if (performance.now() - drag.time > 80) drag.planet.userData.velocity.set(0, 0);
    // Touch screens have no hover: a tap (not a drag) on an explorer shows its name for a few seconds
    const moved = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
    if (drag.pointerType !== "mouse" && moved < 10) {
      const info = explorerAt(e.clientX, e.clientY);
      clearTimeout(hover.hideTimer);
      if (info) {
        showLabel(info, e.clientX, e.clientY);
        hover.hideTimer = setTimeout(hideLabel, 3000);
      } else {
        hideLabel();
      }
    }
    endDrag();
  });
  document.addEventListener("mouseleave", () => { hover.inside = false; hideLabel(); });
  window.addEventListener("pointercancel", endDrag);
  window.addEventListener("blur", endDrag);

  /* ------------------------------------------------------------------ */
  /* Launch transition (called from script.js)                           */
  /* ------------------------------------------------------------------ */

  const clock = new THREE.Clock();
  const launch = { active: false, start: 0, resolve: null, duration: reduceMotion ? 0.8 : 3.2 };
  let travelSpeed = 0;
  let introStart = 0;

  window.astroScene = {
    launch() {
      if (launch.active) return Promise.resolve();
      endDrag();
      hideLabel();
      html.classList.remove("can-grab");
      launch.active = true;
      launch.start = clock.elapsedTime;
      return new Promise((resolve) => { launch.resolve = resolve; });
    },
    reset() {
      launch.active = false;
      launch.resolve = null;
      travelSpeed = 0;
      introStart = clock.elapsedTime;
    },
    // Stop/start drawing (used while the story chapter is on screen)
    pause() {
      paused = true;
    },
    resume() {
      if (!paused) return;
      paused = false;
      clock.getDelta(); // skip the time spent paused
      requestAnimationFrame(animate);
    },
  };
  let paused = false;

  /* ------------------------------------------------------------------ */
  /* Animation loop                                                      */
  /* ------------------------------------------------------------------ */

  function animate() {
    if (paused) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const tm = t * MOTION;

    // Intro: planets rise into place
    const intro = easeOutCubic(clamp((t - introStart) / (reduceMotion ? 0.4 : 1.6), 0, 1));

    // Launch progress
    let lp = 0;
    if (launch.active) {
      lp = clamp((t - launch.start) / launch.duration, 0, 1);
      if (lp >= 1 && launch.resolve) { launch.resolve(); launch.resolve = null; }
    }
    const lpEase = lp * lp;

    // Stars (warp toward the viewer during launch)
    starUniforms.uTime.value = t;
    const targetTravel = launch.active && !reduceMotion ? 45 * lpEase : 0;
    travelSpeed = mix(travelSpeed, targetTravel, 0.08);
    starUniforms.uTravel.value += travelSpeed * dt;
    stars.rotation.z = Math.sin(tm * 0.02) * 0.03;

    // Planets: slow spin, gentle bob, drag "fling", fly off screen on launch
    const viewH = visibleHeightAt(-1);
    const viewW = viewH * camera.aspect;
    [moon, mars].forEach((planet, i) => {
      const ud = planet.userData;
      const beingDragged = drag.planet === planet;

      // After a fling, keep turning and slow down gradually
      if (!beingDragged && ud.velocity.lengthSq() > 1e-6) {
        turnPlanet(planet, ud.velocity.x * dt, ud.velocity.y * dt);
        ud.velocity.multiplyScalar(Math.exp(-dt * 2.5));
      }

      // The automatic spin pauses while you play with a planet, then eases back in
      if (!beingDragged) ud.idle += dt;
      const autoSpin = smoothstep(2.5, 5, ud.idle);
      ud.spin.rotation.y += dt * ud.spinSpeed * MOTION * autoSpin;

      const base = i === 0 ? moonBase : marsBase;
      const side = i === 0 ? -1 : 1; // Moon exits left, Mars exits right
      const bob = Math.sin(tm * 0.6 + i * 2) * 0.06 * planet.scale.y;
      const exit = lpEase * (viewW * 0.5 + planet.scale.x * 3);
      planet.position.x = base.x + side * exit;
      planet.position.y = base.y + bob - (1 - intro) * 6 - lpEase * viewH * 0.35;
    });

    updateShip(t, launch.active);

    // Planets keep turning under a still mouse, so re-check the hover label a few times a second
    if (hover.inside && performance.now() - hover.lastCheck > 120) {
      hover.lastCheck = performance.now();
      updateHover();
    }

    // Shooting star
    const ss = shootingStar;
    if (!ss.active && t > ss.next && !launch.active && !reduceMotion) {
      const z = -8;
      const vh = visibleHeightAt(z), vw = vh * camera.aspect;
      ss.from.set((Math.random() * 0.8 - 0.1) * vw * 0.5, vh * (0.25 + Math.random() * 0.2), z);
      ss.dir.set(-1, -0.45 - Math.random() * 0.2, 0).normalize();
      ss.mesh.rotation.z = Math.atan2(ss.dir.y, ss.dir.x);
      ss.start = t;
      ss.active = true;
      ss.mesh.visible = true;
    }
    if (ss.active) {
      const p = (t - ss.start) / 1.1;
      if (p >= 1) {
        ss.active = false;
        ss.mesh.visible = false;
        ss.next = t + 5 + Math.random() * 7;
      } else {
        ss.mesh.position.copy(ss.from).addScaledVector(ss.dir, p * 14);
        ss.mat.uniforms.uOpacity.value = Math.sin(p * Math.PI);
      }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
})();
