/**
 * The Gallery's preview moves to the demo song, silently, only while nothing
 * plays, and goes back to the music the moment there is some
 * (`useQuietDemoAudio`). Quiet is a state - nothing heard AND no player
 * playing - so the silence between two songs keeps the music.
 */
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  SceneAudioProvider,
  type ISceneAudio,
} from 'renderer/audio/SceneAudioContext';
import useQuietDemoAudio from 'renderer/audio/useQuietDemoAudio';

const mockControl = { isActive: true, error: '' };
// The output meter's held peak: music at -12 dBFS unless a test says.
const mockMeter = { peakDb: -12 };
jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioControl: () => mockControl,
  useLiveAudioFrame: () => ({
    outputLevels: [
      {
        levelDb: mockMeter.peakDb,
        peakDb: mockMeter.peakDb,
        isClipping: false,
      },
    ],
  }),
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
  // The control: the same silence with no player playing starts the demo.
  const control = render(music(0));
  expect(control.hook.result.current.demo).toBe(true);
  control.hook.unmount();
  mockDemos.length = 0;

  mockSources = { library: { isPlaying: true } };
  const between = music(0);
  const { hook } = render(between);
  expect(mockDemos).toHaveLength(0);
  expect(hook.result.current.demo).toBe(false);
  expect(hook.result.current.audio).toBe(between);
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
