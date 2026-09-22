/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef } from 'react';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { getEaseFactor } from 'common/smoothing';
import { isLockedLookId } from 'common/scenePacks';
import { useLiveAudioControl } from '../audio/LiveAudioContext';
import BrandMark from '../icons/BrandMark';
import LookPicker from '../graph/LookPicker';
import { requestAccountPanel } from '../account/accountPanel';
import {
  cycleGraphLook,
  setGraphLook,
  useSelectedLookId,
} from '../utils/graphStyle';
import { useTranslation } from '../utils/I18nContext';
import { setWindowMode } from './windowModeStore';
import useSmoothFrames from '../utils/useSmoothFrames';

/** The band the kick lives in, in hertz. */
const KICK_HZ = 140;
/** How fast the mark settles after a hit. */
const RELEASE_MS = 150;

/**
 * The mark at the end of the transport: it breathes with the kick drum, and
 * it is how the visualizers are changed.
 *
 * Still the glyph alone, with no box around it — a bordered key here reads as
 * a control nobody can name (Ivan, 2026-09-21) — but it is a press now
 * (2026-09-22): a press steps to the next look, Ctrl and a press steps back,
 * and a right-press opens the graph's own explorer, the same list the
 * visualizer deck's picker opens. That matters most in a narrow player, where
 * the visualizer has no deck and therefore no picker of its own; this is the
 * way to the looks from anywhere.
 *
 * It reads the same live capture the analyser beside it does, once a frame,
 * and writes what it found onto its own element, so nothing above it
 * re-renders at the frame rate.
 */
const PlayerBeatMark = () => {
  const { t } = useTranslation();
  const { isActive, readFrame } = useLiveAudioControl();
  const readRef = useRef(readFrame);
  readRef.current = readFrame;
  const activeRef = useRef(isActive);
  activeRef.current = isActive;
  const markRef = useRef<HTMLSpanElement>(null);
  const selectedLookId = useSelectedLookId();
  // A locked visualizer is bought in the Account panel, which is the full
  // app's — the same answer the visualizer deck's own picker gives.
  const choose = useCallback((lookId: string) => {
    if (!isLockedLookId(lookId)) {
      setGraphLook(lookId);
      return;
    }
    setWindowMode('app')
      .then(() => requestAccountPanel())
      .catch(() => undefined);
  }, []);
  const beatRef = useRef(0);

  const onFrame = useCallback((deltaMs: number) => {
    const mark = markRef.current;
    if (!mark) {
      return false;
    }
    const frame = activeRef.current ? readRef.current() : undefined;
    const points = frame?.points ?? [];
    let loudest = MIN_GAIN;
    for (let i = 0; i < points.length && points[i].x <= KICK_HZ; i += 1) {
      loudest = Math.max(loudest, points[i].y);
    }
    const target = Math.max(
      0,
      Math.min(1, (loudest - MIN_GAIN) / (MAX_GAIN - MIN_GAIN)),
    );
    // Up on the hit, down at the ease the analyser's bars fall at, so the two
    // agree about what a beat looked like.
    const fall = getEaseFactor(deltaMs, RELEASE_MS);
    const beat =
      target > beatRef.current
        ? target
        : beatRef.current + (target - beatRef.current) * fall;
    beatRef.current = beat;
    mark.style.setProperty('--player-beat', beat.toFixed(3));
    return frame !== undefined || beat > 0.002;
  }, []);

  const kick = useSmoothFrames(onFrame, { isEnabled: true, target: markRef });

  // Sound arriving wakes the loop; it sleeps again once the mark is dark,
  // the way the analyser beside it does.
  useEffect(() => {
    if (isActive) {
      kick();
    }
  }, [isActive, kick]);

  return (
    <LookPicker
      value={selectedLookId}
      disabled={false}
      onChoose={choose}
      triggerClassName="player-transport__mark"
      triggerTitle={t('player.mark.hint')}
      // A PRESS STEPS, A RIGHT-PRESS BROWSES (Ivan, 2026-09-22). Stepping is
      // what a listener does over and over — the next look, and the one
      // before it with Ctrl — so it is the plain press; the whole explorer is
      // the deliberate act, and it is where a deliberate act belongs. Both
      // are named in the tooltip, because neither is guessable from a glyph.
      onTriggerPress={(event) => {
        cycleGraphLook(event.ctrlKey || event.metaKey ? -1 : 1);
      }}
      trigger={
        <span className="player-transport__beat" ref={markRef} aria-hidden>
          <BrandMark />
        </span>
      }
    />
  );
};

export default PlayerBeatMark;
