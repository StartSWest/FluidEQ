/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { TSceneTintMode } from '../utils/sceneTintStore';

interface ITintIconProps {
  className?: string;
  /**
   * Which of the three the glyph says: an empty circle for the theme as it
   * is, the half filled for the scene's colours, and the half with a wave
   * round it for the colours beating with the scene. Half filled by default.
   */
  mode?: TSceneTintMode;
}

/**
 * A circle half filled — the theme's own glyph — for the controls that put
 * the window in a scene's colour. The half is a path of its own so a sheet
 * can fill it with the colour being lent (`--scene-tint-swatch`), which is
 * what lets the control say what it does before its label is read.
 */
const TintIcon = ({ className, mode = 'tint' }: ITintIconProps) => {
  if (mode === 'pulse') {
    return (
      <svg
        className={className}
        viewBox="0 0 16 16"
        aria-hidden
        data-mode={mode}
      >
        <path className="tint-icon__half" d="M8 4.2v7.6a3.8 3.8 0 0 0 0-7.6z" />
        <circle cx="8" cy="8" r="3.8" />
        <circle className="tint-icon__wave" cx="8" cy="8" r="6.6" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden data-mode={mode}>
      {mode === 'tint' && (
        <path className="tint-icon__half" d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" />
      )}
      <circle cx="8" cy="8" r="5.5" />
    </svg>
  );
};

export default TintIcon;
