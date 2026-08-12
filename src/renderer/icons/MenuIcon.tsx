/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * Glyphs for the actions menu and the panel buttons.
 *
 * One drawing language with the profile and voicing icons: stroked, on a 24
 * unit grid, few enough strokes to survive being drawn at 14px. A menu of
 * five same-length sentences is a wall of text to scan; a glyph gives each row
 * something to recognise before reading it.
 */
const PATHS: Record<string, string> = {
  // Circular arrow around a dot: restart the thing that is running.
  restart: 'M20 12a8 8 0 1 1-2.3-5.6M20 3v4h-4',
  // Sliders: the configurator is where the wiring is set.
  configure: 'M5 7h9M17 7h2M5 12h2M10 12h9M5 17h11M19 17h0M14 4.5v5M7 9.5v5',
  // Cog, drawn as an octagon rather than a toothed wheel — teeth vanish at
  // this size and leave a grey blob.
  settings:
    'M9.5 3.8h5l.7 2.1 2 1.2 2.2-.4 2.1 3.6M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6',
  // Arrow coming up out of a tray: bring a file in.
  import:
    'M12 15V5m0 0L8.5 8.5M12 5l3.5 3.5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3',
  // Speaker with one wave: an impulse response is still just sound.
  waveform: 'M4 9v6h3l4 3.5V5.5L7 9H4M15.5 9.5a4 4 0 0 1 0 5',
  // Heart.
  support: 'M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9z',
  // Two overlapping waves: something else is shaping the sound.
  convolution: 'M3 14c3 0 3-6 6-6s3 6 6 6 3-6 6-6',
  // Headphones: a band over two cups. Reads at 13px where a detailed pair
  // would not.
  model:
    'M5 14v-2a7 7 0 0 1 14 0v2M5 13h1.6a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1H5.6A1.6 1.6 0 0 1 4 16.9v-2.3a1.6 1.6 0 0 1 1-1.6zM19 13h-1.6a1 1 0 0 0-1 1v3.5a1 1 0 0 0 1 1h1a1.6 1.6 0 0 0 1.6-1.6v-2.3a1.6 1.6 0 0 0-1-1.6z',
  // Sparkle: the one control here that decides something for you.
  smart:
    'M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4zM18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z',
  // Anticlockwise arrow: put the bands back where they started.
  reset: 'M5 11a7 7 0 1 1 2 5M5 6v5h5',
  // Plus in a circle.
  plus: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8.5v7M8.5 12h7',
  // Four rails of different heights: a band layout in miniature.
  layout: 'M6 6v12M10 9v9M14 5v13M18 8v10',
  // Circled i.
  info: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 11v5M12 8h0',
  // A globe: meridians and one parallel. Enough at 16px to read as 'world'.
  language:
    'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM4 12h16M12 4c2.2 2.2 3.3 5 3.3 8s-1.1 5.8-3.3 8c-2.2-2.2-3.3-5-3.3-8s1.1-5.8 3.3-8z',
  // X in a circle: take it off.
  clear: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM9.5 9.5l5 5M14.5 9.5l-5 5',
  // Arrow leaving a small window: visit the source in the browser.
  external:
    'M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5',
  // A response curve over two axes: preview an imported correction.
  graph: 'M4 19V5M4 19h16M7 15l3-4 3 2 5-7',
  folder:
    'M3.5 7.5h6l2-2h3l2 2h4v10.5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V7.5z',
  filePlus: 'M6 3.5h8l4 4V20H6V3.5zM14 3.5v4h4M12 11v6M9 14h6',
  menu: 'M5 7h14M5 12h14M5 17h14',
  microphone:
    'M12 15a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4zM5 11a7 7 0 0 0 14 0M12 18v3M9 21h6',
  // Compact microphone plus adjustment rails: specifically mic settings,
  // rather than the generic application settings cog.
  microphoneSettings:
    'M9.5 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zM4.5 11a5 5 0 0 0 8.5 3.6M9.5 16v4M7 20h5M17 5v3M17 11v7M14.5 8h5M20.5 5v7M20.5 15v3M18 12h5',
  previous: 'M15.5 6L9 12l6.5 6M7 6v12',
  next: 'M8.5 6L15 12l-6.5 6M17 6v12',
  play: 'M9 6l8 6-8 6V6z',
  pause: 'M9 6v12M15 6v12',
  volume: 'M5 10v4h3l4 3V7l-4 3H5M15 9a4 4 0 0 1 0 6',
};

export type MenuIconName = keyof typeof PATHS;

interface IMenuIconProps {
  name: MenuIconName;
  className?: string;
}

export default function MenuIcon({
  name,
  className = 'menu-icon',
}: IMenuIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
