/* FluidEQ — GPL-3.0-or-later */

import { requestAccountPanel } from '../account/accountPanel';
import { useAccount } from '../account/accountStore';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { useSignedEdition } from './useSignedEdition';
import '../styles/Edition.scss';

const buy = () => {
  window.electron?.ipcRenderer?.signedEditionBuy?.().catch(() => undefined);
};

/**
 * Which edition this copy is, in About (session 22's frame 5c): the signed
 * one with its publisher and that it updates itself; the signed one that
 * needs a sign-in to keep updating; or the free one, whose new versions are
 * on the site. Nothing here is ever a fault: every state is a working app.
 *
 * The publisher is the name on the build's certificate, which is the
 * developer's own; the business the edition is sold through is not named
 * here.
 */
export default function EditionLine() {
  const { t } = useTranslation();
  const account = useAccount();
  const status = useSignedEdition();
  if (!status) {
    return null;
  }
  const offer = status.price
    ? t('update.onSite.getAuto', { price: status.price })
    : t('update.onSite.getAutoNoPrice');

  if (!status.signedCopy) {
    return (
      <section className="edition-line" aria-label={t('edition.free')}>
        <span className="edition-line__text">
          <strong>{t('edition.free')}</strong>
          <span>{t('edition.freeHint')}</span>
        </span>
        <button type="button" className="button small subtle" onClick={buy}>
          {offer}
        </button>
      </section>
    );
  }

  const name = status.publisher
    ? t('edition.signedBy', { publisher: status.publisher })
    : t('edition.signed');

  if (status.account === 'signed-out') {
    return (
      <section
        className="edition-line is-waiting"
        aria-label={t('edition.signed')}
      >
        <span className="edition-line__text">
          <strong>{t('edition.signIn')}</strong>
          <span>{t('edition.signInHint')}</span>
        </span>
        <button
          type="button"
          className="button small"
          onClick={() => requestAccountPanel()}
        >
          {t('account.signIn')}
        </button>
      </section>
    );
  }

  if (status.account === 'not-owned') {
    return (
      <section
        className="edition-line is-waiting"
        aria-label={t('edition.signed')}
      >
        <span className="edition-line__text">
          <strong>{t('edition.notActivated')}</strong>
          <span>{t('edition.notActivatedHint')}</span>
        </span>
        <button type="button" className="button small subtle" onClick={buy}>
          {offer}
        </button>
      </section>
    );
  }

  // Owned, or a question the server did not answer: the copy is what it is.
  const owned = status.account === 'owned';
  return (
    <section
      className={`edition-line${owned ? ' is-active' : ''}`}
      aria-label={t('edition.signed')}
    >
      <span className="edition-line__text">
        <strong>
          {owned && <MenuIcon name="shield" />}
          {owned ? t('edition.updates', { edition: name }) : name}
        </strong>
        {owned && account.identity?.email && (
          <span>
            {t('edition.signedInAs', { email: account.identity.email })}
          </span>
        )}
      </span>
    </section>
  );
}
