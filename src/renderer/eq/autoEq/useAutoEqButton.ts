/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSmartEqRun, useSmartEqStatus } from '../../utils/smartEqRun';
import useIsAutoEqRunning from '../../utils/autoEqRunning';
import {
  endCorrectionFlash,
  useCorrectionFlash,
} from '../../utils/correctionFlash';
import useBubblePlacement from '../useBubblePlacement';
import { isInsideAnchoredMenu } from '../../widgets/AnchoredMenu';
import { useNoticeClaim } from '../../utils/noticeTurn';
import { useAutoEqOpenRequest } from './autoEqOpen';

/**
 * Auto EQ's button on the EQ page: whether its panel is open, and what the
 * pet's bubble beside it says while Smart correction measures. Moved out of
 * the bands' hook with the button that was Smart EQ's: nothing about the
 * bands depends on it.
 */
const useAutoEqButton = () => {
  const { listeningFor, isRunning: isBalancing } = useSmartEqRun();
  const balanceStatus = useSmartEqStatus();
  const [isOpen, setIsOpen] = useState(false);
  const holder = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setIsOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }, []);
  /**
   * On, chosen, and not held up by a switch on the other side of the screen
   * (`useIsAutoEqRunning`): a lit button over a stopped loop is the app
   * claiming to be doing something it is not.
   */
  const isContinuousRunning = useIsAutoEqRunning();
  /**
   * A correction landing, for as long as the bubble's text holds the applied
   * colour — its own animation, whose end is what clears the flash.
   */
  const correctionFlash = useCorrectionFlash();
  /**
   * What the bubble says: an announcement if there is one, the measurement
   * otherwise. `balanceStatus` is a remark held for a moment — a correction
   * landing, a voicing change rebuilding the layer, a run finishing — and
   * outranks the rest because somebody is waiting to hear about it.
   * Underneath is the running measurement. Nothing while the panel is open:
   * the panel says the same in its Smart correction line.
   */
  const bubbleText = isOpen
    ? ''
    : balanceStatus?.text || (isContinuousRunning ? listeningFor : '');
  // The bubble is the only thing that shows a flash, and its animation is the
  // only thing that ends one. A correction landing with no bubble to show it
  // would otherwise arrive green on the next bubble, over a write minutes old.
  const flashId = correctionFlash?.id;
  useEffect(() => {
    if (flashId !== undefined && !bubbleText) {
      endCorrectionFlash(flashId);
    }
  }, [bubbleText, flashId]);
  // Somewhere free around the button, chosen from what the header holds at
  // this width: see `eq/bubblePlacement.ts`.
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const bubbleSpot = useBubblePlacement(holder, bubbleRef, bubbleText);

  // Every notice waits while the panel is open (`noticeTurn.ts`): one came up
  // over its top and covered its Forget.
  useNoticeClaim('autoEqPanel', isOpen);

  // Opened from elsewhere: the Output panel's note about the old switch.
  useAutoEqOpenRequest(() => setIsOpen(true));

  // Closes on a press elsewhere and on Escape, like every other menu here.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      // The panel is portalled out of the card that clips, so it is asked
      // about apart from the trigger.
      if (
        !holder.current?.contains(event.target as Node) &&
        !isInsideAnchoredMenu(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, close]);

  return {
    isOpen,
    setIsOpen,
    holder,
    trigger,
    isBalancing,
    isContinuousRunning,
    listeningFor,
    balanceStatus,
    correctionFlash,
    bubbleText,
    bubbleRef,
    bubbleSpot,
  };
};

export type TAutoEqButton = ReturnType<typeof useAutoEqButton>;

export default useAutoEqButton;
