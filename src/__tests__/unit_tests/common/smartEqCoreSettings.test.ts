/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Smart EQ's settings as the core keeps them from the window: each one read
 * back as it was sent, and anything that is not one read as the safe
 * default — the running switch off above all, a mode in which the sound
 * changes by itself.
 */
import {
  DEFAULT_CORRECTION_LIMIT_DB,
  DEFAULT_SMART_EQ_SETTINGS,
  MAX_CORRECTION_LIMIT_DB,
  MIN_CORRECTION_LIMIT_DB,
  parseSmartEqCoreSettings,
} from 'common/smartEqCore';
import { presenceKey, presenceLineAt } from 'common/presenceLines';

it('reads back what the window sent', () => {
  const sent = {
    mode: 'target',
    continuous: true,
    limitDb: 9.5,
    presenceOffsets: { [presenceKey('target', 'bass', 'floor')]: -4 },
  };
  expect(parseSmartEqCoreSettings(sent)).toEqual(sent);
});

it.each([
  ['nothing', undefined],
  ['a list', [1, 2]],
  ['text', 'detail'],
])('reads %s as the defaults', (_what, raw) => {
  expect(parseSmartEqCoreSettings(raw)).toEqual(DEFAULT_SMART_EQ_SETTINGS);
});

it('keeps the running switch off unless it is plainly on', () => {
  expect(parseSmartEqCoreSettings({ continuous: 'true' }).continuous).toBe(
    false,
  );
  expect(parseSmartEqCoreSettings({ continuous: 1 }).continuous).toBe(false);
});

it('reads the old single running mode as Detail, and anything else as the one-shot', () => {
  expect(parseSmartEqCoreSettings({ mode: 'continuous' }).mode).toBe('detail');
  expect(parseSmartEqCoreSettings({ mode: 'loud' }).mode).toBe('smart');
});

it('holds the limit to its range, and a limit that is not one to the default', () => {
  expect(parseSmartEqCoreSettings({ limitDb: 0.2 }).limitDb).toBe(
    MIN_CORRECTION_LIMIT_DB,
  );
  expect(parseSmartEqCoreSettings({ limitDb: 99 }).limitDb).toBe(
    MAX_CORRECTION_LIMIT_DB,
  );
  expect(parseSmartEqCoreSettings({ limitDb: -3 }).limitDb).toBe(
    DEFAULT_CORRECTION_LIMIT_DB,
  );
  expect(parseSmartEqCoreSettings({ limitDb: Number.NaN }).limitDb).toBe(
    DEFAULT_CORRECTION_LIMIT_DB,
  );
});

it('drops a presence offset that is not a number in range, which would switch its gate off', () => {
  const { presenceOffsets } = parseSmartEqCoreSettings({
    presenceOffsets: { a: 3, b: Number.NaN, c: 'x', d: 1000 },
  });
  expect(presenceOffsets).toEqual({ a: 3 });
});

it('moves a line by its offset, in its own mode only', () => {
  const key = presenceKey('balance', 'bass', 'floor');
  const moved = presenceLineAt({ [key]: -3 }, 'balance', 'floor', 'bass', 100);
  const auto = presenceLineAt({}, 'balance', 'floor', 'bass', 100);
  expect(moved).toBeCloseTo(auto - 3);
  expect(presenceLineAt({ [key]: -3 }, 'detail', 'floor', 'bass', 100)).toBe(
    presenceLineAt({}, 'detail', 'floor', 'bass', 100),
  );
});
