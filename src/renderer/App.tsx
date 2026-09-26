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

import {
  Activity,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { ErrorCode, ErrorDescription } from 'common/errors';
import type { IAudioRestartOutcome, TAudioEngine } from 'common/audioEngine';
import type { IEngineSetupResult } from 'main/engineSetup';
import { SUPPORT_CONTRIBUTED_KEY } from 'common/support';
import { isAccountConfigured } from 'common/accountConfig';
import {
  TITLEBAR_DOUBLE_CLICK_CHANNEL,
  type IWindowState,
} from 'common/windowMode';
import {
  featureTourDismissal,
  shouldShowFeatureTour,
} from 'common/featureTour';
import {
  OFFICIAL_SITE_URL,
  PRODUCT_NAME,
  PRODUCT_VERSION,
} from 'common/branding';
import { resetRhythmRun } from './utils/rhythmRun';
import useMediaQuery from './utils/useMediaQuery';
import { useTitlebarRoom } from './utils/useTitlebarRoom';
import GameSound from './games/GameSound';
import RackFollowsEngine from './dsp/RackFollowsEngine';
import PresetToneFeed from './dsp/PresetToneFeed';
import { resetEuphoriaMode } from './utils/euphoriaMode';
import './styles/App.scss';
// After App.scss: these are the accents in their rainbow form, and they have to
// win against the cyan ones they replace without reaching for `!important`.
import './styles/Rainbow.scss';
import MainContent from './MainContent';
import SmartEqEngine from './SmartEqEngine';
import SmartHeadroomEngine from './SmartHeadroomEngine';
import SupportDialog from './SupportDialog';
import AccountDialog from './account/AccountDialog';
import {
  subscribeAccountPanelRequests,
  type TAccountPanelPage,
} from './account/accountPanel';
import showGalleryGraph from './plus/showGalleryGraph';
import { subscribePlusTabRequests } from './plus/plusTabRequest';
import useStudioAgent from './studio/useStudioAgent';
import { usePlusWelcome } from './account/plusWelcomeStore';
import UsageMeter from './usage/UsageMeter';
import DynamicLightingLoop from './lighting/DynamicLightingLoop';
import HeardSongNames from './graph/HeardSongNames';
import WallpaperAudio from './wallpaper/WallpaperAudio';
import WallpaperGraphLook from './wallpaper/WallpaperGraphLook';
import WallpaperTuning from './wallpaper/WallpaperTuning';
import { WallpaperDialogHost } from './wallpaper/WallpaperControls';
import { GenreNotesHost } from './dsp/GenreNotesDialog';
import ProcessesDialog from './components/ProcessesDialog';

import SupportPet from './SupportPet';
import { FluidEqProvider, useFluidEqShell } from './utils/FluidEqContext';
import PrereqMissingModal from './PrereqMissingModal';
import BugReportDialog from './components/BugReportDialog';
import AudioTroubleshooter from './components/AudioTroubleshooter';
import SideBar from './SideBar';
import {
  exitGraphFullScreen,
  getGraphView,
  onWindowFullScreenChange,
  toggleGraphExpanded,
  toggleGraphFullScreen,
  toggleFullScreenTopBar,
  useGraphFullScreen,
  useGraphView,
  useFullScreenTopBar,
  useSceneLook,
} from './utils/graphStyle';
import {
  useIsChromeIdle,
  useIsPointerNearChrome,
  useIsPointerNearSideChrome,
  watchChromeIdle,
} from './utils/idleChrome';
import { reportError, reportInfo } from './utils/logger';
import { albumKey } from '../common/library/grouping';
import { ILibraryTrack } from '../common/library/types';
import LibraryStageArt from './library/LibraryStageArt';
import SystemStageArt from './library/SystemStageArt';
import { LibraryProvider } from './library/LibraryContext';
import { PlaylistProvider, usePlaylists } from './library/PlaylistContext';
import { useHasPendingKaraokeFiles } from './library/karaokeHandoff';
import {
  LibraryPlayerProvider,
  useLibraryPlayer,
} from './library/player/LibraryPlayerContext';
import NowPlayingBar from './library/player/NowPlayingBar';
import IdleTransportBar from './library/player/IdleTransportBar';
import SourceTransportBar from './library/player/SourceTransportBar';
import { usePlaybackOwner, type TPlaybackOwner } from './audio/playbackOwner';
import { useSystemMediaSource } from './audio/useSystemMediaSource';
import { useSongEqSessionHost } from './audio/songEqSession';
import {
  readRememberedTransportOwner,
  useLastPlayingOwner,
  useLastTransportOwner,
  useHasTransportTitle,
  useIsTransportPlaying,
  useTransportIdentitySources,
  useTransportSources,
} from './audio/transportSource';
import pickTransportOwner from './audio/transportRouting';
import TaskbarTransport from './audio/TaskbarTransport';
import keepsPlayerMounted from './audio/playerMount';
import { useLastShown } from './audio/lastShown';
import useCaptureBridge from './audio/useCaptureBridge';
import useAppFullMark from './utils/useAppFullMark';
import { useNoticeClaim } from './utils/noticeTurn';
import PaneResizer from './components/PaneResizer';
import WorkspaceTabStrip from './components/WorkspaceTabStrip';
import WorkspaceSectionTabs from './components/WorkspaceSectionTabs';
import FluidEngineLabel from './components/FluidEngineLabel';
import {
  clampToWindow,
  commitPaneSizes,
  getEditorHeight,
  setEditorHeight,
  shortWindowPaneKey,
  belowGraphPaneKey,
  useEditorHeight,
} from './utils/paneSizes';
import { EqTitleSlotContext } from './utils/eqTitleSlot';
import useWorkspaceAxis from './utils/workspaceAxis';
import FrequencyResponseChart from './graph/FrequencyResponseChart';
import PresetsBar from './PresetsBar';
import DeviceProfiles from './DeviceProfiles';
import ExtraOutputs from './ExtraOutputs';
import DriverPicker from './components/DriverPicker';
import WaveformVisualizer from './WaveformVisualizer';
import {
  ConfigPage,
  ConvolutionPage,
  DspPanelPage,
  ForumPage,
  GamesPage,
  isTabReady,
  KaraokePage,
  LibraryPage,
  MediaPage,
  PlusPage,
  preloadTab,
  PresetsPage,
  SharePage,
} from './workspacePages';
import {
  LEGACY_WORKSPACE_TABS,
  readWorkspaceTab,
  resolveWorkspaceTab,
  WORKSPACE_TAB_KEY,
  WORKSPACE_TABS,
  type TWorkspaceTab,
} from './workspaceTabs';
import {
  applyDspSettings,
  persistDspSettings,
  publishSystemDspChain,
  setDspRackGate,
  useDspEngineState,
  useDspSettings,
} from './dsp/store';
import useEngineTrouble from './audio/useEngineTrouble';
import eqReachesSound from './utils/eqReachesSound';
import { sameEndpoint } from './audio/engineTrouble';
import useRepairWhenEngineNeverRan from './utils/useRepairWhenEngineNeverRan';
import useWindowFloor from './utils/windowFloor';
import MenuIcon from './icons/MenuIcon';
import Chevron from './icons/Chevron';
import ActionsMenu, { type TEngineState } from './components/ActionsMenu';
import UpdateNotice from './components/UpdateNotice';
import SpeechMemoryNotice from './components/SpeechMemoryNotice';
import SongEqNotice from './components/SongEqNotice';
import PlusTermsNotice from './components/PlusTermsNotice';
import SceneReviewNotice from './components/SceneReviewNotice';
import MakerMonthNotice from './components/MakerMonthNotice';
import SceneReportHost from './plus/SceneReportHost';
import PlusWelcomeDialog from './components/PlusWelcomeDialog';
import MandatoryUpdateModal from './components/MandatoryUpdateModal';
import DisclaimerGate from './components/DisclaimerGate';
import WhatsNewDialog from './components/WhatsNewDialog';
import FeatureTour from './components/featureTour/FeatureTour';
import HelpMenu from './help/HelpMenu';
import { featureTourFor } from './components/featureTour/slides';
import AboutDialog from './components/AboutDialog';
import SignalBrandMark from './components/SignalBrandMark';
import SignalBrandName from './components/SignalBrandName';
import MiniPlayer from './player/MiniPlayer';
import type { TPlayerPage } from './player/PlayerTitleStrip';
import WindowModeSwitch from './player/WindowModeSwitch';
import TrafficLightSlot from './components/TrafficLightSlot';
import runsOnMac from './utils/platform';
import {
  setPlayerVisFull,
  useIsPlayerQueueOpen,
  usePlayerVisFull,
} from './player/playerLayout';
import {
  afterNextFrame,
  setWindowMode,
  untilViewportIsWindow,
  useWindowMode,
} from './player/windowModeStore';
import { holdGraphUntil } from './graph/graphArrival';
import { applyThemeScope } from './utils/theme';
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
import {
  createPreset,
  deletePreset,
  getAudioDevices,
  getPresetListFromFiles,
  importConvolutionFile,
  importEqFile,
  loadPreset,
  renamePreset,
  savePreset,
} from './utils/equalizerApi';
import { startEqualizerApoInstall } from './utils/apoInstall';
import RestartAudioDialog from './components/RestartAudioDialog';
import EngineTroubleNotice from './components/EngineTroubleNotice';
import EngineUpdateNotice from './components/EngineUpdateNotice';
import AudioEngineDialog, {
  type TApoAction,
} from './components/AudioEngineDialog';
import { useAudioEngineStatus } from './utils/useAudioEngineStatus';
import { useEngineMaintenance } from './utils/useEngineMaintenance';
import { AudioEngineContext } from './utils/audioEngineContext';
import { notifyAudioEngineChanged } from './utils/audioEngineEvents';
import { startScenePrebuild } from './graph/scenePrebuild';
import {
  attachFluidEngine,
  detachFluidEngine,
  engineDisplayName,
  engineInstallsNeeded,
  getAudioEngineStatus,
  installFluidEngine,
  isAwaitingApoInstall,
  prereqBannerEngine,
  setAudioEngine,
  repairFluidEngineOutput,
  updateFluidEngine,
} from './utils/audioEngineApi';

const APO_RESTART_RECOMMENDED_KEY = 'fluideq.apoRestartRecommended';
/**
 * The version on which "don't show this again" was ticked in the feature
 * tour. Absent when it was never ticked, or was unticked on the last close.
 */
const FEATURE_TOUR_DISMISSED_KEY = 'fluideq.featureTourDismissed';

/**
 * Shipped build version, substituted by webpack at compile time. Empty in any
 * context that does not go through the bundler (a bare unit-test import), so
 * the badge is rendered conditionally rather than showing "vundefined".
 *
 * Defined once in `common/branding`, alongside the name it sits next to.
 */
const APP_VERSION = PRODUCT_VERSION;
/** What this version brought, then the standing slides. */
const TOUR_SLIDES = featureTourFor(APP_VERSION);

/** Independent response-graph visibility overrides for each workspace tab. */
const GRAPH_VISIBILITY_BY_TAB_KEY = 'fluideq.graphVisibilityByTab';

/**
 * The five tabs that are one place: the equaliser and the things that set it.
 *
 * The strip had grown to eight, which is not a row of tabs any more but a
 * menu bar somebody has to read. Four of these are the same subject seen from
 * different sides — the bands, the presets that fill them, the voicing over
 * them, the impulse under them — and Config is the one that reports what is
 * on disk when a tuning is not doing what it should. They live behind one
 * tab, with a row of pills inside it, and the strip is left with the four
 * things that are genuinely different places: EQ, Media, Library, Karaoke,
 * and DSP. Everything behind EQ writes or inspects Equalizer APO; DSP has its
 * own top-level destination because it processes only FluidEQ's player.
 *
 * Config last among them, for the reason it was last in the strip: it is the
 * only one that changes nothing, so it is where you go when something is
 * wrong rather than somewhere you pass through on the way to a tuning.
 */
const EQ_GROUP_TABS: readonly TWorkspaceTab[] = [
  'eq',
  'presets',
  'convolution',
  'games',
  'config',
];

const EQ_GROUP_LABEL_KEYS = {
  eq: 'tabs.eqMain',
  presets: 'tabs.presets',
  convolution: 'tabs.convolution',
  games: 'tabs.games',
  config: 'tabs.config',
} as const;

/**
 * The width below which the media tab is named in one word instead of two.
 *
 * 1280 is where the titlebar already stops giving everything its full
 * presentation — the meter drops from 420px to 320 and both outer tracks
 * start being sized from their contents. Everything the strip does below that
 * only makes the words smaller, which is not enough for a name that runs to
 * "Multimedia en línea" in Spanish and "オンラインメディア" in Japanese: at
 * five tabs those two extra words cost more room than the whole EQ tab.
 *
 * So the qualifier goes and the noun stays. It costs nothing to lose, because
 * this is the only place in the app that plays anything from a URL — "online"
 * says which media tab only while there is room to say it.
 */
const MEDIA_TAB_ONE_WORD_QUERY = '(max-width: 1280px)';

/**
 * A laptop's height: `$bp-laptop-height` in `_constant.scss`, where the shell
 * puts its chrome away. Here it is where a page other than the EQ's keeps its
 * own split, with the graph starting as a strip (`shortWindowPaneKey`).
 */
const SHORT_WINDOW_QUERY = '(max-height: 900px)';

const isEqGroupTab = (tab: TWorkspaceTab): boolean =>
  EQ_GROUP_TABS.includes(tab);

const FULLSCREEN_MEDIA_TABS: readonly TWorkspaceTab[] = [
  'video',
  'library',
  'karaoke',
];

const isFullscreenMediaTab = (tab: TWorkspaceTab): boolean =>
  FULLSCREEN_MEDIA_TABS.includes(tab);

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
 * Which player each tab's bar drives.
 *
 * The tabs that are not players have no entry, and there the bar falls back
 * to whatever is making sound — see `pickTransportOwner`, which holds the
 * rule both halves of the bar ask.
 */
const TAB_TRANSPORT: Partial<Record<TWorkspaceTab, TPlaybackOwner>> = {
  library: 'library',
  karaoke: 'karaoke',
  video: 'media',
};

/**
 * The bar for every tab that is not the library.
 *
 * Mounted outside `hasOpenedLibrary`, which is the whole point of it being a
 * separate component: the library's providers are built on first visit to
 * that tab, and the karaoke transport used to live inside them. A window
 * opened straight onto Karaoke therefore had no bar at all until the user
 * happened to look at the Library.
 */
/**
 * Where each player lives, for the press that goes to it.
 *
 * Partial because one of them has nowhere to go: `system` is another program
 * making the sound, and no tab here shows it. The bar leaves its cover and
 * title as plain text rather than as a button that would go nowhere.
 */
const TRANSPORT_TAB: Partial<Record<TPlaybackOwner, TWorkspaceTab>> = {
  library: 'library',
  karaoke: 'karaoke',
  media: 'video',
  // The LAN audio page: it shows the sending computer and its live meter,
  // which is the nearest thing this machine has to the player.
  remote: 'share',
};

/**
 * The bar when there is no player to put in it.
 *
 * Asks the same question of the same stores the two real bars ask, and draws
 * only when both of them have answered no — which is the one case the foot of
 * the window used to be empty for. Not in full screen: there the bar is
 * something that arrives over a picture when the pointer goes looking for it,
 * and an empty one arriving would be chrome with nothing to say.
 */
const IdleTransportBarSlot = ({
  activeTab,
  isFullScreen,
  onGoToTab,
}: {
  activeTab: TWorkspaceTab;
  isFullScreen: boolean;
  onGoToTab: (tab: TWorkspaceTab) => void;
}) => {
  const sources = useTransportSources();
  const playingOwner = usePlaybackOwner();
  const lastOwner = useLastTransportOwner();
  const remembered = useLastShown();
  const owner = pickTransportOwner(
    TAB_TRANSPORT[activeTab],
    sources,
    playingOwner,
    lastOwner,
  );
  // AND NOT BEFORE ANYTHING HAS EVER PLAYED.
  //
  // On a machine where the library is still empty — a fresh install, the
  // "No music yet" screen — a transport across the whole foot of the window
  // is the loudest thing on it, and it is for nothing: there is no queue to
  // resume and no tab that could fill it. `lastOwner` and `remembered` are
  // kept across restarts, so this appears the moment something has been
  // played once and stays from then on, which is the "always a bar" that was
  // asked for — saying what played last, from then on, rather than nothing.
  if (
    owner !== undefined ||
    isFullScreen ||
    (lastOwner === undefined && remembered === undefined)
  ) {
    return null;
  }
  const tab =
    remembered === undefined ? 'library' : TRANSPORT_TAB[remembered.owner];
  return (
    <IdleTransportBar
      remembered={remembered}
      onReveal={tab === undefined ? undefined : () => onGoToTab(tab)}
    />
  );
};

const TabTransportBar = ({
  activeTab,
  isIdle,
  isFloating,
  onGoToTab,
}: {
  activeTab: TWorkspaceTab;
  isIdle: boolean;
  isFloating: boolean;
  onGoToTab: (tab: TWorkspaceTab) => void;
}) => {
  const sources = useTransportSources();
  const playingOwner = usePlaybackOwner();
  const lastOwner = useLastTransportOwner();
  const owner = pickTransportOwner(
    TAB_TRANSPORT[activeTab],
    sources,
    playingOwner,
    lastOwner,
  );
  const source = owner === undefined ? undefined : sources[owner];
  if (owner === 'library' || source === undefined) {
    return null;
  }
  const tab = TRANSPORT_TAB[source.owner];
  return (
    <SourceTransportBar
      source={source}
      isIdle={isIdle}
      isFloating={isFloating}
      onReveal={tab === undefined ? undefined : () => onGoToTab(tab)}
    />
  );
};

const ConnectedNowPlayingBar = ({
  activeTab,
  isIdle,
  isFloating,
  onReveal,
}: {
  activeTab: TWorkspaceTab;
  isIdle: boolean;
  isFloating: boolean;
  onReveal: (track: ILibraryTrack) => void;
}) => {
  const player = useLibraryPlayer();
  const { isFavorite, toggleFavorite } = usePlaylists();
  const sources = useTransportSources();
  const playingOwner = usePlaybackOwner();
  const lastOwner = useLastTransportOwner();
  const { track } = player;
  const owner = pickTransportOwner(
    TAB_TRANSPORT[activeTab],
    sources,
    playingOwner,
    lastOwner,
  );

  // Another tab's bar is up; this one stays down. `TabTransportBar` asks the
  // same question of the same two stores, so exactly one of us answers yes.
  if (owner !== undefined && owner !== 'library') {
    return null;
  }

  return (
    <NowPlayingBar
      isIdle={isIdle}
      isFloating={isFloating}
      track={player.track}
      isPlaying={player.isPlaying}
      positionMs={player.positionMs}
      durationMs={player.durationMs}
      repeat={player.repeat}
      isShuffled={player.isShuffled}
      isUnplayable={player.isUnplayable}
      onToggle={player.toggle}
      onSkip={player.skip}
      onStop={player.stop}
      onSeek={player.seek}
      onShuffle={() => player.setShuffle(!player.isShuffled)}
      onRepeat={player.cycleRepeat}
      isFavorite={track ? isFavorite(track.id) : false}
      onFavorite={track ? () => toggleFavorite(track.id) : undefined}
      onReveal={track ? () => onReveal(track) : undefined}
    />
  );
};

/**
 * The DSP page, subscribed to the rack's settings itself.
 *
 * The settings live in the DSP store because the engine that consumes them
 * runs inside `LibraryPlayerContext`; reading them here rather than in
 * `AppContent` is the other half of that. The root used to read them for this
 * one prop, and the store publishes on every step of a knob, so every drag
 * re-rendered the whole window — titlebar, both side columns, the chart and
 * any mounted player — for a page that is one leaf of it.
 */
const DspPage = memo(
  ({ onOpenEngineDialog }: { onOpenEngineDialog: () => void }) => {
    const settings = useDspSettings();
    const engineState = useDspEngineState();
    return (
      <DspPanelPage.Page
        settings={settings}
        onChange={applyDspSettings}
        onCommit={persistDspSettings}
        engineState={engineState}
        onOpenEngineDialog={onOpenEngineDialog}
      />
    );
  },
);

/**
 * The pane above the graph, sized by the divider.
 *
 * Its height is read here and nowhere above. The store publishes on every
 * pixel of a divider drag and on every resize of the column, and read in
 * `AppContent` it re-rendered the whole window for one number each time. The
 * children are built by the root and handed down, so they keep their identity
 * and React passes over them when only the height moves.
 */
const MiddleContent = ({
  paneKey,
  isSized,
  children,
}: {
  paneKey: string;
  isSized: boolean;
  children: ReactNode;
}) => {
  const editorHeight = useEditorHeight(paneKey);
  return (
    <div
      className="middle-content"
      // What the divider actually sets: the height of everything above the
      // graph, on every tab. It used to be a ceiling on the EQ tab so the card
      // could hug its content — see App.scss for why one handle behaving
      // differently depending on the open tab was not worth what it bought.
      style={
        isSized
          ? ({ '--editor-height': `${editorHeight}px` } as CSSProperties)
          : undefined
      }
    >
      {children}
    </div>
  );
};

/** The divider, reading the height it reports for itself — see above. */
const GraphPaneResizer = ({
  paneKey,
  ariaLabel,
  onStart,
  onDrag,
  onEnd,
}: {
  paneKey: string;
  ariaLabel: string;
  onStart: () => void;
  onDrag: (deltaY: number) => void;
  onEnd: () => void;
}) => {
  const editorHeight = useEditorHeight(paneKey);
  // How much of the workspace the editor currently has, as a percentage. Only
  // for the divider's `aria-valuenow` — a pixel height means nothing read out
  // loud without also knowing how tall the window is.
  const valuePercent = Math.round(
    (editorHeight / Math.max(1, window.innerHeight)) * 100,
  );
  return (
    <PaneResizer
      ariaLabel={ariaLabel}
      valuePercent={valuePercent}
      onStart={onStart}
      onDrag={onDrag}
      onEnd={onEnd}
    />
  );
};

const AppContent = () => {
  const {
    isLoading,
    globalError,
    isBlockingError,
    isEnabled,
    isEngineUsable,
    isGraphViewOn,
    performHealthCheck,
    refreshState,
    setGlobalError,
  } = useFluidEqShell();
  const { t } = useTranslation();

  // The sound panel drawer, meaningful only under the three-column breakpoint.
  const [rightPaneOpen, setRightPaneOpen] = useState(false);
  // The same, for the panel that becomes a drawer at the top of the window.
  const [topPaneOpen, setTopPaneOpen] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<TWorkspaceTab>(readWorkspaceTab);
  // Set from inside the graph pane; changing workspace pages leaves either
  // large graph mode first. The backdrop now follows playback rather than the
  // selected tab, so carrying expanded/fullscreen through a navigation makes
  // the tab press appear to do nothing.
  const isGraphFullScreen = useGraphFullScreen();
  const graphView = useGraphView();
  /**
   * Every route to another page: a tab, a pill, the amp, the tour, a reveal.
   *
   * Most pages are fetched on their first opening (`workspacePages.ts`), and a
   * page that has not arrived yet is fetched before anything changes, so the
   * page being left stays on screen until the next one can be drawn whole —
   * never an empty pane between the two. The latest press wins: one made
   * while an earlier page was still arriving is the page that opens.
   *
   * Read through refs at the moment the page is shown, not closed over at the
   * press, because that moment can be a fetch later than the press.
   */
  const activeTabRef = useRef(activeWorkspaceTab);
  activeTabRef.current = activeWorkspaceTab;
  const requestedTabRef = useRef<TWorkspaceTab | undefined>(undefined);
  const selectTopWorkspaceTab = useCallback((next: TWorkspaceTab) => {
    requestedTabRef.current = next;
    const show = () => {
      if (requestedTabRef.current !== next) {
        return;
      }
      if (next !== activeTabRef.current && getGraphView() !== 'normal') {
        exitGraphFullScreen();
      }
      setActiveWorkspaceTab(next);
    };
    if (isTabReady(next)) {
      show();
      return;
    }
    preloadTab(next).then(show, (error: unknown) => {
      // Shown anyway: a press that does nothing reads as a dead button, and
      // drawing the page meets the failure again where it can be reported.
      reportError(`Loading the ${next} page`, error);
      show();
    });
  }, []);
  /** A hover or a focus on a way to a page is when its code is fetched. */
  const preloadTabOnApproach = useCallback((tab: TWorkspaceTab) => {
    preloadTab(tab).catch((error: unknown) => {
      reportError(`Fetching the ${tab} page ahead of its press`, error);
    });
  }, []);
  /**
   * The same for the equaliser's pills, which are drawn by a component that
   * knows them only by their order: they are `EQ_GROUP_TABS`, in that order.
   * One listener on the panel rather than one per pill.
   */
  const preloadEqPillOnApproach = useCallback(
    (event: SyntheticEvent<HTMLElement>) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      const pill = event.target.closest('.workspace-pill');
      const pills = pill?.parentElement?.querySelectorAll('.workspace-pill');
      const index = pill && pills ? Array.from(pills).indexOf(pill) : -1;
      const tab = EQ_GROUP_TABS[index];
      if (tab !== undefined) {
        preloadTabOnApproach(tab);
      }
    },
    [preloadTabOnApproach],
  );
  /**
   * Which of the equaliser's five was last open, for the tab that holds them.
   *
   * Pressing EQ from Media has to land somewhere, and always landing on the
   * bands would mean somebody working in Voicing lost their place every time
   * they looked at something else. Seeded from the stored tab, so it survives
   * a restart the same way the tab itself does.
   */
  const [lastEqTab, setLastEqTab] = useState<TWorkspaceTab>(() => {
    const stored = readWorkspaceTab();
    return isEqGroupTab(stored) ? stored : 'eq';
  });
  useEffect(() => {
    if (isEqGroupTab(activeWorkspaceTab)) {
      setLastEqTab(activeWorkspaceTab);
    }
  }, [activeWorkspaceTab]);

  // The window as the compact player (`MiniPlayer`), and the way back from
  // it onto one of the pages: the page is chosen while the app is still put
  // away, so it comes back already showing it.
  const { mode: windowMode } = useWindowMode();
  /**
   * THE AMP'S QUEUE DECK NEEDS THE LIBRARY'S PLAYER, whether or not anything
   * is playing (Ivan, 2026-09-22: "drag and drop into the up next doesn't
   * work, the app needs to enable that feature"). The deck lists that player's
   * queue and hands it the music dropped on it, and with the providers put
   * away — as they are off-tab once silent and no longer the last thing
   * played, and as they
   * have never been on a fresh launch — the deck had nothing to list and a
   * drop went nowhere, silently. So while the window is the amp and its
   * queue is open, the Library counts as opened and as active below.
   */
  const isPlayerQueueOpen = useIsPlayerQueueOpen();
  const playerWantsLibrary = windowMode === 'player' && isPlayerQueueOpen;
  /**
   * THE AMP KEEPS ITS OWN THEME (Ivan, 2026-09-22). The full app can be Dark
   * while the amp is Light: the two are never on screen at once, so there is
   * one theme on the window at a time and a choice remembered for each mode.
   *
   * Applied from here rather than from the mode store itself, which is where
   * it belongs by subject and cannot go by construction: that module is
   * imported by half the player, and importing the theme from it closed a
   * cycle that took the window down with a TDZ error on `useWindowMode`. App
   * is the top of the tree and imports both already.
   */
  useEffect(() => {
    applyThemeScope(windowMode === 'player' ? 'player' : 'app');
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

  const [graphVisibilityByTab, setGraphVisibilityByTab] = useState<
    TWorkspaceGraphVisibility | undefined
  >(readWorkspaceGraphVisibility);

  // Which engine is processing the audio, held once for the whole shell: the
  // output panels, the troubleshooter and the dialog all read this one answer
  // rather than each asking main for its own copy.
  const { status: engineStatus, refresh: refreshEngineStatus } =
    useAudioEngineStatus();
  const runningEngine = engineStatus?.engine;
  // Whether the FluidEQ Engine is failing where it can be heard: for the
  // notice that says so, and for the DSP rack, which runs nowhere while the
  // engine is off.
  const { trouble: engineTrouble, isOnOutput: isEngineOnOutput } =
    useEngineTrouble(
      runningEngine ?? null,
      engineStatus?.fluid,
      engineStatus?.fluidUpdateReady === true,
    );
  // The EQ pages lock on all three ways a band cannot be heard, not only the
  // two the context knows about. See `eqReachesSound.ts`.
  const isEqReachingSound = eqReachesSound(isEngineUsable, isEngineOnOutput);

  /**
   * Inside the page rather than above it, and pills rather than tabs: the
   * strip is where the app's five places are chosen, and a second row of
   * tab-shaped things under it would read as eight tabs in two rows — which
   * is the arrangement this split exists to undo. Built once here and placed
   * by each panel, because they are five separate pages and a row that is
   * part of the page has to be inside it.
   */
  const eqGroupPills = (
    <WorkspaceSectionTabs
      label={t('tabs.eq')}
      activeId={activeWorkspaceTab}
      tabs={EQ_GROUP_TABS.map((tab) => ({
        id: tab,
        label: t(EQ_GROUP_LABEL_KEYS[tab as keyof typeof EQ_GROUP_LABEL_KEYS]),
      }))}
      onSelect={(id) => {
        const next = resolveWorkspaceTab(id);
        if (next) {
          selectTopWorkspaceTab(next);
        }
      }}
    >
      <FluidEngineLabel
        isEngineOnOutput={isEngineOnOutput}
        isPartlyOff={engineTrouble?.kind === 'problems'}
      />
    </WorkspaceSectionTabs>
  );
  const isVideoTab = activeWorkspaceTab === 'video';
  const isMediaTabOneWord = useMediaQuery(MEDIA_TAB_ONE_WORD_QUERY);
  const isLibraryTab = activeWorkspaceTab === 'library';
  const isKaraokeTab = activeWorkspaceTab === 'karaoke';
  const isDspTab = activeWorkspaceTab === 'dsp';
  const isShareTab = activeWorkspaceTab === 'share';
  const isCommunityTab = activeWorkspaceTab === 'community';
  const isForumTab = activeWorkspaceTab === 'forum';
  const playingOwner = usePlaybackOwner();
  const transportIdentities = useTransportIdentitySources();

  // The graph mode is read above with the titlebar navigation because those
  // controls now participate in leaving full screen.
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
    (graphView !== 'normal' && isFullscreenMediaTab(activeWorkspaceTab)) ||
    (graphVisibilityByTab?.[activeWorkspaceTab] ??
      (activeWorkspaceTab === 'karaoke' ||
      activeWorkspaceTab === 'library' ||
      activeWorkspaceTab === 'share' ||
      // A forum is read top to bottom; a spectrum under the thread takes the
      // height the conversation needs. Still one switch away.
      activeWorkspaceTab === 'forum'
        ? false
        : isGraphViewOn));

  /**
   * The EQ pages put their graph ABOVE the page (layout A, the open floor,
   * Ivan 2026-09-25): the section pills and the Bands title row on top, the
   * graph under them, then the bands — each standing under the point on the
   * graph it moves (`MainContent`, `plotGeometry`). Only while there is a
   * graph beside the page to put there; off, or filling the column, the page
   * keeps its pills and its title as it always has.
   *
   * Every other page keeps its graph underneath: there the graph is a monitor
   * of what the page is doing, not the instrument the page is edited on.
   */
  const isGraphFirst =
    isEqGroupTab(activeWorkspaceTab) && showsGraph && !isGraphFullScreen;
  const [eqTitleSlot, setEqTitleSlot] = useState<HTMLElement | null>(null);
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
  // A Plus visualizer fills the graph edge to edge, so laid over a video it
  // only hides the picture. With one on the graph, the graph's full screen is
  // the visualizer alone and the video gets its own (see the double-click on
  // the video below); the standard visualizers still draw over a playing
  // video, see-through and all (Ivan, 2026-09-21). Karaoke keeps its stage
  // under the graph: that is its lyrics, and it has no other full screen.
  const isSceneOnGraph = useSceneLook() !== null;
  // The song the transport holds, paused or not: the one playing, else the one
  // that played last and still describes the same song. Keyed to playing
  // alone, every pause took the picture away and left a black card. Worse on
  // Karaoke, where a lyric press pauses for its count-in: the stage stopped
  // being the backdrop, went hidden, hiding cancelled the count-in, and the
  // song never came back (Ivan, 2026-09-23: "it stops and get black").
  const lastPlayingOwner = useLastPlayingOwner();
  const heldOwner = playingOwner ?? lastPlayingOwner;
  /**
   * The machine's own player, when it is the one making the sound.
   *
   * It wins the backdrop over whatever of ours played LAST — a Library song
   * paused an hour ago is not the song Spotify is playing now — but never over
   * one of ours that is playing, and never over Karaoke's stage, which is its
   * lyrics and whose count-in dies if the stage is hidden (see above).
   */
  // Two flags, not the register: read whole, it changes with the position and
  // re-rendered this entire tree on every seek-bar tick while music played.
  const isSystemPlaying = useIsTransportPlaying('system');
  const hasSystemTitle = useHasTransportTitle('system');
  const isSystemSounding = playingOwner === undefined && isSystemPlaying;
  const graphBackdropOwner =
    isGraphBackdropMode &&
    (!isSceneOnGraph || heldOwner === 'karaoke') &&
    (!isSystemSounding || heldOwner === 'karaoke')
      ? heldOwner
      : undefined;
  const showsMediaGraphBackdrop = graphBackdropOwner === 'media';
  const showsLibraryGraphBackdrop = graphBackdropOwner === 'library';
  const showsKaraokeGraphBackdrop = graphBackdropOwner === 'karaoke';
  // The same picture for the machine's own song, when none of ours holds the
  // backdrop and the machine has a song to show (Ivan, 2026-09-23: "when doing
  // expanded mode or fullscreen on system audio we can show the covert art to
  // same as we do for libarery"). A Plus scene fills the graph edge to edge,
  // so it takes this picture's place just as it takes the Library's.
  const showsSystemGraphBackdrop =
    isGraphBackdropMode &&
    !isSceneOnGraph &&
    !showsMediaGraphBackdrop &&
    !showsLibraryGraphBackdrop &&
    !showsKaraokeGraphBackdrop &&
    hasSystemTitle;

  // Off its tab a player stays for as long as it plays, hands over, or is the
  // last thing played — see `keepsPlayerMounted`. The picture under an
  // expanded graph counts as seen: a paused song there is on screen, not
  // behind another tab, and unmounting it blacked the card out.
  const lastTransportOwner = useLastTransportOwner();
  const keepVideoMounted = keepsPlayerMounted({
    isActive: isVideoTab || showsMediaGraphBackdrop,
    isPlaying:
      playingOwner === 'media' || transportIdentities.media?.isPlaying === true,
    isHandingOver: transportIdentities.media?.retainWhenHidden === true,
    isLastOwner: lastTransportOwner === 'media',
  });
  const keepLibraryMounted = keepsPlayerMounted({
    // The native DSP engine lives in this provider as well. If it has already
    // been opened, the visible DSP rack is an active consumer even though the
    // Library shelf itself is not the selected tab. So is the amp's open
    // queue deck (`playerWantsLibrary`).
    isActive:
      isLibraryTab ||
      isDspTab ||
      playerWantsLibrary ||
      showsLibraryGraphBackdrop,
    isPlaying:
      playingOwner === 'library' ||
      transportIdentities.library?.isPlaying === true,
    isHandingOver: transportIdentities.library?.retainWhenHidden === true,
    isLastOwner: lastTransportOwner === 'library',
  });
  const keepKaraokeMounted = keepsPlayerMounted({
    isActive: isKaraokeTab || showsKaraokeGraphBackdrop,
    isPlaying:
      playingOwner === 'karaoke' ||
      transportIdentities.karaoke?.isPlaying === true,
    isHandingOver: transportIdentities.karaoke?.retainWhenHidden === true,
    isLastOwner: lastTransportOwner === 'karaoke',
  });

  /**
   * The six places, drawn in the titlebar either side of the live output
   * meter — three on the left, three on the right.
   *
   * Above the workspace rather than on it. The meter is the one element that
   * makes this window look like itself and it already floats across the top;
   * putting the places in the same wrapper means the app's navigation lives
   * in its signature element and the workspace below gets its row back.
   *
   * Split, because all six on one end left the spectrum sitting a couple of
   * hundred pixels left of the window's middle while the wrapper around it was
   * perfectly centred — the one drawing in this app that is meant to look
   * centred was the one thing that was not. Share Audio belongs beside Online
   * Media because both move audio between computers rather than shape it.
   *
   * Built here rather than in the header markup only because it is long, and
   * the titlebar reads better as four things than as four things and two
   * lists.
   */
  const workspaceTabsLeft = (
    <WorkspaceTabStrip label={t('tabs.aria')}>
      {/* The one tab whose name is too long for its own strip. It shortens for
          the eye and not for anything else: the accessible name stays the full
          two words at every width, and the short label is a word out of them,
          so what is read aloud and what is on screen never disagree. */}
      <button
        type="button"
        role="tab"
        aria-selected={isVideoTab}
        aria-label={t('tabs.media')}
        className={`workspace-tab${isVideoTab ? ' is-active' : ''}`}
        onClick={() => selectTopWorkspaceTab('video')}
        onPointerEnter={() => preloadTabOnApproach('video')}
        onFocus={() => preloadTabOnApproach('video')}
      >
        <MenuIcon name="video" />
        <span className="workspace-tab__label">
          {isMediaTabOneWord ? t('tabs.mediaShort') : t('tabs.media')}
        </span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isShareTab}
        aria-label={t('tabs.share')}
        className={`workspace-tab${isShareTab ? ' is-active' : ''}`}
        onClick={() => selectTopWorkspaceTab('share')}
        onPointerEnter={() => preloadTabOnApproach('share')}
        onFocus={() => preloadTabOnApproach('share')}
      >
        <MenuIcon name="waveform" />
        <span className="workspace-tab__label">{t('tabs.share')}</span>
      </button>
      {/* Six places, not ten. The equaliser and everything that sets it
          are one tab with a row of pills inside — see EQ_GROUP_TABS.

          Last on this side, so it is the name against the meter's left edge
          and the rack is the name against its right: the two halves of one
          signal chain still touch, with the spectrum they are shaping between
          them. */}
      <button
        type="button"
        role="tab"
        aria-selected={isEqGroupTab(activeWorkspaceTab)}
        aria-label={t('tabs.eq')}
        className={`workspace-tab${
          isEqGroupTab(activeWorkspaceTab) ? ' is-active' : ''
        }`}
        onClick={() => selectTopWorkspaceTab(lastEqTab)}
        onPointerEnter={() => preloadTabOnApproach(lastEqTab)}
        onFocus={() => preloadTabOnApproach(lastEqTab)}
      >
        <MenuIcon name="layout" />
        <span className="workspace-tab__label">{t('tabs.eq')}</span>
      </button>
    </WorkspaceTabStrip>
  );
  const workspaceTabsRight = (
    <WorkspaceTabStrip label={t('tabs.aria')}>
      {/* First on this side, which keeps it next to the equaliser across the
          meter: the rack is the rest of the signal chain the EQ tab starts,
          and a user who has just set a curve looks for the compressor next —
          not past Library and Karaoke to the far end of the strip. */}
      <button
        type="button"
        role="tab"
        aria-selected={isDspTab}
        aria-label={t('tabs.dsp')}
        className={`workspace-tab${isDspTab ? ' is-active' : ''}`}
        onClick={() => selectTopWorkspaceTab('dsp')}
        onPointerEnter={() => preloadTabOnApproach('dsp')}
        onFocus={() => preloadTabOnApproach('dsp')}
      >
        <MenuIcon name="configure" />
        <span className="workspace-tab__label">{t('tabs.dsp')}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isLibraryTab}
        aria-label={t('tabs.library')}
        className={`workspace-tab${isLibraryTab ? ' is-active' : ''}`}
        onClick={() => selectTopWorkspaceTab('library')}
        onPointerEnter={() => preloadTabOnApproach('library')}
        onFocus={() => preloadTabOnApproach('library')}
      >
        <MenuIcon name="album" />
        <span className="workspace-tab__label">{t('tabs.library')}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isKaraokeTab}
        aria-label={t('tabs.karaoke')}
        className={`workspace-tab${isKaraokeTab ? ' is-active' : ''}`}
        onClick={() => selectTopWorkspaceTab('karaoke')}
        onPointerEnter={() => preloadTabOnApproach('karaoke')}
        onFocus={() => preloadTabOnApproach('karaoke')}
      >
        <MenuIcon name="microphone" />
        <span className="workspace-tab__label">{t('tabs.karaoke')}</span>
      </button>
      {/* Only in a build with a backend — every fork and every checkout
          without a .env has no gallery, board or Studio sharing to show, and
          a tab that opens an empty room is worse than no tab. */}
      {isAccountConfigured() && (
        <button
          type="button"
          role="tab"
          aria-selected={isCommunityTab}
          aria-label={t('tabs.plus')}
          className={`workspace-tab${isCommunityTab ? ' is-active' : ''}`}
          onClick={() => selectTopWorkspaceTab('community')}
          onPointerEnter={() => preloadTabOnApproach('community')}
          onFocus={() => preloadTabOnApproach('community')}
        >
          <MenuIcon name="plusTab" />
          <span className="workspace-tab__label">{t('tabs.plus')}</span>
        </button>
      )}
      {/* No Forum tab: the forum opens from the Help menu, beside the other
          ways to get help, and still fills the workspace like a tab. */}
    </WorkspaceTabStrip>
  );

  // WHICH playback workspace owns the native-window full screen, not merely
  // whether one does. Karaoke originated the control and Library and Online
  // Media share it so there can never be two, but as a bare boolean it read
  // `true` on all three at once: taking the Karaoke stage full screen and then
  // pressing Library handed Library a full-screen window it never asked for,
  // titlebar gone and its floating controls stacked over each other. Full
  // screen belongs to the surface that entered it, and a navigation leaves it
  // — the same rule the graph modes have always had.
  const [mediaFullScreenOwner, setMediaFullScreenOwner] = useState<
    TWorkspaceTab | undefined
  >(undefined);
  const isMediaFullScreen = mediaFullScreenOwner !== undefined;
  const mediaFullScreenRequestedRef = useRef(false);
  const [showAudioRestartRecommendation, setShowAudioRestartRecommendation] =
    useState(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  // Which page of the Account panel is open, or none. A page rather than a
  // flag because the leaderboard's guide opens it straight on the terms.
  const [accountDialogPage, setAccountDialogPage] = useState<
    TAccountPanelPage | undefined
  >();
  // A locked Plus look in the picker leads here: choosing one is a request to
  // see what Plus is and how to get it, not a selection. Only honoured when a
  // backend is configured — without one the panel has nothing to offer, and a
  // locked row never appears in the first place.
  useEffect(
    () =>
      subscribeAccountPanelRequests((page) => {
        if (isAccountConfigured()) {
          setAccountDialogPage(page);
        }
      }),
    [],
  );
  // The graph's notice that its look has a new version opens that scene's
  // page in the Plus tab (`GraphUpdateNotice.tsx`), and the welcome to Plus
  // opens the tab itself. Whoever asks wants to SEE it, so the Account panel
  // — open in front of the tab whenever this comes from paying — closes with
  // the request; "See the visualizers" used to land on the panel that had
  // sent the person to pay.
  useEffect(
    () =>
      subscribePlusTabRequests(() => {
        setAccountDialogPage(undefined);
        selectTopWorkspaceTab('community');
      }),
    [selectTopWorkspaceTab],
  );
  // The member's own AI asking to see the scene it is writing: answered for
  // the life of the window, since bringing the Studio up is one of the answers.
  useStudioAgent();
  // The welcome takes the Account panel's place the moment a membership
  // lands: it is the panel's own "you are Plus now", said larger, and the
  // panel underneath it was what the person had left to go and pay from.
  // Closing the welcome returns to the app, with nothing in front of it; the
  // panel, opened again, is the member's profile with the scene in it.
  const plusWelcome = usePlusWelcome();
  useEffect(() => {
    if (plusWelcome) {
      setAccountDialogPage(undefined);
    }
  }, [plusWelcome]);
  const [showProcessesDialog, setShowProcessesDialog] = useState(false);
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
  // Bumped when the engine's card is asked for again — see
  // `handleAskAboutEngine`. A card put away for the session comes back on a
  // press rather than staying away because it was dismissed once.
  const [engineAskCount, setEngineAskCount] = useState(0);
  // The engine is not running the output being listened to, which takes the
  // rack with it (`rackPlacement.ts`).
  //
  // Deliberately not every `isEngineOnOutput === false`: an output the engine
  // was never put on is one of those, and this gate also stops the Library
  // player's own copy of the rack — which processes its own audio and works
  // perfectly well on an output no engine is attached to. Widening it there
  // would silence the rack in the Library to describe the engine.
  const isEngineOff = engineTrouble?.kind === 'off';
  useEffect(() => {
    // Before the publish below, so the first rack of a launch already knows
    // where it may run (`rackPlacement.ts`): under the FluidEQ Engine,
    // FluidEQ switched off or the engine not running leaves it nowhere.
    setDspRackGate({
      engine: runningEngine ?? null,
      eqEnabled: isEnabled,
      engineOff: isEngineOff,
    });
  }, [runningEngine, isEnabled, isEngineOff]);
  useEffect(() => {
    // FluidEQ takes the rack away from the engine when it quits, so the DSP
    // page's own publish — which waits for the page to be opened — would
    // leave every launch running no rack until then.
    if (runningEngine === 'fluid') {
      publishSystemDspChain();
    }
  }, [runningEngine]);
  useEffect(() => {
    // A scene has to be compiled on the machine that plays it, so it is
    // compiled the moment it arrives rather than the first time somebody
    // watches it: measured at eleven seconds for one of the big ones, which
    // was eleven seconds of a still picture in the window.
    return startScenePrebuild();
  }, []);
  const [showEngineDialog, setShowEngineDialog] = useState(false);
  // Bumping this remounts the prerequisite notice, which is how a dismissed
  // one comes back. Without it the notice was a one-shot: close it once and
  // the only route to "Install Equalizer APO" was gone until the error
  // changed, which for a missing engine it never does.
  const [prereqNonce, setPrereqNonce] = useState(0);
  // The feature tour: the big slides, what this version brought first and
  // then the standing features. It is the launch notice; the changelog used
  // to open itself after an update and no longer does, because two panels on
  // top of each other on first run read as a malfunction. The changelog is
  // one click away inside the tour, and in the menu.
  const [showFeatureTour, setShowFeatureTour] = useState(() =>
    shouldShowFeatureTour(
      APP_VERSION,
      localStorage.getItem(FEATURE_TOUR_DISMISSED_KEY),
    ),
  );
  // Null when closed, otherwise how much of the changelog to show: `all`
  // from the menu and the tour's link, both requests to read the history.
  const [whatsNewScope, setWhatsNewScope] = useState<'latest' | 'all' | null>(
    null,
  );
  // What the rest of the machine is playing, on the bar when this app has
  // nothing of its own there. Mounted at the root because it is nobody's tab:
  // the sound is Spotify's or a browser's, and the curve on screen is shaping
  // it just the same.
  useSystemMediaSource();
  // The Smart EQ song-memory recorder: same lifetime and the same reason as
  // the line above it. A recording must not end because somebody switched
  // tabs, so this is hosted here rather than inside the EQ page.
  useSongEqSessionHost();

  // Whether the two ends of the titlebar leave the meter between them its
  // whole width with the tagline and the creature still in them. The bar's
  // own element carries the answer as `data-crowded` — see the hook.
  const titlebarRef = useRef<HTMLElement | null>(null);
  const titlebarLeftRef = useRef<HTMLDivElement | null>(null);
  const titlebarRightRef = useRef<HTMLDivElement | null>(null);
  useTitlebarRoom(titlebarRef, titlebarLeftRef, titlebarRightRef);

  // `showsGraph` and the backdrop it decides are worked out beside the players'
  // mount rules above, which have to know whether a paused player is on
  // screen under the graph.
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
   * Hiding the graph leaves the mode it was being drawn in.
   *
   * Expanded and full screen are ways of SHOWING the graph, and switching the
   * graph off while in one of them left the mode standing over a page with
   * nothing drawn on it — on Media that is a video with the player's own
   * chrome suppressed for a spectrum that is not there. There is nothing to
   * expand once the graph is off, so the view goes back to standard and the
   * page it was covering is a page again.
   *
   * Every tab, not only the two the graph is drawn THROUGH. It is worst on
   * those — a video with the player's chrome suppressed for a spectrum that
   * is not there — but the rule is the same wherever it happens: no graph, no
   * graph mode.
   *
   * What that costs, written down because it is not obvious from the code:
   * the mode is one global setting rather than one per tab, so arriving on a
   * tab whose graph is closed returns the view to standard too, and going
   * back does not put it on again. The alternative is a mode left standing on
   * a page with nothing drawn on it, which is the bug this replaces.
   */
  useEffect(() => {
    if (!showsGraph && graphView !== 'normal') {
      exitGraphFullScreen();
    }
  }, [graphView, showsGraph]);

  // Karaoke has one fullscreen layout. Entering it from the graph changes only
  // whether the graph is drawn over that layout; it does not create a second
  // set of stage offsets, playlist sizing or chord positions.
  const isKaraokeGraphFullScreen =
    showsKaraokeGraphBackdrop && graphView === 'fullscreen';
  const isKaraokeGraphOverlay = showsKaraokeGraphBackdrop;
  // Owner-scoped, not merely "some surface is full screen": between the tab
  // changing and the effect below releasing the window there is one render in
  // which the outgoing owner is still recorded, and these classes must not
  // dress the incoming tab in the outgoing tab's full-screen layout.
  const isMediaSurfaceFullScreen =
    mediaFullScreenOwner === activeWorkspaceTab || isKaraokeGraphFullScreen;
  const isKaraokeSurfaceFullScreen =
    (isKaraokeTab && mediaFullScreenOwner === 'karaoke') ||
    isKaraokeGraphFullScreen;

  /** The window itself is full screen, so the titlebar is not on screen. */
  const isGraphAppFullScreen =
    graphView === 'fullscreen' && showsGraph && !isMediaFullScreen;
  // Full screen with the top bar kept. Everything below reads this rather than
  // the mode alone, so "full screen" and "full screen with the bar" cannot end
  // up disagreeing about which pieces are on screen.
  const hasFullScreenTopBar = useFullScreenTopBar();
  const isChromeHidden =
    (isGraphAppFullScreen || isMediaFullScreen) && !hasFullScreenTopBar;
  /**
   * Full screen, whether or not the top bar is showing.
   *
   * `isChromeHidden` is a narrower question — it asks whether the chrome is
   * getting out of the way, which the top-bar toggle can veto. The transport
   * bar floats over the stage in every full screen: the picture is meant to
   * reach the bottom edge, and a reserved strip there is a band of background
   * under a stage that should have filled it.
   */
  const isAppFullScreen = isGraphAppFullScreen || isMediaFullScreen;
  useAppFullMark(isAppFullScreen);
  const isPlayerVisFull = usePlayerVisFull();
  /**
   * Whether anything in here is actually claiming the full-screen window.
   *
   * Read from the window's own state messages, which arrive from outside
   * React and therefore cannot see this render's values — hence a ref,
   * rewritten every render. Its job is to answer one question: the window
   * says it is full screen, but is that because we asked?
   *
   * When the answer is no the two have come apart, and they can: a renderer
   * reload leaves the window exactly as it was while every piece of state in
   * here starts again at nothing. What that looked like was a full-screen
   * window with the windowed layout drawn in it, and a double-click that
   * appeared to do nothing because it was the one putting the app back IN
   * step — which is the "I have to do it twice" this exists to end.
   */
  const windowFullScreenClaimRef = useRef(false);
  // The player's visualizer counts as a claim too: its picture on the whole
  // screen is the window changing, and without this the reconciliation below
  // would take the window straight back out of the mode it was just put in.
  windowFullScreenClaimRef.current = isAppFullScreen || isPlayerVisFull;
  // Which split the divider moves: the tab's own; on a short window and a
  // page other than the EQ's, that window's (`shortWindowPaneKey`); and on an
  // EQ page with its graph above it, the one below the graph
  // (`belowGraphPaneKey`), which is a different pane from the one the tab's
  // own share was chosen for.
  const isShortWindow = useMediaQuery(SHORT_WINDOW_QUERY);
  let paneKey: string = activeWorkspaceTab;
  if (isGraphFirst) {
    paneKey = belowGraphPaneKey(activeWorkspaceTab);
  } else if (isShortWindow && !isEqGroupTab(activeWorkspaceTab)) {
    paneKey = shortWindowPaneKey(activeWorkspaceTab);
  }

  // Watched only in full screen, and stopped on the way out — see the store for
  // why leaving it running would strand a faded workspace.
  const isChromeIdle = useIsChromeIdle();
  // The bar answers to the pointer, not to the clock — see `idleChrome`.
  const isPointerNearChrome = useIsPointerNearChrome();
  // The drawer tabs answer the side edges the same way.
  const isPointerNearSideChrome = useIsPointerNearSideChrome();

  // Published on `#root` for the stylesheets that have to know: a panel over
  // a floating bar clears it while it is up and takes the room back when it
  // fades, and CSS cannot read a React flag.
  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.toggle(
      'is-chrome-idle',
      isAppFullScreen && (!isPointerNearChrome || isChromeIdle),
    );
    return () => root?.classList.remove('is-chrome-idle');
  }, [isAppFullScreen, isChromeIdle, isPointerNearChrome]);
  // And the same for the two drawer tabs, which are the only chrome that
  // lives on the vertical edges. Kept apart from the flag above so that
  // reaching for a panel does not also summon the header and the transport.
  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.toggle(
      'is-side-chrome-awake',
      isAppFullScreen && isPointerNearSideChrome,
    );
    return () => root?.classList.remove('is-side-chrome-awake');
  }, [isAppFullScreen, isPointerNearSideChrome]);
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
    // `isChromeHidden` as well: full screen fades the transport bar too, and a
    // full-screen surface with no graph on it would otherwise have nothing
    // watching for the stillness that fades it.
    watchChromeIdle(showsGraph || isMediaFullScreen || isChromeHidden);
    return () => watchChromeIdle(false);
  }, [isChromeHidden, isMediaFullScreen, showsGraph]);

  /** `undefined` leaves full screen; a tab takes it, and owns it. */
  /**
   * Take the window full screen when the graph asks for its largest view.
   *
   * Full screen rather than maximised, and that is the point of the mode: the
   * taskbar goes, so a video or a spectrum has the whole glass. FluidEQ's own
   * header stays on top of it.
   *
   * Registered here rather than done in the store, because it is an IPC call
   * and a layout preference should not have to know the shape of the app's API
   * to hold a value. The store says *what* it wants; this says how.
   */
  /**
   * THE ONE WAY THIS APP ASKS FOR A FULL-SCREEN WINDOW.
   *
   * Both routes to the mode go through here — the graph asking for its
   * largest view, and a player taking the shared media surface — so the claim
   * the window's own state messages are reconciled against is written in the
   * same breath as the request that creates it. Two callers each doing their
   * own IPC is how the app and the window came to disagree in the first
   * place: whichever of them spoke last, nothing recorded that anybody had.
   */
  const requestWindowFullScreen = useCallback((next: boolean) => {
    windowFullScreenClaimRef.current = next;
    return window.electron.ipcRenderer.setWindowFullScreen(next);
  }, []);

  // The graph goes out of sight while the window changes size for it and
  // fades in once the page is drawn at the new size (`graphArrival.ts`):
  // main answers once it has moved the window, and the page's own size says
  // when that has reached it.
  useEffect(() => {
    onWindowFullScreenChange((next) => {
      const moved = requestWindowFullScreen(next);
      holdGraphUntil(moved.then(untilViewportIsWindow).then(afterNextFrame));
      moved.catch((e) => {
        reportError('Could not change the window to full screen', e);
      });
    });
    return () => onWindowFullScreenChange(() => undefined);
  }, [requestWindowFullScreen]);

  const applyMediaFullScreen = useCallback(
    async (owner: TWorkspaceTab | undefined) => {
      const next = owner !== undefined;
      mediaFullScreenRequestedRef.current = next;
      setMediaFullScreenOwner(owner);
      try {
        const applied = await requestWindowFullScreen(next);
        mediaFullScreenRequestedRef.current = next && applied;
        setMediaFullScreenOwner(next && applied ? owner : undefined);
      } catch (error) {
        mediaFullScreenRequestedRef.current = false;
        setMediaFullScreenOwner(undefined);
        reportError('Could not change the media surface full screen', error);
      }
    },
    [requestWindowFullScreen],
  );

  // Ctrl+F and Ctrl+S always mean graph fullscreen and expanded mode in a
  // playback workspace. This listener also covers Library and Karaoke when
  // their normal per-tab graph is hidden, where FrequencyResponseChart has no
  // mounted listener of its own to hear either shortcut. The player's explicit
  // fullscreen controls use the shared media surface instead; separate
  // commands, separate visible results, all App-owned.
  useEffect(() => {
    const isMediaTab = isFullscreenMediaTab(activeWorkspaceTab);
    if (!isMediaTab && !isMediaFullScreen) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      // Reading help must not toggle the playback surface behind its modal.
      if (document.querySelector('dialog.help-guide[open]')) {
        return;
      }
      const shortcut = event.key.toLowerCase();
      const wantsToggle =
        isMediaTab &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.repeat &&
        (shortcut === 'f' || shortcut === 's');
      const wantsExit = event.key === 'Escape' && isMediaFullScreen;
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
      if (wantsExit) {
        applyMediaFullScreen(undefined);
        return;
      }

      // Switching from the no-graph media surface to a graph mode must not
      // bounce the BrowserWindow out and back in. Transfer ownership in React,
      // then let the graph store apply the requested view; for Ctrl+F the OS
      // window is already in the requested state.
      if (isMediaFullScreen) {
        mediaFullScreenRequestedRef.current = false;
        setMediaFullScreenOwner(undefined);
      }
      setActiveTabGraphVisibility(true);
      if (shortcut === 's') {
        toggleGraphExpanded();
      } else {
        toggleGraphFullScreen();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    activeWorkspaceTab,
    applyMediaFullScreen,
    isMediaFullScreen,
    setActiveTabGraphVisibility,
  ]);

  /**
   * CHANGING WORKSPACE PAGES LEAVES FULL SCREEN — ANY PAGE, NOT JUST A
   * NON-PLAYBACK ONE.
   *
   * This used to release the window only when the new tab was outside the
   * three playback workspaces, on the reasoning that they share one full
   * screen so there is nothing to hand over. But sharing the *window* is not
   * sharing the *layout*: Karaoke full screen is a lyric stage with the
   * titlebar gone, and arriving on Library still in it gave that tab a
   * hidden titlebar with its own floating controls piled into the space —
   * exactly the "the tab press did nothing" that `selectTopWorkspaceTab`
   * already prevents for the graph modes. So the owner is compared to the
   * open tab, and any mismatch leaves.
   */
  useEffect(() => {
    if (
      mediaFullScreenOwner !== undefined &&
      mediaFullScreenOwner !== activeWorkspaceTab
    ) {
      applyMediaFullScreen(undefined);
    }
  }, [activeWorkspaceTab, applyMediaFullScreen, mediaFullScreenOwner]);

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
   * The player somebody was using when the window last closed.
   *
   * Each of the three below becomes eligible to mount on its first visit and
   * is disposed off its tab once it is silent and no longer the last thing
   * played. The tab is remembered but a disposed player is not live, so coming
   * back on the EQ, DSP or Config tab — which is most restarts — left every
   * player unmounted, nothing describing itself to the bar, and the foot of
   * the window reading "Nothing playing" over a queue that was sitting in
   * storage waiting to be resumed. What was missing was not the memory: the
   * library's queue, the karaoke session and the Media tab's page each restore
   * themselves perfectly well the moment they exist. Nobody was mounting them.
   *
   * One of them, not all three: this is "what was I last listening to", and
   * bringing up a browser engine and a karaoke session alongside the queue
   * somebody actually left would be three players restored to answer a
   * question about one. Each restores paused — the point is the transport
   * being there to press, not sound arriving unasked at launch.
   *
   * Held in state purely to be read once. The answer is a fact about how the
   * window opened; re-reading storage after that would be wasted work and could
   * change the value under flags which have already gone true.
   */
  const [restoredOwner] = useState(readRememberedTransportOwner);
  // Once visited, the Media tab is eligible to reconstruct its guest. A silent
  // hidden browser stays only while it is the last thing played.
  const [hasOpenedVideo, setHasOpenedVideo] = useState(
    () => restoredOwner === 'media',
  );
  // Library follows the same eligibility rule. Its providers survive off-tab
  // while a deck is making sound, or while its queue is the last thing played.
  const [hasOpenedLibrary, setHasOpenedLibrary] = useState(
    () => restoredOwner === 'library',
  );
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
  const revealPlayingTrack = useCallback(
    (track: ILibraryTrack) => {
      selectTopWorkspaceTab('library');
      setLibraryReveal((current) => ({
        albumId: albumKey(track),
        trackId: track.id,
        nonce: (current?.nonce ?? 0) + 1,
      }));
    },
    [selectTopWorkspaceTab],
  );
  // Karaoke keeps a playing audio element across a tab switch. Its microphone,
  // canvases and editing tools belong to the visible tab and are discharged.
  const [hasOpenedKaraoke, setHasOpenedKaraoke] = useState(
    () => restoredOwner === 'karaoke',
  );

  /**
   * A song was sent over from the Library tab.
   *
   * App's whole share of the handoff is moving the reader and mounting the
   * destination; `KaraokeWorkspace` drains the queue itself. Both halves are
   * needed and neither is enough: without the mount there is nobody to drain
   * it, and without the switch the song arrives on a tab nobody is looking
   * at — a menu item that appears to have done nothing.
   *
   * The queue is what is watched rather than an event, so a file sent before
   * the workspace has ever been mounted still lands. See `karaokeHandoff.ts`.
   */
  const hasPendingKaraokeFiles = useHasPendingKaraokeFiles();
  useEffect(() => {
    if (!hasPendingKaraokeFiles) {
      return;
    }
    setHasOpenedKaraoke(true);
    selectTopWorkspaceTab('karaoke');
  }, [hasPendingKaraokeFiles, selectTopWorkspaceTab]);

  // The editor's height when the drag began, so every move is measured from one
  // fixed point rather than accumulated.
  const graphDragStart = useRef(0);
  // Read by the player, which has to stop swallowing pointer events for the
  // length of a drag — see VideoBrowser.scss.
  const [isResizingPanes, setIsResizingPanes] = useState(false);

  const handleGraphResizeStart = useCallback(() => {
    graphDragStart.current = getEditorHeight(paneKey);
    setIsResizingPanes(true);
  }, [paneKey]);

  /**
   * Move the divider.
   *
   * What is set is the page's pane — the graph simply takes what is left.
   * With the graph under the page, dragging down gives the page more and the
   * graph less; with the graph above it (`isGraphFirst`) the page is under the
   * divider, so dragging down gives it LESS. Either way the handle goes where
   * it is carried, and both ends of the drag stay live because the pane being
   * sized is the one whose content can actually vary.
   */
  const handleGraphResizeDrag = useCallback(
    (deltaY: number) => {
      setEditorHeight(
        clampToWindow(
          graphDragStart.current + (isGraphFirst ? -deltaY : deltaY),
        ),
        paneKey,
      );
    },
    [paneKey, isGraphFirst],
  );

  const handleGraphResizeEnd = useCallback(() => {
    setIsResizingPanes(false);
    commitPaneSizes();
  }, []);

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
    if (!isLibraryTab && !playerWantsLibrary) {
      return undefined;
    }

    setHasOpenedLibrary(true);
    return undefined;
  }, [isLibraryTab, playerWantsLibrary]);

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

    /**
     * THE WINDOW IS THE AUTHORITY ON WHETHER IT IS FULL SCREEN.
     *
     * This used to believe it only while a request of ours was in flight,
     * which left the app free to disagree with the window for as long as it
     * liked — and it did. Two states for one fact is the bug Ivan named: the
     * window full screen, this app drawing the windowed layout, and a
     * full-screen press that appeared to do nothing because what it actually
     * did was put the two back in step.
     *
     * Both directions are reconciled here, which is what makes this the one
     * place that decides:
     *
     *  - Not full screen: nothing may still own a full-screen surface. That
     *    covers the window being taken out of it by any route we did not ask
     *    about, F11 and the system menu among them — and on a Mac the green
     *    button, which is on screen over every full-screen window there. A
     *    window that WAS full screen and left it while something in here still
     *    claimed it was taken out from under that claim, and every claim goes:
     *    the graph's largest view and the player's visualizer as well as the
     *    media surface, or they would draw their full-screen layout in a
     *    window.
     *
     *  - Full screen with nothing in here claiming it: the two have come
     *    apart, and the window is the half that is wrong — no tab is drawing
     *    a full-screen layout, so it is showing a windowed one with the
     *    titlebar gone. Put it back. Unless it is the listener's own full
     *    screen (`isSystemFullScreen`): a Mac's green button takes the whole
     *    app full screen, windowed layout and all, and that is the mode they
     *    asked for, not a disagreement.
     *
     * Fed from two places, because the window outlives the page. Every state
     * change the window announces comes through the listener below; the read
     * on mount is for the announcement that was made before there was a page
     * to hear it — main pushes the state on `did-finish-load`, which is before
     * React has mounted this listener, so a renderer reload inside full screen
     * kept the window and lost the flag. Measured: 1440px tall with the
     * windowed layout in it, and a double-click that only repaired the
     * disagreement.
     */
    /** The last announcement's answer, to tell leaving from never having been. */
    let wasFullScreen = false;
    const reconcileWindowState = (state: Partial<IWindowState> | undefined) => {
      if (!mounted) {
        return;
      }
      setIsWindowMaximized(Boolean(state?.isMaximized));
      // What the window's own edge is drawn from (`body::after` in App.scss):
      // whether there is an edge to light at all, and the radius Windows
      // clips the corner to, which is in the system's pixels while the page
      // is in the zoom's. On the root element rather than in React state
      // because the player draws no React tree of the app's at all.
      const root = document.documentElement;
      root.classList.toggle(
        'is-window-filled',
        state?.isMaximized === true || state?.isFullScreen === true,
      );
      const zoom = state?.zoom;
      if (typeof zoom === 'number' && zoom > 0) {
        root.style.setProperty('--window-zoom', String(zoom));
      }
      if (state?.isFullScreen === true) {
        wasFullScreen = true;
        if (
          !windowFullScreenClaimRef.current &&
          state.isSystemFullScreen !== true
        ) {
          window.electron.ipcRenderer
            .setWindowFullScreen(false)
            .catch(() => undefined);
        }
        return;
      }
      // Only on the way out, never merely while windowed: a claim written a
      // moment before the window has gone full screen for it is the page
      // entering the mode, and the announcement it is racing says nothing
      // about the claim.
      if (wasFullScreen && windowFullScreenClaimRef.current) {
        if (getGraphView() === 'fullscreen') {
          exitGraphFullScreen();
        }
        setPlayerVisFull(false);
      }
      wasFullScreen = false;
      mediaFullScreenRequestedRef.current = false;
      setMediaFullScreenOwner(undefined);
    };

    window.electron.ipcRenderer
      .getWindowState()
      .then(reconcileWindowState)
      .catch(() => {
        // The window state is only visual; keep the restore control usable if
        // the main process is not ready during a hot reload.
      });

    const unsubscribe = window.electron.ipcRenderer.on(
      'window-state-changed',
      (...args: unknown[]) => {
        reconcileWindowState(args[0] as Partial<IWindowState> | undefined);
      },
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

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
      await window.electron.ipcRenderer.showNativeMessage(error);
      return false;
    }
    localStorage.setItem(APO_RESTART_RECOMMENDED_KEY, 'true');
    setShowAudioRestartRecommendation(true);
    return true;
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
    const confirmed = await window.electron.ipcRenderer.confirmNative(
      'Reinstall Equalizer APO?\n\n' +
        'Its setup will open so you can re-select which audio devices to ' +
        'equalise. Windows will ask for administrator permission, and your ' +
        'computer will need to restart afterwards.\n\n' +
        `Your ${PRODUCT_NAME} settings and profiles are not affected.`,
      t('whatsNew.ok'),
      t('config.cancel'),
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
      await window.electron.ipcRenderer.showNativeMessage(
        `This copy of ${PRODUCT_NAME} has no Equalizer APO installer inside it.\n\n` +
          "Opening Equalizer APO's own download page instead. Install it from " +
          `there and ${PRODUCT_NAME} will find it.`,
      );
      return;
    }

    if (outcome === 'not-started') {
      await window.electron.ipcRenderer.showNativeMessage(
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
      await window.electron.ipcRenderer.showNativeMessage(error);
    }
  };

  // Stable, so the DSP page it is handed to keeps its memo.
  const handleOpenEngineDialog = useCallback(() => {
    // Asked again on the way in: the answer can have changed since the window
    // opened — Equalizer APO installed from outside, the engine attached to a
    // new output — and this dialog is where that is acted on.
    refreshEngineStatus();
    setShowEngineDialog(true);
  }, [refreshEngineStatus]);

  /**
   * Put the chosen engine in place, in the order that leaves the machine
   * usable if any step of it fails.
   *
   * Install first, then record the choice: a preference naming an engine that
   * is not on disk is the `FLUID_ENGINE_NOT_INSTALLED` wall, and reaching it
   * because the user closed a Windows prompt would be this dialog's own doing.
   * Equalizer APO is the other way round — its setup is a separate program
   * that needs a Windows restart, so the choice is saved first and the setup
   * run after, and the config it will read is already on disk when it is.
   */
  /**
   * The status is re-read here rather than taken from the hook's snapshot:
   * the dialog can have been open since before either engine was installed,
   * and acting on a stale `installed: false` runs an installer the machine
   * does not need — which is how switching back to Equalizer APO used to
   * re-run its installer and ask for a reboot.
   */
  const handleApplyAudioEngine = async (engine: TAudioEngine) => {
    const fresh = await getAudioEngineStatus().catch((error) => {
      reportError('the audio engine status could not be read', error);
      return undefined;
    });
    const needed = engineInstallsNeeded(engine, fresh);
    if (needed.fluid) {
      const result = await installFluidEngine();
      if (result.declined) {
        throw new Error('declined');
      }
      if (!result.ok) {
        throw new Error(result.error ?? 'engine setup failed');
      }
    }
    try {
      await setAudioEngine(engine);
    } catch (error) {
      if (!isAwaitingApoInstall(error, needed)) {
        throw error;
      }
    }
    if (needed.apo) {
      await startEqualizerApoInstall();
      localStorage.setItem(APO_RESTART_RECOMMENDED_KEY, 'true');
      setShowAudioRestartRecommendation(true);
    }
    notifyAudioEngineChanged();
    await refreshEngineStatus();
    performHealthCheck();
    // The dialog stays open: comparing the two engines is done by switching
    // back and forth while something plays, and a dialog that closed on
    // every Apply made each comparison a trip through the menu. The blocking
    // first-run copy still goes away by itself, because choosing an engine
    // is what un-blocks it.
  };

  const handleApoAction = (action: TApoAction) => {
    setShowEngineDialog(false);
    if (action === 'reconfigure') {
      handleConfigureEqualizerApo();
    } else if (action === 'settings') {
      handleOpenEqualizerApoSettings();
    } else {
      handleReinstallApo();
    }
  };

  /** One output through the engine, from the notice that says it is not. */
  const handleAttachFluidEngine = async (guid: string) => {
    const result = await attachFluidEngine(guid);
    if (result.ok) {
      await refreshEngineStatus();
      performHealthCheck();
    }
    return result;
  };

  /**
   * The single button on the blocking `FLUID_ENGINE_NOT_INSTALLED` banner.
   *
   * Returns the result rather than swallowing it: a declined Windows prompt
   * or an outright failure is an answer the banner has to show, not silence
   * that leaves the button looking like it did nothing.
   */
  const handleInstallFluidEngine = async (): Promise<IEngineSetupResult> => {
    const result = await installFluidEngine();
    if (result.ok) {
      notifyAudioEngineChanged();
      await refreshEngineStatus();
      performHealthCheck();
    }
    return result;
  };

  /**
   * The banner's Retry asks the engine again before checking health.
   *
   * The check alone answers from what the engine last said about itself, so
   * after a moment when it could not be asked — Windows Audio restarting, or
   * not up yet at login — Retry kept showing the same wall until the app was
   * restarted.
   */
  const handlePrereqRetry = async () => {
    await refreshEngineStatus();
    performHealthCheck();
  };

  /**
   * The troubleshooter's own "put the engine back" step.
   *
   * It has no inline error slot of its own — unlike the blocking banner and
   * the output notice, its steps are a list of buttons with no room kept for
   * a result line — so a declined or failed attempt is surfaced through the
   * native message box the rest of the app already uses for this kind of
   * one-shot outcome.
   */
  const handleTroubleshootEnableEngine = async () => {
    const result = await handleInstallFluidEngine();
    if (!result.ok) {
      await window.electron.ipcRenderer.showNativeMessage(
        t(result.declined ? 'engine.declined' : 'engine.failed'),
      );
    }
  };

  /** One output off the engine again, with its old effect chain restored. */
  const handleDetachFluidEngine = async (guid: string) => {
    const result = await detachFluidEngine(guid);
    if (result.ok) {
      notifyAudioEngineChanged();
      await refreshEngineStatus();
      performHealthCheck();
    }
    return result;
  };

  /**
   * The troubleshooter's "take it off this output" step.
   *
   * The output is resolved here rather than passed down: the troubleshooter
   * has no device list of its own, and "this output" means the one Windows is
   * playing through — the same device the rest of the shell is showing. An
   * output list that cannot be read, a declined prompt and an outright
   * failure all come back through the same native message box the Enable step
   * uses, because this panel's steps have no inline slot for a result line.
   */
  const handleTroubleshootRemoveEngine = async () => {
    const devices = await getAudioDevices().catch((error) => {
      reportError('the audio outputs could not be read', error);
      return undefined;
    });
    const current = devices?.find((device) => device.isDefault);
    if (!current) {
      await window.electron.ipcRenderer.showNativeMessage(
        t('engine.detachFailed'),
      );
      return;
    }
    const result = await handleDetachFluidEngine(current.guid);
    if (!result.ok) {
      await window.electron.ipcRenderer.showNativeMessage(
        t(result.declined ? 'engine.declined' : 'engine.detachFailed'),
      );
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

  /**
   * The restart itself, run by the card's own button through
   * `useAudioRestart`, which owns it so it outlives the card. The card shows
   * the outcome, so there is no message box here any more.
   */
  const performWindowsAudioRestart =
    async (): Promise<IAudioRestartOutcome> => {
      const outcome = await window.electron.ipcRenderer.restartWindowsAudio();
      if (outcome.ok) {
        localStorage.removeItem(APO_RESTART_RECOMMENDED_KEY);
        setShowAudioRestartRecommendation(false);
        /**
         * Audiosrv came back; the loopback stream did not necessarily come with it.
         *
         * Chromium can keep the old capture track `live` after Windows invalidates
         * its endpoint, feeding silence forever. A retry is not enough because the
         * capture sees that live track and correctly refuses to open a duplicate.
         * The output-change path is the owner of a full rebind: it removes the
         * track listeners, stops every track, disconnects the analyser graph,
         * closes its AudioContext and clears its pump before opening a fresh
         * loopback. Reusing that path also means repeated restart notifications
         * are coalesced instead of accumulating streams or timers.
         */
        window.dispatchEvent(new CustomEvent('fluideq-output-changed'));
        performHealthCheck();
      }
      return outcome;
    };

  /**
   * This app's engine in place of the one installed, run by the update
   * notice's own button through `useEngineUpdate`, which owns it so it
   * outlives the notice.
   *
   * It ends in a restart of Windows audio, so it is followed by what a
   * restart is followed by: the capture rebuilt on the restarted output, and
   * the health check. The status is read again whatever the answer, so the
   * notice is offered only while there is still an engine to install.
   */
  const afterEngineChanged = async (outcome: IAudioRestartOutcome) => {
    if (outcome.ok) {
      localStorage.removeItem(APO_RESTART_RECOMMENDED_KEY);
      setShowAudioRestartRecommendation(false);
      window.dispatchEvent(new CustomEvent('fluideq-output-changed'));
      await refreshState();
    }
    await refreshEngineStatus();
    return outcome;
  };
  const performEngineUpdate = async (): Promise<IAudioRestartOutcome> =>
    afterEngineChanged(await updateFluidEngine());
  // Main's own repair of one output, which ends the way an update does.
  const performEngineRepair = async (
    guid: string,
  ): Promise<IAudioRestartOutcome> =>
    afterEngineChanged(await repairFluidEngineOutput(guid));

  const { audioRestart, engineUpdate, repairEngine, suppressAudioNotices } =
    useEngineMaintenance(
      engineStatus?.engine === 'fluid' && engineStatus.fluidUpdateReady,
      performWindowsAudioRestart,
      performEngineUpdate,
      performEngineRepair,
    );
  const handleRestartWindowsAudio = audioRestart.open;
  // The restart and capture notices below hold the corner notices back
  // while they are up (`noticeTurn.ts`).
  useNoticeClaim(
    'audioRestart',
    !suppressAudioNotices &&
      (showAudioRestartRecommendation ||
        (Boolean(captureError) && !isCaptureNoticeHidden)),
  );
  // Never restarted by itself. The engine on the output being listened to
  // and Windows not running it used to get Windows audio restarted the
  // moment sound was heard — once a session, without a press — and that
  // restart is an elevated run of the setup helper, so every change of
  // output to one Windows had built before the engine was on it put a
  // Windows prompt up with nobody having asked. The trouble card asks
  // instead: its Restart button is the one thing that runs it.
  /**
   * The bypassed-engine card's own button: move the engine to another of the
   * output's effect slots, because Windows is playing that output through a
   * chain it is not in. Pressed, never automatic — one Windows prompt.
   */
  const handleTryAnotherSlot = (guid: string) => {
    reportInfo(
      `Moving the engine on ${guid} to another slot: it was asked for, on an ` +
        'output whose sound has never reached the engine',
    );
    repairEngine(guid).catch((error) =>
      reportError('The engine could not be moved to another slot', error),
    );
  };

  /**
   * The rack card's own button: put this app's engine in place.
   *
   * A rack the engine could not start is the one trouble a restart of
   * Windows audio cannot mend — it brings back the same engine, which fails
   * the same way. A user with a half-installed engine hit exactly that: the
   * EQ played, every DSP effect was off, the card's restart did nothing, and
   * what mended it was this same step found by hand on the help page.
   */
  /**
   * The side bar's switch, pressed back on while it reads off because the
   * engine is not reaching this output.
   *
   * It asks; it never installs. Every repair on the engine's card is an
   * elevated run of the setup helper, so running one on a switch press would
   * put a Windows prompt up each time the switch was touched — for nothing,
   * most times, since the card already offers only the repair that fits the
   * fault. Where there is no card, the engine's own dialog is where an engine
   * is installed or swapped, and it says what is on this machine first.
   */
  const handleAskAboutEngine = () => {
    if (engineTrouble !== undefined) {
      setEngineAskCount((count) => count + 1);
      return;
    }
    handleOpenEngineDialog();
  };

  const handleInstallEngineForTrouble = () => {
    handleTroubleshootEnableEngine().catch((error) =>
      reportError('The engine could not be put in place', error),
    );
  };

  // Where Windows has never created the engine on the output, a restart
  // cannot help; putting the install back, or moving the engine to a slot
  // the driver builds, can — the slot ladder, bounded and silent by design. Keyed by the slot
  // the helper reports, so each rung is asked for once.
  const troubledSlot =
    engineTrouble?.kind === 'off'
      ? engineStatus?.fluid.endpoints.find((endpoint) =>
          sameEndpoint(endpoint.guid, engineTrouble.device.guid),
        )?.slot
      : undefined;
  const { isTryingSlots } = useRepairWhenEngineNeverRan(
    engineTrouble,
    suppressAudioNotices,
    repairEngine,
    troubledSlot,
  );
  // What the window shows before the page has painted and inside the strip a
  // resize opens — the app's own floor rather than a pane of bare glass.
  useWindowFloor();

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
  /** As large as it goes, by either route. */
  const isWindowFilled = isWindowMaximized || isAppFullScreen;

  /** Out of full screen, whichever kind of full screen it is. */
  const leaveFullScreen = useCallback(() => {
    if (isMediaFullScreen) {
      applyMediaFullScreen(undefined).catch(() => undefined);
      return;
    }
    exitGraphFullScreen();
  }, [applyMediaFullScreen, isMediaFullScreen]);

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
    handleToggleMaximizeWindow().catch(() => undefined);
  };

  // No engine chosen yet. Its own name because it is answered by a dialog
  // rather than by the red banner every other blocking failure raises.
  const isEngineUnchosen =
    isBlockingError && globalError?.code === ErrorCode.AUDIO_ENGINE_NOT_CHOSEN;

  // Undefined until main answers, and while no engine has been chosen — the
  // actions menu then shows the status alone rather than guessing at an
  // engine.
  const engineName = engineStatus?.engine
    ? engineDisplayName(engineStatus.engine, t)
    : undefined;

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
              <div className="workspace-header__tagline">
                {t('app.tagline')}
              </div>
            </div>
          </div>
          {workspaceTabsLeft}
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
          {workspaceTabsRight}
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
              engineState={engineState}
              engineName={engineName}
              engineVersion={
                runningEngine === 'fluid'
                  ? engineStatus?.fluid.dllVersion
                  : undefined
              }
              onFix={() => {
                // The pill is the only thing left on screen saying something
                // is wrong once its card has been put away with "Not now", so
                // it has to be the way back to the card that says why and
                // offers the repair. It used to re-check the prerequisites
                // only, which on the commonest trouble — part of the engine
                // failing to start — did nothing anybody could see.
                handleAskAboutEngine();
                setPrereqNonce((n) => n + 1);
              }}
              onOpenEngine={handleOpenEngineDialog}
              onTroubleshoot={() => setShowTroubleshooter(true)}
              onRestartAudio={handleRestartWindowsAudio}
              onImportEq={handleImportEq}
              onImportImpulse={handleImportConvolution}
              onProcesses={() => setShowProcessesDialog(true)}
              onSupport={() => setShowSupportDialog(true)}
              onAccount={
                isAccountConfigured()
                  ? () => setAccountDialogPage('home')
                  : undefined
              }
            />
            {/* Help, as one more glyph in the capsule beside the engine's
                (Ivan, 2026-09-22: "put the help menu as icon next to the
                other menu icon inside the pill"). It stood outside as a word
                of its own, which was one of the four shapes across this
                strip. */}
            <HelpMenu
              onTour={() => setShowFeatureTour(true)}
              onTroubleshoot={() => setShowTroubleshooter(true)}
              onReport={() => setShowBugReport(true)}
              onForum={() => selectTopWorkspaceTab('forum')}
              onAbout={() => setShowAbout(true)}
              forumOpen={isForumTab}
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
                    leaveFullScreen();
                    return;
                  }
                  handleToggleMaximizeWindow().catch(() => undefined);
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
          rightPaneOpen ? ' is-sound-drawer-open' : ''
        }`}
      >
        {showAudioRestartRecommendation && !suppressAudioNotices && (
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
        {captureError && !isCaptureNoticeHidden && !suppressAudioNotices && (
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
        {/* Below the two-column breakpoint this panel is a drawer that slides
            in from the left edge, summoned by the tab below and dismissed by
            its own backdrop — the same arrangement the sound panel has on the
            other edge. Above that width the tab and the backdrop are
            display:none and the class does nothing. */}
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
          onAskAboutEngine={handleAskAboutEngine}
          onGraphVisibilityChange={setActiveTabGraphVisibility}
        />

        <div
          ref={setCenterColumn}
          className={`center-workspace${
            isGraphFullScreen && showsGraph && !isMediaFullScreen
              ? ' is-graph-full'
              : ''
          }${isResizingPanes ? ' is-resizing' : ''}${
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
          {/* The EQ pages' head, above their graph (`isGraphFirst`): the
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
                see `workspaceTabs` and the wrapper it is drawn in. */}
              {/* The pages, asleep behind the amp (`behindAmp`). Each is
                unmounted by an ordinary tab switch already, so nothing in one
                has to run while it is not on screen. The players below are
                not in here: they are the sound. */}
              <Activity mode={behindAmp}>
                {isEqGroupTab(activeWorkspaceTab) && (
                  // The shared header must outlive section changes: remounting
                  // the engine label briefly hid it while status loaded and
                  // restarted its rainbow animation. Only the scroll content is
                  // keyed.
                  <div
                    key="eq-workspace"
                    className={`workspace-tab-panel workspace-tab-panel--${activeWorkspaceTab}${!isEqReachingSound ? ' is-engine-disabled' : ''}`}
                    aria-disabled={
                      activeWorkspaceTab === 'config' ||
                      activeWorkspaceTab === 'games'
                        ? undefined
                        : !isEqReachingSound
                    }
                    onPointerOver={preloadEqPillOnApproach}
                    onFocus={preloadEqPillOnApproach}
                  >
                    {!isGraphFirst && eqGroupPills}
                    <div
                      key={activeWorkspaceTab}
                      className="workspace-tab-panel__scroll"
                    >
                      {/* Only met by a page drawn before its code arrived,
                        which `selectTopWorkspaceTab` never does: the pills
                        stay, and the page follows a moment later. */}
                      <Suspense fallback={null}>
                        {activeWorkspaceTab === 'eq' && <MainContent />}
                        {activeWorkspaceTab === 'presets' && (
                          <PresetsPage.Page />
                        )}
                        {activeWorkspaceTab === 'convolution' && (
                          <ConvolutionPage.Page />
                        )}
                        {activeWorkspaceTab === 'games' && <GamesPage.Page />}
                        {activeWorkspaceTab === 'config' && <ConfigPage.Page />}
                      </Suspense>
                    </div>
                  </div>
                )}
                {/* No engine-disabled state, and that is not an oversight. The
                  panels above are inert with the equaliser off because they
                  only write APO's config. This one is a Web Audio graph on
                  FluidEQ's own player — APO is not in its path at all, so it
                  works exactly the same either way, and greying it out would
                  be a lie. */}
                {activeWorkspaceTab === 'dsp' && (
                  <div
                    key={activeWorkspaceTab}
                    className="workspace-tab-panel workspace-tab-panel--dsp"
                  >
                    <div className="workspace-tab-panel__scroll">
                      <Suspense fallback={null}>
                        <DspPage onOpenEngineDialog={handleOpenEngineDialog} />
                      </Suspense>
                    </div>
                  </div>
                )}
                {activeWorkspaceTab === 'share' && (
                  <div
                    key={activeWorkspaceTab}
                    className="workspace-tab-panel workspace-tab-panel--share"
                  >
                    <div className="workspace-tab-panel__scroll">
                      <Suspense fallback={null}>
                        <SharePage.Page />
                      </Suspense>
                    </div>
                  </div>
                )}
                {activeWorkspaceTab === 'community' && (
                  // No `__scroll` wrapper: the gallery, the board and the
                  // Studio each scroll inside themselves beside a rail that
                  // stays put.
                  <div
                    key={activeWorkspaceTab}
                    className="workspace-tab-panel workspace-tab-panel--community"
                  >
                    <Suspense fallback={null}>
                      <PlusPage.Page
                        onSignIn={() => setAccountDialogPage('home')}
                        onShowGraph={() =>
                          showGalleryGraph(() => {
                            setGraphVisibilityByTab((current) => ({
                              ...current,
                              eq: true,
                            }));
                            selectTopWorkspaceTab('eq');
                          })
                        }
                      />
                    </Suspense>
                  </div>
                )}
                {activeWorkspaceTab === 'forum' && (
                  // Like Plus: the list and the thread scroll inside
                  // themselves, so the panel does not.
                  <div
                    key={activeWorkspaceTab}
                    className="workspace-tab-panel workspace-tab-panel--forum"
                  >
                    <Suspense fallback={null}>
                      <ForumPage.Page />
                    </Suspense>
                  </div>
                )}
              </Activity>
              {/* A silent guest off its tab stays only while it is the last
                thing played; otherwise it is unmounted, which destroys its
                renderer process.

                The three players stay awake behind the amp — their audio, the
                guest and the transport they describe are what the amp plays —
                and are put away there the way a tab switch puts them away, by
                `isHidden`: the page drawn by each one sleeps, its sound does
                not. Each waits for its code in a boundary of its own, so
                nothing around it is hidden while it does. */}
              {hasOpenedVideo && keepVideoMounted && (
                <Suspense fallback={null}>
                  <MediaPage.Page
                    isHidden={
                      isAmp ||
                      (!showsMediaGraphBackdrop &&
                        (!isVideoTab || isGraphBackdropMode))
                    }
                    isFullScreen={mediaFullScreenOwner === 'video'}
                    isGraphBackdrop={showsMediaGraphBackdrop}
                    onRequestFullScreen={() => {
                      applyMediaFullScreen('video');
                    }}
                    onRequestGraphFullScreen={() => {
                      // With a Plus visualizer on the graph, a double-click on
                      // the video is the video's own full screen, in and out:
                      // the visualizer would only have covered it (see the
                      // backdrop above).
                      if (isSceneOnGraph) {
                        applyMediaFullScreen(
                          isMediaFullScreen ? undefined : 'video',
                        );
                        return;
                      }
                      // A double-click on the guest is the same command as
                      // Ctrl+F. If the shared no-graph media surface already
                      // owns the OS window, transfer it without first bouncing
                      // out of full screen and making Chromium resize the live
                      // video twice.
                      if (isMediaFullScreen) {
                        mediaFullScreenRequestedRef.current = false;
                        setMediaFullScreenOwner(undefined);
                      }
                      setActiveTabGraphVisibility(true);
                      toggleGraphFullScreen();
                    }}
                  />
                </Suspense>
              )}
              {/* The bar for karaoke and for the Media page, mounted where
                nothing can gate it. Its own rule keeps it and the library's
                bar from ever both being up. */}
              {/* Faded out with the rest of the chrome once full screen has been
                still for a moment, and back on the next movement — the same
                two seconds the graph's own toolbar waits, from the same
                store, so the two cannot disagree about when to go. */}
              <TaskbarTransport tabOwner={TAB_TRANSPORT[activeWorkspaceTab]} />
              <IdleTransportBarSlot
                activeTab={activeWorkspaceTab}
                isFullScreen={isAppFullScreen}
                onGoToTab={selectTopWorkspaceTab}
              />
              <TabTransportBar
                activeTab={activeWorkspaceTab}
                isIdle={
                  isAppFullScreen && (!isPointerNearChrome || isChromeIdle)
                }
                isFloating={isAppFullScreen}
                onGoToTab={selectTopWorkspaceTab}
              />
              {/* The providers keep a playing deck, or a silent one while its
                queue is the last thing played. The shelf is pruned immediately
                off-tab; otherwise the providers and native DSP host leave too. */}
              {hasOpenedLibrary && keepLibraryMounted && (
                <LibraryProvider>
                  {/* Inside `LibraryProvider` for tidiness rather than
                    necessity — it needs nothing from it — and outside
                    `LibraryPlayerProvider`, which does: a queue built from a
                    playlist is resolved against the index the player reads. */}
                  <PlaylistProvider>
                    <LibraryPlayerProvider>
                      <Suspense fallback={null}>
                        <LibraryPage.Page
                          isHidden={
                            isAmp ||
                            (!showsLibraryGraphBackdrop &&
                              (!isLibraryTab || isGraphBackdropMode))
                          }
                          isGraphBackdrop={showsLibraryGraphBackdrop}
                          revealRequest={libraryReveal}
                          isFullScreen={mediaFullScreenOwner === 'library'}
                          onToggleFullScreen={() => {
                            applyMediaFullScreen(
                              mediaFullScreenOwner === 'library'
                                ? undefined
                                : 'library',
                            );
                          }}
                        />
                      </Suspense>
                      {showsLibraryGraphBackdrop && <LibraryStageArt />}
                      <ConnectedNowPlayingBar
                        activeTab={activeWorkspaceTab}
                        isIdle={
                          isAppFullScreen &&
                          (!isPointerNearChrome || isChromeIdle)
                        }
                        isFloating={isAppFullScreen}
                        onReveal={revealPlayingTrack}
                      />
                    </LibraryPlayerProvider>
                  </PlaylistProvider>
                </LibraryProvider>
              )}
              {/* Outside the Library's providers: the machine's own song needs
                none of them, and inside they are mounted only once the Library
                has been opened, so after a launch that never visited it an
                expanded graph showed Spotify's song with no picture. */}
              {showsSystemGraphBackdrop && <SystemStageArt />}
              {/* Loaded Karaoke keeps only its audio element and exact shared
                transport while it is the last thing played. Otherwise it
                unmounts completely. */}
              {/* Not hidden behind the compact player, unlike the Media and
                Library pages: hidden, Karaoke renders only its audio host, so
                an open Maker unmounts and cancels whatever it is running — a
                background removal takes minutes without a GPU, and the compact
                player is exactly where somebody waits for it. The window
                behind the amp is not drawn, and the stage's own loops stop
                when it is not shown. */}
              {hasOpenedKaraoke && keepKaraokeMounted && (
                <Suspense fallback={null}>
                  <KaraokePage.Page
                    isHidden={
                      !showsKaraokeGraphBackdrop &&
                      (!isKaraokeTab || isGraphBackdropMode)
                    }
                    isFullScreen={isKaraokeSurfaceFullScreen}
                    isGraphOverlay={isKaraokeGraphOverlay}
                    isChromeIdle={isChromeIdle}
                    hasFullScreenTopBar={hasFullScreenTopBar}
                    onToggleFullScreenTopBar={toggleFullScreenTopBar}
                    onToggleFullScreen={() => {
                      if (isKaraokeGraphFullScreen) {
                        exitGraphFullScreen();
                        return;
                      }
                      applyMediaFullScreen(
                        mediaFullScreenOwner === 'karaoke'
                          ? undefined
                          : 'karaoke',
                      );
                    }}
                  />
                </Suspense>
              )}
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
                onStart={handleGraphResizeStart}
                onDrag={handleGraphResizeDrag}
                onEnd={handleGraphResizeEnd}
              />
            )}
            {showsGraph ? <FrequencyResponseChart isVisible /> : null}
            {/* The graph's Plus visualizer, beside the graph and not in it:
                on the plot, the EQ column or the Backdrop, and still behind
                the window in the Backdrop while the graph is closed on a page
                (`GraphScene`). Renders only its canvas, wherever that is. */}
            <GraphScene />
          </Activity>
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
          className={`right-content-toggle${rightPaneOpen ? ' is-open' : ''}`}
          aria-expanded={rightPaneOpen}
          aria-label={t('app.soundPanel')}
          title={t('app.soundPanel')}
          onClick={() => setRightPaneOpen((open) => !open)}
        >
          <Chevron className="drawer-tab__chevron" />
        </button>
        {/* One backdrop for both drawers, and pressing it shuts both. Two of
            them stacked, each closing only its own, meant a press outside
            with both open closed whichever happened to be on top and left
            the other standing. */}
        {(rightPaneOpen || topPaneOpen) && (
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
        <div className={`right-content${rightPaneOpen ? ' is-open' : ''}`}>
          <div className="right-content__scroll">
            {/* One card: the output you listen on, and under it the profiles
                that play through it. They were two cards, and the ON pill on
                a profile sat a card away from the output it was on. */}
            {/* Asleep behind the amp. Each reads what it shows again when it
                wakes: the preset list, the outputs and their profiles. */}
            <Activity mode={behindAmp}>
              <DeviceProfiles
                engine={engineStatus?.engine ?? null}
                isNoticeHidden={suppressAudioNotices}
                onConfigureApo={handleConfigureEqualizerApo}
                onAttachFluidEngine={handleAttachFluidEngine}
              >
                <PresetsBar
                  fetchPresets={getPresetListFromFiles}
                  loadPreset={loadPreset}
                  savePreset={savePreset}
                  createPreset={createPreset}
                  renamePreset={renamePreset}
                  deletePreset={deletePreset}
                />
              </DeviceProfiles>
            </Activity>
            {/* Directly under the output picker: it is the same question asked
                twice over — that one chooses where the sound goes, this one
                adds a second somewhere. */}
            {/* Awake behind the amp: it plays the mirror to the second output
                (`useOutputMirror`), and asleep it would silence that output
                the moment the window became the amp. */}
            <ExtraOutputs engine={engineStatus?.engine ?? null} />
            {/* Sits with the output device because it answers the same question:
                what is this sound coming out of. */}
            <Activity mode={behindAmp}>
              <DriverPicker />
            </Activity>
          </div>
          <footer className="right-content__footer">
            <a
              className="right-content__site"
              href={OFFICIAL_SITE_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Open fluideq.com in your browser"
              title="Open fluideq.com in your browser"
            >
              <span>fluideq.com</span>
              <MenuIcon name="external" className="right-content__site-icon" />
            </a>
          </footer>
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
        {/* No creature in the corner while the header is away. The bar comes
            back the moment the pointer reaches an edge — see the reveal in
            GraphTheme — and the creature comes back with it, in the bar where
            it lives. A second copy of it floating over the picture was a
            piece of chrome that the mode exists to get rid of. */}
        {showTroubleshooter && (
          <AudioTroubleshooter
            engine={engineStatus?.engine ?? null}
            onClose={() => setShowTroubleshooter(false)}
            onRestartAudio={handleRestartWindowsAudio}
            onReconfigure={handleConfigureEqualizerApo}
            onReinstallApo={handleReinstallApo}
            onEnableEngine={handleTroubleshootEnableEngine}
            onRemoveEngineFromOutput={handleTroubleshootRemoveEngine}
            enableEngineLabel={t('output.enable')}
          />
        )}
        {/* No engine chosen at all is a question, not a fault: the same dialog
            the menu opens, without a way out of it, because there is nothing
            behind it that works until it is answered. `engineStatus` is
            undefined only while main's first answer is in flight, and the
            loading screen covers that. */}
        {isEngineUnchosen
          ? engineStatus && (
              <AudioEngineDialog
                status={engineStatus}
                onApply={handleApplyAudioEngine}
              />
            )
          : globalError &&
            isBlockingError && (
              <PrereqMissingModal
                key={prereqNonce}
                engine={prereqBannerEngine(globalError.code, engineStatus)}
                isLoading={isLoading}
                onRetry={handlePrereqRetry}
                onInstallFluid={handleInstallFluidEngine}
                errorMsg={globalError.shortError}
                actionMsg={globalError.action}
              />
            )}
        {/* Never beside the blocking copy of itself: two identical dialogs
            stacked, one of which cannot be closed, is the worst possible way
            to ask a question once. */}
        {showEngineDialog && !isEngineUnchosen && engineStatus && (
          <AudioEngineDialog
            status={engineStatus}
            onApply={handleApplyAudioEngine}
            onCancel={() => setShowEngineDialog(false)}
            onApoAction={handleApoAction}
          />
        )}
        {audioRestart.isOpen && !suppressAudioNotices && (
          <RestartAudioDialog
            phase={audioRestart.phase}
            outcome={audioRestart.outcome}
            onRestart={audioRestart.run}
            onClose={audioRestart.close}
          />
        )}
        {/* Steps aside for the two dialogs its own buttons open, and for
            the ones that take the whole window: whatever it says can wait
            until they are answered, and it is still true afterwards. */}
        <EngineTroubleNotice
          trouble={engineTrouble}
          isHidden={
            suppressAudioNotices ||
            isTryingSlots ||
            audioRestart.isOpen ||
            showEngineDialog ||
            isEngineUnchosen ||
            Boolean(globalError && isBlockingError)
          }
          onRestartAudio={handleRestartWindowsAudio}
          onUseApo={handleOpenEngineDialog}
          onTryAnotherSlot={handleTryAnotherSlot}
          onInstallEngine={handleInstallEngineForTrouble}
          reopenCount={engineAskCount}
        />
        {/* Waits for the same things, for the troubleshooter, and for the
            tour and the release notes that open on the first launch after an
            update — the launch this is most likely to have something to say
            on. Two panels arriving together on first run read as a
            malfunction. */}
        <EngineUpdateNotice
          update={engineUpdate}
          isHidden={
            audioRestart.isOpen ||
            showEngineDialog ||
            isEngineUnchosen ||
            Boolean(globalError && isBlockingError) ||
            showTroubleshooter ||
            showFeatureTour ||
            whatsNewScope !== null
          }
        />
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
        {/* Here for the same reason: the song that was just matched can start
            playing while the user is on any tab, and the loaned curve is
            already audible before this ever draws. */}
        <SongEqNotice />
        {/* Here too: the terms promise that the app tells a member when they
            change, and a member need never open the Plus tab to use Plus. */}
        <PlusTermsNotice />
        {/* Here for the same reason: a scene waiting for the admin, or a
            maker's scene approved or not, is news on whichever tab is open. */}
        <SceneReviewNotice />
        {/* The week's warning before a maker's earned Plus runs out. Beside
            the review news, because it is the same kind of thing: something
            about their scenes that can land on any tab. */}
        <MakerMonthNotice />
        {/* A scene reported from the looks: the menu it was asked from
            closes under the dialog, so the dialog lives here. */}
        <SceneReportHost />
        {/* The one moment a membership turning on is marked. Here rather than
            in the Plus tab, because paying is done from the account panel and
            the answer can land with any tab open. */}
        <PlusWelcomeDialog />
        {showFeatureTour && (
          <FeatureTour
            version={APP_VERSION}
            slides={TOUR_SLIDES}
            onClose={(dontShowAgain) => {
              const dismissal = featureTourDismissal(
                APP_VERSION,
                dontShowAgain,
              );
              if (dismissal) {
                localStorage.setItem(FEATURE_TOUR_DISMISSED_KEY, dismissal);
              } else {
                localStorage.removeItem(FEATURE_TOUR_DISMISSED_KEY);
              }
              setShowFeatureTour(false);
            }}
            // The whole history, on top of the tour: someone who followed
            // the link asked to read, not to be told the headline again.
            onShowReleaseNotes={() => setWhatsNewScope('all')}
            isCovered={whatsNewScope !== null}
            onOpenTab={(tab) => {
              // Landing on the tab is not being done with the tour: the tick
              // was not offered a chance, so it counts as left unticked.
              localStorage.removeItem(FEATURE_TOUR_DISMISSED_KEY);
              setShowFeatureTour(false);
              selectTopWorkspaceTab(tab);
            }}
          />
        )}
        {whatsNewScope && (
          <WhatsNewDialog
            scope={whatsNewScope}
            onClose={() => setWhatsNewScope(null)}
          />
        )}
        {showProcessesDialog && (
          <ProcessesDialog onClose={() => setShowProcessesDialog(false)} />
        )}

        {accountDialogPage !== undefined && (
          <AccountDialog
            initialPage={accountDialogPage}
            onClose={() => setAccountDialogPage(undefined)}
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
