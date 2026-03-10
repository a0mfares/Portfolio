/**
 * UIControls
 * Fixed-position overlay buttons and instruction label.
 */
function UIControls({ theme, viewMode, onToggleTheme, onBack, instructionsVisible }) {
  const isLight = theme === 'light';
  const isFocused = viewMode === 'focused';

  let instructionText = 'Drag to rotate\u00A0\u00A0·\u00A0\u00A0Scroll to zoom\u00A0\u00A0·\u00A0\u00A0Click island to focus';
  if (isFocused) instructionText = 'Drag to rotate\u00A0\u00A0·\u00A0\u00A0Scroll to zoom';

  return (
    <>
      {/* Back button */}
      <button
        className={`ui-pill back-btn ${isFocused ? 'visible' : ''}`}
        onClick={onBack}
        aria-label="Back to all islands"
      >
        ← Back to all islands
      </button>

      {/* Theme toggle */}
      <button
        className="ui-pill theme-toggle"
        onClick={onToggleTheme}
        aria-label="Toggle theme"
      >
        {isLight ? '🌙 Dark Mode' : '☀️ Light Mode'}
      </button>

      {/* Instructions */}
      <div
        className={`ui-pill instructions ${instructionsVisible ? '' : 'hidden'}`}
        aria-live="polite"
      >
        {instructionText}
      </div>
    </>
  );
}

export default UIControls;
