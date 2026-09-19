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
 * output, so the sentence would be a lie and the pill says so instead. And
 * while FluidEQ is switched off or the engine is not running, the rack runs
 * nowhere under the FluidEQ Engine, and the line says that and why.
 *
 * Its own file rather than more of `DspPanel.tsx`, which is already past the
 * project's 500-line limit.
 */

import { useCallback, useEffect, useState } from 'react';
import type { IAudioDevice } from '../../common/constants';
import type { IAudioEngineStatus } from '../../common/audioEngine';
import type { IEngineLatency } from '../../common/engineHealth';
import { getAudioDevices } from '../utils/equalizerApi';
import { reportError } from '../utils/logger';
import { useTranslation } from '../utils/I18nContext';
import useEqualizerPower from '../utils/useEqualizerPower';
import LatencyReadout from '../components/LatencyReadout';
import type { TRackSuspension } from './rackPlacement';

interface IDspScopeNoticeProps {
  status: IAudioEngineStatus | undefined;
  /**
   * Why the rack is off everywhere, under the FluidEQ Engine — FluidEQ
   * switched off, or the engine not running (`rackPlacement.ts`). Said in
   * place of the scope, because while it holds the rack has none.
   */
  suspension: TRackSuspension | undefined;
  /** False while nothing is playing through the Library player. */
  isRackEngaged: boolean;
  /**
   * The delay the engine measures on the output being listened to, stage by
   * stage; absent while nothing plays there or from an older engine.
   */
  latency: IEngineLatency | undefined;
  /** Whether the engine is running that output in game mode. */
  gameMode: boolean;
  /** Absent until the engine dialog exists; the link renders only with it. */
  onOpenEngineDialog?: () => void;
}

/**
 * The output this page last named, kept for the next time it opens.
 *
 * `undefined` until a read has answered. The page used to open on the unnamed
 * pill and swap the device name in a moment later, when the read it started
 * on mount came back — the line under the title changing on every visit. It
 * now opens with the name it last had, and on the first visit of a session
 * shows the pill once the name is known rather than twice.
 */
let lastOutputName: string | undefined;

const DspScopeNotice = ({
  status,
  suspension,
  isRackEngaged,
  latency,
  gameMode,
  onOpenEngineDialog,
}: IDspScopeNoticeProps) => {
  const { t } = useTranslation();
  const power = useEqualizerPower();
  const isSystemWide = status?.engine === 'fluid';
  const [output, setOutput] = useState(lastOutputName);

  const readOutput = useCallback(async () => {
    try {
      const devices: IAudioDevice[] = await getAudioDevices();
      // The same device the EQ page calls the active output: whichever one
      // Windows is currently sending everything to.
      lastOutputName = devices.find((device) => device.isDefault)?.name ?? '';
      setOutput(lastOutputName);
    } catch (error) {
      // The pill drops to its unnamed form rather than disappearing: the
      // scope is still system-wide whether or not the output can be named.
      lastOutputName ??= '';
      setOutput((shown) => shown ?? '');
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

  if (suspension !== undefined) {
    const suspensionLabel = {
      'sharing-raw': 'dsp.scope.rawSender',
      'switched-off': 'dspOff.switchedOff',
      'engine-off': 'dspOff.engineOff',
    } as const;
    // Amber, the page's "not now" rather than a fault: the rack is intact and
    // comes back as it was the moment FluidEQ, or the engine, does.
    return (
      <p className="dsp-scope is-idle" role="status">
        {t(suspensionLabel[suspension])}
        {suspension === 'switched-off' ? (
          <button
            type="button"
            className="link-button dsp-scope-link"
            disabled={power.isBlockingError}
            onClick={() => {
              power.toggle().catch(() => undefined);
            }}
          >
            {t('dspOff.turnOn')}
          </button>
        ) : undefined}
      </p>
    );
  }

  if (status === undefined) {
    // Nothing until main has said which engine runs. Falling through to the
    // sentence below meant "Library only", in amber, under the title of a
    // page whose rack was running on every output — for as long as main took
    // to answer, which is a helper run and a hash of the engine files.
    return null;
  }

  if (isSystemWide) {
    if (output === undefined) {
      // The output has never been read this session; see `lastOutputName`.
      return null;
    }
    return (
      <div className="dsp-scope-row">
        <span className="dsp-scope-pill">
          {output
            ? t('dsp.scope.system', { output })
            : t('dsp.scope.systemAll')}
        </span>
        {/* Only measured processing buffers; no guessed fallback. */}
        {latency ? (
          <LatencyReadout latency={latency} gameMode={gameMode} />
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
