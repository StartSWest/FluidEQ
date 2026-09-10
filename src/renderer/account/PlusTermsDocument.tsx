import { useMemo } from 'react';
import type { TranslationKey } from 'common/i18n/en';
import { ACCOUNT_CONFIG } from 'common/accountConfig';
import { OFFICIAL_SITE_URL } from 'common/branding';
import { REPORT_EMAIL } from 'common/bugReport';
import {
  DAILY_LISTENING_CAP_HOURS,
  LISTENING_UPLOAD_INTERVAL_HOURS,
  LISTENING_WINDOW_DAYS,
} from 'common/leaderboardScore';
import {
  PLUS_ACCOUNT_DELETION_DAYS,
  PLUS_MINIMUM_AGE,
  PLUS_OFFLINE_GRACE_DAYS,
  PLUS_REFUND_DAYS,
  PLUS_TERMS_VERSION,
  termsEffectiveDate,
} from 'common/plusTerms';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import {
  TERMS_HIGHLIGHTS,
  TERMS_SECTIONS,
  TERMS_SENT_ROWS,
} from './plusTermsContent';
import '../styles/PlusTerms.scss';

/**
 * Every number the terms quote, from the constant the code keeps it with.
 *
 * The contact is the support address the build was made with; a build
 * without one points at the site instead, so the sentence never ends in a
 * blank.
 */
const termsValues = (): Record<string, string | number> => ({
  price: ACCOUNT_CONFIG.plusPrice,
  refundDays: PLUS_REFUND_DAYS,
  graceDays: PLUS_OFFLINE_GRACE_DAYS,
  deletionDays: PLUS_ACCOUNT_DELETION_DAYS,
  age: PLUS_MINIMUM_AGE,
  capHours: DAILY_LISTENING_CAP_HOURS,
  windowDays: LISTENING_WINDOW_DAYS,
  uploadHours: LISTENING_UPLOAD_INTERVAL_HOURS,
  contact: REPORT_EMAIL || new URL(OFFICIAL_SITE_URL).host,
});

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
  const values = useMemo(termsValues, []);
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
          {t('terms.meta', { version: PLUS_TERMS_VERSION, date: effective })}
        </span>
        <p className="plus-terms__intro">{t('terms.intro')}</p>
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
        {TERMS_SECTIONS.map((section, index) => (
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
                {TERMS_SENT_ROWS.map((row) => (
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
