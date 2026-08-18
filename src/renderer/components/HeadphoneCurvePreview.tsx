/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useMemo } from 'react';
import {
  AutoEqFormat,
  IFiltersMap,
  IHeadphoneSettings,
} from 'common/constants';
import { getHeadphoneFilters, getHeadphoneGraphicEq } from 'common/headphone';
import EqCurveChart from '../graph/EqCurveChart';
import { PREVIEW_BOX, makeCurve } from '../graph/curvePreview';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';

interface IHeadphoneCurvePreviewProps {
  headphone: IHeadphoneSettings | undefined;
  /** What is applied, in words. Shown in the corner of the chart. */
  appliedLabel?: string;
  onClear?: () => void;
  isClearDisabled?: boolean;
}

/**
 * The headphone correction as it is actually applied, drawn on its own.
 *
 * Its own layer, so its own graph: nothing the user's bands, a Squiglink import
 * or a custom file are doing appears here, and this curve appears in none of
 * their previews either. Two curves sharing an axis would suggest the two
 * choices interact, and they do not — a correction can be swapped without
 * touching a band.
 *
 * Drawn through `getHeadphoneFilters`, the same reading of the layer the
 * renderer hands to Equalizer APO, so the strength slider moves this curve and
 * a correction at zero strength draws nothing. The preamp is left out: it is
 * the whole stage's headroom, not part of the correction's shape.
 */
export default function HeadphoneCurvePreview({
  headphone,
  appliedLabel,
  onClear,
  isClearDisabled,
}: IHeadphoneCurvePreviewProps) {
  const { t } = useTranslation();

  const graphicEq = useMemo(
    () => getHeadphoneGraphicEq(headphone),
    [headphone],
  );
  const filters: IFiltersMap = useMemo(() => {
    const entries = getHeadphoneFilters(headphone).map((filter, index) => {
      const id = `headphone-${index}`;
      return [id, { ...filter, id }] as const;
    });
    return Object.fromEntries(entries);
  }, [headphone]);

  const bandCount = graphicEq.length > 0 ? 0 : Object.keys(filters).length;
  const curve = useMemo(
    () =>
      makeCurve(
        0,
        graphicEq.length > 0 ? AutoEqFormat.GRAPHIC : AutoEqFormat.PARAMETRIC,
        graphicEq,
        filters,
        PREVIEW_BOX,
      ),
    [filters, graphicEq],
  );

  // The box keeps its place with nothing applied. It is the right half of the
  // card, and a column that appears and disappears moves the pickers sideways
  // every time somebody clears a correction.
  if (!curve.path) {
    return (
      <div className="autoeq-curve autoeq-curve--empty">
        <MenuIcon name="graph" />
        <strong>{t('autoeq.notApplied')}</strong>
        <p>{t('autoeq.curveEmptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="autoeq-curve">
      <div className="autoeq-curve__head">
        <div className="autoeq-curve__title">
          <strong>{t('autoeq.curveTitle')}</strong>
          <small>
            {graphicEq.length > 0
              ? 'GraphicEQ'
              : t('eq.layers.eq.bands', { count: bandCount })}
          </small>
        </div>
        {appliedLabel && (
          <div className="autoeq-applied autoeq-curve__applied">
            <MenuIcon name="model" />
            <span>{appliedLabel}</span>
            {onClear && (
              <button
                type="button"
                className="autoeq-applied__clear"
                title={t('eq.layers.clearReference')}
                aria-label={t('eq.layers.clearReference')}
                disabled={isClearDisabled}
                onClick={onClear}
              >
                <MenuIcon name="clear" />
              </button>
            )}
          </div>
        )}
      </div>
      <EqCurveChart
        className="autoeq-curve__chart"
        box={PREVIEW_BOX}
        bounds={{ min: curve.min, max: curve.max }}
        ariaLabel={t('autoeq.curveAria')}
        defs={
          <linearGradient id="autoeq-curve-line" x1="0" x2="1">
            <stop offset="0" stopColor="#8ce2ff" />
            <stop offset="0.55" stopColor="#b9a7ff" />
            <stop offset="1" stopColor="#f3a8d7" />
          </linearGradient>
        }
        lines={[
          {
            id: 'headphone',
            path: curve.path,
            stroke: 'url(#autoeq-curve-line)',
          },
        ]}
      />
    </div>
  );
}
