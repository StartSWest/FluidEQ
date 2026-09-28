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
   * Which of the four the glyph says, one step further each: a ring for the
   * theme as it is (in the theme's own accent, where a sheet paints it so),
   * the ring filled with the colour for the window in the scene's colours,
   * that dot with a halo round it for the colours beating with the scene, and
   * the dot in a glow the whole width of the glyph for the scene behind the
   * whole window. The colour by default.
   */
  mode?: TSceneTintMode;
}

/**
 * The window-colour modes' glyph, for the controls that put the window in a
 * scene's colour. The coloured parts are shapes of their own so a sheet can
 * paint them in the colour being lent (`--scene-tint-swatch`), which is what
 * lets the control say what it does before its label is read.
 *
 * One ring, one dot, one halo, on one centre, with no stroke laid over a
 * fill. It was a circle half filled, a smaller half inside a wave, and a
 * disc, a ring, a wave and a wash stacked for the Backdrop: four outlines
 * and fills fighting at sixteen pixels (Ivan, 2026-09-27: "make this icon
 * better and more clean look").
 */
const TintIcon = ({ className, mode = 'tint' }: ITintIconProps) => (
  <svg className={className} viewBox="0 0 16 16" aria-hidden data-mode={mode}>
    {mode === 'off' && (
      <circle className="tint-icon__theme" cx="8" cy="8" r="5.25" />
    )}
    {mode === 'tint' && (
      <circle className="tint-icon__fill" cx="8" cy="8" r="6" />
    )}
    {mode === 'pulse' && (
      <>
        <circle className="tint-icon__halo" cx="8" cy="8" r="6.25" />
        <circle className="tint-icon__fill" cx="8" cy="8" r="3.5" />
      </>
    )}
    {mode === 'cover' && (
      <>
        <circle className="tint-icon__glow" cx="8" cy="8" r="7" />
        <circle className="tint-icon__fill" cx="8" cy="8" r="3.5" />
      </>
    )}
  </svg>
);

export default TintIcon;
