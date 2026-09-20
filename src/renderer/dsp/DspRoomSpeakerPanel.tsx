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
import { LockBadge } from '../graph/lookPickerParts';
import { useTranslation } from '../utils/I18nContext';
import { Dial } from './DspControls';
import {
  roomSpeakerCode,
  roomSpeakerNameKey,
  TRoomPick,
} from './roomSpeakerNames';

interface IDspRoomSpeakerPanelProps {
  room: IRoomSettings;
  which: TRoomPick;
  /** Angle, distance and level shape the room: Plus, and the room on. */
  canShape: boolean;
  /** Whether the lock is Plus's and not the room being off. */
  isLocked: boolean;
  /**
   * Whether what is playing reaches this speaker: a stereo stream on the
   * front stage reaches the front pair alone. A speaker nothing reaches
   * cannot be soloed — that would be six speakers silenced to hear nothing.
   */
  isFed: boolean;
  /** Fed by the stereo expansion rather than by a channel of its own. */
  isDerived: boolean;
  isDisabled: boolean;
  onChange: (next: IRoomSettings) => void;
  onCommit: () => void;
}

/** What the pane says about where this speaker's sound comes from. */
const feedNote = (
  isSub: boolean,
  isFed: boolean,
  isDerived: boolean,
): TranslationKey => {
  if (isSub) {
    return isFed ? 'dsp.room.speaker.noteSub' : 'dsp.room.speaker.noteSubUnfed';
  }
  if (!isFed) {
    return 'dsp.room.speaker.noteUnfed';
  }
  return isDerived
    ? 'dsp.room.speaker.noteDerived'
    : 'dsp.room.speaker.noteDiscrete';
};

/**
 * The selected speaker's pane, beside the picture on the Room's first
 * screen: its angle, its own distance, its level, and mute and solo — the
 * set-up a receiver walks through with a test tone. It is always there and
 * always somebody's: pressing a speaker, or starting to drag one, makes the
 * pane that speaker's at once, and its angle counts along while the speaker
 * moves. It used to open under the picture on release, below the fold of a
 * 720-pixel window, and a drag — which has no release until it is over —
 * showed nothing at all.
 *
 * Shaping (angle, distance, level) is Plus like the dials; mute and solo stay
 * free.
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
  isLocked,
  isFed,
  isDerived,
  isDisabled,
  onChange,
  onCommit,
}: IDspRoomSpeakerPanelProps) => {
  const { t } = useTranslation();
  const angleId = useId();
  const isSub = which === 'sub';
  const index = isSub ? ROOM_SPEAKERS : which;
  const name = t(roomSpeakerNameKey(which));
  const isMuted = room.mutes[index] === true;
  const isSoloed = !isSub && roomSolo(room.mutes) === which;
  // Letting go is always allowed; taking a solo needs sound to reach it.
  const canSolo = isSoloed || isFed;
  // The sub's level and mute act on the stream's subwoofer channel. Without
  // one they turn nothing, so they rest rather than pretend.
  const hasChannel = !isSub || isFed;

  const shape = (next: Partial<IRoomSettings>) => {
    onChange({ ...room, ...next, presetId: 'custom' });
  };
  const withOne = <T,>(list: readonly T[], at: number, value: T): T[] =>
    list.map((entry, index_) => (index_ === at ? value : entry));

  return (
    <div className="dsp-band dsp-room-pane" role="group" aria-label={name}>
      <div className="dsp-room-pane__head">
        <span className="dsp-room-pane__code">{roomSpeakerCode(which)}</span>
        <span className="dsp-room-pane__name">{name}</span>
        {isLocked ? <LockBadge label={t('dsp.room.plus')} /> : undefined}
        <span className="dsp-import__spacer" />
        <button
          type="button"
          className={`button small${isMuted ? '' : ' subtle'}`}
          aria-pressed={isMuted}
          disabled={isDisabled || !hasChannel}
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
      </div>
      <div className="dsp-band-dials dsp-room-pane__controls">
        {!isSub ? (
          <>
            {/* By number, and this speaker alone: dragging it in the picture
                is how it is walked round with its pair, and this is how it is
                put on an exact degree. A knob cannot be typed into. Laid out
                as a dial is — the control, then its name under it — so the
                three stand as three of a kind on one line. */}
            <div className="dsp-room-pane__angle">
              <div className="dsp-room-speaker-panel__angle">
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
              <label className="labelled-knob__label" htmlFor={angleId}>
                {t('dsp.room.speaker.angle')}
              </label>
            </div>
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
          </>
        ) : undefined}
        <Dial
          labelKey="dsp.room.speaker.level"
          value={isSub ? room.subDb : room.levels[which]}
          min={isSub ? -12 : -24}
          max={12}
          step={0.5}
          unit="dB"
          defaultValue={isSub ? DSP_DEFAULTS.room.subDb : 0}
          isDisabled={!canShape || !hasChannel}
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
      <p className="dsp-band-hint dsp-room-pane__note">
        {t(feedNote(isSub, isFed, isDerived))}
      </p>
    </div>
  );
};

export default DspRoomSpeakerPanel;
