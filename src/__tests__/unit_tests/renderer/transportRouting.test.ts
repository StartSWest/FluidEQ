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
 * Whose transport the one bar is showing.
 *
 * Two components ask this and exactly one of them must answer yes, so the
 * rule lives in a function rather than in either of them — and the cases
 * worth writing down are the ones where two answers are plausible: a song
 * paused on the tab you are looking at while something else is playing.
 */

import { pickTransportOwner } from '../../../renderer/audio/transportRouting';
import type { ITransportSource } from '../../../renderer/audio/transportSource';
import type { TPlaybackOwner } from '../../../renderer/audio/playbackOwner';

const source = (
  owner: TPlaybackOwner,
  isPlaying = false,
): ITransportSource => ({
  owner,
  title: `${owner} title`,
  isPlaying,
  positionMs: 0,
  durationMs: 1000,
  toggle: () => {},
});

describe('which player the bar belongs to', () => {
  it('follows the tab when nothing is playing', () => {
    const sources = {
      library: source('library'),
      karaoke: source('karaoke'),
    };
    expect(pickTransportOwner('karaoke', sources, undefined, 'library')).toBe(
      'karaoke',
    );
  });

  it('keeps the playing song on every tab', () => {
    const sources = {
      library: source('library', true),
      karaoke: source('karaoke'),
    };
    expect(pickTransportOwner('karaoke', sources, 'library', 'library')).toBe(
      'library',
    );
  });

  it('gives the bar to sound this app is not making', () => {
    // The whole point of the feature: FluidEQ is equalising a browser tab, so
    // the bar shows that rather than a blank card — and it keeps it on every
    // page, exactly as one of this app's own songs would.
    const sources = {
      library: source('library'),
      system: source('system', true),
    };
    expect(pickTransportOwner('library', sources, undefined, 'library')).toBe(
      'system',
    );
    expect(pickTransportOwner('karaoke', sources, undefined, 'library')).toBe(
      'system',
    );
  });

  it('hands the bar back to the page once that sound stops', () => {
    const sources = {
      library: source('library'),
      system: source('system', false),
    };
    expect(pickTransportOwner('library', sources, undefined, 'library')).toBe(
      'library',
    );
  });

  it('never takes the bar from a player of this app that is playing', () => {
    // Both are making sound — a video in the Media tab and something outside.
    // The one with controls that work is the one worth showing.
    const sources = {
      media: source('media', true),
      system: source('system', true),
    };
    expect(pickTransportOwner('library', sources, 'media', 'media')).toBe(
      'media',
    );
  });

  it('holds the bar for a player of this app that has not described itself yet', () => {
    // Suno starting in the Media tab claims playback from the tag's own
    // event, and the description follows a render later. In that gap the
    // machine's player must not take the bar and hand it back — which is one
    // flicker per press of play.
    const sources = { system: source('system', true) };
    expect(pickTransportOwner('media', sources, 'media', undefined)).toBe(
      undefined,
    );
  });

  it('says nobody when there is nobody', () => {
    expect(
      pickTransportOwner('library', {}, undefined, undefined),
    ).toBeUndefined();
  });
});
