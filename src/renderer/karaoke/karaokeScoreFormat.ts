/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type TranslationKey } from '../../common/i18n';
import {
  type IKaraokeScoreLine,
  type TKaraokeVerdict,
} from '../../common/karaoke/scoring';
import { type TKaraokeRating } from '../../common/karaoke/scoringRun';
import { useTranslation } from '../utils/I18nContext';

// The score's figures in the reader's own language: "8 640" in French and
// Spanish, "8,640" in English, "82 %" where a space comes before the sign.

const wholeFormats = new Map<string, Intl.NumberFormat>();
const percentFormats = new Map<string, Intl.NumberFormat>();

const cached = (
  store: Map<string, Intl.NumberFormat>,
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat => {
  const known = store.get(locale);
  if (known) {
    return known;
  }
  const made = new Intl.NumberFormat(locale, options);
  store.set(locale, made);
  return made;
};

export const formatKaraokeWhole = (locale: string, value: number): string =>
  cached(wholeFormats, locale, { maximumFractionDigits: 0 }).format(
    Math.round(value),
  );

/** A 0-100 figure as a percentage. */
export const formatKaraokePercent = (locale: string, percent: number): string =>
  cached(percentFormats, locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(Math.round(percent) / 100);

export const VERDICT_KEYS: Record<TKaraokeVerdict, TranslationKey> = {
  perfect: 'karaoke.score.verdictPerfect',
  good: 'karaoke.score.verdictGood',
  late: 'karaoke.score.verdictLate',
  low: 'karaoke.score.verdictLow',
  high: 'karaoke.score.verdictHigh',
  missed: 'karaoke.score.verdictMissed',
  skipped: 'karaoke.score.verdictSkipped',
};

export const RATING_KEYS: Record<TKaraokeRating, TranslationKey> = {
  excellent: 'karaoke.score.ratingExcellent',
  great: 'karaoke.score.ratingGreat',
  good: 'karaoke.score.ratingGood',
  fair: 'karaoke.score.ratingFair',
  practice: 'karaoke.score.ratingPractice',
};

/** "Line 4, “canto sin miedo”", or just "Line 4" for a line with no words. */
export const useLineName = () => {
  const { t } = useTranslation();
  return (line: IKaraokeScoreLine): string => {
    const name = t('karaoke.score.lineNumber', { number: line.index + 1 });
    return line.text
      ? t('karaoke.score.lineWithText', { line: name, text: line.text })
      : name;
  };
};

/** The tone a rating wears: the accent, amber, or the muted red. */
export const ratingTone = (rating: TKaraokeRating): 'on' | 'near' | 'off' => {
  if (rating === 'excellent' || rating === 'great') {
    return 'on';
  }
  return rating === 'practice' ? 'off' : 'near';
};
