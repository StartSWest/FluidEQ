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

  // ------------------------------------------------------------------------
  // The DSP rack's presets, which are a longer list than the profiles above
  // and reuse them wherever the two mean the same thing. A preset called
  // "Rock" and a voicing called "Rock" are one idea at two points in the
  // chain, and drawing them differently would say they were not.
  // ------------------------------------------------------------------------

  // A level line: nothing applied.
  flat: 'M3 12h18',
  // The smile the preset is named after.
  'v-shape': 'M3 7l9 10 9-10',
  // Offbeat skank: chops between the beats.
  reggae: 'M4 15V9m5 9V6m5 12V6m5 9V9',
  // Cassette: shell, hubs and tape.
  tape: 'M3 6h18v12H3zM8 12h.01M16 12h.01M7 12a5 5 0 0 1 10 0M8 18v-2h8v2',
  // A soft hill: nothing in it has an edge.
  ambient: 'M3 16c4 0 4-8 9-8s5 8 9 8',
  // Kick drum, head on.
  drumBass:
    'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM5 12h14M12 5v14M4 20l3-3M20 20l-3-3',
  // Keyboard: keys and two sharps.
  piano: 'M4 5h16v14H4zM9.3 5v14M14.6 5v14M7 5v6h2.5V5M12.4 5v6h2.5V5',
  // A scroll and strings, abstracted to what survives at 14px.
  strings: 'M15 4c-4 3-7 7-9 12M9 4c3 3 5 7 6 12M6 19h8',
  // An open book.
  audiobook:
    'M12 6v13M12 6C10 4.5 7 4 4 4.5v12c3-.5 6 0 8 1.5M12 6c2-1.5 5-2 8-1.5v12c-3-.5-6 0-8 1.5',
  // A notch taken out of a line. Every repair preset is this shape; only its
  // frequency differs, and a glyph cannot show a frequency.
  notch: 'M3 8h5l2 8 2-8 2 8 2-8h5',
  // Weight arriving at the bottom of the range.
  bassBoost: 'M6 20V8m0 0L3 11m3-3 3 3M13 20h8M13 16h8M13 12h8',
  // The same arrow at the other end.
  trebleBoost: 'M18 20V8m0 0-3 3m3-3 3 3M3 20h8M3 16h8M3 12h8',
  // A low sun: warmth without the heat of a flame.
  warm: 'M12 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 3v1.5M12 19.5V21M4.2 4.2l1 1M18.8 18.8l1 1M3 12h1.5M19.5 12H21M4.2 19.8l1-1M18.8 5.2l1-1',
  // Moving air: what the top octave sounds like when it is there.
  air: 'M3 8h11a2.5 2.5 0 1 0-2.5-2.5M3 12h15a2.5 2.5 0 1 1-2.5 2.5M3 16h9a2.5 2.5 0 1 1-2.5 2.5',
  // A small box with one driver, which is the whole problem it solves.
  smallSpeakers:
    'M6 3h12v18H6zM12 8a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 5.5h.01',
  // Car, from the side.
  car: 'M4 16v3h3v-3m10 0v3h3v-3M3 16v-4l2-5h14l2 5v4zM3 12h18M7.5 14h.01M16.5 14h.01',
  // A pair of earbuds with their stems.
  earbuds:
    'M9 4a5 5 0 0 0-5 5v4a3 3 0 0 0 6 0V9M15 4a5 5 0 0 1 5 5v4a3 3 0 0 1-6 0V9',
  // Laptop: lid and base.
  laptop: 'M5 5h14v10H5zM3 18h18l-1.5-3H4.5z',
  // Headphones, band over the top.
  openBack:
    'M4 15v-3a8 8 0 0 1 16 0v3M4 14h3v6H5a1 1 0 0 1-1-1zm16 0h-3v6h2a1 1 0 0 0 1-1z',
};

/**
 * Entries that are another one's idea, drawn its way.
 *
 * A second table rather than duplicated path data, so a glyph that gets
 * redrawn cannot come out updated for "Tape" and stale for "Lo-fi", which are
 * the same cassette.
 */
const ALIASES: Record<string, string> = {
  // Purposes the voicing list already draws.
  movie: 'movies',
  nightMovie: 'movies',
  gaming: 'games',
  vocal: 'speech',
  podcast: 'speech',
  liveVocal: 'speech',
  lateNight: 'loudness',
  // Genres that are a sibling of one already here.
  punk: 'rock',
  country: 'acoustic',
  blues: 'jazz',
  trap: 'hiphop',
  vinyl: 'hiphop',
  orchestra: 'classical',
  lofi: 'tape',
  // The Maximizer's own profiles, drawn as what they do to the envelope.
  // "Safety" applies no gain at all, "Transparent" rounds nothing off, and
  // "Punch" is a kick's first cycle arriving before the limiter has moved.
  safety: 'flat',
  transparent: 'ambient',
  punch: 'drumBass',
  streaming: 'air',
  broadcast: 'speech',
  loud: 'rock',
  // Repairs, all of them a notch.
  deEss: 'notch',
  sibilance: 'notch',
  mudCut: 'notch',
  harshTamer: 'notch',
  tameBoom: 'notch',
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
  const key = profileId ? (ALIASES[profileId] ?? profileId) : '';
  const path = (key ? PATHS[key] : GENERIC) ?? GENERIC;

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
