/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Keeping the Studio's scene: in the looks, and from there on the desktop —
 * which plays a look, never a project folder, and takes the stage's wave.
 */

import { act, renderHook } from '@testing-library/react';
import type { TAddOutcome } from '../../../main/ipc/memberScenes';
import type { IMemberSceneSummary } from '../../../main/memberScenes/store';
import { addStudioSceneToLooks } from '../../../renderer/studio/studioStore';
import useStudioKeep from '../../../renderer/studio/useStudioKeep';
import { useCanSetDesktop } from '../../../renderer/wallpaper/WallpaperControls';
import { openWallpaperDialog } from '../../../renderer/wallpaper/wallpaperDialogs';

jest.mock('../../../renderer/studio/studioStore', () => ({
  addStudioSceneToLooks: jest.fn(),
}));
jest.mock('../../../renderer/wallpaper/WallpaperControls', () => ({
  useCanSetDesktop: jest.fn(),
}));
jest.mock('../../../renderer/wallpaper/wallpaperDialogs', () => ({
  openWallpaperDialog: jest.fn(),
}));

const WAVE = { height: 0.4, position: 0.3 };
const kept = {
  lookId: 'member:me:aurora',
} as IMemberSceneSummary;

const keeping = () => {
  const notify = jest.fn();
  const hook = renderHook(() => useStudioKeep('Aurora', WAVE, notify));
  return { notify, hook };
};

/** Lets the keep's promise chain finish inside React's act. */
const settle = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

beforeEach(() => {
  jest.mocked(useCanSetDesktop).mockReturnValue(true);
  jest
    .mocked(addStudioSceneToLooks)
    .mockResolvedValue({ ok: true, scene: kept } satisfies TAddOutcome);
});

afterEach(() => jest.clearAllMocks());

it('keeps the scene in the looks and says so', async () => {
  const { notify, hook } = keeping();
  act(() => hook.result.current.add());
  await settle();
  expect(notify).toHaveBeenCalledWith({
    ok: true,
    key: 'studio.notice.added',
    vars: { name: 'Aurora' },
  });
  expect(openWallpaperDialog).not.toHaveBeenCalled();
});

it('puts the kept look on the desktop, with the wave the stage shows, and is busy only until then', async () => {
  const { notify, hook } = keeping();
  const { setDesktop } = hook.result.current;
  expect(setDesktop).toBeDefined();
  act(() => setDesktop?.());
  expect(hook.result.current.settingDesktop).toBe(true);
  await settle();
  expect(addStudioSceneToLooks).toHaveBeenCalledTimes(1);
  expect(openWallpaperDialog).toHaveBeenCalledWith('member:me:aurora', WAVE);
  expect(notify).toHaveBeenCalledWith(
    expect.objectContaining({ ok: true, key: 'studio.notice.added' }),
  );
  expect(hook.result.current.settingDesktop).toBe(false);
});

it('opens no desktop for a scene that could not be kept, and says why', async () => {
  jest
    .mocked(addStudioSceneToLooks)
    .mockResolvedValueOnce({ ok: false, reason: 'inspect-only' })
    .mockResolvedValueOnce({ ok: false, reason: 'no-build' })
    .mockRejectedValueOnce(new Error('bridge gone'));
  const { notify, hook } = keeping();
  for (let press = 0; press < 3; press += 1) {
    act(() => hook.result.current.setDesktop?.());
    // eslint-disable-next-line no-await-in-loop -- each press settles before the next, as a member's would
    await settle();
  }
  expect(openWallpaperDialog).not.toHaveBeenCalled();
  expect(notify.mock.calls.map(([notice]) => notice.key)).toEqual([
    'studio.inspect.locked',
    'studio.notice.addFailed',
    'studio.notice.addFailed',
  ]);
  expect(hook.result.current.settingDesktop).toBe(false);
});

it('offers no desktop on a computer that cannot put a visualizer there', () => {
  jest.mocked(useCanSetDesktop).mockReturnValue(false);
  const { hook } = keeping();
  expect(hook.result.current.setDesktop).toBeUndefined();
});
