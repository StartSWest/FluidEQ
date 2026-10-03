/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IIncomingSound } from './remoteAudio/remoteAudioValueContext';
import type { TOutputDelayKind } from '../common/outputDelay';
import { useTranslation } from './utils/I18nContext';
import { formatLatencyMs } from './components/LatencyReadout';

interface IMirrorDelayProps {
  /** Reported software buffering; excludes unreported device/transport delay. */
  delayMs?: number;
  kind?: TOutputDelayKind;
  /** Other computers' sound playing here, which it plays later still. */
  incoming: readonly IIncomingSound[];
}

/**
 * The software buffering reported for a second output, and — only
 * while another computer's sound is actually arriving — its reported
 * software delay as well. This is not an acoustic measurement.
 * A computer linked and silent has no sound to be behind
 * (Ivan, 2026-10-02: "don't show the network lag if the audio is not coming
 * from the network"), and one whose delay is not measured yet is not guessed
 * at. The same line in the open card and in a folded row.
 */
const MirrorDelay = ({
  delayMs,
  incoming,
  kind = 'buffer',
}: IMirrorDelayProps) => {
  const { t } = useTranslation();
  const engine = kind === 'engine';
  const known = delayMs !== undefined && kind !== 'unavailable';
  let label = t('extraOutput.delayUnavailable');
  if (known) {
    label = engine
      ? `${t('dsp.latency.label')}: ${t('dsp.latency.ms', {
          ms: formatLatencyMs(delayMs, 1000),
        })}`
      : t('extraOutput.delay', { milliseconds: Math.round(delayMs) });
  }
  return (
    <p
      className="extra-outputs__delay"
      title={t(engine ? 'dsp.latency.hint' : 'extraOutput.latency')}
    >
      <span>{label}</span>
      {incoming.map((sound) =>
        !known || sound.delayMs === undefined || !sound.isSounding ? null : (
          <span key={sound.id}>
            {engine
              ? `${sound.name}: ${t('dsp.latency.ms', {
                  ms: formatLatencyMs(sound.delayMs + delayMs, 1000),
                })}`
              : t('extraOutput.delayFrom', {
                  name: sound.name,
                  milliseconds: Math.round(sound.delayMs + delayMs),
                })}
          </span>
        ),
      )}
    </p>
  );
};

export default MirrorDelay;
