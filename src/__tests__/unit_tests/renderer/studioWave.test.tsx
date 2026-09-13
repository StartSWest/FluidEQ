/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The graph's wave height and position, tried on a scene in the Studio.
 *
 * On the graph those two settings reach a scene as the band its spectrum is
 * drawn in. The Studio's stage used to be handed the whole frame always, so a
 * scene that fell apart under a low or lifted wave looked fine right up until
 * a listener moved the slider. What is held here is that the stage is handed
 * the band the graph would hand, worked out by hand rather than by the
 * transform under test, and that the sliders move it the way the graph's do.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import useSceneRunner from '../../../renderer/graph/useSceneRunner';
import StudioStage from '../../../renderer/studio/StudioStage';
import StudioWaveControls from '../../../renderer/studio/StudioWaveControls';
import {
  DEFAULT_STUDIO_WAVE,
  studioSpectrumRect,
  type IStudioWave,
} from '../../../renderer/studio/studioWave';

jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));
jest.mock('../../../renderer/graph/useSceneRunner', () => ({
  __esModule: true,
  default: jest.fn(() => ({ current: null })),
}));

const runner = jest.mocked(useSceneRunner);
const LOW_LIFTED: IStudioWave = { height: 0.5, position: 1 };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("the band a scene is handed under the graph's wave", () => {
  it('is the whole frame under the graph’s default wave', () => {
    expect(studioSpectrumRect({}, DEFAULT_STUDIO_WAVE)).toEqual([0, 1, 0, 1]);
  });

  it('stands on the middle and reaches a quarter up for a half wave lifted all the way', () => {
    // Lifted all the way, the floor is the middle of the plot and half of it
    // is left above; half height takes half of that.
    const [left, right, bottom, top] = studioSpectrumRect({}, LOW_LIFTED);
    expect(left).toBe(0);
    expect(right).toBe(1);
    expect(bottom).toBeCloseTo(0.5);
    expect(top).toBeCloseTo(0.75);
  });

  it('is the band a scene reserves, whatever the wave', () => {
    const reserved = { spectrumRange: [0.55, 0.94] as const };
    expect(studioSpectrumRect(reserved, LOW_LIFTED)).toEqual([
      0, 1, 0.55, 0.94,
    ]);
    // The control: the same wave on a scene without a band of its own moves.
    expect(studioSpectrumRect({}, LOW_LIFTED)).not.toEqual([0, 1, 0.55, 0.94]);
  });
});

describe('the stage', () => {
  const pack = { names: { en: 'Alpine' }, params: [] } as unknown as IScenePack;
  const stage = (wave: IStudioWave) => (
    <StudioStage
      identity="one"
      pack={pack}
      serial={1}
      signal="live"
      size="graph"
      wave={wave}
      onTrouble={jest.fn()}
      onDrawn={jest.fn()}
      onExitFullscreen={jest.fn()}
      onToggleFullscreen={jest.fn()}
    />
  );
  const lastBand = () =>
    runner.mock.calls[runner.mock.calls.length - 1][0].spectrumRect;

  it('hands the scene the band the wave puts it in', () => {
    const { rerender } = render(stage(DEFAULT_STUDIO_WAVE));
    expect(lastBand()).toEqual([0, 1, 0, 1]);
    rerender(stage(LOW_LIFTED));
    expect(lastBand()).toEqual(studioSpectrumRect({}, LOW_LIFTED));
  });

  it('keeps one band array while the wave stays put', () => {
    const { rerender } = render(stage(LOW_LIFTED));
    const first = lastBand();
    rerender(stage(LOW_LIFTED));
    expect(lastBand()).toBe(first);
  });
});

describe('the wave sliders', () => {
  const controls = (
    wave: IStudioWave,
    onWave: (next: IStudioWave) => void,
    isFixedByScene = false,
  ) => (
    <StudioWaveControls
      wave={wave}
      onWave={onWave}
      isFixedByScene={isFixedByScene}
      idle={false}
    />
  );

  it('snaps the height to the graph’s quarters and leaves other values alone', () => {
    const onWave = jest.fn();
    render(controls(DEFAULT_STUDIO_WAVE, onWave));
    const height = screen.getByRole('slider', { name: /graph.waveHeight/ });
    // 5% + 95% of 468/1000 is 49%, within reach of the half.
    fireEvent.change(height, { target: { value: '468' } });
    expect(onWave).toHaveBeenLastCalledWith({ height: 0.5, position: 0 });
    // The control: 62% is near no quarter and stays 62%.
    fireEvent.change(height, { target: { value: '600' } });
    expect(onWave).toHaveBeenLastCalledWith({ height: 0.62, position: 0 });
  });

  it('offers reset only once the wave has moved, and resets to the graph’s default', () => {
    const onWave = jest.fn();
    const { rerender } = render(controls(DEFAULT_STUDIO_WAVE, onWave));
    expect(
      screen.getByRole('button', { name: 'studio.settings.reset' }),
    ).toBeDisabled();
    rerender(controls(LOW_LIFTED, onWave));
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.settings.reset' }),
    );
    expect(onWave).toHaveBeenCalledWith(DEFAULT_STUDIO_WAVE);
  });

  it('says why the sliders wait on a scene that reserves its own band', () => {
    const { rerender } = render(controls(DEFAULT_STUDIO_WAVE, jest.fn(), true));
    expect(screen.getByText('studio.wave.fixed')).toBeInTheDocument();
    screen
      .getAllByRole('slider')
      .forEach((slider) => expect(slider).toBeDisabled());
    // The control: without a band of its own the sliders are live.
    rerender(controls(DEFAULT_STUDIO_WAVE, jest.fn()));
    expect(screen.getByText('studio.wave.hint')).toBeInTheDocument();
    screen
      .getAllByRole('slider')
      .forEach((slider) => expect(slider).toBeEnabled());
  });
});
