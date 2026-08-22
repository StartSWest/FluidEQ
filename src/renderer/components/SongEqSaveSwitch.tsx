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
import '../styles/SongEqSaveSwitch.scss';

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

  // How much of the two-minute floor is behind us, drawn rather than only
  // counted down. It measures the wait and nothing else — the same subtraction
  // the countdown above already does, normalised.
  //
  // A full bar therefore means the floor is behind us, NOT that the song is
  // going to be saved: `willSongEqSave` wants a live Smart EQ layer too, so a
  // song can sit at a finished bar and still save nothing. Saying which of the
  // two it is belongs to `willSave`, which lights the whole chip — reading it
  // here as well would be the second opinion this component must not grow.
  const progress = Math.min(1, recording.listenedMs / SONG_EQ_MIN_LISTENED_MS);

  return (
    <span
      className={`song-eq-save${isSaveOn ? ' is-on' : ''}${
        recording.willSave ? ' is-will-save' : ''
      }`}
    >
      <span className="song-eq-save__row">
        <Switch
          id={id}
          isOn={isSaveOn}
          isDisabled={false}
          handleToggle={handleToggle}
          ariaLabel={t('songEq.saveAria')}
        />
        {/* A label rather than a span, pointed at the same checkbox: the chip
            is about two hundred pixels wide and only the thirty of them the
            switch occupies used to do anything, so a press on the words it is
            named by did nothing at all. The checkbox carries its own
            `aria-label`, which is what assistive tech reads — this text does
            not become a second accessible name. */}
        <label className="song-eq-save__label" htmlFor={id}>
          {t('songEq.save')}
        </label>
      </span>
      <span className="song-eq-save__row">
        {/* Silent to assistive tech: the sentence beside it is a live region
            already saying the same thing in words, and a progress bar
            announcing a second percentage over the top of it would be the
            same fact read twice. */}
        <span className="song-eq-save__track" aria-hidden>
          <span
            className="song-eq-save__fill"
            style={{ width: `${progress * 100}%` }}
          />
        </span>
        {/* A live region for the same reason the mode button's own bubble is
            one: the sentence changes underneath a user who is not looking at
            it, and a badge nobody is told changed is a badge nobody reads.
            The `title` carries whatever the fixed-width slot has to clip —
            a long song title, most often. */}
        <span className="song-eq-save__status" role="status" title={readout}>
          {readout}
        </span>
      </span>
    </span>
  );
}
