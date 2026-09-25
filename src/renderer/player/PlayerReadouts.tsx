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
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';
import {
  useListenedDelay,
  useListenedOutput,
} from '../utils/useListenedOutput';
import useSmoothFrames from '../utils/useSmoothFrames';
import writeLiveText from '../utils/liveText';

/** How often the level figure changes: often enough to live, not to flicker. */
const LEVEL_EVERY_MS = 250;
/** The quietest level the figure names; below it, silence. */
const FLOOR_DB = -60;

/**
 * The display's readouts: the output level, and — under the FluidEQ Engine,
 * which reports them — the processing delay, the stream's rate, how many
 * channels it has, and Game mode, which is also the switch for it.
 *
 * The level is read from the live capture the way the analyser beside it is,
 * and written straight into its cell four times a second rather than through
 * React. The rest are the engine's own report of the output being listened
 * to (`useListenedOutput`), the same one the EQ page's delay figure reads.
 */
const PlayerReadouts = () => {
  const { t } = useTranslation();
  // What the window already holds (`AppContent` asks for the life of the
  // window): asking on mount ran the engine helper and a registry probe
  // every time the player was opened.
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
  const sinceRef = useRef(LEVEL_EVERY_MS);

  const showLevel = useCallback((deltaMs: number) => {
    sinceRef.current += deltaMs;
    if (sinceRef.current < LEVEL_EVERY_MS) {
      return activeRef.current;
    }
    sinceRef.current = 0;
    const cell = levelRef.current;
    if (!cell) {
      return false;
    }
    const peaks = activeRef.current
      ? (readRef.current()?.channelPeaks ?? [])
      : [];
    const loudest = peaks.reduce((max, peak) => Math.max(max, peak), 0);
    const db = loudest > 0 ? 20 * Math.log10(loudest) : -Infinity;
    writeLiveText(cell, db > FLOOR_DB ? db.toFixed(1) : '−∞');
    return activeRef.current;
  }, []);
  const kick = useSmoothFrames(showLevel, {
    isEnabled: true,
    target: levelRef,
  });
  useEffect(() => {
    kick();
  }, [isActive, kick]);

  const { output } = listened;
  const latency = isEnabled ? delay?.latency : undefined;
  const channels = output?.channels;
  const supportsGame =
    isFluid &&
    engineSupportsGameMode(status?.fluid.dllVersion, output?.gameMode);
  let layout: string | undefined;
  if (channels === 2) {
    layout = t('player.readout.stereo');
  } else if (channels === 1) {
    layout = t('player.readout.mono');
  } else if (channels !== undefined && channels > 2) {
    // 5.1 and 7.1 are how every receiver and every game names a layout,
    // in every language: the speakers and the one subwoofer.
    layout = `${channels - 1}.1`;
  }

  return (
    <div className="player-readouts">
      <div className="player-readouts__row">
        <span className="player-readout" title={t('player.readout.level')}>
          <b ref={levelRef}>−∞</b>
          <small>{t('player.unit.db')}</small>
        </span>
        {latency && (
          <span className="player-readout" title={t('dsp.latency.label')}>
            <b>{formatLatencyMs(latency.frames, latency.rate)}</b>
            <small>{t('player.unit.ms')}</small>
          </span>
        )}
        {latency && (
          <span className="player-readout" title={t('player.readout.rate')}>
            <b>{Number((latency.rate / 1000).toFixed(1))}</b>
            <small>{t('player.unit.khz')}</small>
          </span>
        )}
      </div>
      <div className="player-readouts__row">
        {layout && (
          <span
            className="player-lamp is-lit"
            title={t('player.readout.channels')}
          >
            {layout}
          </span>
        )}
        {supportsGame && (
          <button
            type="button"
            className={`player-lamp player-lamp--warm${gameMode ? ' is-lit' : ''}`}
            aria-pressed={gameMode}
            title={t('dsp.gameMode.hint')}
            disabled={!isEnabled || isBlockingError}
            onClick={() => setGameMode(!gameMode)}
          >
            {t('dsp.latency.gameMode')}
          </button>
        )}
      </div>
    </div>
  );
};

export default PlayerReadouts;
