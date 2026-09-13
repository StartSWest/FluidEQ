/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The Studio stage's graph grid.
 *
 * The grid is only worth having if the scene under it is handed the band the
 * graph would hand it: a grid drawn over a scene still spread edge to edge
 * would measure the wrong thing while looking right. So the band the runner
 * is given is what is asserted, with the grid off as the control.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import useSceneRunner from '../../../renderer/graph/useSceneRunner';
import StudioGridSwitch from '../../../renderer/studio/StudioGridSwitch';
import StudioStage from '../../../renderer/studio/StudioStage';
import { studioPaper } from '../../../renderer/studio/studioPaper';
import { studioSpectrumRect } from '../../../renderer/studio/studioWave';

jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
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

/** One stage box, as the layout would measure it. */
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
  // Calls back when the test says the layout measured, as a real one would
  // once the stage has a box.
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

const stage = (isGridShown: boolean) => (
  <StudioStage
    identity="one"
    pack={pack}
    serial={1}
    signal="live"
    size="graph"
    wave={wave}
    isGridShown={isGridShown}
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

const lastBand = () =>
  runner.mock.calls[runner.mock.calls.length - 1][0].spectrumRect;

it('hands the scene the whole frame with the grid off', () => {
  const { container } = render(stage(false));
  measured();
  expect(container.querySelector('.studio-paper')).toBeNull();
  expect(lastBand()).toEqual(studioSpectrumRect({}, wave));
});

it("draws the graph's grid and hands the scene the graph's band with it on", () => {
  const { container } = render(stage(true));
  measured();
  expect(container.querySelector('.studio-paper')).not.toBeNull();
  expect(
    container.querySelectorAll('.studio-paper text').length,
  ).toBeGreaterThan(0);
  const expected = studioPaper(WIDTH, HEIGHT, {}, wave).spectrumRect;
  expect(lastBand()).toEqual(expected);
  // The control: the gridded band is not the whole frame.
  expect(lastBand()).not.toEqual(studioSpectrumRect({}, wave));
});

it('keeps one band array while nothing about it changes', () => {
  const { rerender } = render(stage(true));
  measured();
  const first = lastBand();
  rerender(stage(true));
  expect(lastBand()).toBe(first);
});

it('remembers the grid switch', () => {
  window.localStorage.removeItem('fluideq.studioGrid');
  render(<StudioGridSwitch />);
  const toggle = screen.getByRole('checkbox', { name: 'studio.grid.label' });
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle);
  expect(
    screen.getByRole('checkbox', { name: 'studio.grid.label' }),
  ).toBeChecked();
  expect(window.localStorage.getItem('fluideq.studioGrid')).toBe('true');
});
