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

import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import { ErrorCode, ErrorDescription } from 'common/errors';
import { SUPPORT_CONTRIBUTED_KEY } from 'common/support';
import {
  LATEST_RELEASE_URL,
  PRODUCT_NAME,
  PRODUCT_VERSION,
} from 'common/branding';
import { resetRhythmRun } from './utils/rhythmRun';
import ConfigInspector from './components/ConfigInspector';
import { resetEuphoriaMode } from './utils/euphoriaMode';
import './styles/App.scss';
import MainContent from './MainContent';
import SmartEqEngine from './SmartEqEngine';
import SupportDialog from './SupportDialog';
import SupportPet from './SupportPet';
import { FluidEqProvider, useFluidEqContext } from './utils/FluidEqContext';
import PrereqMissingModal from './PrereqMissingModal';
import BugReportDialog from './components/BugReportDialog';
import AudioTroubleshooter from './components/AudioTroubleshooter';
import SideBar from './SideBar';
import {
  onWindowFullScreenChange,
  toggleFullScreenTopBar,
  useGraphFullScreen,
  useGraphView,
  useFullScreenTopBar,
} from './utils/graphStyle';
import { useIsChromeIdle, watchChromeIdle } from './utils/idleChrome';
import { reportError } from './utils/logger';
import VideoBrowser from './video/VideoBrowser';
import { albumKey } from '../common/library/grouping';
import { ILibraryTrack } from '../common/library/types';
import LibraryWorkspace from './library/LibraryWorkspace';
import { LibraryProvider } from './library/LibraryContext';
import {
  LibraryPlayerProvider,
  useLibraryPlayer,
} from './library/player/LibraryPlayerContext';
import NowPlayingBar from './library/player/NowPlayingBar';
import SourceTransportBar from './library/player/SourceTransportBar';
import type { TPlaybackOwner } from './audio/playbackOwner';
import { useTransportSource } from './audio/transportSource';
import KaraokeWorkspace from './karaoke/KaraokeWorkspace';
import PaneResizer from './components/PaneResizer';
import {
  clampToWindow,
  commitPaneSizes,
  getEditorHeight,
  setEditorHeight,
  useEditorHeight,
} from './utils/paneSizes';
import FrequencyResponseChart from './graph/FrequencyResponseChart';
import PresetsBar from './PresetsBar';
import EqPresetsPanel from './EqPresetsPanel';
import DeviceProfiles from './DeviceProfiles';
import ExtraOutputs from './ExtraOutputs';
import DriverPicker from './components/DriverPicker';
import WaveformVisualizer from './WaveformVisualizer';
import ConvolutionPanel from './ConvolutionPanel';
import VoicingPanel from './VoicingPanel';
import MenuIcon from './icons/MenuIcon';
import LanguagePicker from './components/LanguagePicker';
import UpdateNotice from './components/UpdateNotice';
import SpeechMemoryNotice from './components/SpeechMemoryNotice';
import MandatoryUpdateModal from './components/MandatoryUpdateModal';
import DisclaimerGate from './components/DisclaimerGate';
import WhatsNewDialog from './components/WhatsNewDialog';
import AboutDialog from './components/AboutDialog';
import BrandMark from './icons/BrandMark';
import { I18nProvider, useTranslation } from './utils/I18nContext';
import {
  LiveAudioProvider,
  useLiveAudioControl,
} from './audio/LiveAudioContext';
import EuphoriaGlow from './components/EuphoriaGlow';
import {
  deletePreset,
  getPresetListFromFiles,
  importConvolutionFile,
  importEqFile,
  loadPreset,
  renamePreset,
  savePreset,
} from './utils/equalizerApi';
import { startEqualizerApoInstall } from './utils/apoInstall';

const APO_RESTART_RECOMMENDED_KEY = 'fluideq.apoRestartRecommended';
/** The version whose notes have already been shown. */
const WHATS_NEW_SEEN_KEY = 'fluideq.whatsNewSeen';

/**
 * Shipped build version, substituted by webpack at compile time. Empty in any
 * context that does not go through the bundler (a bare unit-test import), so
 * the badge is rendered conditionally rather than showing "vundefined".
 *
 * Defined once in `common/branding`, alongside the name it sits next to.
 */
const APP_VERSION = PRODUCT_VERSION;

/** The workspace tab the app was left on. */
const WORKSPACE_TAB_KEY = 'fluideq.workspaceTab';
/** Independent response-graph visibility overrides for each workspace tab. */
const GRAPH_VISIBILITY_BY_TAB_KEY = 'fluideq.graphVisibilityByTab';

type TWorkspaceTab =
  | 'eq'
  | 'presets'
  | 'voicing'
  | 'convolution'
  | 'video'
  | 'library'
  | 'karaoke'
  | 'config';

/**
 * Tab names this build no longer uses, and what they became.
 *
 * Both of the things remembered about a tab — which one you were on, and
 * whether its graph was showing — are keyed by name, so a rename is a silent
 * data loss unless the old name still resolves. `autoeq` became `presets` when
 * the library behind it stopped being AutoEq's.
 */
const LEGACY_WORKSPACE_TABS: Record<string, TWorkspaceTab> = {
  autoeq: 'presets',
};

/**
 * The tab strip, in the order it is drawn.
 *
 * Config last, and deliberately at the end rather than beside the panels that
 * change the sound. It is the only one that changes nothing — it reports what
 * is on disk — so it is where you go when something is wrong, not somewhere you
 * pass through on the way to a tuning.
 *
 * Reordering this list is safe because what is persisted is the tab's name and
 * not its position: `readWorkspaceTab` looks the stored string up here, so a
 * tab that moves takes its remembered state with it. An index would have sent
 * everybody who left the app on Config to a different tab on the next launch.
 */
const WORKSPACE_TABS: TWorkspaceTab[] = [
  'eq',
  'presets',
  'voicing',
  'convolution',
  'video',
  'library',
  'karaoke',
  'config',
];

/** A stored tab name, under whatever name that tab had when it was written. */
const resolveWorkspaceTab = (stored: unknown): TWorkspaceTab | undefined =>
  typeof stored === 'string'
    ? (WORKSPACE_TABS.find((tab) => tab === stored) ??
      LEGACY_WORKSPACE_TABS[stored])
    : undefined;

type TWorkspaceGraphVisibility = Partial<Record<TWorkspaceTab, boolean>>;

const readWorkspaceGraphVisibility = ():
  TWorkspaceGraphVisibility | undefined => {
  try {
    const stored = window.localStorage.getItem(GRAPH_VISIBILITY_BY_TAB_KEY);
    if (!stored) {
      return undefined;
    }
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    const visibility: TWorkspaceGraphVisibility = {};
    // Retired names first and current names second, so that if a profile holds
    // both, what was written under today's name wins regardless of key order.
    Object.entries(LEGACY_WORKSPACE_TABS).forEach(([legacy, tab]) => {
      if (typeof parsed?.[legacy] === 'boolean') {
        visibility[tab] = parsed[legacy] as boolean;
      }
    });
    WORKSPACE_TABS.forEach((tab) => {
      if (typeof parsed?.[tab] === 'boolean') {
        visibility[tab] = parsed[tab] as boolean;
      }
    });
    return Object.keys(visibility).length ? visibility : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Which tab to open on.
 *
 * Remembered, which is a departure from the rule the graph's modes follow —
 * solo and full screen are deliberately forgotten, because a mode that outlives
 * a restart is how somebody ends up convinced their bands have vanished. A tab
 * is not that: every one of them is visibly a tab, the one you are on is named
 * in the row, and getting back is one click that is already on screen.
 *
 * And the Video tab is the reason it is worth doing. Something is playing in
 * it. Dropping back to the EQ on every reload stops what was being listened to
 * and puts the app on the pane that was not being used — during development,
 * where a reload happens on every save, that is most of them.
 *
 * Validated against the list rather than cast, because this is storage a user
 * can edit and an older build may have written a name this one no longer has.
 */
const readWorkspaceTab = (): TWorkspaceTab => {
  try {
    const stored = window.localStorage.getItem(WORKSPACE_TAB_KEY);
    return resolveWorkspaceTab(stored) ?? 'eq';
  } catch {
    // Storage can be unavailable, and the EQ is the right place to land.
    return 'eq';
  }
};

/**
 * The one place `NowPlayingBar` is wired to something real.
 *
 * `NowPlayingBar` itself stays a pure, prop-driven view — see its own doc
 * comment — so this is the seam: read `LibraryPlayerContext`, hand its values
 * down as props. Shuffle and repeat are exposed as toggles rather than
 * setters (`onShuffle`/`onRepeat`, not `onSetShuffle`), matching every other
 * button on the bar, so the flip from the current value to the next one
 * happens here rather than inside the view.
 */
/**
 * Which tab each transport source belongs to.
 *
 * The bar follows the tab being looked at, so a source only takes it over on
 * its own ground: the karaoke session drives it on the Karaoke tab, the Media
 * page on the Media tab, and everywhere else — the EQ, Voicing, Config — the
 * library keeps it. That last part is the important half. A bar that showed
 * whatever tab you happened to open would take the controls for the music
 * that is playing away the moment you went to adjust the sound it is playing
 * through, which is the one time you are most likely to want them.
 */
const TRANSPORT_TAB: Record<TPlaybackOwner, TWorkspaceTab> = {
  library: 'library',
  karaoke: 'karaoke',
  media: 'video',
};

const ConnectedNowPlayingBar = ({
  activeTab,
  onReveal,
}: {
  activeTab: TWorkspaceTab;
  onReveal: (track: ILibraryTrack) => void;
}) => {
  const player = useLibraryPlayer();
  const source = useTransportSource();
  const { track } = player;
  if (
    source &&
    source.owner !== 'library' &&
    TRANSPORT_TAB[source.owner] === activeTab
  ) {
    return <SourceTransportBar source={source} />;
  }
  return (
    <NowPlayingBar
      track={player.track}
      isPlaying={player.isPlaying}
      positionMs={player.positionMs}
      durationMs={player.durationMs}
      repeat={player.repeat}
      isShuffled={player.isShuffled}
      volume={player.volume}
      isUnplayable={player.isUnplayable}
      onToggle={player.toggle}
      onSkip={player.skip}
      onStop={player.stop}
      onSeek={player.seek}
      onShuffle={() => player.setShuffle(!player.isShuffled)}
      onRepeat={player.cycleRepeat}
      onVolume={player.setVolume}
      onReveal={track ? () => onReveal(track) : undefined}
    />
  );
};

const AppContent = () => {
  const {
    isLoading,
    globalError,
    isBlockingError,
    isEngineUsable,
    isGraphViewOn,
    performHealthCheck,
    refreshState,
    setGlobalError,
  } = useFluidEqContext();
  const { t } = useTranslation();
  // The sound panel drawer, meaningful only under the three-column breakpoint.
  const [rightPaneOpen, setRightPaneOpen] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<TWorkspaceTab>(readWorkspaceTab);
  const [graphVisibilityByTab, setGraphVisibilityByTab] = useState<
    TWorkspaceGraphVisibility | undefined
  >(readWorkspaceGraphVisibility);
  const isVideoTab = activeWorkspaceTab === 'video';
  const isLibraryTab = activeWorkspaceTab === 'library';
  const isKaraokeTab = activeWorkspaceTab === 'karaoke';
  const [isKaraokeFullScreen, setIsKaraokeFullScreen] = useState(false);
  const karaokeFullScreenRequestedRef = useRef(false);
  const [showAudioRestartRecommendation, setShowAudioRestartRecommendation] =
    useState(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const [showAudioToolsMenu, setShowAudioToolsMenu] = useState(false);
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  // What the last import did. Reported the same way as a recoverable failure —
  // in the corner, dismissable — rather than as a modal alert, because there
  // is nothing to decide and the result is already audible.
  const [importNotice, setImportNotice] = useState('');
  // Shown once per version, automatically. Someone who just updated wants to
  // know what changed; someone opening the app for the fifth time today does
  // not, so the version they last saw is remembered.
  // Opened from the actions menu. Nothing is gathered until it is on screen,
  // so an app nobody is reporting a problem with never reads its own logs.
  const [showBugReport, setShowBugReport] = useState(false);
  // Licence, attribution, trademark and what else is bundled. Opened, never
  // automatic — but reachable, which is the whole point of it existing.
  const [showAbout, setShowAbout] = useState(false);
  const [showTroubleshooter, setShowTroubleshooter] = useState(false);
  // Bumping this remounts the prerequisite notice, which is how a dismissed
  // one comes back. Without it the notice was a one-shot: close it once and
  // the only route to "Install Equalizer APO" was gone until the error
  // changed, which for a missing engine it never does.
  const [prereqNonce, setPrereqNonce] = useState(0);
  // Null when closed, otherwise how much of the changelog to show. The dialog
  // that opens itself after an update answers "what changed in the version I
  // just got"; the one somebody opens from a menu is a request to read, and
  // gets the history. Same dialog, two questions.
  const [whatsNewScope, setWhatsNewScope] = useState<'latest' | 'all' | null>(
    () =>
      !!APP_VERSION && localStorage.getItem(WHATS_NEW_SEEN_KEY) !== APP_VERSION
        ? 'latest'
        : null,
  );
  // Set from inside the graph pane; read here because the elements that have
  // to get out of the way are not the graph's — the EQ panel is its sibling,
  // and the side panels and titlebar are further out still.
  const isGraphFullScreen = useGraphFullScreen();
  const graphView = useGraphView();
  // Each workspace owns this choice. Karaoke starts without the response graph
  // because its stage and pitch lane need the height; Library starts without
  // it because the tab is a surface for looking at album art, not at a
  // spectrum; every other workspace inherits the legacy graph preference until
  // the user chooses differently.
  // Library and Karaoke both start closed and stay togglable. Forcing Library
  // closed outright was tried and taken back out: it did remove the graph's
  // toolbar from a tab that has no use for it by default, but it also removed
  // the choice, and the switch in the sidebar then did nothing on that one tab
  // — a control that visibly does nothing being worse than the row it saved.
  const showsGraph =
    graphVisibilityByTab?.[activeWorkspaceTab] ??
    (activeWorkspaceTab === 'karaoke' || activeWorkspaceTab === 'library'
      ? false
      : isGraphViewOn);
  const setActiveTabGraphVisibility = useCallback(
    (next: boolean) => {
      setGraphVisibilityByTab((current) => ({
        ...current,
        [activeWorkspaceTab]: next,
      }));
    },
    [activeWorkspaceTab],
  );
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
  /** The window itself is full screen, so the titlebar is not on screen. */
  const isGraphAppFullScreen =
    graphView === 'fullscreen' && showsGraph && !isKaraokeFullScreen;
  // Full screen with the top bar kept. Everything below reads this rather than
  // the mode alone, so "full screen" and "full screen with the bar" cannot end
  // up disagreeing about which pieces are on screen.
  const hasFullScreenTopBar = useFullScreenTopBar();
  const isChromeHidden =
    (isGraphAppFullScreen || isKaraokeFullScreen) && !hasFullScreenTopBar;
  const editorHeight = useEditorHeight(activeWorkspaceTab);

  // Watched only in full screen, and stopped on the way out — see the store for
  // why leaving it running would strand a faded workspace.
  const isChromeIdle = useIsChromeIdle();
  useEffect(() => {
    // Every mode the graph is drawn in, not only the ones that fill the screen.
    //
    // This started as a full-screen behaviour on the theory that a toolbar only
    // gets in the way once the picture is the whole window. It gets in the way
    // in the ordinary view too: the strip lies over the top of the plot, which
    // is where the peaks go, and the controls on it are ones you reach for
    // occasionally and then look past for minutes at a time.
    //
    // Tied to visible auto-hiding chrome: the graph in any view, or Karaoke's
    // centre dock while its stage owns the full screen. With neither rendered
    // there is no listener on the window watching activity for nothing.
    watchChromeIdle(showsGraph || isKaraokeFullScreen);
    return () => watchChromeIdle(false);
  }, [isKaraokeFullScreen, showsGraph]);

  /**
   * Take the window fullscreen when the graph asks for it.
   *
   * Registered here rather than done in the store, because it is an IPC call
   * and a layout preference should not have to know the shape of the app's API
   * to hold a value. The store says *what* it wants; this says how.
   */
  useEffect(() => {
    onWindowFullScreenChange((next) => {
      window.electron.ipcRenderer.setWindowFullScreen(next).catch((e) => {
        reportError('Could not change the window to full screen', e);
      });
    });
    return () => onWindowFullScreenChange(() => undefined);
  }, []);

  const applyKaraokeFullScreen = useCallback(async (next: boolean) => {
    karaokeFullScreenRequestedRef.current = next;
    setIsKaraokeFullScreen(next);
    try {
      const applied =
        await window.electron.ipcRenderer.setWindowFullScreen(next);
      karaokeFullScreenRequestedRef.current = next && applied;
      setIsKaraokeFullScreen(next && applied);
    } catch (error) {
      karaokeFullScreenRequestedRef.current = false;
      setIsKaraokeFullScreen(false);
      reportError('Could not change Karaoke full screen', error);
    }
  }, []);

  // Karaoke owns Ctrl+F while its tab is active. The response graph also has
  // that shortcut, so this listener runs in capture and stops the event before
  // the graph can turn itself into the full-screen surface instead.
  useEffect(() => {
    if (!isKaraokeTab) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const wantsToggle =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.repeat &&
        event.key.toLowerCase() === 'f';
      const wantsExit = event.key === 'Escape' && isKaraokeFullScreen;
      if (!wantsToggle && !wantsExit) {
        return;
      }
      if (
        wantsExit &&
        (document.querySelector(
          '[role="dialog"]:not(.karaoke-maker), .dropdown--open',
        ) ||
          (event.target as HTMLElement | null)?.closest?.(
            'input, textarea, [contenteditable]',
          ))
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      applyKaraokeFullScreen(wantsExit ? false : !isKaraokeFullScreen);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [applyKaraokeFullScreen, isKaraokeFullScreen, isKaraokeTab]);

  useEffect(() => {
    if (!isKaraokeTab && isKaraokeFullScreen) {
      applyKaraokeFullScreen(false);
    }
  }, [applyKaraokeFullScreen, isKaraokeFullScreen, isKaraokeTab]);

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
  // The player is mounted on first visit and never unmounted, because its page
  // is destroyed the moment the element leaves the DOM — switching to the EQ
  // to move a band would otherwise stop whatever was playing. Until somebody
  // opens the tab, though, there is no reason to have a browser engine running
  // at all, so it does not exist.
  const [hasOpenedVideo, setHasOpenedVideo] = useState(false);
  // Library follows the same lifetime rule: a scan started on this tab must
  // not be abandoned by switching away from it.
  const [hasOpenedLibrary, setHasOpenedLibrary] = useState(false);
  // What the now-playing bar asked the Library to show. The nonce is what
  // makes pressing it twice for the same album work: an id alone would look
  // unchanged after the user had navigated away, and do nothing.
  const [libraryReveal, setLibraryReveal] = useState<
    { albumId: string; trackId: string; nonce: number } | undefined
  >(undefined);
  /** Opening the album was only half of "show me what is playing": it landed
   * the reader on the right page and left them to find the row, which on a
   * forty-track compilation is no answer at all. The track id travels with
   * the album so the list can scroll to that row and mark it. */
  const revealPlayingTrack = useCallback((track: ILibraryTrack) => {
    setActiveWorkspaceTab('library');
    setLibraryReveal((current) => ({
      albumId: albumKey(track),
      trackId: track.id,
      nonce: (current?.nonce ?? 0) + 1,
    }));
  }, []);
  // Karaoke follows the same lifetime rule. Once audio and microphone capture
  // land here, leaving the tab must not tear either pipeline down.
  const [hasOpenedKaraoke, setHasOpenedKaraoke] = useState(false);

  // The editor's height when the drag began, so every move is measured from one
  // fixed point rather than accumulated.
  const graphDragStart = useRef(0);
  // Read by the player, which has to stop swallowing pointer events for the
  // length of a drag — see VideoBrowser.scss.
  const [isResizingPanes, setIsResizingPanes] = useState(false);

  const handleGraphResizeStart = useCallback(() => {
    graphDragStart.current = getEditorHeight(activeWorkspaceTab);
    setIsResizingPanes(true);
  }, [activeWorkspaceTab]);

  /**
   * Move the divider.
   *
   * What is set is the pane *above* it — the graph below simply takes what is
   * left. Dragging down gives the editor more and the graph less, which is the
   * direction the handle is being carried, and both ends of the drag stay live
   * because the pane being sized is the one whose content can actually vary.
   */
  const handleGraphResizeDrag = useCallback(
    (deltaY: number) => {
      setEditorHeight(
        clampToWindow(graphDragStart.current + deltaY),
        activeWorkspaceTab,
      );
    },
    [activeWorkspaceTab],
  );

  const handleGraphResizeEnd = useCallback(() => {
    setIsResizingPanes(false);
    commitPaneSizes();
  }, []);

  // How much of the workspace the editor currently has, as a percentage. Only
  // for the divider's `aria-valuenow` — a pixel height means nothing read out
  // loud without also knowing how tall the window is.
  const graphHeightPercent = Math.round(
    (editorHeight / Math.max(1, window.innerHeight)) * 100,
  );
  const [hasContributed, setHasContributed] = useState(
    () => localStorage.getItem(SUPPORT_CONTRIBUTED_KEY) === 'true',
  );

  useEffect(() => {
    if (!isVideoTab) {
      return undefined;
    }

    setHasOpenedVideo(true);
    return undefined;
  }, [isVideoTab]);

  useEffect(() => {
    if (!isLibraryTab) {
      return undefined;
    }

    setHasOpenedLibrary(true);
    return undefined;
  }, [isLibraryTab]);

  useEffect(() => {
    if (!isKaraokeTab) {
      return undefined;
    }

    setHasOpenedKaraoke(true);
    return undefined;
  }, [isKaraokeTab]);

  // Written on every change rather than on the way out, because there is no
  // reliable way out: a development reload, a crash and a quit all end the
  // renderer without warning, and the reload is the one this exists for.
  useEffect(() => {
    try {
      window.localStorage.setItem(WORKSPACE_TAB_KEY, activeWorkspaceTab);
    } catch {
      // Not worth failing a tab change over.
    }
  }, [activeWorkspaceTab]);

  useEffect(() => {
    if (!graphVisibilityByTab) {
      return;
    }
    try {
      window.localStorage.setItem(
        GRAPH_VISIBILITY_BY_TAB_KEY,
        JSON.stringify(graphVisibilityByTab),
      );
    } catch {
      // A private/locked storage area must not break the live layout.
    }
  }, [graphVisibilityByTab]);

  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.toggle('minimized', !showsGraph);
    return () => root?.classList.remove('minimized');
  }, [showsGraph]);

  useEffect(() => {
    let mounted = true;

    window.electron.ipcRenderer
      .isWindowMaximized()
      .then((maximized) => {
        if (mounted) {
          setIsWindowMaximized(maximized);
        }
        return undefined;
      })
      .catch(() => {
        // The window state is only visual; keep the restore control usable if
        // the main process is not ready during a hot reload.
      });

    const unsubscribe = window.electron.ipcRenderer.on(
      'window-state-changed',
      (...args: unknown[]) => {
        const state = args[0] as
          { isMaximized?: boolean; isFullScreen?: boolean } | undefined;
        setIsWindowMaximized(Boolean(state?.isMaximized));
        if (
          state?.isFullScreen === false &&
          karaokeFullScreenRequestedRef.current
        ) {
          karaokeFullScreenRequestedRef.current = false;
          setIsKaraokeFullScreen(false);
        }
      },
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!showAudioToolsMenu) {
      return undefined;
    }

    const closeMenu = (event: Event) => {
      const target = event.target as HTMLElement;
      // The language list is portalled to document.body so it can escape the
      // titlebar menu without being clipped. It still belongs to this menu:
      // closing the parent on the option's pointerdown unmounts the picker
      // before List can deliver its click and the locale never changes.
      if (!target.closest('.workspace-header__tools, .language-picker-menu')) {
        setShowAudioToolsMenu(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAudioToolsMenu(false);
      }
    };

    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showAudioToolsMenu]);

  useEffect(() => {
    if (globalError?.code === ErrorCode.EQUALIZER_APO_NOT_INSTALLED) {
      localStorage.setItem(APO_RESTART_RECOMMENDED_KEY, 'true');
      return;
    }

    if (
      !isLoading &&
      !globalError &&
      localStorage.getItem(APO_RESTART_RECOMMENDED_KEY) === 'true'
    ) {
      setShowAudioRestartRecommendation(true);
    }
  }, [globalError, isLoading]);

  const handleConfigureEqualizerApo = async () => {
    const error =
      await window.electron.ipcRenderer.openEqualizerApoConfigurator();
    if (error) {
      window.alert(error);
      return;
    }
    localStorage.setItem(APO_RESTART_RECOMMENDED_KEY, 'true');
    setShowAudioRestartRecommendation(true);
  };

  /**
   * Run Equalizer APO's installer again, over the top of itself.
   *
   * Its setup is a repair as much as an install: it re-registers the APO and
   * reopens the Device Selector, which is what fixes an endpoint Windows has
   * detached it from. The bundled copy is still in the install directory, so
   * nothing is downloaded.
   */
  const handleReinstallApo = async () => {
    // Asked first, and the label's ellipsis is a promise that it will be.
    //
    // This raises a Windows permission prompt, reinstalls the component that
    // processes all of the machine's audio, and needs a restart afterwards.
    // None of that should happen because somebody was reading the menu with a
    // mouse in their hand.
    const confirmed = window.confirm(
      'Reinstall Equalizer APO?\n\n' +
        'Its setup will open so you can re-select which audio devices to ' +
        'equalise. Windows will ask for administrator permission, and your ' +
        'computer will need to restart afterwards.\n\n' +
        `Your ${PRODUCT_NAME} settings and profiles are not affected.`,
    );
    if (!confirmed) {
      return;
    }
    const outcome = await startEqualizerApoInstall();

    if (outcome === 'bundle-missing') {
      // The download page is already opening. Saying so beats the generic
      // error banner this used to raise, which showed the literal sentinel
      // `apo-bundle-missing` over "Please restart the application" — no
      // download, and nothing anybody could act on.
      window.alert(
        `This copy of ${PRODUCT_NAME} has no Equalizer APO installer inside it.\n\n` +
          "Opening Equalizer APO's own download page instead. Install it from " +
          `there and ${PRODUCT_NAME} will find it.`,
      );
      return;
    }

    if (outcome === 'not-started') {
      window.alert(
        'Equalizer APO did not start.\n\n' +
          'It needs administrator permission — try again and approve the ' +
          'Windows prompt.',
      );
      return;
    }

    // Same as reconfiguring, and more certainly so: a reinstalled APO is not
    // in the audio chain until the endpoints are rebuilt. Reconfigure has
    // always said this; a reinstall staying silent about it would leave
    // somebody deciding the repair had not worked.
    localStorage.setItem(APO_RESTART_RECOMMENDED_KEY, 'true');
    setShowAudioRestartRecommendation(true);
  };

  const handleOpenEqualizerApoSettings = async () => {
    const error = await window.electron.ipcRenderer.openEqualizerApoSettings();
    if (error) {
      window.alert(error);
    }
  };

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
      setImportNotice(summary);
      await refreshState();
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  const handleImportEq = () => runImport(importEqFile);
  const handleImportConvolution = () => runImport(importConvolutionFile);

  const handleRestartWindowsAudio = async () => {
    if (!window.confirm(t('notice.restartConfirm'))) {
      return;
    }

    const error = await window.electron.ipcRenderer.restartWindowsAudio();
    window.alert(error || t('notice.restartDone'));
    if (!error) {
      localStorage.removeItem(APO_RESTART_RECOMMENDED_KEY);
      setShowAudioRestartRecommendation(false);
      performHealthCheck();
    }
  };

  const dismissAudioRestartRecommendation = () => {
    localStorage.removeItem(APO_RESTART_RECOMMENDED_KEY);
    setShowAudioRestartRecommendation(false);
  };

  const handleMinimizeWindow = () => {
    window.electron.ipcRenderer.minimizeWindow().catch(() => undefined);
  };

  const handleToggleMaximizeWindow = async () => {
    const maximized = await window.electron.ipcRenderer.toggleMaximizeWindow();
    setIsWindowMaximized(maximized);
  };

  const handleCloseWindow = () => {
    window.electron.ipcRenderer.closeWindow().catch(() => undefined);
  };

  /**
   * Whether the transport buttons are drawn at all.
   *
   * They press Windows virtual keys, and there is no equivalent anywhere else —
   * so on macOS or Linux they would be three controls that look like every
   * other control and do nothing when pressed. Not rendering them is the honest
   * version of that. The main process refuses the same way, independently.
   */
  const handleTitlebarDoubleClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea')) {
      return;
    }
    handleToggleMaximizeWindow().catch(() => undefined);
  };

  let connectionStatus = t('app.status.ready');
  if (isLoading) {
    connectionStatus = t('app.status.checking');
  } else if (isBlockingError) {
    connectionStatus = t('app.status.error');
  }

  return (
    <>
      <header
        className="workspace-header window-titlebar"
        onDoubleClick={handleTitlebarDoubleClick}
      >
        {/* The three direct grid children keep the waveform optically centred.
            Identity stays in the left track; pet, transport, actions and window
            controls share one ordered cluster in the right track. */}
        <div className="window-titlebar__left">
          <div className="workspace-header__identity">
            <BrandMark />
            {/* Named, because a narrow window hides this and leaves the mark
                alone — see `.workspace-header__identity-text`. */}
            <div className="workspace-header__identity-text">
              <div className="workspace-header__name">
                {PRODUCT_NAME}
                {/* Inlined at build time from the same package.json
                    electron-builder versions the installer with, so a bug
                    report quoting this is quoting the real build. */}
                {APP_VERSION && (
                  <span className="workspace-header__version">
                    v{APP_VERSION}
                  </span>
                )}
              </div>
              <div className="workspace-header__tagline">
                {t('app.tagline')}
              </div>
            </div>
          </div>
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
        <WaveformVisualizer />
        <div className="window-titlebar__right">
          {!isChromeHidden && (
            <SupportPet
              hasContributed={hasContributed}
              onOpen={() => setShowSupportDialog(true)}
            />
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
          <div className="workspace-header__tools">
            <button
              type="button"
              className="workspace-header__tools-trigger"
              aria-label={t('app.actions')}
              aria-expanded={showAudioToolsMenu}
              title={t('app.actions.title')}
              onClick={() => setShowAudioToolsMenu((current) => !current)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12h3l2-6 4 12 2-6h5" />
              </svg>
              <span
                className={`status-dot${isBlockingError ? ' error' : ''}`}
              />
            </button>
            {showAudioToolsMenu && (
              <div className="workspace-header__menu" role="menu">
                {/* A status line that says something is wrong and offers no
                    way to act on it is a dead end. When it is reporting a real
                    fault it becomes the way back to the notice that carries
                    the Install and Retry buttons — which is otherwise
                    unreachable once dismissed. */}
                {isBlockingError ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="workspace-header__menu-status is-actionable"
                    onClick={() => {
                      setShowAudioToolsMenu(false);
                      setPrereqNonce((n) => n + 1);
                    }}
                  >
                    <span className="status-dot error" />
                    <span>{connectionStatus}</span>
                    <span className="workspace-header__menu-status-hint">
                      {t('app.menu.fix')}
                    </span>
                  </button>
                ) : (
                  <div className="workspace-header__menu-status">
                    <span className="status-dot" />
                    <span>{connectionStatus}</span>
                  </div>
                )}
                {!isLoading && !isBlockingError && (
                  <>
                    {/* Two columns, split by what each thing belongs to.
                       
                        The menu had grown to nine unlabelled rows in one
                        stack — everything from importing a WAV to reinstalling
                        the audio engine, in the order each had been added. Two
                        of them said "Equalizer APO" and two more were about it
                        without saying so, which is the state where people stop
                        reading a menu and start hunting through it.
                       
                        Split by owner rather than by frequency, because that
                        is the distinction that actually predicts where
                        somebody will look: is this about FluidEQ, or about the
                        engine underneath it? Within each column a rule
                        separates doing something from fixing something. */}
                    <div className="workspace-header__menu-columns">
                      <div className="workspace-header__menu-column">
                        <p className="workspace-header__menu-heading">
                          {PRODUCT_NAME}
                        </p>
                        {/* Bringing your own files in belongs at the top: it
                            is the only thing here that changes what you
                            hear. */}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowAudioToolsMenu(false);
                            handleImportEq();
                          }}
                        >
                          <MenuIcon name="import" />
                          {t('app.menu.importEq')}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowAudioToolsMenu(false);
                            handleImportConvolution();
                          }}
                        >
                          <MenuIcon name="waveform" />
                          {t('app.menu.importConvolution')}
                        </button>

                        <hr className="workspace-header__menu-rule" />

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowAudioToolsMenu(false);
                            setWhatsNewScope('all');
                          }}
                        >
                          <MenuIcon name="info" />
                          {t('app.menu.whatsNew')}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowAudioToolsMenu(false);
                            setShowBugReport(true);
                          }}
                        >
                          <MenuIcon name="info" />
                          {t('app.menu.reportProblem')}
                        </button>
                        {/* Beside the release notes rather than at the bottom
                            of the column: both answer "what is this copy of
                            the app", and the licence should not read as a
                            footnote to reinstalling. */}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowAudioToolsMenu(false);
                            setShowAbout(true);
                          }}
                        >
                          <MenuIcon name="info" />
                          {t('app.menu.about', { product: PRODUCT_NAME })}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowAudioToolsMenu(false);
                            window.open(
                              LATEST_RELEASE_URL,
                              '_blank',
                              'noopener',
                            );
                          }}
                        >
                          <MenuIcon name="restart" />
                          {t('app.menu.reinstallApp', {
                            product: PRODUCT_NAME,
                          })}
                        </button>
                      </div>

                      <div className="workspace-header__menu-column">
                        <p className="workspace-header__menu-heading">
                          Equalizer APO
                        </p>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowAudioToolsMenu(false);
                            handleConfigureEqualizerApo();
                          }}
                        >
                          <MenuIcon name="configure" />
                          {t('app.menu.reconfigure')}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowAudioToolsMenu(false);
                            handleOpenEqualizerApoSettings();
                          }}
                        >
                          <MenuIcon name="settings" />
                          {t('app.menu.apoSettings')}
                        </button>

                        <hr className="workspace-header__menu-rule" />

                        {/* First, above the individual repairs, because it is
                            the one to open when you do not already know which
                            of them you need — which is everybody whose audio
                            has just stopped. The three below are the same
                            actions, for anyone who does know. */}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowAudioToolsMenu(false);
                            setShowTroubleshooter(true);
                          }}
                        >
                          <MenuIcon name="configure" />
                          {t('app.menu.fixAudio')}
                        </button>

                        {/* Repairing, rather than configuring. APO can be
                            installed and still not working — a Windows update
                            can detach it from an endpoint. Reconfigure covers
                            a device that was never ticked; this covers one it
                            has lost. */}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowAudioToolsMenu(false);
                            handleRestartWindowsAudio();
                          }}
                        >
                          <MenuIcon name="restart" />
                          {t('app.menu.restartAudio')}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowAudioToolsMenu(false);
                            handleReinstallApo();
                          }}
                        >
                          <MenuIcon name="settings" />
                          {t('app.menu.reinstallApo')}
                        </button>
                      </div>
                    </div>
                  </>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className="workspace-header__menu-support"
                  onClick={() => {
                    setShowAudioToolsMenu(false);
                    setShowSupportDialog(true);
                  }}
                >
                  <MenuIcon name="support" />
                  {t('app.menu.support')}
                </button>
                {/* Last, and always available: someone who cannot read the
                    rest of this menu needs to be able to reach it. */}
                <LanguagePicker />
              </div>
            )}
          </div>
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
            <button
              type="button"
              className="window-control"
              aria-label={
                isWindowMaximized
                  ? t('app.window.restoreApp')
                  : t('app.window.maximizeApp')
              }
              title={
                isWindowMaximized
                  ? t('app.window.restore')
                  : t('app.window.maximize')
              }
              onClick={() =>
                handleToggleMaximizeWindow().catch(() => undefined)
              }
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                {isWindowMaximized ? (
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
        </div>
      </header>
      <main
        className={`app-workspace${
          isGraphAppFullScreen || isKaraokeFullScreen ? ' is-app-full' : ''
        }${
          (isGraphAppFullScreen || isKaraokeFullScreen) && hasFullScreenTopBar
            ? ' has-top-bar'
            : ''
        }${isKaraokeFullScreen ? ' is-karaoke-full' : ''}`}
      >
        {showAudioRestartRecommendation && (
          <aside className="audio-restart-notice" role="status">
            <span>{t('notice.apoReconfigured')}</span>
            <div className="audio-restart-notice__actions">
              <button type="button" onClick={handleRestartWindowsAudio}>
                {t('notice.restartNow')}
              </button>
              <button type="button" onClick={dismissAudioRestartRecommendation}>
                {t('app.dismiss')}
              </button>
            </div>
          </aside>
        )}
        {/* Same shape as the restart notice above: what happened, and the
            one thing worth trying. Windows refuses the loopback capture for
            transient reasons — a device changing mid-start, a prompt
            dismissed — and a second attempt very often works, so there is
            something better to offer than an apology. */}
        {captureError && !isCaptureNoticeHidden && (
          <aside className="audio-restart-notice" role="status">
            <span>
              The live meter and the output curve could not start. Everything
              else works normally.
            </span>
            <div className="audio-restart-notice__actions">
              <button
                type="button"
                onClick={() => {
                  retryCapture();
                }}
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => setIsCaptureNoticeHidden(true)}
              >
                {t('app.dismiss')}
              </button>
            </div>
          </aside>
        )}
        <SideBar
          showGraphToggle
          isGraphVisible={showsGraph}
          onGraphVisibilityChange={setActiveTabGraphVisibility}
        />
        <div
          className={`center-workspace${
            isGraphFullScreen && showsGraph && !isKaraokeFullScreen
              ? ' is-graph-full'
              : ''
          }${isResizingPanes ? ' is-resizing' : ''}`}
        >
          <div
            className="middle-content"
            // What the divider actually sets: the height of everything above
            // the graph, on every tab. It used to be a ceiling on the EQ tab so
            // the card could hug its content — see App.scss for why one handle
            // behaving differently depending on the open tab was not worth what
            // it bought.
            style={
              showsGraph && !isGraphFullScreen
                ? ({
                    '--editor-height': `${editorHeight}px`,
                  } as CSSProperties)
                : undefined
            }
          >
            <div
              className="workspace-tabs"
              role="tablist"
              aria-label={t('tabs.aria')}
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeWorkspaceTab === 'eq'}
                className={`workspace-tab${
                  activeWorkspaceTab === 'eq' ? ' is-active' : ''
                }`}
                onClick={() => setActiveWorkspaceTab('eq')}
              >
                {t('tabs.eq')}
              </button>
              {/* Next to the EQ rather than out at the end, because it is
                  where most tunings start: you pick the headphones you own,
                  and then go and edit what it gave you. */}
              <button
                type="button"
                role="tab"
                aria-selected={activeWorkspaceTab === 'presets'}
                className={`workspace-tab${
                  activeWorkspaceTab === 'presets' ? ' is-active' : ''
                }`}
                onClick={() => setActiveWorkspaceTab('presets')}
              >
                {t('tabs.presets')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeWorkspaceTab === 'voicing'}
                className={`workspace-tab${
                  activeWorkspaceTab === 'voicing' ? ' is-active' : ''
                }`}
                onClick={() => setActiveWorkspaceTab('voicing')}
              >
                {t('tabs.voicing')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeWorkspaceTab === 'convolution'}
                className={`workspace-tab${
                  activeWorkspaceTab === 'convolution' ? ' is-active' : ''
                }`}
                onClick={() => setActiveWorkspaceTab('convolution')}
              >
                {t('tabs.convolution')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isVideoTab}
                className={`workspace-tab${isVideoTab ? ' is-active' : ''}`}
                onClick={() => setActiveWorkspaceTab('video')}
              >
                {t('tabs.media')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isLibraryTab}
                className={`workspace-tab${isLibraryTab ? ' is-active' : ''}`}
                onClick={() => setActiveWorkspaceTab('library')}
              >
                {t('tabs.library')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isKaraokeTab}
                className={`workspace-tab${isKaraokeTab ? ' is-active' : ''}`}
                onClick={() => setActiveWorkspaceTab('karaoke')}
              >
                {t('tabs.karaoke')}
              </button>
              {/* Last, and held out at the far edge by an auto margin. See
                  WORKSPACE_TABS for why the one tab that changes nothing is
                  kept apart from the ones that do. */}
              <button
                type="button"
                role="tab"
                aria-selected={activeWorkspaceTab === 'config'}
                className={`workspace-tab workspace-tab--config${
                  activeWorkspaceTab === 'config' ? ' is-active' : ''
                }`}
                onClick={() => setActiveWorkspaceTab('config')}
              >
                {t('tabs.config')}
              </button>
            </div>
            {activeWorkspaceTab === 'eq' && (
              <div
                // Remounts on every tab change so the panel entrance animation
                // replays. Voicing and convolution share this element, so
                // without a key switching between them changed the contents
                // with no transition at all.
                key={activeWorkspaceTab}
                // Inert when the equaliser is switched off, and equally inert
                // when Equalizer APO is not installed — in both cases there is
                // nothing behind these sliders and moving one changes nothing
                // you can hear. The app is still worth looking at, which is
                // why it is dimmed rather than replaced by an error screen.
                className={`workspace-tab-panel workspace-tab-panel--eq${
                  !isEngineUsable ? ' is-engine-disabled' : ''
                }`}
                aria-disabled={!isEngineUsable}
              >
                <MainContent />
              </div>
            )}
            {/* Its own page rather than a strip above the bands, which is
                where it used to live. It was the first thing on the EQ tab and
                the one thing there that is not a band, so it took a row of the
                editor's height from everybody — including everybody who does
                not own a measured headphone. */}
            {activeWorkspaceTab === 'presets' && (
              <div
                key={activeWorkspaceTab}
                className={`workspace-tab-panel workspace-tab-panel--presets${
                  !isEngineUsable ? ' is-engine-disabled' : ''
                }`}
                aria-disabled={!isEngineUsable}
              >
                <EqPresetsPanel />
              </div>
            )}
            {(activeWorkspaceTab === 'voicing' ||
              activeWorkspaceTab === 'convolution') && (
              // Voicing and convolution are both written into the same APO
              // config as the EQ, so with the engine off they are just as inert
              // and read the same way.
              <div
                key={activeWorkspaceTab}
                className={`workspace-tab-panel workspace-tab-panel--convolution${
                  !isEngineUsable ? ' is-engine-disabled' : ''
                }`}
                aria-disabled={!isEngineUsable}
              >
                {activeWorkspaceTab === 'voicing' ? (
                  <VoicingPanel />
                ) : (
                  <ConvolutionPanel />
                )}
              </div>
            )}
            {/* No engine-disabled state, unlike every panel above it.
                Those are inert with the equaliser switched off because moving
                their controls changes nothing you can hear. This one changes
                nothing at all — it only reports what is on disk — and the
                config is at its most worth reading precisely when something is
                wrong, which includes the engine being off. */}
            {activeWorkspaceTab === 'config' && (
              <div
                key={activeWorkspaceTab}
                className="workspace-tab-panel workspace-tab-panel--config"
              >
                <ConfigInspector />
              </div>
            )}
            {/* Outside the tab switch above, and deliberately: this one is
                hidden rather than unmounted, so that leaving the tab does not
                stop the music. It has no engine-disabled state either — a
                video plays whether or not Equalizer APO is behind it. */}
            {hasOpenedVideo && <VideoBrowser isHidden={!isVideoTab} />}
            {/* Same lifetime rule as the player above: mounted once a scan
                could be running here, then hidden rather than destroyed so
                switching tabs cannot cancel it. `LibraryPlayerProvider`
                nests inside `LibraryProvider` — it resolves a track id
                against the library index to draw a title and an artist, and
                that index is what `LibraryProvider` holds — and, once
                mounted, is never re-created by anything a tab does for
                exactly the same reason: `hasOpenedLibrary` only ever goes
                from false to true. The audio element it owns lives inside a
                ref, never rendered, so nothing here can remount it either. */}
            {hasOpenedLibrary && (
              <LibraryProvider>
                <LibraryPlayerProvider>
                  <LibraryWorkspace
                    isHidden={!isLibraryTab}
                    revealRequest={libraryReveal}
                  />
                  <ConnectedNowPlayingBar
                    activeTab={activeWorkspaceTab}
                    onReveal={revealPlayingTrack}
                  />
                </LibraryPlayerProvider>
              </LibraryProvider>
            )}
            {/* Mounted on first visit and then hidden instead of destroyed.
                The empty shell has no live resources yet, but the lifetime is
                correct before song playback and microphone capture arrive. */}
            {hasOpenedKaraoke && (
              <KaraokeWorkspace
                isHidden={!isKaraokeTab}
                isFullScreen={isKaraokeFullScreen}
                isChromeIdle={isChromeIdle}
                hasFullScreenTopBar={hasFullScreenTopBar}
                onToggleFullScreenTopBar={toggleFullScreenTopBar}
                onToggleFullScreen={() =>
                  applyKaraokeFullScreen(!isKaraokeFullScreen)
                }
              />
            )}
            {/* Outside the tab switch for the same class of reason, and more
                strictly: this one renders nothing at all. It hosts both Smart
                EQ measurements, which used to live in the EQ panel above and so
                were torn down mid-capture whenever anybody looked at another
                tab. Mounted once and never unmounted, a continuous measurement
                keeps its evidence for as long as the window is open. */}
            <SmartEqEngine />
          </div>
          {/* One divider, both tabs, always in the same place: the seam between
              whatever is above and the graph. In full screen there is nothing
              above the graph, so there is nothing to divide. */}
          {showsGraph && !isGraphFullScreen && (
            <PaneResizer
              ariaLabel={t('graph.resize')}
              valuePercent={graphHeightPercent}
              onStart={handleGraphResizeStart}
              onDrag={handleGraphResizeDrag}
              onEnd={handleGraphResizeEnd}
            />
          )}
          {showsGraph ? <FrequencyResponseChart isVisible /> : null}
        </div>
        {/*
          Below the three-column breakpoint the sound panel is a slide-over
          drawer instead of a band squashed under the workspace: the same
          content, floated, with an edge tab to summon it. Above the
          breakpoint the tab and backdrop are display:none and this class
          does nothing.
        */}
        <button
          type="button"
          className="right-content-toggle"
          aria-expanded={rightPaneOpen}
          aria-label={t('app.soundPanel')}
          onClick={() => setRightPaneOpen((open) => !open)}
        >
          <MenuIcon name="settings" />
        </button>
        {rightPaneOpen && (
          <button
            type="button"
            className="right-content-backdrop"
            aria-label={t('app.soundPanel')}
            onClick={() => setRightPaneOpen(false)}
          />
        )}
        <div className={`right-content${rightPaneOpen ? ' is-open' : ''}`}>
          <DeviceProfiles />
          {/* Directly under the output picker: it is the same question asked
              twice over — that one chooses where the sound goes, this one
              adds a second somewhere. */}
          <ExtraOutputs />
          {/* Sits with the output device because it answers the same question:
              what is this sound coming out of. */}
          <DriverPicker />
          <PresetsBar
            fetchPresets={getPresetListFromFiles}
            loadPreset={loadPreset}
            savePreset={savePreset}
            renamePreset={renamePreset}
            deletePreset={deletePreset}
          />
        </div>
        {/* Only a genuinely fatal condition takes the screen. Anything else is
            reported without touching the editor: a preset that failed to save
            is no reason to hide an equalizer that is still working. */}
        {showBugReport && (
          <BugReportDialog onClose={() => setShowBugReport(false)} />
        )}
        {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
        {/* The repairs are the same handlers the menu calls directly. Passed
            in rather than imported there, so there is one definition of what
            "reinstall Equalizer APO" does — including the confirmation and the
            restart advice that follows it. */}
        {/* The creature remains over a full-screen graph. When Karaoke is the
            surface beneath that graph, the overlay class moves it into the
            lower dock so it cannot cover the playlist or song metadata. A
            native Karaoke full screen keeps the creature out entirely. */}
        {isChromeHidden && !isKaraokeFullScreen && (
          <div
            className={`fullscreen-chrome${
              isKaraokeTab ? ' is-karaoke-overlay' : ''
            }${isChromeIdle ? ' is-idle' : ''}`}
          >
            <SupportPet
              hasContributed={hasContributed}
              onOpen={() => setShowSupportDialog(true)}
            />
          </div>
        )}
        {showTroubleshooter && (
          <AudioTroubleshooter
            onClose={() => setShowTroubleshooter(false)}
            onRestartAudio={handleRestartWindowsAudio}
            onReconfigure={handleConfigureEqualizerApo}
            onReinstallApo={handleReinstallApo}
          />
        )}
        {globalError && isBlockingError && (
          <PrereqMissingModal
            key={prereqNonce}
            isLoading={isLoading}
            onRetry={performHealthCheck}
            errorMsg={globalError.shortError}
            actionMsg={globalError.action}
          />
        )}
        {globalError && !isBlockingError && (
          <div className="workspace-notice" role="alert">
            <div>
              <strong>{globalError.shortError}</strong>
              <span>{globalError.action}</span>
            </div>
            <button
              type="button"
              aria-label={t('app.dismiss')}
              onClick={() => setGlobalError(undefined)}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          </div>
        )}
        {importNotice && (
          <div className="workspace-notice workspace-notice--ok" role="status">
            <MenuIcon name="import" className="workspace-notice__icon" />
            <div>
              <strong>{t('notice.importComplete')}</strong>
              <span>{importNotice}</span>
            </div>
            <button
              type="button"
              aria-label={t('app.dismiss')}
              onClick={() => setImportNotice('')}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          </div>
        )}
        {/* Bottom left, opposite the failure notices, so two things arriving
            at once do not land on top of each other. */}
        <UpdateNotice />
        {/* Here rather than in the Karaoke tab that owns the model: the idle
            timer that raises it runs for as long as the model is loaded, and
            asking inside a tab nobody is looking at held the RAM until the
            user happened to come back. */}
        <SpeechMemoryNotice />
        {whatsNewScope && (
          <WhatsNewDialog
            scope={whatsNewScope}
            onClose={() => {
              // Written on close rather than on open: a dialog dismissed by a
              // crash should still be shown again.
              if (APP_VERSION) {
                localStorage.setItem(WHATS_NEW_SEEN_KEY, APP_VERSION);
              }
              setWhatsNewScope(null);
            }}
          />
        )}
        {showSupportDialog && (
          <SupportDialog
            // Opens on top rather than replacing this one. Reading the
            // notes is a detour from deciding whether to contribute, not a
            // departure from it — closing them should put you back where you
            // were, not leave you staring at the workspace.
            onShowReleaseNotes={() => setWhatsNewScope('all')}
            isCovered={whatsNewScope !== null}
            hasContributed={hasContributed}
            onContributed={() => {
              localStorage.setItem(SUPPORT_CONTRIBUTED_KEY, 'true');
              setHasContributed(true);
            }}
            // Development only — the button that calls this is compiled out of
            // a release build. Both halves have to go: the badge is what gates
            // the game, and a run left standing would keep the whole window in
            // euphoria mode for a creature that no longer has anything to
            // celebrate.
            onResetContribution={() => {
              localStorage.removeItem(SUPPORT_CONTRIBUTED_KEY);
              setHasContributed(false);
              resetRhythmRun();
              // The unlock goes too. Leaving it would put a working euphoria
              // switch on the titlebar of an install that has just been reset
              // to never having earned one.
              resetEuphoriaMode();
            }}
            onClose={() => setShowSupportDialog(false)}
          />
        )}
        {/* Last, and in this order, because these two are the only things that
            arrive over the top of the workspace on their own.

            The acknowledgement is second, and therefore in front. It is the
            only one of the pair that cannot be dismissed, and a gate drawn
            underneath a dialog it is holding focus away from is a window
            nobody can use: its focus lock would keep pulling focus out of the
            update notice, and its Escape handler would eat the key that
            notice closes on. Front-most is the only place a lock belongs. */}
        <MandatoryUpdateModal />
        <DisclaimerGate />
      </main>
    </>
  );
};

export default function App() {
  return (
    // Outermost: every other provider can surface a message, and all of them
    // are below this one so they can be translated.
    <I18nProvider>
      <FluidEqProvider>
        <LiveAudioProvider>
          {/* Mounted here rather than inside the support dialog, because the
              run outlives that dialog being closed and the celebration is
              meant to reach the whole window. It renders nothing; it puts the
              streak on the document root where every stylesheet can see it. */}
          <EuphoriaGlow />
          <Router>
            <Routes>
              <Route path="/" element={<AppContent />} />
            </Routes>
          </Router>
        </LiveAudioProvider>
      </FluidEqProvider>
    </I18nProvider>
  );
}
