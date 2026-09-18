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
  isLaterSceneVersion,
  isNewSceneVersion,
  readVersionNote,
  versionToPublish,
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

describe('the rule that a scene changes only under a higher version', () => {
  it('takes a higher version over what is already there', () => {
    expect(isLaterSceneVersion(4, 3)).toBe(true);
    expect(isLaterSceneVersion(400, 3)).toBe(true);
  });

  it('refuses the same version again, which is the whole point', () => {
    // A maker republishing under the number everybody already installed is
    // how different code reaches a listener with no update notice, nothing
    // on the versions page, and one number naming two scenes.
    expect(isLaterSceneVersion(3, 3)).toBe(false);
  });

  it('refuses a version that goes backwards', () => {
    expect(isLaterSceneVersion(2, 3)).toBe(false);
  });

  it('lets anything fill a place where nothing is published', () => {
    expect(isLaterSceneVersion(1)).toBe(true);
    expect(isLaterSceneVersion(97)).toBe(true);
  });

  it('refuses a version that is not a whole number, rather than comparing it', () => {
    // Fails CLOSED: a manifest carrying text, a fraction or NaN must not
    // publish, and NaN compares false against everything either way — which
    // would read as "refused" here and as "allowed" if the test were written
    // the other way round.
    [Number.NaN, 2.5, '4', null, undefined, {}].forEach((bad) => {
      expect(isLaterSceneVersion(bad, 3)).toBe(false);
      expect(isLaterSceneVersion(bad)).toBe(false);
    });
  });

  it('treats a held version nobody can compare as no version at all', () => {
    // A row that cannot be read must not lock its own scene out of the
    // gallery for good.
    expect(isLaterSceneVersion(3, Number.NaN)).toBe(true);
  });
});

describe('the version a publication goes out under', () => {
  it('is one above the gallery when the project has not caught up', () => {
    expect(versionToPublish(3, 3)).toBe(4);
    expect(versionToPublish(1, 8)).toBe(9);
  });

  it('never drags a maker back below where they have taken it', () => {
    expect(versionToPublish(12, 3)).toBe(12);
  });

  it('is the project’s own for a first publication', () => {
    expect(versionToPublish(5)).toBe(5);
  });

  it('always clears what is held, whatever the project says', () => {
    // The property that matters: whatever comes out of this is a version the
    // rule above accepts. Anything else and publishing refuses its own work.
    [Number.NaN, 0.5, '2', null, undefined, 1, 4, 99].forEach((local) => {
      [undefined, 0, 1, 7, 98].forEach((held) => {
        expect(isLaterSceneVersion(versionToPublish(local, held), held)).toBe(
          true,
        );
      });
    });
  });
});
