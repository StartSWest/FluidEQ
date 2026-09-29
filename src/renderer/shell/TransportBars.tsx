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

import type { ILibraryTrack } from '../../common/library/types';
import { usePlaybackOwner, type TPlaybackOwner } from '../audio/playbackOwner';
import { useLastShown } from '../audio/lastShown';
import pickTransportOwner from '../audio/transportRouting';
import {
  useLastTransportOwner,
  useTransportSources,
} from '../audio/transportSource';
import { usePlaylists } from '../library/PlaylistContext';
import IdleTransportBar from '../library/player/IdleTransportBar';
import { useLibraryPlayer } from '../library/player/LibraryPlayerContext';
import NowPlayingBar from '../library/player/NowPlayingBar';
import SourceTransportBar from '../library/player/SourceTransportBar';
import type { TWorkspaceTab } from '../workspaceTabs';

/**
 * Which player each tab's bar drives.
 *
 * The tabs that are not players have no entry, and there the bar falls back
 * to whatever is making sound — see `pickTransportOwner`, which holds the
 * rule both halves of the bar ask.
 */
export const TAB_TRANSPORT: Partial<Record<TWorkspaceTab, TPlaybackOwner>> = {
  library: 'library',
  karaoke: 'karaoke',
  video: 'media',
};

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
export const IdleTransportBarSlot = ({
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

/**
 * The bar for every tab that is not the library.
 *
 * Mounted outside `hasOpenedLibrary`, which is the whole point of it being a
 * separate component: the library's providers are built on first visit to
 * that tab, and the karaoke transport used to live inside them. A window
 * opened straight onto Karaoke therefore had no bar at all until the user
 * happened to look at the Library.
 */
export const TabTransportBar = ({
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
export const ConnectedNowPlayingBar = ({
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
