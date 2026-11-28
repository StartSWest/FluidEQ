/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ScenePerformanceMenu from '../../../renderer/graph/ScenePerformanceMenu';
import { setOnBatteryForTesting } from '../../../renderer/utils/batteryPower';
import {
  readScenePerformance,
  resetScenePerformanceForTesting,
  setScenePerformance,
} from '../../../renderer/utils/scenePerformanceStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
  }),
}));

beforeEach(() => {
  window.localStorage.removeItem('fluideq.scenePerformance');
  window.localStorage.removeItem('fluideq.standardPerformance');
  resetScenePerformanceForTesting();
  setOnBatteryForTesting(false);
});

describe('the View menu’s drawing rows', () => {
  // Ivan, 2026-11-27: "I dont want that many options so lets do auto,
  // blance, and full".
  it('offers the frame rate and the quality, and nothing else', () => {
    render(<ScenePerformanceMenu />);
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(
      screen.getByText('graph.scene.frameRate.display'),
    ).toBeInTheDocument();
    expect(screen.getByText('scene.quality.auto')).toBeInTheDocument();
    // The row says what the choice on it does.
    expect(screen.getByTitle('scene.quality.auto.hint')).toBeInTheDocument();
  });

  it('cycles the quality through Balanced and Full and back to Auto', () => {
    render(<ScenePerformanceMenu />);
    const seen: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      fireEvent.click(screen.getAllByRole('menuitem')[1]);
      seen.push(readScenePerformance().quality);
    }
    expect(seen).toEqual(['balanced', 'full', 'auto']);
    fireEvent.click(screen.getAllByRole('menuitem')[1]);
    expect(screen.getByText('scene.quality.balanced')).toBeInTheDocument();
    expect(
      screen.getByTitle('scene.quality.balanced.hint'),
    ).toBeInTheDocument();
  });

  it('keeps each group’s choice when switching between Standard and Plus', () => {
    const { rerender } = render(<ScenePerformanceMenu group="standard" />);
    fireEvent.click(screen.getByTitle('scene.quality.auto.hint'));
    fireEvent.click(screen.getByTitle('graph.scene.frameRateHint'));
    expect(readScenePerformance('standard')).toEqual({
      frameRate: 'sixty',
      quality: 'balanced',
    });

    rerender(<ScenePerformanceMenu group="plus" />);
    expect(
      screen.getByText('graph.scene.frameRate.display'),
    ).toBeInTheDocument();
    expect(screen.getByText('scene.quality.auto')).toBeInTheDocument();

    rerender(<ScenePerformanceMenu group="standard" />);
    expect(screen.getByText('graph.scene.frameRate.sixty')).toBeInTheDocument();
    expect(screen.getByText('scene.quality.balanced')).toBeInTheDocument();
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

  /** Fifteen is FluidWallpapers' battery rate; FluidEQ's row names it and moves on. */
  it('names a fifteen set elsewhere, and cycles on from it to the display rate', () => {
    setScenePerformance({ frameRate: 'fifteen' });
    render(<ScenePerformanceMenu />);
    expect(
      screen.getByText('graph.scene.frameRate.fifteen'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('graph.scene.frameRateHint'));
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

  /** The graphics card is no choice any more: always the fast one. */
  it('offers no graphics card row', () => {
    render(<ScenePerformanceMenu />);
    expect(screen.queryByTitle('graph.scene.gpuHint')).toBeNull();
    expect(screen.queryByText(/graph\.scene\.gpu/)).toBeNull();
  });
});
