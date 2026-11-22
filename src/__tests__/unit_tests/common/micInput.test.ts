/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IMediaInput, micInputFor } from '../../../common/micInput';

/** Chromium's inputs as Ivan's window listed them on 2026-11-22. */
const IVANS_INPUTS: IMediaInput[] = [
  {
    kind: 'audioinput',
    deviceId: 'default',
    label: 'Default - Microphone (Razer Kraken V4 Pro USB - Chat) (1532:0567)',
  },
  {
    kind: 'audioinput',
    deviceId: 'communications',
    label:
      'Communications - Microphone (Razer Kraken V4 Pro - Chat) (1532:0568)',
  },
  {
    kind: 'audioinput',
    deviceId: 'realtek',
    label: 'Microphone Array (Realtek(R) Audio)',
  },
  {
    kind: 'audioinput',
    deviceId: 'kraken-wireless',
    label: 'Microphone (Razer Kraken V4 Pro - Chat) (1532:0568)',
  },
  {
    kind: 'audioinput',
    deviceId: 'kraken-usb',
    label: 'Microphone (Razer Kraken V4 Pro USB - Chat) (1532:0567)',
  },
  {
    kind: 'audiooutput',
    deviceId: 'speakers',
    label: 'Speakers (Razer Kraken V4 Pro USB - Game) (1532:0567)',
  },
];

describe('which browser input a Windows mic is', () => {
  it('finds a USB mic whatever ids Chromium adds to its name', () => {
    expect(
      micInputFor(IVANS_INPUTS, 'Microphone (Razer Kraken V4 Pro USB - Chat)'),
    ).toBe('kraken-usb');
    // Control: matched exactly, as the tab did, the same mic is not found.
    expect(
      IVANS_INPUTS.find(
        (input) =>
          input.label === 'Microphone (Razer Kraken V4 Pro USB - Chat)',
      ),
    ).toBeUndefined();
  });

  it('never takes one Kraken for the other', () => {
    expect(
      micInputFor(IVANS_INPUTS, 'Microphone (Razer Kraken V4 Pro - Chat)'),
    ).toBe('kraken-wireless');
  });

  it('prefers the plain entry over the default and communications twins', () => {
    expect(
      micInputFor(IVANS_INPUTS, 'Microphone (Razer Kraken V4 Pro USB - Chat)'),
    ).not.toBe('default');
    // With only the twin listed, the twin is the mic.
    expect(
      micInputFor(
        IVANS_INPUTS.filter((input) => input.deviceId !== 'kraken-usb'),
        'Microphone (Razer Kraken V4 Pro USB - Chat)',
      ),
    ).toBe('default');
  });

  it('finds a mic Chromium names as Windows does, and no output', () => {
    expect(
      micInputFor(IVANS_INPUTS, ' microphone array (realtek(r) audio) '),
    ).toBe('realtek');
    expect(
      micInputFor(IVANS_INPUTS, 'Speakers (Razer Kraken V4 Pro USB - Game)'),
    ).toBeUndefined();
    expect(micInputFor(IVANS_INPUTS, '')).toBeUndefined();
  });
});
