/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, cleanup, render } from '@testing-library/react';
import { Activity, useEffect } from 'react';
import useCaptureBridge from '../../../renderer/audio/useCaptureBridge';
import { useLiveAudioControl } from '../../../renderer/audio/LiveAudioContext';

/**
 * The capture as `useLiveOutputSpectrum` runs it: open while anything claims
 * it, closed the moment the last claim goes. `start` and `stop` in the log
 * are a loopback negotiated and one torn down.
 */
const mockCapture = {
  claims: 0,
  isActive: true,
  log: [] as string[],
  claim() {
    if (mockCapture.claims === 0) {
      mockCapture.log.push('start');
    }
    mockCapture.claims += 1;
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      mockCapture.claims -= 1;
      if (mockCapture.claims === 0) {
        mockCapture.log.push('stop');
      }
    };
  },
};

jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioControl: () => ({
    claim: mockCapture.claim,
    isActive: mockCapture.isActive,
  }),
}));

/** Something drawn that holds the capture, like the graph or the amp's deck. */
const Owner = () => {
  const { claim } = useLiveAudioControl();
  useEffect(() => claim('display'), [claim]);
  return null;
};

/** The shell's shape: pages asleep behind the amp, the amp drawn over them. */
const Shell = ({ isAmp }: { isAmp: boolean }) => (
  <>
    <Activity mode={isAmp ? 'hidden' : 'visible'}>
      <Owner />
    </Activity>
    {isAmp && <Owner />}
  </>
);

const BridgedShell = ({ isAmp }: { isAmp: boolean }) => {
  useCaptureBridge(isAmp ? 'player' : 'app');
  return <Shell isAmp={isAmp} />;
};

beforeEach(() => {
  mockCapture.claims = 0;
  mockCapture.isActive = true;
  mockCapture.log = [];
});
afterEach(cleanup);

describe('the capture across the switch to the amp and back', () => {
  it('closes and reopens without the bridge (the control)', async () => {
    const view = render(<Shell isAmp={false} />);
    mockCapture.log = [];
    await act(async () => view.rerender(<Shell isAmp />));
    expect(mockCapture.log).toEqual(['stop', 'start']);
  });

  it('stays open through the switch both ways with the bridge', async () => {
    const view = render(<BridgedShell isAmp={false} />);
    expect(mockCapture.log).toEqual(['start']);
    mockCapture.log = [];

    await act(async () => view.rerender(<BridgedShell isAmp />));
    expect(mockCapture.log).toEqual([]);
    // Only the amp's own claim is left: the page let go, and so did the bridge.
    expect(mockCapture.claims).toBe(1);

    await act(async () => view.rerender(<BridgedShell isAmp={false} />));
    expect(mockCapture.log).toEqual([]);
    expect(mockCapture.claims).toBe(1);
  });

  it('does not open a capture that nothing had running', async () => {
    mockCapture.isActive = false;
    const idle = render(<BridgedWithoutOwners isAmp={false} />);
    await act(async () => idle.rerender(<BridgedWithoutOwners isAmp />));
    expect(mockCapture.log).toEqual([]);
    expect(mockCapture.claims).toBe(0);

    // The control: the same switch over a running capture is bridged, which
    // with no owner either side shows as the bridge's own claim and release.
    mockCapture.isActive = true;
    await act(async () =>
      idle.rerender(<BridgedWithoutOwners isAmp={false} />),
    );
    expect(mockCapture.log).toEqual(['start', 'stop']);
    expect(mockCapture.claims).toBe(0);
  });
});

/** The bridge with nothing claiming on either side. */
function BridgedWithoutOwners({ isAmp }: { isAmp: boolean }) {
  useCaptureBridge(isAmp ? 'player' : 'app');
  return null;
}
