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

import {
  DISCLAIMER_PARAGRAPHS,
  DISCLAIMER_VERSION,
  buildAcceptance,
  readAcceptance,
} from 'common/disclaimer';
import { AUTHOR_NAME } from 'common/branding';

describe('the disclaimer text', () => {
  const text = DISCLAIMER_PARAGRAPHS.join(' ');

  it('says the three things sections 15 and 16 say', () => {
    expect(text).toContain('as is');
    expect(text).toContain('no warranty');
    expect(text).toContain(`${AUTHOR_NAME} is not liable`);
  });

  it('names what it is disclaiming liability for', () => {
    // Vagueness is the failure mode of a disclaimer that nobody wrote out. The
    // three named here are the ones this program can plausibly reach.
    expect(text).toContain('hearing');
    expect(text).toContain('equipment');
    expect(text).toContain('data');
  });

  it('says that using it is the acceptance', () => {
    expect(text).toContain('you accept');
  });

  it('does not overstate what it achieves', () => {
    // Consumer law in a number of countries limits what a seller may disclaim
    // however the text is worded. A notice that implies otherwise invites
    // somebody to believe they have given up a right they still have, and it
    // is the one way this feature could do actual harm.
    expect(text).toContain('does not take away rights the law gives you');
    expect(text.toLowerCase()).not.toContain('cannot sue');
    expect(text.toLowerCase()).not.toContain('waive');
    expect(text.toLowerCase()).not.toContain('terms of service');
    expect(text.toLowerCase()).not.toContain('under no circumstances');
  });
});

describe('recording that it was acknowledged', () => {
  it('writes down which wording, which build and when', () => {
    // A boolean would stop the dialog reappearing and be worth nothing as
    // evidence afterwards. These three fields are the difference between "the
    // flag is set" and "this text was shown to this person on this date".
    const record = buildAcceptance('1.2.0', new Date('2026-08-12T09:30:00Z'));
    expect(record).toEqual({
      disclaimerVersion: DISCLAIMER_VERSION,
      appVersion: '1.2.0',
      acceptedAt: '2026-08-12T09:30:00.000Z',
    });
  });

  it('reads its own record back', () => {
    const record = buildAcceptance('1.2.0', new Date('2026-08-12T09:30:00Z'));
    expect(readAcceptance(JSON.stringify(record))).toEqual(record);
  });

  it('takes a record with no app version, because an unknown build is still a record', () => {
    const stored = JSON.stringify({
      disclaimerVersion: DISCLAIMER_VERSION,
      acceptedAt: '2026-08-12T09:30:00.000Z',
    });
    expect(readAcceptance(stored)?.appVersion).toBe('');
  });
});

describe('asking again when', () => {
  // The bias here runs the opposite way to the mandatory-update check. There
  // the cheap mistake is not blocking; here it is showing this twice.
  it.each([
    ['nothing has been stored', null],
    ['the stored value is undefined', undefined],
    ['the stored value is empty', ''],
    ['the stored value is a bare boolean', 'true'],
    ['the stored value is truncated JSON', '{'],
    ['the stored value is a word', 'accepted'],
    ['the stored value is JSON null', 'null'],
    ['the stored value is a JSON number', '42'],
    ['the stored value is a JSON string', '"accepted"'],
    ['the stored value is an empty array', '[]'],
    [
      'the record is wrapped in an array',
      '[{"disclaimerVersion":1,"acceptedAt":"2026-01-01T00:00:00.000Z"}]',
    ],
    [
      'the wording has changed since it was accepted',
      JSON.stringify({
        disclaimerVersion: DISCLAIMER_VERSION - 1,
        appVersion: '1.2.0',
        acceptedAt: '2026-08-12T09:30:00.000Z',
      }),
    ],
    [
      // What a hand-edited file, or a future format written carelessly, looks
      // like. Strict equality, so it asks again rather than guessing.
      'the version is stored as a string rather than a number',
      JSON.stringify({
        disclaimerVersion: String(DISCLAIMER_VERSION),
        acceptedAt: '2026-08-12T09:30:00.000Z',
      }),
    ],
    [
      'there is no timestamp, so there is no evidence of anything',
      JSON.stringify({ disclaimerVersion: DISCLAIMER_VERSION }),
    ],
    [
      'the timestamp is empty',
      JSON.stringify({ disclaimerVersion: DISCLAIMER_VERSION, acceptedAt: '' }),
    ],
    [
      'the timestamp is a number of milliseconds',
      JSON.stringify({
        disclaimerVersion: DISCLAIMER_VERSION,
        acceptedAt: 1_754_000_000_000,
      }),
    ],
  ])('%s', (_label, raw) => {
    expect(readAcceptance(raw)).toBeUndefined();
  });
});
