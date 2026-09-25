/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { BRAND_MARK } from 'common/branding';
import '../styles/SignalBrand.scss';

/**
 * The logo in the header, alive: "Signal" (Ivan chose it on 2026-09-25 from
 * four, https://claude.ai/artifact/HZpBeQQa79QDb2KAKjNvkV). At launch the
 * wave draws itself; after that a pulse of light runs along it every few
 * seconds, and the name's "EQ" glows as it arrives (`SignalBrandName`). In
 * Rainbow mode the tile is filled with the spectrum, drifting as the name's
 * does, and the wave is drawn in white on it. Still when motion is turned
 * down (`SignalBrand.scss`).
 *
 * The tile is `.brand-mark`'s, so every size the header gives the mark still
 * applies. Everywhere else the app shows itself the logo stays the still one
 * (`BrandMark`): this is the header's.
 *
 * `pathLength` makes the wave sixty units long whatever its geometry, which is
 * what the draw and the pulse are timed against.
 */
export default function SignalBrandMark() {
  return (
    <div className="brand-mark brand-mark--signal" aria-hidden="true">
      <svg viewBox={BRAND_MARK.viewBox}>
        <path
          className="brand-mark__wave"
          d={BRAND_MARK.path}
          pathLength={60}
        />
        <path
          className="brand-mark__pulse"
          d={BRAND_MARK.path}
          pathLength={60}
        />
      </svg>
    </div>
  );
}
