/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import PlayerIcon from './PlayerIcon';
import { setWindowMode, useWindowMode } from './windowModeStore';
import '../styles/WindowModeSwitch.scss';

/**
 * The switch between the full app and the player.
 *
 * The same control in both, in the same corner: beside the window buttons in
 * the app's titlebar and in the player's title strip. Main anchors the
 * player at that corner, so the pointer that turned the app into the player
 * is already on the switch that turns it back.
 *
 * A switch and not a button, because it has two states and shows both: the
 * lit half is the mode the window is in.
 */
const WindowModeSwitch = ({ className = '' }: { className?: string }) => {
  const { t } = useTranslation();
  const { mode } = useWindowMode();
  const isPlayer = mode === 'player';
  const hint = isPlayer
    ? t('player.switch.toApp')
    : t('player.switch.toPlayer');
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isPlayer}
      aria-label={t('player.switch.name')}
      title={hint}
      className={`window-mode-switch${isPlayer ? ' is-player' : ''} ${className}`}
      // Inside a titlebar that maximises (the app) or folds (the player) on a
      // double-click: two quick presses here are two switches, not that.
      onDoubleClick={(event) => event.stopPropagation()}
      onClick={() => {
        // Main answers with the mode it is in, and the store draws that. A
        // request that fails reaches nobody: main is restarting, and its
        // next push says which mode the window came back in.
        setWindowMode(isPlayer ? 'app' : 'player').catch(() => undefined);
      }}
    >
      <span className="window-mode-switch__side window-mode-switch__side--app">
        <PlayerIcon name="app" />
      </span>
      <span className="window-mode-switch__side window-mode-switch__side--player">
        <PlayerIcon name="player" />
      </span>
    </button>
  );
};

export default WindowModeSwitch;
