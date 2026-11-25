/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useState } from 'react';
import type { TranslationKey } from '../../../../common/i18n';
import type { ILyricsLine } from '../../../../common/library/lyrics';
import MenuIcon, { type MenuIconName } from '../../../icons/MenuIcon';
import { LibraryLyricsSyncedView } from '../../../library/LibraryLyricsSynced';
import { useTranslation } from '../../../utils/I18nContext';
import useTourFrames from '../useTourFrames';

const nothing = () => undefined;

/**
 * A made-up song's words, timed word by word as an enhanced LRC file times
 * them: written for this picture, so nothing anybody wrote is shown.
 */
const VERSES: readonly (readonly string[])[] = [
  ['Lights', 'along', 'the', 'harbour', 'wall'],
  ['Every', 'window', 'holds', 'a', 'song'],
  ['I', 'hear', 'you', 'in', 'the', 'undertow'],
  ['Singing', 'all', 'night', 'long'],
  [],
  ['Turn', 'the', 'tide', 'and', 'call', 'my', 'name'],
  ['Paper', 'boats', 'on', 'silver', 'foam'],
  ['Every', 'wave', 'that', 'carries', 'me'],
  ['Carries', 'me', 'back', 'home'],
];
const WORD_MS = 420;
const LINE_GAP_MS = 600;
const BREAK_MS = 1600;

const LINES: readonly ILyricsLine[] = (() => {
  let at = 400;
  return VERSES.map((words) => {
    const line: ILyricsLine = {
      timeMs: at,
      text: words.join(' '),
      // Each word carries the space after it, as an enhanced LRC's do.
      words: words.map((text, index) => ({
        timeMs: at + index * WORD_MS,
        text: index < words.length - 1 ? `${text} ` : text,
      })),
    };
    at += words.length === 0 ? BREAK_MS : words.length * WORD_MS + LINE_GAP_MS;
    return line;
  });
})();
const SONG_MS =
  LINES[LINES.length - 1].timeMs +
  (VERSES[VERSES.length - 1].length * WORD_MS + 2 * LINE_GAP_MS);

const TABS: readonly {
  id: string;
  icon: MenuIconName;
  label: TranslationKey;
}[] = [
  { id: 'upNext', icon: 'playlist', label: 'library.upNext' },
  { id: 'details', icon: 'info', label: 'library.pane.details' },
  { id: 'lyrics', icon: 'microphone', label: 'library.pane.lyrics' },
];

/**
 * The Library's right pane on its Lyrics tab, a made-up song playing: the
 * timed lines are the Library's own (`LibraryLyricsSyncedView`) on a clock
 * of the picture's, so the line being sung is lit and held where the
 * Library holds it and each word lights as it is sung. Around them, the
 * pane's markup: the song's card, the three tabs, and the foot with Open
 * in Karaoke, whose real parts read the reader's own library.
 */
export default function LibraryLive() {
  const { t } = useTranslation();
  const [positionMs, setPositionMs] = useState(LINES[1].timeMs);
  useTourFrames((seconds) => setPositionMs((seconds * 1000) % SONG_MS), {
    fps: 8,
    still: LINES[2].timeMs / 1000 + 0.9,
  });

  return (
    <aside className="library-up-next tour-live26-library">
      <div className="library-now">
        <span className="tour-live26-library__art" aria-hidden="true" />
        <span className="library-now__text">
          <b className="library-now__title">Harbour Lights</b>
          <small className="library-now__who">June Avery · Low Tide</small>
        </span>
      </div>
      <div className="library-pane__tabs" role="tablist">
        {TABS.map((tab) => (
          <span
            key={tab.id}
            role="tab"
            aria-selected={tab.id === 'lyrics'}
            className={`library-pane__tab${tab.id === 'lyrics' ? ' is-active' : ''}`}
          >
            <MenuIcon name={tab.icon} className="library-pane__icon" />
            <span className="library-pane__label">{t(tab.label)}</span>
          </span>
        ))}
      </div>
      <div className="library-pane__body">
        <div className="library-lyrics is-synced">
          <LibraryLyricsSyncedView
            lines={LINES}
            positionMs={positionMs}
            isPlaying
            onPlayFrom={nothing}
          />
          <div className="library-lyrics__foot">
            <div className="library-lyrics__source-row">
              <p className="library-lyrics__source">
                <span>{t('library.lyrics.fromTags')}</span>
              </p>
            </div>
            <div className="library-lyrics__actions">
              <span className="button small subtle library-lyrics__karaoke">
                <MenuIcon name="microphone" />
                {t('library.lyrics.karaoke.open')}
              </span>
              <span className="button small subtle library-lyrics__other">
                {t('library.lyrics.other')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
