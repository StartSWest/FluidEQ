/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '../styles/PlayerIcon.scss';

/**
 * The player's glyphs, drawn on one 24-unit grid with one stroke weight so
 * the transport, the switch and the title strip read as one set.
 *
 * Stroked by default; the transport's solid shapes are filled, because a
 * play triangle drawn as an outline is the size of a hint rather than a key.
 */
const STROKED = {
  // The full app: a window with its titlebar and its side column.
  app: 'M5.4 4.5h13.2a2.4 2.4 0 0 1 2.4 2.4v10.2a2.4 2.4 0 0 1-2.4 2.4H5.4A2.4 2.4 0 0 1 3 17.1V6.9a2.4 2.4 0 0 1 2.4-2.4zM3 8.5h18M8.5 8.5v11',
  // The player: a small deck with a play key and two lines of display.
  player:
    'M5.6 6h12.8A2.6 2.6 0 0 1 21 8.6v6.8a2.6 2.6 0 0 1-2.6 2.6H5.6A2.6 2.6 0 0 1 3 15.4V8.6A2.6 2.6 0 0 1 5.6 6zM14 10.2h3.6M14 13.8h2.4',
  pin: 'M9.5 3.5h5l-.8 5.6 3.3 3.4H7l3.3-3.4zM12 12.5V20',
  minimize: 'M6 12h12',
  // A clock face with its hands at ten past ten: the time still to come.
  clock: 'M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM12 8v4.4l2.8 1.7',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  caret: 'M6 9.5l6 6 6-6',
  fold: 'M6 15l6-6 6 6',
  unfold: 'M6 9l6 6 6-6',
  back5: 'M4.5 12.5a7.5 7.5 0 1 0 2.3-5.4M4.6 4.2v3.9h3.9',
  forward5: 'M19.5 12.5a7.5 7.5 0 1 1-2.3-5.4M19.4 4.2v3.9h-3.9',
  shuffle:
    'M3.5 7h3.3c2 0 3.1 1.1 4.3 2.9l1.8 2.7c1.2 1.8 2.3 2.9 4.3 2.9h3.3M3.5 17h3.3c1.1 0 1.9-.3 2.6-1M13.8 8c.8-.7 1.7-1 2.9-1h3.8M17.9 4.3L20.6 7l-2.7 2.7M17.9 12.8l2.7 2.7-2.7 2.7',
  repeat:
    'M16.8 3.6l2.9 2.9-2.9 2.9M4.3 11.2V9.5a3 3 0 0 1 3-3h12.4M7.2 20.4l-2.9-2.9 2.9-2.9M19.7 12.8v1.7a3 3 0 0 1-3 3H4.3',
  speaker:
    'M4 9.4h3.4L12 5.6v12.8l-4.6-3.8H4zM15.4 9.3a3.8 3.8 0 0 1 0 5.4M17.9 6.8a7.3 7.3 0 0 1 0 10.4',
  mute: 'M4 9.4h3.4L12 5.6v12.8l-4.6-3.8H4zM15.8 9.6l4.8 4.8M20.6 9.6l-4.8 4.8',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  chevronLeft: 'M14.5 6l-6 6 6 6',
  chevronRight: 'M9.5 6l6 6-6 6',
  check: 'M5 12.5l4.4 4.4L19 7.4',
  remove: 'M7.5 7.5l9 9M16.5 7.5l-9 9',
} as const;

const FILLED = {
  play: 'M8 5.2v13.6L19 12z',
  pause: 'M6.8 5h3.8v14H6.8zM13.4 5h3.8v14h-3.8z',
  stop: 'M7.6 6h8.8A1.6 1.6 0 0 1 18 7.6v8.8a1.6 1.6 0 0 1-1.6 1.6H7.6A1.6 1.6 0 0 1 6 16.4V7.6A1.6 1.6 0 0 1 7.6 6z',
  previous: 'M6 5h2.3v14H6zM19.5 5.2v13.6L9.3 12z',
  next: 'M15.7 5H18v14h-2.3zM4.5 5.2v13.6L14.7 12z',
  // The player glyph's play key, filled inside the stroked deck.
  playerKey: 'M7.2 9.6v4.8l4-2.4z',
} as const;

export type TPlayerIconName = keyof typeof STROKED | keyof typeof FILLED;

interface IPlayerIconProps {
  name: TPlayerIconName;
  className?: string;
}

const isFilled = (name: TPlayerIconName): name is keyof typeof FILLED =>
  name in FILLED;

const PlayerIcon = ({ name, className = 'player-icon' }: IPlayerIconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    {isFilled(name) ? (
      <path className="player-icon__fill" d={FILLED[name]} />
    ) : (
      <path className="player-icon__stroke" d={STROKED[name]} />
    )}
    {name === 'player' && (
      <path className="player-icon__fill" d={FILLED.playerKey} />
    )}
    {(name === 'back5' || name === 'forward5') && (
      <text className="player-icon__digit" x="12" y="15.6" textAnchor="middle">
        5
      </text>
    )}
  </svg>
);

export default PlayerIcon;
