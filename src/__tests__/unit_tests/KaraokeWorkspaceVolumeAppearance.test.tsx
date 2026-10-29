/* FluidEQ — GPL-3.0-or-later */
import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {
  SYSTEM_VOLUME_CHANGED,
  SYSTEM_VOLUME_CHANNEL,
} from '../../common/systemVolume';
import { setTransportSlot } from '../../renderer/audio/transportSlot';
import KaraokeWorkspace from '../../renderer/karaoke/KaraokeWorkspace';
import {
  setKaraokeSceneBlur,
  setKaraokeSceneOpacity,
} from '../../renderer/karaoke/karaokeSceneAppearance';
import { createKaraokeAudioClock } from '../../renderer/karaoke/karaokeAudioClock';
import { FakeClockContext, openFakeClock } from '../utils/fakeAudioClock';

jest.mock('../../renderer/audio/LiveAudioContext', () => ({
  ...jest.requireActual('../../renderer/audio/LiveAudioContext'),
  useLiveAudioCapture: jest.fn(),
  useLiveAudioControl: () => ({
    isPaused: false,
    readFrame: () => undefined,
  }),
}));
let mockClock = createKaraokeAudioClock(openFakeClock(new FakeClockContext()));
jest.mock('../../renderer/karaoke/karaokeAudioClock', () => ({
  ...jest.requireActual('../../renderer/karaoke/karaokeAudioClock'),
  useKaraokeAudioClock: () => mockClock,
}));

describe('Karaoke workspace volume and scenery boundaries', () => {
  const originalElectron = window.electron;
  const originalCreateURL = Object.getOwnPropertyDescriptor(
    URL,
    'createObjectURL',
  );
  const originalRevokeURL = Object.getOwnPropertyDescriptor(
    URL,
    'revokeObjectURL',
  );
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const sendMessage = jest.fn();
  let barSlot: HTMLDivElement;

  beforeAll(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:karaoke-regression'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    jest
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => {});
    jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  });
  beforeEach(() => {
    mockClock = createKaraokeAudioClock(openFakeClock(new FakeClockContext()));
    listeners.clear();
    sendMessage.mockClear();
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        platform: 'win32',
        ipcRenderer: {
          getPathForFile: jest.fn(() => ''),
          saveKaraokeSession: jest.fn().mockResolvedValue(undefined),
          restoreKaraokeSession: jest.fn().mockResolvedValue(undefined),
          readKaraokeSessionFile: jest.fn().mockResolvedValue(undefined),
          clearKaraokeSession: jest.fn().mockResolvedValue(undefined),
          loadKaraokeMakerDraft: jest.fn().mockResolvedValue(undefined),
          saveKaraokeMakerDraft: jest.fn().mockResolvedValue(undefined),
          deleteKaraokeMakerDraft: jest.fn().mockResolvedValue(undefined),
          loadKaraokeStems: jest.fn().mockResolvedValue(null),
          saveKaraokeStems: jest.fn().mockResolvedValue(undefined),
          releaseKaraokeSeparationModel: jest.fn(),
          cancelKaraokeSeparation: jest.fn(),
          separateKaraokeVocals: jest.fn(),
          onKaraokeSeparationProgress: jest.fn(() => () => {}),
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
    window.localStorage.clear();
    act(() => {
      setKaraokeSceneOpacity(1);
      setKaraokeSceneBlur(0);
    });
    barSlot = document.createElement('div');
    document.body.append(barSlot);
    setTransportSlot(barSlot);
  });
  afterEach(async () => {
    await act(async () => {
      cleanup();
      setTransportSlot(null);
    });
    barSlot.remove();
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: originalElectron,
    });
  });
  afterAll(() => {
    jest.restoreAllMocks();
    if (originalCreateURL) {
      Object.defineProperty(URL, 'createObjectURL', originalCreateURL);
    } else {
      Reflect.deleteProperty(URL, 'createObjectURL');
    }
    if (originalRevokeURL) {
      Object.defineProperty(URL, 'revokeObjectURL', originalRevokeURL);
    } else {
      Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });

  it('keeps the scene faders off the cover and backing track', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'painted-song.mp3', { type: 'audio/mpeg' }),
            new File(['image'], 'painted-song.jpg', { type: 'image/jpeg' }),
          ],
        },
      },
    );
    await screen.findByRole('heading', { name: 'painted song' });
    const audio = container.querySelector('audio');
    expect(
      container.querySelector('.karaoke-stage-media__still'),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Use current visualizer as background',
      }),
    );
    expect(
      container.querySelector('.karaoke-stage-media__still'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('.karaoke-graph-background'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mix settings' }));
    const mix = within(screen.getByRole('dialog', { name: 'Mix settings' }));
    fireEvent.change(mix.getByRole('slider', { name: 'Blur' }), {
      target: { value: '12' },
    });
    fireEvent.change(mix.getByRole('slider', { name: 'See through' }), {
      target: { value: '75' },
    });
    expect(container.querySelector('.karaoke-backdrop')).toHaveStyle({
      '--karaoke-backdrop-filter': 'blur(12px)',
      '--karaoke-scene-opacity': '0.25',
    });
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Show cover art' }));
    expect(
      container.querySelector('.karaoke-stage-media__still'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.karaoke-graph-background'),
    ).not.toBeInTheDocument();
    expect(container.querySelector('.karaoke-backdrop')).toHaveStyle({
      '--karaoke-backdrop-filter': 'none',
    });
    expect(window.localStorage.getItem('fluideq-karaoke-scene-blur')).toBe(
      '12',
    );
    expect(container.querySelector('audio')).toBe(audio);
    expect(audio?.volume).toBe(1);
  });

  it('uses the system mute without zeroing the master or attenuating the backing element', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [new File(['audio'], 'song.mp3', { type: 'audio/mpeg' })],
        },
      },
    );
    await screen.findByRole('heading', { name: 'song' });
    // The helper is fake; the workspace, transport and system fader are real.
    // This checks wiring, not physical playback or loudness.
    act(() =>
      listeners.get(SYSTEM_VOLUME_CHANGED)?.({ level: 0.6, isMuted: true }),
    );
    const master = screen.getByRole('slider', { name: 'Volume' });
    expect(master).toHaveValue('0.6');
    fireEvent.click(screen.getByRole('button', { name: 'Unmute' }));
    expect(sendMessage).toHaveBeenCalledWith(SYSTEM_VOLUME_CHANNEL, [
      'mute',
      false,
    ]);
    expect(sendMessage).not.toHaveBeenCalledWith(SYSTEM_VOLUME_CHANNEL, [
      'set',
      0,
    ]);
    expect(master).toHaveValue('0.6');
    fireEvent.change(master, { target: { value: '0.35' } });
    expect(sendMessage).toHaveBeenCalledWith(SYSTEM_VOLUME_CHANNEL, [
      'set',
      0.35,
    ]);
    expect(container.querySelector('audio')?.volume).toBe(1);
  });
});
