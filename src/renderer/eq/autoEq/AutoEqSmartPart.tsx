/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SONG_EQ_MIN_LISTENED_MS } from 'common/songEqRecorder';
import Switch from '../../widgets/Switch';
import SegmentedControl from '../../widgets/SegmentedControl';
import { useTranslation } from '../../utils/I18nContext';
import { setContinuousEq, useContinuousEq } from '../../utils/continuousEq';
import { cancelSmartEq } from '../../utils/smartEqRun';
import {
  CONTINUOUS_MODES,
  SMART_EQ_MODE_NAME,
  SMART_EQ_MODE_NOTE,
  TSmartEqMode,
  isContinuousMode,
  setSmartEqMode,
  useSmartEqMode,
} from '../../utils/smartEqMode';
import { useSongEqRecording } from '../../audio/songEqSession';
import { formatDuration } from '../../library/player/NowPlayingBar';
import type { TAutoEqButton } from './useAutoEqButton';

/** The mode Smart correction starts in when it was never chosen. */
const FIRST_MODE: TSmartEqMode = 'balance';

/**
 * Smart correction: Smart EQ's three continuous modes inside Auto EQ. It
 * measures each song from the source — never through the rack, which is the
 * record's processing and not the record (`rawSource.ts`) — keeps the
 * correction for that song, and plays on top of whichever sound the song
 * has. A song's own saved sound does not replace it: both apply (the
 * mockup's fourth decision).
 *
 * On is the continuous measurement with its per-song saving, which used to
 * be a switch of its own beside the button; that switch is gone, because a
 * correction that is not kept for its song is measured again every play.
 */
const AutoEqSmartPart = ({ button }: { button: TAutoEqButton }) => {
  const { t } = useTranslation();
  const { isBalancing, isContinuousRunning, listeningFor } = button;
  const isOn = useContinuousEq();
  const mode = useSmartEqMode();
  const recording = useSongEqRecording();

  const turnOn = () => {
    if (isContinuousMode(mode)) {
      setContinuousEq(true);
    } else {
      setSmartEqMode(FIRST_MODE);
    }
  };
  const turnOff = () => {
    setContinuousEq(false);
    if (isBalancing) {
      cancelSmartEq();
    }
  };
  let saving = '';
  if (isContinuousRunning && recording.title !== undefined) {
    saving = recording.willSave
      ? t('autoEq.smart.willSave')
      : t('autoEq.smart.savesIn', {
          remaining: formatDuration(
            Math.max(0, SONG_EQ_MIN_LISTENED_MS - recording.listenedMs),
          ),
        });
  }
  const progress = Math.min(1, recording.listenedMs / SONG_EQ_MIN_LISTENED_MS);

  return (
    <section className="eq-auto-part" aria-labelledby="eq-auto-smart-title">
      <div className="eq-auto-part__head">
        <div className="eq-auto-part__words">
          <strong id="eq-auto-smart-title">{t('autoEq.smart.title')}</strong>
          <span>{t('autoEq.smart.hint')}</span>
        </div>
        <Switch
          id="eq-auto-smart"
          isOn={isOn}
          isDisabled={false}
          handleToggle={isOn ? turnOff : turnOn}
          ariaLabel={t('autoEq.smart.title')}
        />
      </div>
      {isOn && (
        <>
          <SegmentedControl
            name={t('autoEq.smart.modes')}
            value={isContinuousMode(mode) ? mode : ''}
            options={CONTINUOUS_MODES.map((entry) => ({
              value: entry,
              label: t(SMART_EQ_MODE_NAME[entry]),
              title: t(SMART_EQ_MODE_NOTE[entry]),
            }))}
            onChange={(next) => setSmartEqMode(next as TSmartEqMode)}
          />
          {isContinuousRunning && (
            <div className="eq-auto-part__line eq-auto-smart__status">
              <span role="status">
                {listeningFor || t('autoEq.smart.waiting')}
              </span>
              {saving && (
                <>
                  <span className="eq-auto-smart__track" aria-hidden="true">
                    <span
                      className="eq-auto-smart__fill"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </span>
                  <span>{saving}</span>
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default AutoEqSmartPart;
