/**
 * The Studio's stage moves to the demo song, unheard, while nothing plays
 * under the signals that listen to the music - Your music, and Bass, Mids and
 * Treble, which hear their part of it - and says so on the stage
 * (`StudioStageSound`). A made-up signal keeps no demo: Silence stays
 * silence.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import {
  SceneAudioProvider,
  type ISceneAudio,
} from '../../../renderer/audio/SceneAudioContext';
import StudioStageSound from '../../../renderer/studio/StudioStageSound';
import type { TStudioSignal } from '../../../renderer/studio/studioSignals';

const mockControl = { isActive: true, error: '' };
jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
  useLiveAudioControl: () => mockControl,
  useLiveAudioFrame: () => ({
    outputLevels: [{ levelDb: -12, peakDb: -12, isClipping: false }],
  }),
}));
jest.mock('../../../renderer/audio/transportSource', () => ({
  useTransportSources: () => ({}),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

interface IFakeDemo {
  points: { x: number; y: number }[];
  waveform: number[];
  readFrame: jest.Mock;
  stop: jest.Mock;
  ready: Promise<undefined>;
}
const mockDemos: IFakeDemo[] = [];
jest.mock('../../../renderer/studio/publishDemoAudio', () => ({
  __esModule: true,
  default: () => {
    const demo: IFakeDemo = {
      points: [{ x: 20, y: -20 }],
      waveform: [0],
      readFrame: jest.fn(() => ({
        points: [],
        waveform: [],
        sound: undefined,
      })),
      stop: jest.fn(() => Promise.resolve()),
      // Started, as far as the stage can tell: it never settles here.
      ready: Promise.race<undefined>([]),
    };
    mockDemos.push(demo);
    return demo;
  },
}));

// What the stage's scene hears, as the runner reads it at each render.
const mockHeard: ISceneAudio[] = [];
jest.mock('../../../renderer/graph/useSceneRunner', () => ({
  __esModule: true,
  default: function useHeardSceneRunner() {
    const { useSceneAudio } = jest.requireActual(
      '../../../renderer/audio/SceneAudioContext',
    );
    mockHeard.push(useSceneAudio());
    return { current: null };
  },
}));

const music = (points: number): ISceneAudio => ({
  points: Array.from({ length: points }, (_, i) => ({ x: 20 + i, y: 0 })),
  waveform: [],
  isPaused: false,
  readFrame: () => undefined,
});

const stage = (signal: TStudioSignal) => (
  <StudioStageSound
    identity="one"
    pack={{ names: { en: 'Alpine' } } as IScenePack}
    serial={1}
    signal={signal}
    size="graph"
    preview="stage"
    wave={{ height: 1, position: 0 }}
    isGridShown={false}
    readingRef={{ current: null }}
    onTrouble={jest.fn()}
    onDrawn={jest.fn()}
    onExitFullscreen={jest.fn()}
    onToggleFullscreen={jest.fn()}
  />
);

const show = (signal: TStudioSignal, live: ISceneAudio) => {
  const view = render(
    <SceneAudioProvider value={live}>{stage(signal)}</SceneAudioProvider>,
  );
  return {
    ...view,
    choose: (next: TStudioSignal) =>
      view.rerender(
        <SceneAudioProvider value={live}>{stage(next)}</SceneAudioProvider>,
      ),
  };
};

const heardNow = () => mockHeard[mockHeard.length - 1];

beforeEach(() => {
  mockDemos.length = 0;
  mockHeard.length = 0;
});

it('moves Your music to the demo song while nothing plays, and says so on the stage', () => {
  show('live', music(0));
  expect(mockDemos).toHaveLength(1);
  expect(screen.getByText('studio.stage.demoSong')).toHaveAttribute(
    'role',
    'status',
  );
  // The scene hears the demo's measurements, not the silent room.
  heardNow().readFrame();
  expect(mockDemos[0].readFrame).toHaveBeenCalled();
});

it.each<TStudioSignal>(['bass', 'mid', 'treble'])(
  'lets %s hear its part of the same demo song',
  (signal) => {
    show(signal, music(0));
    expect(mockDemos).toHaveLength(1);
    expect(screen.getByText('studio.stage.demoSong')).toBeInTheDocument();
  },
);

it.each<TStudioSignal>(['silence', 'beat', 'accent', 'showcase'])(
  'keeps no demo under %s, the made-up signal hearing nothing beneath it',
  (signal) => {
    const room = music(0);
    show(signal, room);
    expect(mockDemos).toHaveLength(0);
    expect(screen.queryByText('studio.stage.demoSong')).toBeNull();
    expect(heardNow()).toBe(room);
  },
);

it('stops the demo the moment a made-up signal is chosen', () => {
  const view = show('live', music(0));
  expect(screen.getByText('studio.stage.demoSong')).toBeInTheDocument();
  view.choose('silence');
  expect(mockDemos[0].stop).toHaveBeenCalled();
  expect(screen.queryByText('studio.stage.demoSong')).toBeNull();
});

it('plays the music heard, with no demo and nothing said', () => {
  const live = music(320);
  show('live', live);
  expect(mockDemos).toHaveLength(0);
  expect(screen.queryByText('studio.stage.demoSong')).toBeNull();
  expect(heardNow()).toBe(live);
});
