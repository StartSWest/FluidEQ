/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { STARTER_CREDITS } from 'common/sceneStore';
import type { TranslationKey } from 'common/i18n';
import { useAccount } from '../account/accountStore';
import Glyph from '../community/Glyph';
import { creditsText } from '../plus/credits';
import { pluralCategory } from '../utils/pluralCategory';
import { useSceneStore } from '../plus/sceneStore';
import {
  StarterCoin,
  StarterFan,
  StarterSlots,
  pickFirstScenes,
  useStarterClaim,
} from '../plus/StarterParts';
import { isDialogDue, useStarterWelcome } from '../plus/starterWelcome';
import holdFocusReturn from '../utils/focusReturn';
import { useTranslation } from '../utils/I18nContext';
import { useNoticeTurn } from '../utils/noticeTurn';
import { moveTabStop } from '../utils/useModalKeys';

/**
 * The starter credits, offered once a new member is in (Ivan, 2026-11-13:
 * "las dos", with the card in Visualizers): three of FluidEQ's scenes fanned
 * behind the credit coin, the claim on the spot, and after it the way to the
 * gallery with Not mine yet on, so the credits are spent. When it shows is
 * `starterWelcome.ts`; it waits its turn behind every notice that carries
 * something to do, and holds the screen once up.
 */
export default function StarterWelcome() {
  const account = useAccount();
  const accountId =
    account.status === 'signed-in' ? account.identity?.id : undefined;
  if (!accountId) {
    return null;
  }
  return <StarterWelcomeFor key={accountId} accountId={accountId} />;
}

function StarterWelcomeFor({ accountId }: { accountId: string }) {
  const { store, owner } = useSceneStore();
  const welcome = useStarterWelcome(accountId);
  // Compared with the time the window first asks, not a clock left running.
  const [askedAt] = useState(() => Date.now());
  const [isUp, setIsUp] = useState(false);
  const offered =
    store !== undefined &&
    owner === accountId &&
    !store.starterClaimed &&
    !store.everything &&
    !store.suspension &&
    isDialogDue(welcome.record, askedAt);
  const mayShow = useNoticeTurn('starterWelcome', offered && !isUp);
  useEffect(() => {
    if (mayShow) {
      setIsUp(true);
    }
  }, [mayShow]);
  if (!isUp) {
    return null;
  }
  return (
    <WelcomeDialog
      onAnswer={(later) => {
        welcome.answerDialog(later);
        setIsUp(false);
      }}
    />
  );
}

function WelcomeDialog({ onAnswer }: { onAnswer: (later: boolean) => void }) {
  const { t, locale } = useTranslation();
  const surfaceRef = useRef<HTMLElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const { phase, failure, claim } = useStarterClaim();
  const claimed = phase === 'claimed';
  const plural = pluralCategory(STARTER_CREDITS, locale);
  const count = new Intl.NumberFormat(locale).format(STARTER_CREDITS);
  const names = {
    visualizers: t('tabs.plus'),
    notMine: t('plus.gallery.notMine'),
  };
  const answerRef = useRef(onAnswer);
  answerRef.current = onAnswer;
  const claimedRef = useRef(claimed);
  claimedRef.current = claimed;

  // Over whatever was open: Escape answers this alone, as Later, and Tab
  // stays inside it, as the scene announcement does.
  useEffect(() => {
    const giveFocusBack = holdFocusReturn();
    actionRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        answerRef.current(!claimedRef.current);
      } else if (event.key === 'Tab') {
        event.stopPropagation();
        moveTabStop(surfaceRef.current, event);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      giveFocusBack();
    };
  }, []);

  const title = t(
    `store.welcome.${claimed ? 'claimedTitle' : 'title'}.${plural}` as TranslationKey,
    { count },
  );

  return (
    <div className="starter-welcome-backdrop" role="presentation">
      <section
        ref={surfaceRef}
        className={`starter-welcome${claimed ? ' is-claimed' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="starter-welcome-title"
      >
        <div className="starter-welcome__hero">
          <StarterFan />
          <StarterCoin claimed={claimed} size="l" />
        </div>
        <div className="starter-welcome__body">
          {claimed ? (
            <span className="starter-balance">
              <Glyph name="credit" />
              {creditsText(t, locale, STARTER_CREDITS)}
            </span>
          ) : (
            <span className="starter-welcome__eyebrow">
              {t('store.welcome.eyebrow')}
            </span>
          )}
          <h2 id="starter-welcome-title" className="starter-welcome__title">
            {title}
          </h2>
          <p className="starter-welcome__text">
            {t(
              claimed ? 'store.welcome.claimedBody' : 'store.welcome.body',
              names,
            )}
          </p>
          <StarterSlots claimed={claimed} />
          {!claimed && (
            <p className="starter-welcome__fine">{t('store.welcome.fine')}</p>
          )}
          {failure && (
            <p className="gallery-dialog__error" role="alert">
              {t(failure)}
            </p>
          )}
        </div>
        <footer className="starter-welcome__actions">
          <button
            type="button"
            className="button small subtle"
            onClick={() => onAnswer(!claimed)}
          >
            {t('store.welcome.later')}
          </button>
          {claimed ? (
            <button
              ref={actionRef}
              type="button"
              className="button small"
              onClick={() => {
                onAnswer(false);
                pickFirstScenes();
              }}
            >
              {t('store.welcome.pick')}
              <Glyph name="next" />
            </button>
          ) : (
            <button
              ref={actionRef}
              type="button"
              className={`button small${phase === 'claiming' ? ' is-running' : ''}`}
              aria-busy={phase === 'claiming'}
              disabled={phase === 'claiming'}
              onClick={claim}
            >
              {t('store.starter.claim', {
                credits: creditsText(t, locale, STARTER_CREDITS),
              })}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
