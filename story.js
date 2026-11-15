/*
 * Astro Adventures: The Forgotten Explorers
 * Chapter 1 – Boarding Day (first-person 3D story scene, Three.js r160)
 *
 * You are a kid astronaut standing in the middle of the front row of two
 * rows of excited astronauts, waiting to board the rocket.
 *   1. You walk up to your spot (no talking).
 *   2. Nova, the lead astronaut, and PIP the robot come out of the rocket.
 *   3. Nova introduces the mission; PIP introduces itself.
 *   4. Everyone follows Nova into the rocket, and you go with them.
 *   5. Inside: you take the front-row window seat, safety bars click down,
 *      Nova gives a pre-flight briefing and PIP runs the systems check.
 *   6. Countdown 10 → 1, LIFTOFF! You watch the sky turn black through your
 *      porthole, then see the Moon through the front window.
 *   7. The trip: "3 DAYS LATER", the Moon grows in the front window.
 *   8. Landing, watched from outside: the rocket comes down on its flame and
 *      kicks up dust and the ramp lowers. Then we cut to everyone gathered
 *      outside around Nova and PIP.
 *   9. Our first Forgotten Explorer: we hop over to the Apollo 11 Lunar Module "Eagle"
 *      and Nova tells its story at the landing stage, the ladder and plaque,
 *      the flag and footprints, and the science experiments left behind.
 *  10. Our second Forgotten Explorer: we ride the moon buggy to the foot of the
 *      Apennine Mountains and visit the Apollo 15 Lunar Roving Vehicle, Falcon,
 *      the hammer-and-feather spot, the memorial, and the ALSEP experiments.
 *  11. Back in the rocket to Mars (the day counter races ahead), then four Mars
 *      sites, each landing watched from outside: Spirit at Home Plate, Opportunity
 *      at Endeavour Crater, InSight (built on Phoenix's design) on Elysium Planitia,
 *      and the Ingenuity helicopter in Jezero Crater.
 *  After each Forgotten Explorer, PIP opens the "Ask PIP" chat (chat.js).
 *
 * Dialogue moves on when you click Next (or anywhere / press Space).
 *
 * Everything is built in code (no model files). Exposes:
 *   window.AstroStory.start()  – plays the chapter (rebuilds it fresh every time)
 *   window.AstroStory.stop()   – stops it and frees the 3D resources
 */
(function () {
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

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* The dialogue lives in lines.js (edit it there) */
  const { NAMES, LINES } = window.ASTRO_SCRIPT;

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */

  class Cancelled extends Error {}
  let current = null;

  window.AstroStory = {
    start() {
      this.stop();
      const run = { cancelled: false, cleanup: [] };
      current = run;
      return playStory(run).catch((err) => {
        if (err instanceof Cancelled) return;
        console.error("Astro Adventures story error:", err);
        // If 3D can't run, still let the player get back to the start
        document.getElementById("storyFade").style.opacity = "0";
        document.getElementById("storyEnd").hidden = false;
      });
    },
    stop() {
      if (!current) return;
      current.cancelled = true;
      current.cleanup.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
      current = null;
    },
  };

  /* ------------------------------------------------------------------ */
  /* The chapter                                                         */
  /* ------------------------------------------------------------------ */

  async function playStory(run) {
    const check = () => { if (run.cancelled) throw new Cancelled(); };

    const ui = {
      screen: document.getElementById("storyScreen"),
      fade: document.getElementById("storyFade"),
      dialogue: document.getElementById("dialogue"),
      speaker: document.getElementById("dialogueSpeaker"),
      text: document.getElementById("dialogueText"),
      next: document.getElementById("dialogueNext"),
      end: document.getElementById("storyEnd"),
    };
    // "Play again" starts from the end card, which already covers the screen
    const replay = !ui.end.hidden;
    ui.dialogue.hidden = true;

    // Transition from the welcome screen: the warp keeps running underneath while the
    // screen slowly washes over to Blue Yonder, then we build the launch pad behind it.
    const COVER_SECONDS = reduceMotion ? 0.3 : replay ? 0.6 : 1.6;
    ui.fade.style.transition = "none";
    ui.fade.style.background = "#2E96F5";
    ui.fade.style.opacity = replay ? "1" : "0";
    ui.end.hidden = true;
    void ui.fade.offsetWidth;
    ui.fade.style.transition = `opacity ${COVER_SECONDS}s ease-in`;
    ui.fade.style.opacity = "1";
    const THREE_PROMISE = new Function("u", "return import(u)")(THREE_URL); // (written this way so dev servers like Vite leave this classic script alone)
    await new Promise((resolve) => setTimeout(resolve, COVER_SECONDS * 1000));
    check();
    if (window.astroScene) window.astroScene.pause(); // the welcome screen is hidden now

    const THREE = await THREE_PROMISE;
    check();
    try { await document.fonts.load('900 100px "Fira Sans"'); } catch (e) { /* fallback font is fine */ }
    check();

    /* ---------------- Renderer, scene, camera ---------------- */

    const canvas = document.createElement("canvas");
    canvas.className = "story-canvas";
    canvas.setAttribute("aria-hidden", "true");
    ui.screen.prepend(canvas);
    ui.screen.classList.add("scene-ready");
    run.cleanup.push(() => { canvas.remove(); ui.screen.classList.remove("scene-ready"); });

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      if (run.cancelled) return; // (we closed it ourselves)
      console.warn("Lost No More: the browser stopped the 3D view (graphics memory). Reload the page to continue.");
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    run.cleanup.push(() => { renderer.dispose(); renderer.forceContextLoss(); });

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(new THREE.Color(BRAND.blueYonder).lerp(new THREE.Color(BRAND.white), 0.6), 80, 480);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
    camera.rotation.order = "YXZ";

    function resize() {
      const w = ui.screen.clientWidth || window.innerWidth;
      const h = ui.screen.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Keep the scene framed on tall phone screens
      camera.fov = w / h < 0.8 ? 75 : 60;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);
    run.cleanup.push(() => window.removeEventListener("resize", resize));

    /* ---------------- Helpers ---------------- */

    const TAU = Math.PI * 2;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
    const lerpAngle = (a, b, k) => {
      let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
      return a + d * k;
    };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    function mulberry32(seed) {
      return function () {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const rand = mulberry32(2026);

    const G = {};
    const geo = (key, make) => G[key] || (G[key] = make());
    const matCache = {};
    const std = (color, roughness = 0.5, metalness = 0) => {
      const key = `${color}-${roughness}-${metalness}`;
      return matCache[key] || (matCache[key] = new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    };

    function add(geometry, material, parent, x = 0, y = 0, z = 0) {
      const m = new THREE.Mesh(geometry, material);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    }

    function canvasTexture(w, h, draw) {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      draw(c.getContext("2d"), w, h);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return tex;
    }

    const shadowTex = canvasTexture(128, 128, (ctx) => {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(7,23,63,0.45)");
      g.addColorStop(1, "rgba(7,23,63,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    });
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

    function addShadow(parent, size) {
      const s = add(geo("shadow", () => new THREE.PlaneGeometry(1, 1)), shadowMat, parent, 0, 0.02, 0);
      s.rotation.x = -Math.PI / 2;
      s.scale.set(size, size, 1);
      return s;
    }

    /* ---------------- Lights + reflections ---------------- */

    scene.add(new THREE.HemisphereLight(BRAND.white, BRAND.electricBlue, 1.3));
    const sun = new THREE.DirectionalLight(BRAND.white, 2.4);
    sun.position.set(6, 14, 10);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(BRAND.blueYonder, 1.6);
    rim.position.set(-6, 8, -25);
    scene.add(rim);

    (function environment() {
      const envScene = new THREE.Scene();
      const g = new THREE.SphereGeometry(10, 32, 16);
      const top = new THREE.Color(BRAND.white), mid = new THREE.Color(BRAND.blueYonder), bottom = new THREE.Color(BRAND.deepBlue);
      const colors = [];
      const c = new THREE.Color();
      for (let i = 0; i < g.attributes.position.count; i++) {
        const t = g.attributes.position.getY(i) / 10;
        if (t > 0) c.copy(mid).lerp(top, t); else c.copy(mid).lerp(bottom, -t);
        colors.push(c.r, c.g, c.b);
      }
      g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      envScene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(envScene, 0.04).texture;
      pmrem.dispose();
    })();

    /* ---------------- Sky, stars, ground ---------------- */

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(700, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          // Regular daytime sky (we haven't lifted off yet)
          cHorizon: { value: new THREE.Color(BRAND.blueYonder).lerp(new THREE.Color(BRAND.white), 0.6) },
          cLow: { value: new THREE.Color(BRAND.blueYonder).lerp(new THREE.Color(BRAND.white), 0.25) },
          cMid: { value: new THREE.Color(BRAND.blueYonder) },
          cTop: { value: new THREE.Color(BRAND.blueYonder).lerp(new THREE.Color(BRAND.neonBlue), 0.45) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 cHorizon, cLow, cMid, cTop;
          varying vec3 vDir;
          void main() {
            float h = max(vDir.y, 0.0);
            vec3 col = mix(cHorizon, cLow, smoothstep(0.0, 0.18, h));
            col = mix(col, cMid, smoothstep(0.18, 0.45, h));
            col = mix(col, cTop, smoothstep(0.45, 0.95, h));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      })
    );
    scene.add(sky);

    // Puffy cartoon clouds drifting across the daytime sky
    const clouds = new THREE.Group();
    scene.add(clouds);
    (function makeClouds() {
      const cloudMat = new THREE.MeshStandardMaterial({ color: BRAND.white, emissive: BRAND.white, emissiveIntensity: 0.35, roughness: 1, fog: false });
      const puffGeo = new THREE.SphereGeometry(1, 20, 14);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + rand() * 0.3;
        const r = 170 + rand() * 120;
        const cloud = new THREE.Group();
        cloud.position.set(Math.cos(a) * r, 35 + rand() * 45, Math.sin(a) * r);
        cloud.lookAt(0, cloud.position.y, 0);
        const size = 7 + rand() * 6;
        const puffs = 4 + Math.floor(rand() * 3);
        for (let p = 0; p < puffs; p++) {
          const puff = new THREE.Mesh(puffGeo, cloudMat);
          const t = puffs === 1 ? 0 : p / (puffs - 1) - 0.5;
          puff.position.set(t * size * 2.4, (1 - Math.abs(t) * 2) * size * 0.45, (rand() - 0.5) * size * 0.5);
          puff.scale.setScalar(size * (0.75 + (1 - Math.abs(t) * 2) * 0.45));
          cloud.add(puff);
        }
        cloud.scale.y = 0.75;
        clouds.add(cloud);
      }
    })();

    const ground = add(new THREE.PlaneGeometry(1600, 1600), std(0x8d97a6, 0.95), scene);
    ground.rotation.x = -Math.PI / 2;

    const pad = add(new THREE.CircleGeometry(42, 64), std(0xa9b2bf, 0.9), scene, 0, 0.01, -20);
    pad.rotation.x = -Math.PI / 2;
    const ring = add(new THREE.RingGeometry(10.4, 11, 64), new THREE.MeshBasicMaterial({ color: BRAND.neonBlue }), scene, 0, 0.02, -30);
    ring.rotation.x = -Math.PI / 2;
    const walkway = add(new THREE.PlaneGeometry(2.6, 18), std(0xbcc4cf, 0.9), scene, 0, 0.025, -10.4);
    walkway.rotation.x = -Math.PI / 2;
    [-1.3, 1.3].forEach((x) => {
      const line = add(new THREE.PlaneGeometry(0.08, 18), new THREE.MeshBasicMaterial({ color: BRAND.neonBlue }), scene, x, 0.03, -10.4);
      line.rotation.x = -Math.PI / 2;
    });

    // Distant hills
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU + rand() * 0.2;
      const r = 230 + rand() * 120;
      const hill = add(geo("hill", () => new THREE.SphereGeometry(1, 24, 12, 0, TAU, 0, Math.PI / 2)), std(BRAND.electricBlue, 1), scene, Math.cos(a) * r, 0, Math.sin(a) * r);
      hill.scale.set(40 + rand() * 50, 12 + rand() * 22, 40 + rand() * 40);
    }

    /* ---------------- The rocket ---------------- */

    const ROCKET_Z = -30;
    const R = 3;
    const DOOR = { y: 3.65, z: ROCKET_Z + R + 0.06, w: 1.5, h: 2.5 };
    const RAMP_BOTTOM = V(0, 0.03, -19.2);
    const RAMP_TOP = V(0, 2.4, DOOR.z + 0.05);
    const INSIDE = V(0, 2.4, ROCKET_Z + 1);

    const rocket = new THREE.Group();
    rocket.position.set(0, 0, ROCKET_Z);
    scene.add(rocket);
    rocket.updateMatrixWorld();

    add(new THREE.CylinderGeometry(4.6, 5, 0.6, 48), std(0x9aa3b0, 0.8), rocket, 0, 0.3, 0); // launch stand

    const bodyTex = canvasTexture(1024, 2048, (ctx, w, h) => {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, w, h);
      const band = (y0, y1, color) => { ctx.fillStyle = color; ctx.fillRect(0, (1 - y1 / 24) * h, w, ((y1 - y0) / 24) * h); };
      band(5.6, 6.2, "#0042A6");
      band(21.6, 22.4, "#0042A6");
      band(22.6, 22.9, "#2E96F5");
      // Vertical name on the front (u = 0.5 faces the line of astronauts)
      ctx.fillStyle = "#0042A6";
      ctx.font = '900 92px "Fira Sans", Arial, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      "ASTRO".split("").forEach((ch, i) => ctx.fillText(ch, w / 2, (1 - (19 - i * 2.1) / 24) * h));
    });
    add(new THREE.CylinderGeometry(R, R, 24, 64, 1, true, Math.PI, TAU), new THREE.MeshStandardMaterial({ map: bodyTex, roughness: 0.45, metalness: 0.05 }), rocket, 0, 12.6, 0);

    function ogive(y0, y1, len, segments) {
      const pts = [];
      for (let i = 0; i <= segments; i++) {
        const y = y0 + ((y1 - y0) * i) / segments;
        pts.push(new THREE.Vector2(R * Math.pow(Math.max(0, 1 - Math.pow(y / len, 2)), 0.62), y));
      }
      return new THREE.LatheGeometry(pts, 64);
    }
    add(ogive(0, 5.2, 7.5, 24), std(BRAND.white, 0.45), rocket, 0, 24.6, 0);
    add(ogive(5.2, 7.5, 7.5, 12), std(BRAND.neonBlue, 0.35, 0.2), rocket, 0, 24.6, 0);

    // Fins
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(2.5, -0.4);
    finShape.quadraticCurveTo(2.7, -0.4, 2.6, 0.4);
    finShape.lineTo(0, 5.6);
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.28, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3 });
    finGeo.translate(0, 0, -0.14);
    for (let k = 0; k < 4; k++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = Math.PI / 4 + (k * Math.PI) / 2;
      rocket.add(pivot);
      add(finGeo, std(BRAND.electricBlue, 0.35, 0.15), pivot, R - 0.1, 1.0, 0);
    }

    // Engine bell
    add(new THREE.CylinderGeometry(1.4, 2.1, 1.1, 32, 1, true), std(0x5d6672, 0.4, 0.6), rocket, 0, 0.9, 0);

    // Portholes on the sides
    [-0.7, 0.7].forEach((a) => {
      [7.5, 10.5].forEach((y) => {
        const p = V(Math.sin(a) * (R + 0.02), y, Math.cos(a) * (R + 0.02));
        const glass = add(geo("porthole", () => new THREE.CircleGeometry(0.45, 32)), new THREE.MeshBasicMaterial({ color: BRAND.blueYonder }), rocket, p.x, p.y, p.z);
        glass.lookAt(rocket.localToWorld(p.clone().multiplyScalar(2).setY(y)));
        const rimMesh = add(geo("portRim", () => new THREE.TorusGeometry(0.47, 0.07, 10, 32)), std(0xc4c8cf, 0.35, 0.6), rocket, p.x, p.y, p.z);
        rimMesh.quaternion.copy(glass.quaternion);
      });
    });

    // Glowing open door
    const doorGlowMat = new THREE.MeshBasicMaterial({ color: 0xfff4d6 });
    add(new THREE.PlaneGeometry(DOOR.w, DOOR.h), doorGlowMat, scene, 0, DOOR.y, DOOR.z + 0.02);
    const frameShape = new THREE.Shape();
    const fw = DOOR.w / 2 + 0.16, fh = DOOR.h / 2 + 0.16;
    frameShape.moveTo(-fw, -fh); frameShape.lineTo(fw, -fh); frameShape.lineTo(fw, fh); frameShape.lineTo(-fw, fh); frameShape.lineTo(-fw, -fh);
    const hole = new THREE.Path();
    hole.moveTo(-DOOR.w / 2, -DOOR.h / 2); hole.lineTo(-DOOR.w / 2, DOOR.h / 2); hole.lineTo(DOOR.w / 2, DOOR.h / 2); hole.lineTo(DOOR.w / 2, -DOOR.h / 2); hole.lineTo(-DOOR.w / 2, -DOOR.h / 2);
    frameShape.holes.push(hole);
    add(new THREE.ExtrudeGeometry(frameShape, { depth: 0.12, bevelEnabled: false }), std(BRAND.electricBlue, 0.35, 0.2), scene, 0, DOOR.y, DOOR.z - 0.04);
    const doorLight = new THREE.PointLight(0xfff0c8, 0, 9, 1.5);
    doorLight.position.set(0, DOOR.y, DOOR.z + 1.2);
    scene.add(doorLight);

    // Boarding ramp with railings
    function buildRamp(parent) {
      const dir = new THREE.Vector3().subVectors(RAMP_TOP, RAMP_BOTTOM);
      const len = dir.length();
      const tilt = Math.atan2(RAMP_TOP.y - RAMP_BOTTOM.y, RAMP_BOTTOM.z - RAMP_TOP.z);
      const g = new THREE.Group();
      g.position.copy(RAMP_BOTTOM).addScaledVector(dir, 0.5);
      g.rotation.x = tilt;
      parent.add(g);
      add(new THREE.BoxGeometry(1.9, 0.12, len), std(0xc4c8cf, 0.6, 0.3), g, 0, -0.07, 0);
      [-1, 1].forEach((s) => {
        const rail = add(new THREE.CylinderGeometry(0.04, 0.04, len, 8), std(BRAND.neonBlue, 0.35, 0.3), g, s * 0.95, 0.9, 0);
        rail.rotation.x = Math.PI / 2;
        for (let i = 0; i <= 5; i++) {
          const z = -len / 2 + (i * len) / 5;
          const post = add(geo("post", () => new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8)), std(0xc4c8cf, 0.4, 0.4), g, s * 0.95, 0.45, z);
          post.rotation.x = -tilt; // keep posts vertical
        }
      });
      return g;
    }
    buildRamp(scene);

    // Service tower
    const towerLightMat = new THREE.MeshBasicMaterial({ color: 0xff4d5e });
    (function tower() {
      const t = new THREE.Group();
      t.position.set(-9, 0, ROCKET_Z);
      scene.add(t);
      const colMat = std(0xc9ced6, 0.6, 0.3), beamMat = std(BRAND.neonBlue, 0.45, 0.2);
      const H = 30, S = 3;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => add(geo("col", () => new THREE.BoxGeometry(0.3, H, 0.3)), colMat, t, (a * S) / 2, H / 2, (b * S) / 2));
      for (let y = 3; y <= H; y += 3) {
        add(geo("beamX", () => new THREE.BoxGeometry(S, 0.18, 0.18)), beamMat, t, 0, y, S / 2);
        add(geo("beamX", () => new THREE.BoxGeometry(S, 0.18, 0.18)), beamMat, t, 0, y, -S / 2);
        add(geo("beamZ", () => new THREE.BoxGeometry(0.18, 0.18, S)), beamMat, t, S / 2, y, 0);
        add(geo("beamZ", () => new THREE.BoxGeometry(0.18, 0.18, S)), beamMat, t, -S / 2, y, 0);
        const brace = add(geo("brace", () => new THREE.CylinderGeometry(0.06, 0.06, Math.hypot(S, 3), 6)), colMat, t, 0, y - 1.5, S / 2);
        brace.rotation.z = (y / 3) % 2 ? Math.atan2(S, 3) : -Math.atan2(S, 3);
      }
      // Arm reaching toward the rocket near the top
      add(new THREE.BoxGeometry(4.6, 0.5, 1.2), beamMat, t, S / 2 + 2.3, 22, 0);
      add(new THREE.SphereGeometry(0.3, 16, 10), towerLightMat, t, 0, H + 0.4, 0);
    })();

    // Mission banner over the start of the ramp
    (function banner() {
      const tex = canvasTexture(1024, 220, (ctx, w, h) => {
        ctx.fillStyle = "#0042A6";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#2E96F5";
        ctx.lineWidth = 10;
        ctx.strokeRect(10, 10, w - 20, h - 20);
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = '700 40px "Fira Sans", Arial, sans-serif';
        ctx.fillText("MISSION", w / 2, 62);
        ctx.font = '900 70px "Fira Sans", Arial, sans-serif';
        ctx.fillText("THE FORGOTTEN EXPLORERS", w / 2, 140);
      });
      add(new THREE.PlaneGeometry(4.4, 0.95), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }), scene, 0, 3.65, -18.6);
      [-2.25, 2.25].forEach((x) => add(geo("bannerPole", () => new THREE.CylinderGeometry(0.06, 0.06, 4.2, 10)), std(0xc4c8cf, 0.4, 0.5), scene, x, 2.1, -18.6));
    })();

    /* ---------------- Characters: astronauts ---------------- */

    const M = {
      suit: new THREE.MeshPhysicalMaterial({ color: BRAND.white, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.4, sheen: 0.5, sheenColor: new THREE.Color(BRAND.white), envMapIntensity: 0.6 }),
      pack: std(0xe6e8ec, 0.55),
      gray: std(0xc4c8cf, 0.5),
      boot: std(0xa9afb9, 0.55),
      dark: std(0x2b303b, 0.6),
      gold: std(0xffb627, 0.25, 0.6),
      lining: new THREE.MeshStandardMaterial({ color: BRAND.deepBlue, roughness: 0.8, side: THREE.BackSide }),
      visor: new THREE.MeshPhysicalMaterial({ color: BRAND.blueYonder, roughness: 0.04, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.16, envMapIntensity: 2.2, depthWrite: false }),
      glint: new THREE.MeshBasicMaterial({ color: BRAND.white, transparent: true, opacity: 0.85, depthWrite: false }),
      eye: std(0x15172b, 0.15),
      white: new THREE.MeshBasicMaterial({ color: BRAND.white }),
      cheek: new THREE.MeshBasicMaterial({ color: 0xff8fa8, transparent: true, opacity: 0.5, depthWrite: false }),
      mouth: std(0x8a2f3a, 0.5),
      screen: new THREE.MeshBasicMaterial({ color: BRAND.blueYonder }),
      buttons: [0xff4d5e, 0xffd23f, 0x3ddc84].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.4 })),
    };

    // Helmet window (radians on the helmet sphere)
    const HR = 0.78, HW = 0.8, T0 = Math.PI / 2 - 0.6, T1 = Math.PI / 2 + 0.5;
    const P0 = Math.PI / 2 - HW, P1 = Math.PI / 2 + HW;
    const spherePoint = (r, phi, theta) => V(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)).multiplyScalar(r);

    function buildAstronaut(o) {
      const skin = std(o.skin, 0.65), hair = std(o.hair, 0.55), accent = std(o.accent, 0.35, 0.1), trim = std(o.trim, 0.4);
      // Kids are chibi (big head, short body). Adults get a longer torso, arms and legs,
      // a slimmer build and a smaller head compared to the body.
      const adult = !!o.adult;
      const T = adult ? 0.3 : 0;   // extra torso length
      const A = adult ? 0.14 : 0;  // extra length per arm segment
      const L = adult ? 0.34 : 0;  // extra leg length
      const HEAD = adult ? 0.78 : 1;
      const k = adult ? "A" : "";  // separate cached geometries for adult proportions

      const root = new THREE.Group();
      const model = new THREE.Group();
      const baseY = 1.0 + L; // feet at y = 0
      model.position.y = baseY;
      root.add(model);
      const body = new THREE.Group(); // torso + backpack (slimmer for adults)
      body.scale.set(adult ? 0.9 : 1, 1, adult ? 0.92 : 1);
      model.add(body);

      // Torso, belt, chest panel
      add(geo("torso" + k, () => new THREE.CapsuleGeometry(0.5, 0.35 + T, 8, 24)), M.suit, body, 0, 0.15 + T / 2, 0).scale.set(1, 1, 0.85);
      const belt = add(geo("belt", () => new THREE.TorusGeometry(0.495, 0.06, 10, 40)), trim, body, 0, -0.06, 0);
      belt.rotation.x = Math.PI / 2;
      belt.scale.set(1, 0.85, 1);
      const panel = add(geo("panel", () => new THREE.BoxGeometry(0.34, 0.24, 0.08)), M.gray, body, -0.06, 0.14 + T * 0.55, 0.4);
      add(geo("panelScreen", () => new THREE.PlaneGeometry(0.22, 0.05)), M.screen, panel, 0, 0.05, 0.041);
      M.buttons.forEach((mat, i) => add(geo("btn", () => new THREE.SphereGeometry(0.028, 10, 8)), mat, panel, -0.08 + i * 0.08, -0.04, 0.04));

      // Backpack + tanks
      add(geo("pack" + k, () => new THREE.BoxGeometry(0.8, 0.9 + T, 0.34)), M.pack, body, 0, 0.26 + T / 2, -0.5);
      add(geo("packStripe", () => new THREE.BoxGeometry(0.5, 0.1, 0.02)), accent, body, 0, 0.5 + T, -0.68);
      [-1, 1].forEach((s) => {
        add(geo("tank" + k, () => new THREE.CylinderGeometry(0.09, 0.09, 0.6 + T, 16)), M.gray, body, s * 0.25, 0.3 + T / 2, -0.72);
        add(geo("tankCap", () => new THREE.SphereGeometry(0.09, 12, 8, 0, TAU, 0, Math.PI / 2)), trim, body, s * 0.25, 0.6 + T, -0.72);
      });

      function arm(side) {
        const shoulder = new THREE.Group();
        shoulder.position.set(side * (adult ? 0.47 : 0.52), 0.38 + T, 0);
        model.add(shoulder);
        add(geo("shoulderBall", () => new THREE.SphereGeometry(0.18, 16, 12)), M.suit, shoulder);
        add(geo("upperArm" + k, () => new THREE.CapsuleGeometry(0.145, 0.16 + A, 6, 16)), M.suit, shoulder, 0, -0.18 - A / 2, 0);
        if (o.commander) add(geo("epaulet", () => new THREE.BoxGeometry(0.24, 0.05, 0.3)), M.gold, shoulder, 0, 0.17, 0);
        const elbow = new THREE.Group();
        elbow.position.y = -0.34 - A;
        shoulder.add(elbow);
        add(geo("elbowRing", () => new THREE.TorusGeometry(0.135, 0.042, 8, 24)), accent, elbow).rotation.x = Math.PI / 2;
        add(geo("foreArm" + k, () => new THREE.CapsuleGeometry(0.135, 0.14 + A, 6, 16)), M.suit, elbow, 0, -0.15 - A / 2, 0);
        add(geo("cuff", () => new THREE.TorusGeometry(0.13, 0.05, 8, 24)), trim, elbow, 0, -0.3 - A, 0).rotation.x = Math.PI / 2;
        add(geo("glove", () => new THREE.SphereGeometry(0.16, 16, 12)), M.gray, elbow, 0, -0.42 - A, 0).scale.set(1, 1.05, 0.85);
        return { shoulder, elbow };
      }

      function leg(side) {
        const hip = new THREE.Group();
        hip.position.set(side * (adult ? 0.21 : 0.23), -0.3, 0);
        model.add(hip);
        add(geo("thigh" + k, () => new THREE.CapsuleGeometry(0.18, 0.2 + L, 6, 16)), M.suit, hip, 0, -0.2 - L / 2, 0);
        add(geo("knee", () => new THREE.TorusGeometry(0.175, 0.045, 8, 24)), accent, hip, 0, -0.36 - L * 0.6, 0).rotation.x = Math.PI / 2;
        add(geo("boot", () => new THREE.SphereGeometry(0.22, 16, 12)), M.boot, hip, 0, -0.52 - L, 0.05).scale.set(1, 0.78, 1.25);
        return hip;
      }

      // Helmet (sits on the shoulders; smaller for adults)
      const head = new THREE.Group();
      head.position.y = adult ? 1.06 + T : 1.15;
      head.scale.setScalar(HEAD);
      model.add(head);
      add(geo("shellA", () => new THREE.SphereGeometry(HR, 40, 30, P1, TAU - 2 * HW, 0, Math.PI)), M.suit, head);
      add(geo("shellB", () => new THREE.SphereGeometry(HR, 20, 14, P0, 2 * HW, 0, T0)), M.suit, head);
      add(geo("shellC", () => new THREE.SphereGeometry(HR, 20, 14, P0, 2 * HW, T1, Math.PI - T1)), M.suit, head);
      add(geo("lining", () => new THREE.SphereGeometry(HR * 0.965, 24, 16)), M.lining, head);
      add(geo("visorRim", () => {
        const pts = [];
        const n = 12;
        for (let i = 0; i < n; i++) pts.push(spherePoint(HR * 1.01, P0 + (P1 - P0) * (i / n), T0));
        for (let i = 0; i < n; i++) pts.push(spherePoint(HR * 1.01, P1, T0 + (T1 - T0) * (i / n)));
        for (let i = 0; i < n; i++) pts.push(spherePoint(HR * 1.01, P1 - (P1 - P0) * (i / n), T1));
        for (let i = 0; i < n; i++) pts.push(spherePoint(HR * 1.01, P0, T1 - (T1 - T0) * (i / n)));
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, "centripetal"), 120, 0.045, 8, true);
      }), o.commander ? M.gold : trim, head);
      add(geo("visor", () => new THREE.SphereGeometry(HR * 1.005, 32, 20, P0 - 0.02, 2 * HW + 0.04, T0 - 0.02, T1 - T0 + 0.04)), M.visor, head).renderOrder = 2;
      [[Math.PI / 2 - 0.5, Math.PI / 2 - 0.36, 0.13, 0.045], [Math.PI / 2 - 0.62, Math.PI / 2 - 0.14, 0.04, 0.025]].forEach(([phi, theta, sx, sy]) => {
        const g = add(geo("glint", () => new THREE.CircleGeometry(1, 20)), M.glint, head);
        const p = spherePoint(HR * 1.02, phi, theta);
        g.position.copy(p);
        g.lookAt(p.clone().multiplyScalar(2));
        g.rotateZ(0.7);
        g.scale.set(sx, sy, 1);
        g.renderOrder = 3;
      });
      [-1, 1].forEach((s) => add(geo("ear", () => new THREE.CylinderGeometry(0.15, 0.15, 0.1, 24)), accent, head, s * 0.76, 0.02, 0).rotation.z = Math.PI / 2);
      add(geo("neck", () => new THREE.TorusGeometry(0.47, 0.085, 12, 40)), accent, head, 0, -0.62, 0).rotation.x = Math.PI / 2;

      // Face
      const face = new THREE.Group();
      face.position.set(0, -0.02, 0.06);
      head.add(face);
      const FR = 0.56;
      add(geo("face", () => new THREE.SphereGeometry(FR, 32, 24)), skin, face);
      const placeOnFace = (obj, x, y, out) => {
        const p = V(x, y, Math.sqrt(Math.max(0, FR * FR - x * x - y * y))).normalize().multiplyScalar(FR + out);
        obj.position.copy(p);
        obj.lookAt(p.clone().multiplyScalar(2));
        face.add(obj);
        return obj;
      };
      add(geo("hairCap", () => new THREE.SphereGeometry(FR * 1.045, 28, 14, 0, TAU, 0, 1.3)), hair, face).rotation.x = -0.5;
      const bangs = o.bangs || [-0.22, -0.05, 0.14, 0.28];
      if (o.withBangs) bangs.forEach((x, i) => {
        const b = new THREE.Mesh(geo("bang", () => new THREE.SphereGeometry(0.12, 14, 10)), hair);
        b.scale.set(1.2, 0.75, 0.6);
        placeOnFace(b, x, 0.36 - Math.abs(x) * 0.35 - (i % 2) * 0.02, -0.03);
      });
      const eyeScale = o.commander ? 0.85 : 1;
      const eyes = [-1, 1].map((s) => {
        const eg = new THREE.Group();
        placeOnFace(eg, s * 0.19, 0.03, -0.015);
        const e = add(geo("eye", () => new THREE.SphereGeometry(0.085, 16, 12)), M.eye, eg);
        e.scale.set(eyeScale, 1.3 * eyeScale, 0.55);
        add(geo("eyeHi", () => new THREE.SphereGeometry(0.028, 8, 6)), M.white, eg, -0.025, 0.04, 0.04);
        return eg;
      });
      [-1, 1].forEach((s) => {
        const brow = new THREE.Mesh(geo(o.commander ? "browThick" : "brow", () => new THREE.TorusGeometry(0.06, o.commander ? 0.022 : 0.014, 6, 16, Math.PI * 0.8)), hair);
        placeOnFace(brow, s * 0.19, 0.2, 0);
        brow.rotateZ(Math.PI * 0.1);
      });
      placeOnFace(new THREE.Mesh(geo("nose", () => new THREE.SphereGeometry(0.035, 10, 8)), skin), 0, -0.06, 0.005);
      if (!o.commander) {
        [-1, 1].forEach((s) => {
          const ch = new THREE.Mesh(geo("cheek", () => new THREE.CircleGeometry(0.065, 20)), M.cheek);
          ch.scale.set(1, 0.65, 1);
          placeOnFace(ch, s * 0.31, -0.1, 0.004);
        });
      }
      const smile = new THREE.Mesh(geo("smile", () => new THREE.TorusGeometry(0.085, 0.02, 8, 24, Math.PI)), M.mouth);
      placeOnFace(smile, 0, -0.15, -0.005);
      smile.rotateZ(Math.PI);

      // Commander's gold star badge
      if (o.commander) {
        const star = new THREE.Shape();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 0.045 : 0.11;
          const a = Math.PI / 2 + (i * Math.PI) / 5;
          if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r); else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        const badge = add(new THREE.ExtrudeGeometry(star, { depth: 0.03, bevelEnabled: false }), M.gold, body, 0.27, 0.36 + T * 0.75, 0.36);
        badge.rotation.y = 0.5;
      }

      // Scale so the top of the helmet is exactly `o.height` metres tall
      const modelHeight = baseY + head.position.y + HR * HEAD;
      const scale = o.height / modelHeight;
      root.scale.setScalar(scale);
      addShadow(root, 1.6);
      const headCenterY = baseY + head.position.y;
      // How far to raise the body so the thighs rest on a seat `seatTop` metres high
      const sitBobFor = (seatTop) => seatTop / scale + 0.48 - baseY;

      const armL = arm(-1), armR = arm(1);
      return {
        kind: "astro", root, model, head, eyes, baseY, scale, sitBobFor,
        sitBob: sitBobFor(0.3),
        armL, armR, legL: leg(-1), legR: leg(1),
        // Where the glove is (side -1 = left, 1 = right), for holding things
        hand: (side) => (side < 0 ? armL : armR).elbow.localToWorld(V(0, -0.42 - A, 0.05)),
        mode: o.mode || "idle",
        phase: rand() * 10,
        heading: 0, targetHeading: 0,
        pose: {}, nextBlink: 1 + rand() * 3,
        headPoint: () => root.localToWorld(V(0, headCenterY, 0)),
      };
    }

    /* ---------------- Characters: PIP the robot ---------------- */

    function buildRobot() {
      const shell = new THREE.MeshPhysicalMaterial({ color: BRAND.white, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.9 });
      const blue = std(BRAND.electricBlue, 0.35, 0.2);
      const glowMat = new THREE.MeshBasicMaterial({ color: BRAND.blueYonder });
      const root = new THREE.Group();
      const body = new THREE.Group();
      body.position.y = 0.95;
      root.add(body);

      add(new THREE.SphereGeometry(0.42, 32, 24), shell, body).scale.set(1, 1.05, 0.92);
      add(new THREE.CircleGeometry(0.12, 32), glowMat, body, 0, 0.02, 0.392);
      add(new THREE.TorusGeometry(0.14, 0.022, 8, 32), blue, body, 0, 0.02, 0.39);
      add(new THREE.TorusGeometry(0.3, 0.05, 10, 32), blue, body, 0, -0.36, 0).rotation.x = Math.PI / 2;

      // Hover glow
      const glowTex = canvasTexture(128, 128, (ctx) => {
        const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.3, "rgba(46,150,245,0.9)");
        g.addColorStop(1, "rgba(46,150,245,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
      });
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      glow.position.y = -0.5;
      glow.scale.set(0.55, 0.55, 1);
      body.add(glow);

      // Head with a face screen
      const head = new THREE.Group();
      head.position.y = 0.66;
      body.add(head);
      const headShape = new THREE.Group();
      headShape.scale.set(1.2, 0.88, 1);
      head.add(headShape);
      add(new THREE.SphereGeometry(0.4, 32, 24), shell, headShape);
      add(new THREE.SphereGeometry(0.403, 32, 16, Math.PI / 2 - 0.95, 1.9, Math.PI / 2 - 0.62, 1.2), std(BRAND.deepBlue, 0.2, 0.3), headShape);
      const eyes = [-1, 1].map((s) => {
        const e = add(new THREE.CapsuleGeometry(0.045, 0.06, 4, 12), glowMat, head, s * 0.14, 0.04, 0.37);
        return e;
      });
      const mouth = add(new THREE.TorusGeometry(0.06, 0.013, 8, 20, Math.PI), glowMat, head, 0, -0.09, 0.365);
      mouth.rotation.z = Math.PI;
      [-1, 1].forEach((s) => add(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 20), blue, head, s * 0.48, 0, 0).rotation.z = Math.PI / 2);
      add(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 8), std(0xc4c8cf, 0.4, 0.5), head, 0, 0.45, 0);
      const antennaMat = new THREE.MeshBasicMaterial({ color: 0xff8a3d });
      add(new THREE.SphereGeometry(0.05, 12, 8), antennaMat, head, 0, 0.6, 0);

      const arms = [-1, 1].map((s) => {
        const sh = new THREE.Group();
        sh.position.set(s * 0.44, 0.08, 0);
        body.add(sh);
        add(new THREE.CapsuleGeometry(0.065, 0.16, 4, 12), blue, sh, 0, -0.14, 0);
        add(new THREE.SphereGeometry(0.085, 14, 10), shell, sh, 0, -0.3, 0);
        return sh;
      });

      root.scale.setScalar(0.75);
      addShadow(root, 1.1);

      return {
        kind: "robot", root, body, head, eyes, mouth, glow, antennaMat,
        armL: arms[0], armR: arms[1],
        mode: "idle", phase: 0, heading: 0, targetHeading: 0, spin: 0,
        nextBlink: 2,
        headPoint: () => root.localToWorld(V(0, 1.6, 0)),
      };
    }

    /* ---------------- Character animation ---------------- */

    function animateAstronaut(c, dt, t) {
      const ph = c.phase;
      // Target pose for the current mood
      const p = { bob: 0, sL: -0.3, sR: 0.3, eL: -0.25, eR: 0.25, xL: 0, xR: 0, hipL: 0, hipR: 0, headY: 0, headX: 0, tilt: 0, lean: 0 };
      switch (c.mode) {
        case "idle":
          p.headY = Math.sin(t * 0.6 + ph) * 0.35;
          p.tilt = Math.sin(t * 0.9 + ph) * 0.03;
          p.sL = -0.3 - Math.sin(t * 1.1 + ph) * 0.05;
          p.sR = 0.3 + Math.sin(t * 1.1 + ph) * 0.05;
          break;
        case "excited": // bouncing on their toes and waving
          p.bob = Math.abs(Math.sin(t * 5 + ph)) * 0.12;
          p.sR = 2.5 + Math.sin(t * 9 + ph) * 0.3;
          p.eR = 0.4 + Math.sin(t * 9 + ph + 0.6) * 0.3;
          p.headY = Math.sin(t * 1.3 + ph) * 0.3;
          p.tilt = Math.sin(t * 2 + ph) * 0.05;
          break;
        case "cheer": // jumping with both arms up
          p.bob = Math.abs(Math.sin(t * 6 + ph)) * 0.35;
          p.sL = -2.7 - Math.sin(t * 12 + ph) * 0.15;
          p.sR = 2.7 + Math.sin(t * 12 + ph + 1) * 0.15;
          p.eL = 0; p.eR = 0;
          p.headX = -0.15;
          break;
        case "walk": {
          const w = t * 8 + ph;
          p.hipL = Math.sin(w) * 0.45;
          p.hipR = -Math.sin(w) * 0.45;
          p.xL = -Math.sin(w) * 0.5;
          p.xR = Math.sin(w) * 0.5;
          p.sL = -0.15; p.sR = 0.15;
          p.bob = Math.abs(Math.cos(w)) * 0.06;
          break;
        }
        case "talk":
          p.sR = 0.8 + Math.sin(t * 2.2) * 0.3;
          p.eR = 0.9 + Math.sin(t * 2.2 + 0.5) * 0.3;
          p.xR = -0.6;
          p.sL = -0.35 - Math.sin(t * 1.4) * 0.15;
          p.xL = -0.3;
          p.headX = Math.sin(t * 4.5) * 0.04;
          p.headY = Math.sin(t * 0.9) * 0.12;
          break;
        case "present": // gesturing toward the robot (model +x side, which is on our right when facing us)
          p.sR = 1.3;
          p.eR = 0.2;
          p.xR = -0.4;
          p.headY = 0.5;
          break;
        case "wave": // friendly wave, feet on the ground
          p.sR = 2.4 + Math.sin(t * 7 + ph) * 0.3;
          p.eR = 0.5 + Math.sin(t * 7 + ph + 0.6) * 0.3;
          p.headY = Math.sin(t * 0.8) * 0.15;
          break;
        case "float": { // zero gravity: drifting up out of the seat
          p.bob = c.sitBob + 1.1 + Math.sin(t * 0.9 + ph) * 0.3;
          p.hipL = -0.7 + Math.sin(t * 0.7 + ph) * 0.35;
          p.hipR = -0.4 + Math.sin(t * 0.8 + ph + 1) * 0.35;
          p.sL = -1.7 + Math.sin(t * 1.2 + ph) * 0.4;
          p.sR = 1.7 + Math.sin(t * 1.1 + ph + 2) * 0.4;
          p.eL = -0.4; p.eR = 0.4;
          p.tilt = Math.sin(t * 0.5 + ph) * 0.3;
          p.headY = Math.sin(t * 0.6 + ph) * 0.4;
          break;
        }
        case "bound": { // the Moon lope: push off, float slowly, land softly with bent knees
          const w = t * 3.1 + ph;
          const air = Math.max(0, Math.sin(w));        // in the air for half of each stride
          const ground = Math.max(0, -Math.sin(w));    // squashing down on landing
          const swing = Math.cos(w);
          p.bob = air * 0.2 - ground * 0.05;
          p.hipL = -0.25 - 0.3 * air * swing - 0.25 * ground; // one foot leads while floating
          p.hipR = -0.25 + 0.3 * air * swing - 0.25 * ground;
          p.xL = -0.45; p.xR = -0.45;                   // arms held a little forward, bulky-suit style
          p.sL = -0.4 - air * 0.12; p.sR = 0.4 + air * 0.12;
          p.eL = -0.45; p.eR = 0.45;
          p.lean = 0.14;
          p.headX = -0.04;
          break;
        }
        case "reach": // bending down to pick something up
          p.lean = 0.55;
          p.xL = -0.7; p.xR = -0.7;
          p.sL = -0.15; p.sR = 0.15;
          p.hipL = -0.5; p.hipR = -0.5;
          p.bob = -0.12;
          p.headX = 0.2;
          break;
        case "hold": // holding something out in front with both hands
          p.xL = -1.15; p.xR = -1.15;
          p.sL = -0.12; p.sR = 0.12;
          p.eL = -0.1; p.eR = 0.1;
          p.headX = 0.08;
          break;
        case "moonHop": { // slow, high, low-gravity hops
          const hop = Math.abs(Math.sin(t * 1.7 + ph));
          p.bob = hop * 2.0;
          p.hipL = -0.55 * hop; p.hipR = -0.55 * hop;
          p.sL = -1.0 - hop * 0.9; p.sR = 1.0 + hop * 0.9;
          p.headX = -0.1;
          break;
        }
        case "sit": // seated, hands on lap, looking around a little
        case "sitCheer": { // seated with both arms up
          const cheer = c.mode === "sitCheer";
          p.bob = c.sitBob + (cheer ? Math.abs(Math.sin(t * 6 + ph)) * 0.05 : 0);
          p.hipL = -1.45; p.hipR = -1.45;
          p.xL = cheer ? 0 : -0.75; p.xR = cheer ? 0 : -0.75;
          p.sL = cheer ? -2.6 - Math.sin(t * 10 + ph) * 0.2 : -0.12;
          p.sR = cheer ? 2.6 + Math.sin(t * 10 + ph + 1) * 0.2 : 0.12;
          p.eL = cheer ? 0 : -0.35; p.eR = cheer ? 0 : 0.35;
          p.headY = cheer ? 0 : Math.sin(t * 0.5 + ph) * 0.3;
          p.headX = cheer ? -0.12 : 0;
          break;
        }
      }
      const pose = c.pose;
      const k = 1 - Math.exp(-dt * 10);
      for (const key in p) pose[key] = pose[key] === undefined ? p[key] : pose[key] + (p[key] - pose[key]) * k;

      c.model.position.y = c.baseY + pose.bob;
      c.model.rotation.z = pose.tilt;
      c.model.rotation.x = pose.lean;
      c.armL.shoulder.rotation.set(pose.xL, 0, pose.sL);
      c.armR.shoulder.rotation.set(pose.xR, 0, pose.sR);
      c.armL.elbow.rotation.z = pose.eL;
      c.armR.elbow.rotation.z = pose.eR;
      c.legL.rotation.x = pose.hipL;
      c.legR.rotation.x = pose.hipR;
      c.head.rotation.set(pose.headX, pose.headY, 0);

      blink(c, t);
      c.heading = lerpAngle(c.heading, c.targetHeading, 1 - Math.exp(-dt * 6));
      c.root.rotation.y = c.heading;
    }

    function animateRobot(c, dt, t) {
      const talking = c.mode === "talk";
      const excited = c.mode === "excited";
      const thinking = c.mode === "think";    // radioing a Forgotten Explorer: head tilts, antenna flashes fast
      const listening = c.mode === "listen";  // waiting for a question: head tilted, leaning in
      c.body.position.y = 0.95 + Math.sin(t * 2.2) * 0.07 + (excited ? Math.abs(Math.sin(t * 6)) * 0.2 : 0);
      c.body.rotation.z = Math.sin(t * 1.3) * 0.05;
      c.head.rotation.y = Math.sin(t * 0.7) * (talking ? 0.12 : 0.25);
      c.head.rotation.x = talking ? Math.sin(t * 5) * 0.05 : listening ? 0.08 : 0;
      c.head.rotation.z = thinking ? Math.sin(t * 2.4) * 0.22 : listening ? 0.18 : 0;
      const armTarget = excited ? 2.4 : talking ? 0.9 + Math.sin(t * 3) * 0.4 : 0.25 + Math.sin(t * 1.5) * 0.08;
      c.armL.rotation.z = -(excited ? 2.4 + Math.sin(t * 10) * 0.2 : talking ? 0.4 + Math.sin(t * 3 + 1) * 0.2 : armTarget);
      c.armR.rotation.z = excited ? 2.4 + Math.sin(t * 10 + 1) * 0.2 : thinking ? 2.0 + Math.sin(t * 6) * 0.15 : armTarget; // hand to its antenna
      c.mouth.scale.set(talking ? 1 + Math.abs(Math.sin(t * 14)) * 0.7 : 1, talking ? 1 + Math.abs(Math.sin(t * 11)) * 0.9 : 1, 1);
      c.glow.material.opacity = 0.75 + Math.sin(t * 8) * 0.2;
      c.antennaMat.color.setHex(Math.sin(t * (thinking ? 18 : 4)) > 0 ? (thinking ? 0x2e96f5 : 0xff8a3d) : 0xffd23f);
      blink(c, t);
      c.heading = lerpAngle(c.heading, c.targetHeading, 1 - Math.exp(-dt * 6));
      c.root.rotation.y = c.heading + c.spin;
    }

    function blink(c, t) {
      if (t > c.nextBlink) {
        const b = (t - c.nextBlink) / 0.16;
        const sy = b < 1 ? Math.max(0.1, Math.abs(1 - b * 2)) : 1;
        c.eyes.forEach((e) => { e.scale.y = c.kind === "robot" ? sy : sy * (e.userData.baseY || 1); });
        if (b >= 1) c.nextBlink = t + 2.5 + Math.random() * 3;
      }
    }

    /* ---------------- Cast ---------------- */

    const SKINS = [0xf6d3b3, 0xe8b48a, 0xc68642, 0x8d5524, 0xf1c27d, 0x6b4226];
    const HAIRS = [0x3b2417, 0x1d1a1a, 0x8a4b2a, 0xd9a441, 0x5a3a22, 0xb5523b];
    const ACCENTS = [BRAND.blueYonder, BRAND.neonBlue, BRAND.electricBlue, 0xff8a3d, 0x3ddc84, 0xb36bff];
    const TRIMS = [0xff8a3d, 0xffb627, BRAND.blueYonder];
    const BANGS = [[-0.22, -0.05, 0.14, 0.28], [-0.25, 0.0, 0.25], [-0.15, 0.1], [-0.28, -0.1, 0.08, 0.24, 0.32]];
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];

    const characters = [];
    function kid(x, z, heading, mode) {
      const c = buildAstronaut({
        skin: pick(SKINS), hair: pick(HAIRS), accent: pick(ACCENTS), trim: pick(TRIMS), bangs: pick(BANGS),
        height: 1.05 + rand() * 0.15, mode,
      });
      c.root.position.set(x, 0, z);
      c.heading = c.targetHeading = heading;
      scene.add(c.root);
      characters.push(c);
      return c;
    }

    const EYE = 1.05;
    const facing = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

    // Two side-by-side rows facing the rocket. We stand in the middle of the SECOND row,
    // so looking left and right shows astronauts in both rows. The front row is shifted
    // half a space sideways, leaving a gap right in front of us to see Nova and PIP through.
    const FRONT_Z = -13, BACK_Z = -11.5, GAP = 1.4;
    const ME = V(0, EYE, BACK_Z);
    const jitter = () => (rand() - 0.5) * 0.15;
    const frontRow = [-2, -1, 0, 1].map((slot, i) =>
      kid((slot + 0.5) * GAP + jitter(), FRONT_Z + jitter(), Math.PI, i % 3 === 0 ? "cheer" : "excited"));
    const backRow = [1].map((slot, i) =>
      kid(slot * GAP + jitter(), BACK_Z + jitter(), Math.PI, i % 2 ? "excited" : "cheer"));
    const everyone = [...frontRow, ...backRow];

    // Nova (an adult, much taller than the kids) + PIP start hidden inside the rocket
    const commander = buildAstronaut({ skin: 0x8d5524, hair: 0x1d1a1a, accent: BRAND.electricBlue, trim: 0xffb627, commander: true, adult: true, height: 2.05, bangs: [-0.2, 0.05, 0.25] });
    commander.root.position.copy(INSIDE);
    commander.root.visible = false;
    scene.add(commander.root);
    characters.push(commander);

    const pip = buildRobot();
    pip.root.position.copy(INSIDE);
    pip.root.visible = false;
    scene.add(pip.root);
    characters.push(pip);

    /* ---------------- Frame loop, tweens, camera ---------------- */

    const updaters = new Set();
    const clock = new THREE.Clock();
    let raf = 0;

    const cam = { pos: ME.clone(), yaw: 0, pitch: 0.1, follow: null, walking: false, bob: 0, shake: 0, hop: false, floatY: 0 };
    if (window.ASTRO_DEBUG) window.__astro = { cam, characters, renderer, get activeScene() { return activeScene; } };
    let activeScene = scene;     // switches to the rocket cabin later
    const frameHooks = [];       // extra per-frame work for the current scene

    function frame() {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05) * (window.ASTRO_DEBUG && window.ASTRO_SPEED ? window.ASTRO_SPEED : 1); // (tests can fast-forward)
      const t = clock.elapsedTime;

      for (const u of [...updaters]) {
        try { if (u(dt, t)) updaters.delete(u); }
        catch (err) { updaters.delete(u); console.warn("Lost No More: an animation step failed and was skipped", err); }
      }
      for (const c of characters) {
        if (!c.root.visible) continue;
        if (c.kind === "robot") animateRobot(c, dt, t); else animateAstronaut(c, dt, t);
      }

      // Camera: follow a target smoothly if asked, plus gentle breathing / walking bob
      if (cam.follow) {
        const p = cam.follow();
        const dx = p.x - cam.pos.x, dy = p.y - cam.pos.y, dz = p.z - cam.pos.z;
        const k = 1 - Math.exp(-dt * 4);
        cam.yaw = lerpAngle(cam.yaw, Math.atan2(-dx, -dz), k);
        cam.pitch += (Math.atan2(dy, Math.hypot(dx, dz)) - cam.pitch) * k;
      }
      const stepBob = cam.hop ? Math.max(0, Math.sin(t * 3.1)) * 0.11 - Math.max(0, -Math.sin(t * 3.1)) * 0.03 : Math.sin(t * 9) * 0.035; // the Moon lope: float, land
      cam.bob += ((cam.walking ? stepBob : 0) - cam.bob) * Math.min(1, dt * 12);
      camera.position.copy(cam.pos);
      camera.position.y += cam.bob + (cam.floatY ? cam.floatY + Math.sin(t * 0.9) * 0.05 : 0);
      camera.rotation.set(cam.pitch + Math.sin(t * 0.8) * 0.004, cam.yaw + Math.sin(t * 0.5) * 0.004, cam.floatY ? Math.sin(t * 0.6) * 0.12 * cam.floatY : 0);
      if (cam.shake > 0) { // rocket rumble
        camera.position.x += (Math.random() - 0.5) * cam.shake;
        camera.position.y += (Math.random() - 0.5) * cam.shake;
        camera.rotation.z += (Math.random() - 0.5) * cam.shake * 0.6;
      }

      clouds.rotation.y = t * 0.004;
      doorLight.intensity = 6 + Math.sin(t * 2) * 1;
      towerLightMat.color.setHex(Math.sin(t * 3) > 0 ? 0xff4d5e : 0x5a1a22);
      for (const hook of frameHooks) hook(dt, t);

      // Personal space: anyone standing or walking who gets too close is nudged aside,
      // so we never walk through another astronaut (or PIP). Seated people are left alone.
      for (const c of characters) {
        if (!c.root.visible || c.mode === "sit" || c.mode === "sitCheer" || c.root.parent !== activeScene) continue;
        const dx = c.root.position.x - cam.pos.x, dz = c.root.position.z - cam.pos.z;
        const d = Math.hypot(dx, dz);
        const MIN = 0.95;
        if (d < MIN && Math.abs(c.root.position.y - (cam.pos.y - EYE)) < 1.5) {
          const push = d > 1e-4 ? (MIN - d) / d : 0;
          if (push) { c.root.position.x += dx * push; c.root.position.z += dz * push; }
          else c.root.position.x += MIN;
        }
      }

      // ...and standing characters keep a little space between each other too
      const standing = characters.filter((c) => c.root.visible && c.mode !== "sit" && c.mode !== "sitCheer" && c.root.parent === activeScene);
      for (let i = 0; i < standing.length; i++) {
        for (let j = i + 1; j < standing.length; j++) {
          const a = standing[i].root.position, b = standing[j].root.position;
          const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
          const MIN = standing[i] === commander || standing[j] === commander ? 1.0 : 0.8;
          if (d < MIN && d > 1e-4) {
            const push = (MIN - d) / d / 2;
            a.x -= dx * push; a.z -= dz * push;
            b.x += dx * push; b.z += dz * push;
          }
        }
      }

      keepOutOfSolids();
      renderer.render(activeScene, camera);
      if (photoWanted) { // a snapshot for the scrapbook (taken right after drawing)
        const p = photoWanted;
        photoWanted = null;
        try { photos[p.key] = canvas.toDataURL("image/jpeg", 0.85); } catch (e) { /* ignore */ }
        p.done();
      }
    }
    // Free a place we've left behind (keeping anything that travels on with us)
    function disposeScene(sc, keep = []) {
      keep.forEach((o) => { if (o && o.parent && isInside(o, sc)) o.parent.remove(o); });
      for (const c of characters) if (c.root.parent && c.root.parent !== activeScene && isInside(c.root, sc)) c.root.parent.remove(c.root);
      sc.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => { for (const key in m) { const v = m[key]; if (v && v.isTexture) v.dispose(); } m.dispose(); });
      });
      sc.clear();
    }
    const isInside = (obj, sc) => { let p = obj.parent; while (p) { if (p === sc) return true; p = p.parent; } return false; };

    // Things people can't walk through: circles on the ground, per scene
    const obstacles = [];
    const solid = (sc, p, r) => obstacles.push({ sc, x: p.x, z: p.z, r });
    function keepOutOfSolids() {
      for (const c of characters) {
        if (!c.root.visible || c.mode === "sit" || c.mode === "sitCheer" || c.root.parent !== activeScene) continue;
        const p = c.root.position;
        for (const o of obstacles) {
          if (o.sc !== activeScene) continue;
          const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), r = o.r + 0.35;
          if (d < r) {
            if (d < 1e-4) { p.x += r; continue; }
            p.x = o.x + (dx / d) * r;
            p.z = o.z + (dz / d) * r;
          }
        }
      }
    }
    // Scrapbook photos of each Forgotten Explorer, taken when we find it
    const photos = {};
    let photoWanted = null;
    const snapPhoto = (key) => new Promise((done) => { photoWanted = { key, done }; });
    raf = requestAnimationFrame(frame);
    run.cleanup.push(() => cancelAnimationFrame(raf));

    // A tween runs `fn(k)` with k going 0→1 over `seconds`, on the scene clock
    function tween(seconds, fn) {
      check();
      return new Promise((resolve) => {
        let tt = 0;
        const dur = reduceMotion ? Math.min(seconds, 0.3) : seconds;
        updaters.add((dt) => {
          if (run.cancelled) return true;
          tt += dt;
          const k = clamp(tt / Math.max(dur, 0.0001), 0, 1);
          fn(k);
          if (k >= 1) { resolve(); return true; }
          return false;
        });
      });
    }
    const wait = (s) => tween(s, () => {});

    function lookTo(yaw, pitch, seconds) {
      cam.follow = null;
      const y0 = cam.yaw, p0 = cam.pitch;
      return tween(seconds, (k) => {
        const e = ease(k);
        cam.yaw = y0 + (yaw - y0) * e;
        cam.pitch = p0 + (pitch - p0) * e;
      }).then(check);
    }

    function lookAtPoint(p, seconds) {
      const dx = p.x - cam.pos.x, dy = p.y - cam.pos.y, dz = p.z - cam.pos.z;
      let yaw = Math.atan2(-dx, -dz);
      while (yaw - cam.yaw > Math.PI) yaw -= TAU;
      while (yaw - cam.yaw < -Math.PI) yaw += TAU;
      return lookTo(yaw, Math.atan2(dy, Math.hypot(dx, dz)), seconds);
    }

    // Move a character along waypoints at `speed` m/s
    function walkTo(c, points, speed, opts = {}) {
      check();
      c.mode = c.kind === "robot" ? "idle" : cam.hop ? "bound" : "walk"; // on the Moon everyone hops
      const id = (c.walkId = (c.walkId || 0) + 1); // a newer walk (or a scene change) cancels this one
      return new Promise((resolve) => {
        let i = 0, best = Infinity, stuck = 0, total = 0;
        const tmp = new THREE.Vector3();
        updaters.add((dt) => {
          if (run.cancelled) return true;
          if (c.walkId !== id) { resolve(); return true; } // replaced by a newer walk: never leave anyone waiting
          // Blocked? (pushed back every frame, so no longer getting closer) → move on to the next point
          total += dt;
          if (i < points.length) {
            const dNow = Math.hypot(points[i].x - c.root.position.x, points[i].z - c.root.position.z);
            if (dNow < best - 0.01) { best = dNow; stuck = 0; } else stuck += dt;
            if (stuck > 0.6 || total > 60) { i = stuck > 0.6 ? i + 1 : points.length; best = Infinity; stuck = 0; }
          }
          let step = speed * dt;
          while (step > 0 && i < points.length) {
            tmp.copy(points[i]).sub(c.root.position);
            const d = tmp.length();
            if (d <= step) { c.root.position.copy(points[i]); step -= d; i++; best = Infinity; stuck = 0; }
            else { c.root.position.addScaledVector(tmp, step / d); step = 0; }
          }
          if (i < points.length) {
            const tx = points[i].x - c.root.position.x, tz = points[i].z - c.root.position.z;
            if (tx * tx + tz * tz > 1e-4) c.targetHeading = Math.atan2(tx, tz);
          }
          if (opts.vanishZ !== undefined && c.root.position.z < opts.vanishZ) c.root.visible = false;
          if (i >= points.length) {
            c.mode = opts.endMode || "idle";
            if (opts.face) c.targetHeading = facing(c.root.position, opts.face);
            if (opts.heading !== undefined) c.targetHeading = opts.heading;
            resolve();
            return true;
          }
          return false;
        });
      });
    }

    // Move the camera (us) along waypoints
    function walkCamera(points, speed) {
      cam.walking = true;
      const tmp = new THREE.Vector3();
      let i = 0;
      return new Promise((resolve) => {
        updaters.add((dt) => {
          if (run.cancelled) return true;
          let step = speed * dt;
          while (step > 0 && i < points.length) {
            tmp.copy(points[i]).sub(cam.pos);
            const d = tmp.length();
            if (d <= step) { cam.pos.copy(points[i]); step -= d; i++; }
            else { cam.pos.addScaledVector(tmp, step / d); step = 0; }
          }
          if (i >= points.length) { cam.walking = false; resolve(); return true; }
          return false;
        });
      });
    }

    /* ---------------- Fades + dialogue box ---------------- */

    function fadeTo(opacity, seconds, color) {
      if (color) ui.fade.style.background = color;
      ui.fade.style.transition = `opacity ${reduceMotion ? 0.2 : seconds}s ease`;
      void ui.fade.offsetWidth;
      ui.fade.style.opacity = String(opacity);
      return wait(seconds);
    }

    let advance = null;
    function onAdvance(e) {
      if (!advance || ui.dialogue.hidden) return;
      if (e.type === "keydown") {
        if (e.key !== " " && e.key !== "Enter") return;
        if (e.target.closest && e.target.closest("button")) return; // the button handles its own keys
        e.preventDefault();
      }
      if (e.type === "click" && e.target.closest && e.target.closest("button") && e.target !== ui.next) return;
      advance();
    }
    ui.screen.addEventListener("click", onAdvance);
    window.addEventListener("keydown", onAdvance);
    run.cleanup.push(() => {
      window.AstroVoice?.stop();
      ui.screen.removeEventListener("click", onAdvance);
      window.removeEventListener("keydown", onAdvance);
      ui.dialogue.hidden = true;
      advance = null;
    });

    function say(who, text) {
      window.AstroVoice?.speak(who, text);
      check();
      const role = who === NAMES.you ? "you" : who === NAMES.robot ? "robot" : "commander";
      ui.dialogue.hidden = false;
      ui.dialogue.dataset.role = role;
      ui.speaker.textContent = role === "you" ? `${who} (thinking)` : who;
      ui.text.textContent = "";

      return new Promise((resolve) => {
        let shown = 0;
        let typing = !reduceMotion && !window.AstroVoice;;
        let finished = false;
        if (!typing) ui.text.textContent = text;
        const typer = typing ? setInterval(() => {
          shown = Math.min(text.length, shown + 1);
          ui.text.textContent = text.slice(0, shown);
          if (shown >= text.length) { clearInterval(typer); typing = false; }
        }, 28) : 0;
        run.cleanup.push(() => clearInterval(typer));

        if (window.AstroAudio && role === "robot") window.AstroAudio.sfx("chirp");

        // Click Next (or anywhere / Space / Enter): the first click finishes the typing, the next one moves on
        advance = () => {
          if (typing) {
            clearInterval(typer);
            typing = false;
            ui.text.textContent = text;
            return;
          }
          if (finished) return;
          finished = true;
          advance = null;
          window.AstroVoice?.stop();
          resolve();
        };
      }).then(check);
    }

    // "Ask PIP": the chat opens beside PIP; PIP's pose follows the chat (listening → radioing → answering)
    async function askPip(explorerId) {
      if (!window.AstroChat) return;
      pip.targetHeading = facing(pip.root.position, cam.pos);
      await lookAtPoint(pip.headPoint(), 0.8);
      const poses = { listening: "listen", thinking: "think", speaking: "talk", oops: "idle" };
      ui.screen.classList.add("chat-open");
      const closeChat = () => { window.AstroChat.close(); ui.screen.classList.remove("chat-open"); };
      run.cleanup.push(closeChat);
      await window.AstroChat.open({
        explorerId,
        onState: (state) => {
          pip.mode = poses[state] || "idle";
          if (state === "thinking" && window.AstroAudio) window.AstroAudio.sfx("blips");
        },
      });
      ui.screen.classList.remove("chat-open");
      check();
      pip.mode = "idle";
    }

    function openScrapbook() {
      const el = {
        root: document.getElementById("scrapbook"),
        spread: document.getElementById("bookSpread"),
        prev: document.getElementById("bookPrev"),
        next: document.getElementById("bookNext"),
        count: document.getElementById("bookCount"),
      };
      const entries = LINES.scrapbook;
      const total = entries.length + 2; // cover + explorers + last page
      let page = 0;
      const make = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
      const photoOf = (key) => {
        const img = make("img", "book-photo");
        img.alt = key;
        if (photos[key]) img.src = photos[key];
        return img;
      };
      function render() {
        el.spread.textContent = "";
        if (page === 0 || page === total - 1) {
          const cover = make("div", "book-cover");
          if (page === 0) {
            cover.append(make("p", "book-kicker", "LOST NO MORE: A VOYAGE BEYOND"), make("h3", "book-title", "My Forgotten Explorers"), make("p", "book-where", "A scrapbook of everything we found on the Moon and Mars"));
          } else {
            cover.append(make("p", "book-kicker", "MISSION COMPLETE"), make("h3", "book-title", "6 Forgotten Explorers found!"));
            const thumbs = make("div", "book-thumbs");
            entries.forEach((e) => { const img = make("img"); img.alt = e.title; if (photos[e.key]) img.src = photos[e.key]; thumbs.appendChild(img); });
            cover.appendChild(thumbs);
          }
          el.spread.appendChild(cover);
        } else {
          const e = entries[page - 1];
          const left = make("div", "book-left");
          left.append(make("div", "book-tape"), photoOf(e.key));
          const right = make("div", "book-right");
          right.append(make("p", "book-kicker", "FORGOTTEN EXPLORER #" + page), make("h3", "book-title", e.title), make("p", "book-where", e.where + (foundOnDay[e.key] ? "  ·  Found on mission day " + foundOnDay[e.key] : "")));
          const ul = make("ul", "book-facts");
          e.facts.forEach((f) => ul.appendChild(make("li", "", f)));
          right.appendChild(ul);
          el.spread.append(left, right);
        }
        el.spread.classList.remove("turn");
        void el.spread.offsetWidth;
        el.spread.classList.add("turn");
        el.count.textContent = (page + 1) + " / " + total;
        el.prev.disabled = page === 0;
        el.next.innerHTML = page === total - 1 ? "Close the book" : 'Next page <span aria-hidden="true">&#9656;</span>';
      }
      return new Promise((resolve) => {
        const onNext = () => {
          if (page === total - 1) { finish(); return; }
          page++;
          if (window.AstroAudio) window.AstroAudio.sfx("whoosh");
          render();
        };
        const onPrev = () => { if (page > 0) { page--; render(); } };
        const stopClicks = (e) => e.stopPropagation();
        function finish() {
          el.next.removeEventListener("click", onNext);
          el.prev.removeEventListener("click", onPrev);
          el.root.removeEventListener("click", stopClicks);
          el.root.hidden = true;
          resolve();
        }
        el.next.addEventListener("click", onNext);
        el.prev.addEventListener("click", onPrev);
        el.root.addEventListener("click", stopClicks);
        run.cleanup.push(() => { el.root.hidden = true; el.next.removeEventListener("click", onNext); el.prev.removeEventListener("click", onPrev); });
        el.root.hidden = false;
        render();
        el.next.focus({ preventScroll: true });
      }).then(check);
    }

    function hideDialogue() {
      ui.dialogue.hidden = true;
    }

    // Big centered text: countdown numbers, "LIFTOFF!", "DAY 1"…
    const bigEl = document.getElementById("countdown");
    function showBig(text, variant = "") {
      bigEl.hidden = false;
      bigEl.className = "countdown";
      if (variant) bigEl.classList.add(variant);
      bigEl.textContent = text;
      void bigEl.offsetWidth; // restart the pop animation
      bigEl.classList.add("pop");
    }
    function hideBig() {
      bigEl.hidden = true;
    }

    // Mission day counter (top middle), with what we found that day
    const dayEl = document.getElementById("dayCounter");
    const dayNum = dayEl.querySelector(".day-num");
    const dayFound = dayEl.querySelector(".day-found");
    const repop = (el) => { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); };
    function setDay(n) {
      dayEl.hidden = false;
      dayNum.textContent = String(n);
      dayFound.textContent = "";
      dayFound.hidden = true;
      repop(dayEl);
    }
    const foundOnDay = {};
    function foundToday(name) {
      foundOnDay[name] = Number(dayNum.textContent);
      snapPhoto(name);
      dayFound.textContent = "Found: " + name;
      dayFound.hidden = false;
      repop(dayFound);
    }
    const dayLoc = dayEl.querySelector(".day-loc");
    function setLocation(text) {
      dayLoc.textContent = text;
      repop(dayLoc);
    }
    run.cleanup.push(() => { dayEl.hidden = true; });
    setDay(1);
    setLocation("Earth · Launch pad");
    run.cleanup.push(hideBig);
    run.cleanup.push(() => { if (window.AstroAudio) { window.AstroAudio.rumble(0, 0.3); } });

    const setMode = (list, mode) => list.forEach((c) => { c.mode = mode; });

    /* ================================================================== */
    /* THE STORY                                                           */
    /* ================================================================== */

    // 1. Walk up to our spot in the middle of the second row
    cam.pos.set(0, EYE, BACK_Z + 6);
    cam.pitch = 0.06;
    camera.position.copy(cam.pos);
    renderer.render(scene, camera);
    await Promise.all([fadeTo(0, 2.2), walkCamera([ME.clone()], 1.4)]);
    await wait(0.3);

    // 2. Nova and PIP come out of the rocket; everyone calms down to watch
    setMode(everyone, "idle");
    await lookAtPoint(V(0, DOOR.y, DOOR.z), 1.2);

    // Just past the front row, framed by the gap in front of us
    const CMD_SPOT = V(-0.9, 0, -16.6);
    const BOT_SPOT = V(0.9, 0, -16.6);
    commander.root.visible = true;
    if (window.AstroAudio) window.AstroAudio.sfx("chime"); // the rocket door opens
    commander.root.position.copy(RAMP_TOP).setZ(RAMP_TOP.z - 0.6);
    pip.root.position.copy(commander.root.position);
    cam.follow = () => commander.headPoint();
    const arrive = Promise.all([
      walkTo(commander, [RAMP_TOP, RAMP_BOTTOM, CMD_SPOT], 1.9, { face: ME }),
      (async () => {
        await wait(0.9);
        pip.root.visible = true;
        await walkTo(pip, [RAMP_TOP, RAMP_BOTTOM, BOT_SPOT], 1.9, { face: ME });
      })(),
    ]);
    await arrive;

    // 3. Nova introduces the mission
    await lookAtPoint(commander.headPoint(), 0.9);
    commander.mode = "talk";
    for (let i = 0; i < LINES.commander.length - 1; i++) await say(NAMES.commander, LINES.commander[i]);
    commander.mode = "present";
    await say(NAMES.commander, LINES.commander[LINES.commander.length - 1]);
    hideDialogue();

    // 4. PIP introduces itself (with a happy spin)
    pip.mode = "excited";
    const spinStart = pip.spin;
    const turnToBot = lookAtPoint(pip.headPoint(), 1.0);
    await tween(1.0, (k) => { pip.spin = spinStart + ease(k) * TAU; });
    await turnToBot;
    pip.spin = 0;
    pip.mode = "talk";
    commander.mode = "idle";
    commander.targetHeading = facing(commander.root.position, pip.root.position);
    for (const line of LINES.robot) await say(NAMES.robot, line);
    pip.mode = "idle";
    hideDialogue();

    // 5. Time to board! Everyone follows Nova into the rocket, and so do we
    commander.targetHeading = facing(commander.root.position, ME);
    await lookAtPoint(commander.headPoint(), 0.9);
    commander.mode = "talk";
    await say(NAMES.commander, LINES.board);
    hideDialogue();
    setMode(everyone, "idle"); // everyone waits calmly for their turn

    const vanishZ = DOOR.z - 0.15;
    const FUNNEL = V(0, 0, -17.6); // where the rows merge into one line at the ramp
    const SPEED = 1.8;
    cam.follow = () => commander.headPoint();
    walkTo(commander, [RAMP_BOTTOM, RAMP_TOP, INSIDE], 1.6, { vanishZ }).catch(() => {});
    (async () => { await wait(0.5); await walkTo(pip, [V(0.6, 0, -18.8), RAMP_BOTTOM, RAMP_TOP, INSIDE], 1.6, { vanishZ }); })().catch(() => {});

    // Boarding order: the two front-row kids just ahead of us go first, then us (3rd),
    // then the rest of the front row, then the rest of our row, middle outwards.
    const byMiddle = (a, b) => Math.abs(a.root.position.x) - Math.abs(b.root.position.x);
    const front = frontRow.slice().sort(byMiddle);
    const order = [front[0], front[1], "me", ...front.slice(2), ...backRow.slice().sort(byMiddle)];
    const START = 1.8, STEP = 0.9;
    let ourTurn = null;
    order.forEach((who, i) => {
      if (who === "me") { ourTurn = START + i * STEP; return; }
      (async () => {
        await wait(START + i * STEP);
        if (activeScene !== scene) return; // we're already inside the rocket
        const x = who.root.position.x;
        await walkTo(who, [V(x * 0.35, 0, FUNNEL.z + 1), FUNNEL, RAMP_BOTTOM, RAMP_TOP, INSIDE], SPEED, { vanishZ });
      })().catch(() => {});
    });

    // Our walk: straight ahead, up the ramp and through the glowing door
    await wait(ourTurn);
    cam.follow = () => V(0, DOOR.y, DOOR.z);
    const path = [V(0, EYE, FUNNEL.z), V(0, EYE + 0.03, RAMP_BOTTOM.z), V(0, RAMP_TOP.y + EYE, RAMP_TOP.z + 0.4)];
    const pathLength = path.reduce((sum, p, i) => sum + p.distanceTo(i ? path[i - 1] : cam.pos), 0);
    await Promise.all([
      walkCamera(path, SPEED),
      (async () => {
        await wait(Math.max(0, (pathLength - 2.2) / SPEED));
        await fadeTo(1, 1.2, "#FFFFFF");
      })(),
    ]);

    /* ================================================================== */
    /* INSIDE THE ROCKET                                                   */
    /* ================================================================== */

    // Behind the white flash: stop everyone outside and build the crew cabin
    for (const c of characters) { c.walkId = (c.walkId || 0) + 1; c.root.visible = false; }
    cam.walking = false;

    const cabin = new THREE.Scene();
    cabin.background = new THREE.Color(BRAND.deepBlue);
    cabin.environment = scene.environment;
    const CR = 3.8, CH = 3.2; // cabin radius + height (metres)

    /* ---- Lights ---- */
    cabin.add(new THREE.HemisphereLight(BRAND.white, BRAND.blueYonder, 0.9));
    const cabinKey = new THREE.DirectionalLight(BRAND.white, 0.9);
    cabinKey.position.set(1.5, 4, 3);
    cabin.add(cabinKey);
    const ceilingLight = new THREE.PointLight(BRAND.white, 4, 12, 1);
    ceilingLight.position.set(0, 2.9, 0);
    cabin.add(ceilingLight);
    const engineLight = new THREE.PointLight(0xff8a3d, 0, 10, 1); // flickers during liftoff
    engineLight.position.set(0, 1.2, -3.0);
    cabin.add(engineLight);

    /* ---- Walls, floor, ceiling ---- */
    const wallTex = canvasTexture(1024, 512, (ctx, w, h) => {
      ctx.fillStyle = "#EEF1F6";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#C9D0DC";
      ctx.lineWidth = 4;
      for (let x = 0; x <= w; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      [110, 400].forEach((y) => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); });
      ctx.fillStyle = "#0960E1";
      ctx.fillRect(0, 300, w, 22);
      ctx.fillStyle = "#2E96F5";
      ctx.fillRect(0, 330, w, 6);
      ctx.fillStyle = "#B7BFCC";
      for (let x = 16; x < w; x += 32) {
        ctx.beginPath(); ctx.arc(x, 122, 3, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(x, 388, 3, 0, TAU); ctx.fill();
      }
    });
    wallTex.wrapS = THREE.RepeatWrapping;
    wallTex.repeat.set(6, 1);
    add(new THREE.CylinderGeometry(CR, CR, CH, 64, 1, true), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.7, side: THREE.BackSide }), cabin, 0, CH / 2, 0);

    const floorTex = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#B9C2CF";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#A3ADBC";
      ctx.lineWidth = 3;
      for (let i = 0; i <= w; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
      }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(6, 6);
    add(new THREE.CircleGeometry(CR, 64), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }), cabin).rotation.x = -Math.PI / 2;
    add(new THREE.PlaneGeometry(1.1, 6.6), std(BRAND.electricBlue, 0.6), cabin, 0, 0.005, 0.4).rotation.x = -Math.PI / 2; // aisle
    const aisleLightMat = new THREE.MeshBasicMaterial({ color: BRAND.blueYonder });
    for (let z = -2.4; z <= 3.4; z += 0.6) {
      [-0.5, 0.5].forEach((x) => { add(geo("aisleLight", () => new THREE.CircleGeometry(0.04, 12)), aisleLightMat, cabin, x, 0.01, z).rotation.x = -Math.PI / 2; });
    }
    add(new THREE.CircleGeometry(CR, 64), new THREE.MeshBasicMaterial({ color: 0xdde3ec }), cabin, 0, CH, 0).rotation.x = Math.PI / 2;
    const lightRingMat = new THREE.MeshBasicMaterial({ color: BRAND.white });
    add(new THREE.TorusGeometry(2.2, 0.06, 10, 64), lightRingMat, cabin, 0, CH - 0.05, 0).rotation.x = Math.PI / 2;
    add(new THREE.TorusGeometry(1.0, 0.05, 10, 48), lightRingMat, cabin, 0, CH - 0.05, 0).rotation.x = Math.PI / 2;
    add(new THREE.PlaneGeometry(1.3, 2.3), new THREE.MeshBasicMaterial({ color: 0xfff4d6 }), cabin, 0, 1.15, CR * 0.985).rotation.y = Math.PI; // the door we came in

    /* ---- The view outside: one shader for every window ---- */
    // uAlt goes 0 (on the pad) → 1 (in space): ground drops away, clouds rush past,
    // the sky turns from Blue Yonder to black, stars come out, and the Moon appears.
    const skyU = {
      uAlt: { value: 0 }, uTime: { value: 0 }, uScroll: { value: 0 }, uEngine: { value: 0 },
      uTrip: { value: 0 }, uEarthVis: { value: 0 },                      // Earth shrinking in the portholes
      uMoonR: { value: 0.1 },                                             // Moon size in the front window
      uMars: { value: 0 },                                                // 1 = the planet in the front window is Mars
      uHome: { value: 0 },                                                // 1 = it's Earth (on the way home)
      uLand: { value: 0 }, uLandMix: { value: 0 }, uDust: { value: 0 },  // landing on the Moon
    };
    function skyWindowMaterial(aspect, offset, isFront) {
      return new THREE.ShaderMaterial({
        uniforms: {
          ...skyU,
          uSize: { value: new THREE.Vector2(aspect, 1) },
          uOffset: { value: new THREE.Vector2(offset[0], offset[1]) },
          uMoon: { value: isFront ? 1 : 0 },
          uEarthOn: { value: isFront ? 0 : 1 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform float uAlt, uTime, uScroll, uEngine, uMoon, uEarthOn, uTrip, uEarthVis, uMoonR, uLand, uLandMix, uDust, uMars, uHome;
          uniform vec2 uSize, uOffset;
          varying vec2 vUv;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
          }
          float fbm(vec2 p) {
            float s = 0.0, a = 0.5;
            for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
            return s;
          }
          float crater(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            float h = hash(i);
            vec2 c = vec2(hash(i + 3.1), hash(i + 7.7)) * 0.6 + 0.2;
            float d = length(f - c) / (0.12 + 0.25 * h);
            float bowl = d < 1.0 ? (d * d - 1.0) * 0.6 : exp(-pow((d - 1.0) / 0.25, 2.0)) * 0.3;
            return bowl * step(0.35, h);
          }
          void main() {
            vec2 uv = vUv * uSize;
            float a = uAlt;
            vec3 yonder = vec3(0.180, 0.588, 0.961);
            vec3 neon = vec3(0.035, 0.376, 0.882);
            vec3 electric = vec3(0.0, 0.259, 0.651);
            vec3 deep = vec3(0.027, 0.090, 0.247);
            vec3 space = vec3(0.004, 0.012, 0.04);
            vec3 low = mix(yonder, mix(electric, space, smoothstep(0.55, 0.9, a)), smoothstep(0.1, 0.55, a));
            vec3 high = mix(neon, mix(deep, space, smoothstep(0.45, 0.85, a)), smoothstep(0.05, 0.5, a));
            vec3 col = mix(low, high, clamp(vUv.y, 0.0, 1.0));

            // Hills and the launch site fall away as we climb
            float horizon = 0.3 - a * 3.0;
            float hill = horizon + 0.07 * noise(vec2((uv.x + uOffset.x) * 3.0, 1.0));
            col = mix(col, vec3(0.0, 0.2, 0.55), step(vUv.y, hill));
            col = mix(col, vec3(0.62, 0.66, 0.72), step(vUv.y, horizon - 0.05));

            // Clouds rushing past on the way up
            float band = smoothstep(0.04, 0.2, a) * (1.0 - smoothstep(0.4, 0.62, a));
            float cl = fbm(vec2((uv.x + uOffset.x) * 2.5, uv.y * 1.2 + uScroll + uOffset.y));
            col = mix(col, vec3(1.0), smoothstep(0.5, 0.72, cl) * band);

            // Stars once the sky is dark
            vec2 sp = (uv + uOffset) * 45.0;
            float s = hash(floor(sp));
            float star = step(0.975, s) * smoothstep(0.32, 0.0, length(fract(sp) - 0.5));
            col += vec3(star * smoothstep(0.55, 0.9, a) * (0.6 + 0.4 * sin(uTime * 3.0 + s * 50.0)));

            // Earth seen through the portholes on the trip (it shrinks as we fly away)
            if (uEarthOn > 0.5 && uEarthVis > 0.0) {
              float er = mix(1.5, 0.16, uTrip);
              vec2 ecen = vec2(0.5 * uSize.x, mix(-1.2, 0.42, uTrip));
              vec2 d = (uv - ecen) / er;
              float r = length(d);
              col += yonder * uEarthVis * 0.7 * smoothstep(1.15, 1.0, r) * step(1.0, r);
              if (r < 1.0) {
                vec3 n = vec3(d, sqrt(1.0 - r * r));
                float landMask = smoothstep(0.5, 0.58, fbm(n.xy * 2.2 + n.z * 1.7 + 3.0));
                float cloud = smoothstep(0.55, 0.78, fbm(n.xy * 3.5 - n.z * 2.0 + 11.0));
                vec3 ecol = mix(vec3(0.05, 0.35, 0.85), vec3(0.24, 0.6, 0.3), landMask);
                ecol = mix(ecol, vec3(1.0), cloud * 0.85);
                ecol *= 0.3 + 0.8 * clamp(dot(n, normalize(vec3(-0.5, 0.45, 0.75))), 0.0, 1.0);
                col = mix(col, ecol, uEarthVis);
              }
            }

            // The Moon in the front window (grows as we get closer)
            vec2 mc = mix(vec2(uSize.x * 0.74, 0.66), vec2(uSize.x * 0.5, 0.5), smoothstep(0.1, 0.6, uMoonR));
            vec2 mdv = (uv - mc) / uMoonR;
            float mr = length(mdv);
            if (mr < 1.0) {
              float mz = sqrt(1.0 - mr * mr);
              vec3 moonCol = vec3(0.88, 0.89, 0.92) - 0.16 * smoothstep(0.55, 0.7, fbm(mdv * 2.5 + 7.0)) - 0.07 * noise(mdv * 18.0);
              moonCol *= 0.65 + 0.35 * mz;
              vec3 marsCol = mix(vec3(0.82, 0.43, 0.22), vec3(0.55, 0.25, 0.14), smoothstep(0.5, 0.66, fbm(mdv * 2.2 + 3.0)));
              marsCol = mix(marsCol, vec3(0.97, 0.95, 0.93), smoothstep(0.84, 0.9, mdv.y)); // polar cap
              marsCol *= 0.6 + 0.4 * mz;
              moonCol = mix(moonCol, marsCol, uMars);
              vec3 homeCol = mix(vec3(0.08, 0.35, 0.85), vec3(0.25, 0.6, 0.3), smoothstep(0.5, 0.58, fbm(mdv * 2.2 + 11.0)));
              homeCol = mix(homeCol, vec3(1.0), smoothstep(0.55, 0.75, fbm(mdv * 4.0 + 3.0)) * 0.8);
              homeCol *= 0.55 + 0.45 * mz;
              moonCol = mix(moonCol, homeCol, uHome);
              col = mix(col, moonCol, uMoon * smoothstep(0.8, 1.0, a) * smoothstep(1.0, 0.97, mr));
            }

            // Landing: the cratered lunar surface rushing up toward us
            if (uLandMix > 0.0) {
              float hz = 0.62;
              vec3 landCol = col;
              if (vUv.y < hz) {
                float depth = 0.3 / (hz - vUv.y + 0.015);
                float zoom = mix(14.0, 0.9, uLand);
                vec2 gp = vec2((uv.x - uSize.x * 0.5) * depth, depth + uScroll) * zoom * 0.25 + uOffset;
                float cr = crater(gp) + 0.5 * crater(gp * 2.7 + 5.0);
                vec3 g = vec3(0.58, 0.59, 0.62) + cr * 0.22 + (noise(gp * 9.0) - 0.5) * 0.08;
                landCol = mix(g, vec3(0.72, 0.73, 0.75), smoothstep(hz - 0.12, hz, vUv.y));
              }
              col = mix(col, landCol, uLandMix);
              col += vec3(1.0, 0.55, 0.15) * uEngine * smoothstep(0.45, 0.0, vUv.y) * uLandMix;
            }

            // Moon dust kicked up at touchdown
            col = mix(col, vec3(0.62, 0.6, 0.57), clamp(uDust * smoothstep(0.85, 0.0, vUv.y) * (0.55 + 0.45 * fbm(uv * 3.0 + vec2(uTime * 0.3, 0.0))), 0.0, 1.0));

            // Orange engine glow at the bottom during liftoff
            col += vec3(1.0, 0.55, 0.15) * uEngine * smoothstep(0.5, 0.0, vUv.y) * (1.0 - smoothstep(0.15, 0.4, a));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      });
    }
    frameHooks.push((dt, t) => {
      skyU.uTime.value = t;
      engineLight.intensity = skyU.uEngine.value * (5 + Math.random() * 4);
    });

    // Big front window (two panes) above the console
    const WIN = { w: 3.0, h: 1.45, y: 1.95, z: -3.3 };
    const WINDOW_CENTER = V(0, WIN.y, WIN.z);
    add(new THREE.PlaneGeometry(WIN.w, WIN.h), skyWindowMaterial(WIN.w / WIN.h, [0, 0], true), cabin, 0, WIN.y, WIN.z);
    const frameMat = std(BRAND.electricBlue, 0.4, 0.2);
    add(new THREE.BoxGeometry(WIN.w + 0.24, 0.12, 0.12), frameMat, cabin, 0, WIN.y + WIN.h / 2 + 0.06, WIN.z + 0.03);
    add(new THREE.BoxGeometry(WIN.w + 0.24, 0.12, 0.12), frameMat, cabin, 0, WIN.y - WIN.h / 2 - 0.06, WIN.z + 0.03);
    [-1, 1].forEach((s) => add(new THREE.BoxGeometry(0.12, WIN.h + 0.24, 0.12), frameMat, cabin, s * (WIN.w / 2 + 0.06), WIN.y, WIN.z + 0.03));
    add(new THREE.BoxGeometry(0.06, WIN.h, 0.06), frameMat, cabin, 0, WIN.y, WIN.z + 0.03);

    // Portholes beside every row (ours is front row, left)
    const ROWS = [-0.9, 0.4, 1.7];
    let myPorthole = null;
    const portRimMat = std(0xc4c8cf, 0.35, 0.6);
    ROWS.forEach((z, r) => [-1, 1].forEach((s) => {
      const p = V(s * Math.sqrt(CR * CR - z * z) * 0.985, 1.05, z);
      const glass = add(geo("portGlass", () => new THREE.CircleGeometry(0.3, 40)), skyWindowMaterial(1, [rand() * 5, rand() * 5], false), cabin, p.x, p.y, p.z);
      glass.lookAt(0, p.y, 0); // face into the cabin
      const ringMesh = add(geo("portRim2", () => new THREE.TorusGeometry(0.31, 0.06, 10, 36)), portRimMat, cabin, p.x, p.y, p.z);
      ringMesh.quaternion.copy(glass.quaternion);
      if (s < 0 && r === 0) myPorthole = p;
    }));

    /* ---- Console with screens ---- */
    add(new THREE.BoxGeometry(3.4, 0.85, 0.55), std(0xdfe4ec, 0.5), cabin, 0, 0.425, -3.0);
    const deck = new THREE.Group();
    deck.position.set(0, 0.9, -2.82);
    deck.rotation.x = 0.35;
    cabin.add(deck);
    add(new THREE.BoxGeometry(3.4, 0.06, 0.42), std(BRAND.deepBlue, 0.4, 0.2), deck);
    const knobColors = [0xff4d5e, 0xffd23f, 0x3ddc84, BRAND.blueYonder];
    const knobMats = knobColors.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5 }));
    for (let i = 0; i < 24; i++) {
      add(geo("knob", () => new THREE.CylinderGeometry(0.03, 0.03, 0.03, 14)), knobMats[i % 4], deck, -1.5 + (i % 12) * 0.27, 0.045, i < 12 ? -0.08 : 0.08);
    }

    const font = (weight, px) => `${weight} ${px}px "Fira Sans", Arial, sans-serif`;
    function makeScreen(x, draw) {
      const c = document.createElement("canvas");
      c.width = 512; c.height = 256;
      const ctx = c.getContext("2d");
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      add(new THREE.BoxGeometry(0.98, 0.53, 0.05), std(BRAND.deepBlue, 0.4, 0.2), cabin, x, 1.08, -3.2);
      add(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: tex }), cabin, x, 1.08, -3.17);
      return (...args) => { draw(ctx, 512, 256, ...args); tex.needsUpdate = true; };
    }
    const screenBg = (ctx, w, h, title) => {
      ctx.fillStyle = "#07173F";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#0960E1";
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = "#2E96F5";
      ctx.font = font(700, 26);
      ctx.textAlign = "left";
      ctx.fillText(title, 26, 44);
    };
    const drawRoute = makeScreen(-1.05, (ctx, w, h, progress = 0) => {
      screenBg(ctx, w, h, "ROUTE");
      ctx.fillStyle = "#2E96F5"; ctx.beginPath(); ctx.arc(95, 168, 46, 0, TAU); ctx.fill();
      ctx.fillStyle = "#3DDC84"; ctx.beginPath(); ctx.arc(80, 155, 16, 0, TAU); ctx.arc(110, 185, 12, 0, TAU); ctx.fill();
      ctx.fillStyle = "#D6DBE3"; ctx.beginPath(); ctx.arc(430, 112, 26, 0, TAU); ctx.fill();
      ctx.setLineDash([10, 10]);
      ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(140, 150); ctx.quadraticCurveTo(280, 40, 404, 112); ctx.stroke();
      ctx.setLineDash([]);
      const q = clamp(progress, 0, 1), u = 1 - q;
      ctx.fillStyle = "#FF8A3D";
      ctx.beginPath(); ctx.arc(u * u * 140 + 2 * u * q * 280 + q * q * 404, u * u * 150 + 2 * u * q * 40 + q * q * 112, 10, 0, TAU); ctx.fill();
      ctx.fillStyle = "#FFFFFF"; ctx.font = font(700, 22); ctx.textAlign = "center";
      ctx.fillText("EARTH", 95, 238); ctx.fillText("MOON", 430, 168);
    });
    const drawStatus = makeScreen(0, (ctx, w, h, title = "PRE-FLIGHT", sub = "Crew boarding", color = "#2E96F5", progress = -1) => {
      screenBg(ctx, w, h, "MISSION STATUS");
      ctx.textAlign = "center";
      ctx.fillStyle = color; ctx.font = font(900, title.length > 10 ? 50 : 64);
      ctx.fillText(title, w / 2, 140);
      ctx.fillStyle = "#FFFFFF"; ctx.font = font(700, 26);
      ctx.fillText(sub, w / 2, 190);
      if (progress >= 0) {
        ctx.fillStyle = "#0042A6"; ctx.fillRect(66, 210, w - 132, 16);
        ctx.fillStyle = "#3DDC84"; ctx.fillRect(66, 210, (w - 132) * progress, 16);
      }
    });
    const drawSystems = makeScreen(1.05, (ctx, w, h, levels = [1, 0, 0]) => {
      screenBg(ctx, w, h, "SYSTEMS");
      ["FUEL", "ENGINES", "HARNESSES"].forEach((name, i) => {
        const y = 92 + i * 56;
        ctx.textAlign = "left"; ctx.fillStyle = "#FFFFFF"; ctx.font = font(700, 24);
        ctx.fillText(name, 26, y + 18);
        ctx.fillStyle = "#0042A6"; ctx.fillRect(200, y, 280, 22);
        ctx.fillStyle = levels[i] >= 1 ? "#3DDC84" : "#2E96F5"; ctx.fillRect(200, y, 280 * levels[i], 22);
      });
    });
    drawRoute(0);
    drawStatus();
    drawSystems([1, 0, 0]);

    // Posters on the front walls
    function poster(side, draw) {
      const z = -2.55;
      const p = V(side * Math.sqrt(CR * CR - z * z) * 0.975, 1.85, z);
      const m = add(new THREE.PlaneGeometry(0.85, 0.85), new THREE.MeshStandardMaterial({ map: canvasTexture(512, 512, draw), roughness: 0.8 }), cabin, p.x, p.y, p.z);
      m.lookAt(0, p.y, 0);
      return m;
    }
    const nextStopDraw = (place, color) => (ctx, w, h) => {
      ctx.fillStyle = "#0960E1"; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 14; ctx.strokeRect(18, 18, w - 36, h - 36);
      ctx.fillStyle = "#FFFFFF"; ctx.textAlign = "center";
      ctx.font = font(700, 40); ctx.fillText("NEXT STOP", 256, 120);
      ctx.font = font(900, place.length > 6 ? 76 : 84); ctx.fillText(place, 256, 220);
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(256, 330, 50, 0, TAU); ctx.fill();
    };
    let nextStopPoster = null;
    function setNextStop(place, color) {
      if (!nextStopPoster) return;
      nextStopPoster.material.map.dispose();
      nextStopPoster.material.map = canvasTexture(512, 512, nextStopDraw(place, color));
      nextStopPoster.material.needsUpdate = true;
    }
    poster(-1, (ctx, w, h) => {
      ctx.fillStyle = "#07173F"; ctx.beginPath(); ctx.arc(256, 256, 250, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#2E96F5"; ctx.lineWidth = 16; ctx.stroke();
      ctx.fillStyle = "#D6DBE3"; ctx.beginPath(); ctx.arc(180, 250, 70, 0, TAU); ctx.fill();
      ctx.fillStyle = "#E0703A"; ctx.beginPath(); ctx.arc(340, 260, 58, 0, TAU); ctx.fill();
      ctx.fillStyle = "#FFFFFF"; ctx.textAlign = "center"; ctx.font = font(900, 40);
      ctx.fillText("THE FORGOTTEN", 256, 120); ctx.fillText("EXPLORERS", 256, 400);
    });
    nextStopPoster = poster(1, nextStopDraw("THE MOON", "#D6DBE3"));

    /* ---- Seats with swing-down safety bars ---- */
    const seatShell = std(BRAND.white, 0.45);
    const seatPad = std(BRAND.electricBlue, 0.6);
    const seatHead = std(BRAND.neonBlue, 0.5);
    const barPadMat = std(BRAND.blueYonder, 0.45);
    const rodMat = std(0xc4c8cf, 0.35, 0.6);
    const BAR_UP = -0.15, BAR_DOWN = -2.15;
    function buildSeat(x, z, top = 0.3, w = 0.56) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      cabin.add(g);
      add(geo("seatPost" + top, () => new THREE.CylinderGeometry(0.07, 0.12, top - 0.05, 12)), rodMat, g, 0, (top - 0.05) / 2, 0);
      add(geo("seatBase" + w, () => new THREE.BoxGeometry(w, 0.1, 0.5)), seatShell, g, 0, top - 0.05, 0);
      add(geo("seatCush" + w, () => new THREE.BoxGeometry(w - 0.08, 0.04, 0.44)), seatPad, g, 0, top + 0.01, -0.01);
      const back = new THREE.Group();
      back.position.set(0, top, 0.24);
      back.rotation.x = 0.12;
      g.add(back);
      add(geo("seatBack" + w, () => new THREE.BoxGeometry(w, 0.66, 0.08)), seatShell, back, 0, 0.33, 0.02);
      add(geo("seatBackPad" + w, () => new THREE.BoxGeometry(w - 0.1, 0.54, 0.03)), seatPad, back, 0, 0.32, -0.035);
      add(geo("seatHead" + w, () => new THREE.BoxGeometry(w * 0.7, 0.16, 0.1)), seatHead, back, 0, 0.72, 0);
      [-1, 1].forEach((s) => add(geo("seatArm" + w, () => new THREE.BoxGeometry(0.06, 0.06, 0.42)), seatShell, g, s * (w / 2), top + 0.17, -0.02));
      const bar = new THREE.Group();
      bar.position.set(0, top + 0.62, 0.2);
      bar.rotation.x = BAR_UP;
      g.add(bar);
      [-1, 1].forEach((s) => add(geo("barRod", () => new THREE.CylinderGeometry(0.022, 0.022, 0.62, 8)), rodMat, bar, s * 0.24, 0.31, 0));
      add(geo("barPad", () => new THREE.CapsuleGeometry(0.05, 0.4, 4, 12)), barPadMat, bar, 0, 0.62, 0).rotation.z = Math.PI / 2;
      return { bar, x, z, top };
    }
    const XS = [-2.6, -1.75, -0.9, 0.9, 1.75, 2.6];
    const seats = [];
    ROWS.forEach((z, row) => XS.forEach((x) => seats.push({ ...buildSeat(x, z), row })));
    const seatAt = (x, row) => seats.find((s) => s.x === x && s.row === row);
    const MY_SEAT = seatAt(-2.6, 0);
    const CMD_SEAT = buildSeat(0, -2.2, 0.45, 0.74);
    CMD_SEAT.bar.visible = false; // Nova's seat has no bar sticking up in the middle of the cabin
    const swingBar = (seat, seconds) => tween(seconds, (k) => { seat.bar.rotation.x = BAR_UP + (BAR_DOWN - BAR_UP) * ease(k); });

    /* ---- People ---- */
    const kidsIn = order.filter((w) => w !== "me");
    const [firstA, firstB] = kidsIn;          // boarded just before us
    const neighbours = kidsIn.slice(2, 4);    // come in right after us, front row (right side)
    const behindUs = kidsIn.slice(4);         // fill the rows behind us
    // (the seat right next to ours stays empty so we can see the front clearly)
    for (const c of kidsIn) {
      cabin.add(c.root);
      c.root.visible = false;
      c.mode = "idle";
      c.pose = {};
    }
    const backSeats = seats.filter((s) => s.row > 0);
    const seatNow = (c, seat) => {
      c.sitBob = c.sitBobFor(seat.top);
      c.root.position.set(seat.x, 0, seat.z);
      c.heading = c.targetHeading = Math.PI;
      c.mode = "sit";
      c.pose = {};
      c.root.visible = true;
    };
    const walkToSeat = (c, seat, fromZ) => {
      c.root.position.set(0, 0, fromZ);
      c.root.visible = true;
      return walkTo(c, [V(0, 0, seat.z - 0.55), V(seat.x, 0, seat.z - 0.55), V(seat.x, 0, seat.z)], 1.5, { endMode: "sit", heading: Math.PI });
    };

    cabin.add(commander.root, pip.root);
    commander.root.visible = pip.root.visible = true;
    commander.root.position.set(-1.1, 0, -2.05);
    commander.heading = commander.targetHeading = 0; // facing the door as everyone comes in
    commander.mode = "idle";
    commander.sitBob = commander.sitBobFor(CMD_SEAT.top);
    pip.root.position.set(1.9, 0, -2.15);
    pip.heading = pip.targetHeading = 0;
    pip.mode = "idle";
    pip.spin = 0;

    /* ---- Play the cabin scene ---- */
    const SEAT_EYE = 0.95;
    const novaLook = () => commander.headPoint().add(V(0, -0.35, 0)); // chest/face, not helmet top
    activeScene = cabin;
    cam.pos.set(0, EYE, 3.3);
    cam.yaw = 0;
    cam.pitch = 0.05;
    cam.follow = () => commander.headPoint();
    walkToSeat(firstA, seatAt(-0.9, 0), 1.3).catch(() => {});
    walkToSeat(firstB, seatAt(0.9, 0), 2.2).catch(() => {});
    // The rest of the front row comes in right behind us and sits on the right side
    const neighbourSeats = [seatAt(1.75, 0), seatAt(2.6, 0)];
    const neighboursSeated = Promise.all(neighbours.map((c, i) => (async () => {
      c.root.position.set(0, 0, 4.4); // just outside the door, behind us
      await wait(0.9 + i * 0.7);
      await walkToSeat(c, neighbourSeats[i], 3.5);
    })()));
    const fadeIn = fadeTo(0, 1.2);

    // Walk down the aisle and across to our window seat
    const FRONT_WALK = ROWS[0] - 0.55;
    await walkCamera([V(0, EYE, FRONT_WALK)], 1.4);
    await fadeIn;
    cam.follow = () => V(-3.4, 0.9, ROWS[0]);
    await walkCamera([V(MY_SEAT.x, EYE, FRONT_WALK)], 1.3);

    // Sit down, facing the front
    cam.follow = null;
    {
      const from = cam.pos.clone(), y0 = cam.yaw, p0 = cam.pitch;
      // Sit down and turn straight toward Nova
      const nova = novaLook();
      const to0 = V(MY_SEAT.x, SEAT_EYE, MY_SEAT.z + 0.02);
      let yaw1 = Math.atan2(-(nova.x - to0.x), -(nova.z - to0.z));
      const pitch1 = Math.atan2(nova.y - to0.y, Math.hypot(nova.x - to0.x, nova.z - to0.z));
      while (yaw1 - y0 > Math.PI) yaw1 -= TAU;
      while (yaw1 - y0 < -Math.PI) yaw1 += TAU;
      const to = V(MY_SEAT.x, SEAT_EYE, MY_SEAT.z + 0.02);
      await tween(1.2, (k) => {
        const e = ease(k);
        cam.pos.lerpVectors(from, to, e);
        cam.yaw = y0 + (yaw1 - y0) * e;
        cam.pitch = p0 + (pitch1 - p0) * e;
      });
    }
    behindUs.forEach((c, i) => seatNow(c, backSeats[i])); // they came in behind us
    // Empty seats keep no safety bar (so nothing hangs in the air in front of anyone)
    const occupied = new Set([MY_SEAT, seatAt(-0.9, 0), seatAt(0.9, 0), ...neighbourSeats, ...backSeats.slice(0, behindUs.length)]);
    seats.forEach((st) => { if (!occupied.has(st)) st.bar.visible = false; });

    // Nova welcomes everyone straight away
    commander.targetHeading = facing(commander.root.position, V(0, 0, 0.6));
    pip.targetHeading = facing(pip.root.position, V(0, 0, 0.6));
    cam.follow = () => novaLook();
    commander.mode = "talk";
    await say(NAMES.commander, LINES.cabinWelcome[0]);
    await say(NAMES.commander, LINES.cabinWelcome[1]);
    hideDialogue();
    await neighboursSeated;
    commander.mode = "idle";

    // Safety bars swing down; we look down to watch ours click into place
    const otherBars = Promise.all(seats.filter((s) => s !== MY_SEAT && occupied.has(s)).map((s, i) => (async () => {
      await wait(0.2 + i * 0.06);
      await swingBar(s, 0.6);
    })()));
    await lookTo(0, -0.62, 0.8);
    await swingBar(MY_SEAT, 0.7);
    if (window.AstroAudio) window.AstroAudio.sfx("click");
    showBig("CLICK!", "small");
    await wait(0.9);
    hideBig();
    await otherBars;
    await lookAtPoint(novaLook(), 0.9);

    // Pre-flight briefing
    commander.mode = "talk";
    for (let i = 0; i < LINES.briefing.length - 1; i++) await say(NAMES.commander, LINES.briefing[i]);
    commander.mode = "present";
    await say(NAMES.commander, LINES.briefing[LINES.briefing.length - 1]);
    hideDialogue();
    commander.mode = "idle";

    // PIP runs the systems check on the console
    pip.targetHeading = facing(pip.root.position, V(1.9, 0, -3.2));
    await lookAtPoint(pip.headPoint(), 0.9);
    pip.mode = "talk";
    if (window.AstroAudio) window.AstroAudio.sfx("blips");
    const blipTimer = setInterval(() => { if (window.AstroAudio) window.AstroAudio.sfx("blips"); }, 1100);
    run.cleanup.push(() => clearInterval(blipTimer));
    const checking = tween(3.2, (k) => {
      drawStatus("CHECKING…", "Systems check", "#2E96F5", k);
      drawSystems([1, Math.min(1, k * 1.6), Math.max(0, k * 1.6 - 0.6)]);
    });
    await say(NAMES.robot, LINES.pipCheck[0]);
    await say(NAMES.robot, LINES.pipCheck[1]);
    await checking;
    drawSystems([1, 1, 1]);
    clearInterval(blipTimer);
    drawStatus("ALL SYSTEMS GO", "Ready for launch", "#3DDC84");
    if (window.AstroAudio) window.AstroAudio.sfx("success");
    pip.targetHeading = facing(pip.root.position, V(0, 0, 0.6));
    pip.mode = "excited";
    await say(NAMES.robot, LINES.pipCheck[2]);
    hideDialogue();
    pip.mode = "idle";

    // Nova takes the commander's seat; PIP goes to its station
    await lookAtPoint(novaLook(), 0.8);
    commander.mode = "talk";
    await say(NAMES.commander, LINES.countdown);
    hideDialogue();
    const novaSits = walkTo(commander, [V(-0.75, 0, -2.2), V(0, 0, -2.2)], 1.2, { endMode: "sit", heading: Math.PI });
    walkTo(pip, [V(2.3, 0, -2.4)], 1.0, { heading: Math.PI }).catch(() => {});
    await lookAtPoint(WINDOW_CENTER, 1.4);
    await novaSits;
    await wait(0.4);

    // Countdown 10 → 1 (the rumble builds from 5)
    for (let n = 10; n >= 1; n--) {
      showBig(String(n));
      if (window.AstroAudio) {
        window.AstroAudio.sfx(n <= 3 ? "beepHigh" : "beep");
      }
      drawStatus(`T-${n}`, "Countdown", "#FF8A3D");
      if (n <= 5) {
        cam.shake = 0.004 * (6 - n);
        if (window.AstroAudio) window.AstroAudio.rumble((6 - n) * 0.12, 0.8);
        skyU.uEngine.value = (6 - n) / 5;
      }
      await wait(1.0);
    }

    // LIFTOFF!
    showBig("LIFTOFF!", "liftoff");
    if (window.AstroAudio) window.AstroAudio.rumble(1, 0.4);
    setMode(kidsIn, "sitCheer");
    setLocation("Space · On the way to the Moon");
    let lastKm = -1, prevAlt = 0;
    const climb = tween(12, (k) => {
      const alt = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      skyU.uScroll.value += (alt - prevAlt) * 30;
      prevAlt = alt;
      skyU.uAlt.value = alt;
      cam.shake = 0.03 * Math.pow(1 - k, 1.4) + (k < 0.85 ? 0.003 : 0);
      const stage = alt < 0.85 ? 0 : 1;
      if (stage !== lastKm) {
        lastKm = stage;
        drawStatus(stage ? "IN SPACE" : "LIFTOFF", stage ? "Next stop: the Moon" : "Hold on tight!", stage ? "#3DDC84" : "#FFFFFF");
        drawRoute(alt * 0.06);
      }
    });
    const lookOut = (async () => {
      await wait(2.0);
      hideBig();
      await lookAtPoint(myPorthole, 1.4);   // watch the ground drop and clouds rush past
      await wait(4.2);
      await lookAtPoint(WINDOW_CENTER, 1.6); // black sky, stars, and the Moon ahead
    })();
    if (window.AstroAudio) window.AstroAudio.rumble(0, 11); // the rumble fades as we reach space
    await Promise.all([climb, lookOut]);
    cam.shake = 0;
    skyU.uEngine.value = 0;
    setMode(kidsIn, "sit");
    await wait(1.0);

    // We made it to space!
    for (const line of LINES.space) await say(NAMES.commander, line);
    hideDialogue();

    /* ================================================================== */
    /* THE TRIP: a short 3-day montage                                     */
    /* ================================================================== */

    // Look back at Earth through our porthole: it gets smaller and smaller
    skyU.uTrip.value = 0;
    skyU.uEarthVis.value = 1;
    await lookAtPoint(myPorthole, 1.4);
    let tripDay = 1;
    await tween(9, (k) => {
      skyU.uTrip.value = ease(k);
      drawRoute(0.06 + 0.25 * k);
      const d = 1 + Math.min(3, Math.floor(k * 3.2 + 0.2)); // days 2, 3, 4 pass as Earth shrinks
      if (d !== tripDay) { tripDay = d; setDay(d); if (window.AstroAudio) window.AstroAudio.sfx("blips"); }
    });
    await wait(0.6);

    // Turn to look out the front window while the days tick by
    drawRoute(0.31);
    await lookAtPoint(WINDOW_CENTER, 2.2);
    if (window.AstroAudio) window.AstroAudio.sfx("swell");
    const moonGrows = tween(6, (k) => {
      skyU.uMoonR.value = 0.1 + 0.45 * ease(k);
      drawRoute(0.31 + 0.6 * k);
    });
    await say(NAMES.commander, LINES.trip.day3[0]);
    await say(NAMES.commander, LINES.trip.day3[1]);
    hideDialogue();
    await moonGrows;

    /* ================================================================== */
    /* LANDING ON THE MOON (watched from outside, on the surface)          */
    /* ================================================================== */

    await wait(0.6);
    await fadeTo(1, 0.9, "#000000"); // cut to the outside view
    for (const c of characters) c.walkId = (c.walkId || 0) + 1;

    const moonScene = new THREE.Scene();
    moonScene.background = new THREE.Color(0x000000);
    moonScene.environment = scene.environment;

    moonScene.add(new THREE.HemisphereLight(0x8090b0, 0x55575c, 0.6));
    const moonSunDir = V(-40, 30, 35).normalize();
    const moonSun = new THREE.DirectionalLight(BRAND.white, 2.8);
    moonSun.position.copy(moonSunDir).multiplyScalar(100);
    moonScene.add(moonSun);
    const blueFill = new THREE.DirectionalLight(BRAND.blueYonder, 0.5);
    blueFill.position.set(30, 60, 130);
    moonScene.add(blueFill);

    /* ---- Cratered gray ground (flat around the landing spot) ---- */
    const h2 = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
    const noise2 = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    const smooth01 = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
    const EAGLE = V(32, 0, -18); // where the Apollo 11 Lunar Module "Eagle" waits: a short hop away, off to our right (out of view until we turn)
    const moonCraters = [];
    const crRand = mulberry32(77);
    for (let i = 0; i < 80; i++) {
      const a = crRand() * TAU, d = 30 + crRand() * 230;
      moonCraters.push({ x: Math.cos(a) * d, z: -22 + Math.sin(a) * d, r: 3 + Math.pow(crRand(), 2) * 22, depth: 0.5 + crRand() * 0.5 });
    }
    function moonHeight(x, z) {
      const ax = 0, az = -22, bx = EAGLE.x, bz = EAGLE.z;
      const seg = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2), 0, 1);
      const flat = smooth01((Math.hypot(x - (ax + (bx - ax) * seg), z - (az + (bz - az) * seg)) - 26) / 14); // 0 from our landing spot to Eagle
      let h = (noise2(x * 0.05, z * 0.05) - 0.5) * 3 + (noise2(x * 0.2, z * 0.2) - 0.5) * 0.6;
      for (const c of moonCraters) {
        const d = Math.hypot(x - c.x, z - c.z) / c.r;
        if (d < 1.6) {
          let v = d < 1 ? (d * d - 1) * 0.9 : 0;
          v += Math.exp(-Math.pow((d - 1) / 0.22, 2)) * 0.45;
          h += v * c.depth * c.r * 0.25;
        }
      }
      return h * flat;
    }
    const moonGroundGeo = new THREE.PlaneGeometry(900, 900, 150, 150);
    const mgp = moonGroundGeo.attributes.position;
    for (let i = 0; i < mgp.count; i++) mgp.setZ(i, moonHeight(mgp.getX(i), -mgp.getY(i)));
    moonGroundGeo.computeVertexNormals();
    const regolith = canvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = "#9A9DA3";
      ctx.fillRect(0, 0, w, h);
      const r = mulberry32(5);
      for (let i = 0; i < 5000; i++) { // soft round grains of moon dust
        const g = 125 + Math.floor(r() * 60);
        ctx.fillStyle = `rgba(${g},${g},${g + 4},${0.35 + r() * 0.4})`;
        ctx.beginPath();
        ctx.arc(r() * w, r() * h, 0.6 + r() * 1.8, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(90,92,98,0.5)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(r() * w, r() * h, 4 + r() * 10, 0, TAU); ctx.stroke(); }
    });
    regolith.wrapS = regolith.wrapT = THREE.RepeatWrapping;
    regolith.repeat.set(150, 150);
    const moonGround = new THREE.Mesh(moonGroundGeo, new THREE.MeshStandardMaterial({ map: regolith, color: 0xdcdce0, roughness: 1 }));
    moonGround.rotation.x = -Math.PI / 2;
    moonScene.add(moonGround);

    /* ---- Stars and Earth in the black sky ---- */
    let moonStars = null;
    {
      const N = 2600;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const y = -0.05 + rand() * 1.05, a = rand() * TAU, sR = Math.sqrt(Math.max(0, 1 - y * y));
        pos.set([Math.cos(a) * sR * 600, y * 600, Math.sin(a) * sR * 600], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      moonStars = new THREE.Points(g, new THREE.PointsMaterial({ color: BRAND.white, size: 2, sizeAttenuation: false }));
      moonScene.add(moonStars);
    }
    const EARTH_POS = V(-90, 70, -180);
    const earth = new THREE.Mesh(new THREE.SphereGeometry(9, 64, 40), new THREE.ShaderMaterial({
      uniforms: { uSun: { value: moonSunDir.clone() } },
      vertexShader: /* glsl */ `
        varying vec3 vP;
        varying vec3 vN;
        void main() {
          vP = normalize(position);
          vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun;
        varying vec3 vP;
        varying vec3 vN;
        float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float noise3(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
        }
        float fbm3(vec3 p) {
          float s = 0.0, a = 0.5;
          for (int i = 0; i < 5; i++) { s += a * noise3(p); p *= 2.02; a *= 0.5; }
          return s;
        }
        void main() {
          float land = smoothstep(0.5, 0.56, fbm3(vP * 2.2 + 3.0));
          float ice = smoothstep(0.82, 0.9, abs(vP.y));
          float cloud = smoothstep(0.55, 0.75, fbm3(vP * 4.0 + 10.0));
          vec3 c = mix(vec3(0.05, 0.33, 0.82), vec3(0.25, 0.58, 0.28), land);
          c = mix(c, vec3(1.0), max(ice, cloud * 0.85));
          float lit = clamp(dot(vN, uSun) * 1.2 + 0.25, 0.0, 1.0);
          gl_FragColor = vec4(c * (0.12 + 0.95 * lit), 1.0);
        }
      `,
    }));
    earth.position.copy(EARTH_POS);
    moonScene.add(earth);
    const softGlow = (rgba0, rgba1) => canvasTexture(128, 128, (ctx) => {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, rgba0);
      g.addColorStop(1, rgba1);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    });
    const earthGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softGlow("rgba(46,150,245,0.8)", "rgba(46,150,245,0)"), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    earthGlow.position.copy(EARTH_POS);
    earthGlow.scale.set(30, 30, 1);
    moonScene.add(earthGlow);

    /* ---- Our rocket: landing legs, a door that lights up, a flame ---- */
    const moonRocket = rocket.clone(true);
    moonRocket.remove(moonRocket.children[0]); // no launch stand on the Moon
    moonScene.add(moonRocket);
    const legMat = std(0xc4c8cf, 0.4, 0.5);
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2; // under each fin
      const out = V(Math.cos(a), 0, -Math.sin(a));
      const top = out.clone().multiplyScalar(4.4).setY(1.7);
      const foot = out.clone().multiplyScalar(6.2).setY(0.12);
      const dir = foot.clone().sub(top);
      const leg = add(new THREE.CylinderGeometry(0.12, 0.12, dir.length(), 10), legMat, moonRocket);
      leg.position.copy(top).addScaledVector(dir, 0.5);
      leg.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
      add(new THREE.CylinderGeometry(0.5, 0.6, 0.14, 20), legMat, moonRocket, foot.x, 0.09, foot.z);
    }
    const doorZ = DOOR.z - ROCKET_Z; // door position inside the rocket group
    const moonDoorMat = new THREE.MeshBasicMaterial({ color: BRAND.electricBlue }); // closed until we land
    add(new THREE.PlaneGeometry(DOOR.w, DOOR.h), moonDoorMat, moonRocket, 0, DOOR.y, doorZ + 0.02);
    const frameMat2 = std(BRAND.electricBlue, 0.35, 0.2);
    add(new THREE.BoxGeometry(DOOR.w + 0.32, 0.16, 0.12), frameMat2, moonRocket, 0, DOOR.y + DOOR.h / 2 + 0.08, doorZ);
    add(new THREE.BoxGeometry(DOOR.w + 0.32, 0.16, 0.12), frameMat2, moonRocket, 0, DOOR.y - DOOR.h / 2 - 0.08, doorZ);
    [-1, 1].forEach((s) => add(new THREE.BoxGeometry(0.16, DOOR.h + 0.32, 0.12), frameMat2, moonRocket, s * (DOOR.w / 2 + 0.08), DOOR.y, doorZ));

    const flame = new THREE.Sprite(new THREE.SpriteMaterial({
      map: canvasTexture(128, 256, (ctx, w, h) => {
        const g = ctx.createRadialGradient(64, 40, 4, 64, 90, 120);
        g.addColorStop(0, "rgba(255,255,230,1)");
        g.addColorStop(0.25, "rgba(255,210,80,0.95)");
        g.addColorStop(0.6, "rgba(255,120,40,0.55)");
        g.addColorStop(1, "rgba(255,80,20,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    flame.center.set(0.5, 1); // hangs down from the engine
    flame.position.set(0, 0.4, 0);
    moonRocket.add(flame);

    // Dust clouds kicked up by the engine near the ground
    const dustTex = softGlow("rgba(170,170,176,0.9)", "rgba(170,170,176,0)");
    const dust = [];
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, depthWrite: false, transparent: true, opacity: 0 }));
      const a = (i / 14) * TAU;
      sp.userData.dir = V(Math.cos(a), 0, Math.sin(a));
      moonScene.add(sp);
      dust.push(sp);
    }
    const setDust = (amount, spread) => dust.forEach((sp, i) => {
      sp.position.set(sp.userData.dir.x * spread, 0.8 + (i % 3) * 0.5, ROCKET_Z + sp.userData.dir.z * spread);
      sp.scale.setScalar(3 + spread * 0.8);
      sp.material.opacity = amount * (0.55 + 0.3 * Math.sin(i * 1.7));
    });
    setDust(0, 0);

    // The ramp lowers once we've landed
    const moonRamp = buildRamp(moonScene);
    moonRamp.visible = false;
    const rampMid = RAMP_TOP.clone().lerp(RAMP_BOTTOM, 0.5);
    const setRamp = (k) => {
      moonRamp.scale.set(1, 1, Math.max(0.001, k));
      moonRamp.position.copy(RAMP_TOP).lerp(rampMid, k);
    };

    /* ---- Watch the landing ---- */
    activeScene = moonScene;
    setLocation("Moon · Tranquility Base");
    ui.screen.classList.add("outside-view"); // no helmet edge for the outside shot
    run.cleanup.push(() => ui.screen.classList.remove("outside-view"));
    cam.floatY = 0;
    cam.hop = false;
    cam.shake = 0;
    cam.pos.set(4, 1.6, -13); // standing on the surface, close to the landing spot
    moonRocket.position.y = 70;
    const rocketAim = () => V(0, moonRocket.position.y + 9, ROCKET_Z);
    {
      const aim = rocketAim();
      cam.yaw = Math.atan2(-(aim.x - cam.pos.x), -(aim.z - cam.pos.z));
      cam.pitch = Math.atan2(aim.y - cam.pos.y, Math.hypot(aim.x - cam.pos.x, aim.z - cam.pos.z));
    }
    cam.follow = rocketAim;
    const showOutside = fadeTo(0, 1.0);
    if (window.AstroAudio) window.AstroAudio.rumble(0.35, 1);
    let lastRumble = -1;
    await tween(10, (k) => {
      const y = 70 * Math.pow(1 - k, 2); // slows down gently as it gets close
      const level = Math.round((0.35 + 0.5 * k) * 20) / 20;
      if (level !== lastRumble) { lastRumble = level; if (window.AstroAudio) window.AstroAudio.rumble(level, 0.3); }
      moonRocket.position.y = y;
      flame.scale.set(2.6 * (0.85 + Math.random() * 0.3), 6 * (0.85 + Math.random() * 0.3), 1);
      const near = clamp(1 - y / 16, 0, 1);
      setDust(near, 2 + near * 7);
      cam.shake = near * 0.012;
    });
    await showOutside;

    // Down! A little bump, the flame goes out and the dust drifts away
    moonRocket.position.y = 0.04; // resting on its feet, just above the ground
    if (window.AstroAudio) window.AstroAudio.rumble(0, 0.6);
    if (window.AstroAudio) window.AstroAudio.sfx("thud");
    flame.visible = false;
    await tween(0.5, (k) => { cam.shake = 0.04 * (1 - k); });
    cam.shake = 0;
    const dustClears = tween(3, (k) => setDust(1 - k, 9 + k * 3));
    await wait(1.0);

    // The door lights up and the ramp lowers
    cam.follow = () => V(0, 3, ROCKET_Z + 4);
    const doorWarm = new THREE.Color(0xfff4d6), doorClosed = new THREE.Color(BRAND.electricBlue);
    if (window.AstroAudio) window.AstroAudio.sfx("chime");
    await tween(0.8, (k) => { moonDoorMat.color.copy(doorClosed).lerp(doorWarm, k); });
    moonRamp.visible = true;
    if (window.AstroAudio) window.AstroAudio.sfx("whir");
    await tween(1.6, (k) => setRamp(ease(k)));
    await dustClears;

    await wait(0.8);

    // Everyone is already outside: Nova and PIP join the group
    moonScene.add(commander.root, pip.root);
    commander.root.visible = true;
    commander.pose = {};
    pip.root.visible = true;
    pip.spin = 0;

    /* ---- Our moon buggy (it rode down inside the rocket): 6 wheels, 3 rows of seats ---- */
    // Local layout: front toward -z. Row 1: Nova drives (left); there's no seat beside her,
    // so we can see ahead. Row 2: us (right) + one astronaut. Row 3: a bench for three. PIP rides on the back.
    const buggy = new THREE.Group();
    const buggyWheels = [];
    const BUGGY_SEATS = {
      nova: { x: -0.55, z: -1.0, top: 0.85 },
      me: { x: 0.55, z: 0.3, top: 1.2 },
      kids: [{ x: -0.55, z: 0.3, top: 1.2 }, { x: -0.75, z: 1.55, top: 1.36 }, { x: 0, z: 1.55, top: 1.36 }, { x: 0.75, z: 1.55, top: 1.36 }],
      pip: { x: 0, z: 2.45, y: 0.55 },
    };
    {
      const rod = (parent, p, q, radius, mat) => {
        const d = q.clone().sub(p);
        const m = add(new THREE.CylinderGeometry(radius, radius, d.length(), 10), mat, parent);
        m.position.copy(p).addScaledVector(d, 0.5);
        m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
        return m;
      };
      const body = std(BRAND.white, 0.4, 0.1);
      const blueM = std(BRAND.electricBlue, 0.35, 0.2);
      const yonderM = std(BRAND.blueYonder, 0.35, 0.2);
      const tyreM = std(0x2b2e35, 0.85);
      const metalM = std(0xc4c8cf, 0.35, 0.6);
      const padM = std(BRAND.deepBlue, 0.7);
      // Chassis and low side panels
      add(new THREE.BoxGeometry(2.3, 0.3, 5.6), blueM, buggy, 0, 0.72, 0);
      [-1, 1].forEach((sx) => {
        add(new THREE.BoxGeometry(0.12, 0.42, 5.2), body, buggy, sx * 1.1, 1.05, 0);
        add(new THREE.BoxGeometry(0.14, 0.08, 5.2), yonderM, buggy, sx * 1.1, 1.28, 0);
      });
      add(new THREE.BoxGeometry(2.3, 0.5, 0.5), body, buggy, 0, 1.0, -2.55); // nose
      add(new THREE.BoxGeometry(2.3, 0.12, 0.6), blueM, buggy, 0, 1.27, -2.5);
      [-0.75, 0.75].forEach((x) => add(new THREE.SphereGeometry(0.13, 16, 10), new THREE.MeshBasicMaterial({ color: 0xfff4d6 }), buggy, x, 1.0, -2.82));
      add(new THREE.BoxGeometry(2.3, 0.2, 1.2), body, buggy, 0, 0.95, 2.3); // rear deck for PIP
      // Six chunky wheels with fenders
      for (const sx of [-1, 1]) for (const z of [-1.9, 0, 1.9]) {
        const w = new THREE.Group();
        w.position.set(sx * 1.32, 0.55, z);
        buggy.add(w);
        add(new THREE.CylinderGeometry(0.55, 0.55, 0.42, 28), tyreM, w).rotation.z = Math.PI / 2;
        add(new THREE.CylinderGeometry(0.28, 0.28, 0.44, 20), metalM, w).rotation.z = Math.PI / 2;
        add(new THREE.CylinderGeometry(0.1, 0.1, 0.46, 12), yonderM, w).rotation.z = Math.PI / 2;
        for (let k = 0; k < 8; k++) { // tread blocks so we can see the wheels turn
          const a = (k * TAU) / 8;
          add(new THREE.BoxGeometry(0.44, 0.08, 0.16), tyreM, w, 0, Math.cos(a) * 0.55, Math.sin(a) * 0.55).rotation.x = -a;
        }
        w.userData.isWheel = true;
        buggyWheels.push(w);
        const f = add(new THREE.CylinderGeometry(0.66, 0.66, 0.5, 24, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: BRAND.white, roughness: 0.4, side: THREE.DoubleSide }), buggy, sx * 1.32, 0.55, z);
        f.rotation.z = Math.PI / 2;
      }
      // Seats
      const seat = (x, z, top, w = 0.62) => {
        add(new THREE.BoxGeometry(w, top - 0.85, 0.5), blueM, buggy, x, (top + 0.85) / 2, z);
        add(new THREE.BoxGeometry(w, 0.1, 0.52), padM, buggy, x, top, z);
        const back = add(new THREE.BoxGeometry(w, 0.62, 0.1), padM, buggy, x, top + 0.34, z + 0.28);
        back.rotation.x = 0.12;
      };
      seat(BUGGY_SEATS.nova.x, BUGGY_SEATS.nova.z, BUGGY_SEATS.nova.top + 0.02);
      seat(-0.55, 0.3, 1.22);
      seat(0.55, 0.3, 1.22);
      seat(0, 1.55, 1.38, 2.0);
      // Steering wheel and a little dashboard
      add(new THREE.BoxGeometry(2.0, 0.3, 0.3), blueM, buggy, 0, 1.25, -1.75).rotation.x = -0.4;
      add(new THREE.BoxGeometry(0.5, 0.2, 0.02), new THREE.MeshBasicMaterial({ color: BRAND.blueYonder }), buggy, 0.45, 1.36, -1.6).rotation.x = -0.4;
      rod(buggy, V(-0.55, 1.2, -1.75), V(-0.55, 1.45, -1.45), 0.03, metalM);
      const wheelRing = add(new THREE.TorusGeometry(0.2, 0.03, 8, 24), metalM, buggy, -0.55, 1.47, -1.42);
      wheelRing.rotation.x = -0.9;
      // Roll bar arching over the middle row, with a little antenna
      [-1, 1].forEach((sx) => rod(buggy, V(sx * 1.08, 1.25, 0.9), V(sx * 1.08, 2.3, 0.9), 0.05, metalM));
      rod(buggy, V(-1.08, 2.3, 0.9), V(1.08, 2.3, 0.9), 0.05, metalM);
      rod(buggy, V(0.8, 2.3, 0.9), V(0.8, 2.85, 0.9), 0.015, metalM);
      add(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff8a3d }), buggy, 0.8, 2.88, 0.9);
      add(geo("buggyShadow", () => new THREE.PlaneGeometry(3.4, 6.4)), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, opacity: 0.6 }), buggy, 0, 0.015, 0)
        .rotation.x = -Math.PI / 2;
    }
    buggy.position.set(9, 0, -22);
    buggy.rotation.y = -Math.PI / 2; // parked beside the rocket, nose toward Eagle's direction
    buggy.visible = false;            // it comes out of the rocket while we cut away
    moonScene.add(buggy);
    const convoy = [].map((i) => { // (one buggy is enough for our crew)
      const v = buggy.clone(true);
      const wheels = [];
      v.traverse((o) => { if (o.userData.isWheel) wheels.push(o); });
      v.position.set(15.4 + i * 6.4, 0, -22);
      v.rotation.y = -Math.PI / 2;
      v.visible = false;
      moonScene.add(v);
      return { v, wheels };
    });

    // Riding: we watch from outside, with a camera following just behind and above the vehicle
    const ride = { vehicle: null, back: 3, up: 2.4, side: 8.5, ahead: 1, reveal: null, blend: 0 };
    function placeRideCam() {
      const v = ride.vehicle || buggy;
      v.updateMatrixWorld(true);
      cam.pos.copy(v.localToWorld(V(ride.side, ride.up, ride.back)));
      const look = v.localToWorld(V(0, 1.2, -ride.ahead));
      if (ride.reveal && ride.blend > 0) look.lerp(ride.reveal, ride.blend); // turn to see what's ahead
      cam.follow = null;
      cam.yaw = Math.atan2(-(look.x - cam.pos.x), -(look.z - cam.pos.z));
      cam.pitch = Math.atan2(look.y - cam.pos.y, Math.hypot(look.x - cam.pos.x, look.z - cam.pos.z));
    }
    function seatInBuggy(c, spot, vehicle = buggy) {
      vehicle.add(c.root);
      c.walkId = (c.walkId || 0) + 1;
      c.root.visible = true;
      if (c.kind === "robot") {
        c.root.position.set(spot.x, spot.y, spot.z);
        c.mode = "idle";
      } else {
        c.root.position.set(spot.x, 0, spot.z);
        c.sitBob = c.sitBobFor(spot.top);
        c.mode = "sit";
        c.pose = {};
      }
      c.heading = c.targetHeading = Math.PI; // facing the front of the buggy
    }
    // Drive along a curve on the ground (heightAt gives the ground height)
    function driveBuggy(points, seconds, heightAt, opts = {}) {
      const vehicle = opts.vehicle || buggy, wheels = opts.wheels || buggyWheels, wheelR = opts.wheelR || 0.55;
      const followers = opts.followers || [];
      const curve = new THREE.CatmullRomCurve3(points);
      const len = curve.getLength();
      const start = curve.getPointAt(0), dir0 = curve.getTangentAt(0);
      let prevU = 0;
      ride.blend = 0;
      return tween(seconds, (k) => {
        if (opts.reveal) { ride.reveal = opts.reveal; ride.blend = smooth01((k - 0.45) / 0.5); }
        const u = k < 0.15 ? (k * k) / 0.3 : k > 0.85 ? 1 - ((1 - k) * (1 - k)) / 0.3 : (k - 0.075) / 0.85; // smooth start and stop
        const uu = clamp(u, 0, 1);
        const p = curve.getPointAt(uu), tan = curve.getTangentAt(uu);
        vehicle.position.set(p.x, heightAt(p.x, p.z) + Math.sin(uu * len * 1.7) * 0.025, p.z);
        vehicle.rotation.y = Math.atan2(-tan.x, -tan.z);
        const dist = (uu - prevU) * len;
        prevU = uu;
        wheels.forEach((w) => { w.rotation.x -= dist / wheelR; });
        // The other vehicles follow in a line behind
        for (const f of followers) {
          const along = uu * len - f.lag;
          const fp = along >= 0 ? curve.getPointAt(along / len) : start.clone().addScaledVector(dir0, along);
          const ft = along >= 0 ? curve.getTangentAt(along / len) : dir0;
          f.v.position.set(fp.x, heightAt(fp.x, fp.z), fp.z);
          f.v.rotation.y = Math.atan2(-ft.x, -ft.z);
          f.wheels.forEach((w) => { w.rotation.x -= dist / wheelR; });
        }
        placeRideCam();
      });
    }

    /* ---- Cut: everyone gathered around Nova and PIP ---- */
    await fadeTo(1, 0.7, "#000000");
    ui.screen.classList.remove("outside-view"); // back to seeing through our own helmet
    buggy.visible = true; // our moon buggies, unloaded and parked beside the rocket
    convoy.forEach((c) => { c.v.visible = true; });
    const CENTER = V(0, 0, -13);
    commander.root.position.copy(CENTER);
    pip.root.position.copy(CENTER).add(V(1.0, 0, -0.2));
    cam.pos.copy(CENTER).add(V(0, EYE, 2.5));           // we're in the circle, close to Nova
    commander.heading = commander.targetHeading = facing(commander.root.position, cam.pos);
    pip.heading = pip.targetHeading = facing(pip.root.position, cam.pos);
    pip.mode = "excited";
    commander.mode = "idle";
    // Everyone gathers round. Only the two on each side of Nova peek into the frame;
    // the rest of the circle is beside and behind us.
    const sideSpots = [V(-1.9, 0, -12.1), V(-2.6, 0, -13.7), V(1.9, 0, -12.1), V(2.6, 0, -13.7)];
    kidsIn.forEach((c, i) => {
      const spot = sideSpots[i];
      c.root.visible = !!spot;
      if (!spot) return;
      moonScene.add(c.root);
      c.root.position.copy(spot);
      c.heading = c.targetHeading = facing(spot, CENTER);
      c.pose = {};
      c.mode = "cheer";
    });
    commander.root.updateMatrixWorld(true);
    {
      const look = novaLook();
      cam.follow = null;
      cam.yaw = Math.atan2(-(look.x - cam.pos.x), -(look.z - cam.pos.z));
      cam.pitch = Math.atan2(look.y - cam.pos.y, Math.hypot(look.x - cam.pos.x, look.z - cam.pos.z));
    }
    await fadeTo(0, 0.8);
    await wait(0.6);
    commander.mode = "talk";
    await say(NAMES.commander, LINES.moonEnd);
    hideDialogue();
    commander.mode = "idle";
    await wait(0.8);

    /* ================================================================== */
    /* OUR FIRST FORGOTTEN EXPLORER: the Apollo 11 Lunar Module "Eagle"    */
    /* Only its bottom half (the descent stage) was left on the Moon.      */
    /* Sizes follow NASA's description: an octagon 4.2 m across and 1.7 m  */
    /* thick, its bottom 1.5 m above the ground, four legs with round      */
    /* footpads 9.4 m apart, a 1 m engine cone, a ladder and small platform */
    /* on one leg, and a plaque on the strut behind the ladder.            */
    /* ================================================================== */

    // Positions around Eagle: (r, y, f) where f points toward us as we arrive and r is to our right
    const at = (r, y, f) => V(EAGLE.x + r, y, EAGLE.z + f);

    const beam = (parent, a, b, radius, mat) => {
      const d = b.clone().sub(a);
      const m = add(new THREE.CylinderGeometry(radius, radius, d.length(), 10), mat, parent);
      m.position.copy(a).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
      return m;
    };

    const foilMat = new THREE.MeshStandardMaterial({
      map: canvasTexture(512, 256, (ctx, w, h) => {
        ctx.fillStyle = "#C9971F";
        ctx.fillRect(0, 0, w, h);
        const r = mulberry32(31);
        for (let i = 0; i < 260; i++) { // crinkly gold foil
          ctx.fillStyle = r() < 0.5 ? `rgba(240,200,95,${0.25 + r() * 0.35})` : `rgba(120,85,15,${0.2 + r() * 0.3})`;
          ctx.beginPath();
          const x = r() * w, y = r() * h;
          ctx.moveTo(x, y);
          for (let k = 0; k < 4; k++) ctx.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 40);
          ctx.fill();
        }
      }),
      metalness: 0.75, roughness: 0.35,
    });
    const lmSilver = std(0xc9ccd2, 0.35, 0.7);
    const lmDark = std(0x2a2b30, 0.6, 0.3);
    const lmStrut = std(0xbfae7a, 0.35, 0.7);

    const eagle = new THREE.Group();
    eagle.position.copy(EAGLE);
    moonScene.add(eagle);
    const R8 = 2.1 / Math.cos(Math.PI / 8); // octagon 4.2 m across
    add(new THREE.CylinderGeometry(R8, R8, 1.7, 8), foilMat, eagle, 0, 2.35, 0).rotation.y = Math.PI / 8;
    [1.575, 3.125].forEach((y) => { add(new THREE.CylinderGeometry(R8 * 1.01, R8 * 1.01, 0.12, 8), lmDark, eagle, 0, y, 0).rotation.y = Math.PI / 8; });
    add(new THREE.CylinderGeometry(R8 * 0.98, R8 * 0.98, 0.05, 8), lmSilver, eagle, 0, 3.235, 0).rotation.y = Math.PI / 8;
    for (let k = 0; k < 4; k++) { // fittings where the top half used to sit
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      add(new THREE.BoxGeometry(0.25, 0.12, 0.25), lmDark, eagle, Math.cos(a) * 1.2, 3.3, Math.sin(a) * 1.2);
    }
    add(new THREE.CylinderGeometry(0.45, 0.8, 1.0, 24, 1, true), lmDark, eagle, 0, 1.0, 0); // engine cone
    for (let k = 0; k < 4; k++) { // four legs with round footpads
      const a = (k * Math.PI) / 2;
      const dir = V(Math.sin(a), 0, Math.cos(a)); // k = 0 is the ladder leg, facing us
      const perp = V(dir.z, 0, -dir.x);
      const top = dir.clone().multiplyScalar(2.15).setY(3.0);
      const foot = dir.clone().multiplyScalar(4.6).setY(0.25);
      beam(eagle, top, foot, 0.075, lmStrut);
      const knee = foot.clone().lerp(top, 0.35);
      [-1, 1].forEach((s) => beam(eagle, dir.clone().multiplyScalar(1.95).addScaledVector(perp, s * 0.9).setY(1.55), knee, 0.05, lmStrut));
      add(new THREE.CylinderGeometry(0.47, 0.4, 0.14, 24), lmSilver, eagle, foot.x, 0.07, foot.z);
    }
    // Ladder and small platform on the front leg
    const LT = V(0, 3.0, 2.15), LP = V(0, 0.25, 4.6);
    const ld = LP.clone().sub(LT);
    const ladderLen = ld.length();
    ld.normalize();
    const ln = V(0, ld.z, -ld.y); // points out and up from the strut
    [-0.24, 0.24].forEach((x) => beam(eagle, LT.clone().addScaledVector(ln, 0.14).setX(x), LP.clone().addScaledVector(ln, 0.14).setX(x), 0.025, lmSilver));
    for (let i = 1; i < 15; i++) {
      const p = LT.clone().addScaledVector(ld, (ladderLen * i) / 15).addScaledVector(ln, 0.14);
      beam(eagle, p.clone().setX(-0.24), p.clone().setX(0.24), 0.018, lmSilver);
    }
    add(new THREE.BoxGeometry(1.0, 0.05, 0.8), lmSilver, eagle, 0, 3.05, 2.55);
    // The plaque, on the strut behind the ladder
    const plaque = add(new THREE.PlaneGeometry(0.5, 0.38), new THREE.MeshStandardMaterial({
      map: canvasTexture(512, 390, (ctx, w, h) => {
        ctx.fillStyle = "#D9DCE1";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#3A3D44";
        ctx.lineWidth = 8;
        ctx.strokeRect(10, 10, w - 20, h - 20);
        ctx.lineWidth = 3;
        [170, 342].forEach((x) => { ctx.beginPath(); ctx.arc(x, 92, 58, 0, TAU); ctx.stroke(); }); // the two halves of Earth
        ctx.fillStyle = "#23262C";
        ctx.textAlign = "center";
        ctx.font = '700 26px "Fira Sans", Arial, sans-serif';
        ["HERE MEN FROM THE PLANET EARTH", "FIRST SET FOOT ON THE MOON", "JULY 1969, A.D.", "WE CAME IN PEACE FOR ALL MANKIND"]
          .forEach((t, i) => ctx.fillText(t, w / 2, 200 + i * 40));
      }),
      metalness: 0.4, roughness: 0.4,
    }), eagle);
    plaque.position.copy(LT).addScaledVector(ld, ladderLen * 0.75).addScaledVector(ln, 0.2);
    plaque.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(1, 0, 0), ld.clone().negate(), ln));
    const PLAQUE_POS = plaque.position.clone().add(EAGLE);

    // The flag
    const FLAG = at(-6.5, 0, 2);
    beam(moonScene, FLAG, FLAG.clone().setY(2.1), 0.022, lmSilver);
    beam(moonScene, FLAG.clone().setY(2.05), FLAG.clone().add(V(0.92, 2.05, 0)), 0.015, lmSilver);
    add(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshStandardMaterial({
      map: canvasTexture(190, 100, (ctx, w, h) => {
        for (let i = 0; i < 13; i++) { ctx.fillStyle = i % 2 ? "#FFFFFF" : "#B22234"; ctx.fillRect(0, (i * h) / 13, w, h / 13 + 0.5); }
        ctx.fillStyle = "#3C3B6E";
        ctx.fillRect(0, 0, w * 0.4, h * (7 / 13));
        ctx.fillStyle = "#FFFFFF";
        for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) ctx.fillRect(5 + x * 12, 5 + y * 10, 3, 3);
      }),
      side: THREE.DoubleSide, roughness: 0.8,
    }), moonScene, FLAG.x + 0.46, 1.74, FLAG.z);

    // Science left behind: the seismometer package (EASEP) and the laser mirror (retroreflector)
    const EASEP = at(7.5, 0, 10);
    const easep = new THREE.Group();
    easep.position.copy(EASEP);
    moonScene.add(easep);
    add(new THREE.BoxGeometry(0.65, 0.32, 0.65), foilMat, easep, 0, 0.16, 0);
    add(new THREE.CylinderGeometry(0.18, 0.2, 0.22, 20), foilMat, easep, -0.08, 0.43, -0.05); // seismometer
    add(new THREE.BoxGeometry(0.14, 0.1, 0.14), lmSilver, easep, 0.2, 0.37, 0.2);                // dust detector
    beam(easep, V(0.22, 0.32, -0.22), V(0.22, 1.05, -0.22), 0.02, lmSilver);                     // antenna mast
    add(new THREE.ConeGeometry(0.13, 0.1, 20, 1, true), lmSilver, easep, 0.22, 1.08, -0.22).rotation.x = Math.PI;
    const cellsTex = canvasTexture(256, 160, (ctx, w, h) => {
      ctx.fillStyle = "#07173F";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#2E96F5";
      ctx.lineWidth = 2;
      for (let x = 0; x <= w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y <= h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    });
    [-1, 1].forEach((s) => { // two solar panels, tilted to face east and west
      beam(easep, V(s * 0.32, 0.22, 0), V(s * 0.62, 0.36, 0), 0.02, lmSilver);
      const panel = add(new THREE.BoxGeometry(0.9, 0.03, 0.62), new THREE.MeshStandardMaterial({ map: cellsTex, roughness: 0.3, metalness: 0.3 }), easep, s * 1.0, 0.45, 0);
      panel.rotation.z = s * 0.45;
    });
    const MIRROR = at(4.6, 0, 13);
    solid(moonScene, EAGLE, 2.6);
    solid(moonScene, EASEP, 0.8);
    solid(moonScene, MIRROR, 0.5);
    solid(moonScene, V(0, 0, ROCKET_Z), 6.4);
    const mirror = new THREE.Group();
    mirror.position.copy(MIRROR);
    moonScene.add(mirror);
    [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]].forEach(([x, z]) => beam(mirror, V(x, 0, z), V(x, 0.18, z), 0.015, lmSilver));
    add(new THREE.BoxGeometry(0.62, 0.06, 0.5), lmSilver, mirror, 0, 0.2, 0);
    const reflector = add(new THREE.BoxGeometry(0.46, 0.04, 0.46), new THREE.MeshStandardMaterial({
      map: canvasTexture(200, 200, (ctx, w, h) => {
        ctx.fillStyle = "#3A3D44";
        ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
          ctx.fillStyle = "#9FD3FF";
          ctx.beginPath(); ctx.arc(10 + x * 20, 10 + y * 20, 7, 0, TAU); ctx.fill();
        }
      }),
      metalness: 0.6, roughness: 0.2,
    }), mirror, 0, 0.36, 0);
    reflector.rotation.x = -0.5;

    // Footprint trails all around the landing site, plus a few rocks
    const lmPrintMat = new THREE.MeshStandardMaterial({
      map: canvasTexture(128, 256, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "rgba(55,57,63,0.8)";
        ctx.beginPath(); ctx.ellipse(64, 80, 46, 68, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(64, 200, 38, 46, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = "rgba(140,142,148,0.9)";
        ctx.lineWidth = 6;
        for (let y = 30; y < 240; y += 22) { ctx.beginPath(); ctx.moveTo(26, y); ctx.lineTo(102, y); ctx.stroke(); }
      }),
      transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const printGeo = new THREE.PlaneGeometry(0.2, 0.4);
    const printTrail = (pts, parent = moonScene) => {
      let side = 1;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
        const steps = Math.floor(len / 0.38);
        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const m = add(printGeo, lmPrintMat, parent, a.x + dx * t + (-dz / len) * 0.12 * side, 0.012, a.z + dz * t + (dx / len) * 0.12 * side);
          m.rotation.x = -Math.PI / 2;
          m.rotation.z = Math.atan2(-dx, -dz);
          side = -side;
        }
      }
    };
    const pr = mulberry32(1969);
    const ladderFoot = at(0, 0, 5.1);
    printTrail([ladderFoot, at(-3, 0, 4.2), at(-6.1, 0, 2.7)]);   // to the flag
    printTrail([ladderFoot, at(3.5, 0, 7), at(7.2, 0, 9.4)]);     // to the seismometer
    printTrail([at(7.2, 0, 9.6), at(4.8, 0, 12.4)]);              // to the laser mirror
    for (let w = 0; w < 4; w++) { // wandering around
      const pts = [ladderFoot.clone()];
      for (let k = 0; k < 5; k++) pts.push(pts[pts.length - 1].clone().add(V((pr() - 0.5) * 6, 0, 1 + pr() * 2.5)));
      printTrail(pts);
    }
    for (let i = 0; i < 70; i++) {
      const a = pr() * TAU, d = 6 + pr() * 20;
      const rock = add(geo("rock", () => new THREE.DodecahedronGeometry(1, 0)), std(0x8d9097, 1), moonScene, EAGLE.x + Math.cos(a) * d, 0, EAGLE.z + Math.sin(a) * d);
      rock.scale.set(0.1 + pr() * 0.3, 0.06 + pr() * 0.18, 0.1 + pr() * 0.3);
      rock.rotation.set(pr() * 3, pr() * 3, pr() * 3);
    }

    /* ---- Moving the group from stop to stop ---- */
    const sideKids = kidsIn.slice(0, 4);
    // The other astronauts follow just behind us
    function flankSpots(camPos, lookPoint) {
      const f = V(lookPoint.x - camPos.x, 0, lookPoint.z - camPos.z).normalize();
      const rgt = V(-f.z, 0, f.x);
      const base = V(camPos.x, 0, camPos.z);
      return [
        base.clone().addScaledVector(rgt, -1.2).addScaledVector(f, -1.6),
        base.clone().addScaledVector(rgt, -2.2).addScaledVector(f, -2.2),
        base.clone().addScaledVector(rgt, 1.2).addScaledVector(f, -1.6),
        base.clone().addScaledVector(rgt, 2.2).addScaledVector(f, -2.2),
      ];
    }
    // Everyone hops to the next stop together. Nova and PIP lead; the other astronauts
    // hop alongside us in their own lanes (left and right of our path) at our pace,
    // so nobody is passed or walked through. As soon as we and Nova arrive, she talks.
    const HOP_SPEED = 2.4;
    async function goTo(stop) {
      const from = cam.pos.clone();
      const path = stop.camPath;
      let len = 0;
      path.reduce((p, q) => { len += p.distanceTo(q); return q; }, from);
      const camTime = len / HOP_SPEED;
      const flat = (p) => V(p.x, 0, p.z);
      const dirAt = (i) => { const p = i === 0 ? from : path[i - 1], q = path[i]; return V(q.x - p.x, 0, q.z - p.z).normalize(); };
      const rightOf = (d) => V(-d.z, 0, d.x);
      // Lanes keep each astronaut on the side of our path they're already on
      const r0 = rightOf(dirAt(0));
      const side = (c) => flat(c.root.position).sub(flat(from)).dot(r0);
      const bySide = sideKids.slice().sort((p, q) => side(p) - side(q));
      const LANES = [-2.4, -1.3, 1.3, 2.4];
      // Final spots beside / just behind us, matched to the lanes so nobody crosses our path
      const rEnd = rightOf(dirAt(path.length - 1));
      const endPos = flat(path[path.length - 1]);
      const spots = flankSpots(stop.cam, stop.look).sort((p, q) => p.clone().sub(endPos).dot(rEnd) - q.clone().sub(endPos).dot(rEnd));

      cam.follow = () => stop.look; // look steadily at where we're headed
      const kidHops = bySide.map((c, i) => {
        const pts = [];
        for (let k = 0; k < path.length - 1; k++) {
          const d = dirAt(k).add(dirAt(k + 1)).normalize();
          pts.push(flat(path[k]).addScaledVector(rightOf(d), LANES[i]).addScaledVector(d, -0.6));
        }
        pts.push(spots[i]);
        pts.forEach((p) => {
          for (const o of obstacles) {
            if (o.sc !== activeScene) continue;
            const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), r = o.r + 0.6;
            if (d < r && d > 1e-4) { p.x = o.x + (dx / d) * r; p.z = o.z + (dz / d) * r; }
          }
        });
        let L = 0;
        pts.reduce((p, q) => { L += p.distanceTo(q); return q; }, c.root.position.clone());
        return walkTo(c, pts, clamp(L / Math.max(camTime, 0.6), 1.2, 3.6), { face: stop.look })
          .then(() => { c.mode = "idle"; });
      });
      kidHops.forEach((p) => p.catch(() => {}));
      await Promise.all([
        walkTo(commander, stop.novaPath, HOP_SPEED + 0.3, { face: stop.cam }),
        walkTo(pip, stop.pipPath, HOP_SPEED + 0.3, { face: stop.cam }),
        walkCamera(path, HOP_SPEED),
      ]);
      commander.targetHeading = facing(commander.root.position, cam.pos);
    }

    // 1) Walk over to Eagle. It comes into view as we head toward it.
    await goTo({
      cam: at(0, EYE, 11), look: at(-0.8, 1.8, 0),
      camPath: [V(14, EYE, -6.4), at(0, EYE, 11)],
      novaPath: [V(12, 0, -10.8), at(-2.4, 0, 7.6)],
      pipPath: [V(12.5, 0, -9.6), at(-1.3, 0, 8.2)],
    });
    commander.mode = "talk";
    if (window.AstroAudio) window.AstroAudio.sfx("sparkle"); // there it is!
    foundToday("Apollo 11 Lunar Module Eagle");
    for (const line of LINES.eagle.arrive) await say(NAMES.commander, line);
    await say(NAMES.commander, LINES.eagle.twoParts);
    hideDialogue();

    // 2) The ladder, then step right up to read the plaque
    await goTo({
      cam: at(1.2, EYE, 8.2), look: at(-0.3, 1.5, 3.6),
      camPath: [at(1.2, EYE, 8.2)],
      novaPath: [at(-1.8, 0, 6.2)],
      pipPath: [at(-2.7, 0, 6.8)],
    });
    commander.mode = "talk";
    await say(NAMES.commander, LINES.eagle.ladder);
    hideDialogue();
    cam.follow = () => PLAQUE_POS;
    await walkCamera([at(0.5, EYE, 6.6), V(PLAQUE_POS.x, EYE, PLAQUE_POS.z + 1.0)], 1.8);
    await lookAtPoint(PLAQUE_POS, 0.6);
    await say(NAMES.commander, LINES.eagle.plaque);
    hideDialogue();
    cam.follow = () => at(-0.3, 1.5, 3.6);
    await walkCamera([at(0.5, EYE, 6.8)], 1.8); // step back

    // 3) The flag and the footprints
    printTrail([at(-3.4, 0, 6.6), at(-4.6, 0, 5.8), at(-6.0, 0, 4.6)]); // a fresh-looking trail right in front of us
    await goTo({
      cam: at(-4.2, EYE, 7.6), look: at(-5.6, 1.4, 2.4),
      camPath: [at(-2.2, EYE, 7.8), at(-4.2, EYE, 7.6)],
      novaPath: [at(-4.6, 0, 3.6)],
      pipPath: [at(-3.5, 0, 3.9)],
    });
    commander.mode = "talk";
    await say(NAMES.commander, LINES.eagle.flag);
    hideDialogue();
    await lookAtPoint(at(-4.6, 0, 5.9), 1.2); // look down at the footprints
    await say(NAMES.commander, LINES.eagle.steps);
    await say(NAMES.commander, LINES.eagle.rocks);
    hideDialogue();

    // 4) The science experiments they left behind
    await goTo({
      cam: at(6.0, EYE, 16.6), look: at(6.6, 0.5, 11.2),
      camPath: [at(0.5, EYE, 12.5), at(6.0, EYE, 16.6)],
      novaPath: [at(2, 0, 9.5), at(9.4, 0, 11.8)],
      pipPath: [at(3, 0, 10.5), at(9.0, 0, 13.4)],
    });
    commander.mode = "talk";
    for (const line of LINES.eagle.science) await say(NAMES.commander, line);
    hideDialogue();
    await lookAtPoint(MIRROR.clone().setY(0.3), 1.2);
    await say(NAMES.commander, LINES.eagle.mirror);
    hideDialogue();

    // Finale: Eagle in the background, Nova and PIP in front
    commander.mode = "idle";
    await Promise.all([
      walkTo(commander, [at(3.0, 0, 12.2)], 2.2, { face: cam.pos }),
      (async () => { await wait(0.3); await walkTo(pip, [at(7.0, 0, 12.2), at(4.2, 0, 11.4)], 2.2, { face: cam.pos }); })(),
      lookAtPoint(at(1.8, 1.6, 8.0), 1.6),
    ]);
    commander.mode = "talk";
    await say(NAMES.commander, LINES.eagle.end);
    commander.mode = "idle";
    pip.mode = "excited";
    if (window.AstroAudio) window.AstroAudio.sfx("sparkle"); // mission complete
    await say(NAMES.robot, LINES.eagle.pipQuestions);
    hideDialogue();
    await askPip("lunar-module");
    commander.mode = "talk";
    await say(NAMES.commander, LINES.eagle.next);
    hideDialogue();
    commander.mode = "idle";
    await wait(0.3);
    await fadeTo(1, 1.0, "#000000");

    /* ================================================================== */
    /* OUR SECOND FORGOTTEN EXPLORER: the Apollo 15 Lunar Roving Vehicle   */
    /* Hadley, at the foot of the Apennine Mountains. Nearby: the bottom   */
    /* half of the lunar module Falcon, the memorial plaque and figure,    */
    /* and the ALSEP science station with its power generator.             */
    /* ================================================================== */

    for (const c of characters) c.walkId = (c.walkId || 0) + 1; // stop any walks still going at Eagle


    const hadley = new THREE.Scene();
    hadley.background = new THREE.Color(0x000000);
    hadley.environment = scene.environment;
    hadley.add(new THREE.HemisphereLight(0x8090b0, 0x55575c, 0.6));
    const hSun = new THREE.DirectionalLight(BRAND.white, 2.8);
    hSun.position.set(62, 34, 28);
    hadley.add(hSun);
    const hFill = new THREE.DirectionalLight(BRAND.blueYonder, 0.45);
    hFill.position.set(-30, 60, 120);
    hadley.add(hFill);

    const ROVER = V(-20, 0, -9);   // the Lunar Roving Vehicle, parked with its front toward -z
    const FALCON = V(-27, 0, -19); // the bottom half of Falcon
    const ALSEP = V(-29, 0, -1.5); // the ALSEP central station
    const MEM = V(-12.6, 0, -5.6); // the memorial plaque and little figure

    /* ---- Ground: flat where we explore, Hadley Rille to the west, the Apennines all along the horizon ---- */
    const hr = mulberry32(1971);
    const hCraters = [];
    for (let i = 0; i < 45; i++) {
      const a = hr() * TAU, d = 40 + hr() * 200;
      hCraters.push({ x: -14 + Math.cos(a) * d, z: -10 + Math.sin(a) * d, r: 3 + Math.pow(hr(), 2) * 16, depth: 0.4 + hr() * 0.5 });
    }
    const peaks = [];
    for (let i = 0; i < 17; i++) {
      const a = Math.PI * 0.7 + (i / 16) * Math.PI * 1.25 + (hr() - 0.5) * 0.12;
      const d = 250 + hr() * 70;
      peaks.push({ x: -14 + Math.cos(a) * d, z: -10 + Math.sin(a) * d, r: 38 + hr() * 26, h: 26 + hr() * 30 });
    }
    const rilleX = (z) => -56 + 7 * Math.sin(z * 0.04 + 1) + 3 * Math.sin(z * 0.11);
    function hadleyHeight(x, z) {
      const ax = 0, az = -22, bx = -24, bz = -8;
      const seg = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2), 0, 1);
      const flat = smooth01((Math.hypot(x - (ax + (bx - ax) * seg), z - (az + (bz - az) * seg)) - 22) / 14);
      let h = (noise2(x * 0.05 + 40, z * 0.05) - 0.5) * 3 + (noise2(x * 0.2, z * 0.2 + 9) - 0.5) * 0.6;
      for (const c of hCraters) {
        const d = Math.hypot(x - c.x, z - c.z) / c.r;
        if (d < 1.6) {
          let v = d < 1 ? (d * d - 1) * 0.9 : 0;
          v += Math.exp(-Math.pow((d - 1) / 0.22, 2)) * 0.45;
          h += v * c.depth * c.r * 0.25;
        }
      }
      h *= flat;
      const dd = Math.abs(x - rilleX(z)) / 12; // the rille: a long, winding channel
      if (dd < 1.6) h += (dd < 1 ? -9 * Math.pow(1 - dd * dd, 1.5) : 0) + Math.exp(-Math.pow((dd - 1) / 0.25, 2)) * 1.2;
      // The mountains rise far away on the horizon; the ground where we explore stays level
      const far = smooth01((Math.hypot(x + 14, z + 10) - 120) / 70);
      if (far > 0) for (const p of peaks) h += far * p.h * Math.exp(-((x - p.x) ** 2 + (z - p.z) ** 2) / (p.r * p.r));
      return h;
    }
    {
      const g = new THREE.PlaneGeometry(900, 900, 150, 150);
      const gp = g.attributes.position;
      for (let i = 0; i < gp.count; i++) gp.setZ(i, hadleyHeight(gp.getX(i), -gp.getY(i)));
      g.computeVertexNormals();
      const ground = new THREE.Mesh(g, moonGround.material);
      ground.rotation.x = -Math.PI / 2;
      hadley.add(ground);
    }
    hadley.add(moonStars.clone());
    const hEarth = earth.clone();
    hEarth.position.set(-175, 62, -95);
    hadley.add(hEarth);
    const hEarthGlow = earthGlow.clone();
    hEarthGlow.position.copy(hEarth.position);
    hadley.add(hEarthGlow);

    /* ---- Falcon: its bottom half (the descent stage), like Eagle's ---- */
    solid(hadley, ROVER, 1.9);
    solid(hadley, FALCON, 2.6);
    solid(hadley, ALSEP, 0.5);
    const falcon = eagle.clone(true);
    falcon.children[eagle.children.indexOf(plaque)].removeFromParent(); // Eagle's plaque stays with Eagle
    falcon.position.copy(FALCON);
    hadley.add(falcon);

    /* ---- The Lunar Roving Vehicle ---- */
    const roverGroup = new THREE.Group();
    roverGroup.position.copy(ROVER);
    hadley.add(roverGroup);
    {
      const P = roverGroup;
      const alu = std(0xc9ccd2, 0.35, 0.7);
      const dark = std(0x3a3d44, 0.6, 0.3);
      const fender = std(0xa9b0b9, 0.5, 0.3);
      const web = std(0x7f9bb8, 0.85, 0);
      const meshTex = canvasTexture(512, 64, (ctx, w, h) => { // woven wire mesh with metal chevron treads
        ctx.fillStyle = "#77715f";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(210,200,165,0.6)";
        ctx.lineWidth = 1;
        for (let x = -h; x < w + h; x += 6) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + h, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        ctx.strokeStyle = "#dde1e6";
        ctx.lineWidth = 6;
        for (let x = 4; x < w; x += 24) { ctx.beginPath(); ctx.moveTo(x, 5); ctx.lineTo(x + 10, h / 2); ctx.lineTo(x, h - 5); ctx.stroke(); }
      });
      meshTex.wrapS = THREE.RepeatWrapping;
      const tyre = new THREE.MeshStandardMaterial({ map: meshTex, roughness: 0.7, metalness: 0.4 });
      const WR = 0.41, TRACK = 0.915, BASE = 1.145;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const wheel = new THREE.Group();
        wheel.position.set(sx * TRACK, WR, sz * BASE);
        P.add(wheel);
        add(new THREE.CylinderGeometry(WR, WR, 0.23, 40, 1, false), [tyre, dark, dark], wheel).rotation.z = Math.PI / 2;
        add(new THREE.CylinderGeometry(0.12, 0.12, 0.27, 20), alu, wheel).rotation.z = Math.PI / 2;
        [-1, 1].forEach((s) => add(new THREE.TorusGeometry(WR, 0.016, 8, 40), alu, wheel, s * 0.115, 0, 0).rotation.y = Math.PI / 2);
        // Fender arching over the top of the wheel
        const f = add(new THREE.CylinderGeometry(WR + 0.08, WR + 0.08, 0.3, 24, 1, true, 0, Math.PI), fender, P, sx * TRACK, WR, sz * BASE);
        f.rotation.z = Math.PI / 2;
        f.material.side = THREE.DoubleSide;
        // Suspension arm from the chassis to the hub
        beam(P, V(sx * 0.5, 0.58, sz * (BASE - 0.35)), V(sx * (TRACK - 0.12), WR, sz * BASE), 0.03, alu);
      }
      // Chassis
      add(new THREE.BoxGeometry(1.1, 0.08, 2.4), alu, P, 0, 0.6, 0);
      [-1, 1].forEach((s) => add(new THREE.BoxGeometry(0.06, 0.12, 2.6), alu, P, s * 0.56, 0.62, 0));
      // Front: batteries and electronics with white radiator tops
      add(new THREE.BoxGeometry(1.0, 0.22, 0.55), foilMat, P, 0, 0.75, -1.02);
      add(new THREE.BoxGeometry(0.98, 0.02, 0.5), std(0xf2f4f7, 0.2, 0.2), P, 0, 0.87, -1.02);
      // TV camera on its mast at the very front
      beam(P, V(0, 0.86, -1.2), V(0, 1.15, -1.3), 0.02, alu);
      add(new THREE.BoxGeometry(0.16, 0.13, 0.24), std(0xe8eaee, 0.4, 0.2), P, 0, 1.22, -1.32);
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 16), dark, P, 0, 1.22, -1.47).rotation.x = Math.PI / 2;
      // Umbrella-shaped high-gain antenna (wire mesh) and the thin low-gain antenna
      const dish = new THREE.Group();
      dish.position.set(0.32, 1.72, -1.0);
      dish.rotation.set(0.55, 0, 0.35);
      P.add(dish);
      beam(P, V(0.32, 0.86, -1.05), V(0.32, 1.7, -1.0), 0.018, alu);
      add(new THREE.SphereGeometry(0.5, 24, 6, 0, TAU, 0, 0.62), new THREE.MeshStandardMaterial({ color: 0xd8d2bf, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide }), dish, 0, 0.5, 0)
        .rotation.x = Math.PI;
      add(new THREE.SphereGeometry(0.5, 12, 6, 0, TAU, 0, 0.62), new THREE.MeshBasicMaterial({ color: 0x8c8676, wireframe: true }), dish, 0, 0.505, 0)
        .rotation.x = Math.PI;
      beam(P, V(-0.38, 0.86, -1.1), V(-0.38, 1.55, -1.1), 0.012, alu);
      {
        const pts = [];
        for (let i = 0; i <= 60; i++) pts.push(V(-0.38 + Math.cos(i * 0.7) * 0.035, 1.2 + i * 0.009, -1.1 + Math.sin(i * 0.7) * 0.035));
        add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.006, 5), alu, P);
      }
      // Control console with dials, and the T-shaped hand controller between the seats
      beam(P, V(0, 0.64, -0.55), V(0, 0.98, -0.5), 0.025, alu);
      const consoleBox = add(new THREE.BoxGeometry(0.42, 0.3, 0.06), new THREE.MeshStandardMaterial({
        map: canvasTexture(210, 150, (ctx, w, h) => {
          ctx.fillStyle = "#2f3238";
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = "#dde1e6";
          ctx.lineWidth = 3;
          [[45, 45], [105, 45], [165, 45]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 12, y - 12); ctx.stroke(); });
          ctx.fillStyle = "#9aa0a8";
          for (let i = 0; i < 8; i++) ctx.fillRect(18 + i * 23, 100, 12, 26);
        }),
        roughness: 0.5,
      }), P, 0, 1.08, -0.48);
      consoleBox.rotation.x = -0.45;
      beam(P, V(0, 0.64, -0.05), V(0, 0.92, -0.08), 0.02, dark);
      beam(P, V(-0.08, 0.93, -0.08), V(0.08, 0.93, -0.08), 0.018, dark);
      // Two seats made of tubes and woven straps
      [-1, 1].forEach((s) => {
        const x = s * 0.33;
        add(new THREE.BoxGeometry(0.44, 0.03, 0.46), web, P, x, 0.78, 0.1);
        const back = add(new THREE.BoxGeometry(0.44, 0.48, 0.03), web, P, x, 1.02, 0.36);
        back.rotation.x = -0.18;
        [-1, 1].forEach((k) => {
          beam(P, V(x + k * 0.22, 0.64, -0.12), V(x + k * 0.22, 0.8, -0.12), 0.015, alu);
          beam(P, V(x + k * 0.22, 0.78, 0.33), V(x + k * 0.22, 1.25, 0.41), 0.015, alu);
        });
        beam(P, V(x - 0.25, 0.92, -0.08), V(x - 0.25, 0.92, 0.3), 0.012, alu); // armrest
      });
      // Back: a rack for tools and sample bags
      add(new THREE.BoxGeometry(0.9, 0.04, 0.42), alu, P, 0, 0.78, 1.05);
      [-0.3, 0, 0.3].forEach((x, i) => {
        beam(P, V(x, 0.8, 0.95), V(x + 0.05, 1.45, 1.12), 0.012, alu);  // tongs, scoop and rake handles
        add(new THREE.BoxGeometry(0.1, 0.06, 0.04), dark, P, x + 0.05, 1.46, 1.12).rotation.z = i * 0.4;
      });
      add(new THREE.BoxGeometry(0.34, 0.2, 0.22), std(0xe6e8ec, 0.7), P, -0.22, 0.9, 1.08); // sample bags
      add(new THREE.BoxGeometry(0.22, 0.16, 0.2), std(0xb9bec6, 0.7), P, 0.24, 0.88, 1.1);
      add(geo("roverShadow", () => new THREE.PlaneGeometry(2.6, 3.4)), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, opacity: 0.6 }), P, 0, 0.015, 0)
        .rotation.x = -Math.PI / 2;
    }

    /* ---- Wheel tracks winding off toward the rille, the mountains, and back to us ---- */
    const trackTex = canvasTexture(64, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(70,72,78,0.45)";
      ctx.fillRect(4, 0, w - 8, h);
      ctx.strokeStyle = "rgba(45,47,52,0.85)";
      ctx.lineWidth = 5;
      for (let y = 6; y < h; y += 16) { ctx.beginPath(); ctx.moveTo(8, y + 8); ctx.lineTo(w / 2, y); ctx.lineTo(w - 8, y + 8); ctx.stroke(); }
    });
    const trackMat = new THREE.MeshStandardMaterial({ map: trackTex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const tracks = [
      [V(-20, 0, -10.4), V(-20.4, 0, -13.4), V(-23.4, 0, -14.4), V(-31, 0, -13), V(-40, 0, -12.5), V(-47, 0, -15), V(-62, 0, -26)],
      [V(-23.4, 0, -14.4), V(-15, 0, -23), V(-2, 0, -40), V(14, 0, -70)],
      [V(-20, 0, -7.6), V(-19.9, 0, -4.6), V(-21.5, 0, 2), V(-18, 0, 9), V(-8, 0, 14), V(5, 0, 18)],
    ];
    {
      const pieces = [];
      for (const pts of tracks) {
        const curve = new THREE.CatmullRomCurve3(pts);
        const n = Math.floor(curve.getLength() / 0.3);
        const sp = curve.getSpacedPoints(n);
        for (let i = 0; i < sp.length - 1; i++) {
          const d = sp[i + 1].clone().sub(sp[i]).normalize();
          const r = V(-d.z, 0, d.x);
          [-0.915, 0.915].forEach((o) => pieces.push({ p: sp[i].clone().addScaledVector(r, o), yaw: Math.atan2(-d.x, -d.z) }));
        }
      }
      const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.24, 0.31), trackMat, pieces.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = V(1, 1, 1);
      pieces.forEach(({ p, yaw }, i) => {
        q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw));
        m4.compose(V(p.x, hadleyHeight(p.x, p.z) + 0.014, p.z), q, one);
        inst.setMatrixAt(i, m4);
      });
      hadley.add(inst);
    }
    // Footprints around the rover, Falcon and the science station
    printTrail([V(-18.6, 0, -8.2), V(-15.6, 0, -6.6), MEM.clone().add(V(0.6, 0, 0.4))], hadley);
    printTrail([V(-21.6, 0, -9.6), V(-24.5, 0, -14.6), V(-25.2, 0, -16.4)], hadley);
    printTrail([V(-21.4, 0, -8.0), V(-25, 0, -4.6), V(-28, 0, -2.6)], hadley);
    printTrail([V(-28.6, 0, -0.6), V(-30.8, 0, 0.4), V(-30.4, 0, -3)], hadley);
    for (let i = 0; i < 60; i++) {
      const a = hr() * TAU, d = 5 + hr() * 24;
      const x = -20 + Math.cos(a) * d, z = -9 + Math.sin(a) * d;
      const rock = add(geo("rock", () => new THREE.DodecahedronGeometry(1, 0)), std(0x8d9097, 1), hadley, x, hadleyHeight(x, z), z);
      rock.scale.set(0.08 + hr() * 0.3, 0.05 + hr() * 0.16, 0.08 + hr() * 0.3);
      rock.rotation.set(hr() * 3, hr() * 3, hr() * 3);
    }

    /* ---- The memorial: a small plaque and a little figure lying in the dust ---- */
    {
      const g = new THREE.Group();
      g.position.copy(MEM);
      hadley.add(g);
      const figMat = std(0xd4d8de, 0.3, 0.85);
      const fig = new THREE.Group();
      fig.position.set(0.18, 0.02, 0.05);
      fig.rotation.y = 0.6;
      g.add(fig);
      add(new THREE.CapsuleGeometry(0.022, 0.07, 4, 10), figMat, fig, 0, 0, 0).rotation.x = Math.PI / 2;
      add(new THREE.SphereGeometry(0.024, 12, 10), figMat, fig, 0, 0.004, -0.075);
      [-1, 1].forEach((s) => {
        add(new THREE.CapsuleGeometry(0.01, 0.06, 4, 8), figMat, fig, s * 0.034, -0.004, 0.0).rotation.x = Math.PI / 2;
        add(new THREE.CapsuleGeometry(0.012, 0.07, 4, 8), figMat, fig, s * 0.014, -0.006, 0.085).rotation.x = Math.PI / 2;
      });
      const plq = add(new THREE.PlaneGeometry(0.22, 0.11), new THREE.MeshStandardMaterial({
        map: canvasTexture(220, 110, (ctx, w, h) => {
          ctx.fillStyle = "#C9CDD3";
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = "#5A5E66";
          ctx.lineWidth = 4;
          ctx.strokeRect(4, 4, w - 8, h - 8);
          ctx.fillStyle = "#4A4E56";
          for (let i = 0; i < 14; i++) { // fourteen names
            const col = i < 7 ? 0 : 1, row = i % 7;
            ctx.fillRect(18 + col * 100, 14 + row * 12.5, 70 + ((i * 37) % 17), 5);
          }
        }),
        metalness: 0.5, roughness: 0.35,
      }), g, -0.12, 0.06, 0);
      plq.rotation.x = -1.15;
      plq.rotation.y = 0.3;
    }

    /* ---- ALSEP: the science station, its power generator and its instruments ---- */
    const RTG = ALSEP.clone().add(V(1.6, 0, 0.9));
    const SEIS = ALSEP.clone().add(V(-1.7, 0, -1.6));
    const MAG = ALSEP.clone().add(V(-2.4, 0, 2.0));
    const SWS = ALSEP.clone().add(V(0.4, 0, -2.6));
    const HEAT = ALSEP.clone().add(V(2.2, 0, -1.6));
    {
      const cable = (a, b) => {
        const mid = a.clone().lerp(b, 0.5).add(V(0.3, 0, -0.2));
        add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a.clone().setY(0.02), mid.setY(0.02), b.clone().setY(0.02)]), 30, 0.008, 5), std(0x30323a, 0.6), hadley);
      };
      // Central station with its sunshade and the long antenna pointed at Earth
      const st = new THREE.Group();
      st.position.copy(ALSEP);
      hadley.add(st);
      add(new THREE.BoxGeometry(0.6, 0.32, 0.45), foilMat, st, 0, 0.16, 0);
      add(new THREE.BoxGeometry(0.62, 0.02, 0.5), std(0xf2f4f7, 0.2, 0.2), st, 0, 0.33, 0);
      add(new THREE.BoxGeometry(0.62, 0.02, 0.5), std(0xe8eaee, 0.3, 0.2), st, 0, 0.62, -0.05).rotation.x = 0.15;
      [-1, 1].forEach((s) => beam(st, V(s * 0.29, 0.33, -0.2), V(s * 0.29, 0.62, -0.2), 0.01, lmSilver));
      const toEarth = hEarth.position.clone().sub(ALSEP).normalize();
      beam(st, V(0.18, 0.62, 0.1), V(0.18, 0.62, 0.1).addScaledVector(toEarth, 0.58), 0.019, lmSilver);
      // The power generator: a cylinder with eight fins
      const rtg = new THREE.Group();
      rtg.position.copy(RTG);
      hadley.add(rtg);
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.46, 20), std(0x3b3e45, 0.5, 0.5), rtg, 0, 0.33, 0);
      for (let k = 0; k < 8; k++) {
        const fin = add(new THREE.BoxGeometry(0.15, 0.42, 0.01), std(0x55585f, 0.5, 0.5), rtg, 0, 0.33, 0);
        fin.rotation.y = (k * Math.PI) / 4;
        fin.translateX(0.12);
      }
      beam(rtg, V(-0.12, 0, -0.12), V(0, 0.1, 0), 0.012, lmSilver);
      [V(0.12, 0, -0.12), V(0, 0, 0.16)].forEach((p) => beam(rtg, p, V(0, 0.1, 0), 0.012, lmSilver));
      // Seismometer: a silver drum on a skirt of foil
      add(new THREE.CylinderGeometry(0.6, 0.6, 0.01, 28), foilMat, hadley, SEIS.x, 0.01, SEIS.z);
      add(new THREE.CylinderGeometry(0.14, 0.17, 0.3, 20), lmSilver, hadley, SEIS.x, 0.16, SEIS.z);
      add(new THREE.SphereGeometry(0.14, 16, 8, 0, TAU, 0, Math.PI / 2), lmSilver, hadley, SEIS.x, 0.31, SEIS.z);
      // Magnetometer: three arms with sensors on a tripod
      const mag = new THREE.Group();
      mag.position.copy(MAG);
      hadley.add(mag);
      [0, 1, 2].forEach((k) => {
        const a = (k * TAU) / 3;
        beam(mag, V(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35), V(0, 0.5, 0), 0.012, lmSilver);
        const tip = V(Math.cos(a + 1) * 0.55, 0.8, Math.sin(a + 1) * 0.55);
        beam(mag, V(0, 0.55, 0), tip, 0.02, std(0xe6e8ec, 0.4));
        add(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 14), std(0xf2f4f7, 0.4), mag, tip.x, tip.y, tip.z);
      });
      add(new THREE.BoxGeometry(0.2, 0.12, 0.2), foilMat, mag, 0, 0.55, 0);
      // Solar wind spectrometer: a box of sensor cups on legs
      const sws = new THREE.Group();
      sws.position.copy(SWS);
      hadley.add(sws);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => beam(sws, V(x * 0.15, 0, z * 0.12), V(x * 0.13, 0.32, z * 0.1), 0.01, lmSilver));
      add(new THREE.BoxGeometry(0.34, 0.16, 0.28), std(0xe8eaee, 0.4, 0.2), sws, 0, 0.4, 0);
      for (let i = 0; i < 7; i++) add(new THREE.CylinderGeometry(0.03, 0.025, 0.05, 12), std(0x3b3e45, 0.4, 0.6), sws, -0.12 + i * 0.04, 0.5, (i % 2) * 0.06 - 0.03);
      // Heat flow experiment: an electronics box with probe cables going down into the ground
      add(new THREE.BoxGeometry(0.3, 0.14, 0.22), foilMat, hadley, HEAT.x, 0.07, HEAT.z);
      [V(0.9, 0, -0.5), V(-0.5, 0, -1.0)].forEach((o) => {
        cable(HEAT, HEAT.clone().add(o));
        add(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10), std(0x55585f, 0.5), hadley, HEAT.x + o.x, 0.04, HEAT.z + o.z);
      });
      [RTG, SEIS, MAG, SWS, HEAT].forEach((p) => cable(ALSEP, p));
    }

    /* ---- The hammer and the feather (for our own little experiment) ---- */
    const hammer = new THREE.Group();
    add(new THREE.CylinderGeometry(0.018, 0.022, 0.4, 10), std(0x6d727b, 0.45, 0.6), hammer, 0, 0, 0);
    add(new THREE.BoxGeometry(0.17, 0.055, 0.055), std(0xc4c8cf, 0.3, 0.8), hammer, 0.02, 0.18, 0);
    const feather = new THREE.Group();
    add(new THREE.CylinderGeometry(0.004, 0.007, 0.4, 6), std(0xf2ede2, 0.8), feather, 0, 0, 0);
    add(new THREE.SphereGeometry(1, 18, 10), std(0xe9dfcc, 0.9), feather, 0, 0.05, 0).scale.set(0.05, 0.15, 0.008);
    add(new THREE.SphereGeometry(1, 14, 8), std(0x8a6a48, 0.9), feather, 0, 0.17, 0).scale.set(0.035, 0.05, 0.009);
    hadley.add(hammer, feather);
    hammer.visible = feather.visible = false; // PIP brings them out right before the experiment
    // Who is holding them: "pip" (carries them from the rocket), "nova", or null (on the ground / in the air)
    let holder = "pip";
    const pipHand = (side) => (side < 0 ? pip.armL : pip.armR).localToWorld(V(0, -0.32, 0.06));
    const holdPoints = (who) => {
      if (who === "nova") {
        commander.root.updateMatrixWorld(true);
        const h = commander.hand(1), f = commander.hand(-1);
        f.y = h.y; // held at exactly the same height
        return [h, f];
      }
      pip.root.updateMatrixWorld(true);
      return [pipHand(1), pipHand(-1)];
    };
    frameHooks.push(() => {
      if (!holder || activeScene !== hadley) return;
      const [h, f] = holdPoints(holder);
      hammer.position.copy(h);
      feather.position.copy(f);
    });
    // Pass the hammer and feather smoothly into someone's hands
    async function handOff(to, seconds) {
      const h0 = hammer.position.clone(), f0 = feather.position.clone();
      const hr0 = hammer.rotation.z, fr0 = feather.rotation.z;
      holder = null;
      await tween(seconds, (k) => {
        const e = ease(k);
        const [h, f] = holdPoints(to);
        hammer.position.lerpVectors(h0, h, e);
        feather.position.lerpVectors(f0, f, e);
        hammer.rotation.z = hr0 * (1 - e);
        feather.rotation.z = fr0 * (1 - e);
      });
      holder = to;
    }
    const puffs = [];
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, depthWrite: false, transparent: true, opacity: 0 }));
      hadley.add(sp);
      puffs.push(sp);
    }

    // Everyone climbs into the moon buggy, and we drive off across the Moon
    seatInBuggy(commander, BUGGY_SEATS.nova);
    seatInBuggy(pip, BUGGY_SEATS.pip);
    sideKids.forEach((c, i) => seatInBuggy(c, BUGGY_SEATS.kids[i]));
    const youStandIn = kidsIn[4]; // seen from outside, someone sits in our seat: that's us!
    seatInBuggy(youStandIn, BUGGY_SEATS.me);
    const followers = convoy.map((c, i) => ({ v: c.v, wheels: c.wheels, lag: 7.5 * (i + 1) }));
    // Leaving Eagle's landing site: free its memory (keeping what comes with us)
    disposeScene(moonScene, [buggy, moonRocket, moonRamp, ...dust]);
    Object.assign(ride, { vehicle: buggy, back: 3, up: 2.4, side: 8.5, ahead: 1, reveal: null, blend: 0 });
    ui.screen.classList.add("outside-view");
    setLocation("Moon · Apennine Mountains");

    /* ---- Into Hadley by moon buggy, the Apennines ahead (the day counter ticks on) ---- */
    hadley.add(buggy);
    activeScene = hadley;
    const DRIVE2 = [V(52, 0, -58), V(36, 0, -44), V(26, 0, -32), V(15, 0, -22.5), V(6, 0, -19.5)];
    buggy.position.copy(DRIVE2[0]);
    placeRideCam();
    await fadeTo(0, 0.9);
    if (window.AstroAudio) { window.AstroAudio.sfx("whir"); window.AstroAudio.rumble(0.12, 1); }
    let buggyDay = Number(dayNum.textContent);
    await Promise.all([
      driveBuggy(DRIVE2, 15, hadleyHeight, { followers, reveal: ROVER.clone().setY(1.0) }),
      tween(15, (k) => { if (k > 0.35 && buggyDay < 5) { buggyDay = 5; setDay(5); if (window.AstroAudio) window.AstroAudio.sfx("blips"); } }),
    ]);
    if (window.AstroAudio) { window.AstroAudio.rumble(0, 0.6); window.AstroAudio.sfx("sparkle"); }
    await say(NAMES.commander, LINES.rover.spotted);
    hideDialogue();
    await wait(0.3);

    /* ---- Cut: everyone gathered around Nova and PIP again ---- */
    await fadeTo(1, 0.7, "#000000");
    ui.screen.classList.remove("outside-view"); // back to our own eyes
    youStandIn.root.visible = false;
    hadley.add(commander.root, pip.root);
    sideKids.forEach((c) => hadley.add(c.root));
    const HC = CENTER.clone().add(V(6, 0, 0)); // a little further from the rover this time
    commander.root.position.copy(HC);
    commander.pose = {};
    pip.root.position.copy(HC).add(V(1.0, 0, -0.2));
    cam.pos.copy(HC).add(V(0, EYE, 2.5));
    commander.heading = commander.targetHeading = facing(commander.root.position, cam.pos);
    pip.heading = pip.targetHeading = facing(pip.root.position, cam.pos);
    commander.mode = "idle";
    pip.mode = "excited";
    sideKids.forEach((c, i) => {
      hadley.add(c.root);
      c.root.visible = true;
      c.root.position.copy(sideSpots[i]).add(V(6, 0, 0));
      c.heading = c.targetHeading = facing(c.root.position, HC);
      c.pose = {};
      c.mode = "cheer";
    });
    commander.root.updateMatrixWorld(true);
    {
      const look = novaLook();
      cam.follow = null;
      cam.yaw = Math.atan2(-(look.x - cam.pos.x), -(look.z - cam.pos.z));
      cam.pitch = Math.atan2(look.y - cam.pos.y, Math.hypot(look.x - cam.pos.x, look.z - cam.pos.z));
    }
    await fadeTo(0, 0.8);
    await wait(0.5);
    commander.mode = "talk";
    await say(NAMES.commander, LINES.rover.landed);
    hideDialogue();
    commander.mode = "idle";
    pip.mode = "idle";
    sideKids.forEach((c) => { c.mode = "idle"; });

    // 1) Hop over to the rover. It's parked off to our left, with Falcon behind it.
    await goTo({
      cam: V(-13.5, EYE, -8.2), look: V(-20.6, 0.9, -10.6),
      camPath: [V(-4, EYE, -6.4), V(-13.5, EYE, -8.2)],
      novaPath: [V(-5, 0, -11.6), V(-16.3, 0, -11.0)],
      pipPath: [V(-5.6, 0, -12.6), V(-18.4, 0, -12.2)],
    });
    commander.mode = "talk";
    if (window.AstroAudio) window.AstroAudio.sfx("sparkle"); // there it is!
    foundToday("Apollo 15 Lunar Roving Vehicle");
    for (const line of LINES.rover.arrive) await say(NAMES.commander, line);
    hideDialogue();

    // 2) Falcon, the lunar module that carried the rover here
    await goTo({
      cam: V(-20.5, EYE, -14.2), look: V(-27, 2.2, -19),
      camPath: [V(-16.5, EYE, -12.6), V(-20.5, EYE, -14.2)],
      novaPath: [V(-21, 0, -11.8), V(-24.5, 0, -14.4)],
      pipPath: [V(-22.6, 0, -17.6)],
    });
    commander.mode = "talk";
    for (const line of LINES.rover.falcon) await say(NAMES.commander, line);
    hideDialogue();

    // 3) Up close to the rover, then its tracks, the rille and the mountains
    await goTo({
      cam: V(-17.3, EYE, -7.0), look: V(-20, 0.95, -8.8),
      camPath: [V(-16.6, EYE, -12.2), V(-15.8, EYE, -9.2), V(-17.3, EYE, -7.0)],
      novaPath: [V(-23.2, 0, -12.2), V(-22.7, 0, -9.6)],
      pipPath: [V(-20.6, 0, -12.6)],
    });
    commander.mode = "talk";
    await say(NAMES.commander, LINES.rover.first);
    hideDialogue();
    await lookAtPoint(V(-19.9, 0, -5.2), 1.0); // the tracks behind it
    await say(NAMES.commander, LINES.rover.tracks);
    hideDialogue();
    await lookAtPoint(V(-48, 0.5, -14), 1.4); // toward the rille
    await say(NAMES.commander, LINES.rover.rille);
    hideDialogue();
    await lookAtPoint(V(-30, 22, -170), 1.4); // the mountains
    await say(NAMES.commander, LINES.rover.mountains);
    hideDialogue();
    await lookAtPoint(novaLook(), 1.2);
    await say(NAMES.commander, LINES.rover.totals);
    hideDialogue();

    // 4) The hammer and the feather
    const DROP = V(-16.5, 0, -13.6);
    await goTo({
      cam: V(-13.8, EYE, -11.0), look: DROP.clone().setY(1.3),
      camPath: [V(-14.8, EYE, -8.6), V(-13.8, EYE, -11.0)],
      novaPath: [V(-22.6, 0, -12.4), V(-19, 0, -13.2), DROP],
      pipPath: [V(-19.2, 0, -15.4), V(-15.0, 0, -15.2)],
    });
    commander.mode = "talk";
    await say(NAMES.commander, LINES.rover.hammer[0]);
    hideDialogue();
    // PIP brings them over
    const pipSpot = pip.root.position.clone();
    pip.mode = "talk";
    hammer.visible = feather.visible = true;
    if (window.AstroAudio) window.AstroAudio.sfx("sparkle");
    await say(NAMES.robot, LINES.rover.pipBring);
    hideDialogue();
    pip.mode = "idle";
    const besideNova = DROP.clone().add(V(0.75, 0, -0.85)); // at Nova's side, a little behind her
    await walkTo(pip, [besideNova], 1.4, { face: DROP });
    commander.targetHeading = facing(commander.root.position, besideNova);
    commander.mode = "hold";
    await wait(0.4);
    if (window.AstroAudio) window.AstroAudio.sfx("blips");
    await handOff("nova", 0.7);
    commander.targetHeading = facing(commander.root.position, cam.pos);
    pip.targetHeading = facing(pip.root.position, cam.pos); // PIP waits at Nova's side
    commander.mode = "talk";
    await say(NAMES.commander, LINES.rover.hammer[1]);
    hideDialogue();
    commander.mode = "hold";
    await lookAtPoint(hammer.position.clone().lerp(feather.position, 0.5), 0.6);
    await wait(1.0);
    holder = null;
    {
      const h0 = hammer.position.y, f0 = feather.position.y;
      const T = Math.sqrt((2 * (h0 - 0.2)) / 1.62); // both start at the same height, so they land together
      const ground = hammer.position.clone().lerp(feather.position, 0.5).setY(0);
      commander.mode = "idle";
      await Promise.all([
        tween(T, (k) => {
          const drop = 0.5 * 1.62 * (k * T) ** 2;
          hammer.position.y = h0 - drop;
          feather.position.y = f0 - drop;
        }),
        lookAtPoint(ground, T),
      ]);
      if (window.AstroAudio) window.AstroAudio.sfx("thud");
      puffs.forEach((sp, i) => sp.position.copy(i < 2 ? hammer.position : feather.position).setY(0.08));
      await tween(0.9, (k) => {
        hammer.rotation.z = (Math.PI / 2) * ease(Math.min(1, k * 2.5));
        feather.rotation.z = -(Math.PI / 2) * ease(Math.min(1, k * 2.5));
        hammer.position.y = 0.2 - 0.17 * ease(Math.min(1, k * 2.5));
        feather.position.y = 0.2 - 0.19 * ease(Math.min(1, k * 2.5));
        puffs.forEach((sp, i) => { sp.scale.setScalar(0.2 + k * (0.5 + i * 0.1)); sp.material.opacity = 0.5 * (1 - k); });
      });
    }
    commander.mode = "talk";
    await say(NAMES.commander, LINES.rover.hammer[2]);
    hideDialogue();
    // Nova picks them up and gives them back to PIP
    commander.mode = "reach";
    await wait(0.6);
    await handOff("nova", 0.6);
    commander.mode = "hold";
    await lookAtPoint(novaLook(), 0.8);
    // Nova turns around and hands them back to PIP, who waits behind her
    pip.targetHeading = facing(pip.root.position, commander.root.position);
    commander.targetHeading = facing(commander.root.position, pip.root.position);
    await wait(0.7);
    await handOff("pip", 0.8);
    if (window.AstroAudio) window.AstroAudio.sfx("chirp");
    holder = null;
    hammer.visible = feather.visible = false; // PIP puts them away
    commander.mode = "idle";
    commander.targetHeading = facing(commander.root.position, cam.pos);
    pip.targetHeading = facing(pip.root.position, cam.pos);
    await wait(0.5);

    // 5) The memorial: a quiet moment
    await goTo({
      cam: V(-11.0, EYE, -4.0), look: MEM.clone().setY(0.05),
      camPath: [V(-10.6, EYE, -8.4), V(-11.0, EYE, -4.0)],
      novaPath: [V(-15.6, 0, -10.6), V(-14.8, 0, -7.8)],
      pipPath: [V(-17.2, 0, -11.8), V(-15.4, 0, -6.0)],
    });
    commander.mode = "idle";
    pip.mode = "idle";
    await say(NAMES.commander, LINES.rover.memorial);
    hideDialogue();
    await wait(1.4);

    // 6) The ALSEP science station
    await goTo({
      cam: V(-24.4, EYE, 1.4), look: ALSEP.clone().setY(0.3),
      camPath: [V(-14.5, EYE, -0.6), V(-21, EYE, 2.0), V(-24.4, EYE, 1.4)],
      novaPath: [V(-17.8, 0, -4.6), V(-22, 0, -3.6), V(-25.4, 0, -0.6), V(-28.4, 0, 1.6)],
      pipPath: [V(-19.4, 0, -5.6), V(-25.8, 0, -2.6)],
    });
    commander.mode = "talk";
    await say(NAMES.commander, LINES.rover.alsep[0]);
    hideDialogue();
    await lookAtPoint(SEIS.clone().lerp(MAG, 0.5).setY(0.3), 1.2);
    await say(NAMES.commander, LINES.rover.alsep[1]);
    hideDialogue();
    await lookAtPoint(RTG.clone().setY(0.3), 1.0);
    await say(NAMES.commander, LINES.rover.alsep[2]);
    hideDialogue();
    await lookAtPoint(ALSEP.clone().setY(0.6), 0.9);
    await say(NAMES.commander, LINES.rover.alsep[3]);
    hideDialogue();

    // Finale: back by the rover, Nova and PIP in front of it
    await goTo({
      cam: V(-14.6, EYE, -3.8), look: V(-19.6, 1.0, -8.6),
      camPath: [V(-20, EYE, 1.6), V(-15.5, EYE, -0.6), V(-14.6, EYE, -3.8)],
      novaPath: [V(-23.6, 0, -2.2), V(-19.2, 0, -4.6), V(-17.5, 0, -5.9)],
      pipPath: [V(-22.6, 0, -4.6), V(-18.0, 0, -7.2), V(-16.5, 0, -6.9)],
    });
    commander.targetHeading = facing(commander.root.position, cam.pos);
    pip.targetHeading = facing(pip.root.position, cam.pos);
    commander.mode = "talk";
    await say(NAMES.commander, LINES.rover.end);
    commander.mode = "idle";
    pip.mode = "excited";
    if (window.AstroAudio) window.AstroAudio.sfx("sparkle"); // mission complete
    await say(NAMES.robot, LINES.rover.pipQuestions);
    hideDialogue();
    await askPip("lunar-rover");
    commander.mode = "talk";
    await say(NAMES.commander, LINES.rover.next);
    hideDialogue();
    commander.mode = "idle";
    await wait(0.4);
    await fadeTo(1, 1.0, "#000000");

    /* ================================================================== */
    /* MARS: four Forgotten Explorers (Spirit, Opportunity, InSight,       */
    /* Ingenuity). Each lives at its own site; we hop between sites by     */
    /* rocket and watch each landing from outside.                         */
    /* ================================================================== */

    // Every Mars site puts its explorer here: a short walk away, off to our right
    const MEX = V(22, 0, -16);
    const atM = (r, y, f) => V(MEX.x + r, y, MEX.z + f); // f points toward us as we arrive

    // Butterscotch sky, rusty ground, dusty haze
    const MARS_HAZE = new THREE.Color(0xd9a578);
    const marsSkyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 horizon = vec3(0.85, 0.65, 0.47);
          vec3 zenith = vec3(0.52, 0.34, 0.26);
          gl_FragColor = vec4(mix(horizon, zenith, pow(h, 0.6)), 1.0);
        }
      `,
    });
    const marsGroundMat = new THREE.MeshStandardMaterial({
      map: (() => {
        const t = canvasTexture(512, 512, (ctx, w, h) => {
          ctx.fillStyle = "#B8693D";
          ctx.fillRect(0, 0, w, h);
          const r = mulberry32(9);
          for (let i = 0; i < 5000; i++) {
            const k = r();
            ctx.fillStyle = k < 0.5 ? `rgba(${150 + r() * 50},${80 + r() * 30},${45 + r() * 20},0.55)` : `rgba(${95 + r() * 30},${48 + r() * 20},${30 + r() * 15},0.45)`;
            ctx.beginPath();
            ctx.arc(r() * w, r() * h, 0.6 + r() * 2, 0, TAU);
            ctx.fill();
          }
        });
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(150, 150);
        return t;
      })(),
      color: 0xffffff, roughness: 1,
    });
    const marsRockMat = std(0x6e3b26, 0.95);
    const marsDustTex = softGlow("rgba(205,140,95,0.9)", "rgba(205,140,95,0)");
    const marsDust = [];
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: marsDustTex, depthWrite: false, transparent: true, opacity: 0 }));
      sp.userData.dir = V(Math.cos((i / 14) * TAU), 0, Math.sin((i / 14) * TAU));
      marsDust.push(sp);
    }
    const setMarsDust = (amount, spread) => marsDust.forEach((sp, i) => {
      sp.position.set(sp.userData.dir.x * spread, 0.8 + (i % 3) * 0.5, ROCKET_Z + sp.userData.dir.z * spread);
      sp.scale.setScalar(2.4 + spread * 0.55);
      sp.material.opacity = amount * 0.4 * (0.55 + 0.3 * Math.sin(i * 1.7));
    });

    // Build one Mars site. extraHeight(x, z) adds the site's own landforms.
    function buildMarsSite(seed, extraHeight = () => 0) {
      const sc = new THREE.Scene();
      sc.background = MARS_HAZE.clone();
      sc.fog = new THREE.Fog(MARS_HAZE.clone(), 90, 520);
      sc.environment = scene.environment;
      sc.add(new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), marsSkyMat));
      sc.add(new THREE.HemisphereLight(0xf0c9a0, 0x6b3a24, 0.9));
      const sun = new THREE.DirectionalLight(0xfff1e0, 2.4);
      sun.position.set(-50, 40, 40);
      sc.add(sun);
      const r = mulberry32(seed);
      const craters = [];
      for (let i = 0; i < 40; i++) {
        const a = r() * TAU, d = 45 + r() * 200;
        craters.push({ x: Math.cos(a) * d, z: -22 + Math.sin(a) * d, r: 3 + Math.pow(r(), 2) * 18, depth: 0.4 + r() * 0.5 });
      }
      const height = (x, z) => {
        const ax = 0, az = -22, bx = MEX.x, bz = MEX.z;
        const seg = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2), 0, 1);
        const flat = smooth01((Math.hypot(x - (ax + (bx - ax) * seg), z - (az + (bz - az) * seg)) - 24) / 16);
        let h = (noise2(x * 0.04 + seed, z * 0.04) - 0.5) * 4 + (noise2(x * 0.2, z * 0.2 + seed) - 0.5) * 0.5;
        for (const c of craters) {
          const d = Math.hypot(x - c.x, z - c.z) / c.r;
          if (d < 1.6) h += ((d < 1 ? (d * d - 1) * 0.9 : 0) + Math.exp(-Math.pow((d - 1) / 0.22, 2)) * 0.45) * c.depth * c.r * 0.25;
        }
        return h * flat + extraHeight(x, z);
      };
      const g = new THREE.PlaneGeometry(900, 900, 120, 120);
      const gp = g.attributes.position;
      for (let i = 0; i < gp.count; i++) gp.setZ(i, height(gp.getX(i), -gp.getY(i)));
      g.computeVertexNormals();
      const ground = new THREE.Mesh(g, marsGroundMat);
      ground.rotation.x = -Math.PI / 2;
      sc.add(ground);
      // Rocks everywhere (but not on the paths right around the explorer)
      for (let i = 0; i < 160; i++) {
        const a = r() * TAU, d = 6 + r() * 60;
        const x = MEX.x - 10 + Math.cos(a) * d, z = MEX.z + Math.sin(a) * d;
        if (Math.hypot(x - MEX.x, z - MEX.z) < 5 || Math.hypot(x, z + 11) < 5) continue;
        const rock = add(geo("rock", () => new THREE.DodecahedronGeometry(1, 0)), marsRockMat, sc, x, height(x, z), z);
        rock.scale.set(0.06 + r() * 0.3, 0.04 + r() * 0.18, 0.06 + r() * 0.3);
        rock.rotation.set(r() * 3, r() * 3, r() * 3);
      }
      return { scene: sc, height };
    }

    // Wheel tracks (instanced little imprints) for the rovers
    const marsTrackMat = new THREE.MeshStandardMaterial({
      map: canvasTexture(32, 32, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "rgba(90,45,25,0.55)";
        ctx.fillRect(3, 0, w - 6, h);
        ctx.fillStyle = "rgba(60,30,18,0.8)";
        for (let y = 2; y < h; y += 8) ctx.fillRect(3, y, w - 6, 3);
      }),
      transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    function marsTracks(sc, height, pts, gauge, width = 0.16, mat = marsTrackMat) {
      const curve = new THREE.CatmullRomCurve3(pts);
      const sp = curve.getSpacedPoints(Math.floor(curve.getLength() / 0.2));
      const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(width, 0.21), mat, (sp.length - 1) * 2);
      const m4 = new THREE.Matrix4(), one = V(1, 1, 1);
      let n = 0;
      for (let i = 0; i < sp.length - 1; i++) {
        const d = sp[i + 1].clone().sub(sp[i]).normalize();
        const yaw = Math.atan2(-d.x, -d.z);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw));
        for (const o of [-gauge / 2, gauge / 2]) {
          const p = sp[i].clone().addScaledVector(V(-d.z, 0, d.x), o);
          m4.compose(V(p.x, height(p.x, p.z) + 0.012, p.z), q, one);
          inst.setMatrixAt(n++, m4);
        }
      }
      sc.add(inst);
    }

    // Solar cell texture (optionally dusty)
    const cellTexture = (dust) => canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#1B2350";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#5B6BB0";
      ctx.lineWidth = 2;
      for (let x = 0; x <= w; x += 21) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y <= h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      if (dust) {
        const r = mulberry32(3);
        for (let i = 0; i < 900; i++) {
          ctx.fillStyle = `rgba(190,120,80,${dust * (0.2 + r() * 0.4)})`;
          ctx.beginPath();
          ctx.arc(r() * w, r() * h, 2 + r() * 10, 0, TAU);
          ctx.fill();
        }
      }
    });

    /* ---- Spirit / Opportunity: a Mars Exploration Rover (front toward -z) ---- */
    function buildMER(dust) {
      const g = new THREE.Group();
      const white = std(0xe9e6df, 0.6), alu = std(0xc4c8cf, 0.35, 0.6), dark = std(0x3a3d44, 0.6, 0.3);
      const cells = new THREE.MeshStandardMaterial({ map: cellTexture(dust), roughness: 0.45, metalness: 0.3 });
      const WR = 0.13;
      for (const sx of [-1, 1]) {
        for (const z of [-0.55, 0.02, 0.55]) {
          const w = add(new THREE.CylinderGeometry(WR, WR, 0.16, 24), alu, g, sx * 0.62, WR, z);
          w.rotation.z = Math.PI / 2;
          add(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 12), dark, g, sx * 0.62, WR, z).rotation.z = Math.PI / 2;
        }
        // Rocker-bogie "legs"
        const piv = V(sx * 0.58, 0.45, -0.05), bog = V(sx * 0.62, 0.3, 0.3);
        beam(g, piv, V(sx * 0.62, WR + 0.05, -0.55), 0.022, alu);
        beam(g, piv, bog, 0.022, alu);
        beam(g, bog, V(sx * 0.62, WR + 0.05, 0.02), 0.02, alu);
        beam(g, bog, V(sx * 0.62, WR + 0.05, 0.55), 0.02, alu);
      }
      // Body ("vital organs" inside), with a gold band
      add(new THREE.BoxGeometry(0.9, 0.3, 0.95), white, g, 0, 0.55, 0);
      add(new THREE.BoxGeometry(0.92, 0.06, 0.97), foilMat, g, 0, 0.42, 0);
      // Solar panels: the deck plus side and back wings
      add(new THREE.BoxGeometry(1.0, 0.025, 1.1), cells, g, 0, 0.72, 0);
      [-1, 1].forEach((sx) => add(new THREE.BoxGeometry(0.55, 0.02, 0.85), cells, g, sx * 0.78, 0.72, 0.08));
      add(new THREE.BoxGeometry(1.0, 0.02, 0.45), cells, g, 0, 0.72, 0.77);
      // Mast ("neck") and camera head with two stereo "eyes"
      beam(g, V(0.18, 0.73, -0.42), V(0.18, 1.42, -0.42), 0.035, white);
      add(new THREE.BoxGeometry(0.32, 0.1, 0.12), white, g, 0.18, 1.48, -0.42);
      [-1, 1].forEach((s) => add(new THREE.CylinderGeometry(0.028, 0.028, 0.04, 16), dark, g, 0.18 + s * 0.11, 1.48, -0.49).rotation.x = Math.PI / 2);
      // High-gain dish and low-gain antenna (for "speaking" and "listening")
      beam(g, V(-0.3, 0.73, 0.3), V(-0.3, 0.9, 0.3), 0.02, alu);
      const dish = add(new THREE.CylinderGeometry(0.15, 0.1, 0.04, 24), alu, g, -0.3, 0.93, 0.3);
      dish.rotation.set(0.6, 0, 0.3);
      beam(g, V(0.38, 0.73, 0.36), V(0.38, 1.18, 0.36), 0.01, alu);
      // Arm with shoulder, elbow and wrist, holding its instrument turret
      const sh = V(-0.25, 0.42, -0.5), el = V(0.05, 0.36, -0.74), wr = V(0.25, 0.3, -0.62);
      beam(g, sh, el, 0.025, white);
      beam(g, el, wr, 0.022, white);
      [sh, el, wr].forEach((p) => add(new THREE.SphereGeometry(0.035, 12, 8), dark, g, p.x, p.y, p.z));
      [0, 1, 2].forEach((k) => add(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 12), k ? alu : dark, g, wr.x + Math.cos(k * 2.1) * 0.06, wr.y - 0.06, wr.z + Math.sin(k * 2.1) * 0.06));
      add(geo("merShadow", () => new THREE.PlaneGeometry(2.4, 2.4)), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, opacity: 0.55 }), g, 0, 0.015, 0).rotation.x = -Math.PI / 2;
      return g;
    }

    /* ---- InSight lander (front, with its arm, toward +z) ---- */
    function buildInSight() {
      const g = new THREE.Group();
      const white = std(0xece8e0, 0.55), alu = std(0xc4c8cf, 0.35, 0.6), dark = std(0x3a3d44, 0.6, 0.3);
      const copper = std(0xb27a4a, 0.4, 0.7);
      add(new THREE.CylinderGeometry(0.8, 0.8, 0.22, 10), white, g, 0, 0.8, 0);
      add(new THREE.CylinderGeometry(0.82, 0.82, 0.06, 10), foilMat, g, 0, 0.67, 0);
      for (let k = 0; k < 3; k++) { // three legs
        const a = Math.PI / 2 + (k * TAU) / 3;
        const top = V(Math.cos(a) * 0.55, 0.68, Math.sin(a) * 0.55), foot = V(Math.cos(a) * 1.0, 0.06, Math.sin(a) * 1.0);
        beam(g, top, foot, 0.04, alu);
        add(new THREE.CylinderGeometry(0.16, 0.18, 0.06, 16), alu, g, foot.x, 0.03, foot.z);
      }
      // Two round solar arrays (10-sided, 2.15 m wide)
      const arrTex = canvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = "#C27A3E";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#5A3A20";
        ctx.lineWidth = 3;
        for (let k = 0; k < 10; k++) { const a = (k * TAU) / 10; ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 + Math.cos(a) * w, h / 2 + Math.sin(a) * h); ctx.stroke(); }
        for (let rr = 20; rr < w / 2; rr += 22) { ctx.beginPath(); ctx.arc(w / 2, h / 2, rr, 0, TAU); ctx.stroke(); }
      });
      [-1, 1].forEach((sx) => {
        const arr = add(new THREE.CylinderGeometry(1.075, 1.075, 0.05, 10), new THREE.MeshStandardMaterial({ map: arrTex, roughness: 0.5, metalness: 0.3 }), g, sx * 1.95, 0.74, 0);
        arr.rotation.x = 0.12; // tipped a little toward us, so we can see them
        beam(g, V(sx * 0.75, 0.8, 0), V(sx * 0.95, 0.75, 0), 0.04, alu);
      });
      // Deck gear: a camera mast and two little wind/weather booms
      beam(g, V(-0.3, 0.9, -0.3), V(-0.3, 1.25, -0.3), 0.02, alu);
      [-1, 1].forEach((s) => { beam(g, V(s * 0.45, 0.9, -0.5), V(s * 0.65, 1.1, -0.75), 0.012, alu); add(new THREE.BoxGeometry(0.08, 0.05, 0.05), white, g, s * 0.65, 1.1, -0.75); });
      // Robotic arm (over 1.8 m), reaching out from the front of the deck
      const a0 = V(0.15, 0.92, 0.6), a1 = V(0.2, 1.6, 1.25), a2 = V(0.25, 0.95, 2.0);
      beam(g, a0, a1, 0.04, white);
      beam(g, a1, a2, 0.035, white);
      [a0, a1, a2].forEach((p) => add(new THREE.SphereGeometry(0.06, 12, 8), dark, g, p.x, p.y, p.z));
      for (let k = 0; k < 5; k++) { const a = (k * TAU) / 5; beam(g, a2, a2.clone().add(V(Math.cos(a) * 0.07, -0.14, Math.sin(a) * 0.07)), 0.01, alu); } // grapple
      // The seismometer the arm set on the ground (under its domed cover), and the heat flow probe
      const SEIS_L = V(-0.9, 0, 2.4), HEAT_L = V(1.1, 0, 2.2);
      add(new THREE.CylinderGeometry(0.5, 0.55, 0.06, 28), std(0x8a8f98, 0.8, 0.2), g, SEIS_L.x, 0.03, SEIS_L.z);
      add(new THREE.SphereGeometry(0.36, 28, 14, 0, TAU, 0, Math.PI / 2), copper, g, SEIS_L.x, 0.05, SEIS_L.z);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => beam(g, V(HEAT_L.x + x * 0.16, 0, HEAT_L.z + z * 0.12), V(HEAT_L.x + x * 0.1, 0.32, HEAT_L.z + z * 0.08), 0.012, alu));
      add(new THREE.BoxGeometry(0.26, 0.22, 0.2), foilMat, g, HEAT_L.x, 0.42, HEAT_L.z);
      [SEIS_L, HEAT_L].forEach((p) => {
        const curve = new THREE.CatmullRomCurve3([V(p.x * 0.3, 0.7, 0.5), V(p.x * 0.7, 0.05, (p.z + 0.5) / 2), V(p.x, 0.04, p.z)]);
        add(new THREE.TubeGeometry(curve, 20, 0.012, 5), std(0x30323a, 0.6), g);
      });
      add(geo("insightShadow", () => new THREE.PlaneGeometry(6, 3)), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, opacity: 0.5 }), g, 0, 0.015, 0).rotation.x = -Math.PI / 2;
      g.userData.seis = SEIS_L;
      g.userData.heat = HEAT_L;
      return g;
    }

    /* ---- Ingenuity: a small helicopter (rotors 1.2 m tip to tip) ---- */
    function buildIngenuity() {
      const g = new THREE.Group();
      const body = std(0xd9dce2, 0.5, 0.2), dark = std(0x2b2e35, 0.6, 0.2), blade = std(0x9aa3ad, 0.45, 0.3);
      add(new THREE.BoxGeometry(0.14, 0.13, 0.14), body, g, 0, 0.2, 0);
      add(new THREE.BoxGeometry(0.145, 0.03, 0.145), foilMat, g, 0, 0.13, 0);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => {
        beam(g, V(x * 0.05, 0.15, z * 0.05), V(x * 0.21, 0.01, z * 0.21), 0.006, dark);
        add(new THREE.SphereGeometry(0.018, 10, 6), dark, g, x * 0.21, 0.015, z * 0.21);
      });
      beam(g, V(0, 0.26, 0), V(0, 0.52, 0), 0.012, dark);
      // Two rotors stacked on the mast, 1.2 m across
      [[0.34, 0.5], [0.42, -0.7]].forEach(([y, a]) => {
        const rotor = new THREE.Group();
        rotor.position.y = y;
        rotor.rotation.y = a;
        g.add(rotor);
        add(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), dark, rotor);
        [-1, 1].forEach((s) => { const b = add(new THREE.BoxGeometry(0.58, 0.006, 0.07), blade, rotor, s * 0.3, 0, 0); b.rotation.x = s * 0.08; });
      });
      // Solar panel on top
      add(new THREE.BoxGeometry(0.42, 0.012, 0.17), new THREE.MeshStandardMaterial({ map: cellTexture(0.3), roughness: 0.4, metalness: 0.3 }), g, 0, 0.53, 0);
      add(geo("heliShadow", () => new THREE.PlaneGeometry(0.9, 0.9)), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, opacity: 0.5 }), g, 0, 0.012, 0).rotation.x = -Math.PI / 2;
      return g;
    }

    /* ---- Landing at a Mars site (outside view), then everyone gathered round ---- */
    const marsAim = () => V(0, moonRocket.position.y + 4.5, ROCKET_Z);
    async function marsLanding(site) {
      for (const c of characters) c.walkId = (c.walkId || 0) + 1;
      site.scene.add(moonRocket, moonRamp);
      marsDust.forEach((sp) => site.scene.add(sp));
      moonRocket.position.y = 70;
      flame.visible = true;
      moonDoorMat.color.copy(doorClosed);
      moonRamp.visible = false;
      setRamp(0);
      setMarsDust(0, 0);
      activeScene = site.scene;
      ui.screen.classList.add("outside-view");
      cam.pos.set(5, 1.6, -9);
      cam.shake = 0;
      {
        const aim = marsAim();
        cam.yaw = Math.atan2(-(aim.x - cam.pos.x), -(aim.z - cam.pos.z));
        cam.pitch = Math.atan2(aim.y - cam.pos.y, Math.hypot(aim.x - cam.pos.x, aim.z - cam.pos.z));
      }
      cam.follow = marsAim;
      const shown = fadeTo(0, 1.0);
      if (window.AstroAudio) window.AstroAudio.rumble(0.35, 1);
      lastRumble = -1;
      await tween(8, (k) => {
        const y = 70 * Math.pow(1 - k, 2);
        const level = Math.round((0.35 + 0.5 * k) * 20) / 20;
        if (level !== lastRumble) { lastRumble = level; if (window.AstroAudio) window.AstroAudio.rumble(level, 0.3); }
        moonRocket.position.y = y;
        flame.scale.set(2.6 * (0.85 + Math.random() * 0.3), 6 * (0.85 + Math.random() * 0.3), 1);
        const near = clamp(1 - y / 16, 0, 1);
        setMarsDust(near, 2 + near * 7);
        cam.shake = near * 0.012;
      });
      await shown;
      moonRocket.position.y = 0.04; // resting on its feet, just above the ground
      if (window.AstroAudio) { window.AstroAudio.rumble(0, 0.6); window.AstroAudio.sfx("thud"); }
      flame.visible = false;
      await tween(0.5, (k) => { cam.shake = 0.04 * (1 - k); });
      cam.shake = 0;
      const settle = tween(3, (k) => setMarsDust(1 - k, 9 + k * 3));
      await wait(0.8);
      cam.follow = () => V(0, 3, ROCKET_Z + 4);
      if (window.AstroAudio) window.AstroAudio.sfx("chime");
      await tween(0.8, (k) => { moonDoorMat.color.copy(doorClosed).lerp(doorWarm, k); });
      moonRamp.visible = true;
      if (window.AstroAudio) window.AstroAudio.sfx("whir");
      await tween(1.6, (k) => setRamp(ease(k)));
      await settle;
      await wait(0.4);

      await marsGather(site, false); // we came by rocket
    }

    // The pressurized rover: our home on wheels on Mars (it rode down inside the rocket)
    const pRoverWheels = [];
    const pRover = (function buildPressurizedRover() {
      const g = new THREE.Group(); // front toward -z
      const white = std(BRAND.white, 0.4, 0.1), blueM = std(BRAND.electricBlue, 0.35, 0.2), yonderM = std(BRAND.blueYonder, 0.3, 0.2);
      const tyreM = std(0x2b2e35, 0.85), metalM = std(0xc4c8cf, 0.35, 0.6);
      const glass = new THREE.MeshStandardMaterial({ color: 0x0b1f4a, roughness: 0.1, metalness: 0.4 });
      add(new THREE.BoxGeometry(2.6, 0.35, 5.6), blueM, g, 0, 0.85, 0);
      const cabinBody = add(new THREE.CapsuleGeometry(1.25, 3.4, 8, 24), white, g, 0, 2.0, 0.1);
      cabinBody.rotation.x = Math.PI / 2;
      cabinBody.scale.set(1.05, 1, 0.92);
      [-1, 1].forEach((sx) => {
        add(new THREE.BoxGeometry(0.06, 0.18, 4.4), yonderM, g, sx * 1.3, 1.75, 0.1);
        for (let k = 0; k < 3; k++) { // portholes
          const w = add(new THREE.CircleGeometry(0.24, 24), glass, g, sx * 1.33, 2.15, -1.1 + k * 1.2);
          w.rotation.y = sx * Math.PI / 2;
          const ring = add(new THREE.TorusGeometry(0.25, 0.04, 8, 24), metalM, g, sx * 1.33, 2.15, -1.1 + k * 1.2);
          ring.rotation.y = Math.PI / 2;
        }
      });
      const front = add(new THREE.SphereGeometry(1.05, 24, 16, 0, TAU, 0, Math.PI / 2.4), glass, g, 0, 2.05, -2.1); // big front window
      front.rotation.x = -Math.PI / 2;
      add(new THREE.TorusGeometry(1.0, 0.07, 10, 32), blueM, g, 0, 2.05, -2.15);
      add(new THREE.CylinderGeometry(0.75, 0.75, 0.25, 24), metalM, g, 0, 2.05, 2.75).rotation.x = Math.PI / 2; // rear hatch
      add(new THREE.BoxGeometry(1.8, 0.05, 2.4), new THREE.MeshStandardMaterial({ map: cellTexture(0.2), roughness: 0.4, metalness: 0.3 }), g, 0, 3.27, 0.4); // roof solar panel
      rodM(g, V(0.9, 3.2, -1.2), V(0.9, 3.9, -1.2), 0.03, metalM);
      add(new THREE.CylinderGeometry(0.3, 0.12, 0.08, 20), metalM, g, 0.9, 3.95, -1.2);
      [-0.7, 0.7].forEach((x) => add(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff4d6 }), g, x, 1.1, -2.85));
      for (const sx of [-1, 1]) for (const z of [-2.0, 0, 2.0]) {
        const w = new THREE.Group();
        w.position.set(sx * 1.45, 0.6, z);
        g.add(w);
        add(new THREE.CylinderGeometry(0.6, 0.6, 0.45, 28), tyreM, w).rotation.z = Math.PI / 2;
        add(new THREE.CylinderGeometry(0.3, 0.3, 0.47, 20), metalM, w).rotation.z = Math.PI / 2;
        for (let k = 0; k < 8; k++) { const a = (k * TAU) / 8; add(new THREE.BoxGeometry(0.47, 0.08, 0.18), tyreM, w, 0, Math.cos(a) * 0.6, Math.sin(a) * 0.6).rotation.x = -a; }
        pRoverWheels.push(w);
      }
      add(geo("pRoverShadow", () => new THREE.PlaneGeometry(3.8, 7)), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), g, 0, 0.015, 0).rotation.x = -Math.PI / 2;
      return g;
    })();
    function rodM(parent, p, q, radius, mat) {
      const d = q.clone().sub(p);
      const m = add(new THREE.CylinderGeometry(radius, radius, d.length(), 10), mat, parent);
      m.position.copy(p).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    }
    const PROVER_PARK = V(2, 0, -22);
    // Drive in by pressurized rover (seen from outside), spot the explorer ahead, then gather
    const MARS_DRIVE = [V(-40, 0, -6), V(-26, 0, -14), V(-12, 0, -20), PROVER_PARK];
    async function marsDriveTo(site, prevSite, opts = {}) {
      const seconds = opts.seconds || 10, days = opts.days || 1;
      for (const c of characters) c.walkId = (c.walkId || 0) + 1;
      site.scene.add(pRover);
      pRover.visible = true;
      activeScene = site.scene;
      ui.screen.classList.add("outside-view");
      pRover.position.copy(MARS_DRIVE[0]);
      Object.assign(ride, { vehicle: pRover, back: 4, up: 3, side: 12, ahead: 1, reveal: null, blend: 0 });
      placeRideCam();
      if (prevSite) disposeScene(prevSite.scene, [pRover, moonRocket, moonRamp, ...marsDust]);
      await fadeTo(0, 0.9);
      if (window.AstroAudio) window.AstroAudio.rumble(0.12, 1);
      // The day counter ticks on as we drive (it's a long way)
      const day0 = Number(dayNum.textContent);
      let shownDay = day0;
      await Promise.all([
        driveBuggy(MARS_DRIVE, seconds, site.height, { vehicle: pRover, wheels: pRoverWheels, wheelR: 0.6, reveal: MEX.clone().setY(0.8) }),
        tween(seconds, (k) => {
          const d = day0 + Math.min(days, Math.floor(k * days + 0.15));
          if (d !== shownDay) { shownDay = d; setDay(d); if (window.AstroAudio) window.AstroAudio.sfx("blips"); }
        }),
      ]);
      setDay(day0 + days);
      if (window.AstroAudio) { window.AstroAudio.rumble(0, 0.6); window.AstroAudio.sfx("sparkle"); }
      await wait(1.2);
      await marsGather(site);
    }

    async function marsGather(site, withRover = true) {
      // Cut: everyone outside, gathered round Nova and PIP (the pressurized rover parked nearby, if we came in it)
      if (withRover) {
        site.scene.add(pRover);
        pRover.visible = true;
        pRover.position.set(PROVER_PARK.x, site.height(PROVER_PARK.x, PROVER_PARK.z), PROVER_PARK.z);
        pRover.rotation.y = -Math.PI / 2;
      }
      await fadeTo(1, 0.7, "#000000");
      ui.screen.classList.remove("outside-view");
      site.scene.add(commander.root, pip.root);
      commander.root.position.copy(CENTER);
      commander.pose = {};
      commander.mode = "idle";
      pip.root.position.copy(CENTER).add(V(1.0, 0, -0.2));
      pip.mode = "excited";
      cam.pos.copy(CENTER).add(V(0, EYE, 2.5));
      commander.heading = commander.targetHeading = facing(commander.root.position, cam.pos);
      pip.heading = pip.targetHeading = facing(pip.root.position, cam.pos);
      sideKids.forEach((c, i) => {
        site.scene.add(c.root);
        c.root.visible = true;
        c.root.position.copy(sideSpots[i]);
        c.heading = c.targetHeading = facing(sideSpots[i], CENTER);
        c.pose = {};
        c.mode = "cheer";
      });
      commander.root.updateMatrixWorld(true);
      {
        const look = novaLook();
        cam.follow = null;
        cam.yaw = Math.atan2(-(look.x - cam.pos.x), -(look.z - cam.pos.z));
        cam.pitch = Math.atan2(look.y - cam.pos.y, Math.hypot(look.x - cam.pos.x, look.z - cam.pos.z));
      }
      await fadeTo(0, 0.8);
      await wait(0.4);
    }

    // Nova leads everyone back to the rocket and we cut away
    async function backToRocket(line) {
      commander.mode = "talk";
      await say(NAMES.commander, line);
      hideDialogue();
      commander.mode = "idle";
      await wait(0.3);
      await fadeTo(1, 1.0, "#000000");
    }

    // The first walk at every Mars site: over to the explorer, which waits off to our right
    const firstMarsWalk = (look, novaEnd, pipEnd, camEnd) => goTo({
      cam: camEnd, look,
      camPath: [V(11, EYE, -7.6), camEnd],
      novaPath: [V(10, 0, -11.6), novaEnd],
      pipPath: [V(10.5, 0, -12.6), pipEnd],
    });

    /* ---- Back in the rocket cabin, everyone in their seats: lift off for Mars ---- */
    for (const c of characters) c.walkId = (c.walkId || 0) + 1;
    activeScene = cabin;
    ui.screen.classList.remove("outside-view");
    // Everyone back in their own cabin seat (same seats as on the way to the Moon)
    function reseatEveryone() {
      const seatOf = [seatAt(-0.9, 0), seatAt(0.9, 0), ...neighbourSeats, ...backSeats];
      kidsIn.forEach((c, i) => { cabin.add(c.root); c.root.visible = true; seatNow(c, seatOf[i]); });
    }
    reseatEveryone();
    cabin.add(commander.root);
    commander.root.position.set(0, 0, -2.2);
    commander.heading = commander.targetHeading = Math.PI;
    commander.pose = {};
    commander.sitBob = commander.sitBobFor(CMD_SEAT.top);
    commander.mode = "sit";
    cabin.add(pip.root);
    pip.root.position.set(2.3, 0, -2.4);
    pip.heading = pip.targetHeading = Math.PI;
    pip.mode = "idle";
    cam.follow = null;
    cam.walking = false;
    cam.pos.set(MY_SEAT.x, SEAT_EYE, MY_SEAT.z + 0.02);
    skyU.uAlt.value = 1;
    skyU.uEngine.value = 0;
    skyU.uEarthVis.value = 0;
    skyU.uTrip.value = 1;
    skyU.uMars.value = 1;     // the planet ahead is Mars now
    skyU.uMoonR.value = 0.0001; // too far away to see yet
    dayFound.hidden = true;
    disposeScene(hadley, [buggy, ...convoy.map((c) => c.v)]);
    drawStatus("NEXT STOP", "Mars", "#FF8A3D");
    setNextStop("MARS", "#E0703A");
    await lookAtPoint(WINDOW_CENTER, 0.05);
    await fadeTo(0, 0.9);
    await say(NAMES.commander, LINES.mars.liftoff);
    hideDialogue();
    for (const n of [3, 2, 1]) {
      showBig(String(n));
      if (window.AstroAudio) { window.AstroAudio.sfx(n === 1 ? "beepHigh" : "beep"); window.AstroAudio.rumble((4 - n) * 0.15, 0.8); }
      cam.shake = 0.006 * (4 - n);
      await wait(1.0);
    }
    showBig("LIFTOFF!", "liftoff");
    setMode(kidsIn, "sitCheer");
    setLocation("Space · On the way to Mars");
    if (window.AstroAudio) window.AstroAudio.rumble(1, 0.4);
    await tween(4, (k) => { cam.shake = 0.03 * (1 - k); skyU.uEngine.value = 1 - k; });
    cam.shake = 0;
    if (window.AstroAudio) window.AstroAudio.rumble(0, 2.5);
    hideBig();
    setMode(kidsIn, "sit");
    await wait(0.6);

    for (const line of LINES.mars.far) await say(NAMES.commander, line);
    hideDialogue();
    // The long cruise: the day counter races forward (about 205 days, like InSight's and Ingenuity's trips)
    await fadeTo(1, 0.8, "#07173F");
    const cruiseFrom = Number(dayNum.textContent) || 5;
    const MARS_DAY = cruiseFrom + 205;
    await tween(3.2, (k) => { dayNum.textContent = String(Math.round(cruiseFrom + (MARS_DAY - cruiseFrom) * ease(k))); });
    setDay(MARS_DAY);
    if (window.AstroAudio) window.AstroAudio.sfx("swell");
    await fadeTo(0, 0.8);
    skyU.uMoonR.value = 0.04; // there it is!
    const marsGrows = tween(6, (k) => { skyU.uMoonR.value = 0.04 + 0.5 * ease(k); });
    await say(NAMES.commander, LINES.mars.window[0]);
    await say(NAMES.commander, LINES.mars.window[1]);
    hideDialogue();
    await marsGrows;
    await wait(0.5);
    await fadeTo(1, 0.9, "#000000");

    /* ================================================================== */
    /* 3) SPIRIT, at Home Plate                                            */
    /* ================================================================== */
    const spiritSite = buildMarsSite(2004);
    const HOME_PLATE = atM(-2, 0, -12); // a light-toned, layered plateau behind Spirit
    {
      const layers = [std(0xd9b591, 0.9), std(0xc49b74, 0.9)];
      for (let i = 0; i < 5; i++) {
        const rr = 7.2 - i * 0.28;
        const m = add(new THREE.CylinderGeometry(rr, rr + 0.25, 0.3, 40), layers[i % 2], spiritSite.scene, HOME_PLATE.x, 0.15 + i * 0.28, HOME_PLATE.z);
        m.scale.z = 0.8;
      }
    }
    const spirit = buildMER(0.85);
    spirit.position.copy(MEX);
    spirit.rotation.y = Math.PI / 2; // nose toward Home Plate
    spiritSite.scene.add(spirit);
    solid(spiritSite.scene, MEX, 1.3);
    solid(spiritSite.scene, HOME_PLATE, 6.4);
    solid(spiritSite.scene, V(0, 0, ROCKET_Z), 6.4);
    solid(spiritSite.scene, PROVER_PARK, 3.0);
    marsTracks(spiritSite.scene, spiritSite.height, [atM(14, 0, 7), atM(6, 0, 2.5), atM(1.0, 0, 0)], 1.24);
    // The bright soil churned up by a dragging wheel
    const silica = add(new THREE.PlaneGeometry(2.6, 0.3), new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.9, transparent: true, opacity: 0.85 }), spiritSite.scene, MEX.x + 2.2, 0.02, MEX.z + 0.8);
    silica.rotation.set(-Math.PI / 2, 0, -0.38);

    setDay(MARS_DAY);
    setLocation("Mars · Home Plate");
    await marsLanding(spiritSite);
    commander.mode = "talk";
    await say(NAMES.commander, LINES.spirit.welcome);
    hideDialogue();
    commander.mode = "idle";
    pip.mode = "idle";
    sideKids.forEach((c) => { c.mode = "idle"; });

    await firstMarsWalk(atM(0, 0.7, 0), atM(-1.9, 0, 3.2), atM(1.9, 0, 3.4), atM(0, EYE, 7));
    commander.mode = "talk";
    if (window.AstroAudio) window.AstroAudio.sfx("sparkle");
    foundToday("Spirit rover");
    for (const line of LINES.spirit.arrive) await say(NAMES.commander, line);
    hideDialogue();

    // Up close: the rover's "body", "head", arm and solar panels
    await goTo({
      cam: atM(0.9, EYE, 3.0), look: atM(0, 0.6, 0),
      camPath: [atM(0.9, EYE, 3.0)],
      novaPath: [atM(-2.4, 0, -0.6), atM(-0.6, 0, -2.2)],
      pipPath: [atM(2.9, 0, 1.0), atM(1.6, 0, -1.8)],
    });
    commander.mode = "talk";
    await say(NAMES.commander, LINES.spirit.body);
    hideDialogue();
    await lookAtPoint(atM(-0.42, 1.45, -0.18), 0.9);
    await say(NAMES.commander, LINES.spirit.head);
    hideDialogue();
    await lookAtPoint(atM(-0.62, 0.35, -0.25), 0.9);
    await say(NAMES.commander, LINES.spirit.arm);
    hideDialogue();
    await lookAtPoint(atM(0, 0.72, 0.1), 0.9);
    await say(NAMES.commander, LINES.spirit.power);
    hideDialogue();
    await lookAtPoint(atM(2.0, 0, 0.7), 1.0); // the bright soil
    await say(NAMES.commander, LINES.spirit.silica);
    hideDialogue();

    // Home Plate
    await goTo({
      cam: atM(2.2, EYE, -1.4), look: HOME_PLATE.clone().setY(1.2),
      camPath: [atM(2.6, EYE, 1.8), atM(2.2, EYE, -1.4)],
      novaPath: [atM(-2.4, 0, -2.6), atM(-3.4, 0, -4.2)],
      pipPath: [atM(0.6, 0, 3.0)],
    });
    commander.mode = "talk";
    for (const line of LINES.spirit.homePlate) await say(NAMES.commander, line);
    await say(NAMES.commander, LINES.spirit.comanche);
    hideDialogue();
    await goTo({
      cam: atM(2.6, EYE, 3.4), look: atM(0, 0.7, 0),
      camPath: [atM(2.9, EYE, 0.4), atM(2.6, EYE, 3.4)],
      novaPath: [atM(-1.4, 0, -1.9)],
      pipPath: [atM(1.8, 0, 1.2), atM(1.4, 0, -1.6)],
    });
    commander.targetHeading = facing(commander.root.position, cam.pos);
    pip.targetHeading = facing(pip.root.position, cam.pos);
    commander.mode = "talk";
    await say(NAMES.commander, LINES.spirit.end);
    commander.mode = "idle";
    pip.mode = "excited";
    if (window.AstroAudio) window.AstroAudio.sfx("sparkle");
    await say(NAMES.robot, LINES.spirit.pipQuestions);
    hideDialogue();
    await askPip("spirit");
    await backToRocket(LINES.mars.next);

    /* ================================================================== */
    /* 4) OPPORTUNITY, on the rim of Endeavour Crater                      */
    /* ================================================================== */
    // A huge crater beyond the rover, with a raised rim we can stand on and look down from
    const CRATER = (() => {
      const r = 180, dir = V(0.417, 0, -0.911).normalize();
      return { x: MEX.x + dir.x * (r + 26), z: MEX.z + dir.z * (r + 26), r };
    })();
    const oppSite = buildMarsSite(2011, (x, z) => {
      const d = Math.hypot(x - CRATER.x, z - CRATER.z);
      return (d < CRATER.r ? -55 * smooth01((CRATER.r - d) / 60) : 0) + 4 * Math.exp(-Math.pow((d - CRATER.r) / 9, 2));
    });
    const opportunity = buildMER(0.45);
    opportunity.position.set(MEX.x, oppSite.height(MEX.x, MEX.z), MEX.z);
    opportunity.rotation.y = Math.PI / 2;
    oppSite.scene.add(opportunity);
    solid(oppSite.scene, MEX, 1.3);
    solid(oppSite.scene, PROVER_PARK, 3.0);
    marsTracks(oppSite.scene, oppSite.height, [atM(12, 0, 6), atM(5, 0, 1.5), atM(1.0, 0, 0)], 1.24);
    // "Blueberries": tiny round hematite pebbles
    const BERRIES = atM(0.5, 0, 5.3);
    {
      const br = mulberry32(44);
      const berryMat = std(0x5f6474, 0.5, 0.3);
      for (let i = 0; i < 70; i++) {
        const a = br() * TAU, d = Math.sqrt(br()) * 0.6;
        const x = BERRIES.x + Math.cos(a) * d, z = BERRIES.z + Math.sin(a) * d;
        add(geo("berry", () => new THREE.SphereGeometry(1, 10, 8)), berryMat, oppSite.scene, x, oppSite.height(x, z) + 0.012, z).scale.setScalar(0.014 + br() * 0.014);
      }
    }
    // A rock with a bright gypsum vein
    const VEIN_ROCK = atM(4.6, 0, 4.0);
    solid(oppSite.scene, VEIN_ROCK, 0.6);
    {
      const rock = add(new THREE.BoxGeometry(1.0, 0.36, 0.7), std(0xa86a45, 0.95), oppSite.scene, VEIN_ROCK.x, oppSite.height(VEIN_ROCK.x, VEIN_ROCK.z) + 0.16, VEIN_ROCK.z);
      rock.rotation.y = 0.3;
      const vein = add(new THREE.BoxGeometry(1.02, 0.05, 0.06), std(0xfbf7ef, 0.6), rock, 0, 0.17, 0.05);
      vein.rotation.y = 0.25;
      add(new THREE.BoxGeometry(0.06, 0.37, 0.05), std(0xfbf7ef, 0.6), rock, 0.3, 0, 0.34);
    }

    setLocation("Mars · Endeavour Crater");
    // Everyone walks to the next view, following the ground (up onto the crater rim too)
    async function oppWalk(v) {
      const speed = v.speed || 2.4;
      const H = (p, up) => V(p.x, oppSite.height(p.x, p.z) + up, p.z);
      const route = (from, pts, up) => {
        const out = [];
        let p0 = from.clone();
        for (const q of pts) {
          const n = Math.max(1, Math.ceil(Math.hypot(q.x - p0.x, q.z - p0.z) / 1.5));
          for (let i = 1; i <= n; i++) out.push(H(V(p0.x + (q.x - p0.x) * i / n, 0, p0.z + (q.z - p0.z) * i / n), up));
          p0 = q.clone();
        }
        return out;
      };
      cam.follow = () => v.look;
      const spots = flankSpots(v.cam, v.look); // the others walk alongside, ending beside and behind us
      sideKids.forEach((k, i) => {
        if (!spots[i]) return;
        walkTo(k, route(k.root.position, [...(v.kidVia || []), spots[i]], 0), speed + 0.4, { face: v.look })
          .then(() => { k.mode = "idle"; }).catch(() => {});
      });
      await Promise.race([
        Promise.all([
          walkTo(commander, route(commander.root.position, [...(v.novaVia || []), v.nova], 0), speed + 0.3, { face: v.cam }),
          walkTo(pip, route(pip.root.position, [...(v.pipVia || []), v.pip], 0), speed + 0.3, { face: v.cam }),
          walkCamera(route(cam.pos, [...(v.camVia || []), v.cam], EYE), speed),
        ]),
        wait(45), // (never wait forever)
      ]);
      cam.walking = false;
    }
    await marsDriveTo(oppSite, spiritSite, { seconds: 16, days: 6 }); // Opportunity is on the other side of Mars
    commander.mode = "talk";
    await say(NAMES.commander, LINES.opportunity.welcome);
    hideDialogue();
    commander.mode = "idle";
    pip.mode = "idle";
    sideKids.forEach((c) => { c.mode = "idle"; });

    // a) Hello, Opportunity!
    await firstMarsWalk(atM(0, 0.7, 0), atM(-1.9, 0, 3.2), atM(1.9, 0, 3.4), atM(0, EYE, 7));
    commander.targetHeading = facing(commander.root.position, cam.pos);
    commander.mode = "talk";
    if (window.AstroAudio) window.AstroAudio.sfx("sparkle");
    foundToday("Opportunity rover");
    for (const line of LINES.opportunity.arrive) await say(NAMES.commander, line);
    hideDialogue();

    // b) Blueberries, right by our feet
    await lookAtPoint(BERRIES, 1.0);
    commander.mode = "talk";
    for (const line of LINES.opportunity.blueberries) await say(NAMES.commander, line);
    hideDialogue();
    commander.mode = "idle";

    // c) The rock with the gypsum vein
    hideDialogue();
    await oppWalk({ cam: atM(3.9, EYE, 7.8), look: VEIN_ROCK.clone().setY(0.45), nova: atM(5.9, 0, 3.4), pip: atM(3.0, 0, 2.9), speed: 1.8 });
    commander.targetHeading = facing(commander.root.position, cam.pos);
    commander.mode = "talk";
    await say(NAMES.commander, LINES.opportunity.gypsum);
    hideDialogue();

    // d) The rim of Endeavour Crater (it drops away right in front of us)
    {
      const toC = V(CRATER.x - MEX.x, 0, CRATER.z - MEX.z).normalize();
      const rgt = V(-toC.z, 0, toC.x);
      const rim = V(CRATER.x, 0, CRATER.z).addScaledVector(toC, -(CRATER.r + 2));
      hideDialogue();
      // Up onto the rim; Nova and PIP stay just behind us, so we see only the crater
      await oppWalk({
        cam: rim.clone(),
        camVia: [atM(6.4, 0, 5.0)],
        look: V(CRATER.x, -40, CRATER.z).addScaledVector(toC, -70),
        nova: rim.clone().addScaledVector(toC, -3.2).addScaledVector(rgt, -0.4),
        pip: rim.clone().addScaledVector(toC, -3.0).addScaledVector(rgt, 1.1),
        speed: 2.8,
      });
    }
    commander.mode = "talk";
    for (const line of LINES.opportunity.crater) await say(NAMES.commander, line);
    hideDialogue();

    // e) Back with Opportunity to say goodbye: Nova and PIP side by side in front of it
    hideDialogue();
    await oppWalk({
      cam: atM(0, EYE, 6.6), camVia: [atM(5.0, 0, 1.0)], look: atM(0, 0.8, 0),
      nova: atM(-1.5, 0, 3.0), novaVia: [atM(-3.4, 0, -1.8)],
      pip: atM(1.5, 0, 3.0), pipVia: [atM(3.6, 0, 0.6)],
      kidVia: [atM(5.5, 0, 0)],
      speed: 2.8,
    });
    commander.targetHeading = facing(commander.root.position, cam.pos);
    pip.targetHeading = facing(pip.root.position, cam.pos);
    commander.mode = "talk";
    await say(NAMES.commander, LINES.opportunity.dust);
    await say(NAMES.commander, LINES.opportunity.end);
    commander.mode = "idle";
    pip.mode = "excited";
    if (window.AstroAudio) window.AstroAudio.sfx("sparkle");
    await say(NAMES.robot, LINES.opportunity.pipQuestions);
    hideDialogue();
    await askPip("opportunity");
    await backToRocket(LINES.mars.next);

    /* ================================================================== */
    /* 5) INSIGHT (built on the Phoenix lander's design), Elysium Planitia */
    /* ================================================================== */
    const insightSite = buildMarsSite(2018);
    const insight = buildInSight();
    insight.position.copy(MEX);
    insightSite.scene.add(insight);
    solid(insightSite.scene, MEX, 1.0);
    solid(insightSite.scene, MEX.clone().add(V(-1.95, 0, 0)), 1.1);
    solid(insightSite.scene, MEX.clone().add(V(1.95, 0, 0)), 1.1);
    solid(insightSite.scene, PROVER_PARK, 3.0);
    const SEIS_W = MEX.clone().add(insight.userData.seis), HEAT_W = MEX.clone().add(insight.userData.heat);

    setLocation("Mars · Elysium Planitia");
    await marsDriveTo(insightSite, oppSite, { seconds: 13, days: 4 });
    commander.mode = "talk";
    await say(NAMES.commander, LINES.insight.welcome);
    hideDialogue();
    commander.mode = "idle";
    pip.mode = "idle";
    sideKids.forEach((c) => { c.mode = "idle"; });

    await firstMarsWalk(atM(0, 0.7, 0), atM(-1.6, 0, 5.6), atM(1.8, 0, 5.4), atM(0, EYE, 8.5));
    commander.mode = "talk";
    if (window.AstroAudio) window.AstroAudio.sfx("sparkle");
    foundToday("InSight lander");
    for (const line of LINES.insight.arrive) await say(NAMES.commander, line);
    await say(NAMES.commander, LINES.insight.job);
    hideDialogue();

    // Up close: the arm, the seismometer and the heat flow probe
    await goTo({
      cam: atM(0.4, EYE, 4.6), look: atM(0.2, 1.1, 1.4),
      camPath: [atM(0.4, EYE, 4.6)],
      novaPath: [atM(-3.6, 0, 2.4), atM(-3.6, 0, -1.8), atM(0, 0, -2.6)],
      pipPath: [atM(3.5, 0, 3.0), atM(3.4, 0, 1.8)],
    });
    commander.mode = "talk";
    await say(NAMES.commander, LINES.insight.arm);
    hideDialogue();
    await lookAtPoint(SEIS_W.clone().setY(0.2), 1.0);
    for (const line of LINES.insight.seismometer) await say(NAMES.commander, line);
    hideDialogue();
    await lookAtPoint(HEAT_W.clone().setY(0.35), 1.0);
    await say(NAMES.commander, LINES.insight.heat);
    hideDialogue();
    await lookAtPoint(atM(0, 0.8, 0), 1.0);
    await say(NAMES.commander, LINES.insight.wind);
    hideDialogue();
    if (window.AstroAudio) window.AstroAudio.rumble(0.18, 1.2); // a low, windy rumble
    await wait(2.6);
    if (window.AstroAudio) window.AstroAudio.rumble(0, 1.5);
    for (const line of LINES.insight.end) await say(NAMES.commander, line);
    commander.mode = "idle";
    pip.mode = "excited";
    if (window.AstroAudio) window.AstroAudio.sfx("sparkle");
    await say(NAMES.robot, LINES.insight.pipQuestions);
    hideDialogue();
    await askPip("insight");
    await backToRocket(LINES.insight.next);

    /* ================================================================== */
    /* 6) INGENUITY, the Mars helicopter, in Jezero Crater                 */
    /* ================================================================== */
    const ingSite = buildMarsSite(2021, (x, z) => {
      const d = Math.hypot(x, z + 20);
      return smooth01((d - 150) / 90) * (16 + 22 * noise2(x * 0.012 + 5, z * 0.012)); // the crater's far walls
    });
    const heli = buildIngenuity();
    heli.position.copy(MEX);
    heli.rotation.y = 0.3;
    ingSite.scene.add(heli);
    solid(ingSite.scene, MEX, 0.7);
    solid(ingSite.scene, PROVER_PARK, 3.0);

    setLocation("Mars · Jezero Crater");
    await marsDriveTo(ingSite, insightSite, { seconds: 12, days: 3 });
    commander.mode = "talk";
    await say(NAMES.commander, LINES.ingenuity.welcome);
    hideDialogue();
    commander.mode = "idle";
    pip.mode = "idle";
    sideKids.forEach((c) => { c.mode = "idle"; });

    await firstMarsWalk(atM(0, 0.25, 0), atM(-1.6, 0, 1.2), atM(1.6, 0, 1.4), atM(0, EYE, 3.8));
    commander.mode = "talk";
    if (window.AstroAudio) window.AstroAudio.sfx("sparkle");
    foundToday("Ingenuity helicopter");
    for (const line of LINES.ingenuity.arrive) await say(NAMES.commander, line);
    await say(NAMES.commander, LINES.ingenuity.firstFlight);
    hideDialogue();
    // Step in for a close look
    cam.follow = () => atM(0, 0.3, 0);
    await walkCamera([atM(0.3, EYE, 2.1)], 1.2);
    cam.follow = null;
    await say(NAMES.commander, LINES.ingenuity.size);
    hideDialogue();
    await lookAtPoint(atM(0, 0.53, 0), 0.8);
    await say(NAMES.commander, LINES.ingenuity.power);
    hideDialogue();
    await goTo({
      cam: atM(0, EYE, 4.0), look: atM(0, 0.55, 0),
      camPath: [atM(0, EYE, 4.0)],
      novaPath: [atM(-1.2, 0, -1.0)],
      pipPath: [atM(1.2, 0, -1.0)],
    });
    commander.targetHeading = facing(commander.root.position, cam.pos);
    pip.targetHeading = facing(pip.root.position, cam.pos);
    commander.mode = "talk";
    await say(NAMES.commander, LINES.ingenuity.air);
    for (const line of LINES.ingenuity.flights) await say(NAMES.commander, line);
    for (const line of LINES.ingenuity.end) await say(NAMES.commander, line);
    commander.mode = "idle";
    pip.mode = "excited";
    if (window.AstroAudio) window.AstroAudio.sfx("sparkle");
    await say(NAMES.robot, LINES.ingenuity.pipQuestions);
    hideDialogue();
    await askPip("ingenuity");
    commander.targetHeading = facing(commander.root.position, cam.pos);
    await lookAtPoint(novaLook(), 1.0);
    commander.mode = "talk";
    await say(NAMES.commander, LINES.ingenuity.finale);
    await say(NAMES.commander, LINES.home.leave);
    hideDialogue();
    commander.mode = "idle";
    await wait(0.3);
    await fadeTo(1, 1.0, "#000000");

    /* ================================================================== */
    /* HOME AGAIN: the trip back to Earth                                  */
    /* ================================================================== */
    for (const c of characters) c.walkId = (c.walkId || 0) + 1;
    activeScene = cabin;
    ui.screen.classList.remove("outside-view");
    reseatEveryone();
    cabin.add(commander.root);
    commander.root.position.set(0, 0, -2.2);
    commander.heading = commander.targetHeading = Math.PI;
    commander.pose = {};
    commander.sitBob = commander.sitBobFor(CMD_SEAT.top);
    commander.mode = "sit";
    cabin.add(pip.root);
    pip.root.position.set(2.3, 0, -2.4);
    pip.heading = pip.targetHeading = Math.PI;
    pip.mode = "idle";
    cam.follow = null;
    cam.walking = false;
    cam.pos.set(MY_SEAT.x, SEAT_EYE, MY_SEAT.z + 0.02);
    skyU.uMars.value = 0;
    skyU.uHome.value = 1;     // Earth ahead
    skyU.uMoonR.value = 0.04;
    disposeScene(ingSite.scene, [pRover, ...marsDust]);
    drawStatus("NEXT STOP", "Home", "#3DDC84");
    setNextStop("HOME", "#2E96F5");
    setLocation("Space · Heading home");
    dayFound.hidden = true;
    await lookAtPoint(WINDOW_CENTER, 0.05);
    await fadeTo(0, 0.9);
    showBig("LIFTOFF!", "liftoff");
    setMode(kidsIn, "sitCheer");
    if (window.AstroAudio) window.AstroAudio.rumble(1, 0.4);
    await tween(3, (k) => { cam.shake = 0.03 * (1 - k); });
    cam.shake = 0;
    if (window.AstroAudio) window.AstroAudio.rumble(0, 2.5);
    hideBig();
    setMode(kidsIn, "sit");
    await say(NAMES.commander, LINES.home.cabin);
    hideDialogue();
    await fadeTo(1, 0.8, "#07173F");
    {
      const from = Number(dayNum.textContent) || MARS_DAY;
      const to = from + 205;
      await tween(3.2, (k) => { dayNum.textContent = String(Math.round(from + (to - from) * ease(k))); });
      setDay(to);
      setLocation("Space · Almost home");
    }
    if (window.AstroAudio) window.AstroAudio.sfx("swell");
    await fadeTo(0, 0.8);
    const earthGrows = tween(6, (k) => { skyU.uMoonR.value = 0.04 + 0.5 * ease(k); });
    await say(NAMES.commander, LINES.home.window);
    hideDialogue();
    await earthGrows;
    await wait(0.4);
    await fadeTo(1, 0.9, "#000000");

    /* ================================================================== */
    /* THE SCRAPBOOKS: back at the launch pad, everyone lines up           */
    /* ================================================================== */
    activeScene = scene;
    setLocation("Earth · Launch pad");
    cam.hop = false;
    const NOVA_SPOT = V(0, 0, -17.2);
    scene.add(commander.root, pip.root);
    commander.root.visible = pip.root.visible = true;
    commander.root.position.copy(NOVA_SPOT);
    commander.heading = commander.targetHeading = 0; // facing the line
    commander.pose = {};
    commander.mode = "idle";
    pip.root.position.set(1.35, 0, -17.5);
    pip.heading = pip.targetHeading = -0.3;
    pip.mode = "idle";
    // The line: two astronauts ahead of us, we're 3rd, two more behind
    const SLOT_Z = [-15.8, -14.6, -13.4, -12.2, -11.0, -9.8];
    const LINE_X = 0.35;
    const queue = [sideKids[0], sideKids[1], "me", sideKids[2], sideKids[3], kidsIn[4]];
    queue.forEach((c, i) => {
      if (c === "me") return;
      scene.add(c.root);
      c.root.visible = true;
      c.root.position.set(LINE_X + (i % 2 ? 0.05 : -0.05), 0, SLOT_Z[i]);
      c.heading = c.targetHeading = Math.PI;
      c.pose = {};
      c.mode = "idle";
    });
    cam.pos.set(LINE_X, EYE, SLOT_Z[2]);
    commander.root.updateMatrixWorld(true);
    {
      const look = novaLook();
      cam.yaw = Math.atan2(-(look.x - cam.pos.x), -(look.z - cam.pos.z));
      cam.pitch = Math.atan2(look.y - cam.pos.y, Math.hypot(look.x - cam.pos.x, look.z - cam.pos.z));
    }

    // The scrapbooks: a stack in PIP's arms
    const coverTex = canvasTexture(256, 320, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#2E96F5"); g.addColorStop(0.5, "#0960E1"); g.addColorStop(1, "#07173F");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.font = '900 30px "Fira Sans", Arial, sans-serif';
      ctx.fillText("MY", w / 2, 120);
      ctx.fillText("SCRAPBOOK", w / 2, 156);
      ctx.beginPath();
      const cx = w / 2, cy = 225;
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 30, a = -Math.PI / 2 + (i * Math.PI) / 5; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      ctx.fill();
    });
    const bookMats = [std(0xf4efe4, 0.9), std(0xf4efe4, 0.9), std(0xf4efe4, 0.9), std(0xf4efe4, 0.9), new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.6 }), std(BRAND.electricBlue, 0.6)];
    const books = [];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.05), bookMats);
      b.userData.at = null;
      scene.add(b);
      books.push(b);
    }
    const pipHands = () => { pip.root.updateMatrixWorld(true); return pip.armL.localToWorld(V(0, -0.32, 0.06)).lerp(pip.armR.localToWorld(V(0, -0.32, 0.06)), 0.5); };
    const inFrontOfUs = () => {
      const f = V(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
      return cam.pos.clone().addScaledVector(f, 0.5).add(V(0, -0.42, 0));
    };
    books.forEach((b, i) => { b.userData.at = () => pipHands().add(V(0, 0.02 + i * 0.055, 0.12)); b.userData.flat = true; });
    frameHooks.push(() => {
      if (activeScene !== scene) return;
      for (const b of books) {
        if (!b.userData.at) continue;
        b.position.copy(b.userData.at());
        if (b.userData.flat) b.rotation.set(-Math.PI / 2, 0, 0);
        else if (b.userData.mine) b.lookAt(camera.position);
        else b.rotation.set(0, b.userData.yaw || 0, 0);
      }
    });
    // Pass a book smoothly from where it is into someone's hands
    async function passBook(b, toFn, seconds, opts = {}) {
      const from = b.position.clone();
      b.userData.at = null;
      b.userData.flat = false;
      b.userData.mine = !!opts.mine;
      b.userData.yaw = opts.yaw || 0;
      if (opts.mine) b.lookAt(camera.position); else b.rotation.set(0, b.userData.yaw, 0);
      await tween(seconds, (k) => b.position.lerpVectors(from, toFn(), ease(k)));
      b.userData.at = toFn;
    }

    await fadeTo(0, 0.9);
    commander.mode = "talk";
    await say(NAMES.commander, LINES.home.welcome);
    hideDialogue();
    commander.mode = "idle";
    pip.mode = "talk";
    await say(NAMES.robot, LINES.home.pip);
    hideDialogue();
    pip.mode = "idle";

    // Nova hands a scrapbook to each astronaut ahead of us, who then steps aside
    const SIDE_SPOTS = [V(2.6, 0, -15.2), V(3.5, 0, -14.1), V(1.9, 0, -13.1), V(2.9, 0, -12.5), V(4.3, 0, -13.2)];
    let nextBook = books.length - 1;
    const novaHand = () => { commander.root.updateMatrixWorld(true); return commander.hand(1); };
    async function giveBookTo(kid, line, spot) {
      const b = books[nextBook--];
      commander.targetHeading = facing(commander.root.position, pip.root.position);
      await wait(0.4);
      await passBook(b, novaHand, 0.5);
      commander.targetHeading = facing(commander.root.position, kid.root.position);
      commander.mode = "present";
      await wait(0.3);
      await passBook(b, () => { kid.root.updateMatrixWorld(true); return kid.hand(1); }, 0.6, { yaw: kid.heading });
      kid.mode = "hold";
      if (window.AstroAudio) window.AstroAudio.sfx("chime");
      await wait(0.5);
      commander.mode = "idle";
      await walkTo(kid, [spot], 1.4, { endMode: "hold", face: NOVA_SPOT });
    }
    async function lineMovesUp(step) { // everyone still in line takes one step forward
      const moves = [];
      queue.forEach((c, i) => {
        if (i < step) return;
        const z = SLOT_Z[i - step];
        if (c === "me") moves.push(walkCamera([V(LINE_X, EYE, z)], 1.2));
        else moves.push(walkTo(c, [V(c.root.position.x, 0, z)], 1.2, { heading: Math.PI }));
      });
      cam.follow = () => novaLook();
      await Promise.all(moves);
      cam.follow = null;
    }
    await giveBookTo(queue[0], LINES.home.give[0], SIDE_SPOTS[0]);
    await lineMovesUp(1);
    await giveBookTo(queue[1], LINES.home.give[1], SIDE_SPOTS[1]);
    await lineMovesUp(2);

    // Our turn
    {
      const b = books[nextBook--];
      commander.targetHeading = facing(commander.root.position, pip.root.position);
      await wait(0.4);
      await passBook(b, novaHand, 0.5);
      commander.targetHeading = facing(commander.root.position, cam.pos);
      commander.mode = "present";
      await lookAtPoint(novaLook(), 0.5);
      await passBook(b, inFrontOfUs, 0.8, { mine: true });
      if (window.AstroAudio) window.AstroAudio.sfx("sparkle");
      commander.heading = commander.targetHeading = facing(commander.root.position, cam.pos);
      commander.mode = "talk";
      await lookAtPoint(novaLook(), 0.4);
      await say(NAMES.commander, LINES.home.yours);
      hideDialogue();
      commander.mode = "idle";
      // Step to the side, then open the book
      const aside = V(-2.2, EYE, -15.0);
      cam.follow = () => novaLook();
      await walkCamera([aside], 1.2);
      cam.follow = null;
      await lookTo(cam.yaw, -0.55, 0.8); // look down at the book in our hands
      if (window.AstroAudio) window.AstroAudio.sfx("whoosh");
      const othersGetTheirs = giveTheRest(); // (while we look through our book)
      await openScrapbook();
      await othersGetTheirs;
      b.visible = false;
      await lookAtPoint(novaLook(), 1.0);
    }
    async function giveTheRest() {
    const behind = queue.slice(3);
    for (let i = 0; i < behind.length; i++) {
      const kid = behind[i];
      await walkTo(kid, [V(LINE_X, 0, SLOT_Z[0])], 1.6, { heading: Math.PI });
      const b = books[nextBook--];
      await passBook(b, novaHand, 0.4);
      commander.targetHeading = facing(commander.root.position, kid.root.position);
      await passBook(b, () => { kid.root.updateMatrixWorld(true); return kid.hand(1); }, 0.5, { yaw: Math.PI });
      kid.mode = "hold";
      if (window.AstroAudio) window.AstroAudio.sfx("chime");
      walkTo(kid, [SIDE_SPOTS[2 + i]], 1.4, { endMode: "hold", face: NOVA_SPOT }).catch(() => {});
      await wait(0.6);
    }
    }
    await wait(0.8);

    // Nova concludes the mission
    commander.targetHeading = facing(commander.root.position, cam.pos);
    const pipAside = walkTo(pip, [V(-1.1, 0, -18.3)], 1.6, { face: cam.pos }); // PIP floats to Nova's side, where we can see it
    await lookAtPoint(novaLook(), 0.8);
    await Promise.race([pipAside, wait(3)]);
    commander.mode = "talk";
    for (const line of LINES.home.end) await say(NAMES.commander, line);
    hideDialogue();
    commander.mode = "wave";
    pip.mode = "excited";
    queue.forEach((c) => { if (c !== "me") c.mode = "cheer"; });
    if (window.AstroAudio) window.AstroAudio.sfx("success");
    await wait(2.4);

    await fadeTo(1, 1.4, "#2E96F5");

    // The end: back to the welcome screen
    dayEl.hidden = true;
    cancelAnimationFrame(raf);
    const back = document.getElementById("backButton");
    if (back) back.click(); // (does everything "Back to base" does: stops the story, shows the welcome screen)
  }
})();
