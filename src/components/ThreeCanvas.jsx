import { forwardRef, useRef, useImperativeHandle } from 'react';
import { useThreeScene } from '../hooks/useThreeScene';

/**
 * ThreeCanvas
 * Renders the Three.js scene into a full-screen div.
 * Exposes the Three.js API via a forwarded ref.
 */
const ThreeCanvas = forwardRef(function ThreeCanvas(
  { onPanoReady, onAllIslandsLoaded, onIslandFocused, onReturn, onReturnComplete },
  ref
) {
  const containerRef = useRef(null);

  const apiRef = useThreeScene(containerRef, {
    onPanoReady,
    onAllIslandsLoaded,
    onIslandFocused,
    onReturn,
    onReturnComplete,
  });

  /* Forward the Three.js API methods to the parent via ref */
  useImperativeHandle(ref, () => ({
    applyTheme:        (theme) => apiRef.current.applyTheme(theme),
    setIslandsVisible: (v)     => apiRef.current.setIslandsVisible(v),
    setIntroFinished:  (v)     => apiRef.current.setIntroFinished(v),
    startReturn:       ()      => apiRef.current.startReturn(),
  }), [apiRef]);

  return <div className="canvas-container" ref={containerRef} />;
});

export default ThreeCanvas;
