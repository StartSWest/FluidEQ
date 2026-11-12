/* FluidEQ — GPL-3.0-or-later */

import { useId, useState } from 'react';
import {
  EDITION_SUPPORT_EMAIL,
  type TEditionLinkFinish,
} from 'common/signedEdition';
import type { TranslationKey } from 'common/i18n';
import { creditsText } from '../plus/credits';
import { useTranslation } from '../utils/I18nContext';
import { useSignedEdition } from './useSignedEdition';
import '../styles/Account.scss';
import '../styles/AccountForms.scss';

type TNote =
  | 'sent'
  | 'limited'
  | 'linked'
  | 'wrong'
  | 'tooSoon'
  | 'failed'
  | 'noRelease'
  | 'downloadFailed';

const NOTES: Record<TNote, TranslationKey> = {
  sent: 'edition.card.sent',
  limited: 'edition.card.limited',
  linked: 'edition.card.linked',
  wrong: 'edition.card.wrong',
  tooSoon: 'edition.card.tooSoon',
  failed: 'edition.card.failed',
  noRelease: 'edition.card.noRelease',
  downloadFailed: 'edition.card.downloadFailed',
};

const FINISHED: Record<TEditionLinkFinish, TNote> = {
  linked: 'linked',
  no: 'wrong',
  'too-soon': 'tooSoon',
  'signed-out': 'failed',
  failed: 'failed',
};

const bridge = () => window.electron?.ipcRenderer;

/**
 * The Signed Edition in the account panel, kept to the minimum (Ivan,
 * 2026-11-11): owning it, with the download and the two lines of support;
 * or the offer, which says to pay with this account's email so the purchase
 * links by itself, with the quiet way round for one paid with another
 * address: a code sent to that address, typed back here.
 *
 * Shown only once the server has answered, and not at all when it could not
 * say: an edition drawn as "not yours" on a failed question would be wrong
 * to exactly the people who bought it.
 */
export default function SignedEditionCard() {
  const { t, locale } = useTranslation();
  const ids = useId();
  const [asked, setAsked] = useState(0);
  const status = useSignedEdition(asked);
  const [linking, setLinking] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<TNote>();

  if (
    !status ||
    status.account === 'unknown' ||
    status.account === 'signed-out'
  ) {
    return null;
  }

  const run = (work: () => Promise<TNote | undefined> | undefined) => {
    setBusy(true);
    setNote(undefined);
    (work() ?? Promise.resolve<TNote | undefined>('failed'))
      .then((next) => {
        setNote(next);
        return undefined;
      })
      .catch(() => setNote('failed'))
      .finally(() => setBusy(false));
  };

  if (status.account === 'owned') {
    return (
      <section className="edition-card" aria-labelledby="edition-card-title">
        <span id="edition-card-title" className="plus-card__eyebrow">
          {t('edition.signed')}
        </span>
        <div className="edition-card__row">
          <p className="plus-card__line">{t('edition.card.yours')}</p>
          <button
            type="button"
            className={`button small subtle${busy ? ' is-running' : ''}`}
            aria-busy={busy}
            disabled={busy}
            onClick={() =>
              run(() =>
                bridge()
                  ?.signedEditionDownload?.()
                  .then((outcome): TNote | undefined => {
                    if (outcome.ok) {
                      return undefined;
                    }
                    return outcome.reason === 'no-release'
                      ? 'noRelease'
                      : 'downloadFailed';
                  }),
              )
            }
          >
            {t('edition.card.download')}
          </button>
        </div>
        {note && (
          <p className="edition-card__note" role="status">
            {t(NOTES[note])}
          </p>
        )}
        <p className="edition-card__support">{t('edition.card.receipt')}</p>
        <p className="edition-card__support">
          {t('edition.card.support', { email: EDITION_SUPPORT_EMAIL })}
          {status.order && (
            <span className="edition-card__order">
              {t('edition.card.order', { order: status.order })}
            </span>
          )}
        </p>
      </section>
    );
  }

  return (
    <section className="edition-card" aria-labelledby="edition-card-title">
      <span id="edition-card-title" className="plus-card__eyebrow">
        {t('edition.signed')}
      </span>
      <div className="edition-card__row">
        <p className="plus-card__line">
          {status.credits
            ? t('edition.card.offerCredits', {
                credits: creditsText(t, locale, status.credits),
              })
            : t('edition.card.offer')}{' '}
          {t('edition.card.payHint')}
        </p>
        <button
          type="button"
          className="button small subtle"
          onClick={() => {
            bridge()
              ?.signedEditionBuy?.()
              .catch(() => undefined);
          }}
        >
          {status.price
            ? t('edition.card.buy', { price: status.price })
            : t('edition.card.buyNoPrice')}
        </button>
      </div>
      {!linking && (
        <button
          type="button"
          className="edition-card__other"
          onClick={() => setLinking(true)}
        >
          {t('edition.card.other')}
        </button>
      )}
      {linking && (
        <div className="edition-card__link">
          <p className="edition-card__support">{t('edition.card.otherHint')}</p>
          <form
            className="edition-card__form"
            onSubmit={(event) => {
              event.preventDefault();
              run(() =>
                bridge()
                  ?.signedEditionLinkStart?.(email)
                  .then((outcome): TNote => {
                    if (outcome === 'sent') {
                      setCodeSent(true);
                      return 'sent';
                    }
                    return outcome === 'limited' ? 'limited' : 'failed';
                  }),
              );
            }}
          >
            <label
              className="account-field edition-card__field"
              htmlFor={`${ids}-email`}
            >
              <span className="account-field__label">
                {t('edition.card.email')}
              </span>
              <input
                id={`${ids}-email`}
                type="email"
                value={email}
                autoComplete="email"
                required
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="button small subtle"
              disabled={busy || email.trim().length === 0}
            >
              {t('edition.card.send')}
            </button>
          </form>
          {codeSent && (
            <form
              className="edition-card__form"
              onSubmit={(event) => {
                event.preventDefault();
                run(() =>
                  bridge()
                    ?.signedEditionLinkFinish?.(email, code)
                    .then((outcome): TNote => {
                      if (outcome === 'linked') {
                        // Asked again: the card becomes the owner's.
                        setAsked((count) => count + 1);
                      }
                      return FINISHED[outcome];
                    }),
                );
              }}
            >
              <label
                className="account-field edition-card__field"
                htmlFor={`${ids}-code`}
              >
                <span className="account-field__label">
                  {t('edition.card.code')}
                </span>
                <input
                  id={`${ids}-code`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={code}
                  required
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, ''))
                  }
                />
              </label>
              <button
                type="submit"
                className="button small"
                disabled={busy || code.length !== 6}
              >
                {t('edition.card.link')}
              </button>
            </form>
          )}
          {note && (
            <p className="edition-card__note" role="status">
              {t(NOTES[note])}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
