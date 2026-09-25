/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { DSP_DEFAULTS, IDimensionSettings } from '../../common/dsp/chain';
import LiveFigure from '../components/LiveFigure';
import { useTranslation } from '../utils/I18nContext';
import { Dial, ProcessorCard } from './DspControls';
import DspDimensionBar from './DspDimensionBar';
import DspDimensionGraph from './DspDimensionGraph';
import { startGraphLoop } from './graphLoop';
import { readDspDimensionGuard, useDspSampleRate } from './store';
import writeLiveText from '../utils/liveText';

/** The guard's reading at its widest, and the dash of a stage not running. */
const GUARD_WIDEST = ['100%', '—'];

/**
 * The fill standing at `fraction` of its track.
 *
 * Slid rather than sized: the fill keeps the track's whole width and is moved
 * left by what the guard is holding back, inside a track that clips it. A
 * width changes the layout of the grid it stands in, every frame, and the
 * window is laid out up to its root with it; a transform lays nothing out.
 * Slid rather than scaled because a scaled fill would squash its rounded end
 * into a flat one as the guard closed — sliding keeps it the shape it was.
 */
const guardFill = (fraction: number) =>
  `translateX(${((fraction - 1) * 100).toFixed(1)}%)`;

interface IDspDimensionCardProps {
  dimension: IDimensionSettings;
  onPatch: (next: IDimensionSettings) => void;
  onCommit: () => void;
}

/**
 * How wide the guard is letting the stage go, and why it stopped.
 *
 * The curve above already sinks toward unity when the guard closes, so this is
 * the number behind that movement rather than a second way of saying it. Both
 * read the same published value, so the picture and the figure cannot disagree.
 *
 * Polled on an animation frame rather than held in React state: the value moves
 * every audio block, and a render per block is a repaint the display cannot use
 * and the reconciler cannot afford.
 */
const DimensionGuardMeter = ({ isEnabled }: { isEnabled: boolean }) => {
  const { t } = useTranslation();
  const barRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    /**
     * A stopped meter has to look stopped.
     *
     * The fill's resting place is the whole track, because a guard that is
     * wide open is the ordinary state and the bar reads as how much of the
     * control is AVAILABLE. Leaving early on a disabled card therefore left a
     * full bar and a "100%" reading sitting under six greyed-out dials, which
     * is a live meter reporting on a stage that is not running.
     */
    if (!isEnabled) {
      if (barRef.current) {
        barRef.current.style.transform = guardFill(0);
      }
      writeLiveText(valueRef.current, '—');
      return undefined;
    }
    /**
     * The rack's own loop, which turns only while the engine publishes and is
     * started again when it registers (`graphLoop.ts`).
     *
     * It asked for its next frame unconditionally, so the card redrew a guard
     * nothing was measuring sixty times a second for as long as it was open.
     * The engine letting go buys one last frame, which paints the reading it
     * leaves behind.
     */
    const loop = startGraphLoop(() => {
      const guard = Math.max(0, Math.min(1, readDspDimensionGuard()));
      if (barRef.current) {
        barRef.current.style.transform = guardFill(guard);
      }
      writeLiveText(valueRef.current, `${Math.round(guard * 100)}%`);
    });
    return () => loop.stop();
  }, [isEnabled]);

  return (
    <div
      className={`dsp-dimension-guard${isEnabled ? '' : ' is-off'}`}
      aria-live="off"
    >
      <span className="dsp-dimension-guard-name">
        {t('dsp.dimension.guard')}
      </span>
      <div className="dsp-dimension-guard-track">
        <div className="dsp-dimension-guard-fill" ref={barRef} />
      </div>
      <LiveFigure
        className="dsp-dimension-guard-value"
        widest={GUARD_WIDEST}
        textRef={valueRef}
      >
        —
      </LiveFigure>
    </div>
  );
};

/**
 * The Dimension page: the picture first, then the two decisions behind it.
 *
 * The dials are grouped rather than listed. The three widths are one decision —
 * how the image is shaped across the spectrum — and the two corners plus the
 * spread are the other, which is where the bands divide and how much of the
 * width is decorrelation rather than level. In one flat row of six they read as
 * six unrelated numbers, and the pairing is most of what somebody needs to know
 * to set them.
 */
const DspDimensionCard = ({
  dimension,
  onPatch,
  onCommit,
}: IDspDimensionCardProps) => {
  const { t } = useTranslation();
  const sampleRate = useDspSampleRate();

  /**
   * Any change to the sound makes the result Custom; bypass does not.
   *
   * The same rule as the Exciter's and the Maximizer's pages. A profile the
   * user has since edited must stop claiming to be that profile, or the picker
   * is naming something that is no longer on screen.
   */
  const patch = (next: Partial<IDimensionSettings>) =>
    onPatch({ ...dimension, ...next, presetId: '' });

  return (
    <ProcessorCard
      id="dsp-dimension"
      titleKey="dsp.dimension.title"
      isEnabled={dimension.enabled}
      onToggle={() => {
        onPatch({ ...dimension, enabled: !dimension.enabled });
        onCommit();
      }}
      toolbar={
        <DspDimensionBar
          dimension={dimension}
          onChange={onPatch}
          onCommit={onCommit}
        />
      }
    >
      <DspDimensionGraph dimension={dimension} sampleRate={sampleRate} />

      <div className="dsp-dimension-controls">
        <div className="dsp-dimension-group">
          <span className="dsp-dimension-group-name">
            {t('dsp.dimension.groupWidth')}
          </span>
          <div className="dsp-dimension-group-dials">
            {/* Bass stops at unity, and the dial says so by not going further:
                low frequencies carry the energy and none of the localisation,
                so width down there costs headroom and buys no picture. */}
            <Dial
              labelKey="dsp.dimension.lowWidth"
              value={dimension.lowWidth}
              defaultValue={DSP_DEFAULTS.dimension.lowWidth}
              min={0}
              max={1}
              unit="x"
              step={0.01}
              isDisabled={!dimension.enabled}
              onCommit={onCommit}
              onChange={(lowWidth) => patch({ lowWidth })}
            />
            <Dial
              labelKey="dsp.dimension.midWidth"
              value={dimension.midWidth}
              defaultValue={DSP_DEFAULTS.dimension.midWidth}
              min={0}
              max={2}
              unit="x"
              step={0.01}
              isDisabled={!dimension.enabled}
              onCommit={onCommit}
              onChange={(midWidth) => patch({ midWidth })}
            />
            <Dial
              labelKey="dsp.dimension.highWidth"
              value={dimension.highWidth}
              defaultValue={DSP_DEFAULTS.dimension.highWidth}
              min={0}
              max={2}
              unit="x"
              step={0.01}
              isDisabled={!dimension.enabled}
              onCommit={onCommit}
              onChange={(highWidth) => patch({ highWidth })}
            />
          </div>
        </div>

        <div className="dsp-dimension-group">
          <span className="dsp-dimension-group-name">
            {t('dsp.dimension.groupShape')}
          </span>
          <div className="dsp-dimension-group-dials">
            <Dial
              labelKey="dsp.dimension.lowHz"
              value={dimension.lowHz}
              defaultValue={DSP_DEFAULTS.dimension.lowHz}
              min={60}
              max={600}
              unit="Hz"
              step={5}
              isDisabled={!dimension.enabled}
              onCommit={onCommit}
              onChange={(lowHz) => patch({ lowHz })}
            />
            <Dial
              labelKey="dsp.dimension.highHz"
              value={dimension.highHz}
              defaultValue={DSP_DEFAULTS.dimension.highHz}
              min={1_000}
              max={10_000}
              unit="Hz"
              step={50}
              isDisabled={!dimension.enabled}
              onCommit={onCommit}
              onChange={(highHz) => patch({ highHz })}
            />
            <Dial
              labelKey="dsp.dimension.decorrelation"
              value={dimension.decorrelation}
              defaultValue={DSP_DEFAULTS.dimension.decorrelation}
              min={0}
              max={1}
              unit=""
              step={0.01}
              isDisabled={!dimension.enabled}
              onCommit={onCommit}
              onChange={(decorrelation) => patch({ decorrelation })}
            />
          </div>
        </div>
      </div>

      <DimensionGuardMeter isEnabled={dimension.enabled} />
    </ProcessorCard>
  );
};

export default DspDimensionCard;
