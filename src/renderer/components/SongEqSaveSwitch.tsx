/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useCallback } from 'react';
import { SONG_EQ_MIN_LISTENED_MS } from 'common/songEqRecorder';
import {
  setSongEqSaveOn,
  useSongEqRecording,
  useSongEqSaveOn,
} from '../audio/songEqSession';
import { formatDuration } from '../library/player/NowPlayingBar';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';

interface ISongEqSaveSwitchProps {
  id: string;
}

/**
 * The only place this whole feature turns on, and the only place the
 * two-minute floor is ever visible.
 *
 * Every rule about whether a song is worth saving already lives behind
 * `willSave` (see `songEqSession.ts`'s own comment on it, and
 * `songEqTiming.ts`'s `willSongEqSave` underneath): the floor, whether a
 * Smart EQ layer exists at all, whether the song was forgotten. This
 * component reads that one answer and picks a sentence; it must never grow a
 * second opinion about any of the conditions behind it.
 */
export default function SongEqSaveSwitch({ id }: ISongEqSaveSwitchProps) {
  const { t } = useTranslation();
  const isSaveOn = useSongEqSaveOn();
  const recording = useSongEqRecording();

  const handleToggle = useCallback(() => {
    setSongEqSaveOn(!isSaveOn);
  }, [isSaveOn]);

  // `title` is only ever set while a session is open (`computeRecording` in
  // songEqSession.ts sets it from `session?.identity.title`), so its absence
  // is the one honest way to tell "nothing playing" apart from "playing, but
  // not yet past the floor" — checking `listenedMs` instead would misread a
  // session that just opened (still zero) as nothing playing at all.
  let readout: string;
  if (recording.title === undefined) {
    readout = t('songEq.waiting');
  } else if (recording.willSave) {
    readout = t('songEq.willSave', { title: recording.title });
  } else {
    readout = t('songEq.listening', {
      remaining: formatDuration(
        Math.max(0, SONG_EQ_MIN_LISTENED_MS - recording.listenedMs),
      ),
    });
  }

  return (
    <span className="eq-toolbar__save">
      <span className="eq-toolbar__save-row">
        <Switch
          id={id}
          isOn={isSaveOn}
          isDisabled={false}
          handleToggle={handleToggle}
          ariaLabel={t('songEq.saveAria')}
        />
        <span>{t('songEq.save')}</span>
      </span>
      {/* A live region for the same reason the mode button's own bubble is
          one: the sentence changes underneath a user who is not looking at
          it, and a badge nobody is told changed is a badge nobody reads. */}
      <span className="eq-toolbar__status" role="status">
        {readout}
      </span>
    </span>
  );
}
