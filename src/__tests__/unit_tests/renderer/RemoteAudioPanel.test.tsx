/* FluidEQ — GPL-3.0-or-later */

import { fireEvent, render, screen } from '@testing-library/react';
import RemoteAudioPanel from '../../../renderer/remoteAudio/RemoteAudioPanel';
import type { IRemoteAudioValue } from '../../../renderer/remoteAudio/remoteAudioState';
import RemoteAudioContext from '../../../renderer/remoteAudio/remoteAudioValueContext';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
jest.mock('../../../renderer/remoteAudio/RemoteAudioMonitor', () => ({
  __esModule: true,
  default: () => <div data-testid="remote-audio-monitor" />,
}));

const remoteValue = (role?: 'listener' | 'sender'): IRemoteAudioValue => ({
  connectedComputers: [],
  connectedCount: 0,
  lanOptions: [],
  networkStats: [],
  phase: 'idle',
  resumePlayback: jest.fn(),
  role,
  setStreamMode: jest.fn(),
  startListening: jest.fn(),
  startSending: jest.fn(),
  stop: jest.fn(),
  streamMode: 'music',
  subscribeMeter: jest.fn(() => jest.fn()),
});

const renderPanel = (remote: IRemoteAudioValue) =>
  render(
    <RemoteAudioContext.Provider value={remote}>
      <RemoteAudioPanel />
    </RemoteAudioContext.Provider>,
  );

describe('Share Audio role tabs', () => {
  beforeEach(() => {
    Object.assign(window, {
      electron: {
        ipcRenderer: {
          getSavedRemoteAudioLanSenderCode: jest
            .fn()
            .mockResolvedValue(undefined),
        },
      },
    });
  });

  it('selects Listen by default without starting the listener', () => {
    const remote = remoteValue();
    renderPanel(remote);

    const radios = screen.getAllByRole('radio');
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
    expect(radios[1].getAttribute('aria-checked')).toBe('false');
    expect(remote.startListening).not.toHaveBeenCalled();
  });

  it('changes role tabs without starting either connection', () => {
    const remote = remoteValue();
    renderPanel(remote);
    const radios = screen.getAllByRole('radio');

    fireEvent.click(radios[1]);
    fireEvent.click(radios[0]);

    expect(remote.startListening).not.toHaveBeenCalled();
    expect(remote.startSending).not.toHaveBeenCalled();
  });

  it('selects the role that is already active', () => {
    renderPanel(remoteValue('sender'));

    const radios = screen.getAllByRole('radio');
    expect(radios[0].getAttribute('aria-checked')).toBe('false');
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
  });

  it('keeps an active connection running while browsing the other role', () => {
    const remote = remoteValue('listener');
    renderPanel(remote);

    fireEvent.click(screen.getAllByRole('radio')[1]);

    // Read the attribute rather than matching it: this file registers no
    // jest-dom matchers of its own, so `toHaveAttribute` was there or not
    // depending on which worker had already loaded them — the suite passed or
    // failed on run order.
    expect(screen.getAllByRole('radio')[1].getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(remote.stop).not.toHaveBeenCalled();
    expect(remote.startListening).not.toHaveBeenCalled();
    expect(remote.startSending).not.toHaveBeenCalled();
  });
});
