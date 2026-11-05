/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IGameProfile } from '../../common/games';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import GameIcon from './GameIcon';
import usePlayingGamePreset, {
  type IPlayingGamePreset,
} from './usePlayingGamePreset';

interface IGamingNowPlayingTagProps {
  /** The game whose own sound is on. */
  game: IGameProfile;
  /** The preset that game's sound plays, if it plays one. */
  preset: IPlayingGamePreset | undefined;
  /** Brings that game up in the list. */
  onShow: () => void;
}

/**
 * The tag itself, given what it says: the preset in the glyph and name its
 * Preset chip wears, then the game. A game kept as it was mixed plays none,
 * and shows the game alone. What's New draws the Lab with this one
 * (`GamingLabVisual`), handing it a preset instead of the window's.
 */
export const GamingNowPlayingTag = ({
  game,
  preset,
  onShow,
}: IGamingNowPlayingTagProps) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="gaming-now"
      title={t('gaming.now.hint', { game: game.name })}
      onClick={onShow}
    >
      <span className="gaming-now__dot" aria-hidden="true" />
      {preset ? (
        <VoicingIcon profileId={preset.glyph} className="gaming-now__glyph" />
      ) : (
        <GameIcon program={game} className="gaming-now__glyph" />
      )}
      {preset && <span className="gaming-now__preset">{preset.name}</span>}
      <span className="gaming-now__game">{game.name}</span>
    </button>
  );
};

interface IGamingNowPlayingProps {
  /** The game whose own sound is on. */
  game: IGameProfile;
  /** Brings that game up in the list. */
  onShow: () => void;
}

/**
 * What is playing, on the Gaming Lab's top line whatever view or game is
 * open (Ivan, 2026-11-03: "we need to show the current game preset that is
 * playing ... in gaming lab with icon"), as the window's Preset layer has
 * it. A press brings the game up, the way the EQ page's preset button brings
 * the Lab up.
 */
const GamingNowPlaying = ({ game, onShow }: IGamingNowPlayingProps) => (
  <GamingNowPlayingTag
    game={game}
    preset={usePlayingGamePreset()}
    onShow={onShow}
  />
);

export default GamingNowPlaying;
