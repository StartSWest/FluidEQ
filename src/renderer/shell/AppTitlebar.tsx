/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import { useRef, type ComponentProps, type MouseEvent } from 'react';
import { PRODUCT_VERSION } from 'common/branding';
import { TITLEBAR_DOUBLE_CLICK_CHANNEL } from 'common/windowMode';
import ActionsMenu from '../components/ActionsMenu';
import SignalBrandMark from '../components/SignalBrandMark';
import SignalBrandName from '../components/SignalBrandName';
import TrafficLightSlot from '../components/TrafficLightSlot';
import HelpMenu from '../help/HelpMenu';
import type { IHelpHandlers } from '../help/helpMenuActions';
import WindowModeSwitch from '../player/WindowModeSwitch';
import SupportPet from '../SupportPet';
import { useTranslation } from '../utils/I18nContext';
import runsOnMac from '../utils/platform';
import { useTitlebarRoom } from '../utils/useTitlebarRoom';
import WaveformVisualizer from '../WaveformVisualizer';
import {
  WorkspaceTabsLeft,
  WorkspaceTabsRight,
  type IWorkspaceTabsProps,
} from './WorkspaceTabStrips';

/**
 * Shipped build version, substituted by webpack at compile time. Empty in any
 * context that does not go through the bundler (a bare unit-test import), so
 * the badge is rendered conditionally rather than showing "vundefined".
 *
 * Defined once in `common/branding`, alongside the name it sits next to.
 */
const APP_VERSION = PRODUCT_VERSION;

export interface IAppTitlebarProps {
  tabs: IWorkspaceTabsProps;
  /** Full screen without its top bar: the creature is not drawn. */
  isChromeHidden: boolean;
  hasContributed: boolean;
  onOpenSupport: () => void;
  /** The engine's chip and everything its menu offers. */
  actions: Omit<ComponentProps<typeof ActionsMenu>, 'help'>;
  /**
   * What Help's entries open: its own menu's, and the actions menu's while
   * the titlebar has no room for Help's button.
   */
  help: IHelpHandlers;
  /** Whether the forum is the page on screen, for Help's entry to it. */
  isForumOpen: boolean;
  /** Maximised or full screen: as large as the window goes. */
  isWindowFilled: boolean;
  isAppFullScreen: boolean;
  onLeaveFullScreen: () => void;
  onToggleMaximize: () => Promise<void>;
}

/**
 * The window's titlebar: who the app is, the six places either side of the
 * meter, the instrument capsule and Windows' three controls.
 */
const AppTitlebar = ({
  tabs,
  isChromeHidden,
  hasContributed,
  onOpenSupport,
  actions,
  help,
  isForumOpen,
  isWindowFilled,
  isAppFullScreen,
  onLeaveFullScreen,
  onToggleMaximize,
}: IAppTitlebarProps) => {
  const { t } = useTranslation();

  // Whether the two ends of the titlebar leave the meter between them its
  // whole width with the tagline and the creature still in them. The bar's
  // own element carries the answer as `data-crowded` — see the hook.
  const titlebarRef = useRef<HTMLElement | null>(null);
  const titlebarLeftRef = useRef<HTMLDivElement | null>(null);
  const titlebarRightRef = useRef<HTMLDivElement | null>(null);
  useTitlebarRoom(titlebarRef, titlebarLeftRef, titlebarRightRef);

  /**
   * The strip of titlebar the system does not own.
   *
   * Windows answers the double-click everywhere the bar is a drag region —
   * which is nearly all of it. This covers what is left: the identity block
   * on the left is `no-drag` so the name can be hovered, and a double-click
   * there should still maximise like a double-click an inch to its right.
   *
   * A Mac answers it on the drag region too, but with whatever the listener
   * chose in System Settings — zoom, minimise or nothing — so what is left
   * goes to main, which reads the same setting, rather than maximising here
   * whatever it says.
   */
  const handleTitlebarDoubleClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea')) {
      return;
    }
    if (runsOnMac()) {
      window.electron.ipcRenderer.sendMessage(
        TITLEBAR_DOUBLE_CLICK_CHANNEL,
        [],
      );
      return;
    }
    onToggleMaximize().catch(() => undefined);
  };

  const handleMinimizeWindow = () => {
    window.electron.ipcRenderer.minimizeWindow().catch(() => undefined);
  };

  const handleCloseWindow = () => {
    window.electron.ipcRenderer.closeWindow().catch(() => undefined);
  };

  return (
    <header
      ref={titlebarRef}
      className="workspace-header window-titlebar"
      data-window-strip
      onDoubleClick={handleTitlebarDoubleClick}
    >
      {/* The three direct grid children are what centre the waveform, and
          the middle one holds nothing but the meter for exactly that reason:
          two equal outer tracks put an `auto` middle one in the true middle
          of the window, so anything else in there pushes the spectrum off
          it. Identity and two places on the left; three places, the pet, the
          actions button and the window controls on the right. */}
      <div className="window-titlebar__left" ref={titlebarLeftRef}>
        {/* A Mac's traffic lights, first in the card, where every Mac
            window has them. Nothing on Windows or Linux. */}
        <TrafficLightSlot />
        <div className="workspace-header__identity">
          {/* Alive in the header ("Signal", Ivan 2026-09-25): the wave
              draws itself and a pulse runs along it; still everywhere
              else the app shows its logo. */}
          <SignalBrandMark />
          {/* Named, because a narrow window hides this and leaves the mark
              alone — see `.workspace-header__identity-text`. */}
          <div className="workspace-header__identity-text">
            <div className="workspace-header__name">
              <SignalBrandName />
              {/* Inlined at build time from the same package.json
                  electron-builder versions the installer with, so a bug
                  report quoting this is quoting the real build. */}
              {APP_VERSION && (
                <span className="workspace-header__version">
                  v{APP_VERSION}
                </span>
              )}
            </div>
            <div className="workspace-header__tagline">{t('app.tagline')}</div>
          </div>
        </div>
        <WorkspaceTabsLeft
          activeTab={tabs.activeTab}
          lastEqTab={tabs.lastEqTab}
          onSelect={tabs.onSelect}
          onApproach={tabs.onApproach}
        />
      </div>
      {/* Moved, not copied.

          In full screen the titlebar is hidden, and both of these are lifted
          out of it into the overlay below. Rendering a second copy instead
          was the first attempt and it does not work: CSS-hiding the titlebar
          leaves the originals mounted, so there were two creatures on one
          analyser and neither drew correctly — the hero in the support dialog
          went with them. Exactly one of each exists at any moment. */}
      {/* Always mounted, even in full screen where the titlebar around it is
          hidden. It is not wanted on screen there — a video with a spectrum
          over it does not also need a second meter across the top — but
          unmounting it would tear the analyser's hook down and build it again
          on every mode change, for a component nobody can see. CSS hides the
          bar; this stays put behind it. */}
      {/* The meter, alone in the middle track and therefore in the middle of
          the window. It is not restyled or resized by being in here — it
          keeps its own pane, its own border and its own drawing, and only
          its width gives way, to whatever the two ends leave over once the
          tagline and the creature have gone. See `useTitlebarRoom`. */}
      <div className="titlebar-nav">
        <WaveformVisualizer />
      </div>
      <div className="window-titlebar__right" ref={titlebarRightRef}>
        {/* First, so it stands against the meter with the elastic space
            behind it — which is what leaves the pet room instead of the
            names crowding it into the window controls.

            Two tab strips rather than one, because a single one cannot be
            interrupted by the meter and still slide its pill along itself.
            Each measures its own highlight and draws none when the chosen
            place is on the other side — see `useSlidingIndicator`. */}
        <WorkspaceTabsRight
          activeTab={tabs.activeTab}
          onSelect={tabs.onSelect}
          onApproach={tabs.onApproach}
        />
        {!isChromeHidden && (
          <SupportPet hasContributed={hasContributed} onOpen={onOpenSupport} />
        )}
        {/* No transport here any more. The bar at the foot of the window is
            the one transport this app has, and two of them meant the most
            contested strip in the window — analyser, pet, actions, window
            controls — was also carrying a second set of the same buttons.

            The row that stood here sent Windows media keys rather than
            driving anything in this app: one press acted on whatever
            external application had last claimed the key, which is a
            different thing from the play button beside it and was never
            obvious from looking at them. `TitlebarMediaTransport` and the
            `sendMediaTransport` channel behind it are still there for
            whatever wants them next. */}
        {/* ONE CAPSULE FOR THE TWO INSTRUMENT CONTROLS. The engine's chip
            and the switch between the app and the player were two separate
            boxes of two different shapes, standing beside a third (Help)
            and a creature — four things in four shapes across the busiest
            strip in the window (Ivan, 2026-09-22). Joined, they read as one
            instrument: what the app is doing, and what the window is. The
            same capsule the DSP page's Game mode and delay already share.

            Outside `.window-titlebar__controls` on purpose: those three
            buttons are Windows' own, and what they do is move the window
            rather than change what is in it. */}
        <div
          className="titlebar-instrument"
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <ActionsMenu
            engineState={actions.engineState}
            engineName={actions.engineName}
            engineVersion={actions.engineVersion}
            onFix={actions.onFix}
            onOpenEngine={actions.onOpenEngine}
            onTroubleshoot={actions.onTroubleshoot}
            onRestartAudio={actions.onRestartAudio}
            onImportEq={actions.onImportEq}
            onImportImpulse={actions.onImportImpulse}
            onProcesses={actions.onProcesses}
            onSupport={actions.onSupport}
            onAccount={actions.onAccount}
            help={help}
          />
          {/* Help, as one more glyph in the capsule beside the engine's
              (Ivan, 2026-09-22: "put the help menu as icon next to the
              other menu icon inside the pill"). It stood outside as a word
              of its own, which was one of the four shapes across this
              strip. */}
          <HelpMenu
            onTour={help.onTour}
            onTroubleshoot={help.onTroubleshoot}
            onReport={help.onReport}
            onForum={help.onForum}
            onAbout={help.onAbout}
            forumOpen={isForumOpen}
          />
          <WindowModeSwitch />
        </div>
        {/* Windows' three, drawn by the page because the window has no
            frame. A Mac has its own at the other end of the card. */}
        {!runsOnMac() && (
          <div
            className="window-titlebar__controls"
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="window-control"
              aria-label={t('app.window.minimizeApp')}
              title={t('app.window.minimize')}
              onClick={handleMinimizeWindow}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2 6h8" />
              </svg>
            </button>
            {/* Full screen counts as filled, because the window really is:
                the graph's largest view takes the screen for real, taskbar
                and all. A button offering to maximise a window that has the
                whole screen describes a state the window is not in, and
                pressing it did nothing — a full-screen window cannot be
                maximised. It reads and answers both states. */}
            <button
              type="button"
              className="window-control"
              aria-label={
                isWindowFilled
                  ? t('app.window.restoreApp')
                  : t('app.window.maximizeApp')
              }
              title={
                isWindowFilled
                  ? t('app.window.restore')
                  : t('app.window.maximize')
              }
              onClick={() => {
                if (isAppFullScreen) {
                  onLeaveFullScreen();
                  return;
                }
                onToggleMaximize().catch(() => undefined);
              }}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                {isWindowFilled ? (
                  <path d="M4 3h6v6M2 5v5h6V4" />
                ) : (
                  <path d="M2 2h8v8H2z" />
                )}
              </svg>
            </button>
            <button
              type="button"
              className="window-control window-control--close"
              aria-label={t('app.window.closeApp')}
              title={t('app.window.close')}
              onClick={handleCloseWindow}
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

export default AppTitlebar;
