/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Normalizer page's live readings, each subscribed where it is drawn.
 *
 * The engine publishes these with every host frame, a hundred times a second.
 * Read once at the top of `DspNormalizerCard`, they re-rendered the whole
 * page on each frame — the mode switch, both dials and every label — to move
 * two bars and a handful of numbers. Here only the readings themselves redraw.
 */

import { useEffect, useRef, useState } from 'react';
import { ILibraryNormalizationAnalysis } from '../../common/library/types';
import LiveFigure from '../components/LiveFigure';
import { useTranslation } from '../utils/I18nContext';
import writeLiveText from '../utils/liveText';
import { startGraphLoop } from './graphLoop';
import { readDspNormalizerMeter, useDspNormalizerMeterValue } from './store';

const LIVE_STATES = [
  'dsp.normalizer.off',
  'dsp.normalizer.livePeak',
  'dsp.normalizer.learning',
  'dsp.normalizer.holding',
  'dsp.normalizer.liveLeveling',
  'dsp.normalizer.liveLimited',
] as const;

const peakDb = (value: number) =>
  value > 0.000001 ? 20 * Math.log10(value) : -120;

/**
 * Where a bar's fill stands for a peak, on a track spanning -60 to +6 dBFS.
 *
 * Slid rather than sized: the fill keeps the track's whole width and is moved
 * left by what the peak falls short of, inside a track that clips it. A width
 * lays the meter's grid out, and the window up to its root with it; a
 * transform lays nothing out, and its transition can run off the main
 * thread. Slid rather than scaled because a scaled pill has its rounded end
 * squashed flat as the bar shortens — sliding keeps the end the shape it was.
 */
const meterFill = (value: number) =>
  `translateX(${
    Math.max(0, Math.min(100, ((peakDb(value) + 60) / 66) * 100)) - 100
  }%)`;

const peakText = (value: number) => `${peakDb(value).toFixed(1)} dBFS`;

/** A bar's figure at its widest: a peak on the floor reads -120.0 dBFS. */
const PEAK_WIDEST = ['-000.0 dBFS'];

const analysisValue = (value: number | undefined, unit: string) =>
  value === undefined ? '—' : `${value.toFixed(1)} ${unit}`;

/** What the engine's leveller is doing right now, under the FluidEQ Engine. */
export const DspNormalizerLiveState = () => {
  const { t } = useTranslation();
  const levelState = useDspNormalizerMeterValue((meter) => meter.levelState);
  return levelState === undefined ? null : (
    <>{t(LIVE_STATES[levelState] ?? 'dsp.normalizer.learning')}</>
  );
};

interface IDspNormalizerStatsProps {
  isLive: boolean;
  analysis: ILibraryNormalizationAnalysis | undefined;
}

/** Peak, loudness and the gain applied: measured live, or from the analysis. */
export const DspNormalizerStats = ({
  isLive,
  analysis,
}: IDspNormalizerStatsProps) => {
  const { t } = useTranslation();
  // Each figure as the text it is shown in, so a host frame that moved none
  // of them renders nothing here.
  const livePeak = useDspNormalizerMeterValue((meter) =>
    analysisValue(meter.inputTruePeakDb, 'dBTP'),
  );
  const liveLoudness = useDspNormalizerMeterValue((meter) =>
    analysisValue(meter.inputLufs, 'LUFS'),
  );
  const appliedGain = useDspNormalizerMeterValue((meter) =>
    analysisValue(meter.appliedGainDb, 'dB'),
  );
  return (
    <dl className="dsp-normalizer-stats">
      <div>
        <dt>{t('dsp.normalizer.measuredPeak')}</dt>
        <dd>
          {isLive ? livePeak : analysisValue(analysis?.truePeakDbtp, 'dBTP')}
        </dd>
      </div>
      <div>
        <dt>
          {t(
            isLive
              ? 'dsp.normalizer.shortTerm'
              : 'dsp.normalizer.measuredLoudness',
          )}
        </dt>
        <dd>
          {isLive
            ? liveLoudness
            : analysisValue(analysis?.integratedLufs, 'LUFS')}
        </dd>
      </div>
      <div>
        <dt>{t('dsp.normalizer.appliedGain')}</dt>
        <dd>{appliedGain}</dd>
      </div>
    </dl>
  );
};

/**
 * The gain the engine is applying, beside the meter's title.
 *
 * Subscribed on its own, so a new figure here is the one thing that renders:
 * the bars and figures under it are drawn by the meter's loop, never through
 * React.
 */
const DspNormalizerAppliedGain = () => {
  const appliedGain = useDspNormalizerMeterValue(
    (meter) => `${meter.appliedGainDb.toFixed(1)} dB`,
  );
  return <span className="dsp-band-spec">{appliedGain}</span>;
};

/** Each channel's two bars, and which of the meter's peaks each one draws. */
const BARS = [
  { kind: 'before', label: 'dsp.normalizer.before' },
  { kind: 'after', label: 'dsp.normalizer.after' },
] as const;

/** A bar's peak, from the input's for Before and the output's for After. */
const barPeak = (
  kind: (typeof BARS)[number]['kind'],
  channelIndex: number,
): number => {
  const meter = readDspNormalizerMeter();
  return (kind === 'before' ? meter.inputPeaks : meter.outputPeaks)[
    channelIndex
  ];
};

/**
 * The before and after bars for both channels.
 *
 * Drawn by the rack's frame loop (`graphLoop.ts`), which reads the meter at
 * the display's rate while the engine publishes and stops when it does not.
 * The whole meter used to re-render with every host frame, a hundred times a
 * second, and set a width on each of its four bars and new text in each of
 * its four figures: every one a layout of the grid it stands in and of the
 * window above it. Now the loop slides each fill (`meterFill`) and writes
 * each figure into a box of its own (`LiveFigure`), and the 70 ms transition,
 * on the transform now, eases the fill exactly as it eased the width.
 */
export const DspNormalizerLiveMeter = () => {
  const { t } = useTranslation();
  // Four of each, channel by channel, Before before After.
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const figures = useRef<(HTMLSpanElement | null)[]>([]);
  /**
   * The peaks as the meter opened on them, which is what it renders with.
   *
   * Placed there by React rather than by the loop's first frame so the bars
   * arrive where they belong: a fill put in place a frame after it was
   * inserted would slide there from empty. Handed the same values on every
   * render after, React never writes them back over the loop's.
   */
  const [opening] = useState(() =>
    (['L', 'R'] as const).flatMap((_channel, channelIndex) =>
      BARS.map(({ kind }) => barPeak(kind, channelIndex)),
    ),
  );
  useEffect(() => {
    const loop = startGraphLoop(() => {
      (['L', 'R'] as const).forEach((_channel, channelIndex) => {
        BARS.forEach(({ kind }, barIndex) => {
          const at = channelIndex * BARS.length + barIndex;
          const peak = barPeak(kind, channelIndex);
          const fill = fills.current[at];
          if (fill) {
            fill.style.transform = meterFill(peak);
            fill.classList.toggle('is-over', peak > 1);
          }
          writeLiveText(figures.current[at], peakText(peak));
        });
      });
    });
    return () => loop.stop();
  }, []);

  return (
    <section className="dsp-normalizer-live">
      <div className="dsp-band-head">
        <span className="dsp-band-title">{t('dsp.normalizer.liveMeter')}</span>
        <DspNormalizerAppliedGain />
      </div>
      <div className="dsp-normalizer-meter" aria-live="off">
        {(['L', 'R'] as const).map((channel, channelIndex) => (
          <div className="dsp-normalizer-meter-channel" key={channel}>
            <span className="dsp-normalizer-meter-channel-name">{channel}</span>
            {BARS.map(({ kind, label }, barIndex) => {
              const at = channelIndex * BARS.length + barIndex;
              const peak = opening[at];
              return (
                <div className="dsp-normalizer-meter-pair" key={kind}>
                  <span className="dsp-normalizer-meter-name">{t(label)}</span>
                  <span className="dsp-normalizer-meter-track">
                    <span
                      className={`dsp-normalizer-meter-fill is-${kind}${
                        peak > 1 ? ' is-over' : ''
                      }`}
                      style={{ transform: meterFill(peak) }}
                      ref={(element) => {
                        fills.current[at] = element;
                      }}
                    />
                    <span className="dsp-normalizer-meter-zero" />
                  </span>
                  <LiveFigure
                    className="dsp-normalizer-meter-value"
                    widest={PEAK_WIDEST}
                    textRef={(element) => {
                      figures.current[at] = element;
                    }}
                  >
                    {peakText(peak)}
                  </LiveFigure>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="dsp-band-hint">{t('dsp.normalizer.liveMeterHint')}</p>
    </section>
  );
};
