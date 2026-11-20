/**
 * The Gallery's preview moves to the demo song, silently, only while nothing
 * plays, and goes back to the music the moment there is some
 * (`useQuietDemoAudio`). Music is what the capture hears, never what a
 * player says (2026-11-19): a player reporting that it plays keeps music that
 * was heard through the silence between two songs, and never stands for music
 * on its own.
 */
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  SceneAudioProvider,
  type ISceneAudio,
} from 'renderer/audio/SceneAudioContext';
import useQuietDemoAudio from 'renderer/audio/useQuietDemoAudio';
import { LEVEL_FLOOR_DB } from 'renderer/graph/outputLevel';

const mockControl = { isActive: true, error: '' };
// The output meter's held peak: music at -12 dBFS unless a test says.
const mockMeter = { peakDb: -12 };
jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioControl: () => mockControl,
  // The hook selects the level from the frame store (729751e34), read here
  // from the meter of the render it is in.
  ...jest
    .requireActual<typeof import('../../utils/liveFrameHooks')>(
      '../../utils/liveFrameHooks',
    )
    .liveFrameHooks(() => ({
      outputLevels: [
        {
          levelDb: mockMeter.peakDb,
          peakDb: mockMeter.peakDb,
          isClipping: false,
        },
      ],
    })),
}));

let mockSources: Record<string, { isPlaying: boolean }> = {};
jest.mock('renderer/audio/transportSource', () => ({
  useTransportSources: () => mockSources,
}));

interface IFakeDemo {
  options: unknown;
  points: { x: number; y: number }[];
  waveform: number[];
  readFrame: jest.Mock;
  stop: jest.Mock;
  ready: Promise<undefined>;
  fail(): void;
}
const mockDemos: IFakeDemo[] = [];
jest.mock('renderer/studio/publishDemoAudio', () => ({
  __esModule: true,
  default: (_paused: boolean, options: unknown) => {
    let fail: () => void = () => undefined;
    const ready = new Promise<undefined>((_resolve, reject) => {
      fail = () => reject(new Error('no demo file'));
    });
    const demo: IFakeDemo = {
      options,
      points: [{ x: 20, y: -20 }],
      waveform: [0],
      readFrame: jest.fn(() => ({
        points: [],
        waveform: [],
        sound: undefined,
      })),
      stop: jest.fn(() => Promise.resolve()),
      ready,
      fail: () => fail(),
    };
    mockDemos.push(demo);
    return demo;
  },
}));

const music = (points: number): ISceneAudio => ({
  points: Array.from({ length: points }, (_, i) => ({ x: 20 + i, y: 0 })),
  waveform: [],
  isPaused: false,
  readFrame: () => undefined,
});

const render = (initial: ISceneAudio) => {
  let live = initial;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SceneAudioProvider value={live}>{children}</SceneAudioProvider>
  );
  const hook = renderHook(() => useQuietDemoAudio(), { wrapper });
  return {
    hook,
    hear: (next: ISceneAudio) => {
      live = next;
      hook.rerender();
    },
  };
};

beforeEach(() => {
  mockDemos.length = 0;
  mockSources = {};
  mockControl.isActive = true;
  mockControl.error = '';
  mockMeter.peakDb = -12;
});

it('moves to the demo song, silently, while nothing plays', () => {
  const { hook } = render(music(0));
  expect(mockDemos).toHaveLength(1);
  expect(mockDemos[0].options).toEqual({ audible: false });
  expect(hook.result.current.demo).toBe(true);
  // The demo's own arrays, never empty, so a resting scene is woken.
  expect(hook.result.current.audio.points).toBe(mockDemos[0].points);
  expect(hook.result.current.audio.isPaused).toBe(false);
  hook.result.current.audio.readFrame();
  expect(mockDemos[0].readFrame).toHaveBeenCalled();
});

it('plays the music, and opens no demo, while music is heard', () => {
  const live = music(320);
  const { hook } = render(live);
  expect(mockDemos).toHaveLength(0);
  expect(hook.result.current.demo).toBe(false);
  expect(hook.result.current.audio).toBe(live);
});

it('goes back to the music the moment it is heard, and stops the demo', () => {
  const { hook, hear } = render(music(0));
  expect(hook.result.current.demo).toBe(true);
  const live = music(320);
  hear(live);
  expect(hook.result.current.demo).toBe(false);
  expect(hook.result.current.audio).toBe(live);
  expect(mockDemos[0].stop).toHaveBeenCalled();
});

it('keeps the music through the silence between two songs', () => {
  mockSources = { library: { isPlaying: true } };
  const { hook, hear } = render(music(320));
  expect(hook.result.current.demo).toBe(false);

  // The gap: nothing heard, the meter at its floor, the player still playing.
  mockMeter.peakDb = LEVEL_FLOOR_DB;
  const between = music(0);
  hear(between);
  expect(mockDemos).toHaveLength(0);
  expect(hook.result.current.demo).toBe(false);
  expect(hook.result.current.audio).toBe(between);

  // The control: the same silence once the player has stopped starts the demo.
  mockSources = { library: { isPlaying: false } };
  hear(music(0));
  expect(mockDemos).toHaveLength(1);
  expect(hook.result.current.demo).toBe(true);
});

it('moves to the demo while a player says it plays but nothing was heard', () => {
  // A game in front always says it plays, as a paused browser tab can: it
  // used to keep the scene on silence under a tag that claimed the music.
  mockSources = { game: { isPlaying: true } };
  mockMeter.peakDb = LEVEL_FLOOR_DB;
  const { hook, hear } = render(music(0));
  expect(mockDemos).toHaveLength(1);
  expect(hook.result.current.demo).toBe(true);
  expect(hook.result.current.audio.points).toBe(mockDemos[0].points);

  // The control: music heard under the same player takes the scene at once.
  mockMeter.peakDb = -12;
  const song = music(320);
  hear(song);
  expect(hook.result.current.demo).toBe(false);
  expect(hook.result.current.audio).toBe(song);
});

it('gives the scene to the demo once only a faint sound under the meter is left', () => {
  // Another program idling, or a device's hiss, after the music: the capture
  // still hears something, but the meter shows nothing.
  const { hook, hear } = render(music(320));
  expect(hook.result.current.demo).toBe(false);

  // The control: a whisper just over the meter's floor is still the music.
  mockMeter.peakDb = LEVEL_FLOOR_DB + 1;
  hear(music(4));
  expect(hook.result.current.demo).toBe(false);
  expect(mockDemos).toHaveLength(0);

  mockMeter.peakDb = LEVEL_FLOOR_DB;
  hear(music(4));
  expect(hook.result.current.demo).toBe(true);
  expect(mockDemos).toHaveLength(1);
});

it('opens no demo for a page that is not listening to the music', () => {
  const room = music(0);
  let live = room;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SceneAudioProvider value={live}>{children}</SceneAudioProvider>
  );
  const hook = renderHook(
    ({ listening }: { listening: boolean }) => useQuietDemoAudio(listening),
    { wrapper, initialProps: { listening: false } },
  );
  expect(mockDemos).toHaveLength(0);
  expect(hook.result.current.demo).toBe(false);
  expect(hook.result.current.audio).toBe(room);
  // The control: the same silence, listened to, moves to the demo.
  live = music(0);
  hook.rerender({ listening: true });
  expect(mockDemos).toHaveLength(1);
  expect(hook.result.current.demo).toBe(true);
});

it('holds steady through a sound flickering at the edge of silence', () => {
  // A faint hum, over the capture's floor one frame and under it the next:
  // the demo starts once, stays, and is never stopped and started again.
  const { hook, hear } = render(music(0));
  expect(hook.result.current.demo).toBe(true);
  mockMeter.peakDb = -90;
  [music(4), music(0), music(4), music(0), music(4)].forEach((faint) => {
    hear(faint);
    expect(hook.result.current.demo).toBe(true);
  });
  expect(mockDemos).toHaveLength(1);
  expect(mockDemos[0].stop).not.toHaveBeenCalled();
  // The control: the same sound, plainly music, takes the scene at once.
  mockMeter.peakDb = -12;
  const song = music(320);
  hear(song);
  expect(hook.result.current.demo).toBe(false);
  expect(hook.result.current.audio).toBe(song);
});

it('keeps the music through its quiet passages, and gives way only to silence', () => {
  const { hook, hear } = render(music(320));
  expect(hook.result.current.demo).toBe(false);
  // Quiet, under the level that would have taken the scene back: still music.
  mockMeter.peakDb = -55;
  hear(music(320));
  expect(hook.result.current.demo).toBe(false);
  expect(mockDemos).toHaveLength(0);
  // Silence: the demo.
  hear(music(0));
  expect(hook.result.current.demo).toBe(true);
});

it('waits for the capture to start before deciding', () => {
  mockControl.isActive = false;
  const { hook } = render(music(0));
  expect(mockDemos).toHaveLength(0);
  expect(hook.result.current.demo).toBe(false);
});

it('moves to the demo when the capture has failed', () => {
  mockControl.isActive = false;
  mockControl.error = 'Windows refused the loopback capture';
  const { hook } = render(music(0));
  expect(hook.result.current.demo).toBe(true);
});

it('drops a demo that cannot start, and never claims it', async () => {
  const { hook } = render(music(0));
  expect(hook.result.current.demo).toBe(true);
  await act(async () => {
    mockDemos[0].fail();
    await mockDemos[0].ready.catch(() => undefined);
  });
  expect(hook.result.current.demo).toBe(false);
});

it('stops the demo when the preview goes', () => {
  const { hook } = render(music(0));
  hook.unmount();
  expect(mockDemos[0].stop).toHaveBeenCalled();
});
