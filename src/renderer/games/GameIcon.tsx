/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IGameProgram } from '../../common/games';

interface IGameIconProps {
  program: Pick<IGameProgram, 'icon' | 'source'>;
  className?: string;
}

/**
 * A game's own icon, or a glyph for what it is.
 *
 * The picture Windows draws for the program is what a player recognises, and
 * it is what the launchers themselves show. Where there is none — a folder
 * with no readable program, a machine that refused the read — the fallback
 * says what kind of thing the row is instead of drawing a worse guess: a
 * window for a program that merely happens to be open, a gamepad for a game
 * out of a library.
 *
 * Drawn rather than photographed: no launcher's mark is reproduced here.
 * Steam's and Battle.net's logos are theirs, and a row that wore them would
 * be claiming a relationship this app does not have.
 */
const GameIcon = ({ program, className }: IGameIconProps) => {
  const classes = `game-icon${className ? ` ${className}` : ''}`;
  if (program.icon) {
    return <img className={classes} src={program.icon} alt="" aria-hidden />;
  }
  return (
    <svg
      className={classes}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {program.source === 'running' ? (
        // A window: something open, which is all this row claims to be.
        <>
          <rect x="3" y="4.5" width="18" height="15" rx="2" />
          <path d="M3 9h18M6.5 6.7h.01M9 6.7h.01" />
        </>
      ) : (
        // A gamepad, drawn at this weight so it sits beside real icons.
        <>
          <path d="M8 7.5h8a5 5 0 0 1 5 5v1a3.6 3.6 0 0 1-6.3 2.4l-.7-.8h-4l-.7.8A3.6 3.6 0 0 1 3 13.5v-1a5 5 0 0 1 5-5z" />
          <path d="M7.4 11.4v2.4M6.2 12.6h2.4M15.8 11.6h.01M18 13.4h.01" />
        </>
      )}
    </svg>
  );
};

export default GameIcon;
