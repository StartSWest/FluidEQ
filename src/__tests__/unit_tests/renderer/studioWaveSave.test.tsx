/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Letting a wave slider go writes the wave into the scene.
 *
 * The main process's half is held by `studioWaveSettings.test.ts`; this is the
 * half that sends it. What it holds is that the Studio asks for the wave to be
 * saved at all, that a wave left where the graph's own stands asks for
 * nothing, and that Reset goes back to the scene's own rather than to the
 * graph's default.
 */

import { renderHook, act } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import useStudioTuning from '../../../renderer/studio/useStudioTuning';

const writeStudioSettings = jest.fn(async () => ({
  written: 'written' as const,
  lookUpdated: false,
}));

const pack = (over: Partial<IScenePack> = {}): IScenePack =>
  ({
    schema: 1,
    id: 'crystal',
    version: 2,
    contract: 4,
    names: { en: 'Crystal' },
    fallbackStyle: 'bars',
    swatch: ['#fff', '#000'],
    source: 'void main(){}',
    params: [],
    ...over,
  }) as IScenePack;

const tuner = (scene: IScenePack) =>
  renderHook(() => useStudioTuning(scene, 'project-1', {}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { writeStudioSettings } },
  });
});

it('saves the wave into the scene when the slider is let go', () => {
  const { result } = tuner(pack());
  act(() => result.current.setWave({ height: 0.4, position: 0.3 }));
  // On the stage at once; written when the slider is released.
  expect(result.current.wave).toEqual({ height: 0.4, position: 0.3 });
  expect(writeStudioSettings).not.toHaveBeenCalled();
  act(() => result.current.commit());
  expect(writeStudioSettings).toHaveBeenCalledWith(
    expect.objectContaining({ wave: { height: 0.4, position: 0.3 } }),
  );
});

it('asks for nothing when the wave is left where the graph’s own stands', () => {
  const { result } = tuner(pack());
  act(() => result.current.setWave({ height: 1, position: 0 }));
  act(() => result.current.commit());
  // Nothing to say: a scene at the full height on the bottom is every scene.
  expect(writeStudioSettings).not.toHaveBeenCalled();
});

it('takes the scene’s wave out when it goes back to the graph’s own', () => {
  const { result } = tuner(pack({ wave: { height: 0.4, position: 0.3 } }));
  expect(result.current.wave).toEqual({ height: 0.4, position: 0.3 });
  act(() => result.current.setWave({ height: 1, position: 0 }));
  act(() => result.current.commit());
  expect(writeStudioSettings).toHaveBeenCalledWith(
    expect.objectContaining({ wave: null }),
  );
});

it('offers Reset only once the wave has left the scene’s own, and goes back to it', () => {
  const { result } = tuner(pack({ wave: { height: 0.4, position: 0.3 } }));
  expect(result.current.canResetWave).toBe(false);
  act(() => result.current.setWave({ height: 0.8, position: 0 }));
  expect(result.current.canResetWave).toBe(true);
  act(() => result.current.resetWave());
  expect(result.current.wave).toEqual({ height: 0.4, position: 0.3 });
  // The scene on disk already says this, so there is nothing to write.
  expect(writeStudioSettings).not.toHaveBeenCalled();
});

it('goes back to the wave the project was opened with, not the last one saved', () => {
  // A wave saved into the scene becomes the pack's own, and Reset that
  // followed the pack would then have nothing to go back to. It goes back to
  // where the project stood when it was opened, as the controls do.
  const { result, rerender } = renderHook(
    ({ scene }: { scene: IScenePack }) =>
      useStudioTuning(scene, 'project-1', {}),
    { initialProps: { scene: pack({ wave: { height: 0.4, position: 0.3 } }) } },
  );
  act(() => result.current.setWave({ height: 0.8, position: 0.1 }));
  act(() => result.current.commit());
  // The save lands and the scene is built again, now carrying the new wave.
  rerender({
    scene: pack({ version: 3, wave: { height: 0.8, position: 0.1 } }),
  });
  expect(result.current.canResetWave).toBe(true);
  act(() => result.current.resetWave());
  expect(result.current.wave).toEqual({ height: 0.4, position: 0.3 });
  expect(writeStudioSettings).toHaveBeenLastCalledWith(
    expect.objectContaining({ wave: { height: 0.4, position: 0.3 } }),
  );
});
