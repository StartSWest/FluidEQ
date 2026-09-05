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

/**
 * What is ACTUALLY being equalised, not what the bar happens to show.
 *
 * `pickTransportOwner` also takes the current tab, so on a tab that is not a
 * player it falls back to whatever was last described — the paused song
 * somebody is about to resume. Right for a bar, wrong for a recorder: a paused
 * song is not being equalised, and opening the EQ tab must not start one being
 * recorded. `pickPlayingIdentity` shares its first two clauses with that
 * function and none of the rest, so the cases worth pinning are the ones a
 * bar would answer differently from a recorder — plus the one case the
 * recorder needs that the bar has no reason to: telling a pause apart from a
 * stop, which is `lastPlayingOwner`'s whole job.
 */

import { buildSongIdentity } from 'common/songIdentity';
import type { ITransportSource } from 'renderer/audio/transportSource';
import { pickPlayingIdentity } from 'renderer/audio/nowPlayingIdentity';

const songA = buildSongIdentity('library', 'a', 'Song A', 'Artist');
const songB = buildSongIdentity('system', 'Spotify.exe', 'Song B', 'Artist');

const sourceOf = (
  owner: ITransportSource['owner'],
  isPlaying: boolean,
  identity = songA,
): ITransportSource => ({
  owner,
  title: 'Song',
  isPlaying,
  positionMs: 0,
  durationMs: 0,
  toggle: () => undefined,
  identity,
});

describe('pickPlayingIdentity', () => {
  it("is the other computer's song while it plays through this one", () => {
    // Smart EQ said nothing was playing through a whole album arriving over
    // the LAN link. The sender's song is the same kind of thing as the
    // machine's own player: never the owner, playing all the same.
    const remoteSong = buildSongIdentity(
      'remote',
      'SWEST-YOGA',
      'Song C',
      'Artist',
    );
    expect(
      pickPlayingIdentity(
        { remote: sourceOf('remote', true, remoteSong) },
        undefined,
        undefined,
      ),
    ).toEqual({ identity: remoteSong, isPlaying: true });
    // And not while it is paused: a paused song is not being equalised.
    expect(
      pickPlayingIdentity(
        { remote: sourceOf('remote', false, remoteSong) },
        undefined,
        undefined,
      ),
    ).toEqual({ identity: undefined, isPlaying: false });
  });

  it('is nothing when nothing is playing', () => {
    expect(
      pickPlayingIdentity(
        { library: sourceOf('library', false) },
        undefined,
        undefined,
      ),
    ).toEqual({ identity: undefined, isPlaying: false });
  });

  it('is the app player that holds playback', () => {
    // Positive control for the test above.
    expect(
      pickPlayingIdentity(
        { library: sourceOf('library', true) },
        'library',
        undefined,
      ),
    ).toEqual({ identity: songA, isPlaying: true });
  });

  it("is the machine's own player when nothing of ours holds playback", () => {
    expect(
      pickPlayingIdentity(
        { system: sourceOf('system', true, songB) },
        undefined,
        undefined,
      ),
    ).toEqual({ identity: songB, isPlaying: true });
  });

  it("ignores the machine's player while one of ours is playing", () => {
    expect(
      pickPlayingIdentity(
        {
          library: sourceOf('library', true),
          system: sourceOf('system', true, songB),
        },
        'library',
        undefined,
      ),
    ).toEqual({ identity: songA, isPlaying: true });
  });

  it("reads only the playing owner's entry, not any source that is registered", () => {
    // If this fell back to "whatever is in the register" instead of indexing
    // by `playingOwner`, a karaoke source sitting there unplayed while the
    // library plays would leak its identity into the recording.
    const karaokeSong = buildSongIdentity('karaoke', 'k1', 'Karaoke Song');
    expect(
      pickPlayingIdentity(
        { karaoke: sourceOf('karaoke', false, karaokeSong) },
        'library',
        undefined,
      ),
    ).toEqual({ identity: undefined, isPlaying: true });
  });

  it("reports the machine's own player as paused rather than as playing", () => {
    // The rule this and the test below both pin: clause 2 must gate on
    // `isPlaying`, and a `system` player that has actually played is exactly
    // as eligible for clause 3's fallback as any of this app's own three —
    // unlike an ownership scheme, `lastPlayingOwner` does not exclude it.
    expect(
      pickPlayingIdentity(
        { system: sourceOf('system', false, songB) },
        undefined,
        'system',
      ),
    ).toEqual({ identity: songB, isPlaying: false });
  });

  it("is nothing when the machine's own player never played at all", () => {
    // A regression dropping the `isPlaying` gate on clause 2 would answer
    // `{ identity: songB, isPlaying: true }` here, which every assertion
    // above this one would still pass regardless — this is the one case
    // that depends on the gate.
    expect(
      pickPlayingIdentity(
        { system: sourceOf('system', false, songB) },
        undefined,
        undefined,
      ),
    ).toEqual({ identity: undefined, isPlaying: false });
  });

  it('is nothing for a source that published no identity', () => {
    const anonymous = { ...sourceOf('library', true), identity: undefined };
    expect(
      pickPlayingIdentity({ library: anonymous }, 'library', undefined),
    ).toEqual({ identity: undefined, isPlaying: true });
  });

  it('reports a paused library player as paused rather than as nothing playing at all', () => {
    // The positive control for the new fallback, for one of this app's own
    // three players rather than for `system`: a pause must be tellable apart
    // from a stop, or the suspend grace `songEqTiming.ts` gives a resuming
    // song is never actually reachable.
    expect(
      pickPlayingIdentity(
        { library: sourceOf('library', false) },
        undefined,
        'library',
      ),
    ).toEqual({ identity: songA, isPlaying: false });
  });

  it('reports whoever is actually playing over a stale last-playing owner', () => {
    // library paused a while ago (so it is `lastPlayingOwner`), then karaoke
    // started and is now playing. The currently playing owner must still win
    // outright.
    const karaokeSong = buildSongIdentity('karaoke', 'k1', 'Karaoke Song');
    expect(
      pickPlayingIdentity(
        {
          library: sourceOf('library', false),
          karaoke: sourceOf('karaoke', true, karaokeSong),
        },
        'karaoke',
        'library',
      ),
    ).toEqual({ identity: karaokeSong, isPlaying: true });
  });
});
