/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties, ReactNode } from 'react';
import { BRAND_MARK, PRODUCT_NAME } from '../../../common/branding';
import { DSP_PRESETS } from '../../../common/dsp/presets';
import type { TranslationKey } from '../../../common/i18n';
import { dspPresetName } from '../../dsp/dspPresetCatalog';
import BrandMark from '../../icons/BrandMark';
import { useTranslation } from '../../utils/I18nContext';
import sceneAlpine from '../../../../assets/tour/scene-alpine.jpg';
import sceneNeonCity from '../../../../assets/tour/scene-neon-city.jpg';

/**
 * Game presets, told as what happens on the desktop (Ivan, 2026-09-28: "what
 * happens if user minimized game but not close compared to standard cases"):
 * the game comes to the front and its sound loads, with the card FluidEQ puts
 * over it; the game is minimized or alt-tabbed out of and the sound stays,
 * because a game ends when its process does and not when it loses the front
 * (`gameWatch.ts`); the game is closed and the sound that was playing before
 * comes back, with the card saying so. The cards' words are the cards' own
 * (`games.toast.*`), and the presets' names the catalogue's.
 */

/** A real game, drawn as a tile in its colours rather than its logo. */
const GAME = {
  name: 'Counter-Strike 2',
  initials: 'CS',
  preset: 'gaming-competitive',
  colours: ['#f5a53a', '#b24d1c'] as const,
};

/** What was playing before the game, and comes back after it. */
const BEFORE = 'pop';

const presetName = (id: string, t: ReturnType<typeof useTranslation>['t']) => {
  const preset = DSP_PRESETS.find((entry) => entry.id === id);
  return preset ? dspPresetName(preset, t) : id;
};

/** The taskbar along a frame's foot: Start, a browser, FluidEQ, the game. */
function Taskbar({ game }: { game: 'front' | 'open' | 'gone' }) {
  return (
    <span className="game-story__taskbar">
      <span className="game-story__start" />
      <span className="game-story__app game-story__app--browser" />
      <span className="game-story__app">
        <BrandMark className="game-story__mark" />
      </span>
      {game !== 'gone' && (
        <span
          className={`game-story__app game-story__app--game${
            game === 'front' ? ' is-front' : ''
          }`}
        >
          {GAME.initials}
        </span>
      )}
    </span>
  );
}

/**
 * FluidEQ's card on the desktop, as `assets/game-toast.html` draws it: the
 * game's own icon in a tinted badge, what happened and for which game, and
 * FluidEQ's wave and name at its end. Both cards, loading and restoring,
 * carry the game's icon.
 */
function Card({ title, detail }: { title: string; detail: string }) {
  return (
    <span className="game-story__card">
      <span className="game-story__badge">
        <span className="game-story__tile">{GAME.initials}</span>
      </span>
      <span className="game-story__words">
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <span className="game-story__brand">
        <svg className="game-story__wave" viewBox={BRAND_MARK.viewBox}>
          <path d={BRAND_MARK.path} />
        </svg>
        {PRODUCT_NAME}
      </span>
    </span>
  );
}

function Frame({
  step,
  caption,
  children,
}: {
  step: number;
  caption: TranslationKey;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <li className="game-story__frame">
      <span className="game-story__caption">
        <span className="game-story__step">{step}</span>
        {t(caption)}
      </span>
      <span className="game-story__screen">{children}</span>
    </li>
  );
}

export default function GameStoryVisual() {
  const { t } = useTranslation();
  const gamePreset = presetName(GAME.preset, t);
  const beforePreset = presetName(BEFORE, t);
  return (
    <div
      className="game-story"
      role="img"
      aria-label={t('tour.games.imageAlt')}
      style={
        {
          '--game-from': GAME.colours[0],
          '--game-to': GAME.colours[1],
        } as CSSProperties
      }
    >
      <ol className="game-story__frames">
        <Frame step={1} caption="tour.games.stepFront">
          <span className="game-story__game">
            <img className="game-story__world" src={sceneNeonCity} alt="" />
            <span className="game-story__minimap" />
            <span className="game-story__crosshair" />
            <span className="game-story__health" />
            <span className="game-story__ammo">30 / 90</span>
          </span>
          <Card
            title={t('games.toast.loaded', { preset: gamePreset })}
            detail={t('games.toast.forGame', { game: GAME.name })}
          />
          <Taskbar game="front" />
        </Frame>

        {/* No card while the game is only out of sight: FluidEQ's window
            says it, on Game presets, in its own words. */}
        <Frame step={2} caption="tour.games.stepAway">
          <img className="game-story__wallpaper" src={sceneAlpine} alt="" />
          <span className="game-story__window">
            <span className="game-story__window-bar">
              <BrandMark className="game-story__mark" />
              {t('tabs.games')}
            </span>
            <span className="game-story__front">
              <span className="game-story__pip" />
              {t('games.front.sounding', { name: GAME.name })}
            </span>
          </span>
          <Taskbar game="open" />
        </Frame>

        <Frame step={3} caption="tour.games.stepClosed">
          <img className="game-story__wallpaper" src={sceneAlpine} alt="" />
          <Card
            title={t('games.toast.restored', { preset: beforePreset })}
            detail={t('games.toast.afterGame', { game: GAME.name })}
          />
          <Taskbar game="gone" />
        </Frame>
      </ol>
    </div>
  );
}
