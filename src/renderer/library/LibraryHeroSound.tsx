/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import Chevron from '../icons/Chevron';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import { useTranslation } from '../utils/I18nContext';
import { useSongSoundIndex } from '../audio/songSoundIndex';
import songSoundPresetName from '../components/songSoundPresetName';
import LibrarySoundMenu from './LibrarySoundMenu';

interface ILibraryHeroSoundProps {
  /** The album the record is: its sound is picked here. */
  album: { key: string; title: string; artist: string };
  /** Every id in the record, asked for as the picker opens. */
  loadTrackIds: () => Promise<readonly string[]>;
}

/**
 * The record's hero's sound controls (the Auto EQ mockup's album page): the
 * album's sound, beside Play, opening the same choices as the album's menu
 * (`LibrarySoundMenu`). A "Has a saved sound" filter stood beside it and
 * was taken out (Ivan, 2026-11-20): on, it emptied a record with no saved
 * song, and the hero's controls, shown only for a record with songs, went
 * with the table - including the button that would have turned it off.
 */
const LibraryHeroSound = ({ album, loadTrackIds }: ILibraryHeroSoundProps) => {
  const { t } = useTranslation();
  const { albums } = useSongSoundIndex();
  const trigger = useRef<HTMLButtonElement>(null);
  const [trackIds, setTrackIds] = useState<readonly string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Closes on a press elsewhere and on Escape, as every Library menu does.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        !isInsideAnchoredMenu(event.target) &&
        !trigger.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const set = albums.get(album.key);
  const name = set
    ? (songSoundPresetName(set.presetId, t) ?? t('songSound.noPresetName'))
    : t('library.sound.none');

  return (
    <span className="library-hero__sound">
      <span className="library-hero__sound-label">
        {t('library.sound.albumTitle')}
      </span>
      <button
        type="button"
        ref={trigger}
        className={`library-hero__button library-hero__sound-pick${
          set ? ' is-set' : ''
        }`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={t('library.sound.albumAria', { album: album.title })}
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
            return;
          }
          // Opened once its songs are known: a menu over a record whose
          // songs it does not know yet would act on none of them.
          loadTrackIds()
            .then((ids) => {
              setTrackIds(ids);
              setIsOpen(true);
              return undefined;
            })
            .catch(() => undefined);
        }}
      >
        <span>{name}</span>
        <Chevron />
      </button>
      <AnchoredMenu
        anchor={trigger.current}
        isOpen={isOpen}
        className="library-list__menu"
        ariaLabel={t('library.sound.albumTitle')}
      >
        <LibrarySoundMenu
          subject={{ kind: 'album', album, trackIds }}
          onClose={() => setIsOpen(false)}
        />
      </AnchoredMenu>
    </span>
  );
};

export default LibraryHeroSound;
