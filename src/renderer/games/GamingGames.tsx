/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ComponentProps } from 'react';
import { gamingProfileOf, IGameProfile } from '../../common/games';
import { useTranslation } from '../utils/I18nContext';
import GamingGamePanel from './GamingGamePanel';
import GamingGameRow from './GamingGameRow';
import { gamingProfileEntry } from './gamingCatalog';
import { useLoadedGame } from './gameSoundStore';
import { useGameTuned, useYoursGamingProfiles } from './useGamingData';

/**
 * A row, told by main whether its game's copy has moved away from the
 * profile it started from — the copy on now is read live, any other from its
 * file (`useGameTuned`).
 */
const TunedGameRow = ({
  game,
  profileName,
  isSelected,
  isPlaying,
  isLoaded,
  onSelect,
}: Omit<ComponentProps<typeof GamingGameRow>, 'isTuned'> & {
  isLoaded: boolean;
}) => {
  const tuned = useGameTuned(game.id, isLoaded);
  return (
    <GamingGameRow
      game={game}
      profileName={profileName}
      isTuned={tuned.length > 0}
      isSelected={isSelected}
      isPlaying={isPlaying}
      onSelect={onSelect}
    />
  );
};

interface IGamingGamesProps {
  games: readonly IGameProfile[];
  /** The Gaming Lab's switch: off, the list reads as standing by. */
  isOn: boolean;
  playingId?: string;
  soundingId?: string;
  selectedId?: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

/**
 * The listener's games down the side and the chosen one's sound beside them.
 *
 * Which game is shown when none was chosen is the one being played, then the
 * one whose sound is on, then the first: the page is mostly opened from a
 * game, alt-tabbed out of, and that game is the one it should open on.
 */
const GamingGames = ({
  games,
  isOn,
  playingId,
  soundingId,
  selectedId,
  onSelect,
  onAdd,
}: IGamingGamesProps) => {
  const { t } = useTranslation();
  const yours = useYoursGamingProfiles();
  const { gameId: loadedId } = useLoadedGame();

  if (games.length === 0) {
    return (
      <div className="games-empty">
        {/* The page's own picture, at the size an empty page can carry: a pad
            with a sound coming off it, which is the whole feature in one
            drawing. */}
        <svg
          className="games-empty__art"
          viewBox="0 0 120 72"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path
            className="games-empty__body"
            d="M30 20h20a16 16 0 0 1 16 16v3a11 11 0 0 1-19.6 6.9L44 43H36l-2.4 2.9A11 11 0 0 1 14 39v-3a16 16 0 0 1 16-16z"
          />
          <path
            className="games-empty__pad"
            strokeWidth="2.2"
            d="M24 32v8M20 36h8M52 32.5h.01M58 38h.01M46 38h.01M52 43.5h.01"
          />
          <path
            className="games-empty__wave"
            strokeWidth="2.4"
            d="M78 26a14 14 0 0 1 0 20"
          />
          <path
            className="games-empty__wave"
            strokeWidth="2.4"
            d="M88 18a25 25 0 0 1 0 36"
          />
          <path
            className="games-empty__wave"
            strokeWidth="2.4"
            d="M98 10a36 36 0 0 1 0 52"
          />
        </svg>
        <p className="games-empty__title">{t('gaming.empty.title')}</p>
        <p className="games-empty__more">{t('gaming.empty.more')}</p>
        <button type="button" className="button small" onClick={onAdd}>
          {t('gaming.add')}
        </button>
      </div>
    );
  }

  const shown =
    games.find((game) => game.id === selectedId) ??
    games.find((game) => game.id === playingId) ??
    games.find((game) => game.id === soundingId) ??
    games[0];

  return (
    <div className={`gaming-games${isOn ? '' : ' is-off'}`}>
      <div className="gaming-games__list">
        <span className="gaming-cap">
          {t('gaming.list.count', { count: games.length })}
        </span>
        {games.map((game) => (
          <TunedGameRow
            key={game.id}
            game={game}
            profileName={
              gamingProfileEntry(gamingProfileOf(game), yours, t).name
            }
            isSelected={game.id === shown.id}
            isPlaying={game.id === playingId}
            isLoaded={game.id === loadedId}
            onSelect={() => onSelect(game.id)}
          />
        ))}
      </div>
      <GamingGamePanel
        key={shown.id}
        game={shown}
        yours={yours}
        isLoaded={shown.id === loadedId}
        isPlaying={shown.id === playingId}
      />
    </div>
  );
};

export default GamingGames;
