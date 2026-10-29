/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The graph's one notice that the look it is playing arrived at a new
 * version. What is held here: a first play says nothing, a newer version
 * played says so once with what its maker wrote and the gallery entry to open,
 * and a gallery that cannot be asked still leaves the notice with its name.
 *
 * One module for the whole file, as the window has it, so every case plays a
 * look of its own.
 */

import { act, renderHook } from '@testing-library/react';
import type { IGalleryScene } from '../../../common/plusGallery';
import { findGalleryScene } from '../../../renderer/plus/galleryStore';
import {
  acknowledgeSceneUpdateNotice,
  reportScenePlayed,
  useSceneUpdateNotice,
} from '../../../renderer/graph/sceneUpdateStore';

jest.mock('../../../renderer/plus/galleryStore', () => ({
  findGalleryScene: jest.fn(() => undefined),
}));

const FLUIDEQ = '00000000-0000-4000-8000-000000000001';

const entry = (lookId: string, version: number) =>
  ({
    lookId,
    sceneId: lookId.split(':')[1],
    authorId: FLUIDEQ,
    version,
    names: { en: 'Alpine' },
    versionNote: 'The peaks stay whole on wide panels',
  }) as IGalleryScene;

const notice = () => renderHook(() => useSceneUpdateNotice()).result.current;

let listGallery: jest.Mock;

beforeEach(() => {
  listGallery = jest.fn(async () => ({
    ok: true,
    scenes: [entry('premium:alpine', 49)],
    more: false,
  }));
  window.electron = {
    ipcRenderer: { listGallery },
  } as unknown as typeof window.electron;
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electron');
});

it('says nothing the first time a look is played, nor at the same version again', async () => {
  const before = notice();
  const played = {
    lookId: 'premium:bloom',
    version: 4,
    names: { en: 'Bloom' },
  };
  await reportScenePlayed(played);
  await reportScenePlayed(played);
  expect(notice()).toBe(before);
  expect(listGallery).not.toHaveBeenCalled();
});

it('says once that a newer version is playing, with its note and its page', async () => {
  const names = { en: 'Alpine' };
  await reportScenePlayed({ lookId: 'premium:alpine', version: 47, names });
  await reportScenePlayed({ lookId: 'premium:alpine', version: 49, names });
  expect(notice()).toMatchObject({
    ok: true,
    version: 49,
    note: 'The peaks stay whole on wide panels',
    scene: { lookId: 'premium:alpine', version: 49 },
  });
  // FluidEQ's own scenes are looked up under FluidEQ.
  expect(listGallery).toHaveBeenCalledWith({ sort: 'new', authorId: FLUIDEQ });
});

it('still names the scene when the gallery cannot be asked', async () => {
  listGallery.mockResolvedValue({ ok: false, reason: 'offline' });
  const names = { en: 'Aurora' };
  await reportScenePlayed({ lookId: 'premium:aurora', version: 4, names });
  await reportScenePlayed({ lookId: 'premium:aurora', version: 5, names });
  const shown = notice();
  expect(shown).toMatchObject({ version: 5, names: { en: 'Aurora' } });
  expect(shown).not.toHaveProperty('scene');
  expect(shown).not.toHaveProperty('note');
});

it('keeps stale gallery metadata out of the confirmed version notice', async () => {
  const lookId = 'premium:stale-gallery';
  jest.mocked(findGalleryScene).mockReturnValue(entry(lookId, 10));
  listGallery.mockResolvedValue({ ok: true, scenes: [entry(lookId, 12)] });
  const names = { en: 'Confirmed pack' };
  await reportScenePlayed({ lookId, version: 10, names });
  await reportScenePlayed({ lookId, version: 11, names });
  expect(notice()).toEqual({ ok: true, version: 11, names });
  expect(listGallery).toHaveBeenCalledTimes(1);
  jest.mocked(findGalleryScene).mockReset();
});

it('does not replace version 12 with a late version 11 lookup', async () => {
  const lookId = 'premium:out-of-order';
  const names = { en: 'Neon Horizon' };
  let finish: (value: unknown) => void = () => {
    throw new Error('the gallery lookup did not start');
  };
  listGallery.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await reportScenePlayed({ lookId, version: 10, names });
  const older = reportScenePlayed({ lookId, version: 11, names });
  await reportScenePlayed({ lookId, version: 12, names });
  const newer = notice();
  expect(newer?.version).toBe(12);
  finish({ ok: true, scenes: [entry(lookId, 11)] });
  await older;
  expect(notice()).toBe(newer);
});

it('acknowledges only the notice delivered, preserving a newer pending one', async () => {
  const lookId = 'premium:delivery-race';
  const names = { en: 'Neon Horizon' };
  await reportScenePlayed({ lookId, version: 10, names });
  await reportScenePlayed({ lookId, version: 11, names });
  const first = notice();
  await act(async () => reportScenePlayed({ lookId, version: 12, names }));
  const newer = notice();
  if (!first || !newer) {
    throw new Error('both update notices are required');
  }
  act(() => {
    acknowledgeSceneUpdateNotice(first);
  });
  expect(notice()).toBe(newer);
  act(() => {
    acknowledgeSceneUpdateNotice(newer);
  });
  expect(notice()).toBeUndefined();
});
