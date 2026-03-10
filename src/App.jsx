import { useState, useCallback, useRef, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import ThreeCanvas from './components/ThreeCanvas';
import IntroOverlay from './components/IntroOverlay';
import HoloScene from './components/HoloScene';
import UIControls from './components/UIControls';
import { STATIC_ISLAND_PANELS, parseCSV, csvRowToPanel } from './data/islandPanels';

/* ── Notification Sound ── */
function createNotifSound() {
  try {
    const audio = new Audio('Assets/notification.mp3');
    audio.volume = 0.55;
    return audio;
  } catch {
    return null;
  }
}

function playNotif(soundRef) {
  try {
    if (soundRef.current) {
      soundRef.current.currentTime = 0;
      soundRef.current.play().catch(() => {});
    }
  } catch {}
}

let _uidCounter = 0;
function nextUid() { return ++_uidCounter; }

export default function App() {
  /* ── Theme ── */
  const [theme, setTheme] = useState('dark');

  /* ── View state ── */
  const [viewMode, setViewMode] = useState('overview'); // 'overview' | 'focused'
  const [introComplete, setIntroComplete] = useState(false);
  const [instructionsVisible, setInstructionsVisible] = useState(false);

  /* ── Intro signals from Three.js ── */
  const [panoReady, setPanoReady] = useState(false);
  const [allIslandsLoaded, setAllIslandsLoaded] = useState(false);

  /* ── Panels ── */
  const [panels, setPanels] = useState([]);

  /* ── Dynamic panels from CSV ── */
  const dynamicPanelsRef = useRef({ ...STATIC_ISLAND_PANELS });

  /* ── Three.js API ref ── */
  const threeRef = useRef(null);

  /* ── Notification sound ── */
  const notifSoundRef = useRef(null);
  useEffect(() => {
    notifSoundRef.current = createNotifSound();
  }, []);

  /* ── Load CSV at startup ── */
  useEffect(() => {
    const controller = new AbortController();

    fetch('Assets/Data.csv', { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error('CSV not found'); return r.text(); })
      .then((text) => {
        // Reset islands 1-5 before populating so we never double-push
        for (let i = 1; i <= 5; i++) dynamicPanelsRef.current[i] = [];
        const rows = parseCSV(text);
        rows.forEach((row) => {
          const panel = csvRowToPanel(row);
          if (panel) {
            if (!dynamicPanelsRef.current[panel.islandId]) {
              dynamicPanelsRef.current[panel.islandId] = [];
            }
            dynamicPanelsRef.current[panel.islandId].push(panel.data);
          }
        });
      })
      .catch(() => { /* CSV optional or aborted */ });

    return () => controller.abort();
  }, []);

  /* ── Apply theme to html element + Three.js ── */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    threeRef.current?.applyTheme(theme);
  }, [theme]);

  /* ── Callbacks from Three.js ── */
  const handlePanoReady = useCallback(() => {
    setPanoReady(true);
  }, []);

  const handleAllIslandsLoaded = useCallback(() => {
    setAllIslandsLoaded(true);
  }, []);

  const handleIntroComplete = useCallback(() => {
    setIntroComplete(true);
    threeRef.current?.setIslandsVisible(true);
    threeRef.current?.setIntroFinished(true);
    setInstructionsVisible(true);
  }, []);

  const handleIslandFocused = useCallback((islandId) => {
    setViewMode('focused');
    setInstructionsVisible(true);

    const islandPanelData = dynamicPanelsRef.current[islandId] ?? [];
    const panelDataList =
      islandPanelData.length > 0
        ? islandPanelData
        : [
            {
              notifTitle: `SYSTEM // ISLAND ${islandId}`,
              headerName: 'COMING SOON',
              asset: {
                type: 'text',
                content: `// NO DATA FOUND FOR ISLAND ${islandId}\n\nNew projects are under construction.\nCheck back later for updates.`,
              },
            },
          ];

    const newPanels = panelDataList.map((data, i) => ({
      uid: nextUid(),
      data,
      column: i % 2 === 0 ? 'left' : 'right',
      delay: i * 200,
      closing: false,
    }));

    setPanels(newPanels);
    playNotif(notifSoundRef);
  }, []);

  const handleReturn = useCallback(() => {
    /* Start closing all panels immediately */
    setPanels((prev) => prev.map((p) => ({ ...p, closing: true })));
  }, []);

  const handleReturnComplete = useCallback(() => {
    setViewMode('overview');
    setInstructionsVisible(true);
  }, []);

  const handlePanelClosed = useCallback((uid) => {
    setPanels((prev) => prev.filter((p) => p.uid !== uid));
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleBack = useCallback(() => {
    threeRef.current?.startReturn();
    // onReturn callback will fire from Three.js → triggers panel close
  }, []);

  const panelsExist = panels.length > 0;

  return (
    <>
      {/* Three.js canvas — z-index 1 */}
      <ThreeCanvas
        ref={threeRef}
        onPanoReady={handlePanoReady}
        onAllIslandsLoaded={handleAllIslandsLoaded}
        onIslandFocused={handleIslandFocused}
        onReturn={handleReturn}
        onReturnComplete={handleReturnComplete}
      />

      {/* Intro overlay — z-index 200 */}
      {!introComplete && (
        <IntroOverlay
          panoReady={panoReady}
          allIslandsLoaded={allIslandsLoaded}
          onComplete={handleIntroComplete}
        />
      )}

      {/* Holo panel overlay — z-index 50 */}
      <HoloScene
        panels={panels}
        onPanelClosed={handlePanelClosed}
        floorVisible={panelsExist}
      />

      {/* UI controls — z-index 60 */}
      {introComplete && (
        <UIControls
          theme={theme}
          viewMode={viewMode}
          onToggleTheme={handleToggleTheme}
          onBack={handleBack}
          instructionsVisible={instructionsVisible}
        />
      )}

      {/* Vercel Analytics */}
      <Analytics />

      {/* Vercel Speed Insights */}
      <SpeedInsights />
    </>
  );
}
