/*
<FluidEQ: System-wide parametric audio equalizer interface>
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

import { FC, Ref, useCallback, useEffect, useRef, useState } from 'react';
import ChannelEnum from 'common/channels';
import type { TranslationKey } from 'common/i18n';
import { buildSongIdentity } from 'common/songIdentity';
import {
  VIDEO_AD_BLOCK_DEFAULT,
  VIDEO_AD_BLOCK_STORAGE_KEY,
} from 'common/videoAdBlock';
import {
  IVideoSite,
  VIDEO_BROWSER_PARTITION,
  VIDEO_GRAPH_FULLSCREEN_REQUEST,
  VIDEO_SITES,
  VIDEO_LINK_BLOCKED,
  buildSearchUrl,
  findSiteForUrl,
  isNavigableVideoUrl,
} from 'common/videoSites';
import {
  IVideoDownloadUpdate,
  VIDEO_DOWNLOAD_CHANGED,
  isVideoDownloadUpdate,
} from 'common/videoDownloads';
import {
  TPlaybackMarks,
  buildResumeSeekScript,
  parsePlaybackMarks,
  rememberPlayback,
  resumePositionFor,
  resumeUrlFor,
  serialisePlaybackMarks,
} from 'common/videoResume';
import Switch from '../widgets/Switch';
import { useTranslation } from '../utils/I18nContext';
import { useIsAdBlockRevealed } from '../utils/adBlockReveal';
import { useGraphView } from '../utils/graphStyle';
import VideoSearch from './VideoSearch';
import {
  claimPlayback,
  registerPlayer,
  releasePlayback,
} from '../audio/playbackOwner';
import {
  clearTransportSource,
  setTransportSource,
} from '../audio/transportSource';
import { PLAYBACK_HANDOFF_GRACE_MS } from '../audio/playbackHandoff';
import VideoSiteIcon from './VideoSiteIcon';
import '../styles/VideoBrowser.scss';
import {
  EXIT_PAGE_FULLSCREEN,
  PLAYER_ONLY_CSS,
  PROBE_PLAYBACK,
  PROBE_PLAYBACK_PHASE,
  PROBE_SKIP_CONTROLS,
  READ_NOW_PLAYING,
  READ_PLAYBACK_CLOCK,
  READ_POSITION,
  STOP_AND_RESET_PLAYBACK,
  nudgePositionScript,
  skipScript,
  STOP_PLAYBACK,
  TOGGLE_PLAYBACK,
  setGuestVolumeScript,
  enterPlayerOnlyScript,
  exitPlayerOnlyScript,
} from './videoPlayerScripts';

/**
 * The part of `<webview>` this pane uses.
 *
 * Written out rather than imported from Electron's typings because those
 * describe the tag as it exists in a renderer with `webviewTag` on, and
 * importing them here would pull main-process types into the window bundle for
 * eight method signatures.
 */
interface IWebview extends HTMLElement {
  canGoBack(): boolean;
  canGoForward(): boolean;
  goBack(): void;
  goForward(): void;
  reload(): void;
  stop(): void;
  getURL(): string;
  /** The guest document's own title — what the bar calls the page while the
   * Media tab is the one driving it. */
  getTitle(): string;
  loadURL(url: string): Promise<void>;
  /**
   * The second argument tells Chromium to treat the call as though the user had
   * done it, which is what a gesture-gated API like `requestFullscreen`
   * requires.
   *
   * Nothing here passes it, and that is a decision rather than an oversight: a
   * granted gesture is also a user activation on the guest, and the tag's
   * autoplay policy reads exactly that to decide whether the page may start
   * playing on its own. Anything that needs the flag later has to be sure it is
   * not also handing the page permission to make noise.
   */
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
  /** Returns a key the stylesheet can be removed by. */
  insertCSS(css: string): Promise<string>;
  /**
   * A picture of what the guest is showing, for the bar at the foot of the
   * window.
   *
   * Typed by what is used rather than by importing Electron's `NativeImage`
   * into the renderer: this file already describes the tag it drives, and one
   * shape describing both is one place to look.
   */
  capturePage(): Promise<{
    isEmpty(): boolean;
    resize(options: { height: number }): { toDataURL(): string };
  }>;
  removeInsertedCSS(key: string): Promise<void>;
}

interface IWebviewProps {
  ref?: Ref<IWebview>;
  src: string;
  partition: string;
  /**
   * Whether the guest may open a window at all.
   *
   * A presence attribute, and one that is read when the tag attaches rather
   * than asked for later — which is why it has to be here and not only in the
   * main process. Without it `window.open` returns `null` before Chromium gets
   * as far as asking the window-open handler about the address, and every
   * sign-in that opens a window sees a popup blocker.
   *
   * A STRING, NOT A BOOLEAN, and the difference is whether it exists at all.
   * `webview` is a custom element as far as React is concerned, so it has no
   * idea `allowpopups` is a presence attribute; handed `true` it declines to
   * write anything and says so in a console warning. Written as `"true"` it
   * lands in the DOM, which is the only place Chromium looks.
   */
  allowpopups?: string;
  /** A comma-separated features string — see `VIDEO_WEB_PREFERENCES`. */
  webpreferences?: string;
  className?: string;
}

/**
 * React has no `webview` in its intrinsic elements, and React 19 moved the JSX
 * namespace such that adding one means augmenting a module. A cast keeps that
 * declaration here, next to the only place in the app that renders the tag,
 * instead of loose in a global .d.ts where it would advertise the element as
 * generally available.
 */
const Webview = 'webview' as unknown as FC<IWebviewProps>;

/**
 * Nothing in the page may start playing until somebody in it has asked.
 *
 * This is the bug that opening the tab used to be: the pane mounts on first
 * visit, loads the page that was last open, and the site started playing it —
 * over the top of whatever the machine was already playing. Nothing in FluidEQ
 * called for that. The page did, because Electron let it: its default is
 * `no-user-gesture-required`, which is a browser's autoplay rules with the
 * brakes off, and a watch URL loaded under that policy plays on sight.
 *
 * `document-user-activation-required` rather than `user-gesture-required`. The
 * strict one wants a gesture per play, so the next track in a queue — or a
 * player picking itself back up after an ad — would need a press of its own,
 * and a music site would stop between songs. This one is sticky per document:
 * the first press anywhere in the page lifts it and everything after behaves
 * like an ordinary browser. A page that has just been loaded and not yet
 * touched has no activation at all, which is precisely the case in hand.
 *
 * Declared on the tag rather than in the main process on purpose. What the main
 * process imposes at attach is the sandbox — the preload, the partition, what
 * the guest is allowed to reach — and it leaves the rest of what the tag asked
 * for alone. Whether the player starts by itself is a decision about this pane,
 * so it is written where the pane is.
 */
const VIDEO_WEB_PREFERENCES =
  'autoplayPolicy=document-user-activation-required';

/** How long "Signed out" stays up before the button goes back to offering it. */
const SIGN_OUT_NOTICE_MS = 4000;

const formatDownloadBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) {
    return `${Math.max(0, bytes / 1024).toFixed(1)} KB`;
  }
  return `${Math.max(0, bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const HOME_SITE: IVideoSite = VIDEO_SITES[0];

/**
 * Where the player was when the window last closed.
 *
 * A restart used to land back on YouTube's home page, whatever had been
 * playing. That is a small loss on a browser and a large one here: FluidEQ gets
 * restarted *because* of what it does — an EQ change that needs the audio
 * service bounced, an update, a crash — and each time it threw away the track
 * somebody was in the middle of tuning against.
 *
 * The URL only. Not the position in the video, which is the site's own business
 * and is generally remembered by the site itself for anyone signed in.
 */
const VIDEO_LAST_URL_KEY = 'fluideq.videoLastUrl';

/**
 * The stored page, if it is still somewhere the player may go.
 *
 * Checked rather than trusted. localStorage is editable, and this value is
 * handed straight to the guest as its `src` — the one place in this component
 * where a string from disk becomes a navigation. The main process would refuse
 * an unlisted host anyway, but a `src` it refuses is a player that comes up
 * blank, which is a worse answer than the home page.
 */
const readStoredUrl = () => {
  try {
    const stored = localStorage.getItem(VIDEO_LAST_URL_KEY);
    return stored && isNavigableVideoUrl(stored) ? stored : HOME_SITE.home;
  } catch {
    return HOME_SITE.home;
  }
};

/**
 * Where each site was left, so switching between them is not switching off.
 *
 * Separate from the key above, which is one URL for the whole player and
 * answers a different question — where to come up after a restart. This is one
 * mark per site, and it is what makes the site buttons feel like tabs rather
 * than like six front pages.
 */
const VIDEO_RESUME_KEY = 'fluideq.videoResume';

/** How often to note the position, in milliseconds. */
const RESUME_SAMPLE_MS = 5000;

/** Four bar updates a second; visual guest work remains stopped off-tab. */
const TRANSPORT_CLOCK_SAMPLE_MS = 250;

/**
 * Which run of the page-stripping is the current one.
 *
 * Module scope rather than component state: nothing renders from it, it must
 * survive a remount, and it only ever counts up. See `exitPlayerOnlyScript`.
 */
let soloGeneration = 0;

const readStoredMarks = (): TPlaybackMarks => {
  try {
    return parsePlaybackMarks(localStorage.getItem(VIDEO_RESUME_KEY));
  } catch {
    // A blocked or full store is a lost mark, not a broken tab.
    return {};
  }
};

const writeStoredMarks = (marks: TPlaybackMarks) => {
  try {
    localStorage.setItem(VIDEO_RESUME_KEY, serialisePlaybackMarks(marks));
  } catch {
    // As above.
  }
};

const readStoredAdBlock = () => {
  try {
    const stored = localStorage.getItem(VIDEO_AD_BLOCK_STORAGE_KEY);
    return stored === null ? VIDEO_AD_BLOCK_DEFAULT : stored === 'true';
  } catch {
    return VIDEO_AD_BLOCK_DEFAULT;
  }
};

interface IVideoBrowserProps {
  /**
   * Kept mounted but out of sight while another tab is open.
   *
   * The tag destroys its guest page when it leaves the DOM, so unmounting this
   * would stop the music every time somebody went to move a band — which is
   * the one thing they are most likely to be doing while listening. Hidden
   * with `display: none`, the guest is left alone and keeps playing.
   */
  isHidden: boolean;
  /** The one fullscreen state shared by Media, Library and Karaoke. */
  isFullScreen: boolean;
  /** The player is the picture under an expanded graph, even off its tab. */
  isGraphBackdrop: boolean;
  /** Promotes a site's HTML-fullscreen request to FluidEQ's window instead. */
  onRequestFullScreen: () => void;
  /** A double-click on the guest video requests graph fullscreen. */
  onRequestGraphFullScreen: () => void;
}

const VideoBrowser = ({
  isHidden,
  isFullScreen,
  isGraphBackdrop,
  onRequestFullScreen,
  onRequestGraphFullScreen,
}: IVideoBrowserProps) => {
  const { t } = useTranslation();
  const webviewRef = useRef<IWebview | null>(null);
  /** The guest's own volume, held here because the page cannot be asked what
   * it is — only told. Starts where a fresh media element does. */
  const guestVolumeRef = useRef(1);
  /** Whether the guest is playing, for the description rebuilt when the fader
   * moves — that has no event of its own to read the state from. */
  const playingRef = useRef(false);
  /**
   * Whether the page has skip controls of its own, as of the last probe.
   *
   * A ref for the reason the two beside it are: it is read by listeners
   * registered once, and re-registering them on a change would take the
   * guest's own events with them.
   */
  const skipsRef = useRef({ next: false, previous: false });
  /** The track the page says it is playing, where it says so at all. */
  const nowPlayingRef = useRef<{ title?: string; artist?: string }>({});
  /**
   * The ask, held where the sampler can reach it.
   *
   * The probe closes over the `describe` that belongs to the effect holding
   * the guest's own listeners, and that effect runs once; the position
   * sampler is a different effect with a different lifetime. A ref is the
   * seam between them, and the alternative — moving `describe` up — would
   * re-register the guest's listeners on every render that touches it.
   */
  const nowPlayingProbeRef = useRef<() => void>(() => {});
  /** The last frame taken of the guest, as a `data:` URL, for the bar's
   * cover. Held in a ref because it is read by listeners registered once and
   * never drawn by this component itself. */
  const frameRef = useRef<string | undefined>(undefined);
  /** Whether this tab is the one being looked at, for the same listeners:
   * they are registered on mount and cannot see a prop that changes. */
  const isHiddenRef = useRef(isHidden);
  isHiddenRef.current = isHidden;
  const onRequestFullScreenRef = useRef(onRequestFullScreen);
  onRequestFullScreenRef.current = onRequestFullScreen;
  const onRequestGraphFullScreenRef = useRef(onRequestGraphFullScreen);
  onRequestGraphFullScreenRef.current = onRequestGraphFullScreen;
  const graphView = useGraphView();

  // Read once, into a ref as well as into state: the `src` attribute must not
  // change after the tag has attached, or every navigation would reload the
  // page the app started on.
  const initialUrl = useRef(readStoredUrl());
  const [currentUrl, setCurrentUrl] = useState(initialUrl.current);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [blockedUrl, setBlockedUrl] = useState('');
  const [downloadUpdate, setDownloadUpdate] = useState<IVideoDownloadUpdate>();
  const [downloadPathCopied, setDownloadPathCopied] = useState(false);
  // Whether the guest has a document to be asked anything about. Nothing may
  // call into it before `dom-ready`.
  const [isGuestReady, setIsGuestReady] = useState(false);
  // Which document is in the guest. Incremented on every `dom-ready`, so
  // anything that has to be done again to a freshly loaded page can depend on
  // it. See `handleReady` for why a boolean was not enough.
  const [pageToken, setPageToken] = useState(0);
  /**
   * How the sign-out is going, as one value rather than three booleans.
   *
   * A clear can be in flight, can have worked, or can have failed, and those are
   * exclusive — `isClearing && didFail` is not a state this can be in, so it
   * should not be a state it can express. The result is deliberately not sticky:
   * it goes back to idle on its own, because a permanent "Signed out" beside a
   * button would still be there next time somebody wondered whether they were.
   */
  const [signOutState, setSignOutState] = useState<
    'idle' | 'clearing' | 'done' | 'failed'
  >('idle');
  const [isAdBlockOn, setIsAdBlockOn] = useState(readStoredAdBlock);
  // Whether the switch is in the interface at all. Owned by a root-level flag
  // rather than by this component, because the chord that moves it is pressed
  // on the support dialog and this player may not be mounted at the time.
  const isAdBlockRevealed = useIsAdBlockRevealed();
  const activeSite = findSiteForUrl(currentUrl);

  // Held in a ref rather than in state. Nothing renders from it, and a sample
  // every five seconds that re-rendered the pane would be five seconds of work
  // to change nothing on screen.
  const marksRef = useRef<TPlaybackMarks>(readStoredMarks());
  // A position waiting for a page to grow a player. Consumed once, by the next
  // guest that becomes ready — put in a ref because it is a message to a later
  // effect, not a thing the interface has an opinion about.
  const pendingResumeRef = useRef(0);

  /**
   * Note where this site is, over and over, while it plays.
   *
   * Sampled rather than captured on the way out, and that is the whole design.
   * Reading the position at the moment of leaving is one call racing a document
   * that is being torn down, and it gets nothing at all when the way out is the
   * window closing or the app crashing — which, for an equalizer that gets
   * restarted to bounce the audio service, is most of the time. A cheap sample
   * on a timer is already correct when any of those happen.
   *
   * Only while the tab is on screen. A player left running in the background is
   * still playing and its position still moves, but so does the position of the
   * page somebody has since switched to, and the site whose mark this would
   * overwrite is the one they are not looking at.
   */
  useEffect(() => {
    if (isHidden || !isGuestReady || !activeSite) {
      return undefined;
    }

    const sample = () => {
      const view = webviewRef.current;
      if (!view) {
        return;
      }
      // The queue can move without the document changing — a Suno playlist,
      // a YouTube Music queue — and this is the only thing already ticking
      // while it does.
      nowPlayingProbeRef.current();
      try {
        view
          .executeJavaScript(READ_POSITION)
          .then((position) => {
            // The site is worked out from the page, at the moment the page is
            // read, and never carried in from outside this callback.
            //
            // It used to be the `activeSite` this effect closed over, which is
            // a different thing by one render: a tick landing between the
            // navigation and the interface noticing filed the new site's page
            // under the old site's name, and the button then went to the wrong
            // site every time from then on. Reading both halves of the pair
            // from the same source at the same instant is what makes them
            // agree — `rememberPlayback` checks the pairing too, but this is
            // where it stops being wrong in the first place.
            const url = view.getURL();
            const site = findSiteForUrl(url);
            if (!site) {
              return 0;
            }
            const seconds = typeof position === 'number' ? position : 0;
            marksRef.current = rememberPlayback(
              marksRef.current,
              site.id,
              url,
              seconds,
            );
            writeStoredMarks(marksRef.current);
            return seconds;
          })
          .catch(() => undefined);
      } catch {
        // Throws rather than rejects when the guest has gone. The next sample
        // finds the new one, or there is no next sample.
      }
    };

    sample();
    const timer = window.setInterval(sample, RESUME_SAMPLE_MS);
    return () => window.clearInterval(timer);
  }, [activeSite, isGuestReady, isHidden]);

  /**
   * Hand a waiting position to the page that has just loaded.
   *
   * Keyed on the page token, so it fires exactly once per document — which is
   * what makes a single ref enough to carry the position across a navigation.
   *
   * It moves the playhead and stops there. This used to run with `userGesture`
   * set, which did two things at once: it let the script's own `play()` through,
   * and it handed the guest a user activation — the page's own licence to start
   * playing, under the policy in `VIDEO_WEB_PREFERENCES`. Both halves of that
   * are sound nobody asked for, so the call is now made as what it is, which is
   * a script that seeks. Coming back to a site finds the video where it was,
   * paused, on the frame it was left on.
   */
  useEffect(() => {
    const view = webviewRef.current;
    const position = pendingResumeRef.current;
    if (!view || !pageToken || position <= 0) {
      return;
    }
    pendingResumeRef.current = 0;
    try {
      view
        .executeJavaScript(buildResumeSeekScript(position))
        .catch(() => undefined);
    } catch {
      // No web contents to ask; the page is still where it was.
    }
  }, [pageToken]);

  /**
   * This pane's half of the one-player rule.
   *
   * The guest is a whole browser and we do not own what it is doing, so both
   * directions go through the two things a `<webview>` will tell us and the
   * one thing it will let us ask. `media-started-playing` is the claim — by
   * the time it fires the page is already making sound, which is exactly when
   * the album underneath it should stop. `media-paused` gives it back. And
   * being asked to stop is a script that pauses every media element on the
   * page: not a user gesture, so it cannot start anything, only end it.
   *
   * Anything the page opens in its own window is beyond this, and honestly so
   * — we can only speak to the contents we embedded.
   */
  useEffect(() => {
    const view = webviewRef.current;
    if (!view) {
      return undefined;
    }
    /**
     * What the bar shows while the Media tab is the one being looked at.
     *
     * Title, play, pause and stop, a fader, five seconds either way — and the
     * page's own skip buttons where the page has them.
     *
     * No seek SLIDER, still: there is no playhead we own to move and this
     * pane learns the position from a sample every few seconds, so a slider
     * would be a control that lies about where it is. The step is done inside
     * the page instead, which does know.
     *
     * "Next" belongs to whatever site is loaded and means something different
     * on each — the queue on YouTube Music, the album on Bandcamp, nothing at
     * all on a live stream — so the answer is not a rule of ours but the
     * page's own button, pressed where the page has one and not offered where
     * it does not. See `PROBE_SKIP_CONTROLS`.
     */
    let playbackRevision = 0;
    let retainForHandoff = false;
    let isDisposed = false;
    let playbackClockPositionMs = 0;
    let playbackClockDurationMs = 0;
    let playbackClockFrame = 0;
    let playbackClockRevision = 0;
    let playbackClockReadPending = false;
    let lastPlaybackClockRead = -Infinity;
    let handoffFrame = 0;
    let handoffDeadline = 0;
    const describe = (isPlaying: boolean) => {
      // The song where the page publishes one, the page otherwise.
      //
      // A document title is the site, not the track: Suno reads "Suno | AI
      // Music" through every song it plays, and YouTube Music keeps the tab's
      // name while the queue moves underneath it. What those players hand the
      // lock screen is `mediaSession.metadata`, and that is what this bar
      // carries too — see `READ_NOW_PLAYING`.
      const resolvedTitle =
        nowPlayingRef.current.title || view.getTitle() || t('tabs.media');
      setTransportSource({
        owner: 'media',
        title: resolvedTitle,
        subtitle: nowPlayingRef.current.artist || undefined,
        artworkUrl: frameRef.current,
        // The URL is the exact key, plus the track the page published where
        // it published one: two pages can share a title (every unplayed
        // YouTube tab is "YouTube") but never a URL — and an album page keeps
        // one URL across every track on it. `nowPlayingRef` holds ONLY what
        // `mediaSession.metadata` gave us, which is why the published title is
        // passed separately from the resolved one the bar draws.
        identity: buildSongIdentity(
          'media',
          view.getURL(),
          resolvedTitle,
          nowPlayingRef.current.artist,
          nowPlayingRef.current.title,
        ),
        isPlaying,
        retainWhenHidden: retainForHandoff || undefined,
        positionMs: playbackClockPositionMs,
        durationMs: playbackClockDurationMs,
        toggle: () => {
          try {
            // The one call in this pane made WITH a user gesture, because it
            // is one: the reader pressed play on our own bar, and without the
            // activation the guest's `play()` is refused by the autoplay
            // policy the tag is loaded under.
            view
              .executeJavaScript(TOGGLE_PLAYBACK, true)
              .catch(() => undefined);
          } catch {
            // No web contents to ask.
          }
        },
        stop: () => {
          // Stop is a state of this loaded Media page, not the removal of its
          // source. Publish the paused beginning before asking the guest so
          // its later `media-paused` event can only confirm the same bar.
          playbackRevision += 1;
          setHandoffRetention(false);
          stopPlaybackClock();
          playingRef.current = false;
          playbackClockPositionMs = 0;
          describe(false);
          releasePlayback('media');
          try {
            view
              .executeJavaScript(STOP_AND_RESET_PLAYBACK)
              .catch(() => undefined);
          } catch {
            // The loaded description remains; the guest can be retried once it
            // is attached again instead of replacing the bar with idle chrome.
          }
        },
        // Five seconds either way, done inside the page.
        //
        // No `seek` beside it, and that is the honest pair: this pane learns
        // the position from a sample every few seconds — enough to remember
        // where a video was left, nowhere near enough to drive a slider — so
        // the bar gets the step it can offer truthfully rather than a slider
        // it could not. The page holds the playhead and does the arithmetic:
        // see `nudgePositionScript`.
        nudge: (deltaMs: number) => {
          try {
            view
              .executeJavaScript(nudgePositionScript(deltaMs / 1000))
              .catch(() => undefined);
          } catch {
            // No web contents to ask.
          }
        },
        // The page's own, and only where the page has one. `skipsRef` is what
        // the last probe found — see the probe below, which runs on every
        // navigation because a queue appears and disappears with the page.
        next: skipsRef.current.next ? () => press('next') : undefined,
        previous: skipsRef.current.previous
          ? () => press('previous')
          : undefined,
        volume: guestVolumeRef.current,
        setVolume: (value: number) => {
          guestVolumeRef.current = value;
          try {
            view
              .executeJavaScript(setGuestVolumeScript(value))
              .catch(() => undefined);
          } catch {
            // Same: nothing to set it on.
          }
          describe(playingRef.current);
        },
      });
    };
    const stopPlaybackClock = () => {
      playbackClockRevision += 1;
      if (playbackClockFrame !== 0) {
        window.cancelAnimationFrame(playbackClockFrame);
        playbackClockFrame = 0;
      }
    };
    const samplePlaybackClock = (renderTime: number) => {
      if (isDisposed || !playingRef.current) {
        playbackClockFrame = 0;
        return;
      }
      if (
        renderTime - lastPlaybackClockRead >= TRANSPORT_CLOCK_SAMPLE_MS &&
        !playbackClockReadPending
      ) {
        lastPlaybackClockRead = renderTime;
        playbackClockReadPending = true;
        const revision = playbackClockRevision;
        try {
          view
            .executeJavaScript(READ_PLAYBACK_CLOCK)
            .then((clock) => {
              playbackClockReadPending = false;
              if (
                isDisposed ||
                !playingRef.current ||
                playbackClockRevision !== revision
              ) {
                return clock;
              }
              const record = (clock ?? {}) as Record<string, unknown>;
              playbackClockPositionMs =
                typeof record.positionMs === 'number' &&
                Number.isFinite(record.positionMs)
                  ? record.positionMs
                  : 0;
              playbackClockDurationMs =
                typeof record.durationMs === 'number' &&
                Number.isFinite(record.durationMs)
                  ? record.durationMs
                  : 0;
              describe(true);
              return clock;
            })
            .catch(() => {
              playbackClockReadPending = false;
            });
        } catch {
          playbackClockReadPending = false;
        }
      }
      playbackClockFrame = window.requestAnimationFrame(samplePlaybackClock);
    };
    const startPlaybackClock = () => {
      stopPlaybackClock();
      lastPlaybackClockRead = -Infinity;
      playbackClockFrame = window.requestAnimationFrame(samplePlaybackClock);
    };
    const setHandoffRetention = (retain: boolean) => {
      if (handoffFrame !== 0) {
        window.cancelAnimationFrame(handoffFrame);
        handoffFrame = 0;
      }
      retainForHandoff = retain;
      if (!retain) {
        handoffDeadline = 0;
        return;
      }
      handoffDeadline = performance.now() + PLAYBACK_HANDOFF_GRACE_MS;
      const watchHandoff = (now: number) => {
        if (isDisposed || !retainForHandoff) {
          handoffFrame = 0;
          return;
        }
        if (now >= handoffDeadline) {
          handoffFrame = 0;
          retainForHandoff = false;
          describe(false);
          return;
        }
        handoffFrame = window.requestAnimationFrame(watchHandoff);
      };
      handoffFrame = window.requestAnimationFrame(watchHandoff);
    };
    const onPlaying = () => {
      playbackRevision += 1;
      setHandoffRetention(false);
      playingRef.current = true;
      claimPlayback('media');
      describe(true);
      startPlaybackClock();
      nowPlayingProbeRef.current();
      // A frame taken now is a frame of the thing that just started, which is
      // a better picture than the page's poster or its cookie banner.
      grabFrame();
    };
    const onPaused = () => {
      playingRef.current = false;
      stopPlaybackClock();
      const revision = playbackRevision + 1;
      playbackRevision = revision;
      const settlePausedState = (phase: unknown) => {
        if (isDisposed || playbackRevision !== revision) {
          return;
        }
        if (phase === 'playing') {
          onPlaying();
          return;
        }
        // Every natural end gets the bounded lease. Some sites autoplay a
        // queue without exposing a usable Next control; the real next
        // `playing` event cancels it, and expiry handles a final item.
        setHandoffRetention(phase === 'ended');
        describe(false);
        releasePlayback('media');
      };
      try {
        view
          .executeJavaScript(PROBE_PLAYBACK_PHASE)
          .then(settlePausedState)
          .catch(() => settlePausedState('paused'));
      } catch {
        settlePausedState('paused');
      }
    };
    /**
     * Ask the page what it has, and describe it or take the bar away.
     *
     * The tag's own events only fire when playback starts or stops, so a page
     * that arrives with a paused video — which is every video, under the
     * autoplay policy this tag is loaded with — announced nothing, and the
     * Media tab sat there with no bar until something was played. Run when a
     * page finishes arriving instead, and the bar is there to press.
     */
    /**
     * A still of the page, for the bar's cover.
     *
     * The guest is a web page and has no artwork to ask for, so the picture
     * is the picture: one frame, cut down to bar height. Skipped while the
     * tab is hidden — a webview nobody is looking at captures black, and a
     * black square is worse than the generated tile it would replace.
     */
    const grabFrame = () => {
      if (isHiddenRef.current) {
        return;
      }
      try {
        view
          .capturePage()
          .then((image) => {
            if (image.isEmpty()) {
              return undefined;
            }
            // 72 rather than the bar's 36: the cover is drawn at a device
            // pixel ratio this process cannot know, and a picture asked for
            // at exactly its drawn size is the one that looks soft.
            frameRef.current = image.resize({ height: 72 }).toDataURL();
            describe(playingRef.current);
            return undefined;
          })
          .catch(() => undefined);
      } catch {
        // No web contents to photograph.
      }
    };

    /**
     * Press the page's own skip control.
     *
     * With a user gesture, which is what it is: somebody pressed a transport
     * button on our bar, and the next track does not start under the guest's
     * autoplay policy without it — see `VIDEO_WEB_PREFERENCES`.
     */
    const press = (direction: 'next' | 'previous') => {
      try {
        view
          .executeJavaScript(skipScript(direction), true)
          // The page it lands on is a different page: probe again so the
          // buttons match what the new one has, and so the title on the bar
          // is the track that is now playing.
          .then(() => probeSkips())
          .catch(() => undefined);
      } catch {
        // No web contents to ask.
      }
    };

    /**
     * What the page can be asked to skip to, asked of the page.
     *
     * On every navigation, because it changes with one: a YouTube video
     * opened on its own has no next until it is opened from a playlist, and
     * YouTube Music has neither until something is queued.
     */
    const probeSkips = () => {
      try {
        view
          .executeJavaScript(PROBE_SKIP_CONTROLS)
          .then((found) => {
            const record = (found ?? {}) as Record<string, unknown>;
            const next = record.next === true;
            const previous = record.previous === true;
            if (
              next === skipsRef.current.next &&
              previous === skipsRef.current.previous
            ) {
              return found;
            }
            skipsRef.current = { next, previous };
            describe(playingRef.current);
            return found;
          })
          .catch(() => undefined);
      } catch {
        // No web contents to ask.
      }
    };

    /**
     * What the page says is playing, asked of the page.
     *
     * Cheap and idempotent, so it runs anywhere the answer could have moved:
     * on navigation with the rest of the probe, and on the position sample,
     * which is the one thing already ticking while a queue advances without
     * the document changing at all — a Suno playlist, a YouTube Music queue.
     */
    const probeNowPlaying = () => {
      try {
        view
          .executeJavaScript(READ_NOW_PLAYING)
          .then((found) => {
            const record = (found ?? {}) as Record<string, unknown>;
            const title =
              typeof record.title === 'string' ? record.title : undefined;
            const artist =
              typeof record.artist === 'string' && record.artist
                ? record.artist
                : undefined;
            if (
              title === nowPlayingRef.current.title &&
              artist === nowPlayingRef.current.artist
            ) {
              return found;
            }
            nowPlayingRef.current = { title, artist };
            describe(playingRef.current);
            return found;
          })
          .catch(() => undefined);
      } catch {
        // No web contents to ask.
      }
    };
    nowPlayingProbeRef.current = probeNowPlaying;

    const probe = () => {
      probeSkips();
      probeNowPlaying();
      try {
        view
          .executeJavaScript(PROBE_PLAYBACK)
          .then((state) => {
            if (typeof state !== 'boolean') {
              clearTransportSource('media');
              return state;
            }
            playingRef.current = state;
            if (state) {
              setHandoffRetention(false);
              claimPlayback('media');
              startPlaybackClock();
            }
            describe(state);
            grabFrame();
            return state;
          })
          .catch(() => undefined);
      } catch {
        // No web contents to ask.
      }
    };
    view.addEventListener('media-started-playing', onPlaying);
    view.addEventListener('media-paused', onPaused);
    view.addEventListener('dom-ready', probe);
    view.addEventListener('did-navigate', probe);
    view.addEventListener('did-navigate-in-page', probe);
    view.addEventListener('page-title-updated', probe);
    const unregister = registerPlayer('media', () => {
      playbackRevision += 1;
      setHandoffRetention(false);
      stopPlaybackClock();
      playingRef.current = false;
      describe(false);
      releasePlayback('media');
      try {
        view.executeJavaScript(STOP_PLAYBACK).catch(() => undefined);
      } catch {
        // No web contents to ask — nothing is playing in one that is gone.
      }
    });
    return () => {
      isDisposed = true;
      playbackRevision += 1;
      setHandoffRetention(false);
      stopPlaybackClock();
      view.removeEventListener('media-started-playing', onPlaying);
      view.removeEventListener('media-paused', onPaused);
      view.removeEventListener('dom-ready', probe);
      view.removeEventListener('did-navigate', probe);
      view.removeEventListener('did-navigate-in-page', probe);
      view.removeEventListener('page-title-updated', probe);
      unregister();
      clearTransportSource('media');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Strip the page back to its player while the graph is over it.
   *
   * Re-applied when the guest reloads: a navigation throws inserted CSS away
   * with the document, so without `isGuestReady` in the dependencies the second
   * video would come back wearing the whole page.
   */
  /**
   * Make sure the page is *not* in its own fullscreen while a mode is on.
   *
   * Tried the other way and it cannot work, for a reason that is structural
   * rather than a value to tune: when the guest enters HTML fullscreen, Electron
   * puts the `<webview>` element itself into the host document's top layer. The
   * top layer is above every stacking context by definition — that is what it
   * is for — so no `z-index` on this side can reach over it and the graph is
   * simply not on screen. A video with a spectrum over it is the entire point
   * of these modes, so the site's fullscreen is the thing that has to go.
   *
   * The stripping below does the same job without it: the page is reduced to
   * its player, pinned to the viewport, in the ordinary layers where the graph
   * can be drawn on top.
   */
  useEffect(() => {
    const view = webviewRef.current;
    if (!view || isHidden || !isGuestReady || graphView === 'normal') {
      return;
    }
    try {
      // Asked without a gesture, unlike the call this replaces. Leaving a
      // fullscreen is not gesture-gated — only entering one is — so the flag
      // bought nothing here, and it cost something: it grants the guest a user
      // activation, which is the page's licence to start playing on its own.
      // This effect runs at `dom-ready` whenever the graph is expanded, so with
      // the flag on, opening the tab in that state was the autoplay again by
      // another road.
      view.executeJavaScript(EXIT_PAGE_FULLSCREEN).catch(() => undefined);
    } catch {
      // The guest went away, and took its fullscreen with it.
    }
  }, [graphView, isGuestReady, isHidden]);

  useEffect(() => {
    const view = webviewRef.current;
    if (!view || isHidden || !isGuestReady || graphView === 'normal') {
      return undefined;
    }
    let key: string | undefined;
    let isCancelled = false;
    // Claimed before either call goes out, so the teardown below carries the
    // same number as the setup it belongs to, whichever order they land in.
    soloGeneration += 1;
    const generation = soloGeneration;
    // Named rather than inline in the chain: the removal it may issue is a
    // promise of its own, and a chain inside a handler is what reads as a
    // race when it is not one.
    const keepOrRemove = (inserted: string) => {
      if (isCancelled) {
        // The mode changed while this was in flight. Take it straight back
        // out rather than leaving a sheet nothing holds the key to.
        view.removeInsertedCSS(inserted).catch(() => undefined);
      } else {
        key = inserted;
      }
      return inserted;
    };
    try {
      view
        .insertCSS(PLAYER_ONLY_CSS)
        .then(keepOrRemove)
        .catch(() => undefined);
      // The stylesheet does nothing until the chain is marked; the two go in
      // together and come out together.
      view
        .executeJavaScript(enterPlayerOnlyScript(generation))
        .catch(() => undefined);
    } catch {
      // No web contents to inject into, and so nothing to undo either.
    }
    return () => {
      isCancelled = true;
      if (key !== undefined) {
        view.removeInsertedCSS(key).catch(() => undefined);
      }
      try {
        view
          .executeJavaScript(exitPlayerOnlyScript(generation))
          .catch(() => undefined);
      } catch {
        // The guest is gone, which disconnects the observer rather more
        // thoroughly than asking it to.
      }
    };
    // Deliberately not keyed on `pageToken`, however tempting it looks.
    //
    // A navigation does throw the inserted CSS away, and this effect does only
    // run once — so re-running it per document reads like the obvious fix. It
    // is not: the cleanup disconnects the observer and unmarks the tree while
    // the new run is inserting a sheet and marking it again, and the two orders
    // those can land in are "stripped" and "black". Tried, and it broke the
    // player intermittently, which is worse than the thing it was fixing.
    //
    // Whatever replaces this has to sequence the teardown against the setup
    // rather than let React interleave them.
  }, [graphView, isGuestReady, isHidden]);

  // Written on every navigation rather than on close. There is no reliable
  // "about to quit" moment in a renderer — the window can go with the audio
  // service, or with a crash — and the whole reason this exists is the restarts
  // that are not orderly.
  useEffect(() => {
    if (!currentUrl || !isNavigableVideoUrl(currentUrl)) {
      return;
    }
    try {
      localStorage.setItem(VIDEO_LAST_URL_KEY, currentUrl);
    } catch {
      // Coming back to the home page is a small loss, not a failure.
    }
  }, [currentUrl]);

  /**
   * A popup the main process refused, reported here.
   *
   * `will-navigate` is visible to this component and already raises the notice.
   * A `target="_blank"` is not: it is answered in the main process, so a click
   * that opened a window to somewhere unlisted did nothing at all and looked
   * exactly like a broken page. The boundary should be legible; that is the
   * whole point of having one.
   */
  useEffect(() => {
    const off = window.electron.ipcRenderer.on(
      VIDEO_LINK_BLOCKED,
      (...args: unknown[]) => {
        const [url] = args;
        if (typeof url === 'string' && url) {
          setBlockedUrl(url);
        }
      },
    );
    // Wrapped rather than returned directly: the unsubscribe hands back the
    // IpcRenderer, and a cleanup that returns anything is not a cleanup.
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    const off = window.electron.ipcRenderer.on(
      VIDEO_DOWNLOAD_CHANGED,
      (...args: unknown[]) => {
        const [update] = args;
        if (!isVideoDownloadUpdate(update)) {
          return;
        }
        setDownloadPathCopied(false);
        setDownloadUpdate(update.phase === 'cancelled' ? undefined : update);
      },
    );
    return () => {
      off();
    };
  }, []);

  const copyDownloadPath = useCallback(async () => {
    if (!downloadUpdate?.filePath) {
      return;
    }
    try {
      await navigator.clipboard.writeText(downloadUpdate.filePath);
      setDownloadPathCopied(true);
    } catch {
      setDownloadPathCopied(false);
    }
  }, [downloadUpdate]);

  // What the blocker actually runs on. A switch nobody has found cannot be on,
  // whatever a stored value left by another build might say — the interface
  // showing nothing and the player stripping ads is the one combination that
  // must not be reachable.
  const isAdBlockActive = isAdBlockRevealed && isAdBlockOn;

  // Pushed to the main process, which is where the blocker actually reads it
  // from. Runs on mount too, so a player attached later starts in the state the
  // switch is already in rather than in the default.
  useEffect(() => {
    window.electron.ipcRenderer.sendMessage(ChannelEnum.SET_VIDEO_AD_BLOCK, [
      isAdBlockActive,
    ]);
    try {
      localStorage.setItem(VIDEO_AD_BLOCK_STORAGE_KEY, String(isAdBlockOn));
    } catch {
      // A preference that cannot be written is not worth failing a click over.
    }
  }, [isAdBlockActive, isAdBlockOn]);

  // The switch going out of sight switches it off with it, so that what comes
  // back later is a control that is off rather than one still holding a setting
  // nobody can see. The flag persists the same decision for a player that was
  // not mounted to hear it; this is the half that applies to one that was.
  useEffect(() => {
    if (!isAdBlockRevealed) {
      setIsAdBlockOn(false);
    }
  }, [isAdBlockRevealed]);

  /**
   * Read the guest's navigation state back out.
   *
   * Both calls throw if the guest has gone — a reload mid-teardown, or the tab
   * closing — and neither answer matters at that point.
   */
  const syncNavigationState = useCallback(() => {
    const view = webviewRef.current;
    if (!view) {
      return;
    }
    try {
      setCanGoBack(view.canGoBack());
      setCanGoForward(view.canGoForward());
      setCurrentUrl(view.getURL());
    } catch {
      // The guest is not attached yet, or no longer is.
    }
  }, []);

  useEffect(() => {
    const view = webviewRef.current;
    if (!view) {
      return undefined;
    }

    const handleNavigated = (event: Event) => {
      const { url } = event as Event & { url?: string };
      if (url) {
        setCurrentUrl(url);
      }
      syncNavigationState();
    };

    const handleStartLoading = () => setIsLoading(true);
    const handleStopLoading = () => {
      setIsLoading(false);
      syncNavigationState();
    };

    /**
     * Say something when a link goes nowhere.
     *
     * The main process is what actually refuses the navigation; this listener
     * exists only so the refusal is visible. Without it a link to somewhere
     * off the list would simply do nothing, which reads as a frozen app rather
     * than as a deliberate boundary.
     */
    const handleWillNavigate = (event: Event) => {
      const { url } = event as Event & { url?: string };
      if (url && !isNavigableVideoUrl(url)) {
        setBlockedUrl(url);
      }
    };

    const handleEnterFullScreen = () => {
      // THERE IS NO GUEST-OWNED FULL-SCREEN STATE.
      //
      // YouTube, Twitch and the other guests ask Electron to put the webview in
      // the document's top layer. That layer is above FluidEQ's titlebar, graph
      // and exit controls, so it is the state that ate the top of the Media
      // screen and could not survive a switch to Library or Karaoke.
      //
      // Leave the guest's top layer immediately, then promote the same click to
      // the shared FluidEQ window-fullscreen state. The player still fills the
      // Media workspace, but App owns tab changes, Escape, the optional top bar
      // and the one exit path.
      try {
        view.executeJavaScript(EXIT_PAGE_FULLSCREEN).catch(() => undefined);
      } catch {
        // The guest can disappear between making the request and this event.
      }
      onRequestFullScreenRef.current();
    };
    const handleLeaveFullScreen = () => {
      // Normally the acknowledgement of EXIT_PAGE_FULLSCREEN above. Treating
      // it as an app exit would undo shared fullscreen in the entering gesture.
    };
    const handleGuestMessage = (event: Event) => {
      const { channel } = event as Event & { channel?: string };
      if (channel === VIDEO_GRAPH_FULLSCREEN_REQUEST) {
        onRequestGraphFullScreenRef.current();
      }
    };

    // Nothing may be asked of the guest before this.
    //
    // `executeJavaScript` needs a web contents id, and the tag has none until
    // it is attached and its document exists — so calling it early does not
    // reject, it *throws*, which is a different thing to have to catch and the
    // reason the first attempt at this blew up on mount.
    // Once, and it stays true.
    //
    // It used to be cleared again on `did-start-navigation`, on the reasoning
    // that a new document means a new id. That reasoning is wrong twice over:
    // the id belongs to the tag rather than to the document, so it survives a
    // navigation — and YouTube is a single-page app that fires that event
    // constantly for its own in-page routing. So the flag spent almost all of
    // its time false, and the one thing gated on it, taking the page's player
    // full screen, almost never ran.
    const handleReady = () => {
      setIsGuestReady(true);
      // Counted, not flagged.
      //
      // `isGuestReady` only ever goes from false to true, so an effect that
      // depends on it runs once for the life of the pane — which is not what
      // "re-applied when the guest reloads" needs, and quietly was not
      // happening: the second video came back wearing the whole page because
      // the injection never ran again. A number that changes on every
      // `dom-ready` is the honest way to say "a new document exists", and both
      // the page-stripping and the resume hang off it.
      setPageToken((token) => token + 1);
    };

    view.addEventListener('did-navigate', handleNavigated);
    view.addEventListener('did-navigate-in-page', handleNavigated);
    view.addEventListener('did-start-loading', handleStartLoading);
    view.addEventListener('did-stop-loading', handleStopLoading);
    view.addEventListener('will-navigate', handleWillNavigate);
    view.addEventListener('enter-html-full-screen', handleEnterFullScreen);
    view.addEventListener('leave-html-full-screen', handleLeaveFullScreen);
    view.addEventListener('ipc-message', handleGuestMessage);
    view.addEventListener('dom-ready', handleReady);

    return () => {
      view.removeEventListener('did-navigate', handleNavigated);
      view.removeEventListener('did-navigate-in-page', handleNavigated);
      view.removeEventListener('did-start-loading', handleStartLoading);
      view.removeEventListener('did-stop-loading', handleStopLoading);
      view.removeEventListener('will-navigate', handleWillNavigate);
      view.removeEventListener('enter-html-full-screen', handleEnterFullScreen);
      view.removeEventListener('leave-html-full-screen', handleLeaveFullScreen);
      view.removeEventListener('ipc-message', handleGuestMessage);
      view.removeEventListener('dom-ready', handleReady);
    };
  }, [syncNavigationState]);

  const goTo = useCallback((url: string) => {
    setBlockedUrl('');
    const view = webviewRef.current;
    if (!view) {
      return;
    }
    try {
      // Stop whatever is playing before leaving the page.
      //
      // YouTube Music holds onto its player hard: choosing another site while
      // it was playing did nothing at all, because a media element still
      // running keeps the document alive against the navigation the tag is
      // trying to start. Pausing first lets go of it.
      //
      // One player, always — the tag is reused rather than one per site — so
      // there is never a second video in memory once this document goes.
      view
        .executeJavaScript(STOP_PLAYBACK)
        .catch(() => undefined)
        .finally(() => {
          view.loadURL(url).catch(() => {
            // A navigation replaced by a newer one rejects; not a failure.
          });
        });
    } catch {
      // No web contents to ask. Nothing is playing in that case either.
      view.loadURL(url).catch(() => undefined);
    }
  }, []);

  /**
   * Open a site where it was left rather than at its front page.
   *
   * The buttons are the things you move between, so they should behave like
   * tabs: coming back to YouTube Music should find the album that was playing,
   * not a page of recommendations. The position goes into the ref for the
   * effect above to pick up once the new page has a player to seek.
   *
   * Pressing the site you are already on is the way back to its front page.
   * Without that there would be no way to reach it again short of clearing the
   * mark, and a button that reloads the page you are looking at is not worth
   * having when it could do something.
   */
  const goToSite = useCallback(
    (site: IVideoSite) => {
      if (activeSite?.id === site.id) {
        pendingResumeRef.current = 0;
        goTo(site.home);
        return;
      }
      pendingResumeRef.current = resumePositionFor(marksRef.current, site.id);
      goTo(resumeUrlFor(marksRef.current, site.id) ?? site.home);
    },
    [activeSite, goTo],
  );

  const handleSearch = useCallback(
    (terms: string) => {
      if (!terms.trim()) {
        return;
      }
      // Searched on whichever site is open, so the button that is lit is also
      // the one being asked. Off any of them, YouTube answers.
      goTo(buildSearchUrl(activeSite ?? HOME_SITE, terms));
    },
    [activeSite, goTo],
  );

  /**
   * Sign out of everything, and say so.
   *
   * The main process does the clearing and sends every player home afterwards,
   * so there is nothing to reload from here — a page left showing somebody's
   * name from cache is exactly the failure this button exists to avoid, and it
   * is fixed on the side that knows when the store is actually empty.
   *
   * `once` rather than a standing listener: a reply belongs to the press that
   * asked for it, and a listener that outlived the press would answer a later
   * one with an earlier result.
   */
  const handleSignOut = useCallback(() => {
    setSignOutState('clearing');
    window.electron.ipcRenderer.once(ChannelEnum.CLEAR_VIDEO_SESSION, (arg) => {
      const reply = arg as { result?: boolean };
      setSignOutState(reply?.result ? 'done' : 'failed');
    });
    window.electron.ipcRenderer.sendMessage(
      ChannelEnum.CLEAR_VIDEO_SESSION,
      [],
    );
  }, []);

  // The confirmation clears itself. Left up, "Signed out" would still be on
  // screen the next time somebody looked to check whether they were — which is
  // the one question this control exists to answer, answered wrongly.
  useEffect(() => {
    if (signOutState !== 'done' && signOutState !== 'failed') {
      return undefined;
    }
    const timer = window.setTimeout(
      () => setSignOutState('idle'),
      SIGN_OUT_NOTICE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [signOutState]);

  const blockedHost = (() => {
    try {
      // A refused address with no host — `about:blank` is the one that happens
      // — would print an empty string, which is a notice that says nothing at
      // all. The whole address is worth more than a blank in that case.
      return new URL(blockedUrl).hostname || blockedUrl;
    } catch {
      return blockedUrl;
    }
  })();

  /**
   * Whether the real browser could do anything with this if offered it.
   *
   * `shell.openExternal` is handed the address in the main process and refuses
   * anything that is not `http:` or `https:` — rightly, since the OS acts on
   * whatever scheme it is given. But the button offering it was drawn
   * regardless, so a refusal of `about:blank` put up a control that did
   * precisely nothing when pressed, which is worse than not offering it: it
   * reads as the app being broken rather than as the address being unopenable.
   */
  const canOpenBlockedExternally = (() => {
    try {
      const { protocol } = new URL(blockedUrl);
      return protocol === 'https:' || protocol === 'http:';
    } catch {
      return false;
    }
  })();

  // There used to be a second kind of refusal here: a sign-in, turned away on
  // purpose and told apart from a link off the list so it could be answered
  // differently. Sign-in is the point now, so there is one kind of refusal left
  // — the address is not on the list — and one thing to say about it.

  return (
    <div
      // `workspace-tab-panel--video` is what marks this out as the tab's panel.
      //
      // It had no such class, because this is the one tab rendered outside the
      // switch that builds the others — it is hidden rather than unmounted, so
      // that leaving the tab does not stop the music. Everything keyed on the
      // panel therefore missed it: the card the other tabs have never applied,
      // and, worse, the rule that clears the workspace behind an expanded graph
      // asks "is the video tab open?" by looking for exactly this class — so
      // the answer was always no and the player was hidden along with the rest.
      // Which is the opposite of the point: the player is the one thing worth
      // keeping behind the graph.
      className={`video-browser workspace-tab-panel--video${
        isHidden ? ' is-hidden' : ''
      }${isFullScreen ? ' is-fullscreen' : ''}${
        isGraphBackdrop ? ' is-playback-backdrop' : ''
      }`}
    >
      {!isHidden && (
        <div className="video-browser__bar">
          <div className="video-browser__nav">
            <button
              type="button"
              className="video-browser__nav-button"
              aria-label={t('video.back')}
              title={t('video.back')}
              disabled={!canGoBack}
              onClick={() => webviewRef.current?.goBack()}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M10 3L5 8l5 5" />
              </svg>
            </button>
            <button
              type="button"
              className="video-browser__nav-button"
              aria-label={t('video.forward')}
              title={t('video.forward')}
              disabled={!canGoForward}
              onClick={() => webviewRef.current?.goForward()}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M6 3l5 5-5 5" />
              </svg>
            </button>
            <button
              type="button"
              className="video-browser__nav-button"
              aria-label={isLoading ? t('video.stop') : t('video.reload')}
              title={isLoading ? t('video.stop') : t('video.reload')}
              onClick={() => {
                const view = webviewRef.current;
                if (isLoading) {
                  view?.stop();
                } else {
                  view?.reload();
                }
              }}
            >
              {isLoading ? (
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2v3h-3" />
                </svg>
              )}
            </button>
          </div>

          <div
            className="video-browser__sites"
            role="group"
            aria-label={t('video.sites')}
          >
            {VIDEO_SITES.map((site) => (
              <button
                key={site.id}
                type="button"
                className={`video-browser__site${
                  activeSite?.id === site.id ? ' is-active' : ''
                }`}
                aria-pressed={activeSite?.id === site.id}
                onClick={() => goToSite(site)}
              >
                <VideoSiteIcon siteId={site.id} />
                {site.name}
              </button>
            ))}
          </div>

          <div className="video-browser__search">
            <VideoSearch
              handleSearch={handleSearch}
              siteName={(activeSite ?? HOME_SITE).name}
            />
          </div>

          {/*
          THE OTHER HALF OF A SESSION THAT REMEMBERS.

          The player keeps cookies now, so that signing in is worth doing — and
          the moment it does, somebody has to be able to undo it. Always there,
          unlike the ad-block switch behind its chord: a privacy control that has
          to be discovered is one most people never find, and this one is the
          whole justification for the store existing.

          A MARK RATHER THAN A SENTENCE. It was a labelled button with a result
          beside it, which is two pieces of prose in a toolbar whose other
          controls are all glyphs — and it read as the loudest thing in the row
          for something pressed once a month. The words live in the tooltip and
          the label the screen reader gets; the corner keeps one small square.

          It still says what it did, in the only currency it has left: the glyph
          becomes a tick or a cross for a few seconds. A press that clears every
          login and then shows nothing is indistinguishable from one that failed,
          and that difference matters more here than anywhere else in the app.
        */}
          <button
            type="button"
            className={`video-browser__sign-out is-${signOutState}`}
            onClick={handleSignOut}
            disabled={signOutState === 'clearing'}
            title={t('video.signOutHint')}
            aria-label={t(
              {
                idle: 'video.signOut',
                clearing: 'video.signOutBusy',
                done: 'video.signOutDone',
                failed: 'video.signOutFailed',
              }[signOutState] as TranslationKey,
            )}
          >
            {/* Announced through the button's own label, so the drawing is
              hidden from anything that reads rather than looks. */}
            <svg viewBox="0 0 16 16" aria-hidden>
              {signOutState === 'done' && <path d="M3.5 8.4l3 3 6-6.6" />}
              {signOutState === 'failed' && (
                <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
              )}
              {signOutState !== 'done' && signOutState !== 'failed' && (
                // A door with an arrow leaving it, which is what every other
                // application in the world uses for this.
                <>
                  <path d="M9.5 2.5h-6v11h6" />
                  <path d="M7.5 8h7M11.5 5l3 3-3 3" />
                </>
              )}
            </svg>
          </button>

          {isAdBlockRevealed && (
            <div className="video-browser__ad-block">
              <span
                className="video-browser__ad-block-label"
                title={t('video.adBlockHint')}
              >
                {t('video.adBlock')}
              </span>
              <Switch
                id="videoAdBlocker"
                isOn={isAdBlockOn}
                isDisabled={false}
                handleToggle={() => setIsAdBlockOn((on) => !on)}
              />
            </div>
          )}
        </div>
      )}

      <div className="video-browser__stage">
        <Webview
          ref={webviewRef}
          className="video-browser__view"
          src={initialUrl.current}
          // Named here as well as forced in the main process. This is the value
          // that has to be right for the tag to attach at all; the main process
          // overwrites it anyway, so the two can never drift apart.
          partition={VIDEO_BROWSER_PARTITION}
          // Same reasoning as the partition above: named here as well as forced
          // in the main process, because this is one of the attributes the tag
          // reads while attaching. Setting it only in `will-attach-webview` was
          // too late — the guest attached without it and `window.open` returned
          // null, so SoundCloud showed "Please enable popup windows and try
          // again" with a handler standing ready that Chromium never consulted.
          //
          // It does NOT widen what may open. Every popup is still put to
          // `setWindowOpenHandler`, still checked against the allow-list, and
          // still refused with a notice naming the host. This only lets the
          // question be asked.
          allowpopups="true"
          webpreferences={VIDEO_WEB_PREFERENCES}
        />
        {!isHidden && downloadUpdate && (
          <div
            className={`video-browser__download is-${downloadUpdate.phase}`}
            role={downloadUpdate.phase === 'failed' ? 'alert' : 'status'}
            aria-live="polite"
          >
            <div className="video-browser__download-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20">
                <path d="M10 2v10m0 0 4-4m-4 4L6 8M3 15.5h14" />
              </svg>
            </div>
            <div className="video-browser__download-copy">
              <strong>
                {downloadUpdate.phase === 'choosing' &&
                  t('video.downloadChoosing')}
                {downloadUpdate.phase === 'downloading' &&
                  t('video.downloadSaving', {
                    file: downloadUpdate.fileName,
                  })}
                {downloadUpdate.phase === 'completed' &&
                  t('video.downloadComplete')}
                {downloadUpdate.phase === 'failed' && t('video.downloadFailed')}
              </strong>
              <span title={downloadUpdate.filePath ?? downloadUpdate.fileName}>
                {downloadUpdate.filePath ?? downloadUpdate.fileName}
              </span>
              {(downloadUpdate.phase === 'choosing' ||
                downloadUpdate.phase === 'downloading') && (
                <>
                  <div
                    className="video-browser__download-progress"
                    role="progressbar"
                    aria-label={t('video.downloadProgress')}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={
                      downloadUpdate.percent !== undefined
                        ? Math.round(downloadUpdate.percent)
                        : undefined
                    }
                  >
                    <span
                      style={{
                        width: `${downloadUpdate.percent ?? 0}%`,
                      }}
                    />
                  </div>
                  <small>
                    {formatDownloadBytes(downloadUpdate.receivedBytes)}
                    {downloadUpdate.totalBytes !== undefined &&
                      ` / ${formatDownloadBytes(downloadUpdate.totalBytes)}`}
                    {downloadUpdate.percent !== undefined &&
                      ` · ${Math.round(downloadUpdate.percent)}%`}
                  </small>
                </>
              )}
            </div>
            {downloadUpdate.phase === 'completed' &&
              downloadUpdate.filePath && (
                <div className="video-browser__download-actions">
                  <button type="button" onClick={copyDownloadPath}>
                    {downloadPathCopied
                      ? t('video.downloadCopied')
                      : t('video.downloadCopyPath')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.electron.ipcRenderer
                        .revealVideoDownload(downloadUpdate.filePath as string)
                        .catch(() => undefined);
                    }}
                  >
                    {t('video.downloadShowFolder')}
                  </button>
                </div>
              )}
            {(downloadUpdate.phase === 'completed' ||
              downloadUpdate.phase === 'failed') && (
              <button
                type="button"
                aria-label={t('app.dismiss')}
                className="video-browser__download-dismiss"
                onClick={() => setDownloadUpdate(undefined)}
              >
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M3 3l6 6M9 3l-6 6" />
                </svg>
              </button>
            )}
          </div>
        )}
        {!isHidden && blockedUrl && (
          <div className="video-browser__blocked" role="alert">
            <div>
              <strong>{t('video.blockedTitle')}</strong>
              <span title={blockedUrl}>{blockedHost}</span>
            </div>
            {canOpenBlockedExternally && (
              <button
                type="button"
                onClick={() => {
                  window.electron.ipcRenderer.sendMessage(
                    ChannelEnum.OPEN_VIDEO_LINK_EXTERNALLY,
                    [blockedUrl],
                  );
                  setBlockedUrl('');
                }}
              >
                {t('video.openInBrowser')}
              </button>
            )}
            <button
              type="button"
              aria-label={t('app.dismiss')}
              className="video-browser__blocked-dismiss"
              onClick={() => setBlockedUrl('')}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoBrowser;
