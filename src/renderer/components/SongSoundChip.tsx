/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { useLiveSongSound, useSongSoundNow } from '../audio/songSoundSession';
import { useSongSoundIndex } from '../audio/songSoundIndex';
import { useSavedEqStates } from '../audio/savedEqActions';
import { songCardSound } from '../audio/songCardSound';
import { requestAutoEqOpen } from '../eq/autoEq/autoEqOpen';
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
  const sound = songCardSound(now, live, states, eqById, t);
  if (!sound) {
    return null;
  }
  const label = t('autoEq.chip.title', { sound: sound.text });
  return (
    <button
      type="button"
      className={`song-sound-chip ${className} is-${sound.kind}`}
      title={label}
      aria-label={label}
      onClick={requestAutoEqOpen}
    >
      <MenuIcon name="smart" className="song-sound-chip__icon" />
      <span className="song-sound-chip__text">{sound.text}</span>
    </button>
  );
};

export default SongSoundChip;
