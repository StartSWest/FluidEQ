/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import type { ILibraryTrack } from 'common/library/types';
import Chevron from '../icons/Chevron';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import { useTranslation } from '../utils/I18nContext';
import { useSongSoundIndex } from '../audio/songSoundIndex';
import songSoundPresetName from '../components/songSoundPresetName';
import LibrarySoundMenu from './LibrarySoundMenu';
import librarySoundTag from './librarySoundTag';

/**
 * A song's sound in its Details (Ivan, 2026-11-19: "from the song's row in
 * Details"): where it comes from — its own, its album's, or the listener's —
 * and the same choices as its menu (`LibrarySoundMenu`).
 */
const LibraryTrackSound = ({ track }: { track: ILibraryTrack }) => {
  const { t } = useTranslation();
  const index = useSongSoundIndex();
  const trigger = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

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

  const tag = librarySoundTag(track, index);
  const preset = tag
    ? (songSoundPresetName(tag.presetId, t) ?? t('songSound.noPresetName'))
    : undefined;
  let where = t('library.sound.detailsYours');
  if (tag?.kind === 'own' && preset) {
    where = t('library.sound.tagOwn', { preset });
  } else if (tag?.kind === 'album' && preset) {
    where = t('library.sound.tagAlbum', { preset });
  }

  return (
    // The pane's own shapes: a fact row, as every other group here is drawn,
    // and a button under it, as Location's Show in Explorer is.
    <section className="library-facts__group">
      <h3 className="library-pane__heading">{t('autoEq.title')}</h3>
      <dl>
        <div className="library-facts__row">
          <dt>{t('library.sound.title')}</dt>
          <dd>
            <span
              className={`library-list__sound${tag ? ` is-${tag.kind}` : ''}`}
            >
              {where}
            </span>
          </dd>
        </div>
      </dl>
      <div className="library-facts__sound">
        <button
          type="button"
          ref={trigger}
          className="library-hero__button library-facts__reveal library-facts__sound-pick"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((was) => !was)}
        >
          <span>{t('library.sound.change')}</span>
          <Chevron />
        </button>
        <AnchoredMenu
          anchor={trigger.current}
          isOpen={isOpen}
          className="library-list__menu"
          ariaLabel={t('library.sound.title')}
        >
          <LibrarySoundMenu
            subject={{ kind: 'songs', trackIds: [track.id] }}
            onClose={() => setIsOpen(false)}
          />
        </AnchoredMenu>
      </div>
    </section>
  );
};

export default LibraryTrackSound;
