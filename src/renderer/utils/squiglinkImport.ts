/* FluidEQ — GPL-3.0-or-later */

import { IState, NO_GAIN_FILTER_TYPES } from 'common/constants';

const SQUIGLINK_TEXT_STORAGE_KEY = 'fluideq.squiglink-import.text';

export const hasEqToReplace = ({
  eqImport,
  preAmp,
  graphicEq,
  filters,
}: Pick<IState, 'eqImport' | 'preAmp' | 'graphicEq' | 'filters'>): boolean =>
  Boolean(
    eqImport ||
    preAmp !== 0 ||
    graphicEq?.some(({ gain }) => gain !== 0) ||
    Object.values(filters).some(
      ({ gain, type }) => gain !== 0 || NO_GAIN_FILTER_TYPES.includes(type),
    ),
  );

export const readStoredEqText = (): string | undefined => {
  try {
    const stored = window.localStorage.getItem(SQUIGLINK_TEXT_STORAGE_KEY);
    return stored === null ? undefined : stored;
  } catch {
    return undefined;
  }
};

export const persistEqText = (value: string) => {
  try {
    window.localStorage.setItem(SQUIGLINK_TEXT_STORAGE_KEY, value);
  } catch {
    // The applied copy remains persisted with the EQ profile when storage is
    // unavailable in a restricted renderer.
  }
};
