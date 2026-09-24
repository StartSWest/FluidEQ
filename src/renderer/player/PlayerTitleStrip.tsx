/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PRODUCT_NAME } from 'common/branding';
import TrafficLightSlot from '../components/TrafficLightSlot';
import { useTranslation } from '../utils/I18nContext';
import runsOnMac from '../utils/platform';
import PlayerIcon from './PlayerIcon';
import PlayerMarkMenu, { type TPlayerPage } from './PlayerMarkMenu';
import WindowModeSwitch from './WindowModeSwitch';
import { setWindowPinned, useWindowMode } from './windowModeStore';

export type { TPlayerPage };

interface IPlayerTitleStripProps {
  onFold: () => void;
  /** Back to the full app, on one of its pages. */
  onOpenPage: (page: TPlayerPage) => void;
}

/**
 * The player's one strip of chrome, and the handle the window is dragged by.
 *
 * The FluidEQ mark opens the menu that stands in for the app's tab strip
 * (`PlayerMarkMenu`). Then Always on top, the switch, and the two window
 * buttons. A double-click on the strip folds the player to one line, where
 * the app's titlebar would maximise — a player has nothing to maximise into.
 * Windows keeps that double-click to itself, so it arrives from main
 * (`usePlayerFold`), not as a page event.
 *
 * On a Mac the window's own traffic lights open the strip and the two window
 * buttons are not drawn. A Mac keeps a double-click on a drag handle to
 * itself as well, and answers it with the listener's own setting, so the
 * fold is the mark menu's there.
 */
const PlayerTitleStrip = ({ onFold, onOpenPage }: IPlayerTitleStripProps) => {
  const { t } = useTranslation();
  const { isPinned } = useWindowMode();
  const togglePin = () => setWindowPinned(!isPinned).catch(() => undefined);

  return (
    <div className="player-title" data-window-strip>
      <TrafficLightSlot />
      <PlayerMarkMenu onFold={onFold} onOpenPage={onOpenPage} />
      <span className="player-title__name" aria-hidden="true">
        {PRODUCT_NAME}
      </span>
      <div className="player-title__controls">
        <button
          type="button"
          className="player-title__button"
          aria-pressed={isPinned}
          aria-label={t('player.menu.alwaysOnTop')}
          title={t('player.menu.alwaysOnTop')}
          onClick={togglePin}
        >
          <PlayerIcon name="pin" />
        </button>
        <WindowModeSwitch />
        {!runsOnMac() && (
          <>
            <button
              type="button"
              className="player-title__button"
              aria-label={t('app.window.minimizeApp')}
              title={t('app.window.minimize')}
              onClick={() => {
                window.electron.ipcRenderer
                  .minimizeWindow()
                  .catch(() => undefined);
              }}
            >
              <PlayerIcon name="minimize" />
            </button>
            <button
              type="button"
              className="player-title__button player-title__button--close"
              aria-label={t('app.window.closeApp')}
              title={t('app.window.close')}
              onClick={() => {
                window.electron.ipcRenderer
                  .closeWindow()
                  .catch(() => undefined);
              }}
            >
              <PlayerIcon name="close" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PlayerTitleStrip;
