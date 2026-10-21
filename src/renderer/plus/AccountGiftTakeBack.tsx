/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IAccountToDelete } from 'common/accountDeletion';
import { GIFT_PLAN } from 'common/plusGifts';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { GIFT_ERRORS } from './AccountGiftButton';
import { setGalleryNotice } from './galleryActions';

const bridge = () => window.electron?.ipcRenderer;

/**
 * What taking the gift back leaves the account with, as the question says it
 * before the press: the Plus they pay for, or nothing. It used to name the
 * free trial as well; none is offered any more (Ivan, 2026-10-21).
 */
const questionFor = (account: IAccountToDelete): TranslationKey =>
  account.plusUntil !== undefined && account.plan !== GIFT_PLAN
    ? 'plus.accounts.takeBackPaid'
    : 'plus.accounts.takeBackPlain';

interface IAccountGiftTakeBackProps {
  account: IAccountToDelete;
  name: string;
  /** Whether this is the question the card is asking right now. */
  asking: boolean;
  onAsk: (asking: boolean) => void;
  /** The gift is gone; the list is read again so the row says so. */
  onTakenBack: () => void;
}

/**
 * The gift of Plus on the account in front of the admin, taken back from its
 * row — the same call as Take back on the gifts page, which was the only
 * place it could be done, by address.
 */
export default function AccountGiftTakeBack({
  account,
  name,
  asking,
  onAsk,
  onTakenBack,
}: IAccountGiftTakeBackProps) {
  const { t } = useTranslation();
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<TranslationKey>();

  const takeBack = () => {
    if (working) {
      return;
    }
    setFailure(undefined);
    const answer = bridge()?.takeBackPlus?.(account.email);
    if (!answer) {
      setFailure('plus.gallery.error.server');
      return;
    }
    setWorking(true);
    answer
      .then((outcome) => {
        setWorking(false);
        onAsk(false);
        if (outcome.ok) {
          setGalleryNotice({
            ok: true,
            key: 'plus.gifts.done.takenBack',
            vars: { email: account.email },
          });
          onTakenBack();
          return undefined;
        }
        setFailure(GIFT_ERRORS[outcome.reason]);
        return undefined;
      })
      .catch(() => {
        setWorking(false);
        onAsk(false);
        setFailure('plus.gallery.error.server');
      });
  };

  if (asking) {
    return (
      <>
        <span className="account-deletion__confirm">
          {t(working ? 'plus.accounts.takingBack' : questionFor(account), {
            name,
          })}
        </span>
        {/* Keep first and quiet, the answer that takes the gift away last and
            red, as on the gifts page; one group, so a narrow card wraps both
            together. */}
        <span className="account-deletion__answers">
          <button
            type="button"
            className="button small subtle"
            disabled={working}
            onClick={() => onAsk(false)}
          >
            {t('plus.accounts.keep')}
          </button>
          <button
            type="button"
            className={`button small danger${working ? ' is-running' : ''}`}
            aria-busy={working}
            onClick={takeBack}
          >
            <Glyph name="gift" />
            {t('plus.gifts.takeBack')}
          </button>
        </span>
      </>
    );
  }

  return (
    <>
      {failure && (
        <span className="account-deletion__failure" role="alert">
          {t(failure)}
        </span>
      )}
      <button
        type="button"
        className="button small subtle"
        onClick={() => {
          setFailure(undefined);
          onAsk(true);
        }}
      >
        <Glyph name="gift" />
        {t('plus.accounts.takeBack')}
      </button>
    </>
  );
}
