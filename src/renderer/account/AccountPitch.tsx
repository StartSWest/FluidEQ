import type { ReactNode } from 'react';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';

/** Beside the sign-in form: that an account is optional, and what it opens. */
export default function AccountPitch({ termsLink }: { termsLink: ReactNode }) {
  const { t } = useTranslation();
  return (
    <aside className="account__pitch">
      <p className="account__optional">{t('account.optional')}</p>
      <ul className="account__perks">
        <li>
          <span className="account__perk-mark" aria-hidden="true">
            <Glyph name="looks" />
          </span>
          {t('account.perk.looks')}
        </li>
        <li>
          <span className="account__perk-mark" aria-hidden="true">
            <Glyph name="studio" />
          </span>
          {t('account.perk.visualizers')}
        </li>
      </ul>
      {termsLink}
    </aside>
  );
}
