/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
  // Circled i.
  info: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 11v5M12 8h0',
  // X in a circle: take it off.
  clear: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM9.5 9.5l5 5M14.5 9.5l-5 5',
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
