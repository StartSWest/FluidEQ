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
  OFFICIAL_SITE_URL,
  PRODUCT_NAME,
  PRODUCT_VERSION,
} from 'common/branding';
import { resetRhythmRun } from './utils/rhythmRun';
import { useMediaQuery } from './utils/useMediaQuery';
import { useTitlebarSideWidth } from './utils/useTitlebarSideWidth';
import ConfigInspector from './components/ConfigInspector';
import { resetEuphoriaMode } from './utils/euphoriaMode';
import './styles/App.scss';
// After App.scss: these are the accents in their rainbow form, and they have to
// win against the cyan ones they replace without reaching for `!important`.
import './styles/Rainbow.scss';
import MainContent from './MainContent';
import SmartEqEngine from './SmartEqEngine';
import SmartHeadroomEngine from './SmartHeadroomEngine';
import SupportDialog from './SupportDialog';
import ProcessesDialog from './components/ProcessesDialog';

import SupportPet from './SupportPet';
import { FluidEqProvider, useFluidEqContext } from './utils/FluidEqContext';
import PrereqMissingModal from './PrereqMissingModal';
import BugReportDialog from './components/BugReportDialog';
import AudioTroubleshooter from './components/AudioTroubleshooter';
import SideBar from './SideBar';
import {
  exitGraphFullScreen,
  onWindowFullScreenChange,
  toggleGraphExpanded,
  toggleGraphFullScreen,
  toggleFullScreenTopBar,
  useGraphFullScreen,
  useGraphView,
  useFullScreenTopBar,
} from './utils/graphStyle';
import {
  useIsChromeIdle,
  useIsPointerNearChrome,
  watchChromeIdle,
} from './utils/idleChrome';
import { reportError } from './utils/logger';
import VideoBrowser from './video/VideoBrowser';
import { albumKey } from '../common/library/grouping';
import { ILibraryTrack } from '../common/library/types';
import LibraryStageArt from './library/LibraryStageArt';
import LibraryWorkspace from './library/LibraryWorkspace';
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
  useLastTransportOwner,
  useTransportIdentitySources,
  useTransportSources,
} from './audio/transportSource';
import pickTransportOwner from './audio/transportRouting';
import { useIdlePlayerMount } from './audio/useIdlePlayerMount';
import KaraokeWorkspace from './karaoke/KaraokeWorkspace';
import PaneResizer from './components/PaneResizer';
import WorkspaceTabStrip from './components/WorkspaceTabStrip';
import WorkspaceSectionTabs from './components/WorkspaceSectionTabs';
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
import DspPanel from './dsp/DspPanel';
import {
  applyDspSettings,
  persistDspSettings,
  useDspEngineState,
  useDspSettings,
} from './dsp/store';
import VoicingPanel from './VoicingPanel';
import MenuIcon from './icons/MenuIcon';
import LanguagePicker from './components/LanguagePicker';
import UpdateNotice from './components/UpdateNotice';
import SpeechMemoryNotice from './components/SpeechMemoryNotice';
import SongEqNotice from './components/SongEqNotice';
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
import RemoteAudioPanel from './remoteAudio/RemoteAudioPanel';
import RemoteAudioProvider from './remoteAudio/RemoteAudioContext';
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
  | 'dsp'
  | 'share'
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
  'dsp',
  'share',
  'config',
];

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
  'voicing',
  'convolution',
  'config',
];

const EQ_GROUP_LABEL_KEYS = {
  eq: 'tabs.eqMain',
  presets: 'tabs.presets',
  voicing: 'tabs.voicing',
  convolution: 'tabs.convolution',
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

const isEqGroupTab = (tab: TWorkspaceTab): boolean =>
  EQ_GROUP_TABS.includes(tab);

const FULLSCREEN_MEDIA_TABS: readonly TWorkspaceTab[] = [
  'video',
  'library',
  'karaoke',
];

const isFullscreenMediaTab = (tab: TWorkspaceTab): boolean =>
  FULLSCREEN_MEDIA_TABS.includes(tab);

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
  // resume and no tab that could fill it. `lastOwner` is remembered across
  // restarts, so this appears the moment something has been played once and
  // stays from then on, which is the "always a bar" that was asked for.
  if (owner !== undefined || isFullScreen || lastOwner === undefined) {
    return null;
  }
  return <IdleTransportBar onGoToLibrary={() => onGoToTab('library')} />;
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
      volume={player.volume}
      isUnplayable={player.isUnplayable}
      onToggle={player.toggle}
      onSkip={player.skip}
      onStop={player.stop}
      onSeek={player.seek}
      onShuffle={() => player.setShuffle(!player.isShuffled)}
      onRepeat={player.cycleRepeat}
      isFavorite={track ? isFavorite(track.id) : false}
      onFavorite={track ? () => toggleFavorite(track.id) : undefined}
      onVolume={player.setVolume}
      onVolumeCommit={player.commitVolume}
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
  const selectTopWorkspaceTab = useCallback(
    (next: TWorkspaceTab) => {
      if (next !== activeWorkspaceTab && graphView !== 'normal') {
        exitGraphFullScreen();
      }
      setActiveWorkspaceTab(next);
    },
    [activeWorkspaceTab, graphView],
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

  const [graphVisibilityByTab, setGraphVisibilityByTab] = useState<
    TWorkspaceGraphVisibility | undefined
  >(readWorkspaceGraphVisibility);

  /**
   * The equaliser's five, drawn at the top of whichever of them is open.
   *
   * Read from the DSP store rather than held here: the engine that consumes
   * them runs inside `LibraryPlayerContext`, where the `<audio>` element it
   * has to attach to lives. Lifting the state to this component would
   * re-render the whole player tree on every knob turn.
   */
  const dspSettings = useDspSettings();
  const dspEngineState = useDspEngineState();

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
    />
  );
  const isVideoTab = activeWorkspaceTab === 'video';
  const isMediaTabOneWord = useMediaQuery(MEDIA_TAB_ONE_WORD_QUERY);
  const isLibraryTab = activeWorkspaceTab === 'library';
  const isKaraokeTab = activeWorkspaceTab === 'karaoke';
  const isDspTab = activeWorkspaceTab === 'dsp';
  const isShareTab = activeWorkspaceTab === 'share';
  const playingOwner = usePlaybackOwner();
  const transportIdentities = useTransportIdentitySources();
  // A loaded silent player keeps only its controller/media shell for five
  // seconds after leaving the tab. That prevents the fast empty-bar glitch,
  // but the lease is bounded: once it expires, unmounting disposes the guest,
  // media elements, observers and native DSP host. Playing audio has no timer.
  const keepVideoMounted = useIdlePlayerMount({
    isActive: isVideoTab,
    hasLoadedSource: transportIdentities.media !== undefined,
    isPlaying:
      playingOwner === 'media' || transportIdentities.media?.isPlaying === true,
  });
  const keepLibraryMounted = useIdlePlayerMount({
    // The native DSP engine lives in this provider as well. If it has already
    // been opened, the visible DSP rack is an active consumer even though the
    // Library shelf itself is not the selected tab.
    isActive: isLibraryTab || isDspTab,
    hasLoadedSource: transportIdentities.library !== undefined,
    isPlaying:
      playingOwner === 'library' ||
      transportIdentities.library?.isPlaying === true,
  });
  const keepKaraokeMounted = useIdlePlayerMount({
    isActive: isKaraokeTab,
    hasLoadedSource: transportIdentities.karaoke !== undefined,
    isPlaying:
      playingOwner === 'karaoke' ||
      transportIdentities.karaoke?.isPlaying === true,
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
      >
        <MenuIcon name="microphone" />
        <span className="workspace-tab__label">{t('tabs.karaoke')}</span>
      </button>
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
  const [showAudioToolsMenu, setShowAudioToolsMenu] = useState(false);
  const [showSupportDialog, setShowSupportDialog] = useState(false);
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
  // What the rest of the machine is playing, on the bar when this app has
  // nothing of its own there. Mounted at the root because it is nobody's tab:
  // the sound is Spotify's or a browser's, and the curve on screen is shaping
  // it just the same.
  useSystemMediaSource();
  // The Smart EQ song-memory recorder: same lifetime and the same reason as
  // the line above it. A recording must not end because somebody switched
  // tabs, so this is hosted here rather than inside the EQ page.
  useSongEqSessionHost();

  // What the two ends of the titlebar actually need, so the meter between them
  // can be given the rest and stay in the middle of the window. The bar's own
  // element carries the answer as a custom property — see the hook.
  const titlebarRef = useRef<HTMLElement | null>(null);
  const titlebarLeftRef = useRef<HTMLDivElement | null>(null);
  const titlebarRightRef = useRef<HTMLDivElement | null>(null);
  useTitlebarSideWidth(titlebarRef, titlebarLeftRef, titlebarRightRef);

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
      activeWorkspaceTab === 'share'
        ? false
        : isGraphViewOn));
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
  const graphBackdropOwner = isGraphBackdropMode ? playingOwner : undefined;
  const showsMediaGraphBackdrop = graphBackdropOwner === 'media';
  const showsLibraryGraphBackdrop = graphBackdropOwner === 'library';
  const showsKaraokeGraphBackdrop = graphBackdropOwner === 'karaoke';

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
  const editorHeight = useEditorHeight(activeWorkspaceTab);

  // Watched only in full screen, and stopped on the way out — see the store for
  // why leaving it running would strand a faded workspace.
  const isChromeIdle = useIsChromeIdle();
  // The bar answers to the pointer, not to the clock — see `idleChrome`.
  const isPointerNearChrome = useIsPointerNearChrome();

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
  useEffect(() => {
    onWindowFullScreenChange((next) => {
      window.electron.ipcRenderer.setWindowFullScreen(next).catch((e) => {
        reportError('Could not change the window to full screen', e);
      });
    });
    return () => onWindowFullScreenChange(() => undefined);
  }, []);

  const applyMediaFullScreen = useCallback(
    async (owner: TWorkspaceTab | undefined) => {
      const next = owner !== undefined;
      mediaFullScreenRequestedRef.current = next;
      setMediaFullScreenOwner(owner);
      try {
        const applied =
          await window.electron.ipcRenderer.setWindowFullScreen(next);
        mediaFullScreenRequestedRef.current = next && applied;
        setMediaFullScreenOwner(next && applied ? owner : undefined);
      } catch (error) {
        mediaFullScreenRequestedRef.current = false;
        setMediaFullScreenOwner(undefined);
        reportError('Could not change the media surface full screen', error);
      }
    },
    [],
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
   * can later be disposed after its silent off-tab lease. The tab is remembered
   * but a disposed player is not live, so coming
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
  // hidden browser receives only the shared five-second disposal lease.
  const [hasOpenedVideo, setHasOpenedVideo] = useState(
    () => restoredOwner === 'media',
  );
  // Library follows the same eligibility rule. Its providers survive off-tab
  // while a deck is making sound, or for the bounded silent grace period.
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
          mediaFullScreenRequestedRef.current
        ) {
          mediaFullScreenRequestedRef.current = false;
          setMediaFullScreenOwner(undefined);
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
        ref={titlebarRef}
        className="workspace-header window-titlebar"
        onDoubleClick={handleTitlebarDoubleClick}
      >
        {/* The three direct grid children are what centre the waveform, and
            the middle one holds nothing but the meter for exactly that reason:
            two equal outer tracks put an `auto` middle one in the true middle
            of the window, so anything else in there pushes the spectrum off
            it. Identity and two places on the left; three places, the pet, the
            actions button and the window controls on the right. */}
        <div className="window-titlebar__left" ref={titlebarLeftRef}>
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
            its width gives way, to whatever the wider end of the bar leaves
            over. See `useTitlebarSideWidth`. */}
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
                {/* A full row rather than a column entry: it answers which of
                    the identical FluidEQ rows is using memory, in every build
                    where that question can matter. */}
                <button
                  type="button"
                  role="menuitem"
                  className="workspace-header__menu-support"
                  onClick={() => {
                    setShowAudioToolsMenu(false);
                    setShowProcessesDialog(true);
                  }}
                >
                  <MenuIcon name="restart" />
                  {t('app.processes.menu')}
                </button>
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
        }${isKaraokeGraphFullScreen ? ' has-karaoke-graph' : ''}`}
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
          onClick={() => setTopPaneOpen((open) => !open)}
        >
          <MenuIcon name="settings" />
        </button>
        <SideBar
          showGraphToggle
          isGraphVisible={showsGraph}
          isOpen={topPaneOpen}
          onGraphVisibilityChange={setActiveTabGraphVisibility}
        />

        <div
          className={`center-workspace${
            isGraphFullScreen && showsGraph && !isMediaFullScreen
              ? ' is-graph-full'
              : ''
          }${isResizingPanes ? ' is-resizing' : ''}`}
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
            // Library and Karaoke deliberately let pointer events pass through
            // the graph to their live surface. Catch the gesture at their
            // shared ancestor so the usual graph double-click still restores
            // the window without making the player underneath unclickable.
            event.preventDefault();
            event.stopPropagation();
            exitGraphFullScreen();
          }}
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
            {/* The six places are in the titlebar now, beside the meter —
                see `workspaceTabs` and the wrapper it is drawn in. */}
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
                {eqGroupPills}
                <div className="workspace-tab-panel__scroll">
                  <MainContent />
                </div>
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
                {eqGroupPills}
                <div className="workspace-tab-panel__scroll">
                  <EqPresetsPanel />
                </div>
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
                {eqGroupPills}
                <div className="workspace-tab-panel__scroll">
                  {activeWorkspaceTab === 'voicing' ? (
                    <VoicingPanel />
                  ) : (
                    <ConvolutionPanel />
                  )}
                </div>
              </div>
            )}
            {/* No engine-disabled state, and that is not an oversight. The
                panels above are inert with the equaliser off because they only
                write APO's config. This one is a Web Audio graph on FluidEQ's
                own player — APO is not in its path at all, so it works exactly
                the same either way, and greying it out would be a lie. */}
            {activeWorkspaceTab === 'dsp' && (
              <div
                key={activeWorkspaceTab}
                className="workspace-tab-panel workspace-tab-panel--dsp"
              >
                <div className="workspace-tab-panel__scroll">
                  <DspPanel
                    settings={dspSettings}
                    onChange={applyDspSettings}
                    onCommit={persistDspSettings}
                    engineState={dspEngineState}
                  />
                </div>
              </div>
            )}
            {activeWorkspaceTab === 'share' && (
              <div
                key={activeWorkspaceTab}
                className="workspace-tab-panel workspace-tab-panel--share"
              >
                <div className="workspace-tab-panel__scroll">
                  <RemoteAudioPanel />
                </div>
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
                {eqGroupPills}
                <div className="workspace-tab-panel__scroll">
                  <ConfigInspector />
                </div>
              </div>
            )}
            {/* A loaded guest gets a five-second silent lease through a tab
                switch. Playing has no deadline; a silent guest is then
                unmounted, which destroys its renderer process. */}
            {hasOpenedVideo && keepVideoMounted && (
              <VideoBrowser
                isHidden={
                  !showsMediaGraphBackdrop &&
                  (!isVideoTab || isGraphBackdropMode)
                }
                isFullScreen={mediaFullScreenOwner === 'video'}
                isGraphBackdrop={showsMediaGraphBackdrop}
                onRequestFullScreen={() => {
                  applyMediaFullScreen('video');
                }}
                onRequestGraphFullScreen={() => {
                  // A double-click on the guest is the same command as Ctrl+F.
                  // If the shared no-graph media surface already owns the OS
                  // window, transfer it without first bouncing out of full
                  // screen and making Chromium resize the live video twice.
                  if (isMediaFullScreen) {
                    mediaFullScreenRequestedRef.current = false;
                    setMediaFullScreenOwner(undefined);
                  }
                  setActiveTabGraphVisibility(true);
                  toggleGraphFullScreen();
                }}
              />
            )}
            {/* The bar for karaoke and for the Media page, mounted where
                nothing can gate it. Its own rule keeps it and the library's
                bar from ever both being up. */}
            {/* Faded out with the rest of the chrome once full screen has been
                still for a moment, and back on the next movement — the same
                two seconds the graph's own toolbar waits, from the same
                store, so the two cannot disagree about when to go. */}
            <IdleTransportBarSlot
              activeTab={activeWorkspaceTab}
              isFullScreen={isAppFullScreen}
              onGoToTab={selectTopWorkspaceTab}
            />
            <TabTransportBar
              activeTab={activeWorkspaceTab}
              isIdle={isAppFullScreen && (!isPointerNearChrome || isChromeIdle)}
              isFloating={isAppFullScreen}
              onGoToTab={selectTopWorkspaceTab}
            />
            {/* The providers keep a playing deck, or a silent one for the short
                disposal lease. The shelf is pruned immediately off-tab; after
                the lease, the providers and native DSP host leave too. */}
            {hasOpenedLibrary && keepLibraryMounted && (
              <LibraryProvider>
                {/* Inside `LibraryProvider` for tidiness rather than
                    necessity — it needs nothing from it — and outside
                    `LibraryPlayerProvider`, which does: a queue built from a
                    playlist is resolved against the index the player reads. */}
                <PlaylistProvider>
                  <LibraryPlayerProvider>
                    <LibraryWorkspace
                      isHidden={
                        !showsLibraryGraphBackdrop &&
                        (!isLibraryTab || isGraphBackdropMode)
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
            {/* Loaded Karaoke keeps only its audio element and exact shared
                transport during the silent lease. It then unmounts completely
                unless playback resumed. */}
            {hasOpenedKaraoke && keepKaraokeMounted && (
              <KaraokeWorkspace
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
                    mediaFullScreenOwner === 'karaoke' ? undefined : 'karaoke',
                  );
                }}
              />
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
          className={`right-content-toggle${rightPaneOpen ? ' is-open' : ''}`}
          aria-expanded={rightPaneOpen}
          aria-label={t('app.soundPanel')}
          onClick={() => setRightPaneOpen((open) => !open)}
        >
          <MenuIcon name="settings" />
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
            <DeviceProfiles onConfigureApo={handleConfigureEqualizerApo} />
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
        {/* Here for the same reason: the song that was just matched can start
            playing while the user is on any tab, and the loaned curve is
            already audible before this ever draws. */}
        <SongEqNotice />
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
        {showProcessesDialog && (
          <ProcessesDialog onClose={() => setShowProcessesDialog(false)} />
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
          <RemoteAudioProvider>
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
          </RemoteAudioProvider>
        </LiveAudioProvider>
      </FluidEqProvider>
    </I18nProvider>
  );
}
