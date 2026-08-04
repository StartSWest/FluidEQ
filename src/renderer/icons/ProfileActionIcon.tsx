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
const PATHS: Record<string, string> = {
  // Page with a plus: somewhere new to put this sound.
  new: 'M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9M13 3l6 7M13 3v6a1 1 0 0 0 1 1h5M9 15h6M12 12v6',
  // Floppy: save to the profile.
  save: 'M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 3v6h7V3M8 21v-6h8v6',
  // Anticlockwise arrow: back to the copy you kept.
  restore: 'M4 10a8 8 0 1 1 1.5 6M4 5v5h5',
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
