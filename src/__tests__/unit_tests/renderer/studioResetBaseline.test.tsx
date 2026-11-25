/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Studio's Reset goes back to.
 *
 * Tuning a new version is tuning away from the one listeners already have, so
 * Reset means the published settings. A scene that has never been published,
 * and one whose member is offline or signed out, go back to the scene's own
 * settings as the project was opened instead — and, either way, whichever it
 * is has to be on screen before the button is pressed.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import type { ISceneSettings } from '../../../common/sceneSettings';
import useStudioBaseline from '../../../renderer/studio/useStudioBaseline';
import useStudioTuning from '../../../renderer/studio/useStudioTuning';
import { memberPack } from '../../utils/memberSceneFixtures';

const PROJECT = '11111111-1111-4111-8111-111111111111';

const packWith = (values: Record<string, number>): IScenePack => ({
  ...memberPack(),
  params: Object.entries(values).map(([id, value]) => ({
    id,
    names: { en: id },
    min: 0,
    max: 1,
    value,
  })),
});

const write = jest.fn(async () => ({
  written: 'written' as const,
  lookUpdated: false,
}));
const askPublished = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(window, {
    electron: {
      ipcRenderer: {
        writeStudioSettings: write,
        publishedStudioSettings: askPublished,
      },
    },
  });
});

const published = (settings: Partial<ISceneSettings>) => ({
  ok: true as const,
  published: {
    version: 5,
    settings: { params: {}, ambient: {}, ...settings },
  },
});

// One pack for the whole file, as the Studio's store hands out one per build:
// a fresh object on every render would tell the tuning the scene had changed
// again each time, which is a render loop rather than a test.
const PACK = packWith({ glow: 0.9 });

/** The baseline and the tuning together, as the bench wires them. */
const tuner = () =>
  renderHook(() => {
    const baseline = useStudioBaseline(PROJECT, 0);
    return { baseline, tuning: useStudioTuning(PACK, PROJECT, baseline) };
  });

it('puts the controls back where the published version left them', async () => {
  askPublished.mockResolvedValue(published({ params: { glow: 0.2 } }));
  const { result } = tuner();
  await waitFor(() => expect(result.current.tuning.publishedVersion).toBe(5));
  expect(result.current.baseline.gallery).toEqual({
    state: 'live',
    version: 5,
  });

  // The scene on disk stands at 0.9 and the published one at 0.2, so there is
  // something to go back to before anything is touched.
  expect(result.current.tuning.values.glow).toBeCloseTo(0.9);
  expect(result.current.tuning.canResetParams).toBe(true);

  // A reset that writes waits for its save, which the tuning records.
  await act(async () => result.current.tuning.resetParams());
  expect(result.current.tuning.values.glow).toBeCloseTo(0.2);
  expect(write).toHaveBeenCalledWith({ params: { glow: 0.2 } });
});

it('goes back to the scene as it was opened when nothing is published', async () => {
  askPublished.mockResolvedValue({ ok: true });
  const { result } = tuner();
  await waitFor(() =>
    expect(result.current.baseline.gallery).toEqual({ state: 'none' }),
  );
  expect(result.current.tuning.publishedVersion).toBeUndefined();

  // Nothing has moved, so there is nothing to reset to.
  expect(result.current.tuning.canResetParams).toBe(false);
  act(() => result.current.tuning.setParam('glow', 0.1));
  expect(result.current.tuning.canResetParams).toBe(true);
  act(() => result.current.tuning.resetParams());
  expect(result.current.tuning.values.glow).toBeCloseTo(0.9);
});

it('resets the response to the published one, and to neutral without it', async () => {
  askPublished.mockResolvedValue(
    published({
      response: { sensitivity: 2, threshold: 0.1, attack: 40, release: 300 },
    }),
  );
  const { result } = tuner();
  await waitFor(() => expect(result.current.tuning.publishedVersion).toBe(5));

  // The scene on disk answers the music as the engine hears it; the published
  // one did not, so Reset has somewhere to go.
  expect(result.current.tuning.canResetResponse).toBe(true);
  act(() => result.current.tuning.resetResponse());
  expect(result.current.tuning.response.sensitivity).toBeCloseTo(2);

  // And at the published response there is nothing left to reset.
  await waitFor(() =>
    expect(result.current.tuning.canResetResponse).toBe(false),
  );
});

it('falls back to the scene when the server cannot be asked', async () => {
  askPublished.mockResolvedValue({ ok: false });
  const { result } = tuner();
  // Offline is "could not ask", never "nothing published" (the bar said a
  // published scene was unpublished while offline).
  await waitFor(() =>
    expect(result.current.baseline.gallery).toEqual({ state: 'unknown' }),
  );
  // Offline is not "never published": it says nothing, and Reset keeps the
  // meaning it has when there is nothing to go back to.
  expect(result.current.tuning.publishedVersion).toBeUndefined();
  act(() => result.current.tuning.setParam('glow', 0.4));
  act(() => result.current.tuning.resetParams());
  expect(result.current.tuning.values.glow).toBeCloseTo(0.9);
});

it('survives a bridge that throws, and asks nothing with no project open', async () => {
  askPublished.mockRejectedValue(new Error('gone'));
  const { result } = tuner();
  await waitFor(() => expect(askPublished).toHaveBeenCalled());
  expect(result.current.baseline.settings).toBeUndefined();
  await waitFor(() =>
    expect(result.current.baseline.gallery).toEqual({ state: 'unknown' }),
  );

  askPublished.mockClear();
  renderHook(() => useStudioBaseline(undefined, 0));
  expect(askPublished).not.toHaveBeenCalled();
});

it('reads as being asked until the answer lands, and a new publication keeps the old answer meanwhile', async () => {
  let answer: (value: unknown) => void = () => {};
  askPublished.mockImplementation(
    () =>
      new Promise((resolve) => {
        answer = resolve;
      }),
  );
  const { result, rerender } = renderHook(
    ({ publications }) => useStudioBaseline(PROJECT, publications),
    { initialProps: { publications: 0 } },
  );
  expect(result.current.gallery).toEqual({ state: 'asking' });
  await act(async () => answer(published({})));
  expect(result.current.gallery).toEqual({ state: 'live', version: 5 });

  // Published again: still version 5 on screen until the gallery answers,
  // rather than a blank line in between.
  rerender({ publications: 1 });
  expect(result.current.gallery).toEqual({ state: 'live', version: 5 });
  await act(async () =>
    answer({
      ok: true,
      published: { version: 6, settings: { params: {}, ambient: {} } },
    }),
  );
  expect(result.current.gallery).toEqual({ state: 'live', version: 6 });
});

it('asks again for another project, and never shows the last project’s answer for it', async () => {
  askPublished.mockResolvedValueOnce(published({}));
  askPublished.mockImplementationOnce(() => new Promise(() => {}));
  const { result, rerender } = renderHook(
    ({ project }) => useStudioBaseline(project, 0),
    { initialProps: { project: PROJECT } },
  );
  await waitFor(() =>
    expect(result.current.gallery).toEqual({ state: 'live', version: 5 }),
  );
  rerender({ project: '22222222-2222-4222-8222-222222222222' });
  expect(result.current.gallery).toEqual({ state: 'asking' });
  expect(result.current.settings).toBeUndefined();
});
