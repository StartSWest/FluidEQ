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

import type { TPlaybackOwner } from './playbackOwner';
import type { ITransportSource } from './transportSource';

/**
 * Whose transport the bar is showing.
 *
 * What is playing wins, on every tab. Walk from the library to the EQ to
 * Media with a song running and the bar stays that song's — the controls for
 * the thing you can hear are never more than where they already were. Only
 * starting playback somewhere else takes the bar, and starting playback
 * somewhere else stops this one anyway: see `playbackOwner`, which allows one
 * player at a time.
 *
 * With nothing playing, the bar belongs to the page it is under: Karaoke gets
 * the karaoke session, Media the page it has loaded, Library the queue. A tab
 * that is not a player keeps whatever was last described, which is the paused
 * song somebody is about to resume.
 *
 * Two components ask this — the library's bar, which draws itself, and the
 * host that draws every other tab's — and they must never both answer yes.
 * That is why the rule lives here rather than in either of them.
 */
const pickTransportOwner = (
  tabOwner: TPlaybackOwner | undefined,
  sources: Partial<Record<TPlaybackOwner, ITransportSource>>,
  playingOwner: TPlaybackOwner | undefined,
  lastOwner: TPlaybackOwner | undefined,
): TPlaybackOwner | undefined => {
  if (playingOwner !== undefined && sources[playingOwner] !== undefined) {
    return playingOwner;
  }
  // The machine's own sound plays by the same rule, and has to say so itself.
  //
  // `playbackOwner` is a register of players this app can silence, and another
  // program is not one of them — so a browser tab is never the "playing owner"
  // however loudly it is playing. Its own `isPlaying` is the only word there
  // is on the subject: while that is true the bar is its own on every page,
  // exactly as a song of this app's would be, and when it stops the page's own
  // player has the bar back.
  //
  // Second, and never first. A player of this app's that is playing holds the
  // bar even in the instant before it has described itself — a video starting
  // in the Media tab claims playback from the tag's own event, and the
  // description follows a render later. Without the `undefined` here that gap
  // was a bar that flicked to the machine's player and back, on every press
  // of play.
  if (playingOwner === undefined && sources.system?.isPlaying === true) {
    return 'system';
  }
  // And the same again for sound arriving from another computer over the LAN
  // link — described by that computer's bar, playing through this one's
  // output. After the machine's own player, because a browser tab here is
  // nearer than a song there, and because the listener's own system session
  // is what somebody just pressed play on.
  if (playingOwner === undefined && sources.remote?.isPlaying === true) {
    return 'remote';
  }
  // A natural end is still the same listening session. Hold the actual
  // player's controls while its known next item starts; the player's bounded
  // handoff lease clears on `playing`, explicit pause/stop, error, or expiry.
  if (
    lastOwner !== undefined &&
    sources[lastOwner]?.retainWhenHidden === true
  ) {
    return lastOwner;
  }
  const retainedOwner = (['library', 'karaoke', 'media'] as const).find(
    (candidate) => sources[candidate]?.retainWhenHidden === true,
  );
  if (retainedOwner !== undefined) {
    return retainedOwner;
  }
  if (tabOwner !== undefined && sources[tabOwner] !== undefined) {
    return tabOwner;
  }
  if (lastOwner !== undefined && sources[lastOwner] !== undefined) {
    return lastOwner;
  }
  return undefined;
};

export default pickTransportOwner;
