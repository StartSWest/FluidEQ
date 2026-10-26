/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { MAX_PLAYLIST_NAME_LENGTH } from 'common/library/playlists';
import { useTranslation } from '../utils/I18nContext';
import TextInput from '../widgets/TextInput';
import PlayerIcon from './PlayerIcon';
import { useLibraryDeck } from './libraryDeck';
import { usePlaylistDeck } from './playlistDeck';

/**
 * The queue kept as a playlist (Ivan, 2026-10-25, the one amp's Up next):
 * the whole play order, first to last, under a name typed on the spot. The
 * key is a glyph on the queue's tabs, and the name is asked for in a line
 * over the list rather than in a menu, so nothing opens over the rows. The
 * line takes its room from the list's own, so asking for it never changes
 * the amp's height — the line the key used to stand in cost the queue a row
 * on a laptop's screen (Ivan, 2026-10-25: "try to fit it in my laptop").
 */
export const QueueSaveKey = ({
  isNaming,
  onPress,
}: {
  isNaming: boolean;
  onPress: () => void;
}) => {
  const { t } = useTranslation();
  const library = useLibraryDeck();
  const playlists = usePlaylistDeck();
  if (!library || !playlists || library.total === 0) {
    return null;
  }
  return (
    <button
      type="button"
      className="player-shelf__key"
      aria-pressed={isNaming}
      aria-label={t('player.queue.save')}
      title={t('player.queue.save')}
      onClick={onPress}
    >
      <PlayerIcon name="save" />
    </button>
  );
};

const QueueNaming = ({ onDone }: { onDone: () => void }) => {
  const { t } = useTranslation();
  const library = useLibraryDeck();
  const playlists = usePlaylistDeck();
  const [name, setName] = useState('');
  const fieldRef = useRef<HTMLInputElement>(null);
  // The field takes the typing the moment it appears.
  useEffect(() => {
    fieldRef.current?.focus();
  }, []);
  if (!library || !playlists || library.total === 0) {
    return null;
  }

  const save = (typed: string) => {
    const trimmed = typed.trim();
    if (!trimmed) {
      return;
    }
    playlists.create(trimmed, library.playOrder());
    onDone();
  };

  return (
    <div className="player-queue__naming">
      <TextInput
        ref={fieldRef}
        value={name}
        ariaLabel={t('library.playlist.newName')}
        placeholder={t('library.playlist.newName')}
        isDisabled={false}
        errorMessage=""
        formatInput={(value) => value.slice(0, MAX_PLAYLIST_NAME_LENGTH)}
        handleChange={setName}
        handleSubmit={save}
        handleEscape={onDone}
      />
      <button
        type="button"
        className="button small"
        disabled={name.trim().length === 0}
        onClick={() => save(name)}
      >
        {t('library.playlist.create')}
      </button>
      <button
        type="button"
        className="player-queue__cancel"
        aria-label={t('common.icon.cancel')}
        title={t('common.icon.cancel')}
        onClick={onDone}
      >
        <PlayerIcon name="close" />
      </button>
    </div>
  );
};

export default QueueNaming;
