/* FluidEQ — GPL-3.0-or-later */
import '@testing-library/jest-dom';
import { randomUUID } from 'crypto';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { translate, type TranslationKey } from '../../../common/i18n';
import { SYSTEM_VOLUME_CHANGED } from '../../../common/systemVolume';
import { useSystemFader } from '../../../renderer/audio/systemVolume';
import PlayerVolume from '../../../renderer/player/PlayerVolume';
import RemoteAudioMix from '../../../renderer/remoteAudio/RemoteAudioMix';
import { remoteAudioValue } from '../../utils/remoteAudioValue';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: TranslationKey) => translate('en', key) }),
}));

const Mix = () => (
  <RemoteAudioMix remote={remoteAudioValue()} system={useSystemFader()} />
);
const listeners = new Map<string, (...args: unknown[]) => void>();
const sendMessage = jest.fn();
const original = window.electron;
const originalUUID = Object.getOwnPropertyDescriptor(
  window.crypto,
  'randomUUID',
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
const latest = (): string =>
  sendMessage.mock.calls[sendMessage.mock.calls.length - 1][1][2];
const slider = () =>
  screen.getByRole('slider', { name: translate('en', 'player.volume.system') });
const expectVolumes = (thumb: number, confirmed: number) => {
  expect(slider()).toHaveValue(String(thumb));
  expect(screen.getByRole('slider', { name: 'This PC' })).toHaveValue(
    String(thumb),
  );
  expect(document.querySelector('.player-volume__value')).toHaveTextContent(
    `${confirmed}%`,
  );
  expect(
    document.querySelector('.remote-audio__lane-level-value'),
  ).toHaveTextContent(`${confirmed}%`);
};

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
  render(
    <>
      <PlayerVolume />
      <Mix />
    </>,
  );
  say(0.5);
});

afterEach(() => {
  cleanup();
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

it('shows only confirmed percentages and never pulls a held thumb backwards on quantized replies', () => {
  expect.hasAssertions();
  fireEvent.pointerDown(slider());
  fireEvent.change(slider(), { target: { value: '80' } });
  const first = latest();
  expectVolumes(80, 50);
  fireEvent.change(slider(), { target: { value: '81' } });
  const last = latest();
  say(0.79, first);
  expectVolumes(81, 50);
  say(0.8, last);
  expectVolumes(81, 80);
  fireEvent.pointerUp(window);
  expectVolumes(80, 80);
  say(0.6);
  expectVolumes(60, 60);
});

it('waits for the last applied result when the pointer is released before Windows answers', () => {
  expect.hasAssertions();
  fireEvent.pointerDown(slider());
  fireEvent.change(slider(), { target: { value: '90' } });
  const request = latest();
  fireEvent.pointerUp(window);
  expectVolumes(90, 50);
  say(0.89, request);
  expectVolumes(89, 89);
});

it('holds keyboard changes until the volume key is released', () => {
  expect.hasAssertions();
  fireEvent.keyDown(slider(), { key: 'ArrowRight' });
  fireEvent.change(slider(), { target: { value: '80' } });
  say(0.79, latest());
  expectVolumes(80, 79);
  fireEvent.keyUp(window, { key: 'ArrowRight' });
  expectVolumes(79, 79);
});

it.each(['pointercancel', 'blur'])(
  'finishes a gesture on window %s',
  (type) => {
    expect.hasAssertions();
    fireEvent.pointerDown(slider());
    fireEvent.change(slider(), { target: { value: '80' } });
    say(0.79, latest());
    expectVolumes(80, 79);
    fireEvent(window, new Event(type));
    expectVolumes(79, 79);
  },
);

it('drops the old gesture when the helper or output is replaced', () => {
  expect.hasAssertions();
  fireEvent.pointerDown(slider());
  fireEvent.change(slider(), { target: { value: '80' } });
  say(0.3, undefined, 'replacement');
  expectVolumes(30, 30);
  fireEvent.pointerUp(window);
  expectVolumes(30, 30);
});
