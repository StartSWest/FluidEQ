/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  CROSSFADE_CURVES,
  DSP_DEFAULTS,
  ICrossfadeSettings,
  TCrossfadeCurve,
} from '../../common/dsp/chain';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import { Dial, ProcessorCard } from './DspControls';
import { useDspCrossfadeMeter } from './deckCrossfade';

interface IDspCrossfadeCardProps {
  crossfade: ICrossfadeSettings;
  onPatch: (next: ICrossfadeSettings) => void;
  onCommit: () => void;
}

const CURVE_LABELS: Record<TCrossfadeCurve, TranslationKey> = {
  equalPower: 'dsp.crossfade.equalPower',
  smooth: 'dsp.crossfade.smooth',
  linear: 'dsp.crossfade.linear',
};

const curvePath = (curve: TCrossfadeCurve, incoming: boolean): string => {
  if (curve === 'linear') {
    return incoming ? 'M16 94 L184 18' : 'M16 18 L184 94';
  }
  if (curve === 'smooth') {
    return incoming
      ? 'M16 94 C72 94 128 18 184 18'
      : 'M16 18 C72 18 128 94 184 94';
  }
  return incoming
    ? 'M16 94 C54 94 80 52 104 36 C128 20 154 18 184 18'
    : 'M16 18 C54 18 80 20 104 36 C128 52 154 94 184 94';
};

const DspCrossfadeCard = ({
  crossfade,
  onPatch,
  onCommit,
}: IDspCrossfadeCardProps) => {
  const { t } = useTranslation();
  const meter = useDspCrossfadeMeter();
  const markerX = 16 + meter.progress * 168;
  const outgoingMarkerY = 94 - meter.outgoingGain * 76;
  const incomingMarkerY = 94 - meter.incomingGain * 76;

  const selectCurve = (curve: TCrossfadeCurve) => {
    onPatch({ ...crossfade, curve });
    onCommit();
  };

  return (
    <ProcessorCard
      id="dsp-crossfade"
      titleKey="dsp.crossfade.title"
      descriptionKey="dsp.crossfade.description"
      isEnabled={crossfade.enabled}
      onToggle={() => {
        onPatch({ ...crossfade, enabled: !crossfade.enabled });
        onCommit();
      }}
    >
      <div className="dsp-crossfade-layout">
        <section className="dsp-crossfade-preview" aria-hidden="true">
          <span className="dsp-crossfade-preview-label is-outgoing">
            {t('dsp.crossfade.outgoing')}
          </span>
          <svg viewBox="0 0 200 112" preserveAspectRatio="none">
            <path className="dsp-crossfade-grid" d="M16 56 H184 M100 12 V100" />
            <path
              className="dsp-crossfade-line is-outgoing"
              d={curvePath(crossfade.curve, false)}
            />
            <path
              className="dsp-crossfade-line is-incoming"
              d={curvePath(crossfade.curve, true)}
            />
            {meter.active ? (
              <>
                <line
                  className="dsp-crossfade-playhead"
                  x1={markerX}
                  y1="12"
                  x2={markerX}
                  y2="100"
                />
                <circle
                  className="dsp-crossfade-marker is-outgoing"
                  cx={markerX}
                  cy={outgoingMarkerY}
                  r="4"
                />
                <circle
                  className="dsp-crossfade-marker is-incoming"
                  cx={markerX}
                  cy={incomingMarkerY}
                  r="4"
                />
              </>
            ) : undefined}
          </svg>
          <span className="dsp-crossfade-preview-label is-incoming">
            {t('dsp.crossfade.incoming')}
          </span>
          <span className="dsp-crossfade-time">
            {(crossfade.durationMs / 1_000)
              .toFixed(2)
              .replace(/0+$/, '')
              .replace(/\.$/, '')}{' '}
            s
          </span>
          <div
            className={`dsp-crossfade-live${meter.active ? ' is-active' : ''}`}
          >
            <span className="is-outgoing">
              {t('dsp.crossfade.outgoing')}{' '}
              {Math.round(meter.outgoingGain * 100)}%
            </span>
            <span className="is-incoming">
              {t('dsp.crossfade.incoming')}{' '}
              {Math.round(meter.incomingGain * 100)}%
            </span>
          </div>
        </section>

        <section className="dsp-crossfade-controls">
          <Dial
            labelKey="dsp.crossfade.duration"
            value={crossfade.durationMs / 1_000}
            defaultValue={DSP_DEFAULTS.crossfade.durationMs / 1_000}
            min={0.25}
            max={12}
            unit="s"
            step={0.05}
            isDisabled={!crossfade.enabled}
            onCommit={onCommit}
            onChange={(seconds) =>
              onPatch({ ...crossfade, durationMs: Math.round(seconds * 1_000) })
            }
          />
          <div className="dsp-crossfade-curve-control">
            <span className="dsp-band-title">{t('dsp.crossfade.curve')}</span>
            <div
              className="segmented"
              role="group"
              aria-label={t('dsp.crossfade.curve')}
            >
              {CROSSFADE_CURVES.map((curve) => (
                <button
                  key={curve}
                  type="button"
                  className={`segmented__option${
                    crossfade.curve === curve ? ' is-selected' : ''
                  }`}
                  aria-pressed={crossfade.curve === curve}
                  disabled={!crossfade.enabled}
                  onClick={() => selectCurve(curve)}
                >
                  {t(CURVE_LABELS[curve])}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
      <p className="dsp-band-hint dsp-crossfade-hint">
        {t('dsp.crossfade.hint')}
      </p>
    </ProcessorCard>
  );
};

export default DspCrossfadeCard;
