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

import { useSongEqRecording } from '../audio/songEqSession';
import { useTranslation } from '../utils/I18nContext';
import '../styles/SongEqBadge.scss';

/**
 * The same recording state Auto EQ's Smart correction line draws
 * (`AutoEqSmartPart`), legible on whichever tab you are on rather than only
 * the EQ page.
 *
 * Presence and the one distinction it draws are read exactly as that line
 * reads them, and nothing here is re-derived: `title` is the one honest
 * "a session is actually open" signal (`computeRecording` in
 * `songEqSession.ts` sets it only while a session is open; `listenedMs`
 * alone would misread a session that just started as nothing playing), and
 * `willSave` is taken as-is. A second opinion on either is the exact mistake
 * this feature has already shipped twice.
 */
const SongEqBadge = () => {
  const { t } = useTranslation();
  const { isSaveOn, title, willSave } = useSongEqRecording();

  // Off, or nothing open to record: the switch itself says as much on the EQ
  // tab, and a bar on every other tab claiming otherwise would be the lie
  // this badge exists to avoid telling.
  if (!isSaveOn || title === undefined) {
    return null;
  }

  return (
    <span
      className={`song-eq-badge${willSave ? ' song-eq-badge--will-save' : ''}`}
      role="status"
      aria-label={t('songEq.badgeAria')}
      title={t('songEq.badgeAria')}
    />
  );
};

export default SongEqBadge;
