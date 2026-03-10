import { useState, useEffect, useRef, useCallback } from 'react';
import ProjectAsset from './ProjectAsset';

const CORNER_SVG = {
  tl: (
    <svg className="corner-svg corner-tl" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <polyline points="0,30 0,0 30,0" className="corner-line" />
      <polyline points="0,20 0,8 8,0"  className="corner-inner" />
      <circle cx="0" cy="0" r="2"      className="corner-dot" />
    </svg>
  ),
  tr: (
    <svg className="corner-svg corner-tr" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <polyline points="40,30 40,0 10,0"   className="corner-line" />
      <polyline points="40,20 40,8 32,0"   className="corner-inner" />
      <circle cx="40" cy="0" r="2"         className="corner-dot" />
    </svg>
  ),
  bl: (
    <svg className="corner-svg corner-bl" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <polyline points="0,10 0,40 30,40"  className="corner-line" />
      <polyline points="0,20 0,32 8,40"   className="corner-inner" />
      <circle cx="0" cy="40" r="2"        className="corner-dot" />
    </svg>
  ),
  br: (
    <svg className="corner-svg corner-br" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <polyline points="40,10 40,40 10,40" className="corner-line" />
      <polyline points="40,20 40,32 32,40" className="corner-inner" />
      <circle cx="40" cy="40" r="2"        className="corner-dot" />
    </svg>
  ),
};

/**
 * Typewriter hook for text asset content.
 */
function useTypewriter(text, speed = 15, active = false) {
  const [displayed, setDisplayed] = useState(active ? '' : text);

  useEffect(() => {
    if (!active) { setDisplayed(text); return; }
    setDisplayed('');
    let i = 0;
    let timeout;

    function type() {
      if (i < text.length) {
        i++;
        setDisplayed(text.slice(0, i));
        timeout = setTimeout(type, speed);
      }
    }
    timeout = setTimeout(type, speed);
    return () => clearTimeout(timeout);
  }, [text, speed, active]);

  return displayed;
}

/**
 * TextAsset — renders pre-formatted text, optionally with typewriter effect.
 */
function TextAsset({ asset }) {
  const text = useTypewriter(asset.content, 15, !!asset.typing);
  return <pre className="asset-text">{text}</pre>;
}

/**
 * HoloContainer
 * One cyberpunk HUD panel.
 *
 * Props:
 *   data       — { notifTitle, headerName, asset }
 *   closing    — boolean, set by parent to trigger close animation
 *   onClosed   — called when close animation ends
 *   delay      — spawn animation delay (ms)
 */
function HoloContainer({ data, closing, onClosed, delay = 0 }) {
  const [isOpen, setIsOpen] = useState(false);
  const closedRef = useRef(false);

  /* Open animation — respect delay */
  useEffect(() => {
    const timer = setTimeout(() => setIsOpen(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  /* Close animation */
  useEffect(() => {
    if (!closing || closedRef.current) return;
    closedRef.current = true;
    setIsOpen(false);
    const timer = setTimeout(() => onClosed?.(), 1200);
    return () => clearTimeout(timer);
  }, [closing, onClosed]);

  const handleClose = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    setIsOpen(false);
    setTimeout(() => onClosed?.(), 1200);
  }, [onClosed]);

  const animClass = closing ? 'is-closing' : isOpen ? 'is-open' : '';

  return (
    <div className={`holo-container ${animClass}`} data-anim="portal">
      {/* Corner decorations */}
      {CORNER_SVG.tl}
      {CORNER_SVG.tr}
      {CORNER_SVG.bl}
      {CORNER_SVG.br}

      {/* Glowing frame edges */}
      <div className="frame-border">
        <div className="edge edge-top" />
        <div className="edge edge-right" />
        <div className="edge edge-bottom" />
        <div className="edge edge-left" />
      </div>

      {/* Header */}
      <header className="holo-header">
        <div className="header-left">
          <div className="hatch-marks">
            <span /><span /><span /><span /><span />
          </div>
        </div>
        <div className="header-center">
          <span className="notification-title">{data.notifTitle}</span>
        </div>
        <div className="header-right">
          <button className="hud-btn close-btn" title="Close" onClick={handleClose}>
            <svg viewBox="0 0 14 14">
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Scanline overlay */}
      <div className="scanline-overlay" />

      {/* Content */}
      <main className="holo-content">
        <div className="inner-panel">
          <div className="inner-panel-title">
            <span className="inner-title-text">{data.headerName}</span>
          </div>
          <div className="inner-panel-glare" />
          <div className="inner-panel-content">
            {data.asset.type === 'text'    && <TextAsset asset={data.asset} />}
            {data.asset.type === 'project' && <ProjectAsset asset={data.asset} />}
          </div>
          <div className="inner-panel-corner inner-tl" />
          <div className="inner-panel-corner inner-tr" />
          <div className="inner-panel-corner inner-bl" />
          <div className="inner-panel-corner inner-br" />
        </div>
      </main>

      {/* Side deco lines */}
      <div className="deco-line deco-line-left">
        <span /><span /><span />
      </div>
      <div className="deco-line deco-line-right">
        <span /><span /><span />
      </div>
    </div>
  );
}

export default HoloContainer;
