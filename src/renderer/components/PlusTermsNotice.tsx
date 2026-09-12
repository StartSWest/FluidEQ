/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo, type ReactNode } from 'react';
import {
  PLUS_TERMS_VERSION,
  PLUS_TERMS_EDITION,
  PLUS_TERMS_FIRST_PUBLIC_REVISION,
  termsEffectiveDate,
} from 'common/plusTerms';
import { PLUS_TERMS_CHANGES } from 'common/plusTermsNotice';
import { requestAccountPanel } from '../account/accountPanel';
import {
  markPlusTermsNoticeSeen,
  usePlusTermsNotice,
} from '../account/plusTermsNoticeStore';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import '../styles/PlusTermsNotice.scss';

const CHANGES_ID = 'plus-terms-notice-changes';

/**
 * Tells a Plus member that the terms changed since the version they agreed
 * to: what changed, one sentence per version, and the way to the terms.
 *
 * Mounted at the app root beside the other corner notices, because the terms
 * promise that the app tells people, not that the Plus tab does: a member who
 * only ever uses their looks from the graph would otherwise never be told.
 * Beside the work, never in front of it — nothing here needs answering before
 * anything else can happen, so it takes no focus and blocks nothing.
 *
 * Reading the terms is the recommendation, and wears the loud button; "Got it"
 * is the quiet one. Either puts the notice away for good for this version:
 * the promise is to tell, once, and somebody who opened the terms from it has
 * been told.
 *
 * Whether it shows is decided in the main process, which holds every fact it
 * depends on; see `common/plusTermsNotice.ts`.
 */
const PlusTermsNotice = () => {
  const { t, locale } = useTranslation();
  const notice = usePlusTermsNotice();
  const effective = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'long',
        timeZone: 'UTC',
      }).format(termsEffectiveDate()),
    [locale],
  );

  // Only a notice about the text this window carries. In development the main
  // process can run an older copy of `common` than the renderer until it
  // restarts, and a date or a sentence for the wrong version is worse than
  // waiting for the two to agree.
  if (!notice || notice.version !== PLUS_TERMS_VERSION) {
    return null;
  }

  const changes = notice.changes.flatMap((version) => {
    if (version < PLUS_TERMS_FIRST_PUBLIC_REVISION) {
      return [];
    }
    const key = PLUS_TERMS_CHANGES[version];
    return key ? [{ version, key }] : [];
  });

  // Only published changes belong in the notice; internal pre-release
  // revision numbers are not public editions.
  let described: ReactNode = null;
  if (changes.length === 1) {
    described = (
      <p id={CHANGES_ID} className="plus-terms-notice__change">
        {t(changes[0].key)}
      </p>
    );
  } else if (changes.length > 1) {
    described = (
      <ul id={CHANGES_ID} className="plus-terms-notice__changes">
        {changes.map(({ version, key }) => (
          <li key={version}>
            <span className="plus-terms-notice__change">{t(key)}</span>
          </li>
        ))}
      </ul>
    );
  }

  const putAway = () => {
    markPlusTermsNoticeSeen(notice.version).catch(() => undefined);
  };

  return (
    <div
      className="plus-terms-notice"
      role="dialog"
      aria-labelledby="plus-terms-notice-title"
      aria-describedby={described ? CHANGES_ID : undefined}
    >
      <div className="plus-terms-notice__body">
        <MenuIcon name="plusTab" className="plus-terms-notice__icon" />
        <div className="plus-terms-notice__text">
          <strong id="plus-terms-notice-title">{t('termsNotice.title')}</strong>
          <span className="plus-terms-notice__meta">
            {t('terms.meta', { version: PLUS_TERMS_EDITION, date: effective })}
          </span>
          {described}
        </div>
      </div>
      <div className="plus-terms-notice__actions">
        <button type="button" className="button small subtle" onClick={putAway}>
          {t('termsNotice.gotIt')}
        </button>
        <button
          type="button"
          className="button small"
          onClick={() => {
            putAway();
            requestAccountPanel('terms');
          }}
        >
          {t('termsNotice.read')}
        </button>
      </div>
    </div>
  );
};

export default PlusTermsNotice;
