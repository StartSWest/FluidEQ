/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { RefObject } from 'react';
import Glyph from '../../../community/Glyph';
import { useTranslation } from '../../../utils/I18nContext';
import { takeFiles } from './importDrop';
import type { IChosenFile } from './importFiles';

/** Every kind an import reads, for the system's file picker. */
const ACCEPTED =
  'image/png,image/jpeg,image/webp,image/gif,.png,.apng,.jpg,.jpeg,.webp,.gif,.ase,.aseprite,.json,application/json';

/**
 * The Animations tab's Import, in its head (Ivan, 2026-11-10: "that import
 * thing shall be a button"): the system's picker for the files an import
 * reads, which it names on hover. Files dropped anywhere on the tab come in
 * the same way (`useFileDrop`).
 */
export default function StudioAnimationImportButton({
  inputRef,
  onFiles,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onFiles: (files: IChosenFile[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <button
        type="button"
        className="button small subtle"
        title={t('studio.animationImport.formats')}
        onClick={() => inputRef.current?.click()}
      >
        <Glyph name="upload" />
        {t('studio.animationImport.button')}
      </button>
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
    </>
  );
}
