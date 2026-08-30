/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import {
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

  return (
    <div className="dsp-crossfade-library">
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
          {saved.map((curve) => (
            <li key={curve.id} className="dsp-crossfade-library__item">
              <button
                type="button"
                className="button small subtle dsp-crossfade-library__apply"
                disabled={isDisabled}
                onClick={() => onApply(curve.shape)}
              >
                {curve.name}
              </button>
              <button
                type="button"
                className="button small subtle dsp-crossfade-library__delete"
                disabled={isDisabled}
                aria-label={`${t('dsp.crossfade.deleteCurve')} ${curve.name}`}
                onClick={() => setSaved(deleteCrossfadeCurve(curve.id))}
              >
                ×
              </button>
            </li>
          ))}
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
