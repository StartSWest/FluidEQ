import type { TranslationKey } from 'common/i18n/en';
import {
  ACTIVE_DAY_MINUTES,
  DAILY_LISTENING_CAP_HOURS,
  DAILY_MESSAGE_CAP,
  PART_POINTS,
  SCORE_PARTS,
  type TScorePart,
} from 'common/leaderboardScore';
import { requestAccountPanel } from '../account/accountPanel';
import { useTranslation } from '../utils/I18nContext';
import Glyph from './Glyph';
import { PART_GLYPHS, PART_KEYS } from './leaderboardParts';
import '../styles/LeaderboardGuide.scss';

/** Each rule's sentence, and the limit it names from the scoring's own numbers. */
const RULES: Readonly<
  Record<TScorePart, { key: TranslationKey; limit?: number }>
> = {
  hours: { key: 'leaderboard.guide.hours', limit: DAILY_LISTENING_CAP_HOURS },
  days: { key: 'leaderboard.guide.days', limit: ACTIVE_DAY_MINUTES },
  messages: { key: 'leaderboard.guide.messages', limit: DAILY_MESSAGE_CAP },
  mentions: { key: 'leaderboard.guide.mentions' },
};

/**
 * How points are earned, beside the board.
 *
 * A column on a wide pane, kept in view while the rows scroll; under the
 * board on a narrow one. Each part in the colour it wears on the standing bar
 * and under every name, with its worth large enough to compare at a glance.
 *
 * It ends on how the numbers are known, because the honest answer is part of
 * the rules: listening is counted on the reader's own computer, and the board
 * is only as fair as the checks on what arrives. The link goes to the Plus
 * terms, where everything the app sends is listed in full.
 */
export default function LeaderboardGuide() {
  const { t } = useTranslation();
  return (
    <aside
      className="leaderboard-guide"
      aria-labelledby="leaderboard-guide-title"
    >
      <header className="leaderboard-guide__head">
        <span id="leaderboard-guide-title" className="eyebrow">
          {t('leaderboard.guide.title')}
        </span>
        <p className="leaderboard-guide__lead">{t('leaderboard.guide.lead')}</p>
      </header>

      <ol className="leaderboard-guide__list">
        {SCORE_PARTS.map((part) => {
          const { key, limit } = RULES[part];
          return (
            <li
              key={part}
              className={`leaderboard-guide__item leaderboard-part--${part}`}
            >
              <span className="leaderboard-guide__mark" aria-hidden="true">
                <Glyph name={PART_GLYPHS[part]} />
              </span>
              <span className="leaderboard-guide__text">
                <span className="leaderboard-guide__name">
                  {t(PART_KEYS[part])}
                </span>
                <span className="leaderboard-guide__rule">
                  {t(key, limit === undefined ? undefined : { limit })}
                </span>
              </span>
              <span className="leaderboard-guide__value">
                {t('leaderboard.guide.value', { points: PART_POINTS[part] })}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="leaderboard-guide__fair">
        <span className="leaderboard-guide__fair-mark" aria-hidden="true">
          <Glyph name="shield" />
        </span>
        <div className="leaderboard-guide__fair-text">
          <span className="leaderboard-guide__fair-title">
            {t('leaderboard.guide.fairTitle')}
          </span>
          <p>{t('leaderboard.guide.fair')}</p>
          <button
            type="button"
            className="account-link"
            onClick={() => requestAccountPanel('terms')}
          >
            {t('leaderboard.guide.terms')}
          </button>
        </div>
      </div>
    </aside>
  );
}
