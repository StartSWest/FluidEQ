/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type Ref } from 'react';
import { type TranslationKey } from '../../common/i18n';
import {
  type IKaraokeScoreLine,
  KARAOKE_SCORE_MAX,
  type TKaraokeVerdict,
} from '../../common/karaoke/scoring';
import {
  type IKaraokeRunSummary,
  type TKaraokeProblem,
  type TKaraokeTip,
} from '../../common/karaoke/scoringSummary';
import { useTranslation } from '../utils/I18nContext';
import KaraokeCountUp from './KaraokeCountUp';
import {
  formatKaraokePercent,
  formatKaraokeWhole,
  RATING_KEYS,
  ratingTone,
  useLineName,
  VERDICT_KEYS,
} from './karaokeScoreFormat';
import { type IKaraokeEndCard } from './useKaraokeScore';

/** The verdicts in the order the split bar lays them out. */
export const VERDICT_ORDER: readonly Exclude<TKaraokeVerdict, 'skipped'>[] = [
  'perfect',
  'good',
  'late',
  'low',
  'high',
  'missed',
];

const TIP_KEYS: Record<TKaraokeTip, TranslationKey> = {
  low: 'karaoke.score.tipLow',
  high: 'karaoke.score.tipHigh',
  late: 'karaoke.score.tipLate',
  missed: 'karaoke.score.tipMissed',
  octave: 'karaoke.score.tipOctave',
  clean: 'karaoke.score.tipClean',
};

const HARDEST_KEYS: Record<TKaraokeProblem, TranslationKey> = {
  low: 'karaoke.score.hardestLow',
  high: 'karaoke.score.hardestHigh',
  late: 'karaoke.score.hardestLate',
  missed: 'karaoke.score.hardestMissed',
};

/** The card's figures count up together, as the song's end is announced. */
const COUNT_MS = 1_400;

type TVerdictCounts = IKaraokeRunSummary['counts'];

const presentVerdicts = (counts: TVerdictCounts) =>
  VERDICT_ORDER.filter((verdict) => counts[verdict] > 0);

/** Each verdict's swatch, word and count. */
export const KaraokeVerdictKey = ({ counts }: { counts: TVerdictCounts }) => {
  const { t } = useTranslation();
  return (
    <span className="karaoke-score-card__key">
      {presentVerdicts(counts).map((verdict) => (
        <span key={verdict}>
          <i data-verdict={verdict} aria-hidden="true" />
          {t(VERDICT_KEYS[verdict])} {counts[verdict]}
        </span>
      ))}
    </span>
  );
};

/** The verdicts' counts as one bar, with the key under it. */
const KaraokeVerdictSplit = ({ counts }: { counts: TVerdictCounts }) => (
  <div className="karaoke-score-card__split-block">
    <span className="karaoke-score-card__split" aria-hidden="true">
      {presentVerdicts(counts).map((verdict) => (
        <i
          key={verdict}
          data-verdict={verdict}
          style={{ flexGrow: counts[verdict] }}
        />
      ))}
    </span>
    <KaraokeVerdictKey counts={counts} />
  </div>
);

interface IKaraokeScoreRecapProps {
  card: IKaraokeEndCard;
  songLabel: string;
  titleId: string;
  practiseRef: Ref<HTMLButtonElement>;
  onPractiseLine: (line: IKaraokeScoreLine) => void;
  onSingAgain: () => void;
}

/**
 * The "Resumen" card at the end of the song: the score out of 10 000 and its
 * word, against the best kept for this song, how much was in tune and on
 * time, the notes hit, the line that was hardest, one thing to try, and the
 * two ways on — that passage again, or the whole song.
 */
const KaraokeScoreRecap = ({
  card,
  songLabel,
  titleId,
  practiseRef,
  onPractiseLine,
  onSingAgain,
}: IKaraokeScoreRecapProps) => {
  const { t, locale } = useTranslation();
  const lineName = useLineName();
  const { summary, best, sheet } = card;
  const whole = (value: number) => formatKaraokeWhole(locale, value);
  const percent = (value: number) => formatKaraokePercent(locale, value);
  const hardest = summary.hardestLine
    ? sheet.lines[summary.hardestLine.index]
    : undefined;
  let bestText = t('karaoke.score.bestFirst');
  if (best.kind === 'new') {
    bestText = t('karaoke.score.bestNew', { delta: whole(best.delta) });
  } else if (best.kind === 'tied') {
    bestText = t('karaoke.score.bestTied');
  } else if (best.kind === 'behind') {
    bestText = t('karaoke.score.bestBehind', { delta: whole(best.delta) });
  }
  let hardestText = '';
  if (hardest && summary.hardestLine) {
    const vars = {
      line: lineName(hardest),
      cents: summary.hardestLine.cents,
      percent: percent(Math.round(summary.hardestLine.share * 100)),
    };
    const { problem } = summary.hardestLine;
    hardestText = t(
      problem ? HARDEST_KEYS[problem] : 'karaoke.score.hardestLowest',
      vars,
    );
  }
  const sung = summary.judged - summary.counts.missed;
  const onTimeCount = Math.round((summary.onTimeShare ?? 0) * sung);

  return (
    <article className="karaoke-score-card__pane">
      <header className="karaoke-score-card__top">
        <h2 id={titleId} className="karaoke-score-card__kicker">
          {t('karaoke.score.recapTitle')}
        </h2>
        <span className="karaoke-score-card__song">{songLabel}</span>
      </header>
      <div className="karaoke-score-card__score-row">
        <p className="karaoke-score-card__big">
          <KaraokeCountUp
            value={summary.score}
            from={0}
            durationMs={COUNT_MS}
            format={whole}
            widest={whole(KARAOKE_SCORE_MAX)}
          />
          <small>
            {t('karaoke.score.outOf', { max: whole(KARAOKE_SCORE_MAX) })}
          </small>
        </p>
        <div className="karaoke-score-card__grade">
          <b data-tone={ratingTone(summary.rating)}>
            {t(RATING_KEYS[summary.rating])}
          </b>
          <span className="karaoke-score-card__best" data-best={best.kind}>
            {bestText}
          </span>
        </div>
      </div>
      <dl className="karaoke-score-card__stats">
        <div>
          <dt>{t('karaoke.score.inTune')}</dt>
          <dd>
            <KaraokeCountUp
              value={Math.round((summary.inTuneShare ?? 0) * 100)}
              from={0}
              durationMs={COUNT_MS}
              format={percent}
              widest={percent(100)}
            />
          </dd>
          <dd className="is-note">{t('karaoke.score.inTuneNote')}</dd>
        </div>
        <div>
          <dt>{t('karaoke.score.onTime')}</dt>
          <dd>
            <KaraokeCountUp
              value={Math.round((summary.onTimeShare ?? 0) * 100)}
              from={0}
              durationMs={COUNT_MS}
              format={percent}
              widest={percent(100)}
            />
          </dd>
          <dd className="is-note">
            {t('karaoke.score.onTimeNote', {
              count: onTimeCount,
              total: sung,
            })}
          </dd>
        </div>
        <div>
          <dt>{t('karaoke.score.notes')}</dt>
          <dd>
            <KaraokeCountUp
              value={summary.hits}
              from={0}
              durationMs={COUNT_MS}
              format={whole}
              widest={whole(summary.judged)}
            />
            <span className="karaoke-score-card__of">
              {' / '}
              {whole(summary.judged)}
            </span>
          </dd>
          <dd className="is-note">{t('karaoke.score.notesNote')}</dd>
        </div>
      </dl>
      <KaraokeVerdictSplit counts={summary.counts} />
      {hardest && (
        <section className="karaoke-score-card__block">
          <h3>{t('karaoke.score.hardestTitle')}</h3>
          <p>{hardestText}</p>
        </section>
      )}
      <section className="karaoke-score-card__tip">
        <h3>{t('karaoke.score.tipTitle')}</h3>
        <p>{t(TIP_KEYS[summary.tip])}</p>
      </section>
      <div className="karaoke-score-card__actions">
        {hardest && (
          <button
            ref={practiseRef}
            type="button"
            className="button small"
            onClick={() => onPractiseLine(hardest)}
          >
            {t('karaoke.score.practisePassage')}
          </button>
        )}
        <button
          type="button"
          className="button small subtle"
          onClick={onSingAgain}
        >
          {t('karaoke.score.singAgain')}
        </button>
      </div>
    </article>
  );
};

export default KaraokeScoreRecap;
