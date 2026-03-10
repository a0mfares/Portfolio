import { useState, useEffect, useRef, useCallback } from 'react';

const INTRO_TEXT = "Hello, I am Ahmed Mohamed Ahmed\nand this is my Portfolio";
const DELETE_INTERVAL = 22; // ms per deleted character

/**
 * IntroOverlay
 *
 * Phase machine:
 *  waiting-pano → typing (when panoReady)
 *  typing       → deleting (when typing done AND allLoaded)
 *  deleting     → done (when text empty → calls onComplete)
 */
function IntroOverlay({ panoReady, allIslandsLoaded, onComplete }) {
  const [phase, setPhase] = useState('waiting-pano'); // waiting-pano | typing | deleting | done
  const [displayedText, setDisplayedText] = useState('');
  const [showSpinner, setShowSpinner] = useState(true);
  const [showText, setShowText] = useState(false);

  const typingDoneRef     = useRef(false);
  const allLoadedReadyRef = useRef(false);
  const charIndexRef      = useRef(0);
  const loadStartRef      = useRef(performance.now());
  const loadedFractionRef = useRef(0);

  /* Track allIslandsLoaded count for adaptive speed */
  const totalIslands = 7;
  const loadedCountRef = useRef(0);

  /* When panoReady fires, fade spinner and start typing */
  useEffect(() => {
    if (!panoReady) return;

    setShowSpinner(false);
    const timer = setTimeout(() => {
      setPhase('typing');
      setShowText(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [panoReady]);

  /* Kick off typing when phase becomes 'typing' */
  useEffect(() => {
    if (phase !== 'typing') return;
    let active = true;

    function scheduleNext() {
      if (!active) return;
      const i = charIndexRef.current;
      if (i >= INTRO_TEXT.length) {
        typingDoneRef.current = true;
        checkReadyToDelete();
        return;
      }

      const elapsed  = performance.now() - loadStartRef.current;
      const fraction = loadedFractionRef.current;
      const charsLeft = INTRO_TEXT.length - i;
      const remainingLoad = fraction > 0 ? elapsed * (1 - fraction) / fraction : 600;
      const delay = Math.min(500, Math.max(28, remainingLoad / charsLeft));

      setTimeout(() => {
        if (!active) return;
        charIndexRef.current++;
        setDisplayedText(INTRO_TEXT.slice(0, charIndexRef.current));
        scheduleNext();
      }, delay);
    }

    scheduleNext();
    return () => { active = false; };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  function checkReadyToDelete() {
    if (!typingDoneRef.current || !allLoadedReadyRef.current) return;
    setTimeout(() => setPhase('deleting'), 900);
  }

  /* Update loaded fraction when allIslandsLoaded changes */
  useEffect(() => {
    if (allIslandsLoaded) {
      loadedFractionRef.current = 1;
      allLoadedReadyRef.current = true;
      checkReadyToDelete();
    }
  }, [allIslandsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Deleting phase */
  useEffect(() => {
    if (phase !== 'deleting') return;
    let active = true;
    let prev = performance.now();
    let accum = 0;
    let rafId;

    function loop(now) {
      if (!active) return;
      accum += now - prev;
      prev = now;
      while (accum >= DELETE_INTERVAL) {
        accum -= DELETE_INTERVAL;
        setDisplayedText((t) => {
          if (t.length === 0) return t;
          const next = t.slice(0, -1);
          if (next.length === 0) {
            active = false;
            onComplete?.();
          }
          return next;
        });
      }
      if (active) rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);
    return () => { active = false; cancelAnimationFrame(rafId); };
  }, [phase, onComplete]);

  if (phase === 'done') return null;

  const isPanoReady = panoReady;

  return (
    <div
      className={[
        'intro-overlay',
        isPanoReady ? 'pano-ready' : '',
      ].join(' ')}
    >
      {/* Spinner */}
      <div className={`intro-spinner ${!showSpinner ? 'hidden' : ''}`}>
        <div className="spinner-ring" />
        <span className="spinner-label">Loading world…</span>
      </div>

      {/* Typed text */}
      <div className={`intro-text-wrap ${showText ? 'visible' : ''}`}>
        <span className="intro-typed">{displayedText}</span>
        <span
          className="intro-cursor"
          style={phase === 'deleting' ? { animation: 'none', opacity: 1 } : {}}
        />
      </div>
    </div>
  );
}

export default IntroOverlay;
