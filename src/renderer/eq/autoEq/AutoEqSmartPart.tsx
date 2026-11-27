/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import Switch from '../../widgets/Switch';
import { useTranslation } from '../../utils/I18nContext';
import { setContinuousEq, useContinuousEq } from '../../utils/continuousEq';
import { cancelSmartEq } from '../../utils/smartEqRun';
import { useSongEqRecording } from '../../audio/songEqSession';
import type { TAutoEqButton } from './useAutoEqButton';
import AutoEqSmartStatus from './AutoEqSmartStatus';

/**
 * Smart correction inside Auto EQ, the one way it corrects: Balance
 * (`common/referenceCurve`). It measures each song from the source — never through the rack, which is the
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
  const { isBalancing, isContinuousRunning } = button;
  const isOn = useContinuousEq();
  const recording = useSongEqRecording();

  const turnOff = () => {
    setContinuousEq(false);
    if (isBalancing) {
      cancelSmartEq();
    }
  };
  // Said once it is so: a song's correction is saved the moment Smart
  // correction is done with it, with nothing to count down to (Ivan,
  // 2026-11-26: "remove the concept of saved for this song in x secs").
  const isSaved =
    isContinuousRunning && recording.title !== undefined && recording.isSaved;

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
          handleToggle={isOn ? turnOff : () => setContinuousEq(true)}
          ariaLabel={t('autoEq.smart.title')}
        />
      </div>
      {isOn && (
        <>
          {isContinuousRunning && <AutoEqSmartStatus />}
          {isSaved && (
            <div className="eq-auto-part__line eq-auto-smart__saving">
              <span>{t('autoEq.songs.saved')}</span>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default AutoEqSmartPart;
