/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../utils/I18nContext';
import { prefersReducedMotion } from '../utils/bandReveal';
import { playCelebration } from './coinCelebrationMotion';
import CreditCoin from './CreditCoin';
import { creditsText } from './credits';
import packCoins from './packCoins';
import { onCreditsArrived, useSceneStore } from './sceneStore';
import '../styles/CoinCelebration.scss';

/** Sparks thrown by the burst: enough to read as a burst, few enough to stay a flourish. */
const SPARKS = 10;

/** Where the balance is drawn now, if anywhere a member can see it. */
const balanceOnScreen = (): DOMRect | undefined => {
  const figure = document.querySelector('.credits-card__count');
  if (!figure) {
    return undefined;
  }
  const rect = figure.getBoundingClientRect();
  const seen =
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth;
  return seen ? rect : undefined;
};

/**
 * One celebration: the coins on screen, played once, gone when done. Ends
 * on a click anywhere, which goes on to whatever it was pressed on, or on
 * Esc, which it keeps: the credits most often land over the Get credits
 * dialog, and an Esc meant for the coins closed that dialog too. The window
 * is never blocked and focus never moves.
 */
function Celebration({
  credits,
  coins,
  onDone,
}: {
  credits: number;
  coins: number;
  onDone: () => void;
}) {
  const { t, locale } = useTranslation();
  const coinRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const sparkRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const burstRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const burst = burstRef.current;
    const glow = glowRef.current;
    const line = lineRef.current;
    const coinElements = coinRefs.current.filter(
      (coin): coin is HTMLSpanElement => coin !== null,
    );
    const sparks = sparkRefs.current.filter(
      (spark): spark is HTMLSpanElement => spark !== null,
    );
    if (!burst || !glow || !line) {
      return undefined;
    }
    const celebration = playCelebration(
      { coins: coinElements, burst, glow, sparks, line },
      { reduced: prefersReducedMotion(), target: balanceOnScreen() },
    );
    let live = true;
    celebration.finished
      .then(() => {
        if (live) {
          done.current();
        }
        return undefined;
      })
      .catch(() => undefined);
    const skipOnKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Heard first (capture, on the window) and kept from the dialog
        // under the coins, which would close on it too.
        event.preventDefault();
        event.stopPropagation();
        celebration.skip();
      }
    };
    window.addEventListener('pointerdown', celebration.skip, true);
    window.addEventListener('keydown', skipOnKey, true);
    return () => {
      live = false;
      window.removeEventListener('pointerdown', celebration.skip, true);
      window.removeEventListener('keydown', skipOnKey, true);
      celebration.skip();
    };
  }, []);

  return createPortal(
    <div className="coin-celebration">
      <div className="coin-celebration__stage">
        <span ref={glowRef} className="coin-celebration__glow" />
        <span ref={burstRef} className="coin-celebration__burst" />
        {Array.from({ length: SPARKS }, (_, index) => (
          <span
            // A spark's place in the burst is what it is; the burst is fixed.
            // eslint-disable-next-line react/no-array-index-key -- see above
            key={index}
            ref={(element) => {
              sparkRefs.current[index] = element;
            }}
            className={`coin-celebration__spark${
              index % 3 === 0 ? ' coin-celebration__spark--dot' : ''
            }`}
          />
        ))}
        <div className="coin-celebration__coins">
          {Array.from({ length: coins }, (_, index) => (
            <span
              // A coin's place in the pile is what it is: it never reorders.
              // eslint-disable-next-line react/no-array-index-key -- see above
              key={index}
              ref={(element) => {
                coinRefs.current[index] = element;
              }}
              className="coin-celebration__coin"
            >
              <CreditCoin size="m" />
            </span>
          ))}
        </div>
        {/* Said once to a screen reader as it appears, never moving focus. */}
        <p ref={lineRef} className="coin-celebration__line" role="status">
          {t('store.celebration.line', {
            credits: creditsText(t, locale, credits),
          })}
        </p>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The coins that celebrate a pack once its payment is confirmed (Ivan,
 * 2026-11-13: "when they purchase credits, show the nice coin animating on
 * the screen with a celebration and then disappear"), as many as the pack's
 * pile in Get credits. Told by main exactly once per purchase
 * (`onCreditsArrived`); two arriving together play one after the other.
 */
export default function CoinCelebration() {
  const { store } = useSceneStore();
  const packs = store?.packs ?? [];
  const packsRef = useRef(packs);
  packsRef.current = packs;
  const [queue, setQueue] = useState<{ id: number; credits: number }[]>([]);
  const nextId = useRef(0);

  useEffect(
    () =>
      onCreditsArrived((credits) => {
        nextId.current += 1;
        const id = nextId.current;
        setQueue((waiting) => [...waiting, { id, credits }]);
      }),
    [],
  );

  const current = queue[0];
  if (!current) {
    return null;
  }
  return (
    <Celebration
      key={current.id}
      credits={current.credits}
      coins={packCoins(packsRef.current, current.credits)}
      onDone={() => setQueue((waiting) => waiting.slice(1))}
    />
  );
}
