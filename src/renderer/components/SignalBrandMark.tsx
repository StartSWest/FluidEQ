/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useId } from 'react';
import { BRAND_MARK } from 'common/branding';
import { ThemeWaveGradient, useLagoonWave } from '../icons/BrandMark';
import '../styles/SignalBrand.scss';

/**
 * The app icon's outline, a superellipse (n = 5) in the 48-unit tile: the
 * icon file's own shape (`assets/icon.svg`), which a rounded square only
 * approximates — its sides stay straight longer and its corners turn later.
 */
const SQUIRCLE = (() => {
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

/**
 * The logo in the header, alive: "Signal" (Ivan chose it on 2026-09-25 from
 * four, https://claude.ai/artifact/HZpBeQQa79QDb2KAKjNvkV). At launch the
 * wave draws itself; after that a pulse of light runs along it every few
 * seconds.
 *
 * DRAWN AS THE APP ICON (Ivan, 2026-11-26: "make the logo match the app icon
 * with stronger borders"): the icon's squircle, the colour rising from its
 * depth, the light across its top, the thick wave with its highlight, and an
 * edge about twice the icon file's. Its face stays in the window's colours —
 * near black at Black, the light blue at the light end, where a black tile
 * stood out like a hole (2026-09-27) — and its edge and wave are the first
 * stretch of the one gradient the header's name continues ("one logo ...
 * the text color needs to match that updated logo fluidly"; `SignalBrand.scss`
 * and `HeaderWordmark`). Still when motion is turned down.
 *
 * `pathLength` makes the wave sixty units long whatever its geometry, which is
 * what the draw is timed against. The pulse is a spark of the page laid over
 * the drawing, moved by the compositor (`SignalBrand.scss`): a dash sliding
 * along the path was painted on the main thread every frame.
 */
export default function SignalBrandMark() {
  const wave = useLagoonWave();
  const face = `brand-face-${useId().replace(/:/g, '')}`;
  return (
    <div
      className="brand-mark brand-mark--signal"
      aria-hidden="true"
      style={wave.style}
    >
      <svg className="brand-mark__face" viewBox="0 0 48 48">
        <defs>
          <linearGradient
            id={`${face}-fill`}
            x1="0.15"
            y1="0.05"
            x2="0.85"
            y2="0.95"
          >
            <stop offset="0" style={{ stopColor: 'var(--logo-face-1)' }} />
            <stop offset="0.5" style={{ stopColor: 'var(--logo-face-2)' }} />
            <stop offset="1" style={{ stopColor: 'var(--logo-face-3)' }} />
          </linearGradient>
          <radialGradient id={`${face}-depth`} cx="0.5" cy="0.6" r="0.5">
            <stop
              offset="0"
              style={{ stopColor: 'var(--logo-3)', stopOpacity: 0.22 }}
            />
            <stop
              offset="0.6"
              style={{ stopColor: 'var(--logo-3)', stopOpacity: 0.05 }}
            />
            <stop
              offset="1"
              style={{ stopColor: 'var(--logo-3)', stopOpacity: 0 }}
            />
          </radialGradient>
          <linearGradient id={`${face}-light`} x1="0" y1="0" x2="0" y2="0.5">
            <stop offset="0" style={{ stopColor: '#fff', stopOpacity: 0.07 }} />
            <stop offset="1" style={{ stopColor: '#fff', stopOpacity: 0 }} />
          </linearGradient>
          <linearGradient id={`${face}-edge`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--logo-1)' }} />
            <stop offset="0.5" style={{ stopColor: 'var(--logo-3)' }} />
            <stop offset="1" style={{ stopColor: 'var(--logo-5)' }} />
          </linearGradient>
          <clipPath id={`${face}-clip`}>
            <path d={SQUIRCLE} />
          </clipPath>
        </defs>
        <path
          className="brand-mark__body"
          d={SQUIRCLE}
          fill={`url(#${face}-fill)`}
        />
        <g clipPath={`url(#${face}-clip)`}>
          <rect width="48" height="48" fill={`url(#${face}-depth)`} />
          <rect width="48" height="24" fill={`url(#${face}-light)`} />
        </g>
        <path
          className="brand-mark__edge"
          d={SQUIRCLE}
          stroke={`url(#${face}-edge)`}
        />
      </svg>
      <span className="brand-mark__drawing">
        <svg viewBox={BRAND_MARK.viewBox}>
          <defs>
            <ThemeWaveGradient id={wave.id} />
          </defs>
          <path
            className="brand-mark__wave"
            d={BRAND_MARK.path}
            pathLength={60}
          />
          {/* The icon's highlight: a thin light along the upper side of the
              wave's first swing, as the icon file has it. */}
          <path
            className="brand-mark__glint"
            d={BRAND_MARK.path}
            pathLength={60}
          />
        </svg>
        <span className="brand-mark__pulse">
          <span className="brand-mark__spark" />
        </span>
      </span>
    </div>
  );
}
