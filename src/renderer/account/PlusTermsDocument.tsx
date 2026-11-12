import { useMemo } from 'react';
import type { TranslationKey } from 'common/i18n/en';
import { OFFICIAL_SITE_URL } from 'common/branding';
import { REPORT_EMAIL } from 'common/bugReport';
import { CREATOR_PAYOUTS_OPEN, formatDollars } from 'common/creatorPayouts';
import {
  CREATOR_HOLD_DAYS,
  CREATOR_MINIMUM_CENTS,
  CREATOR_PAYOUT_EVERY_DAYS,
  CREATOR_SHARE_PERCENT,
  CREDIT_REFUND_DAYS,
  PLUS_ACCOUNT_DELETION_DAYS,
  PLUS_MAX_COMPUTERS,
  PLUS_MAX_PUBLISHED_SCENES,
  PLUS_MINIMUM_AGE,
  PLUS_OFFLINE_GRACE_DAYS,
  PLUS_SHARES_PER_HOUR,
  PLUS_TAKEDOWN_PAUSE_DAYS,
  PLUS_TASTE_SECONDS,
  PLUS_TERMS_EDITION,
  termsEffectiveDate,
} from 'common/plusTerms';
import { PLUS_MOVE_CREDITS, STARTER_CREDITS } from 'common/sceneStore';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { TERMS_HIGHLIGHTS, termsLayout } from './plusTermsContent';
import '../styles/PlusTerms.scss';

/**
 * Every number the terms quote, from the constant the code keeps it with.
 * The contact is the support address the build was made with; a build
 * without one points at the site instead, so the sentence never ends in a
 * blank. The creator terms' names (share, days, amount) are the sign-up
 * dialog's own, because the section quotes its sentences.
 */
export const termsValues = (
  locale = 'en',
): Record<string, string | number> => ({
  graceDays: PLUS_OFFLINE_GRACE_DAYS,
  deletionDays: PLUS_ACCOUNT_DELETION_DAYS,
  age: PLUS_MINIMUM_AGE,
  computers: PLUS_MAX_COMPUTERS,
  tasteSeconds: PLUS_TASTE_SECONDS,
  starterCredits: STARTER_CREDITS,
  moveCredits: PLUS_MOVE_CREDITS,
  sharesPerHour: PLUS_SHARES_PER_HOUR,
  maxPublished: PLUS_MAX_PUBLISHED_SCENES,
  takedownDays: PLUS_TAKEDOWN_PAUSE_DAYS,
  contact: REPORT_EMAIL || new URL(OFFICIAL_SITE_URL).host,
  refundDays: CREDIT_REFUND_DAYS,
  share: CREATOR_SHARE_PERCENT,
  days: CREATOR_HOLD_DAYS,
  amount: formatDollars(CREATOR_MINIMUM_CENTS, locale),
  every: CREATOR_PAYOUT_EVERY_DAYS,
});

/** The document this build carries: payouts in it only while creators can be paid. */
const LAYOUT = termsLayout(CREATOR_PAYOUTS_OPEN);

/**
 * The Plus terms, as a document.
 *
 * The four facts that matter most first, as cards, so a person who reads
 * nothing else has still read those. Then the sections in order, each under
 * its own picture and number, with what the app sends as a list of rows —
 * what, when, who can see it — because that is the part people come back to,
 * and a row answers "does it send this" faster than a paragraph can.
 *
 * Only the document: the dialog around it decides whether it ends in an
 * agreement or in a way back.
 */
export default function PlusTermsDocument() {
  const { t, locale } = useTranslation();
  const values = useMemo(() => termsValues(locale), [locale]);
  const effective = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'long',
        timeZone: 'UTC',
      }).format(termsEffectiveDate()),
    [locale],
  );
  const say = (key: TranslationKey) => t(key, values);

  return (
    <article className="plus-terms">
      <header className="plus-terms__lede">
        <span className="plus-terms__meta">
          {t('terms.meta', { version: PLUS_TERMS_EDITION, date: effective })}
        </span>
        <p className="plus-terms__intro">{t(LAYOUT.intro)}</p>
      </header>

      <section className="plus-terms__short" aria-labelledby="plus-terms-short">
        <h3 id="plus-terms-short" className="eyebrow">
          {t('terms.short.title')}
        </h3>
        <ul className="plus-terms__highlights">
          {TERMS_HIGHLIGHTS.map((item) => (
            <li key={item.title} className="plus-terms__highlight">
              <span className="plus-terms__highlight-mark" aria-hidden="true">
                <Glyph name={item.glyph} />
              </span>
              <span className="plus-terms__highlight-title">
                {say(item.title)}
              </span>
              <span className="plus-terms__highlight-body">
                {say(item.body)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <ol className="plus-terms__sections">
        {LAYOUT.sections.map((section, index) => (
          <li
            key={section.id}
            className={`plus-terms__section plus-terms__section--${section.id}`}
          >
            <h3 className="plus-terms__heading">
              <span className="plus-terms__heading-mark" aria-hidden="true">
                <Glyph name={section.glyph} />
              </span>
              <span className="plus-terms__heading-number" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              {t(section.title)}
            </h3>

            {section.body === 'points' ? (
              <ul className="plus-terms__points">
                {section.lines.map((line) => (
                  <li key={line}>{say(line)}</li>
                ))}
              </ul>
            ) : (
              section.lines.map((line) => (
                <p key={line} className="plus-terms__text">
                  {say(line)}
                </p>
              ))
            )}

            {section.body === 'sent' && (
              <ul className="plus-terms__sent">
                {LAYOUT.sentRows.map((row) => (
                  <li key={row.id} className="plus-terms__sent-row">
                    <span className="plus-terms__sent-mark" aria-hidden="true">
                      <Glyph name={row.glyph} />
                    </span>
                    <div className="plus-terms__sent-body">
                      <span className="plus-terms__sent-what">
                        {say(row.what)}
                      </span>
                      <dl className="plus-terms__sent-facts">
                        <div>
                          <dt>{t('terms.sent.when')}</dt>
                          <dd>{say(row.when)}</dd>
                        </div>
                        <div>
                          <dt>{t('terms.sent.who')}</dt>
                          <dd>{say(row.who)}</dd>
                        </div>
                      </dl>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </article>
  );
}
