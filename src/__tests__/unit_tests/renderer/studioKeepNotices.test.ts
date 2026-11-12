/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, renderHook } from '@testing-library/react';
import useStudioKeep from '../../../renderer/studio/useStudioKeep';
import { addStudioSceneToLooks } from '../../../renderer/studio/studioStore';
import { openWallpaperDialog } from '../../../renderer/wallpaper/wallpaperDialogs';

jest.mock('../../../renderer/studio/studioStore', () => ({
  addStudioSceneToLooks: jest.fn(),
}));
jest.mock('../../../renderer/wallpaper/wallpaperDialogs', () => ({
  openWallpaperDialog: jest.fn(),
}));
jest.mock('../../../renderer/wallpaper/WallpaperControls', () => ({
  useCanSetDesktop: () => true,
}));

/**
 * The Studio's "Put on desktop" keeps the stage's scene in the member's looks
 * and opens the desktop dialog on it — published or not (Ivan, 2026-10-21:
 * "no need to publish to run on grahp"). Every way the press can fail says
 * which, in its own words.
 */

const WAVE = { height: 1, position: 0 };
const LOOK = 'member:faaed582-d6f4-4e70-999b-86e8518a7dc4:alpine';

const press = async (outcome: unknown) => {
  jest.mocked(addStudioSceneToLooks).mockResolvedValue(outcome as never);
  const notify = jest.fn();
  const { result } = renderHook(() =>
    useStudioKeep('Alpine', WAVE, notify, jest.fn()),
  );
  await act(async () => {
    result.current.setDesktop?.();
  });
  return notify;
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('puts an unpublished scene that plays on the desktop', async () => {
  const notify = await press({
    ok: true,
    scene: { lookId: LOOK },
    updated: false,
  });
  expect(openWallpaperDialog).toHaveBeenCalledWith(LOOK, WAVE);
  expect(notify).toHaveBeenCalledWith(
    expect.objectContaining({ ok: true, key: 'studio.notice.added' }),
  );
});

it('says each failure in its own words, and opens nothing', async () => {
  const cases: [unknown, string][] = [
    [{ ok: false, reason: 'signed-out' }, 'studio.notice.signedOut'],
    [{ ok: false, reason: 'no-build' }, 'studio.notice.addFailed'],
    [{ ok: false, reason: 'refused' }, 'studio.notice.saveFailed'],
    [{ ok: false, reason: 'inspect-only' }, 'studio.inspect.locked'],
    [{ ok: false, reason: 'not-entitled' }, 'studio.notice.saveFailed'],
  ];
  // One at a time: each press is its own.
  // eslint-disable-next-line no-restricted-syntax -- awaited in turn
  for (const [outcome, key] of cases) {
    // eslint-disable-next-line no-await-in-loop -- one press at a time
    const notify = await press(outcome);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, key }),
    );
  }
  expect(openWallpaperDialog).not.toHaveBeenCalled();
});

it('says the save failed when main could not be asked at all', async () => {
  jest.mocked(addStudioSceneToLooks).mockRejectedValue(new Error('gone'));
  const notify = jest.fn();
  const { result } = renderHook(() =>
    useStudioKeep('Alpine', WAVE, notify, jest.fn()),
  );
  await act(async () => {
    result.current.setDesktop?.();
  });
  expect(notify).toHaveBeenCalledWith(
    expect.objectContaining({ ok: false, key: 'studio.notice.saveFailed' }),
  );
  expect(openWallpaperDialog).not.toHaveBeenCalled();
});
