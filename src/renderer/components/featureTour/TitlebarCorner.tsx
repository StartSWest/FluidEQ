/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import MenuIcon from '../../icons/MenuIcon';
import PlayerIcon from '../../player/PlayerIcon';

/** The actions menu's own glyph, as its trigger draws it (`ActionsMenu`). */
const PULSE = 'M4 12h3l2-6 4 12 2-6h5';

/** The three things in the title bar's capsule a slide can send you to. */
export type TTitlebarControl = 'actions' | 'help' | 'player';

/**
 * The top right of FluidEQ's window as it stands: the capsule holding the
 * actions menu's pulse, Help's book and the switch between the app and the
 * Compact player, then the window's own keys. The control a slide sends the
 * reader to is ringed, with its name under it, so the picture points at the
 * place in the window rather than describing it.
 */
export default function TitlebarCorner({
  ringed,
  label,
}: {
  ringed: TTitlebarControl;
  /** The ringed control's own name, as its tooltip gives it. */
  label: string;
}) {
  const tag = (control: TTitlebarControl) =>
    control === ringed && <span className="titlebar-corner__tag">{label}</span>;
  const ring = (control: TTitlebarControl) =>
    control === ringed ? ' is-ringed' : '';
  return (
    <div className="titlebar-corner">
      <span className="titlebar-corner__capsule">
        <span className={`titlebar-corner__key${ring('actions')}`}>
          <svg className="titlebar-corner__glyph" viewBox="0 0 24 24">
            <path className="titlebar-corner__line" d={PULSE} />
          </svg>
          <span className="titlebar-corner__dot" />
          {tag('actions')}
        </span>
        <span className={`titlebar-corner__key${ring('help')}`}>
          <MenuIcon name="guide" className="titlebar-corner__glyph" />
          {tag('help')}
        </span>
        <span className={`titlebar-corner__switch${ring('player')}`}>
          <span className="is-lit">
            <PlayerIcon name="app" className="titlebar-corner__glyph" />
          </span>
          <span>
            <PlayerIcon name="player" className="titlebar-corner__glyph" />
          </span>
          {tag('player')}
        </span>
      </span>
      <span className="titlebar-corner__window-keys">
        <PlayerIcon name="minimize" className="titlebar-corner__glyph" />
        <svg className="titlebar-corner__glyph" viewBox="0 0 24 24">
          <rect
            className="titlebar-corner__line"
            x="6.5"
            y="6.5"
            width="11"
            height="11"
            rx="1.6"
          />
        </svg>
        <PlayerIcon name="close" className="titlebar-corner__glyph" />
      </span>
    </div>
  );
}
