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
  /** Nothing chosen yet, which is where the page starts and where an empty
   * press in the picture puts it back. */
  which: TRoomPick | undefined;
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
  /**
   * Before a speaker is chosen the pane is still drawn, and it is the front
   * left's numbers that are drawn — every control resting, behind a card that
   * says to pick one. An empty pane, or a pane that appears on the first
   * press, would move everything beside it the moment somebody touched the
   * picture; this way the page is the shape it will keep.
   */
  const isWaiting = which === undefined;
  const pick = which ?? 0;
  const isSub = pick === 'sub';
  const index = isSub ? ROOM_SPEAKERS : pick;
  const name = t(roomSpeakerNameKey(pick));
  const isMuted = room.mutes[index] === true;
  const isSoloed = !isSub && roomSolo(room.mutes) === pick;
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
    <div
      className={`dsp-band dsp-room-pane${isWaiting ? ' is-waiting' : ''}`}
      role="group"
      aria-label={isWaiting ? t('dsp.room.speaker.pick') : name}
    >
      <div className="dsp-room-pane__head">
        <span className="dsp-room-pane__code">{roomSpeakerCode(pick)}</span>
        <span className="dsp-room-pane__name">{name}</span>
        {isLocked ? <LockBadge label={t('dsp.room.plus')} /> : undefined}
        <span className="dsp-import__spacer" />
        <button
          type="button"
          className={`button small${isMuted ? '' : ' subtle'}`}
          aria-pressed={isMuted}
          disabled={isDisabled || isWaiting || !hasChannel}
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
            disabled={isDisabled || isWaiting || !canSolo}
            title={canSolo ? undefined : t('dsp.room.speaker.soloUnfed')}
            onClick={() => {
              shape({
                mutes: isSoloed
                  ? withoutSolo(room.mutes)
                  : withSolo(room.mutes, pick),
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
                  value={room.angles[pick]}
                  disabled={!canShape || isWaiting}
                  onChange={(event) => {
                    const angle = Number(event.target.value);
                    if (Number.isFinite(angle)) {
                      shape({
                        angles: withOne(
                          room.angles,
                          pick,
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
              value={room.distances[pick]}
              min={0.5}
              max={6}
              step={0.1}
              unit="m"
              defaultValue={room.distanceM}
              isDisabled={!canShape || isWaiting}
              onChange={(value) =>
                shape({ distances: withOne(room.distances, pick, value) })
              }
              onCommit={onCommit}
            />
          </>
        ) : undefined}
        <Dial
          labelKey="dsp.room.speaker.level"
          value={isSub ? room.subDb : room.levels[pick]}
          min={isSub ? -12 : -24}
          max={12}
          step={0.5}
          unit="dB"
          defaultValue={isSub ? DSP_DEFAULTS.room.subDb : 0}
          isDisabled={!canShape || isWaiting || !hasChannel}
          onChange={(value) =>
            shape(
              isSub
                ? { subDb: value }
                : { levels: withOne(room.levels, pick, value) },
            )
          }
          onCommit={onCommit}
        />
      </div>
      <p className="dsp-band-hint dsp-room-pane__note">
        {t(feedNote(isSub, isFed, isDerived))}
      </p>
      {/* Over the resting pane rather than instead of it, so nothing on the
          page moves when a speaker is finally chosen: the card lifts off and
          the controls under it wake up in place. It is not in the way of
          anything — every control behind it is already disabled — so it lets
          the press through to the picture underneath the pane's own edge.

          No `role="status"` on it: the pane's own group label already reads
          this sentence, and a second live region competed with the picture's
          note about what is playing. */}
      {isWaiting ? (
        <div className="dsp-room-pane__ask">
          <svg
            className="dsp-room-pane__ask-art"
            viewBox="0 0 64 52"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {/* A speaker on the ring with the pointer arriving at it: the
                cabinet, its two drivers, and two arcs of sound leaving it. */}
            <rect
              className="dsp-room-pane__ask-body"
              x="12.5"
              y="6.5"
              width="25"
              height="39"
              rx="4.5"
            />
            <circle
              className="dsp-room-pane__ask-driver"
              cx="25"
              cy="18"
              r="6.2"
            />
            <circle
              className="dsp-room-pane__ask-dot"
              cx="25"
              cy="18"
              r="1.9"
            />
            <circle
              className="dsp-room-pane__ask-driver"
              cx="25"
              cy="34"
              r="3.4"
            />
            <path
              className="dsp-room-pane__ask-wave"
              d="M44 17a17 17 0 0 1 0 18"
            />
            <path
              className="dsp-room-pane__ask-wave is-far"
              d="M51 11a27 27 0 0 1 0 30"
            />
            <path
              className="dsp-room-pane__ask-pointer"
              d="M30 28.5 44.5 43 39 44.5 42.5 50"
            />
          </svg>
          <p className="dsp-room-pane__ask-text">
            {t('dsp.room.speaker.pick')}
          </p>
        </div>
      ) : undefined}
    </div>
  );
};

export default DspRoomSpeakerPanel;
