/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type {
  ISubscriptionState,
  TLibraryPlanId,
  TManageResult,
  TSubscribeResult,
} from 'common/subscription';
import { useTranslation } from '../utils/I18nContext';
import {
  getPlus,
  managePlus,
  subscribePlusReturns,
} from './plusSubscriptionStore';
import { initialPlan } from './plusWords';

const SUBSCRIBE_FAILURE: Readonly<
  Record<Exclude<TSubscribeResult, 'opened'>, TranslationKey>
> = {
  'terms-changed': 'subscription.error.termsChanged',
  'needs-email': 'subscription.error.needsEmail',
  'needs-update': 'subscription.error.needsUpdate',
  'already-subscribed': 'subscription.error.alreadySubscribed',
  'not-on-sale': 'subscription.error.notOnSale',
  banned: 'subscription.error.banned',
  'signed-out': 'subscription.error.signedOut',
  failed: 'subscription.error.failed',
};

/** Whether the component that asked is still on screen to hear the answer. */
const useLive = () => {
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  return live;
};

export interface IGetPlusCheckout {
  selected: TLibraryPlanId | undefined;
  select: (plan: TLibraryPlanId) => void;
  /** The checkout is being asked for. */
  opening: boolean;
  /** Stripe's page opened, and the account has no Plus yet. */
  waiting: boolean;
  /** The account has Plus since this checkout opened Stripe's page. */
  done: boolean;
  failure: TranslationKey | undefined;
  /** The server says the account has Plus already: Manage is the way on. */
  alreadySubscribed: boolean;
  pay: () => void;
}

/**
 * Getting Plus, from the plan chosen to the account subscribed: the checkout
 * asked of main, the wait while Stripe's page is open in the browser, and
 * the moment the account has Plus. The wait is the account's own state, not
 * a clock: it ends when main says the account is subscribed, or when the
 * person comes back through "Back to FluidEQ" having cancelled.
 */
export const useGetPlusCheckout = (
  plus: ISubscriptionState,
  startOn?: TLibraryPlanId,
): IGetPlusCheckout => {
  const { locale } = useTranslation();
  const live = useLive();
  const [chosen, setChosen] = useState<TLibraryPlanId | undefined>(startOn);
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState(false);
  const [failure, setFailure] = useState<TranslationKey>();
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);

  useEffect(
    () =>
      subscribePlusReturns((returned) => {
        if (returned === 'cancelled') {
          setOpened(false);
        }
      }),
    [],
  );

  const listed = (plan: TLibraryPlanId | undefined) =>
    plan !== undefined && plus.plans.some((each) => each.id === plan);
  const selected = listed(chosen) ? chosen : initialPlan(plus.plans);

  const pay = useCallback(() => {
    if (!selected || opening) {
      return;
    }
    setOpening(true);
    setFailure(undefined);
    setAlreadySubscribed(false);
    getPlus(selected, locale)
      .then((result) => {
        if (!live.current) {
          return undefined;
        }
        setOpening(false);
        if (result === 'opened') {
          setOpened(true);
        } else {
          setAlreadySubscribed(result === 'already-subscribed');
          setFailure(SUBSCRIBE_FAILURE[result]);
        }
        return undefined;
      })
      .catch(() => {
        if (live.current) {
          setOpening(false);
          setFailure('subscription.error.failed');
        }
      });
  }, [live, locale, opening, selected]);

  return {
    selected,
    select: setChosen,
    opening,
    waiting: opened && !plus.subscribed,
    done: opened && plus.subscribed,
    failure,
    alreadySubscribed,
    pay,
  };
};

const MANAGE_SAID: Readonly<Record<TManageResult, TranslationKey>> = {
  opened: 'subscription.manage.opened',
  'no-subscription': 'subscription.manage.none',
  'signed-out': 'subscription.manage.signedOut',
  failed: 'subscription.manage.failed',
};

/** Manage Plus: Stripe's portal opened in the browser, and what came of it. */
export const useManagePlus = () => {
  const { locale } = useTranslation();
  const live = useLive();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TManageResult>();
  const manage = useCallback(() => {
    if (busy) {
      return;
    }
    setBusy(true);
    setResult(undefined);
    managePlus(locale)
      .then((answer) => {
        if (live.current) {
          setBusy(false);
          setResult(answer);
        }
        return undefined;
      })
      .catch(() => {
        if (live.current) {
          setBusy(false);
          setResult('failed');
        }
      });
  }, [busy, live, locale]);
  return {
    busy,
    /** What the last press came to, said beside the button. */
    said: result ? MANAGE_SAID[result] : undefined,
    failed: result !== undefined && result !== 'opened',
    manage,
  };
};
