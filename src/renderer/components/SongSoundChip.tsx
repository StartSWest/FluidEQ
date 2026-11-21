/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useRef, useState } from 'react';
import MenuIcon from '../icons/MenuIcon';
import AnchoredMenu from '../widgets/AnchoredMenu';
import { useTranslation } from '../utils/I18nContext';
import {
  revertSongSound,
  useLiveSongSound,
  useSongSoundNow,
} from '../audio/songSoundSession';
import { useSongSoundIndex } from '../audio/songSoundIndex';
import { useSavedEqStates } from '../audio/savedEqActions';
import { songCardSound } from '../audio/songCardSound';
import { requestAutoEqOpen } from '../eq/autoEq/autoEqOpen';
import useMenuDismiss from '../player/useMenuDismiss';
import '../styles/SongSoundChip.scss';

/**
 * The sound the playing song plays, on its card (Ivan, 2026-11-20: "also
 * show the preset playing on the song card too"): "Album · Pop" in the
 * album's amber, "Own · Warm" in the song's green, a change not saved in the
 * amber, the listener's own preset in the card's quiet ink — the Library's
 * Sound column, word for word (`songCardSound`). From the same session the
 * panel reads, so it changes the moment the sound does. Pressed, it opens
 * Auto EQ's panel, which says why and offers what can be done about it.
 *
 * Changed by hand over a song's or an album's sound, the press opens a short
 * menu instead (Ivan, 2026-11-20: "when I hover on 'Changed' — set album
 * sound or something like that"): back to that sound first, Auto EQ second.
 * A menu rather than going back on the press itself, because in every other
 * state the same press opens Auto EQ, and a press that silently swapped the
 * sound in this one alone would be the one nobody expected.
 *
 * The bars and the amp each place and size it (`className`); what it says
 * and does is the same everywhere. From the amp the press brings the app
 * back on the EQ page (`App.tsx`), the amp showing no page of its own.
 */
const SongSoundChip = ({ className }: { className: string }) => {
  const { t } = useTranslation();
  const now = useSongSoundNow();
  const live = useLiveSongSound();
  const { eqs, eqById } = useSongSoundIndex();
  const states = useSavedEqStates(eqs);
  const [isOpen, setIsOpen] = useState(false);
  const holder = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  useMenuDismiss(isOpen, holder, close);

  const sound = songCardSound(now, live, states, eqById, t);
  const back = sound?.back;
  // Nothing changed any more (saved, gone back, the next song): the menu goes
  // with it, and does not open by itself the next time a change is made.
  if (isOpen && !back) {
    setIsOpen(false);
  }
  if (!sound) {
    return null;
  }
  const isAlbum = back?.owner === 'album';
  let label = t('autoEq.chip.title', { sound: sound.text });
  if (back) {
    label = t(
      isAlbum ? 'autoEq.chip.changedAlbum' : 'autoEq.chip.changedSong',
      { preset: back.name },
    );
  }

  return (
    <>
      <button
        ref={holder}
        type="button"
        className={`song-sound-chip ${className} is-${sound.kind}`}
        title={label}
        aria-label={label}
        aria-haspopup={back ? 'menu' : undefined}
        aria-expanded={back ? isOpen : undefined}
        onClick={() => {
          if (back) {
            setIsOpen((was) => !was);
            return;
          }
          requestAutoEqOpen();
        }}
      >
        <MenuIcon name="smart" className="song-sound-chip__icon" />
        <span className="song-sound-chip__text">{sound.text}</span>
      </button>
      {back && (
        <AnchoredMenu
          anchor={holder.current}
          isOpen={isOpen}
          className="band-menu song-sound-menu"
          ariaLabel={label}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              revertSongSound();
            }}
          >
            <MenuIcon name="reset" className="band-menu__icon" />
            <span>
              {t(isAlbum ? 'autoEq.chip.backAlbum' : 'autoEq.chip.backSong', {
                preset: back.name,
              })}
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              requestAutoEqOpen();
            }}
          >
            <MenuIcon name="smart" className="band-menu__icon" />
            <span>{t('autoEq.chip.open')}</span>
          </button>
        </AnchoredMenu>
      )}
    </>
  );
};

export default SongSoundChip;
