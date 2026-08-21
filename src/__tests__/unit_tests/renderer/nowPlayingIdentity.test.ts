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
 * recorded. `pickPlayingIdentity` is only the first two clauses of that
 * function, so the cases worth pinning are the ones a bar would answer
 * differently from a recorder.
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
  it('is nothing when nothing is playing', () => {
    expect(
      pickPlayingIdentity({ library: sourceOf('library', false) }, undefined),
    ).toBeUndefined();
  });

  it('is the app player that holds playback', () => {
    // Positive control for the test above.
    expect(
      pickPlayingIdentity({ library: sourceOf('library', true) }, 'library'),
    ).toBe(songA);
  });

  it("is the machine's own player when nothing of ours holds playback", () => {
    expect(
      pickPlayingIdentity(
        { system: sourceOf('system', true, songB) },
        undefined,
      ),
    ).toBe(songB);
  });

  it("ignores the machine's player while one of ours is playing", () => {
    expect(
      pickPlayingIdentity(
        {
          library: sourceOf('library', true),
          system: sourceOf('system', true, songB),
        },
        'library',
      ),
    ).toBe(songA);
  });

  it('does not follow the tab, unlike the bar', () => {
    // The bar shows the last paused thing on a tab that is not a player. A
    // paused song is not being equalised, so this must not.
    expect(
      pickPlayingIdentity({ library: sourceOf('library', false) }, undefined),
    ).toBeUndefined();
  });

  it('is nothing for a source that published no identity', () => {
    const anonymous = { ...sourceOf('library', true), identity: undefined };
    expect(
      pickPlayingIdentity({ library: anonymous }, 'library'),
    ).toBeUndefined();
  });
});
