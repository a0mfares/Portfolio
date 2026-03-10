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

function isMobileDevice() {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768
  );
}

/**
 * loadPanoramaTexture
 * Loads the real panorama pre-scaled to GPU-safe size via canvas,
 * preventing the "Texture has been resized" freeze on mobile GPUs.
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
      antialias: !mobile,
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
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

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

    const panoSafetyTimer = setTimeout(() => {
      if (!panoReadyFired) onPanoLoaded('dark', makeFallbackTexture(true));
    }, 8000);

    /* ── Islands ── */
    const loader       = new GLTFLoader();
    const islands      = [];
    let loadedCount    = 0;
    let allLoadedFired = false;

    /*
     * islandsVisible flag — tracks whether setIslandsVisible(true) has been called.
     *
     * On mobile some GLTFs finish loading AFTER the intro completes and
     * setIslandsVisible(true) has already run. Without this flag those
     * late-arriving islands stay stuck at visible=false forever.
     * Fix: every island checks this flag on arrival and shows itself immediately
     * if the intro has already finished.
     */
    let islandsVisible = false;

    function onIslandLoaded() {
      loadedCount++;
      if (loadedCount >= ISLAND_DEFS.length && !allLoadedFired) {
        allLoadedFired = true;
        clearTimeout(islandSafetyTimer);
        cbRef.current.onAllIslandsLoaded?.();
      }
    }

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
      // BUG FIX: was using def.scale (undefined) — must use scaleDesktop/scaleMobile
      const scale = mobile ? def.scaleMobile : def.scaleDesktop;

      const g = new THREE.Group();
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(def.isCenterIsland ? 30 : 20, 1),
        new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.9 })
      );
      g.add(rock);
      g.position.set(def.x, def.y, def.z);
      g.scale.setScalar(scale / 3);
      g.userData = makeUD(def, index);
      // Show immediately if intro has already finished
      g.visible = islandsVisible;
      scene.add(g);
      islands.push(g);
    }

    ISLAND_DEFS.forEach((def, i) => {
      const scale = mobile ? def.scaleMobile : def.scaleDesktop;
      loader.load(
        def.file,
        (gltf) => {
          const island = gltf.scene;
          island.position.set(def.x, def.y, def.z);
          island.scale.setScalar(scale);
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
          // Show immediately if intro has already finished
          island.visible = islandsVisible;
          scene.add(island);
          islands.push(island);
          onIslandLoaded();
        },
        undefined,
        () => { makePlaceholder(def, i); onIslandLoaded(); }
      );
    });

    // Safety: fire allIslandsLoaded even if a GLTF silently stalls on mobile
    const islandSafetyTimer = setTimeout(() => {
      if (!allLoadedFired) {
        allLoadedFired = true;
        cbRef.current.onAllIslandsLoaded?.();
      }
    }, mobile ? 20000 : 30000);

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
        // Also set the flag so islands arriving late (after this call) show up too
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
