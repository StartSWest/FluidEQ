/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import {
  crossfadeShapesMatch,
  defaultCrossfadeShape,
  ICrossfadeShape,
} from '../../common/dsp/crossfadeShape';
import { useTranslation } from '../utils/I18nContext';
import {
  CROSSFADE_CURVE_NAME_MAX,
  deleteCrossfadeCurve,
  ISavedCrossfadeCurve,
  readSavedCrossfadeCurves,
  saveCrossfadeCurve,
} from './crossfadeCurves';
import DspPresetSaveDialog from './DspPresetSaveDialog';

interface IDspCrossfadeCurveLibraryProps {
  shape: ICrossfadeShape;
  isDisabled: boolean;
  onApply: (shape: ICrossfadeShape) => void;
}

/**
 * Saving the dragged shape, and getting one back.
 *
 * On the card rather than behind a menu: a shape takes real work to make, and
 * a save control the user has to go looking for is one they will not find
 * until after they have lost the curve once.
 *
 * The saved shapes are drawn as the EQ page's applied-layer chip — the same
 * `.active-layer` pill, the same round remove button. A stored thing you can
 * put back is one kind of thing in this app, and it had been drawn two ways.
 */
const DspCrossfadeCurveLibrary = ({
  shape,
  isDisabled,
  onApply,
}: IDspCrossfadeCurveLibraryProps) => {
  const { t } = useTranslation();
  const [saved, setSaved] = useState<ISavedCrossfadeCurve[]>(() =>
    readSavedCrossfadeCurves(),
  );
  const [isNaming, setIsNaming] = useState(false);

  /**
   * Which of the saved shapes the fade is running, if it is running one.
   *
   * `find` rather than a test per pill, because the fade holds exactly one
   * shape: two curves saved under different names with the same handles would
   * otherwise both light up, and the row would claim the fade was using two.
   * Dragging a handle leaves every match and lights nothing, which is the
   * truth — what is on the plot is no longer a saved shape.
   */
  const appliedId = saved.find((curve) =>
    crossfadeShapesMatch(curve.shape, shape),
  )?.id;

  return (
    <div className="dsp-crossfade-library">
      <span className="dsp-band-title">{t('dsp.crossfade.shapeSection')}</span>
      <div className="dsp-crossfade-library__actions">
        <button
          type="button"
          className="button small"
          disabled={isDisabled}
          onClick={() => setIsNaming(true)}
        >
          {t('dsp.crossfade.saveCurve')}
        </button>
        <button
          type="button"
          className="button small subtle"
          disabled={isDisabled}
          onClick={() => onApply(defaultCrossfadeShape())}
        >
          {t('dsp.crossfade.resetCurve')}
        </button>
      </div>

      {saved.length > 0 && (
        <ul className="dsp-crossfade-library__list">
          {saved.map((curve) => {
            const isApplied = curve.id === appliedId;
            return (
              <li
                key={curve.id}
                className={`active-layer dsp-crossfade-curve${
                  isApplied ? ' is-applied' : ''
                }`}
              >
                <button
                  type="button"
                  className="active-layer__body"
                  aria-pressed={isApplied}
                  disabled={isDisabled}
                  title={
                    isApplied
                      ? t('dsp.crossfade.curveApplied')
                      : t('dsp.crossfade.applyCurve')
                  }
                  onClick={() => onApply(curve.shape)}
                >
                  {/* A dot on every pill, filled on the applied one. Drawn on
                      all of them rather than only where it is lit, so applying
                      a different shape does not resize the row under the
                      cursor that is still moving along it. */}
                  <span className="dsp-crossfade-curve__pip" aria-hidden />
                  <span className="active-layer__name" title={curve.name}>
                    {curve.name}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={isDisabled}
                  aria-label={`${t('dsp.crossfade.deleteCurve')} ${curve.name}`}
                  title={`${t('dsp.crossfade.deleteCurve')} ${curve.name}`}
                  onClick={() => setSaved(deleteCrossfadeCurve(curve.id))}
                >
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M3 3l6 6M9 3l-6 6" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {isNaming && (
        <DspPresetSaveDialog
          existing={saved.map((curve) => curve.name)}
          titleKey="dsp.crossfade.saveTitle"
          hintKey="dsp.crossfade.saveHint"
          placeholderKey="dsp.crossfade.savePlaceholder"
          nameMax={CROSSFADE_CURVE_NAME_MAX}
          onSave={(name) => {
            setSaved(saveCrossfadeCurve(name, shape));
            setIsNaming(false);
          }}
          onClose={() => setIsNaming(false)}
        />
      )}
    </div>
  );
};

export default DspCrossfadeCurveLibrary;
