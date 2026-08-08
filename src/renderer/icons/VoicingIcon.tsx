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
 * Glyphs for the voicing profiles.
 *
 * Stroked rather than filled and drawn on a 24 unit grid, so the same paths
 * stay legible from the 14px chip in the EQ toolbar up to the card in the
 * Voicing tab. `currentColor` lets each usage inherit its own state colour.
 */
const PATHS: Record<string, string> = {
  // Musical note.
  music:
    'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zm10-2a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  // Clapperboard.
  movies:
    'M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8zm0 0 1.5-4h15L21 8M8 4l-1.5 4M13 4l-1.5 4M18 4l-1.5 4',
  // Gamepad.
  games:
    'M7 12h4m-2-2v4m6.5-1h.01M18 10h.01M8 7h8a5 5 0 0 1 5 5v1a4 4 0 0 1-7 2.7l-.6-.7h-2.8l-.6.7A4 4 0 0 1 3 13v-1a5 5 0 0 1 5-5z',
  // Microphone.
  speech:
    'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4m-3 0h6',
  // Crescent moon.
  loudness: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
  // Crossed-out circle, for "no voicing".
  none: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM6 6l12 12',

  // Genres. Drawn on the same 24 grid and at the same weight, so a genre and a
  // purpose read as the same kind of thing in the same list — which they are.
  // Lightning: amplified.
  rock: 'M13 3 5 14h5l-1 7 8-11h-5l1-7z',
  // Amplifier stack.
  metal: 'M4 4h16v7H4zm0 9h16v7H4zM8 7.5h.01M16 7.5h.01M8 16.5h.01M16 16.5h.01',
  // Star.
  pop: 'M12 3.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.9l6-.8z',
  // Turntable: platter, spindle and arm.
  hiphop:
    'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM17.5 6.5 13.5 10.5',
  // Waveform on a scope.
  electronic: 'M3 12h3l2-6 3 12 3-9 2 3h5',
  // Saxophone.
  jazz: 'M14 3v8a5 5 0 0 1-5 5 3 3 0 0 0 0 6h5M11 7h4M11 11h4',
  // Concert hall: pediment and columns.
  classical: 'M5 20h14M4 9h16L12 3 4 9zM7 9v9m4-9v9m4-9v9',
  // Acoustic guitar: body, soundhole and neck.
  acoustic:
    'M14 3h4m-2 0v8m-2.5 1.5a5.5 5.5 0 1 1-5.5 5.5 5.5 5.5 0 0 1 5.5-5.5zm0 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
};

/** The strip of sliders that stands for voicing as a whole. */
const GENERIC = 'M4 8h6M14 8h6M4 16h10M18 16h2M11 5v6M15 13v6';

interface IVoicingIconProps {
  /** Profile id, or omitted for the generic voicing glyph. */
  profileId?: string;
  className?: string;
}

export default function VoicingIcon({
  profileId,
  className,
}: IVoicingIconProps) {
  // Falls back rather than rendering nothing. `PATHS[unknown]` is `undefined`
  // and a path with no `d` draws an empty glyph, so a profile added without one
  // would leave a hole in the list that looks like a failed load.
  const path = (profileId ? PATHS[profileId] : GENERIC) ?? GENERIC;

  return (
    <svg
      className={`voicing-icon ${className || ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path || GENERIC} />
    </svg>
  );
}
