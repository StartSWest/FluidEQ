/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How long a scene was on screen, as the admin's pages say it. Under a
 * minute it says the seconds: "under a minute" told nothing about a scene put
 * on the graph moments ago (Ivan, 2026-10-12: "it need to show for how long").
 */

import type { TranslationKey } from 'common/i18n';
import { formatDuration } from 'renderer/plus/insightsFormat';

const t = (key: TranslationKey, vars?: Record<string, string>) =>
  key === 'insights.time.hoursMinutes' && vars
    ? `${vars.hours} ${vars.minutes}`
    : key;

const say = (seconds: number) => formatDuration(seconds, 'en', t);

describe('a time on screen', () => {
  it('says the seconds under a minute, whole ones only', () => {
    expect(say(0)).toBe('0s');
    expect(say(40)).toBe('40s');
    expect(say(59.9)).toBe('59s');
  });

  it('says minutes, then hours and minutes, from a minute up', () => {
    expect(say(60)).toBe('1m');
    expect(say(3300)).toBe('55m');
    expect(say(3600)).toBe('1h');
    expect(say(5 * 3600 + 10 * 60)).toBe('5h 10m');
  });

  it('says it in the reader’s language', () => {
    expect(formatDuration(40, 'de', t)).toBe('40 Sek.');
  });
});
