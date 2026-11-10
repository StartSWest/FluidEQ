/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, useState, type DragEvent } from 'react';
import type { IChosenFile } from './importFiles';

/** The files as an import takes them: each one's name and bytes. */
export const chosenFiles = (list: FileList | null): Promise<IChosenFile[]> =>
  Promise.all(
    Array.from(list ?? []).map(async (file) => ({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })),
  );

/** `list` read, and handed on when it holds anything. */
export const takeFiles = (
  list: FileList | null,
  onFiles: (files: IChosenFile[]) => void,
) => {
  chosenFiles(list)
    .then((files) => {
      if (files.length > 0) {
        onFiles(files);
      }
      return undefined;
    })
    .catch(() => undefined);
};

const carriesFiles = (event: DragEvent) =>
  event.dataTransfer.types.includes('Files');

/**
 * Files dropped anywhere on an element are an import, and while they are
 * held over it `over` says so, for the element to show where they will
 * land. Entering and leaving are counted, because every child the pointer
 * crosses sends its own pair: a plain flag went out and back in at each.
 */
export default function useFileDrop(onFiles: (files: IChosenFile[]) => void) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const settle = () => {
    depth.current = 0;
    setOver(false);
  };
  return {
    over,
    onDragEnter: (event: DragEvent) => {
      if (carriesFiles(event)) {
        depth.current += 1;
        setOver(true);
      }
    },
    onDragOver: (event: DragEvent) => {
      if (carriesFiles(event)) {
        event.preventDefault();
      }
    },
    onDragLeave: (event: DragEvent) => {
      if (carriesFiles(event)) {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) {
          setOver(false);
        }
      }
    },
    onDrop: (event: DragEvent) => {
      settle();
      if (event.dataTransfer.files.length > 0) {
        event.preventDefault();
        takeFiles(event.dataTransfer.files, onFiles);
      }
    },
  };
}
