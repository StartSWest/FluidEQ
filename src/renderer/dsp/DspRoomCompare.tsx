/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { IRoomSettings } from '../../common/dsp/chain';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import { readDspRoomReport, subscribeDspRoomReport } from './roomTelemetry';

interface IDspRoomCompareProps {
  room: IRoomSettings;
  onPatch: (next: IRoomSettings) => void;
  onCommit: () => void;
}

/**
 * What the comparison is doing, from what the engine reports and nothing
 * else. No report is "not known", never "ready": a rack written to disk is
 * not a rack that has played, and an engine that says nothing has not said
 * the levels match.
 */
const stateKey = (
  asked: boolean,
  report: ReturnType<typeof readDspRoomReport>,
): TranslationKey | undefined => {
  if (!asked) {
    return undefined;
  }
  if (report === undefined) {
    return 'dsp.room.compare.unknown';
  }
  if (!report.original) {
    return 'dsp.room.compare.waiting';
  }
  return report.matchAvailable
    ? 'dsp.room.compare.matched'
    : 'dsp.room.compare.unmatched';
};

/**
 * Original / Room: the room alone taken out of the path, with everything
 * else in the rack left playing, the original held back by exactly the
 * room's own delay and — once the engine has heard enough of both to know —
 * brought to the room's loudness, so the louder of the two is not simply the
 * one that wins.
 *
 * It is a way of listening, not a setting of the room: it leaves the
 * profile's name alone, no saved room keeps it, and every profile leaves it
 * where it is. The report is read here and nowhere above, so the card does
 * not re-render when the engine speaks.
 */
const DspRoomCompare = ({ room, onPatch, onCommit }: IDspRoomCompareProps) => {
  const { t } = useTranslation();
  const report = useSyncExternalStore(
    subscribeDspRoomReport,
    readDspRoomReport,
  );
  const asked = room.compareOriginal;
  const state = stateKey(asked && room.enabled, report);
  const isFolded =
    asked && report?.original === true && report.conventionalFoldDown;

  return (
    <div className="dsp-room-compare">
      <button
        type="button"
        className={`button small${asked ? '' : ' subtle'}`}
        aria-pressed={asked}
        disabled={!room.enabled}
        title={t('dsp.room.compare.hint')}
        onClick={() => {
          onPatch({ ...room, compareOriginal: !asked });
          onCommit();
        }}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 2v12M3 5h3M3 8h3M3 11h3M10 5h3M10 11h3" />
        </svg>
        {t(asked ? 'dsp.room.compare.original' : 'dsp.room.compare.label')}
      </button>
      {state !== undefined ? (
        <span className="dsp-room-compare__state" role="status">
          {t(state, {
            gain: (report?.referenceGainDb ?? 0).toFixed(1),
          })}
          {isFolded ? ` · ${t('dsp.room.compare.foldDown')}` : ''}
        </span>
      ) : undefined}
    </div>
  );
};

export default DspRoomCompare;
