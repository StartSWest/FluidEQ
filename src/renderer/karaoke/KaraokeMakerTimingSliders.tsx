/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import { formatClock } from './makerFormat';

/**
 * The sliders that move one word's start and length.
 *
 * Rendered in two places — the inspector beside the canvas and the lyrics
 * dialog — which is why it takes an id prefix: two copies on screen at once
 * would otherwise give their inputs the same ids, and a label would point at
 * whichever mounted first.
 *
 * The limits arrive already worked out. What a word may be resized to depends
 * on the words either side of it, and deriving that here would mean this
 * component knowing about the whole line.
 */
export interface IKaraokeMakerTimingSlidersProps {
  /** Distinguishes the two copies that can be on screen together. */
  idPrefix: string;
  /** Where the word may be moved to, given its neighbours. */
  selectedTokenTimingControls:
    | {
        startMs: number;
        endMs: number;
        durationMs: number;
        canResizeStart: boolean;
        canResizeEnd: boolean;
        minimumStartMs: number;
        maximumStartMs: number;
        minimumDurationMs: number;
        maximumDurationMs: number;
      }
    | undefined;
  updateSelectedTokenTiming: (update: {
    text?: string;
    startMs?: number;
    durationMs?: number;
  }) => void;
}

const KaraokeMakerTimingSliders = ({
  idPrefix,
  selectedTokenTimingControls,
  updateSelectedTokenTiming,
}: IKaraokeMakerTimingSlidersProps) => {
  const { t } = useTranslation();
  if (!selectedTokenTimingControls) {
    return (
      <div className="karaoke-maker__word-timing-sliders is-disabled">
        <span>{t('karaoke.maker.untimed')}</span>
        <small>{t('karaoke.maker.wordTimingSliderHint')}</small>
      </div>
    );
  }
  const positionMinimum = Math.round(
    selectedTokenTimingControls.minimumStartMs,
  );
  const positionMaximum = Math.max(
    positionMinimum,
    Math.round(selectedTokenTimingControls.maximumStartMs),
  );
  const durationMaximum = Math.max(
    selectedTokenTimingControls.minimumDurationMs,
    Math.round(selectedTokenTimingControls.maximumDurationMs),
  );
  return (
    <div className="karaoke-maker__word-timing-sliders">
      <label htmlFor={`${idPrefix}-position`}>
        <span>
          {t('karaoke.maker.wordPosition')}
          <output>{formatClock(selectedTokenTimingControls.startMs)}</output>
        </span>
        <input
          id={`${idPrefix}-position`}
          type="range"
          min={positionMinimum}
          max={positionMaximum}
          step={10}
          value={Math.round(selectedTokenTimingControls.startMs)}
          disabled={!selectedTokenTimingControls.canResizeStart}
          onChange={(event) =>
            updateSelectedTokenTiming({ startMs: Number(event.target.value) })
          }
        />
      </label>
      <label htmlFor={`${idPrefix}-length`}>
        <span>
          {t('karaoke.maker.wordDuration')}
          <output>
            {Math.round(selectedTokenTimingControls.durationMs)} ms
          </output>
        </span>
        <input
          id={`${idPrefix}-length`}
          type="range"
          min={selectedTokenTimingControls.minimumDurationMs}
          max={durationMaximum}
          step={10}
          value={Math.max(
            selectedTokenTimingControls.minimumDurationMs,
            Math.min(
              durationMaximum,
              Math.round(selectedTokenTimingControls.durationMs),
            ),
          )}
          disabled={!selectedTokenTimingControls.canResizeEnd}
          onChange={(event) =>
            updateSelectedTokenTiming({
              durationMs: Number(event.target.value),
            })
          }
        />
      </label>
      <small>{t('karaoke.maker.wordTimingSliderHint')}</small>
    </div>
  );
};

export default KaraokeMakerTimingSliders;
