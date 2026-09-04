/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, render, screen } from '@testing-library/react';
import RemoteAudioMonitor from '../../../renderer/remoteAudio/RemoteAudioMonitor';

describe('remote audio connection monitor', () => {
  beforeEach(() => {
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      beginPath: jest.fn(),
      clearRect: jest.fn(),
      closePath: jest.fn(),
      fill: jest.fn(),
      lineTo: jest.fn(),
      moveTo: jest.fn(),
      restore: jest.fn(),
      save: jest.fn(),
      stroke: jest.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows every source computer in its own waveform lane', () => {
    const { container } = render(
      <RemoteAudioMonitor
        active
        connectedComputers={[
          { address: '192.168.1.21', id: 'alpha', name: 'STUDIO-PC' },
          { address: '192.168.1.34', id: 'beta', name: 'GAME-PC' },
        ]}
        mode="listener"
        networkStats={[
          {
            bytesPerSecond: 350_000,
            direction: 'receive',
            peerId: 'alpha',
            queuedBytes: 0,
            queuedMilliseconds: 0,
          },
        ]}
        status="2 computers connected"
        subscribe={() => () => undefined}
      />,
    );

    expect(screen.getByText('STUDIO-PC')).toBeTruthy();
    expect(screen.getByText('192.168.1.21')).toBeTruthy();
    expect(screen.getByText('GAME-PC')).toBeTruthy();
    expect(screen.getByText('192.168.1.34')).toBeTruthy();
    expect(screen.getByText('2.80 Mb/s LAN')).toBeTruthy();
    expect(
      container.querySelector(
        '.remote-audio__network-health:not(.is-unavailable)',
      )?.textContent,
    ).toBe('Network clear');
    expect(
      screen.getByLabelText('Live audio waveform for STUDIO-PC'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Live audio waveform for GAME-PC'),
    ).toBeTruthy();
    expect(
      container.querySelectorAll('.remote-audio__monitor-lane'),
    ).toHaveLength(2);
  });

  it('uses the same primary graph treatment for one receiver or sender lane', () => {
    const { container, rerender } = render(
      <RemoteAudioMonitor
        active
        connectedComputers={[
          { address: '192.168.1.21', id: 'alpha', name: 'STUDIO-PC' },
        ]}
        mode="listener"
        networkStats={[]}
        status="1 computer connected"
        subscribe={() => () => undefined}
      />,
    );

    expect(
      container.querySelector('.remote-audio__monitor-lane.is-primary'),
    ).toBeTruthy();
    expect(
      container.querySelectorAll('.remote-audio__monitor-readouts > span'),
    ).toHaveLength(4);

    rerender(
      <RemoteAudioMonitor
        active
        connectedComputers={[]}
        mode="sender"
        networkStats={[]}
        status="Sending lossless audio"
        subscribe={() => () => undefined}
      />,
    );

    expect(
      container.querySelector('.remote-audio__monitor-lane.is-primary'),
    ).toBeTruthy();
  });

  it('shows the sender compression and socket queue in the buffer slot', () => {
    let paint: FrameRequestCallback | undefined;
    jest.mocked(window.requestAnimationFrame).mockImplementation((callback) => {
      paint = callback;
      return 1;
    });
    render(
      <RemoteAudioMonitor
        active
        connectedComputers={[]}
        mode="sender"
        networkStats={[
          {
            bytesPerSecond: 390_000,
            direction: 'send',
            peerId: 'receiver',
            queuedBytes: 0,
            queuedMilliseconds: 37,
          },
        ]}
        status="Sending lossless audio"
        subscribe={() => () => undefined}
      />,
    );

    act(() => paint?.(0));

    expect(screen.getByText('Send queue 37 ms')).toBeTruthy();
  });
});
