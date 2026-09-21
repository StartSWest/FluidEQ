/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the three tone dials were set to, kept rather than worked out again.
 *
 * Working them out from the curve is lossy in both directions — Treble set to
 * 8 read back as 7.2 with -0.8 of Bass beside it — so leaving the page and
 * returning, or changing the band count, moved every dial. These are the
 * values themselves.
 */
import {
  recallTone,
  rememberTone,
  TONE_MEMORY_KEY,
} from '../../../renderer/eq/toneMemory';
import { TONE_MAX_DB } from '../../../common/toneStack';

describe('remembering the tone dials', () => {
  beforeEach(() => window.localStorage.clear());

  it('gives back exactly what was set', () => {
    rememberTone({ bass: 4.5, mid: -2.1, treble: 8 });
    expect(recallTone()).toEqual({ bass: 4.5, mid: -2.1, treble: 8 });
  });

  it('answers nothing the first time, so the curve is read instead', () => {
    expect(recallTone()).toBeUndefined();
  });

  it('refuses anything this app did not write', () => {
    const rubbish = [
      'not json at all',
      '"a string"',
      'null',
      '{}',
      '{"bass":1,"mid":2}',
      '{"bass":"loud","mid":0,"treble":0}',
      '{"bass":null,"mid":0,"treble":0}',
    ];
    rubbish.forEach((text) => {
      window.localStorage.setItem(TONE_MEMORY_KEY, text);
      expect(recallTone()).toBeUndefined();
    });
  });

  /**
   * A value out of range would put the dial past its own end, where it cannot
   * be turned back from.
   */
  it('brings a value from outside the dial back onto it', () => {
    window.localStorage.setItem(
      TONE_MEMORY_KEY,
      JSON.stringify({ bass: 400, mid: -400, treble: 0 }),
    );
    expect(recallTone()).toEqual({
      bass: TONE_MAX_DB,
      mid: -TONE_MAX_DB,
      treble: 0,
    });
  });

  it('refuses a number that is not one', () => {
    window.localStorage.setItem(
      TONE_MEMORY_KEY,
      '{"bass":null,"mid":0,"treble":0}',
    );
    expect(recallTone()).toBeUndefined();
  });

  /**
   * Storage a browser refuses is the same answer as no storage: the controls
   * read the curve, which is where they started, rather than failing to open.
   */
  it('says nothing and keeps working when storage cannot be used', () => {
    const readable = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    const writable = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    expect(recallTone()).toBeUndefined();
    expect(() => rememberTone({ bass: 1, mid: 1, treble: 1 })).not.toThrow();
    readable.mockRestore();
    writable.mockRestore();
  });
});
