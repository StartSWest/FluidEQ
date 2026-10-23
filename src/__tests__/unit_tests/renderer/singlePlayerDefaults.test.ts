/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { forgetSettings } from 'renderer/utils/settingsReset';

const readOnLaunch = (): boolean => {
  let enabled = false;
  jest.isolateModules(() => {
    const { isSinglePlayerEnabled } = jest.requireActual<
      typeof import('renderer/utils/singlePlayer')
    >('renderer/utils/singlePlayer');
    enabled = isSinglePlayerEnabled();
  });
  return enabled;
};

describe('one player at a time preference', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('starts on with no saved preference', () => {
    expect(readOnLaunch()).toBe(true);
  });

  it('keeps an explicit off until the settings are reset', () => {
    localStorage.setItem('fluideq.singlePlayer', 'false');
    expect(readOnLaunch()).toBe(false);

    const outputs = JSON.stringify(['headphones']);
    const volumes = JSON.stringify({ headphones: 0.4 });
    localStorage.setItem('fluideq-mirror-target-guids', outputs);
    localStorage.setItem('fluideq-mirror-volumes', volumes);
    forgetSettings(localStorage);

    expect(readOnLaunch()).toBe(true);
    expect(localStorage.getItem('fluideq-mirror-target-guids')).toBe(outputs);
    expect(localStorage.getItem('fluideq-mirror-volumes')).toBe(volumes);
  });
});
