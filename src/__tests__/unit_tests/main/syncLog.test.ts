/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import {
  isSyncFeedError,
  offlineError,
  SyncFeedError,
  syncLogLine,
  syncLogTime,
} from '../../../main/syncLog';

describe('a sync log line', () => {
  it('reads feed, what, why and what happens next, in that order', () => {
    expect(
      syncLogLine({
        feed: 'OPRA database',
        what: 'check failed',
        why: 'HTTP 502',
        next: 'tries again at the next launch',
      }),
    ).toBe(
      'OPRA database: check failed (HTTP 502); tries again at the next launch.',
    );
  });

  it('gives a time as the clock reads it and as the instant', () => {
    const at = Date.parse('2026-11-13T20:05:33Z');
    const local = new Date(at);
    const hhmm = `${String(local.getHours()).padStart(2, '0')}:${String(
      local.getMinutes(),
    ).padStart(2, '0')}`;
    expect(syncLogTime(at)).toBe(`${hhmm} (2026-11-13T20:05:33.000Z)`);
  });

  it('tells an expected failure from a bug', () => {
    expect(isSyncFeedError(new SyncFeedError('http', 'HTTP 500'))).toBe(true);
    expect(isSyncFeedError(offlineError(new TypeError('fetch failed')))).toBe(
      true,
    );
    expect(isSyncFeedError(new Error('HTTP 500'))).toBe(false);
  });
});
