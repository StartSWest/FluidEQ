/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { render, screen } from '@testing-library/react';
import RemoteAudioMonitor from '../../../renderer/remoteAudio/RemoteAudioMonitor';

describe('remote audio connection monitor', () => {
  beforeEach(() => {
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
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
        status="2 computers connected"
        subscribe={() => () => undefined}
      />,
    );

    expect(screen.getByText('STUDIO-PC')).toBeTruthy();
    expect(screen.getByText('192.168.1.21')).toBeTruthy();
    expect(screen.getByText('GAME-PC')).toBeTruthy();
    expect(screen.getByText('192.168.1.34')).toBeTruthy();
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
        status="1 computer connected"
        subscribe={() => () => undefined}
      />,
    );

    expect(
      container.querySelector('.remote-audio__monitor-lane.is-primary'),
    ).toBeTruthy();

    rerender(
      <RemoteAudioMonitor
        active
        connectedComputers={[]}
        mode="sender"
        status="Sending lossless audio"
        subscribe={() => () => undefined}
      />,
    );

    expect(
      container.querySelector('.remote-audio__monitor-lane.is-primary'),
    ).toBeTruthy();
  });
});
