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
 * Glyphs for the three profile actions.
 *
 * Stroked on a 24 unit grid like the voicing icons, so the sidebar keeps one
 * drawing language. They sit next to their labels rather than replacing them:
 * these three actions are easy to confuse and a picture alone would not say
 * which one overwrites your tuning.
 */
/**
 * Deliberately simple shapes.
 *
 * These render at 14px next to a label. The first attempt used a page-with-a-
 * plus and a floppy disk, and at that size their internal detail collapsed
 * into grey mush — a glyph you cannot resolve is worse than no glyph, because
 * it still takes the space. Each of these is a handful of strokes that survive
 * being drawn a quarter of an inch wide.
 */
const PATHS: Record<string, string> = {
  // Plus in a circle.
  new: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8.5v7M8.5 12h7',
  // Arrow into a tray: commit this downward, into storage.
  save: 'M12 4v9m0 0 3.5-3.5M12 13 8.5 9.5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3',
  // Anticlockwise arrow: back to the copy you kept.
  restore: 'M5 11a7 7 0 1 1 2 5M5 6v5h5',
};

interface IProfileActionIconProps {
  action: 'new' | 'save' | 'restore';
}

export default function ProfileActionIcon({ action }: IProfileActionIconProps) {
  return (
    <svg
      className="profile-action-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[action]} />
    </svg>
  );
}
