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

/**
 * The last stage of Smart EQ: turning a measurement into a sentence.
 *
 * Auto-balance is a pipeline — tune, listen, fit, narrate — and this is the end
 * of it. Nothing here measures or decides anything; it takes a finished report
 * and says what happened in the user's language.
 *
 * Worth its own file because it is the only part of the 2,900 lines that is
 * about words rather than about signal, and because the direction of the
 * dependency proves the seam is real: this reads the capture's types and
 * constants, and nothing in the capture reads this.
 */

import { IFilter } from '../../common/constants';
import { Translate, TranslationKey } from '../../common/i18n';
import {
  BALANCE_REGION_EDGES,
  BALANCE_REGION_LABELS,
  IBalanceProgress,
  IBalanceResult,
  REGION_ACTIVE_WEIGHT,
} from './autoBalance';

/**
 * The translation key for a region, from the label the capture carries.
 *
 * `BALANCE_REGION_LABELS` stays English on purpose: those strings are
 * identifiers. They key the flash store, they are React keys on the coverage
 * columns, and a test asserts on them. Translating them at the source would
 * turn every one of those into something that changes with the menu.
 */
export const BALANCE_REGION_KEYS: Record<string, TranslationKey> = {
  'deep bass': 'eq.smart.range.deepBass',
  bass: 'eq.smart.range.bass',
  'low mids': 'eq.smart.range.lowMids',
  mids: 'eq.smart.range.mids',
  'upper mids': 'eq.smart.range.upperMids',
  presence: 'eq.smart.range.presence',
  treble: 'eq.smart.range.treble',
  'high treble': 'eq.smart.range.highTreble',
  air: 'eq.smart.range.air',
};

/** A region's name to say out loud. Unknown labels are passed through. */
export const balanceRangeName = (label: string, t: Translate): string => {
  const key = BALANCE_REGION_KEYS[label];
  return key ? t(key) : label;
};

/**
 * Sentence case, for a line assembled from clauses that are written lowercase
 * so they can also appear second and third.
 *
 * A no-op in Chinese, Japanese and Devanagari, which have no case, and correct
 * in German, where the first word of these clauses is a noun and already
 * capitalised.
 */
const asSentence = (said: string): string =>
  said ? said.charAt(0).toUpperCase() + said.slice(1) : '';

export const describeContinuousProgress = (
  progress: IBalanceProgress,
  t: Translate,
): string => {
  if (progress.isPaused) {
    return t('eq.smart.status.paused');
  }
  if (progress.isSilent) {
    return t('eq.smart.status.waitingForSound');
  }
  // Filling right now — uncovered AND actually being fed. The second half is
  // what stops the sentence going stale: a range with no content never covers,
  // so on the first test alone it stayed named forever and the bubble was frozen
  // on a request nothing was ever going to satisfy.
  const filling = progress.regions
    .filter(
      (region) => !region.isCovered && region.weight >= REGION_ACTIVE_WEIGHT,
    )
    .map((region) => region.label);
  if (filling.length === 0) {
    return t('eq.smart.status.listening');
  }
  const named = filling
    .slice(0, MAX_NAMED_RANGES)
    .map((label) => balanceRangeName(label, t))
    .join(t('eq.smart.range.separator'));
  const rest = filling.length - MAX_NAMED_RANGES;
  // "Waiting on", not "needs".
  //
  // Both mean "has not heard this range well enough yet", and only one of them
  // survives being read quickly. "Needs air" over a top end somebody has just
  // boosted by seventeen decibels reads as the app asking for more of it, which
  // is the opposite of what it means and makes the whole readout look like it is
  // not listening to the same sound the user is.
  //
  // The overflow is its own key rather than a "+3" stapled onto the end of the
  // other one. Same reason as everything else here: a language that ends the
  // sentence with the verb has nowhere to staple it.
  return rest > 0
    ? t('eq.smart.status.waitingOnMore', {
        percent: progress.percent,
        ranges: named,
        count: rest,
      })
    : t('eq.smart.status.waitingOn', {
        percent: progress.percent,
        ranges: named,
      });
};

/**
 * A frequency as a listener reads it.
 *
 * The unit goes through the dictionary too, which looks like ceremony over two
 * characters until you notice that Russian writes them Гц and кГц.
 */
export const formatBalanceFrequency = (
  frequency: number,
  t: Translate,
): string =>
  frequency >= 1000
    ? t('eq.smart.frequency.khz', { value: Math.round(frequency / 100) / 10 })
    : t('eq.smart.frequency.hz', { value: Math.round(frequency) });

export const describeBalanceProgress = (
  progress: IBalanceProgress,
  t: Translate,
): string => {
  if (progress.isPaused) {
    return t('eq.smart.status.pausedResume');
  }
  if (progress.isSilent) {
    return t('eq.smart.status.pausedSilent');
  }
  if (progress.isSettling) {
    return t('eq.smart.status.settling', { percent: progress.percent });
  }
  if (!progress.weakestLabel) {
    return t('eq.smart.status.listeningPercent', { percent: progress.percent });
  }
  // "Waiting on" rather than "needs", for the reason written out in
  // `describeContinuousProgress`: this names a range the measurement has not
  // heard enough of, and "needs" reads as a request to boost it.
  return t('eq.smart.status.waitingOn', {
    percent: progress.percent,
    ranges: balanceRangeName(progress.weakestLabel, t),
  });
};

/**
 * How far a range has to average before it is worth naming, in dB.
 *
 * Under a decibel is not a thing anybody can hear on a broad band, and saying
 * it would turn a description into a readout — nine ranges all reporting a
 * fraction, none of it audible, changing every time it is looked at.
 */
export const NAMEABLE_CORRECTION_DB = 0.8;

/** At most this many, biggest first. A list of nine is not a description. */
export const MAX_NAMED_RANGES = 3;

/**
 * What a correction is actually doing, in words, from the gains it applied.
 *
 * Read off the layer rather than off the measurement, and that is the whole
 * point: the measurement is what was heard, which is a claim about the room the
 * app cannot verify, while the gains are what FluidEQ has done and can be
 * checked against the config file on disk. Nothing here is inferred, guessed or
 * rounded up to sound impressive — a range is named only if the bands inside it
 * really do average that far from zero.
 *
 * By range and not by band, because "more air" is a sentence and "+1.2 at 10k,
 * +0.9 at 12.5k, +1.4 at 8k" is a table. The ranges are the same nine the
 * measurement already reports coverage for, so the words line up with the
 * columns drawn on the graph while it listens.
 */
export const describeCorrectionShape = (
  filters: IFilter[],
  t: Translate,
): string => {
  const named = BALANCE_REGION_LABELS.map((label, index) => {
    const low = BALANCE_REGION_EDGES[index];
    const high = BALANCE_REGION_EDGES[index + 1];
    const inside = filters.filter(
      (filter) => filter.frequency >= low && filter.frequency < high,
    );
    const mean = inside.length
      ? inside.reduce((total, filter) => total + filter.gain, 0) / inside.length
      : 0;
    return { label, mean };
  })
    .filter((entry) => Math.abs(entry.mean) >= NAMEABLE_CORRECTION_DB)
    .sort((left, right) => Math.abs(right.mean) - Math.abs(left.mean))
    .slice(0, MAX_NAMED_RANGES)
    // Verbs, because this is a thing that was done rather than a column of
    // numbers. "Lifted air" is what somebody would say about it out loud; "air
    // +2.4" is what the config file already says, better.
    //
    // Past tense, and that is not a nicety. This is read off the gains of a
    // finished layer and printed next to the word that says the measurement is
    // over — "lifting air" beside "Balanced" reads as a run still going, which
    // is the one thing the sentence must not imply.
    //
    // One key per clause, not a verb glued to a noun. See the note above
    // `BALANCE_REGION_KEYS` for why that distinction is the whole of this.
    .map((entry) =>
      t(entry.mean > 0 ? 'eq.smart.shape.lifted' : 'eq.smart.shape.eased', {
        range: balanceRangeName(entry.label, t),
      }),
    );

  return asSentence(named.join(t('eq.smart.range.separator')));
};

/**
 * What the correction still owes the music, in words.
 *
 * The sibling of `describeCorrectionShape`, and the difference is which
 * question it answers. That one says what the correction adds up to, which is
 * the right thing to report at the end of a measurement. This one says what is
 * about to change, which is the right thing to report while a mode is running.
 *
 * Handed the gains the layer WOULD have — `stepSmartEqGains` against the
 * long-run destination — rather than the destination itself, and that is what
 * makes it honest. A band inside the deadband does not move, and a band already
 * at the ceiling cannot, so neither can be named: the step function has already
 * decided both, and reading its answer means this cannot promise a correction
 * that is never going to happen. It stays true for as long as the gap does,
 * which is the whole time the mode is working toward it and no longer.
 *
 * Only bands that move count toward a range's average. Averaging the still ones
 * in as zeroes is how a range with one band a long way out reported a quarter of
 * what it was about to do.
 *
 * Phrased as a need rather than as an operation. "Needs more air" is what the
 * thing is for; "lifting air" is a description of a subroutine.
 */
export const describeCorrectionNeed = (
  bands: IFilter[],
  next: Record<string, number>,
  // After the data and before the ranges, because the ranges have a default and
  // a defaulted parameter cannot come before a required one.
  t: Translate,
  regions: {
    label: string;
    lowFrequency: number;
    highFrequency: number;
  }[] = BALANCE_REGION_LABELS.map((label, index) => ({
    label,
    lowFrequency: BALANCE_REGION_EDGES[index],
    highFrequency: BALANCE_REGION_EDGES[index + 1],
  })),
): string => {
  const named = regions
    .map((region) => {
      const moving = bands
        .filter(
          (band) =>
            band.frequency >= region.lowFrequency &&
            band.frequency < region.highFrequency,
        )
        .map((band) =>
          Number.isFinite(next[band.id]) ? next[band.id] - band.gain : 0,
        )
        .filter((delta) => delta !== 0);
      const delta = moving.length
        ? moving.reduce((total, entry) => total + entry, 0) / moving.length
        : 0;
      return { label: region.label, delta };
    })
    .filter((entry) => entry.delta !== 0)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, MAX_NAMED_RANGES)
    // What is wrong, not what is being done about it. "Easing air" is a
    // description of a subroutine; "too much air" is the observation that made
    // it run, and it is the half somebody can agree or disagree with — which
    // matters, because the commonest reason to look at this is to check whether
    // the thing is hearing the same sound you are.
    .map((entry) =>
      t(entry.delta > 0 ? 'eq.smart.need.more' : 'eq.smart.need.less', {
        range: balanceRangeName(entry.label, t),
      }),
    );

  return asSentence(named.join(t('eq.smart.range.separator')));
};

export const describeBalanceResult = (
  result: IBalanceResult,
  t: Translate,
): string => {
  if (result.status === 'ready') {
    return t('eq.smart.result.fullRange');
  }
  return t('eq.smart.result.range', {
    low: formatBalanceFrequency(result.lowFrequency, t),
    high: formatBalanceFrequency(result.highFrequency, t),
  });
};
