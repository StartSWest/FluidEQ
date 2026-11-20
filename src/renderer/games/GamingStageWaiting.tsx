/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IGameProgram } from '../../common/games';
import type { IGameCopySound } from '../../common/gaming';
import { useTranslation } from '../utils/I18nContext';
import GameIcon from './GameIcon';
import GamingSoundSheet from './GamingSoundSheet';
import type { TGamingStage } from './gamingStages';

interface IGamingStageWaitingProps {
  game: Pick<IGameProgram, 'name' | 'icon' | 'source'>;
  /** What the game's sound plays; none until main has answered. */
  sound?: IGameCopySound;
  /** The part chosen in the rail. */
  stage: TGamingStage;
  /** Puts the game's sound on and opens that part. */
  onTune: (part: TGamingStage) => void;
  isBusy: boolean;
}

/**
 * Where a part's editor stands while the game's own sound is not the one
 * on. A sound that cannot be heard is not tuned blind, so the editors wait;
 * what stands here instead is the line saying so and everything that sound
 * does (`GamingSoundSheet`). A lone note in the middle of the page left the
 * rest of it empty (Ivan, 2026-11-19: "is too empty"). The way to put the
 * sound on is the header's Try it now and each part's Tune: a second lit
 * Try it now here stood a hand's width under the header's, two suggested
 * actions for one thing. Drawn by the page and by its Help drawing
 * (`help/live/gamingFigures`).
 */
const GamingStageWaiting = ({
  game,
  sound,
  stage,
  onTune,
  isBusy,
}: IGamingStageWaitingProps) => {
  const { t } = useTranslation();
  return (
    <div className="gaming-editor gaming-sheet">
      <div className="gaming-sheet__strip">
        <GameIcon program={game} className="gaming-sheet__icon" />
        <div className="gaming-sheet__say">
          <p className="gaming-sheet__title">
            {t('gaming.editor.notLoaded', { game: game.name })}
          </p>
          <p className="gaming-sheet__lead">
            {t('gaming.sheet.lead', { game: game.name })}
          </p>
        </div>
      </div>
      {sound && (
        <GamingSoundSheet
          gameName={game.name}
          sound={sound}
          stage={stage}
          onTune={onTune}
          isBusy={isBusy}
        />
      )}
    </div>
  );
};

export default GamingStageWaiting;
