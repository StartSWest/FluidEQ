/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ScenePerformanceMenu from '../../../renderer/graph/ScenePerformanceMenu';
import { setOnBatteryForTesting } from '../../../renderer/utils/batteryPower';
import { resetGraphicsPreferenceForTesting } from '../../../renderer/utils/graphicsPreferenceStore';
import {
  readScenePerformance,
  resetScenePerformanceForTesting,
} from '../../../renderer/utils/scenePerformanceStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
  }),
}));

const withGraphicsBridge = (supported: boolean) => {
  let chosen = 'auto';
  const state = () => ({ chosen, atLaunch: 'auto', supported });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        graphicsPreference: jest.fn(async () => state()),
        setGraphicsPreference: jest.fn(async (next: string) => {
          chosen = next;
          return state();
        }),
      },
    },
  });
};

const settle = () => act(async () => undefined);

beforeEach(() => {
  window.localStorage.removeItem('fluideq.scenePerformance');
  resetScenePerformanceForTesting();
  resetGraphicsPreferenceForTesting();
  setOnBatteryForTesting(false);
  delete (window as { electron?: unknown }).electron;
});

describe('the View menu’s performance rows for Plus visualizers', () => {
  it('shows the display rate, automatic resolution down to a third, AMD FSR and fast smoothing to start with', () => {
    render(<ScenePerformanceMenu />);
    expect(
      screen.getByText('graph.scene.frameRate.display'),
    ).toBeInTheDocument();
    expect(screen.getByText('graph.scene.resolution.auto')).toBeInTheDocument();
    expect(screen.getByText('graph.scene.floor.35')).toBeInTheDocument();
    expect(screen.getByText('graph.scene.scaler.fsr')).toBeInTheDocument();
    expect(screen.getByText('graph.scene.smoothing.fast')).toBeInTheDocument();
  });

  it('walks the smallest size through the four floors, and says when it counts under a fixed size', () => {
    render(<ScenePerformanceMenu />);
    const row = screen.getByTitle('graph.scene.floorHint');
    const seen: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      fireEvent.click(row);
      seen.push(readScenePerformance().autoFloor);
    }
    expect(seen).toEqual([0.5, 0.67, 0.85, 0.35]);
    expect(screen.getByText('graph.scene.floor.35')).toBeInTheDocument();
    expect(screen.queryByText('graph.scene.floor.whenAuto')).toBeNull();
    // A fixed size: the row stays, and says the floor is Automatic's.
    fireEvent.click(screen.getByTitle('graph.scene.resolutionHint'));
    expect(readScenePerformance().resolution).toBe('native');
    expect(screen.getByTitle('graph.scene.floorHint')).toBeInTheDocument();
    expect(screen.getByText('graph.scene.floor.whenAuto')).toBeInTheDocument();
  });

  it('cycles the frame rate through the caps and back on each click', () => {
    render(<ScenePerformanceMenu />);
    const row = screen.getByTitle('graph.scene.frameRateHint');
    fireEvent.click(row);
    expect(screen.getByText('graph.scene.frameRate.sixty')).toBeInTheDocument();
    expect(readScenePerformance().frameRate).toBe('sixty');
    fireEvent.click(row);
    expect(
      screen.getByText('graph.scene.frameRate.thirty'),
    ).toBeInTheDocument();
    fireEvent.click(row);
    expect(
      screen.getByText('graph.scene.frameRate.display'),
    ).toBeInTheDocument();
    expect(readScenePerformance().frameRate).toBe('display');
  });

  it('says the display rate is held to sixty while on battery', () => {
    render(<ScenePerformanceMenu />);
    act(() => setOnBatteryForTesting(true));
    expect(
      screen.getByText('graph.scene.frameRate.displayBattery'),
    ).toBeInTheDocument();
    act(() => setOnBatteryForTesting(false));
    expect(
      screen.getByText('graph.scene.frameRate.display'),
    ).toBeInTheDocument();
  });

  it('walks the resolution through full and the three presets', () => {
    render(<ScenePerformanceMenu />);
    const row = screen.getByTitle('graph.scene.resolutionHint');
    const seen: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(row);
      seen.push(readScenePerformance().resolution);
    }
    expect(seen).toEqual([
      'native',
      'quality',
      'balanced',
      'performance',
      'auto',
    ]);
    expect(screen.getByText('graph.scene.resolution.auto')).toBeInTheDocument();
  });

  it('switches the scaler and the smoothing', () => {
    render(<ScenePerformanceMenu />);
    fireEvent.click(screen.getByTitle('graph.scene.scalerHint'));
    expect(readScenePerformance().upscaler).toBe('simple');
    expect(screen.getByText('graph.scene.scaler.simple')).toBeInTheDocument();
    const smoothing = screen.getByTitle('graph.scene.smoothingHint');
    fireEvent.click(smoothing);
    expect(readScenePerformance().smoothing).toBe('best');
    expect(screen.getByText('graph.scene.smoothing.best')).toBeInTheDocument();
    fireEvent.click(smoothing);
    expect(readScenePerformance().smoothing).toBe('off');
    expect(screen.getByText('graph.scene.smoothing.off')).toBeInTheDocument();
  });

  it('offers no graphics card row where the choice means nothing', async () => {
    withGraphicsBridge(false);
    render(<ScenePerformanceMenu />);
    await settle();
    expect(screen.queryByTitle('graph.scene.gpuHint')).toBeNull();
    expect(screen.getAllByRole('menuitem')).toHaveLength(5);
  });

  it('offers the graphics card row on Windows, and says a restart is owed after a change', async () => {
    withGraphicsBridge(true);
    render(<ScenePerformanceMenu />);
    await settle();
    expect(screen.getAllByRole('menuitem')).toHaveLength(6);
    expect(screen.getByText('graph.scene.gpu.auto')).toBeInTheDocument();
    expect(screen.queryByText('graph.scene.gpu.restart')).toBeNull();
    fireEvent.click(screen.getByTitle('graph.scene.gpuHint'));
    await settle();
    expect(screen.getByText('graph.scene.gpu.high')).toBeInTheDocument();
    expect(screen.getByText('graph.scene.gpu.restart')).toBeInTheDocument();
  });
});
