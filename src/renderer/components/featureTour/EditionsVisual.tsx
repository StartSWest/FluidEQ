/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { AUTHOR_NAME } from '../../../common/branding';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';

/**
 * The two editions as the app shows them: the free copy's line in About with
 * the notice it gets when a new version is out (Download loud, automatic
 * updates quiet), over the signed copy's line with its publisher and the
 * owner's card in Account. Every word is the app's own label, so the picture
 * speaks each language and follows a renamed control. No price: the offer
 * is drawn without one, as the app draws it when the server gives none.
 *
 * No animation: the lines it copies stand still in the app too.
 */
export default function EditionsVisual() {
  const { t } = useTranslation();
  const signed = t('edition.updates', {
    edition: t('edition.signedBy', { publisher: AUTHOR_NAME }),
  });
  return (
    <div
      className="editions-visual"
      role="img"
      aria-label={t('tour.editions.imageAlt')}
    >
      <section className="editions-visual__edition">
        <span className="editions-visual__line">
          <strong>{t('edition.free')}</strong>
          <small>{t('edition.freeHint')}</small>
        </span>
        <span className="editions-visual__notice">
          <strong>{t('update.onSite.title')}</strong>
          <span className="editions-visual__actions">
            <span className="button small">{t('update.onSite.download')}</span>
            <span className="button small subtle">
              {t('update.onSite.getAutoNoPrice')}
            </span>
          </span>
        </span>
      </section>

      <section className="editions-visual__edition is-signed">
        <span className="editions-visual__line is-active">
          <strong>
            <MenuIcon name="shield" />
            {signed}
          </strong>
          <small>{t('edition.card.yours')}</small>
        </span>
        <span className="editions-visual__actions">
          <span className="button small">{t('edition.card.download')}</span>
          <span className="editions-visual__link">
            {t('edition.card.other')}
          </span>
        </span>
      </section>
    </div>
  );
}
