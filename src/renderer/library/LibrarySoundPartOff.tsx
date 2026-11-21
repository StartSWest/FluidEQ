/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import type { ISongSoundParts } from 'common/songSoundEvents';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';

/**
 * A sound kept in the Library for a part of Auto EQ that is switched off
 * (Ivan, 2026-11-20: "it's not loading because the album sounds is off. We
 * need to show there, if off, a warning and confirmation"). The pick is
 * already kept; this page of the sound menu says it will not play yet and
 * offers the switch, the suggested action in the loud style and Not now in
 * the quiet one, with where to switch it off again. Before it, the menu
 * closed on the pick and nothing played, which read as the pick failing.
 */
const LibrarySoundPartOff = ({
  part,
  kept,
  onTurnOn,
  onClose,
}: {
  part: keyof ISongSoundParts;
  /** What was kept, and for what: "Kept for the album: Pop". */
  kept: string;
  onTurnOn: () => void;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const turnOn = useRef<HTMLButtonElement>(null);
  const isAlbums = part === 'albums';

  // The menu's pick button is gone with the page it stood on; the focus goes
  // to what the page suggests.
  useEffect(() => {
    turnOn.current?.focus();
  }, []);

  return (
    <div
      className={`library-sound-off${isAlbums ? ' is-album' : ' is-own'}`}
      role="group"
      aria-labelledby="library-sound-off-why"
    >
      <p id="library-sound-off-why" className="library-sound-off__why">
        <MenuIcon name="power" className="library-sound-off__icon" />
        <span>
          {t(isAlbums ? 'library.sound.albumsOff' : 'library.sound.songsOff')}
        </span>
      </p>
      <p className="library-sound-off__kept">
        <MenuIcon name="check" className="library-sound-off__icon" />
        <span>{kept}</span>
      </p>
      <div className="library-sound-off__actions">
        <button
          ref={turnOn}
          type="button"
          className="button small"
          onClick={onTurnOn}
        >
          {t(
            isAlbums
              ? 'library.sound.turnOnAlbums'
              : 'library.sound.turnOnSongs',
          )}
        </button>
        <button type="button" className="button small subtle" onClick={onClose}>
          {t('output.notNow')}
        </button>
      </div>
      <p className="library-sound-off__where">{t('library.sound.offWhere')}</p>
    </div>
  );
};

export default LibrarySoundPartOff;
