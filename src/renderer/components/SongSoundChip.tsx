/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useRef, useState } from 'react';
import MenuIcon from '../icons/MenuIcon';
import AnchoredMenu from '../widgets/AnchoredMenu';
import { useTranslation } from '../utils/I18nContext';
import { useLiveSongSound, useSongSoundNow } from '../audio/songSoundSession';
import { useSongSoundIndex } from '../audio/songSoundIndex';
import {
  goBackToSaved,
  songCardSound,
  storedPresetOf,
} from '../audio/songCardSound';
import { requestAutoEqOpen } from '../eq/autoEq/autoEqOpen';
import useMenuDismiss from '../player/useMenuDismiss';
import '../styles/SongSoundChip.scss';

/**
 * The sound the playing song plays, on its card (Ivan, 2026-11-20: "also
 * show the preset playing on the song card too"), in three states only
 * (`songCardSound`): "Song · Warm" in the song's green, "Album · Pop" in the
 * album's amber, "Changed · K-pop" in the amber, and nothing at all
 * otherwise. From the same session the panel reads, so it changes the moment
 * the sound does. Pressed, it opens Auto EQ's panel.
 *
 * Changed by hand over a song's or an album's sound, the press opens a short
 * menu instead (Ivan, 2026-11-20: "when I hover on 'Changed' — set album
 * sound or something like that"): Restore first, in the panel's own words,
 * Auto EQ second. Drawn over the bar, which stands at a higher layer than
 * menus do: under it the menu's foot was cut off (Ivan, 2026-11-21: "fix
 * the menu to show on top").
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
  const index = useSongSoundIndex();
  const { eqById } = index;
  const [isOpen, setIsOpen] = useState(false);
  const holder = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  useMenuDismiss(isOpen, holder, close);

  const sound = songCardSound(now, live, eqById, t, storedPresetOf(now, index));
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
              goBackToSaved(back);
            }}
          >
            <MenuIcon name="reset" className="band-menu__icon" />
            <span>{t('autoEq.restore', { preset: back.name })}</span>
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
