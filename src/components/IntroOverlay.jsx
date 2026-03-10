import { useState, useEffect, useRef } from 'react';

const INTRO_TEXT = "Hello, I am Ahmed Mohamed Ahmed\nand this is my Portfolio";
const DELETE_INTERVAL = 22; // ms per deleted character

/**
 * IntroOverlay
 *
 * Phase machine — identical to desktop:
 *  waiting-pano → typing (when panoReady)
 *  typing       → deleting (when typing done AND allLoaded)
 *  deleting     → done (calls onComplete)
 *
 * Mobile-safe additions:
 *  • If panoReady never arrives in 8s → force-start typing anyway
 *  • If allIslandsLoaded never arrives in 18s → force-start deleting anyway
 *  These are last-resort fallbacks only; the normal path always takes priority.
 */
function IntroOverlay({ panoReady, allIslandsLoaded, onComplete }) {
  const [phase, setPhase]           = useState('waiting-pano');
  const [displayedText, setDisplayedText] = useState('');
  const [showSpinner, setShowSpinner]     = useState(true);
  const [showText, setShowText]           = useState(false);

  const typingDoneRef     = useRef(false);
  const allLoadedReadyRef = useRef(false);
  const charIndexRef      = useRef(0);
  const loadStartRef      = useRef(performance.now());
  const loadedFractionRef = useRef(0);
  const phaseRef          = useRef('waiting-pano');

  // Keep phaseRef current so setTimeout callbacks can read it without stale closure
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  /* ── Last-resort: start typing if panoReady never fires in 8s ── */
  useEffect(() => {
    const id = setTimeout(() => {
      if (phaseRef.current === 'waiting-pano') {
        setShowSpinner(false);
        setTimeout(() => {
          if (phaseRef.current === 'waiting-pano') {
            setPhase('typing');
            setShowText(true);
          }
        }, 500);
      }
    }, 8000);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Last-resort: finish overlay if allIslandsLoaded never fires in 18s ── */
  useEffect(() => {
    const id = setTimeout(() => {
      if (!allLoadedReadyRef.current) {
        allLoadedReadyRef.current = true;
        loadedFractionRef.current = 1;
        checkReadyToDelete();
      }
    }, 18000);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Normal path: panoReady fires → fade spinner, start typing ── */
  useEffect(() => {
    if (!panoReady) return;
    setShowSpinner(false);
    const id = setTimeout(() => {
      setPhase((prev) => {
        if (prev === 'waiting-pano') {
          setShowText(true);
          return 'typing';
        }
        return prev;
      });
    }, 500);
    return () => clearTimeout(id);
  }, [panoReady]);

  /* ── Typing phase ── */
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
      const elapsed   = performance.now() - loadStartRef.current;
      const fraction  = loadedFractionRef.current;
      const charsLeft = INTRO_TEXT.length - i;
      const remaining = fraction > 0 ? elapsed * (1 - fraction) / fraction : 600;
      const delay     = Math.min(500, Math.max(28, remaining / charsLeft));

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

  /* ── allIslandsLoaded signal ── */
  useEffect(() => {
    if (!allIslandsLoaded) return;
    loadedFractionRef.current  = 1;
    allLoadedReadyRef.current  = true;
    checkReadyToDelete();
  }, [allIslandsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Deleting phase ── */
  useEffect(() => {
    if (phase !== 'deleting') return;
    let active = true;
    let prev   = performance.now();
    let accum  = 0;
    let rafId;

    function loop(now) {
      if (!active) return;
      accum += now - prev;
      prev   = now;
      while (accum >= DELETE_INTERVAL) {
        accum -= DELETE_INTERVAL;
        setDisplayedText((t) => {
          if (t.length === 0) return t;
          const next = t.slice(0, -1);
          if (next.length === 0) { active = false; onComplete?.(); }
          return next;
        });
      }
      if (active) rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);
    return () => { active = false; cancelAnimationFrame(rafId); };
  }, [phase, onComplete]);

  if (phase === 'done') return null;

  return (
    <div className={['intro-overlay', panoReady ? 'pano-ready' : ''].join(' ')}>
      <div className={`intro-spinner ${!showSpinner ? 'hidden' : ''}`}>
        <div className="spinner-ring" />
        <span className="spinner-label">Loading world…</span>
      </div>
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
