import { useState, useEffect, useRef } from 'react';

const INTRO_TEXT      = "Hello, I am Ahmed Mohamed Ahmed\nand this is my Portfolio";
const DELETE_INTERVAL = 18;   // ms per deleted character (faster backspace)
const POST_TYPE_WAIT  = 4000; // ms to show the full sentence before deleting

/**
 * IntroOverlay
 *
 * Phase machine:
 *  waiting-pano → typing  (when panoReady fires)
 *  typing       → deleting (when typing finishes — starts a 4s countdown,
 *                           begins deleting when either allIslandsLoaded
 *                           fires OR the 4s countdown expires, whichever first)
 *  deleting     → done    (calls onComplete when text is empty)
 */
function IntroOverlay({ panoReady, allIslandsLoaded, onComplete }) {
  const [phase, setPhase]                 = useState('waiting-pano');
  const [displayedText, setDisplayedText] = useState('');
  const [showSpinner, setShowSpinner]     = useState(true);
  const [showText, setShowText]           = useState(false);

  const typingDoneRef     = useRef(false);
  const allLoadedReadyRef = useRef(false);
  const deleteScheduledRef = useRef(false); // guard: only schedule delete once
  const charIndexRef      = useRef(0);
  const loadStartRef      = useRef(performance.now());
  const loadedFractionRef = useRef(0);
  const phaseRef          = useRef('waiting-pano');

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  /* ── Hard fallback: start typing after 8s even if panoReady never fires ── */
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

  /* ── Normal path: panoReady fires ── */
  useEffect(() => {
    if (!panoReady) return;
    setShowSpinner(false);
    const id = setTimeout(() => {
      setPhase((prev) => {
        if (prev === 'waiting-pano') { setShowText(true); return 'typing'; }
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
        tryScheduleDelete();
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

  /*
   * tryScheduleDelete
   *
   * Called when typing completes OR when allIslandsLoaded fires.
   * Starts a POST_TYPE_WAIT (4s) countdown the first time typing finishes.
   * Deletion begins when either:
   *   a) allIslandsLoaded fires (immediately after the 4s wait)
   *   b) the 4s countdown expires (even if islands aren't fully loaded yet)
   */
  const deleteTimerRef = useRef(null);

  function tryScheduleDelete() {
    if (!typingDoneRef.current) return;   // typing not done yet
    if (deleteScheduledRef.current) return; // already scheduled

    // If islands already loaded, wait 4s then delete
    // If islands not yet loaded, also wait 4s then delete regardless
    deleteScheduledRef.current = true;
    deleteTimerRef.current = setTimeout(() => {
      setPhase('deleting');
    }, POST_TYPE_WAIT);
  }

  /* ── allIslandsLoaded signal ── */
  useEffect(() => {
    if (!allIslandsLoaded) return;
    loadedFractionRef.current  = 1;
    allLoadedReadyRef.current  = true;
    tryScheduleDelete();
  }, [allIslandsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Cleanup the delete timer on unmount */
  useEffect(() => {
    return () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); };
  }, []);

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
