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

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ICueSheet } from '../../../common/library/cueSheet';
import type {
  ITagFolderFacts,
  ITrackTagSheet,
} from '../../../common/library/tagFields';
import { readCoverBlob } from './tagCover';
import type { IDraftCover } from './tagDrafts';

/** The album folder's picture, offered to the songs that carry none. */
export interface IFolderCoverOffer {
  /** The line's identity among Fix's ticks: `cover:` and the folder. */
  key: string;
  folder: string;
  fileName: string;
  /** Songs without a cover today: the picture goes to these alone. */
  trackIds: string[];
}

/** A picture asked for: its preview, or `refused` where it would not read. */
export type TFolderCover = IDraftCover | 'refused';

/** The one folder every one of `sheets` sits in, or `undefined`. */
export const folderOf = (
  sheets: readonly ITrackTagSheet[],
): string | undefined => {
  const folders = new Set(sheets.map((sheet) => sheet.folder));
  return folders.size === 1 ? [...folders][0] : undefined;
};

/** The CUE sheet an album's songs share, where they share a folder. */
export const cueOf = (
  sheets: readonly ITrackTagSheet[],
  facts: ReadonlyMap<string, ITagFolderFacts>,
): ICueSheet | undefined => {
  const folder = folderOf(sheets);
  return folder === undefined ? undefined : facts.get(folder)?.cue;
};

/**
 * The folder picture for an album whose songs share a folder and carry no
 * cover at all. An album where some songs have one is left alone: the
 * editor's cover goes to every song, and the picture inside a file was put
 * there on purpose, where the one beside the files is a guess.
 */
export const coverOfferOf = (
  sheets: readonly ITrackTagSheet[],
  facts: ReadonlyMap<string, ITagFolderFacts>,
): IFolderCoverOffer | undefined => {
  const folder = folderOf(sheets);
  const cover = folder === undefined ? undefined : facts.get(folder)?.cover;
  const without = sheets.filter((sheet) => sheet.cover === undefined);
  if (
    folder === undefined ||
    cover === undefined ||
    without.length === 0 ||
    without.length !== sheets.length
  ) {
    return undefined;
  }
  return {
    key: `cover:${folder}`,
    folder,
    fileName: cover.fileName,
    trackIds: without.map((sheet) => sheet.trackId),
  };
};

/**
 * What the songs' album folders hold, asked of main once per set of songs,
 * and their pictures, read one album at a time as they are needed. Every
 * preview made is let go when the page closes.
 */
export const useTagFolders = (ids: readonly string[]) => {
  const [facts, setFacts] = useState<ReadonlyMap<string, ITagFolderFacts>>(
    () => new Map(),
  );
  const [covers, setCovers] = useState<ReadonlyMap<string, TFolderCover>>(
    () => new Map(),
  );
  /** True once main has answered, even with nothing: Fix waits for it. */
  const [isRead, setIsRead] = useState(false);
  const urls = useRef<string[]>([]);

  useEffect(() => {
    let isCurrent = true;
    if (ids.length === 0) {
      return undefined;
    }
    window.electron.ipcRenderer
      .readLibraryTagFolders(ids)
      .then((answer) => {
        if (isCurrent) {
          setFacts(new Map(answer.map((entry) => [entry.folder, entry])));
          setIsRead(true);
        }
        return undefined;
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; Fix proposes from names alone
        console.error('Could not read the album folders for Fix tags', error);
        if (isCurrent) {
          setIsRead(true);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [ids]);

  useEffect(
    () => () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
      urls.current = [];
    },
    [],
  );

  /**
   * The offer's picture, read once per folder: an ask while it is being
   * read, or after, answers with the same read. It holds no state of its
   * own, so it is one function for the page's life.
   */
  const reads = useRef(new Map<string, Promise<TFolderCover>>());
  const loadCover = useCallback((offer: IFolderCoverOffer) => {
    const known = reads.current.get(offer.folder);
    if (known) {
      return known;
    }
    const read = (async (): Promise<TFolderCover> => {
      const [askId] = offer.trackIds;
      if (askId === undefined) {
        return 'refused';
      }
      const picked =
        await window.electron.ipcRenderer.readLibraryTagFolderCover(askId);
      if (picked.state !== 'ok') {
        return 'refused';
      }
      const blob = await readCoverBlob(
        new Blob([new Uint8Array(picked.bytes)]),
      );
      return blob.state === 'ok' ? blob.cover : 'refused';
    })().then((cover) => {
      if (cover !== 'refused') {
        urls.current.push(cover.url);
      }
      setCovers((current) => new Map(current).set(offer.folder, cover));
      return cover;
    });
    reads.current.set(offer.folder, read);
    return read;
  }, []);

  return { facts, covers, isRead, loadCover };
};
