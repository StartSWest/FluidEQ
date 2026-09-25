/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISongMap } from '../../../common/songMap';
import readHeardAnswer from '../../../main/studioAgent/hearAnswer';
import { readHearRequest } from '../../../main/studioAgent/hearRequest';

/**
 * hear_the_music, both ends of it: what the member's AI may ask (which of the
 * two songs FluidEQ keeps, nothing else), and what it may be told - the
 * window's map of how the song moves, read as a stranger's before it goes
 * out: numbers and the map's own words, never the sound, never which song.
 */

const second = (t: number) => ({
  t,
  strength: 0.5,
  intensity: 0.5,
  level: 0.6,
  bass: 0.5,
  mid: 0.5,
  treble: 0.4,
  voice: 1,
  pitch: 0.4,
  kicks: 2,
  snares: 2,
  hats: 4,
  build: 0,
  drop: false,
});

const map: ISongMap = {
  seconds: 12,
  tempo: 120,
  steadiness: 0.9,
  sections: [
    {
      from: 0,
      to: 12,
      energy: 'strong',
      strength: 0.7,
      intensity: 0.6,
      level: 0.6,
      voice: 0.8,
      pitch: 0.4,
      kicks: 2,
      snares: 2,
      hats: 4,
      bass: 0.5,
      mid: 0.5,
      treble: 0.4,
      rise: 0.1,
      builds: false,
    },
  ],
  drops: [8],
  peakAt: 6,
  voiceFrom: 1,
  voicedSeconds: 10,
  voiceLow: 0.3,
  voiceHigh: 0.5,
  perSecond: Array.from({ length: 12 }, (_, t) => second(t)),
};

describe('what the AI may ask to hear', () => {
  it('is the song playing unless it asks for the one before', () => {
    expect(readHearRequest({})).toEqual({ song: 'now' });
    expect(readHearRequest({ song: 'now' })).toEqual({ song: 'now' });
    expect(readHearRequest({ song: 'before' })).toEqual({ song: 'before' });
  });

  it('refuses anything else, and says what', () => {
    expect(readHearRequest({ song: 'Toxic' })).toBe(
      'song must be "now" or "before".',
    );
    expect(readHearRequest({ title: 'Toxic' })).toBe(
      'There is no argument called "title".',
    );
    // A key is quoted back no longer than forty characters.
    expect(readHearRequest({ ['x'.repeat(500)]: 1 })).toBe(
      `There is no argument called "${'x'.repeat(40)}".`,
    );
  });
});

describe('what the AI is told', () => {
  it('passes a whole map through, and nothing the map does not have', () => {
    const answer = readHeardAnswer({
      ok: true,
      map: {
        ...map,
        // Nothing in the window puts these here; if anything ever did, they
        // stop at the door.
        title: 'Toxic',
        artist: 'Britney Spears',
        sections: map.sections.map((section) => ({ ...section, lyric: 'x' })),
      },
      otherSeconds: 30.4,
      samples: [0.1, 0.2],
    });
    expect(answer).toEqual({ ok: true, map, otherSeconds: 30 });
    expect(JSON.stringify(answer)).not.toMatch(/Toxic|Britney|lyric|samples/);
  });

  it('reads a map with a wrong number in it as no sound at all', () => {
    const broken = {
      ...map,
      perSecond: [...map.perSecond.slice(0, 5), { ...second(5), level: NaN }],
    };
    expect(readHeardAnswer({ ok: true, map: broken, otherSeconds: 0 })).toEqual(
      { ok: false, reason: 'no-sound', otherSeconds: 0 },
    );
    // Nor a word the map does not use.
    const worded = {
      ...map,
      sections: [{ ...map.sections[0], energy: 'loud' }],
    };
    expect(readHeardAnswer({ ok: true, map: worded }).ok).toBe(false);
  });

  it('takes no more of anything than ten minutes of song could make', () => {
    const endless = {
      ...map,
      perSecond: Array.from({ length: 700 }, (_, t) => second(t)),
    };
    expect(readHeardAnswer({ ok: true, map: endless }).ok).toBe(false);
    expect(readHeardAnswer({ ok: false, otherSeconds: 1e9 }).otherSeconds).toBe(
      605,
    );
  });

  it('is no sound when the window answered nothing it could read', () => {
    [undefined, null, 'map', 7, [], { ok: 'yes', map }].forEach((raw) => {
      expect(readHeardAnswer(raw)).toEqual({
        ok: false,
        reason: 'no-sound',
        otherSeconds: 0,
      });
    });
  });
});
