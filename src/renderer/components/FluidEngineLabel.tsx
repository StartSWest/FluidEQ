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
   * (`engineOnOutput`). Undefined while the window cannot tell yet, which is
   * every launch until the outputs have been read.
   */
  isEngineOnOutput?: boolean;
  /**
   * The engine is running this output and could not start part of what it was
   * asked for — the DSP rack, usually. The EQ is playing, so this is neither
   * of the other two answers.
   */
  isPartlyOff?: boolean;
}

/** What the line is saying, which is the whole of its behaviour. */
type TEngineLabelState = 'checking' | 'working' | 'partly' | 'broken';

/**
 * The engine's name above the EQ, and whether it is really doing anything.
 *
 * It used to appear the moment an engine was installed and chosen, in the
 * app's own rainbow, and say nothing else ever after — so an output Windows
 * has never once loaded the engine on carried the same lit name as one being
 * processed. Three states now, and the difference between them is the point:
 *
 * - **checking** — the window has not been told yet. Faded, with a crest
 *   travelling through the name on a loop: something is happening and no
 *   claim has been made.
 * - **working** — the engine is on the output being listened to. The crest
 *   runs once as the name rises and the rainbow draws itself out underneath,
 *   and the name rests lit. This is the only state that celebrates, because
 *   it is the only one with something to celebrate.
 * - **broken** — dim, with a red dot, and no animation at all. The side
 *   bar's switch reads off at the same moment from the same fact.
 *
 * The arrival fires on becoming working, never on merely being drawn: the
 * label used to ride in the moment an engine was installed and chosen, which
 * put a success animation in front of an output nothing was reaching.
 *
 * Equalizer APO is none of these. It says nothing about itself, so it is
 * drawn plainly — no dot, no crest, and not FluidEQ's rainbow either.
 *
 * The crest is a mask sweeping across the whole line, not one span per
 * letter: the name is painted by clipping the rainbow to its text
 * (`background-clip: text`), and a transformed child of that is composited on
 * its own, which leaves the letters transparent — invisible — for as long as
 * they move.
 */
export default function FluidEngineLabel({
  isEngineOnOutput,
  isPartlyOff,
}: IFluidEngineLabelProps) {
  const { status } = useAudioEngineStatus();
  const { isEngineUsable } = useFluidEqContext();
  const { t } = useTranslation();
  const isApo =
    status?.engine === 'apo' && status.apo.installed && isEngineUsable;
  const isFluid =
    status?.engine === 'fluid' && status.fluid.installed && isEngineUsable;
  const name = t(isApo ? 'eq.apoEngine' : 'eq.fluidEngine');

  let state: TEngineLabelState = 'checking';
  if (isEngineOnOutput === false) {
    state = 'broken';
  } else if (isEngineOnOutput === true) {
    // Running, and not doing all of it. Celebrating here is what made the
    // line a liar: the name stood in full rainbow beside a card saying part
    // of the sound was not reaching the output.
    state = isPartlyOff === true ? 'partly' : 'working';
  }
  const isWorking = isFluid && state === 'working';

  // The arrival runs once each time the engine starts working, and is cleared
  // by the sweep's own `animationend` rather than by a duration written twice.
  const wasWorking = useRef(false);
  const [isRiding, setIsRiding] = useState(false);
  useEffect(() => {
    if (isWorking && !wasWorking.current) {
      setIsRiding(true);
    }
    wasWorking.current = isWorking;
  }, [isWorking]);

  if (!isApo && !isFluid) {
    return null;
  }

  // Equalizer APO is drawn plainly, whatever the state would have been.
  const mood = isFluid ? ` eq-engine-line--${state}` : '';
  return (
    <span
      className={`eq-engine-line${mood}`}
      title={
        isFluid && state === 'checking' ? t('app.status.checking') : undefined
      }
    >
      {state === 'broken' && isFluid && (
        <span
          className="status-dot error"
          role="img"
          aria-label={t('eq.engineNotHere')}
          title={t('eq.engineNotHere')}
        />
      )}
      {state === 'partly' && isFluid && (
        <span
          className="status-dot warning"
          role="img"
          aria-label={t('engineHealth.partlyOff')}
          title={t('engineHealth.partlyOff')}
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
