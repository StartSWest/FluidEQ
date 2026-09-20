/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { IRoomSettings } from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';
import {
  readSystemDspChainResult,
  subscribeSystemDspChainResult,
} from './systemChain';

interface IDspRoomSignalProps {
  room: IRoomSettings;
}

/**
 * The line under the header that says why the room is not doing what its
 * dials say: the installed engine is older than this room. An exception
 * only. That Dimension rests while the speakers' positions are kept used to
 * be a second, and it stood across the page for every featured room that
 * ever played — the normal state, said as loudly as a fault, and said again
 * by the switch that causes it. A third said the room was stepping aside for
 * a source marked as already spatial, and went with that switch.
 *
 * Subscribed here and not in the card, so a result arriving re-renders a line
 * and not the room.
 */
const DspRoomSignal = ({ room }: IDspRoomSignalProps) => {
  const { t } = useTranslation();
  const result = useSyncExternalStore(
    subscribeSystemDspChainResult,
    readSystemDspChainResult,
  );
  if (!room.enabled || result !== 'update-required') {
    return null;
  }
  return (
    <div className="dsp-room-signal" role="status">
      <p className="dsp-room-signal__line is-warn">
        {t('dsp.room.signal.updateRequired')}
      </p>
    </div>
  );
};

export default DspRoomSignal;
