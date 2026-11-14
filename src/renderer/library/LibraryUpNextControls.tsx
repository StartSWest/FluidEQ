/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { useLibraryPlayerSession } from './player/LibraryPlayerContext';
import LibrarySurpriseButton from './LibrarySurpriseButton';
import Switch from '../widgets/Switch';

/**
 * Keep playing, and Surprise me beside it.
 *
 * ON THE SURFACE THE LIST IS, not in a menu. What the switch does is add
 * rows to the panel directly beneath it, so it belongs beside them: a queue
 * that refills itself with nothing on screen to say why reads as the player
 * having a mind of its own, and a switch buried in settings is found only by
 * somebody who already suspects it exists. Surprise me fills the same list,
 * so it stands on the same row (Ivan, 2026-11-13: "inside up next"); where
 * the panel is too narrow for both, it takes the next line, at the right,
 * rather than covering the switch's words.
 */
export const LibraryUpNextKeepRow = ({
  canSurprise,
}: {
  /** The button is offered only while there is a shelf to surprise from
   * and the empty queue's own larger one is not already on screen. */
  canSurprise: boolean;
}) => {
  const { t } = useTranslation();
  const { isContinuationOn, setIsContinuationOn } = useLibraryPlayerSession();
  return (
    <div className="library-up-next__keep">
      <span className="library-up-next__keep-switch">
        <Switch
          id="library-up-next-keep-playing"
          isOn={isContinuationOn}
          isDisabled={false}
          handleToggle={() => setIsContinuationOn(!isContinuationOn)}
          ariaLabel={t('library.upNext.keepPlaying')}
        />
        {/* A label pointed at the same checkbox, for the reason
            `SongEqSaveSwitch` gives: without it only the switch itself
            answers a press and the words beside it are dead. */}
        <label
          className="library-up-next__keep-label"
          htmlFor="library-up-next-keep-playing"
          title={t('library.upNext.keepPlayingHint')}
        >
          {t('library.upNext.keepPlaying')}
        </label>
      </span>
      {canSurprise && (
        <LibrarySurpriseButton
          className="small library-up-next__surprise"
          title={t('library.upNext.surpriseHint')}
        />
      )}
    </div>
  );
};

/**
 * An empty queue, and the way to start one.
 *
 * Nothing queued is the moment Surprise me is most useful, so it is offered
 * there at full size with what it does written under it — the hint the
 * small one keeps in its tooltip. A library with nothing it can play (every
 * song on a drive that is not plugged in, or only videos) answers no song;
 * the line under the button then says so, because a press that visibly does
 * nothing reads as a broken button.
 */
export const LibraryUpNextStart = ({
  canSurprise,
}: {
  canSurprise: boolean;
}) => {
  const { t } = useTranslation();
  const [isNothingToPlay, setIsNothingToPlay] = useState(false);
  if (!canSurprise) {
    return (
      <p className="library-up-next__empty">{t('library.upNext.empty')}</p>
    );
  }
  return (
    <div className="library-up-next__start">
      <p className="library-up-next__empty">{t('library.upNext.empty')}</p>
      <LibrarySurpriseButton
        className="library-up-next__start-button"
        onAnswer={(picked) => setIsNothingToPlay(picked === null)}
      />
      <p
        className={`library-up-next__start-hint${
          isNothingToPlay ? ' is-nothing' : ''
        }`}
        // Said aloud when it changes to "nothing can be played": the press
        // that caused it moved no focus and started no sound.
        aria-live="polite"
      >
        {isNothingToPlay
          ? t('library.upNext.surpriseNothing')
          : t('library.upNext.surpriseStart')}
      </p>
    </div>
  );
};
