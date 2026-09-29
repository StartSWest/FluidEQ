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

import { useCallback, useEffect, useRef, useState } from 'react';
import ChannelEnum from 'common/channels';
import type { TranslationKey } from 'common/i18n';
import { VIDEO_AD_BLOCK_STORAGE_KEY } from 'common/videoAdBlock';
import {
  IVideoSite,
  VIDEO_BROWSER_PARTITION,
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
  resumePositionFor,
  resumeUrlFor,
} from 'common/videoResume';
import Switch from '../widgets/Switch';
import { useTranslation } from '../utils/I18nContext';
import { useIsAdBlockRevealed } from '../utils/adBlockReveal';
import { useGraphView } from '../utils/graphStyle';
import { sendRequest, simpleResponseHandler } from '../utils/ipcRequest';
import isOwnAnimationEnd from '../utils/ownAnimationEnd';
import VideoSearch from './VideoSearch';
import { FULL_LEVEL } from '../library/player/usePlayerDecks';
import VideoSiteIcon from './VideoSiteIcon';
import GuestTintToggle from './GuestTintToggle';
import { useGuestTint } from './useGuestTint';
import VideoSceneBackdrop, { useSceneBehindVideo } from './VideoSceneBackdrop';
import '../styles/VideoBrowser.scss';
import { STOP_PLAYBACK, setGuestVolumeScript } from './videoPlayerScripts';
import { IWebview, VIDEO_WEB_PREFERENCES, Webview } from './videoWebview';
import {
  HOME_SITE,
  VIDEO_LAST_URL_KEY,
  readStoredAdBlock,
  readStoredMarks,
  readStoredUrl,
} from './videoBrowserStorage';
import useVideoGuestEvents from './useVideoGuestEvents';
import useVideoPlayerOnly from './useVideoPlayerOnly';
import useVideoTransport from './useVideoTransport';
import useVideoResumeMarks from './useVideoResumeMarks';

const formatDownloadBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) {
    return `${Math.max(0, bytes / 1024).toFixed(1)} KB`;
  }
  return `${Math.max(0, bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  /**
   * The app's fader — the same number the library and karaoke play at.
   *
   * It used to be a `useRef(1)` this pane invented, which is why the bar said
   * 100% over a page playing at a third of that and the first drag jumped the
   * sound. The page is both told this and asked for it: see the volume
   * listener below.
   */
  /** The last level sent to the page, and how many sends are still in flight —
   * together, the guard that stops the page's echo dragging the fader back.
   * See the volume branch of `handleGuestMessage`. */
  const lastPushedVolumeRef = useRef<number | undefined>(undefined);
  const pendingVolumePushesRef = useRef(0);
  /**
   * How many times this document has been told the level again after setting
   * one of its own, and whether it has agreed to ours yet.
   *
   * A NEW PAGE TAKES THE APP'S LEVEL, NOT THE OTHER WAY ROUND. A site opens
   * each video at whatever it remembers for itself, and that first move is
   * indistinguishable from a report — so without this, opening the Media tab
   * replaced the app's fader with YouTube's remembered level, on every click.
   *
   * Bounded, and the bound is the point: a site that answers a level with a
   * different one every time would otherwise be argued with for as long as it
   * kept answering. Four attempts is past every initialisation observed here
   * (YouTube writes its own level twice while its player mounts); after that
   * the page is believed, because a page that will not take a level is one
   * whose own number is the only true one.
   */
  const guestVolumeArgumentsRef = useRef(0);
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
   * The ask, held where the handlers declared ahead of it can reach it.
   *
   * The probe closes over the `describe` that belongs to the effect holding
   * the guest's own listeners, and it is asked from that effect's playing
   * handler and its playback clock, both written before it. A ref is the seam,
   * and the alternative — moving `describe` up — would re-register the guest's
   * listeners on every render that touches it.
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
  // The page in FluidEQ's colours, when the user has asked for it — or as
  // glass over the graph's Plus visualizer in the video's own full screen.
  const isSceneBehind = useSceneBehindVideo(isFullScreen);
  useGuestTint(
    webviewRef,
    activeSite?.id,
    pageToken,
    isGuestReady,
    isSceneBehind,
  );

  // Held in a ref rather than in state. Nothing renders from it, and a note
  // taken several times a second while a video plays that re-rendered the pane
  // would be that much work to change nothing on screen.
  const marksRef = useRef<TPlaybackMarks>(readStoredMarks());
  /**
   * Where the playing video is, handed over by the transport's clock.
   *
   * The clock belongs to the effect holding the guest's own listeners, which
   * runs once; whether a position is worth noting belongs to the effect below,
   * which lives only while this tab is on screen. A no-op outside that.
   */
  const notePlayingPositionRef = useRef<(seconds: number) => void>(() => {});
  const { pendingResumeRef } = useVideoResumeMarks({
    webviewRef,
    isHidden,
    isGuestReady,
    activeSite,
    marksRef,
    notePlayingPositionRef,
    pageToken,
  });

  /**
   * Put a level on the page, and remember that we are the ones who did.
   *
   * The two refs it keeps are what tell our own echo from the page moving its
   * slider: the guest fires `volumechange` for both, and the reading that
   * comes back from ours must not be mistaken for a report.
   */
  const pushGuestVolume = useCallback((level: number) => {
    const view = webviewRef.current;
    if (!view) {
      return;
    }
    lastPushedVolumeRef.current = level;
    pendingVolumePushesRef.current += 1;
    const settle = () => {
      pendingVolumePushesRef.current -= 1;
    };
    try {
      view.executeJavaScript(setGuestVolumeScript(level)).then(settle, settle);
    } catch {
      // No web contents to set it on.
      settle();
    }
  }, []);

  /**
   * Put the app's level on the page — on every change, and on every document.
   *
   * `pageToken` as well as the level, because a site is a whole browser: it
   * opens each new video at whatever it remembers for itself, so a page told
   * once at attach would be back at its own level after the next click. This
   * is what makes the Media tab play at the same volume as the library rather
   * than at whatever the site last used.
   */
  useEffect(() => {
    if (!isGuestReady) {
      return;
    }
    guestVolumeArgumentsRef.current = 0;
    // Full level, always: the fader beside this player is the computer's
    // (`useSystemFader`), and the page's own is held at the top.
    pushGuestVolume(FULL_LEVEL);
  }, [isGuestReady, pageToken, pushGuestVolume]);

  useVideoTransport({
    webviewRef,
    nowPlayingRef,
    t,
    frameRef,
    playingRef,
    skipsRef,
    nowPlayingProbeRef,
    notePlayingPositionRef,
    isHiddenRef,
  });

  useVideoPlayerOnly({ webviewRef, isHidden, isGuestReady, graphView });

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

  useVideoGuestEvents({
    webviewRef,
    setCanGoBack,
    setCanGoForward,
    setCurrentUrl,
    setIsLoading,
    setBlockedUrl,
    onRequestFullScreenRef,
    onRequestGraphFullScreenRef,
    pendingVolumePushesRef,
    lastPushedVolumeRef,
    guestVolumeArgumentsRef,
    pushGuestVolume,
    setIsGuestReady,
    setPageToken,
  });

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
   * not a page of recommendations. The position goes into the ref for
   * `useVideoResumeMarks` to pick up once the new page has a player to seek.
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
    [activeSite, goTo, pendingResumeRef],
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
   * A request rather than a standing listener: the reply belongs to the press
   * that asked for it, and a listener that outlived the press would answer a
   * later one with an earlier result. Waited on however long the store takes
   * to empty, because main answers every press.
   */
  const handleSignOut = useCallback(() => {
    setSignOutState('clearing');
    sendRequest(
      ChannelEnum.CLEAR_VIDEO_SESSION,
      [],
      simpleResponseHandler<boolean>(),
    ).then(
      (cleared) => setSignOutState(cleared ? 'done' : 'failed'),
      () => setSignOutState('failed'),
    );
  }, []);

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
          <GuestTintToggle siteId={activeSite?.id} />
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
              hidden from anything that reads rather than looks.

              The tick or the cross clears itself: left up, "Signed out"
              would still be on screen the next time somebody looked to check
              whether they were — the one question this control exists to
              answer, answered wrongly. How long it stays is the glyph's own
              hold (`video-sign-out-said`), whose end brings the door back; it
              was a timer, which ran on behind a covered window. */}
            <svg
              viewBox="0 0 16 16"
              aria-hidden
              onAnimationEnd={(event) => {
                if (isOwnAnimationEnd(event, 'video-sign-out-said')) {
                  setSignOutState('idle');
                }
              }}
            >
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
        {isSceneBehind && <VideoSceneBackdrop />}
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
