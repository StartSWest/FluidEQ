/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Calm on the Studio stage (Ivan, 2026-11-09: "if I click change to calm
 * that's what I want so user can check both calmed and music mode on any
 * music mode, demo or real"). The stage's scene hears the desktop's own calm
 * motion while Calm is on, whatever the stage hears otherwise — the music,
 * the demo song or a test signal — in every shape it is shown as; the switch
 * eases across on the same scene; and the plate's first button says which
 * is on and swaps them. Each case beside the music as its control.
 */

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import type { TWallpaperMotion } from '../../../common/wallpaper';
import type { IScenePack } from '../../../common/scenePacks';
import {
  SPECTRUM_TEXELS,
  WAVEFORM_TEXELS,
} from '../../../common/sceneUniformContract';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import useSceneRunner from '../../../renderer/graph/useSceneRunner';
import StudioStage from '../../../renderer/studio/StudioStage';
import StudioStageMotion from '../../../renderer/studio/StudioStageMotion';
import { useStageMotion } from '../../../renderer/studio/stageMotion';
import type { TStudioSignal } from '../../../renderer/studio/studioSignals';
import {
  PLAYER_PANEL_VIEW,
  type TStagePreview,
} from '../../../renderer/studio/studioStageScreen';
import { calmBands } from '../../../renderer/wallpaper/calmMotion';

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
const SECONDS = 12;

let observers: Array<() => void> = [];

beforeEach(() => {
  jest.clearAllMocks();
  observers = [];
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 1200,
    height: 480,
    top: 0,
    left: 0,
    right: 1200,
    bottom: 480,
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

const stage = ({
  motion,
  preview = 'stage',
  signal = 'live',
}: {
  motion: TWallpaperMotion;
  preview?: TStagePreview;
  signal?: TStudioSignal;
}) => (
  <StudioStage
    identity="one"
    pack={pack}
    serial={1}
    signal={signal}
    demo={false}
    size="graph"
    preview={preview}
    motion={motion}
    onToggleMotion={jest.fn()}
    wave={{ height: 1, position: 0 }}
    isGridShown={false}
    readingRef={{ current: null }}
    onTrouble={jest.fn()}
    onDrawn={jest.fn()}
    onExitFullscreen={jest.fn()}
    onToggleFullscreen={jest.fn()}
  />
);

const measured = () =>
  act(() => {
    observers.forEach((changed) => changed());
  });

/** What the music hands the scene: loud, on a beat. */
const heard = (deltaMs = 1000 / 60): ISceneFrame => ({
  timeSeconds: SECONDS,
  deltaMs,
  level: 0.7,
  beat: 0.9,
  bands: [0.8, 0.5, 0.3],
  musicAccent: [0.6, 3],
  musicRun: [0.25, 0.05],
  accent: [0, 0.9, 0.8],
  fade: 1,
  spectrum: new Uint8Array(SPECTRUM_TEXELS).fill(200),
  waveform: new Uint8Array(WAVEFORM_TEXELS).fill(180),
  params: {},
});

const shaper = () => {
  const { shapeFrame } = runner.mock.calls[runner.mock.calls.length - 1][0];
  if (!shapeFrame) {
    throw new Error('the stage hands the runner no frame shaper');
  }
  return shapeFrame;
};

const calm = calmBands(SECONDS);

describe('Calm on the Studio stage', () => {
  it('hands the scene the desktop’s calm motion while Calm is on', () => {
    render(stage({ motion: 'calm' }));
    measured();
    const out = shaper()(heard());
    expect(out.playing).toBe(false);
    expect(out.beat).toBe(0);
    expect(out.level).toBeCloseTo(calm.level, 10);
    expect(out.bands).toEqual([calm.bass, calm.mid, calm.treble]);
    expect(out.musicAccent[0]).toBe(0);
  });

  it('control: on the music the scene hears what is playing', () => {
    render(stage({ motion: 'music' }));
    measured();
    const out = shaper()(heard());
    expect(out.level).toBe(0.7);
    expect(out.beat).toBe(0.9);
    expect(out.bands).toEqual([0.8, 0.5, 0.3]);
    expect(out.playing).toBeUndefined();
  });

  it('eases across when switched, on the same scene, never starting it again', () => {
    const view = render(stage({ motion: 'music' }));
    measured();
    const first = shaper();
    view.rerender(stage({ motion: 'calm' }));
    // The runner is handed the same shaper: nothing about the scene changed.
    expect(shaper()).toBe(first);
    // Half the desktop's handover in, the music and the calm are mixed.
    const halfway = first(heard(750));
    expect(halfway.level).toBeLessThan(0.7);
    expect(halfway.level).toBeGreaterThan(calm.level);
    expect(halfway.playing).toBeUndefined();
    // And at its end the scene hears only the calm motion.
    const settled = first(heard(750));
    expect(settled.playing).toBe(false);
    expect(settled.level).toBeCloseTo(calm.level, 10);

    view.rerender(stage({ motion: 'music' }));
    first(heard(1500));
    expect(first(heard()).level).toBe(0.7);
  });

  it('calms a test signal and the Compact player’s view as well', () => {
    render(stage({ motion: 'calm', preview: 'player', signal: 'beat' }));
    measured();
    const out = shaper()(heard());
    expect(out.view).toEqual(PLAYER_PANEL_VIEW);
    expect(out.playing).toBe(false);
    expect(out.beat).toBe(0);
    expect(out.bands).toEqual([calm.bass, calm.mid, calm.treble]);
  });

  it('control: the test signal beats on the music', () => {
    render(stage({ motion: 'music', preview: 'player', signal: 'beat' }));
    measured();
    const out = shaper()(heard());
    expect(out.view).toEqual(PLAYER_PANEL_VIEW);
    expect(out.playing).not.toBe(false);
  });
});

describe('the plate’s first button', () => {
  it('says the music the scene moves to, and a press asks for Calm', () => {
    const onToggle = jest.fn();
    render(
      <StudioStageMotion motion="music" demo={false} onToggle={onToggle} />,
    );
    const button = screen.getByRole('button', { name: 'studio.stage.music' });
    expect(button.getAttribute('title')).toContain('studio.stage.toCalm');
    expect(button).not.toHaveClass('is-calm');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('says the demo song while nothing plays, with its light', () => {
    const { container } = render(
      <StudioStageMotion motion="music" demo onToggle={jest.fn()} />,
    );
    expect(
      screen.getByRole('button', { name: 'studio.stage.demoSong' }),
    ).toBeInTheDocument();
    expect(container.querySelector('.studio-stage__demo-dot')).not.toBeNull();
  });

  it('says Calm while Calm is on, worn as chosen, and a press asks for the music', () => {
    const onToggle = jest.fn();
    const { container } = render(
      <StudioStageMotion motion="calm" demo onToggle={onToggle} />,
    );
    const button = screen.getByRole('button', { name: 'studio.stage.calm' });
    expect(button.getAttribute('title')).toContain('studio.stage.toMusic');
    expect(button).toHaveClass('is-calm');
    // Calm hears no demo song: its light goes with it.
    expect(container.querySelector('.studio-stage__demo-dot')).toBeNull();
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('stands in a live region, so a change is announced', () => {
    render(<StudioStageMotion motion="music" demo onToggle={jest.fn()} />);
    expect(
      screen.getByRole('button').closest('[aria-live="polite"]'),
    ).not.toBeNull();
  });

  it('says on the stage what the stage hears, and its press reaches the Studio', () => {
    const onToggleMotion = jest.fn();
    const view = render(
      <StudioStage
        identity="one"
        pack={pack}
        serial={1}
        signal="live"
        demo={false}
        size="graph"
        preview="stage"
        motion="calm"
        onToggleMotion={onToggleMotion}
        wave={{ height: 1, position: 0 }}
        isGridShown={false}
        readingRef={{ current: null }}
        onTrouble={jest.fn()}
        onDrawn={jest.fn()}
        onExitFullscreen={jest.fn()}
        onToggleFullscreen={jest.fn()}
      />,
    );
    measured();
    fireEvent.click(view.getByRole('button', { name: 'studio.stage.calm' }));
    expect(onToggleMotion).toHaveBeenCalledTimes(1);
  });

  it('is the first thing on the stage’s plate', () => {
    const { container } = render(stage({ motion: 'music' }));
    measured();
    expect(
      container.querySelector('.studio-stage__bar')?.firstElementChild,
    ).toHaveClass('studio-stage-motion');
  });
});

describe('the Studio’s choice of what the stage hears', () => {
  it('starts on the music and swaps to Calm and back with one press', () => {
    const { result } = renderHook(() => useStageMotion());
    const toggle = result.current.toggleMotion;
    expect(result.current.motion).toBe('music');
    act(() => result.current.toggleMotion());
    expect(result.current.motion).toBe('calm');
    act(() => result.current.toggleMotion());
    expect(result.current.motion).toBe('music');
    expect(result.current.toggleMotion).toBe(toggle);
  });
});
