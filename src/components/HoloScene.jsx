import { useEffect, useRef, useCallback } from 'react';
import HoloContainer from './HoloContainer';

/**
 * HoloScene
 * Renders the split-column overlay with HoloContainer panels.
 * Also handles mouse-parallax tilt effect.
 *
 * Props:
 *   panels  — Array<{ uid, data, column:'left'|'right', delay, closing }>
 *   onPanelClosed(uid) — called when a panel finishes close animation
 *   floorVisible — boolean
 */
function HoloScene({ panels, onPanelClosed, floorVisible }) {
  const sceneRef = useRef(null);
  const mouseMoveTimerRef = useRef(null);

  /* Parallax tilt on mouse move */
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (mouseMoveTimerRef.current) cancelAnimationFrame(mouseMoveTimerRef.current);
      mouseMoveTimerRef.current = requestAnimationFrame(() => {
        const cx = window.innerWidth  / 2;
        const cy = window.innerHeight / 2;
        const dx = (e.clientX - cx) / cx;
        const dy = (e.clientY - cy) / cy;

        const containers = sceneRef.current?.querySelectorAll('.holo-container');
        containers?.forEach((c) => {
          c.style.transform = `
            perspective(1000px)
            rotateX(${dy * -2}deg)
            rotateY(${dx * 2}deg)
            scaleY(1)
          `;
        });
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (mouseMoveTimerRef.current) cancelAnimationFrame(mouseMoveTimerRef.current);
    };
  }, []);

  const leftPanels  = panels.filter((p) => p.column === 'left');
  const rightPanels = panels.filter((p) => p.column === 'right');

  return (
    <div className="holo-scene" ref={sceneRef}>
      {/* Left column */}
      <div className="holo-column holo-column-left">
        {leftPanels.map((p) => (
          <HoloContainer
            key={p.uid}
            data={p.data}
            closing={p.closing}
            delay={p.delay}
            onClosed={() => onPanelClosed(p.uid)}
          />
        ))}
      </div>

      {/* Right column */}
      <div className="holo-column holo-column-right">
        {rightPanels.map((p) => (
          <HoloContainer
            key={p.uid}
            data={p.data}
            closing={p.closing}
            delay={p.delay}
            onClosed={() => onPanelClosed(p.uid)}
          />
        ))}
      </div>

      {/* Floor reflection */}
      <div
        className="floor-reflection"
        style={{ opacity: floorVisible ? 1 : 0.3 }}
      />
    </div>
  );
}

export default HoloScene;
