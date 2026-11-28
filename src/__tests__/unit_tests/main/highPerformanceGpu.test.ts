/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  HIGH_PERFORMANCE_GPU_SWITCH,
  startOnTheFastGpu,
} from 'main/highPerformanceGpu';

// Ivan, 2026-11-27: "always to try enforce fast high performance".
describe('the fast graphics card', () => {
  /**
   * Chromium turns a GPU workaround on from the command line by its exact
   * name, underscores and all; a near spelling is a switch nothing reads,
   * and the app quietly stays wherever Windows put it.
   */
  it('is asked for by the name of Chromium’s own workaround', () => {
    expect(HIGH_PERFORMANCE_GPU_SWITCH).toBe('force_high_performance_gpu');
    const appendSwitch = jest.fn();
    startOnTheFastGpu({ appendSwitch });
    expect(appendSwitch).toHaveBeenCalledTimes(1);
    expect(appendSwitch).toHaveBeenCalledWith('force_high_performance_gpu');
  });

  /** It used to wait for a View menu choice that was off by default. */
  it('is asked for on every launch, with nothing to switch it off', () => {
    const main = readFileSync(join(__dirname, '../../../main/main.ts'), 'utf8');
    // At the top level of main, never inside a condition.
    expect(main).toMatch(/^startOnTheFastGpu\(app\.commandLine\);$/m);
    expect(main).not.toMatch(/GpuPreference|graphicsPreference/);
  });
});
