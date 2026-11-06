/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IGameProfile } from '../../common/games';
import { useTranslation } from '../utils/I18nContext';
import GameIcon from './GameIcon';

interface IGamingGameRowProps {
  game: IGameProfile;
  /** The Gaming profile its copy started from, by name. */
  profileName: string;
  /** Whether its copy has moved away from that profile anywhere. */
  isTuned: boolean;
  isSelected: boolean;
  isPlaying: boolean;
  onSelect: () => void;
}

/**
 * One game in the Gaming Lab's list: what it is, what its sound started
 * from, and whether it is in front now. Drawn by the page and by its Help
 * drawing (`help/live/gamingFigures`).
 */
const GamingGameRow = ({
  game,
  profileName,
  isTuned,
  isSelected,
  isPlaying,
  onSelect,
}: IGamingGameRowProps) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`gaming-game${isSelected ? ' is-selected' : ''}${
        isPlaying ? ' is-playing' : ''
      }`}
      aria-current={isSelected ? 'true' : undefined}
      title={game.name}
      onClick={onSelect}
    >
      <span className="gaming-game__icon">
        <GameIcon program={game} />
      </span>
      <span className="gaming-game__what">
        <span className="gaming-game__name">{game.name}</span>
        <span className="gaming-game__from">
          <span className="gaming-game__source">
            {game.copyName ?? t('gaming.list.from', { profile: profileName })}
          </span>
          {isTuned && (
            <span className="gaming-game__tuned">
              {' · '}
              {t('gaming.list.tuned')}
            </span>
          )}
        </span>
      </span>
      {isPlaying && (
        <span className="gaming-game__playing">
          <span className="gaming-dot" aria-hidden="true" />
          {t('gaming.list.playing')}
        </span>
      )}
    </button>
  );
};

export default GamingGameRow;
