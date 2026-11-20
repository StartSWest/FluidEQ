/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { useLibraryPlayerSession } from './player/LibraryPlayerContext';
import LibrarySurpriseButton from './LibrarySurpriseButton';
import { surprisesAtEnd } from './player/useSurpriseAtEnd';
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
export const LibraryUpNextKeepRow = () => {
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
        {/* A label pointed at the same checkbox: without it only the
            switch itself answers a press and the words beside it are dead. */}
        <label
          className="library-up-next__keep-label"
          htmlFor="library-up-next-keep-playing"
          title={t('library.upNext.keepPlayingHint')}
        >
          {t('library.upNext.keepPlaying')}
        </label>
      </span>
    </div>
  );
};

/**
 * Surprise me at the foot of the queue, one button in one place whether the
 * queue holds songs or nothing (Ivan, 2026-11-15: "Surprise me button at the
 * bottom of the Up next", then "it needs to be the same for both cases, I
 * like the filled version"). It stood squeezed beside Keep playing over a
 * list and large in the middle of an empty queue - two buttons for one
 * action. Filled, as he chose.
 *
 * While the queue is empty its line stands under it: what it does, or what
 * the end of the song will do, or - a library with nothing it can play
 * (every song on a drive that is not plugged in, or only videos) - that
 * there is nothing to pick, because a press that visibly does nothing reads
 * as a broken button.
 */
export const LibraryUpNextFoot = ({
  isQueueEmpty,
}: {
  isQueueEmpty: boolean;
}) => {
  const { t } = useTranslation();
  const { isContinuationOn, track, repeat } = useLibraryPlayerSession();
  const [isNothingToPlay, setIsNothingToPlay] = useState(false);
  // Said while a song stands with nothing after it and its end will press
  // Surprise me by itself (`useSurpriseAtEnd`): a next song nobody queued
  // must not arrive unannounced.
  const surprisesNext =
    repeat === 'off' &&
    surprisesAtEnd({ isContinuationOn, endedKind: track?.kind });
  return (
    <div className="library-up-next__foot">
      <LibrarySurpriseButton
        className="small library-up-next__surprise"
        title={t('library.upNext.surpriseHint')}
        onAnswer={(picked) => setIsNothingToPlay(picked === null)}
      />
      {isQueueEmpty && (
        <p
          className={`library-up-next__start-hint${
            isNothingToPlay ? ' is-nothing' : ''
          }`}
          // Said aloud when it changes to "nothing can be played": the press
          // that caused it moved no focus and started no sound.
          aria-live="polite"
        >
          {isNothingToPlay && t('library.upNext.surpriseNothing')}
          {!isNothingToPlay &&
            (surprisesNext
              ? t('library.upNext.surpriseNext')
              : t('library.upNext.surpriseStart'))}
        </p>
      )}
    </div>
  );
};

const FILLING_ROWS = 4;

/**
 * The songs Keep playing is fetching, before they arrive.
 *
 * Drawn as the list's own heading and rows, at the rows' own 42px, so the
 * answer lands in place: the panel keeps its shape, and only the words and
 * covers appear.
 */
export const LibraryUpNextFilling = () => {
  const { t } = useTranslation();
  return (
    <div
      className="library-up-next__filling"
      role="status"
      aria-busy="true"
      aria-label={t('library.upNext.continued')}
    >
      <p className="library-up-next__section is-continued" aria-hidden="true">
        {t('library.upNext.continued')}
      </p>
      {Array.from({ length: FILLING_ROWS }, (_, index) => (
        <div key={index} className="library-up-next__ghost" aria-hidden="true">
          <span className="library-up-next__ghost-cover" />
          <span className="library-up-next__ghost-text">
            <span className="library-up-next__ghost-bar" />
            <span className="library-up-next__ghost-bar is-short" />
          </span>
        </div>
      ))}
    </div>
  );
};

/**
 * An empty queue: what it is, in the middle of the column. The way to start
 * one is the queue's own foot (`LibraryUpNextFoot`), where it stands whatever
 * the queue holds.
 */
export const LibraryUpNextStart = () => {
  const { t } = useTranslation();
  return <p className="library-up-next__empty">{t('library.upNext.empty')}</p>;
};
