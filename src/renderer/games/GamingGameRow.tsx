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
 * One game in the Gaming Lab's rail (`StudioRail`): a shelf row of the
 * Library's rail, the game's own icon in the glyph's place and its name, the
 * one mark where the reader is. What its sound started from and
 * whether it was tuned are the panel's to say; the row keeps them in its
 * tooltip, which is also its name while the rail is folded to icons. A game
 * in front wears the live dot at the row's end, where a shelf keeps its
 * count. Drawn by the page and by its Help drawing (`help/live/gamingFigures`).
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
  const source =
    game.copyName ?? t('gaming.list.from', { profile: profileName });
  const tip = [
    game.name,
    isTuned ? `${source} · ${t('gaming.list.tuned')}` : source,
    isPlaying ? t('gaming.list.playing') : undefined,
  ]
    .filter(Boolean)
    .join('\n');
  return (
    <button
      type="button"
      className={`gaming-game${
        isSelected ? ' is-selected' : ''
      }${isPlaying ? ' is-playing' : ''}`}
      aria-current={isSelected ? 'true' : undefined}
      title={tip}
      onClick={onSelect}
    >
      <span className="gaming-game__icon">
        <GameIcon program={game} />
      </span>
      <span className="gaming-game__name studio-rail__word">{game.name}</span>
      {isPlaying && (
        <span className="gaming-game__live">
          <span className="gaming-dot" aria-hidden="true" />
          <span className="gaming-game__live-word">
            {t('gaming.list.playing')}
          </span>
        </span>
      )}
    </button>
  );
};

export default GamingGameRow;
