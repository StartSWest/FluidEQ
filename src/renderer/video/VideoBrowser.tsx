/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
import {
  VIDEO_AD_BLOCK_DEFAULT,
  VIDEO_AD_BLOCK_STORAGE_KEY,
} from 'common/videoAdBlock';
import {
  IVideoSite,
  VIDEO_BROWSER_PARTITION,
  VIDEO_SITES,
  VIDEO_LINK_BLOCKED,
  buildSearchUrl,
  findSiteForUrl,
  isNavigableVideoUrl,
  isSignInUrl,
} from 'common/videoSites';
import {
  TPlaybackMarks,
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
import VideoSiteIcon from './VideoSiteIcon';
import '../styles/VideoBrowser.scss';

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
  loadURL(url: string): Promise<void>;
  /**
   * The second argument is what makes this useful: it tells Chromium to treat
   * the call as though the user had done it. Without it `requestFullscreen`
   * refuses — it is gesture-gated, and rightly so — and the player would
   * silently stay windowed.
   */
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
  /** Returns a key the stylesheet can be removed by. */
  insertCSS(css: string): Promise<string>;
  removeInsertedCSS(key: string): Promise<void>;
}

/**
 * Just the picture, with the page it came from out of the way.
 *
 * Injected while the graph is expanded or full screen. The rest of a video page
 * — header, sidebar, recommendations, comments — is what you scroll through to
 * *find* something; once it is playing with a spectrum over it, all of it is
 * furniture around a rectangle.
 *
 * Hidden by chain rather than by pinning the player. A z-index only sorts within
 * its own stacking context and these sites nest their players in several, so a
 * player told to be above everything still had the comments painted over it.
 * Marking the path from the document down to the player and hiding whatever is
 * not on it at each level has no such ceiling, and names nothing per-site.
 *
 * The pruning stops *at* the player: it is on the chain itself, so without that
 * the rule reached inside and hid its own children — the video among them.
 */
const PLAYER_ONLY_CSS = `
  html[data-fluideq-solo],
  html[data-fluideq-solo] body {
    overflow: hidden !important;
    background: #000 !important;
  }
  html[data-fluideq-solo]
    [data-fluideq-keep]:not([data-fluideq-player])
    > *:not([data-fluideq-keep]) {
    display: none !important;
  }
  html[data-fluideq-solo] [data-fluideq-keep]:not([data-fluideq-player]) {
    display: block !important;
    width: auto !important;
    max-width: none !important;
    height: auto !important;
    max-height: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  html[data-fluideq-solo] [data-fluideq-player] {
    position: fixed !important;
    z-index: 2147483647 !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background: #000 !important;
  }

`;

/**
 * Mark the path to the player, and keep it marked.
 *
 * The observer is the part that matters. Marking once works for about a second
 * on YouTube: it is a single-page app that rebuilds its own tree constantly, and
 * the moment it swapped the player out, the marks pointed at elements no longer
 * in the document — so the rule hid everything and left a black screen. Re-
 * marking whenever the tree changes is what makes this survive contact with a
 * real site.
 *
 * Coalesced onto an animation frame, because a page like that mutates hundreds
 * of times a second and re-walking the ancestor chain on each one would cost
 * more than the page it is hiding.
 */
const ENTER_PLAYER_ONLY = `(() => {
  // Most specific first, because several of these match on the same page and
  // the first hit wins. YouTube Music is why the list is ordered rather than
  // merely long: it wraps the same '#movie_player' YouTube uses inside its own
  // 'ytmusic-player', and marking the inner one leaves the app's chrome — nav
  // rail, queue, now-playing bar — off the chain and therefore hidden, which on
  // a music app removes the half people actually use.
  const SELECTOR =
    'ytmusic-player, #movie_player, .html5-video-player, [data-a-target="video-player"]';
  const mark = () => {
    // The largest video, rather than the first in the document. Pages are full
    // of thumbnails and preview loops; the one being watched is the big one.
    const videos = Array.from(document.querySelectorAll('video'));
    videos.sort(
      (a, b) =>
        b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight
    );
    const player =
      document.querySelector(SELECTOR) ||
      (videos[0] && videos[0].parentElement);
    if (!player) { return; }
    // Already correct, and still attached. The common case by far.
    if (player.hasAttribute('data-fluideq-player') && player.isConnected) {
      return;
    }
    document
      .querySelectorAll('[data-fluideq-keep], [data-fluideq-player]')
      .forEach((node) => {
        node.removeAttribute('data-fluideq-keep');
        node.removeAttribute('data-fluideq-player');
      });
    player.setAttribute('data-fluideq-player', '');
    let node = player;
    while (node && node !== document.documentElement) {
      node.setAttribute('data-fluideq-keep', '');
      node = node.parentElement;
    }
    document.documentElement.setAttribute('data-fluideq-solo', '');
  };
  mark();
  if (window.__fluideqSolo) { window.__fluideqSolo.disconnect(); }
  let queued = false;
  window.__fluideqSolo = new MutationObserver(() => {
    if (queued) { return; }
    queued = true;
    requestAnimationFrame(() => { queued = false; mark(); });
  });
  window.__fluideqSolo.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  return 'ok';
})()`;

const EXIT_PLAYER_ONLY = `(() => {
  if (window.__fluideqSolo) {
    window.__fluideqSolo.disconnect();
    window.__fluideqSolo = undefined;
  }
  document.documentElement.removeAttribute('data-fluideq-solo');
  document
    .querySelectorAll('[data-fluideq-keep], [data-fluideq-player]')
    .forEach((node) => {
      node.removeAttribute('data-fluideq-keep');
      node.removeAttribute('data-fluideq-player');
    });
  return 'ok';
})()`;

/**
 * Pause every media element on the page.
 *
 * Run before navigating away. A player still running holds its document open
 * against the navigation, which is why choosing another site while YouTube
 * Music was playing appeared to do nothing at all — the request was made and
 * the page simply would not let go.
 */
const STOP_PLAYBACK = `(() => {
  document.querySelectorAll('video, audio').forEach((media) => {
    try { media.pause(); } catch (e) { /* already gone */ }
  });
  return 'ok';
})()`;

/**
 * How far into whatever is playing, in seconds.
 *
 * The one that is running is preferred over the one that is biggest: a page can
 * hold a muted preview loop larger than the thing being listened to, and an
 * audio element has no size at all, so area alone picks the wrong one on a
 * music site. Falls back to the largest when nothing is playing, which is the
 * paused video somebody means to come back to.
 */
const READ_POSITION = `(() => {
  const media = Array.from(document.querySelectorAll('video, audio'));
  if (!media.length) { return 0; }
  media.sort(
    (a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight)
  );
  const playing = media.find((el) => !el.paused && el.currentTime > 0);
  const chosen = playing || media[0];
  return Number.isFinite(chosen.currentTime) ? chosen.currentTime : 0;
})()`;

/**
 * Pick the video back up where it was left.
 *
 * Waiting rather than assuming, because there is nothing to seek when this
 * runs: the page has only just been asked to load and builds its player from
 * script, which on a slow morning is several seconds after `dom-ready`. The
 * poll is bounded — twenty seconds and then it gives up, so a page that never
 * grows a player does not leave a timer running behind it for the rest of the
 * session.
 *
 * The seek waits again, on the media's own terms: `currentTime` before metadata
 * has arrived is discarded silently, which is the difference between resuming
 * and quietly starting from the beginning.
 */
const resumePlaybackScript = (position: number) => `(() => {
  const at = ${position};
  let tries = 0;
  const attempt = () => {
    const media = Array.from(document.querySelectorAll('video, audio'));
    media.sort(
      (a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight)
    );
    const el = media[0];
    if (!el) {
      tries += 1;
      if (tries < 80) { setTimeout(attempt, 250); }
      return;
    }
    const start = () => {
      try {
        // Past the end is not a resume, it is a video that finished.
        if (at > 0 && (!Number.isFinite(el.duration) || at < el.duration)) {
          el.currentTime = at;
        }
      } catch (e) { /* a server-controlled stream can refuse a seek */ }
      const played = el.play();
      if (played && played.catch) {
        // Chromium can still refuse without a gesture it recognises. The page
        // is where it was either way, which is most of what was wanted.
        played.catch(() => {});
      }
    };
    if (el.readyState >= 1) { start(); } else {
      el.addEventListener('loadedmetadata', start, { once: true });
    }
  };
  attempt();
  return 'ok';
})()`;

const EXIT_PAGE_FULLSCREEN = `(() => {
  if (!document.fullscreenElement) { return 'none'; }
  const button = document.querySelector(
    '.ytp-fullscreen-button, [data-a-target="player-fullscreen-button"], .fullscreen-control, .vp-fullscreen'
  );
  // Same reasoning in reverse: let the player leave the way it came in.
  if (button) { button.click(); return 'button'; }
  document.exitFullscreen();
  return 'exit';
})()`;

interface IWebviewProps {
  ref?: Ref<IWebview>;
  src: string;
  partition: string;
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
}

const VideoBrowser = ({ isHidden }: IVideoBrowserProps) => {
  const { t } = useTranslation();
  const webviewRef = useRef<IWebview | null>(null);
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
  // Whether the guest has a document to be asked anything about. Nothing may
  // call into it before `dom-ready`.
  const [isGuestReady, setIsGuestReady] = useState(false);
  // Which document is in the guest. Incremented on every `dom-ready`, so
  // anything that has to be done again to a freshly loaded page can depend on
  // it. See `handleReady` for why a boolean was not enough.
  const [pageToken, setPageToken] = useState(0);
  const [isAdBlockOn, setIsAdBlockOn] = useState(readStoredAdBlock);
  // Whether the switch is in the interface at all. Owned by a root-level flag
  // rather than by this component, because the chord that moves it is pressed
  // on the support dialog and this player may not be mounted at the time.
  const isAdBlockRevealed = useIsAdBlockRevealed();
  // The page asked for fullscreen — the button on YouTube's own player.
  //
  // A guest going fullscreen fills the element it lives in and nothing more, so
  // on its own the button would expand the video to the size of the box it was
  // already in. This gives it the rest of the player's pane: the toolbar stands
  // down and the picture takes the lot.
  //
  // The pane, and not the window. FluidEQ is not a browser, and the reason to
  // play something in it is to watch the spectrum move with it — a video over
  // the whole window covers the graph, which is the only thing here the video
  // is for.
  const [isPageFullScreen, setIsPageFullScreen] = useState(false);

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

    const siteId = activeSite.id;
    const sample = () => {
      const view = webviewRef.current;
      if (!view) {
        return;
      }
      try {
        view
          .executeJavaScript(READ_POSITION)
          .then((position) => {
            const seconds = typeof position === 'number' ? position : 0;
            marksRef.current = rememberPlayback(
              marksRef.current,
              siteId,
              view.getURL(),
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
   */
  useEffect(() => {
    const view = webviewRef.current;
    const position = pendingResumeRef.current;
    if (!view || !pageToken || position <= 0) {
      return;
    }
    pendingResumeRef.current = 0;
    try {
      // Counted as a gesture: the site button that started this was one, and
      // Chromium has no way to see that from here. Without it `play()` is
      // refused and the page comes back paused at the right place, which is
      // half the feature.
      view
        .executeJavaScript(resumePlaybackScript(position), true)
        .catch(() => undefined);
    } catch {
      // No web contents to ask; the page is still where it was.
    }
  }, [pageToken]);

  /**
   * Take the page's own player with us into full screen.
   *
   * The graph's full-screen mode gives the window to the player and the graph.
   * Without this the *window* was fullscreen and the video inside it was still
   * a letterboxed rectangle in the middle of a search results page — which is
   * the one thing the mode exists to avoid.
   *
   * Skipped while the tab is hidden. Forcing a background player fullscreen
   * would be a page taking over a screen nobody is looking at it on, and the
   * guest is still loaded and playing the whole time.
   */
  useEffect(() => {
    const view = webviewRef.current;
    if (!view || isHidden || !isGuestReady) {
      return;
    }
    try {
      view
        .executeJavaScript(
          // Never asked for any more, only ever undone.
          //
          // Full screen used to ask for it, and that is the blank screen: the
          // page's fullscreen puts the player in Chromium's top layer while the
          // injected rules are still pinning it to the viewport, and the two
          // accounts of where it belongs disagree. Pressing Escape dropped the
          // page's fullscreen, left the injection alone, and the picture
          // appeared — which is the symptom that names the cause exactly.
          //
          // The injection already strips the page to the player in both modes,
          // so there is nothing left for the site's own fullscreen to add. What
          // remains here is the undo, for a page somebody put into fullscreen
          // with the player's own button.
          EXIT_PAGE_FULLSCREEN,
          // Counts as a user gesture. The click or the shortcut that opened the
          // mode was one; Chromium has no way to know that from here, and
          // `requestFullscreen` refuses without it.
          true,
        )
        .catch(() => {
          // The document went away mid-call — a navigation landing at the same
          // moment. The next mode change will find the new one.
        });
    } catch {
      // Throws rather than rejects when the guest has no web contents id yet.
      // `dom-ready` is meant to have ruled that out, but a teardown racing this
      // effect can still get here, and a crashed player is not worth taking the
      // window down over.
    }
  }, [graphView, isGuestReady, isHidden]);

  /**
   * Strip the page back to its player while the graph is over it.
   *
   * Re-applied when the guest reloads: a navigation throws inserted CSS away
   * with the document, so without `isGuestReady` in the dependencies the second
   * video would come back wearing the whole page.
   */
  useEffect(() => {
    const view = webviewRef.current;
    if (!view || isHidden || !isGuestReady || graphView === 'normal') {
      return undefined;
    }
    let key: string | undefined;
    let isCancelled = false;
    try {
      view
        .insertCSS(PLAYER_ONLY_CSS)
        .then((inserted) => {
          if (isCancelled) {
            // The mode changed while this was in flight. Take it straight back
            // out rather than leaving a sheet nothing holds the key to.
            view.removeInsertedCSS(inserted).catch(() => undefined);
          } else {
            key = inserted;
          }
          return inserted;
        })
        .catch(() => undefined);
      // The stylesheet does nothing until the chain is marked; the two go in
      // together and come out together.
      view.executeJavaScript(ENTER_PLAYER_ONLY).catch(() => undefined);
    } catch {
      // No web contents to inject into, and so nothing to undo either.
    }
    return () => {
      isCancelled = true;
      if (key !== undefined) {
        view.removeInsertedCSS(key).catch(() => undefined);
      }
      try {
        view.executeJavaScript(EXIT_PLAYER_ONLY).catch(() => undefined);
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

    const handleEnterFullScreen = () => setIsPageFullScreen(true);
    const handleLeaveFullScreen = () => setIsPageFullScreen(false);

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
    view.addEventListener('dom-ready', handleReady);

    return () => {
      view.removeEventListener('did-navigate', handleNavigated);
      view.removeEventListener('did-navigate-in-page', handleNavigated);
      view.removeEventListener('did-start-loading', handleStartLoading);
      view.removeEventListener('did-stop-loading', handleStopLoading);
      view.removeEventListener('will-navigate', handleWillNavigate);
      view.removeEventListener('enter-html-full-screen', handleEnterFullScreen);
      view.removeEventListener('leave-html-full-screen', handleLeaveFullScreen);
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

  const blockedHost = (() => {
    try {
      return new URL(blockedUrl).hostname;
    } catch {
      return blockedUrl;
    }
  })();

  // A sign-in was refused on purpose and is not the same thing as a link off
  // the list, so it does not get told it is leaving the player — it is not.
  // Derived rather than remembered alongside the URL: two pieces of state
  // saying one thing is two pieces of state that can disagree.
  const isBlockedSignIn = Boolean(blockedUrl) && isSignInUrl(blockedUrl);

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
      }${isPageFullScreen ? ' is-fullscreen' : ''}`}
    >
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

      <div className="video-browser__stage">
        <Webview
          ref={webviewRef}
          className="video-browser__view"
          src={initialUrl.current}
          // Named here as well as forced in the main process. This is the value
          // that has to be right for the tag to attach at all; the main process
          // overwrites it anyway, so the two can never drift apart.
          partition={VIDEO_BROWSER_PARTITION}
        />
        {blockedUrl && (
          <div className="video-browser__blocked" role="alert">
            <div>
              <strong>
                {t(
                  isBlockedSignIn
                    ? 'video.blockedSignInTitle'
                    : 'video.blockedTitle',
                )}
              </strong>
              <span title={blockedUrl}>{blockedHost}</span>
            </div>
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
