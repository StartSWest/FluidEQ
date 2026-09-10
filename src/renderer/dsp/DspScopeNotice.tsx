/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the rack is actually processing, said at the top of the page.
 *
 * The load-bearing line on this page, and now it has two entirely different
 * things to say. Under Equalizer APO the rack runs inside the Library player
 * and nothing else on the machine is touched — a user who assumes otherwise
 * reports the feature as broken rather than as misunderstood, which is why
 * that sentence has always been body text here rather than a tooltip. Under
 * FluidEQ Engine the same rack runs inside audiodg.exe on every attached
 * output, so the sentence would be a lie and the pill says so instead.
 *
 * Its own file rather than more of `DspPanel.tsx`, which is already past the
 * project's 500-line limit.
 */

import { useCallback, useEffect, useState } from 'react';
import type { IAudioDevice } from '../../common/constants';
import type { IAudioEngineStatus } from '../../common/audioEngine';
import {
  LINEAR_PHASE_LATENCY_FRAMES,
  LINEAR_PHASE_REFERENCE_RATE,
  TEqPhase,
} from '../../common/dsp/chain';
import { getAudioDevices } from '../utils/equalizerApi';
import { reportError } from '../utils/logger';
import { useTranslation } from '../utils/I18nContext';

/**
 * The delay linear phase costs, as the page prints it.
 *
 * Against 48 kHz rather than the stream's own rate on purpose: the engine
 * attaches to every output and each one can be running at a different rate,
 * so a single number here would be right for one of them and quietly wrong
 * for the rest. 48 kHz is what Windows shared mode gives on almost every
 * machine, and one honest round number is worth more than four exact ones
 * nobody can tell apart.
 */
const LINEAR_PHASE_DELAY_MS = Math.round(
  (LINEAR_PHASE_LATENCY_FRAMES / LINEAR_PHASE_REFERENCE_RATE) * 1000,
);

interface IDspScopeNoticeProps {
  status: IAudioEngineStatus | undefined;
  /** False while nothing is playing through the Library player. */
  isRackEngaged: boolean;
  /** The rack's own EQ phase mode, which is what costs the delay. */
  phase: TEqPhase;
  /** Absent until the engine dialog exists; the link renders only with it. */
  onOpenEngineDialog?: () => void;
}

const DspScopeNotice = ({
  status,
  isRackEngaged,
  phase,
  onOpenEngineDialog,
}: IDspScopeNoticeProps) => {
  const { t } = useTranslation();
  const isSystemWide = status?.engine === 'fluid';
  const [output, setOutput] = useState('');

  const readOutput = useCallback(async () => {
    try {
      const devices: IAudioDevice[] = await getAudioDevices();
      // The same device the EQ page calls the active output: whichever one
      // Windows is currently sending everything to.
      setOutput(devices.find((device) => device.isDefault)?.name ?? '');
    } catch (error) {
      // The pill drops to its unnamed form rather than disappearing: the
      // scope is still system-wide whether or not the output can be named.
      reportError(
        'the active output could not be read for the DSP page',
        error,
      );
    }
  }, []);

  useEffect(() => {
    if (!isSystemWide) {
      return undefined;
    }
    readOutput();
    // `DeviceProfiles` raises this whenever Windows moves the default output
    // — a headphone plugged in, a monitor woken up. Waiting on the event is
    // what keeps this name current without anything polling for it.
    const onOutputChanged = () => {
      readOutput();
    };
    window.addEventListener('fluideq-output-changed', onOutputChanged);
    return () => {
      window.removeEventListener('fluideq-output-changed', onOutputChanged);
    };
  }, [isSystemWide, readOutput]);

  if (isSystemWide) {
    return (
      <div className="dsp-scope-row">
        <span className="dsp-scope-pill">
          {output
            ? t('dsp.scope.system', { output })
            : t('dsp.scope.systemAll')}
        </span>
        {/* Only when linear phase is actually running. The minimum-phase
            cascade this page defaults to adds no delay worth naming, and a
            latency figure shown beside a chain that is not paying it is the
            kind of number people plan around. */}
        {phase === 'linear' ? (
          <span className="dsp-scope-delay">
            {t('dsp.scope.systemDelay', { ms: LINEAR_PHASE_DELAY_MS })}
          </span>
        ) : undefined}
      </div>
    );
  }

  return (
    <p className={`dsp-scope${!isRackEngaged ? ' is-idle' : ''}`}>
      {t(!isRackEngaged ? 'dsp.idle' : 'dsp.scopeNotice')}
      {onOpenEngineDialog ? (
        <button
          type="button"
          className="link-button dsp-scope-link"
          onClick={onOpenEngineDialog}
        >
          {t('dsp.scope.useFluid')}
        </button>
      ) : undefined}
    </p>
  );
};

export default DspScopeNotice;
