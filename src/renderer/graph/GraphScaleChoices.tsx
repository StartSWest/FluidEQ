/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import { format } from 'd3';
import type { TranslationKey } from 'common/i18n';
import { GRAPH_TILTS, hasGraphTilt } from 'common/graphAnalysis';
import { useTranslation } from '../utils/I18nContext';
import { useGraphLook } from '../utils/graphStyle';
import {
  setGraphAnalyserSlope,
  setGraphFrequencyRange,
  useGraphAnalyserSlope,
  useGraphFrequencyRange,
} from '../utils/graphScaleSettings';
import {
  GRAPH_FREQUENCY_RANGES,
  GRAPH_FREQUENCY_SPANS,
  type TGraphFrequencyRange,
} from './graphFrequencyRanges';

/** What each range is for, said on the option itself. */
const RANGE_HINT: Record<TGraphFrequencyRange, TranslationKey> = {
  extended: 'graph.frequencyRange.extendedHint',
  standard: 'graph.frequencyRange.standardHint',
  wide: 'graph.frequencyRange.wideHint',
  music: 'graph.frequencyRange.musicHint',
};

/**
 * Each range by its two ends, as the scale along the bottom names them —
 * "10–20k": the figures say which is which faster than four names could,
 * and the option's hint names it.
 */
const shortHz = format('~s');
const spanLabel = (range: TGraphFrequencyRange) => {
  const [low, high] = GRAPH_FREQUENCY_SPANS[range];
  return `${shortHz(low)}–${shortHz(high)}`;
};

interface IChoiceRowProps {
  icon: ReactNode;
  name: string;
  /** Why the row does nothing now, on the row, while it does nothing. */
  disabledReason?: string;
  children: ReactNode;
}

/** The View menu's row of a few short choices, as the window's colours. */
const ChoiceRow = ({
  icon,
  name,
  disabledReason,
  children,
}: IChoiceRowProps) => (
  <div
    className={`graph-view-menu__slider graph-view-menu__slider--switch${
      disabledReason ? ' is-disabled' : ''
    }`}
    title={disabledReason}
  >
    <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
      {icon}
    </svg>
    <span>{name}</span>
    <span
      className="segmented graph-view-menu__choice"
      role="radiogroup"
      aria-label={name}
    >
      {children}
    </span>
  </div>
);

interface IGraphScaleChoicesProps {
  isGridHidden: boolean;
  /** A Plus scene draws the plot itself; the analyser's slope is not on it. */
  hasScene: boolean;
}

/**
 * The graph's scale, under the grid's switch: which frequencies the plot
 * spans, and how far the analyser tips its spectrum toward the treble (Ivan,
 * 2026-11-16: "We need an option for users to pick from different frequency
 * distributions", and "in the new graph frequency modes show the slopes too").
 *
 * Greyed rather than removed while they change nothing, with the reason on
 * the row: the range with the grid off, where the graph is a picture trimmed
 * to 20 Hz to 16 kHz (`graphFrequencyRange`), and the slope over a look that
 * draws no spectrum to tip (`hasGraphTilt`). The row above says why at a
 * glance, as the orientation row's does under the wave's switch.
 */
const GraphScaleChoices = ({
  isGridHidden,
  hasScene,
}: IGraphScaleChoicesProps) => {
  const { t } = useTranslation();
  const range = useGraphFrequencyRange();
  const slope = useGraphAnalyserSlope();
  const look = useGraphLook();
  const slopeApplies = !hasScene && hasGraphTilt(look.style);
  return (
    <>
      <ChoiceRow
        icon={
          <path d="M1.5 13.5h13M3 13.5v-3M6 13.5V8M10 13.5V5M13 13.5V2.5" />
        }
        name={t('graph.frequencyRange')}
        disabledReason={
          isGridHidden ? t('graph.frequencyRange.gridOffHint') : undefined
        }
      >
        {GRAPH_FREQUENCY_RANGES.map((choice) => {
          const isChosen = range === choice;
          return (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={isChosen}
              className={`segmented__option${isChosen ? ' is-selected' : ''}`}
              title={t(RANGE_HINT[choice])}
              disabled={isGridHidden}
              onClick={() => setGraphFrequencyRange(choice)}
            >
              {spanLabel(choice)}
            </button>
          );
        })}
      </ChoiceRow>
      <ChoiceRow
        icon={<path d="M1.5 12.5l13-6M1.5 13.5h13" />}
        name={t('graph.analyserSlope')}
        disabledReason={
          slopeApplies ? undefined : t('graph.analyserSlopeLookHint')
        }
      >
        {GRAPH_TILTS.map((choice) => {
          const isChosen = slope === choice;
          return (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={isChosen}
              className={`segmented__option${isChosen ? ' is-selected' : ''}`}
              // The unit is said once, in the hint: five options each
              // carrying "dB/oct" would not fit beside the row's name.
              title={t('graph.analyserSlopeHint')}
              aria-label={
                choice === 0
                  ? t('look.off')
                  : t('graph.analyserSlopeValue', { value: String(choice) })
              }
              disabled={!slopeApplies}
              onClick={() => setGraphAnalyserSlope(choice)}
            >
              {choice === 0 ? t('look.off') : String(choice)}
            </button>
          );
        })}
      </ChoiceRow>
    </>
  );
};

export default GraphScaleChoices;
