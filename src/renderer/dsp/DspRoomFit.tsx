/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import { IRoomSettings, ROOM_HEADS, TRoomHead } from '../../common/dsp/chain';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import SegmentedControl from '../widgets/SegmentedControl';
import DspRoomFitDialog from './DspRoomFitDialog';

interface IDspRoomFitProps {
  room: IRoomSettings;
  onPatch: (next: IRoomSettings) => void;
  onCommit: () => void;
}

/**
 * Fit: the listener, not the room. Which of the three heads the room is heard
 * through — untouched by every profile and saved room — and the listening
 * test that picks it by ear.
 *
 * It says what the three heads are: one measured head at three sizes, not
 * three people and not a scan of anybody's ears. A page that let "Small,
 * Medium, Large" pass for a measurement of the listener would be selling
 * something the app does not do.
 *
 * A "Correct the headphones / Leave them" segment stood beside the head until
 * 2026-09-20, and had never once changed a sample: the value it wrote was
 * defaulted, clamped, saved, put on the wire and decoded by the engine, and
 * then read by nothing — the Room is built from a struct that field is never
 * copied into. What it pretended to offer already exists and works, on the
 * headphone profile's own switch on the equaliser's page, and that is where
 * it belongs: a correction curve is the headset's own signature and no chain
 * has any business reaching into it.
 */
const DspRoomFit = ({ room, onPatch, onCommit }: IDspRoomFitProps) => {
  const { t } = useTranslation();
  const [isFitOpen, setFitOpen] = useState(false);
  const isOn = room.enabled;

  return (
    <div className="dsp-room-fit">
      <div className="dsp-band">
        <div className="dsp-band-head">
          <span className="dsp-band-title">{t('dsp.room.fitView.head')}</span>
        </div>
        <div className="dsp-room-row">
          <span className="dsp-room-row__label">{t('dsp.room.groupHead')}</span>
          <div className="dsp-room-row__controls">
            <SegmentedControl
              name={t('dsp.room.groupHead')}
              value={room.head}
              isDisabled={!isOn}
              options={ROOM_HEADS.map((head) => ({
                value: head,
                label: t(`dsp.room.head.${head}` as TranslationKey),
              }))}
              onChange={(head) => {
                const chosen = ROOM_HEADS.find((id) => id === head);
                if (chosen !== undefined) {
                  onPatch({ ...room, head: chosen });
                  onCommit();
                }
              }}
            />
          </div>
        </div>
        {/* The listening test that picks the head: a row of this band and
            not a band of its own, because it answers the same question as
            the segment above it. Quiet, since the segment already answers
            most people. A band of its own made seven,
            which no number of columns divides: the page ended in a hole. */}
        <div className="dsp-room-row">
          <span className="dsp-room-row__label">
            {t('dsp.room.fitView.guided')}
          </span>
          <div className="dsp-room-row__controls">
            <button
              type="button"
              className="button small subtle"
              disabled={!isOn}
              title={t('dsp.room.fitView.guidedHint')}
              onClick={() => setFitOpen(true)}
            >
              {t('dsp.room.fitView.start')}
            </button>
          </div>
        </div>
        <p className="dsp-band-hint">{t('dsp.room.fitView.headHint')}</p>
      </div>

      {isFitOpen ? (
        <DspRoomFitDialog
          onPick={(head: TRoomHead) => {
            onPatch({ ...room, head });
            onCommit();
            setFitOpen(false);
          }}
          onClose={() => setFitOpen(false)}
        />
      ) : undefined}
    </div>
  );
};

export default DspRoomFit;
