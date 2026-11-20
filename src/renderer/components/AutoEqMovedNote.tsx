/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import {
  isAutoEqMovedNoteDue,
  markAutoEqMovedNoteSeen,
} from '../audio/autoEqParts';
import { requestAutoEqOpen } from '../eq/autoEq/autoEqOpen';
import { useSongSoundIndex } from '../audio/songSoundIndex';
import { useTranslation } from '../utils/I18nContext';

/**
 * Where "Remember each song's sound" stood under the profiles, once, for
 * whoever had it on: it is Auto EQ on the EQ page now, and the songs it kept
 * came with it (the mockup's Output panel). Gone for good once followed or
 * dismissed; never shown to anybody who had the switch off.
 */
const AutoEqMovedNote = () => {
  const { t } = useTranslation();
  const [isDue, setIsDue] = useState(isAutoEqMovedNoteDue);
  const { index } = useSongSoundIndex();
  if (!isDue) {
    return null;
  }
  const count = (index?.songs.length ?? 0) + (index?.otherCount ?? 0);
  const dismiss = () => {
    markAutoEqMovedNoteSeen();
    setIsDue(false);
  };
  return (
    <div className="eq-auto-moved" role="note">
      <strong>{t('autoEq.moved.title')}</strong>
      <p>
        {count === 1
          ? t('autoEq.moved.bodyOne')
          : t('autoEq.moved.body', { count })}
      </p>
      <div className="eq-auto-moved__actions">
        <button
          type="button"
          className="button small"
          onClick={() => {
            dismiss();
            requestAutoEqOpen();
          }}
        >
          {t('autoEq.moved.open')}
        </button>
        <button type="button" className="button small subtle" onClick={dismiss}>
          {t('autoEq.moved.dismiss')}
        </button>
      </div>
    </div>
  );
};

export default AutoEqMovedNote;
