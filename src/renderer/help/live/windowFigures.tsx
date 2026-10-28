/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { PRODUCT_VERSION } from 'common/branding';
import LiveFigure from '../../components/LiveFigure';
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
import runsOnMac from '../../utils/platform';
import { PEAK_WIDEST } from '../../WaveformVisualizer';
import { WAVEFORM_BLEED } from '../../waveformPaint';
import signalStill from '../../../../assets/tour/signal-still.png';

/**
 * The window chapter's title bar, drawn by the bar's own parts
 * (`helpChapters/start.ts` frames its two ends out of it).
 *
 * The identity, both tab strips, the creature's art and the window-mode
 * switch are the bar's own components, with the EQ tab lit; the buttons
 * whose components open menus, read the engine or listen to the music — the
 * actions and Help triggers, the creature's button, Windows' three — are
 * their markup, class for class, as `AppTitlebar` draws them. The signal is
 * a still of its drawing, laid where its canvas lies: the meter draws the
 * reader's own sound, and a second meter on the same capture was the bug
 * that put two creatures on one analyser (`AppTitlebar`).
 *
 * The bar's window-width rules apply as they do in the window, so the
 * drawing shows the bar the reader has: names on the tabs on a wide window,
 * glyphs on a narrower one. Only its own box is Help's (`_helpLive.scss`).
 */

const nothing = () => undefined;

/** The actions trigger's glyph, three lines, as `ActionsMenu` draws it. */
const MENU_LINES = 'M4 7h16M4 12h16M4 17h16';

/** The live signal, as a still of its canvas under its own labels. */
const SignalStill = () => {
  const { t } = useTranslation();
  return (
    <div className="waveform-visualizer-shell">
      <button
        type="button"
        className="waveform-visualizer waveform-visualizer--fluid is-active"
      >
        <span className="waveform-visualizer__meta">
          <span className="waveform-visualizer__signal">
            <span className="waveform-visualizer__signal-dot" />
            {t('waveform.live')}
          </span>
          <span className="waveform-visualizer__readout">
            <LiveFigure
              className="waveform-visualizer__peak"
              widest={PEAK_WIDEST}
            >
              -0.9 dB
            </LiveFigure>
          </span>
        </span>
        <span className="waveform-visualizer__stage">
          {/* The canvas's own bleed, so the still lies where the drawing
              does; cropped rather than squeezed where the window makes the
              meter narrower than the 420px it was taken at. */}
          <img
            className="waveform-visualizer__canvas"
            src={signalStill}
            alt=""
            style={{
              margin: -WAVEFORM_BLEED,
              width: `calc(100% + ${WAVEFORM_BLEED * 2}px)`,
              height: `calc(100% + ${WAVEFORM_BLEED * 2}px)`,
              objectFit: 'cover',
              objectPosition: 'left center',
            }}
          />
        </span>
      </button>
      <button
        type="button"
        className="euphoria-pill waveform-visualizer__euphoria"
        aria-pressed
      >
        {t('waveform.rainbow')}
      </button>
    </div>
  );
};

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
        <SignalStill />
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
