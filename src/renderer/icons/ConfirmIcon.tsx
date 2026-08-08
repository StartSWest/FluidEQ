/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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
 * Tick and cross for the rename row.
 *
 * Stroked rather than filled, unlike the edit and delete glyphs beside them:
 * these two appear only while a field is open, and a filled shape at that size
 * next to a text cursor reads as a blob.
 */
interface IConfirmIconProps {
  /** Which of the pair to draw. */
  variant: 'accept' | 'cancel';
}

const PATHS = {
  accept: 'M4 10.5l4 4 8-9',
  cancel: 'M5 5l10 10M15 5L5 15',
};

export default function ConfirmIcon({ variant }: IConfirmIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[variant]} />
    </svg>
  );
}
