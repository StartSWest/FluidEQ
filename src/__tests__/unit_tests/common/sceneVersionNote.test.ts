/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a maker writes about a version, and how long a version is new. The
 * server vendors this file byte for byte, so what is held here is also what
 * the publishing function keeps.
 */

import {
  MAX_VERSION_NOTE,
  NEW_VERSION_DAYS,
  isNewSceneVersion,
  readVersionNote,
} from '../../../common/sceneVersionNote';

const DAY = 24 * 60 * 60 * 1000;

describe('a version note', () => {
  it('is kept as one clean line', () => {
    expect(readVersionNote('  Brighter lake\n\tat   night  ')).toBe(
      'Brighter lake at night',
    );
  });

  it('loses characters that draw nothing or turn the line around', () => {
    // Zero-width space, right-to-left override, a tag character, a BOM.
    const hidden = `peaks\u200b stay\u202e whole\u{e0041}\ufeff`;
    expect(readVersionNote(hidden)).toBe('peaks stay whole');
  });

  it('is nothing when nothing is sent or nothing is left', () => {
    expect(readVersionNote(undefined)).toBeNull();
    expect(readVersionNote(null)).toBeNull();
    expect(readVersionNote('   \u200b  ')).toBeNull();
  });

  it('cannot be kept when it is not text or runs long', () => {
    expect(readVersionNote(42)).toBeUndefined();
    expect(readVersionNote({ text: 'hi' })).toBeUndefined();
    expect(readVersionNote('x'.repeat(MAX_VERSION_NOTE + 1))).toBeUndefined();
    // The control: exactly the limit is kept.
    expect(readVersionNote('x'.repeat(MAX_VERSION_NOTE))).toHaveLength(
      MAX_VERSION_NOTE,
    );
  });
});

describe('a new version', () => {
  const now = Date.parse('2026-09-13T20:00:00.000Z');
  const at = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();

  it('is one past the first, published within the week', () => {
    expect(
      isNewSceneVersion({ version: 4, firstVersion: 1, updatedAt: at(2) }, now),
    ).toBe(true);
    expect(
      isNewSceneVersion(
        { version: 4, firstVersion: 1, updatedAt: at(NEW_VERSION_DAYS + 1) },
        now,
      ),
    ).toBe(false);
  });

  it('is never a scene’s first version, nor one whose history is unknown', () => {
    expect(
      isNewSceneVersion({ version: 1, firstVersion: 1, updatedAt: at(0) }, now),
    ).toBe(false);
    expect(isNewSceneVersion({ version: 4, updatedAt: at(0) }, now)).toBe(
      false,
    );
    expect(
      isNewSceneVersion(
        { version: 4, firstVersion: 1, updatedAt: 'not a date' },
        now,
      ),
    ).toBe(false);
  });
});
