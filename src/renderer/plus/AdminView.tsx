/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import { useAccount } from '../account/accountStore';
import Glyph, { type TCommunityGlyph } from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import AdminAccounts from './AdminAccounts';
import { useGalleryNotice, type IGalleryNotice } from './galleryActions';
import { useModeration } from './moderationStore';
import {
  ADMIN_SECTIONS,
  openAdminSection,
  usePlusNavigation,
  type TAdminSection,
} from './plusNavigation';
import PlusGifts from './PlusGifts';
import PlusToastStack from './PlusToastStack';
import ReportedScenes from './ReportedScenes';
import ReviewQueue from './ReviewQueue';
import '../styles/Gallery.scss';
import '../styles/Admin.scss';

const SECTIONS: Record<
  TAdminSection,
  { glyph: TCommunityGlyph; name: TranslationKey }
> = {
  accounts: { glyph: 'person', name: 'plus.gallery.accounts' },
  gifts: { glyph: 'gift', name: 'plus.gallery.gifts' },
  reported: { glyph: 'report', name: 'plus.gallery.reported' },
  review: { glyph: 'check', name: 'review.tab' },
};

/**
 * The admin's own place in the Plus tab: the scenes waiting to be approved,
 * the scenes members reported, every account and the Plus given away, one
 * page at a time under a row of tabs.
 *
 * These pages lived behind three buttons on the gallery's toolbar, where they
 * crowded a member's page with things no member could use. Only the account
 * the server calls the admin is offered the place, and the server still
 * decides every call on its own; nothing here does.
 */
export default function AdminView() {
  const { t, locale } = useTranslation();
  const { admin: section } = usePlusNavigation();
  const account = useAccount();
  const moderation = useModeration();
  const notice = useGalleryNotice();

  return (
    <>
      <header className="community__head gallery-head">
        <span
          className="community__head-mark admin-head__mark"
          aria-hidden="true"
        >
          <Glyph name="shield" />
        </span>
        <span className="community__head-text">
          <span className="community__head-name">{t('plus.admin.title')}</span>
          <span className="community__head-description">
            {t('plus.admin.description')}
          </span>
        </span>
        {/* What the gifts and the reported scenes say back, as the gallery
            says it: under the head, which stays put. */}
        <PlusToastStack<IGalleryNotice>
          sources={{ gallery: notice }}
          text={(entry) => t(entry.key, entry.vars)}
        />
      </header>
      <nav className="admin-sections" aria-label={t('plus.admin.title')}>
        {ADMIN_SECTIONS.map((entry) => {
          const active = entry === section;
          return (
            <button
              key={entry}
              type="button"
              className={`admin-sections__tab${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => openAdminSection(entry)}
            >
              <Glyph name={SECTIONS[entry].glyph} />
              {t(SECTIONS[entry].name)}
              {entry === 'reported' && moderation.open > 0 && (
                <span
                  className="gallery-toolbar__badge"
                  aria-label={t('plus.gallery.reportedOpen', {
                    count: String(moderation.open),
                  })}
                >
                  {new Intl.NumberFormat(locale).format(moderation.open)}
                </span>
              )}
              {entry === 'review' && moderation.review > 0 && (
                <span
                  className="gallery-toolbar__badge"
                  aria-label={t('review.tabCount', {
                    count: String(moderation.review),
                  })}
                >
                  {new Intl.NumberFormat(locale).format(moderation.review)}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      {/* Keyed by page, so each one opens at its top. */}
      <div key={section} className="gallery-visualizers">
        {section === 'accounts' && <AdminAccounts />}
        {section === 'gifts' && <PlusGifts />}
        {section === 'reported' && <ReportedScenes me={account.identity?.id} />}
        {section === 'review' && <ReviewQueue me={account.identity?.id} />}
      </div>
    </>
  );
}
