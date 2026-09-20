/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IRoomSettings } from '../../common/dsp/chain';
import { roomOnNewRenderer } from '../../common/dsp/roomPresets';
import { LockBadge } from '../graph/lookPickerParts';
import { useTranslation } from '../utils/I18nContext';
import { Dial } from './DspControls';
import { dbOfSpace, spaceOfDb } from './roomView';

interface IDspRoomQuickProps {
  room: IRoomSettings;
  /** Plus, and the room on. */
  canShape: boolean;
  isLocked: boolean;
  onShape: (next: Partial<IRoomSettings>) => void;
  onPatch: (next: IRoomSettings) => void;
  onCommit: () => void;
}

/**
 * The three dials most rooms are made with, on the first screen: how much of
 * the walls is heard (Space), how much of a tail follows them (Ambience), and
 * how far away the speakers stand (Distance).
 *
 * Space and Ambience belong to the new sound. A classic room runs on the
 * first renderer, which has neither — so on a classic room they are not drawn
 * as dials that turn and change nothing: the card says what the room is and
 * offers the move, and makes it only on that press. Looking at a saved room
 * never retunes it.
 */
const DspRoomQuick = ({
  room,
  canShape,
  isLocked,
  onShape,
  onPatch,
  onCommit,
}: IDspRoomQuickProps) => {
  const { t } = useTranslation();
  const isNew = room.rendererVersion === 2;
  // The tail is fed by the walls: with Space at nothing there is nothing to
  // have a tail, and the dial says so by resting.
  const hasWalls = room.earlyReflectionDb > -60 && room.walls < 1;

  return (
    <div
      className="dsp-band dsp-room-quick"
      role="group"
      aria-label={t('dsp.room.quick.title')}
    >
      <div className="dsp-band-head">
        <span className="dsp-band-title">{t('dsp.room.quick.title')}</span>
        {isLocked ? <LockBadge label={t('dsp.room.plus')} /> : undefined}
      </div>
      <div className="dsp-band-dials">
        {isNew ? (
          <>
            <Dial
              labelKey="dsp.room.quick.space"
              value={spaceOfDb(room.earlyReflectionDb)}
              min={0}
              max={100}
              step={1}
              unit="%"
              defaultValue={100}
              isDisabled={!canShape}
              onChange={(percent) =>
                onShape({ earlyReflectionDb: dbOfSpace(percent) })
              }
              onCommit={onCommit}
            />
            <Dial
              labelKey="dsp.room.quick.ambience"
              value={Math.round(room.ambienceMix * 100)}
              min={0}
              max={100}
              step={1}
              unit="%"
              defaultValue={Math.round(DSP_DEFAULTS.room.ambienceMix * 100)}
              isDisabled={!canShape || !hasWalls}
              onChange={(percent) => onShape({ ambienceMix: percent / 100 })}
              onCommit={onCommit}
            />
          </>
        ) : undefined}
        <Dial
          labelKey="dsp.room.distance"
          value={room.distanceM}
          min={0.5}
          max={6}
          step={0.1}
          unit="m"
          defaultValue={DSP_DEFAULTS.room.distanceM}
          isDisabled={!canShape}
          onChange={(value) =>
            // The ring: every speaker steps with it, its own distance
            // included, so the picture and the engine agree.
            onShape({
              distanceM: value,
              distances: room.distances.map(() => value),
            })
          }
          onCommit={onCommit}
        />
      </div>
      {/* Said on the page, not only in a tooltip: what the lock is, and that
          the rooms themselves are free either way. */}
      {isLocked ? (
        <p className="dsp-band-hint">{t('dsp.room.plusHint')}</p>
      ) : undefined}
      {isNew ? (
        <p className="dsp-band-hint">{t('dsp.room.quick.hint')}</p>
      ) : (
        <div className="dsp-room-upgrade">
          <p className="dsp-band-hint">{t('dsp.room.classic.hint')}</p>
          <button
            type="button"
            className="button small"
            disabled={!canShape}
            title={isLocked ? t('dsp.room.plusHint') : undefined}
            onClick={() => {
              onPatch(roomOnNewRenderer(room));
              onCommit();
            }}
          >
            {t('dsp.room.classic.upgrade')}
          </button>
        </div>
      )}
    </div>
  );
};

export default DspRoomQuick;
