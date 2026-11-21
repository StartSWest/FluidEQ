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
import { VIDEO_AD_BLOCK_STORAGE_KEY } from 'common/videoAdBlock';
import {
  IVideoSite,
  VIDEO_BROWSER_PARTITION,
  VIDEO_LINK_BLOCKED,
  buildSearchUrl,
  findSiteForUrl,
  isNavigableVideoUrl,
} from 'common/videoSites';
import {
  TPlaybackMarks,
  resumePositionFor,
  resumeUrlFor,
} from 'common/videoResume';
import Switch from '../widgets/Switch';
import { useTranslation } from '../utils/I18nContext';
import { useIsAdBlockRevealed } from '../utils/adBlockReveal';
import { useGraphView } from '../utils/graphStyle';
import { addSearchToHistory } from '../utils/videoSearchHistory';
import VideoFullScreenRow from './VideoFullScreenRow';
import { FULL_LEVEL } from '../library/player/usePlayerDecks';
import GuestTintToggle from './GuestTintToggle';
import VideoRail from './VideoRail';
import VideoSignOut from './VideoSignOut';
import VideoTopBar from './VideoTopBar';
import { VideoBlockedStrip, VideoDownloadStrip } from './VideoNotices';
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
  /** A double-click on the guest video: the video's own full screen, in and
   * out, never the graph's. */
  onToggleVideoFullScreen: () => void;
}

const VideoBrowser = ({
  isHidden,
  isFullScreen,
  isGraphBackdrop,
  onRequestFullScreen,
  onToggleVideoFullScreen,
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
  const onToggleVideoFullScreenRef = useRef(onToggleVideoFullScreen);
  onToggleVideoFullScreenRef.current = onToggleVideoFullScreen;
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
  /** What the search field holds; a recent search pressed in the rail lands
   * there too. */
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdBlockOn, setIsAdBlockOn] = useState(readStoredAdBlock);
  // Whether the switch is in the interface at all. Owned by a root-level flag
  // rather than by this component, because the chord that moves it is pressed
  // on the support dialog and this player may not be mounted at the time.
  const isAdBlockRevealed = useIsAdBlockRevealed();
  const activeSite = findSiteForUrl(currentUrl);
  // The page in FluidEQ's colours, when the user has asked for it — or as
  // glass over the graph's Plus visualizer in the video's own full screen.
  const isSceneBehind = useSceneBehindVideo(isFullScreen);
  // The page as a page, with its rail and bar: on its tab, and neither in the
  // video's own full screen nor the picture under an expanded graph.
  const showsChrome = !isHidden && !isFullScreen && !isGraphBackdrop;
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
    onToggleVideoFullScreenRef,
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

  /**
   * Run a search, from the field or from a recent one in the rail, and
   * remember it. Searched on whichever site is open, so the site marked in
   * the rail is also the one being asked. Off any of them, YouTube answers.
   */
  const runSearch = useCallback(
    (terms: string) => {
      const cleaned = terms.trim();
      if (!cleaned) {
        return;
      }
      addSearchToHistory(cleaned);
      setSearchQuery(cleaned);
      goTo(buildSearchUrl(activeSite ?? HOME_SITE, cleaned));
    },
    [activeSite, goTo],
  );

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
      {/* The rail and the bar only while the page is looked at as a page:
          never behind another tab, in the video's own full screen or under an
          expanded graph, where the picture is everything. Rendered rather
          than hidden, and always ahead of the column that holds the guest,
          so that column never moves in the tree and the guest is never
          reloaded. */}
      {showsChrome && (
        <VideoRail
          activeSiteId={activeSite?.id}
          onSite={goToSite}
          onRunSearch={runSearch}
          foot={
            <>
              <GuestTintToggle siteId={activeSite?.id} />
              <VideoSignOut />
              {isAdBlockRevealed && (
                <div className="video-rail__ad-block">
                  <span
                    className="video-rail__label"
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
            </>
          }
        />
      )}

      <div className="video-browser__main">
        {showsChrome && (
          <VideoTopBar
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            isLoading={isLoading}
            onBack={() => webviewRef.current?.goBack()}
            onForward={() => webviewRef.current?.goForward()}
            onReloadOrStop={() => {
              const view = webviewRef.current;
              if (isLoading) {
                view?.stop();
              } else {
                view?.reload();
              }
            }}
            currentUrl={currentUrl}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onRunSearch={runSearch}
            siteName={(activeSite ?? HOME_SITE).name}
          />
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
          {/* A page on its way, from the first moment: a sweep along the
            stage's top edge until the guest says it stopped loading. */}
          {showsChrome && isLoading && (
            <div
              className="video-browser__loading"
              role="progressbar"
              aria-label={t('video.loading')}
            >
              <span />
            </div>
          )}
          {/* In full screen, where the toolbar above is not drawn, the page's
            row, as every page has one. */}
          {!isHidden && isFullScreen && (
            <VideoFullScreenRow
              siteName={activeSite?.name}
              onExit={onToggleVideoFullScreen}
            />
          )}
          <VideoDownloadStrip isHidden={isHidden} />
          {!isHidden && blockedUrl && (
            <VideoBlockedStrip
              url={blockedUrl}
              onDismiss={() => setBlockedUrl('')}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoBrowser;
