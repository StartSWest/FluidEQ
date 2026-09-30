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

import { Activity, useCallback, useEffect, useRef, useState } from 'react';
import { ErrorCode, ErrorDescription } from 'common/errors';
import { isAccountConfigured } from 'common/accountConfig';
import useMediaQuery from './utils/useMediaQuery';
import {
  setSoundPaneFolded,
  useSoundPaneFolded,
  useSoundPaneSlide,
} from './utils/soundPane';
import GameSound from './games/GameSound';
import RackFollowsEngine from './dsp/RackFollowsEngine';
import PresetToneFeed from './dsp/PresetToneFeed';
import './styles/App.scss';
// After App.scss: these are the accents in their rainbow form, and they have to
// win against the cyan ones they replace without reaching for `!important`.
import './styles/Rainbow.scss';
import SmartEqEngine from './SmartEqEngine';
import SmartHeadroomEngine from './SmartHeadroomEngine';
import showGalleryGraph from './plus/showGalleryGraph';
import useStudioAgent from './studio/useStudioAgent';
import UsageMeter from './usage/UsageMeter';
import DynamicLightingLoop from './lighting/DynamicLightingLoop';
import HeardSongNames from './graph/HeardSongNames';
import WallpaperAudio from './wallpaper/WallpaperAudio';
import WallpaperGraphLook from './wallpaper/WallpaperGraphLook';
import WallpaperTuning from './wallpaper/WallpaperTuning';
import { WallpaperDialogHost } from './wallpaper/WallpaperControls';
import { GenreNotesHost } from './dsp/GenreNotesDialog';
import { FluidEqProvider, useFluidEqShell } from './utils/FluidEqContext';
import SideBar from './SideBar';
import {
  exitGraphFullScreen,
  useGraphFullScreen,
  useGraphView,
} from './utils/graphStyle';
import { reportError } from './utils/logger';
import { useSystemMediaSource } from './audio/useSystemMediaSource';
import { useSongEqSessionHost } from './audio/songEqSession';
import useCaptureBridge from './audio/useCaptureBridge';
import usePageMark from './utils/usePageMark';
import { useNoticeClaim } from './utils/noticeTurn';
import { shortWindowPaneKey, belowGraphPaneKey } from './utils/paneSizes';
import { EqTitleSlotContext } from './utils/eqTitleSlot';
import useWorkspaceAxis from './utils/workspaceAxis';
import FrequencyResponseChart from './graph/FrequencyResponseChart';
import eqReachesSound from './utils/eqReachesSound';
import useWindowFloor from './utils/windowFloor';
import Chevron from './icons/Chevron';
import { type TEngineState } from './components/ActionsMenu';
import type { IHelpHandlers } from './help/helpMenuActions';
import MiniPlayer from './player/MiniPlayer';
import usePlayerAmp from './player/usePlayerAmp';
import type { TPlayerPage } from './player/PlayerTitleStrip';
import { usePlayerVisFull } from './player/playerLayout';
import {
  reportPlayerAmp,
  setWindowMode,
  useWindowMode,
} from './player/windowModeStore';
import { applyThemeScope } from './utils/theme';
import { applyBackdropVeilScope } from './utils/backdropVeil';
import { applySceneDaylightScope } from './utils/sceneDaylightSetting';
import { applySliderHandleScope } from './utils/sliderHandle';
import { I18nProvider, useTranslation } from './utils/I18nContext';
import {
  LiveAudioProvider,
  useLiveAudioControl,
} from './audio/LiveAudioContext';
import RemoteAudioProvider from './remoteAudio/RemoteAudioContext';
import EuphoriaGlow from './components/EuphoriaGlow';
import ScenePulse from './components/ScenePulse';
import SceneAmbient from './ambient/SceneAmbient';
import SceneCover from './graph/SceneCover';
import SceneColumnLayer from './graph/SceneColumnLayer';
import GraphScene from './graph/GraphScene';
import SceneTint from './components/SceneTint';
import RainbowSource from './components/RainbowSource';
import { importConvolutionFile, importEqFile } from './utils/equalizerApi';
import { AudioEngineContext } from './utils/audioEngineContext';
import { startScenePrebuild } from './graph/scenePrebuild';
import { engineDisplayName } from './utils/audioEngineApi';
import { preloadTab } from './workspacePages';
import type { TWorkspaceTab } from './workspaceTabs';
import {
  SHORT_WINDOW_QUERY,
  SOUND_PANE_DRAWER_QUERY,
} from './shell/workspaceGroups';
import {
  GraphPaneResizer,
  MiddleContent,
  useGraphPaneResize,
} from './shell/ShellPanes';
import useWorkspaceNavigation from './shell/useWorkspaceNavigation';
import useShellEngine from './shell/useShellEngine';
import useShellFullScreen from './shell/useShellFullScreen';
import usePlayerMounts from './shell/usePlayerMounts';
import useTabGraph from './shell/useTabGraph';
import useShellDialogs from './shell/useShellDialogs';
import AppTitlebar from './shell/AppTitlebar';
import SoundPanel from './shell/SoundPanel';
import WorkspacePages, { EqGroupPills } from './shell/WorkspacePages';
import WorkspacePlayers from './shell/WorkspacePlayers';
import ShellDialogs from './shell/ShellDialogs';
import {
  CaptureFailedNotice,
  RestartRecommendedNotice,
} from './shell/ShellNotices';

const AppContent = () => {
  const {
    isLoading,
    globalError,
    isBlockingError,
    isEngineUsable,
    isGraphViewOn,
    refreshState,
    setGlobalError,
  } = useFluidEqShell();
  const { t } = useTranslation();

  // The sound panel drawer, meaningful only under the three-column breakpoint
  // and over a full-screen picture, where the panel opens over the page.
  const [rightPaneOpen, setRightPaneOpen] = useState(false);
  // Docked beside the page, folded to its rail or not: the member's choice,
  // and the Studio's while its bench is on screen (`soundPane.ts`).
  const isSoundPaneFolded = useSoundPaneFolded();
  const isSoundPaneDrawer = useMediaQuery(SOUND_PANE_DRAWER_QUERY);
  // The same, for the panel that becomes a drawer at the top of the window.
  const [topPaneOpen, setTopPaneOpen] = useState(false);
  const {
    activeWorkspaceTab,
    selectTopWorkspaceTab,
    preloadTabOnApproach,
    preloadEqPillOnApproach,
    lastEqTab,
  } = useWorkspaceNavigation();
  // Set from inside the graph pane; changing workspace pages leaves either
  // large graph mode first. The backdrop now follows playback rather than the
  // selected tab, so carrying expanded/fullscreen through a navigation makes
  // the tab press appear to do nothing.
  const isGraphFullScreen = useGraphFullScreen();
  const graphView = useGraphView();

  // The window as the compact player (`MiniPlayer`), and the way back from
  // it onto one of the pages: the page is chosen while the app is still put
  // away, so it comes back already showing it.
  const { mode: windowMode } = useWindowMode();
  // Which amp the switch will open, said while the window is the full app so
  // the player opens at that amp's own size; the amp says it itself once it
  // is on screen (`AmpMark`), ahead of its own limits.
  const playerAmp = usePlayerAmp();
  useEffect(() => {
    if (windowMode === 'app') {
      reportPlayerAmp(playerAmp);
    }
  }, [playerAmp, windowMode]);
  /**
   * THE AMP'S QUEUE DECK NEEDS THE LIBRARY'S PLAYER, whether or not anything
   * is playing (Ivan, 2026-09-22: "drag and drop into the up next doesn't
   * work, the app needs to enable that feature"). The deck lists that player's
   * queue and hands it the music dropped on it, and with the providers put
   * away — as they are off-tab once silent and no longer the last thing
   * played, and as they
   * have never been on a fresh launch — the deck had nothing to list and a
   * drop went nowhere, silently. So while the window is the amp, the Library
   * counts as opened and as active below: its queue is one tab of the amp's
   * sheet away (the Stage, 2026-09-27), and its count names that tab.
   */
  const playerWantsLibrary = windowMode === 'player';
  /**
   * THE AMP KEEPS ITS OWN THEME (Ivan, 2026-09-22). The full app can be Dark
   * while the amp is Light: the two are never on screen at once, so there is
   * one theme on the window at a time and a choice remembered for each mode.
   * Transparency, the EQ sliders' round or rectangular handle and a scene's
   * own time of day are kept the same way: one control remembered twice
   * (`backdropVeil.ts`, `sliderHandle.ts`, `sceneDaylightSetting.ts`).
   *
   * Applied from here rather than from the mode store itself, which is where
   * it belongs by subject and cannot go by construction: that module is
   * imported by half the player, and importing the theme from it closed a
   * cycle that took the window down with a TDZ error on `useWindowMode`. App
   * is the top of the tree and imports both already.
   */
  useEffect(() => {
    const scope = windowMode === 'player' ? 'player' : 'app';
    applyThemeScope(scope);
    applyBackdropVeilScope(scope);
    applySliderHandleScope(scope);
    applySceneDaylightScope(scope);
  }, [windowMode]);
  const openPageFromPlayer = useCallback(
    (page: TPlayerPage) => {
      let tab: TWorkspaceTab = page === 'plus' ? 'community' : lastEqTab;
      if (page !== 'eq' && page !== 'plus') {
        tab = page;
      }
      // The amp stays until the page it opens onto has arrived, so the app
      // comes back already showing that page rather than the one it was left
      // on and then changing.
      preloadTab(tab)
        .catch((error: unknown) => {
          reportError(`Loading the ${tab} page`, error);
        })
        .finally(() => {
          selectTopWorkspaceTab(tab);
          setWindowMode('app').catch(() => undefined);
        });
    },
    [lastEqTab, selectTopWorkspaceTab],
  );
  /**
   * What sleeps while the window is the amp.
   *
   * The app behind the amp was only `display: none` (`_miniPlayerShell.scss`),
   * so every page, the graph and the panels kept their effects, their frame
   * loops and their store subscriptions running for a window nobody could
   * see. Inside `<Activity mode="hidden">` they keep their state and their
   * DOM, lose their effects, and render only when nothing else wants the
   * thread; switching back runs the effects again, the same way opening a tab
   * does.
   *
   * Only what is already mounted and unmounted in ordinary use goes inside:
   * the pages (a tab switch unmounts each), the graph (hiding it on a tab
   * unmounts it), and the preset, output and driver panels. What has to keep
   * going for the amp stays outside and awake — see the markup below for each
   * one and why.
   */
  const isAmp = windowMode === 'player';
  const behindAmp = isAmp ? 'hidden' : 'visible';
  // Entering the amp and leaving it move the live capture's owners in one
  // commit: the sleeping pages let go and the amp takes hold, or the other
  // way round. Without a bridge the capture closed and reopened in between.
  useCaptureBridge(windowMode);

  const engine = useShellEngine();
  const { engineStatus, engineTrouble, isEngineOnOutput } = engine;
  // The EQ pages lock on all three ways a band cannot be heard, not only the
  // two the context knows about. See `eqReachesSound.ts`.
  const isEqReachingSound = eqReachesSound(isEngineUsable, isEngineOnOutput);

  const { showsGraph, setActiveTabGraphVisibility, showGraphOn } = useTabGraph({
    activeWorkspaceTab,
    graphView,
    isGraphViewOn,
  });

  /**
   * The EQ page puts its graph ABOVE the page (layout A, the open floor,
   * Ivan 2026-09-25): the section pills and the Bands title row on top, the
   * graph under them, then the bands — each standing under the point on the
   * graph it moves (`MainContent`, `plotGeometry`). Only while there is a
   * graph beside the page to put there; off, or filling the column, the page
   * keeps its pills and its title as it always has.
   *
   * Every other page keeps its graph underneath, the EQ group's other pills
   * included (Ivan, 2026-09-29: "only the one on the EQ page goes on top, the
   * rest always opens at the bottom"): there the graph is a monitor of what
   * the page is doing, not the instrument the page is edited on.
   */
  const isGraphFirst =
    activeWorkspaceTab === 'eq' && showsGraph && !isGraphFullScreen;
  const [eqTitleSlot, setEqTitleSlot] = useState<HTMLElement | null>(null);
  const eqGroupPills = (
    <EqGroupPills
      activeTab={activeWorkspaceTab}
      onSelect={selectTopWorkspaceTab}
      isEngineOnOutput={isEngineOnOutput}
      isPartlyOff={engineTrouble?.kind === 'problems'}
    />
  );
  // The player bar's deck stands under this column's middle.
  const [centerColumn, setCenterColumn] = useState<HTMLDivElement | null>(null);
  useWorkspaceAxis(centerColumn);

  /**
   * FULL SCREEN IS FULL SCREEN, ON EVERY TAB INCLUDING THE MAKER.
   *
   * This briefly refused to go full screen at all while the editor was open,
   * which is the wrong half of the choice: the graph stayed docked under the
   * Maker as a half-empty pane taking a third of the window, which is worse
   * than either answer. What is special about the editor is not whether the
   * graph may fill the screen — it is whether the graph is drawn *through*,
   * with the surface behind it left visible.
   *
   * That overlay belongs to the two picture-led tabs, the Karaoke player and
   * Media, where a translucent graph over a video or a lyric stage is a second
   * view of the same thing. Over an editor it is two interfaces fighting for
   * the same pixels. So the overlay is scoped in GraphTheme.scss to exclude a
   * Maker, and full screen here stays exactly what it is everywhere else.
   */
  // The picture behind an expanded graph follows the thing making the sound,
  // never the tab selected above it. This lets a Karaoke song stay a Karaoke
  // stage while Library or Media is selected, and lets a web player stay live
  // under the graph while EQ is open. `system` never claims this store, so an
  // external browser, Spotify or another application deliberately gets the
  // quiet graph-only surface.
  const isGraphBackdropMode = isGraphFullScreen && showsGraph;
  const mounts = usePlayerMounts({
    activeWorkspaceTab,
    isGraphBackdropMode,
    playerWantsLibrary,
    selectTopWorkspaceTab,
  });

  const dialogs = useShellDialogs(selectTopWorkspaceTab);
  // The member's own AI asking to see the scene it is writing: answered for
  // the life of the window, since bringing the Studio up is one of the answers.
  useStudioAgent();
  useEffect(() => {
    // A scene has to be compiled on the machine that plays it, so it is
    // compiled the moment it arrives rather than the first time somebody
    // watches it: measured at eleven seconds for one of the big ones, which
    // was eleven seconds of a still picture in the window.
    return startScenePrebuild();
  }, []);
  // What the rest of the machine is playing, on the bar when this app has
  // nothing of its own there. Mounted at the root because it is nobody's tab:
  // the sound is Spotify's or a browser's, and the curve on screen is shaping
  // it just the same.
  useSystemMediaSource();
  // The Smart EQ song-memory recorder: same lifetime and the same reason as
  // the line above it. A recording must not end because somebody switched
  // tabs, so this is hosted here rather than inside the EQ page.
  useSongEqSessionHost();

  // What Help's entries open: its own menu's, and the actions menu's while
  // the titlebar has no room for Help's button.
  const helpHandlers: IHelpHandlers = {
    onTour: () => dialogs.setShowFeatureTour(true),
    onTroubleshoot: () => dialogs.setShowTroubleshooter(true),
    onReport: () => dialogs.setShowBugReport(true),
    onForum: () => selectTopWorkspaceTab('forum'),
    onAbout: () => dialogs.setShowAbout(true),
  };

  const isPlayerVisFull = usePlayerVisFull();
  const fullScreen = useShellFullScreen({
    activeWorkspaceTab,
    showsGraph,
    graphView,
    isPlayerVisFull,
    setActiveTabGraphVisibility,
  });
  const {
    mediaFullScreenOwner,
    isMediaFullScreen,
    isGraphAppFullScreen,
    isAppFullScreen,
    hasFullScreenTopBar,
  } = fullScreen;
  usePageMark(activeWorkspaceTab);

  // Karaoke has one fullscreen layout. Entering it from the graph changes only
  // whether the graph is drawn over that layout; it does not create a second
  // set of stage offsets, playlist sizing or chord positions.
  const isKaraokeGraphFullScreen =
    mounts.showsKaraokeGraphBackdrop && graphView === 'fullscreen';
  // Owner-scoped, not merely "some surface is full screen": between the tab
  // changing and the effect releasing the window there is one render in which
  // the outgoing owner is still recorded, and these classes must not dress
  // the incoming tab in the outgoing tab's full-screen layout.
  const isMediaSurfaceFullScreen =
    mediaFullScreenOwner === activeWorkspaceTab || isKaraokeGraphFullScreen;
  const isKaraokeSurfaceFullScreen =
    (activeWorkspaceTab === 'karaoke' && mediaFullScreenOwner === 'karaoke') ||
    isKaraokeGraphFullScreen;

  // Where the sound panel opens over the page rather than standing beside it,
  // its button opens the drawer; beside the page it folds the column.
  const isSoundPaneOverPage =
    isSoundPaneDrawer || isGraphAppFullScreen || isMediaFullScreen;
  const isSoundDrawerOpen = isSoundPaneOverPage && rightPaneOpen;
  const isSoundPaneShown = isSoundPaneOverPage
    ? rightPaneOpen
    : !isSoundPaneFolded;
  // The panel slides on the compositor; the page is laid out once per fold
  // (`useSoundPaneSlide`). Beside the page the column is its rail from the
  // start of a fold, and until an unfold's slide has finished — the panel
  // covers the difference either way.
  const soundPanelRef = useRef<HTMLDivElement>(null);
  const isSoundPaneSliding = useSoundPaneSlide(soundPanelRef, isSoundPaneShown);
  const isSoundColumnNarrow =
    isSoundPaneFolded || (isSoundPaneSliding && !isSoundPaneOverPage);
  // Which split the divider moves: the tab's own; on a short window and a
  // page other than the EQ's, that window's (`shortWindowPaneKey`); and on an
  // EQ page with its graph above it, the one below the graph
  // (`belowGraphPaneKey`), which is a different pane from the one the tab's
  // own share was chosen for.
  const isShortWindow = useMediaQuery(SHORT_WINDOW_QUERY);
  let paneKey: string = activeWorkspaceTab;
  if (isGraphFirst) {
    paneKey = belowGraphPaneKey(activeWorkspaceTab);
  } else if (isShortWindow && activeWorkspaceTab !== 'eq') {
    paneKey = shortWindowPaneKey(activeWorkspaceTab);
  }
  const resize = useGraphPaneResize(paneKey, isGraphFirst);

  // The live capture's own failure, read once and reported once.
  //
  // It used to be printed inline in two places at the same time — a bare
  // sentence in the graph legend AND another in the waveform meter — so the
  // same fault appeared twice, in the two panes it had just emptied, in a
  // typeface meant for labels. It is a fault, so it now reads like the other
  // faults do.
  const { error: captureError, retry: retryCapture } = useLiveAudioControl();
  const [isCaptureNoticeHidden, setIsCaptureNoticeHidden] = useState(false);
  // A new failure is worth showing again even if the last one was dismissed.
  useEffect(() => setIsCaptureNoticeHidden(false), [captureError]);

  /**
   * Import an EQ or an impulse response the user already has.
   *
   * The file picker lives in the main process, so this is one call that either
   * comes back with a description of what was applied, an empty string because
   * the dialog was cancelled, or an error naming what was wrong with the file.
   * Nothing is applied halfway: the state only changes if the parse succeeded.
   */
  const runImport = async (importer: () => Promise<string>) => {
    try {
      const summary = await importer();
      if (!summary) {
        return;
      }
      dialogs.setImportNotice(summary);
      await refreshState();
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  // The restart and capture notices below hold the corner notices back
  // while they are up (`noticeTurn.ts`).
  useNoticeClaim(
    'audioRestart',
    !engine.suppressAudioNotices &&
      (engine.showAudioRestartRecommendation ||
        (Boolean(captureError) && !isCaptureNoticeHidden)),
  );
  // What the window shows before the page has painted and inside the strip a
  // resize opens — the app's own floor rather than a pane of bare glass.
  useWindowFloor();

  // No engine chosen yet. Its own name because it is answered by a dialog
  // rather than by the red banner every other blocking failure raises.
  const isEngineUnchosen =
    isBlockingError && globalError?.code === ErrorCode.AUDIO_ENGINE_NOT_CHOSEN;

  // The light the titlebar carries, and the one on the engine card the menu
  // opens onto. It used to go red only on a blocking failure — an engine that
  // is missing or a config that cannot be read — so an output Windows has
  // never once loaded the engine on left it green, beside a title saying the
  // audio engine was connected, while nothing at all was being processed.
  // Whatever the window knows is wrong on the output being listened to turns
  // it red now, which is the same answer the side bar's switch gives.
  let engineState: TEngineState = 'ready';
  if (
    isBlockingError ||
    engineTrouble !== undefined ||
    isEngineOnOutput === false
  ) {
    engineState = 'failing';
  } else if (isLoading) {
    engineState = 'checking';
  }

  return (
    <AudioEngineContext.Provider value={engineStatus?.engine ?? null}>
      <AppTitlebar
        tabs={{
          activeTab: activeWorkspaceTab,
          lastEqTab,
          onSelect: selectTopWorkspaceTab,
          onApproach: preloadTabOnApproach,
        }}
        isChromeHidden={fullScreen.isChromeHidden}
        hasContributed={dialogs.hasContributed}
        onOpenSupport={() => dialogs.setShowSupportDialog(true)}
        actions={{
          engineState,
          // Undefined until main answers, and while no engine has been
          // chosen — the menu then shows the status alone rather than
          // guessing at an engine.
          engineName: engineStatus?.engine
            ? engineDisplayName(engineStatus.engine, t)
            : undefined,
          engineVersion:
            engine.runningEngine === 'fluid'
              ? engineStatus?.fluid.dllVersion
              : undefined,
          onFix: () => {
            // The pill is the only thing left on screen saying something is
            // wrong once its card has been put away with "Not now", so it
            // has to be the way back to the card that says why and offers
            // the repair. It used to re-check the prerequisites only, which
            // on the commonest trouble — part of the engine failing to
            // start — did nothing anybody could see.
            engine.handleAskAboutEngine();
            dialogs.bumpPrereqNonce();
          },
          onOpenEngine: engine.handleOpenEngineDialog,
          onTroubleshoot: () => dialogs.setShowTroubleshooter(true),
          onRestartAudio: engine.handleRestartWindowsAudio,
          onImportEq: () => runImport(importEqFile),
          onImportImpulse: () => runImport(importConvolutionFile),
          onProcesses: () => dialogs.setShowProcessesDialog(true),
          onSupport: () => dialogs.setShowSupportDialog(true),
          onAccount: isAccountConfigured()
            ? () => dialogs.setAccountDialogPage('home')
            : undefined,
        }}
        help={helpHandlers}
        isForumOpen={activeWorkspaceTab === 'forum'}
        isWindowFilled={fullScreen.isWindowFilled}
        isAppFullScreen={isAppFullScreen}
        onLeaveFullScreen={fullScreen.leaveFullScreen}
        onToggleMaximize={fullScreen.toggleMaximizeWindow}
      />
      <main
        className={`app-workspace${
          isGraphAppFullScreen || isMediaFullScreen ? ' is-app-full' : ''
        }${
          (isGraphAppFullScreen || isMediaFullScreen) && hasFullScreenTopBar
            ? ' has-top-bar'
            : ''
        }${isMediaSurfaceFullScreen ? ' is-media-full' : ''}${
          isKaraokeSurfaceFullScreen ? ' is-karaoke-full' : ''
        }${isKaraokeGraphFullScreen ? ' has-karaoke-graph' : ''}${
          isSoundDrawerOpen ? ' is-sound-drawer-open' : ''
        }${isSoundPaneFolded ? ' is-sound-pane-folded' : ''}${
          isSoundColumnNarrow ? ' is-sound-pane-narrow' : ''
        }`}
      >
        {engine.showAudioRestartRecommendation &&
          !engine.suppressAudioNotices && (
            <RestartRecommendedNotice
              onDismiss={engine.dismissAudioRestartRecommendation}
              onRestart={engine.handleRestartWindowsAudio}
            />
          )}
        {captureError &&
          !isCaptureNoticeHidden &&
          !engine.suppressAudioNotices && (
            <CaptureFailedNotice
              onHide={() => setIsCaptureNoticeHidden(true)}
              onRetry={retryCapture}
            />
          )}
        {/* Below the two-column breakpoint this panel is a drawer that slides
            in from the left edge, summoned by the tab below and dismissed by
            its own backdrop. (The sound panel on the other edge keeps a rail
            instead, its button at the top.) Above that width the tab and the
            backdrop are display:none and the class does nothing. */}
        <button
          type="button"
          className={`side-bar-toggle${topPaneOpen ? ' is-open' : ''}`}
          aria-expanded={topPaneOpen}
          aria-label={t('app.soundPanel')}
          title={t('app.soundPanel')}
          onClick={() => setTopPaneOpen((open) => !open)}
        >
          {/* Which way the panel goes, not what is in it: the tab is a
              handle, and the chevron turns over with the panel. */}
          <Chevron className="drawer-tab__chevron" />
        </button>
        <SideBar
          showGraphToggle
          isGraphVisible={showsGraph}
          isOpen={topPaneOpen}
          isEngineOnOutput={isEngineOnOutput}
          onAskAboutEngine={engine.handleAskAboutEngine}
          onGraphVisibilityChange={setActiveTabGraphVisibility}
        />

        <div
          ref={setCenterColumn}
          className={`center-workspace${
            isGraphFullScreen && showsGraph && !isMediaFullScreen
              ? ' is-graph-full'
              : ''
          }${resize.isResizingPanes ? ' is-resizing' : ''}${
            isGraphFirst ? ' is-graph-first' : ''
          }`}
          onDoubleClickCapture={(event) => {
            if (!isGraphAppFullScreen) {
              return;
            }
            const target = event.target as Element;
            if (
              target.closest(
                'button, input, select, textarea, a, [role="dialog"], [role="menu"], .graph-edit-point',
              )
            ) {
              return;
            }
            // Anywhere on the screen, not only on the drawing. Full screen is
            // watched like a video, and a double-click anywhere on a video
            // comes back from it — the plot's margins and the strip above it
            // too, where the plot's own double-click does not reach. Caught
            // here on the way down and stopped, so the plot's handler cannot
            // toggle the mode a second time.
            event.preventDefault();
            event.stopPropagation();
            exitGraphFullScreen();
          }}
        >
          {/* The EQ page's head, above its graph (`isGraphFirst`): the
              section pills, and a slot the Bands page's title row is
              portalled into. First in the column's DOM as well as on screen,
              so the keyboard reaches it before the page. The graph and the
              page are put in order by the stylesheet rather than by moving
              them here — reordering the page's element moves every panel kept
              alive in it, and a moved web view reloads. */}
          {/* Behind the head and the graph, for a Plus visualizer to run up
              to the top of the column (`SceneColumnLayer`). */}
          {isGraphFirst && showsGraph && <SceneColumnLayer />}
          {isGraphFirst && (
            // Dimmed with its page when the engine cannot hear it
            // (`GraphTheme.scss`), as the pills and the title were while
            // they stood inside the page.
            <div
              className={`center-head center-head--${activeWorkspaceTab}${
                !isEqReachingSound ? ' is-engine-disabled' : ''
              }`}
            >
              {eqGroupPills}
              <div className="center-head__title" ref={setEqTitleSlot} />
            </div>
          )}
          <EqTitleSlotContext.Provider
            value={isGraphFirst ? eqTitleSlot : null}
          >
            <MiddleContent
              paneKey={paneKey}
              isSized={showsGraph && !isGraphFullScreen}
            >
              {/* The six places are in the titlebar now, beside the meter —
                see `AppTitlebar`. */}
              <WorkspacePages
                activeTab={activeWorkspaceTab}
                behindAmp={behindAmp}
                isEqReachingSound={isEqReachingSound}
                isGraphFirst={isGraphFirst}
                eqGroupPills={eqGroupPills}
                onEqPillApproach={preloadEqPillOnApproach}
                onOpenEngineDialog={engine.handleOpenEngineDialog}
                onSignIn={() => dialogs.setAccountDialogPage('home')}
                onShowGalleryGraph={() =>
                  showGalleryGraph(() => {
                    showGraphOn('eq');
                    selectTopWorkspaceTab('eq');
                  })
                }
              />
              <WorkspacePlayers
                activeTab={activeWorkspaceTab}
                isAmp={isAmp}
                isGraphBackdropMode={isGraphBackdropMode}
                mounts={mounts}
                fullScreen={fullScreen}
                isKaraokeSurfaceFullScreen={isKaraokeSurfaceFullScreen}
                isKaraokeGraphFullScreen={isKaraokeGraphFullScreen}
                onGoToTab={selectTopWorkspaceTab}
                setActiveTabGraphVisibility={setActiveTabGraphVisibility}
              />
              {/* Outside the tab switch for the same class of reason, and more
                strictly: this one renders nothing at all. It hosts both Smart
                EQ measurements, which used to live in the EQ panel above and so
                were torn down mid-capture whenever anybody looked at another
                tab. Mounted once and never unmounted, a continuous measurement
                keeps its evidence for as long as the window is open. */}
              <SmartEqEngine />
              {/* Headless, and mounted beside its sibling for the same reason:
                the measurement has to run wherever the user happens to be, not
                only where the response graph is. */}
              <SmartHeadroomEngine />
              {/* And the third, for the same reason spelled out again because it
                is the one that surprises: a game profile switches the sound
                while FluidEQ is BEHIND the game. On the Games page it would
                only ever work with the page open, which is the one moment
                nobody is playing. */}
              <GameSound />
              {/* A preset's rack across an engine switch, which is made in a
                dialog over whichever page is open. */}
              <RackFollowsEngine />
              {/* And its curve, told to the rack's Maximizer from wherever the
                curve changes: a preset, its chip, the EQ mode menu. */}
              <PresetToneFeed />
            </MiddleContent>
          </EqTitleSlotContext.Provider>
          {/* One divider, both tabs, always in the same place: the seam between
              whatever is above and the graph. In full screen there is nothing
              above the graph, so there is nothing to divide. */}
          {/* Asleep behind the amp, like the pages: hiding the graph on a tab
              already unmounts it, so its loops and its claim on the capture
              are known to stop and start cleanly. */}
          <Activity mode={behindAmp}>
            {showsGraph && !isGraphFullScreen && (
              <GraphPaneResizer
                paneKey={paneKey}
                ariaLabel={t('graph.resize')}
                onStart={resize.handleGraphResizeStart}
                onDrag={resize.handleGraphResizeDrag}
                onEnd={resize.handleGraphResizeEnd}
              />
            )}
            {showsGraph ? (
              <FrequencyResponseChart
                isVisible
                hasLayersInHead={isGraphFirst && activeWorkspaceTab === 'eq'}
              />
            ) : null}
            {/* The graph's Plus visualizer, beside the graph and not in it:
                on the plot, the EQ column or, on the EQ page, the Backdrop
                (`GraphScene`). Renders only its canvas, wherever that is. */}
            <GraphScene page={activeWorkspaceTab} />
          </Activity>
        </div>
        {/* One backdrop for both drawers, and pressing it shuts both. Two of
            them stacked, each closing only its own, meant a press outside
            with both open closed whichever happened to be on top and left
            the other standing. */}
        {(isSoundDrawerOpen || topPaneOpen) && (
          <button
            type="button"
            className="drawer-backdrop"
            aria-label={t('app.dismiss')}
            onClick={() => {
              setRightPaneOpen(false);
              setTopPaneOpen(false);
            }}
          />
        )}
        <SoundPanel
          panelRef={soundPanelRef}
          isDrawerOpen={isSoundDrawerOpen}
          isShown={isSoundPaneShown}
          isSliding={isSoundPaneSliding}
          onToggle={() =>
            isSoundPaneOverPage
              ? setRightPaneOpen((open) => !open)
              : setSoundPaneFolded(!isSoundPaneFolded)
          }
          behindAmp={behindAmp}
          engine={engineStatus?.engine ?? null}
          isNoticeHidden={engine.suppressAudioNotices}
          onConfigureApo={engine.handleConfigureEqualizerApo}
          onAttachFluidEngine={engine.handleAttachFluidEngine}
        />
        <ShellDialogs
          dialogs={dialogs}
          engine={engine}
          isEngineUnchosen={isEngineUnchosen}
          selectTopWorkspaceTab={selectTopWorkspaceTab}
        />
        {/* Drawn at the foot of the document, over the app it puts away. */}
        {windowMode === 'player' && (
          <MiniPlayer onOpenPage={openPageFromPlayer} />
        )}
      </main>
    </AudioEngineContext.Provider>
  );
};

export default function App() {
  return (
    // Outermost: every other provider can surface a message, and all of them
    // are below this one so they can be translated.
    <I18nProvider>
      <FluidEqProvider>
        <LiveAudioProvider>
          <RemoteAudioProvider>
            {/* Mounted here rather than inside the support dialog, because the
                run outlives that dialog being closed and the celebration is
                meant to reach the whole window. It renders nothing; it puts the
                streak on the document root where every stylesheet can see it. */}
            <EuphoriaGlow />
            {/* The window in the chosen Plus visualizer's colour, when that
                is switched on. Here for the same reason: the colour outlives
                the graph being on screen. Renders nothing. */}
            <SceneTint />
            {/* Rainbow mode's palette: Aurora, or the chosen Plus
                visualizer's colours. Renders nothing. */}
            <RainbowSource />
            {/* The back of the window, where that visualizer is drawn in the
                Backdrop mode; an empty layer otherwise. */}
            <SceneCover />
            {/* The window beating with that visualizer, when its mode asks
                for it; nothing in the page otherwise. */}
            <ScenePulse />
            {/* That visualizer's own elements — birds, petals, stars — faintly
                over the window in the same mode; nothing in the page otherwise. */}
            <SceneAmbient />
            {/* Counts listening while music plays. Renders nothing, sends
                nothing anywhere unless the person joined the leaderboard. */}
            <UsageMeter />
            {/* Dynamic lighting's loop: renders nothing, and lights nothing
                unless a Plus member switched it on. */}
            <DynamicLightingLoop />
            {/* Which song the players say is playing, so the songs kept for
                the member's AI are told apart. Renders nothing. */}
            <HeardSongNames />
            {/* The desktop background's music, read for its monitors while
                any plays; what every visualizer is set to, for the monitors
                showing one; the graph's own, for the monitors following it;
                and its dialogs, which outlive the menus that open them. */}
            <WallpaperAudio />
            <WallpaperTuning />
            <WallpaperGraphLook />
            <WallpaperDialogHost />
            {/* A genre's notes, for the same reason: two of the places that
                open them are menus, which close when pressed. */}
            <GenreNotesHost />
            {/* No router: the window has one page and moves between its
                places with state (`activeWorkspaceTab`). A MemoryRouter with
                a single route stood here, and its package shipped in the
                window's script for it. */}
            <AppContent />
          </RemoteAudioProvider>
        </LiveAudioProvider>
      </FluidEqProvider>
    </I18nProvider>
  );
}
