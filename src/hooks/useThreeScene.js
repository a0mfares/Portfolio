import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/* ── Theme Palettes ── */
const THEMES = {
  dark: {
    fog: 0x080f20, fogDensity: 0.002,
    ambientColor: 0x5588a0, ambientIntensity: 5,
    dirColor: 0x88b8d0, dirIntensity: 5,
    exposure: 0.8, envMapIntensity: 0.08,
  },
  light: {
    fog: 0xDDF4FF, fogDensity: 0.0015,
    ambientColor: 0xffffff, ambientIntensity: 0.9,
    dirColor: 0xfff6e0, dirIntensity: 1.8,
    exposure: 0.78, envMapIntensity: 0.35,
  },
};

const ORBIT_R = 120;
const d = THREE.MathUtils.degToRad;

const ISLAND_DEFS = [
  { x: 0,                          y: 30, z: 0,                          scale: 58, file: 'Assets/middle.glb',              isCenterIsland: true },
  { x: Math.cos(d(0))   * ORBIT_R, y: 20, z: Math.sin(d(0))   * ORBIT_R, scale: 45, file: 'Assets/Floadting Island 1.glb' },
  { x: Math.cos(d(60))  * ORBIT_R, y: 25, z: Math.sin(d(60))  * ORBIT_R, scale: 48, file: 'Assets/floating Island 3.glb'  },
  { x: Math.cos(d(120)) * ORBIT_R, y: 35, z: Math.sin(d(120)) * ORBIT_R, scale: 52, file: 'Assets/floating island 2.glb'  },
  { x: Math.cos(d(180)) * ORBIT_R, y: 22, z: Math.sin(d(180)) * ORBIT_R, scale: 42, file: 'Assets/floating Island 4.glb'  },
  { x: Math.cos(d(240)) * ORBIT_R, y: 28, z: Math.sin(d(240)) * ORBIT_R, scale: 46, file: 'Assets/floating Island 5.glb'  },
  { x: Math.cos(d(300)) * ORBIT_R, y: 25, z: Math.sin(d(300)) * ORBIT_R, scale: 44, file: 'Assets/floating Island 6.glb'  },
];

/**
 * useThreeScene
 *
 * Manages all Three.js rendering inside containerRef.
 * Exposes an imperative API via the returned apiRef.
 *
 * Callbacks (stable refs — safe to update between renders):
 *   onPanoReady()          — dark panorama loaded (start intro typing)
 *   onAllIslandsLoaded()   — all island GLTFs done (enable intro finish)
 *   onIslandFocused(id)    — camera transition-in complete
 *   onReturn()             — startReturn triggered (close panels immediately)
 */
export function useThreeScene(containerRef, callbacks) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const introFinishedRef = useRef(false);

  const apiRef = useRef({
    applyTheme:        () => {},
    setIslandsVisible: () => {},
    setIntroFinished:  (v) => { introFinishedRef.current = v; },
    startReturn:       () => {},
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    /* ─────────────────────────────────────────────
       DEVICE DETECTION
       On mobile we apply a cascade of optimisations:
         - no antialias, pixel-ratio capped at 1
         - no shadows anywhere
         - sequential (not parallel) GLTF loading
         - fire onAllIslandsLoaded after just the center island
         - 30 fps render throttle
         - minimal placeholder geometry
         - cull tiny detail meshes after each GLTF parse
    ───────────────────────────────────────────── */
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      || window.innerWidth <= 768;

    /* ── Renderer ── */
    const renderer = new THREE.WebGLRenderer({
      antialias:       !isMobile,
      powerPreference: isMobile ? 'low-power' : 'high-performance',
    });
    renderer.setPixelRatio(isMobile
      ? Math.min(window.devicePixelRatio, 1)
      : Math.min(window.devicePixelRatio, 1.5)
    );
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = THEMES.dark.exposure;
    renderer.shadowMap.enabled   = !isMobile;
    if (!isMobile) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    /* ── Scene ── */
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(THEMES.dark.fog, isMobile ? 0.001 : THEMES.dark.fogDensity);

    /* ── Camera ── */
    const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 1, 20000);
    camera.position.set(0, 160, 220);

    /* ── Controls ── */
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 30, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance   = 20;
    controls.maxDistance   = 600;

    /* ── Lights ── */
    const ambientLight = new THREE.AmbientLight(THEMES.dark.ambientColor, THEMES.dark.ambientIntensity);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(THEMES.dark.dirColor, THEMES.dark.dirIntensity);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = !isMobile;
    if (!isMobile) {
      dirLight.shadow.camera.top    =  200;
      dirLight.shadow.camera.right  =  200;
      dirLight.shadow.camera.bottom = -200;
      dirLight.shadow.camera.left   = -200;
      dirLight.shadow.camera.near   = 0.1;
      dirLight.shadow.camera.far    = 500;
      dirLight.shadow.mapSize.set(1024, 1024);
      dirLight.shadow.bias = -0.001;
    }
    scene.add(dirLight);

    /* ─────────────────────────────────────────────
       PANORAMIC SKY MESHES
       Uses an inverted sphere instead of scene.background to:
         1. Fix the mirrored panorama (EquirectangularReflectionMapping
            mirrors horizontally — it's designed for object reflections)
         2. Eliminate the geometry seam visible on fast swipes
    ───────────────────────────────────────────── */
    const panoramas  = { dark: null, light: null };
    const skyMeshes  = { dark: null, light: null };
    const texLoader  = new THREE.TextureLoader();
    let currentTheme = 'dark';

    function makeFallbackTexture(isDark) {
      const cv  = document.createElement('canvas');
      cv.width  = 2048; cv.height = 1024;
      const ctx = cv.getContext('2d');
      if (isDark) {
        const g = ctx.createLinearGradient(0, 0, 0, 1024);
        g.addColorStop(0,   '#060d1a');
        g.addColorStop(0.5, '#0d1f3c');
        g.addColorStop(1,   '#1a3a5c');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 2048, 1024);
        for (let i = 0; i < 800; i++) {
          const x = Math.random() * 2048, y = Math.random() * 512, r = Math.random() * 1.5;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200,220,255,${0.4 + Math.random() * 0.6})`;
          ctx.fill();
        }
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, 1024);
        g.addColorStop(0,   '#C8EDFF');
        g.addColorStop(0.6, '#DDF4FF');
        g.addColorStop(1,   '#EEF8FF');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 2048, 1024);
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    function buildSkyMesh(tex) {
      /* Flip UV horizontally to correct panorama orientation */
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.set(-1, 1);
      tex.offset.set(1, 0);
      const geo  = new THREE.SphereGeometry(9000, 48, 24);
      const mat  = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = -1;
      return mesh;
    }

    function processPanorama(themeKey, tex) {
      tex.colorSpace      = THREE.SRGBColorSpace;
      panoramas[themeKey] = tex;
      const mesh          = buildSkyMesh(tex);
      skyMeshes[themeKey] = mesh;
      if (themeKey === currentTheme) { scene.background = null; scene.add(mesh); }
      if (themeKey === 'dark') cbRef.current.onPanoReady?.();
    }

    function loadPanorama(themeKey, url) {
      texLoader.load(
        url,
        (tex) => processPanorama(themeKey, tex),
        undefined,
        ()    => processPanorama(themeKey, makeFallbackTexture(themeKey === 'dark'))
      );
    }

    loadPanorama('dark',  'Assets/bg.png');
    loadPanorama('light', 'Assets/light bg.png');

    /* ─────────────────────────────────────────────
       ISLANDS
    ───────────────────────────────────────────── */
    const loader  = new GLTFLoader();
    const islands = [];
    let gltfDoneCount = 0;

    /* On mobile, fire onAllIslandsLoaded after just the center island (index 0)
       so the intro sequence can finish immediately. The other 6 load silently
       in the background while the user is already exploring.
       On desktop, wait for all 7 as before.                                   */
    const readyThreshold = isMobile ? 1 : ISLAND_DEFS.length;

    function onIslandLoaded() {
      gltfDoneCount++;
      if (gltfDoneCount === readyThreshold) {
        cbRef.current.onAllIslandsLoaded?.();
      }
    }

    function makeUD(def, index) {
      return {
        originalY:      def.y,
        floatSpeed:     0.4 + Math.random() * 0.4,
        floatOffset:    Math.random() * Math.PI * 2,
        rotationSpeed:  def.isCenterIsland ? 0.0008 : (Math.random() - 0.5) * 0.002,
        isIsland:       true,
        id:             index,
        isCenterIsland: !!def.isCenterIsland,
      };
    }

    /* ── Placeholder geometry ──────────────────────────────────────────────
       Desktop : detailed rock + grass + trees (visual fidelity during load)
       Mobile  : single low-poly octahedron — near-zero CPU/GPU cost, no
                 tree/trunk/leaf meshes to allocate and upload to the GPU.
    ──────────────────────────────────────────────────────────────────────── */
    function makePlaceholder(def, index) {
      const g = new THREE.Group();

      if (isMobile) {
        const blob = new THREE.Mesh(
          new THREE.OctahedronGeometry(def.isCenterIsland ? 28 : 20, 1),
          new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.9, flatShading: true })
        );
        g.add(blob);
      } else {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(def.isCenterIsland ? 38 : 30, 1),
          new THREE.MeshStandardMaterial({ color: 0x7a6a55, roughness: 0.9, flatShading: true })
        );
        rock.castShadow = rock.receiveShadow = true;
        g.add(rock);

        const grass = new THREE.Mesh(
          new THREE.CylinderGeometry(28, 22, 10, 7),
          new THREE.MeshStandardMaterial({ color: 0x4a7c38, roughness: 0.8, flatShading: true })
        );
        grass.position.y = 28; grass.castShadow = grass.receiveShadow = true; g.add(grass);

        const tc = def.isCenterIsland ? 5 : 3;
        const tr = def.isCenterIsland ? 16 : 12;
        for (let t = 0; t < tc; t++) {
          const tg    = new THREE.Group();
          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(1.5, 2.4, 12, 5),
            new THREE.MeshStandardMaterial({ color: 0x4a3728 })
          );
          trunk.position.y = 6; tg.add(trunk);
          const leaves = new THREE.Mesh(
            new THREE.ConeGeometry(9, 18, 5),
            new THREE.MeshStandardMaterial({ color: 0x2d5a27, flatShading: true })
          );
          leaves.position.y = 18; tg.add(leaves);
          const a = (t / tc) * Math.PI * 2;
          tg.position.set(Math.cos(a) * tr, 30, Math.sin(a) * tr);
          tg.rotation.y = Math.random() * Math.PI;
          g.add(tg);
        }
      }

      g.position.set(def.x, def.y, def.z);
      g.scale.setScalar(def.scale / 3);
      g.userData = makeUD(def, index);
      g.visible  = false;
      scene.add(g);
      islands.push(g);
    }

    /* ── Post-load mesh processing ─────────────────────────────────────────
       On mobile, after each GLTF parses we hide child meshes whose local
       bounding sphere radius is below a threshold. These are tiny decorative
       details (pebbles, bolts, leaf clusters) that add GPU draw calls but
       are effectively invisible at normal viewing distances on a small screen.
    ──────────────────────────────────────────────────────────────────────── */
    const MOBILE_CULL_RADIUS = 1.5; /* world-space units */
    const _bbox = new THREE.Box3();
    const _bsph = new THREE.Sphere();
    const _ws   = new THREE.Vector3();

    function prepareIslandMesh(island) {
      island.traverse((child) => {
        if (!child.isMesh) return;

        child.castShadow    = !isMobile;
        child.receiveShadow = !isMobile;

        if (child.material) {
          child.material.envMapIntensity = THEMES[currentTheme].envMapIntensity;
          if (!isMobile) {
            child.material.roughness = Math.max(child.material.roughness ?? 0.5, 0.2);
          }
        }

        /* Cull micro-detail meshes on mobile */
        if (isMobile && child.geometry) {
          child.geometry.computeBoundingBox();
          _bbox.copy(child.geometry.boundingBox);
          _bbox.getBoundingSphere(_bsph);
          child.getWorldScale(_ws);
          const worldRadius = _bsph.radius * Math.max(_ws.x, _ws.y, _ws.z);
          if (worldRadius < MOBILE_CULL_RADIUS) child.visible = false;
        }
      });
    }

    /* ─────────────────────────────────────────────
       SEQUENTIAL vs PARALLEL LOADING

       Desktop : fire all 7 fetches at once — HTTP/2 handles parallelism
                 efficiently and GPUs handle concurrent uploads fine.

       Mobile  : load one island at a time with a 150 ms gap between each.
                 This prevents 7 simultaneous GLTF parse + GPU-upload jobs
                 from locking the main thread for several seconds on mid/low-end
                 phones. The gap lets the browser paint frames and stay responsive.
                 Island 0 (center) loads first so the user can interact immediately.
    ───────────────────────────────────────────── */
    const MOBILE_LOAD_DELAY_MS = 150;

    function loadSingleIsland(def, i, onDone) {
      loader.load(
        def.file,
        (gltf) => {
          const island = gltf.scene;
          island.position.set(def.x, def.y, def.z);
          island.scale.setScalar(def.scale);
          prepareIslandMesh(island);
          island.userData = makeUD(def, i);
          island.visible  = false;
          scene.add(island);
          islands.push(island);
          onIslandLoaded();
          onDone?.();
        },
        undefined,
        () => {
          makePlaceholder(def, i);
          onIslandLoaded();
          onDone?.();
        }
      );
    }

    if (isMobile) {
      /* Sequential queue — island 0 first, then 1–6 with breathing room */
      let queueIndex = 0;
      function loadNext() {
        if (queueIndex >= ISLAND_DEFS.length) return;
        const i   = queueIndex++;
        loadSingleIsland(ISLAND_DEFS[i], i, () => setTimeout(loadNext, MOBILE_LOAD_DELAY_MS));
      }
      loadNext();
    } else {
      /* Parallel — all at once for fastest desktop load */
      ISLAND_DEFS.forEach((def, i) => loadSingleIsland(def, i, null));
    }

    /* ── Camera Transitions ── */
    const ISLAND_FOCUS_DEFS = {
      0: { pos: new THREE.Vector3(0, 80, 90),                                              target: new THREE.Vector3(0, 38, 0) },
      1: { pos: new THREE.Vector3(Math.cos(d(0))   * 55, 70, Math.sin(d(0))   * 55),      target: new THREE.Vector3(Math.cos(d(0))   * ORBIT_R, 28, Math.sin(d(0))   * ORBIT_R) },
      2: { pos: new THREE.Vector3(Math.cos(d(60))  * 55, 70, Math.sin(d(60))  * 55),      target: new THREE.Vector3(Math.cos(d(60))  * ORBIT_R, 33, Math.sin(d(60))  * ORBIT_R) },
      3: { pos: new THREE.Vector3(Math.cos(d(120)) * 55, 70, Math.sin(d(120)) * 55),      target: new THREE.Vector3(Math.cos(d(120)) * ORBIT_R, 43, Math.sin(d(120)) * ORBIT_R) },
      4: { pos: new THREE.Vector3(Math.cos(d(180)) * 55, 70, Math.sin(d(180)) * 55),      target: new THREE.Vector3(Math.cos(d(180)) * ORBIT_R, 30, Math.sin(d(180)) * ORBIT_R) },
      5: { pos: new THREE.Vector3(Math.cos(d(240)) * 55, 70, Math.sin(d(240)) * 55),      target: new THREE.Vector3(Math.cos(d(240)) * ORBIT_R, 36, Math.sin(d(240)) * ORBIT_R) },
      6: { pos: new THREE.Vector3(Math.cos(d(300)) * 55, 70, Math.sin(d(300)) * 55),      target: new THREE.Vector3(Math.cos(d(300)) * ORBIT_R, 30, Math.sin(d(300)) * ORBIT_R) },
    };

    let viewMode           = 'overview';
    let focusedIsland      = null;
    const overviewCamPos   = new THREE.Vector3(0, 160, 220);
    const overviewTarget   = new THREE.Vector3(0, 30, 0);
    let transProgress      = 0;
    let transitionComplete = false;
    const TRANS_SPEED      = 0.012;
    let bzP0, bzP1, bzP2, bzP3, lookFrom, lookTo;

    function easeInOut(t) {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    function cubicBezier(P0, P1, P2, P3, t) {
      const u = 1 - t, tt = t * t, uu = u * u;
      return P0.clone().multiplyScalar(uu * u)
        .add(P1.clone().multiplyScalar(3 * uu * t))
        .add(P2.clone().multiplyScalar(3 * u  * tt))
        .add(P3.clone().multiplyScalar(tt * t));
    }

    function startFocus(island) {
      const def = ISLAND_FOCUS_DEFS[island.userData.id];
      if (!def) return;
      bzP0 = camera.position.clone(); bzP3 = def.pos.clone();
      const mid = bzP0.clone().lerp(bzP3, 0.5); mid.y += 70;
      bzP1 = bzP0.clone().lerp(mid, 0.3); bzP2 = bzP3.clone().lerp(mid, 0.3);
      lookFrom = controls.target.clone(); lookTo = def.target.clone();
      transProgress = 0; transitionComplete = false;
      viewMode = 'transitioning-in'; controls.enabled = false;
    }

    function startReturn() {
      if (viewMode !== 'focused') return;
      bzP0 = camera.position.clone(); bzP3 = overviewCamPos.clone();
      const mid = bzP0.clone().lerp(bzP3, 0.5); mid.y += 60;
      bzP1 = bzP0.clone().lerp(mid, 0.3); bzP2 = bzP3.clone().lerp(mid, 0.3);
      lookFrom = controls.target.clone(); lookTo = overviewTarget.clone();
      transProgress = 0; transitionComplete = false;
      viewMode = 'transitioning-out'; controls.enabled = false;
      focusedIsland = null;
      cbRef.current.onReturn?.();
    }

    /* ── Raycasting / Click ── */
    const raycaster  = new THREE.Raycaster();
    const mouse      = new THREE.Vector2();
    let mouseDownPos = { x: 0, y: 0 };

    function pick(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      for (const hit of hits) {
        let o = hit.object;
        while (o.parent && o.parent !== scene) o = o.parent;
        if (o.userData?.isIsland) return o;
      }
      return null;
    }

    const onMouseDown = (e) => { mouseDownPos = { x: e.clientX, y: e.clientY }; };
    const onMouseUp   = (e) => {
      if (Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y) > 5) return;
      if (viewMode === 'transitioning-in' || viewMode === 'transitioning-out') return;
      const clicked = pick(e.clientX, e.clientY);
      if (viewMode === 'overview' && clicked) {
        overviewCamPos.copy(camera.position);
        overviewTarget.copy(controls.target);
        focusedIsland = clicked;
        startFocus(clicked);
      } else if (viewMode === 'focused' && !clicked) {
        startReturn();
      }
    };

    let touchStart     = { x: 0, y: 0 };
    const onTouchStart = (e) => { touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
    const onTouchEnd   = (e) => {
      const t = e.changedTouches[0];
      if (!t) return;
      if (Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) > 10) return;
      onMouseUp({ clientX: t.clientX, clientY: t.clientY });
    };

    renderer.domElement.addEventListener('mousedown',  onMouseDown);
    renderer.domElement.addEventListener('mouseup',    onMouseUp);
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    renderer.domElement.addEventListener('touchend',   onTouchEnd,   { passive: true });

    /* ── Transition Tick ── */
    function tickTransition() {
      if (viewMode !== 'transitioning-in' && viewMode !== 'transitioning-out') return;
      if (!bzP0 || !bzP3) return;

      transProgress = Math.min(1, transProgress + TRANS_SPEED);
      const t = easeInOut(transProgress);
      camera.position.copy(cubicBezier(bzP0, bzP1, bzP2, bzP3, t));
      controls.target.copy(lookFrom.clone().lerp(lookTo, t));
      controls.update();

      if (transProgress >= 1 && !transitionComplete) {
        transitionComplete = true;
        controls.enabled = true;
        if (viewMode === 'transitioning-in') {
          viewMode = 'focused';
          controls.minDistance = 30;
          controls.maxDistance = 250;
          if (focusedIsland) cbRef.current.onIslandFocused?.(focusedIsland.userData.id);
        } else {
          viewMode = 'overview';
          controls.minDistance = 20;
          controls.maxDistance = 600;
          cbRef.current.onReturnComplete?.();
        }
        bzP0 = bzP1 = bzP2 = bzP3 = null;
        lookFrom = lookTo = null;
      }
    }

    /* ─────────────────────────────────────────────
       RENDER LOOP
       Mobile: throttle to ~30 fps by skipping frames
       whose delta falls below the 33 ms budget.
       This alone halves the GPU workload on mobile.
    ───────────────────────────────────────────── */
    const clock     = new THREE.Clock();
    const TARGET_MS = isMobile ? 1000 / 30 : 0; /* 0 = uncapped on desktop */
    let lastFrameMs = 0;
    let animId;

    function animate(now) {
      animId = requestAnimationFrame(animate);

      if (isMobile && now - lastFrameMs < TARGET_MS) return;
      lastFrameMs = now;

      const time = clock.getElapsedTime();
      controls.update();
      tickTransition();

      if (introFinishedRef.current) {
        for (const isl of islands) {
          isl.position.y = isl.userData.originalY
            + Math.sin(time * isl.userData.floatSpeed + isl.userData.floatOffset) * 2;
          isl.rotation.y += isl.userData.rotationSpeed;
        }
      }

      renderer.render(scene, camera);
    }

    animate(0);

    /* ── Resize ── */
    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    /* ── Expose API ── */
    apiRef.current = {
      applyTheme(theme) {
        currentTheme = theme;
        const t = THEMES[theme];
        scene.fog.color.setHex(t.fog);
        scene.fog.density = isMobile ? 0.001 : t.fogDensity;
        ambientLight.color.setHex(t.ambientColor);
        ambientLight.intensity = t.ambientIntensity;
        dirLight.color.setHex(t.dirColor);
        dirLight.intensity = t.dirIntensity;
        renderer.toneMappingExposure = t.exposure;

        /* Swap sky meshes */
        const prev = theme === 'dark' ? 'light' : 'dark';
        if (skyMeshes[prev])  scene.remove(skyMeshes[prev]);
        if (skyMeshes[theme]) {
          scene.add(skyMeshes[theme]);
          scene.background = null;
        } else if (panoramas[theme]) {
          scene.background = panoramas[theme];
        }

        islands.forEach((isl) => {
          isl.traverse((child) => {
            if (child.isMesh && child.material) {
              child.material.envMapIntensity = t.envMapIntensity;
            }
          });
        });
      },
      setIslandsVisible(visible) {
        islands.forEach((isl) => { isl.visible = visible; });
      },
      setIntroFinished(v) {
        introFinishedRef.current = v;
      },
      startReturn,
    };

    /* ── Cleanup ── */
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('mousedown',  onMouseDown);
      renderer.domElement.removeEventListener('mouseup',    onMouseUp);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchend',   onTouchEnd);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      apiRef.current = {
        applyTheme:        () => {},
        setIslandsVisible: () => {},
        setIntroFinished:  () => {},
        startReturn:       () => {},
      };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return apiRef;
}
