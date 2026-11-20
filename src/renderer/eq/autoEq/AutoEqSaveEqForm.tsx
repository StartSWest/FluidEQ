/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import log from 'electron-log/renderer';
import { cleanSavedEqName } from 'common/savedEq';
import MenuIcon from '../../icons/MenuIcon';
import Switch from '../../widgets/Switch';
import TextInput from '../../widgets/TextInput';
import { useTranslation } from '../../utils/I18nContext';
import { useLiveSongSound } from '../../audio/songSoundSession';
import { saveCurrentEq } from '../../audio/savedEqActions';
import AutoEqSongHolds, { presetLine } from './AutoEqSongHolds';

/**
 * Save this EQ, in the panel itself and never a window over the app (the
 * mockup Ivan approved, 2026-11-20): a name already filled in, exactly what
 * will be kept, and the one switch — keep the preset with it, or leave it out
 * so it plays over any preset. The headphone correction and Smart correction
 * are never in it, and the line under the list says so. Save is the only
 * press: nothing is saved by itself.
 */
const AutoEqSaveEqForm = ({
  suggestedName,
  onDone,
}: {
  suggestedName: string;
  onDone: () => void;
}) => {
  const { t } = useTranslation();
  const live = useLiveSongSound();
  const [name, setName] = useState(suggestedName);
  const [keepPreset, setKeepPreset] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  // The name is what the press opened the form for: it takes the caret, all
  // of it chosen, so typing replaces the suggestion.
  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);

  const canSave = !!live && cleanSavedEqName(name) !== '' && !isSaving;
  const save = () => {
    if (!canSave) {
      return;
    }
    setIsSaving(true);
    setHasFailed(false);
    saveCurrentEq(name, keepPreset)
      .then(() => onDone())
      .catch((error: unknown) => {
        log.error('A saved EQ could not be kept', error);
        setIsSaving(false);
        setHasFailed(true);
      });
  };

  return (
    <div className="eq-auto-save-eq">
      <TextInput
        ref={field}
        value={name}
        ariaLabel={t('autoEq.eqs.name')}
        placeholder={t('autoEq.eqs.name')}
        isDisabled={isSaving}
        errorMessage={hasFailed ? t('autoEq.eqs.saveFailed') : ''}
        handleChange={setName}
        handleSubmit={save}
        handleEscape={onDone}
      />
      {live && (
        <AutoEqSongHolds
          sound={keepPreset ? live : { ...live, presetId: '' }}
          correctionNote={t('autoEq.eqs.stays')}
          presetValue={
            <span className="eq-auto-save-eq__preset">
              <span className={keepPreset ? undefined : 'is-faint'}>
                {keepPreset
                  ? presetLine(live.presetId, t)
                  : t('autoEq.eqs.anyPreset')}
              </span>
              <Switch
                id="eq-auto-save-eq-preset"
                isOn={keepPreset}
                isDisabled={isSaving}
                handleToggle={() => setKeepPreset((was) => !was)}
                ariaLabel={t('autoEq.eqs.keepPreset')}
              />
            </span>
          }
        />
      )}
      <div className="eq-auto-part__line eq-auto-save-eq__actions">
        <button type="button" className="button small subtle" onClick={onDone}>
          {t('autoEq.eqs.cancel')}
        </button>
        <button
          type="button"
          className="button small"
          disabled={!canSave}
          onClick={save}
        >
          <MenuIcon name="check" />
          {t('autoEq.eqs.save')}
        </button>
      </div>
    </div>
  );
};

export default AutoEqSaveEqForm;
