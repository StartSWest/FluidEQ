/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IGameProfile } from '../../../common/games';
import type { ErrorDescription } from '../../../common/errors';
import GameIcon from '../../games/GameIcon';
import { openGamingLab } from '../../games/gamingLabEvents';
import usePlayingGamePreset from '../../games/usePlayingGamePreset';
import { putMusicSoundBack } from '../../games/useGameSound';
import Chevron from '../../icons/Chevron';
import MenuIcon from '../../icons/MenuIcon';
import VoicingIcon from '../../icons/VoicingIcon';
import { useFluidEqShell } from '../../utils/FluidEqContext';
import { useTranslation } from '../../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../../widgets/AnchoredMenu';
import useCardDismissal from './useCardDismissal';
import WavePresetCard from './WavePresetCard';

/**
 * The plate while a game's own sound is on: the game's name with the live
 * dot its Gaming Lab tab wears, and on a press a short menu of what can be
 * done from here — the music sound back, first, and the Gaming Lab at its
 * foot.
 *
 * Not the presets list. The game is the preset then, tuned in the Gaming Lab
 * and nowhere else (Ivan, 2026-11-03: a preset picked into a game's sound
 * from the main screen "will complicate things"), so the player's deck sends
 * a press straight to the Lab (`GameSoundPresetButton`) and this one offers
 * the two ways out of the game's sound instead.
 */
const WavePresetGame = ({ game }: { game: IGameProfile }) => {
  const { t } = useTranslation();
  const { setGlobalError } = useFluidEqShell();
  const preset = usePlayingGamePreset();
  const card = useCardDismissal();
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // The keyboard lands on the first thing to do once the menu is drawn
  // (AnchoredMenu draws nothing until it has placed it). Stable, so it runs
  // once per opening.
  const arrive = useCallback((first: HTMLButtonElement | null) => {
    first?.focus();
  }, []);

  // Closed by a press anywhere else and by Escape, as every menu here is,
  // with the focus handed back to the plate when it was inside the menu.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const close = (event: Event) => {
      if (
        !rootRef.current?.contains(event.target as Node) &&
        !isInsideAnchoredMenu(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      if (isInsideAnchoredMenu(document.activeElement)) {
        triggerRef.current?.focus();
      }
      setIsOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const backToMusic = () => {
    setIsOpen(false);
    card.dismiss();
    setIsBusy(true);
    putMusicSoundBack()
      .catch((error: unknown) => setGlobalError(error as ErrorDescription))
      .finally(() => setIsBusy(false));
  };
  const openLab = () => {
    setIsOpen(false);
    card.dismiss();
    openGamingLab();
  };
  const liveDot = (
    <span className="workspace-tab__live wave-preset__live" aria-hidden />
  );

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- it hears the keys and the pointer of the plate and card inside it, which are the controls
    <div
      className="wave-preset__holder"
      onPointerLeave={card.onPointerLeave}
      onBlur={card.onBlur}
      onKeyDown={card.onKeyDown}
    >
      <div
        ref={rootRef}
        className={`rich-pick wave-preset__pick${
          card.isDismissed ? ' is-card-dismissed' : ''
        }`}
      >
        <button
          ref={triggerRef}
          type="button"
          className="rich-pick__trigger is-active wave-preset__plate is-game"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label={t('wavePreset.gameLabel', { game: game.name })}
          onClick={() => setIsOpen(!isOpen)}
        >
          <GameIcon
            program={game}
            className="rich-pick__glyph wave-preset__glyph"
          />
          <span className="rich-pick__label wave-preset__name">
            {game.name}
          </span>
          {liveDot}
          <Chevron className="rich-pick__caret" />
        </button>

        <WavePresetCard
          glyph={
            <GameIcon program={game} className="wave-preset-card__glyph" />
          }
          name={
            <>
              {game.name}
              {liveDot}
            </>
          }
          label={game.name}
          line={t('wavePreset.gameOn', { game: game.name })}
          actions={
            <>
              <button
                type="button"
                className="button small"
                disabled={isBusy}
                onClick={backToMusic}
              >
                {t('wavePreset.backToMusic')}
              </button>
              <button
                type="button"
                className="button small subtle"
                onClick={openLab}
              >
                {t('wavePreset.openLab')}
              </button>
            </>
          }
        >
          {/* The curve the game's sound plays, named as its chip names it
              ("Competitive"). */}
          {preset && (
            <div className="eq-preset-tab__stages wave-preset-card__stages">
              <ul>
                <li className="wave-preset-card__chip">
                  <VoicingIcon
                    profileId={preset.glyph}
                    className="wave-preset-card__chip-glyph"
                  />
                  {preset.name}
                </li>
              </ul>
            </div>
          )}
        </WavePresetCard>

        <AnchoredMenu
          anchor={rootRef.current}
          isOpen={isOpen}
          className="rich-pick__menu dsp-chain-preset-menu wave-preset__menu"
        >
          <p className="wave-preset__menu-note">
            {t('wavePreset.gameOn', { game: game.name })}
          </p>
          <div className="rich-pick__list">
            <button
              ref={arrive}
              type="button"
              role="menuitem"
              className="rich-pick__item"
              disabled={isBusy}
              onClick={backToMusic}
            >
              <VoicingIcon profileId="music" className="rich-pick__glyph" />
              <span>
                <strong>{t('wavePreset.backToMusic')}</strong>
                <small>{t('gaming.action.unloadHint')}</small>
              </span>
            </button>
          </div>
          <div className="rich-pick__footer">
            <button
              type="button"
              role="menuitem"
              className="rich-pick__action"
              onClick={openLab}
            >
              <MenuIcon name="gamepad" />
              <span>{t('wavePreset.openLab')}</span>
            </button>
          </div>
        </AnchoredMenu>
      </div>
    </div>
  );
};

export default WavePresetGame;
