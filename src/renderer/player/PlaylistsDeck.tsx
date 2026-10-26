/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import LibraryCoverArt from '../library/LibraryCoverArt';
import { useTranslation } from '../utils/I18nContext';
import PlayerIcon from './PlayerIcon';
import { usePlaylistDeck } from './playlistDeck';

/**
 * PLAYLISTS (Ivan, 2026-10-25): the queue's other page in the one amp —
 * Favourites and every playlist the Library keeps, each by its first song's
 * cover, its name, how many songs it holds and its Play. A press puts that
 * playlist on from its first song, as its own Play does in the Library, and
 * the Up next page is then that playlist.
 *
 * The playlists are the Library's, published from its providers
 * (`playlistDeck.ts`); before the Library has opened there are none to list,
 * which the page says, with the way to the Library.
 */
const PlaylistsDeck = ({ onOpenLibrary }: { onOpenLibrary: () => void }) => {
  const { t } = useTranslation();
  const deck = usePlaylistDeck();

  if (!deck || deck.playlists.length === 0) {
    return (
      <div className="player-queue__empty">
        <strong>{t('player.playlists.emptyTitle')}</strong>
        <span>{t('player.playlists.emptyNote')}</span>
        <button
          type="button"
          className="button small subtle player-queue__open"
          title={t('player.queue.openLibraryHint')}
          onClick={onOpenLibrary}
        >
          {t('tabs.library')}
          <PlayerIcon name="chevronRight" />
        </button>
      </div>
    );
  }

  return (
    <ul className="player-lists" aria-label={t('library.browse.playlist')}>
      {deck.playlists.map((playlist) => {
        const name = playlist.isFavorites
          ? t('library.playlist.favorites')
          : playlist.name;
        const isEmpty = playlist.count === 0;
        return (
          <li key={playlist.id} className="player-lists__row">
            <span className="player-lists__art">
              <LibraryCoverArt artId={playlist.artId} label={name} size="row" />
            </span>
            <span className="player-lists__words">
              <span className="player-lists__name">{name}</span>
              <span className="player-lists__count">
                {playlist.count === 1
                  ? t('library.playlist.songCountOne')
                  : t('library.playlist.songCount', { count: playlist.count })}
              </span>
            </span>
            <button
              type="button"
              className="player-lists__play"
              aria-label={`${t('library.play')} ${name}`}
              title={isEmpty ? t('library.playlist.empty') : undefined}
              disabled={isEmpty}
              onClick={() => deck.play(playlist.id)}
            >
              {t('library.play')}
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default PlaylistsDeck;
