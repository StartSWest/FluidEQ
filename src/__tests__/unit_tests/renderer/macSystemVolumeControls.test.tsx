/* FluidEQ — GPL-3.0-or-later */
import '@testing-library/jest-dom';
import { randomUUID } from 'crypto';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ISystemVolume } from 'common/systemVolume';
import { SYSTEM_VOLUME_CHANGED } from 'common/systemVolume';
import { useSystemFader } from 'renderer/audio/systemVolume';
import RemoteAudioMix from 'renderer/remoteAudio/RemoteAudioMix';
import { remoteAudioValue } from '../../utils/remoteAudioValue';

const original = window.electron;
const originalUUID = Object.getOwnPropertyDescriptor(
  window.crypto,
  'randomUUID',
);
const listeners = new Map<string, (...args: unknown[]) => void>();
const sendMessage = jest.fn();
beforeEach(() => {
  listeners.clear();
  sendMessage.mockClear();
  Object.defineProperty(window.crypto, 'randomUUID', {
    configurable: true,
    value: randomUUID,
  });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      platform: 'darwin',
      ipcRenderer: {
        sendMessage,
        on: (channel: string, listener: (...args: unknown[]) => void) => {
          listeners.set(channel, listener);
          return () => listeners.delete(channel);
        },
      },
    },
  });
});
afterEach(() => {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: original,
  });
  if (originalUUID) {
    Object.defineProperty(window.crypto, 'randomUUID', originalUUID);
  } else {
    Reflect.deleteProperty(window.crypto, 'randomUUID');
  }
});
const Harness = () => {
  const system = useSystemFader();
  return (
    <>
      <video aria-label="Video playback">
        <track kind="captions" />
      </video>
      <RemoteAudioMix
        remote={remoteAudioValue({ links: [], sending: false })}
        system={system}
      />
    </>
  );
};
const say = (over: Partial<ISystemVolume> = {}) =>
  act(() => {
    listeners.get(SYSTEM_VOLUME_CHANGED)?.({
      level: 1,
      isMuted: false,
      canSetLevel: true,
      canMute: true,
      canAcknowledge: true,
      deviceId: '73',
      sessionId: 'mac-1',
      ...over,
    });
  });
it('keeps This PC bound to the Mac system output with a video mounted and no shared stream', () => {
  const view = render(<Harness />);
  expect(sendMessage).toHaveBeenCalledWith('system-volume', ['watch', true]);
  const fader = screen.getByRole('slider', { name: 'This PC' });
  say();
  expect(fader).toBeEnabled();
  expect(fader).toHaveValue('100');
  say({ level: 0.5 });
  expect(fader).toHaveValue('50');
  say({ level: 0 });
  expect(fader).toBeEnabled();
  expect(fader).toHaveValue('0');
  fireEvent.change(fader, { target: { value: '50' } });
  const requestId = sendMessage.mock.calls.slice(-1)[0]?.[1][2] as string;
  say({ level: 0.1 });
  expect(fader).toHaveValue('50');
  say({ level: 0.499, appliedRequestId: requestId });
  expect(fader).toHaveValue('50');
  say({ level: 0.3, deviceId: '74', sessionId: 'mac-2' });
  expect(fader).toHaveValue('30');
  fireEvent.click(screen.getByRole('button', { name: 'Mute this PC' }));
  expect(fader).toHaveValue('0');
  expect(sendMessage.mock.calls.slice(-1)[0]?.[1].slice(0, 2)).toEqual([
    'mute',
    true,
  ]);
  view.unmount();
});
it('keeps volume available when mute is unsupported, without faking mute', () => {
  const view = render(<Harness />);
  say({ isMuted: undefined, canMute: false });
  expect(screen.getByRole('slider', { name: 'This PC' })).toBeEnabled();
  expect(
    screen.getByRole('button', {
      name: 'System mute unavailable for this output',
    }),
  ).toBeDisabled();
  expect(
    sendMessage.mock.calls.filter(([, args]) => args[0] === 'mute'),
  ).toHaveLength(0);
  view.unmount();
});
it('reports fixed-level outputs truthfully while retaining an independently supported mute', () => {
  const view = render(<Harness />);
  say({ level: undefined, canSetLevel: false });
  expect(screen.getByRole('slider', { name: 'This PC' })).toBeDisabled();
  expect(screen.getByText('System volume unavailable')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Mute this PC' })).toBeEnabled();
  say({
    level: undefined,
    isMuted: undefined,
    canSetLevel: false,
    canMute: false,
  });
  expect(screen.getByRole('slider', { name: 'This PC' })).toBeDisabled();
  expect(
    screen.getByRole('button', {
      name: 'System mute unavailable for this output',
    }),
  ).toBeDisabled();
  view.unmount();
});
