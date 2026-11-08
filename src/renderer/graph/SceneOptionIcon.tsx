/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import type { TChoiceIcon } from 'common/sceneChoice';

/**
 * The pictures a scene's choice may put beside an option (`CHOICE_ICONS`),
 * drawn here as strokes on a 16-unit square in the current colour, so an
 * icon takes the option's own colour - dim, lit, or the accent when chosen.
 * A scene names one; it never brings a picture of its own.
 */
const GLYPHS: Record<TChoiceIcon, ReactNode> = {
  bars: (
    <>
      <path d="M3 13V8" />
      <path d="M6.5 13V4" />
      <path d="M10 13V6" />
      <path d="M13.5 13V9.5" />
    </>
  ),
  wave: <path d="M1.5 8c1.6-4 3.2-4 4.8 0s3.2 4 4.8 0 2.4-3 3.4-1.5" />,
  circle: <circle cx="8" cy="8" r="5" />,
  ring: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="2.5" />
    </>
  ),
  dots: (
    <>
      <circle cx="4" cy="8" r="1.2" />
      <circle cx="8" cy="8" r="1.2" />
      <circle cx="12" cy="8" r="1.2" />
    </>
  ),
  grid: (
    <>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </>
  ),
  star: (
    <path d="M8 2l1.8 3.8 4.1.5-3 2.8.8 4.1L8 11.2 4.3 13.2l.8-4.1-3-2.8 4.1-.5z" />
  ),
  sparkle: (
    <path d="M8 1.5c.6 3.4 1.6 4.4 5 5-3.4.6-4.4 1.6-5 5-.6-3.4-1.6-4.4-5-5 3.4-.6 4.4-1.6 5-5z" />
  ),
  sun: (
    <>
      <circle cx="8" cy="8" r="2.8" />
      <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
    </>
  ),
  moon: <path d="M12.8 10.2A5.5 5.5 0 0 1 5.8 3.2a5.5 5.5 0 1 0 7 7z" />,
  cloud: (
    <path d="M4.5 12.5h7a2.7 2.7 0 0 0 .3-5.4 3.8 3.8 0 0 0-7.3-.6 3 3 0 0 0 0 6z" />
  ),
  snow: (
    <path d="M8 1.5v13M2.4 4.75l11.2 6.5M2.4 11.25l11.2-6.5M6.3 2.6L8 4l1.7-1.4M6.3 13.4L8 12l1.7 1.4" />
  ),
  drop: (
    <path d="M8 2c2.6 3.2 4.2 5.5 4.2 7.6a4.2 4.2 0 0 1-8.4 0C3.8 7.5 5.4 5.2 8 2z" />
  ),
  flame: (
    <path d="M8 14.5a4.3 4.3 0 0 0 4.3-4.3C12.3 6.7 8.9 5 9.3 1.5 6.3 3 5.3 5.6 5.6 7.6 4.6 7.2 4.1 6.3 4 5.5a5 5 0 0 0-.3 4.7A4.3 4.3 0 0 0 8 14.5z" />
  ),
  leaf: (
    <>
      <path d="M3 13c0-6 3.5-10 10-10 0 6.5-4 10-10 10z" />
      <path d="M3 13l6-6" />
    </>
  ),
  flower: (
    <>
      <circle cx="8" cy="8" r="1.7" />
      <path d="M8 6.3C6.6 4.8 6.6 2.6 8 1.8c1.4.8 1.4 3 0 4.5zM9.7 8c1.5-1.4 3.7-1.4 4.5 0-.8 1.4-3 1.4-4.5 0zM8 9.7c1.4 1.5 1.4 3.7 0 4.5-1.4-.8-1.4-3 0-4.5zM6.3 8C4.8 9.4 2.6 9.4 1.8 8c.8-1.4 3-1.4 4.5 0z" />
    </>
  ),
  heart: (
    <path d="M8 13.5S2 10 2 5.9A3.1 3.1 0 0 1 8 4.7a3.1 3.1 0 0 1 6 1.2C14 10 8 13.5 8 13.5z" />
  ),
  spiral: (
    <path d="M8 8.2c0-.6.5-1 1-1 .9 0 1.5.8 1.5 1.7 0 1.4-1.2 2.4-2.6 2.4-1.9 0-3.3-1.6-3.3-3.4C4.6 5.6 6.6 4 8.9 4c2.8 0 4.6 2.3 4.6 4.9 0 3.2-2.6 5.6-5.8 5.6" />
  ),
  square: <rect x="3" y="3" width="10" height="10" rx="1.5" />,
  triangle: <path d="M8 2.5l6 10.5H2z" />,
  diamond: <path d="M8 1.8l5.8 6.2L8 14.2 2.2 8z" />,
  mountain: <path d="M1.5 13l4.3-7 2.6 4 1.8-2.6 4.3 5.6z" />,
  bolt: <path d="M9 1.5L3.5 9H8l-1 5.5L12.5 7H8z" />,
  eye: (
    <>
      <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
    </>
  ),
};

export default function SceneOptionIcon({
  icon,
  className,
}: {
  icon: TChoiceIcon;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[icon]}
    </svg>
  );
}
