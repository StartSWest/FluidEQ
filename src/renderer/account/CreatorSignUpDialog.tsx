/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  formatDollars,
  isPayableCountry,
  PAYABLE_COUNTRIES,
  type ICreatorTerms,
  type TCreatorFailure,
} from 'common/creatorPayouts';
import DialogFrame from '../components/DialogFrame';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import Dropdown from '../widgets/Dropdown';
import { CREATOR_ERRORS } from './creatorErrors';

/**
 * Signing up to be paid, before Stripe's own pages: the country (asked once,
 * because Stripe cannot move an account to another), the creator terms with
 * the server's own numbers in them, and the press that agrees to them and
 * opens Stripe in the browser. Stripe asks for everything else — identity,
 * bank, tax — and FluidEQ never sees any of it.
 *
 * Also how an unfinished sign-up is picked up again, and how newer terms are
 * agreed to: then there is no country to ask, and the press is the same.
 */

/** The country somebody's language most likely means, if Stripe pays there. */
const guessCountry = (): string => {
  const region = navigator.languages
    .map((tag) => {
      try {
        return new Intl.Locale(tag).maximize().region;
      } catch {
        return undefined;
      }
    })
    .find(isPayableCountry);
  return region ?? '';
};

interface ICreatorSignUpDialogProps {
  terms: ICreatorTerms;
  /** Asked only the first time; an account keeps the one it was made in. */
  askCountry: boolean;
  onClose: () => void;
  /** Told once Stripe's page is open in the browser. */
  onOpened: () => void;
}

export default function CreatorSignUpDialog({
  terms,
  askCountry,
  onClose,
  onOpened,
}: ICreatorSignUpDialogProps) {
  const { t, locale } = useTranslation();
  const ids = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [country, setCountry] = useState(guessCountry);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<TCreatorFailure>();

  const close = useCallback(() => onClose(), [onClose]);
  useModalKeys(surfaceRef, closeRef, { busy, onCancel: close });

  // Each country in the reader's own language, in the reader's own order.
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: 'region' });
    const collator = new Intl.Collator(locale);
    return PAYABLE_COUNTRIES.map((code) => {
      const label = names.of(code) ?? code;
      return { value: code, label, display: label };
    }).sort((a, b) => collator.compare(a.label, b.label));
  }, [locale]);

  const ready = !askCountry || isPayableCountry(country);

  const go = async () => {
    if (!ready || busy) {
      return;
    }
    setBusy(true);
    setFailure(undefined);
    const outcome = await window.electron?.ipcRenderer
      ?.startCreatorSignUp?.(askCountry ? country : undefined, locale)
      .catch(() => undefined);
    setBusy(false);
    if (outcome?.ok) {
      onOpened();
      return;
    }
    setFailure(outcome ? outcome.reason : 'offline');
  };

  const money = (cents: number) => formatDollars(cents, locale);

  return createPortal(
    <div
      className="gallery-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          close();
        }
      }}
    >
      <DialogFrame
        ref={surfaceRef}
        className="gallery-report-dialog creator-dialog"
        icon={<Glyph name="payout" />}
        title={t('creator.dialog.title')}
        titleId={`${ids}-title`}
        description={<span id={`${ids}-lead`}>{t('creator.dialog.lead')}</span>}
        aria-describedby={`${ids}-lead`}
        rail={
          // The whole way, before the first step of it: half of it happens
          // in the browser, where this dialog cannot say anything.
          <ol className="creator-dialog__steps">
            <li>{t('creator.dialog.step1')}</li>
            <li>{t('creator.dialog.step2')}</li>
            <li>{t('creator.dialog.step3')}</li>
          </ol>
        }
        closeLabel={t('support.close')}
        onClose={busy ? undefined : close}
        footer={
          <div className="dialog-frame__actions">
            <button
              ref={closeRef}
              type="button"
              className="button small subtle"
              disabled={busy}
              onClick={close}
            >
              {t('creator.dialog.cancel')}
            </button>
            <button
              type="button"
              className="button small"
              disabled={!ready || busy}
              aria-busy={busy}
              onClick={() => {
                go().catch(() => undefined);
              }}
            >
              {t(busy ? 'creator.dialog.opening' : 'creator.dialog.go')}
            </button>
          </div>
        }
      >
        <div className="creator-dialog__body">
          {askCountry && (
            <div className="creator-dialog__country">
              <span id={`${ids}-country`} className="creator-dialog__label">
                {t('creator.dialog.country')}
              </span>
              <Dropdown
                name={t('creator.dialog.country')}
                options={countries}
                value={country}
                isDisabled={busy}
                isFilterable
                filterPlaceholder={t('creator.dialog.search')}
                noSelectionPlaceholder={t('creator.dialog.choose')}
                placement="down"
                menuClassName="creator-country-menu"
                handleChange={setCountry}
              />
              <p className="creator-dialog__hint">
                {t('creator.dialog.countryHint')}
              </p>
            </div>
          )}

          <section
            className="creator-dialog__terms"
            aria-labelledby={`${ids}-terms`}
          >
            <h3 id={`${ids}-terms`} className="plus-card__eyebrow">
              {t('creator.terms.title')}
            </h3>
            <ol>
              <li>
                {t('creator.terms.share', {
                  share: String(terms.sharePercent),
                })}
              </li>
              <li>{t('creator.terms.paidCredits')}</li>
              <li>
                {t('creator.terms.hold', { days: String(terms.holdDays) })}
              </li>
              <li>
                {t('creator.terms.minimum', {
                  amount: money(terms.minimumCents),
                  every: String(terms.payoutDays),
                })}
              </li>
              <li>{t('creator.terms.stripe')}</li>
              <li>{t('creator.terms.rights')}</li>
              <li>{t('creator.terms.taxes')}</li>
              <li>{t('creator.terms.changes')}</li>
            </ol>
          </section>

          {failure && (
            <p className="account__error" role="alert">
              {t(CREATOR_ERRORS[failure])}
            </p>
          )}
        </div>
      </DialogFrame>
    </div>,
    document.body,
  );
}
