/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useState } from 'react';

/**
 * When the starter credits are offered (Ivan, 2026-11-13: "las dos"). New
 * accounts get free credits, and nobody was told: the offer lived inside
 * Account and the buy dialog.
 *
 * - The welcome dialog, once, the first time an account that has not
 *   claimed them is signed in on this computer. Put away with Later, it
 *   comes back once more, on the first look at least `DIALOG_AGAIN_DAYS`
 *   later, and never after that.
 * - The card at the top of Visualizers, every visit while they are not
 *   claimed. Its Later puts it away for `CARD_AWAY_DAYS`.
 * - Neither once they are claimed, on any computer: that is the server's
 *   `starterClaimed`, which the callers check before these.
 *
 * What was answered is kept per account on this computer, as dates. Each
 * rule compares them with the time it is asked, at a launch or a visit;
 * nothing waits for a date to come round.
 */

export const DIALOG_AGAIN_DAYS = 3;
export const CARD_AWAY_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const KEY_PREFIX = 'fluideq.starterWelcome.';

export interface IStarterWelcomeRecord {
  /** How many times the dialog has been answered on this computer. */
  dialogAnswers: number;
  /** When the dialog was last put away with Later. */
  dialogLaterAt?: number;
  /** When the Visualizers card was last put away with Later. */
  cardLaterAt?: number;
}

const EMPTY: IStarterWelcomeRecord = { dialogAnswers: 0 };

/** Whether the welcome dialog is due, from what was answered and the time. */
export const isDialogDue = (
  record: IStarterWelcomeRecord,
  now: number,
): boolean => {
  if (record.dialogAnswers === 0) {
    return true;
  }
  return (
    record.dialogAnswers === 1 &&
    record.dialogLaterAt !== undefined &&
    now - record.dialogLaterAt >= DIALOG_AGAIN_DAYS * DAY_MS
  );
};

/** Whether the Visualizers card is due, from its Later and the time. */
export const isCardDue = (
  record: IStarterWelcomeRecord,
  now: number,
): boolean =>
  record.cardLaterAt === undefined ||
  now - record.cardLaterAt >= CARD_AWAY_DAYS * DAY_MS;

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/** What a stored record says, with anything unreadable taken as unsaid. */
export const readRecord = (raw: string | null): IStarterWelcomeRecord => {
  if (!raw) {
    return EMPTY;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return EMPTY;
  }
  const answers = Reflect.get(parsed, 'dialogAnswers');
  const dialogLaterAt = Reflect.get(parsed, 'dialogLaterAt');
  const cardLaterAt = Reflect.get(parsed, 'cardLaterAt');
  return {
    dialogAnswers:
      typeof answers === 'number' && Number.isInteger(answers) && answers > 0
        ? answers
        : 0,
    ...(isTime(dialogLaterAt) ? { dialogLaterAt } : {}),
    ...(isTime(cardLaterAt) ? { cardLaterAt } : {}),
  };
};

const load = (accountId: string): IStarterWelcomeRecord => {
  try {
    return readRecord(window.localStorage.getItem(KEY_PREFIX + accountId));
  } catch {
    // Storage refused: offered as if nothing had been answered, this run.
    return EMPTY;
  }
};

const save = (accountId: string, record: IStarterWelcomeRecord) => {
  try {
    window.localStorage.setItem(KEY_PREFIX + accountId, JSON.stringify(record));
  } catch {
    // Storage refused: asked again on the next launch at worst.
  }
};

export interface IStarterWelcome {
  record: IStarterWelcomeRecord;
  /** The dialog was answered; `later` when it was put away with Later. */
  answerDialog: (later: boolean) => void;
  /** The card was put away with Later. */
  putCardAway: () => void;
}

/** This account's answers on this computer, and the ways to record new ones. */
export const useStarterWelcome = (accountId: string): IStarterWelcome => {
  const [state, setState] = useState(() => ({
    accountId,
    record: load(accountId),
  }));
  // Another account signed in: its own answers, not the last one's.
  const record = state.accountId === accountId ? state.record : load(accountId);
  if (state.accountId !== accountId) {
    setState({ accountId, record });
  }
  const update = useCallback(
    (change: (current: IStarterWelcomeRecord) => IStarterWelcomeRecord) => {
      setState((current) => {
        // From what is stored, not this hook's copy: the dialog and the card
        // each keep one, and the older copy written back would undo the
        // other's answer (a dialog answered, then shown again).
        const next = change(load(current.accountId));
        save(current.accountId, next);
        return { ...current, record: next };
      });
    },
    [],
  );
  return {
    record,
    answerDialog: useCallback(
      (later: boolean) =>
        update((current) => ({
          ...current,
          dialogAnswers: current.dialogAnswers + 1,
          ...(later ? { dialogLaterAt: Date.now() } : {}),
        })),
      [update],
    ),
    putCardAway: useCallback(
      () => update((current) => ({ ...current, cardLaterAt: Date.now() })),
      [update],
    ),
  };
};
