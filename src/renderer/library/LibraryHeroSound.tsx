/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import Chevron from '../icons/Chevron';
import MenuIcon from '../icons/MenuIcon';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import { useTranslation } from '../utils/I18nContext';
import { useSongSoundIndex } from '../audio/songSoundIndex';
import songSoundPresetName from '../components/songSoundPresetName';
import LibrarySoundMenu from './LibrarySoundMenu';

interface ILibraryHeroSoundProps {
  /** The album the record is, when it is one: its sound is picked here. */
  album?: { key: string; title: string; artist: string };
  /** Every id in the record, asked for as the picker opens. */
  loadTrackIds: () => Promise<readonly string[]>;
  /** "Has a saved sound": the record's table narrowed to the songs with one. */
  soundFilter?: { isOn: boolean; onToggle: () => void };
}

/**
 * The record's hero's sound controls (the Auto EQ mockup's album page): the
 * album's sound, beside Play, opening the same choices as the album's menu
 * (`LibrarySoundMenu`), and "Has a saved sound", which narrows the table to
 * the songs that keep one.
 */
const LibraryHeroSound = ({
  album,
  loadTrackIds,
  soundFilter,
}: ILibraryHeroSoundProps) => {
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

  const set = album ? albums.get(album.key) : undefined;
  const name = set
    ? (songSoundPresetName(set.presetId, t) ?? t('songSound.noPresetName'))
    : t('library.sound.none');

  return (
    <>
      {album && (
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
      )}
      {soundFilter && (
        <button
          type="button"
          className={`library-hero__button library-hero__sound-filter${
            soundFilter.isOn ? ' is-on' : ''
          }`}
          aria-pressed={soundFilter.isOn}
          onClick={soundFilter.onToggle}
        >
          <MenuIcon name="check" />
          <span>{t('library.sound.filter')}</span>
        </button>
      )}
    </>
  );
};

export default LibraryHeroSound;
