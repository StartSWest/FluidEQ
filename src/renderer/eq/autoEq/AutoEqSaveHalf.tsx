/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import MenuIcon from '../../icons/MenuIcon';
import isOwnAnimationEnd from '../../utils/ownAnimationEnd';
import { useTranslation } from '../../utils/I18nContext';
import useHasChanged from '../../utils/useHasChanged';
import {
  saveSongSoundNow,
  type ISongSoundNow,
} from '../../audio/songSoundSession';

export type TSaveHalf = 'save' | 'saveChanges' | 'saved';

/**
 * What the button's Save half offers, the same press as the panel's (Ivan
 * approved, 2026-11-20): Save changes over a saved sound changed while it
 * plays, Saved for a moment after a save, and "Save to this song" over the
 * listener's own sound — nothing while nothing plays, Song sounds is off or
 * Auto EQ steps aside.
 */
export const saveHalfOf = (
  now: ISongSoundNow,
  isSongsOn: boolean,
  isHeld: boolean,
  /** A save was just pressed and its moment is not over. */
  isJustSaved: boolean,
): TSaveHalf | undefined => {
  if (isHeld || !isSongsOn || !now.identity) {
    return undefined;
  }
  if (now.isChanged) {
    return 'saveChanges';
  }
  // Saved for a moment after the press, then nothing until something is
  // changed (Ivan, 2026-11-26: "saved only for 5 s show then it back to
  // normal"): the main half already says Song.
  if (now.owner === 'song') {
    return isJustSaved ? 'saved' : undefined;
  }
  return now.canSave ? 'save' : undefined;
};

/** The Save half itself: a segment sharing the button's edge, as the caret of
 * the row's other split controls does (`_mainContentToolbar.scss`). */
const AutoEqSaveHalf = ({
  save,
  title,
  moment,
  onSavedShown,
}: {
  save: TSaveHalf | undefined;
  title: string | undefined;
  /** Which save Saved is about: a second press holds it a moment again. */
  moment: number;
  /** Saved has been shown for its moment (`eq-auto-saved-hold`). */
  onSavedShown: () => void;
}) => {
  const { t } = useTranslation();
  // Save and Saved swap in when they swap, never as the page opens.
  const swap = useHasChanged(save ?? 'none') ? ' is-swap' : '';
  if (!save) {
    return null;
  }
  if (save === 'saved') {
    return (
      <span
        key={moment}
        className={`eq-auto__save is-saved${swap}`}
        role="status"
        onAnimationEnd={(event) => {
          if (isOwnAnimationEnd(event, 'eq-auto-saved-hold')) {
            onSavedShown();
          }
        }}
      >
        <MenuIcon name="check" className="eq-toolbar__icon" />
        <span className="eq-auto__save-word eq-toolbar__word">
          {t('autoEq.button.saved')}
        </span>
      </span>
    );
  }
  // The panel's own words for a screen reader; on the row one short word,
  // the main half already saying Changed or Yours. "Save changes" there
  // pushed the row into its narrower fit at full width, and the Preset and
  // Tone tabs gave up what they hold to make room.
  const name =
    save === 'saveChanges'
      ? t('autoEq.songs.saveChanges')
      : t('autoEq.songs.save');
  return (
    <button
      type="button"
      className={`eq-auto__save${swap}`}
      aria-label={name}
      title={title ? t('autoEq.button.saveFor', { title }) : name}
      onClick={saveSongSoundNow}
    >
      <MenuIcon name="save" className="eq-toolbar__icon" />
      <span className="eq-auto__save-word eq-toolbar__word" aria-hidden="true">
        {t('autoEq.button.save')}
      </span>
    </button>
  );
};

export default AutoEqSaveHalf;
