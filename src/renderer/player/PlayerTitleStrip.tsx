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
 * The amp's header, and the handle the window is dragged by (the Stage, Ivan
 * 2026-09-27: "we need a nicer header with title and handler look").
 *
 * Nothing in its middle but a grab bar over the name, which says "drag
 * here" and is all header — the visualizer's controls went onto the picture
 * (`PlayerStageBar`) so the strip stays clean to drag. At its ends two glass
 * pieces hold the only buttons in it: the FluidEQ mark, which opens the menu
 * that stands in for the app's tab strip (`PlayerMarkMenu`), and the window's
 * own — Always on top and the switch back to the full app, then minimise and
 * close.
 *
 * A double-click on the header folds the player to one line, where the app's
 * titlebar would maximise — a player has nothing to maximise into. Windows
 * keeps that double-click to itself, so it arrives from main
 * (`usePlayerFold`), not as a page event.
 *
 * On a Mac the window's own traffic lights open the header and the two
 * window buttons are not drawn. A Mac keeps a double-click on a drag handle
 * to itself as well, and answers it with the listener's own setting, so the
 * fold is the mark menu's there.
 */
const PlayerTitleStrip = ({ onFold, onOpenPage }: IPlayerTitleStripProps) => {
  const { t } = useTranslation();
  const { isPinned } = useWindowMode();
  const togglePin = () => setWindowPinned(!isPinned).catch(() => undefined);
  const isMac = runsOnMac();
  return (
    <div className="player-title" data-window-strip>
      <div className="player-title__lead">
        <TrafficLightSlot />
        <PlayerMarkMenu onFold={onFold} onOpenPage={onOpenPage} />
      </div>
      <span className="player-title__handle" aria-hidden="true">
        <span className="player-title__grabber" />
        <span className="player-title__name">{PRODUCT_NAME}</span>
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
        {!isMac && (
          <>
            <span className="player-title__rule" aria-hidden="true" />
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
