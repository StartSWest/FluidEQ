import type { ReactNode } from 'react';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';

/** Signup explains free browsing separately from the optional trial. */
export default function AccountPitch({
  trial,
  termsLink,
}: {
  trial: boolean;
  termsLink: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <aside className="account__pitch">
      {trial && <h3 className="plus-card__pitch">{t('trial.offer.title')}</h3>}
      <p className="account__optional">
        {t(trial ? 'trial.consent.signIn' : 'account.optional')}
      </p>
      {trial ? (
        <p className="account__optional">
          {t('trial.browse')} {t('trial.offer.fine')}
        </p>
      ) : (
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
          <li>
            <span className="account__perk-mark" aria-hidden="true">
              <Glyph name="board" />
            </span>
            {t('account.perk.board')}
          </li>
        </ul>
      )}
      {termsLink}
    </aside>
  );
}
