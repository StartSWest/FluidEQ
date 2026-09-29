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

import { Suspense } from 'react';
import TaskbarTransport from '../audio/TaskbarTransport';
import { LibraryProvider } from '../library/LibraryContext';
import LibraryStageArt from '../library/LibraryStageArt';
import { LibraryPlayerProvider } from '../library/player/LibraryPlayerContext';
import { PlaylistProvider } from '../library/PlaylistContext';
import SystemStageArt from '../library/SystemStageArt';
import {
  exitGraphFullScreen,
  toggleFullScreenTopBar,
  toggleGraphFullScreen,
} from '../utils/graphStyle';
import { KaraokePage, LibraryPage, MediaPage } from '../workspacePages';
import type { TWorkspaceTab } from '../workspaceTabs';
import {
  ConnectedNowPlayingBar,
  IdleTransportBarSlot,
  TAB_TRANSPORT,
  TabTransportBar,
} from './TransportBars';
import type usePlayerMounts from './usePlayerMounts';
import type useShellFullScreen from './useShellFullScreen';

export interface IWorkspacePlayersProps {
  activeTab: TWorkspaceTab;
  /** The window is the amp: the pages each player draws sleep, not its sound. */
  isAmp: boolean;
  /** The graph expanded or full screen over the page. */
  isGraphBackdropMode: boolean;
  mounts: ReturnType<typeof usePlayerMounts>;
  fullScreen: ReturnType<typeof useShellFullScreen>;
  /** Karaoke's own full screen, or the graph's over its stage. */
  isKaraokeSurfaceFullScreen: boolean;
  isKaraokeGraphFullScreen: boolean;
  onGoToTab: (tab: TWorkspaceTab) => void;
  /** Switches the open tab's graph on, for the video's double-click. */
  setActiveTabGraphVisibility: (next: boolean) => void;
}

/**
 * The three players and the bars that drive them.
 *
 * A silent guest off its tab stays only while it is the last thing played;
 * otherwise it is unmounted, which destroys its renderer process.
 *
 * The three players stay awake behind the amp — their audio, the guest and
 * the transport they describe are what the amp plays — and are put away there
 * the way a tab switch puts them away, by `isHidden`: the page drawn by each
 * one sleeps, its sound does not. Each waits for its code in a boundary of its
 * own, so nothing around it is hidden while it does.
 */
const WorkspacePlayers = ({
  activeTab,
  isAmp,
  isGraphBackdropMode,
  mounts,
  fullScreen,
  isKaraokeSurfaceFullScreen,
  isKaraokeGraphFullScreen,
  onGoToTab,
  setActiveTabGraphVisibility,
}: IWorkspacePlayersProps) => {
  const isVideoTab = activeTab === 'video';
  const isLibraryTab = activeTab === 'library';
  const isKaraokeTab = activeTab === 'karaoke';
  const {
    mediaFullScreenOwner,
    isMediaFullScreen,
    isAppFullScreen,
    isChromeIdle,
    isPointerNearChrome,
    hasFullScreenTopBar,
    applyMediaFullScreen,
    releaseMediaSurface,
  } = fullScreen;
  // Faded out with the rest of the chrome once full screen has been still for
  // a moment, and back on the next movement — the same two seconds the graph's
  // own toolbar waits, from the same store, so the two cannot disagree about
  // when to go.
  const isBarIdle = isAppFullScreen && (!isPointerNearChrome || isChromeIdle);
  return (
    <>
      {mounts.hasOpenedVideo && mounts.keepVideoMounted && (
        <Suspense fallback={null}>
          <MediaPage.Page
            isHidden={
              isAmp ||
              (!mounts.showsMediaGraphBackdrop &&
                (!isVideoTab || isGraphBackdropMode))
            }
            isFullScreen={mediaFullScreenOwner === 'video'}
            isGraphBackdrop={mounts.showsMediaGraphBackdrop}
            onRequestFullScreen={() => {
              applyMediaFullScreen('video');
            }}
            onRequestGraphFullScreen={() => {
              // With a Plus visualizer on the graph, a double-click on
              // the video is the video's own full screen, in and out:
              // the visualizer would only have covered it (see the
              // backdrop above).
              if (mounts.isSceneOnGraph) {
                applyMediaFullScreen(isMediaFullScreen ? undefined : 'video');
                return;
              }
              // A double-click on the guest is the same command as
              // Ctrl+F. If the shared no-graph media surface already
              // owns the OS window, transfer it without first bouncing
              // out of full screen and making Chromium resize the live
              // video twice.
              if (isMediaFullScreen) {
                releaseMediaSurface();
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
      <TaskbarTransport tabOwner={TAB_TRANSPORT[activeTab]} />
      <IdleTransportBarSlot
        activeTab={activeTab}
        isFullScreen={isAppFullScreen}
        onGoToTab={onGoToTab}
      />
      <TabTransportBar
        activeTab={activeTab}
        isIdle={isBarIdle}
        isFloating={isAppFullScreen}
        onGoToTab={onGoToTab}
      />
      {/* The providers keep a playing deck, or a silent one while its
        queue is the last thing played. The shelf is pruned immediately
        off-tab; otherwise the providers and native DSP host leave too. */}
      {mounts.hasOpenedLibrary && mounts.keepLibraryMounted && (
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
                    (!mounts.showsLibraryGraphBackdrop &&
                      (!isLibraryTab || isGraphBackdropMode))
                  }
                  isGraphBackdrop={mounts.showsLibraryGraphBackdrop}
                  revealRequest={mounts.libraryReveal}
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
              {mounts.showsLibraryGraphBackdrop && <LibraryStageArt />}
              <ConnectedNowPlayingBar
                activeTab={activeTab}
                isIdle={isBarIdle}
                isFloating={isAppFullScreen}
                onReveal={mounts.revealPlayingTrack}
              />
            </LibraryPlayerProvider>
          </PlaylistProvider>
        </LibraryProvider>
      )}
      {/* Outside the Library's providers: the machine's own song needs
        none of them, and inside they are mounted only once the Library
        has been opened, so after a launch that never visited it an
        expanded graph showed Spotify's song with no picture. */}
      {mounts.showsSystemGraphBackdrop && <SystemStageArt />}
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
      {mounts.hasOpenedKaraoke && mounts.keepKaraokeMounted && (
        <Suspense fallback={null}>
          <KaraokePage.Page
            isHidden={
              !mounts.showsKaraokeGraphBackdrop &&
              (!isKaraokeTab || isGraphBackdropMode)
            }
            isFullScreen={isKaraokeSurfaceFullScreen}
            isGraphOverlay={mounts.showsKaraokeGraphBackdrop}
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
        </Suspense>
      )}
    </>
  );
};

export default WorkspacePlayers;
