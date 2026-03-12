import { useRef, useEffect } from 'react';

/* ── Device Detection ── */
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  || window.innerWidth < 768;

/* ── Theme Palettes ── */
const THEMES = {
  dark: {
    fog: 0x080f20, fogDensity: 0.002,
    ambientColor: 0x5588a0, ambientIntensity: 5,
    dirColor: 0x88b8d0, dirIntensity: 5,
    exposure: 0.8, envMapIntensity: 0.08,
    panoUrl: 'Assets/bg.webp',
  },
  light: {
    fog: 0xDDF4FF, fogDensity: 0.0015,
    ambientColor: 0xffffff, ambientIntensity: 0.9,
    dirColor: 0xfff6e0, dirIntensity: 1.8,
    exposure: 0.78, envMapIntensity: 0.35,
    panoUrl: 'Assets/light bg.webp',
  },
};

/* ORBIT_R and ISLAND_DEFS are created inside the async initialiser
   because they depend on THREE.MathUtils which is dynamically imported. */

/* ─────────────────────────────────────────────────────────────────
   Mobile / DPR Helpers
   
   Problem: Android Chrome reports a high devicePixelRatio (e.g. 3×)
   but silently clips the WebGL framebuffer at 4096px on either axis.
   The result is objects rendering incorrectly or appearing black/
   corrupted when (innerWidth × dpr) or (innerHeight × dpr) > 4096.
   
   Fix (from Three.js community thread):
     Clamp dpr so neither canvas dimension exceeds MAX_ANDROID_BUFFER.
     We also re-run this calculation on every resize because
     orientation changes swap width/height and can re-trigger the bug.
───────────────────────────────────────────────────────────────── */
const isAndroidChrome =
  /Android/i.test(navigator.userAgent) && /Chrome/i.test(navigator.userAgent);
const MAX_ANDROID_BUFFER = 4096;

function getSafeDPR() {
  // Start with the native ratio, already capped lower on mobile for perf
  let dpr = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);

  // Apply the Android/Chrome 4096-buffer-dimension fix
  if (
    isAndroidChrome &&
    (window.innerWidth * dpr > MAX_ANDROID_BUFFER ||
      window.innerHeight * dpr > MAX_ANDROID_BUFFER)
  ) {
    dpr = Math.floor(
      Math.min(
        dpr - 1,
        MAX_ANDROID_BUFFER / window.innerHeight,
        MAX_ANDROID_BUFFER / window.innerWidth,
      ),
    );
  }

  // Safety floor — never let dpr drop below 0.5
  return Math.max(dpr, 0.5);
}

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
  /* Keep callbacks in a ref so the animation loop always reads the latest version */
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  /* Flags the hook consumer can mutate without re-renders */
  const introFinishedRef = useRef(false);

  /* Exposed imperative API */
  const apiRef = useRef({
    applyTheme: () => { },
    setIslandsVisible: () => { },
    setIntroFinished: (v) => { introFinishedRef.current = v; },
    startReturn: () => { },
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    /* Track whether cleanup has run before init finishes */
    let disposed = false;

    /* ── Defer Three.js loading until after first paint ── */
    const deferInit = typeof requestIdleCallback === 'function'
      ? requestIdleCallback
      : (cb) => setTimeout(cb, 0);

    const cancelInit = typeof cancelIdleCallback === 'function'
      ? cancelIdleCallback
      : clearTimeout;

    const initId = deferInit(async () => {
      if (disposed) return;

      /* ── Dynamic imports — keeps Three.js out of the initial bundle ── */
      const [THREE, { OrbitControls }, { GLTFLoader }, { DRACOLoader }] =
        await Promise.all([
          import('three'),
          import('three/examples/jsm/controls/OrbitControls.js'),
          import('three/examples/jsm/loaders/GLTFLoader.js'),
          import('three/examples/jsm/loaders/DRACOLoader.js'),
        ]);

      if (disposed) return;   // component unmounted while awaiting

      /* ── Build ISLAND_DEFS (needs THREE.MathUtils) ── */
      const ORBIT_R = 120;
      const d = THREE.MathUtils.degToRad;
      const ISLAND_DEFS = [
        { x: 0, y: 30, z: 0, scale: 58, file: 'Assets/middle.glb', isCenterIsland: true },
        { x: Math.cos(d(0)) * ORBIT_R, y: 20, z: Math.sin(d(0)) * ORBIT_R, scale: 45, file: 'Assets/Floadting Island 1.glb' },
        { x: Math.cos(d(60)) * ORBIT_R, y: 25, z: Math.sin(d(60)) * ORBIT_R, scale: 48, file: 'Assets/floating Island 3.glb' },
        { x: Math.cos(d(120)) * ORBIT_R, y: 35, z: Math.sin(d(120)) * ORBIT_R, scale: 52, file: 'Assets/floating island 2.glb' },
        { x: Math.cos(d(180)) * ORBIT_R, y: 22, z: Math.sin(d(180)) * ORBIT_R, scale: 42, file: 'Assets/floating Island 4.glb' },
        { x: Math.cos(d(240)) * ORBIT_R, y: 28, z: Math.sin(d(240)) * ORBIT_R, scale: 46, file: 'Assets/floating Island 5.glb' },
        { x: Math.cos(d(300)) * ORBIT_R, y: 25, z: Math.sin(d(300)) * ORBIT_R, scale: 44, file: 'Assets/floating Island 6.glb' },
      ];

      /* ── Renderer ── */
      const renderer = new THREE.WebGLRenderer({
        antialias: !isMobile,          // off on mobile → big GPU saving
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(
        isMobile
          ? Math.min(window.devicePixelRatio, 1)   // cap at 1× on mobile
          : Math.min(window.devicePixelRatio, 1.5)
      );
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;   // correct sRGB for GLTF textures
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = THEMES.dark.exposure;
      renderer.shadowMap.enabled = !isMobile;   // shadows off on mobile
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setClearColor(THEMES.dark.fog, 1);   // match fog so no seam shows past panorama
      container.appendChild(renderer.domElement);

      /* ── Scene ── */
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(THEMES.dark.fog, THEMES.dark.fogDensity);

      /* ── Camera ── */
      const camera = new THREE.PerspectiveCamera(
        55,
        container.clientWidth / container.clientHeight,
        1,
        20000
      );
      camera.position.set(0, 160, 220);

      /* ── Controls ──
         Touch feel tweaks for mobile: slightly slower rotate, more damping
      */
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 30, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.maxPolarAngle = Math.PI / 2 - 0.05;
      controls.minDistance = 20;
      controls.maxDistance = isMobile ? 300 : 600;   // tighter on mobile to prevent seeing past panorama

      /* ── Lights ── */
      const ambientLight = new THREE.AmbientLight(
        THEMES.dark.ambientColor,
        THEMES.dark.ambientIntensity
      );
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(
        THEMES.dark.dirColor,
        THEMES.dark.dirIntensity
      );
      dirLight.position.set(50, 100, 50);
      if (!isMobile) {
        dirLight.castShadow = true;
        dirLight.shadow.camera.top = 200;
        dirLight.shadow.camera.right = 200;
        dirLight.shadow.camera.bottom = -200;
        dirLight.shadow.camera.left = -200;
        dirLight.shadow.camera.near = 0.1;
        dirLight.shadow.camera.far = 500;
        dirLight.shadow.mapSize.set(1024, 1024);
        dirLight.shadow.bias = -0.001;
      }
      scene.add(dirLight);

      /* ── Panoramic Backgrounds ── */
      const panoramas = { dark: null, light: null };
      const texLoader = new THREE.TextureLoader();
      let currentTheme = 'dark';

      function makeFallbackTexture(isDark) {
        const cv = document.createElement('canvas');
        cv.width = 2048; cv.height = 1024;
        const ctx = cv.getContext('2d');
        if (isDark) {
          const g = ctx.createLinearGradient(0, 0, 0, 1024);
          g.addColorStop(0, '#060d1a'); g.addColorStop(0.5, '#0d1f3c'); g.addColorStop(1, '#1a3a5c');
          ctx.fillStyle = g; ctx.fillRect(0, 0, 2048, 1024);
          for (let i = 0; i < 800; i++) {
            const x = Math.random() * 2048, y = Math.random() * 512, r = Math.random() * 1.5;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200,220,255,${0.4 + Math.random() * 0.6})`; ctx.fill();
          }
        } else {
          const g = ctx.createLinearGradient(0, 0, 0, 1024);
          g.addColorStop(0, '#C8EDFF'); g.addColorStop(0.6, '#DDF4FF'); g.addColorStop(1, '#EEF8FF');
          ctx.fillStyle = g; ctx.fillRect(0, 0, 2048, 1024);
        }
        const tex = new THREE.CanvasTexture(cv);
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      }

      function processPanorama(themeKey, tex) {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        panoramas[themeKey] = tex;
        if (themeKey === currentTheme) scene.background = tex;
        if (themeKey === 'dark') {
          // Two-frame delay ensures the panorama is visibly painted before firing
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              cbRef.current.onPanoReady?.();
            });
          });
        }
      }

      function loadPanorama(themeKey, url) {
        texLoader.load(
          url,
          (tex) => processPanorama(themeKey, tex),
          undefined,
          () => processPanorama(themeKey, makeFallbackTexture(themeKey === 'dark'))
        );
      }

      // Load current theme panorama first for better LCP
      loadPanorama(currentTheme, THEMES[currentTheme].panoUrl);
      // Lazily load the other theme
      setTimeout(() => {
        const otherTheme = currentTheme === 'dark' ? 'light' : 'dark';
        loadPanorama(otherTheme, THEMES[otherTheme].panoUrl);
      }, 2000);

      /* ── DRACO + GLTF Loader ── */
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('/draco/');  // served from public/draco/
      dracoLoader.preload();                  // fetch WASM decoder in background now

      const loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoader);

      /* ── Islands ── */
      const islands = [];
      let loadedCount = 0;
      const totalIslands = ISLAND_DEFS.length;

      function makeUD(def, index) {
        return {
          originalY: def.y,
          floatSpeed: 0.4 + Math.random() * 0.4,
          floatOffset: Math.random() * Math.PI * 2,
          rotationSpeed: def.isCenterIsland ? 0.0008 : (Math.random() - 0.5) * 0.002,
          isIsland: true,
          id: index,
          isCenterIsland: !!def.isCenterIsland,
        };
      }

      function makePlaceholder(def, index) {
        const g = new THREE.Group();
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(def.isCenterIsland ? 38 : 30, 1),
          new THREE.MeshStandardMaterial({ color: 0x7a6a55, roughness: 0.9, flatShading: true })
        );
        rock.castShadow = rock.receiveShadow = !isMobile;
        g.add(rock);

        const grass = new THREE.Mesh(
          new THREE.CylinderGeometry(28, 22, 10, 7),
          new THREE.MeshStandardMaterial({ color: 0x4a7c38, roughness: 0.8, flatShading: true })
        );
        grass.position.y = 28;
        grass.castShadow = grass.receiveShadow = !isMobile;
        g.add(grass);

        const tc = def.isCenterIsland ? 5 : 3;
        const tr = def.isCenterIsland ? 16 : 12;
        for (let t = 0; t < tc; t++) {
          const tg = new THREE.Group();
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

        g.position.set(def.x, def.y, def.z);
        g.scale.setScalar(def.scale / 3);
        g.userData = makeUD(def, index);
        g.visible = false;
        scene.add(g);
        islands.push(g);
      }

      function onIslandLoaded() {
        loadedCount++;
        if (loadedCount === totalIslands) {
          cbRef.current.onAllIslandsLoaded?.();
        }
      }

      function loadIsland(def, i) {
        loader.load(
          def.file,
          (gltf) => {
            const island = gltf.scene;
            island.position.set(def.x, def.y, def.z);
            island.scale.setScalar(def.scale);
            island.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = child.receiveShadow = !isMobile;
                if (child.material) {
                  child.material.envMapIntensity = THEMES[currentTheme].envMapIntensity;
                  child.material.roughness = Math.max(child.material.roughness ?? 0.5, 0.2);
                }
              }
            });
            island.userData = makeUD(def, i);
            island.visible = false;
            scene.add(island);
            islands.push(island);
            onIslandLoaded();
          },
          undefined,
          () => { makePlaceholder(def, i); onIslandLoaded(); }
        );
      }

      if (isMobile) {
        /* Sequential loading with gaps — prevents memory spikes on mobile */
        ISLAND_DEFS.forEach((def, i) => {
          /* Synchronous placeholder so islands[] is populated before setIslandsVisible */
          makePlaceholder(def, i);
        });

        /* Reset counters — placeholders don't count toward loaded total here */
        loadedCount = 0;

        (async function loadSequentially() {
          for (let i = 0; i < ISLAND_DEFS.length; i++) {
            await new Promise((resolve) => {
              loader.load(
                ISLAND_DEFS[i].file,
                (gltf) => {
                  /* Swap out placeholder with real model */
                  const placeholder = islands[i];
                  scene.remove(placeholder);

                  const island = gltf.scene;
                  island.position.set(ISLAND_DEFS[i].x, ISLAND_DEFS[i].y, ISLAND_DEFS[i].z);
                  island.scale.setScalar(ISLAND_DEFS[i].scale);
                  island.traverse((child) => {
                    if (child.isMesh) {
                      child.castShadow = child.receiveShadow = false;
                      if (child.material) {
                        child.material.envMapIntensity = THEMES[currentTheme].envMapIntensity;
                        child.material.roughness = Math.max(child.material.roughness ?? 0.5, 0.2);
                      }
                    }
                  });
                  island.userData = makeUD(ISLAND_DEFS[i], i);
                  island.visible = islands[i].visible; // inherit visibility state
                  scene.add(island);
                  islands[i] = island;

                  onIslandLoaded();
                  resolve();
                },
                undefined,
                () => {
                  /* Keep existing placeholder on error */
                  onIslandLoaded();
                  resolve();
                }
              );
            });

            /* Small gap between each load to avoid memory pressure */
            if (i < ISLAND_DEFS.length - 1) {
              await new Promise((r) => setTimeout(r, 150));
            }
          }
        })();
      } else {
        /* Desktop: Priority-based loading */
        // Load center island first
        const centerDef = ISLAND_DEFS.find(d => d.isCenterIsland);
        const centerIdx = ISLAND_DEFS.indexOf(centerDef);
        if (centerDef) {
          loadIsland(centerDef, centerIdx);
        }

        // Load others with a slight staggered delay to avoid competing for bandwidth
        ISLAND_DEFS.forEach((def, i) => {
          if (!def.isCenterIsland) {
            setTimeout(() => loadIsland(def, i), 100 + i * 50);
          }
        });
      }

      /* ── Camera Transitions ── */
      const ISLAND_FOCUS_DEFS = {
        0: { pos: new THREE.Vector3(0, 80, 90), target: new THREE.Vector3(0, 38, 0) },
        1: { pos: new THREE.Vector3(Math.cos(d(0)) * 55, 70, Math.sin(d(0)) * 55), target: new THREE.Vector3(Math.cos(d(0)) * ORBIT_R, 28, Math.sin(d(0)) * ORBIT_R) },
        2: { pos: new THREE.Vector3(Math.cos(d(60)) * 55, 70, Math.sin(d(60)) * 55), target: new THREE.Vector3(Math.cos(d(60)) * ORBIT_R, 33, Math.sin(d(60)) * ORBIT_R) },
        3: { pos: new THREE.Vector3(Math.cos(d(120)) * 55, 70, Math.sin(d(120)) * 55), target: new THREE.Vector3(Math.cos(d(120)) * ORBIT_R, 43, Math.sin(d(120)) * ORBIT_R) },
        4: { pos: new THREE.Vector3(Math.cos(d(180)) * 55, 70, Math.sin(d(180)) * 55), target: new THREE.Vector3(Math.cos(d(180)) * ORBIT_R, 30, Math.sin(d(180)) * ORBIT_R) },
        5: { pos: new THREE.Vector3(Math.cos(d(240)) * 55, 70, Math.sin(d(240)) * 55), target: new THREE.Vector3(Math.cos(d(240)) * ORBIT_R, 36, Math.sin(d(240)) * ORBIT_R) },
        6: { pos: new THREE.Vector3(Math.cos(d(300)) * 55, 70, Math.sin(d(300)) * 55), target: new THREE.Vector3(Math.cos(d(300)) * ORBIT_R, 30, Math.sin(d(300)) * ORBIT_R) },
      };

      let viewMode = 'overview';
      let focusedIsland = null;
      const overviewCamPos = new THREE.Vector3(0, 160, 220);
      const overviewTarget = new THREE.Vector3(0, 30, 0);
      let transProgress = 0;
      let transitionComplete = false;
      const TRANS_SPEED = 0.012;
      let bzP0, bzP1, bzP2, bzP3, lookFrom, lookTo;

      function easeInOut(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      }

      function cubicBezier(P0, P1, P2, P3, t) {
        const u = 1 - t, tt = t * t, uu = u * u;
        return P0.clone().multiplyScalar(uu * u)
          .add(P1.clone().multiplyScalar(3 * uu * t))
          .add(P2.clone().multiplyScalar(3 * u * tt))
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
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      let mouseDownPos = { x: 0, y: 0 };

      function pick(clientX, clientY) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
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
      const onMouseUp = (e) => {
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

      let touchStart = { x: 0, y: 0 };
      const onTouchStart = (e) => { touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
      const onTouchEnd = (e) => {
        const t = e.changedTouches[0];
        if (!t) return;
        if (Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) > TAP_TOLERANCE) return;
        onMouseUp({ clientX: t.clientX, clientY: t.clientY });
      };

      renderer.domElement.addEventListener('mousedown', onMouseDown);
      renderer.domElement.addEventListener('mouseup', onMouseUp);
      renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
      renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: true });

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

      /* ── Render Loop ── */
      const clock = new THREE.Clock();
      /* ── Render Loop ── */
      let animId;
      let lastFrameTime = 0;
      const MOBILE_FRAME_INTERVAL = 1000 / 30; // 30 fps cap on mobile

      function animate(now) {
        animId = requestAnimationFrame(animate);

        /* Throttle to 30fps on mobile to reduce GPU load */
        if (isMobile) {
          if (now - lastFrameTime < MOBILE_FRAME_INTERVAL) return;
          lastFrameTime = now;
        }

        const time = clock.getElapsedTime();
        controls.update();
        tickTransition();

        if (introFinishedRef.current) {
          for (const isl of islands) {
            isl.position.y =
              isl.userData.originalY
              + Math.sin(time * isl.userData.floatSpeed + isl.userData.floatOffset) * 2;
            isl.rotation.y += isl.userData.rotationSpeed;
          }
        }

        renderer.render(scene, camera);
      }

      animate(0);

      /* ── Resize ──
         IMPORTANT: getSafeDPR() must be re-called on every resize.
         Rotating the phone swaps innerWidth/innerHeight, which can
         re-trigger (or resolve) the Android 4096-buffer overflow.
      */
      const onResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        renderer.setPixelRatio(getSafeDPR()); // recalculate after orientation change
      };
      window.addEventListener('resize', onResize);

      /* ── Expose API ── */
      apiRef.current = {
        applyTheme(theme) {
          currentTheme = theme;
          const t = THEMES[theme];
          scene.fog.color.setHex(t.fog);
          scene.fog.density = t.fogDensity;
          renderer.setClearColor(t.fog, 1);   // keep clear color in sync with fog
          ambientLight.color.setHex(t.ambientColor);
          ambientLight.intensity = t.ambientIntensity;
          dirLight.color.setHex(t.dirColor);
          dirLight.intensity = t.dirIntensity;
          renderer.toneMappingExposure = t.exposure;
          if (panoramas[theme]) scene.background = panoramas[theme];
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
      /* Store inner cleanup so the outer teardown can call it */
      cleanupFn = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', onResize);
        renderer.domElement.removeEventListener('mousedown', onMouseDown);
        renderer.domElement.removeEventListener('mouseup', onMouseUp);
        renderer.domElement.removeEventListener('touchstart', onTouchStart);
        renderer.domElement.removeEventListener('touchend', onTouchEnd);
        controls.dispose();
        dracoLoader.dispose();   // release WASM decoder
        renderer.dispose();

        // Dispose of panoramas
        if (panoramas.dark) panoramas.dark.dispose();
        if (panoramas.light) panoramas.light.dispose();

        // Dispose of island materials/geometries
        islands.forEach(isl => {
          isl.traverse(child => {
            if (child.isMesh) {
              child.geometry.dispose();
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach(m => m.dispose());
                } else {
                  child.material.dispose();
                }
              }
            }
          });
        });

        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        apiRef.current = {
          applyTheme: () => { },
          setIslandsVisible: () => { },
          setIntroFinished: () => { },
          startReturn: () => { },
        };
      };

      // If component was disposed while we were initialising, clean up now
      if (disposed) cleanupFn();

    });   // end deferInit async callback

    let cleanupFn = null;

    return () => {
      disposed = true;
      cancelInit(initId);
      if (cleanupFn) cleanupFn();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return apiRef;
}
