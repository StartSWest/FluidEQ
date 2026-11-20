/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { ISavedEqSummary } from 'common/songSoundMemory';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import { useSongSoundIndex } from '../../audio/songSoundIndex';
import { useLiveSongSound } from '../../audio/songSoundSession';
import {
  type ISavedEqStates,
  useSavedEqStates,
} from '../../audio/savedEqActions';
import AutoEqEqRow from './AutoEqEqRow';
import usePresenceList from '../../utils/usePresenceList';
import { type TViewStep, viewClass } from '../../utils/viewStep';
import AutoEqSaveEqForm from './AutoEqSaveEqForm';

/** The panel lists this many; See all opens the rest in Manage. */
const SHOWN = 3;

/** Newest changed first, and the one on — playing or changed — above all. */
export const orderSavedEqs = (
  eqs: readonly ISavedEqSummary[],
  states: ISavedEqStates,
): ISavedEqSummary[] => {
  const on = states.playingId ?? states.changedId;
  return [...eqs].sort((a, b) => {
    if (a.id === on || b.id === on) {
      return a.id === on ? -1 : 1;
    }
    return b.updatedAt - a.updatedAt;
  });
};

export const rowStateOf = (
  eq: ISavedEqSummary,
  states: ISavedEqStates,
): 'playing' | 'changed' | undefined => {
  if (eq.id === states.playingId) {
    return 'playing';
  }
  return eq.id === states.changedId ? 'changed' : undefined;
};

/**
 * Saved EQs, a part of Auto EQ's panel under Album sounds (Ivan, 2026-11-20:
 * "let's have one option inside for EQs too"; the mockup approved with its
 * recommendations): keep what plays under a name, put one back on in one
 * press, see which one plays. It has no switch: it decides nothing by itself.
 * Songs and albums are given one where they are given a sound — Song sounds'
 * "Use a saved EQ", and the Library's sound menu.
 */
const AutoEqSavedEqs = ({ onSeeAll }: { onSeeAll: () => void }) => {
  const { t } = useTranslation();
  const { eqs } = useSongSoundIndex();
  const live = useLiveSongSound();
  const states = useSavedEqStates(eqs);
  const [isSaving, setIsSaving] = useState(false);
  // The form slides in from the right, and the list back from the left.
  const [step, setStep] = useState<TViewStep>();
  const shown = orderSavedEqs(eqs, states).slice(0, SHOWN);
  const { rows, onRowAnimationEnd } = usePresenceList(shown, (eq) => eq.id);
  const openForm = () => {
    setIsSaving(true);
    setStep('forward');
  };
  const closeForm = () => {
    setIsSaving(false);
    setStep('back');
  };
  const saveButton = (
    <button
      type="button"
      className="button small subtle"
      disabled={!live}
      onClick={openForm}
    >
      <MenuIcon name="plus" />
      {t('autoEq.eqs.saveThis')}
    </button>
  );

  return (
    <section className="eq-auto-part" aria-labelledby="eq-auto-eqs-title">
      <div className="eq-auto-part__head">
        <div className="eq-auto-part__words">
          <strong id="eq-auto-eqs-title">
            {isSaving ? t('autoEq.eqs.saveThis') : t('autoEq.eqs.title')}
          </strong>
          {!isSaving && <span>{t('autoEq.eqs.hint')}</span>}
        </div>
        {!isSaving && eqs.length > 0 && saveButton}
      </div>
      {isSaving && (
        <div className={viewClass(step)}>
          <AutoEqSaveEqForm
            suggestedName={t('autoEq.eqs.defaultName', {
              count: eqs.length + 1,
            })}
            onCancel={closeForm}
            onSaved={closeForm}
          />
        </div>
      )}
      {!isSaving && eqs.length === 0 && (
        <div className="eq-auto-part__line">
          <span>{t('autoEq.eqs.empty')}</span>
          {saveButton}
        </div>
      )}
      {!isSaving && eqs.length > 0 && (
        <ul className={`eq-auto-eqs ${viewClass(step)}`}>
          {rows.map(({ key, item: eq, phase }) => (
            <AutoEqEqRow
              key={key}
              eq={eq}
              state={rowStateOf(eq, states)}
              canPutOn={!!live}
              phase={phase}
              onAnimationEnd={onRowAnimationEnd(key)}
            />
          ))}
        </ul>
      )}
      {!isSaving && eqs.length > SHOWN && (
        <div className="eq-auto-part__line">
          <span className="eq-auto-eqs__more">
            {t('autoEq.eqs.moreCount', { count: eqs.length - SHOWN })}
          </span>
          <button
            type="button"
            className="button small subtle"
            onClick={onSeeAll}
          >
            {t('autoEq.eqs.seeAll', { count: eqs.length })}
          </button>
        </div>
      )}
    </section>
  );
};

export default AutoEqSavedEqs;
