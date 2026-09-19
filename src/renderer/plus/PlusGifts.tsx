/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FormEvent, useCallback, useEffect, useId, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  isGiftEmail,
  PLUS_GIFT_NOTE_MAX,
  type IPlusGift,
} from 'common/plusGifts';
import type { TPlusGiftActOutcome } from 'main/ipc/plusGifts';
import type { TPlusGiftFailure } from 'main/plus/plusGiftsApi';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { setGalleryNotice } from './galleryActions';
import GalleryListNotice from './GalleryListNotice';
import PlusTrialSettings from './PlusTrialSettings';
import '../styles/PlusGifts.scss';

const LIST_ERRORS: Record<TPlusGiftFailure, TranslationKey> = {
  offline: 'plus.gallery.error.offline',
  'signed-out': 'plus.gallery.error.signedOut',
  server: 'plus.gallery.error.server',
  forbidden: 'plus.gifts.error.forbidden',
  invalid: 'plus.gallery.error.server',
};

/** What giving or taking back says when the server would not. */
const REFUSED: Partial<Record<TPlusGiftFailure, TranslationKey>> = {
  invalid: 'plus.gifts.error.invalid',
  forbidden: 'plus.gifts.error.forbidden',
};

type TGifts =
  | { state: 'loading' }
  | { state: 'ready'; gifts: IPlusGift[] }
  | { state: 'failed'; key: TranslationKey };

const bridge = () => window.electron?.ipcRenderer;

/** A date field's `YYYY-MM-DD`, as the last moment of that day here. */
export const endOfDay = (value: string): number | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return undefined;
  }
  const [, year, month, day] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    23,
    59,
    59,
  ).getTime();
};

/** The date field's own spelling of a moment, in local time. */
const dayOf = (time: number) => {
  const date = new Date(time);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * The admin's Plus gifts: addresses that count as paying without paying, for
 * whoever the admin chooses — friends, testers, people who helped.
 *
 * By address, because the person may not have an account yet: a gift waits
 * until an account confirms that address, and is Plus from then on, until it
 * is taken back or the end given here passes. What keeps a gift a gift — that
 * a lapsed membership cannot overwrite it — is the server's (premium 0021);
 * this page only asks.
 *
 * Giving to an address already on the list changes that gift's note and end,
 * which is how a gift is edited: Edit on a row fills the form with it.
 */
export default function PlusGifts() {
  const { t, locale } = useTranslation();
  const ids = useId();
  const [gifts, setGifts] = useState<TGifts>({ state: 'loading' });
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [until, setUntil] = useState('');
  const [sending, setSending] = useState(false);
  const [refused, setRefused] = useState<TranslationKey>();
  const [confirming, setConfirming] = useState<string>();
  const [takingBack, setTakingBack] = useState<string>();

  const load = useCallback(() => {
    let current = true;
    setGifts({ state: 'loading' });
    bridge()
      ?.listPlusGifts?.()
      .then((outcome) => {
        if (current) {
          setGifts(
            outcome.ok
              ? { state: 'ready', gifts: outcome.gifts }
              : { state: 'failed', key: LIST_ERRORS[outcome.reason] },
          );
        }
        return undefined;
      })
      .catch(() => {
        if (current) {
          setGifts({ state: 'failed', key: 'plus.gallery.error.offline' });
        }
      });
    return () => {
      current = false;
    };
  }, []);

  useEffect(load, [load]);

  const typed = email.trim().toLowerCase();
  const existing =
    gifts.state === 'ready'
      ? gifts.gifts.find((gift) => gift.email === typed)
      : undefined;
  const untilTime = until ? endOfDay(until) : undefined;
  const tomorrow = dayOf(Date.now() + 86_400_000);
  const valid =
    isGiftEmail(email) &&
    note.trim().length <= PLUS_GIFT_NOTE_MAX &&
    (until === '' || (untilTime !== undefined && untilTime > Date.now()));

  const reply = (outcome: TPlusGiftActOutcome | undefined): boolean => {
    if (outcome?.ok) {
      return true;
    }
    setRefused(
      (outcome && REFUSED[outcome.reason]) ?? 'plus.gifts.error.failed',
    );
    return false;
  };

  const give = (event: FormEvent) => {
    event.preventDefault();
    if (!valid || sending) {
      return;
    }
    setSending(true);
    setRefused(undefined);
    setGalleryNotice(undefined);
    const updating = existing !== undefined;
    bridge()
      ?.givePlus?.({
        email: typed,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(untilTime !== undefined ? { until: untilTime } : {}),
      })
      .then((outcome) => {
        setSending(false);
        if (reply(outcome)) {
          setGalleryNotice({
            ok: true,
            key: updating ? 'plus.gifts.done.updated' : 'plus.gifts.done.given',
            vars: { email: typed },
          });
          setEmail('');
          setNote('');
          setUntil('');
          load();
        }
        return undefined;
      })
      .catch(() => {
        setSending(false);
        reply(undefined);
      });
  };

  const takeBack = (gift: IPlusGift) => {
    setTakingBack(gift.email);
    setRefused(undefined);
    setGalleryNotice(undefined);
    bridge()
      ?.takeBackPlus?.(gift.email)
      .then((outcome) => {
        setTakingBack(undefined);
        setConfirming(undefined);
        if (reply(outcome)) {
          setGalleryNotice({
            ok: true,
            key: 'plus.gifts.done.takenBack',
            vars: { email: gift.email },
          });
          setGifts((current) =>
            current.state === 'ready'
              ? {
                  state: 'ready',
                  gifts: current.gifts.filter(
                    (row) => row.email !== gift.email,
                  ),
                }
              : current,
          );
        }
        return undefined;
      })
      .catch(() => {
        setTakingBack(undefined);
        reply(undefined);
      });
  };

  const edit = (gift: IPlusGift) => {
    setEmail(gift.email);
    setNote(gift.note ?? '');
    setUntil(gift.until !== undefined ? dayOf(gift.until) : '');
    setRefused(undefined);
  };

  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  const statusOf = (gift: IPlusGift) => {
    if (!gift.active) {
      return { tone: 'ended', label: t('plus.gifts.status.ended') };
    }
    return gift.hasAccount
      ? { tone: 'active', label: t('plus.gifts.status.active') }
      : { tone: 'waiting', label: t('plus.gifts.status.waiting') };
  };

  return (
    <div className="gallery-page plus-gifts">
      <PlusTrialSettings />
      <div className="plus-gifts__intro">
        <span className="plus-gifts__mark" aria-hidden="true">
          <Glyph name="gift" />
        </span>
        <p className="gallery-fine">{t('plus.gifts.hint')}</p>
      </div>

      <form className="plus-gifts__form" onSubmit={give} noValidate>
        <label
          className="plus-gifts__field plus-gifts__field--email"
          htmlFor={`${ids}-email`}
        >
          <span className="plus-gifts__label">
            {t('plus.gifts.field.email')}
          </span>
          <input
            id={`${ids}-email`}
            type="email"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            placeholder="name@example.com"
            value={email}
            disabled={sending}
            onChange={(event) => {
              setEmail(event.target.value);
              setRefused(undefined);
            }}
          />
        </label>
        <label
          className="plus-gifts__field plus-gifts__field--note"
          htmlFor={`${ids}-note`}
        >
          <span className="plus-gifts__label">
            {t('plus.gifts.field.note')}
          </span>
          <input
            id={`${ids}-note`}
            type="text"
            maxLength={PLUS_GIFT_NOTE_MAX}
            placeholder={t('plus.gifts.field.notePlaceholder')}
            value={note}
            disabled={sending}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <label
          className="plus-gifts__field plus-gifts__field--until"
          htmlFor={`${ids}-until`}
        >
          <span className="plus-gifts__label">
            {t('plus.gifts.field.until')}
          </span>
          <input
            id={`${ids}-until`}
            type="date"
            min={tomorrow}
            value={until}
            disabled={sending}
            onChange={(event) => setUntil(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className={`button small plus-gifts__give${sending ? ' is-running' : ''}`}
          disabled={!valid || sending}
          aria-busy={sending}
        >
          <Glyph name="gift" />
          {t(existing ? 'plus.gifts.save' : 'plus.gifts.give')}
        </button>
        <p className="plus-gifts__form-hint">
          {refused ? (
            <span className="plus-gifts__refused" role="alert">
              {t(refused)}
            </span>
          ) : (
            t('plus.gifts.field.untilHint')
          )}
        </p>
      </form>

      {gifts.state === 'failed' && (
        <GalleryListNotice text={t(gifts.key)} onRetry={load} />
      )}

      {gifts.state === 'loading' && (
        <div
          className="gallery-rows"
          role="status"
          aria-label={t('plus.gallery.loading')}
        >
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="plus-gifts__row plus-gifts__row--skeleton"
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {gifts.state === 'ready' && gifts.gifts.length === 0 && (
        <div className="community__empty gallery-empty">
          <span className="community__empty-mark" aria-hidden="true">
            <Glyph name="gift" />
          </span>
          <p className="community__empty-title">{t('plus.gifts.empty')}</p>
          <p className="community__empty-hint">{t('plus.gifts.emptyHint')}</p>
        </div>
      )}

      {gifts.state === 'ready' && gifts.gifts.length > 0 && (
        <ul className="gallery-rows" aria-label={t('plus.gifts.title')}>
          {gifts.gifts.map((gift) => {
            const status = statusOf(gift);
            const isConfirming = confirming === gift.email;
            const isTakingBack = takingBack === gift.email;
            return (
              <li
                key={gift.email}
                className={`plus-gifts__row is-${status.tone}`}
              >
                <span className="plus-gifts__avatar" aria-hidden="true">
                  {gift.email.charAt(0).toUpperCase()}
                </span>
                <span className="plus-gifts__who">
                  <span className="plus-gifts__email">{gift.email}</span>
                  <span className="plus-gifts__meta">
                    {gift.note && (
                      <span className="plus-gifts__note">{gift.note}</span>
                    )}
                    <span>
                      {gift.until !== undefined
                        ? t('plus.gifts.untilDate', {
                            date: date.format(gift.until),
                          })
                        : t('plus.gifts.forever')}
                    </span>
                    <span>
                      {t('plus.gifts.since', {
                        date: date.format(gift.createdAt),
                      })}
                    </span>
                  </span>
                </span>
                <span className={`plus-gifts__status is-${status.tone}`}>
                  {status.label}
                </span>
                <span className="plus-gifts__actions">
                  {isConfirming ? (
                    <>
                      <span className="plus-gifts__confirm">
                        {t('plus.gifts.confirmTakeBack', { email: gift.email })}
                      </span>
                      <button
                        type="button"
                        className={`button small plus-gifts__take-back${isTakingBack ? ' is-running' : ''}`}
                        disabled={isTakingBack}
                        aria-busy={isTakingBack}
                        onClick={() => takeBack(gift)}
                      >
                        {t('plus.gifts.takeBack')}
                      </button>
                      <button
                        type="button"
                        className="button small subtle"
                        disabled={isTakingBack}
                        onClick={() => setConfirming(undefined)}
                      >
                        {t('plus.gifts.keep')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="button small subtle"
                        onClick={() => edit(gift)}
                      >
                        {t('plus.gifts.edit')}
                      </button>
                      <button
                        type="button"
                        className="button small subtle"
                        onClick={() => setConfirming(gift.email)}
                      >
                        {t('plus.gifts.takeBack')}
                      </button>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
