/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';
import {
  DSP_DEFAULTS,
  IRoomSettings,
  ROOM_SPEAKERS,
} from '../../common/dsp/chain';
import { roomSolo, withSolo, withoutSolo } from '../../common/dsp/roomSpeakers';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import { Dial } from './DspControls';
import { TRoomPick } from './DspRoomGraph';

interface IDspRoomSpeakerPanelProps {
  room: IRoomSettings;
  which: TRoomPick;
  /** Level, distance and angle shape the room: Plus, and the room on. */
  canShape: boolean;
  /**
   * Whether what is playing reaches this speaker: a stereo stream on the
   * front stage reaches the front pair alone. A speaker nothing reaches
   * cannot be soloed — that would be six speakers silenced to hear nothing.
   */
  isFed: boolean;
  isDisabled: boolean;
  onChange: (next: IRoomSettings) => void;
  onCommit: () => void;
  onClose: () => void;
}

const SPEAKER_CODES = ['FL', 'FR', 'C', 'SL', 'SR', 'RL', 'RR'];
const SPEAKER_NAME_KEYS: TranslationKey[] = [
  'dsp.room.speakerName.FL',
  'dsp.room.speakerName.FR',
  'dsp.room.speakerName.C',
  'dsp.room.speakerName.SL',
  'dsp.room.speakerName.SR',
  'dsp.room.speakerName.RL',
  'dsp.room.speakerName.RR',
];

/**
 * The panel under the picture for the speaker that was pressed: its level,
 * its own distance, its angle by number, and mute and solo — the set-up a
 * receiver walks through with a test tone. Shaping (level, distance,
 * angle) is Plus like the dials; mute and solo stay free.
 *
 * One state, the mutes (`roomSpeakers.ts`): Solo mutes the other six and
 * opens this one, muted or not; pressed on another speaker it moves there,
 * pressed again it lets go and all seven play. They are the room's, like a
 * speaker's level: they make it Custom, a saved room keeps them, and a
 * preset or Reset puts them back.
 */
const DspRoomSpeakerPanel = ({
  room,
  which,
  canShape,
  isFed,
  isDisabled,
  onChange,
  onCommit,
  onClose,
}: IDspRoomSpeakerPanelProps) => {
  const { t } = useTranslation();
  const angleId = useId();
  const isSub = which === 'sub';
  const index = isSub ? ROOM_SPEAKERS : which;
  const code = isSub ? 'SUB' : SPEAKER_CODES[which];
  const name = t(isSub ? 'dsp.room.speakerName.sub' : SPEAKER_NAME_KEYS[which]);
  const isMuted = room.mutes[index] === true;
  const isSoloed = !isSub && roomSolo(room.mutes) === which;
  // Letting go is always allowed; taking a solo needs sound to reach it.
  const canSolo = isSoloed || isFed;

  const shape = (next: Partial<IRoomSettings>) => {
    onChange({ ...room, ...next, presetId: 'custom' });
  };
  const withOne = <T,>(list: readonly T[], at: number, value: T): T[] =>
    list.map((entry, index_) => (index_ === at ? value : entry));

  return (
    <div className="dsp-room-speaker-panel" role="group" aria-label={name}>
      <div className="dsp-room-speaker-panel__head">
        <span className="dsp-room-speaker-panel__code">{code}</span>
        <span className="dsp-room-speaker-panel__name">{name}</span>
        <span className="dsp-import__spacer" />
        <button
          type="button"
          className={`button small${isMuted ? '' : ' subtle'}`}
          aria-pressed={isMuted}
          disabled={isDisabled}
          onClick={() => {
            shape({ mutes: withOne(room.mutes, index, !isMuted) });
            onCommit();
          }}
        >
          {t('dsp.room.speaker.mute')}
        </button>
        {!isSub ? (
          <button
            type="button"
            className={`button small${isSoloed ? '' : ' subtle'}`}
            aria-pressed={isSoloed}
            disabled={isDisabled || !canSolo}
            title={canSolo ? undefined : t('dsp.room.speaker.soloUnfed')}
            onClick={() => {
              shape({
                mutes: isSoloed
                  ? withoutSolo(room.mutes)
                  : withSolo(room.mutes, which),
              });
              onCommit();
            }}
          >
            {t('dsp.room.speaker.solo')}
          </button>
        ) : undefined}
        <button
          type="button"
          className="button small subtle dsp-room-speaker-panel__close"
          aria-label={t('dsp.room.speaker.close')}
          title={t('dsp.room.speaker.close')}
          onClick={onClose}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      </div>
      <div className="dsp-room-speaker-panel__controls">
        <div className="dsp-room-row__dial">
          <Dial
            labelKey="dsp.room.speaker.level"
            value={isSub ? room.subDb : room.levels[which]}
            min={isSub ? -12 : -24}
            max={12}
            step={0.5}
            unit="dB"
            defaultValue={isSub ? DSP_DEFAULTS.room.subDb : 0}
            isDisabled={!canShape}
            onChange={(value) =>
              shape(
                isSub
                  ? { subDb: value }
                  : { levels: withOne(room.levels, which, value) },
              )
            }
            onCommit={onCommit}
          />
        </div>
        {!isSub ? (
          <>
            <div className="dsp-room-row__dial">
              <Dial
                labelKey="dsp.room.speaker.distance"
                value={room.distances[which]}
                min={0.5}
                max={6}
                step={0.1}
                unit="m"
                defaultValue={room.distanceM}
                isDisabled={!canShape}
                onChange={(value) =>
                  shape({ distances: withOne(room.distances, which, value) })
                }
                onCommit={onCommit}
              />
            </div>
            <div className="dsp-room-speaker-panel__angle">
              <label htmlFor={angleId}>{t('dsp.room.speaker.angle')}</label>
              <input
                id={angleId}
                type="number"
                min={-180}
                max={180}
                step={1}
                value={room.angles[which]}
                disabled={!canShape}
                onChange={(event) => {
                  const angle = Number(event.target.value);
                  if (Number.isFinite(angle)) {
                    shape({
                      angles: withOne(
                        room.angles,
                        which,
                        Math.max(-180, Math.min(180, Math.round(angle))),
                      ),
                    });
                  }
                }}
                onBlur={onCommit}
              />
              <span className="dsp-room-speaker-panel__unit">°</span>
            </div>
          </>
        ) : undefined}
      </div>
    </div>
  );
};

export default DspRoomSpeakerPanel;
