/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useRef, useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import PlayerIcon, { type TPlayerIconName } from './PlayerIcon';
import PlaylistsDeck from './PlaylistsDeck';
import QueueDeck from './QueueDeck';
import { QueueSaveKey } from './QueueSave';
import { useLibraryDeck } from './libraryDeck';
import {
  type TPlayerQueuePage,
  usePlayerQueuePage,
  usePlayerShelfOpen,
} from './playerLayout';
import { usePlaylistDeck } from './playlistDeck';
import { formatQueueTime } from './playerText';
import useRowNeed from './useRowNeed';
import type { TMusicDrop } from './useMusicDrop';

/**
 * WHAT PLAYS NEXT, AND WHAT COULD (Ivan, 2026-10-25): Up next and Playlists
 * as two pages of one space at the foot of the amp, each tab with how many
 * it holds, and how long the queue has left at the end of the row, then the
 * key that keeps the queue as a playlist and the fold.
 *
 * The space is whatever the amp has left under the sound, and the page
 * scrolls inside it: turning the page, a longer list or the sound folding
 * open changes what the page shows and never the amp's height (Ivan: "it
 * cannot change app height"). Folded to its tabs ("let's up next section be
 * collapsible too"), the picture at the top of the amp takes the room, and a
 * press on either tab opens it again on that page.
 */
const PlayerQueue = ({
  onOpenLibrary,
  musicDrop,
}: {
  onOpenLibrary: () => void;
  musicDrop: TMusicDrop;
}) => {
  const { t } = useTranslation();
  const { queuePage, setQueuePage } = usePlayerQueuePage();
  const { isShelfOpen, setShelfOpen } = usePlayerShelfOpen();
  const library = useLibraryDeck();
  const playlists = usePlaylistDeck();
  const [isNaming, setIsNaming] = useState(false);
  const pageId = useId();
  const tabsRef = useRef<HTMLDivElement>(null);
  useRowNeed(tabsRef, 'shelfTabs');
  const hasQueue = library !== undefined && library.total > 0;

  const tab = (
    value: TPlayerQueuePage,
    icon: TPlayerIconName,
    label: string,
    count: number | undefined,
  ) => (
    <button
      type="button"
      role="tab"
      className="player-shelf__tab"
      aria-selected={queuePage === value}
      aria-controls={pageId}
      onClick={() => {
        setQueuePage(value);
        setShelfOpen(true);
      }}
    >
      <PlayerIcon name={icon} />
      <span className="player-shelf__label">{label}</span>
      {count !== undefined && (
        <span className="player-shelf__count">{count}</span>
      )}
    </button>
  );

  return (
    // Not a named region of its own: its pages are named by their tabs, and
    // the queue on the first is the region called Up next (`QueueDeck`).
    <section className={`player-shelf${isShelfOpen ? '' : ' is-folded'}`}>
      <div className="player-shelf__tabs" role="tablist" ref={tabsRef}>
        {tab(
          'next',
          'upNext',
          t('library.upNext'),
          hasQueue ? library.total : undefined,
        )}
        {tab(
          'playlists',
          'playlists',
          t('library.browse.playlist'),
          playlists?.playlists.length,
        )}
        <span className="player-shelf__end">
          {hasQueue && (
            <span
              className="player-shelf__time"
              title={t('player.queue.leftHint', {
                duration: formatQueueTime(library.leftDurationMs),
              })}
            >
              {formatQueueTime(library.leftDurationMs)}
            </span>
          )}
          {queuePage === 'next' && (
            <QueueSaveKey
              isNaming={isNaming && isShelfOpen}
              onPress={() => {
                setIsNaming(!(isNaming && isShelfOpen));
                setShelfOpen(true);
              }}
            />
          )}
          <button
            type="button"
            className="player-shelf__key player-shelf__fold"
            aria-expanded={isShelfOpen}
            aria-controls={pageId}
            aria-label={
              isShelfOpen ? t('player.queue.fold') : t('player.queue.unfold')
            }
            title={
              isShelfOpen ? t('player.queue.fold') : t('player.queue.unfold')
            }
            onClick={() => setShelfOpen(!isShelfOpen)}
          >
            <PlayerIcon
              name="fold"
              className="player-icon player-shelf__chevron"
            />
          </button>
        </span>
      </div>
      {/* Laid out while folded, so it has a height to slide from, and inert,
          so nothing in it can be reached by the keyboard. */}
      <div
        className="player-shelf__page"
        id={pageId}
        role="tabpanel"
        inert={!isShelfOpen}
      >
        {queuePage === 'next' ? (
          <QueueDeck
            musicDrop={musicDrop}
            isNaming={isNaming}
            onNamed={() => setIsNaming(false)}
            onOpenLibrary={onOpenLibrary}
          />
        ) : (
          <PlaylistsDeck onOpenLibrary={onOpenLibrary} />
        )}
      </div>
    </section>
  );
};

export default PlayerQueue;
