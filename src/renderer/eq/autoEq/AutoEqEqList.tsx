/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { normalizeForSearch } from 'common/library/grouping';
import { useTranslation } from '../../utils/I18nContext';
import { useSongSoundIndex } from '../../audio/songSoundIndex';
import { useLiveSongSound } from '../../audio/songSoundSession';
import { useSavedEqStates } from '../../audio/savedEqActions';
import AutoEqEqRow from './AutoEqEqRow';
import usePresenceList from '../../utils/usePresenceList';
import { orderSavedEqs, rowStateOf } from './AutoEqSavedEqs';

/**
 * Every saved EQ, the one on first and then the newest, each with the panel's
 * own row (Put on, Update, Rename, Duplicate, Delete): Manage's Saved EQs tab
 * in Auto EQ's panel, and the manage view of the bands toolbar's Save EQ
 * menu (Ivan, 2026-11-20: "put that inside the same save EQ menu"). Narrowed
 * by the search its owner holds.
 */
const AutoEqEqList = ({ search }: { search: string }) => {
  const { t } = useTranslation();
  const { eqs } = useSongSoundIndex();
  const live = useLiveSongSound();
  const states = useSavedEqStates(eqs);
  const needle = normalizeForSearch(search);
  const shown = orderSavedEqs(eqs, states).filter(
    (eq) => needle === '' || normalizeForSearch(eq.name).includes(needle),
  );
  // A saved EQ added grows into the list, one deleted folds out of it.
  const { rows, onRowAnimationEnd } = usePresenceList(shown, (eq) => eq.id);
  return (
    <ul className="eq-auto-eqs eq-auto-eqs--all">
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
      {shown.length === 0 && (
        <li className="eq-auto-eqs__empty">
          {t(needle === '' ? 'autoEq.eqs.empty' : 'autoEq.manage.noMatch')}
        </li>
      )}
    </ul>
  );
};

export default AutoEqEqList;
