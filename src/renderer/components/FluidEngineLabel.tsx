/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useAudioEngineStatus } from '../utils/useAudioEngineStatus';
import { useTranslation } from '../utils/I18nContext';

interface IFluidEngineLabelProps {
  /**
   * Whether the engine is set up to process the output being listened to
   * (`engineOnOutput`). Undefined while the window cannot tell — the label
   * then reads as working, because no evidence of a fault is not a fault.
   */
  isEngineOnOutput?: boolean;
}

/**
 * The engine's name above the EQ, and whether it is really doing anything.
 *
 * It used to appear the moment an engine was installed and chosen, in the
 * app's own rainbow, and say nothing else ever after — so an output Windows
 * has never once loaded the engine on carried the same lit name as one being
 * processed. It now keeps its place and goes dark with a red dot the moment
 * the window knows the engine is not on the output being listened to, which
 * is the same answer the side bar's switch gives.
 *
 * And it arrives on a wave. The name appears when the engine starts, which
 * before was a line of text simply being there on the next frame; now a crest
 * travels through it while it rises, and the app's rainbow draws itself out
 * underneath.
 *
 * The crest is a mask sweeping across the whole line, not one span per
 * letter: the name is painted by clipping the rainbow to its text
 * (`background-clip: text`), and a transformed child of that is composited on
 * its own, which leaves the letters transparent — invisible — for as long as
 * they move.
 */
export default function FluidEngineLabel({
  isEngineOnOutput,
}: IFluidEngineLabelProps) {
  const { status } = useAudioEngineStatus();
  const { isEngineUsable } = useFluidEqContext();
  const { t } = useTranslation();
  const isApo =
    status?.engine === 'apo' && status.apo.installed && isEngineUsable;
  const isFluid =
    status?.engine === 'fluid' && status.fluid.installed && isEngineUsable;
  // Equalizer APO says nothing about itself, so there is never a dot on it.
  const isBroken = isFluid && isEngineOnOutput === false;
  const name = t(isApo ? 'eq.apoEngine' : 'eq.fluidEngine');
  const isShown = isApo || isFluid;

  // The ride runs once each time the name arrives, and is cleared by the
  // sweep's own `animationend` rather than by a duration written twice.
  const wasShown = useRef(false);
  const [isRiding, setIsRiding] = useState(false);
  useEffect(() => {
    if (isShown && !wasShown.current) {
      setIsRiding(true);
    }
    wasShown.current = isShown;
  }, [isShown]);

  if (!isShown) {
    return null;
  }

  return (
    <span className={`eq-engine-line${isBroken ? ' eq-engine-line--off' : ''}`}>
      {isBroken && (
        <span
          className="status-dot error"
          role="img"
          aria-label={t('eq.engineNotHere')}
          title={t('eq.engineNotHere')}
        />
      )}
      <p
        className={`eq-engine-label${isApo ? ' eq-engine-label--apo' : ''}${
          isRiding ? ' is-riding' : ''
        }`}
      >
        {name}
      </p>
      <span
        className={`eq-engine-label__sweep${isRiding ? ' is-riding' : ''}`}
        aria-hidden="true"
        onAnimationEnd={() => setIsRiding(false)}
      />
    </span>
  );
}
