/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type IKaraokeScoreLine,
  type IKaraokeScoreSheet,
  KARAOKE_SCORE_MAX,
} from '../../common/karaoke/scoring';
import {
  karaokeLineResult,
  karaokeRating,
  karaokeScoreTotal,
  karaokeStreak,
} from '../../common/karaoke/scoringRun';
import { useTranslation } from '../utils/I18nContext';
import KaraokeCountUp from './KaraokeCountUp';
import {
  formatKaraokePercent,
  formatKaraokeWhole,
  RATING_KEYS,
  ratingTone,
  useLineName,
} from './karaokeScoreFormat';
import { type IKaraokeScoreSnapshot } from './useKaraokeScore';

/** The line just closed, the one being sung, and the next. */
const LINES_SHOWN = 3;

interface IKaraokeScoreLinesProps {
  sheet: IKaraokeScoreSheet;
  snapshot: IKaraokeScoreSnapshot;
  onPractiseLine: (line: IKaraokeScoreLine) => void;
}

interface IKaraokeScoreLineRowProps {
  line: IKaraokeScoreLine;
  sheet: IKaraokeScoreSheet;
  snapshot: IKaraokeScoreSnapshot;
  /** The line being sung, or the next one to sing. */
  isCurrent: boolean;
  onPractiseLine: (line: IKaraokeScoreLine) => void;
}

const KaraokeScoreLineRow = ({
  line,
  sheet,
  snapshot,
  isCurrent,
  onPractiseLine,
}: IKaraokeScoreLineRowProps) => {
  const { t, locale } = useTranslation();
  const lineName = useLineName();
  const { closed, share } = karaokeLineResult(line, sheet, snapshot.results);
  const name = t('karaoke.score.lineNumber', { number: line.index + 1 });
  const practise = t('karaoke.score.practiseLine', { line: lineName(line) });
  const rating = share === undefined ? undefined : karaokeRating(share);
  return (
    <li className={isCurrent ? 'is-current' : undefined}>
      <button
        type="button"
        className="karaoke-score__line"
        onClick={() => onPractiseLine(line)}
        title={practise}
        aria-label={practise}
      >
        <span className="karaoke-score__cells" aria-hidden="true">
          {line.noteIndexes.map((index) => {
            const note = sheet.notes[index];
            return (
              <i
                key={index}
                className={`karaoke-score__cell${
                  index === snapshot.firstOpen ? ' is-now' : ''
                }`}
                data-verdict={snapshot.results[index]?.verdict}
                style={{ flexGrow: note.endMs - note.startMs }}
              />
            );
          })}
        </span>
        <span className="karaoke-score__label">
          <span>{name}</span>
          {closed && rating && share !== undefined && (
            <b data-tone={ratingTone(rating)}>
              {t(RATING_KEYS[rating])}
              {' · '}
              <KaraokeCountUp
                value={Math.round(share * 100)}
                from={0}
                format={(percent) => formatKaraokePercent(locale, percent)}
                widest={formatKaraokePercent(locale, 100)}
              />
            </b>
          )}
        </span>
      </button>
    </li>
  );
};

/**
 * Line by line under the strip, the "2 · Frase a frase" of the mockup (Ivan,
 * 2026-11-16: "he wants to go straight to a line and practise it"): each lyric
 * line a row of cells, one per note and as long as it, filling with their
 * verdicts' colours; its rating and percentage once it ends; and a press on
 * it takes the song back to that line to sing it again. The running score
 * and the streak stand at its end, counting.
 */
const KaraokeScoreLines = ({
  sheet,
  snapshot,
  onPractiseLine,
}: IKaraokeScoreLinesProps) => {
  const { t, locale } = useTranslation();
  const { results, firstOpen } = snapshot;
  const current =
    sheet.notes[Math.min(firstOpen, sheet.notes.length - 1)].lineIndex;
  const first = Math.max(
    0,
    Math.min(current - 1, sheet.lines.length - LINES_SHOWN),
  );
  const shown = sheet.lines.slice(first, first + LINES_SHOWN);
  const formatWhole = (value: number) => formatKaraokeWhole(locale, value);
  return (
    <section className="karaoke-score" aria-label={t('karaoke.score.title')}>
      <ol className="karaoke-score__lines">
        {shown.map((line) => (
          <KaraokeScoreLineRow
            key={line.index}
            line={line}
            sheet={sheet}
            snapshot={snapshot}
            isCurrent={line.index === current}
            onPractiseLine={onPractiseLine}
          />
        ))}
      </ol>
      <div className="karaoke-score__total">
        <KaraokeCountUp
          className="karaoke-score__points"
          value={karaokeScoreTotal(results)}
          format={formatWhole}
          widest={formatWhole(KARAOKE_SCORE_MAX)}
          durationMs={700}
        />
        <span className="karaoke-score__sub">
          {t('karaoke.score.outOf', { max: formatWhole(KARAOKE_SCORE_MAX) })}
          <span className="karaoke-score__streak">
            {t('karaoke.score.streak')}{' '}
            <KaraokeCountUp
              value={karaokeStreak(results)}
              format={formatWhole}
              widest="00"
              durationMs={320}
            />
          </span>
        </span>
      </div>
    </section>
  );
};

export default KaraokeScoreLines;
