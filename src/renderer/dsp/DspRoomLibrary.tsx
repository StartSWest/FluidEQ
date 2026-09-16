/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import { IRoomSettings } from '../../common/dsp/chain';
import { TRoomShape } from '../../common/dsp/roomPresets';
import { useTranslation } from '../utils/I18nContext';
import DspPresetSaveDialog from './DspPresetSaveDialog';
import {
  deleteSavedRoom,
  ISavedRoom,
  readSavedRooms,
  roomShapesMatch,
  SAVED_ROOM_NAME_MAX,
  saveRoom,
} from './savedRooms';

interface IDspRoomLibraryProps {
  room: IRoomSettings;
  /** Saving and applying are shaping, so they lock with the dials. */
  isDisabled: boolean;
  onApply: (shape: TRoomShape) => void;
}

/**
 * The rooms the user shaped and kept, under the presets they started from.
 *
 * The same row as the crossfade's saved shapes: a Save button, and one chip
 * per room that puts it back with a press and a round button that removes
 * it. The chip whose shape the room stands in right now is lit; a dial
 * moved leaves every chip unlit, which is the truth — what is on the page is
 * no longer a saved room.
 */
const DspRoomLibrary = ({
  room,
  isDisabled,
  onApply,
}: IDspRoomLibraryProps) => {
  const { t } = useTranslation();
  const [saved, setSaved] = useState<ISavedRoom[]>(() => readSavedRooms());
  const [isNaming, setIsNaming] = useState(false);

  const appliedId = saved.find((one) => roomShapesMatch(one.shape, room))?.id;

  return (
    <div className="dsp-room-library">
      <div className="dsp-room-library__head">
        <span className="dsp-band-subtitle">{t('dsp.room.savedRooms')}</span>
        <button
          type="button"
          className="button small subtle"
          disabled={isDisabled}
          onClick={() => setIsNaming(true)}
        >
          {t('dsp.room.saveRoom')}
        </button>
      </div>

      {saved.length > 0 ? (
        <ul className="dsp-room-library__list">
          {saved.map((one) => {
            const isApplied = one.id === appliedId;
            return (
              <li
                key={one.id}
                className={`active-layer dsp-room-saved${
                  isApplied ? ' is-applied' : ''
                }`}
              >
                <button
                  type="button"
                  className="active-layer__body"
                  aria-pressed={isApplied}
                  disabled={isDisabled}
                  title={
                    isApplied
                      ? t('dsp.room.roomApplied')
                      : t('dsp.room.applyRoom')
                  }
                  onClick={() => onApply(one.shape)}
                >
                  <span className="dsp-room-saved__pip" aria-hidden />
                  <span className="active-layer__name" title={one.name}>
                    {one.name}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={isDisabled}
                  aria-label={`${t('dsp.room.deleteRoom')} ${one.name}`}
                  title={`${t('dsp.room.deleteRoom')} ${one.name}`}
                  onClick={() => setSaved(deleteSavedRoom(one.id))}
                >
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M3 3l6 6M9 3l-6 6" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      ) : undefined}

      {isNaming ? (
        <DspPresetSaveDialog
          existing={saved.map((one) => one.name)}
          titleKey="dsp.room.saveTitle"
          hintKey="dsp.room.saveHint"
          placeholderKey="dsp.room.savePlaceholder"
          nameMax={SAVED_ROOM_NAME_MAX}
          onSave={(name) => {
            setSaved(saveRoom(name, room));
            setIsNaming(false);
          }}
          onClose={() => setIsNaming(false)}
        />
      ) : undefined}
    </div>
  );
};

export default DspRoomLibrary;
