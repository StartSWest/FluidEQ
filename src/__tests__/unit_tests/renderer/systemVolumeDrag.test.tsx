/* FluidEQ — GPL-3.0-or-later */
import '@testing-library/jest-dom';
import { randomUUID } from 'crypto';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useSystemFader } from '../../../renderer/audio/systemVolume';
import { SYSTEM_VOLUME_CHANGED } from '../../../common/systemVolume';

const Fader = ({ name }: { name: string }) => {
  const fader = useSystemFader();
  return (
    <input
      aria-label={name}
      type="range"
      min="0"
      max="1"
      step=".01"
      value={fader.level ?? 0}
      onChange={(event) => fader.setLevel(Number(event.target.value))}
    />
  );
};

it('keeps the Share Audio and bottom-bar faders on the newest drag until its applied result arrives', () => {
  const original = window.electron;
  const originalUUID = Object.getOwnPropertyDescriptor(
    window.crypto,
    'randomUUID',
  );
  Object.defineProperty(window.crypto, 'randomUUID', {
    configurable: true,
    value: randomUUID,
  });
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const sendMessage = jest.fn();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        on: (channel: string, listener: (...args: unknown[]) => void) => {
          listeners.set(channel, listener);
          return () => {
            listeners.delete(channel);
          };
        },
        sendMessage,
      },
    },
  });
  const view = render(
    <>
      <Fader name="Share Audio" />
      <Fader name="Bottom bar" />
    </>,
  );
  const say = (
    level: number,
    appliedRequestId?: string,
    sessionId = 'native-1',
  ) =>
    act(() => {
      listeners.get(SYSTEM_VOLUME_CHANGED)?.({
        level,
        isMuted: false,
        canAcknowledge: true,
        sessionId,
        appliedRequestId,
      });
    });
  try {
    say(0.5);
    fireEvent.change(screen.getByLabelText('Share Audio'), {
      target: { value: '.8' },
    });
    const first: string =
      sendMessage.mock.calls[sendMessage.mock.calls.length - 1][1][2];
    fireEvent.change(screen.getByLabelText('Share Audio'), {
      target: { value: '.9' },
    });
    const latest: string =
      sendMessage.mock.calls[sendMessage.mock.calls.length - 1][1][2];
    say(0.5);
    say(0.8, first);
    expect(screen.getByLabelText('Share Audio')).toHaveValue('0.9');
    expect(screen.getByLabelText('Bottom bar')).toHaveValue('0.9');
    say(0.89, latest);
    expect(screen.getByLabelText('Bottom bar')).toHaveValue('0.89');
    say(0.6);
    expect(screen.getByLabelText('Share Audio')).toHaveValue('0.6');
    fireEvent.change(screen.getByLabelText('Bottom bar'), {
      target: { value: '.7' },
    });
    say(0.3, undefined, 'replacement-helper');
    expect(screen.getByLabelText('Share Audio')).toHaveValue('0.3');
  } finally {
    view.unmount();
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: original,
    });
    if (originalUUID) {
      Object.defineProperty(window.crypto, 'randomUUID', originalUUID);
    } else {
      Reflect.deleteProperty(window.crypto, 'randomUUID');
    }
  }
});
