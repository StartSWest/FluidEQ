/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The app icon's outline, a superellipse (n = 5) in the 48-unit tile: the
 * icon file's own shape (`assets/icon.svg`), which a rounded square only
 * approximates — its sides stay straight longer and its corners turn later.
 * The header's logo (`SignalBrandMark`) and the share card's
 * (`shareCardBrand.ts`) draw this one path, so the two never part.
 */
const BRAND_SQUIRCLE = (() => {
  const steps = 96;
  const radius = 22.6;
  const points: string[] = [];
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = 24 + Math.sign(cos) * Math.abs(cos) ** 0.4 * radius;
    const y = 24 + Math.sign(sin) * Math.abs(sin) ** 0.4 * radius;
    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `M${points.join('L')}Z`;
})();

export default BRAND_SQUIRCLE;
