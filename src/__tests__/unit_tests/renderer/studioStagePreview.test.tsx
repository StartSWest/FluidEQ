/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio stage showing a scene as the ultra-wide graph and as the
 * Compact player (Ivan, 2026-11-09). What matters is what the scene is
 * handed and what stands over it: the player's column frames the scene to
 * the player's top panel, with the player's parts over it only when asked
 * ("don't show the amp", "allow user to select if just the frame and if
 * with amp ui on top"), and the player draws no grid; the ultra-wide graph
 * is a window of its own shape that keeps the grid. Each case beside the
 * stage itself as its control.
 */

import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import {
  SPECTRUM_TEXELS,
  WAVEFORM_TEXELS,
} from '../../../common/sceneUniformContract';
import PlayerPicture from '../../../renderer/components/featureTour/PlayerPicture';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import useSceneRunner from '../../../renderer/graph/useSceneRunner';
import StudioStage from '../../../renderer/studio/StudioStage';
import {
  PLAYER_PANEL_VIEW,
  stageScreen,
  type TStagePreview,
} from '../../../renderer/studio/studioStageScreen';

jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
  useLiveAudioControl: () => ({ claim: () => undefined, capture: undefined }),
}));
jest.mock('../../../renderer/audio/SceneAudioContext', () => ({
  useSceneAudio: () => ({
    points: [],
    waveform: [],
    isPaused: false,
    readFrame: () => undefined,
  }),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../renderer/graph/useSceneRunner', () => ({
  __esModule: true,
  default: jest.fn(() => ({ current: null })),
}));

const runner = jest.mocked(useSceneRunner);
const pack = { names: { en: 'Alpine' }, params: [] } as unknown as IScenePack;
const wave = { height: 1, position: 0 };
const WIDTH = 1200;
const HEIGHT = 480;

let observers: Array<() => void> = [];

beforeEach(() => {
  jest.clearAllMocks();
  observers = [];
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: WIDTH,
    height: HEIGHT,
    top: 0,
    left: 0,
    right: WIDTH,
    bottom: HEIGHT,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  Object.assign(globalThis, {
    ResizeObserver: class {
      private readonly changed: () => void;

      constructor(changed: () => void) {
        this.changed = changed;
      }

      observe() {
        observers.push(this.changed);
      }

      disconnect() {
        observers = observers.filter((changed) => changed !== this.changed);
      }

      unobserve() {
        this.disconnect();
      }
    },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const stage = (
  preview: TStagePreview,
  { isGridShown = false, hasPlayerParts = false } = {},
) => (
  <StudioStage
    identity="one"
    pack={pack}
    serial={1}
    signal="live"
    demo={false}
    size="graph"
    preview={preview}
    motion="music"
    onToggleMotion={jest.fn()}
    hasPlayerParts={hasPlayerParts}
    wave={wave}
    isGridShown={isGridShown}
    readingRef={{ current: null }}
    onTrouble={jest.fn()}
    onDrawn={jest.fn()}
    onExitFullscreen={jest.fn()}
    onToggleFullscreen={jest.fn()}
    labels={<span data-testid="labels" />}
  />
);

const measured = () =>
  act(() => {
    observers.forEach((changed) => changed());
  });

const lastOptions = () => runner.mock.calls[runner.mock.calls.length - 1][0];

/** What the scene is handed for one frame of the live signal. */
const shaped = (): ISceneFrame => {
  const { shapeFrame } = lastOptions();
  const frame: ISceneFrame = {
    timeSeconds: 12,
    deltaMs: 1000 / 60,
    level: 0.5,
    beat: 0.4,
    bands: [0.6, 0.4, 0.2],
    musicAccent: [0, 0],
    musicRun: [0, 0],
    accent: [0, 0.9, 0.8],
    fade: 1,
    spectrum: new Uint8Array(SPECTRUM_TEXELS).fill(120),
    waveform: new Uint8Array(WAVEFORM_TEXELS).fill(128),
    params: {},
  };
  if (!shapeFrame) {
    throw new Error('the stage hands the runner no frame shaper');
  }
  return shapeFrame(frame);
};

const screenOf = (container: HTMLElement) => {
  const element = container.querySelector<HTMLElement>('.studio-stage__screen');
  if (!element) {
    throw new Error('no screen on the stage');
  }
  return element;
};

describe('the Compact player on the Studio stage', () => {
  it('frames the scene to the player’s top panel, where the stage frames it whole', () => {
    render(stage('player'));
    measured();
    expect(shaped().view).toEqual(PLAYER_PANEL_VIEW);
  });

  it('control: the stage itself hands the scene its frame untouched', () => {
    render(stage('stage'));
    measured();
    expect(shaped().view).toBeUndefined();
  });

  it('stands as a window of the player’s shape, sized to the stage', () => {
    const { container } = render(stage('player'));
    measured();
    const expected = stageScreen(
      { width: WIDTH, height: HEIGHT },
      'player',
      undefined,
    );
    const screen = screenOf(container);
    expect(screen).toHaveClass('studio-stage__screen--window');
    expect(screen.style.width).toBe(`${expected.width}px`);
    expect(screen.style.height).toBe(`${expected.height}px`);
    expect(screen.style.left).toBe(`${expected.left}px`);
    expect(screen.style.top).toBe(`${expected.top}px`);
    // The scene is drawn at the window's size, not the stage's.
    expect(lastOptions().width).toBe(expected.width);
    expect(lastOptions().height).toBe(expected.height);
  });

  it('shows the frame alone until the player’s parts are asked for', () => {
    const { container, rerender } = render(stage('player'));
    measured();
    expect(container.querySelector('.studio-stage__player')).toBeNull();

    rerender(stage('player', { hasPlayerParts: true }));
    const parts = container.querySelector('.studio-stage__player');
    expect(parts).not.toBeNull();
    // The whole player, as Help draws it, over the scene and out of reach.
    expect(parts?.querySelector('.player-picture .mini-player')).not.toBeNull();
    expect(parts).toHaveAttribute('inert');
    expect(parts).toHaveAttribute('aria-hidden', 'true');
    // Nothing of its own behind it: the stage's scene is.
    expect(parts?.querySelector('.player-picture__still')).toBeNull();
    // The framing does not move when the parts come and go.
    expect(shaped().view).toEqual(PLAYER_PANEL_VIEW);
  });

  it('lays no parts over a shape that is not the player', () => {
    const { container } = render(stage('ultraWide', { hasPlayerParts: true }));
    measured();
    expect(container.querySelector('.studio-stage__player')).toBeNull();
  });

  it('draws no grid over the player, and no starter labels', () => {
    const { container, queryByTestId } = render(
      stage('player', { isGridShown: true }),
    );
    measured();
    expect(container.querySelector('.studio-paper')).toBeNull();
    expect(queryByTestId('labels')).toBeNull();
  });
});

describe('the ultra-wide graph on the Studio stage', () => {
  it('stands as a window of its shape, with the grid and the labels on it', () => {
    const { container, getByTestId } = render(
      stage('ultraWide', { isGridShown: true }),
    );
    measured();
    const expected = stageScreen(
      { width: WIDTH, height: HEIGHT },
      'ultraWide',
      undefined,
    );
    const screen = screenOf(container);
    expect(screen).toHaveClass('studio-stage__screen--window');
    expect(screen.style.width).toBe(`${expected.width}px`);
    expect(screen.style.height).toBe(`${expected.height}px`);
    expect(container.querySelector('.studio-paper')).not.toBeNull();
    expect(getByTestId('labels')).toBeInTheDocument();
    // Framed whole, as the graph frames a scene.
    expect(shaped().view).toBeUndefined();
  });

  it('control: the stage itself is no window', () => {
    const { container } = render(stage('stage'));
    measured();
    const screen = screenOf(container);
    expect(screen).not.toHaveClass('studio-stage__screen--window');
    expect(screen.getAttribute('style')).toBeNull();
  });
});

describe('the player picture’s backdrop', () => {
  it('stands the aurora behind the player unless told to stand nothing', () => {
    const { container, rerender } = render(
      <PlayerPicture picture="scene" zoom={1} />,
    );
    // POSITIVE CONTROL: Help and What's New keep their still.
    expect(container.querySelector('.player-picture__still')).not.toBeNull();
    rerender(<PlayerPicture picture="scene" zoom={1} still={null} />);
    expect(container.querySelector('.player-picture__still')).toBeNull();
    expect(container.querySelector('.player-stage.has-scene')).not.toBeNull();
  });
});
