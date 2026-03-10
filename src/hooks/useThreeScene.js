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
  { x: 0,                          y: 30, z: 0,                          scaleDesktop: 58, scaleMobile: 50, file: 'Assets/middle.glb',              isCenterIsland: true },
  { x: Math.cos(d(0))   * ORBIT_R, y: 20, z: Math.sin(d(0))   * ORBIT_R, scaleDesktop: 45, scaleMobile: 38, file: 'Assets/Floadting Island 1.glb' },
  { x: Math.cos(d(60))  * ORBIT_R, y: 25, z: Math.sin(d(60))  * ORBIT_R, scaleDesktop: 48, scaleMobile: 40, file: 'Assets/floating Island 3.glb'   },
  { x: Math.cos(d(120)) * ORBIT_R, y: 35, z: Math.sin(d(120)) * ORBIT_R, scaleDesktop: 52, scaleMobile: 44, file: 'Assets/floating island 2.glb'   },
  { x: Math.cos(d(180)) * ORBIT_R, y: 22, z: Math.sin(d(180)) * ORBIT_R, scaleDesktop: 42, scaleMobile: 35, file: 'Assets/floating Island 4.glb'   },
  { x: Math.cos(d(240)) * ORBIT_R, y: 28, z: Math.sin(d(240)) * ORBIT_R, scaleDesktop: 46, scaleMobile: 39, file: 'Assets/floating Island 5.glb'   },
  { x: Math.cos(d(300)) * ORBIT_R, y: 25, z: Math.sin(d(300)) * ORBIT_R, scaleDesktop: 44, scaleMobile: 37, file: 'Assets/floating Island 6.glb'   },
];

/* ── Detect mobile ── */
function isMobileDevice() {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768
  );
}

/**
 * loadPanoramaTexture
 *
 * Loads the REAL panorama but pre-scales it inside a canvas to the GPU's
 * safe texture limit before creating the WebGL texture.
 * Prevents the "Texture has been resized" blocking freeze on mobile GPUs.
 * Desktop: max 4096px (no resize), Mobile: max 2048px.
 */
function loadPanoramaTexture(url, isMobile, onSuccess, onError) {
  const MAX_PX = isMobile ? 2048 : 4096;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const aspect = img.naturalWidth / img.naturalHeight;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > MAX_PX || h > MAX_PX) {
        if (w >= h) { w = MAX_PX; h = Math.round(MAX_PX / aspect); }
        else        { h = MAX_PX; w = Math.round(MAX_PX * aspect); }
      }
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      const tex = new THREE.CanvasTexture(cv);
      tex.mapping    = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      onSuccess(tex);
    } catch (e) { onError(e); }
  };
  img.onerror = onError;
  img.src = url;
}

export function useThreeScene(containerRef, callbacks) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const introFinishedRef = useRef(false);

  const apiRef = useRef({
    applyTheme: () => {},
    setIslandsVisible: () => {},
    setIntroFinished: (v) => { introFinishedRef.current = v; },
    startReturn: () => {},
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mobile = isMobileDevice();

    /* ── Renderer ── */
    const renderer = new THREE.WebGLRenderer({
      antialias: !mobile,             // antialias off on mobile saves significant GPU
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.0 : 1.5));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = THEMES.dark.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    /* ── Scene ── */
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(THEMES.dark.fog, THEMES.dark.fogDensity);

    /* ── Camera ── */
    // Mobile: pull back & widen FOV so all islands fit on narrow screen
    const CAM_Y = mobile ? 180 : 160;
    const CAM_Z = mobile ? 280 : 220;
    const FOV   = mobile ? 65  : 55;

    const camera = new THREE.PerspectiveCamera(FOV, container.clientWidth / container.clientHeight, 1, 20000);
    camera.position.set(0, CAM_Y, CAM_Z);

    /* ── Controls ── */
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 30, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 20;
    controls.maxDistance = 600;
    if (mobile) {
      controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    }

    /* ── Lights ── */
    const ambientLight = new THREE.AmbientLight(THEMES.dark.ambientColor, THEMES.dark.ambientIntensity);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(THEMES.dark.dirColor, THEMES.dark.dirIntensity);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top    =  200;
    dirLight.shadow.camera.right  =  200;
    dirLight.shadow.camera.bottom = -200;
    dirLight.shadow.camera.left   = -200;
    dirLight.shadow.camera.near   = 0.1;
    dirLight.shadow.camera.far    = 500;
    // Halve shadow map resolution on mobile — halves shadow VRAM
    dirLight.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    /* ── Panoramic Backgrounds ── */
    const panoramas    = { dark: null, light: null };
    let panoReadyFired = false;
    let currentTheme   = 'dark';

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

    function onPanoLoaded(themeKey, tex) {
      panoramas[themeKey] = tex;
      if (themeKey === currentTheme) scene.background = tex;
      if (themeKey === 'dark' && !panoReadyFired) {
        panoReadyFired = true;
        clearTimeout(panoSafetyTimer);
        cbRef.current.onPanoReady?.();
      }
    }

    loadPanoramaTexture('Assets/bg.png',       mobile, (t) => onPanoLoaded('dark',  t), () => onPanoLoaded('dark',  makeFallbackTexture(true)));
    loadPanoramaTexture('Assets/light bg.png', mobile, (t) => onPanoLoaded('light', t), () => onPanoLoaded('light', makeFallbackTexture(false)));

    // Safety: if real pano never loads (no connection, 404, etc.) start the intro anyway
    const panoSafetyTimer = setTimeout(() => {
      if (!panoReadyFired) onPanoLoaded('dark', makeFallbackTexture(true));
    }, 8000);

    /* ═══════════════════════════════════════════════════════════════
       ISLANDS
       ───────────────────────────────────────────────────────────────
       The core mobile loading strategy:

       DESKTOP (unchanged): All 7 GLTFs fire simultaneously, same as
       the original code. Fast on a desktop connection.

       MOBILE: Two-phase approach that guarantees visible islands:
         Phase 1 — SYNCHRONOUS: All 7 placeholder geometries are
           built and added to the scene immediately (no async). When
           setIslandsVisible(true) fires they are guaranteed to exist.
         Phase 2 — SEQUENTIAL ASYNC: GLTFs are loaded one at a time
           (next starts only after previous finishes). This prevents
           the simultaneous 7-fetch memory/network overload that was
           causing silent failures. When a GLTF loads it REPLACES its
           placeholder in-place.
    ═══════════════════════════════════════════════════════════════ */

    const loader       = new GLTFLoader();
    const islands      = [];      // scene objects, one per island def
    let   islandsVisible = false; // tracks whether setIslandsVisible(true) has been called
    let   loadedCount    = 0;
    let   allLoadedFired = false;

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

    /* Build one placeholder Group for a given def */
    function buildPlaceholder(def, index, scale) {
      const g    = new THREE.Group();
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(def.isCenterIsland ? 38 : 30, 1),
        new THREE.MeshStandardMaterial({ color: 0x7a6a55, roughness: 0.9, flatShading: true })
      );
      rock.castShadow = rock.receiveShadow = true;
      g.add(rock);

      // Small grass top
      const grass = new THREE.Mesh(
        new THREE.CylinderGeometry(28, 22, 10, 7),
        new THREE.MeshStandardMaterial({ color: 0x4a7c38, roughness: 0.8, flatShading: true })
      );
      grass.position.y = 28; grass.castShadow = grass.receiveShadow = true; g.add(grass);

      // A few trees so it reads as an island at a glance
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
      g.scale.setScalar(scale / 3);
      g.userData = makeUD(def, index);
      g.visible  = false; // hidden until intro finishes
      return g;
    }

    function onOneIslandLoaded() {
      loadedCount++;
      if (loadedCount >= ISLAND_DEFS.length && !allLoadedFired) {
        allLoadedFired = true;
        clearTimeout(islandSafetyTimer);
        cbRef.current.onAllIslandsLoaded?.();
      }
    }

    if (!mobile) {
      /* ── DESKTOP: original parallel loading ── */
      ISLAND_DEFS.forEach((def, i) => {
        loader.load(
          def.file,
          (gltf) => {
            const island = gltf.scene;
            island.position.set(def.x, def.y, def.z);
            island.scale.setScalar(def.scaleDesktop);
            island.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = child.receiveShadow = true;
                if (child.material) {
                  child.material.envMapIntensity = THEMES[currentTheme].envMapIntensity;
                  child.material.roughness = Math.max(child.material.roughness ?? 0.5, 0.2);
                }
              }
            });
            island.userData = makeUD(def, i);
            island.visible  = false;
            scene.add(island);
            islands.push(island);
            onOneIslandLoaded();
          },
          undefined,
          () => {
            // GLTF failed — use placeholder
            const ph = buildPlaceholder(def, i, def.scaleDesktop);
            scene.add(ph);
            islands.push(ph);
            onOneIslandLoaded();
          }
        );
      });

    } else {
      /* ── MOBILE: two-phase loading ──────────────────────────────────
         Phase 1: Place all 7 placeholders synchronously right now.
                  They exist in `islands[]` immediately, so
                  setIslandsVisible(true) will always find them.
         Phase 2: Load GLTFs one at a time. When each finishes,
                  SWAP the placeholder out for the real model.
      ────────────────────────────────────────────────────────────── */

      // Phase 1 — synchronous placeholder creation
      ISLAND_DEFS.forEach((def, i) => {
        const ph = buildPlaceholder(def, i, def.scaleMobile);
        scene.add(ph);
        islands.push(ph); // index i in islands[] corresponds to def[i]
      });

      // Phase 2 — sequential GLTF loading (one at a time)
      let seqIndex = 0;

      function loadNext() {
        if (seqIndex >= ISLAND_DEFS.length) return;
        const i   = seqIndex++;
        const def = ISLAND_DEFS[i];

        loader.load(
          def.file,
          (gltf) => {
            // Success: build the real island
            const island = gltf.scene;
            island.position.set(def.x, def.y, def.z);
            island.scale.setScalar(def.scaleMobile);
            island.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = child.receiveShadow = true;
                if (child.material) {
                  child.material.envMapIntensity = THEMES[currentTheme].envMapIntensity;
                  child.material.roughness = Math.max(child.material.roughness ?? 0.5, 0.2);
                }
              }
            });
            island.userData = makeUD(def, i);
            // Match current visibility state
            island.visible = islandsVisible;

            // Swap: remove old placeholder, put real island in same slot
            const oldPh = islands[i];
            scene.remove(oldPh);
            scene.add(island);
            islands[i] = island;

            onOneIslandLoaded();
            loadNext(); // start next GLTF
          },
          undefined,
          () => {
            // GLTF failed — placeholder stays, that's fine
            // Update placeholder visibility to match current state
            islands[i].visible = islandsVisible;
            onOneIslandLoaded();
            loadNext(); // still continue to next island
          }
        );
      }

      loadNext(); // kick off the sequential chain
    }

    // Safety timer: fire allIslandsLoaded if sequential loading takes too long
    const islandSafetyTimer = setTimeout(() => {
      if (!allLoadedFired) {
        allLoadedFired = true;
        cbRef.current.onAllIslandsLoaded?.();
      }
    }, mobile ? 25000 : 30000);

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

    let viewMode = 'overview';
    let focusedIsland = null;
    const overviewCamPos = new THREE.Vector3(0, CAM_Y, CAM_Z);
    const overviewTarget  = new THREE.Vector3(0, 30, 0);
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

    /* ── Raycasting / Click & Tap ── */
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2();
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

    let touchStart = { x: 0, y: 0, ms: 0 };
    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, ms: Date.now() };
    };
    const onTouchEnd = (e) => {
      const t = e.changedTouches[0];
      if (!t) return;
      const dist = Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y);
      const ms   = Date.now() - touchStart.ms;
      if (dist > 12 || ms > 300) return;
      onMouseUp({ clientX: t.clientX, clientY: t.clientY });
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup',   onMouseUp);
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

    /* ── Render Loop ── */
    const clock = new THREE.Clock();
    let animId;

    function animate() {
      animId = requestAnimationFrame(animate);
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

    animate();

    /* ── Resize ── */
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
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
        scene.fog.density = t.fogDensity;
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
        // Store the flag so any island (placeholder or GLTF) that
        // arrives later immediately matches the correct visibility state.
        islandsVisible = visible;
        islands.forEach((isl) => { isl.visible = visible; });
      },
      setIntroFinished(v) {
        introFinishedRef.current = v;
      },
      startReturn,
    };

    /* ── Cleanup ── */
    return () => {
      clearTimeout(panoSafetyTimer);
      clearTimeout(islandSafetyTimer);
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mouseup',   onMouseUp);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchend',   onTouchEnd);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      apiRef.current = {
        applyTheme: () => {},
        setIslandsVisible: () => {},
        setIntroFinished: () => {},
        startReturn: () => {},
      };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return apiRef;
}
