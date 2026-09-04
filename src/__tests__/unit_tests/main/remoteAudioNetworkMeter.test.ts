/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import createRemoteAudioNetworkMeter from '../../../main/remoteAudioNetworkMeter';

describe('LAN audio network meter', () => {
  it('reports actual encrypted bytes and queued backpressure', () => {
    const emit = jest.fn();
    const times = [0n, 100_000_000n, 300_000_000n];
    const meter = createRemoteAudioNetworkMeter(emit, () => {
      const next = times.shift();
      if (next === undefined) {
        throw new Error('Network meter requested an unexpected timestamp.');
      }
      return next;
    });

    meter.record('source-pc', 'send', 1_000, 0);
    meter.record('source-pc', 'send', 2_000, 0);
    expect(emit).not.toHaveBeenCalled();

    meter.record('source-pc', 'send', 1_000, 512, 25);
    expect(emit).toHaveBeenCalledWith({
      bytesPerSecond: 13_333,
      direction: 'send',
      peerId: 'source-pc',
      queuedBytes: 512,
      queuedMilliseconds: 63,
    });
  });
});
