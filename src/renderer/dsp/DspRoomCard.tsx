/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import {
  DSP_DEFAULTS,
  IRoomSettings,
  ROOM_HEADS,
  TRoomHead,
} from '../../common/dsp/chain';
import { TranslationKey } from '../../common/i18n/en';
import { LockBadge } from '../graph/lookPickerParts';
import { usePlusEntitled } from '../plus/GalleryParts';
import { useTranslation } from '../utils/I18nContext';
import SegmentedControl from '../widgets/SegmentedControl';
import { Dial, ProcessorCard } from './DspControls';
import DspRoomBar from './DspRoomBar';
import DspRoomFitDialog from './DspRoomFitDialog';
import DspRoomGraph from './DspRoomGraph';
import DspRoomLibrary from './DspRoomLibrary';
import { IRoomLive } from './useRoomLive';
import '../styles/LookPicker.scss';

interface IDspRoomCardProps {
  room: IRoomSettings;
  live: IRoomLive;
  onPatch: (next: IRoomSettings) => void;
  onCommit: () => void;
}

const LIVE_TEXT: Record<IRoomLive['state'], TranslationKey> = {
  off: 'dsp.room.live.off',
  'no-head': 'dsp.room.live.noHead',
  'front-stage': 'dsp.room.live.frontStage',
  '5.1': 'dsp.room.live.fiveOne',
  '7.1': 'dsp.room.live.sevenOne',
  on: 'dsp.room.live.on',
  idle: 'dsp.room.live.idle',
  unknown: 'dsp.room.live.unknown',
};

const ALL_FED = [true, true, true, true, true, true, true] as const;
const FRONT_FED = [true, true, false, false, false, false, false] as const;
const FIVE_FED = [true, true, true, true, true, false, false] as const;

/**
 * Which speakers the stream the engine reports right now can reach. Only
 * the two states that leave speakers out say anything; every other state
 * lights all seven, because "nothing playing" is not "these get nothing".
 */
const fedBy = (
  state: IRoomLive['state'],
): { fed: readonly boolean[]; subFed: boolean; hintKey?: TranslationKey } => {
  if (state === 'front-stage') {
    return { fed: FRONT_FED, subFed: false, hintKey: 'dsp.room.fedFrontStage' };
  }
  if (state === '5.1') {
    return { fed: FIVE_FED, subFed: true, hintKey: 'dsp.room.fedFiveOne' };
  }
  return { fed: ALL_FED, subFed: true };
};

/**
 * The Room's page: the room from above, then what shapes it.
 *
 * The presets are whole rooms and are free; shaping — the five dials and
 * dragging a speaker — is Plus, shown locked rather than hidden so the page
 * says what Plus adds where it would be pressed. The head and the headphone
 * switch are the listener's, not the room's, and stay outside the lock.
 */
const DspRoomCard = ({ room, live, onPatch, onCommit }: IDspRoomCardProps) => {
  const { t } = useTranslation();
  const isPlus = usePlusEntitled();
  const canShape = isPlus && room.enabled;
  const [isFitOpen, setFitOpen] = useState(false);
  const { fed, subFed, hintKey: fedHintKey } = fedBy(live.state);
  /**
   * The centre and the sub are dials on channels: while the stream has no
   * such channel they change nothing, so they rest disabled with their
   * speaker asleep rather than turn for nothing.
   */
  const fedDial = (key: 'centreDb' | 'subDb') =>
    key === 'centreDb' ? fed[2] : subFed;

  /** Any change to the room's shape makes the result Custom. */
  const shape = (next: Partial<IRoomSettings>) =>
    onPatch({ ...room, ...next, presetId: 'custom' });

  const dial = (
    key: 'sizeM' | 'walls' | 'distanceM' | 'centreDb' | 'subDb',
    labelKey: TranslationKey,
    min: number,
    max: number,
    step: number,
    unit: string,
  ) => (
    <Dial
      labelKey={labelKey}
      value={room[key]}
      min={min}
      max={max}
      step={step}
      unit={unit}
      defaultValue={DSP_DEFAULTS.room[key]}
      isDisabled={
        !canShape || ((key === 'centreDb' || key === 'subDb') && !fedDial(key))
      }
      onChange={(value) => shape({ [key]: value })}
      onCommit={onCommit}
    />
  );

  return (
    <ProcessorCard
      id="dsp-room"
      titleKey="dsp.room.title"
      descriptionKey="dsp.room.description"
      isEnabled={room.enabled}
      onToggle={() => {
        onPatch({ ...room, enabled: !room.enabled });
        onCommit();
      }}
      toolbar={
        <DspRoomBar room={room} onChange={onPatch} onCommit={onCommit} />
      }
      beforePower={
        <span
          className={`dsp-room-live${
            live.state === 'front-stage' ||
            live.state === '5.1' ||
            live.state === '7.1' ||
            live.state === 'on'
              ? ' is-on'
              : ''
          }`}
          aria-live="polite"
        >
          {t(LIVE_TEXT[live.state])}
        </span>
      }
    >
      <DspRoomGraph
        room={room}
        fed={fed}
        subFed={subFed}
        fedHintKey={room.enabled ? fedHintKey : undefined}
        isDisabled={!room.enabled}
        canDrag={isPlus}
        onAngle={(speaker, angleDeg) =>
          shape({
            angles: room.angles.map((angle, at) =>
              at === speaker ? angleDeg : angle,
            ),
          })
        }
        onCommit={onCommit}
      />

      <div className="dsp-room-controls">
        <div className="dsp-band">
          <div className="dsp-band-head">
            <span className="dsp-band-title">{t('dsp.room.groupRoom')}</span>
            {!isPlus ? <LockBadge label={t('dsp.room.plus')} /> : undefined}
          </div>
          <div className="dsp-band-dials">
            {dial('sizeM', 'dsp.room.size', 2, 12, 0.1, 'm')}
            {dial('walls', 'dsp.room.walls', 0, 1, 0.01, '')}
            {dial('distanceM', 'dsp.room.distance', 0.5, 6, 0.1, 'm')}
            {dial('centreDb', 'dsp.room.centre', -12, 12, 0.5, 'dB')}
            {dial('subDb', 'dsp.room.sub', -12, 12, 0.5, 'dB')}
          </div>
          {!isPlus ? (
            <p className="dsp-band-hint">{t('dsp.room.plusHint')}</p>
          ) : undefined}
          <DspRoomLibrary
            room={room}
            isDisabled={!canShape}
            onApply={(saved) => {
              onPatch({ ...room, ...saved, presetId: 'custom' });
              onCommit();
            }}
          />
        </div>

        <div className="dsp-band">
          <div className="dsp-band-head">
            <span className="dsp-band-title">{t('dsp.room.groupHead')}</span>
            {/* The listening test that picks the head. Plus, like shaping:
                quiet, because the segment beside it already answers most
                people; the badge says where the button leads without it. */}
            <button
              type="button"
              className="button small subtle"
              disabled={!isPlus || !room.enabled}
              title={isPlus ? undefined : t('dsp.room.plusHint')}
              onClick={() => setFitOpen(true)}
            >
              {t('dsp.room.fit')}
            </button>
          </div>
          <SegmentedControl
            name={t('dsp.room.groupHead')}
            value={room.head}
            isDisabled={!room.enabled}
            options={ROOM_HEADS.map((head) => ({
              value: head,
              label: t(`dsp.room.head.${head}` as TranslationKey),
            }))}
            onChange={(head) => {
              const chosen = ROOM_HEADS.find((id) => id === head);
              if (chosen !== undefined) {
                onPatch({ ...room, head: chosen as TRoomHead });
                onCommit();
              }
            }}
          />
          <p className="dsp-band-hint">{t('dsp.room.headHint')}</p>
        </div>

        <div className="dsp-band">
          <div className="dsp-band-head">
            <span className="dsp-band-title">
              {t('dsp.room.groupHeadphones')}
            </span>
          </div>
          <SegmentedControl
            name={t('dsp.room.groupHeadphones')}
            value={room.correctHeadphones ? 'correct' : 'leave'}
            isDisabled={!room.enabled}
            options={[
              { value: 'correct', label: t('dsp.room.headphones.correct') },
              { value: 'leave', label: t('dsp.room.headphones.leave') },
            ]}
            onChange={(choice) => {
              onPatch({ ...room, correctHeadphones: choice === 'correct' });
              onCommit();
            }}
          />
          <p className="dsp-band-hint">{t('dsp.room.headphonesHint')}</p>
        </div>
      </div>
      {isFitOpen ? (
        <DspRoomFitDialog
          onPick={(head) => {
            onPatch({ ...room, head });
            onCommit();
            setFitOpen(false);
          }}
          onClose={() => setFitOpen(false)}
        />
      ) : undefined}
    </ProcessorCard>
  );
};

export default DspRoomCard;
