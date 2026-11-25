/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { PRODUCT_VERSION } from 'common/branding';
import SignalBrandMark from '../../components/SignalBrandMark';
import SignalBrandName from '../../components/SignalBrandName';
import MenuIcon from '../../icons/MenuIcon';
import { PetArt } from '../../PetArt';
import WindowModeSwitch from '../../player/WindowModeSwitch';
import {
  WorkspaceTabsLeft,
  WorkspaceTabsRight,
} from '../../shell/WorkspaceTabStrips';
import { useTranslation } from '../../utils/I18nContext';
import WaveformVisualizer from '../../WaveformVisualizer';
import HelpMusic from './HelpMusic';
import runsOnMac from '../../utils/platform';

/**
 * The window chapter's title bar, drawn by the bar's own parts
 * (`helpChapters/start.ts` frames its two ends out of it).
 *
 * The identity, both tab strips, the creature's art and the window-mode
 * switch are the bar's own components, with the EQ tab lit; the buttons
 * whose components open menus, read the engine or listen to the music — the
 * actions and Help triggers, the creature's button, Windows' three — are
 * their markup, class for class, as `AppTitlebar` draws them. The signal is the
 * meter itself, moving with made-up music (`HelpMusic`), which opens no
 * capture of the reader's output, and without the preset plate over it,
 * which would read the reader's own preset.
 *
 * The bar's window-width rules apply as they do in the window, so the
 * drawing shows the bar the reader has: names on the tabs on a wide window,
 * glyphs on a narrower one. Only its own box is Help's (`_helpLive.scss`).
 */

const nothing = () => undefined;

/** The actions trigger's glyph, three lines, as `ActionsMenu` draws it. */
const MENU_LINES = 'M4 7h16M4 12h16M4 17h16';

/** The whole title bar, on the EQ page. */
const WindowHeaderDrawing = () => {
  const { t } = useTranslation();
  return (
    <header className="workspace-header window-titlebar">
      <div className="window-titlebar__left">
        <div className="workspace-header__identity">
          <SignalBrandMark />
          <div className="workspace-header__identity-text">
            <div className="workspace-header__name">
              <SignalBrandName />
              {PRODUCT_VERSION && (
                <span className="workspace-header__version">
                  v{PRODUCT_VERSION}
                </span>
              )}
            </div>
          </div>
        </div>
        <WorkspaceTabsLeft
          activeTab="eq"
          lastEqTab="eq"
          onSelect={nothing}
          onApproach={nothing}
        />
      </div>
      <div className="titlebar-nav">
        {/* The meter itself, moving with made-up music: never the reader's
            capture, and never the preset plate, which reads their preset. */}
        <HelpMusic>
          <WaveformVisualizer />
        </HelpMusic>
      </div>
      <div className="window-titlebar__right">
        <WorkspaceTabsRight
          activeTab="eq"
          onSelect={nothing}
          onApproach={nothing}
        />
        <button
          type="button"
          className="support-pet"
          aria-label={t('support.pet.title')}
        >
          <PetArt />
        </button>
        <div className="titlebar-instrument">
          <div className="workspace-header__tools actions-menu">
            <button
              type="button"
              className="workspace-header__tools-trigger"
              aria-label={t('app.actions')}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={MENU_LINES} />
              </svg>
              <span className="status-dot" />
            </button>
          </div>
          <div className="workspace-header__tools help-menu">
            <button
              type="button"
              className="workspace-header__tools-trigger help-menu__trigger"
              aria-label={t('help.menu')}
            >
              <MenuIcon name="guide" />
            </button>
          </div>
          <WindowModeSwitch />
        </div>
        {/* Windows' three; a Mac draws its own at the other end. */}
        {!runsOnMac() && (
          <div className="window-titlebar__controls">
            <button
              type="button"
              className="window-control"
              aria-label={t('app.window.minimizeApp')}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2 6h8" />
              </svg>
            </button>
            <button
              type="button"
              className="window-control"
              aria-label={t('app.window.restoreApp')}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M4 3h6v6M2 5v5h6V4" />
              </svg>
            </button>
            <button
              type="button"
              className="window-control window-control--close"
              aria-label={t('app.window.closeApp')}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default WindowHeaderDrawing;
