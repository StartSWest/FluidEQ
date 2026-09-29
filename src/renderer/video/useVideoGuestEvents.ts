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

import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
} from 'react';
import {
  isNavigableVideoUrl,
  VIDEO_GRAPH_FULLSCREEN_REQUEST,
  VIDEO_GUEST_VOLUME_CHANGED,
} from 'common/videoSites';
import { EXIT_PAGE_FULLSCREEN, READ_GUEST_VOLUME } from './videoPlayerScripts';
import { type IWebview } from './videoWebview';

/**
 * How many times one document is told the app's level again before it wins.
 *
 * See `guestVolumeArgumentsRef`: a site sets its own remembered level while
 * its player mounts, and that first move must not be mistaken for the user
 * moving its slider. Four is past every initialisation seen here and small
 * enough that a page which simply will not take a level is believed rather
 * than argued with.
 */
const GUEST_VOLUME_ARGUMENT_LIMIT = 4;

interface IVideoGuestEventsInput {
  webviewRef: RefObject<IWebview | null>;
  setCanGoBack: Dispatch<SetStateAction<boolean>>;
  setCanGoForward: Dispatch<SetStateAction<boolean>>;
  setCurrentUrl: Dispatch<SetStateAction<string>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setBlockedUrl: Dispatch<SetStateAction<string>>;
  onRequestFullScreenRef: RefObject<() => void>;
  onRequestGraphFullScreenRef: RefObject<() => void>;
  pendingVolumePushesRef: RefObject<number>;
  lastPushedVolumeRef: RefObject<number | undefined>;
  guestVolumeArgumentsRef: RefObject<number>;
  pushGuestVolume: (level: number) => void;
  setIsGuestReady: Dispatch<SetStateAction<boolean>>;
  setPageToken: Dispatch<SetStateAction<number>>;
}

/**
 * What the guest page tells the Media tab, wired once per page: where it
 * navigated and whether it can go back, loading, a link the tab refused,
 * its requests for full screen, the app's volume argued back while a site
 * sets its own, and the page becoming ready to be driven.
 */
const useVideoGuestEvents = ({
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
}: IVideoGuestEventsInput) => {
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
  }, [setCanGoBack, setCanGoForward, setCurrentUrl, webviewRef]);

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
        return;
      }
      if (channel !== VIDEO_GUEST_VOLUME_CHANGED) {
        return;
      }
      /**
       * The page moved its own level. Follow it.
       *
       * The site's slider and this app's fader are one control, not two
       * multiplying each other — which is the whole of the bug this fixes:
       * they used to be two, and 100% on both was roughly twice the sound of
       * 100% on either.
       *
       * Ignored while a push of ours is still in flight, and ignored when it
       * comes back as the level we last sent. Both are the same guard against
       * the same race: a drag sends a level per step, and a reading from an
       * earlier step landing after a later one would drag the fader backwards
       * under the pointer.
       */
      if (pendingVolumePushesRef.current > 0) {
        return;
      }
      try {
        view
          .executeJavaScript(READ_GUEST_VOLUME)
          .then((reading) => {
            if (
              typeof reading !== 'number' ||
              !Number.isFinite(reading) ||
              pendingVolumePushesRef.current > 0
            ) {
              return reading;
            }
            const level = Math.min(1, Math.max(0, reading));
            if (level === lastPushedVolumeRef.current) {
              // The page took what it was given.
              guestVolumeArgumentsRef.current = GUEST_VOLUME_ARGUMENT_LIMIT;
              return reading;
            }
            if (
              guestVolumeArgumentsRef.current < GUEST_VOLUME_ARGUMENT_LIMIT &&
              lastPushedVolumeRef.current !== undefined
            ) {
              // A page still settling into its own remembered level. Say it
              // again rather than adopting it — see `guestVolumeArgumentsRef`.
              guestVolumeArgumentsRef.current += 1;
              pushGuestVolume(lastPushedVolumeRef.current);
              return reading;
            }
            // The page insisted on a level of its own past every argument.
            // It keeps it: there is no fader of the app's to carry it into,
            // and the computer's is not the page's to move.
            return reading;
          })
          .catch(() => undefined);
      } catch {
        // No web contents to ask; the fader keeps the level it has.
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
    // `pushGuestVolume` has no dependencies of its own, so naming it here
    // costs nothing: these listeners are still registered once for the life
    // of the pane, which is what every ref above them exists to allow.
  }, [
    syncNavigationState,
    pushGuestVolume,
    webviewRef,
    setCurrentUrl,
    setIsLoading,
    setBlockedUrl,
    onRequestFullScreenRef,
    pendingVolumePushesRef,
    onRequestGraphFullScreenRef,
    lastPushedVolumeRef,
    guestVolumeArgumentsRef,
    setIsGuestReady,
    setPageToken,
  ]);
};

export default useVideoGuestEvents;
