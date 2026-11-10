/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { DragEvent, RefObject } from 'react';
import { useTranslation } from '../../../utils/I18nContext';
import type { IChosenFile } from './importFiles';
import '../../../styles/StudioAsk.scss';

/** Every kind an import reads, for the system's file picker. */
const ACCEPTED =
  'image/png,image/jpeg,image/webp,image/gif,.png,.apng,.jpg,.jpeg,.webp,.gif,.ase,.aseprite,.json,application/json';

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

/** Files dragged over: let them be dropped, and nothing else. */
export const allowFileDrop = (event: DragEvent) => {
  if (event.dataTransfer.types.includes('Files')) {
    event.preventDefault();
  }
};

/** Files dropped: taken in place of the browser opening them. */
export const dropFiles =
  (onFiles: (files: IChosenFile[]) => void) => (event: DragEvent) => {
    if (event.dataTransfer.files.length > 0) {
      event.preventDefault();
      takeFiles(event.dataTransfer.files, onFiles);
    }
  };

/**
 * Where an animation from outside comes in: the files chosen in the
 * system's picker (files dropped anywhere on the tab come in too). A tile
 * beside the one that says how to ask the chat for an animation, in its
 * look.
 */
export default function StudioAnimationImportCard({
  inputRef,
  onFiles,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onFiles: (files: IChosenFile[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <li className="studio-ask">
      <span className="studio-ask__title">
        {t('studio.animationImport.cardTitle')}
      </span>
      <span className="studio-ask__text">
        {t('studio.animationImport.cardText')}
      </span>
      <span>
        <button
          type="button"
          className="button small subtle"
          onClick={() => inputRef.current?.click()}
        >
          {t('studio.animationImport.choose')}
        </button>
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        hidden
        onChange={(event) => {
          takeFiles(event.target.files, onFiles);
          // The same files chosen again are a change too.
          event.target.value = '';
        }}
      />
    </li>
  );
}
