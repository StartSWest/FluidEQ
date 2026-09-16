/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TAudioEngine } from 'common/audioEngine';
import type { IAudioDevice } from 'common/constants';
import type { IOutputFormat } from 'main/outputFormat';
import { useRoomLive } from '../dsp/useRoomLive';
import {
  readOutputFormat,
  restoreOutputFormat,
  setOutputSevenOne,
} from '../utils/equalizerApi';
import { useTranslation } from '../utils/I18nContext';
import { reportError, reportInfo } from '../utils/logger';
import Button from '../widgets/Button';

interface IRoomOutputNoticeProps {
  engine: TAudioEngine | null;
  /** The output the panel shows; the notice is about it when it is the default. */
  device: IAudioDevice | undefined;
  /** Another notice or dialog owns the spot. */
  isHidden: boolean;
}

type TPhase = 'idle' | 'setting' | 'done' | 'failed' | 'undoing';

/**
 * The Room's one press: an output the room is folding as a front stage,
 * whose driver would take 7.1, is offered 7.1 — so games and films reach
 * the room with every channel — and, once set, Undo.
 *
 * Only where the driver takes it: a headset whose driver takes stereo only
 * gets no press, because the press would fail and the notice would be a
 * promise nobody can keep. Whether the room is folding comes from the
 * engine's own status, so the notice appears exactly when the room is on
 * and stereo, not when a setting says it might be.
 */
const RoomOutputNotice = ({
  engine,
  device,
  isHidden,
}: IRoomOutputNoticeProps) => {
  const { t } = useTranslation();
  const live = useRoomLive(engine === 'fluid');
  const [format, setFormat] = useState<
    { deviceId: string; value: IOutputFormat } | undefined
  >();
  const [phase, setPhase] = useState<TPhase>('idle');
  const [dismissedId, setDismissedId] = useState('');
  const deviceId = device?.id;
  const isStereoRoom =
    engine === 'fluid' &&
    live.state === 'front-stage' &&
    device?.isDefault === true;

  // Asked once per output the room is folding: the answer needs the
  // driver, which is a script and a moment, and it does not change while
  // the notice is up.
  useEffect(() => {
    if (!isStereoRoom || !deviceId) {
      return undefined;
    }
    if (format?.deviceId === deviceId) {
      return undefined;
    }
    let isLive = true;
    readOutputFormat(deviceId)
      .then((value) => {
        if (isLive) {
          setFormat({ deviceId, value });
        }
        return undefined;
      })
      .catch((error) =>
        reportError(
          "The output's format could not be read for the room",
          error,
        ),
      );
    return () => {
      isLive = false;
    };
  }, [isStereoRoom, deviceId, format?.deviceId]);

  if (!device || !deviceId || isHidden || dismissedId === deviceId) {
    return null;
  }
  const current = format?.deviceId === deviceId ? format.value : undefined;
  const offer =
    isStereoRoom &&
    current !== undefined &&
    current.channels < 8 &&
    current.takesEightChannels === true &&
    phase !== 'done';
  if (!offer && phase !== 'done') {
    return null;
  }

  const press = async () => {
    setPhase('setting');
    reportInfo(`Setting ${device.name} to 7.1 for the Room, on a press`);
    const result = await setOutputSevenOne(deviceId);
    if (result.ok) {
      setPhase('done');
      setFormat(undefined);
      window.dispatchEvent(new CustomEvent('fluideq-output-changed'));
    } else {
      setPhase('failed');
      reportError(`Setting ${device.name} to 7.1 failed`, result.error ?? '');
    }
  };
  const undo = async () => {
    setPhase('undoing');
    reportInfo(`Putting ${device.name} back from 7.1, on a press`);
    const result = await restoreOutputFormat(deviceId);
    setPhase(result.ok ? 'idle' : 'done');
    if (result.ok) {
      setDismissedId(deviceId);
      setFormat(undefined);
      window.dispatchEvent(new CustomEvent('fluideq-output-changed'));
    } else {
      reportError(`Putting ${device.name} back failed`, result.error ?? '');
    }
  };
  const isDone = phase === 'done' || phase === 'undoing';

  return createPortal(
    <aside
      className="device-apo-notice room-output-notice"
      role="alertdialog"
      aria-labelledby="room-output-notice-title"
      aria-describedby="room-output-notice-body"
    >
      <div className="device-apo-notice__copy">
        <span className="apo-badge">{t('output.roomBadge')}</span>
        <h2 id="room-output-notice-title">
          {t(isDone ? 'output.roomSevenOneTitle' : 'output.roomStereoTitle', {
            device: device.name,
          })}
        </h2>
        <p id="room-output-notice-body">
          {t(isDone ? 'output.roomSevenOneBody' : 'output.roomStereoBody')}
        </p>
        {phase === 'failed' ? (
          <p className="device-apo-notice__error">
            {t('output.sevenOneFailed')}
          </p>
        ) : undefined}
      </div>
      <div className="device-apo-notice__actions">
        {isDone ? (
          <>
            <Button
              ariaLabel={t('output.gotIt')}
              isDisabled={false}
              className="small"
              handleChange={() => setDismissedId(deviceId)}
            >
              {t('output.gotIt')}
            </Button>
            <Button
              ariaLabel={t('output.undoSevenOne')}
              isDisabled={phase === 'undoing'}
              className="small subtle"
              handleChange={() => {
                undo().catch(() => undefined);
              }}
            >
              {t('output.undoSevenOne')}
            </Button>
          </>
        ) : (
          <>
            <Button
              ariaLabel={t('output.setSevenOne')}
              isDisabled={phase === 'setting'}
              className={`small${phase === 'setting' ? ' is-running' : ''}`}
              handleChange={() => {
                press().catch(() => undefined);
              }}
            >
              {t(
                phase === 'setting'
                  ? 'output.settingSevenOne'
                  : 'output.setSevenOne',
              )}
            </Button>
            <Button
              ariaLabel={t('output.notNow')}
              isDisabled={false}
              className="small subtle"
              handleChange={() => setDismissedId(deviceId)}
            >
              {t('output.notNow')}
            </Button>
          </>
        )}
      </div>
    </aside>,
    document.body,
  );
};

export default RoomOutputNotice;
