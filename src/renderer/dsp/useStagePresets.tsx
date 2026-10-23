/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ReactNode, useEffect, useState } from 'react';
import { IDspSettings } from '../../common/dsp/chain';
import {
  TPresetStage,
  applyStagePreset,
  isStagePresetId,
} from '../../common/dsp/stagePresets';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import { IRichPickEntry } from '../widgets/RichPick';
import DspBarIcon from './DspBarIcon';
import DspPresetSaveDialog from './DspPresetSaveDialog';
import { DSP_PRESETS_CHANGED } from './favouriteDspPresets';
import { SAVED_GROUP } from './presetPickEntries';
import {
  IStagePreset,
  STAGE_PRESET_NAME_MAX,
  readStagePresets,
  removeStagePreset,
  saveStagePreset,
} from './stagePresetStore';

export interface IStagePresets {
  /** The saved profiles as picker rows, under "Yours", to go first. */
  entries: IRichPickEntry[];
  /** Puts a saved profile on the stage; false for an id that is not one. */
  apply: (id: string) => boolean;
  /** "Yours" for the saved group, and nothing for any other. */
  savedGroupLabel: (group: string | undefined) => string | undefined;
  /** Save, and Delete while a saved profile is showing: for the bar's group. */
  buttons: ReactNode;
  /** What a save or delete did, on a line of the header's own. */
  notice: ReactNode;
  /** The naming dialog while it is open. */
  dialog: ReactNode;
}

/**
 * A stage's saved profiles, for its bar: the same Save and Delete the EQ's
 * bar has, the same naming dialog and the same "Yours" heading, so every
 * stage saves the way the EQ always has.
 *
 * The bar keeps its picker and its factory list and adds these: the rows go
 * first in its entries, `apply` is asked before its catalogue, and the three
 * pieces of markup go where the EQ's bar puts its own.
 */
const useStagePresets = <S extends TPresetStage>(
  stage: S,
  current: IDspSettings[S],
  onChange: (next: IDspSettings[S]) => void,
  onCommit: () => void,
): IStagePresets => {
  const { t } = useTranslation();
  const [saved, setSaved] = useState<IStagePreset<S>[]>(() =>
    readStagePresets(stage),
  );
  const [isNaming, setIsNaming] = useState(false);
  const [notice, setNotice] = useState('');

  // Another stage's save, another window's, or this one's: each re-reads.
  useEffect(() => {
    const changed = () => setSaved(readStagePresets(stage));
    window.addEventListener(DSP_PRESETS_CHANGED, changed);
    window.addEventListener('storage', changed);
    return () => {
      window.removeEventListener(DSP_PRESETS_CHANGED, changed);
      window.removeEventListener('storage', changed);
    };
  }, [stage]);

  const showing = saved.find((one) => one.id === current.presetId);

  const apply = (id: string): boolean => {
    if (!isStagePresetId(stage, id)) {
      return false;
    }
    const found = saved.find((one) => one.id === id);
    if (!found) {
      return false;
    }
    onChange(applyStagePreset(stage, found.settings, current, found.id));
    onCommit();
    setNotice('');
    return true;
  };

  const save = (name: string) => {
    setIsNaming(false);
    const result = saveStagePreset(stage, name, current);
    if (!result) {
      setNotice(t('dsp.stageSave.failed'));
      return;
    }
    // Selected straight away, so the picker names what was just saved.
    onChange({ ...current, presetId: result.id });
    onCommit();
    setNotice(t('dsp.eqSave.saved', { name: result.name }));
  };

  const remove = () => {
    if (!showing) {
      return;
    }
    if (!removeStagePreset(stage, showing.id)) {
      setNotice(t('dsp.stageSave.failed'));
      return;
    }
    onChange({ ...current, presetId: '' });
    onCommit();
    setNotice(t('dsp.eqSave.deleted', { name: showing.name }));
  };

  return {
    entries: saved.map((one) => ({
      id: one.id,
      name: one.name,
      hint: '',
      group: SAVED_GROUP,
      icon: <VoicingIcon className="rich-pick__glyph" />,
    })),
    apply,
    savedGroupLabel: (group) =>
      group === SAVED_GROUP ? t('dsp.eqPreset.saved') : undefined,
    buttons: (
      <>
        <button
          type="button"
          className="button small subtle"
          title={t('dsp.stageSave.hint')}
          onClick={() => {
            setNotice('');
            setIsNaming(true);
          }}
        >
          <DspBarIcon name="save" />
          {t('dsp.eqSave.save')}
        </button>
        {/* Only for a saved one: there is nothing to delete about a factory
            profile, and a button that is present but refuses is worse than
            one that is not there. */}
        {showing ? (
          <button
            type="button"
            className="button small subtle"
            onClick={remove}
          >
            <DspBarIcon name="delete" />
            {t('dsp.eqSave.delete')}
          </button>
        ) : null}
      </>
    ),
    notice:
      notice === '' ? null : (
        <p className="dsp-eq-notice" role="status">
          {notice}
        </p>
      ),
    dialog: isNaming ? (
      <DspPresetSaveDialog
        existing={saved.map((one) => one.name)}
        titleKey="dsp.eqSave.title"
        hintKey="dsp.stageSave.hint"
        placeholderKey="dsp.eqSave.placeholder"
        nameMax={STAGE_PRESET_NAME_MAX}
        onSave={save}
        onClose={() => setIsNaming(false)}
      />
    ) : null,
  };
};

export default useStagePresets;
