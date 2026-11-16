/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * A cover the reader picks, drops or pastes, read in the window: its bytes,
 * what it is and how big, and a preview. Only a JPEG or a PNG under the
 * size main accepts gets this far; main checks the bytes again anyway.
 */

import { MAX_COVER_BYTES } from '../../../common/library/tagFields';
import { readImageFacts } from '../../../common/library/tagImage';
import type { IDraftCover } from './tagDrafts';

export type TCoverRead =
  | { state: 'ok'; cover: IDraftCover }
  /** Not a JPEG or PNG, or past the size limit. */
  | { state: 'refused' }
  /** Nothing to read: an empty clipboard, a cancelled dialog. */
  | { state: 'none' };

let nextCoverId = 0;

export const readCoverBlob = async (blob: Blob): Promise<TCoverRead> => {
  if (blob.size === 0 || blob.size > MAX_COVER_BYTES) {
    return { state: 'refused' };
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const facts = readImageFacts(bytes);
  if (facts === undefined) {
    return { state: 'refused' };
  }
  nextCoverId += 1;
  return {
    state: 'ok',
    cover: {
      id: `cover-${nextCoverId}`,
      bytes,
      mime: facts.mime,
      url: URL.createObjectURL(new Blob([bytes], { type: facts.mime })),
      width: facts.width,
      height: facts.height,
    },
  };
};

/** The first image on the clipboard, if there is one. */
export const readCoverFromClipboard = async (): Promise<TCoverRead> => {
  try {
    const items = await navigator.clipboard.read();
    const item = items.find((candidate) =>
      candidate.types.some(
        (type) => type === 'image/png' || type === 'image/jpeg',
      ),
    );
    if (item === undefined) {
      return { state: 'none' };
    }
    const type = item.types.includes('image/png') ? 'image/png' : 'image/jpeg';
    return await readCoverBlob(await item.getType(type));
  } catch {
    return { state: 'none' };
  }
};

/** The first file of a drop that could be a cover. */
export const coverFileOfDrop = (data: DataTransfer): File | undefined =>
  Array.from(data.files).find((file) => /^image\/(png|jpeg)$/.test(file.type));
