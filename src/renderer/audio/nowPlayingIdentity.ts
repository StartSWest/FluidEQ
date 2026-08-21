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

import type { ISongIdentity } from 'common/songIdentity';
import { usePlaybackOwner } from './playbackOwner';
import type { TPlaybackOwner } from './playbackOwner';
import { useTransportSources } from './transportSource';
import type { ITransportSource } from './transportSource';

/**
 * What is ACTUALLY being equalised, which is not what the bar is showing.
 *
 * `pickTransportOwner` takes the current tab as an input, so with nothing
 * playing the bar shows the last paused thing and its subject changes as you
 * switch tabs. That is right for a bar — the resume button should follow you —
 * and wrong for a recorder: a paused song is not being equalised, and a song
 * must not start being recorded because somebody opened the EQ page.
 *
 * So this is the first two clauses of that function and none of the rest: a
 * player of ours that holds playback, else the machine's own while it says it
 * is playing. One place rather than derived at each call site, so the recorder
 * and the badge on the bar cannot disagree about what is being recorded.
 */
export const pickPlayingIdentity = (
  sources: Partial<Record<TPlaybackOwner, ITransportSource>>,
  playingOwner: TPlaybackOwner | undefined,
): ISongIdentity | undefined => {
  if (playingOwner !== undefined) {
    return sources[playingOwner]?.identity;
  }
  if (sources.system?.isPlaying === true) {
    return sources.system.identity;
  }
  return undefined;
};

export const useNowPlayingIdentity = (): ISongIdentity | undefined => {
  const sources = useTransportSources();
  const playingOwner = usePlaybackOwner();
  return pickPlayingIdentity(sources, playingOwner);
};
