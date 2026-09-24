/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The preamp's floor is its own, not a band's.
 *
 * A band's ±20 dB bounds what one filter may be asked to do; the preamp
 * cancels the SUM of every layer, and a headphone correction plays as
 * published past ±20 dB. Sent through the band clamp, a level deep enough to
 * hold one arrived at main as -20 — the reserve smaller than what it was
 * reserving against, which clips by construction and reads as the dial
 * refusing to go down.
 */

import ChannelEnum from 'common/channels';
import { MAX_GAIN, MIN_GAIN, PREAMP_MIN_GAIN } from 'common/constants';
import { setMainPreAmp } from 'renderer/utils/equalizerApi';
import installFakeIpcRenderer from '../../utils/fakeIpcRenderer';

const previous = Object.getOwnPropertyDescriptor(window, 'electron');

let bridge: ReturnType<typeof installFakeIpcRenderer>;

/** What reached main on the preamp channel, in decibels. */
const sentGain = (): number =>
  Number(bridge.sentOn(ChannelEnum.SET_PREAMP).slice(-1)[0].args[0]);

beforeEach(() => {
  bridge = installFakeIpcRenderer();
});

afterEach(() => {
  if (previous) {
    Object.defineProperty(window, 'electron', previous);
  } else {
    Reflect.deleteProperty(window, 'electron');
  }
});

describe('the preamp a hand reaches', () => {
  it('sends a level deeper than a band may go, as asked', () => {
    setMainPreAmp(-45).catch(() => undefined);
    expect(sentGain()).toBe(-45);
    // The positive control: the band clamp that used to be here would have
    // turned that into this number, and the test could not tell them apart
    // without saying so.
    expect(sentGain()).not.toBe(MIN_GAIN);
  });

  it('goes all the way to the preamp floor', () => {
    setMainPreAmp(PREAMP_MIN_GAIN).catch(() => undefined);
    expect(sentGain()).toBe(PREAMP_MIN_GAIN);
  });

  it('holds anything past the floor at it', () => {
    setMainPreAmp(-200).catch(() => undefined);
    expect(sentGain()).toBe(PREAMP_MIN_GAIN);
  });

  it('keeps the ceiling a band has, because makeup is not the problem', () => {
    setMainPreAmp(40).catch(() => undefined);
    expect(sentGain()).toBe(MAX_GAIN);
  });

  it('leaves an ordinary trim exactly where it was put', () => {
    setMainPreAmp(-6.5).catch(() => undefined);
    expect(sentGain()).toBe(-6.5);
  });
});
