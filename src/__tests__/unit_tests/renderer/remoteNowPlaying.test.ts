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
 * What the listener draws for a sender, and which sender it draws.
 *
 * The pure halves of the two hooks: what a sender's bar becomes on the wire,
 * how the listener's state carries it per sender, which sender gets the one
 * bar, and which senders count as having just pressed play — the transition
 * the one-player rule acts on.
 */

import type { IRemoteNowPlaying } from 'common/remoteAudio';
import type { ITransportSource } from 'renderer/audio/transportSource';
import listenerState from 'renderer/remoteAudio/listenerState';
import {
  describeForRemote,
  pickSourceForRemote,
} from 'renderer/remoteAudio/useRemoteNowPlayingBroadcast';
import {
  pickRemoteNowPlaying,
  startedSenders,
} from 'renderer/remoteAudio/useRemoteNowPlayingSource';

const playing = (isPlaying: boolean): IRemoteNowPlaying => ({
  title: 'Song',
  isPlaying,
  positionMs: 0,
  durationMs: 0,
  canNext: false,
  canPrevious: false,
  canStep: false,
  canStop: false,
});

const computer = (id: string, nowPlaying?: IRemoteNowPlaying) => ({
  id,
  name: id.toUpperCase(),
  nowPlaying,
});

describe('describeForRemote', () => {
  const source: ITransportSource = {
    owner: 'system',
    title: 'Song',
    subtitle: 'Artist',
    isPlaying: true,
    positionMs: 12_345.6,
    durationMs: Number.NaN,
    toggle: () => undefined,
    nudge: () => undefined,
    next: () => undefined,
  };

  it('is nothing for an empty bar', () => {
    expect(describeForRemote(undefined)).toBeUndefined();
    expect(describeForRemote({ ...source, title: '  ' })).toBeUndefined();
  });

  it('carries the bar and says which buttons the source answers', () => {
    expect(describeForRemote(source)).toEqual({
      title: 'Song',
      subtitle: 'Artist',
      artist: undefined,
      isPlaying: true,
      // Whole, and a clock that could not be measured is zero, not NaN — the
      // validator on the other end rejects anything else.
      positionMs: 12_345,
      durationMs: 0,
      canNext: true,
      canPrevious: false,
      canStep: true,
      canStop: false,
    });
  });

  it('offers a step for a seekable, measured source too', () => {
    const seekable: ITransportSource = {
      ...source,
      nudge: undefined,
      seek: () => undefined,
      durationMs: 1000,
    };
    expect(describeForRemote(seekable)?.canStep).toBe(true);
    // Seekable but unmeasured is a page we can only ask to play or pause.
    expect(describeForRemote({ ...seekable, durationMs: 0 })?.canStep).toBe(
      false,
    );
  });
});

describe('pickSourceForRemote', () => {
  const paused: ITransportSource = {
    owner: 'system',
    title: 'Song',
    isPlaying: false,
    positionMs: 0,
    durationMs: 0,
    toggle: () => undefined,
  };

  it('keeps describing the machine\x27s player after it is paused', () => {
    // The sender's own bar drops a paused browser tab; the listener's bar
    // must not, or the press that paused it has nothing left to resume.
    expect(pickSourceForRemote({ system: paused }, undefined, undefined)).toBe(
      paused,
    );
  });

  it('still prefers the bar\x27s own answer while there is one', () => {
    const library: ITransportSource = { ...paused, owner: 'library' };
    expect(
      pickSourceForRemote({ library, system: paused }, undefined, 'library'),
    ).toBe(library);
    expect(pickSourceForRemote({}, undefined, undefined)).toBeUndefined();
  });
});

describe('listenerState', () => {
  it('carries what each sender said its bar is showing', () => {
    const state = listenerState(
      new Set(['a', 'b']),
      new Map([
        ['a', 'A'],
        ['b', 'B'],
      ]),
      new Map(),
      new Set(['a']),
      false,
      new Map([['a', playing(true)]]),
    );
    expect(state.computers.map((entry) => entry.nowPlaying)).toEqual([
      playing(true),
      undefined,
    ]);
  });
});

describe('pickRemoteNowPlaying', () => {
  it('is the sender that is playing, then whoever described itself', () => {
    const idle = computer('a', playing(false));
    const loud = computer('b', playing(true));
    expect(pickRemoteNowPlaying([idle, loud])).toBe(loud);
    expect(pickRemoteNowPlaying([idle, computer('c')])).toBe(idle);
    expect(pickRemoteNowPlaying([computer('c')])).toBeUndefined();
  });

  it('prefers the sender that started last while it still plays', () => {
    // Two senders playing with the one-player switch off: the bar shows the
    // one whose user pressed play most recently, not the first to connect.
    const first = computer('a', playing(true));
    const latest = computer('b', playing(true));
    expect(pickRemoteNowPlaying([first, latest], 'b')).toBe(latest);
    // A preference for a sender that has since paused is no preference.
    expect(
      pickRemoteNowPlaying([first, computer('b', playing(false))], 'b'),
    ).toBe(first);
  });
});

describe('startedSenders', () => {
  it('is the transition, not the state', () => {
    // A sender still playing since last time is not a press of play; the
    // one-player rule acting on the state made two players take turns
    // stopping each other.
    expect(startedSenders(new Set(['a']), ['a', 'b'])).toEqual(['b']);
    expect(startedSenders(new Set(['a', 'b']), ['a', 'b'])).toEqual([]);
    expect(startedSenders(new Set(), [])).toEqual([]);
  });
});
