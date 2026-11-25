/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  Fragment,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';
import { reachedIndex } from 'common/library/lyrics';
import MenuIcon, { type MenuIconName } from '../../icons/MenuIcon';
import LibraryCoverArt from '../../library/LibraryCoverArt';
import LibraryLyricsFinder from '../../library/LibraryLyricsFinder';
import { formatDuration } from '../../library/tags/tagTime';
import type { ILyricsImport } from '../../library/useLyricsImport';
import { useTranslation } from '../../utils/I18nContext';
import Switch from '../../widgets/Switch';
import {
  HELP_LYRICS,
  HELP_LYRICS_FILE,
  HELP_PLAYING,
  HELP_POSITION_MS,
  HELP_UP_NEXT,
} from './libraryFigureData';

/**
 * The Library's right pane, drawn for Help (`libraryFigures`): what is
 * playing over the three tabs, and Up next or the Lyrics under them. The
 * pane's own components read the player and the reader's library
 * (`LibraryRightPane`, `LibraryUpNext`, `LibraryLyricsTab`), so this is
 * their markup, class for class, playing the made-up record; the finder's
 * sites and buttons are `LibraryLyricsFinder` itself, handed an import that
 * does nothing.
 */

const nothing = () => undefined;

/** Where the tab holds the line being sung, as a share of the list's height. */
const LYRICS_HOLD_AT = 0.32;

type TPaneTab = 'upNext' | 'details' | 'lyrics';

const PANE_TABS: readonly {
  name: TPaneTab;
  icon: MenuIconName;
  label: 'library.upNext' | 'library.pane.details' | 'library.pane.lyrics';
}[] = [
  { name: 'upNext', icon: 'playlist', label: 'library.upNext' },
  { name: 'details', icon: 'info', label: 'library.pane.details' },
  { name: 'lyrics', icon: 'microphone', label: 'library.pane.lyrics' },
];

/** The pane's head and tabs, `tab` chosen, as `LibraryRightPane` lays them. */
const PaneFrame = ({
  tab,
  children,
}: {
  tab: TPaneTab;
  children: ReactNode;
}) => {
  const { t } = useTranslation();
  const song = HELP_PLAYING;
  return (
    <aside className="library-up-next" aria-label={t('library.nowPlaying')}>
      <div className="library-now" title={song.title}>
        <LibraryCoverArt src={song.cover} label={song.title} size="tile" />
        <span className="library-now__text">
          <b className="library-now__title">{song.title}</b>
          <small className="library-now__who">
            <span className="library-artist-link">{song.artist}</span>
            {' · '}
            {song.album}
          </small>
        </span>
      </div>
      <div className="library-pane__tabs" role="tablist">
        {PANE_TABS.map(({ name, icon, label }) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            className={`library-pane__tab${tab === name ? ' is-active' : ''}`}
            aria-label={t(label)}
          >
            <MenuIcon name={icon} className="library-pane__icon" />
            <span className="library-pane__label">{t(label)}</span>
          </button>
        ))}
      </div>
      <div className="library-pane__body" role="tabpanel">
        {children}
      </div>
    </aside>
  );
};

/** One queued song, as `LibraryUpNext` draws its rows. */
const QueueRow = ({ song }: { song: (typeof HELP_UP_NEXT.rest)[number] }) => {
  const { t } = useTranslation();
  return (
    <div className="library-up-next__entry">
      <button type="button" className="library-up-next__row">
        <LibraryCoverArt src={song.cover} label={song.title} size="row" />
        <span className="library-up-next__text">
          <span className="library-up-next__track">{song.title}</span>
          <span className="library-up-next__artist">{song.artist}</span>
        </span>
        <span className="library-up-next__time">
          {formatDuration(song.durationMs ?? 0)}
        </span>
      </button>
      <button
        type="button"
        className="library-up-next__remove"
        aria-label={t('library.queue.remove')}
      >
        <svg viewBox="0 0 16 16" aria-hidden>
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
};

/**
 * Up next: Keep playing, the rest of the record under "Then" and two songs
 * added by hand under "Your picks", each run headed by its record, and
 * Surprise me at the foot.
 */
export const UpNextPane = () => {
  const { t } = useTranslation();
  const keepId = useId();
  return (
    <PaneFrame tab="upNext">
      <div className="library-up-next__body">
        <div className="library-up-next__keep">
          <span className="library-up-next__keep-switch">
            <Switch
              id={keepId}
              isOn
              isDisabled={false}
              handleToggle={nothing}
              ariaLabel={t('library.upNext.keepPlaying')}
            />
            <label className="library-up-next__keep-label" htmlFor={keepId}>
              {t('library.upNext.keepPlaying')}
            </label>
          </span>
        </div>
        <div className="library-up-next__list">
          <p className="library-up-next__section">{t('library.upNext.rest')}</p>
          <p className="library-up-next__group">{HELP_PLAYING.album}</p>
          {HELP_UP_NEXT.rest.map((song) => (
            <QueueRow key={song.id} song={song} />
          ))}
          <p className="library-up-next__section is-added">
            {t('library.upNext.added')}
          </p>
          {/* Two records, so each pick is headed by its own. */}
          {HELP_UP_NEXT.added.map((song) => (
            <Fragment key={song.id}>
              <p className="library-up-next__group">{song.album}</p>
              <QueueRow song={song} />
            </Fragment>
          ))}
        </div>
        <div className="library-up-next__foot">
          <button
            type="button"
            className="button library-surprise small library-up-next__surprise"
          >
            <svg
              className="library-surprise__icon"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                fill="none"
                d="M3.5 18.5h2.6c4.4 0 6.4-10 10.8-10h3.6M18 6l2.5 2.5L18 11M3.5 8.5h2.6c1.6 0 2.8.9 3.8 2.3M12.3 15.6c1.1 1.6 2.5 2.9 4.6 2.9h3.6M18 16l2.5 2.5L18 21"
              />
              <path
                className="library-surprise__spark"
                d="M6 1.8Q6.3 4 8.5 4.3 6.3 4.6 6 6.8 5.7 4.6 3.5 4.3 5.7 4 6 1.8z"
              />
            </svg>
            <span>{t('library.upNext.surprise')}</span>
          </button>
        </div>
      </div>
    </PaneFrame>
  );
};

/**
 * Lyrics: the song's timed words from the .lrc beside it, the line being
 * sung lit up to its word, and the foot that says where they came from with
 * Open in Karaoke and Find other lyrics under it.
 */
const LyricsPane = () => {
  const { t } = useTranslation();
  const active = reachedIndex(HELP_LYRICS, HELP_POSITION_MS);
  const linesRef = useRef<HTMLOListElement>(null);
  // The line being sung held in the list's upper third, where the tab
  // follows it (`LibraryLyricsSynced`'s HOLD_AT).
  useLayoutEffect(() => {
    const list = linesRef.current;
    const line = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (list && line) {
      list.scrollTop = line.offsetTop - list.clientHeight * LYRICS_HOLD_AT;
    }
  }, []);
  return (
    <PaneFrame tab="lyrics">
      <div className="library-lyrics is-synced">
        <div className="library-lyrics__stage">
          <ol
            ref={linesRef}
            className="library-lyrics__lines"
            aria-label={t('library.lyrics.listLabel')}
          >
            {HELP_LYRICS.map((line, index) => {
              if (line.text === '') {
                return (
                  <li
                    // The made-up song's lines never move.
                    // eslint-disable-next-line react/no-array-index-key -- see above
                    key={index}
                    className="library-lyrics__stanza"
                    aria-hidden="true"
                  />
                );
              }
              let state = '';
              if (index === active) {
                state = ' is-active';
              } else if (index < active) {
                state = ' is-past';
              }
              const sung = (line.words ?? []).filter(
                (word) => word.timeMs <= HELP_POSITION_MS,
              ).length;
              return (
                // eslint-disable-next-line react/no-array-index-key -- the made-up song's lines never move
                <li key={index}>
                  <button
                    type="button"
                    className={`library-lyrics__line${state}`}
                    aria-current={index === active ? 'true' : undefined}
                  >
                    {index === active && line.words
                      ? line.words.map((word, at) => (
                          <span
                            // eslint-disable-next-line react/no-array-index-key -- words keep their order
                            key={at}
                            className={`library-lyrics__word${
                              at < sung ? ' is-sung' : ''
                            }`}
                          >
                            {word.text}
                          </span>
                        ))
                      : line.text}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="library-lyrics__foot">
          <div className="library-lyrics__source-row">
            <p
              className="library-lyrics__source"
              title={t('library.lyrics.fromFile', { name: HELP_LYRICS_FILE })}
            >
              <span>
                {t('library.lyrics.fromFile', { name: HELP_LYRICS_FILE })}
              </span>
            </p>
            <button
              type="button"
              className="button small subtle library-lyrics__remove"
              aria-label={t('library.lyrics.remove.button')}
            >
              <MenuIcon name="trash" />
            </button>
          </div>
          <div className="library-lyrics__actions">
            <button
              type="button"
              className="button small subtle library-lyrics__karaoke"
            >
              <MenuIcon name="microphone" />
              {t('library.lyrics.karaoke.open')}
            </button>
            <button
              type="button"
              className="button small subtle library-lyrics__other"
            >
              {t('library.lyrics.other')}
            </button>
          </div>
        </div>
      </div>
    </PaneFrame>
  );
};

/** An import that is never asked for anything: the drawing is inert. */
const STILL_IMPORT: ILyricsImport = {
  status: { state: 'idle' },
  pickFile: nothing,
  importFile: nothing,
  importText: nothing,
  replace: nothing,
  dismiss: nothing,
};

/**
 * Find other lyrics: the search on three sites in the reader's browser,
 * and the ways to keep what they find with the song.
 */
const FinderPane = () => {
  const { t } = useTranslation();
  return (
    <PaneFrame tab="lyrics">
      <div className="library-lyrics is-finding">
        <button
          type="button"
          className="button small subtle library-lyrics__back"
        >
          <MenuIcon name="back" />
          {t('library.lyrics.back')}
        </button>
        <LibraryLyricsFinder
          track={HELP_PLAYING}
          lyricsImport={STILL_IMPORT}
          isLead={false}
        />
      </div>
    </PaneFrame>
  );
};

/**
 * A pane on the Library's card, at the height a window gives it: as wide as
 * the pane (`--up-next-width`'s 300px) and the card's own edges round it.
 */
const PaneCard = ({ children }: { children: ReactNode }) => (
  <div
    className="workspace-tab-panel workspace-tab-panel--library"
    style={{
      display: 'flex',
      // A row, so the pane stretches to the card's height as the Library's
      // grid stretches its side column.
      flexDirection: 'row',
      flex: '0 0 auto',
      // The pane's 300px inside the card's border, and no padding, as the
      // Library's card has none (`.library-workspace`). The card is a size
      // container, so it never takes its width from the pane.
      boxSizing: 'content-box',
      width: 300,
      height: 600,
      padding: 0,
      margin: 0,
      overflow: 'hidden',
    }}
  >
    <div className="library-side">{children}</div>
  </div>
);

/**
 * The Lyrics tab twice, side by side: a song's timed words, and the same
 * tab on Find other lyrics.
 */
export const LibraryLyricsDrawing = () => (
  <div style={{ display: 'flex', gap: 20 }}>
    <PaneCard>
      <LyricsPane />
    </PaneCard>
    <PaneCard>
      <FinderPane />
    </PaneCard>
  </div>
);
