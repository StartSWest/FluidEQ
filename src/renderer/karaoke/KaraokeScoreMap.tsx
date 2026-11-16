/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import {
  type IKaraokeScoreLine,
  KARAOKE_SCORE_MAX,
} from '../../common/karaoke/scoring';
import {
  karaokeLineResult,
  karaokeRating,
} from '../../common/karaoke/scoringRun';
import { type TKaraokeProgress } from '../../common/karaoke/scoringSummary';
import { useTranslation } from '../utils/I18nContext';
import KaraokeCountUp from './KaraokeCountUp';
import paintKaraokeScoreMap from './karaokeScoreMapPaint';
import {
  formatKaraokePercent,
  formatKaraokeWhole,
  RATING_KEYS,
  ratingTone,
  useLineName,
} from './karaokeScoreFormat';
import { KaraokeVerdictKey } from './KaraokeScoreRecap';
import { type IKaraokeEndCard } from './useKaraokeScore';

/** "+8", "−24", "±0": a line against the best attempt's, in points. */
const signedDelta = (delta: number): string => {
  if (delta > 0) {
    return `+${delta}`;
  }
  return delta < 0 ? `−${-delta}` : '±0';
};

const trendOf = (delta: number | undefined): 'up' | 'down' | undefined => {
  if (delta === undefined || delta === 0) {
    return undefined;
  }
  return delta > 0 ? 'up' : 'down';
};

const HISTORY_BAR_MIN_PX = 10;
const HISTORY_BAR_RANGE_PX = 64;

interface IKaraokeScoreMapProps {
  card: IKaraokeEndCard;
  onPractiseLine: (line: IKaraokeScoreLine) => void;
}

/**
 * The "Mapa de la canción" beside the summary: every note in its verdict's
 * colour, each line's rating against the same line in the best attempt
 * before this one, the last six attempts as bars, and one line on how it is
 * going. A line pressed here is sung again, as from the rows under the strip.
 */
const KaraokeScoreMap = ({ card, onPractiseLine }: IKaraokeScoreMapProps) => {
  const { t, locale } = useTranslation();
  const lineName = useLineName();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { sheet, results, summary, deltas, attempts, bestAt, progress } = card;
  const whole = (value: number) => formatKaraokeWhole(locale, value);
  const percent = (value: number) => formatKaraokePercent(locale, value);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const paint = () =>
      paintKaraokeScoreMap({
        canvas,
        sheet,
        results,
        lineLabel: (lineIndex, share) => {
          const name = t('karaoke.score.lineNumber', { number: lineIndex + 1 });
          return share === undefined
            ? name
            : `${name} · ${formatKaraokePercent(locale, share)}`;
        },
      });
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [sheet, results, t, locale]);

  const progressText = (note: TKaraokeProgress): string => {
    const nameAt = (index: number) => lineName(sheet.lines[index]);
    switch (note.kind) {
      case 'first':
        return t('karaoke.score.progressFirst');
      case 'up':
        return t('karaoke.score.progressUp', {
          line: nameAt(note.line),
          delta: signedDelta(note.delta),
        });
      case 'down':
        return t('karaoke.score.progressDown', {
          line: nameAt(note.line),
          delta: signedDelta(note.delta),
        });
      case 'upDown':
        return t('karaoke.score.progressUpDown', {
          up: nameAt(note.up),
          delta: signedDelta(note.delta),
          down: nameAt(note.down),
        });
      default:
        return t('karaoke.score.progressSame');
    }
  };

  const dayFormat = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  });

  return (
    <article className="karaoke-score-card__pane">
      <header className="karaoke-score-card__top">
        <h2 className="karaoke-score-card__kicker">
          {t('karaoke.score.mapTitle')}
        </h2>
        <span className="karaoke-score-card__song">
          {t('karaoke.score.mapSummary', {
            points: whole(summary.score),
            inTune: percent(Math.round((summary.inTuneShare ?? 0) * 100)),
          })}
        </span>
      </header>
      <div role="img" aria-label={t('karaoke.score.mapCanvas')}>
        <canvas
          ref={canvasRef}
          className="karaoke-score-card__map"
          aria-hidden="true"
        />
      </div>
      <KaraokeVerdictKey counts={summary.counts} />
      <ol className="karaoke-score-card__lines">
        {sheet.lines.map((line) => {
          const { share } = karaokeLineResult(line, sheet, results);
          const rating = share === undefined ? undefined : karaokeRating(share);
          const delta = deltas[line.index];
          const name = lineName(line);
          const practise = t('karaoke.score.practiseLine', { line: name });
          return (
            <li key={line.index}>
              <button
                type="button"
                onClick={() => onPractiseLine(line)}
                title={practise}
                aria-label={practise}
              >
                <span className="karaoke-score-card__line-name">{name}</span>
                <b data-tone={rating ? ratingTone(rating) : undefined}>
                  {rating && share !== undefined
                    ? `${t(RATING_KEYS[rating])} · ${percent(share * 100)}`
                    : t('karaoke.score.verdictSkipped')}
                </b>
                <em
                  data-trend={trendOf(delta)}
                  title={t('karaoke.score.deltaTitle')}
                >
                  {delta === undefined ? '' : signedDelta(delta)}
                </em>
              </button>
            </li>
          );
        })}
      </ol>
      <section className="karaoke-score-card__block">
        <h3>{t('karaoke.score.historyTitle')}</h3>
        <ol className="karaoke-score-card__history">
          {attempts.map((attempt, index) => {
            const isNow = index === attempts.length - 1;
            const isBest = attempt.at === bestAt;
            let when = dayFormat.format(attempt.at);
            if (isNow) {
              when = t('karaoke.score.historyNow');
            } else if (isBest) {
              when = t('karaoke.score.historyBest');
            }
            return (
              <li
                key={attempt.at}
                className={`${isNow ? 'is-now' : ''}${isBest ? ' is-best' : ''}`}
              >
                {isNow ? (
                  <KaraokeCountUp
                    className="karaoke-score-card__history-value"
                    value={attempt.score}
                    from={0}
                    durationMs={1_400}
                    format={whole}
                    widest={whole(KARAOKE_SCORE_MAX)}
                  />
                ) : (
                  <span className="karaoke-score-card__history-value">
                    {whole(attempt.score)}
                  </span>
                )}
                <i
                  aria-hidden="true"
                  style={{
                    height:
                      HISTORY_BAR_MIN_PX +
                      (Math.max(0, attempt.score) / KARAOKE_SCORE_MAX) *
                        HISTORY_BAR_RANGE_PX,
                  }}
                />
                <span className="karaoke-score-card__history-when">{when}</span>
              </li>
            );
          })}
        </ol>
      </section>
      <section className="karaoke-score-card__tip">
        <h3>{t('karaoke.score.progressTitle')}</h3>
        <p>{progressText(progress)}</p>
      </section>
    </article>
  );
};

export default KaraokeScoreMap;
