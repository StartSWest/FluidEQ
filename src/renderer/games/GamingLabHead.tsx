/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ReactNode, useId } from 'react';
import MenuIcon from '../icons/MenuIcon';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import '../styles/GameModeSwitch.scss';
import '../styles/Games.scss';

export type TGamingLabView = 'games' | 'profiles';

interface IGamingLabHeadProps {
  view: TGamingLabView;
  onView: (view: TGamingLabView) => void;
  /** Whether a game in front switches to its own sound. */
  isOn: boolean;
  onToggle: () => void;
  onAdd: () => void;
  /**
   * Game mode and the delay it leaves, beside the switch (`ListenedLatency`):
   * the page's, which reads the listener's own output. A drawing of the
   * page, which reads nothing of theirs, leaves it out.
   */
  gameMode?: ReactNode;
  /**
   * What is playing (`GamingNowPlaying`), first on the line, while a game's
   * own sound is on.
   */
  nowPlaying?: ReactNode;
}

/**
 * The Gaming Lab's top line: its two views, the switch that lets a game in
 * front put its own sound on, Game mode beside it — on by itself while a
 * game's sound plays, so it is seen being on (Ivan, 2026-11-03: "add same
 * game mode toggle to gaming lab so is visible there") — and Add a game.
 * The page and its Help drawing (`help/live/gamingFigures`) both draw this
 * one.
 */
const GamingLabHead = ({
  view,
  onView,
  isOn,
  onToggle,
  onAdd,
  gameMode,
  nowPlaying,
}: IGamingLabHeadProps) => {
  const { t } = useTranslation();
  const switchId = useId();
  return (
    <div className="gaming-lab__head">
      <div
        className="gaming-lab__views"
        role="tablist"
        aria-label={t('gaming.tab')}
      >
        {(['games', 'profiles'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            className={`gaming-lab__view${view === id ? ' is-active' : ''}`}
            onClick={() => onView(id)}
          >
            {id === 'games'
              ? t('gaming.view.games')
              : t('gaming.view.profiles')}
          </button>
        ))}
      </div>
      <div className="gaming-lab__head-actions">
        {nowPlaying}
        <div
          className={`game-mode-switch${isOn ? ' is-on' : ''}`}
          title={t('gaming.switch.hint')}
        >
          <label htmlFor={switchId} className="game-mode-switch__label">
            <VoicingIcon profileId="games" className="game-mode-switch__icon" />
            <span className="game-mode-switch__word">{t('gaming.switch')}</span>
          </label>
          <Switch
            id={switchId}
            isOn={isOn}
            isDisabled={false}
            handleToggle={onToggle}
            ariaLabel={t('gaming.switch')}
          />
        </div>
        {gameMode}
        <button
          type="button"
          className="button small subtle gaming-lab__add"
          onClick={onAdd}
        >
          <MenuIcon name="plus" />
          {t('gaming.add')}
        </button>
      </div>
    </div>
  );
};

export default GamingLabHead;
