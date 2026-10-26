/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef } from 'react';
import { engineSupportsGameMode } from 'common/engineHealth';
import { useLiveAudioControl } from '../audio/LiveAudioContext';
import { formatLatencyMs } from '../components/LatencyReadout';
import { setGameMode, useDspSettings } from '../dsp/store';
import { useFluidEqShell } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import writeLiveText from '../utils/liveText';
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';
import {
  useListenedDelay,
  useListenedOutput,
} from '../utils/useListenedOutput';
import useSmoothFrames from '../utils/useSmoothFrames';
import PlayerIcon from './PlayerIcon';

/** How often the level follows the sound: often enough to live, not to flicker. */
const LEVEL_EVERY_MS = 250;
/** The quietest level that counts as sound going out. */
const FLOOR_DB = -60;
/** What the level reads while nothing is going out. */
const NO_LEVEL = '–';

/**
 * THE THREE READINGS UNDER THE SONG (Ivan, 2026-10-25, the one amp): how loud
 * the sound going out is, how long the engine holds it, and the output's
 * rate — each a figure and its unit in a small chip.
 *
 * The level is read from the live capture and written straight into its
 * chip four times a second, never through React, and stands at a dash while
 * nothing is going out rather than at minus infinity. The delay and the rate
 * are the engine's report of the output being listened to
 * (`useListenedOutput`), so they are there under the FluidEQ Engine only.
 *
 * The delay is Game mode's key where the engine has Game mode: it is the
 * figure Game mode is there to cut, so the chip that shows it is the press
 * that cuts it, lit while it is on.
 */
const PlayerReadouts = () => {
  const { t } = useTranslation();
  const status = useKnownAudioEngineStatus();
  const { isEnabled, isBlockingError } = useFluidEqShell();
  const isFluid = status?.engine === 'fluid';
  const listened = useListenedOutput(isFluid && isEnabled);
  const delay = useListenedDelay(listened);
  const { gameMode } = useDspSettings();
  const { isActive, readFrame } = useLiveAudioControl();
  const readRef = useRef(readFrame);
  readRef.current = readFrame;
  const activeRef = useRef(isActive);
  activeRef.current = isActive;
  const levelRef = useRef<HTMLElement>(null);

  const showLevel = useCallback(() => {
    const chip = levelRef.current;
    if (!chip) {
      return false;
    }
    const peaks = activeRef.current
      ? (readRef.current()?.channelPeaks ?? [])
      : [];
    const loudest = peaks.reduce((max, peak) => Math.max(max, peak), 0);
    const db = loudest > 0 ? 20 * Math.log10(loudest) : -Infinity;
    writeLiveText(chip, db > FLOOR_DB ? db.toFixed(1) : NO_LEVEL);
    return activeRef.current;
  }, []);
  const kick = useSmoothFrames(showLevel, {
    isEnabled: true,
    target: levelRef,
    minFrameMs: () => LEVEL_EVERY_MS,
  });
  useEffect(() => {
    kick();
  }, [isActive, kick]);

  const latency = isEnabled ? delay?.latency : undefined;
  const khz = latency ? Number((latency.rate / 1000).toFixed(1)) : undefined;
  const supportsGame =
    isFluid &&
    engineSupportsGameMode(status?.fluid.dllVersion, listened.output?.gameMode);
  const ms = latency
    ? formatLatencyMs(latency.frames, latency.rate)
    : undefined;
  const delayFace = (
    <>
      {supportsGame && gameMode && (
        <PlayerIcon name="gamepad" className="player-icon" />
      )}
      {ms}
      <small>{t('player.unit.ms')}</small>
    </>
  );

  return (
    <span className="player-readouts">
      <span className="player-readouts__chip" title={t('player.readout.level')}>
        <b ref={levelRef}>{NO_LEVEL}</b>
        <small>{t('player.unit.db')}</small>
      </span>
      {ms !== undefined && supportsGame && (
        <button
          type="button"
          className={`player-readouts__chip${gameMode ? ' is-on' : ''}`}
          aria-pressed={gameMode}
          title={t('dsp.gameMode.hint')}
          disabled={!isEnabled || isBlockingError}
          onClick={() => setGameMode(!gameMode)}
        >
          {delayFace}
        </button>
      )}
      {ms !== undefined && !supportsGame && (
        <span className="player-readouts__chip">{delayFace}</span>
      )}
      {khz !== undefined && (
        <span
          className="player-readouts__chip"
          title={t('player.readout.rate')}
        >
          {khz}
          <small>{t('player.unit.khz')}</small>
        </span>
      )}
    </span>
  );
};

export default PlayerReadouts;
