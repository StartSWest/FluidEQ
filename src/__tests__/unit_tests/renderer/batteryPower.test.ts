/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  isOnBattery,
  setOnBatteryForTesting,
  subscribeBattery,
} from '../../../renderer/utils/batteryPower';

describe('whether the computer is on battery', () => {
  afterEach(() => setOnBatteryForTesting(false));

  /** jsdom has no battery status, which is what a desktop reports too. */
  it('answers mains where the browser has no battery to report', () => {
    expect(isOnBattery()).toBe(false);
  });

  it('tells its listeners when the answer changes, and only then', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeBattery(listener);
    setOnBatteryForTesting(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(isOnBattery()).toBe(true);
    setOnBatteryForTesting(true);
    expect(listener).toHaveBeenCalledTimes(1);
    setOnBatteryForTesting(false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    setOnBatteryForTesting(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
