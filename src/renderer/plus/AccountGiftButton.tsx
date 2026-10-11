/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IAccountToDelete } from 'common/accountDeletion';
import type { TPlusGiftFailure } from 'main/plus/plusGiftsApi';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';

/** What giving or taking back Plus from an account's row says on a refusal. */
export const GIFT_ERRORS: Record<TPlusGiftFailure, TranslationKey> = {
  offline: 'plus.gallery.error.offline',
  'signed-out': 'plus.gallery.error.signedOut',
  server: 'plus.gallery.error.server',
  forbidden: 'plus.gifts.error.forbidden',
  invalid: 'plus.gifts.error.invalid',
};

const bridge = () => window.electron?.ipcRenderer;

interface IAccountGiftButtonProps {
  account: IAccountToDelete;
  name: string;
  /** Whether this is the question the card is asking right now. */
  asking: boolean;
  onAsk: (asking: boolean) => void;
  /** The gift is written; the list is read again so the row says so. */
  onGiven: () => void;
}

/**
 * Plus given to the account in front of the admin, rather than to an address
 * typed out on the gifts page.
 *
 * The address is the one on the row, so there is nothing to get wrong — the
 * gifts page asks for an address because a gift can be left waiting for
 * somebody who has not signed up yet, which is a different job.
 *
 * Behind a second press that names who is about to get it, like Delete
 * beside it: both are the admin's word about somebody else's account.
 * Without an end, which the server keeps as "until taken back" — a date is
 * the gifts page's business. Taking it back is `AccountGiftTakeBack`, on the
 * same row once the gift is there.
 */
export default function AccountGiftButton({
  account,
  name,
  asking,
  onAsk,
  onGiven,
}: IAccountGiftButtonProps) {
  const { t } = useTranslation();
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<TranslationKey>();

  const give = () => {
    if (working) {
      return;
    }
    setFailure(undefined);
    const answer = bridge()?.givePlus?.({ email: account.email });
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
          onGiven();
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
          {t(working ? 'plus.accounts.giving' : 'plus.accounts.giveConfirm', {
            name,
          })}
        </span>
        {/* One group, so a narrow card wraps both answers together instead
            of splitting the question from its yes. */}
        <span className="account-deletion__answers">
          <button
            type="button"
            className="button small subtle"
            disabled={working}
            onClick={() => onAsk(false)}
          >
            {t('plus.accounts.giveNo')}
          </button>
          <button
            type="button"
            className={`button small${working ? ' is-running' : ''}`}
            aria-busy={working}
            onClick={give}
          >
            <Glyph name="gift" />
            {t('plus.accounts.giveYes')}
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
        {t('plus.accounts.give')}
      </button>
    </>
  );
}
