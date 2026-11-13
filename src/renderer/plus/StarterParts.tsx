/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { STARTER_CREDITS } from 'common/sceneStore';
import lanternLake from '../../../assets/plus/lantern-lake.jpg';
import nebulaHeart from '../../../assets/plus/nebula-heart.jpg';
import neonHorizon from '../../../assets/plus/neon-horizon.jpg';
import Glyph from '../community/Glyph';
import { storeFailureKey } from './CreditPacks';
import { openNotMineYet } from './plusNavigation';
import { requestPlusTab } from './plusTabRequest';
import { claimStarterCredits } from './sceneStore';

/**
 * What the starter-credits welcome is drawn with, in the dialog and in the
 * card at the top of Visualizers alike: the credit coin, three of FluidEQ's
 * own scenes fanned behind it, a frame for each first scene, and the claim.
 */

/** The covers the welcome shows: what the credits are for. */
export const STARTER_COVERS = [
  { id: 'nebula-heart', picture: nebulaHeart },
  { id: 'lantern-lake', picture: lanternLake },
  { id: 'neon-horizon', picture: neonHorizon },
] as const;

/** The credit coin, with how many the gift is or a tick once it is in. */
export function StarterCoin({
  claimed,
  size,
}: {
  claimed: boolean;
  size: 'l' | 'm';
}) {
  return (
    <span
      className={`starter-coin starter-coin--${size}${claimed ? ' is-claimed' : ''}`}
      aria-hidden="true"
    >
      <Glyph name="credit" />
      <span className="starter-coin__count">
        {claimed ? <Glyph name="check" /> : STARTER_CREDITS}
      </span>
    </span>
  );
}

/** Three of FluidEQ's own scenes, fanned, with their light behind them. */
export function StarterFan() {
  const [left, right, lead] = STARTER_COVERS;
  return (
    <div className="starter-fan" aria-hidden="true">
      <img className="starter-fan__glow" src={lead.picture} alt="" />
      <img className="starter-fan__card is-left" src={left.picture} alt="" />
      <img className="starter-fan__card is-right" src={right.picture} alt="" />
      <img className="starter-fan__card is-lead" src={lead.picture} alt="" />
    </div>
  );
}

/** A frame for each first scene, numbered, lit once the credits are in. */
export function StarterSlots({ claimed }: { claimed: boolean }) {
  return (
    <span className="starter-slots" aria-hidden="true">
      {Array.from({ length: STARTER_CREDITS }, (_, slot) => (
        <span key={slot} className={`starter-slot${claimed ? ' is-lit' : ''}`}>
          {claimed ? <Glyph name="plus" /> : slot + 1}
        </span>
      ))}
    </span>
  );
}

export type TStarterPhase = 'offer' | 'claiming' | 'claimed';

export interface IStarterClaim {
  phase: TStarterPhase;
  failure?: TranslationKey;
  claim: () => void;
}

/**
 * The claim, once: the server gives the credits and the store comes back
 * with them in it. `claimed` holds after the store says so, because the
 * offer that asked is still on screen to say they are in.
 */
export const useStarterClaim = (): IStarterClaim => {
  const [phase, setPhase] = useState<TStarterPhase>('offer');
  const [failure, setFailure] = useState<TranslationKey>();
  // The guard against a second press while the first is out: a ref, read
  // and set in the press itself, so two presses in one frame claim once.
  const running = useRef(false);
  const claim = useCallback(() => {
    if (running.current) {
      return;
    }
    running.current = true;
    setFailure(undefined);
    setPhase('claiming');
    claimStarterCredits()
      .then((outcome) => {
        if (outcome.ok) {
          setPhase('claimed');
          return undefined;
        }
        running.current = false;
        setFailure(storeFailureKey(outcome.reason));
        setPhase('offer');
        return undefined;
      })
      .catch(() => {
        running.current = false;
        setFailure('store.error.offline');
        setPhase('offer');
      });
  }, []);
  return { phase, failure, claim };
};

/** After claiming: Visualizers, showing only the scenes not owned yet. */
export const pickFirstScenes = () => {
  openNotMineYet();
  requestPlusTab();
};
