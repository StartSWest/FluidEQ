/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import '@testing-library/jest-dom';
import { StrictMode } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import KaraokeMicrophone from '../../renderer/karaoke/KaraokeMicrophone';

const mediaDevice = (
  kind: MediaDeviceKind,
  deviceId: string,
  label: string,
): MediaDeviceInfo =>
  ({
    kind,
    deviceId,
    label,
    groupId: '',
    toJSON: () => ({}),
  }) as MediaDeviceInfo;

const microphoneStream = () => {
  const listeners = new Map<string, EventListener>();
  const track = {
    stop: jest.fn(),
    addEventListener: jest.fn((type: string, listener: EventListener) => {
      listeners.set(type, listener);
    }),
    removeEventListener: jest.fn((type: string) => listeners.delete(type)),
  } as unknown as MediaStreamTrack;
  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, track, listeners };
};

const installMediaDevices = (
  getUserMedia: jest.Mock<Promise<MediaStream>, [MediaStreamConstraints]>,
) => {
  const devices = [
    mediaDevice('audioinput', 'default', 'Windows default microphone'),
    mediaDevice('audioinput', 'usb-studio', 'Studio USB Mic'),
    mediaDevice('audiooutput', 'speakers', 'Speakers'),
  ];
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices: jest.fn(async () => devices),
      getUserMedia,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
  });
};

describe('KaraokeMicrophone', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('selects and remembers an input without opening it until asked', async () => {
    const { stream, track } = microphoneStream();
    const getUserMedia = jest.fn<
      Promise<MediaStream>,
      [MediaStreamConstraints]
    >(async () => stream);
    installMediaDevices(getUserMedia);
    const { rerender } = render(<KaraokeMicrophone isActive />);

    const selector = await screen.findByRole('menu', {
      name: 'Microphone input',
    });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(selector.lastElementChild).toHaveClass('arrow');
    expect(getUserMedia).not.toHaveBeenCalled();

    fireEvent.click(selector);
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Studio USB Mic' }),
    );
    expect(window.localStorage.getItem('fluideq.karaoke.microphoneId')).toBe(
      'usb-studio',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Turn on mic' }));

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: {
        deviceId: { exact: 'usb-studio' },
        autoGainControl: false,
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
      },
      video: false,
    });
    expect(
      await screen.findByRole('button', { name: 'Turn off mic' }),
    ).toHaveAttribute('aria-pressed', 'true');

    rerender(<KaraokeMicrophone isActive={false} />);
    await waitFor(() => expect(track.stop).toHaveBeenCalledTimes(1));
    // Returning to the tab never reopens a mic without another user action.
    rerender(<KaraokeMicrophone isActive />);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Turn on mic' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('reports a denied request and keeps the retry action available', async () => {
    const getUserMedia = jest.fn<
      Promise<MediaStream>,
      [MediaStreamConstraints]
    >(async () => {
      throw new DOMException('denied', 'NotAllowedError');
    });
    installMediaDevices(getUserMedia);
    render(<KaraokeMicrophone isActive />);

    fireEvent.click(await screen.findByRole('button', { name: 'Turn on mic' }));

    expect(await screen.findByText('Permission denied')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Turn on mic' })).toBeEnabled();
  });

  it('keeps the mic switch alive when React replays effect setup', async () => {
    const active = microphoneStream();
    const getUserMedia = jest.fn<
      Promise<MediaStream>,
      [MediaStreamConstraints]
    >(async () => active.stream);
    installMediaDevices(getUserMedia);

    render(
      <StrictMode>
        <KaraokeMicrophone isActive />
      </StrictMode>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Turn on mic' }));

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByRole('button', { name: 'Turn off mic' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('stores microphone volume without enabling speaker monitoring', async () => {
    const active = microphoneStream();
    const getUserMedia = jest.fn<
      Promise<MediaStream>,
      [MediaStreamConstraints]
    >(async () => active.stream);
    installMediaDevices(getUserMedia);
    render(<KaraokeMicrophone isActive />);

    const volume = await screen.findByRole('slider', { name: 'Mic volume' });
    expect(volume).toHaveValue('100');
    fireEvent.change(volume, { target: { value: '145' } });

    expect(volume).toHaveValue('145');
    expect(window.localStorage.getItem('fluideq.karaoke.microphoneGain')).toBe(
      '1.45',
    );
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('switches a live microphone and releases the old track', async () => {
    const first = microphoneStream();
    const second = microphoneStream();
    const getUserMedia = jest
      .fn<Promise<MediaStream>, [MediaStreamConstraints]>()
      .mockResolvedValueOnce(first.stream)
      .mockResolvedValueOnce(second.stream);
    installMediaDevices(getUserMedia);
    render(<KaraokeMicrophone isActive />);

    fireEvent.click(await screen.findByRole('button', { name: 'Turn on mic' }));
    await screen.findByRole('button', { name: 'Turn off mic' });
    fireEvent.click(screen.getByRole('menu', { name: 'Microphone input' }));
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Studio USB Mic' }),
    );

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(first.track.stop).toHaveBeenCalledTimes(1);
    expect(getUserMedia.mock.calls[1][0]).toMatchObject({
      audio: { deviceId: { exact: 'usb-studio' } },
    });
  });

  it('reports a microphone that is unplugged while live', async () => {
    const active = microphoneStream();
    const getUserMedia = jest.fn<
      Promise<MediaStream>,
      [MediaStreamConstraints]
    >(async () => active.stream);
    installMediaDevices(getUserMedia);
    render(<KaraokeMicrophone isActive />);

    fireEvent.click(await screen.findByRole('button', { name: 'Turn on mic' }));
    await screen.findByRole('button', { name: 'Turn off mic' });
    act(() => active.listeners.get('ended')?.(new Event('ended')));

    expect(await screen.findByText('Disconnected')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Turn on mic' })).toBeEnabled();
  });
});
