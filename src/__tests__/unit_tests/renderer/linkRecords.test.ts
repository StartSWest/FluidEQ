/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which way sound goes on a link, as the window works it out.
 *
 * Both ways is the switch pair on every link and nothing else — except where
 * either end cannot do it: a computer off Windows plays nothing while it
 * sends (its capture would hear what it plays), and a FluidEQ from before
 * both ways never says what it does, so the side that cannot ask it never
 * sends to it unasked and the side that joined it keeps sending as it always
 * did.
 */

import type { IRemoteNowPlaying } from 'common/remoteAudio';
import {
  ALL_ON,
  type ILinkRecord,
  linkPhase,
  linkViews,
  playsHere,
  sendsThere,
} from 'renderer/remoteAudio/linkRecords';

const record = (overrides: Partial<ILinkRecord> = {}): ILinkRecord => ({
  name: 'OTHER-PC',
  joined: false,
  theirs: { sends: true, plays: true },
  switches: ALL_ON,
  receiving: false,
  ...overrides,
});

const song: IRemoteNowPlaying = {
  title: 'Song',
  isPlaying: true,
  positionMs: 0,
  durationMs: 0,
  canNext: false,
  canPrevious: false,
  canStep: false,
  canStop: false,
};

describe('playsHere', () => {
  it('plays a linked computer while its switch is on, whichever side joined', () => {
    expect(playsHere(record(), true)).toBe(true);
    expect(playsHere(record({ joined: true }), true)).toBe(true);
    expect(
      playsHere(record({ switches: { send: true, play: false } }), true),
    ).toBe(false);
  });

  it('plays nothing it sends to where it cannot do both', () => {
    // Off Windows the computer that joined is the one sending: it plays
    // nothing back, which is the link as it ran before both ways.
    expect(playsHere(record({ joined: true }), false)).toBe(false);
    expect(playsHere(record({ joined: false }), false)).toBe(true);
  });
});

describe('sendsThere', () => {
  it('sends to a computer that said it plays, while the switch is on', () => {
    expect(sendsThere(record(), true)).toBe(true);
    expect(
      sendsThere(record({ switches: { send: false, play: true } }), true),
    ).toBe(false);
    expect(
      sendsThere(record({ theirs: { sends: true, plays: false } }), true),
    ).toBe(false);
  });

  it('never sends unasked to a computer that joined and said nothing', () => {
    // An older FluidEQ that pasted this computer's code never plays anything
    // back; sound sent to it would be a stream nobody hears.
    expect(sendsThere(record({ theirs: undefined }), true)).toBe(false);
  });

  it('keeps sending to the computer it joined when that one says nothing', () => {
    // The other way round: an older FluidEQ whose code this computer pasted
    // is a listener and always was.
    expect(sendsThere(record({ joined: true, theirs: undefined }), true)).toBe(
      true,
    );
  });

  it('sends only to the computer it joined where it cannot do both', () => {
    expect(sendsThere(record({ joined: true }), false)).toBe(true);
    expect(sendsThere(record({ joined: false }), false)).toBe(false);
  });
});

describe('linkPhase', () => {
  it('is idle without a role, and waiting or connecting without a link', () => {
    expect(linkPhase(undefined, new Map(), false)).toBe('idle');
    expect(linkPhase('listener', new Map(), false)).toBe('waiting');
    expect(linkPhase('sender', new Map(), false)).toBe('connecting');
  });

  it('is blocked playback only while something is arriving to be blocked', () => {
    const quiet = new Map([['a', record()]]);
    const arriving = new Map([['a', record({ receiving: true })]]);
    expect(linkPhase('listener', quiet, true)).toBe('connected');
    expect(linkPhase('listener', arriving, true)).toBe('playback-blocked');
    expect(linkPhase('sender', arriving, false)).toBe('connected');
  });
});

describe('linkViews', () => {
  it('carries each link under its peer id, with what its bar is showing', () => {
    const views = linkViews(
      new Map([
        ['a', record({ name: 'A', nowPlaying: song })],
        ['b', record({ name: 'B' })],
      ]),
    );
    expect(views.map((view) => [view.id, view.name])).toEqual([
      ['a', 'A'],
      ['b', 'B'],
    ]);
    expect(views.map((view) => view.nowPlaying)).toEqual([song, undefined]);
  });
});
