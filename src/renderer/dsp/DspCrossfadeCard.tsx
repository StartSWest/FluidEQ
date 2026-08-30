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
import { ICrossfadeShape } from '../../common/dsp/crossfadeShape';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import { Dial, ProcessorCard } from './DspControls';
import { crossfadeGain, useDspCrossfadeMeter } from './deckCrossfade';
import DspCrossfadeCurveEditor from './DspCrossfadeCurveEditor';
import DspCrossfadeCurveLibrary from './DspCrossfadeCurveLibrary';

interface IDspCrossfadeCardProps {
  crossfade: ICrossfadeSettings;
  onPatch: (next: ICrossfadeSettings) => void;
  onCommit: () => void;
}

const CURVE_LABELS: Record<TCrossfadeCurve, TranslationKey> = {
  equalPower: 'dsp.crossfade.equalPower',
  smooth: 'dsp.crossfade.smooth',
  linear: 'dsp.crossfade.linear',
  custom: 'dsp.crossfade.custom',
};

/**
 * The plot area inside the 200x112 viewBox. The markers and the lines both go
 * through these, because they used to disagree: the curves were hand-drawn
 * beziers and the markers read the real gain, so the equal-power sketch — an S
 * that reached 0.74 at the midpoint where the audible curve sits at 0.50 —
 * left both dots hanging well below their own line.
 */
const PLOT_LEFT = 16;
const PLOT_RIGHT = 184;
const PLOT_BOTTOM = 94;
const PLOT_HEIGHT = 76;
const CURVE_SEGMENTS = 48;

const plotX = (progress: number): number =>
  PLOT_LEFT + progress * (PLOT_RIGHT - PLOT_LEFT);

const plotY = (gain: number): number => PLOT_BOTTOM - gain * PLOT_HEIGHT;

const curvePath = (
  curve: TCrossfadeCurve,
  incoming: boolean,
  shape: ICrossfadeShape,
): string =>
  Array.from({ length: CURVE_SEGMENTS + 1 }, (_, index) => {
    const progress = index / CURVE_SEGMENTS;
    const x = plotX(progress).toFixed(2);
    const y = plotY(crossfadeGain(curve, progress, incoming, shape)).toFixed(2);
    return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
  }).join(' ');

/**
 * What the two decks add up to, which is not a constant once the shape is
 * dragged.
 *
 * Drawn because it is the one consequence of dragging that cannot be seen in
 * the two curves themselves: pull both handles up at the midpoint and the fade
 * bulges 3 dB, which is heard as a swell and can clip a dense mix. Above 1 it
 * is drawn in the warning colour rather than hidden, because the shapes that
 * do it — the DJ hold, the long bleed — are ones people genuinely want.
 */
const sumPath = (curve: TCrossfadeCurve, shape: ICrossfadeShape): string =>
  Array.from({ length: CURVE_SEGMENTS + 1 }, (_, index) => {
    const progress = index / CURVE_SEGMENTS;
    const sum =
      crossfadeGain(curve, progress, false, shape) +
      crossfadeGain(curve, progress, true, shape);
    const x = plotX(progress).toFixed(2);
    // Clamped to the plot: a sum of 2 is off the top of a chart whose ceiling
    // is unity, and a line that leaves the box tells the user nothing.
    const y = plotY(Math.min(1, sum)).toFixed(2);
    return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
  }).join(' ');

/** Pointer position back to a point on the plot, for a dragged handle. */
const fromClient = (
  clientX: number,
  clientY: number,
  bounds: DOMRect,
): { at: number; gain: number } => {
  // `preserveAspectRatio="none"` means the two axes scale independently, so
  // each is mapped from its own edge rather than through a shared factor.
  const x = ((clientX - bounds.left) / bounds.width) * 200;
  const y = ((clientY - bounds.top) / bounds.height) * 112;
  return {
    at: (x - PLOT_LEFT) / (PLOT_RIGHT - PLOT_LEFT),
    gain: (PLOT_BOTTOM - y) / PLOT_HEIGHT,
  };
};

const DspCrossfadeCard = ({
  crossfade,
  onPatch,
  onCommit,
}: IDspCrossfadeCardProps) => {
  const { t } = useTranslation();
  const meter = useDspCrossfadeMeter();
  const markerX = plotX(meter.progress);
  const outgoingMarkerY = plotY(meter.outgoingGain);
  const incomingMarkerY = plotY(meter.incomingGain);
  // While a fade is audible the preview belongs to that fade, not to the
  // picker. Choosing a different curve mid-fade changes the next one — the
  // running automation is already on the audio clock — so drawing the new
  // choice here would put the markers off their own line for the rest of it.
  const drawnCurve = meter.active ? meter.curve : crossfade.curve;
  const drawnShape = meter.active ? meter.shape : crossfade.shape;
  const isCustom = crossfade.curve === 'custom';

  const selectCurve = (curve: TCrossfadeCurve) => {
    onPatch({ ...crossfade, curve });
    onCommit();
  };

  const patchShape = (shape: ICrossfadeShape) => {
    onPatch({ ...crossfade, shape });
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
        {/*
          Not `aria-hidden` once the handles are in it: they are real controls
          with a role and a value, and a focusable control inside a hidden
          subtree is reachable by tab and invisible to a screen reader.
        */}
        <section
          className={`dsp-crossfade-preview${isCustom ? ' is-editable' : ''}`}
          role="group"
          aria-label={t('dsp.crossfade.title')}
        >
          <span className="dsp-crossfade-preview-label is-outgoing">
            {t('dsp.crossfade.outgoing')}
          </span>
          <svg viewBox="0 0 200 112" preserveAspectRatio="none">
            <path className="dsp-crossfade-grid" d="M16 56 H184 M100 12 V100" />
            <path
              className="dsp-crossfade-sum"
              d={sumPath(drawnCurve, drawnShape)}
            />
            <path
              className="dsp-crossfade-line is-outgoing"
              d={curvePath(drawnCurve, false, drawnShape)}
            />
            <path
              className="dsp-crossfade-line is-incoming"
              d={curvePath(drawnCurve, true, drawnShape)}
            />
            {isCustom ? (
              <DspCrossfadeCurveEditor
                shape={crossfade.shape}
                isDisabled={!crossfade.enabled}
                onPatch={patchShape}
                onCommit={onCommit}
                plotX={plotX}
                plotY={plotY}
                fromClient={fromClient}
              />
            ) : undefined}
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
          {isCustom ? (
            <DspCrossfadeCurveLibrary
              shape={crossfade.shape}
              isDisabled={!crossfade.enabled}
              onApply={(shape) => {
                onPatch({ ...crossfade, shape });
                onCommit();
              }}
            />
          ) : undefined}
        </section>
      </div>
      <p className="dsp-band-hint dsp-crossfade-hint">
        {t('dsp.crossfade.hint')}
      </p>
    </ProcessorCard>
  );
};

export default DspCrossfadeCard;
