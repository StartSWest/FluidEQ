/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../../utils/I18nContext';
import {
  type ISmartEqPreview,
  requestSmartEqRemeasure,
  useSmartEqPreview,
} from '../../utils/smartEqPreview';
import {
  smartHeardSeconds,
  smartPhaseNote,
  smartPhaseWord,
} from './smartPhaseWords';

/**
 * Smart correction's song, as the panel tells it: Listening and the music
 * heard, Settling, then Held for this song with Measure again beside it.
 * Under the words, one short bar per range, the graph's foot in small, so
 * the panel and the plot read as one measurement.
 *
 * Its own component because the heard time moves every half second: down
 * here that redraws one line, not the panel.
 *
 * The view takes the measurement it tells, so 2.6's What's New draws the
 * same line on a made-up song (`featureTour/live26/AutoEqLive.tsx`).
 */
export const AutoEqSmartStatusView = ({
  preview,
  onAgain,
}: {
  preview: ISmartEqPreview;
  onAgain: () => void;
}) => {
  const { t, locale } = useTranslation();
  const isHeld = preview.phase === 'held';
  const heard = smartHeardSeconds(preview, t, locale);

  return (
    <div
      className={`eq-auto-smart__status is-${preview.phase}${
        preview.isSilent ? ' is-silent' : ''
      }`}
    >
      <div className="eq-auto-smart__row">
        <span className="eq-auto-smart__dot" aria-hidden="true" />
        {/* The word alone is announced: the seconds would be read out
            twice a second. */}
        <span className="eq-auto-smart__word" role="status">
          {smartPhaseWord(preview, t)}
        </span>
        {heard && (
          <span className="eq-auto-smart__heard" aria-hidden="true">
            {heard}
          </span>
        )}
        {isHeld && (
          <button
            type="button"
            className="button small subtle eq-auto-smart__again"
            title={t('autoEq.smart.againHint')}
            onClick={onAgain}
          >
            {t('autoEq.smart.again')}
          </button>
        )}
      </div>
      {!isHeld && preview.regions.length > 0 && (
        <span className="eq-auto-smart__ranges" aria-hidden="true">
          {preview.regions.map((region) => (
            <span
              key={region.label}
              className={`eq-auto-smart__range${
                region.isCovered ? ' is-covered' : ''
              }`}
            >
              <span
                style={{
                  width: `${Math.min(1, region.confidence) * 100}%`,
                }}
              />
            </span>
          ))}
        </span>
      )}
      <p className="eq-auto-smart__note">{smartPhaseNote(preview, t)}</p>
    </div>
  );
};

const AutoEqSmartStatus = () => (
  <AutoEqSmartStatusView
    preview={useSmartEqPreview()}
    onAgain={requestSmartEqRemeasure}
  />
);

export default AutoEqSmartStatus;
