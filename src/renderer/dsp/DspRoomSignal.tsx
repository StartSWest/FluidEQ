/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { IRoomSettings } from '../../common/dsp/chain';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import { readDspRoomReport, subscribeDspRoomReport } from './roomTelemetry';
import {
  readSystemDspChainResult,
  subscribeSystemDspChainResult,
} from './systemChain';

interface IDspRoomSignalProps {
  room: IRoomSettings;
}

interface ISignalLine {
  key: TranslationKey;
  tone: 'note' | 'warn';
}

/**
 * The lines under the header that say why the room is not doing what its
 * dials say: the installed engine is older than this room, or the source was
 * marked as already spatial so the room steps aside. Exceptions only. That
 * Dimension rests while the speakers' positions are kept used to be a third,
 * and it stood across the page for every featured room that ever played — the
 * normal state, said as loudly as a fault, and said again by the switch that
 * causes it. The switch's own sentence is where it is said now.
 *
 * Settings say what was asked; the report says what happened. Where there is
 * a report it wins; where there is none, the line says what was asked and
 * claims nothing about the engine. Subscribed here and not in the card, so
 * a report arriving re-renders two lines and not the room.
 */
const DspRoomSignal = ({ room }: IDspRoomSignalProps) => {
  const { t } = useTranslation();
  const report = useSyncExternalStore(
    subscribeDspRoomReport,
    readDspRoomReport,
  );
  const result = useSyncExternalStore(
    subscribeSystemDspChainResult,
    readSystemDspChainResult,
  );
  if (!room.enabled) {
    return null;
  }
  const lines: ISignalLine[] = [];
  if (result === 'update-required') {
    lines.push({ key: 'dsp.room.signal.updateRequired', tone: 'warn' });
  }
  if (report?.sourceBypassed === true || room.sourceAlreadySpatial) {
    lines.push({ key: 'dsp.room.signal.spatialBypass', tone: 'note' });
  }
  if (lines.length === 0) {
    return null;
  }
  return (
    <div className="dsp-room-signal" role="status">
      {lines.map((line) => (
        <p key={line.key} className={`dsp-room-signal__line is-${line.tone}`}>
          {t(line.key)}
        </p>
      ))}
    </div>
  );
};

export default DspRoomSignal;
