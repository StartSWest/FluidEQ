/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IRoomSettings } from '../../common/dsp/chain';
import { withSoloWhileFed } from '../../common/dsp/roomSpeakers';
import { LockBadge } from '../graph/lookPickerParts';
import { useTranslation } from '../utils/I18nContext';
import SegmentedControl from '../widgets/SegmentedControl';
import Switch from '../widgets/Switch';
import { Dial } from './DspControls';
import { RoomCrossoverGlyph, RoomRingGlyph } from './DspRoomGlyphs';
import { IRoomFeed } from './roomView';

interface IDspRoomTuneProps {
  room: IRoomSettings;
  feed: IRoomFeed;
  /** Whether a surround stream is what is playing: the front stage's switch
   *  then touches no speaker that is heard. */
  isSurround: boolean;
  /** Plus, and the room on. */
  canShape: boolean;
  isLocked: boolean;
  onShape: (next: Partial<IRoomSettings>) => void;
  onPatch: (next: IRoomSettings) => void;
  onCommit: () => void;
}

const FRONT_FED = [true, true, false, false, false, false, false] as const;

/**
 * Tune: what a room is made of, past the three quick dials. The room's
 * character — its size, its walls, and on the new sound how long the tail
 * rings and where it darkens; the bass and the centre; and what becomes of a
 * stereo source.
 *
 * Shaping the room is Plus. Bass management, the stereo switch and its amount,
 * keeping the speakers' positions and "already spatial" are free, as they
 * were: they are how the listener's own source and headphones are treated,
 * not the room being redesigned.
 */
const DspRoomTune = ({
  room,
  feed,
  isSurround,
  canShape,
  isLocked,
  onShape,
  onPatch,
  onCommit,
}: IDspRoomTuneProps) => {
  const { t } = useTranslation();
  const isOn = room.enabled;
  const isNew = room.rendererVersion === 2;
  const hasTail = isNew && room.ambienceMix > 0;

  return (
    <div className="dsp-room-tune">
      <div className="dsp-band">
        <div className="dsp-band-head">
          <span className="dsp-band-title">{t('dsp.room.tune.character')}</span>
          {isLocked ? <LockBadge label={t('dsp.room.plus')} /> : undefined}
        </div>
        <div className="dsp-band-dials">
          <Dial
            labelKey="dsp.room.size"
            value={room.sizeM}
            min={2}
            max={12}
            step={0.1}
            unit="m"
            defaultValue={DSP_DEFAULTS.room.sizeM}
            isDisabled={!canShape}
            onChange={(sizeM) => onShape({ sizeM })}
            onCommit={onCommit}
          />
          <Dial
            labelKey="dsp.room.walls"
            value={room.walls}
            min={0}
            max={1}
            step={0.01}
            unit=""
            defaultValue={DSP_DEFAULTS.room.walls}
            isDisabled={!canShape}
            onChange={(walls) => onShape({ walls })}
            onCommit={onCommit}
          />
          {isNew ? (
            <>
              <Dial
                labelKey="dsp.room.tune.decay"
                value={room.ambienceDecayS}
                min={0.1}
                max={1.8}
                step={0.05}
                unit="s"
                defaultValue={DSP_DEFAULTS.room.ambienceDecayS}
                isDisabled={!canShape || !hasTail}
                onChange={(ambienceDecayS) => onShape({ ambienceDecayS })}
                onCommit={onCommit}
              />
              <Dial
                labelKey="dsp.room.tune.damping"
                value={room.ambienceDampingHz}
                min={1000}
                max={12000}
                step={100}
                unit="Hz"
                defaultValue={DSP_DEFAULTS.room.ambienceDampingHz}
                isDisabled={!canShape || !hasTail}
                onChange={(ambienceDampingHz) => onShape({ ambienceDampingHz })}
                onCommit={onCommit}
              />
            </>
          ) : undefined}
        </div>
        <p className="dsp-band-hint">
          {t(isNew ? 'dsp.room.tune.characterHint' : 'dsp.room.classic.hint')}
        </p>
        {isNew ? (
          <div className="dsp-room-check">
            <Switch
              id="dsp-room-preserve"
              ariaLabel={t('dsp.room.tune.preserve')}
              isOn={room.preservePosition}
              isDisabled={!isOn}
              handleToggle={() => {
                onShape({ preservePosition: !room.preservePosition });
                onCommit();
              }}
            />
            <div className="dsp-room-check__text">
              <span>{t('dsp.room.tune.preserve')}</span>
              <span className="dsp-band-hint">
                {t('dsp.room.tune.preserveHint')}
              </span>
            </div>
          </div>
        ) : undefined}
      </div>

      <div className="dsp-band">
        <div className="dsp-band-head">
          <span className="dsp-band-title">
            {t('dsp.room.tune.bassCentre')}
          </span>
        </div>
        <div className="dsp-room-row">
          <span className="dsp-room-row__label" title={t('dsp.room.bassHint')}>
            {t('dsp.room.groupBass')}
          </span>
          <div className="dsp-room-row__controls">
            <SegmentedControl
              name={t('dsp.room.groupBass')}
              value={room.bassManagement ? 'sub' : 'full'}
              isDisabled={!isOn}
              options={[
                { value: 'sub', label: t('dsp.room.bass.sub') },
                { value: 'full', label: t('dsp.room.bass.full') },
              ]}
              onChange={(choice) => {
                onShape({ bassManagement: choice === 'sub' });
                onCommit();
              }}
            />
            <RoomCrossoverGlyph
              crossoverHz={room.crossoverHz}
              isManaged={room.bassManagement}
            />
            <div className="dsp-room-row__dial">
              <Dial
                labelKey="dsp.room.crossover"
                value={room.crossoverHz}
                min={40}
                max={200}
                step={5}
                unit="Hz"
                defaultValue={DSP_DEFAULTS.room.crossoverHz}
                isDisabled={!isOn || !room.bassManagement}
                onChange={(crossoverHz) => onShape({ crossoverHz })}
                onCommit={onCommit}
              />
            </div>
          </div>
        </div>
        <div className="dsp-room-row">
          <span className="dsp-room-row__label">
            {t('dsp.room.tune.levels')}
          </span>
          <div className="dsp-room-row__controls">
            <div className="dsp-room-row__dial">
              <Dial
                labelKey="dsp.room.centre"
                value={room.centreDb}
                min={-12}
                max={12}
                step={0.5}
                unit="dB"
                defaultValue={DSP_DEFAULTS.room.centreDb}
                isDisabled={!canShape || !feed.fed[2]}
                onChange={(centreDb) => onShape({ centreDb })}
                onCommit={onCommit}
              />
            </div>
            <div className="dsp-room-row__dial">
              <Dial
                labelKey="dsp.room.sub"
                value={room.subDb}
                min={-12}
                max={12}
                step={0.5}
                unit="dB"
                defaultValue={DSP_DEFAULTS.room.subDb}
                isDisabled={!canShape || !feed.subFed}
                onChange={(subDb) => onShape({ subDb })}
                onCommit={onCommit}
              />
            </div>
            {isLocked ? <LockBadge label={t('dsp.room.plus')} /> : undefined}
          </div>
        </div>
        <p className="dsp-band-hint">
          {t('dsp.room.tune.centreHint')}
          {feed.subFed ? '' : ` ${t('dsp.room.tune.noSubChannel')}`}
        </p>
      </div>

      <div className="dsp-band">
        <div className="dsp-band-head">
          <span className="dsp-band-title">{t('dsp.room.tune.stereo')}</span>
        </div>
        <div className="dsp-room-row">
          <span className="dsp-room-row__label" title={t('dsp.room.musicHint')}>
            {t('dsp.room.groupMusic')}
          </span>
          <div className="dsp-room-row__controls">
            <SegmentedControl
              name={t('dsp.room.groupMusic')}
              value={room.musicUpmix ? 'fill' : 'front'}
              isDisabled={!isOn}
              options={[
                { value: 'front', label: t('dsp.room.music.front') },
                { value: 'fill', label: t('dsp.room.music.fill') },
              ]}
              onChange={(choice) => {
                // Back to the front stage, only the front pair is fed: a
                // solo on any other speaker is let go in the same change,
                // not a moment later when the engine reports it — that
                // moment would be silence. Unless a surround stream is what
                // is playing, which this switch does not touch.
                const mutes =
                  choice === 'fill' || isSurround
                    ? room.mutes
                    : withSoloWhileFed(room.mutes, FRONT_FED);
                onShape({
                  musicUpmix: choice === 'fill',
                  ...(mutes === room.mutes ? {} : { mutes: [...mutes] }),
                });
                onCommit();
              }}
            />
            <RoomRingGlyph
              isFilled={room.musicUpmix}
              amount={room.upmixAmount}
            />
            <div className="dsp-room-row__dial">
              <Dial
                labelKey="dsp.room.music.amount"
                value={room.upmixAmount}
                min={0}
                max={1}
                step={0.05}
                unit=""
                defaultValue={DSP_DEFAULTS.room.upmixAmount}
                isDisabled={!isOn || !room.musicUpmix}
                onChange={(upmixAmount) => onShape({ upmixAmount })}
                onCommit={onCommit}
              />
            </div>
          </div>
        </div>
        <p className="dsp-band-hint">{t('dsp.room.tune.stereoHint')}</p>
        <div className="dsp-room-check">
          <Switch
            id="dsp-room-spatial"
            ariaLabel={t('dsp.room.tune.spatial')}
            isOn={room.sourceAlreadySpatial}
            isDisabled={!isOn}
            handleToggle={() => {
              // The listener's word about the source, not the room's shape:
              // it leaves the profile's name where it is.
              onPatch({
                ...room,
                sourceAlreadySpatial: !room.sourceAlreadySpatial,
              });
              onCommit();
            }}
          />
          <div className="dsp-room-check__text">
            <span>{t('dsp.room.tune.spatial')}</span>
            <span className="dsp-band-hint">
              {t('dsp.room.tune.spatialHint')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DspRoomTune;
