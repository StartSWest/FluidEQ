/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  requestAccountPanel,
  subscribeAccountPanelRequests,
} from '../../../renderer/account/accountPanel';
import { hueOf, identityStyle } from '../../../renderer/community/identity';

describe('one colour per person', () => {
  it('is the same hue for the same handle every time, on the colour wheel', () => {
    expect(hueOf('ada')).toBe(hueOf('ada'));
    ['ada', 'bob', 'mei', 'ivan_c', 'x'].forEach((handle) => {
      const hue = hueOf(handle);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    });
  });

  it('spreads neighbouring handles apart rather than a few degrees from each other', () => {
    const hues = ['ada', 'adb', 'adc', 'add', 'ade'].map(hueOf);
    expect(new Set(hues).size).toBeGreaterThan(2);
  });

  it('rides on the element as a custom property, so the stylesheet owns the colour', () => {
    expect(identityStyle('ada')).toEqual({
      '--identity-hue': `${hueOf('ada')}deg`,
    });
  });
});

describe('asking for the Account panel from afar', () => {
  it('reaches whoever is listening, and nobody after they stop', () => {
    const listener = jest.fn();
    const stop = subscribeAccountPanelRequests(listener);
    requestAccountPanel();
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    requestAccountPanel();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
