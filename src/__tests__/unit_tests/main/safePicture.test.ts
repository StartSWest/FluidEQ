/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Main decodes a project's picture, or one that came through a chat, only
 * once its header says it fits (`safePicture.ts`): a bomb never reaches
 * Electron's decoder at all, and comes back as an empty image.
 */

import { pngHeader } from '../../utils/pictureHeaders';

const decoded = {
  isEmpty: () => false,
  getSize: () => ({ width: 64, height: 64 }),
  toJPEG: () => Buffer.from('jpeg'),
  toBitmap: () => Buffer.alloc(4, 255),
};
const empty = { isEmpty: () => true };
const createFromBuffer = jest.fn((_bytes: Buffer) => decoded);
const createEmpty = jest.fn(() => empty);

jest.mock('electron', () => ({
  nativeImage: {
    createFromBuffer: (bytes: Buffer) => createFromBuffer(bytes),
    createEmpty: () => createEmpty(),
  },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import {
  pictureFromBytes,
  pictureFromDataUrl,
} from '../../../main/safePicture';
import {
  chatPictureFromDataUrl,
  chatPictureKeepingAlphaBytes,
} from '../../../main/studioChat/chatPicture';
/* eslint-enable import/first */

const dataUrl = (bytes: Uint8Array) =>
  `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;

beforeEach(() => {
  createFromBuffer.mockClear();
  createEmpty.mockClear();
});

describe('a picture decoded in main', () => {
  it('never hands a bomb to the decoder', () => {
    expect(pictureFromBytes(pngHeader(40000, 40000))).toBe(empty);
    expect(pictureFromDataUrl(dataUrl(pngHeader(40000, 40000)))).toBe(empty);
    expect(createFromBuffer).not.toHaveBeenCalled();
  });

  it('control: an ordinary picture is decoded, from bytes or a data URL', () => {
    expect(pictureFromBytes(pngHeader(64, 64))).toBe(decoded);
    expect(pictureFromDataUrl(dataUrl(pngHeader(64, 64)))).toBe(decoded);
    expect(createFromBuffer).toHaveBeenCalledTimes(2);
  });

  it('decodes nothing that is not a picture, or not a data URL of one', () => {
    expect(pictureFromBytes(new Uint8Array([1, 2, 3]))).toBe(empty);
    expect(pictureFromDataUrl('https://example.com/x.png')).toBe(empty);
    expect(pictureFromDataUrl('data:text/plain;base64,AAAA')).toBe(empty);
    expect(createFromBuffer).not.toHaveBeenCalled();
  });
});

describe("the chat's pictures", () => {
  // A picture Claude wrote into the project, or read there and handed back
  // through its stream: a stranger's file either way.
  it('keep nothing of a bomb, and never decode it', () => {
    expect(
      chatPictureKeepingAlphaBytes(pngHeader(40000, 40000)),
    ).toBeUndefined();
    expect(
      chatPictureFromDataUrl(dataUrl(pngHeader(40000, 40000))),
    ).toBeUndefined();
    expect(createFromBuffer).not.toHaveBeenCalled();
  });

  it('control: keep an ordinary one', () => {
    expect(chatPictureFromDataUrl(dataUrl(pngHeader(64, 64)))).toBe(
      `data:image/jpeg;base64,${Buffer.from('jpeg').toString('base64')}`,
    );
    expect(createFromBuffer).toHaveBeenCalledTimes(1);
  });
});
