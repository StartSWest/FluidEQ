/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's picture previews across saves. Every save of the project —
 * a slider's included — gives the Studio a new revision and re-reads the
 * pictures; decoding the same atlas again each time redrew every tile and
 * cost a decode of megabytes per slider release.
 */

import { renderHook, waitFor } from '@testing-library/react';
import type { TStudioPictures } from '../../../main/ipc/studioPictures';
import useScenePictures from '../../../renderer/studio/useScenePictures';
import sameStudioPictures from '../../../renderer/studio/sameStudioPictures';

const mockDecode = jest.fn();
jest.mock('../../../renderer/studio/scenePicture', () => ({
  decodePicture: (...args: unknown[]) => mockDecode(...args),
}));
const atlas: Extract<TStudioPictures, { kind: 'atlas' }> = {
  kind: 'atlas',
  width: 20,
  height: 20,
  pictures: [],
  image: new Uint8Array([1, 2, 3]),
};
const read = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  mockDecode.mockResolvedValue({ close: jest.fn() });
  read.mockResolvedValue(atlas);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { readStudioPictures: read } },
  });
});

it('keeps decoded previews after a settings save, but refreshes changed image bytes', async () => {
  const { result, rerender } = renderHook(
    ({ revision }) => useScenePictures('Pictures', revision),
    { initialProps: { revision: 1 } },
  );
  await waitFor(() => expect(result.current.pictures).toEqual(atlas));
  expect(mockDecode).toHaveBeenCalledTimes(1);
  read.mockResolvedValue({ ...atlas, image: new Uint8Array([1, 2, 3]) });
  rerender({ revision: 2 });
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  expect(mockDecode).toHaveBeenCalledTimes(1);
  const changed = { ...atlas, image: new Uint8Array([3, 2, 1]) };
  read.mockResolvedValue(changed);
  rerender({ revision: 3 });
  await waitFor(() => expect(result.current.pictures).toEqual(changed));
  expect(mockDecode).toHaveBeenCalledTimes(2);
});

it('invalidates identical bytes when the layout or available image changes', () => {
  expect(sameStudioPictures(atlas, { ...atlas, width: 40 })).toBe(false);
  expect(sameStudioPictures(atlas, { ...atlas, image: undefined })).toBe(false);
  expect(sameStudioPictures(atlas, { kind: 'none' })).toBe(false);
  expect(sameStudioPictures(undefined, atlas)).toBe(false);
  expect(sameStudioPictures(atlas, { ...atlas })).toBe(true);
});
