/* FluidEQ — GPL-3.0-or-later */

import {
  AutoEqFormat,
  ICustomFxSettings,
  IHeadphoneSettings,
  IState,
  NO_GAIN_FILTER_TYPES,
} from 'common/constants';
import { getHeadphoneFilters, getHeadphoneGraphicEq } from 'common/headphone';
import { IChartPointData } from '../graph/ChartController';
import {
  ICurvePath,
  PREVIEW_BOX,
  makeCurve,
  makePath,
} from '../graph/curvePreview';
import {
  getCombinedLineData,
  getFilterLineData,
  getGraphicEqLineData,
} from '../graph/utils';

const SQUIGLINK_TEXT_STORAGE_KEY = 'fluideq.squiglink-import.text';

export const formatName = (format?: AutoEqFormat) => {
  if (format === AutoEqFormat.GRAPHIC) {
    return 'GraphicEQ';
  }
  if (format === AutoEqFormat.FIXED_BAND) {
    return 'Fixed Band EQ';
  }
  return 'Parametric EQ';
};

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

export const makeCustomCurve = (customFx: ICustomFxSettings): ICurvePath => {
  const lines: Record<string, IChartPointData[]> = {};
  if (customFx.graphicEq?.length) {
    lines['custom-graphic'] = getGraphicEqLineData(customFx.graphicEq);
  }
  Object.values(customFx.filters).forEach((filter) => {
    lines[filter.id] = getFilterLineData(filter);
  });
  return makePath(getCombinedLineData(customFx.preAmp, lines), PREVIEW_BOX);
};

export const makeImportedHeadphoneCurve = (
  headphone: IHeadphoneSettings,
): ICurvePath => {
  const points = getHeadphoneGraphicEq(headphone);
  const filters = Object.fromEntries(
    getHeadphoneFilters(headphone).map((filter, index) => {
      const id = `import-${index}`;
      return [id, { ...filter, id }];
    }),
  );
  return makeCurve(
    0,
    points.length ? AutoEqFormat.GRAPHIC : AutoEqFormat.PARAMETRIC,
    points,
    filters,
    PREVIEW_BOX,
  );
};

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
