/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useId, useRef } from 'react';
import type { IDspCatalogEntry } from '../../dsp/dspPresetCatalog';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import { PresetNotesBody } from '../presetCard/PresetNotes';

interface IOwnPresetNotesProps {
  preset: IDspCatalogEntry;
  isAskingDelete: boolean;
  isDisabled: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onAskDelete: () => void;
  onKeep: () => void;
  onDelete: () => void;
}

/**
 * Beside the grid, for one of the listener's presets: its name, what can be
 * done to it — Edit, the loud one, and Duplicate, Rename and Delete quietly
 * beside it — then what every preset's notes show: its curve drawn wide and
 * what its rack runs, stage by stage (`PresetNotesBody`). The actions
 * stand under the name, not at the foot, so a short pane never scrolls them
 * away. Delete asks in their place, naming the preset and what stops if it
 * is playing, before anything is gone.
 */
export const OwnPresetNotes = ({
  preset,
  isAskingDelete,
  isDisabled,
  onEdit,
  onDuplicate,
  onRename,
  onAskDelete,
  onKeep,
  onDelete,
}: IOwnPresetNotesProps) => {
  const { t } = useTranslation();
  const askId = useId();
  const confirmRef = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  // The safe answer takes the focus, as every question that deletes does in
  // this app; and the whole question is brought into view, not just the
  // button, which in a short pane scrolled the words it answers away.
  useEffect(() => {
    if (!isAskingDelete) {
      return;
    }
    keepRef.current?.focus({ preventScroll: true });
    confirmRef.current?.scrollIntoView({ block: 'nearest' });
  }, [isAskingDelete]);
  return (
    <>
      <div className="eq-preset-tab__about">
        <strong>{preset.name}</strong>
        <span>{t('eq.own.about')}</span>
      </div>
      {isAskingDelete ? (
        // A group the question names, not an alertdialog: the app gives every
        // dialog by role a dialog's floor and edge, and this is a line of the
        // notes, not a window over them.
        <div
          ref={confirmRef}
          className="own-preset-notes__confirm"
          role="group"
          aria-labelledby={askId}
        >
          <span className="own-preset-notes__confirm-head">
            <span
              className="own-preset-notes__confirm-glyph"
              aria-hidden="true"
            >
              <MenuIcon name="trash" />
            </span>
            <span id={askId}>
              {t('eq.own.deleteAsk', { name: preset.name })}
            </span>
          </span>
          <span className="own-preset-notes__actions">
            <button
              type="button"
              ref={keepRef}
              className="button small subtle"
              onClick={onKeep}
            >
              {t('eq.own.keep')}
            </button>
            <button
              type="button"
              className="button small danger"
              onClick={onDelete}
            >
              {t('myCurves.delete')}
            </button>
          </span>
        </div>
      ) : (
        <div className="own-preset-notes__actions">
          <button
            type="button"
            className="button small"
            disabled={isDisabled}
            onClick={onEdit}
          >
            {t('eq.own.edit')}
          </button>
          <button
            type="button"
            className="button small subtle"
            onClick={onDuplicate}
          >
            {t('myCurves.duplicate')}
          </button>
          <button
            type="button"
            className="button small subtle"
            onClick={onRename}
          >
            {t('myCurves.rename')}
          </button>
          <button
            type="button"
            className="button small subtle"
            onClick={onAskDelete}
          >
            {t('myCurves.delete')}
          </button>
        </div>
      )}
      <PresetNotesBody preset={preset} />
    </>
  );
};

/** Yours with nothing in it yet: what a preset of their own would be. */
export const OwnPresetsEmptyNotes = () => {
  const { t } = useTranslation();
  return (
    <div className="eq-preset-tab__about">
      <strong>{t('eq.own.emptyTitle')}</strong>
      <span>{t('eq.own.emptyHint')}</span>
    </div>
  );
};
