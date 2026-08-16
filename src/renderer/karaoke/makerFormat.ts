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
 * A timestamp for the editor: `1:23.4`.
 *
 * Tenths rather than milliseconds, because this is read while listening. Three
 * digits changing thirty times a second is not a number anybody can compare to
 * the one they heard; one digit is.
 *
 * Negatives clamp to zero rather than rendering `-0:00.0` — a nudge can carry a
 * word past the start of the song, and the editor already refuses to store that.
 */
export const formatClock = (valueMs: number): string => {
  const safe = Math.max(0, valueMs);
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const tenths = Math.floor((safe % 1_000) / 100);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
};
